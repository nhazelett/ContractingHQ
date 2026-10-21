// Runs only in the trusted deployment workflow; no credentials or source URLs are logged.
import fs from 'node:fs/promises';
import {refreshNotices} from './source.mjs';
import {createD1Adapter} from './d1-rest.mjs';
import {opportunityRoute} from './api.mjs';
const root=new URL('../',import.meta.url),account='a7443e0102de587d778491ab08fd883f',database='kthq-contractintel';
async function cf(path,method='GET',body){
 const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw new Error('Cloudflare deployment access is missing.');
 let response;try{response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw new Error('Cloudflare could not be reached.');}
 if(!response.ok){let codes=[],category='';try{const error=await response.json();codes=(error.errors||[]).map(e=>e.code);const messages=(error.errors||[]).map(e=>e.message||'').join(' ');category=messages.match(/too many SQL variables|too many bound parameters|not authorized|no such table|UNIQUE constraint failed|CHECK constraint failed|malformed JSON|syntax error|database is locked|statement too long|D1_ERROR/i)?.[0]||'';}catch{}throw new Error('Cloudflare operation failed: HTTP '+response.status+'; codes '+codes.join(',')+(category?'; '+category:''));}let data;try{data=await response.json();}catch{throw new Error('Cloudflare returned an unreadable response.');}if(!data.success)throw new Error('Cloudflare rejected the operation.');return data.result;
}
async function dbAdapter(){
 const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),id=config.d1_databases?.find(b=>b.binding==='OPPORTUNITIES_DB')?.database_id;if(!id)throw new Error('Run opportunity deployment preparation first.');
 const query=async(sql,params=[])=>{try{const result=await cf('/d1/database/'+id+'/query','POST',{sql,params});if(result.some(b=>!b.success))throw new Error('Opportunity index query failed.');return result[0]||{results:[]};}catch(e){const stage=sql.match(/(?:INSERT(?: OR IGNORE)? INTO|UPDATE|DELETE FROM|FROM)\s+(opp_[a-z_]+)/i)?.[1]||'schema';throw new Error('Cloudflare query failed at '+stage+' ('+params.length+' parameters): '+e.message);}};
 return createD1Adapter(query);
}
async function main(){
 const action=process.argv[2];
 if(action==='prepare'){
  const databases=await cf('/d1/database?per_page=100'),db=databases.find(d=>d.name===database);if(!db)throw new Error('The existing ContractIntel database was not found.');
  const info=await cf('/d1/database/'+db.uuid);if(Number(info.file_size||0)+35_000_000>450_000_000)throw new Error('The existing D1 storage guard prevents adding the opportunity pilot.');
  const configPath=new URL('worker/wrangler.jsonc',root),config=JSON.parse(await fs.readFile(configPath,'utf8'));config.d1_databases=[...(config.d1_databases||[]).filter(b=>b.binding!=='OPPORTUNITIES_DB'),{binding:'OPPORTUNITIES_DB',database_name:database,database_id:db.uuid}];await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  const sql=await fs.readFile(new URL('opportunities/schema.sql',root),'utf8'),migrated=await cf('/d1/database/'+db.uuid+'/query','POST',{sql});if(migrated.some(r=>!r.success))throw new Error('Opportunity schema migration failed.');console.log('Opportunity index prepared within the existing D1 storage guard.');
 }else if(action==='refresh'){
  const db=await dbAdapter(),active=await db.prepare('SELECT r.checked_at FROM opp_runs r JOIN opp_active a ON a.run_id=r.id').first();
  if(active&&Date.now()-Date.parse(active.checked_at)<21600000&&process.env.FORCE_OPPORTUNITY_REFRESH!=='1'){await db.prepare('UPDATE opp_refresh SET last_error=NULL,lease_until=NULL WHERE last_attempt=?').bind(active.checked_at).run();console.log('Recent validated opportunity index retained; no SAM calls made.');return;}
  try{const result=await refreshNotices({OPPORTUNITIES_DB:db,SAM_API_KEY:process.env.SAM_API_KEY});console.log(JSON.stringify({opportunity_rows:result.rows,checked_at:result.checked_at,source_requests:result.coverage.calls,windows:result.coverage.windows,complete_requested_window:result.coverage.complete}));}catch(e){if(!active)throw e;console.log('Refresh did not complete. Existing validated opportunity data retained.');}
 }else if(action==='warm'){
  const db=await dbAdapter(),rows=await db.prepare("SELECT n.notice_id FROM opp_notices n JOIN opp_active a ON a.run_id=n.run_id WHERE n.description_ref IS NOT NULL AND n.source_active=1 AND n.notice_type IN ('Solicitation','Combined Synopsis/Solicitation','Sources Sought','Presolicitation') ORDER BY n.posted_key DESC,n.notice_id ASC LIMIT 2").all();let warmed=0;
  for(const row of rows.results){const data=await opportunityRoute(new URL('https://local/api/opportunity?id='+row.notice_id+'&description=1'),{OPPORTUNITIES_DB:db,SAM_API_KEY:process.env.SAM_API_KEY});if(data.description.text)warmed++;}
  console.log('Source descriptions available for '+warmed+' of '+rows.results.length+' initial notices; shared request guard retained.');
 }else if(action==='secret'){
  if(!process.env.SAM_API_KEY)throw new Error('The existing SAM_API_KEY repository secret is missing.');
  await cf('/workers/scripts/kthq-contractintel/secrets','PUT',{name:'SAM_API_KEY',text:process.env.SAM_API_KEY,type:'secret_text'});console.log('SAM access configured on the existing server; no browser credential.');
 }else throw new Error('Unknown opportunity deployment action.');
}
try{await main();}catch(e){console.error(e.message?.includes('SAM')||e.message?.includes('Cloudflare')||e.message?.includes('D1')||e.message?.includes('Opportunity')||e.message?.includes('ContractIntel')?e.message:'Opportunity deployment stopped safely.');process.exitCode=1;}
