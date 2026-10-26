// Teste 1.3.8: importul de arhivă tratează fișierele ostile fără excepții necaptate. Rulare: node tests/import-hostile.test.mjs
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(process.env.PW_ROOT || import.meta.url);
const {chromium} = require('playwright');
const FILE = 'file://' + path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
let ok = 0, bad = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  ok   ' + n); } else { bad++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const b = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox']});
const bundle = (inner) => JSON.stringify({format: 'fff-bundle', schema: 1, app: 'fieldobserver', data: {'fieldobserver.arhiva': inner}});
const cases = [
  ['pachet cu conținut intern null', bundle('null')],
  ['pachet cu conținut intern număr', bundle('5')],
  ['pachet cu conținut intern listă goală', bundle('[]')],
  ['fișier JSON null', 'null'],
  ['fișier JSON număr', '7'],
  ['listă cu null-uri', '[null, 1, "x", {"ts": 5}]'],
];
for (const [name, body] of cases) {
  const ctx = await b.newContext({viewport: {width: 420, height: 800}});
  await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(3600);
  await p.click('#btn-skip'); await p.waitForTimeout(500);
  await p.click('#b-ar'); await p.waitForTimeout(400);
  await p.setInputFiles('#ar-fi', {name: 'x.fff.json', mimeType: 'application/json', buffer: Buffer.from(body)});
  await p.waitForTimeout(800);
  const cnt = await p.textContent('#ar-cnt');
  check(name + ': fără pageerror', errs.length === 0, errs);
  check(name + ': nimic importat', cnt === '0', cnt);
  await ctx.close();
}
await b.close();
console.log(`FieldObserver import-hostile: ${ok} ok, ${bad} eșuate`); process.exit(bad ? 1 : 0);
