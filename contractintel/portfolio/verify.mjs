import fs from 'node:fs/promises';
import {compareOffice} from './compare.mjs';
const base='https://kthq-contractintel.nickhazelett.workers.dev';
async function get(path){const response=await fetch(base+path,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('Verification endpoint failed: '+response.status);return response.json();}
try{
 const directory=await get('/api/offices');
 // Check every served window before the long independent source scan.
 for(const start of (await import('./ingest.mjs')).CONFIG.windows){const snapshot=await get('/api/office/FA4528?start='+start);console.log(JSON.stringify({d1_read_preflight:{start,awards:snapshot.records.length,publication_id:snapshot.publication_id}}));}
 const comparison=await compareOffice({directory:directory.offices,getSnapshot:start=>get('/api/office/FA4528?start='+start),onProgress:result=>console.log(JSON.stringify(result))});
 const timings=[];for(let i=0;i<3;i++){const start=performance.now(),data=await get('/api/office/FA4528');timings.push({elapsed_ms:Math.round(performance.now()-start),awards:data.records.length});}
 let storage=null;try{storage=JSON.parse(await fs.readFile(new URL('fa4528-storage.json',import.meta.url),'utf8'));}catch{}
 const report={comparison,storage,endpoint_timings:timings};await fs.writeFile(new URL('fa4528-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!comparison.match)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
