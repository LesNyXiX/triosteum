// Замер нагрузки: перетаскивание блока, панорама и масштаб на большой доске (80 блоков, 100 связей).
// Запуск: npm run build && node tests/perf-bench.mjs   — печатает время скриптов, стилей, раскладки и отрисовки.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
const nodes = [], edges = [];
for (let i = 0; i < 80; i++) nodes.push({ id: 'n' + i, name: 'Блок ' + i, lang: ['python', 'csharp', '1c', 'cpp'][i % 4], x: (i % 10) * 260, y: Math.floor(i / 10) * 140, codes: {}, pluginId: null, family: null, desc: '', colors: null });
for (let i = 0; i < 100; i++) { const a = i % 80, b = (i * 7 + 3) % 80; if (a !== b) edges.push({ id: 'e' + i, from: 'n' + a, to: 'n' + b, taps: i % 9 === 0 ? [{ id: 't' + i, t: 0.5, nodes: [] }] : [] }); }
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((g) => { localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Перф', t: Date.now() }] })); localStorage.setItem('triosteum.proj.p1', JSON.stringify(g)); localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); }, { nodes, edges, notes: [], cam: { x: 40, y: 80, k: 0.6 }, seq: 300 });
const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(1200);
const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
const metric = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const o = {}; m.forEach((x) => { o[x.name] = x.value; }); return o; };
const frames = () => p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); (function f(){ n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); })(); }));
async function measure(name, fn) {
  const a = await metric(); const t0 = Date.now(); await fn(); const ms = Date.now() - t0; const z = await metric();
  const d = (k) => ((z[k] - a[k]) * 1000).toFixed(0).padStart(6);
  console.log(name.padEnd(22), 'скрипты', d('ScriptDuration'), 'мс · стили', d('RecalcStyleDuration'), '· раскладка', d('LayoutDuration'), '· всего задач', d('TaskDuration'), 'мс за', ms, 'мс');
}
const nb = await p.locator('#nodes .node[data-id="n12"]').boundingBox();
await measure('перетаскивание блока', async () => { await p.mouse.move(nb.x + 40, nb.y + 20); await p.mouse.down(); for (let i = 0; i < 120; i++) await p.mouse.move(nb.x + 40 + Math.sin(i / 8) * 300, nb.y + 20 + Math.cos(i / 11) * 120); await p.mouse.up(); await p.waitForTimeout(1500); });
await measure('панорама доски', async () => { await p.mouse.move(1500, 950); await p.mouse.down({ button: 'middle' }); for (let i = 0; i < 120; i++) await p.mouse.move(1500 - i * 4, 950 - i * 2); await p.mouse.up({ button: 'middle' }); await p.waitForTimeout(300); });
await measure('масштаб колесом', async () => { await p.mouse.move(800, 500); for (let i = 0; i < 40; i++) await p.mouse.wheel(0, i < 20 ? -60 : 60); await p.waitForTimeout(300); });
await measure('движение мыши', async () => { for (let i = 0; i < 150; i++) await p.mouse.move(200 + i * 8, 300 + Math.sin(i / 5) * 100); await p.waitForTimeout(300); });
await measure('простой (2 с)', async () => { await p.waitForTimeout(2000); });
await b.close();
