// All default decisions are deterministic rules + lexical evidence retrieval.
// This is deliberately conservative: similarity alone never verifies a claim.
export const ENGINE_VERSION = '1.0.0';
const STOP = new Set('the a an for of and is are was with to in on at our your this that it its very bottle verdant'.split(' '));
const normalize = s => String(s).toLowerCase().replace(/₹/g,'inr ').replace(/[^\p{L}\p{N}%]+/gu,' ').trim().replace(/\s+/g,' ');
const terms = s => [...new Set(normalize(s).split(' ').filter(w=>w.length>1&&!STOP.has(w)))];
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function contrastRatio(a,b) {
  const lum = hex => {
    const rgb = hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function retrieve(query, sources, limit=4) {
  const qt=terms(query);
  return sources.filter(s=>s.active!==false).map(s=>{
    const st=terms(s.text||s.body||''); const common=qt.filter(t=>st.includes(t));
    return {source:s,score:common.reduce((sum,w)=>sum+( /\d/.test(w)?0.4:1),0)/Math.sqrt(Math.max(1,st.length)),overlap:common.length};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);
}
export const factCurrent = (fact,now=new Date()) => fact.active!==false && (!fact.valid_until || fact.valid_until >= now.toISOString().slice(0,10));
function colorDistance(a,b) {return Math.sqrt([1,3,5].reduce((n,i)=>n+(parseInt(a.slice(i,i+2),16)-parseInt(b.slice(i,i+2),16))**2,0));}
export function reviewContent(draft,state,now=new Date()) {
  const text=draft.text||'',findings=[],claims=[];
  const rules=state.rules.filter(r=>r.active!==false);
  const byType = type => rules.filter(r=>r.type===type);
  const sourceRef = s => ({id:s.id,title:s.title,source:s.source,version:s.version,excerpt:s.body||s.text});
  const add=(rule,category,title,message,quote='',suggestion=null,extra={})=>{
    if(findings.length>=100)return;
    findings.push({id:`f-${findings.length+1}`,rule_id:rule.id,category,severity:rule.severity,title,message,quote,suggestion,source:sourceRef(rule),certainty:'Exact rule',decision:'open',...extra});
  };
  for(const r of byType('term')) for(const entry of r.config.terms||[]) {
    const re=new RegExp(`(?<![\\p{L}\\p{N}])${escapeRE(entry.term)}(?![\\p{L}\\p{N}])`,'giu');
    for(const match of text.matchAll(re))add(r,'Terminology','Use preferred terminology',`“${entry.term}” is not preferred. Use “${entry.replacement}”.`,match[0],entry.replacement,{start:match.index,end:match.index+match[0].length});
  }
  for(const r of byType('tone')) {
    for(const phrase of r.config.phrases||[]){const m=new RegExp(`(?<![\\p{L}\\p{N}])${escapeRE(phrase)}(?![\\p{L}\\p{N}])`,'iu').exec(text);if(m)add(r,'Voice','Keep the invitation calm','This pressure phrase conflicts with the approved brand voice.',m[0],null,{start:m.index,end:m.index+m[0].length});}
    for(const m of text.matchAll(/!{2,}/g))add(r,'Voice','Dial down the exclamation marks','Use one exclamation mark at most.',m[0],'.',{start:m.index,end:m.index+m[0].length});
    const shout=/\b[A-Z]{3,}(?:[, ]+[A-Z]{2,}){1,}\b/g;
    for(const m of text.matchAll(shout))add(r,'Voice','Avoid shouting','This all-capital phrase may sound forceful. Review it in context.',m[0],m[0].toLowerCase(),{certainty:'Heuristic',start:m.index,end:m.index+m[0].length});
  }
  // Segment on sentence terminators, preserving decimal numbers and exact spans.
  const sentences=[...text.matchAll(/[^.!?\n]+(?:\.(?=\d)[^.!?\n]+)*(?:[.!?]+|$)/g)].map(m=>({text:m[0].trim(),start:m.index+m[0].indexOf(m[0].trim())})).filter(s=>s.text);
  const claimRule=byType('claims')[0];
  if(claimRule) for(const s of sentences) {
    const candidate=/\d|\b(best|guarantee\w*|certified|carbon[- ]neutral|cure\w*|safest|leading|number one|world.s first)\b/i.test(s.text);
    if(!candidate) continue;
    const exact=state.facts.find(f=>f.active!==false&&normalize(f.text)===normalize(s.text));
    const related=retrieve(s.text,state.facts,3);
    if(exact&&factCurrent(exact,now)){
      claims.push({text:s.text,status:'supported',source:sourceRef(exact),reason:'Exact match to a current approved statement.'});continue;
    }
    const best=exact||related[0]?.source;
    const expired=exact&&!factCurrent(exact,now);
    const suitable=best&&factCurrent(best,now)&&related[0]?.overlap>=2;
    const message=expired?'The matching fact has expired. Ask an owner to revalidate it.':'No exact current approved statement supports this claim. Related evidence is context, not proof.';
    claims.push({text:s.text,status:expired?'expired':'cannot_verify',source:best?sourceRef(best):null,reason:message});
    add(claimRule,'Claims',expired?'Approved evidence has expired':'Cannot verify this claim',message,s.text,suitable?best.text:null,{certainty:'Conservative heuristic',start:s.start,end:s.start+s.text.length,evidence:best?sourceRef(best):null});
  }
  for(const r of byType('readability'))for(const s of sentences){const count=s.text.split(/\s+/).length;if(count>(r.config.maxWords||26))add(r,'Readability','Give this sentence room to breathe',`${count} words. Consider two shorter sentences.`,s.text,null,{certainty:'Heuristic'});}
  if(draft.image) {
    for(const r of byType('alt'))if(!draft.image.decorative&&(!draft.alt?.trim()||draft.alt.trim().length<10||/^(image|photo|picture)( of)?$/i.test(draft.alt.trim())))add(r,'Accessibility','Add meaningful alt text','Describe the information or purpose of this image for someone who cannot see it.');
    if(draft.image.kind==='logo') for(const r of byType('asset')) {
      if(!state.assets.some(a=>a.sha256===draft.image.sha256))add(r,'Visual identity','Logo is not an approved asset','The file hash does not match an approved asset. This does not detect cropping, spacing or semantic logo correctness.');
    }
    if(draft.image.kind==='graphic')for(const r of byType('palette')){
      const off=(draft.image.colors||[]).filter(c=>state.brand.palette.every(a=>colorDistance(c,a)>(r.config.tolerance||50)));
      if(off.length)add(r,'Visual identity','Colours sit outside the brand palette',`Sampled colours ${off.slice(0,5).join(', ')} differ from approved colours. Sampling is approximate; confirm visually.`,null,null,{certainty:'Approximate pixel sampling'});
    }
  }
  let contrast=null;
  if(draft.foreground&&draft.background){
    contrast=contrastRatio(draft.foreground,draft.background);const required=draft.largeText?3:4.5;
    for(const r of byType('contrast'))if(contrast<required)add(r,'Accessibility','Text contrast is too low',`${contrast.toFixed(2)}:1 contrast; at least ${required}:1 is required for the selected text size. This tests the declared colour pair only.`,null,null,{ratio:contrast,required});
  }
  for(const r of byType('disclaimer'))if(/\d+\s*%\s*(off|discount)/i.test(text)&&!text.toLowerCase().includes((r.config.text||'Terms apply.').toLowerCase()))add(r,'Claims','Add the offer conditions','This promotion is missing the required conditions statement.');
  const penalty=findings.reduce((n,f)=>n+({high:18,medium:8,low:3}[f.severity]||0),0);
  return {engine:ENGINE_VERSION,mode:'Rules + evidence retrieval',knowledge_version:state.knowledge_version,reviewed_at:now.toISOString(),score:Math.max(0,100-penalty),findings,claims,contrast,word_count:text.trim()?text.trim().split(/\s+/).length:0,disclosure:'Deterministic rules and lexical retrieval. No generative model used. Claim detection and visual sampling have limits; human approval is required.',ai:{used:false,status:'not_requested'}};
}

export function insights(state) {
  const latest=state.reviews.map(r=>r.analysis).filter(Boolean),all=latest.flatMap(a=>a.findings);
  const buckets={};for(const r of state.reviews){const b=buckets[r.channel] ||= {channel:r.channel,reviews:0,issues:0};b.reviews++;b.issues+=r.analysis?.findings.length||0;}
  const health=state.rules.map(rule=>{
    const hits=all.filter(f=>f.rule_id===rule.id),overrides=hits.filter(f=>['dismissed','overridden'].includes(f.decision)).length;
    return {id:rule.id,title:rule.title,flags:hits.length,overrides,health:hits.length?Math.round(100*(1-overrides/hits.length)):null};
  }).sort((a,b)=>(a.health??101)-(b.health??101));
  return {reviews:state.reviews.length,pending:state.reviews.filter(r=>r.status==='in_review').length,approved:state.reviews.filter(r=>r.status==='approved').length,average_score:latest.length?Math.round(latest.reduce((n,a)=>n+a.score,0)/latest.length):null,open_issues:all.filter(f=>f.decision==='open').length,by_channel:Object.values(buckets),rule_health:health,formula:'Guideline health = 100 × (1 − dismissed or overridden findings / total current findings). No flags = no data. A high score is not proof a rule is clear.'};
}
