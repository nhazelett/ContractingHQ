// Federal notice foundation. This module neither fetches nor publishes data.
import {daysRemaining} from '../web/format.mjs';

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const types={p:'Presolicitation',r:'Sources Sought',o:'Solicitation',k:'Combined Synopsis/Solicitation',a:'Award Notice',u:'Justification',s:'Special Notice',g:'Sale of Surplus Property',i:'Intent to Bundle Requirements'};

function date(value){
 const raw=clean(value),day=raw?.slice(0,10);
 return day&&daysRemaining(day,day)===0?day:null;
}

export function normalizeDeadline(value){
 const raw=clean(value);
 if(!raw)return {raw:null,date:null,instant:null,precision:'missing'};
 const day=date(raw);
 if(!day)return {raw,date:null,instant:null,precision:'invalid'};
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return {raw,date:day,instant:null,precision:'date'};
 const match=raw.match(/^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/i);
 if(!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]||0)>59)return {raw,date:null,instant:null,precision:'invalid'};
 if(!match[4])return {raw,date:day,instant:null,precision:'time_without_zone'};
 const instant=Date.parse(raw.replace(' ','T'));
 return Number.isFinite(instant)?{raw,date:day,instant:new Date(instant).toISOString(),precision:'instant'}:{raw,date:null,instant:null,precision:'invalid'};
}

function samLink(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['sam.gov','www.sam.gov'].includes(u.hostname)||u.username||u.password)return null;return u.origin+u.pathname;}catch{return null;}
}

export function normalizeNotice(record,{checkedAt,descriptionText=null}={}){
 if(!record||typeof record!=='object'||Array.isArray(record))throw new TypeError('A SAM notice object is required.');
 const id=clean(record.noticeId);
 if(!/^[a-f0-9]{32}$/i.test(id||''))throw new TypeError('A valid SAM notice ID is required.');
 if(!checkedAt||!Number.isFinite(Date.parse(checkedAt)))throw new TypeError('A source-check timestamp is required.');
 if(descriptionText!==null&&typeof descriptionText!=='string')throw new TypeError('Description text must be separately retrieved text.');
 const path=clean(record.fullParentPathCode),parts=path?.split('.').map(s=>s.trim()).filter(Boolean)||[];
 const reportedType=clean(record.type),type=types[reportedType?.toLowerCase()]||reportedType;
 const sourceActive=typeof record.active==='boolean'?record.active:/^yes$/i.test(clean(record.active)||'')?true:/^no$/i.test(clean(record.active)||'')?false:null;
 return {
  source:'SAM.gov',record_kind:'posted_notice',notice_id:id.toLowerCase(),title:clean(record.title),solicitation_number:clean(record.solicitationNumber),
  notice_type:type,source_active:sourceActive,posted_date:date(record.postedDate),
  deadline:normalizeDeadline(record.responseDeadLine??record.reponseDeadLine),
  organization_path_code:path,organization_path_name:clean(record.fullParentPathName),
  // Office identity comes from the source hierarchy, never the solicitation prefix.
  office_code:parts.length>=3?parts.at(-1):null,
  naics:clean(record.naicsCode),psc:clean(record.classificationCode),
  set_aside_code:clean(record.typeOfSetAside??record.setAsideCode),set_aside_description:clean(record.typeOfSetAsideDescription??record.setAside),
  place_state:clean(record.placeOfPerformance?.state?.code),place_city:clean(record.placeOfPerformance?.city?.name),
  description_text:clean(descriptionText),
  // The search response's description field is an authenticated URL, not prose.
  description_available:Boolean(clean(record.description)),attachment_count:Array.isArray(record.resourceLinks)?record.resourceLinks.length:0,
  source_url:samLink(record.uiLink),source_checked_at:new Date(checkedAt).toISOString()
 };
}

export function matchesOffice(notice,code){return Boolean(code)&&notice.office_code===code;}

export function deadlineState(notice,now=new Date()){
 const deadline=notice.deadline,clock=new Date(now);
 if(!Number.isFinite(clock.valueOf()))throw new TypeError('A valid comparison time is required.');
 if(deadline.precision==='missing'||deadline.precision==='invalid')return deadline.precision;
 if(deadline.instant)return Date.parse(deadline.instant)<=clock.valueOf()?'passed':'future';
 const days=daysRemaining(deadline.date,clock.toISOString().slice(0,10));
 // Date-only and unzoned deadlines are calendar signals, never exact cutoffs.
 return days<0?'date_passed':days===0?'today_time_unconfirmed':'future_date';
}

export function noticeStatus(notice,now){
 if(notice.source_active===false)return 'source_inactive';
 if(notice.source_active===null)return 'source_status_unreported';
 return deadlineState(notice,now);
}

const tracked=['title','solicitation_number','notice_type','source_active','posted_date','deadline','organization_path_code','organization_path_name','office_code','naics','psc','set_aside_code','set_aside_description','place_state','place_city','description_text','description_available','attachment_count','source_url'];
export function noticeChanges(before,after){
 if(before.source!==after.source||before.notice_id!==after.notice_id)throw new TypeError('Only versions of the same source notice can be compared.');
 return tracked.filter(field=>JSON.stringify(before[field])!==JSON.stringify(after[field])).map(field=>({field,before:before[field],after:after[field]}));
}
