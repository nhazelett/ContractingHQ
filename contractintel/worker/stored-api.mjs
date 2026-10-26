import {summarizeModifications} from './modifications.mjs';
const OFFICES = new Set(['FA4800', 'FA4855', 'FA8101']);
const CONTRACT_END = 'coalesce(potential_end_date,current_end_date)';
const AWARD_AMOUNT = "(SELECT json_extract(t.raw_json,'$.current_total_value_of_award') FROM transactions t WHERE t.version_id=awards.version_id AND t.transaction_id=awards.latest_transaction_id) AS award_amount_source";
const SORTS = { contract_end: CONTRACT_END, end: 'current_end_date', potential: 'potential_end_date', review: "CASE WHEN current_end_date>=date('now') THEN current_end_date WHEN potential_end_date>=date('now') THEN potential_end_date ELSE coalesce(current_end_date,potential_end_date) END", value: 'obligation_cents', vendor: 'recipient', action: 'latest_action_date', piid: 'piid' };
export const fiscalYear = value => Number(value.slice(0, 4)) + (Number(value.slice(5, 7)) >= 10 ? 1 : 0);
const currentDate = () => new Date().toISOString().slice(0, 10);
class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function int(value, fallback, maximum) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || Number(value) > maximum) throw new InputError('Invalid pagination or fiscal year.');
  return Number(value);
}
// Source award totals are cumulative; transaction deltas can cover only a partial history.
export function sourceAmountCents(value) {
  const match=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value??'').trim());
  if(!match)return null;
  return String((match[1]? -1n:1n)*(BigInt(match[2])*100n+BigInt((match[3]||'').padEnd(2,'0'))));
}
function moneyStrings(row) {
  if(Object.hasOwn(row,'award_amount_source')){
    row.award_amount_cents=sourceAmountCents(row.award_amount_source);
    delete row.award_amount_source;
  }
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key.endsWith('_cents') && value !== null ? String(value) : value]));
}
function csvValue(value) {
  let text = String(value ?? '');
  if (/^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-\d+(\.\d+)?$/.test(text))) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csv(rows, fields) {
  return '\uFEFF' + fields.map(csvValue).join(',') + '\r\n' + rows.map(r => fields.map(f => csvValue(r[f])).join(',')).join('\r\n');
}
export async function handle(request, env) {
  const url = new URL(request.url), p = url.searchParams;
  const origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
  if (['https://kthq.org', 'https://www.kthq.org', 'http://127.0.0.1:8898'].includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  const reply = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return reply({ error: 'Read-only API.' }, 405);
  try {
    if (env.READ_LIMIT) {
      const result = await env.READ_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!result.success) return reply({ error: 'Too many requests. Try again shortly.' }, 429, { 'Retry-After': '60' });
    }
    const all = async (sql, args = []) => (await env.DB.prepare(sql).bind(...args).all()).results.map(moneyStrings);
    const first = async (sql, args = []) => (await all(sql, args))[0] || null;
    if (url.pathname === '/api/offices') return reply({ offices: await all('SELECT * FROM offices ORDER BY code') });
    const active = await first('SELECT d.* FROM active_dataset a JOIN dataset_versions d ON a.version_id=d.id WHERE a.singleton=1');
    if (url.pathname === '/api/status') {
      return reply({ dataset: active, source: 'USAspending public transaction exports',
        sam: { access_check: 'Passed 2026-10-20', nightly_ingestion: 'Not enabled in v1' },
        notes: ['Dates and values are reported by the source. An unexpired reported end date does not establish operational status.',
          'DoD reporting delays affect recent activity. Coverage end is a request boundary, not a completeness guarantee.',
          'Historical obligations follow the office and classification reported on each transaction. The portfolio follows the latest loaded action.'],
        issues: active ? await all('SELECT code,count(*) AS records FROM data_quality_issues WHERE version_id=? GROUP BY code', [active.id]) : [],
        runs: await all('SELECT id,version_id,started_at,ended_at,status,message,source FROM ingest_runs ORDER BY started_at DESC LIMIT 5') });
    }
    if (!active) return reply({ error: 'No validated dataset has been published yet.' }, 503);
    const version = p.get('version') || active.id;
    const dataset = version === active.id ? active : await first("SELECT * FROM dataset_versions WHERE id=? AND status='published'", [version]);
    if (!dataset) return reply({ error: 'This dataset version is unavailable. Refresh to load the current version.' }, 409);
    const office = p.get('office') || 'FA4800';
    if (!OFFICES.has(office)) throw new InputError('Unknown pilot office.');
    const dateBasis=p.get('date_basis')||'current';
    if(!['current','potential'].includes(dateBasis)) throw new InputError('Unknown end-date basis.');
    const dateColumn=dateBasis==='potential'?'potential_end_date':'current_end_date';
    const limit = Math.max(1, int(p.get('limit'), 200, 1000));
    const offset = int(p.get('offset'), 0, 1_000_000);
    if (url.pathname === '/api/summary') {
      const fy = fiscalYear(currentDate());
      const rollups = await all('SELECT * FROM fy_obligations WHERE version_id=? AND office_code=? AND fiscal_year BETWEEN ? AND ? ORDER BY fiscal_year,dimension,obligation_cents DESC', [version, office, fy - 5, fy]);
      const counts = await first(`SELECT count(*) AS awards,
        sum(CASE WHEN current_end_date>=? THEN 1 ELSE 0 END) AS unexpired,
        sum(CASE WHEN current_end_date>=date('now') OR potential_end_date>=date('now') THEN 1 ELSE 0 END) AS portfolio_review,
        sum(CASE WHEN (current_end_date IS NULL OR current_end_date<date('now')) AND potential_end_date>=date('now') THEN 1 ELSE 0 END) AS needs_verification,
        sum(CASE WHEN current_end_date IS NULL THEN 1 ELSE 0 END) AS missing_end,
        sum(CASE WHEN ${dateColumn} BETWEEN ? AND date(?,'+90 days') THEN 1 ELSE 0 END) AS expires_90,
        sum(CASE WHEN ${dateColumn} BETWEEN ? AND date(?,'+180 days') THEN 1 ELSE 0 END) AS expires_180,
        sum(CASE WHEN ${dateColumn} BETWEEN ? AND date(?,'+365 days') THEN 1 ELSE 0 END) AS expires_365
        FROM awards WHERE version_id=? AND office_code=?`, [currentDate(), currentDate(), currentDate(), currentDate(), currentDate(), currentDate(), currentDate(), version, office]);
      return reply({ version, office, date_basis: dateBasis, as_of: currentDate(), fiscal_year: fy, rollups, counts, dataset });
    }
    if (url.pathname === '/api/awards') {
      const clauses = ['version_id=?', 'office_code=?'], args = [version, office];
      const q = (p.get('q') || '').trim();
      if (q.length > 160) throw new InputError('Search text is too long.');
      if (q) {
        clauses.push("(piid LIKE ? ESCAPE '\\' OR recipient LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')");
        const term = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
        args.push(term, term, term);
      }
      for (const key of ['naics', 'psc']) if (p.get(key)) { clauses.push(key + '=?'); args.push(p.get(key)); }
      const view = p.get('view') || 'all';
      if (view === 'review') { clauses.push('(current_end_date>=? OR potential_end_date>=?)'); args.push(currentDate(),currentDate()); }
      else if (view === 'verify') { clauses.push('(current_end_date IS NULL OR current_end_date<?) AND potential_end_date>=?'); args.push(currentDate(),currentDate()); }
      else if (view === 'date_review') clauses.push('(current_end_date IS NULL OR potential_end_date IS NULL OR potential_end_date<current_end_date)');
      else if (view === 'past') { clauses.push('current_end_date<? AND potential_end_date<?'); args.push(currentDate(),currentDate()); }
      else if (view === 'potential_active') { clauses.push('potential_end_date>=?'); args.push(currentDate()); }
      else if (view === 'active') { clauses.push('current_end_date>=?'); args.push(currentDate()); }
      else if (view === 'unknown') clauses.push('current_end_date IS NULL');
      else if (['90', '180', '365'].includes(view)) { clauses.push(dateColumn+" BETWEEN ? AND date(?, '+' || ? || ' days')"); args.push(currentDate(), currentDate(), view); }
      else if (['1y', '3y', '5y'].includes(view)) { clauses.push("latest_action_date>=date(?, '-' || ? || ' years')"); args.push(currentDate(), view[0]); }
      else if (view !== 'all') throw new InputError('Unknown portfolio filter.');
      const where = clauses.join(' AND '), sortKey = p.get('sort') || 'contract_end', sort = SORTS[sortKey];
      if (!sort) throw new InputError('Unknown sort column.');
      const direction = p.get('direction') === 'desc' ? 'DESC' : 'ASC';
      const ordering=sortKey==='contract_end'
        ? `CASE WHEN ${CONTRACT_END}>=date('now') THEN 0 WHEN ${CONTRACT_END}<date('now') THEN 1 ELSE 2 END, CASE WHEN ${CONTRACT_END}>=date('now') THEN ${CONTRACT_END} END ${direction}, CASE WHEN ${CONTRACT_END}<date('now') THEN ${CONTRACT_END} END DESC`
        : `${sort} IS NULL,${sort} ${direction}`;
      const total = await first('SELECT count(*) AS count FROM awards WHERE ' + where, args);
      const rows = await all(`SELECT awards.*, ${AWARD_AMOUNT},
        (SELECT modification_number FROM transactions t WHERE t.version_id=awards.version_id AND t.award_id=awards.award_id AND trim(t.modification_number)<>'' AND trim(t.modification_number) GLOB '*[^0]*' ORDER BY action_date DESC,modification_number DESC,transaction_id DESC LIMIT 1) AS latest_mod_number,
        (SELECT count(DISTINCT CASE WHEN trim(t.modification_number) NOT GLOB '*[^0-9]*' THEN CAST(CAST(trim(t.modification_number) AS INTEGER) AS TEXT) ELSE upper(trim(t.modification_number)) END) FROM transactions t WHERE t.version_id=awards.version_id AND t.award_id=awards.award_id AND trim(t.modification_number)<>'' AND trim(t.modification_number) GLOB '*[^0]*') AS mods_loaded,
        (SELECT modification_number FROM transactions t WHERE t.version_id=awards.version_id AND t.award_id=awards.award_id AND upper(trim(json_extract(t.raw_json,'$.action_type_code')))='G' AND trim(t.modification_number)<>'' AND trim(t.modification_number) GLOB '*[^0]*' ORDER BY action_date DESC,modification_number DESC,transaction_id DESC LIMIT 1) AS latest_option_mod_number
        FROM awards WHERE ` + where + ` ORDER BY ${ordering},award_id ASC LIMIT ? OFFSET ?`, [...args, limit, offset]);
      return reply({ version, total: total.count, offset, limit, rows });
    }
    if (url.pathname === '/api/award') {
      const id = p.get('id');
      if (!id || id.length > 300) throw new InputError('Invalid award identifier.');
      const award = await first(`SELECT awards.*, ${AWARD_AMOUNT} FROM awards WHERE version_id=? AND award_id=?`, [version, id]);
      if (!award) throw new InputError('Award not found in this dataset.', 404);
      const issues = await all('SELECT code,detail FROM data_quality_issues WHERE version_id=? AND record_id=?', [version, id]);
      const orders = await all('SELECT award_id,piid,recipient,current_end_date,obligation_cents FROM awards WHERE version_id=? AND parent_piid=? ORDER BY current_end_date LIMIT 1000', [version, award.piid]);
      const historyRows = await all("SELECT transaction_id,action_date,modification_number,source_sha256,json_extract(raw_json,'$.action_type_code') AS action_type_code,json_extract(raw_json,'$.action_type') AS action_type,substr(json_extract(raw_json,'$.transaction_description'),1,1000) AS description,json_extract(raw_json,'$.period_of_performance_start_date') AS reported_start,json_extract(raw_json,'$.period_of_performance_current_end_date') AS reported_current_end,json_extract(raw_json,'$.period_of_performance_potential_end_date') AS reported_potential_end FROM transactions WHERE version_id=? AND award_id=? ORDER BY action_date DESC,modification_number DESC,transaction_id DESC LIMIT 5001", [version,id]);
      const modifications=summarizeModifications(historyRows.slice(0,5000),{truncated:historyRows.length>5000});
      const options = { total_options: null, current_option_year: null, exercise_actions_loaded: modifications.option_mods_loaded, actions: modifications.actions.filter(r=>r.option_exercised).slice(0,20), note: 'Option totals and current option year are not verified. Reported option-exercise mods and observed PoP changes are shown below.' };
      return reply({ version, award, issues, orders, options, modifications, orders_note: 'Related records match the reported parent PIID within the loaded dataset; this is not a complete government-wide order inventory.' });
    }
    if (url.pathname === '/api/transactions') {
      let where = 'version_id=?', args = [version];
      if (p.get('award')) { where += ' AND award_id=?'; args.push(p.get('award')); }
      else {
        where += ' AND office_code=?'; args.push(office);
        const fy = int(p.get('fy'), fiscalYear(currentDate()), 2200);
        where += ' AND fiscal_year=?'; args.push(fy);
        for (const key of ['naics', 'psc']) if (p.get(key)) { where += ' AND ' + key + '=?'; args.push(p.get(key)); }
      }
      const summary = await first('SELECT count(*) AS count,coalesce(sum(obligation_cents),0) AS obligation_cents FROM transactions WHERE ' + where, args);
      const rows = await all('SELECT transaction_id,award_id,piid,action_date,modification_number,office_code,recipient,naics,psc,obligation_cents,current_value_delta_cents,potential_value_delta_cents,number_of_actions,source_sha256 FROM transactions WHERE ' + where + ' ORDER BY action_date DESC,modification_number DESC,transaction_id DESC LIMIT ? OFFSET ?', [...args, limit, offset]);
      return reply({ version, total: summary.count, obligation_cents: summary.obligation_cents, offset, rows });
    }
    if (url.pathname === '/api/sources') return reply({ version, sources: await all('SELECT DISTINCT s.sha256,s.source_url,s.downloaded_at,s.byte_count,s.row_count FROM source_files s JOIN transactions t ON s.sha256=t.source_sha256 WHERE t.version_id=? ORDER BY s.downloaded_at', [version]) });
    return reply({ error: 'Unknown endpoint.' }, 404);
  } catch (error) {
    return reply({ error: error instanceof InputError ? error.message : 'Data service unavailable. Try again shortly.' }, error instanceof InputError ? error.status : 503);
  }
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const cacheable=request.method==='GET'&&url.searchParams.has('version')&&url.pathname!=='/api/status'&&url.href.length<2000;
    if(!cacheable||typeof caches==='undefined'||!ctx?.waitUntil)return handle(request,env);
    const cache=caches.default,key=new Request(url.href,{method:'GET'});
    const applyOrigin=response=>{
      const headers=new Headers(response.headers);
      headers.delete('Access-Control-Allow-Origin');
      const origin=request.headers.get('Origin');
      if(['https://kthq.org','https://www.kthq.org'].includes(origin))headers.set('Access-Control-Allow-Origin',origin);
      headers.set('Vary','Origin');return new Response(response.body,{status:response.status,headers});
    };
    const cached=await cache.match(key);
    if(cached)return applyOrigin(cached);
    const response=await handle(request,env);
    if(response.ok){
      const headers=new Headers(response.headers);headers.set('Cache-Control','public, max-age=300');headers.delete('Access-Control-Allow-Origin');
      const stored=new Response(response.body,{status:response.status,headers});
      ctx.waitUntil(cache.put(key,stored.clone()));return applyOrigin(stored);
    }
    return response;
  }
};
