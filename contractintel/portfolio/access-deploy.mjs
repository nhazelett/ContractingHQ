// Restrict only the coverage paths. No Access bypass or broad allow rule is created.
import fs from 'node:fs/promises';
import {CONFIG} from './ingest.mjs';
export async function prepareCoverageAccess(configPath,cf){
 const config=JSON.parse(await fs.readFile(configPath,'utf8')),hostname=new URL(CONFIG.r2Pilot.productionBase).hostname,paths=[hostname+'/coverage*',hostname+'/api/office/coverage/details*'];
 const organization=await cf('/access/organizations'),apps=await cf('/access/apps?per_page=100');
 if(!organization.ok||!apps.ok){console.log(JSON.stringify({coverage_access:{configured:false,origin_fails_closed:true,organization_http:organization.status,applications_http:apps.status,required_permission:'Access: Apps and Policies edit; Zero Trust organization enabled'}}));return;}
 const found=[];
 for(const domain of paths){
  let app=apps.result.find(a=>a.domain===domain);
  if(!app){
   const created=await cf('/access/apps','POST',{name:'ContractIntel private '+(domain.includes('/api/')?'coverage data':'coverage dashboard'),type:'self_hosted',domain,app_launcher_visible:false,session_duration:'24h',policies:[{name:'Deny until administrator allowlist is configured',decision:'deny',include:[{everyone:{}}]}]});
   if(!created.ok){console.log(JSON.stringify({coverage_access:{configured:false,origin_fails_closed:true,application_http:created.status}}));return;}
   app=created.result;
  }
  if(!app.aud){console.log(JSON.stringify({coverage_access:{configured:false,origin_fails_closed:true,reason:'Application audience missing'}}));return;}
  found.push(app);
 }
 const authDomain=organization.result.auth_domain;
 if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(authDomain)){console.log(JSON.stringify({coverage_access:{configured:false,origin_fails_closed:true,reason:'Access organization needs setup'}}));return;}
 config.vars={...config.vars,COVERAGE_ACCESS_ISSUER:'https://'+authDomain,COVERAGE_ACCESS_PAGE_AUD:found[0].aud,COVERAGE_ACCESS_DATA_AUD:found[1].aud};
 await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');
 console.log(JSON.stringify({coverage_access:{configured:true,paths:['/coverage*','/api/office/coverage/details*'],new_applications_default_deny:true}}));
}
