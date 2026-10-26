// Portfolio date boundaries are always the current date in America/New_York, including DST.
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});
export function currentDate(instant=Date.now()){
 const parts=formatter.formatToParts(new Date(instant));
 const get=type=>parts.find(p=>p.type===type).value;return get('year')+'-'+get('month')+'-'+get('day');
}
