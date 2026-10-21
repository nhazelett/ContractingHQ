// Runs only in the trusted deployment workflow; no credentials or source URLs are logged.
import fs from 'node:fs/promises';
import {refreshNotices} from './source.mjs';
const root=new URL('../',import.meta.url),account='a7443e0102de587d778491ab08fd883f',database='kthq-contractintel';
async function cf(path,method='GET',body){
 const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw new Error('Cloudflare deployment access is missing.');
 let response;try{response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});}catch{throw new Error('Cloudflare could not be reached.');}
 if(!response.ok)throw new Error('Cloudflare operation failed: HTTP '+response.status);let data;try{data=await response.json();}catch{throw new Error('Cloudflare returned an unreadable response.');}if(!data.success)throw new Error('Cloudflare rejected the operation.');return data.result;
}
async function dbAdapter(){
 const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),id=config.d1_databases?.find(b=>b.binding==='OPPORTUNITIES_DB')?.database_id;if(!id)throw new Error('Run opportunity deployment preparation first.');
 const query=async(sql,params=[])=>{const result=await cf('/d1/database/'+id+'/query','POST',{sql,params});if(result.some(b=>!b.success))throw new Error('Opportunity index query failed.');return result[0]||{results:[]};};
 const prepare=sql=>({bind:(...params)=>({sql,params,all:()=>query(sql,params),first:async()=>((await query(sql,params)).results||[])[0]||null,run:()=>query(sql,params)}),all:()=>query(sql),first:async()=>((await query(sql)).results||[])[0]||null,run:()=>query(sql)});
 return {prepare,batch:async statements=>{const out=[];for(const s of statements)out.push(await query(s.sql,s.params));return out;}};
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
  if(active&&Date.now()-Date.parse(active.checked_at)<21600000&&process.env.FORCE_OPPORTUNITY_REFRESH!=='1'){console.log('Recent validated opportunity index retained; no SAM calls made.');return;}
  try{const result=await refreshNotices({OPPORTUNITIES_DB:db,SAM_API_KEY:process.env.SAM_API_KEY});console.log(JSON.stringify({opportunity_rows:result.rows,checked_at:result.checked_at,source_requests:result.coverage.calls,windows:result.coverage.windows,complete_requested_window:result.coverage.complete}));}catch(e){if(!active)throw e;console.log('Refresh did not complete. Existing validated opportunity data retained.');}
 }else if(action==='secret'){
  if(!process.env.SAM_API_KEY)throw new Error('The existing SAM_API_KEY repository secret is missing.');
  await cf('/workers/scripts/kthq-contractintel/secrets','PUT',{name:'SAM_API_KEY',text:process.env.SAM_API_KEY,type:'secret_text'});console.log('SAM access configured on the existing server; no browser credential.');
 }else throw new Error('Unknown opportunity deployment action.');
}
try{await main();}catch(e){console.error(e.message?.includes('SAM')||e.message?.includes('Cloudflare')||e.message?.includes('D1')||e.message?.includes('Opportunity')||e.message?.includes('ContractIntel')?e.message:'Opportunity deployment stopped safely.');process.exitCode=1;}
