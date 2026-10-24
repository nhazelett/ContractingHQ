import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFetch} from '../web/source-requests.mjs';

test('Concurrent portfolio and fiscal calls share pacing',async()=>{
 let time=0;const starts=[];
 const request=createSourceFetch({now:()=>time,sleep:async ms=>{time+=ms;},fetcher:async()=>{starts.push(time);return new Response('{}');}});
 await Promise.all(Array.from({length:12},()=>request('https://example.test')));
 assert.equal(starts.length,12);
 for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=400);
});
test('Rate limiting honors Retry-After before succeeding',async()=>{
 let time=0,calls=0;const retries=[];
 const request=createSourceFetch({now:()=>time,sleep:async ms=>{time+=ms;},onRetry:r=>retries.push(r),fetcher:async()=>++calls===1?new Response('',{status:429,headers:{'Retry-After':'300'}}):new Response('{}')});
 assert.equal((await request('https://example.test')).status,200);
 assert.equal(calls,2);assert.ok(time>=300000);assert.equal(retries[0].delay,300000);
});
test('Temporary errors stop after three retries, permanent errors do not retry',async()=>{
 let time=0,calls=0;
 const request=createSourceFetch({now:()=>time,sleep:async ms=>{time+=ms;},fetcher:async()=>{calls++;return new Response('',{status:503});}});
 assert.equal((await request('https://example.test')).status,503);assert.equal(calls,4);
 calls=0;const missing=createSourceFetch({fetcher:async()=>{calls++;return new Response('',{status:404});}});
 assert.equal((await missing('https://example.test')).status,404);assert.equal(calls,1);
});
test('Changing offices aborts queued requests without blocking subsequent requests',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 const request=createSourceFetch({fetcher:async()=>{calls++;return new Response('{}');}});
 await assert.rejects(request('https://example.test',{signal:controller.signal}),{name:'AbortError'});
 assert.equal((await request('https://example.test')).status,200);assert.equal(calls,1);
});
