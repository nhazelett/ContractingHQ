// A small, non-sensitive checkpoint summary stored as R2 object metadata.
// No source records, descriptions, credentials, or raw error strings leave the checkpoint.
import {CONFIG} from '../ingest.mjs';
export function progressMetadata(state,verification=false){
 const attempts=state.attempts||[],last=attempts.at(-1),failure=last?.http_failures?.at(-1);
 const integer=n=>Number.isSafeInteger(n)&&n>=0?n:null;
 const value={kind:verification?'verification':'import',phase:verification?'verification':state.phase,
 status:verification?'verifying':state.status,discovered:verification?null:integer(Object.keys(state.candidates||{}).length),
 prepared:verification?null:integer(state.hydrate_index),requests:integer(verification?state.requests:state.source_requests),
 source_http_status:integer(failure?.status),recorded_at:new Date().toISOString()};
 const text=JSON.stringify(value);
 if(new TextEncoder().encode(text).length>CONFIG.coverage.progressMetadataBytes)throw new Error('Progress metadata budget exceeded.');
 return {progress:text};
}
export function readProgress(head){
 try{const value=JSON.parse(head?.customMetadata?.progress||'null');if(!value||!['import','verification'].includes(value.kind))return null;return {...value,saved_at:head.uploaded?.toISOString?.()||null};}catch{return null;}
}
