import {officeEnabled} from './admission.mjs';
import {CONFIG,r2Profile} from '../ingest.mjs';
import {createFormat} from './format.mjs';
import {publication} from '../read.mjs';
export async function storedCoverage(env){
 const offices=[];
 for(const [office,settings]of Object.entries(CONFIG.r2Offices)){
  let status='live',source=null,count=null;
  if(await officeEnabled(office,env[settings.binding])){
   try{const {validateManifest}=createFormat(r2Profile(office)),object=await env[settings.binding]?.get('pilot/'+office+'/current.json');if(object){validateManifest(await object.json());status='stored';source='r2';}}catch{}
   if(status!=='stored'&&env.PORTFOLIO_DB)try{const row=await publication(env.PORTFOLIO_DB,office);if(row){status='stored';source='d1';count=row.award_count;}}catch{}
  }
  offices.push({office,status,source,count});
 }
 if(env.PORTFOLIO_DB)try{
  const rows=(await env.PORTFOLIO_DB.prepare("SELECT j.office_dodaac office,p.award_count count FROM portfolio_rollout_jobs j JOIN office_publications p ON p.office_dodaac=j.office_dodaac AND p.published_run_id=j.publication_version JOIN portfolio_publication_receipts r ON r.publication_id=p.published_run_id WHERE j.status='ready' AND r.status='published'").all()).results;
  for(const row of rows)if(!offices.some(entry=>entry.office===row.office))offices.push({...row,status:'stored',source:'d1'});
 }catch{}
 return {offices,default_status:'live'};
}

