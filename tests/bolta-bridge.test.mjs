// FieldObserver 1.3.4 — „↗ Bolta”. Copiat în FieldObserver/tests/bolta-bridge.test.mjs. Rulare: node bolta-bridge.test.mjs <dirFO> <dirBolta>
import {createRequire} from "module"; const require = createRequire("/opt/node-tools/package.json"); const {chromium} = require("playwright");
let fails = 0, passes = 0; const check = (n, c, x) => { c ? (passes++, console.log("  ok  " + n)) : (fails++, console.log("FAIL  " + n + (x !== undefined ? "  -> " + JSON.stringify(x) : ""))); };
const [dF, dB] = process.argv.slice(2);
const b = await chromium.launch({executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"]});
const ctx = await b.newContext({viewport: {width: 420, height: 800}, locale: "ro-RO", permissions: ["geolocation"], geolocation: {latitude: 45.3812, longitude: 26.4047, accuracy: 10}, timezoneId: "Europe/Bucharest"});
const net = []; await ctx.route(/^https?:/, r => { net.push(r.request().url()); r.abort(); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error" || /Content Security Policy/.test(m.text())) errs.push(m.text()); });
await p.clock.install({time: new Date("2026-10-18T12:00:00Z")});
await p.goto("file://" + dF + "/index.html"); await p.waitForTimeout(3000);
await p.click("#btn-skip"); await p.waitForTimeout(600); await p.clock.runFor(1500);
let live = await p.evaluate(() => { const a = document.getElementById("g-bolta"); return {hid: a.hidden, h: a.href, rel: a.rel, tg: a.target}; });
check("live: link vizibil, fără t, ll rotunjit 0,01°, from=fieldobserver", !live.hid && live.h === "https://chiuta.github.io/apps/Bolta/#sky&ll=45.38,26.40&from=fieldobserver", live);
check("live: _blank + noopener", live.tg === "_blank" && /noopener/.test(live.rel));
await p.fill("#nt", "test"); await p.click("#b-sv"); await p.waitForTimeout(700);
await p.click("#b-ar"); await p.waitForTimeout(500);
const arc = await p.evaluate(() => [...document.querySelectorAll("#ar-l .rec a.rbl")].map(a => a.href));
check("arhivă: link pe raportul nou", arc.length === 1, arc);
check("arhivă: t = momentul salvării (UTC, fără ms), ll rotunjit", arc[0] && /^https:\/\/chiuta\.github\.io\/apps\/Bolta\/#sky&t=2026-10-18T12:00:\d\dZ&ll=45\.38,26\.40&from=fieldobserver$/.test(arc[0]), arc[0]);
const rec = await p.evaluate(() => new Promise(r => S.db.transaction("recs").objectStore("recs").getAll().onsuccess = e => r(e.target.result[0])));
check("raport salvat cu t numeric (ms UTC) lângă ts local", typeof rec.t === "number" && Math.abs(rec.t - Date.parse("2026-10-18T12:00:00Z")) < 20000 && /^\d{4}-\d\d-\d\dT/.test(rec.ts), [rec.t, rec.ts]);
// raport vechi (fără t): fără buton
await p.evaluate(() => new Promise(r => { const tx = S.db.transaction("recs", "readwrite"); tx.objectStore("recs").add({ts: "2025-03-30T03:30:00", gps: {lat: 45.38, lon: 26.4}, ori: {az: 0, bt: 0, gm: 0, abs: true}, mot: {ax: 0, ay: 0, az: 0}, lux: null, bat: {}, net: {}, notes: "vechi"}); tx.oncomplete = r; }));
await p.evaluate(() => { document.getElementById("ar-q").value = ""; document.getElementById("ar-q").dispatchEvent(new Event("input")); }); await p.click("#b-ar").catch(() => {}); await p.evaluate(() => { document.getElementById("ar-q").dispatchEvent(new Event("input")); refreshCnt && refreshCnt(); });
await p.evaluate(() => new Promise(r => S.db.transaction("recs").objectStore("recs").getAll().onsuccess = e => { ARCH.length = 0; e.target.result.forEach(x => ARCH.push(x)); renderArch(); r(); }));
const cnt = await p.evaluate(() => ({recs: document.querySelectorAll("#ar-l .rec").length, links: document.querySelectorAll("#ar-l .rec a.rbl").length}));
check("raport vechi (doar ts local): FĂRĂ buton (ora ambiguă nu se ghicește)", cnt.recs === 2 && cnt.links === 1, cnt);
// GPX folosește t
const gx = await p.evaluate(() => buildGpx([{ts: "2026-10-18T15:00:00", t: Date.UTC(2026, 9, 18, 12, 0, 0), gps: {lat: 45.38, lon: 26.4}}], []));
check("GPX: <time> din t (12:00:00Z), nu din ts local", /<time>2026-10-18T12:00:00\.000Z<\/time>/.test(gx), gx.slice(0, 400));
// import păstrează t doar valid
const cl = await p.evaluate(() => [cleanRec({ts: "x", t: 1760788800000, gps: {}}).t, cleanRec({ts: "x", t: "evil", gps: {}}).t, cleanRec({ts: "x", t: 9e15, gps: {}}).t]);
check("import: t valid păstrat, invalid -> null", cl[0] === 1760788800000 && cl[1] === null && cl[2] === null, cl);
check("0 erori / 0 rețea", errs.length === 0 && net.length === 0, [errs, net]);
// ținta: Bolta acceptă exact acest format
const q = await (await b.newContext({viewport: {width: 1000, height: 800}, locale: "ro-RO"})).newPage(); const qe = []; q.on("pageerror", e => qe.push(e.message));
await q.goto("file://" + dB + "/index.html#sky&t=2026-10-18T12:00:00Z&ll=45.38,26.40&from=fieldobserver"); await q.waitForTimeout(2500);
check("Bolta: butonul „înapoi” spre Field Observer", await q.evaluate(() => !!document.getElementById("fff-back")));
await b.close(); console.log(`\n${passes} reușite, ${fails} eșuate`); process.exit(fails ? 1 : 0);
