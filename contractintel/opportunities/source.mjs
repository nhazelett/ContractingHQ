import {normalizeNotice,postedKey} from './notice.mjs';

export class OpportunityError extends Error{constructor(message,status=503){super(message);this.status=status;}}
export const DAILY_REQUEST_BUDGET=10;
export async function reserveRequest(db,now=new Date()){
 const day=now.toISOString().slice(0,10);
 await db.prepare('INSERT OR IGNORE INTO opp_usage(day,requests) VALUES (?,0)').bind(day).run();
 const row=await db.prepare('UPDATE opp_usage SET requests=requests+1 WHERE day=? AND requests<? RETURNING requests').bind(day,DAILY_REQUEST_BUDGET).first();
 if(!row)throw new OpportunityError('The shared SAM request budget has been reached for today. Indexed notices remain available; use the official source for additional details.',429);
 return row.requests;
}
export async function samRequest(db,key,url,{fetcher=fetch,now=new Date()}={}){
 if(!key)throw new OpportunityError('SAM access is not configured.');
 if(url.origin!=='https://api.sam.gov')throw new OpportunityError('Unexpected source address.',400);
 await reserveRequest(db,now);const target=new URL(url);target.searchParams.set('api_key',key);
 let r;try{r=await fetcher(target,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(25000)});}catch{throw new OpportunityError('SAM could not be reached. Previously indexed records are retained.');}
 if(!r.ok){await r.body?.cancel();throw new OpportunityError(r.status===429?'SAM has reached its request limit. Previously indexed records are retained.':'SAM could not complete the request (HTTP '+r.status+'). Previously indexed records are retained.',r.status===429?429:503);}
 const reader=r.body.getReader();let size=0,parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12_000_000){await reader.cancel();throw new OpportunityError('SAM response exceeded the bounded import size.');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 return new TextDecoder().decode(bytes);
}
export function descriptionReference(value){try{const u=new URL(value);if(u.origin!=='https://api.sam.gov'||u.username||u.password||!u.pathname.includes('noticedesc'))return null;for(const k of [...u.searchParams.keys()])if(/api_?key/i.test(k))u.searchParams.delete(k);return u.href;}catch{return null;}}
const usDate=day=>day.slice(5,7)+'/'+day.slice(8,10)+'/'+day.slice(0,4);
export async function refreshNotices(env,{fetcher=fetch,now=new Date(),maxCalls=3,days=7,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const db=env.OPPORTUNITIES_DB;if(!db||!env.SAM_API_KEY)throw new OpportunityError('Opportunity ingestion is not configured.');
 const checkedAt=now.toISOString(),lease=new Date(now.valueOf()+900000).toISOString();
 const lock=await db.prepare("INSERT INTO opp_refresh(singleton,last_attempt,last_error,lease_until) VALUES(1,?,NULL,?) ON CONFLICT(singleton) DO UPDATE SET last_attempt=excluded.last_attempt,last_error=NULL,lease_until=excluded.lease_until WHERE opp_refresh.lease_until IS NULL OR opp_refresh.lease_until<? RETURNING singleton").bind(checkedAt,lease,checkedAt).first();
 if(!lock)throw new OpportunityError('An opportunity refresh is already running.',409);
 const id=crypto.randomUUID(),rows=new Map(),windows=[];let calls=0,rejected=0;
 try{
  for(let age=0;age<days&&calls<maxCalls;age++){
   const day=new Date(now.valueOf()-age*86400000).toISOString().slice(0,10),window={date:day,source_total:null,returned:0,indexed:0,complete:false};windows.push(window);let page=0;
   while(calls<maxCalls){
    const url=new URL('https://api.sam.gov/opportunities/v2/search');for(const[k,v]of Object.entries({postedFrom:usDate(day),postedTo:usDate(day),limit:1000,offset:page}))url.searchParams.set(k,v);
    calls++;const raw=await samRequest(db,env.SAM_API_KEY,url,{fetcher,now});let data;try{data=JSON.parse(raw);}catch{throw new OpportunityError('SAM returned unreadable notice data.');}
    if(!Array.isArray(data.opportunitiesData)||!Number.isInteger(data.totalRecords)||data.totalRecords<0)throw new OpportunityError('SAM returned an unexpected notice response.');
    window.source_total=data.totalRecords;if(!data.opportunitiesData.length&&window.returned<data.totalRecords)throw new OpportunityError('SAM returned an incomplete search page.');
    window.returned+=data.opportunitiesData.length;
    for(const record of data.opportunitiesData){
     let notice;try{notice=normalizeNotice(record,{checkedAt});}catch{rejected++;continue;}
     if(notice.posted_date!==day){rejected++;continue;}
     const encoded=JSON.stringify(notice);if(new TextEncoder().encode(encoded).length>60000)throw new OpportunityError('A source notice exceeds the bounded record size.');
     rows.set(notice.notice_id,{notice,encoded,ref:descriptionReference(record.description)});window.indexed++;
    }
    if(window.returned>=window.source_total){window.complete=true;break;}page++;if(calls<maxCalls)await pause(1000);
   }if(calls<maxCalls)await pause(1000);
  }
  const coverage={source:'SAM.gov',requested_days:days,windows,calls,rejected,complete:windows.length===days&&windows.every(w=>w.complete)&&rejected===0,scope:'Recent federal postings; source search pages, not a complete active-opportunity inventory.'};
  await db.prepare('INSERT INTO opp_runs(id,checked_at,coverage_json,row_count,status) VALUES(?,?,?,?,?)').bind(id,checkedAt,JSON.stringify(coverage),rows.size,'staged').run();
  const items=[...rows.values()];
  for(let start=0;start<items.length;start+=20){const batch=items.slice(start,start+20),params=batch.flatMap(r=>[id,r.notice.notice_id,postedKey(r.notice),r.encoded,r.ref]);await db.prepare('INSERT INTO opp_notices(run_id,notice_id,posted_key,data_json,description_ref) VALUES '+batch.map(()=>'(?,?,?,?,?)').join(',')).bind(...params).run();}
  await db.prepare("INSERT INTO opp_search(run_id,notice_id,title,solicitation) SELECT run_id,notice_id,json_extract(data_json,'$.title'),json_extract(data_json,'$.solicitation_number') FROM opp_notices WHERE run_id=?").bind(id).run();
  const count=await db.prepare('SELECT count(*) AS n FROM opp_notices WHERE run_id=?').bind(id).first();if(count.n!==rows.size)throw new OpportunityError('Staged opportunity count did not validate.');
  await db.batch([db.prepare("UPDATE opp_runs SET status='published' WHERE id=?").bind(id),db.prepare('INSERT INTO opp_active(singleton,run_id) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET run_id=excluded.run_id').bind(id),db.prepare('UPDATE opp_refresh SET lease_until=NULL,last_error=NULL WHERE singleton=1')]);
  // Retain the current and previous public index; never touch portfolio tables.
  const retained=await db.prepare("SELECT id FROM opp_runs WHERE status='published' ORDER BY checked_at DESC,id DESC LIMIT 2").all();const ids=retained.results.map(r=>r.id);if(!ids.includes(id))ids.push(id);const marks=ids.map(()=>'?').join(',');
  await db.batch([db.prepare('DELETE FROM opp_search WHERE run_id NOT IN ('+marks+')').bind(...ids),db.prepare('DELETE FROM opp_notices WHERE run_id NOT IN ('+marks+')').bind(...ids),db.prepare('DELETE FROM opp_runs WHERE id NOT IN ('+marks+')').bind(...ids)]);
  await db.prepare('DELETE FROM opp_descriptions WHERE checked_at<?').bind(new Date(now.valueOf()-7*86400000).toISOString()).run();
  return {run_id:id,checked_at:checkedAt,rows:rows.size,coverage};
 }catch(error){await db.prepare('UPDATE opp_refresh SET lease_until=NULL,last_error=? WHERE singleton=1').bind(error instanceof OpportunityError?error.message:'Opportunity refresh failed; the previous index is retained.').run();throw error;}
}

export function descriptionText(html){
 return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<(?:br\b[^>]*|\/p|\/div|\/li|\/h[1-6])>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n])).replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
}
