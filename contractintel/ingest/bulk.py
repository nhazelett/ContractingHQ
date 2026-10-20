"""Download bounded, immutable USAspending partitions. No SAM key is used."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
import time
import urllib.parse
import urllib.request
from core import utcnow, file_hash

TYPES = ['A','B','C','D','IDV_A','IDV_B','IDV_B_A','IDV_B_B','IDV_B_C','IDV_C','IDV_D','IDV_E']
MAX_ARCHIVE_BYTES = 4_000_000_000
MAX_FILE_BYTES = 500_000_000


def safe_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('api.usaspending.gov','files.usaspending.gov') or parsed.username or parsed.password:
        raise ValueError('Unexpected download host')
    return url


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe_url(newurl)
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def request_json(url, payload=None):
    req = urllib.request.Request(safe_url(url), data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={'Content-Type':'application/json','Accept':'application/json'})
    # Download creation is not retried automatically: avoid duplicate export jobs.
    with urllib.request.build_opener(SafeRedirect()).open(req, timeout=90) as response:
        raw = response.read(2_000_001)
        if len(raw)>2_000_000:
            raise ValueError('Unexpectedly large API response')
        return json.loads(raw)


def download(start, end, directory):
    dt.date.fromisoformat(start)
    dt.date.fromisoformat(end)
    if start > end:
        raise ValueError('Start is after end')
    directory = Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    payload = {'filters': {'prime_award_types': TYPES, 'date_type':'action_date',
               'date_range':{'start_date':start,'end_date':end},
               'agencies':[{'type':'awarding','tier':'subtier','name':'Department of the Air Force','toptier_name':'Department of Defense'}]},
               'file_format':'csv'}
    manifest_path = directory / f'{start}_{end}.json'
    if manifest_path.exists():
        source = json.loads(manifest_path.read_text())
        path = directory / source['file_name']
        if path.exists() and file_hash(path)==source['sha256']:
            source['path'] = str(path)
            return source
        raise ValueError('Cached source does not match its manifest')
    used = sum(p.stat().st_size for p in directory.glob('*.zip'))
    if used >= MAX_ARCHIVE_BYTES:
        raise ValueError('Archive size guard reached; review scope before downloading more')
    job = request_json('https://api.usaspending.gov/api/v2/bulk_download/awards/',payload)
    status_url = safe_url(job['status_url'])
    for attempt in range(90):
        state = request_json(status_url)
        status = str(state.get('status','')).lower()
        if status == 'finished':
            break
        if status in ('failed','error'):
            raise ValueError('USAspending export failed')
        time.sleep(10)
    else:
        raise ValueError('Export is not ready after 15 minutes; resume using the source job status')
    url = safe_url(job['file_url'])
    total = 0
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory,suffix='.download',delete=False) as target:
            temp_name = target.name
            with urllib.request.build_opener(SafeRedirect()).open(url,timeout=180) as response:
                while chunk := response.read(1024*1024):
                    total += len(chunk)
                    if total > MAX_FILE_BYTES or used + total > MAX_ARCHIVE_BYTES:
                        raise ValueError('Download size guard reached; use a smaller source window')
                    target.write(chunk)
        sha = file_hash(temp_name)
        destination = directory / (sha+'.zip')
        os.replace(temp_name,destination)
        source = {'file_name':destination.name,'path':str(destination),'sha256':sha,
                  'source_url':url,'request':payload,'downloaded_at':utcnow(),'byte_count':total}
        manifest_path.write_text(json.dumps(source,indent=2),encoding='utf-8')
        return source
    finally:
        if temp_name and Path(temp_name).exists():
            Path(temp_name).unlink()


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--start',required=True)
    parser.add_argument('--end',required=True)
    parser.add_argument('--directory',default='contractintel/.runtime/sources')
    args=parser.parse_args()
    source=download(args.start,args.end,args.directory)
    print(json.dumps({k:v for k,v in source.items() if k!='request'},indent=2))
