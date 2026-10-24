"""Build a version from an explicit manifest of complete source partitions."""
import argparse
import json
from pathlib import Path
from core import connect, build_dataset, export_sql, activate


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--output',default='contractintel/.runtime/build')
    args=parser.parse_args()
    manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    out=Path(args.output)
    if out.exists() and any(out.iterdir()):
        raise SystemExit('Output must be empty to prevent mixing dataset versions')
    out.mkdir(parents=True,exist_ok=True)
    db=connect(out/'dataset.sqlite')
    version=build_dataset(db,manifest['sources'],manifest['coverage_start'],manifest['coverage_end'],completeness=manifest['completeness'])
    parts=export_sql(db,version,out)
    info=dict(db.execute('SELECT * FROM dataset_versions WHERE id=?',(version,)).fetchone())
    # A large initial import needs a paid D1 plan or partitioned deployment.
    # This estimate includes indexed-row writes, not just transaction count.
    info['estimated_d1_writes']=sum(db.execute('SELECT count(*) FROM '+t).fetchone()[0]*factor for t,factor in [('transactions',3),('awards',3),('fy_obligations',1),('data_quality_issues',1),('source_files',1)])
    info['sql_parts']=parts
    info['sqlite_bytes']=(out/'dataset.sqlite').stat().st_size
    # Preserve the measured size even when a capacity guard stops publication.
    (out/'dataset.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
    if info['sqlite_bytes']>200_000_000:
        raise SystemExit('Dataset exceeds conservative free-D1 staging budget; review before deployment')
    activate(db,version)  # Only the local preview. Remote activation is separately verified.
    db.close()
    print(json.dumps(info,indent=2))


if __name__=='__main__':
    main()
