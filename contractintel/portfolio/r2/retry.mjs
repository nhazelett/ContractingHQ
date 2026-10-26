import {CONFIG} from '../ingest.mjs';
const statuses=new Set([429,500,502,503,504]);
export async function retryGateway(operation,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),random=Math.random,onRetry=()=>{},attempts=CONFIG.authority.retryAttempts}={}){
 for(let at=0;;at++){
  const response=await operation();
  if(!statuses.has(response.status)||at+1>=attempts)return response;
  await response.body?.cancel();
  const delay=Math.min(CONFIG.authority.retryMaxMs,CONFIG.authority.retryBaseMs*2**at)+Math.floor(random()*CONFIG.authority.retryJitterMs);
  await onRetry({attempt:at+1,status:response.status,delay_ms:delay});await sleep(delay);
 }
}
