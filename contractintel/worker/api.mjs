import {portfolioRoute} from '../portfolio/http.mjs';
import {dispatchIngest} from '../portfolio/dispatch.mjs';
import {PortfolioError} from '../portfolio/read.mjs';
import offices from './offices.json' with {type:'json'};
import {opportunityRoute} from '../opportunities/api.mjs';
import {OpportunityError} from '../opportunities/source.mjs';
import {resolve as sourceResolve,ServiceError} from '../web/source.mjs';
export {normalizeAward,normalizeAction,cents,isoDate,validAwardID} from '../web/source.mjs';
export const resolve=(url,env={})=>sourceResolve(url,{...env,OFFICES:offices});
const TTL=21600;
const inflight=new Map();
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export async function handle(request,env={},ctx={}){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const cors=['https://kthq.org','https://www.kthq.org','http://127.0.0.1:8898'].includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const reply=(data,status=200,headers={})=>json(data,status,{...cors,...headers});
 if(url.pathname.startsWith('/api/office/')||url.pathname.startsWith('/api/admin/portfolio/')){
  try{
   if(url.pathname.startsWith('/api/office/')&&env.READ_LIMIT&&!(await env.READ_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return reply({error:'Request limit reached. Wait one minute, then retry.'},429,{'Retry-After':'60'});
   return reply(await portfolioRoute(request,{...env,OFFICES:offices}));
  }catch(error){return reply({error:error instanceof PortfolioError||url.pathname.startsWith('/api/admin/portfolio/')?error.message:'Portfolio service unavailable; live loading remains available.'},error instanceof PortfolioError?error.status:503);}
 }
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
 if(request.method!=='GET')return reply({error:'Read-only API.'},405);
 if(url.href.length>2000)return reply({error:'Request is too long.'},400);
 try{
  if(env.READ_LIMIT&&!(await env.READ_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)return reply({error:'Request limit reached. Your records are retained. Wait one minute, then continue.'},429,{'Retry-After':'60'});
  if(['/api/opportunities','/api/opportunity'].includes(url.pathname)){const data=await opportunityRoute(url,env);return data instanceof Response?data:reply(data);}
  // Canonical route keys prevent irrelevant parameters from bypassing shared caching.
  const allowed={'/api/offices':[],'/api/status':[],'/api/awards':['office','start','page','cursor','sort_value'],'/api/award':['id'],'/api/history':['id','page']}[url.pathname];
  if(!allowed)throw new ServiceError('Unknown endpoint.',404);
  if([...url.searchParams.keys()].some(k=>!allowed.includes(k)))throw new ServiceError('Unexpected query parameter.');
  url.searchParams.sort();const key=new Request(url.origin+'/__cache/live-v3'+url.pathname+url.search),cache=env.CACHE||(typeof caches!=='undefined'?caches.default:null);
  const cached=await cache?.match(key);if(cached)return reply(await cached.json(),200,{'X-ContractIntel-Cache':'hit'});
  let pending=inflight.get(url.href);if(!pending){pending=resolve(url,env);inflight.set(url.href,pending);pending.finally(()=>inflight.delete(url.href)).catch(()=>{});}
  const body=await pending;
  if(cache){const put=cache.put(key,json(body,200,{'Cache-Control':'public, max-age='+TTL}));if(ctx.waitUntil)ctx.waitUntil(put);else await put;}
  return reply(body,200,{'X-ContractIntel-Cache':'miss'});
 }catch(error){return reply({error:error instanceof ServiceError||error instanceof OpportunityError?error.message:'Data service unavailable. Try again shortly.'},error instanceof ServiceError||error instanceof OpportunityError?error.status:503);}
}
export async function scheduled(controller,env){return dispatchIngest(env,{mode:'nightly',origin:'cron'});}
export default {fetch:handle,scheduled};

