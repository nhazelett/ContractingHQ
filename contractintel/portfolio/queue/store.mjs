import {CONFIG} from '../ingest.mjs';
import {emptyQueue,changeQueue,publicQueue} from './model.mjs';
export class QueueError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function readQueue(db){
 if(!db)throw new QueueError('Queue storage unavailable.',503);
 const row=await db.prepare('SELECT revision,state_json FROM portfolio_import_queue WHERE singleton=1').first();
 if(!row)return emptyQueue();
 if(new TextEncoder().encode(row.state_json).length>CONFIG.queue.maxStateBytes)throw new QueueError('Queue storage limit reached.',503);
 const state=JSON.parse(row.state_json);
 if(state.version!==1||state.revision!==row.revision||!Array.isArray(state.groups)||!Array.isArray(state.budgets))throw new QueueError('Queue state needs review.',503);
 return state;
}
export async function queueSummary(db){try{return publicQueue(await readQueue(db));}catch{return publicQueue(emptyQueue(),{available:false});}}
const fields={enqueue:['action','plan','expected_revision'],approve:['action','group_id','plan_hash','expected_revision'],pause:['action','group_id','expected_revision'],resume:['action','group_id','expected_revision'],cancel:['action','group_id','expected_revision'],retry:['action','group_id','office','expected_revision']};
export async function mutateQueue(db,command,directory,options={}){
 if(!command||!Object.hasOwn(fields,command.action)||Object.keys(command).some(k=>!fields[command.action].includes(k)))throw new QueueError('Unknown queue command or parameter.');
 if(!Number.isSafeInteger(command.expected_revision)||command.expected_revision<0)throw new QueueError('A reviewed queue revision is required.');
 const current=await readQueue(db);
 if(current.revision!==command.expected_revision)throw new QueueError('The queue changed. Refresh before making this change.',409);
 let next;try{next=await changeQueue(current,command,directory,options);}catch(error){throw new QueueError(error.message);}
 const stamp=new Date(options.now??Date.now()).toISOString();
 await db.prepare('INSERT OR IGNORE INTO portfolio_import_queue(singleton,revision,state_json,updated_at) VALUES(1,0,?,?)').bind(JSON.stringify(emptyQueue()),stamp).run();
 const result=await db.prepare('UPDATE portfolio_import_queue SET revision=?,state_json=?,updated_at=? WHERE singleton=1 AND revision=?').bind(next.revision,JSON.stringify(next),stamp,current.revision).run();
 if(!result.meta?.changes)throw new QueueError('The queue changed. Refresh before making this change.',409);
 return {...publicQueue(next),group_id:command.action==='enqueue'?next.groups.at(-1).id:command.group_id||null};
}
export async function queueRequest(request,db,directory){
 if(request.method==='GET')return publicQueue(await readQueue(db));
 if(request.method!=='POST')throw new QueueError('Use GET or POST.',405);
 if(Number(request.headers.get('Content-Length')||0)>CONFIG.queue.maxRequestBytes)throw new QueueError('Queue request too large.',413);
 const reader=request.body?.getReader();if(!reader)throw new QueueError('A queue command is required.');
 const chunks=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>CONFIG.queue.maxRequestBytes)throw new QueueError('Queue request too large.',413);chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let command;try{command=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new QueueError('Invalid queue JSON.');}
 return mutateQueue(db,command,directory);
}
