// The complete ingestion package runs here in Node; Cloudflare only dispatches and serves reads.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {CONFIG,runIngest} from './ingest.mjs';
import {createHttpD1,verifyAtomicBatch} from './d1-http.mjs';
import {storageReport,publication} from './read.mjs';
import {currentDate} from '../web/calendar.mjs';
const root=new URL('../',import.meta.url);
export async function runPackage({db,directory,mode='nightly',origin='manual',fetcher=fetch,onChunk=()=>{}}){
 if(!CONFIG.modes.includes(mode))throw new Error('Invalid runner mode.');
 const existing=await publication(db,CONFIG.offices[0]),pending=await db.prepare("SELECT 1 n FROM ingest_office_progress WHERE office_dodaac=? AND status IN ('running','yielded','failed')").bind(CONFIG.offices[0]).first();
 if(!pending&&existing&&(origin==='deployment'||origin==='backup'&&currentDate(Date.parse(existing.published_at))===currentDate()))return {status:'retained',publication_id:existing.published_run_id};
 let result;
 for(let chunk=0;chunk<CONFIG.maxBackfillChunks;chunk++){
  result=await runIngest({PORTFOLIO_DB:db,OFFICES:directory},{mode,fetcher});onChunk(result);
  if(result.status==='completed')return result;
  if(result.status==='busy')return result;
  if(result.status!=='yielded')throw new Error('Ingestion stopped before publication.');
 }
 throw new Error('Runner chunk budget reached; checkpoint retained for the next dispatch.');
}
async function main(){
 const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),binding=config.d1_databases?.find(b=>b.binding==='PORTFOLIO_DB');
 const db=createHttpD1({account:config.account_id,database:binding?.database_id,token:process.env.CLOUDFLARE_API_TOKEN});
 console.log(JSON.stringify(await verifyAtomicBatch(db)));
 const directory=JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8'));
 const result=await runPackage({db,directory,mode:process.env.RUN_MODE||'nightly',origin:process.env.RUN_ORIGIN||'manual',onChunk:r=>console.log(JSON.stringify({runner_chunk:r}))});
 console.log(JSON.stringify({runner_result:result}));
 const storage=await storageReport(db);await fs.writeFile(new URL('portfolio/fa4528-storage.json',root),JSON.stringify(storage,null,2)+'\n');console.log(JSON.stringify({portfolio_storage:storage}));
 if(result.status==='busy')return;
 if(process.env.PERFORM_VERIFY==='true'&&(result.status==='completed'||result.status==='retained'&&process.env.VERIFY_RETAINED==='true'))await import('./verify.mjs');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(error=>{console.error(error.message);process.exitCode=1;});
