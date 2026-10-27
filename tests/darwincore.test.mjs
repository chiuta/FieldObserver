// Field Observer 2.1 — export Darwin Core (GBIF) și CSV pentru iNaturalist.
// Rulare: node tests/darwincore.test.mjs   (Playwright din /opt/node-tools, Chromium din /opt/pw-browsers; rețea blocată)
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const FILE = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let ok = 0, bad = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const issues = [];
const ctx = await b.newContext({viewport: {width: 900, height: 800}, acceptDownloads: true, locale: 'ro-RO', timezoneId: 'Europe/Bucharest'});
await ctx.route(/^https?:/, (r) => { issues.push('REȚEA ' + r.request().url()); r.abort(); });
const p = await ctx.newPage();
p.on('pageerror', (e) => issues.push('pageerror ' + e.message)); p.on('dialog', (d) => { issues.push('dialog ' + d.message()); d.dismiss(); });
await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective)); });
await p.goto(FILE); await p.waitForFunction(() => document.getElementById('btn-skip') !== null, null, {timeout: 20000}).catch(() => {});
await p.waitForTimeout(3500); await p.click('#btn-skip').catch(() => {}); await p.waitForTimeout(500);
await p.waitForFunction(() => typeof S !== 'undefined' && !!S.db, null, {timeout: 10000});

// parser CSV minimal (RFC 4180, ghilimele duble)
function parse(txt) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r') { /* ignoră */ } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const T1 = Date.UTC(2026, 9, 20, 7, 5, 9);   // 2026-10-20T07:05:09Z
const recs = [
  {ts: '20261020-070509', t: T1, gps: {lat: 45.401234567, lon: 26.4, alt: 612.4, acc: 6.4, spd: 0}, ori: {az: 370, bt: 12.34, gm: 0, abs: true}, mot: {ax: 0, ay: 0, az: 9.8}, lux: 180.6, bat: {lvl: 0.77, chg: false}, net: {}, notes: 'Urs, "pe" potecă; 2 pui\nlinia 2', photo: 'data:image/jpeg;base64,AAAA', audio: null},
  {ts: '20261021-101010', t: T1 + 86400000, gps: {lat: -12.5, lon: -70.25, alt: null, acc: null, spd: 0}, ori: {az: 10, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 9.8}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: '=HYPERLINK("http://x","clic")', photo: null, audio: null},
  {ts: '20261022-000000', gps: {lat: null, lon: null, alt: null, acc: null, spd: null}, ori: {az: 0, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: '+5 pasări', photo: null, audio: null},
  {ts: '20261023-000000', t: T1 + 3 * 86400000, gps: {lat: 95, lon: 200, alt: null, acc: null, spd: null}, ori: {az: 0, bt: 0, gm: 0, abs: false}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {lvl: null, chg: false}, net: {}, notes: '', photo: null, audio: null}
];
await p.evaluate((recs) => new Promise((res) => { const tx = S.db.transaction('recs', 'readwrite'); recs.forEach((r) => tx.objectStore('recs').add(r)); tx.oncomplete = () => res(true); }), recs);
await p.evaluate(() => document.querySelector('[data-act="openArch"]').click()); await p.waitForTimeout(600);
const dl = async (act) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="' + act + '"]')]); return {name: d.suggestedFilename(), txt: fs.readFileSync(await d.path(), 'utf8')}; };

console.log('--- Darwin Core');
t('butoanele există, cu titluri', await p.$('[data-act="expDwc"]') !== null && await p.$('[data-act="expInat"]') !== null && /Darwin Core/.test(await p.getAttribute('[data-act="expDwc"]', 'title')));
const d = await dl('expDwc'); const R = parse(d.txt); const H = R[0]; const col = (r, n) => r[H.indexOf(n)];
t('nume de fișier .csv darwincore', /^asfan_darwincore_.*\.csv$/.test(d.name), d.name);
t('fără BOM, CRLF', d.txt.charCodeAt(0) !== 0xFEFF && /\r\n/.test(d.txt));
t('antet = termeni Darwin Core standard', ['occurrenceID', 'basisOfRecord', 'eventDate', 'decimalLatitude', 'decimalLongitude', 'geodeticDatum', 'coordinateUncertaintyInMeters', 'scientificName', 'occurrenceRemarks'].every((x) => H.includes(x)), H);
t('4 rânduri de date + antet; fiecare cu același număr de coloane', R.length === 5 && R.every((r) => r.length === H.length), R.map((r) => r.length));
const r1 = R.find((r) => col(r, 'eventDate') === '2026-10-20T07:05:09Z');
t('eventDate ISO 8601 UTC din t', !!r1);
t('basisOfRecord = HumanObservation, geodeticDatum = EPSG:4326', col(r1, 'basisOfRecord') === 'HumanObservation' && col(r1, 'geodeticDatum') === 'EPSG:4326');
t('coordonate zecimale, 6 zecimale', col(r1, 'decimalLatitude') === '45.401235' && col(r1, 'decimalLongitude') === '26.400000', [col(r1, 'decimalLatitude'), col(r1, 'decimalLongitude')]);
t('incertitudine = acuratețea GPS rotunjită; altitudine rotunjită', col(r1, 'coordinateUncertaintyInMeters') === '6' && col(r1, 'minimumElevationInMeters') === '612' && col(r1, 'maximumElevationInMeters') === '612');
t('notă cu virgulă, ghilimele și rând nou păstrată corect', col(r1, 'occurrenceRemarks') === 'Urs, "pe" potecă; 2 pui\nlinia 2', col(r1, 'occurrenceRemarks'));
t('scientificName gol (aplicația nu captează specia)', col(r1, 'scientificName') === '' && col(r1, 'associatedMedia') === '');
const dp = JSON.parse(col(r1, 'dynamicProperties'));
t('dynamicProperties JSON: azimut normalizat, elevație, lux, baterie, foto semnalată', dp.azimuthDeg === 10 && dp.elevationAngleDeg === 12.3 && dp.lux === 181 && dp.batteryPct === 77 && dp.photoInApp === true, dp);
t('fotografia NU este în CSV', !/base64|data:image/.test(d.txt));
const r2 = R.find((r) => col(r, 'decimalLatitude') === '-12.500000');
t('coordonate negative rămân numere (fără prefix)', !!r2 && col(r2, 'decimalLongitude') === '-70.250000');
t('formulă în notă neutralizată (apostrof)', col(r2, 'occurrenceRemarks').startsWith("'=HYPERLINK"), col(r2, 'occurrenceRemarks'));
const r3 = R.find((r) => /pasări/.test(col(r, 'occurrenceRemarks')));
t('„+5 pasări” neutralizat; raport fără t: eventDate din ts', col(r3, 'occurrenceRemarks') === "'+5 pasări" && col(r3, 'eventDate') === '2026-10-22T00:00:00Z', [col(r3, 'occurrenceRemarks'), col(r3, 'eventDate')]);
t('raport fără GPS: coordonate goale, fără datum', col(r3, 'decimalLatitude') === '' && col(r3, 'geodeticDatum') === '');
const r4 = R.find((r) => col(r, 'eventDate') === '2026-10-23T07:05:09Z');
t('coordonate invalide (95/200) nu sunt exportate', col(r4, 'decimalLatitude') === '' && col(r4, 'decimalLongitude') === '');
t('occurrenceID unice, cu prefix urn:fieldobserver:', new Set(R.slice(1).map((r) => col(r, 'occurrenceID'))).size === 4 && R.slice(1).every((r) => /^urn:fieldobserver:/.test(col(r, 'occurrenceID'))));
t('ordine cronologică', R.slice(1).map((r) => col(r, 'eventDate')).join() === ['2026-10-20T07:05:09Z', '2026-10-21T07:05:09Z', '2026-10-22T00:00:00Z', '2026-10-23T07:05:09Z'].join());
t('toast cu numărul de rânduri și de coordonate', /4 rânduri \(2 cu coordonate\)/.test(await p.textContent('#ts').catch(() => '') || ''), await p.textContent('#ts').catch(() => ''));

console.log('--- iNaturalist');
const n = await dl('expInat'); const N = parse(n.txt);
t('nume de fișier', /^asfan_inaturalist_.*\.csv$/.test(n.name), n.name);
t('exact 8 coloane pe rând, în ordinea iNaturalist', N.length === 5 && N.every((r) => r.length === 8) && N[0].join() === 'Taxon name,Date observed,Description,Place name,Latitude,Longitude,Tags,Geoprivacy', N[0]);
t('Taxon name gol; Tags = fieldobserver', N.slice(1).every((r) => r[0] === '' && r[6] === 'fieldobserver'));
t('data cu decalaj orar local (Europe/Bucharest = +03:00 în 20 oct 2026)', N[1][1] === '2026-10-20T10:05:09+03:00', N[1][1]);
t('lat/lon și descriere (cu neutralizare)', N[1][4] === '45.401235' && N[1][5] === '26.400000' && N[2][2].startsWith("'=") && N[3][2] === "'+5 pasări");

console.log('--- generale');
const empty = await p.evaluate(() => new Promise((res) => { const tx = S.db.transaction('recs', 'readwrite'); tx.objectStore('recs').clear(); tx.oncomplete = () => res(true); }));
let dlFired = false; p.once('download', () => { dlFired = true; });
await p.click('[data-act="expDwc"]'); await p.waitForTimeout(500);
t('arhivă goală: niciun fișier descărcat', !dlFired);
t('0 cereri de rețea, 0 erori, 0 încălcări CSP', issues.length === 0 && (await p.evaluate(() => window.__csp)).length === 0, issues);
await b.close();
console.log(`\nFieldObserver darwincore: ${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
