#!/usr/bin/env python3
"""Verificator INDEPENDENT (doar biblioteca standard Python: zipfile, csv, hashlib) pentru ZIP-ul „ZIP + media” din Field Observer.
Uz:  python3 -I tests/verify_zip.py <fișier.zip> [expected.json]   → JSON pe stdout (nu iese cu cod ≠ 0 la constatări; le raportează)
expected.json (opțional): {"media": {"<rând-cheie>": "<sha256>"}, "notes": [...]} folosit doar de test."""
import sys, zipfile, csv, io, json, hashlib, re, struct
DWC = {'occurrenceID','basisOfRecord','occurrenceStatus','eventDate','decimalLatitude','decimalLongitude','geodeticDatum','coordinateUncertaintyInMeters',
       'minimumElevationInMeters','maximumElevationInMeters','scientificName','recordedBy','occurrenceRemarks','associatedMedia','datasetName','dynamicProperties'}  # termeni Darwin Core (dwc.tdwg.org/list)
path = sys.argv[1]
raw = open(path, 'rb').read()
out = {'findings': []}
z = zipfile.ZipFile(io.BytesIO(raw))
out['testzip'] = z.testzip()
names = z.namelist(); out['names'] = names
out['dup_names'] = sorted({n for n in names if names.count(n) > 1})
low = [n.lower() for n in names]; out['case_collisions'] = sorted({n for n, l in zip(names, low) if low.count(l) > 1 and names.count(n) == 1})
out['unsafe_names'] = [n for n in names if n.startswith('/') or '..' in n.split('/') or '\\' in n or re.search(r'[\x00-\x1f]', n)]
out['compress_types'] = sorted({i.compress_type for i in z.infolist()})
out['flags'] = sorted({i.flag_bits for i in z.infolist()})
# structură: EOCD, număr de intrări, offset-uri locale = offset din directorul central
eocd = raw.rfind(b'PK\x05\x06'); n_ent, cd_size, cd_off = struct.unpack('<HII', raw[eocd + 10:eocd + 20]) if eocd >= 0 else (None, None, None)
out['eocd'] = {'entries': n_ent, 'cd_size': cd_size, 'cd_off': cd_off, 'cd_end_matches': eocd >= 0 and cd_off + cd_size == eocd}
out['local_hdr_ok'] = all(raw[i.header_offset:i.header_offset + 4] == b'PK\x03\x04' for i in z.infolist())
out['sizes_ok'] = all(i.file_size == i.compress_size for i in z.infolist() if i.compress_type == 0)
text = z.read('occurrence.csv').decode('utf-8')
out['csv_bom'] = text.startswith('\ufeff'); out['csv_crlf_only'] = text.endswith('\r\n') and text.count('\r\n') >= len(list(csv.reader(io.StringIO(text, newline=''))))
rows = list(csv.reader(io.StringIO(text, newline='')))
hdr = rows[0]; out['header'] = hdr; out['nrows'] = len(rows) - 1
out['header_not_dwc'] = [h for h in hdr if h not in DWC]
out['ragged'] = [i for i, r in enumerate(rows) if len(r) != len(hdr)]
ci = {h: i for i, h in enumerate(hdr)}
out['ids'] = [r[ci['occurrenceID']] for r in rows[1:]]; out['dup_ids'] = sorted({x for x in out['ids'] if out['ids'].count(x) > 1})
refs = []
for r in rows[1:]:
    v = r[ci['associatedMedia']]
    refs.append([p for p in v.split(' | ')] if v else [])
out['refs'] = refs
flat = [p for l in refs for p in l]
out['missing_refs'] = [p for p in flat if p not in names]; out['dup_refs'] = sorted({p for p in flat if flat.count(p) > 1})
out['orphans'] = [n for n in names if n.startswith('media/') and n not in flat]
out['sha'] = {n: hashlib.sha256(z.read(n)).hexdigest() for n in names if n.startswith('media/')}
out['notes'] = [r[ci['occurrenceRemarks']] for r in rows[1:]]
out['dynprops_json_ok'] = all((not r[ci['dynamicProperties']]) or isinstance(json.loads(r[ci['dynamicProperties']]), dict) for r in rows[1:])
out['lat_lon_ok'] = all(((r[ci['decimalLatitude']] == '') == (r[ci['decimalLongitude']] == '')) and (r[ci['decimalLatitude']] == '' or (-90 <= float(r[ci['decimalLatitude']]) <= 90 and -180 <= float(r[ci['decimalLongitude']]) <= 180)) for r in rows[1:])
out['dates_ok'] = all(re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', r[ci['eventDate']]) or r[ci['eventDate']] == '' for r in rows[1:])
out['readme_head'] = z.read('LEAME-README.txt').decode('utf-8')[:80]
print(json.dumps(out, ensure_ascii=False))
