import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export const office={code:'FA4528',name:'5th Contracting Squadron',department:'Air Force',base:'Minot AFB',location:'ND',command:'AFGSC'};
export const fixed=()=>Date.parse('2026-10-26T01:00:00Z');
export function sqlite({maxValueBytes=Infinity}={}){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../../portfolio/migrations/0001.sql',import.meta.url),'utf8'));
 sql.exec(readFileSync(new URL('../../portfolio/migrations/0002.sql',import.meta.url),'utf8'));
 const guard=rows=>{for(const row of rows)for(const value of Object.values(row))if(typeof value==='string'&&Buffer.byteLength(value)>maxValueBytes)throw new Error('D1 value exceeds maximum length');return rows;};
 const db={prepare(text){const create=params=>({_sql:text,_params:params,bind:(...p)=>create(p),all:async()=>({results:guard(sql.prepare(text).all(...params)),meta:{rows_read:1,rows_written:0,size_after:sql.prepare('PRAGMA page_count').get().page_count*sql.prepare('PRAGMA page_size').get().page_size}}),run:async()=>{const r=sql.prepare(text).run(...params);return {results:[],meta:{changes:Number(r.changes),rows_written:Number(r.changes),rows_read:0}};},first:async()=>{const row=sql.prepare(text).get(...params);return row?guard([row])[0]:null;}});return create([]);},batch:async statements=>{sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await (/^(SELECT|PRAGMA)/i.test(s._sql.trim())?s.all():s.run()));sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};return {db,sql};
}
export function source(){
 const calls=[],ids=['A','B','C','D','E'].map(s=>'CONT_AWD_FA4528'+s+'_9700_-NONE-_-NONE-');let fail=false;
 const raw=ids.map((id,i)=>({generated_unique_award_id:id,piid:'FA4528'+'ABCDE'[i],description:'Requirement '+i,recipient:{recipient_name:'Vendor '+i,recipient_unique_id:'DUNS'+i,recipient_uei:'UEI'+i},period_of_performance:{start_date:'2024-01-01',end_date:['2026-10-26','2026-01-01','2027-01-01','2025-01-01','2026-12-01'][i],potential_end_date:['2027-02-01','2026-09-01','2026-01-01',null,'2027-05-01'][i],last_modified_date:'2026-10-25'},date_signed:'2024-01-01',base_exercised_options:'100.01',total_obligation:'-5.25',base_and_all_options:'300.00',type:'D',type_description:'Definitive contract',latest_transaction_contract_data:{type_set_aside:'SBA',type_set_aside_description:'TOTAL SMALL BUSINESS SET ASIDE',naics:'541330',naics_description:'Engineering',product_or_service_code:'R425',product_or_service_description:'Support'}}));
 const fetcher=async(url,options={})=>{
  if(fail)return new Response('Unavailable',{status:503});
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;calls.push({path,body});let result;
  if(path.includes('spending_by_award')){
   const window=body.filters.time_period[0],selected=window.date_type==='last_modified_date'?raw.slice(0,1):window.start_date==='2007-10-01'?raw:raw.slice(0,4);
   result={results:selected.map(a=>({'Award ID':a.piid,'Recipient Name':a.recipient.recipient_name,Description:a.description,'Start Date':a.period_of_performance.start_date,'End Date':a.period_of_performance.end_date,generated_internal_id:a.generated_unique_award_id})),page_metadata:{hasNext:false}};
  }else if(path.includes('/awards/')){result=raw.find(a=>path.includes(encodeURIComponent(a.generated_unique_award_id)));}
  else if(path.includes('/transactions/')){result={results:[{id:body.award_id+'G',action_date:'2026-10-24',modification_number:'P00001',action_type:'G',action_type_description:'Exercise an option',federal_action_obligation:'-5.25',description:'Option evidence'}],page_metadata:{hasNext:true}};}
  else if(path.includes('spending_by_transaction')){result={results:[{'Award ID':raw[0].piid,'Action Date':body.filters.time_period[0].start_date,'Transaction Amount':'-1.25',generated_internal_id:ids[0]}],page_metadata:{hasNext:false}};}
  else throw new Error('Unexpected source URL '+path);
  return Response.json(result);
 };
 return {fetcher,calls,ids,raw,setFail:value=>{fail=value;}};
}
