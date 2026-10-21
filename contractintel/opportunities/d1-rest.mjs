// Match the D1 binding surface for trusted Node ingestion over the REST query API.
export function createD1Adapter(query){
 const prepare=sql=>{
  const statement=params=>({sql,params,all:()=>query(sql,params),first:async()=>((await query(sql,params)).results||[])[0]||null,run:()=>query(sql,params)});
  return {...statement([]),bind:(...params)=>statement(params)};
 };
 return {prepare,batch:async statements=>{const out=[];for(const s of statements)out.push(await query(s.sql,s.params));return out;}};
}
