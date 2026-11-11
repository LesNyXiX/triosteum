// Группы блоков: Ctrl+G, название, перетаскивание целиком, запуск только группы, отмена, хранение, разгруппировка.
// Запуск: npm run build && node tests/groups-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// по http: на file:// Chromium иногда теряет localStorage при перезагрузке, а тест проверяет именно хранение
const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, y) => ({ id, name, lang: 'cpp', x, y, codes: { cpp: 'int run(){ return 1; }' }, pluginId: null, family: null, desc: '', colors: null });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((g) => {
  if (window.top !== window || localStorage.getItem('__seeded')) return; /* один раз; метка в localStorage: на file:// Chromium иногда теряет sessionStorage при перезагрузке */ localStorage.setItem('__seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Группы', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
}, { nodes: [node('a', 'Сбор 1', 160, 200), node('b', 'Сбор 2', 160, 380), node('c', 'Отчёт', 620, 290)], edges: [{ id: 'e1', from: 'a', to: 'c', taps: [] }, { id: 'e2', from: 'b', to: 'c', taps: [] }], notes: [{ id: 't1', text: 'Комментарий', attach: 'a', dx: -200, dy: 0, x: -40, y: 200, size: 's', tint: 'grey', hidden: false, auto: false }], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);
const graph = async () => { await page.waitForTimeout(700); return page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1'))); };
const center = async (id) => { const b = await page.locator(`.node[data-id="${id}"]`).boundingBox(); return [b.x + b.width / 2, b.y + 18]; };

console.log('Создание');
let [x, y] = await center('a'); await page.mouse.click(x, y);
[x, y] = await center('b'); await page.keyboard.down('Shift'); await page.mouse.click(x, y); await page.keyboard.up('Shift');
await page.keyboard.press('Control+g'); await page.waitForTimeout(300);
check(await page.locator('.grp').count() === 1, 'Ctrl+G — рамка группы появилась');
check(await page.locator('.grp .grp-in').count() === 1, 'сразу можно ввести название');
await page.keyboard.press('Control+a'); await page.keyboard.type('Сбор данных'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
let g = await graph();
check(g.groups && g.groups[0].name === 'Сбор данных' && g.groups[0].ids.sort().join() === 'a,b', 'группа сохранена: название и два блока');
const fb = await page.locator('.grp').boundingBox(), ab = await page.locator('.node[data-id="a"]').boundingBox(), bb = await page.locator('.node[data-id="b"]').boundingBox();
check(fb.x < ab.x && fb.y < ab.y && fb.x + fb.width > bb.x + bb.width && fb.y + fb.height > bb.y + bb.height, 'рамка охватывает оба блока');
console.log('Перетаскивание за заголовок');
const cb = await page.locator('.note[data-id="t1"]').boundingBox();
const hb = await page.locator('.grp-name').boundingBox();
await page.mouse.move(hb.x + 10, hb.y + 8); await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(hb.x + 10 + i * 10, hb.y + 8 + i * 5);
await page.mouse.up(); await page.waitForTimeout(200);
g = await graph();
const na = g.nodes.find((n) => n.id === 'a'), nb = g.nodes.find((n) => n.id === 'b'), nc = g.nodes.find((n) => n.id === 'c');
check(na.x === 240 && na.y === 240 && nb.x === 240 && nb.y === 420 && nc.x === 620, 'двигаются блоки группы, остальные на месте');
const fb2 = await page.locator('.grp').boundingBox();
check(Math.abs(fb2.x - fb.x - 80) < 2, 'рамка переехала вместе с блоками');
const cb2 = await page.locator('.note[data-id="t1"]').boundingBox(), nt = g.notes.find((t) => t.id === 't1');
check(Math.abs(cb2.x - cb.x - 80) < 2 && Math.abs(cb2.y - cb.y - 40) < 2 && nt.x === 40 && nt.y === 240, 'прикреплённый комментарий переехал вместе с группой (на экране и в данных)');
console.log('Перетаскивание одного блока группы (быстрый путь связей)');
{
  const before = await page.locator('.grp').boundingBox();
  const [sx, sy] = await center('a');
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(sx - i * 10, sy);
  await page.mouse.up(); await page.waitForTimeout(500);
  const after = await page.locator('.grp').boundingBox(), na2 = await page.locator('.node[data-id="a"]').boundingBox();
  check(after.x < before.x - 40 && after.x < na2.x, 'рамка расширилась за блоком, сдвинутым влево');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
  const back = await page.locator('.grp').boundingBox();
  check(Math.abs(back.x - before.x) < 2, 'после отмены рамка вернулась');
}
console.log('Запуск группы');
await page.locator('.grp-b[aria-label="Запустить только эту группу"]').click();
await page.waitForFunction(() => !document.querySelector('#runp.busy') && /успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {});
const log = await page.textContent('#runOut');
check(/Порядок выполнения: Сбор 1 → Сбор 2\s*$/m.test(log) || (/Сбор 1/.test(log) && /Сбор 2/.test(log) && !/▶ Отчёт/.test(log)), 'запускаются только блоки группы');
await page.keyboard.press('Escape');
console.log('Отмена, хранение, меню');
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);   // отменили перетаскивание
g = await graph();
check(g.nodes.find((n) => n.id === 'a').x === 160 && g.groups.length === 1, 'Ctrl+Z отменяет перемещение группы');
await page.waitForTimeout(1200);   // дать записи в IndexedDB завершиться до перезагрузки
await page.reload(); await page.waitForTimeout(1000);
check(await page.locator('.grp').count() === 1 && await page.textContent('.grp-name') === 'Сбор данных', 'после перезагрузки группа на месте');
await page.locator('.grp-b[aria-label="Действия с группой"]').click(); await page.waitForTimeout(300);
await page.locator('.ctx .ctx-i', { hasText: 'Разгруппировать' }).click(); await page.waitForTimeout(300);
g = await graph();
check(await page.locator('.grp').count() === 0 && (!g.groups || !g.groups.length) && g.nodes.length === 3, 'разгруппировать: рамки нет, блоки на месте');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
