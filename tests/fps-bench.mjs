// Частота кадров в основных действиях на большой доске. Запуск: node tests/fps-bench.mjs  (N=200 блоков по умолчанию)
// Считает долю «дёрганых» кадров (> 33 мс) и время работы главного потока. Процессор замедлен в 4 раза, как у слабого ноутбука.
import { chromium } from 'playwright';
const N = +(process.env.N || 200), CPU = +(process.env.CPU || 4);
const nodes = [], edges = [], notes = [];
for (let i = 0; i < N; i++) nodes.push({ id: 'n' + i, name: 'Блок ' + i, lang: ['python', 'csharp', '1c', 'cpp', 'html'][i % 5], x: (i % 20) * 250, y: Math.floor(i / 20) * 150, codes: {}, pluginId: null, family: null, desc: 'Описание блока ' + i, colors: null });
for (let i = 0; i < N; i++) { const a = i, b = (i * 7 + 3) % N; if (a !== b) edges.push({ id: 'e' + i, from: 'n' + a, to: 'n' + b, taps: [] }); }
for (let i = 0; i < 20; i++) notes.push({ id: 't' + i, text: 'Заметка ' + i, x: i * 240, y: -120 });
const b = await chromium.launch({ args: ['--enable-gpu-rasterization'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript((g) => { if (localStorage.getItem('triosteum.projects')) return; localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Перф', t: Date.now() }] })); localStorage.setItem('triosteum.proj.p1', JSON.stringify(g)); localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); }, { nodes, edges, notes, cam: { x: 40, y: 80, k: 0.7 }, seq: 900 });
const p = await ctx.newPage(); await p.goto('file://' + process.cwd() + '/docs/index.html'); await p.waitForTimeout(1500);
if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
async function scene(name, fn) {
  if (ONLY && !ONLY.some((o) => name.includes(o))) return;
  await p.evaluate(() => { window.__fr = []; let last = performance.now(); const loop = (t) => { window.__fr.push(t - last); last = t; if (window.__fr.on) requestAnimationFrame(loop); }; window.__fr.on = true; requestAnimationFrame(loop); });
  const a = await metrics(); const t0 = Date.now();
  await fn();
  const z = await metrics(); const dur = Date.now() - t0;
  const fr = await p.evaluate(() => { window.__fr.on = false; return window.__fr.slice(2); });
  const jank = fr.filter((x) => x > 33).length, avg = fr.reduce((s, x) => s + x, 0) / Math.max(1, fr.length);
  console.log(name.padEnd(30), 'fps≈' + (1000 / avg).toFixed(0).padStart(3), ' рывков ' + String(jank).padStart(3) + '/' + fr.length, ' худший кадр ' + Math.max(...fr).toFixed(0).padStart(4) + ' мс', ' скрипты ' + ((z.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0).padStart(5) + ' мс', ' стили+раскладка ' + (((z.RecalcStyleDuration - a.RecalcStyleDuration) + (z.LayoutDuration - a.LayoutDuration)) * 1000).toFixed(0).padStart(5) + ' мс');
}
const cv = await p.locator('#canvas').boundingBox();
await scene('курсор по доске', async () => { for (let i = 0; i < 80; i++) await p.mouse.move(cv.x + 200 + i * 12, cv.y + 300 + Math.sin(i / 5) * 120); });
await scene('прокрутка доски (перетаскивание)', async () => { await p.mouse.move(cv.x + 14, cv.y + 600); await p.mouse.down(); for (let i = 0; i < 60; i++) await p.mouse.move(cv.x + 14 + i * 8, cv.y + 600 - i * 4); await p.mouse.up(); await p.waitForTimeout(250); });
await scene('масштаб колесом', async () => { await p.mouse.move(cv.x + 800, cv.y + 400); for (let i = 0; i < 30; i++) { await p.mouse.wheel(0, i < 15 ? -60 : 60); await p.waitForTimeout(16); } });
await scene('протянуть связь', async () => { const nb = await p.locator('.node').nth(25).boundingBox(); await p.mouse.move(nb.x + nb.width - 4, nb.y + nb.height / 2); await p.waitForTimeout(100); const pd = await p.locator('.node').nth(25).locator('.port-dot').boundingBox(); await p.mouse.move(pd.x + pd.width / 2, pd.y + pd.height / 2); await p.mouse.down(); for (let i = 0; i < 50; i++) await p.mouse.move(pd.x + i * 10, pd.y + i * 5); await p.keyboard.press('Escape'); await p.mouse.up(); await p.waitForTimeout(200); });
await scene('перетаскивание блока', async () => { const nb = await p.locator('.node').nth(25).boundingBox(); await p.mouse.move(nb.x + 40, nb.y + 20); await p.mouse.down(); for (let i = 0; i < 60; i++) await p.mouse.move(nb.x + 40 + i * 6, nb.y + 20 + Math.sin(i / 6) * 80); await p.mouse.up(); await p.waitForTimeout(400); });
await scene('наведение на док сред', async () => { const sh = await p.locator('#envDock .ed-shelf').boundingBox(); for (let i = 0; i < 60; i++) await p.mouse.move(sh.x + 10 + i * (sh.width - 20) / 60, sh.y + sh.height / 2); await p.mouse.move(cv.x + 300, cv.y + 300); await p.waitForTimeout(300); });
await scene('открыть и закрыть библиотеку', async () => { await p.click('#bLib'); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(400); });
await scene('поиск и команды', async () => { await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.type('экспорт', { delay: 40 }); await p.keyboard.press('Escape'); await p.waitForTimeout(300); });
await scene('простой без действий', async () => { await p.waitForTimeout(1500); });
await b.close();
