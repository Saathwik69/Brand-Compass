const encoder=new TextEncoder();
export const uuid=()=>crypto.randomUUID();
export const timestamp=()=>new Date().toISOString();
export async function sha256(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return [...new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function safeEqual(a,b){if(a.length!==b.length)return false;let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;}
export async function appendAudit(state,user,action,target,detail=''){
  const previous=state.audit.at(-1)?.hash||'GENESIS';
  const event={id:uuid(),at:timestamp(),actor:user.name,actor_id:user.id,role:user.role,action,target,detail,previous};
  event.hash=await sha256(JSON.stringify(event));state.audit.push(event);return event;
}
export async function verifyAudit(events){let previous='GENESIS';for(const e of events){const {hash,...record}=e;if(e.previous!==previous||await sha256(JSON.stringify(record))!==hash)return false;previous=hash;}return true;}
export const securityHeaders={
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
