import {CONFIG} from '../ingest.mjs';
export function continuationDecision(report,batch){
 const config=CONFIG.r2Nightly;
 if(!Number.isSafeInteger(batch)||batch<1||batch>config.maxCohortRuns)throw new Error('Invalid continuation batch.');
 if(['passed','not_admitted'].includes(report.status))return {resume:false,reason:report.status};
 const officeBudget=report.failed_chunk?.total_source_requests>=config.maxOfficeBackfillRequests;
 const terminal=officeBudget||/review required|did not match|identity|checksum|storage guard|invalid|incomplete|differs|(?:Checkpoint|Office|Discovery|Changed|Export|Object|audit).*(?:budget|limit)/i.test(report.error||'');
 if(terminal)return {resume:false,blocked:true,reason:report.error};
 const gatewayTransient=/^R2 gateway HTTP (429|500|502|503|504)(?:[: ]|$)/.test(report.error||'');
 const transient=gatewayTransient||report.source_failures?.some(f=>[429,500,502,503,504].includes(f.status))||report.source_network_errors;
 const setup=report.source_requests===0&&batch<config.maxCohortSetupRuns&&/gateway.*HTTP (401|404)|did not become ready/i.test(report.error||'');
 const resumable=report.resume_recommended||transient||setup||/Chunk limit reached|Job upload budget reached/.test(report.error||'');
 if(!resumable)return {resume:false,blocked:true,reason:report.error||'No known resumable condition.'};
 if(batch>=config.maxCohortRuns)return {resume:false,blocked:true,reason:'Cohort continuation budget reached; progress retained for review.'};
 return {resume:true,next_batch:batch+1,maximum:config.maxCohortRuns};
}
