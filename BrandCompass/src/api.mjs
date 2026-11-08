import { seedState, demoDraft } from './seed.mjs';
import { reviewContent, insights, retrieve } from './engine.mjs';
import { addAIReview } from './ai.mjs';
import { renderReport, renderCSV } from './reports.mjs';
import { uuid, timestamp, sha256, passwordHash, safeEqual, appendAudit, verifyAudit, securityHeaders } from './security.mjs';

class AppError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new AppError(status,message);};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...securityHeaders,...extra}});
const str=(value,min=0,max=200)=>typeof value==='string'&&value.trim().length>=min&&value.length<=max?value.trim():fail(400,`Enter text between ${min} and ${max} characters.`);
const checkRole=(u,roles)=>{if(!roles.includes(u.role))fail(403,'Your role cannot perform this action.');};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES=['admin','manager','reviewer','creator'];
const HEX=/^#[\da-fA-F]{6}$/;
const safeUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,org_id:u.org_id});
async function body(request){
  if(!request.headers.get('content-type')?.includes('application/json'))fail(415,'Use a JSON request.');
  const text=await request.text();if(text.length>600000)fail(413,'Request is too large.');
  try{const data=JSON.parse(text);if(!data||Array.isArray(data)||typeof data!=='object')throw 0;return data;}catch{fail(400,'Invalid JSON request.');}
}
async function rateLimit(db,key,limit=40){
  const now=Date.now(),window=60000;
  await db.prepare('INSERT INTO rate_limits(key,count,resets_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at < ? THEN 1 ELSE count+1 END, resets_at=CASE WHEN resets_at < ? THEN ? ELSE resets_at END').bind(key,now+window,now,now,now+window).run();
  const row=await db.prepare('SELECT count FROM rate_limits WHERE key=?').bind(key).first();if(row.count>limit)fail(429,'Too many requests. Please try again in a minute.');
}
async function sessionUser(request,db){
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)bc_session=([^;]+)/)?.[1];
  if(!token)return null;
  return db.prepare('SELECT u.*, o.is_demo, o.name AS org_name FROM sessions s JOIN users u ON u.id=s.user_id JOIN organisations o ON o.id=u.org_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token),Date.now()).first();
}
async function sessionResponse(request,db,user){
  const token=uuid()+uuid();const tokenHash=await sha256(token);
  // Revoke the caller's previous session, including on demo role switch.
  const old=request.headers.get('cookie')?.match(/(?:^|;\s*)bc_session=([^;]+)/)?.[1];
  if(old)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(old)).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(tokenHash,user.id,Date.now()+8*3600000).run();
  return json({user:safeUser(user)},200,{'Set-Cookie':`bc_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${new URL(request.url).protocol==='https:'?'; Secure':''}`});
}
async function loadOrg(db,u){const row=await db.prepare('SELECT * FROM organisations WHERE id=?').bind(u.org_id).first();if(!row)fail(404,'Workspace not found.');return {...row,data:JSON.parse(row.state)};}
async function saveOrg(db,org,data){
  const serialized=JSON.stringify(data);if(serialized.length>1700000)fail(413,'Demo storage limit reached. Export your work and create another workspace.');
  const result=await db.prepare('UPDATE organisations SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(serialized,org.id,org.revision).run();
  if(result.meta.changes!==1)fail(409,'This workspace changed in another session. Reload and try again.');
}
function assertRevision(org,data){if(data.revision!==org.revision)fail(409,'Your view is out of date. Reload before changing this workspace.');}
function draftInput(d){
  const title=str(d.title,1,120),text=str(d.text,0,16000),channel=str(d.channel,1,40),audience=str(d.audience||'',0,160),alt=str(d.alt||'',0,700);
  if(!['Instagram','LinkedIn','Website','Email','Press release'].includes(channel))fail(400,'Select a supported channel.');
  const foreground=d.foreground||'',background=d.background||'';if((foreground||background)&&(!HEX.test(foreground)||!HEX.test(background)))fail(400,'Choose two valid six-digit hex colours.');
  let image=null;
  if(d.image){
    if(typeof d.image!=='object'||!['photo','graphic','logo'].includes(d.image.kind)||!/^([a-f0-9]{64})$/.test(d.image.sha256||''))fail(400,'Invalid image metadata.');
    const width=Number(d.image.width),height=Number(d.image.height);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>25000000)fail(400,'Image dimensions exceed the supported limit.');
    const colors=d.image.colors;if(!Array.isArray(colors)||colors.length>8||colors.some(c=>!HEX.test(c)))fail(400,'Invalid image colours.');
    const thumb=d.image.thumbnail||'';if(thumb&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(thumb)||thumb.length>150000))fail(400,'Invalid image preview.');
    image={name:str(d.image.name,1,160),width,height,sha256:d.image.sha256,kind:d.image.kind,colors,thumbnail:thumb,decorative:d.image.decorative===true};
  }
  if(!text&&!image)fail(400,'Add some text or an image to review.');
  return {title,text,channel,audience,alt,foreground,background,largeText:d.largeText===true,image,campaign:str(d.campaign||'',0,100),useAI:d.useAI===true};
}
async function analyze(draft,state,env){return addAIReview(reviewContent(draft,state),draft,state,env);}
function canEdit(user,r){if(!(user.role==='admin'||user.role==='manager'||(user.role==='creator'&&r.created_by===user.id)))fail(403,'Only the creator or a brand manager can edit this draft.');}
function snapshot(r){return {version:r.version,at:timestamp(),text:r.text,title:r.title,alt:r.alt,channel:r.channel,foreground:r.foreground,background:r.background,largeText:r.largeText,image:r.image,analysis:structuredClone(r.analysis),status:r.status,decisions:structuredClone(r.analysis?.findings||[])};}
function reversion(r,draft,analysis,user){if(r.versions.length>=12)fail(400,'This demo keeps at most 12 revisions per draft. Create a new draft to continue.');r.versions.push(snapshot(r));Object.assign(r,draft,{analysis,version:r.version+1,status:'draft',last_editor:user.id,updated_at:timestamp(),approved_by:null,approved_at:null});}

export async function handleApi(request,env){
  try{
    const url=new URL(request.url),path=url.pathname,method=request.method,db=env.DB;
    if(!db)fail(503,'Database is unavailable. Check the server setup.');
    if(method==='GET'&&path==='/api/health')return json({ok:true,version:'1.0.0'});
    if(!['GET','HEAD'].includes(method)){
      if(request.headers.get('X-BC-Request')!=='1')fail(403,'Missing request guard.');
      const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Cross-origin changes are not allowed.');
    }
    const ip=request.headers.get('cf-connecting-ip')||'local';
    if(method==='POST'&&['/api/login','/api/signup','/api/demo'].includes(path))await rateLimit(db,'auth:'+ip,30);
    if(method==='POST'&&path==='/api/login'){
      const data=await body(request),email=str(data.email,3,200).toLowerCase(),password=str(data.password,1,200);
      await rateLimit(db,'email:'+await sha256(email),10);
      const user=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      const candidate=await passwordHash(password,user?.salt||'nonexistent-account');
      if(!user||!safeEqual(candidate,user.password_hash))fail(401,'Email or password is incorrect.');return sessionResponse(request,db,user);
    }
    if(method==='POST'&&path==='/api/signup'){
      if(env.ALLOW_SIGNUP==='false')fail(403,'New workspaces are disabled by the administrator.');
      const data=await body(request),email=str(data.email,3,200).toLowerCase(),password=str(data.password,10,200),name=str(data.name,2,80),orgName=str(data.organisation,2,100);
      if(!EMAIL.test(email))fail(400,'Enter a valid email address.');
      if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())fail(409,'That email is already registered.');
      const orgId=uuid(),user={id:uuid(),org_id:orgId,email,name,role:'admin'},salt=uuid(),state=seedState();
      await appendAudit(state,user,'workspace.created',orgId,'New workspace with fictional sample guidelines.');
      await db.batch([
        db.prepare('INSERT INTO organisations(id,name,state,created_at) VALUES (?,?,?,?)').bind(orgId,orgName,JSON.stringify(state),timestamp()),
        db.prepare('INSERT INTO users(id,org_id,email,name,role,password_hash,salt,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(user.id,orgId,email,name,'admin',await passwordHash(password,salt),salt,timestamp())
      ]);return sessionResponse(request,db,user);
    }
    if(method==='POST'&&path==='/api/demo'){
      const orgId=uuid(),state=seedState(),people=ROLES.map(role=>({id:uuid(),org_id:orgId,email:`${role}.${orgId}@demo.local`,name:{admin:'Alex Morgan',manager:'Maya Chen',reviewer:'Jordan Lee',creator:'Sam Rivera'}[role],role}));
      const creator=people.find(p=>p.role==='creator'),analysis=reviewContent(demoDraft,state);
      state.reviews.push({...demoDraft,id:uuid(),created_by:creator.id,created_name:creator.name,last_editor:creator.id,created_at:timestamp(),updated_at:timestamp(),version:1,status:'draft',analysis,versions:[],comments:[]});
      await appendAudit(state,creator,'demo.created',orgId,'Isolated demo workspace; all brand data is fictional.');
      const statements=[db.prepare('INSERT INTO organisations(id,name,is_demo,state,created_at) VALUES (?,?,1,?,?)').bind(orgId,'Verdant demo',JSON.stringify(state),timestamp()),...people.map(p=>db.prepare('INSERT INTO users(id,org_id,email,name,role,password_hash,salt,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(p.id,orgId,p.email,p.name,p.role,uuid(),uuid(),timestamp()))];
      await db.batch(statements);return sessionResponse(request,db,creator);
    }
    const user=await sessionUser(request,db);if(!user)fail(401,'Sign in to continue.');
    if(method==='POST'&&path==='/api/logout'){
      const token=request.headers.get('cookie')?.match(/(?:^|;\s*)bc_session=([^;]+)/)?.[1];
      await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token||'')).run();
      return json({ok:true},200,{'Set-Cookie':'bc_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});
    }
    if(method==='POST'&&path==='/api/demo/role'){
      if(!user.is_demo)fail(403,'Role switching is available only in an isolated demo.');
      const data=await body(request);if(!ROLES.includes(data.role))fail(400,'Unknown role.');
      const next=await db.prepare('SELECT * FROM users WHERE org_id=? AND role=?').bind(user.org_id,data.role).first();return sessionResponse(request,db,next);
    }
    const org=await loadOrg(db,user),state=org.data;
    if(method==='GET'&&path==='/api/state')return json({user:safeUser(user),organisation:{id:org.id,name:org.name,is_demo:!!org.is_demo},revision:org.revision,state,insights:insights(state),ai_available:!!env.OPENAI_API_KEY});
    if(method==='GET'&&path==='/api/search')return json({results:retrieve((url.searchParams.get('q')||'').slice(0,500),[...state.rules,...state.facts],10)});
    if(method==='GET'&&path==='/api/audit')return json({valid:await verifyAudit(state.audit),events:state.audit});
    const reportMatch=path.match(/^\/api\/reports\/([^/]+)\/(html|json|csv)$/);
    if(method==='GET'&&reportMatch){
      const r=state.reviews.find(x=>x.id===reportMatch[1]);if(!r)fail(404,'Review not found in this workspace.');
      const format=reportMatch[2],content=format==='html'?renderReport(r):format==='csv'?renderCSV(r):JSON.stringify(r,null,2);
      return new Response(content,{headers:{...securityHeaders,'Cache-Control':'no-store','Content-Type':({html:'text/html; charset=utf-8',csv:'text/csv; charset=utf-8',json:'application/json; charset=utf-8'})[format],'Content-Disposition':`${url.searchParams.get('inline')==='1'&&format==='html'?'inline':'attachment'}; filename="BrandCompass_Review.${format}"`}});
    }
    if(method==='GET'&&path==='/api/export')return json({exported_at:timestamp(),format:'brandcompass-workspace-v1',organisation:org.name,...state});
    if(path==='/api/members'&&method==='GET'){
      checkRole(user,['admin']);return json({members:(await db.prepare('SELECT id,email,name,role FROM users WHERE org_id=?').bind(user.org_id).all()).results});
    }
    if(path==='/api/members'&&method==='POST'){
      checkRole(user,['admin']);const data=await body(request);const email=str(data.email,3,200).toLowerCase(),name=str(data.name,2,80),password=str(data.password,10,200);
      if(!EMAIL.test(email)||!ROLES.includes(data.role))fail(400,'Check the email and role.');
      if((await db.prepare('SELECT COUNT(*) AS n FROM users WHERE org_id=?').bind(user.org_id).first()).n>=20)fail(400,'Demo member limit reached.');
      if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())fail(409,'Email is already registered.');
      assertRevision(org,data);const id=uuid(),salt=uuid();await appendAudit(state,user,'member.created',id,`${name}: ${data.role}`);
      // The organisation CAS and member insertion must succeed together.
      const statements=[
        db.prepare('INSERT INTO users(id,org_id,email,name,role,password_hash,salt,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM organisations WHERE id=? AND revision=?)').bind(id,org.id,email,name,data.role,await passwordHash(password,salt),salt,timestamp(),org.id,org.revision),
        db.prepare('UPDATE organisations SET state=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),org.id,org.revision)
      ];
      const result=await db.batch(statements);if(result[1].meta.changes!==1)fail(409,'Workspace changed. Reload and try again.');return json({ok:true});
    }
    if(method!=='POST')fail(404,'Endpoint not found.');
    await rateLimit(db,'user:'+user.id,90);
    const data=await body(request);assertRevision(org,data);
    if(path==='/api/knowledge'){
      checkRole(user,['admin','manager']);state.knowledge_history ||= [];
      state.knowledge_history.push({version:state.knowledge_version,at:timestamp(),rules:structuredClone(state.rules),facts:structuredClone(state.facts),brand:structuredClone(state.brand),assets:structuredClone(state.assets)});
      if(state.knowledge_history.length>20)state.knowledge_history.shift();
      if(data.kind==='fact'){
        if(state.facts.length>=50&&!data.id)fail(400,'Demo fact limit reached.');
        const prev=state.facts.find(f=>f.id===data.id);if(data.id&&!prev)fail(404,'Fact not found.');
        const validUntil=str(data.valid_until||'',0,10);if(validUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))fail(400,'Use a YYYY-MM-DD expiry date.');
        const item={id:prev?.id||uuid(),title:str(data.title,2,100),text:str(data.text,5,2000),source:str(data.source,2,160),version:(prev?.version||0)+1,valid_until:validUntil,active:data.active!==false};
        if(prev)Object.assign(prev,item);else state.facts.push(item);
      }else if(data.kind==='rule'){
        const prev=state.rules.find(r=>r.id===data.id);if(data.id&&!prev)fail(404,'Rule not found.');
        if(state.rules.length>=40&&!prev)fail(400,'Demo rule limit reached.');
        if(!['term','tone','claims','alt','contrast','palette','asset','readability','disclaimer'].includes(data.type)||!['low','medium','high'].includes(data.severity))fail(400,'Invalid rule type or severity.');
        let config={};
        if(data.type==='term'){if(!Array.isArray(data.terms)||data.terms.length>20||!data.terms.length)fail(400,'Add at least one term replacement.');config.terms=data.terms.map(t=>({term:str(t.term,1,80),replacement:str(t.replacement,1,100)}));}
        if(data.type==='tone')config.phrases=String(data.phrases||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,20);
        if(data.type==='disclaimer')config.text=str(data.required_text||'Terms apply.',1,300);
        if(data.type==='palette')config.tolerance=50;
        if(data.type==='readability')config.maxWords=26;
        const item={id:prev?.id||uuid(),title:str(data.title,2,100),body:str(data.text,5,2000),source:str(data.source,2,160),version:(prev?.version||0)+1,type:data.type,severity:data.severity,config,active:data.active!==false,updated_at:timestamp()};
        if(prev)Object.assign(prev,item);else state.rules.push(item);
      }else if(data.kind==='brand'){
        if(!Array.isArray(data.palette)||data.palette.length<2||data.palette.length>10||data.palette.some(c=>!HEX.test(c)))fail(400,'Provide 2 to 10 six-digit hex colours.');
        state.brand={...state.brand,name:str(data.name,2,80),tagline:str(data.tagline||'',0,160),palette:data.palette};
      }else if(data.kind==='asset'){
        if(!/^[a-f0-9]{64}$/.test(data.sha256||''))fail(400,'Invalid asset fingerprint.');
        if(state.assets.length>=30)fail(400,'Demo asset limit reached.');
        if(state.assets.some(a=>a.sha256===data.sha256))fail(409,'This file is already approved.');
        state.assets.push({id:uuid(),name:str(data.name,1,160),sha256:data.sha256,approved_by:user.name,at:timestamp()});
      }else fail(400,'Unknown knowledge item.');
      state.knowledge_version++;await appendAudit(state,user,'knowledge.updated',data.id||data.kind,`Knowledge version ${state.knowledge_version}`);
      await saveOrg(db,org,state);return json({ok:true});
    }
    if(path==='/api/reviews'){
      checkRole(user,['creator','manager','admin']);if(state.reviews.length>=40)fail(400,'Demo limit of 40 drafts reached. Export your workspace to retain your work.');
      const draft=draftInput(data),analysis=await analyze(draft,state,env),id=uuid();
      state.reviews.unshift({...draft,id,created_by:user.id,created_name:user.name,last_editor:user.id,version:1,status:'draft',created_at:timestamp(),updated_at:timestamp(),analysis,versions:[],comments:[]});
      await appendAudit(state,user,'review.created',id,'Initial review completed.');await saveOrg(db,org,state);return json({id},201);
    }
    const match=path.match(/^\/api\/reviews\/([^/]+)$/);
    if(match){
      const r=state.reviews.find(x=>x.id===match[1]);if(!r)fail(404,'Review not found in this workspace.');
      const action=data.action;
      if(action==='save'){
        canEdit(user,r);const draft=draftInput(data);reversion(r,draft,await analyze(draft,state,env),user);
      }else if(action==='apply'){
        canEdit(user,r);const f=r.analysis.findings.find(x=>x.id===data.finding_id);if(!f?.suggestion||!f.quote||!Number.isInteger(f.start))fail(400,'This issue needs a manual edit.');
        if(r.text.slice(f.start,f.end)!==f.quote)fail(409,'The quoted span has changed. Run the review again.');
        const draft=draftInput({...r,text:r.text.slice(0,f.start)+f.suggestion+r.text.slice(f.end),useAI:false});
        reversion(r,draft,await analyze(draft,state,env),user);
      }else if(action==='decision'){
        if(r.status==='approved')fail(409,'Approved decisions are locked. Edit the draft to start a new revision.');
        const f=r.analysis.findings.find(x=>x.id===data.finding_id);if(!f)fail(404,'Finding not found.');
        if(!['dismissed','overridden','open'].includes(data.decision))fail(400,'Unknown decision.');
        if(f.severity==='high'||data.decision==='overridden')checkRole(user,['reviewer','manager','admin']);else if(user.role==='creator'&&r.created_by!==user.id)fail(403,'This draft belongs to another creator.');
        f.decision=data.decision;f.reason=str(data.reason,5,600);f.decided_by=user.name;f.decided_at=timestamp();
      }else if(action==='submit'){
        canEdit(user,r);if(!['draft','changes_requested'].includes(r.status))fail(409,'Only drafts or requested changes can be submitted.');
        if(r.analysis.knowledge_version!==state.knowledge_version)fail(409,'Brand guidelines changed. Save and review again before submitting.');r.status='in_review';
      }else if(action==='approve'){
        checkRole(user,['reviewer','manager','admin']);if(r.status!=='in_review')fail(409,'Submit this draft for review first.');
        if(r.last_editor===user.id||r.created_by===user.id)fail(403,'A different team member must approve this content.');
        if(r.analysis.knowledge_version!==state.knowledge_version)fail(409,'Guidelines changed; request a fresh content review.');
        if(r.analysis.findings.some(f=>f.severity==='high'&&f.decision==='open'))fail(409,'Resolve or explicitly override high-severity issues before approval.');
        r.status='approved';r.approved_by=user.name;r.approved_at=timestamp();str(data.reason,5,600);
      }else if(action==='request_changes'){
        checkRole(user,['reviewer','manager','admin']);if(r.status!=='in_review')fail(409,'This draft is not awaiting review.');r.status='changes_requested';str(data.reason,5,600);
      }else if(action==='comment'){
        if(r.comments.length>=100)fail(400,'Comment limit reached.');r.comments.push({id:uuid(),text:str(data.text,1,1200),author:user.name,role:user.role,at:timestamp()});
      }else fail(400,'Unknown review action.');
      r.updated_at=timestamp();await appendAudit(state,user,`review.${action}`,r.id,data.reason||`Revision ${r.version}${data.finding_id?'; '+data.finding_id:''}`);
      await saveOrg(db,org,state);return json({ok:true,id:r.id});
    }
    fail(404,'Endpoint not found.');
  }catch(error){if(!error.status)console.error('BrandCompass API:',error.message);return json({error:error.status?error.message:'The server could not complete this request. Please try again.'},error.status||500);}
}
