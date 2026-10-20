"""Cloudflare deployment helpers. Credentials stay in environment and headers."""
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
from core import ROOT,utcnow

ACCOUNT='a7443e0102de587d778491ab08fd883f'
DATABASE='kthq-contractintel'
BUCKET='kthq-contractintel-raw'
WRANGLER='4.140.0'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None


def cf(path,method='GET',body=None):
    token=os.environ.get('CLOUDFLARE_API_TOKEN','').strip()
    if not token:
        raise RuntimeError('Missing CLOUDFLARE_API_TOKEN GitHub Actions secret')
    request=urllib.request.Request('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,
       data=json.dumps(body).encode() if body is not None else None,method=method,
       headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=120) as response:
            data=json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Cloudflare request failed: HTTP '+str(error.code)) from None
    except (OSError,ValueError):
        raise RuntimeError('Cloudflare network or response error') from None
    if not data.get('success'):
        raise RuntimeError('Cloudflare rejected the operation; inspect account permissions and usage')
    return data['result']


def wrangler(*args):
    # Explicitly disable optional CLI telemetry. No credentials in command text.
    env={**os.environ,'CLOUDFLARE_ACCOUNT_ID':ACCOUNT,'WRANGLER_SEND_METRICS':'false','CI':'true'}
    result=subprocess.run(['npx','--yes','wrangler@'+WRANGLER,*map(str,args)],env=env,cwd=ROOT,capture_output=True,text=True)
    if result.returncode:
        # Don't echo tool output: it can include provider diagnostics/URLs.
        raise RuntimeError('Wrangler operation failed ('+' '.join(map(str,args[:3]))+'); deployment stopped')
    return result.stdout


def provision():
    databases=cf('/d1/database?per_page=100')
    found=next((db for db in databases if db['name']==DATABASE),None)
    if not found:
        found=cf('/d1/database','POST',{'name':DATABASE})
    dbid=found['uuid']
    config=json.loads((ROOT/'worker/wrangler.jsonc').read_text())
    config['d1_databases'][0]['database_id']=dbid
    (ROOT/'worker/wrangler.jsonc').write_text(json.dumps(config,indent=2),encoding='utf-8')
    buckets=cf('/r2/buckets')['buckets']
    created=not any(b['name']==BUCKET for b in buckets)
    if created:
        cf('/r2/buckets','POST',{'name':BUCKET,'storageClass':'Standard'})
    return dbid,created


def get_object(key,path):
    path=Path(path).resolve()
    path.parent.mkdir(parents=True,exist_ok=True)
    wrangler('r2','object','get',BUCKET+'/'+key,'--file',path,'--remote')


def put_object(key,path):
    wrangler('r2','object','put',BUCKET+'/'+key,'--file',Path(path).resolve(),'--remote')


def query(dbid,sql,params=None):
    result=cf('/d1/database/'+dbid+'/query','POST',{'sql':sql,'params':params or []})
    if any(not block.get('success') for block in result):
        raise RuntimeError('D1 query failed')
    return result[0]['results'] if result else []


def publish(dbid,build_dir,allowance=80000):
    build_dir=Path(build_dir).resolve()
    info=json.loads((build_dir/'dataset.json').read_text())
    if info['estimated_d1_writes']>allowance:
        raise RuntimeError('Dataset exceeds the configured per-run D1 write guard. Review plan limits before deployment.')
    config=ROOT/'worker/wrangler.jsonc'
    wrangler('d1','execute',DATABASE,'--remote','--file',ROOT/'migrations/0001.sql','--config',config,'--yes')
    active=query(dbid,'SELECT version_id FROM active_dataset WHERE singleton=1')
    previous=active[0]['version_id'] if active else None
    if previous==info['id']:
        print('Identical dataset already active; no database writes required.')
        wrangler('deploy','--config',config)
        return info['id']
    # Do not keep importing into a free-tier DB until it runs out of storage.
    database=cf('/d1/database/'+dbid)
    if int(database.get('file_size',0))+info['sqlite_bytes']>450_000_000:
        raise RuntimeError('D1 storage guard reached. Retain rollback archives and review capacity before importing.')
    for path in sorted(build_dir.glob('stage-*.sql')):
        wrangler('d1','execute',DATABASE,'--remote','--file',path,'--config',config,'--yes')
    version=info['id']
    checks=query(dbid,'''SELECT
      (SELECT count(*) FROM transactions WHERE version_id=?) AS transaction_count,
      (SELECT count(*) FROM awards WHERE version_id=?) AS award_count,
      (SELECT coalesce(sum(obligation_cents),0) FROM transactions WHERE version_id=?) AS net_obligation_cents,
      (SELECT coalesce(sum(obligation_cents),0) FROM awards WHERE version_id=?) AS award_net,
      (SELECT coalesce(sum(obligation_cents),0) FROM fy_obligations WHERE version_id=? AND dimension='all') AS rollup_net''',[version]*5)[0]
    for field in ('transaction_count','award_count','net_obligation_cents'):
        if checks[field]!=info[field]: raise RuntimeError('Remote validation failed: '+field)
    if checks['award_net']!=info['net_obligation_cents'] or checks['rollup_net']!=info['net_obligation_cents']:
        raise RuntimeError('Remote obligations reconciliation failed')
    if query(dbid,'PRAGMA foreign_key_check'):
        raise RuntimeError('Remote foreign key validation failed')
    query(dbid,"UPDATE dataset_versions SET status='published',published_at=? WHERE id=? AND status IN ('validated','published')",[utcnow(),version])
    # The single pointer write is atomic. Compare-and-set protects another publisher.
    query(dbid,'''INSERT INTO active_dataset(singleton,version_id) VALUES(1,?)
      ON CONFLICT(singleton) DO UPDATE SET version_id=excluded.version_id
      WHERE active_dataset.version_id=?''',[version,previous])
    if query(dbid,'SELECT version_id FROM active_dataset WHERE singleton=1')[0]['version_id']!=version:
        raise RuntimeError('A concurrent publication changed the pointer; inspect before retrying')
    wrangler('deploy','--config',config)
    return version
