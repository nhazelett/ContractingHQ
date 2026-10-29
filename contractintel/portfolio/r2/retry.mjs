import {CONFIG} from '../ingest.mjs';
const statuses=new Set([429,500,502,503,504]);
const networkCodes=new Set(['ECONNRESET','ECONNREFUSED','EPIPE','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT']);
export function transientConnection(error){
 const code=error?.cause?.code||error?.code;
 if(code)return networkCodes.has(code);
 return error?.name==='TimeoutError'||error instanceof TypeError&&['fetch failed','terminated'].includes(error.message);
}
export function gatewayConnectionFailure(error){
 return new Error('R2 gateway network failure: '+error.message,{cause:error});
}
export async function retryGateway(operation,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,onRetry=()=>{},attempts=CONFIG.authority.retryAttempts}={}){
 if(!Number.isSafeInteger(attempts)||attempts<1||attempts>CONFIG.authority.retryAttempts)throw new Error('Invalid gateway retry budget.');
 for(let at=0;;at++){
  let response,networkError;
  try{response=await operation();}catch(error){
   if(!transientConnection(error))throw error;
   networkError=error;
   if(at+1>=attempts)throw gatewayConnectionFailure(error);
  }
  if(response&&(!statuses.has(response.status)||at+1>=attempts))return response;
  await response?.body?.cancel();
  const delay=Math.min(CONFIG.authority.retryMaxMs,CONFIG.authority.retryBaseMs*2**at)+Math.floor(random()*CONFIG.authority.retryJitterMs);
  await onRetry({attempt:at+1,status:response?.status??null,network_failure:!!networkError,delay_ms:delay});await sleep(delay);
 }
}
