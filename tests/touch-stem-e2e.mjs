// Отросток на телефоне: пальцем (без наведения) — у выделенного блока и у невыделенного. Запуск: npm run build && node tests/touch-stem-e2e.mjs
import { chromium } from 'playwright';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const node = (id, x, y) => ({ id, name: 'Блок ' + id, lang: 'html', x, y, codes: {}, pluginId: null, family: null, desc: '', colors: null });
await ctx.addInitScript((g) => { localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Т', t: 1 }] })); localStorage.setItem('triosteum.proj.p1', JSON.stringify(g)); localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); }, { nodes: [node('a', 60, 200), node('b', 120, 450), node('c', 120, 620)], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 5 });
const p = await ctx.newPage(); await p.goto('file://' + process.cwd() + '/docs/index.html'); await p.waitForTimeout(1200);
const cdp = await ctx.newCDPSession(p);
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
async function drag(x0, y0, x1, y1, n = 14) { await touch('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await touch('touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n); await p.waitForTimeout(16); } await touch('touchEnd'); await p.waitForTimeout(400); }
const st = () => p.evaluate(() => { const g = JSON.parse(localStorage.getItem('triosteum.proj.p1')); const a = g.nodes.find(n => n.id === 'a'); return { x: a.x, y: a.y, edges: g.edges.length, sel: document.querySelector('.node[data-id="a"]').classList.contains('sel') }; });
const a = await p.locator('.node[data-id="a"]').boundingBox(), bb = await p.locator('.node[data-id="b"]').boundingBox();
// 1) тап по блоку — выделение
await touch('touchStart', a.x + 40, a.y + 20); await touch('touchEnd'); await p.waitForTimeout(500);
check((await st()).sel && await p.evaluate(() => getComputedStyle(document.querySelector('.node[data-id="a"] .stem')).visibility) === 'visible', 'тап выделяет блок, и у него виден отросток');
// 2) тянем за середину отростка к блоку b
await drag(a.x + a.width + 12, a.y + a.height / 2 + 4, bb.x + 30, bb.y + 20);
{ const r = await st(); check(r.edges === 1 && r.x === 60, 'пальцем за отросток выделенного блока — связь, блок не сдвинулся'); }
// 3) без выделения: тап мимо, потом тянем за точку
await touch('touchStart', 300, 700); await touch('touchEnd'); await p.waitForTimeout(400);
const cc = await p.locator('.node[data-id="c"]').boundingBox();
await drag(a.x + a.width + 14, a.y + a.height / 2 + 6, cc.x + 30, cc.y + 20);
{ const r = await st(); check(r.edges === 2 && r.x === 60, 'пальцем там, где отросток, у невыделенного блока — тоже связь'); }
await b.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
