// Ranking and automatic queue preparation only. This entry point cannot dispatch office imports.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../ingest.mjs';
import {createHttpD1} from '../d1-http.mjs';
import {seedAutomaticQueue,ensureRolloutCompatibility,validateRanking} from './automatic.mjs';
const root=new URL('../../',import.meta.url),out=new URL('./out/',import.meta.url);
const directory=JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8'));
const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token||!binding)throw new Error('D1 ranking access is missing.');
if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
const db=createHttpD1({account:config.account_id,database:binding.database_id,token});
await db.prepare(await fs.readFile(new URL('portfolio/migrations/0005.sql',root),'utf8')).run();
await ensureRolloutCompatibility(db);
await fs.mkdir(out,{recursive:true});
let document;
const previous=await db.prepare('SELECT source_json,ranking_json,directory_sha256 FROM portfolio_seed_rankings WHERE fiscal_year=? ORDER BY created_at DESC LIMIT 1').bind(CONFIG.rollout.fiscalYear).first();
if(previous){
 const rows=JSON.parse(previous.ranking_json),source=JSON.parse(previous.source_json);
 const candidate={fiscal_year:CONFIG.rollout.fiscalYear,start_date:CONFIG.rollout.startDate,end_date:CONFIG.rollout.endDate,basis:'PIID first six characters; net FY transaction obligations',source,statistics:source.statistics??null,ranking:rows,seed:rows.slice(0,CONFIG.rollout.seedCount)};
 try{const identity=await validateRanking(candidate,directory);if(identity.directory_sha256===previous.directory_sha256)document=candidate;}catch{}
}
if(document)console.log(JSON.stringify({ranking_reused:true,reason:'A complete FY ranking for this directory is already durable; no duplicate export requested.'}));
else{
 await fs.writeFile(new URL('config.json',out),JSON.stringify(CONFIG.rollout));
 await new Promise((resolve,reject)=>{
  const child=spawn(process.env.PYTHON||'python',[fileURLToPath(new URL('rank_offices.py',import.meta.url)),fileURLToPath(new URL('config.json',out)),fileURLToPath(new URL('worker/offices.json',root)),fileURLToPath(out)],{stdio:'inherit',shell:false});
  child.on('error',()=>reject(new Error('Python ranking process could not start.')));
  child.on('close',code=>code===0?resolve():reject(new Error('Ranking stopped; previous durable queue is unchanged.')));
 });
 document=JSON.parse(await fs.readFile(new URL('office-ranking.json',out),'utf8'));
}
await fs.writeFile(new URL('office-ranking.json',out),JSON.stringify(document,null,2)+'\n');
const result=await seedAutomaticQueue(db,document,directory);
await fs.writeFile(new URL('queue-summary.json',out),JSON.stringify(result,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY){
 const lines=['## FY'+CONFIG.rollout.fiscalYear+' automatic office seed queue','',
  'Ranking completed from one transaction export. Net obligations include deobligations; office = first six PIID characters.','',
  'Seed offices: '+result.seed_offices+'. New imports remain gated on FA4800 validation, cost review, and storage capacity.','',
  '| Rank | Office | FY net obligations |','| --- | --- | ---: |',
  ...document.seed.map(r=>'| '+r.rank+' | '+r.office+' | $'+(BigInt(r.fy_obligations_cents)/100n).toString()+' |')];
 await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}
console.log(JSON.stringify({automatic_seed_queue:result}));
