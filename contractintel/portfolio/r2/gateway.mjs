// Short-lived, authenticated R2 gateway for a GitHub runner. No source fetches,
// D1 binding, public bucket, scheduled task, listing or delete endpoint.
import {CONFIG} from '../ingest.mjs';
import {PILOT,bytes,digest,validKey,validateManifest,unpack,limitedBody,PilotError,canonical} from './format.mjs';
const S=CONFIG.r2Nightly,CURRENT=PILOT.prefix+'/current.json';
const must=(condition,message,status=409)=>{if(!condition)throw new PilotError(message,status);};
async function authenticated(request,secret){
 if(!secret)return false;const a=await digest(request.headers.get('Authorization')||''),b=await digest('Bearer '+secret);let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
}
export function createGateway(){return {async fetch(request,env){
 const stats={reads:0,writes:0},reply=(data,status=200,headers={})=>new Response(data instanceof Uint8Array?data:typeof data==='string'?data:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-R2-Reads':String(stats.reads),'X-R2-Writes':String(stats.writes),...headers}});
 const get=async(bucket,key)=>{stats.reads++;return bucket.get(key);},head=async(bucket,key)=>{stats.reads++;return bucket.head(key);};
 const put=async(key,value,options)=>{stats.writes++;return env.TARGET.put(key,value,options);};
 try{
  if(!await authenticated(request,env.R2_UPDATE_TOKEN))return reply({error:'Unauthorized.'},401);
  const url=new URL(request.url);if(url.pathname==='/health'&&request.method==='GET')return reply({office:S.office,production:false});
  must(url.pathname==='/object','Unknown gateway endpoint.',404);
  must([...url.searchParams.keys()].every(key=>['key','area'].includes(key)),'Unexpected query.',400);
  const key=url.searchParams.get('key'),area=url.searchParams.get('area')||'target',isCurrent=key===CURRENT,isCheckpoint=key===S.checkpointKey,isLedger=key===S.ledgerKey;
  must(['baseline','target'].includes(area)&&(validKey(key)||isCheckpoint||isLedger),'Only owned FA4528 keys are available.',400);
  must(area==='target'||validKey(key),'Baseline controls are not accessible.',400);
  const bucket=area==='baseline'?env.BASELINE:env.TARGET;
  if(request.method==='GET'||request.method==='HEAD'){
   const object=await (request.method==='HEAD'?head(bucket,key):get(bucket,key));if(!object)return reply('',404);
   must(object.size<=PILOT.maxObjectBytes,'Object read budget exceeded.',413);
   const headers={ETag:object.httpEtag||'"'+object.etag+'"','X-Object-SHA256':object.customMetadata?.sha256||'','Content-Type':'application/octet-stream','X-Object-Bytes':String(object.size)};
   return reply(request.method==='HEAD'?'':new Uint8Array(await object.arrayBuffer()),200,headers);
  }
  must(request.method==='PUT'&&area==='target'&&!isLedger,'Gateway method is not allowed.',405);
  must(request.headers.has('If-Match')||request.headers.get('If-None-Match')==='*','Conditional write required.',428);
  const cap=isCurrent?S.maxManifestBytes:isCheckpoint?S.maxCheckpointBytes:PILOT.maxObjectBytes;
  const body=await limitedBody(request.body,cap),sha=await digest(body);
  must(request.headers.get('X-Object-SHA256')===sha,'Upload checksum mismatch.',400);
  if(!isCurrent&&!isCheckpoint)must(key.endsWith('-'+sha+'.json.gz'),'Immutable key checksum differs.',400);
  const existing=await head(env.TARGET,key);
  if(!isCurrent&&!isCheckpoint&&existing){must(existing.customMetadata?.sha256===sha&&existing.size===body.length,'Immutable evidence differs.');return reply({unchanged:true},200,{ETag:existing.httpEtag||'"'+existing.etag+'"'});}
  if(isCheckpoint){const state=await unpack(body,null,S.maxCheckpointJSONBytes);must(state.office===S.office&&state.format_version===S.formatVersion&&typeof state.work_id==='string','Invalid checkpoint.');}
  if(isCurrent){
   const manifest=validateManifest(JSON.parse(new TextDecoder().decode(body))),prior=existing?validateManifest(await (await get(env.TARGET,key)).json()):null;
   const retained=[...new Set([manifest.version,...(prior?.retained_versions||[])])];
   must(retained.length<=PILOT.maxStoredVersions&&canonical(retained)===canonical(manifest.retained_versions),'Pilot retention limit reached; old copies retained.');
   const descriptors=new Map(manifest.objects.map(object=>[object.key,object]));
   for(const descriptor of [manifest.metadata,manifest.lookup,...Object.values(manifest.snapshots)])must(canonical(descriptors.get(descriptor.key))===canonical(descriptor),'Manifest descriptor differs.');
   for(const descriptor of manifest.objects){const object=await head(env.TARGET,descriptor.key);must(object&&object.size===descriptor.compressed_bytes&&object.customMetadata?.sha256===descriptor.sha256,'Incomplete publication; previous copy retained.');}
   const metadata=await get(env.TARGET,manifest.metadata.key),tables=(await unpack(new Uint8Array(await metadata.arrayBuffer()),manifest.metadata.sha256)).tables,pub=tables.office_publications?.[0],run=tables.ingest_runs?.find(row=>row.id===pub?.published_run_id);
   must(pub?.office_dodaac===S.office&&pub.published_run_id===manifest.source_publication_id&&pub.published_at===manifest.source_published_at&&pub.fiscal_complete&&run?.status==='completed','Source publication is incomplete.');
  }
  // Reserve space durably before accepting a new immutable object. A failed
  // write conservatively retains its reservation. Mutable slots reserve their
  // maximum size once. There is no automatic deletion of raw evidence.
  const ledgerObject=await get(env.TARGET,S.ledgerKey),ledger=ledgerObject?await ledgerObject.json():{office:S.office,keys:{}};
  must(ledger.office===S.office,'Invalid storage ledger.');
  const reservation=isCurrent?S.maxManifestBytes:isCheckpoint?S.maxCheckpointBytes:body.length;
  if(!ledger.keys[key]){
   ledger.keys[key]={bytes:reservation,sha:isCurrent||isCheckpoint?null:sha};
   const used=Object.values(ledger.keys).reduce((sum,entry)=>sum+entry.bytes,0)+S.maxLedgerBytes;
   must(used<=S.maxBucketBytes&&Object.keys(ledger.keys).length+1<=S.maxBucketObjects,'Shadow storage guard reached; publication retained.',413);
   const encoded=bytes(ledger);must(encoded.length<=S.maxLedgerBytes,'Storage ledger budget reached.',413);
   const condition=ledgerObject?new Headers({'If-Match':ledgerObject.httpEtag||'"'+ledgerObject.etag+'"'}):new Headers({'If-None-Match':'*'});
   must(await put(S.ledgerKey,encoded,{onlyIf:condition,httpMetadata:{contentType:'application/json'}}),'Storage ledger changed; retry the job.',412);
  }else must(ledger.keys[key].bytes>=body.length&&(!ledger.keys[key].sha||ledger.keys[key].sha===sha),'Stored reservation differs.');
  const result=await put(key,body,{onlyIf:request.headers,httpMetadata:{contentType:isCurrent?'application/json':'application/gzip'},customMetadata:{sha256:sha,office:S.office}});
  must(result,'Publication/checkpoint changed; conditional write refused.',412);
  return reply({stored:true,bytes:body.length},200,{ETag:result.httpEtag||'"'+result.etag+'"'});
 }catch(error){return reply({error:error instanceof PilotError?error.message:'R2 gateway failed safely.'},error.status||503);}
 }};}
export default createGateway();
