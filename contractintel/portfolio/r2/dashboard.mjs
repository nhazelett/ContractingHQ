import {automaticProfile} from '../queue/profile.mjs';
import {queueSummary} from '../queue/store.mjs';
import {CONFIG,r2Profile} from '../ingest.mjs';
import {storedCoverage} from './coverage.mjs';
import {createFormat} from './format.mjs';
import {readProgress} from './progress.mjs';
export async function coverageDashboard(env){
 const coverage=await storedCoverage(env),offices=[];
 for(const entry of coverage.offices){
  const profile=CONFIG.r2Offices[entry.office]?r2Profile(entry.office):automaticProfile(entry.office,env.OFFICES||[]),bucket=env[profile.binding],prefix=profile.prefix+'/';
  const row={...entry,phase:null,progress:null,storage:null,updated_at:null,publication_awards:null,issue:null,
   limits:{bytes:CONFIG.r2Nightly.maxBucketBytes,objects:CONFIG.r2Nightly.maxBucketObjects},
   workflow_url:'https://github.com/'+CONFIG.githubRepository+'/actions/workflows/'+(profile.workflow||CONFIG.r2Nightly.githubWorkflow)};
  if(!bucket){row.issue='Storage binding unavailable; live loading remains available.';offices.push(row);continue;}
  try{
   // HEAD never downloads/decompresses award records or the large checkpoint.
   const [checkpoint,verification,list,pointer]=await Promise.all([
    bucket.head(prefix+'checkpoint.json.gz'),bucket.head(prefix+'verification.json.gz'),
    bucket.list({prefix,limit:CONFIG.coverage.listLimit}),bucket.get(prefix+'current.json')]);
   row.storage={bytes:list.objects.reduce((n,o)=>n+o.size,0),objects:list.objects.length,complete:!list.truncated,measured_at:new Date().toISOString()};
   const saved=readProgress(checkpoint),verified=readProgress(verification);
   row.progress=verified&&(!saved||new Date(verified.saved_at)>new Date(saved.saved_at))?verified:saved;
   if(pointer){
    const manifest=createFormat(profile).validateManifest(await pointer.json());
    row.updated_at=manifest.source_published_at;
    if(entry.status!=='stored')row.status='verifying';
   }else if(checkpoint)row.status='importing';
   if(row.progress){row.phase=row.progress.phase;if(row.progress.source_http_status)row.issue='The last saved batch encountered source HTTP '+row.progress.source_http_status+'. Progress is retained; see the workflow for retry status.';}
   else if(checkpoint)row.issue='An import checkpoint exists. Detailed counters will appear when the next batch saves progress.';
  }catch{row.issue='Coverage measurements unavailable. Existing contract loading is unchanged.';}
  offices.push(row);
 }
 const queue=await queueSummary(env.PORTFOLIO_DB);
 return {queue,offices,default_status:'live',directory_count:env.OFFICES?.length||null,generated_at:new Date().toISOString(),
  note:'Saved progress is not a heartbeat. A batch may be running, waiting, or stopped; its workflow has the current execution status. Storage is measured, not a billing estimate.'};
}

