import fs from 'node:fs/promises';
import {compareOffice} from './compare.mjs';
import {CONFIG} from './ingest.mjs';
const base='https://kthq-contractintel.nickhazelett.workers.dev',checkpointPath=new URL('fa4528-source-checkpoint.json',import.meta.url);
async function get(path){const response=await fetch(base+path,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('Verification endpoint failed: '+response.status);return response.json();}
try{
 const directory=await get('/api/offices'),snapshots=new Map(),preflight=[];
 for(const start of CONFIG.windows){const begin=performance.now(),snapshot=await get('/api/office/FA4528?start='+start);snapshots.set(start,snapshot);const sample={start,elapsed_ms:Math.round(performance.now()-begin),awards:snapshot.records.length,publication_id:snapshot.publication_id};preflight.push(sample);console.log(JSON.stringify({d1_read_preflight:sample}));}
 const publicationKey=snapshots.get(CONFIG.windows[0]).publication_id;if([...snapshots.values()].some(s=>s.publication_id!==publicationKey))throw new Error('Publication changed during read preflight; restart comparison.');
 let checkpoint=null;try{const text=await fs.readFile(checkpointPath,'utf8');if(Buffer.byteLength(text)<=CONFIG.verificationMaxCheckpointBytes)checkpoint=JSON.parse(text);}catch{}
 const save=async work=>{const text=JSON.stringify(work);if(Buffer.byteLength(text)>CONFIG.verificationMaxCheckpointBytes)throw new Error('Verification checkpoint size guard reached.');const temporary=new URL('fa4528-source-checkpoint.tmp',import.meta.url);await fs.writeFile(temporary,text);await fs.rename(temporary,checkpointPath);};
 const comparison=await compareOffice({directory:directory.offices,publicationKey,checkpoint,onCheckpoint:save,getSnapshot:async start=>{const snapshot=await get('/api/office/FA4528?start='+start);if(snapshot.publication_id!==publicationKey)throw new Error('Publication changed during source scan; restart comparison.');return snapshot;},onProgress:result=>console.log(JSON.stringify(result))});
 await fs.rm(checkpointPath,{force:true});
 const timings=[];for(let i=0;i<3;i++){const start=performance.now(),data=await get('/api/office/FA4528');timings.push({elapsed_ms:Math.round(performance.now()-start),awards:data.records.length});}
 let storage=null;try{storage=JSON.parse(await fs.readFile(new URL('fa4528-storage.json',import.meta.url),'utf8'));}catch{}
 const report={comparison,storage,preflight_timings:preflight,endpoint_timings:timings};await fs.writeFile(new URL('fa4528-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!comparison.match)process.exitCode=1;
}catch(error){console.error(error.message);process.exitCode=1;}
