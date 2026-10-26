import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNotice,normalizeDeadline,matchesOffice,deadlineState,noticeStatus,noticeChanges} from '../opportunities/notice.mjs';

// Synthetic records, never production data or a claimed SAM sample.
const sample={noticeId:'a'.repeat(32),title:'Building ventilation maintenance',solicitationNumber:'FA9999-TEST',fullParentPathCode:'097.5700.FA4800',fullParentPathName:'DEFENSE.AIR FORCE.TEST OFFICE',type:'o',active:'Yes',postedDate:'2026-10-20 12:00:00',responseDeadLine:'2026-11-10T14:00:00-05:00',naicsCode:'238220',classificationCode:'J041',typeOfSetAside:'SBA',typeOfSetAsideDescription:'Total Small Business Set-Aside',description:'https://api.sam.gov/opportunities/v1/noticedesc?noticeid=test&api_key=EXAMPLE',uiLink:'https://sam.gov/opp/'+('a'.repeat(32))+'/view?api_key=EXAMPLE',resourceLinks:['https://example.org/attachment']};
const checkedAt='2026-10-21T12:00:00Z';
const normalize=(record=sample,options={})=>normalizeNotice(record,{checkedAt,...options});

test('SAM notices retain provenance and source office without treating a solicitation prefix as identity',()=>{
 const n=normalize();assert.equal(n.record_kind,'posted_notice');assert.equal(n.source,'SAM.gov');assert.equal(n.office_code,'FA4800');assert.equal(matchesOffice(n,'FA9999'),false);assert.equal(matchesOffice(n,'FA4800'),true);assert.equal(n.notice_type,'Solicitation');assert.equal(n.naics,'238220');assert.equal(n.set_aside_code,'SBA');
 assert.equal(normalize({...sample,fullParentPathCode:'097.5700'}).office_code,null);
});

test('Description URLs and API credentials never become client prose or source links',()=>{
 const n=normalize();assert.equal(n.description_text,null);assert.equal(n.description_available,true);assert.equal(n.attachment_count,1);assert.equal(n.source_url,'https://sam.gov/opp/'+('a'.repeat(32))+'/view');assert.ok(!JSON.stringify(n).includes('EXAMPLE'));assert.equal(normalize(sample,{descriptionText:'Separately retrieved requirement text'}).description_text,'Separately retrieved requirement text');
 assert.equal(normalize({...sample,uiLink:'https://sam.gov.example.org/trap'}).source_url,null);assert.equal(normalize({...sample,uiLink:'javascript:alert(1)'}).source_url,null);
});

test('Deadline aliases, missing values, impossible dates and unknown timezone remain distinct',()=>{
 const alias={...sample,responseDeadLine:undefined,reponseDeadLine:'2026-11-10'};assert.equal(normalize(alias).deadline.precision,'date');assert.equal(normalizeDeadline(null).precision,'missing');assert.equal(normalizeDeadline('2026-02-30').precision,'invalid');assert.equal(normalizeDeadline('2026-11-10T25:00:00').precision,'invalid');assert.equal(normalizeDeadline('2026-11-10 14:00:00').precision,'time_without_zone');assert.equal(normalizeDeadline('2026-11-10T14:00:00-05:00').instant,'2026-11-10T19:00:00.000Z');
});

test('Exact deadlines honor offsets, while date-only deadlines never invent a cutoff time',()=>{
 const n=normalize();assert.equal(deadlineState(n,'2026-11-10T18:59:59Z'),'future');assert.equal(deadlineState(n,'2026-11-10T19:00:00Z'),'passed');assert.equal(deadlineState(normalize({...sample,responseDeadLine:'2026-11-10'}),'2026-11-10T23:00:00Z'),'today_time_unconfirmed');assert.equal(deadlineState(normalize({...sample,responseDeadLine:null}),'2026-11-10T23:00:00Z'),'missing');
});

test('Source inactive and unreported status override any future response date',()=>{
 assert.equal(noticeStatus(normalize({...sample,active:'No'}),checkedAt),'source_inactive');assert.equal(noticeStatus(normalize({...sample,active:undefined}),checkedAt),'source_status_unreported');assert.equal(noticeStatus(normalize(),checkedAt),'future');
});

test('Observed notice changes exclude retrieval timestamps and reject unrelated notices',()=>{
 const before=normalize(),same=normalize(sample,{checkedAt:'2026-10-22T12:00:00Z'});assert.deepEqual(noticeChanges(before,same),[]);
 const after=normalize({...sample,responseDeadLine:'2026-11-15',title:'Revised ventilation maintenance'});assert.deepEqual(noticeChanges(before,after).map(c=>c.field),['title','deadline']);assert.throws(()=>noticeChanges(before,normalize({...sample,noticeId:'b'.repeat(32)})),/same source notice/);
});

test('Malformed IDs and missing source timestamps cannot enter the notice model',()=>{
 assert.throws(()=>normalize({...sample,noticeId:'invalid'}),/notice ID/);assert.throws(()=>normalizeNotice(sample),/timestamp/);assert.throws(()=>normalizeNotice(null,{checkedAt}),/object/);
});
