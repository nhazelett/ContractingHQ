"""Exact-money, versioned public transaction ingestion. Python standard library only."""
from collections import defaultdict
import csv
import datetime as dt
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import sqlite3
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OFFICES = ('FA4800', 'FA4855', 'FA8101')
MAX_CENTS = 2**53 - 1  # D1/JavaScript exact-integer boundary, stricter than SQLite.
REQUIRED = {'contract_transaction_unique_key', 'contract_award_unique_key',
            'award_id_piid', 'action_date', 'awarding_office_code', 'federal_action_obligation'}


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def clean(value):
    value = str(value or '').strip()
    return None if value.lower() in ('', 'null', 'none', 'n/a') else value


def cents(value, required=False):
    value = clean(value)
    if value is None:
        if required:
            raise ValueError('Required money value missing')
        return None
    try:
        number = Decimal(value.replace(',', '')) * 100
    except InvalidOperation:
        raise ValueError('Invalid money value') from None
    if not number.is_finite() or number != number.to_integral_value() or abs(number) > MAX_CENTS:
        raise ValueError('Money must be finite, exact cents, and within the supported range')
    return int(number)


def checked_sum(values):
    result = sum(values)
    if abs(result) > MAX_CENTS:
        raise ValueError('Aggregate exceeds exact integer range')
    return result


def date(value):
    value = clean(value)
    if value is None:
        return None
    return dt.date.fromisoformat(value[:10]).isoformat()


def fiscal_year(value):
    day = dt.date.fromisoformat(value)
    return day.year + (day.month >= 10)


def normalize_igf(value):
    # Preserve reported codes. These are reporting labels, not a legal determination.
    raw = clean(value)
    if raw is None:
        return 'Not reported'
    labels = {'CL': 'Closely associated', 'CT': 'Critical', 'OT': 'Other', 'IG': 'Inherently governmental'}
    codes = re.findall(r'IGF::([A-Z]{2})', raw.upper())
    return '; '.join(labels.get(code, code) for code in sorted(set(codes))) if codes else raw


def connect(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / 'migrations/0001.sql').read_text(encoding='utf-8'))
    return db


def csv_rows(path):
    with zipfile.ZipFile(path) as archive:
        for member in sorted(archive.namelist()):
            if not member.lower().endswith('.csv'):
                continue
            with archive.open(member) as stream:
                reader = csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig', newline=''))
                if not REQUIRED.issubset(set(reader.fieldnames or [])):
                    raise ValueError('Source CSV is missing required contract columns')
                yield from reader


def file_hash(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def issue(db, version, record, code, detail):
    db.execute('INSERT OR REPLACE INTO data_quality_issues VALUES (?,?,?,?)',
               (version, record, code, detail))


def ingest_row(db, version, row, source_sha):
    if not REQUIRED.issubset(row):
        raise ValueError('Required CSV columns missing')
    key = clean(row['contract_transaction_unique_key'])
    award = clean(row['contract_award_unique_key'])
    action = date(row['action_date'])
    office = clean(row['awarding_office_code'])
    if not all((key, award, action, office, clean(row['award_id_piid']))):
        raise ValueError('Missing required transaction identity, office, or date')
    count = int(clean(row.get('number_of_actions')) or '1')
    if count < 0:
        raise ValueError('Negative number_of_actions')
    values = (version, key, award, row['award_id_piid'], clean(row.get('parent_award_id_piid')),
              action, fiscal_year(action), clean(row.get('modification_number')) or '', office,
              clean(row.get('awarding_office_name')) or office, clean(row.get('recipient_name')),
              clean(row.get('naics_code')), clean(row.get('product_or_service_code')),
              cents(row['federal_action_obligation'], True),
              cents(row.get('base_and_exercised_options_value')),
              cents(row.get('base_and_all_options_value')), count, source_sha,
              json.dumps(row, separators=(',', ':'), ensure_ascii=True))
    # Duplicates across overlapping snapshots resolve by source modified date,
    # then by input ordering (the later downloaded snapshot is authoritative).
    previous = db.execute('SELECT raw_json FROM transactions WHERE version_id=? AND transaction_id=?',
                          (version, key)).fetchone()
    if previous:
        prior = json.loads(previous[0])
        if (clean(prior.get('last_modified_date')) or '') > (clean(row.get('last_modified_date')) or ''):
            return
    db.execute('INSERT OR REPLACE INTO transactions VALUES (' + ','.join('?' for _ in values) + ')', values)
    if office in OFFICES:
        name = clean(row.get('awarding_office_name')) or office
        db.execute('INSERT INTO office_name_history VALUES (?,?,?,?) ON CONFLICT(office_code,source_name) DO UPDATE SET first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen)',
                   (office, name, action, action))


def build_awards(db, version):
    ids = db.execute('SELECT DISTINCT award_id FROM transactions WHERE version_id=? ORDER BY award_id', (version,)).fetchall()
    for (award_id,) in ids:
        rows = db.execute('SELECT * FROM transactions WHERE version_id=? AND award_id=? ORDER BY action_date,modification_number,transaction_id', (version, award_id)).fetchall()
        latest = rows[-1]
        raw = json.loads(latest['raw_json'])
        original = json.loads(rows[0]['raw_json'])
        start = date(raw.get('period_of_performance_start_date'))
        end = date(raw.get('period_of_performance_current_end_date'))
        potential_end = date(raw.get('period_of_performance_potential_end_date'))
        money = lambda field: checked_sum(r[field] for r in rows) if all(r[field] is not None for r in rows) else None
        obligation = money('obligation_cents')
        current = money('current_value_delta_cents')
        potential = money('potential_value_delta_cents')
        # The aggregate total copied into the export is a useful reconciliation
        # signal, but is never summed across transactions.
        source_total = cents(raw.get('total_dollars_obligated'))
        history_ok = source_total is not None and source_total == obligation
        if not history_ok:
            issue(db, version, award_id, 'history_unreconciled', 'Loaded transaction sum has not reconciled to the source award total. History may be incomplete.')
        if start and end and end < start:
            issue(db, version, award_id, 'end_before_start', 'Source current end date precedes start date.')
        if potential is not None and potential < 0:
            issue(db, version, award_id, 'negative_potential_value', 'Source value deltas sum to a negative potential value; review transactions.')
        values = (version, award_id, latest['piid'], latest['parent_piid'], latest['office_code'], latest['office_name'],
                  clean(raw.get('award_type')) or clean(raw.get('award_type_code')), latest['recipient'], clean(raw.get('recipient_uei')),
                  clean(original.get('prime_award_base_transaction_description')) or clean(raw.get('prime_award_base_transaction_description')) or clean(original.get('transaction_description')),
                  latest['naics'], latest['psc'], clean(raw.get('type_of_set_aside')), clean(raw.get('extent_competed')),
                  clean(raw.get('type_of_contract_pricing')), normalize_igf(raw.get('inherently_governmental_functions')),
                  start, end, potential_end, rows[0]['action_date'], latest['action_date'], obligation, current, potential,
                  len(rows), sum(r['number_of_actions'] for r in rows), clean(raw.get('usaspending_permalink')),
                  latest['transaction_id'], 0)  # Equal totals alone do not prove complete transaction history.
        db.execute('INSERT INTO awards VALUES (' + ','.join('?' for _ in values) + ')', values)
    for dimension, expression in [('all', "''"), ('naics', "coalesce(naics,'Not reported')"), ('psc', "coalesce(psc,'Not reported')")]:
        db.execute(f'''INSERT INTO fy_obligations SELECT version_id,office_code,fiscal_year,?,{expression},
            sum(obligation_cents),count(*),sum(number_of_actions) FROM transactions
            WHERE version_id=? GROUP BY version_id,office_code,fiscal_year,{expression}''', (dimension, version))
    for row in db.execute('SELECT obligation_cents FROM fy_obligations WHERE version_id=?', (version,)):
        checked_sum([row[0]])


def build_dataset(db, sources, start, end, version=None, completeness='Partial history; coverage is limited to the listed source windows.'):
    """Full reconstruction from immutable source partitions, never append-only deltas.

    Pass a complete manifest (including retained historical partitions) each run.
    Replacing a partition in that manifest reconciles deletions and corrections.
    """
    sources = sorted(sources, key=lambda s: s['downloaded_at'])
    manifest_id = hashlib.sha256(json.dumps({'normalizer':'2026-10-20.1','coverage_start':start,'coverage_end':end,'completeness':completeness,'sources':[{'sha256': file_hash(s['path']), 'request': s['request']} for s in sources]}, sort_keys=True).encode()).hexdigest()[:20]
    version = version or 'usa-' + manifest_id
    if db.execute('SELECT 1 FROM dataset_versions WHERE id=?', (version,)).fetchone():
        return version  # Same immutable input is idempotent.
    tracked = set()
    for source in sources:
        for row in csv_rows(source['path']):
            if row.get('awarding_office_code') in OFFICES:
                tracked.add(row['contract_award_unique_key'])
    run_id = version + '-build'
    with db:
        db.execute('INSERT INTO dataset_versions(id,created_at,status,coverage_start,coverage_end,scope,completeness) VALUES (?,?,?,?,?,?,?)',
                   (version, utcnow(), 'staging', start, end, 'Department of the Air Force; awards touching pilot offices, including their other Air Force transactions', completeness))
        db.execute('INSERT INTO ingest_runs VALUES (?,?,?,?,?,?,?)', (run_id,version,utcnow(),None,'running','','USAspending'))
        for source in sources:
            sha = file_hash(source['path'])
            path = Path(source['path'])
            db.execute('INSERT OR IGNORE INTO source_files VALUES (?,?,?,?,?,?,?)',
                       (sha, 'raw/'+sha+'.zip', source['source_url'], json.dumps(source['request'],sort_keys=True), source['downloaded_at'], path.stat().st_size, 0))
            count = 0
            for row in csv_rows(path):
                count += 1
                if row['contract_award_unique_key'] in tracked:
                    if not start <= date(row['action_date']) <= end:
                        raise ValueError('Source action date outside declared coverage')
                    ingest_row(db, version, row, sha)
            db.execute('UPDATE source_files SET row_count=? WHERE sha256=?', (count, sha))
        build_awards(db, version)
        count, net = db.execute('SELECT count(*),coalesce(sum(obligation_cents),0) FROM transactions WHERE version_id=?', (version,)).fetchone()
        awards = db.execute('SELECT count(*) FROM awards WHERE version_id=?', (version,)).fetchone()[0]
        checked_sum([net])
        rollup = db.execute("SELECT coalesce(sum(obligation_cents),0) FROM fy_obligations WHERE version_id=? AND dimension='all'", (version,)).fetchone()[0]
        award_net = db.execute('SELECT coalesce(sum(obligation_cents),0) FROM awards WHERE version_id=?', (version,)).fetchone()[0]
        if net != rollup or net != award_net or not count:
            raise ValueError('Empty dataset or failed obligations reconciliation')
        if db.execute('PRAGMA foreign_key_check').fetchone():
            raise ValueError('Foreign key validation failed')
        db.execute("UPDATE dataset_versions SET status='validated',transaction_count=?,award_count=?,net_obligation_cents=? WHERE id=?",(count,awards,net,version))
        db.execute("UPDATE ingest_runs SET ended_at=?,status='validated' WHERE id=?",(utcnow(),run_id))
    return version


def activate(db, version):
    with db:
        row = db.execute('SELECT status FROM dataset_versions WHERE id=?', (version,)).fetchone()
        if not row or row[0] not in ('validated','published'):
            raise ValueError('Cannot publish an unvalidated dataset')
        db.execute("UPDATE dataset_versions SET status='published',published_at=? WHERE id=?", (utcnow(),version))
        db.execute('INSERT INTO active_dataset VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET version_id=excluded.version_id', (version,))


def quote(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def export_sql(db, version, directory):
    """Stage inserts only. Activation is a separate transaction after remote checks."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    tables = ['offices','office_name_history','dataset_versions','source_files','ingest_runs',
              'transactions','awards','fy_obligations','data_quality_issues']
    part, size, stream = 0, 0, None
    try:
        for table in tables:
            where = ' WHERE id=?' if table == 'dataset_versions' else ' WHERE version_id=?' if table in tables[4:] else ''
            for row in db.execute('SELECT * FROM '+table+where, (version,) if where else ()):
                statement = 'INSERT OR IGNORE INTO '+table+' VALUES ('+','.join(quote(v) for v in row)+');\n'
                if table=='office_name_history':
                    statement=statement.replace('INSERT OR IGNORE','INSERT').replace(');\n',') ON CONFLICT(office_code,source_name) DO UPDATE SET first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen);\n')
                if len(statement.encode()) > 90_000:
                    raise ValueError('Row exceeds conservative D1 SQL statement limit')
                if stream is None or size + len(statement.encode()) > 4_000_000:
                    if stream:
                        stream.close()
                    part += 1
                    stream = (directory / f'stage-{part:04d}.sql').open('w',encoding='utf-8')
                    size = 0
                stream.write(statement)
                size += len(statement.encode())
    finally:
        if stream:
            stream.close()
    return part
