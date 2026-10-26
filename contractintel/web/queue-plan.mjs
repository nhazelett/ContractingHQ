// Shared browser/server plan validation. A plan never starts a source request.
export function planDocument(offices,directory,limits){
 if(!Array.isArray(offices)||!offices.length||offices.length>limits.maxGroupOffices)throw new Error('Choose between 1 and '+limits.maxGroupOffices+' offices.');
 const known=new Set(directory.map(o=>o.code));
 if(offices.some(code=>typeof code!=='string'||!known.has(code)||!/^\w{6}$/.test(code)))throw new Error('Choose offices from the supplied directory.');
 if(new Set(offices).size!==offices.length)throw new Error('An office can appear only once in a group.');
 return {version:1,offices:[...offices],limits:{maxGroupOffices:limits.maxGroupOffices,maxDailySourceRequests:limits.maxDailySourceRequests,maxDailyRuntimeMs:limits.maxDailyRuntimeMs,maxTotalStorageBytes:limits.maxTotalStorageBytes}};
}
export async function planHash(plan){
 const bytes=new TextEncoder().encode(JSON.stringify(plan));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function reviewedPlan(offices,directory,limits){const plan=planDocument(offices,directory,limits);return {...plan,sha256:await planHash(plan)};}
