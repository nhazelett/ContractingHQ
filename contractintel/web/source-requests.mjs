// One request budget shared by portfolio, history, and fiscal scans in this tab.
export function wait(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(signal.reason);
 const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});
});}
export function createSourceFetch({fetcher=fetch,now=Date.now,sleep=wait,interval=400,onRetry=()=>{}}={}){
 let queue=Promise.resolve(),nextStart=0;
 async function slot(signal,start){
  const turn=queue.then(async()=>{
   signal?.throwIfAborted();
   while(nextStart>now())await sleep(nextStart-now(),signal);
   signal?.throwIfAborted();nextStart=now()+interval;return {request:start()};
  });
  queue=turn.catch(()=>{});return turn;
 }
 return async(url,options={})=>{
  for(let attempt=0;;attempt++){
   let response,error;
   try{response=await (await slot(options.signal,()=>fetcher(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)}))).request;}catch(e){options.signal?.throwIfAborted();error=e;}
   if(!error&&![429,502,503,504].includes(response.status))return response;
   if(attempt>=3){if(error)throw error;return response;}
   const header=response?.headers.get('Retry-After');
   const retryAfter=header===null||header===undefined?0:/^\d+$/.test(header)?Number(header)*1000:Math.max(0,Date.parse(header)-now())||0;
   const delay=Math.max(retryAfter,2000*4**attempt);
   nextStart=Math.max(nextStart,now()+delay);
   onRetry({status:response?.status||503,delay,attempt:attempt+1});
   await response?.body?.cancel();
  }
 };
}
