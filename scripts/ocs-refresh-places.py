"""Refresh public GeoNames city/postal reference points, split by country.

No supplier addresses are sent to a geocoding service. Python standard library.
"""
import io
import gzip
import json
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'ocs-atlas/data/places'
ROOT.mkdir(parents=True, exist_ok=True)

def download(url):
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()

def lines(url, filename):
    archive = zipfile.ZipFile(io.BytesIO(download(url)))
    return archive.read(filename).decode('utf-8').splitlines()

admin = {}
for line in download('https://download.geonames.org/export/dump/admin1CodesASCII.txt').decode('utf-8').splitlines():
    a = line.split('\t')
    admin[a[0]] = a[1:3]
data = defaultdict(lambda: {'cities': [], 'postal': []})
for line in lines('https://download.geonames.org/export/dump/cities500.zip', 'cities500.txt'):
    a = line.split('\t')
    aliases = list(dict.fromkeys([a[1], a[2]] + [n for n in a[3].split(',') if n.isascii() and n]))
    data[a[8]]['cities'].append([a[0], aliases, float(a[4]), float(a[5]), [a[10]] + admin.get(a[8]+'.'+a[10], [])])
for line in lines('https://download.geonames.org/export/zip/allCountries.zip', 'allCountries.txt'):
    a = line.split('\t')
    if len(a) < 12 or not a[9] or not a[10]:
        continue
    data[a[0]]['postal'].append([a[1], a[2], float(a[9]), float(a[10]), [a[3], a[4]], a[11]])
stamp = datetime.now(timezone.utc).isoformat()
manifest = {'source': 'GeoNames', 'retrievedAt': stamp, 'license': 'CC BY 4.0', 'countries': {}}
for cc, rows in sorted(data.items()):
    (ROOT / (cc+'.json.gz')).write_bytes(gzip.compress(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), mtime=0))
    manifest['countries'][cc] = {k: len(v) for k, v in rows.items()}
(ROOT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'countries': len(data), 'cities': sum(len(d['cities']) for d in data.values()), 'postal': sum(len(d['postal']) for d in data.values()), 'bytes': sum(p.stat().st_size for p in ROOT.glob('*.json'))}))
