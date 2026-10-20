"""Manual, guarded backfill/refresh with immutable archives and atomic publication.

Each month is a replaceable source partition. Retained monthly exports are read
again on every reconstruction so an award entering a pilot office can recover
its older Air Force actions. No public request can start an ingestion job.
"""
import argparse
import calendar
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from bulk import download,MAX_ARCHIVE_BYTES
from cloud import provision,get_object,put_object,publish
from core import file_hash,utcnow


def months(start,end):
    day=dt.date.fromisoformat(start); last=dt.date.fromisoformat(end)
    if day.day!=1 or day>last:
        raise ValueError('Start must be the first day of a month and no later than end')
    while day<=last:
        finish=min(dt.date(day.year,day.month,calendar.monthrange(day.year,day.month)[1]),last)
        yield day.isoformat(),finish.isoformat()
        day=finish+dt.timedelta(days=1)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--start',default=(dt.datetime.now(dt.timezone.utc).date()-dt.timedelta(days=120)).replace(day=1).isoformat())
    parser.add_argument('--end',default=dt.datetime.now(dt.timezone.utc).date().isoformat())
    parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    windows=list(months(args.start,args.end))
    if len(windows)>324:
        raise ValueError('Backfill exceeds 27-year safety boundary')
    if args.publish and not os.environ.get('CLOUDFLARE_API_TOKEN'):
        raise RuntimeError('Add CLOUDFLARE_API_TOKEN as a repository Actions secret before publishing')
    # Unique directory avoids stale partial exports contaminating a new build.
    base=Path('contractintel/.runtime');base.mkdir(parents=True,exist_ok=True)
    work=Path(tempfile.mkdtemp(prefix='run-',dir=base))
    catalog={'format_version':1,'partitions':{},'objects':{}}
    if args.publish:
        dbid,created=provision()
        if not created:
            get_object('catalog.json',work/'catalog.json')
            catalog=json.loads((work/'catalog.json').read_text())
            if catalog.get('format_version')!=1: raise ValueError('Unsupported archive catalog')
        else:
            (work/'catalog.json').write_text(json.dumps(catalog))
            put_object('catalog.json',work/'catalog.json')
    downloaded={}
    for start,end in windows:
        source=download(start,end,work/'sources')
        # Refuse a refresh that would truncate a previously captured month.
        previous=catalog['partitions'].get(start[:7])
        if previous and previous['request']['filters']['date_range']['end_date']>end:
            raise ValueError('Requested window would truncate a retained monthly partition')
        catalog['partitions'][start[:7]]=source
        downloaded[source['sha256']]=source
        known=sum(item['byte_count'] for item in catalog['objects'].values())
        if source['sha256'] not in catalog['objects'] and known+source['byte_count']>MAX_ARCHIVE_BYTES:
            raise ValueError('4 GB archive guard reached. No further files will be uploaded.')
        if source['sha256'] not in catalog['objects']:
            if args.publish: put_object('raw/'+source['sha256']+'.zip',source['path'])
            catalog['objects'][source['sha256']]={'byte_count':source['byte_count'],'archived_at':utcnow()}
        # Persist the size ledger after each upload, even if a later build fails.
        if args.publish:
            (work/'catalog.json').write_text(json.dumps(catalog,indent=2))
            put_object('catalog.json',work/'catalog.json')
        print('Source partition ready:',start[:7],source['byte_count'],'bytes')
    sources=[]
    for key,source in sorted(catalog['partitions'].items()):
        path=work/'sources'/(source['sha256']+'.zip')
        if source['sha256'] not in downloaded:
            if not args.publish: raise RuntimeError('Retained source requires archive access')
            get_object('raw/'+source['sha256']+'.zip',path)
        if file_hash(path)!=source['sha256']: raise RuntimeError('Archive integrity check failed')
        sources.append({**source,'path':str(path.resolve())})
    ranges=[s['request']['filters']['date_range'] for s in sources]
    # Missing months are explicit blockers, not zero-dollar years in the UI.
    for left,right in zip(ranges,ranges[1:]):
        if dt.date.fromisoformat(left['end_date'])+dt.timedelta(days=1)!=dt.date.fromisoformat(right['start_date']):
            raise ValueError('Source manifest has a gap; fill missing months before publication')
    manifest={'coverage_start':ranges[0]['start_date'],'coverage_end':ranges[-1]['end_date'],
      'completeness':'Air Force source scope only. Older actions before the coverage start, cross-agency transfers, and delayed public reporting may be absent. Unexpired awards are not a certified complete inventory.',
      'sources':sources}
    (work/'manifest.json').write_text(json.dumps(manifest,indent=2))
    subprocess.run([sys.executable,'contractintel/ingest/build.py','--manifest',str(work/'manifest.json'),'--output',str(work/'build')],check=True)
    if args.publish:
        version=publish(dbid,work/'build')
        put_object('datasets/'+version+'/manifest.json',work/'manifest.json')
        put_object('datasets/'+version+'/summary.json',work/'build/dataset.json')
        print('Published dataset:',version)
    print('Build output:',work/'build')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as output: output.write('build_dir='+str(work/'build')+'\n')


if __name__=='__main__':
    try: main()
    except (ValueError,RuntimeError,OSError,subprocess.CalledProcessError) as error:
        # Do not print third-party exception details that might contain URLs/keys.
        print('Pipeline stopped safely:',str(error) if isinstance(error,(ValueError,RuntimeError)) else type(error).__name__)
        sys.exit(1)
