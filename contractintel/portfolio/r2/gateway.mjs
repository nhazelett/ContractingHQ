import {progressMetadata} from './progress.mjs';
// Short-lived, authenticated R2 gateway for a GitHub runner. No source fetches,
// D1 binding, public bucket or scheduled task. Cleanup is limited to tracked,
// unreferenced objects outside both retained publications and the grace period.
import {CONFIG,r2Profile} from '../ingest.mjs';
import {createFormat} from './format.mjs';


async function authenticated(request,secret){
 if(!secret)return false;const {digest}=createFormat(CONFIG.r2Pilot);const a=await digest(request.headers.get('Authorization')||''),b=await digest('Bearer '+secret);let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;
}
export function createGateway(profile=r2Profile(CONFIG.r2Pilot.office)){
const {PILOT,bytes,digest,validKey,validateManifest,unpack,limitedBody,PilotError,canonical}=createFormat(profile);
const S={...CONFIG.r2Nightly,...profile,checkpointKey:profile.prefix+'/checkpoint.json.gz',ledgerKey:profile.prefix+'/budget.json',verificationKey:profile.prefix+'/verification.json.gz',admissionKey:profile.prefix+'/admission.json'},CURRENT=profile.prefix+'/current.json';
const must=(condition,message,status=409)=>{if(!condition)throw new PilotError(message,status);};
return {async fetch(request,env){
 const stats={reads:0,writes:0},reply=(data,status=200,headers={})=>new Response(data instanceof Uint8Array?data:typeof data==='string'?data:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-R2-Reads':String(stats.reads),'X-R2-Writes':String(stats.writes),...headers}});
 const get=async(bucket,key)=>{stats.reads++;return bucket.get(key);},head=async(bucket,key)=>{stats.reads++;return bucket.head(key);};
 const put=async(key,value,options)=>{stats.writes++;return env.TARGET.put(key,value,options);};
 try{
  if(!await authenticated(request,env.R2_UPDATE_TOKEN))return reply({error:'Unauthorized.'},401);
  const url=new URL(request.url);if(url.pathname==='/health'&&request.method==='GET')return reply({office:S.office,production:false});
  must(url.pathname==='/object','Unknown gateway endpoint.',404);
  must([...url.searchParams.keys()].every(key=>['key','area'].includes(key)),'Unexpected query.',400);
  const key=url.searchParams.get('key'),area=url.searchParams.get('area')||'target',isCurrent=key===CURRENT,isCheckpoint=key===S.checkpointKey,isLedger=key===S.ledgerKey,isVerification=key===S.verificationKey,isAdmission=key===S.admissionKey;
  must(['baseline','target'].includes(area)&&(validKey(key)||isCheckpoint||isLedger||isVerification||isAdmission),'Only owned '+PILOT.office+' keys are available.',400);
  must(area==='target'||validKey(key),'Baseline controls are not accessible.',400);
  const bucket=area==='baseline'?env.BASELINE:env.TARGET;
  if(request.method==='GET'||request.method==='HEAD'){
   const object=await (request.method==='HEAD'?head(bucket,key):get(bucket,key));if(!object)return reply('',404);
   must(object.size<=PILOT.maxObjectBytes,'Object read budget exceeded.',413);
   const headers={ETag:object.httpEtag||'"'+object.etag+'"','X-Object-SHA256':object.customMetadata?.sha256||'','Content-Type':'application/octet-stream','X-Object-Bytes':String(object.size)};
   return reply(request.method==='HEAD'?'':new Uint8Array(await object.arrayBuffer()),200,headers);
  }
  if(request.method==='DELETE'&&area==='target'&&validKey(key)&&!isCurrent){
   const pointer=await get(env.TARGET,CURRENT);must(pointer&&request.headers.get('X-Current-Etag')===(pointer.httpEtag||'"'+pointer.etag+'"'),'Publication changed; cleanup refused.',412);
   const current=validateManifest(await pointer.json());must(current.previous_manifest,'Previous publication archive required before cleanup.');
   const archived=await get(env.TARGET,current.previous_manifest.key);must(archived,'Previous publication archive is missing.');
   const previous=validateManifest(await unpack(new Uint8Array(await archived.arrayBuffer()),current.previous_manifest.sha256));must(previous.version===current.retained_versions[1],'Previous version identity differs.');
   const protectedKeys=new Set([CURRENT,S.verificationKey,S.admissionKey,current.previous_manifest.key,...current.objects.map(o=>o.key),...previous.objects.map(o=>o.key)]);
   must(!protectedKeys.has(key),'Current or previous publication object is protected.');
   const ledgerObject=await get(env.TARGET,S.ledgerKey),ledger=await ledgerObject.json();must(ledger.keys[key],'Cleanup refuses untracked objects.');
   const object=await head(env.TARGET,key);
   if(object&&(!object.uploaded||Date.now()-new Date(object.uploaded).getTime()<S.retentionGraceMs))return reply({deleted:false,reason:'retention_grace'});
   if(object){await env.TARGET.delete(key);stats.writes++;}
   delete ledger.keys[key];
   must(await put(S.ledgerKey,bytes(ledger),{onlyIf:new Headers({'If-Match':ledgerObject.httpEtag||'"'+ledgerObject.etag+'"'}),httpMetadata:{contentType:'application/json'}}),'Cleanup reservation reconciliation needs retry.',412);
   return reply({deleted:true});
  }
  must(request.method==='PUT'&&area==='target'&&!isLedger,'Gateway method is not allowed.',405);
  must(request.headers.has('If-Match')||request.headers.get('If-None-Match')==='*','Conditional write required.',428);
  const cap=(isCurrent||isAdmission)?S.maxManifestBytes:(isCheckpoint||isVerification)?S.maxCheckpointBytes:PILOT.maxObjectBytes;
  const body=await limitedBody(request.body,cap),sha=await digest(body);
  must(request.headers.get('X-Object-SHA256')===sha,'Upload checksum mismatch.',400);
  if(!isCurrent&&!isCheckpoint&&!isVerification&&!isAdmission)must(key.endsWith('-'+sha+'.json.gz'),'Immutable key checksum differs.',400);
  const existing=await head(env.TARGET,key);
  if(!isCurrent&&!isCheckpoint&&!isVerification&&!isAdmission&&existing){must(existing.customMetadata?.sha256===sha&&existing.size===body.length,'Immutable evidence differs.');return reply({unchanged:true},200,{ETag:existing.httpEtag||'"'+existing.etag+'"'});}
  if(isAdmission){const admission=JSON.parse(new TextDecoder().decode(body)),pointer=await get(env.TARGET,CURRENT);must(pointer,'A complete publication is required before admission.');const manifest=validateManifest(await pointer.json());must(admission.office===S.office&&admission.verified===true&&admission.schema_version===CONFIG.schemaVersion&&admission.publication_id===manifest.source_publication_id&&/^[a-f0-9]{64}$/.test(admission.comparison_sha256||''),'Admission requires a matching verified publication.');}
  let progress={};
  if(isVerification||isCheckpoint){
   const encoded=request.headers.get('X-Checkpoint-Summary');let summary;
   if(encoded){
    must(new TextEncoder().encode(encoded).length<=CONFIG.coverage.progressMetadataBytes,'Invalid checkpoint summary.',400);
    summary=JSON.parse(encoded);
    must(summary.office===S.office&&summary.format_version===S.formatVersion&&typeof summary.work_id==='string','Invalid checkpoint identity.',400);
    const parsed=JSON.parse(summary.progress||'null');
    must(parsed&&parsed.kind===(isVerification?'verification':'import'),'Invalid checkpoint progress.',400);
    progress={progress:summary.progress};
   }else{
    // Compatibility for small legacy fixtures only; large checkpoint validation lives in Node.
    const state=await unpack(body,null,CONFIG.authority.legacyCheckpointJSONBytes);
    must(state.office===S.office&&(isVerification?state.version===CONFIG.schemaVersion:state.format_version===S.formatVersion),'Invalid checkpoint identity.',400);
    progress=progressMetadata(state,isVerification);
   }
  }
  if(isCurrent){
   const manifest=validateManifest(JSON.parse(new TextDecoder().decode(body))),prior=existing?validateManifest(await (await get(env.TARGET,key)).json()):null;
   const retained=[...new Set([manifest.version,...(prior?.retained_versions||[])])].slice(0,manifest.previous_manifest?PILOT.maxStoredVersions:Infinity);
   if(manifest.previous_manifest){const descriptor=manifest.previous_manifest;must(validKey(descriptor.key),'Invalid previous archive.');const archive=await get(env.TARGET,descriptor.key);must(archive,'Previous archive missing.');const previous=await unpack(new Uint8Array(await archive.arrayBuffer()),descriptor.sha256);must(prior&&canonical(previous)===canonical(prior),'Previous archive does not match current publication.');}
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
  const reservation=isCurrent||isAdmission?S.maxManifestBytes:isCheckpoint||isVerification?S.maxCheckpointBytes:body.length;
  if(!ledger.keys[key]){
   ledger.keys[key]={bytes:reservation,sha:isCurrent||isAdmission||isCheckpoint||isVerification?null:sha};
   const used=Object.values(ledger.keys).reduce((sum,entry)=>sum+entry.bytes,0)+S.maxLedgerBytes;
   must(used<=S.maxBucketBytes&&Object.keys(ledger.keys).length+1<=S.maxBucketObjects,'Shadow storage guard reached; publication retained.',413);
   const encoded=bytes(ledger);must(encoded.length<=S.maxLedgerBytes,'Storage ledger budget reached.',413);
   const condition=ledgerObject?new Headers({'If-Match':ledgerObject.httpEtag||'"'+ledgerObject.etag+'"'}):new Headers({'If-None-Match':'*'});
   must(await put(S.ledgerKey,encoded,{onlyIf:condition,httpMetadata:{contentType:'application/json'}}),'Storage ledger changed; retry the job.',412);
  }else must(ledger.keys[key].bytes>=body.length&&(!ledger.keys[key].sha||ledger.keys[key].sha===sha),'Stored reservation differs.');
  const result=await put(key,body,{onlyIf:request.headers,httpMetadata:{contentType:isCurrent||isAdmission?'application/json':'application/gzip'},customMetadata:{sha256:sha,office:S.office,...progress}});
  must(result,'Publication/checkpoint changed; conditional write refused.',412);
  return reply({stored:true,bytes:body.length},200,{ETag:result.httpEtag||'"'+result.etag+'"'});
 }catch(error){return reply({error:error instanceof PilotError?error.message:'R2 gateway failed safely.'},error.status||503);}
 }};}
export default createGateway();
