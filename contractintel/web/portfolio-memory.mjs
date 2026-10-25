// Browser-only public metadata. No server writes, background downloads or source cursors.
const fields=['award_id','piid','description','recipient','start_date','current_end_date','potential_end_date','latest_action_date','last_modified_date','award_amount_cents','obligation_cents','parent_piid','source_url','competition','pricing_type','set_aside','office_code','office_name','latest_mod_number','latest_option_mod_number','details_pending','details_unavailable','detail_error','history_pending'];
export function snapshotKey(office,window){return office+'|'+window;}
export function makeSnapshot(office,window,rows,now=Date.now()){
 if(!Number.isFinite(now)||now<0||!/^[A-Z0-9]{6}$/.test(office)||!/^\d{4}-\d{2}-\d{2}$/.test(window)||!Array.isArray(rows)||rows.length>10000)return null;
 const records=rows.filter(r=>r&&!r.details_pending&&!r.details_unavailable&&typeof r.award_id==='string'&&r.award_id.startsWith('CONT_AWD_'+office)&&/^CONT_AWD_[A-Z0-9][A-Z0-9._-]*$/.test(r.award_id)&&r.award_id.length<=250).map(r=>Object.fromEntries(fields.filter(k=>r[k]===null||['string','boolean','number'].includes(typeof r[k])).map(k=>[k,r[k]])));
 const snapshot={version:1,key:snapshotKey(office,window),office,window,saved:now,records};
 snapshot.bytes=new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
 return snapshot.bytes<=2*1024*1024?snapshot:null;
}
export function validSnapshot(value,office,window){
 if(!value||value.version!==1||value.key!==snapshotKey(office,window)||value.office!==office||value.window!==window)return null;
 return makeSnapshot(office,window,value.records,value.saved);
}
export function visiblePortfolio(records,preview){
 const merged=new Map([...preview].map(([id,row])=>[id,{...row,source_refresh_pending:true}]));
 for(const [id,row]of records){const saved=merged.get(id);merged.set(id,saved&&row.details_pending?{...saved,description:row.description||saved.description,source_refresh_pending:true}:row);}
 return [...merged.values()];
}
export function createPortfolioMemory(factory){
 if(!arguments.length){try{factory=globalThis.indexedDB;}catch{factory=null;}}
 let opening,writes=Promise.resolve();
 const open=()=>opening||=(new Promise(resolve=>{
  if(!factory){resolve(null);return;}
  let finished=false;const done=db=>{if(finished){db?.close();return;}finished=true;clearTimeout(timer);resolve(db);};
  const timer=setTimeout(()=>done(null),800);
  try{const request=factory.open('contractintel-browser-portfolios',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots',{keyPath:'key'});request.onsuccess=()=>done(request.result);request.onerror=request.onblocked=()=>done(null);}catch{done(null);}
 }));
 return {
  async get(office,window){try{const db=await open();if(!db)return null;return await new Promise(resolve=>{const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get(snapshotKey(office,window));let value=null;r.onsuccess=()=>{value=validSnapshot(r.result,office,window);};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>resolve(null);});}catch{return null;}},
  put(snapshot){if(!snapshot)return Promise.resolve(false);const task=async()=>{try{const db=await open();if(!db)return false;return await new Promise(resolve=>{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),r=store.getAll();r.onsuccess=()=>{try{const others=r.result.filter(s=>s.key!==snapshot.key).sort((a,b)=>b.saved-a.saved);let bytes=snapshot.bytes,count=1;for(const old of others){if(count>=3||bytes+old.bytes>6*1024*1024)store.delete(old.key);else{bytes+=old.bytes;count++;}}store.put(snapshot);}catch{try{tx.abort();}catch{}resolve(false);}};tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>resolve(false);});}catch{return false;}};writes=writes.then(task,task);return writes;}
 };
}
