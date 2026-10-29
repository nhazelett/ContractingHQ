// Temporary authenticated LIST-only gateway. No source fetch, D1, writes or deletes.
export async function auditPage(request,env){
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const encoder=new TextEncoder(),hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
 const a=await hash(request.headers.get('Authorization')||''),b=await hash('Bearer '+(env.STORAGE_AUDIT_TOKEN||''));
 let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];
 if(!env.STORAGE_AUDIT_TOKEN||different)return reply({error:'Unauthorized'},401);
 if(request.method!=='GET')return reply({error:'Read only'},405);
 const url=new URL(request.url),binding=url.searchParams.get('bucket');
 if(url.pathname!=='/list'||!/^B[0-3]$/.test(binding||'')||!env[binding])return reply({error:'Unknown bucket'},400);
 const cursor=url.searchParams.get('cursor')||undefined;
 const result=await env[binding].list({limit:1000,...(cursor?{cursor}:{})});
 if(!Array.isArray(result.objects)||result.objects.some(o=>!Number.isSafeInteger(o.size)||o.size<0))return reply({error:'Invalid listing'},503);
 return reply({bytes:result.objects.reduce((n,o)=>n+o.size,0),objects:result.objects.length,truncated:result.truncated===true,cursor:result.truncated?result.cursor:null});
}
export default {fetch:auditPage};
