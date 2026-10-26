// Trusted operator CLI. The existing ingest secret is read only from the environment.
import fs from 'node:fs/promises';
import {CONFIG} from '../ingest.mjs';
import {reviewedPlan} from '../../web/queue-plan.mjs';
const [action,...args]=process.argv.slice(2),flags={};
try{
 for(let i=0;i<args.length;i+=2){if(!args[i]?.startsWith('--')||!args[i+1])throw new Error('Use --name value arguments.');flags[args[i].slice(2)]=args[i+1];}
 if(action==='plan'){
  const directory=JSON.parse(await fs.readFile(new URL('../../worker/offices.json',import.meta.url),'utf8'));
  const result=await reviewedPlan((flags.offices||'').split(',').filter(Boolean),directory,CONFIG.queue),content=JSON.stringify(result,null,2)+'\n';
  if(flags.out)await fs.writeFile(flags.out,content,{flag:'wx'});else process.stdout.write(content);
 }else{
  if(!['status','enqueue','approve','pause','resume','cancel','retry'].includes(action))throw new Error('Use plan, status, enqueue, approve, pause, resume, cancel, or retry.');
  const secret=process.env.CONTRACTINTEL_INGEST_SECRET;if(!secret)throw new Error('Set CONTRACTINTEL_INGEST_SECRET in the environment.');
  const url=CONFIG.r2Pilot.productionBase+'/api/admin/portfolio/queue',headers={'X-ContractIntel-Ingest-Secret':secret};
  const call=async(options={})=>{const response=await fetch(url,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(CONFIG.dispatchTimeoutMs)});if(!response.ok)throw new Error('Queue request failed: HTTP '+response.status+'. Refresh status and review the command.');return response.json();};
  const current=await call();let result=current;
  if(action!=='status'){
   const command={action,expected_revision:current.revision};
   if(flags.group)command.group_id=flags.group;if(flags.hash)command.plan_hash=flags.hash;if(flags.office)command.office=flags.office;
   if(action==='enqueue'){if(!flags.plan)throw new Error('Use --plan with an exported, reviewed plan.');command.plan=JSON.parse(await fs.readFile(flags.plan,'utf8'));}
   result=await call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
  }
  console.log(JSON.stringify(result,null,2));
 }
}catch(error){console.error(error.message);process.exitCode=1;}
