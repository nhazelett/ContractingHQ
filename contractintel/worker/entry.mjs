import api from './api.mjs';
import {protectedCoverage,accessAllowed} from './access.mjs';
export async function fetchProtected(request,env,ctx){
 const url=new URL(request.url),protectedPath=protectedCoverage(url.pathname);
 if(protectedPath&&!await accessAllowed(request,env))return new Response('Cloudflare Access authentication required.',{status:403,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Type':'text/plain; charset=utf-8'}});
 const response=url.pathname.startsWith('/api/')?await api.fetch(request,env,ctx):await env.ASSETS.fetch(request);
 if(!protectedPath)return response;
 const result=new Response(response.body,response);result.headers.set('Cache-Control','private, no-store');result.headers.set('X-Robots-Tag','noindex, nofollow');return result;
}
export default {...api,fetch:fetchProtected};
