// A single runner process can trust bytes it has already checksum-verified.
// Cache only immutable object keys; current/checkpoint/ledger always hit R2.
import {PILOT,validKey,createFormat} from './format.mjs';
export function cacheImmutable(store,profile=PILOT){
 const {PILOT,validKey}=createFormat(profile);
 const entries=new Map();return {...store,async get(key){
  const immutable=validKey(key)&&key!==PILOT.prefix+'/current.json';
  if(!immutable)return store.get(key);
  if(!entries.has(key)){const value=await store.get(key);if(value)entries.set(key,value);return value;}
  return entries.get(key);
 }};
}
