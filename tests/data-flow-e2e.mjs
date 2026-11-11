// Данные на связях: плашки с количеством записей, таблица в окне связи, результат блока в его настройках.
// Запуск: npm run build && node tests/data-flow-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((g) => {
  if (window.top !== window || localStorage.getItem('__seeded')) return; localStorage.setItem('__seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Данные', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
}, { nodes: [{ id: 's', name: 'Заказы', lang: 'sheet', x: 160, y: 220, codes: { sheet: JSON.stringify({ rows: [['Клиент', 'Сумма'], ['Альфа', '1200'], ['Бета', '800'], ['Гамма', '450']] }) }, pluginId: null, family: null, desc: '', colors: null },
             { id: 'c', name: 'Итог', lang: 'cpp', x: 620, y: 220, codes: { cpp: 'int run(){ return 42; }' }, pluginId: null, family: null, desc: '', colors: null }],
     edges: [{ id: 'e1', from: 's', to: 'c', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);

check(await page.locator('.df-chip').count() === 0, 'до запуска плашек на связях нет');
await page.keyboard.press('Control+r');
await page.waitForFunction(() => !document.querySelector('#runp.busy') && /успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {});
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
check(await page.locator('.df-chip').count() === 1 && /3 записи/.test(await page.textContent('.df-chip')), 'после запуска на связи — «3 записи»: ' + (await page.locator('.df-chip').allTextContents()).join());
const eb = await page.locator('.df-chip').boundingBox(), na = await page.locator('.node[data-id="s"]').boundingBox(), nb = await page.locator('.node[data-id="c"]').boundingBox();
check(eb.x > na.x + na.width && eb.x + eb.width < nb.x, 'плашка — между блоками, на связи');
await page.locator('.df-chip').click(); await page.waitForTimeout(400);
const pop = await page.textContent('#pop');
check(/Данные по связи — последний запуск/.test(pop) && await page.locator('#pop .df-tbl tbody tr').count() === 3 && /Альфа/.test(pop) && /Сумма/.test(pop), 'щелчок по плашке — таблица данных по связи (3 строки, столбцы)');
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
const b = await page.locator('.node[data-id="c"]').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + 20, { button: 'right' }); await page.waitForTimeout(400);
check(/Результат последнего запуска/.test(await page.textContent('#pop')) && /42/.test(await page.textContent('#pop .df-sec')), 'в настройках блока — его результат');
await page.keyboard.press('Escape');
// плашка — на середине связи (в экранных координатах), в том числе после перетаскивания и при другом масштабе
const chipOnEdge = () => page.evaluate(() => {
  const p = document.querySelector('path.edge-hit[data-edge="e1"]');
  const c = document.querySelector('.df-chip'); if (!p || !c) return 9999;
  const m = p.getPointAtLength(p.getTotalLength() / 2), sp = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM());
  const r = c.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - sp.x, r.y + r.height / 2 - sp.y);
});
check(await chipOnEdge() < 4, 'плашка — точно на середине связи');
{
  const nb2 = await page.locator('.node[data-id="c"]').boundingBox();
  await page.mouse.move(nb2.x + 60, nb2.y + 18); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(nb2.x + 60, nb2.y + 18 + i * 25);
  await page.mouse.up(); await page.waitForTimeout(1800);   // блок «доезжает» плавно — плашка встаёт после остановки
  check(await chipOnEdge() < 4, 'после перетаскивания блока плашка переехала на середину связи (' + Math.round(await chipOnEdge()) + ' px)');
}
await page.mouse.move(700, 450);
await page.keyboard.down('Control'); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(80); } await page.keyboard.up('Control');
await page.waitForTimeout(600);
const k = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).cam.k);
check(k < 0.9 && await chipOnEdge() < 4, 'при масштабе ' + Math.round(k * 100) + '% плашка на середине связи (' + Math.round(await chipOnEdge()) + ' px)');
// копия пространства — те же ID блоков, но запуска в ней ещё не было: чужие результаты не показываются
await page.keyboard.press('Control+k'); await page.keyboard.type('Дублировать пространство'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
{
  const bc = await page.locator('.node[data-id="c"]').boundingBox(); await page.mouse.click(bc.x + bc.width / 2, bc.y + 20, { button: 'right' }); await page.waitForTimeout(400);
  check(await page.locator('.df-chip').count() === 0 && !/Результат последнего запуска/.test(await page.textContent('#pop')), 'в копии пространства (те же ID блоков) результатов прошлого запуска нет');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.keyboard.press('Control+r');
  await page.waitForFunction(() => !document.querySelector('#runp.busy') && /успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {});
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  check(await page.locator('.df-chip').count() === 1, 'после запуска копии плашка появилась');
}
await page.keyboard.press('Control+k'); await page.keyboard.type('Скрыть данные на связях'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
check(await page.locator('.df-chip').count() === 0, 'плашки можно скрыть командой');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
