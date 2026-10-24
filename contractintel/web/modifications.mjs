// Summarize reported actions; never infer a mod count from a sequence suffix.
const clean=value=>String(value??'').trim().toUpperCase();
export function modKey(value){const mod=clean(value);return /^\d+$/.test(mod)?String(BigInt(mod)):mod;}
const isMod=value=>value!==''&&value!=='0';
function date(value){const d=String(value||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:null;}
function compare(a,b){return a.action_date.localeCompare(b.action_date)||a.modification_number.localeCompare(b.modification_number,undefined,{numeric:true})||a.transaction_id.localeCompare(b.transaction_id);}
function adjacent(a,b){if(!a||!b)return false;const x=a.match(/^([A-Z]*)(\d+)$/),y=b.match(/^([A-Z]*)(\d+)$/);if(!x||!y)return false;return (a==='0'||x[1]===y[1])&&BigInt(y[2])===BigInt(x[2])+1n;}
export function summarizeModifications(records,{truncated=false}={}){
 const groups=new Map();
 for(const input of records){const row={...input,modification_number:clean(input.modification_number),action_date:String(input.action_date||''),transaction_id:String(input.transaction_id||''),reported_current_end:date(input.reported_current_end),reported_start:date(input.reported_start),reported_potential_end:date(input.reported_potential_end),action_type_code:clean(input.action_type_code)};const key=modKey(row.modification_number)||'missing:'+row.transaction_id;const group=groups.get(key)||[];group.push(row);groups.set(key,group);}
 const actions=[...groups.entries()].map(([key,rows])=>{rows.sort(compare);const row=rows.at(-1);return {...row,mod_key:key,source_records:rows.length,conflicting_records:new Set(rows.map(r=>JSON.stringify([r.reported_current_end,r.reported_start,r.action_type_code]))).size>1};}).sort(compare);
 for(let i=0;i<actions.length;i++){const row=actions[i],previous=actions[i-1];row.option_exercised=isMod(modKey(row.modification_number))&&row.action_type_code==='G';row.previous_modification_number=previous?.modification_number||null;row.previous_action_date=previous?.action_date||null;row.previous_current_end=previous?.reported_current_end||null;row.previous_start=previous?.reported_start||null;row.sequence_gap=!!previous&&!adjacent(modKey(previous.modification_number),modKey(row.modification_number));row.comparison_note=null;
 if(!previous)row.comparison_note='Prior action not loaded';
 else if(row.conflicting_records||previous.conflicting_records)row.comparison_note='Conflicting records for a mod';
 else if(row.action_date===previous.action_date)row.comparison_note='Same-day action order needs review';
 else if(!row.reported_current_end||!previous.reported_current_end)row.comparison_note='A reported end date is missing';
 row.end_change=row.comparison_note?'unknown':row.reported_current_end>previous.reported_current_end?'extended':row.reported_current_end<previous.reported_current_end?'shortened':'unchanged';
 row.start_changed=previous&&row.reported_start&&previous.reported_start&&row.action_date!==previous.action_date&&!row.conflicting_records&&!previous.conflicting_records?row.reported_start!==previous.reported_start:null;
 if(!row.comparison_note&&row.sequence_gap)row.comparison_note='Mod sequence gap; compare with preceding loaded action only';
 }
 const mods=actions.filter(r=>isMod(modKey(r.modification_number))),options=mods.filter(r=>r.option_exercised),changed=options.filter(r=>['extended','shortened'].includes(r.end_change));
 const latest=mods.at(-1)||null;
 return {mods_loaded:mods.length,source_actions_loaded:records.length,base_award_loaded:actions.some(r=>modKey(r.modification_number)==='0'),missing_mod_numbers:actions.filter(r=>!modKey(r.modification_number)).length,latest_mod:latest,latest_mod_date_tied:!!latest&&mods.filter(r=>r.action_date===latest.action_date).length>1,latest_option_mod:options.at(-1)||null,latest_option_pop_change:changed.filter(r=>!r.sequence_gap).at(-1)||null,latest_option_change_candidate:changed.at(-1)||null,option_mods_loaded:options.length,truncated,history_complete:false,actions:actions.reverse(),note:'Counts cover distinct reported modifications in the loaded history, excluding the original award. Date changes compare successive loaded actions; gaps, conflicting reports, and same-day order can limit attribution. Later non-option mods may change the PoP again.'};
}
