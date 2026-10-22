// Teste pentru funcțiile adăugate în v1.1.0 (traseu GPS, GPX, pachet .fff.json, QR, tipărire) + kit.
// Rulare: node tests/fff-r8.test.mjs   (Playwright din /opt/node-tools, Chromium din /opt/pw-browsers; rețea blocată)
import {createRequire} from 'module'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const require = createRequire('/opt/node-tools/package.json'); const {chromium} = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)); const FILE = 'file://' + path.join(HERE, '..', 'index.html');
const AXE = process.env.FFF_AXE || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
let ok = 0, bad = 0; const t = (n, c, x) => { if (c) { ok++; console.log('  ok  ', n); } else { bad++; console.log('  FAIL', n, x ?? ''); } };
const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
async function mk(w = 1280, h = 800, extra = {}) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, acceptDownloads: true, locale: 'ro-RO', permissions: ['geolocation'], geolocation: {latitude: 45.38, longitude: 26.4, accuracy: 10}, ...extra});
  const net = []; await ctx.route(/^https?:/, r => { net.push(r.request().url()); r.abort(); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || /Content Security Policy/.test(m.text())) errs.push(m.text()); });
  return {ctx, p, errs, net};
}
async function dl(p, sel) { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = await d.path(); return {name: d.suggestedFilename(), txt: fs.readFileSync(f, 'utf8')}; }
const {ctx, p, errs, net} = await mk();
await p.goto(FILE); await p.waitForTimeout(3600);
t('pornire fără erori', errs.length === 0, errs); t('0 cereri de rețea', net.length === 0, net);
await p.click('#btn-skip'); await p.waitForTimeout(500);
t('GPS din context afișat', /45\.38/.test(await p.textContent('#g-coord')), await p.textContent('#g-coord'));
await p.fill('#nt', 'Observație <test> & "ghilimele"'); await p.click('#b-sv'); await p.waitForTimeout(600);
await p.click('#b-trk'); await p.waitForTimeout(500);
t('buton traseu activ', (await p.getAttribute('#b-trk', 'aria-pressed')) === 'true');
for (const [la, lo] of [[45.3810, 26.4010], [45.3820, 26.4020], [45.38200001, 26.40200001], [45.3830, 26.4030]]) { await ctx.setGeolocation({latitude: la, longitude: lo, accuracy: 8}); await p.waitForTimeout(700); }
const n1 = await p.evaluate(() => S.trk.pts.length); t('puncte de traseu (punctul la <5 m omis)', n1 >= 4 && n1 <= 5, n1);
await p.click('#b-trk'); await p.waitForTimeout(500);
t('traseu oprit', (await p.getAttribute('#b-trk', 'aria-pressed')) === 'false');
await p.click('#b-ar'); await p.waitForTimeout(400);
t('arhivă cu raport', (await p.textContent('#ar-cnt')) === '1');
const g = await dl(p, '[data-act=expGpx]');
t('GPX: nume .gpx', /\.gpx$/.test(g.name), g.name);
const xml = g.txt;
t('GPX: XML bine format (DOMParser)', await p.evaluate(x => { const d = new DOMParser().parseFromString(x, 'application/xml'); return !d.querySelector('parsererror') && d.documentElement.nodeName === 'gpx'; }, xml));
t('GPX: 1 wpt + 1 trk cu puncte', await p.evaluate(x => { const d = new DOMParser().parseFromString(x, 'application/xml'); return d.getElementsByTagName('wpt').length === 1 && d.getElementsByTagName('trk').length === 1 && d.getElementsByTagName('trkpt').length >= 4; }, xml));
t('GPX: nota cu caractere speciale rămâne exactă', await p.evaluate(x => { const d = new DOMParser().parseFromString(x, 'application/xml'); return d.getElementsByTagName('desc')[0].textContent.startsWith('Observație <test> & "ghilimele"'); }, xml));
t('GPX: timp ISO și coordonate valide', /<time>\d{4}-\d\d-\d\dT[\d:.]+Z<\/time>/.test(xml) && /<trkpt lat="45\.38[0-9]+" lon="26\.40[0-9]+"/.test(xml));
const f = await dl(p, '[data-act=expFff]');
const bun = JSON.parse(f.txt);
t('.fff.json: format/app/schema/versiune', bun.format === 'fff-bundle' && bun.schema === 1 && bun.app === 'fieldobserver' && bun.version === '1.3.4', JSON.stringify(bun).slice(0, 120));
const inner = JSON.parse(bun.data['fieldobserver.arhiva']);
t('.fff.json: 1 raport + 1 traseu', inner.records.length === 1 && inner.tracks.length === 1 && inner.tracks[0].pts.length >= 4);
await p.click('[data-act=qrRec]'); await p.waitForTimeout(400);
t('QR: dialog deschis, SVG prezent', await p.evaluate(() => document.getElementById('qrd').open && !!document.querySelector('#qrd-img svg')));
t('QR: text geo:', /^geo:45\.38\d+,26\.4\d+$/.test(await p.textContent('#qrd-tx')), await p.textContent('#qrd-tx'));
const dec = await p.evaluate(async () => {
  const svg = document.querySelector('#qrd-img svg').outerHTML; const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  const im = new Image(); await new Promise((r, j) => { im.onload = r; im.onerror = j; im.src = url; });
  const c = document.createElement('canvas'); c.width = c.height = 400; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 400); x.drawImage(im, 0, 0, 400, 400);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  try { const r = await FFF.qr.scan(new File([blob], 'q.png', {type: 'image/png'})); return r && (r.text || r); } catch (e) { return 'ERR ' + e.message; } });
t('QR: decodat înapoi = textul afișat', dec === (await p.textContent('#qrd-tx')), dec);
await p.click('#qrd-txt'); await p.waitForTimeout(200);
t('QR: varianta text', /Observație/.test(await p.textContent('#qrd-tx')));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
t('Esc închide doar dialogul QR, arhiva rămâne', await p.evaluate(() => !document.getElementById('qrd').open && document.getElementById('ar').classList.contains('on')));
await p.evaluate(() => new Promise(r => { const tx = S.db.transaction(['recs', 'tracks'], 'readwrite'); tx.objectStore('recs').clear(); tx.objectStore('tracks').clear(); tx.oncomplete = r; }));
fs.writeFileSync('/tmp/_fo_bundle.fff.json', f.txt);
await p.setInputFiles('#ar-fi', '/tmp/_fo_bundle.fff.json'); await p.waitForTimeout(800);
const cnt = await p.evaluate(() => new Promise(r => { const o = {}; const tx = S.db.transaction(['recs', 'tracks'], 'readonly'); tx.objectStore('recs').count().onsuccess = e => o.r = e.target.result; tx.objectStore('tracks').count().onsuccess = e => o.t = e.target.result; tx.oncomplete = () => r(o); }));
t('import .fff.json: raport + traseu restaurate', cnt.r === 1 && cnt.t === 1, JSON.stringify(cnt));
fs.writeFileSync('/tmp/_fo_bad.fff.json', JSON.stringify({format: 'fff-bundle', schema: 1, app: 'altceva', data: {}}));
await p.setInputFiles('#ar-fi', '/tmp/_fo_bad.fff.json'); await p.waitForTimeout(500);
t('import pachet străin respins', /străin|gol/.test(await p.textContent('#ts')), await p.textContent('#ts'));
await p.evaluate(() => document.body.classList.add('printing-ar')); await p.emulateMedia({media: 'print'});
const pr = await p.evaluate(() => ({ar: getComputedStyle(document.getElementById('ar')).display, hd: getComputedStyle(document.getElementById('hd')).display, tb: getComputedStyle(document.getElementById('ar-t')).display, bg: getComputedStyle(document.getElementById('ar')).backgroundColor}));
t('tipărire: arhiva vizibilă, antet/bară ascunse, fundal alb', pr.ar === 'block' && pr.hd === 'none' && pr.tb === 'none' && pr.bg === 'rgb(255, 255, 255)', JSON.stringify(pr));
const pdf = await p.pdf({printBackground: false}); t('tipărire: PDF generat', pdf.length > 1000);
await p.emulateMedia({media: 'screen'}); await p.evaluate(() => document.body.classList.remove('printing-ar'));
t('FFF.core/qr/label/bundle încărcate', await p.evaluate(() => !!(window.FFF && FFF.qr && FFF.label && FFF.bundle)));
t('buton Transparență în arhivă vizibil', await p.isVisible('#ar-lbl'));
await p.click('#ar-lbl'); await p.waitForTimeout(500);
t('dialog Transparență deschis', await p.evaluate(() => !!document.querySelector('dialog.fff-dlg[open]')));
await p.evaluate(fs.readFileSync(AXE, 'utf8') + '\n;0');
const runAxe = () => p.evaluate(async () => (await axe.run(document, {resultTypes: ['violations']})).violations.map(v => v.id + ':' + v.nodes.map(n => n.target.join(' ')).join(',')));
t('axe 0 violări cu dialogul Transparență deschis', (await runAxe()).length === 0, await runAxe());
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(() => { const r = document.querySelector('[data-act=qrRec]'); r && r.click(); }); await p.waitForTimeout(500);
t('axe 0 violări cu dialogul QR deschis', (await runAxe()).length === 0, await runAxe());
await p.evaluate(() => document.getElementById('qrd').close());
t('axe 0 violări în arhivă', (await runAxe()).length === 0, await runAxe());
t('fără erori pe parcurs', errs.length === 0, errs); t('0 cereri de rețea pe parcurs', net.length === 0, net);
await ctx.close();
{ const m = await mk(360, 740); await m.p.goto(FILE); await m.p.waitForTimeout(3600); await m.p.click('#btn-skip'); await m.p.waitForTimeout(400);
  const o = await m.p.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: innerWidth, ab: [...document.querySelectorAll('#ab .ab')].map(e => e.getBoundingClientRect()).map(r => [Math.round(r.left), Math.round(r.right)])}));
  t('360 px: fără depășire orizontală', o.sw <= o.iw + 1, JSON.stringify(o));
  t('360 px: cele 8 butoane încap în ecran', o.ab.length === 8 && o.ab.every(([l, r]) => l >= 0 && r <= 361), JSON.stringify(o.ab));
  await m.p.click('#b-ar'); await m.p.waitForTimeout(300);
  t('360 px: arhiva fără depășire', await m.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); t('360 px: fără erori', m.errs.length === 0, m.errs); await m.ctx.close(); }
{ const m = await mk(); const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8').replace(/<!--fff:kit:start[\s\S]*?<!--fff:kit:end-->/, '');
  const tmp = path.join(HERE, '..', '_nokit.tmp.html'); /* în directorul aplicației, ca manifestul și iconițele relative să existe */ fs.writeFileSync(tmp, html); await m.p.goto('file://' + tmp); await m.p.waitForTimeout(1500); await m.p.click('#btn-skip'); await m.p.click('#b-ar'); await m.p.waitForTimeout(300);
  t('fără kit: nicio eroare, fără buton Transparență', m.errs.length === 0 && !(await m.p.isVisible('#ar-lbl')), m.errs); await m.ctx.close(); fs.unlinkSync(tmp); }
await b.close();
console.log(`\n${ok} ok / ${bad} eșuate`); process.exit(bad ? 1 : 0);
