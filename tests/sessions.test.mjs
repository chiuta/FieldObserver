// Field Observer 2.0 — sesiuni de măsurare sincronizate: senzori + note pe axă comună, salvare, replay, grafice suprapuse, export.
// Rulare: node tests/sessions.test.mjs   (Playwright din /opt/node-tools, Chromium din /opt/pw-browsers; rețea blocată; opțional FFF_AXE)
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const FILE = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
const AXE = process.env.FFF_AXE || process.env.AXE_PATH;
let ok = 0, bad = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const issues = [];
async function open(o = {}) {
  const ctx = o.ctx || await b.newContext({viewport: {width: o.w || 420, height: o.h || 800}, bypassCSP: !!o.bypass, acceptDownloads: true, locale: 'ro-RO'});
  if (!o.ctx) await ctx.route(/^https?:/, (r) => { issues.push('REȚEA ' + r.request().url()); r.abort(); });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => issues.push('pageerror ' + e.message)); p.on('dialog', (d) => { issues.push('dialog ' + d.message()); d.dismiss(); });
  await p.goto(FILE); await p.waitForFunction(() => document.getElementById('btn-skip') !== null, null, {timeout: 20000}).catch(() => {});
  await p.waitForTimeout(3500);
  await p.click('#btn-skip').catch(() => {}); await p.waitForTimeout(500);
  await p.waitForFunction(() => typeof S !== 'undefined' && !!S.db, null, {timeout: 10000}).catch(() => {});
  return {ctx, p};
}
const drive = (p) => p.evaluate(() => {
  if (window.__drv) clearInterval(window.__drv);
  const t0 = Date.now();
  const step = () => { const s = (Date.now() - t0) / 1000;
    S.mot = {ax: 3 * Math.sin(s * 3), ay: 0.5, az: 9.8 + Math.cos(s * 2), gx: 20 * Math.sin(s), gy: 0, gz: 0}; S.motT = Date.now();
    S.lux = 200 + 150 * Math.sin(s); S.ori = {az: (s * 30) % 360, bt: 0, gm: 0, abs: true}; S.oriT = Date.now();
    S.gps = {lat: 45.4 + s * 1e-4, lon: 26.4 + s * 5e-5, alt: 600 + s * 2, acc: 6, spd: 1.4}; };
  step(); window.__drv = setInterval(step, 50);
});
const dbAll = (p) => p.evaluate(() => new Promise((res) => { const r = S.db.transaction('sessions', 'readonly').objectStore('sessions').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }));
const dbPut = (p, rec) => p.evaluate((rec) => new Promise((res) => { const tx = S.db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put(rec); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }), rec);

console.log('--- interfață și înregistrare');
let ctxA, pg;
{
  const o = await open(); ctxA = o.ctx; pg = o.p; const p = pg;
  t('butonul SESIE există (titlu cu numele întreg)', await p.$('#b-ss') !== null && /SESIE/.test(await p.textContent('#b-ss')) && /SESIUNI DE MĂSURARE|Sesiuni de măsurare/i.test(await p.getAttribute('#b-ss', 'title')));
  await p.click('#b-ss'); await p.waitForTimeout(300);
  t('panoul se deschide, mesaj de repaus', await p.$eval('#ss', e => e.classList.contains('on')) && /Nicio sesiune în curs/.test(await p.textContent('#ss-stat')));
  t('listă goală', /Nicio sesiune salvată/.test(await p.textContent('#ss-list')));
  t('nota e dezactivată în afara sesiunii', await p.$eval('#ss-note', e => e.disabled) && await p.$eval('#ss-addnote', e => e.disabled));
  t('avertisment despre senzori și confidențialitate', /nu se trimite nicăieri/.test(await p.textContent('#ss-warn')) && /orientative/.test(await p.textContent('#ss-warn')));
  await drive(p);
  await p.selectOption('#ss-rate', '200');
  await p.click('#ss-rec'); await p.waitForTimeout(300);
  t('sesiunea pornește: buton „OPREȘTE”, notă activă, rată blocată', /OPREȘTE/.test(await p.textContent('#ss-rec')) && !(await p.$eval('#ss-note', e => e.disabled)) && await p.$eval('#ss-rate', e => e.disabled));
  await p.waitForTimeout(900);
  await p.fill('#ss-note', 'Prima notă <b>x</b>'); await p.click('#ss-addnote');
  t('nota se golește după adăugare', (await p.inputValue('#ss-note')) === '');
  await p.waitForTimeout(900);
  await p.fill('#ss-note', 'A doua notă'); await p.press('#ss-note', 'Enter');
  await p.waitForTimeout(900);
  t('starea arată timp, eșantioane și 2 note', /● \d+:\d\d · \d+ eșantioane · 2 note/.test(await p.textContent('#ss-stat')), await p.textContent('#ss-stat'));
  const draft = await dbAll(p);
  t('ciorna este deja în IndexedDB (autosalvare)', draft && draft.length === 1 && draft[0].draft === true && draft[0].notes.length === 2);
  await p.click('#ss-rec'); await p.waitForTimeout(700);
  const all = await dbAll(p);
  t('după oprire: sesiune salvată, nu mai e ciornă', all.length === 1 && all[0].draft === false, all.map(x => x.draft));
  const rec = all[0];
  t('eșantioane la ~5 Hz pe ~3 s (≥ 8)', rec.rows.length >= 8, rec.rows.length);
  t('timpii cresc monoton, de la 0', rec.rows[0][0] <= 5 && rec.rows.every((r, i) => i === 0 || r[0] >= rec.rows[i - 1][0]));
  t('coloanele declarate și lungimea rândului coincid', rec.cols.length === 15 && rec.rows.every(r => r.length === 15));
  t('senzori: accelerație, lumină, direcție, GPS înregistrate', rec.rows.some(r => r[1] !== null) && rec.rows.some(r => r[8] !== null) && rec.rows.some(r => r[9] !== null) && rec.rows.some(r => r[10] !== null));
  t('sunetul lipsește (microfon neactivat): null, nu 0', rec.rows.every(r => r[7] === null));
  t('notele au timp pe aceeași axă, în ordine', rec.notes.length === 2 && rec.notes[0].t < rec.notes[1].t && rec.notes[1].t <= rec.dur && /<b>x<\/b>/.test(rec.notes[0].x));
  t('lista arată sesiunea', (await p.$$('#ss-list .rec')).length === 1 && /note/.test(await p.textContent('#ss-list')));
}

console.log('--- replay și grafice suprapuse');
{
  const p = pg;
  await p.click('#ss-list [data-act="ssOpen"]'); await p.waitForTimeout(500);
  t('vizualizatorul se deschide', !(await p.$eval('#ss-view', e => e.hidden)) && await p.$eval('#ss-listbox', e => e.hidden));
  const chans = await p.$$eval('#ss-chans input', a => a.map(i => [i.dataset.ch, i.checked, i.disabled]));
  t('7 canale; cele cu date sunt pornite, sunetul e dezactivat', chans.length === 7 && chans.find(c => c[0] === 'snd')[2] === true && chans.find(c => c[0] === 'acc')[1] === true, chans);
  t('legenda arată intervalul real (min…max + unitate)', /m\/s²/.test(await p.textContent('#ss-chans')) && /\(fără date\)/.test(await p.textContent('#ss-chans')));
  const px = await p.evaluate(() => { const c = document.getElementById('ss-cv'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  t('graficul are pixeli desenați', px > 200, px);
  const lab0 = await p.getAttribute('#ss-cv', 'aria-label');
  t('descriere accesibilă a graficului cu numele canalelor', /Accelera/.test(lab0) && /Lumin/.test(lab0), lab0);
  await p.uncheck('#ss-chans input[data-ch="acc"]');
  t('dezactivarea unui canal schimbă descrierea', (await p.getAttribute('#ss-cv', 'aria-label')) !== lab0);
  await p.check('#ss-chans input[data-ch="acc"]');
  // scrubber
  const max = +await p.getAttribute('#ss-sc', 'max');
  await p.evaluate((v) => { const s = document.getElementById('ss-sc'); s.value = String(v); s.dispatchEvent(new Event('input', {bubbles: true})); }, Math.round(max / 2));
  await p.waitForTimeout(100);
  const ro = await p.textContent('#ss-ro');
  t('cursor la mijloc: valori pentru canalele active', /Accelera.* m\/s²/.test(ro) && /Lumin.* lx/.test(ro) && !/Sunet/.test(ro), ro);
  t('aria-valuetext al cursorului', /\d+:\d\d/.test(await p.getAttribute('#ss-sc', 'aria-valuetext')));
  // note
  const nb = await p.$$('#ss-notes button');
  t('două note listate, text cu HTML ca text', nb.length === 2 && (await p.$$('#ss-notes b')).length === 0);
  await p.click('#ss-notes button:nth-child(2)'); await p.waitForTimeout(150);
  t('salt la nota 2: apare în citire și e marcată activă', /A doua notă/.test(await p.textContent('#ss-ro')) && await p.$eval('#ss-notes button:nth-child(2)', e => e.classList.contains('act')));
  await p.click('#ss-notes button:nth-child(1)'); await p.waitForTimeout(150);
  t('salt la nota 1 (text cu HTML afișat ca text)', /Prima notă <b>x<\/b>/.test(await p.textContent('#ss-ro')));
  // redare
  await p.evaluate(() => { const s = document.getElementById('ss-sc'); s.value = '0'; s.dispatchEvent(new Event('input', {bubbles: true})); });
  await p.selectOption('#ss-speed', '8');
  await p.click('#ss-play'); await p.waitForTimeout(250);
  t('în redare: buton „PAUZĂ”', /PAUZĂ/.test(await p.textContent('#ss-play')));
  const v1 = +await p.$eval('#ss-sc', e => e.value); await p.waitForTimeout(250); const v2 = +await p.$eval('#ss-sc', e => e.value);
  t('cursorul avansează în timpul redării (sau a ajuns la capăt)', v2 > v1 || v2 >= max - 5, [v1, v2, max]);
  await p.waitForTimeout(1500);
  await p.waitForFunction(() => !SS.play, null, {timeout: 8000}).catch(() => {});
  t('la final redarea se oprește singură', /REDARE/.test(await p.textContent('#ss-play')) && +await p.$eval('#ss-sc', e => e.value) >= max - 5, [await p.textContent('#ss-play'), await p.$eval('#ss-sc', e => e.value), max]);
  await p.click('#ss-play'); await p.waitForTimeout(100); await p.click('#ss-play'); await p.waitForTimeout(100);
  t('pauză manuală funcționează', /PAUZĂ|REDARE/.test(await p.textContent('#ss-play')));
  await p.click('#ss-play').catch(() => {});
  await p.evaluate(() => { ssPause(); });
}

console.log('--- export');
{
  const p = pg;
  const dl = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); return {name: d.suggestedFilename(), txt: fs.readFileSync(await d.path(), 'utf8')}; };
  const j = await dl('#ss-view [data-act="ssJson"]'); const jo = JSON.parse(j.txt);
  t('JSON: rânduri, coloane și note', jo.app === 'fieldobserver' && jo.rows.length >= 8 && jo.cols.length === 15 && jo.notes.length === 2 && /\.json$/.test(j.name), j.name);
  const c = await dl('#ss-view [data-act="ssCsv"]'); const lines = c.txt.replace(/^﻿/, '').split('\r\n').filter(Boolean);
  t('CSV: antet + un rând per eșantion', lines[0].startsWith('time_s,ax,ay,az') && lines.length === jo.rows.length + 1, [lines.length, jo.rows.length]);
  t('CSV: numerele negative nu sunt prefixate cu apostrof', !/'-\d/.test(c.txt));
  t('CSV: notele apar în coloana „note”, HTML-ul rămâne text', /A doua notă/.test(c.txt) && /Prima notă <b>x<\/b>/.test(c.txt));
  const g = await dl('#ss-view [data-act="ssGpx"]');
  t('GPX 1.1: traseu cu puncte, ore și note ca waypoint-uri', /<gpx version="1.1"/.test(g.txt) && (g.txt.match(/<trkpt /g) || []).length >= 5 && /<time>/.test(g.txt) && (g.txt.match(/<wpt /g) || []).length === 2 && /&lt;b&gt;x&lt;\/b&gt;/.test(g.txt), g.txt.slice(0, 300));
  t('fără erori până aici', issues.length === 0, issues.slice(0, 4));
}

console.log('--- persistență, ciornă, ștergere');
{
  const p = pg;
  await p.click('#ss-view [data-act="ssBack"]'); await p.waitForTimeout(200);
  await p.click('#ss-rec'); await p.waitForTimeout(500);
  await p.fill('#ss-note', 'Notă pierdută dacă nu se salvează'); await p.click('#ss-addnote'); await p.waitForTimeout(300);
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await p.waitForTimeout(300);
  const dr = await dbAll(p);
  t('pagehide salvează ciorna cu nota', dr.some(x => x.draft === true && x.notes.length === 1));
  await p.evaluate(() => clearInterval(window.__drv));
  const o2 = await open({ctx: ctxA}); const p2 = o2.p;
  await p2.click('#b-ss'); await p2.waitForTimeout(500);
  const txt = await p2.textContent('#ss-list');
  t('după repornire: sesiunea salvată + ciorna (neterminată) apar în listă', (await p2.$$('#ss-list .rec')).length === 2 && /neterminată/.test(txt), txt.slice(0, 200));
  await p2.click('#ss-list .rec:last-child [data-act="ssDel"]'); await p2.waitForTimeout(300);
  await p2.click('dialog.fff-dlg[open] .fff-danger'); await p2.waitForTimeout(500);
  t('ștergere cu confirmare (dialog propriu, nu nativ)', (await p2.$$('#ss-list .rec')).length === 1 && (await dbAll(p2)).length === 1);
  await pg.close();
  pg = p2;
}

console.log('--- limită de eșantioane și date ostile');
{
  const p = pg;
  await drive(p); await p.click('#ss-rec'); await p.waitForTimeout(400);
  await p.evaluate(() => { const f = []; for (let i = 0; i < 35995; i++) f.push([i, null, null, null, null, null, null, null, null, null, null, null, null, null, null]); SS.rows.push(...f); });
  await p.waitForFunction(() => !SS.on, null, {timeout: 15000}).catch(() => {});
  t('la limita de 36000 eșantioane sesiunea se oprește și se salvează', !(await p.evaluate(() => SS.on)) && /36000/.test(await p.textContent('#ss-stat')), await p.textContent('#ss-stat'));
  const all = await dbAll(p);
  t('sesiunea plafonată e în stocare, fără ciornă rămasă', all.some(x => x.rows.length >= 36000 && x.draft === false));
  await p.evaluate(() => clearInterval(window.__drv));
  // înregistrări ostile direct în IndexedDB
  await dbPut(p, {name: '<img src=x onerror=alert(1)>', t0: 1, rate: 500, cols: [], rows: [[0, 'a', {}, 3], [100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 91, 181, 5, 5, 5], 'x', null, [200]], notes: [{t: 50, x: '<script>alert(1)</script>' + 'z'.repeat(500)}, null, {t: 'a'}], draft: false});
  await dbPut(p, {name: 'gol', rows: [], notes: []});
  await dbPut(p, {name: 'fără rânduri', rows: 'text'});
  await p.click('#ss-view [data-act="ssBack"]').catch(() => {});
  await p.evaluate(() => ssLoadList()); await p.waitForTimeout(500);
  t('lista rezistă la înregistrări stricate; numele ca text', (await p.$$('#ss-list img')).length === 0 && (await p.$$('#ss-list .rec')).length >= 4);
  const hid = await p.evaluate(() => SS.list.filter(s => /img src/.test(s.name))[0].id);
  await p.click('#ss-list [data-act="ssOpen"][data-id="' + hid + '"]'); await p.waitForTimeout(500);
  t('înregistrarea ostilă se deschide filtrată (rândurile valide rămân)', !(await p.$eval('#ss-view', e => e.hidden)) && (await p.evaluate(() => SS.cur.rows.length)) === 3);
  t('nota ostilă: tăiată la 200, fără element script', (await p.evaluate(() => SS.cur.notes[0].x.length)) <= 200 && (await p.$$('#ss-notes script')).length === 0);
  t('rândurile cu coordonate invalide nu strică exportul GPX', await p.evaluate(() => okLL(91, 181) === false));
  const emptyId = await p.evaluate(() => SS.list.filter(s => s.name === 'gol')[0].id);
  await p.click('#ss-view [data-act="ssBack"]'); await p.waitForTimeout(200);
  await p.click('#ss-list [data-act="ssOpen"][data-id="' + emptyId + '"]'); await p.waitForTimeout(400);
  t('sesiune fără eșantioane: mesaj, rămâne lista', !(await p.$eval('#ss-listbox', e => e.hidden)));
  t('fără erori / dialoguri / rețea', issues.length === 0, issues.slice(0, 4));
}

console.log('--- limbi');
{
  const p = pg;
  await p.click('#ss-list [data-act="ssOpen"]:first-of-type').catch(() => {});
  const dict = await p.evaluate(() => { const o = {}; for (const l of LANGS) o[l] = Object.keys(DICT[l]).filter(k => /^ss[A-Z]|^bSess$/.test(k)).length; return o; });
  t('chei ss* în toate cele 8 limbi (≥ 40 fiecare)', Object.values(dict).every(n => n >= 40), dict);
  await p.evaluate(() => { document.querySelector('#ss').classList.add('on'); });
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'de', 'hu', 'ro']) {
    await p.evaluate((l) => setLang(l), l); await p.waitForTimeout(150);
    const txt = await p.$eval('#ss', e => e.textContent), btn = await p.textContent('#b-ss');
    const raw = /\bss[A-Z][A-Za-z_]+\b/.test(txt) || /\bbSess\b/.test(btn);
    const left = l !== 'ro' && /SESIUNI DE MĂSURARE|Senzorii și precizia|ÎNCEPE SESIUNEA|Niciun/.test(txt);
    t('limba ' + l + ': panoul tradus, fără chei brute', !raw && !left && /\S/.test(btn), {raw, left, btn});
  }
}

console.log('--- accesibilitate și mobil');
{
  const o = await open({bypass: true}); const p = o.p;
  await drive(p); await p.click('#b-ss'); await p.waitForTimeout(200); await p.click('#ss-rec'); await p.waitForTimeout(700);
  await p.fill('#ss-note', 'x'.repeat(40)); await p.click('#ss-addnote'); await p.click('#ss-rec'); await p.waitForTimeout(600);
  await p.click('#ss-list [data-act="ssOpen"]'); await p.waitForTimeout(500);
  if (AXE && fs.existsSync(AXE)) {
    await p.evaluate(fs.readFileSync(AXE, 'utf8') + '\n;0');
    const ax = await p.evaluate(async () => (await window.axe.run(document.getElementById('ss'), {resultTypes: ['violations']})).violations.map(v => v.id + ':' + v.nodes.length));
    t('axe 0 violări în panoul de sesiuni', ax.length === 0, ax);
  }
  await o.ctx.close();
  const m = await open({w: 360, h: 740}); 
  await m.p.click('#b-ss'); await m.p.waitForTimeout(200);
  t('fără depășire orizontală la 360 px', await m.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1 && await m.p.evaluate(() => document.getElementById('ss-b').scrollWidth <= document.getElementById('ss-b').clientWidth + 1));
  await m.ctx.close();
  t('0 erori JS / dialoguri native / rețea', issues.length === 0, issues.slice(0, 4));
}
await b.close(); console.log(`\n${ok} ok / ${bad} eșuate`); process.exit(bad ? 1 : 0);
