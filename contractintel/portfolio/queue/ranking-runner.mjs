// Ranking and automatic queue preparation only. This entry point cannot dispatch office imports.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CONFIG} from '../ingest.mjs';
import {createHttpD1} from '../d1-http.mjs';
import {seedAutomaticQueue} from './automatic.mjs';
const root=new URL('../../',import.meta.url),out=new URL('./out/',import.meta.url);
await fs.mkdir(out,{recursive:true});
await fs.writeFile(new URL('config.json',out),JSON.stringify(CONFIG.rollout));
await new Promise((resolve,reject)=>{
 const child=spawn(process.env.PYTHON||'python',[fileURLToPath(new URL('rank_offices.py',import.meta.url)),fileURLToPath(new URL('config.json',out)),fileURLToPath(new URL('worker/offices.json',root)),fileURLToPath(out)],{stdio:'inherit',shell:false});
 child.on('error',()=>reject(new Error('Python ranking process could not start.')));
 child.on('close',code=>code===0?resolve():reject(new Error('Ranking stopped; previous durable queue is unchanged.')));
});
const document=JSON.parse(await fs.readFile(new URL('office-ranking.json',out),'utf8'));
const directory=JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8'));
const config=JSON.parse(await fs.readFile(new URL('worker/wrangler.jsonc',root),'utf8')),binding=config.d1_databases.find(b=>b.binding==='PORTFOLIO_DB');
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token||!binding)throw new Error('D1 ranking access is missing.');
if(process.env.GITHUB_ACTIONS==='true')console.log('::add-mask::'+token);
const db=createHttpD1({account:config.account_id,database:binding.database_id,token});
const migration=await fs.readFile(new URL('portfolio/migrations/0005.sql',root),'utf8');
await db.prepare(migration).run();
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
