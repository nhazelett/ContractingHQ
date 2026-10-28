import {dispatchAutomaticQueue} from '../portfolio/queue/dispatch.mjs';
import api from './api.mjs';
import {protectedCoverage,accessAllowed} from './access.mjs';
export async function fetchProtected(request,env,ctx){
 const url=new URL(request.url),protectedPath=protectedCoverage(url.pathname);
 if(protectedPath&&!await accessAllowed(request,env))return new Response('Cloudflare Access authentication required.',{status:403,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'}});
 const response=url.pathname.startsWith('/api/')?await api.fetch(request,env,ctx):await env.ASSETS.fetch(request);
 if(!protectedPath)return response;
 const result=new Response(response.body,response);result.headers.set('Cache-Control','private, no-store');result.headers.set('X-Robots-Tag','noindex, nofollow');return result;
}
export async function scheduled(controller,env){
 const results=await Promise.allSettled([api.scheduled(controller,env),dispatchAutomaticQueue(env)]);
 for(let i=0;i<results.length;i++)console.log(JSON.stringify({portfolio_scheduler:i===0?'maintenance':'automatic_queue',...(results[i].status==='fulfilled'?{result:results[i].value}:{error:results[i].reason?.message})}));
 const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
 return results.map(r=>r.value);
}
export default {...api,fetch:fetchProtected,scheduled};

