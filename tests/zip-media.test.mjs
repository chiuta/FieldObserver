// Field Observer 2.2 — export ZIP (CSV Darwin Core + fotografii/audio ca fișiere). ZIP-ul e verificat independent cu `zipfile` din Python (CRC).
// Rulare: node tests/zip-media.test.mjs   (Playwright + Chromium; rețea blocată; necesită python3)
import path from 'node:path'; import fs from 'node:fs'; import os from 'node:os'; import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url'; import {createRequire} from 'node:module';
const require = createRequire(process.env.PW_ROOT || import.meta.url); const {chromium} = require('playwright');
const FILE = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const issues = [];
const ctx = await b.newContext({viewport: {width: 900, height: 800}, acceptDownloads: true, locale: 'ro-RO', timezoneId: 'Europe/Bucharest'});
await ctx.route(/^https?:/, (r) => { issues.push('REȚEA ' + r.request().url()); r.abort(); });
const p = await ctx.newPage(); p.on('pageerror', (e) => issues.push('pageerror ' + e.message)); p.on('dialog', (d) => { issues.push('dialog ' + d.message()); d.dismiss(); });
await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective)); });
await p.goto(FILE); await p.waitForTimeout(3500); await p.click('#btn-skip').catch(() => {}); await p.waitForTimeout(500);
await p.waitForFunction(() => typeof S !== 'undefined' && !!S.db, null, {timeout: 60000});
const T1 = Date.UTC(2026, 9, 20, 7, 5, 9);
// fotografie reală (canvas → JPEG) și audio sintetic (octeți arbitrari, cu parametru codecs)
const media = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 16; c.height = 12; const x = c.getContext('2d'); x.fillStyle = '#2a8'; x.fillRect(0, 0, 16, 12); x.fillStyle = '#fc0'; x.fillRect(4, 3, 6, 5); const jpg = c.toDataURL('image/jpeg', 0.9); const au = new Uint8Array(300); for (let i = 0; i < au.length; i++) au[i] = (i * 37 + 11) & 255; let s = ''; au.forEach((v) => { s += String.fromCharCode(v); }); return {jpg, audio: 'data:audio/webm;codecs=opus;base64,' + btoa(s)}; });
const recs = [
  {ts: '20261020-070509', t: T1, gps: {lat: 45.4, lon: 26.4, alt: 600, acc: 5, spd: 0}, ori: {az: 10, bt: 1, gm: 0, abs: true}, mot: {ax: 0, ay: 0, az: 9.8}, lux: 10, bat: {lvl: 0.5, chg: false}, net: {}, notes: 'cu foto și audio', photo: media.jpg, audio: media.audio},
  {ts: '20261021-101010', t: T1 + 86400000, gps: {lat: 45.5, lon: 26.5, alt: null, acc: null, spd: 0}, ori: {az: 0, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: 'doar foto', photo: media.jpg, audio: null},
  {ts: '20261022-000000', t: T1 + 2 * 86400000, gps: {lat: 45.6, lon: 26.6, alt: null, acc: null, spd: 0}, ori: {az: 0, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: 'fără media', photo: null, audio: null},
  {ts: '20261023-000000', t: T1 + 3 * 86400000, gps: {lat: 45.7, lon: 26.7, alt: null, acc: null, spd: 0}, ori: {az: 0, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: 'foto invalidă', photo: 'data:image/png;base64,@@@', audio: null}
];
await p.evaluate((recs) => new Promise((res) => { const tx = S.db.transaction('recs', 'readwrite'); recs.forEach((r) => tx.objectStore('recs').add(r)); tx.oncomplete = () => res(true); }), recs);
await p.evaluate(() => document.querySelector('[data-act="openArch"]').click()); await p.waitForTimeout(600);
t('butonul „ZIP + media” există, cu titlu care spune că nu e arhivă Darwin Core', await p.$('[data-act="expDwcZip"]') !== null && /nu e arhivă Darwin Core/i.test(await p.getAttribute('[data-act="expDwcZip"]', 'title')));
const [d] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="expDwcZip"]')]);
const name = d.suggestedFilename(), zp = path.join(os.tmpdir(), 'fo_' + process.pid + '.zip'); fs.copyFileSync(await d.path(), zp);
t('nume .zip', /^asfan_darwincore_media_.*\.zip$/.test(name), name);
const py = `
import zipfile,sys,json,base64,hashlib
z=zipfile.ZipFile(sys.argv[1]); bad=z.testzip()
out={'bad':bad,'names':z.namelist(),'sizes':{n:z.getinfo(n).file_size for n in z.namelist()},'compress':sorted({z.getinfo(n).compress_type for n in z.namelist()})}
out['csv']=z.read('occurrence.csv').decode('utf-8'); out['readme']=z.read('LEAME-README.txt').decode('utf-8')
out['sha']={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('media/')}
print(json.dumps(out))`;
const Z = JSON.parse(execFileSync('python3', ['-I', '-c', py, zp], {encoding: 'utf-8'}));
t('ZIP valid: CRC-urile trec testul Python (testzip)', Z.bad === null, Z.bad);
t('fără compresie (store)', JSON.stringify(Z.compress) === '[0]', Z.compress);
const media1 = Z.names.filter((n) => n.startsWith('media/'));
t('3 fișiere media: 2 foto + 1 audio (fotografia invalidă și rândurile fără media nu produc fișiere)', media1.length === 3 && media1.filter((n) => /\.jpg$/.test(n)).length === 2 && media1.filter((n) => /_audio\.webm$/.test(n)).length === 1, media1);
const sha = async (s) => p.evaluate(async (s) => { const bin = atob(s.split(',')[1]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const h = await crypto.subtle.digest('SHA-256', u); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''); }, s);
const shaJ = await sha(media.jpg), shaA = await sha(media.audio);
t('octeții fotografiei din ZIP = cei din IndexedDB (SHA-256)', Object.entries(Z.sha).filter(([n]) => n.endsWith('.jpg')).every(([, h]) => h === shaJ));
t('octeții audio din ZIP = cei din IndexedDB (SHA-256)', Object.entries(Z.sha).filter(([n]) => n.endsWith('.webm')).every(([, h]) => h === shaA));
const lines = Z.csv.split('\r\n').filter(Boolean);
t('occurrence.csv: antet Darwin Core + 4 rânduri, fără BOM', lines.length === 5 && Z.csv.charCodeAt(0) !== 0xFEFF && lines[0].startsWith('occurrenceID,basisOfRecord'), lines.length);
const am = (ln) => { const m = /^urn:fieldobserver:[^,]*/.exec(ln); return m ? ln : ''; };
const withBoth = lines.find((l) => /cu foto și audio/.test(l)), photoOnly = lines.find((l) => /doar foto/.test(l)), none = lines.find((l) => /fără media/.test(l)), badP = lines.find((l) => /foto invalidă/.test(l));
t('associatedMedia: două căi relative separate prin " | " pentru foto+audio', /"?media\/[^",|]+\.jpg \| media\/[^",|]+_audio\.webm"?/.test(withBoth), withBoth);
t('associatedMedia: o cale pentru doar foto; gol pentru fără media și pentru foto invalidă', /"?media\/[^",|]+\.jpg"?(,|$)/m.test(photoOnly) && !/media\//.test(none) && !/media\//.test(badP), [photoOnly, none, badP]);
t('căile din CSV există toate în ZIP', [...Z.csv.matchAll(/media\/[A-Za-z0-9._-]+/g)].every((m) => Z.names.includes(m[0])));
t('LEAME-README.txt în RO + EN, spune că NU e arhivă Darwin Core și nu a fost testat la GBIF', /NU este o arhivă Darwin Core/.test(Z.readme) && /NOT a Darwin Core Archive/.test(Z.readme) && /GBIF/.test(Z.readme));
t('scientificName gol (aplicația nu captează specia)', lines.slice(1).every((l) => !/,[A-Z][a-z]+ [a-z]+,/.test(l)));
await p.waitForTimeout(300);
t('toast cu numărul de rânduri și de fișiere', /ZIP: 4 rânduri, 3 fișiere media/.test(await p.evaluate(() => document.body.innerText)));
t('CSV-ul simplu Darwin Core NU conține media (comportament neschimbat)', await (async () => { const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="expDwc"]')]); const txt = fs.readFileSync(await d2.path(), 'utf8'); return !/media\//.test(txt); })());
t('fără cereri de rețea, dialoguri, erori JS sau încălcări CSP', issues.length === 0 && (await p.evaluate(() => window.__csp)).length === 0, issues);
fs.unlinkSync(zp); await b.close(); console.log(`${ok} reușite, ${bad} eșuate`); process.exit(bad ? 1 : 0);
