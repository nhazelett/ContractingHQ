import {CONFIG} from '../ingest.mjs';
export function automaticProfile(office,directory){
 if(!/^[A-Z0-9]{6}$/.test(office)||!directory.some(row=>row.code===office))throw new Error('Automatic office is not in the contracting office directory.');
 if(CONFIG.r2Offices[office])throw new Error('Existing pilot offices keep their original workflow and bucket.');
 return {...CONFIG.r2Pilot,office,prefix:'pilot/'+office,bucket:CONFIG.rollout.sharedBucket,baselineBucket:CONFIG.rollout.sharedBucket,binding:CONFIG.rollout.sharedBinding,seedVerifiedPilot:false,readEnabled:false,admitOnVerified:true,maxAuditRuns:CONFIG.r2Nightly.maxAuditRuns};
}
