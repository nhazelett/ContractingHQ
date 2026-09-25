"""Public-domain Natural Earth polygons for map navigation, not legal boundaries."""
from pathlib import Path
from datetime import datetime, timezone
import urllib.request
import json
import hashlib

root = Path(__file__).resolve().parents[1] / 'ocs-atlas/data'
url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_map_units.geojson'
with urllib.request.urlopen(url, timeout=60) as response:
    raw = response.read()
source = json.loads(raw)
countries = {c['code']: c for c in json.loads((root/'countries.json').read_text(encoding='utf-8'))}
aliases = {'KOS': 'UNK'}  # Existing atlas code for Kosovo.
features = []
unmapped = []
for f in source['features']:
    p = f['properties']
    candidates = [p.get(k) for k in ['ISO_A3_EH','ISO_A3','GU_A3','ADM0_A3']]
    code = next((aliases.get(c,c) for c in candidates if aliases.get(c,c) in countries), None)
    if not code:
        unmapped.append({'name':p.get('NAME'),'codes':candidates})
        continue
    features.append({'type':'Feature','properties':{'code':code,'name':countries[code]['name']},'geometry':f['geometry']})
mapped = {f['properties']['code'] for f in features}
missing = set(countries) - mapped
detail_url = url.replace('ne_50m_', 'ne_10m_')
with urllib.request.urlopen(detail_url, timeout=90) as response:
    detail_raw = response.read()
for f in json.loads(detail_raw)['features']:
    p = f['properties']
    candidates = [p.get(k) for k in ['ISO_A3_EH','ISO_A3','GU_A3','ADM0_A3']]
    code = next((aliases.get(c,c) for c in candidates if aliases.get(c,c) in countries), None)
    if code in missing:
        features.append({'type':'Feature','properties':{'code':code,'name':countries[code]['name']},'geometry':f['geometry']})
output = {'type':'FeatureCollection','source':'Natural Earth','sourceURL':url,'detailSourceURL':detail_url,'license':'Public domain','retrievedAt':datetime.now(timezone.utc).isoformat(),'sourceSHA256':hashlib.sha256(raw).hexdigest(),'detailSHA256':hashlib.sha256(detail_raw).hexdigest(),'note':'Generalized 1:50m map units, supplemented by 1:10m units for omitted atlas entries; navigation only. Source boundary treatment is not a sovereignty determination. Any remaining omissions retain labeled country-reference targets.','features':features}
(root/'country-boundaries.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
mapped = {f['properties']['code'] for f in features}
print(json.dumps({'features':len(features),'countriesMapped':len(mapped),'referenceTargetCountries':[c for c in countries if c not in mapped],'unmatchedSourceUnits':unmapped,'bytes':(root/'country-boundaries.json').stat().st_size},indent=2))
