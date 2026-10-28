import {CONFIG,r2Profile} from '../ingest.mjs';
export function validAdmission(value,office){return value?.office===office&&value.verified===true&&value.schema_version===CONFIG.schemaVersion&&typeof value.publication_id==='string'&&/^[a-f0-9]{64}$/.test(value.comparison_sha256||'');}
export async function officeEnabled(office,bucket,override){
 const profile=override||CONFIG.r2Offices[office];if(profile?.readEnabled===true)return true;if(!profile?.admitOnVerified||!bucket)return false;
 try{const object=await bucket.get((override||r2Profile(office)).prefix+'/admission.json');return !!object&&validAdmission(await object.json(),office);}catch{return false;}
}

