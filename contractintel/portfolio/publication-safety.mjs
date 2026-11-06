// Publication gates deliberately have no environment-variable bypass.
// A source outage or truncated scan must not become an authoritative deletion.
const must=(value,message)=>{if(!value)throw new Error(message);};

export function assertSafeRemoval(previous,next,{windows,limits}){
 const {maxRemovedAwards,maxRemovedFraction,minRemovedForFraction}=limits;
 must(Number.isSafeInteger(maxRemovedAwards)&&maxRemovedAwards>=0&&Number.isFinite(maxRemovedFraction)&&maxRemovedFraction>=0&&maxRemovedFraction<=1&&Number.isSafeInteger(minRemovedForFraction)&&minRemovedForFraction>=1,'Invalid publication removal limits.');
 const ids=(rows)=>new Set(rows.map(row=>row.generated_unique_award_id));
 const checks=[];
 const check=(scope,before,after)=>{
  const removed=[...before].filter(id=>!after.has(id)).length;
  const fraction=before.size?removed/before.size:0;
  const result={scope,before:before.size,after:after.size,removed,fraction};checks.push(result);
  must(!(before.size>0&&after.size===0)&&removed<=maxRemovedAwards&&!(removed>=minRemovedForFraction&&fraction>maxRemovedFraction),
   'Publication removal guard: '+scope+' would remove '+removed+' of '+before.size+' awards ('+(fraction*100).toFixed(2)+'%); publication retained. Preserve the baseline and review complete source discovery before retrying.');
 };
 check('all awards',ids(previous.awards),ids(next.awards));
 for(const start of windows)check('window '+start,ids(previous.award_windows.filter(row=>row.window_start===start)),ids(next.award_windows.filter(row=>row.window_start===start)));
 return checks;
}

// Only identifiers and memberships are read, never raw evidence or award payloads.
export async function publishedMembership(db,office){
 const awards=(await db.prepare('SELECT generated_unique_award_id FROM awards WHERE office_dodaac=?').bind(office).all()).results;
 const award_windows=(await db.prepare('SELECT w.generated_unique_award_id,w.window_start FROM award_windows w JOIN awards a ON a.generated_unique_award_id=w.generated_unique_award_id WHERE a.office_dodaac=?').bind(office).all()).results;
 return {awards,award_windows};
}

export function assertDiscoveryComplete(state,windows){
 must(state.discovery_version===1&&state.window===windows.length,'Discovery completion evidence is missing; preserve the checkpoint and restart discovery before publication.');
 must(state.page===1&&state.cursor===null&&state.sort_value===null,'Discovery pagination is incomplete.');
 must(Object.keys(state.discovery_windows||{}).length===windows.length&&Object.keys(state.windows||{}).length===windows.length,'Discovery window coverage is incomplete.');
 for(const start of windows){
  const proof=state.discovery_windows[start],ids=state.windows[start];
  must(proof?.complete===true&&Number.isSafeInteger(proof.pages)&&proof.pages>=1&&Array.isArray(ids)&&proof.unique_awards===new Set(ids).size&&ids.length===proof.unique_awards,'Discovery window '+start+' is incomplete or its membership changed after the terminal page.');
 }
}

export function assertResumableDiscovery(state,windows){
 must(state.discovery_version===1,'Legacy checkpoint lacks discovery completion evidence; preserve it and restart discovery before publication.');
 if(['hydrate','fiscal','publish'].includes(state.phase))assertDiscoveryComplete(state,windows);
}
