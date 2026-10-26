// Temporary, authenticated benchmark Worker. Never deployed as kthq-contractintel.
import {CONFIG} from '../../portfolio/ingest.mjs';
import {PILOT,PilotError,bytes,digest,unpack,limitedBody,validKey,validateManifest,refreshSnapshot} from './core.mjs';
const currentKey=PILOT.prefix+'/current.json';
async function authenticated(request,secret){if(!secret)return false;const a=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(request.headers.get('Authorization')||''))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes('Bearer '+secret)));let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
export function createPilotWorker({now=Date.now}={}){return {async fetch(request,env){
 const stats={reads:0,writes:0},reply=(data,status=200,headers={})=>new Response(typeof data==='string'||data instanceof ArrayBuffer||data instanceof Uint8Array?data:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Benchmark-R2-Reads':String(stats.reads),'X-Benchmark-R2-Writes':String(stats.writes),...headers}});
 try{
  if(!await authenticated(request,env.R2_BENCH_TOKEN))return reply({error:'Unauthorized.'},401);
  const url=new URL(request.url);if(url.pathname==='/__bench/health'&&request.method==='GET')return reply({pilot:true,office:PILOT.office});
  const get=async key=>{if(!validKey(key))throw new PilotError('Invalid pilot key.',400);stats.reads++;const object=await env.BUCKET.get(key);if(!object)throw new PilotError('Stored pilot object is unavailable.',404);if(object.size>PILOT.maxObjectBytes)throw new PilotError('Object exceeds pilot budget.',413);return object;};
  const read=async descriptor=>{const object=await get(descriptor.key);return unpack(new Uint8Array(await object.arrayBuffer()),descriptor.sha256);};
  const manifest=async()=>{const object=await get(currentKey),data=await object.json();return validateManifest(data);};
  if(url.pathname==='/__bench/object'){
   if([...url.searchParams.keys()].some(k=>k!=='key'))throw new PilotError('Unexpected query.',400);
   const key=url.searchParams.get('key');if(!validKey(key))throw new PilotError('Only owned FA4528 pilot objects are accessible.',400);
   if(request.method==='GET'){const object=await get(key);return reply(await object.arrayBuffer(),200,{'Content-Type':'application/octet-stream','X-Object-SHA256':object.customMetadata?.sha256||''});}
   if(request.method==='HEAD'){stats.reads++;const object=await env.BUCKET.head(key);return reply('',object?200:404,{'X-Object-SHA256':object?.customMetadata?.sha256||''});}
   if(request.method!=='PUT')throw new PilotError('Unsupported benchmark method.',405);
   const body=await limitedBody(request.body,PILOT.maxObjectBytes),sha=await digest(body);if(request.headers.get('X-Object-SHA256')!==sha)throw new PilotError('Upload checksum mismatch.',400);
   if(key===currentKey){
    const candidate=validateManifest(JSON.parse(new TextDecoder().decode(body)));
    for(const object of candidate.objects){stats.reads++;const head=await env.BUCKET.head(object.key);if(!head||head.size!==object.compressed_bytes||head.customMetadata?.sha256!==object.sha256)throw new PilotError('Incomplete publication; previous pointer retained.',409);}
    const metadata=await read(candidate.metadata),pub=metadata.tables.office_publications[0],run=metadata.tables.ingest_runs.find(row=>row.id===pub.published_run_id);
    if(pub.office_dodaac!==PILOT.office||pub.published_run_id!==candidate.source_publication_id||pub.published_at!==candidate.source_published_at||run.id!==pub.published_run_id||run.status!=='completed'||!pub.fiscal_complete)throw new PilotError('Source publication is incomplete.',409);
   }
   if(key!==currentKey){stats.reads++;const existing=await env.BUCKET.head(key);if(existing&&existing.customMetadata?.sha256!==sha)throw new PilotError('Immutable pilot object cannot be overwritten.',409);if(existing)return reply({stored:false,unchanged:true,bytes:body.length,sha256:sha});}
   await env.BUCKET.put(key,body,{httpMetadata:{contentType:key===currentKey?'application/json':'application/gzip'},customMetadata:{sha256:sha,office:PILOT.office}});stats.writes++;return reply({stored:true,bytes:body.length,sha256:sha});
  }
  if(request.method!=='GET')throw new PilotError('Read-only portfolio endpoint.',405);
  if(url.pathname==='/api/office/'+PILOT.office){
   if([...url.searchParams.keys()].some(k=>k!=='start'))throw new PilotError('Unexpected query.',400);
   const start=url.searchParams.get('start')||CONFIG.windows[1];if(!CONFIG.windows.includes(start))throw new PilotError('Invalid source window.',400);
   const published=await manifest(),payload=await read(published.snapshots[start]);
   if(payload.office!==PILOT.office||payload.start!==start||payload.publication_id!==published.source_publication_id)throw new PilotError('Snapshot publication identity mismatch.');
   return reply(refreshSnapshot(payload,now));
  }
  if(url.pathname==='/api/office/'+PILOT.office+'/award'){
   if([...url.searchParams.keys()].some(k=>!['id','page'].includes(k)))throw new PilotError('Unexpected query.',400);
   const id=url.searchParams.get('id'),page=Number(url.searchParams.get('page')||1);if(!id?.startsWith('CONT_AWD_'+PILOT.office)||!Number.isSafeInteger(page)||page<1)throw new PilotError('Invalid evidence query.',400);
   const published=await manifest(),index=await read(published.lookup),descriptor=index.awards[id];if(!descriptor)throw new PilotError('Award not stored.',404);
   const chunk=await read(descriptor),award=chunk.awards.find(row=>row.generated_unique_award_id===id),history=chunk.award_history_pages.find(row=>row.generated_unique_award_id===id&&row.page===page);if(!award||!history?.actions_json)throw new PilotError('This evidence page is not stored; use live USAspending.',404);
   return reply({award:JSON.parse(award.record_json),history:{actions:JSON.parse(history.actions_json),has_next:!!history.has_next,page},fetched_at:published.source_published_at,source:'r2'});
  }
  throw new PilotError('Unknown pilot endpoint.',404);
 }catch(error){return reply({error:error instanceof PilotError?error.message:'Pilot request failed safely.'},error.status||503);}
 }};}
export default createPilotWorker();
