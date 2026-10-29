import {CONFIG} from '../ingest.mjs';
export function automaticProfile(office,directory){
 if(!/^[A-Z0-9]{6}$/.test(office)||!directory.some(row=>row.code===office))throw new Error('Automatic office is not in the contracting office directory.');
 if(CONFIG.r2Offices[office])throw new Error('Existing pilot offices keep their original workflow and bucket.');
 return {...CONFIG.r2Pilot,office,prefix:'pilot/'+office,bucket:CONFIG.rollout.sharedBucket,baselineBucket:CONFIG.rollout.sharedBucket,binding:CONFIG.rollout.sharedBinding,seedVerifiedPilot:false,readEnabled:false,admitOnVerified:true,maxAuditRuns:512,maxOfficeBackfillRequests:120000,maxVerificationRequests:120000,maxBucketBytes:CONFIG.capacity.perOfficeR2Bytes,maxBucketObjects:1024,maxCheckpointBytes:33554432,maxCheckpointJSONBytes:268435456,maxExportBytes:536870912,maxObjectBytes:33554432,maxUploadBytesPerJob:134217728,maxObjects:512,maxSnapshotBytes:134217728,maxUploadBytes:268435456};
}
