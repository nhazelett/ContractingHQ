import {readR2} from './r2/read.mjs';
import {CONFIG} from './ingest.mjs';
import {dispatchIngest} from './dispatch.mjs';
import {officeSnapshot,storedAward,storageReport,PortfolioError} from './read.mjs';
async function authorized(request,secret){
 if(!secret)return false;const value=request.headers.get('X-ContractIntel-Ingest-Secret')||'';
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([digest(value),digest(secret)]);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
export async function portfolioRoute(request,env){
 const url=new URL(request.url),progress=/^\/api\/office\/([A-Z0-9]{6})\/progress$/.exec(url.pathname),match=/^\/api\/office\/([A-Z0-9]{6})(\/award)?$/.exec(url.pathname);
 if(progress){
  if(request.method!=='GET')throw new PortfolioError('Read-only progress endpoint.',405);
  if(url.search||!CONFIG.offices.includes(progress[1]))throw new PortfolioError('Unknown pilot office.',404);
  if(!env.PORTFOLIO_DB)throw new PortfolioError('Portfolio database is not configured.');
  const row=await env.PORTFOLIO_DB.prepare('SELECT status,work_id,checkpoint_json,updated_at FROM ingest_office_progress WHERE office_dodaac=?').bind(progress[1]).first();
  if(!row)return {office:progress[1],status:'not_started'};
  const checkpoint=JSON.parse(row.checkpoint_json),count=await env.PORTFOLIO_DB.prepare("SELECT count(*) n FROM ingest_stage WHERE work_id=? AND record_kind='award'").bind(row.work_id).first();
  return {office:progress[1],status:row.status,phase:checkpoint.phase,awards_prepared:count.n,awards_discovered:checkpoint.awardCount??null,window_index:checkpoint.window,search_page:checkpoint.page,updated_at:row.updated_at};
 }

 if(match){
  if(request.method!=='GET')throw new PortfolioError('Read-only office endpoint.',405);
  if(match[2]){if([...url.searchParams.keys()].some(k=>!['id','page'].includes(k)))throw new PortfolioError('Unexpected query parameter.',400);const page=Number(url.searchParams.get('page')||1);if(!Number.isSafeInteger(page)||page<1)throw new PortfolioError('Invalid history page.',400);try{return await readR2(env[CONFIG.r2Offices[match[1]]?.binding],match[1],{id:url.searchParams.get('id'),page});}catch{}return storedAward(env.PORTFOLIO_DB,match[1],url.searchParams.get('id'),page);}
  if([...url.searchParams.keys()].some(k=>k!=='start'))throw new PortfolioError('Unexpected query parameter.',400);
  try{return await readR2(env[CONFIG.r2Offices[match[1]]?.binding],match[1],{start:url.searchParams.get('start')||CONFIG.windows[1]});}catch{}return officeSnapshot(env.PORTFOLIO_DB,match[1],url.searchParams.get('start')||CONFIG.windows[1]);
 }
 if(!['/api/admin/portfolio/ingest','/api/admin/portfolio/storage','/api/admin/portfolio/status'].includes(url.pathname))throw new PortfolioError('Unknown portfolio route.',404);
 if(!await authorized(request,env.PORTFOLIO_INGEST_SECRET))throw new PortfolioError('Unauthorized.',401);
 if(url.pathname.endsWith('/ingest')){
  if(request.method!=='POST')throw new PortfolioError('Use POST to trigger ingestion.',405);
  let body;try{body=await request.json();}catch{throw new PortfolioError('Invalid request body.',400);}
  if(Object.keys(body).some(k=>!['office','mode'].includes(k))||body.office!=='FA4528'||!CONFIG.modes.includes(body.mode))throw new PortfolioError('Only FA4528 backfill/nightly is enabled.',400);
  return dispatchIngest(env,{mode:body.mode,origin:'admin'});
 }
 if(request.method!=='GET')throw new PortfolioError('Read-only endpoint.',405);
 if(!env.PORTFOLIO_DB)throw new PortfolioError('Portfolio database is not configured.');
 if(url.pathname.endsWith('/storage'))return storageReport(env.PORTFOLIO_DB);
 return {runs:(await env.PORTFOLIO_DB.prepare('SELECT * FROM ingest_runs ORDER BY started_at DESC LIMIT 20').all()).results,progress:(await env.PORTFOLIO_DB.prepare('SELECT * FROM ingest_office_progress').all()).results};
}
