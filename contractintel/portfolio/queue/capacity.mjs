import {CONFIG} from '../ingest.mjs';
// D1 and R2 have independent capacity guards. Reservations are conservative,
// application limits, not an account spending cap or a provider quota.
export function capacityDecision({d1Bytes,baselineR2Bytes,reservedR2Bytes=0,newOffice=false}){
 const c=CONFIG.capacity;
 if(![d1Bytes,baselineR2Bytes,reservedR2Bytes].every(n=>Number.isSafeInteger(n)&&n>=0))return 'storage_measurement_required';
 if(d1Bytes+c.d1PublicationReserveBytes>c.maxD1Bytes)return 'd1_storage_limit';
 if(newOffice&&d1Bytes+c.d1PublicationReserveBytes>c.partitionAtBytes)return 'database_partition_required';
 if(baselineR2Bytes+reservedR2Bytes+c.pilotR2HeadroomBytes>c.maxR2Bytes)return 'r2_storage_limit';
 return 'ready';
}
export function partitionPlan(d1Bytes){
 return {strategy:'Keep current published offices in the existing database; place new offices in another D1 database at the threshold.',
  trigger_bytes:CONFIG.capacity.partitionAtBytes,hard_guard_bytes:CONFIG.capacity.maxD1Bytes,
  staging_reserve_bytes:CONFIG.capacity.d1PublicationReserveBytes,current_bytes:d1Bytes,
  automatic_shard_creation:false,
  requirements:['Durable office-to-database mapping in the control database','Apply the same schema and publication gate in each shard','Route office reads and ingest through the mapping; retain live fallback','Validate a new shard before assigning an office; never silently move existing publications'],
  note:'The queue stops new offices at the threshold. Additional database provisioning and read routing must be implemented before crossing it.'};
}
