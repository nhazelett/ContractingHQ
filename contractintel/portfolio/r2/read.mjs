import {officeEnabled} from './admission.mjs';
// Published R2 reads only. Missing or damaged copies fall back through the caller.
import {CONFIG,r2Profile} from '../ingest.mjs';
import {createFormat,PILOT,validateManifest,unpack,refreshSnapshot,PilotError} from './format.mjs';
export async function readR2(bucket,office,{start=CONFIG.windows[1],id,page=1,now=Date.now,d1Publication}={}){
 if(!bucket||!await officeEnabled(office,bucket))throw new PilotError('R2 office unavailable.',404);
 const {PILOT,validateManifest,unpack,refreshSnapshot}=createFormat(r2Profile(office));
 const pointer=await bucket.get(PILOT.prefix+'/current.json');if(!pointer)throw new PilotError('R2 publication unavailable.',404);
 const manifest=validateManifest(await pointer.json());
 if(d1Publication!==undefined&&(!d1Publication||manifest.d1_publication_version!==d1Publication.published_run_id||manifest.source_publication_id!==d1Publication.published_run_id))throw new PilotError('R2 cache does not match authoritative D1; use D1.',404);
 const read=async descriptor=>{const object=await bucket.get(descriptor.key);if(!object)throw new PilotError('R2 publication object missing.');return unpack(new Uint8Array(await object.arrayBuffer()),descriptor.sha256);};
 if(id!==undefined){
  if(!id?.startsWith('CONT_AWD_'+office))throw new PilotError('Invalid award identifier.',400);
  const index=await read(manifest.lookup),descriptor=index.awards[id];if(!descriptor)throw new PilotError('Award not stored.',404);
  const chunk=await read(descriptor),award=chunk.awards.find(row=>row.generated_unique_award_id===id),history=chunk.award_history_pages.find(row=>row.generated_unique_award_id===id&&row.page===page);
  if(!award||!history?.actions_json)throw new PilotError('Evidence page unavailable.',404);
  return {award:JSON.parse(award.record_json),history:{actions:JSON.parse(history.actions_json),has_next:!!history.has_next,page},fetched_at:manifest.source_published_at,source:'r2'};
 }
 if(!CONFIG.windows.includes(start))throw new PilotError('Invalid source window.',400);
 const payload=await read(manifest.snapshots[start]);
 if(payload.office!==office||payload.start!==start||payload.publication_id!==manifest.source_publication_id||payload.published_at!==manifest.source_published_at||payload.complete!==true||!Array.isArray(payload.records)||payload.fiscal_totals?.length!==2)throw new PilotError('Invalid R2 snapshot.');
 return refreshSnapshot(payload,now);
}
