"""Refresh public logistics directories; stdlib only, no credentials required."""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.request
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1] / 'ocs-atlas' / 'data' / 'logistics'
AIR = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
RUNWAY = 'https://davidmegginson.github.io/ourairports-data/runways.csv'
PORT = 'https://unlocode.unece.org/downloads/unlocode-latest.zip'

def get(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()

def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None

def coordinates(value):
    m = re.fullmatch(r'(\d{2})(\d{2})([NS])\s+(\d{3})(\d{2})([EW])', value.strip())
    if not m:
        return None
    a, b, ns, c, d, ew = m.groups()
    if int(b) >= 60 or int(d) >= 60:
        return None
    lat, lon = int(a) + int(b)/60, int(c) + int(d)/60
    if lat > 90 or lon > 180:
        return None
    return [round(lon * (-1 if ew == 'W' else 1), 6), round(lat * (-1 if ns == 'S' else 1), 6)]

def build():
    at = datetime.now(timezone.utc).isoformat()
    airport_bytes, runway_bytes, port_bytes = get(AIR), get(RUNWAY), get(PORT)
    runway = {}
    for r in csv.DictReader(io.StringIO(runway_bytes.decode('utf-8-sig'))):
        length = number(r.get('length_ft'))
        if r.get('closed') == '0' and length and length > runway.get(r['airport_ident'], {}).get('lengthFt', 0):
            runway[r['airport_ident']] = {'lengthFt': length, 'surface': r.get('surface', '')}
    airports = []
    for r in csv.DictReader(io.StringIO(airport_bytes.decode('utf-8-sig'))):
        lat, lon = number(r['latitude_deg']), number(r['longitude_deg'])
        point = [lon, lat] if lat is not None and lon is not None and abs(lat) <= 90 and abs(lon) <= 180 else None
        airports.append({'id': r['ident'], 'name': r['name'], 'country': r['iso_country'],
            'type': r['type'], 'point': point, 'iata': r.get('iata_code', ''),
            'icao': r.get('icao_code', ''), 'city': r.get('municipality', ''),
            'scheduled': r.get('scheduled_service', ''), 'runway': runway.get(r['ident'])})
    ports = {}
    excluded_deleted = 0
    with zipfile.ZipFile(io.BytesIO(port_bytes)) as archive:
        parts = [n for n in archive.namelist() if re.search(r'CodeListPart\d\.csv$', n)]
        if len(parts) != 3:
            raise ValueError('Unexpected UN/LOCODE archive layout; prior snapshots preserved.')
        for name in parts:
            for r in csv.reader(io.StringIO(archive.read(name).decode('utf-8-sig'))):
                if len(r) < 12 or not (r[6].startswith('1') or r[6].endswith('8')) or not r[2]:
                    continue
                if r[0].strip() == 'X' or r[7].strip() == 'XX':
                    excluded_deleted += 1
                    continue
                ident = r[1] + r[2]
                row = {'id': ident, 'name': r[3], 'country': r[1], 'type': 'maritime_location' if r[6].startswith('1') else 'inland_port_location',
                    'point': coordinates(r[10]), 'functions': r[6], 'status': r[7],
                    'sourceDate': r[8], 'remarks': r[11]}
                if ident not in ports or (row['point'] and not ports[ident]['point']):
                    ports[ident] = row
    if len(airports) < 10000 or len(ports) < 1000:
        raise ValueError('Unexpected source counts; prior snapshots preserved.')
    ROOT.mkdir(parents=True, exist_ok=True)
    datasets = {
        'airfields': {'source': 'OurAirports', 'url': AIR, 'sourcePage': 'https://ourairports.com/data/',
            'license': 'Public domain', 'version': 'Daily directory snapshot', 'sha256': hashlib.sha256(airport_bytes).hexdigest(),
            'relatedSource': RUNWAY, 'relatedSha256': hashlib.sha256(runway_bytes).hexdigest(), 'rows': airports},
        'ports': {'source': 'UNECE UN/LOCODE', 'url': PORT, 'sourcePage': 'https://unlocode.unece.org/publications/',
            'license': 'CC BY 4.0', 'version': 'Pre-release snapshot (may change before official release)',
            'sha256': hashlib.sha256(port_bytes).hexdigest(), 'excludedDeleted': excluded_deleted, 'rows': list(ports.values())}}
    for key, data in datasets.items():
        data.update(schemaVersion=1, retrievedAt=at, mapped=sum(r['point'] is not None for r in data['rows']))
        target = ROOT / (key + '.json')
        temp = target.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        temp.replace(target)
        print(key, len(data['rows']), 'records;', data['mapped'], 'with coordinates')

if __name__ == '__main__':
    build()
