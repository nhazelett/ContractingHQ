import {SETTINGS,CURRENT} from './ingest.mjs';
import {validateManifest,unpack} from './format.mjs';
// The workflow concurrency group serializes this cleanup with every R2 writer.
export async function cleanupRetained(store,published){
 const result={deleted:0,protected_or_grace:0};
 if(!published.manifest.previous_manifest)return result;
 const archive=await store.get(published.manifest.previous_manifest.key);
 const previous=validateManifest(await unpack(archive.bytes,published.manifest.previous_manifest.sha256));
 if(previous.version!==published.manifest.retained_versions[1])throw new Error('Previous publication identity differs.');
 const protectedKeys=new Set([CURRENT,SETTINGS.checkpointKey,SETTINGS.ledgerKey,published.manifest.previous_manifest.key,...published.manifest.objects.map(o=>o.key),...previous.objects.map(o=>o.key)]);
 const ledger=JSON.parse(new TextDecoder().decode((await store.get(SETTINGS.ledgerKey)).bytes));
 for(const key of Object.keys(ledger.keys)){if(protectedKeys.has(key))continue;const outcome=await store.remove(key,published.etag);if(outcome.deleted)result.deleted++;else result.protected_or_grace++;}
 return result;
}
