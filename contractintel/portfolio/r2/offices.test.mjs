import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG,r2Profile} from '../ingest.mjs';
import {createFormat} from './format.mjs';
import {createOfficeIngest} from './ingest.mjs';
import {createGateway} from './gateway.mjs';
import {source,office,fixed} from '../../tests/fixtures/portfolio-d1.mjs';
import {compareOffice} from '../compare.mjs';
function memory(){
 const objects=new Map();let revision=0;
 return {objects,get:async key=>objects.get(key)||null,head:async key=>objects.get(key)||null,async put(key,body,{expected,sha}={}){
  assert.equal(objects.get(key)?.etag||null,expected);const value={bytes:body,etag:String(++revision),sha};objects.set(key,value);return value;
 }};
}
const target={...office,code:'FA4800',name:'633rd Contracting Squadron'};
function upstream(){const original=source();return async(url,options={})=>{const response=await original.fetcher(String(url).replaceAll('FA4800','FA4528'),{...options,body:options.body?.replaceAll('FA4800','FA4528')});return Response.json(JSON.parse(JSON.stringify(await response.json()).replaceAll('FA4528','FA4800')));};}
test('A new FA4800 backfill publishes only after completion, preserves source metrics, and remains separate from FA4528',async()=>{
 const store=memory(),profile=r2Profile('FA4800'),engine=createOfficeIngest(profile),format=createFormat(profile),fetcher=upstream();
 const first=await engine.runR2Chunk({store,directory:[target],now:fixed,fetcher,config:{sourceIntervalMs:0,maxSourceRequests:4,sourceRequestReserve:2}});
 assert.equal(first.status,'yielded');assert.equal(await store.get(engine.CURRENT),null);
 assert.equal((await engine.runR2Chunk({store,directory:[target],now:fixed,fetcher,config:{sourceIntervalMs:0}})).status,'completed');
 const published=await engine.loadPublication(store);assert.equal(published.tables.awards.length,5);assert.ok(published.tables.awards.every(row=>row.office_dodaac==='FA4800'));
 assert.ok([...store.objects.keys()].every(key=>key.startsWith('pilot/FA4800/')));
 const comparison=await compareOffice({office:'FA4800',directory:[target],now:fixed,today:'2026-10-25',fetcher,getSnapshot:async start=>format.snapshotFromTables(published.tables,start,fixed)});
 assert.equal(comparison.match,true);assert.equal(comparison.windows.length,4);
 assert.equal(await createOfficeIngest(r2Profile('FA4528')).loadPublication(store),null);
 assert.throws(()=>r2Profile('FA9999'),/rollout/);
});
test('A scoped gateway rejects keys belonging to the other office before reading a bucket',async()=>{
 const worker=createGateway(r2Profile('FA4800'));let reads=0;const bucket={get:async()=>{reads++;return null;}};
 const response=await worker.fetch(new Request('https://gateway/object?key=pilot%2FFA4528%2Fcurrent.json',{headers:{Authorization:'Bearer fixture'}}),{TARGET:bucket,BASELINE:bucket,R2_UPDATE_TOKEN:'fixture'});
 assert.equal(response.status,400);assert.equal(reads,0);
});
