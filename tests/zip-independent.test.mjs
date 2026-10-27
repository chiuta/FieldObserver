// Field Observer: ZIP „ZIP + media” produs de codul aplicației, verificat cu un parser INDEPENDENT (Python: zipfile, csv, hashlib; Info-ZIP `unzip -t`).
// Datele sunt SINTETICE (fotografii desenate pe canvas, audio = octeți aleatorii cu tip MIME declarat). Nu s-a testat cu GBIF și nu s-a adăugat meta.xml (vezi tests/fixtures/README.md).
// Rulare: node tests/zip-independent.test.mjs   (WRITE_FIXTURE=1 rescrie tests/fixtures/app-generated-zip-media.zip)
import path from 'node:path'; import fs from 'node:fs'; import os from 'node:os'; import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url'; import {createRequire} from 'node:module';
const require = createRequire(process.env.PW_ROOT || import.meta.url); const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), FILE = 'file://' + path.join(HERE, '..', 'index.html'), VERIFY = path.join(HERE, 'verify_zip.py');
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 600) : '')); } };
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const issues = [];
const ctx = await b.newContext({viewport: {width: 900, height: 800}, acceptDownloads: true, locale: 'ro-RO', timezoneId: 'Europe/Bucharest'});
await ctx.route(/^https?:/, (r) => { issues.push('REȚEA ' + r.request().url()); r.abort(); });
const p = await ctx.newPage(); p.on('pageerror', (e) => issues.push('pageerror ' + e.message)); p.on('dialog', (d) => { issues.push('dialog ' + d.message()); d.dismiss(); });
await p.goto(FILE); await p.waitForTimeout(3500); await p.click('#btn-skip').catch(() => {}); await p.waitForTimeout(500);
await p.waitForFunction(() => typeof S !== 'undefined' && !!S.db, null, {timeout: 60000});
const verify = (zp) => JSON.parse(execFileSync('python3', ['-I', VERIFY, zp], {encoding: 'utf-8', maxBuffer: 1 << 28}));
async function exportZip() {
  await p.evaluate(() => document.querySelector('[data-act="openArch"]').click()); await p.waitForTimeout(500);
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="expDwcZip"]')]);
  const zp = path.join(os.tmpdir(), 'fo_ind_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.zip'); fs.copyFileSync(await d.path(), zp); return zp;
}
const reset = () => p.evaluate(() => new Promise((res) => { const tx = S.db.transaction('recs', 'readwrite'); tx.objectStore('recs').clear(); tx.oncomplete = () => res(true); }));
// construiește rândurile în pagină; întoarce SHA-256 așteptat per etichetă
const seed = (spec) => p.evaluate(async (spec) => {
  const sha = async (u) => { const bin = atob(u.split(',')[1]); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', a))].map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const img = (type, w, h, seedN) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${seedN * 37 % 360},70%,50%)`); g.addColorStop(1, '#222'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${(i * 53 + seedN) % 255},${(i * 97) % 255},${(i * 29) % 255},.6)`; x.fillRect((i * 31 + seedN * 7) % w, (i * 17 + seedN * 3) % h, 6, 6); } return c.toDataURL(type, 0.85); };
  const aud = (mime, n, seedN) => { const a = new Uint8Array(n); let s = seedN * 2654435761 >>> 0; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; a[i] = s >>> 24; } let bin = ''; for (let i = 0; i < n; i += 8192) bin += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return 'data:' + mime + ';base64,' + btoa(bin); };
  const T0 = Date.UTC(2026, 9, 20, 7, 0, 0), exp = [];
  const recs = spec.map((s, i) => {
    const photo = s.photo ? img(s.photo[0], s.photo[1], s.photo[2], i) : null, audio = s.audio ? aud(s.audio[0], s.audio[1], i) : null;
    const r = {ts: s.ts != null ? s.ts : '20261020-07' + String(i % 60).padStart(2, '0') + '00', t: s.noT ? null : (s.t != null ? s.t : T0 + i * 61000), gps: s.nogps ? {lat: null, lon: null, alt: null, acc: null, spd: 0} : {lat: 45.4 + i / 1000, lon: 26.4 - i / 1000, alt: 600 + i, acc: 5, spd: 0},
      ori: {az: 10, bt: 1, gm: 0, abs: true}, mot: {ax: 0, ay: 0, az: 9.8}, lux: 10, bat: {lvl: 0.5, chg: false}, net: {}, notes: s.notes, photo, audio};
    exp.push({label: s.label, photo: photo ? photo : null, audio: audio ? audio : null}); return r;
  });
  const shas = []; for (const e of exp) shas.push({label: e.label, photo: e.photo ? await sha(e.photo) : null, audio: e.audio ? await sha(e.audio) : null});
  await new Promise((res) => { const tx = S.db.transaction('recs', 'readwrite'); recs.forEach((r) => tx.objectStore('recs').add(r)); tx.oncomplete = () => res(true); });
  return shas;
}, spec);

/* ===== A) fixture mic, generat de aplicație ===== */
await reset();
const specA = [
  {label: 'a1', notes: 'foto și audio', photo: ['image/jpeg', 64, 48], audio: ['audio/webm;codecs=opus', 3000]},
  {label: 'a2', notes: 'doar png', photo: ['image/png', 32, 24]},
  {label: 'a3', notes: 'fără media'},
  {label: 'a4', notes: 'virgulă, "ghilimele" și\nlinie nouă, ăâîșț', photo: ['image/webp', 40, 30]},
  {label: 'a5', notes: '=HYPERLINK("http://exemplu.invalid")', nogps: true},
  {label: 'a6', notes: 'audio mp4', audio: ['audio/mp4', 2000]},
];
const shaA = await seed(specA);
const zpA = await exportZip();
const fixPath = path.join(HERE, 'fixtures', 'app-generated-zip-media.zip');
if (process.env.WRITE_FIXTURE) { fs.copyFileSync(zpA, fixPath); console.log('  (fixture rescris: ' + fixPath + ')'); }
const checkZip = (V, label) => {
  t(label + ': zipfile.testzip() → CRC-urile trec', V.testzip === null, V.testzip);
  t(label + ': fără nume duplicate, fără coliziuni de majuscule/minuscule, fără căi nesigure', V.dup_names.length === 0 && V.case_collisions.length === 0 && V.unsafe_names.length === 0, [V.dup_names, V.case_collisions, V.unsafe_names]);
  t(label + ': EOCD/director central coerente, antete locale la offset-urile din director, dimensiuni egale (store)', V.eocd.entries === V.names.length && V.eocd.cd_end_matches && V.local_hdr_ok && V.sizes_ok && JSON.stringify(V.compress_types) === '[0]', [V.eocd, V.local_hdr_ok, V.sizes_ok]);
  t(label + ': CSV UTF-8 fără BOM, CRLF, același număr de câmpuri pe toate rândurile', !V.csv_bom && V.csv_crlf_only && V.ragged.length === 0, [V.csv_bom, V.ragged]);
  t(label + ': toate coloanele antetului sunt termeni Darwin Core; JSON dynamicProperties valid; coordonate/date valide', V.header_not_dwc.length === 0 && V.dynprops_json_ok && V.lat_lon_ok && V.dates_ok, [V.header_not_dwc, V.dynprops_json_ok, V.lat_lon_ok, V.dates_ok]);
  t(label + ': căile din associatedMedia există toate în ZIP; fără fișiere orfane; fără referințe duplicate', V.missing_refs.length === 0 && V.orphans.length === 0 && V.dup_refs.length === 0, [V.missing_refs, V.orphans, V.dup_refs]);
  t(label + ': occurrenceID unice', V.dup_ids.length === 0, V.dup_ids);
};
const VA = verify(zpA); checkZip(VA, 'A (app)');
const exp = (V, shas, specs) => { // potrivește pe rând (CSV sortat după timp = ordinea de inserare în A) → SHA-256 așteptat
  const bad = []; V.refs.forEach((refs, i) => { const e = shas[i], names = refs; const jp = names.find((n) => !/_audio\./.test(n)), au = names.find((n) => /_audio\./.test(n));
    if ((e.photo ? 1 : 0) !== (jp ? 1 : 0) || (e.audio ? 1 : 0) !== (au ? 1 : 0)) bad.push(['prezență', i, e.label, names]); else { if (jp && V.sha[jp] !== e.photo) bad.push(['sha foto', i, e.label]); if (au && V.sha[au] !== e.audio) bad.push(['sha audio', i, e.label]); } });
  return bad; };
t('A: SHA-256 media din ZIP = octeții din IndexedDB, pe fiecare rând, și prezența corectă', JSON.stringify(exp(VA, shaA)) === '[]', exp(VA, shaA));
t('A: notele cu virgulă, ghilimele, linie nouă și diacritice rămân identice la citirea cu modulul csv', VA.notes[3] === 'virgulă, "ghilimele" și\nlinie nouă, ăâîșț', VA.notes[3]);
t('A: formula din note este neutralizată (nu începe cu „=”)', !/^[=+\-@]/.test(VA.notes[4]) && /HYPERLINK/.test(VA.notes[4]), VA.notes[4]);
const un = spawnSync('unzip', ['-t', zpA], {encoding: 'utf-8'}); t('A: Info-ZIP `unzip -t` → „No errors detected”', /No errors detected/.test(un.stdout) && un.status === 0, un.stdout.slice(-200) + un.stderr);
if (fs.existsSync(fixPath)) { const VF = verify(fixPath); checkZip(VF, 'fixture salvat'); const u2 = spawnSync('unzip', ['-t', fixPath], {encoding: 'utf-8'}); t('fixture salvat: `unzip -t` fără erori', /No errors detected/.test(u2.stdout)); }
fs.unlinkSync(zpA);

/* ===== B) stres: multe rânduri, media mari, coliziuni de nume ===== */
await reset();
const specB = [];
for (let i = 0; i < 40; i++) specB.push({label: 'b' + i, notes: i % 7 === 0 ? 'x'.repeat(1500) + ',"' + i : 'rând ' + i + '; ț', photo: i % 3 === 0 ? ['image/jpeg', 640, 480] : i % 3 === 1 ? ['image/png', 120, 90] : null, audio: i % 5 === 0 ? [['audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'][i / 5 % 4 | 0], 80000 + i * 1000] : null});
// același moment (t identic) pentru două rânduri → ID cu sufix; ts diferite doar prin punctuație / majuscule fără t numeric → coliziune la numele de fișier?
specB.push({label: 'same-t-1', notes: 'același t 1', t: 1760943909000, photo: ['image/png', 20, 20]}, {label: 'same-t-2', notes: 'același t 2', t: 1760943909000, photo: ['image/png', 24, 20]});
specB.push({label: 'col-colon', notes: 'ts cu două puncte', ts: 'x:1', noT: true, photo: ['image/png', 20, 21]}, {label: 'col-under', notes: 'ts cu subliniere', ts: 'x_1', noT: true, photo: ['image/png', 20, 22]});
specB.push({label: 'case-up', notes: 'majuscule', ts: 'CASE-1', noT: true, photo: ['image/png', 20, 23]}, {label: 'case-lo', notes: 'minuscule', ts: 'case-1', noT: true, photo: ['image/png', 20, 24]});
const shaB = await seed(specB);
const zpB = await exportZip(); const VB = verify(zpB);
t('B: 46 de rânduri exportate', VB.nrows === specB.length, VB.nrows);
checkZip(VB, 'B (stres)');
{ const byNote = new Map(specB.map((sp, i) => [sp.notes, shaB[i]])); const bad = [];
  VB.notes.forEach((nt, i) => { const e = byNote.get(nt); if (!e) { bad.push(['notă necunoscută', i]); return; } const refs = VB.refs[i], jp = refs.find((n) => !/_audio\./.test(n)), au = refs.find((n) => /_audio\./.test(n));
    if ((e.photo ? 1 : 0) !== (jp ? 1 : 0) || (e.audio ? 1 : 0) !== (au ? 1 : 0)) bad.push(['prezență', e.label]); else { if (jp && VB.sha[jp] !== e.photo) bad.push(['sha foto', e.label, jp]); if (au && VB.sha[au] !== e.audio) bad.push(['sha audio', e.label, au]); } });
  t('B: fiecare rând (identificat după notă) are exact fotografia și audio-ul lui (SHA-256), inclusiv rândurile cu nume care coliziona', bad.length === 0, bad); }
t('B: rândurile cu ID-uri „x:1” / „x_1” și „CASE-1” / „case-1” au fișiere distincte', ['ts cu două puncte', 'ts cu subliniere', 'majuscule', 'minuscule'].every((nt) => { const i = VB.notes.indexOf(nt); return i >= 0 && VB.refs[i].length === 1; }) && new Set(VB.names.map((n) => n.toLowerCase())).size === VB.names.length);
fs.unlinkSync(zpB);
t('fără cereri de rețea, dialoguri sau erori JS', issues.length === 0, issues);
await b.close(); console.log(`${ok} reușite, ${bad} eșuate`); process.exit(bad ? 1 : 0);
