import {OpportunityError,samRequest,descriptionText} from './source.mjs';
import {csvCell} from '../web/format.mjs';

const inFlight=new Map();
const facetCache=new Map();
const first=(db,sql,...params)=>db.prepare(sql).bind(...params).first();
const all=async(db,sql,...params)=>(await db.prepare(sql).bind(...params).all()).results;
function input(url){
 const allowed=['q','office','agency','naics','psc','set_aside','state','type','status','due','posted_from','posted_to','page','run','export'];
 if([...url.searchParams.keys()].some(k=>!allowed.includes(k)))throw new OpportunityError('Unexpected opportunity filter.',400);
 const p=Object.fromEntries(url.searchParams);if((p.q||'').length>160)throw new OpportunityError('Search is too long.',400);
 for(const [key,re]of Object.entries({office:/^[A-Z0-9]{6}$/,naics:/^\d{2,6}$/,psc:/^[A-Z0-9]{1,4}$/,set_aside:/^[A-Z0-9_-]{1,20}$/,state:/^[A-Z]{2}$/}))if(p[key]&&!re.test(p[key]))throw new OpportunityError('Invalid '+key+' filter.',400);
 for(const key of ['agency','type'])if((p[key]||'').length>180)throw new OpportunityError('Invalid '+key+' filter.',400);
 if(p.status&&!['all','active','inactive','unknown'].includes(p.status))throw new OpportunityError('Invalid source status.',400);
 if(p.due&&!['7','30','90','unknown'].includes(p.due))throw new OpportunityError('Invalid due-date filter.',400);
 for(const key of ['posted_from','posted_to'])if(p[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(p[key])||!Number.isFinite(Date.parse(p[key]+'T00:00:00Z'))||new Date(p[key]+'T00:00:00Z').toISOString().slice(0,10)!==p[key]))throw new OpportunityError('Invalid posting date.',400);
 if(p.posted_from&&p.posted_to&&p.posted_from>p.posted_to)throw new OpportunityError('Posting dates are reversed.',400);
 if(p.run&&!/^[a-f0-9-]{36}$/i.test(p.run))throw new OpportunityError('Invalid dataset version.',400);
 p.page=p.page||'1';if(!/^\d{1,4}$/.test(p.page)||Number(p.page)<1)throw new OpportunityError('Invalid result page.',400);
 if(p.export&&!['csv'].includes(p.export))throw new OpportunityError('Invalid export format.',400);
 return p;
}
function where(p,run){
 const clauses=['n.run_id=?'],params=[run];
 for(const [key,col]of Object.entries({office:'office_code',agency:'agency_name',naics:'naics',psc:'psc',set_aside:'set_aside_code',state:'place_state',type:'notice_type'}))if(p[key]){if(key==='type'&&p.type==='opportunities'){clauses.push("n.notice_type IN ('Solicitation','Combined Synopsis/Solicitation','Sources Sought','Presolicitation')");}else{clauses.push('n.'+col+'=?');params.push(p[key]);}}
 if(p.status&&p.status!=='all')clauses.push(p.status==='unknown'?'n.source_active IS NULL':'n.source_active='+(p.status==='active'?1:0));
 const today=new Date().toISOString().slice(0,10);
 if(p.due==='unknown')clauses.push('n.deadline_date IS NULL');else if(p.due){clauses.push('n.deadline_date BETWEEN ? AND ?');params.push(today,new Date(Date.now()+Number(p.due)*86400000).toISOString().slice(0,10));}
 if(p.posted_from){clauses.push("json_extract(n.data_json,'$.posted_date')>=?");params.push(p.posted_from);}
 if(p.posted_to){clauses.push("json_extract(n.data_json,'$.posted_date')<=?");params.push(p.posted_to);}
 if(p.q?.trim()){const terms=p.q.trim().match(/[\p{L}\p{N}_-]+/gu)||[];if(!terms.length)throw new OpportunityError('Enter a title word or solicitation number.',400);clauses.push('n.notice_id IN (SELECT notice_id FROM opp_search WHERE opp_search MATCH ? AND run_id=?)');params.push(terms.map(t=>'"'+t.replaceAll('"','""')+'"').join(' AND '),run);}
 return {sql:clauses.join(' AND '),params};
}
async function activeRun(db,requested){
 const active=await first(db,'SELECT r.* FROM opp_runs r JOIN opp_active a ON a.run_id=r.id WHERE a.singleton=1');
 if(!active)throw new OpportunityError('The shared opportunity index has not been published yet. Please try again shortly.');
 if(requested){const pinned=await first(db,"SELECT * FROM opp_runs WHERE id=? AND status='published'",requested);if(!pinned)throw new OpportunityError('This results version is no longer retained. Refresh the search to use the latest index.',409);return pinned;}
 return active;
}
async function getDescription(db,row,env){
 const cached=await first(db,'SELECT * FROM opp_descriptions WHERE notice_id=?',row.notice_id);
 if(cached?.description_text&&Date.now()-Date.parse(cached.checked_at)<21600000)return {text:cached.description_text,checked_at:cached.checked_at,truncated:Boolean(cached.truncated),status:'available'};
 if(!row.description_ref)return {text:null,status:'not_reported'};
 if(!env.SAM_API_KEY)return {text:cached?.description_text||null,status:cached?.description_text?'cached':'unavailable',message:'Open the official notice for the full requirement description.'};
 if(inFlight.has(row.notice_id))return inFlight.get(row.notice_id);
 const task=(async()=>{
  try{let body=await samRequest(db,env.SAM_API_KEY,new URL(row.description_ref),{fetcher:env.SAM_FETCH||fetch});try{const parsed=JSON.parse(body);body=typeof parsed==='string'?parsed:typeof parsed.description==='string'?parsed.description:'';}catch{}
   const full=descriptionText(body);if(!full)throw new OpportunityError('SAM did not return a readable description.');const text=full.slice(0,120000),checked=new Date().toISOString();
   await db.prepare('INSERT INTO opp_descriptions(notice_id,description_text,checked_at,truncated) VALUES(?,?,?,?) ON CONFLICT(notice_id) DO UPDATE SET description_text=excluded.description_text,checked_at=excluded.checked_at,truncated=excluded.truncated').bind(row.notice_id,text,checked,full.length>120000?1:0).run();return {text,checked_at:checked,truncated:full.length>120000,status:'available'};
  }catch(e){return {text:cached?.description_text||null,checked_at:cached?.checked_at||null,status:cached?.description_text?'cached':'unavailable',message:e instanceof OpportunityError?e.message:'The full description could not be loaded. Open the official source.'};}
 })();inFlight.set(row.notice_id,task);try{return await task;}finally{inFlight.delete(row.notice_id);}
}
export async function opportunityRoute(url,env){
 const db=env.OPPORTUNITIES_DB;if(!db)throw new OpportunityError('The opportunity index is being prepared. Portfolio tools remain available.');
 if(url.pathname==='/api/opportunity'){
  if([...url.searchParams.keys()].some(k=>!['id','run','description'].includes(k)))throw new OpportunityError('Unexpected notice parameter.',400);
  const id=url.searchParams.get('id');if(!/^[a-f0-9]{32}$/i.test(id||''))throw new OpportunityError('Invalid notice identifier.',400);
  const run=await activeRun(db,url.searchParams.get('run')),row=await first(db,'SELECT notice_id,data_json,description_ref FROM opp_notices WHERE run_id=? AND notice_id=?',run.id,id.toLowerCase());if(!row)throw new OpportunityError('This notice is not in the selected index.',404);
  const description=url.searchParams.get('description')==='1'?await getDescription(db,row,env):{text:null,status:'not_requested'};
  return {notice:JSON.parse(row.data_json),description,run:run.id};
 }
 const p=input(url),run=await activeRun(db,p.run),filter=where(p,run.id),count=await first(db,'SELECT count(*) AS n FROM opp_notices n WHERE '+filter.sql,...filter.params),total=count.n;
 const page=Number(p.page),limit=p.export?3000:50,offset=p.export?0:(page-1)*50;
 const records=await all(db,"SELECT json_remove(n.data_json,'$.contacts','$.documents','$.description_text') AS data_json FROM opp_notices n WHERE "+filter.sql+' ORDER BY n.posted_key DESC,n.notice_id ASC LIMIT ? OFFSET ?',...filter.params,limit,offset),rows=records.map(r=>JSON.parse(r.data_json));
 if(p.export){const columns=[['title','Requirement'],['solicitation_number','Solicitation'],['agency_name','Agency'],['organization_path_name','Office hierarchy'],['notice_type','Notice type'],['posted_date','Posted date'],['deadline','Response deadline'],['naics','NAICS'],['psc','PSC'],['set_aside_description','Set-aside'],['place_state','State'],['source_active','Source active'],['source_url','Public source'],['source_checked_at','Source checked']];return new Response('\uFEFF'+[columns.map(c=>csvCell(c[1])).join(','),...rows.map(r=>columns.map(([key])=>csvCell(key==='deadline'?r.deadline.raw:r[key])).join(','))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="contractintel-opportunities.csv"','Cache-Control':'no-store'}});}
 let facets=facetCache.get(run.id);if(!facets){facets=await all(db,'SELECT DISTINCT agency_name,notice_type,set_aside_code FROM opp_notices WHERE run_id=?',run.id);if(facetCache.size>=4)facetCache.delete(facetCache.keys().next().value);facetCache.set(run.id,facets);}const refresh=await first(db,'SELECT last_attempt,last_error FROM opp_refresh WHERE singleton=1');
 return {rows,total,page,page_size:50,sort:'newest_posted_first',run:run.id,checked_at:run.checked_at,indexed_count:run.row_count,coverage:JSON.parse(run.coverage_json),last_refresh:refresh,facets:{agencies:[...new Set(facets.map(r=>r.agency_name).filter(Boolean))].sort(),types:[...new Set(facets.map(r=>r.notice_type).filter(Boolean))].sort(),set_asides:[...new Set(facets.map(r=>r.set_aside_code).filter(Boolean))].sort()}};
}
