import {CONFIG,r2Profile} from '../ingest.mjs';
import {createFormat} from './format.mjs';
import {publication} from '../read.mjs';
export async function storedCoverage(env){
 const offices=[];
 for(const [office,settings]of Object.entries(CONFIG.r2Offices)){
  let status='live',source=null,count=null;
  if(settings.readEnabled){
   try{const {validateManifest}=createFormat(r2Profile(office)),object=await env[settings.binding]?.get('pilot/'+office+'/current.json');if(object){validateManifest(await object.json());status='stored';source='r2';}}catch{}
   if(status!=='stored'&&env.PORTFOLIO_DB)try{const row=await publication(env.PORTFOLIO_DB,office);if(row){status='stored';source='d1';count=row.award_count;}}catch{}
  }
  offices.push({office,status,source,count});
 }
 return {offices,default_status:'live'};
}
