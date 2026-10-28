// Full-field staged import; one atomic D1 batch changes the authoritative publication.
import {CONFIG} from './ingest.mjs';
import {createFormat} from './r2/format.mjs';
import {publication} from './read.mjs';
import {exportOffice} from '../benchmarks/r2/export.mjs';
const TABLES=['offices','ingest_runs','awards','award_windows','award_history_pages','fiscal_totals','office_publications'];
const PRIMARY={offices:['dodaac'],ingest_runs:['id'],awards:['generated_unique_award_id'],award_windows:['generated_unique_award_id','window_start'],award_history_pages:['generated_unique_award_id','page'],fiscal_totals:['office_dodaac','fiscal_year'],office_publications:['office_dodaac']};
const must=(value,message)=>{if(!value)throw new Error(message);};
const key=(table,row)=>JSON.stringify(PRIMARY[table].map(name=>row[name]));

// Resume operational config drift only when the complete candidate still
// matches the immutable validation receipt. Never replace a receipt hash.
export async function resumeValidatedCandidate(db,tables,profile){
 const {checkTables,canonical,digest}=createFormat(profile),pub=checkTables(tables);
 const receipt=await db.prepare('SELECT * FROM portfolio_publication_receipts WHERE publication_id=?').bind(pub.published_run_id).first();
 if(!receipt)return tables;
 must(receipt.office_dodaac===profile.office,'D1 validation receipt identity differs.');
 if(await digest(canonical(tables))===receipt.content_sha256)return tables;
 const staged=await db.prepare("SELECT data_json FROM ingest_stage WHERE work_id=? AND record_kind='ingest_runs' AND record_key=?").bind('authority:'+pub.published_run_id,JSON.stringify([pub.published_run_id])).first();
 const original=staged?JSON.parse(staged.data_json):await db.prepare('SELECT * FROM ingest_runs WHERE id=?').bind(pub.published_run_id).first();
 must(original?.id===pub.published_run_id&&typeof original.config_json==='string','Validated candidate metadata is unavailable; publication retained.');
 const restored={...tables,ingest_runs:tables.ingest_runs.map(run=>run.id===pub.published_run_id?{...run,config_json:original.config_json}:run)};
 await receiptFor(db,restored,profile);
 return restored;
}
export async function receiptFor(db,tables,profile){
 const {checkTables,canonical,digest}=createFormat(profile),pub=checkTables(tables),hash=await digest(canonical(tables));
 const row=await db.prepare('SELECT * FROM portfolio_publication_receipts WHERE publication_id=?').bind(pub.published_run_id).first();
 if(row)must(row.office_dodaac===profile.office&&row.content_sha256===hash,'D1 validation receipt identity differs.');
 return {row,hash,pub};
}
export async function recordValidation(db,tables,profile,comparison){
 const {row,hash,pub}=await receiptFor(db,tables,profile);
 must(comparison?.match===true,'Independent source comparison did not match; D1 publication retained.');
 if(row)return row;
 const encoded=JSON.stringify(comparison);must(new TextEncoder().encode(encoded).length<=CONFIG.authority.maxReceiptBytes,'Validation receipt budget reached.');
 await db.prepare("INSERT INTO portfolio_publication_receipts(publication_id,office_dodaac,content_sha256,comparison_json,status,created_at) VALUES(?,?,?,?, 'validated',?) ON CONFLICT(publication_id) DO NOTHING").bind(pub.published_run_id,profile.office,hash,encoded,new Date().toISOString()).run();
 return (await receiptFor(db,tables,profile)).row;
}
export async function publishD1(db,tables,profile,{now=Date.now}={}){
 const format=createFormat(profile),{canonical,checkTables}=format,{row:receipt,pub}=await receiptFor(db,tables,profile);
 must(receipt&&JSON.parse(receipt.comparison_json).match===true,'A matching independent validation receipt is required.');
 const existing=await publication(db,profile.office);
 if(existing?.published_run_id===pub.published_run_id){
  const restored=await exportOffice(db,{profile});must(canonical(restored)===canonical(tables),'Published D1 fields differ from the validated candidate.');return {tables:restored,version:pub.published_run_id,reconciled:true};
 }
 checkTables(tables);const work='authority:'+pub.published_run_id,schemas={};
 for(const table of TABLES){
  schemas[table]=(await db.prepare('PRAGMA table_info('+table+')').all()).results;
  const names=schemas[table].map(c=>c.name);
  for(const value of tables[table]){
   must(Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name)),'D1 candidate schema differs for '+table+'.');
   for(const column of schemas[table]){
    const v=value[column.name];
    must(v===null||column.type==='INTEGER'&&Number.isSafeInteger(v)||column.type==='TEXT'&&typeof v==='string','D1 candidate field type differs for '+table+'.'+column.name);
   }
  }
 }
 const saved=new Set();let kind='',record='';
 for(;;){
  const page=(await db.prepare('SELECT record_kind,record_key FROM ingest_stage WHERE work_id=? AND (record_kind>? OR (record_kind=? AND record_key>?)) ORDER BY record_kind,record_key LIMIT ?').bind(work,kind,kind,record,CONFIG.authority.stageIndexBatchRows).all()).results;
  if(!page.length)break;for(const row of page)saved.add(row.record_kind+'|'+row.record_key);
  must(saved.size<=CONFIG.authority.maxStageRows,'D1 stage row count budget reached.');kind=page.at(-1).record_kind;record=page.at(-1).record_key;
 }
 let batches=0;
 const storage=async()=>{const probe=await db.prepare('SELECT 1 AS authority_storage_probe').all();must(Number.isFinite(probe.meta?.size_after)&&probe.meta.size_after<CONFIG.maxStorageBytes,'D1 storage guard reached; publication retained.');return probe.meta.size_after;};
 await storage();
 for(const table of TABLES){
  const pending=tables[table].map(row=>({key:key(table,row),data:JSON.stringify(row)})).filter(row=>!saved.has(table+'|'+row.key));
  for(let at=0;at<pending.length;at+=CONFIG.authority.stageBatchRows){
   const batch=pending.slice(at,at+CONFIG.authority.stageBatchRows);
   for(const row of batch)must(new TextEncoder().encode(row.data).length<=CONFIG.authority.maxStageRowBytes,'D1 stage row budget reached; no source fields were dropped.');
   await db.batch(batch.map(row=>db.prepare('INSERT INTO ingest_stage(work_id,record_kind,record_key,data_json) VALUES(?,?,?,?) ON CONFLICT(work_id,record_kind,record_key) DO UPDATE SET data_json=excluded.data_json WHERE data_json<>excluded.data_json').bind(work,table,row.key,row.data)));
   if(++batches%CONFIG.authority.storageCheckEveryBatches===0)await storage();
  }
 }
 // Validate the SQL extraction path itself before any published rows change.
 const done=new Set(JSON.parse(receipt.validated_tables_json));
 for(const table of TABLES){
  if(done.has(table))continue;
  const names=schemas[table].map(c=>c.name),projection=names.map(name=>"json_extract(data_json,'$."+name+"') AS "+name).join(',');
  const rows=[];let after='';
  for(;;){
   const page=(await db.prepare('SELECT record_key,'+projection+' FROM ingest_stage WHERE work_id=? AND record_kind=? AND record_key>? ORDER BY record_key LIMIT ?').bind(work,table,after,CONFIG.authority.readBatchRows).all()).results;
   if(!page.length)break;after=page.at(-1).record_key;rows.push(...page.map(({record_key,...row})=>row));
  }
  const sorted=value=>[...value].sort((a,b)=>key(table,a).localeCompare(key(table,b)));
  must(canonical(sorted(rows))===canonical(sorted(tables[table])),'D1 staged round trip differs for '+table+'.');
  done.add(table);await db.prepare('UPDATE portfolio_publication_receipts SET validated_tables_json=? WHERE publication_id=?').bind(JSON.stringify([...done]),pub.published_run_id).run();
 }
 await storage();
 const before=existing?.published_run_id||'',assertion=crypto.randomUUID(),statements=[
  db.prepare("INSERT INTO portfolio_publication_assertions VALUES(?,CASE WHEN coalesce((SELECT published_run_id FROM office_publications WHERE office_dodaac=?),'')=? THEN 1 ELSE 0 END)").bind(assertion,profile.office,before)
 ];
 // Insert referenced offices/runs first; no delete or upsert is visible outside this batch.
 for(const table of TABLES){
  const names=schemas[table].map(c=>c.name),primary=PRIMARY[table],updates=names.filter(n=>!primary.includes(n));
  const select=names.map(name=>"json_extract(data_json,'$."+name+"')").join(',');
  const conflict=updates.length?'DO UPDATE SET '+updates.map(n=>n+'=excluded.'+n).join(',')+' WHERE '+updates.map(n=>table+'.'+n+' IS NOT excluded.'+n).join(' OR '):'DO NOTHING';
  statements.push(db.prepare('INSERT INTO '+table+'('+names.join(',')+') SELECT '+select+' FROM ingest_stage WHERE work_id=? AND record_kind=? ON CONFLICT('+primary.join(',')+') '+conflict).bind(work,table));
  if(table==='awards'){
   statements.push(db.prepare("DELETE FROM awards WHERE office_dodaac=? AND generated_unique_award_id NOT IN(SELECT json_extract(data_json,'$.generated_unique_award_id') FROM ingest_stage WHERE work_id=? AND record_kind='awards')").bind(profile.office,work));
   for(const child of ['award_windows','award_history_pages'])statements.push(db.prepare('DELETE FROM '+child+' WHERE generated_unique_award_id IN(SELECT generated_unique_award_id FROM awards WHERE office_dodaac=?)').bind(profile.office));
   statements.push(db.prepare('DELETE FROM fiscal_totals WHERE office_dodaac=?').bind(profile.office));
  }
 }
 statements.push(db.prepare("UPDATE portfolio_publication_receipts SET status='published' WHERE publication_id=?").bind(pub.published_run_id),db.prepare('DELETE FROM ingest_stage WHERE work_id=?').bind(work),db.prepare('DELETE FROM portfolio_publication_assertions WHERE assertion_id=?').bind(assertion));
 try{await db.batch(statements);}catch(error){
  // A lost response can mean a committed transaction. Reconcile by version, never replay blindly.
  const observed=await publication(db,profile.office).catch(()=>null);if(observed?.published_run_id!==pub.published_run_id)throw error;
 }
 const restored=await exportOffice(db,{profile});must(canonical(restored)===canonical(tables),'Published D1 round trip differs; R2 cache was not changed.');
 return {tables:restored,version:pub.published_run_id,reconciled:false};
}
