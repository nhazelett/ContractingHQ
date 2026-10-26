// Trusted deployment preparation; credentials are never included in reports or source.
import fs from 'node:fs/promises';
import {CONFIG,seedOffices} from './ingest.mjs';
import {createD1Adapter} from '../opportunities/d1-rest.mjs';
const root=new URL('../',import.meta.url),account='a7443e0102de587d778491ab08fd883f',name='kthq-contractintel-portfolio';
async function cf(path,method='GET',body){
 const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw new Error('Cloudflare deployment access is missing.');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(120000)});
 let json;try{json=await response.json();}catch{throw new Error('Cloudflare returned an unreadable response.');}
 if(!response.ok||!json.success)throw new Error('Cloudflare portfolio operation failed: HTTP '+response.status+'; codes '+(json.errors||[]).map(e=>e.code).join(','));return json.result;
}
try{
 const databases=await cf('/d1/database?per_page=100');let database=databases.find(d=>d.name===name);
 if(!database)database=await cf('/d1/database','POST',{name});
 const id=database.uuid,info=await cf('/d1/database/'+id);if(Number(info.file_size||0)>=CONFIG.maxStorageBytes)throw new Error('Portfolio pilot storage guard reached.');
 const sql=await fs.readFile(new URL('portfolio/migrations/0001.sql',root),'utf8');const result=await cf('/d1/database/'+id+'/query','POST',{sql});if(result.some(r=>!r.success))throw new Error('Portfolio migration failed.');
 const db=createD1Adapter(async(sql,params=[])=>{const result=await cf('/d1/database/'+id+'/query','POST',{sql,params});if(result.some(r=>!r.success))throw new Error('Portfolio seed failed.');return result[0];});
 await seedOffices(db,JSON.parse(await fs.readFile(new URL('worker/offices.json',root),'utf8')));
 const configPath=new URL('worker/wrangler.jsonc',root),config=JSON.parse(await fs.readFile(configPath,'utf8'));
 config.d1_databases=[...(config.d1_databases||[]).filter(b=>b.binding!=='PORTFOLIO_DB'),{binding:'PORTFOLIO_DB',database_name:name,database_id:id,migrations_dir:'../portfolio/migrations'}];
 config.triggers={...(config.triggers||{}),crons:[CONFIG.cron]};config.limits={...(config.limits||{}),cpu_ms:30000};
 await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
 console.log(JSON.stringify({portfolio_prepared:true,database_name:name,database_id:id,directory_offices:1432,pilot_offices:CONFIG.offices,cron:CONFIG.cron}));
}catch(error){console.error(error.message?.startsWith('Cloudflare')||error.message?.startsWith('Portfolio')?error.message:'Portfolio deployment preparation failed safely.');process.exitCode=1;}
