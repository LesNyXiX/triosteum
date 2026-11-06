// Две среды рядом: вторая среда — живой Triosteum в прилипающем окне.
// Запуск: npm run build && node tests/split-e2e.mjs   (по http, как настоящий сайт)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const near = (a, b, d = 14) => Math.abs(a - b) <= d;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Схема', t: Date.now(), env: 'code' }, { id: 'p2', name: 'Бумаги', t: Date.now() - 1000, env: 'docs' }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [{ id: 'a', name: 'Блок', lang: 'python', x: 200, y: 160, codes: {}, pluginId: null, family: null, desc: '', colors: null }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3 }));
  localStorage.setItem('triosteum.proj.p2', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1, files: { items: [{ id: 'f1', type: 'folder', name: 'Договоры', parent: null, x: 24, y: 24, t: Date.now(), data: {} }], open: [] } }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);
const row = await page.locator('.row').boundingBox();

console.log('Открыть рядом');
await page.click('#splitBtn'); await page.waitForTimeout(250);
check(await page.locator('#ctx .ctx-i', { hasText: 'Бумаги' }).count() === 1 && await page.locator('#ctx .ctx-i', { hasText: 'Схема' }).count() === 0, 'в списке — другие пространства, текущего нет');
await page.locator('#ctx .ctx-i', { hasText: 'Бумаги' }).click(); await page.waitForTimeout(2200);
const w = await page.locator('#splitW').boundingBox(), cv = await page.locator('#canvas').boundingBox();
check(near(w.x + w.width, row.x + row.width, 8) && near(w.width, row.width / 2, 16), 'вторая среда заняла правую половину');
check(cv.x + cv.width <= w.x + 6, 'доска главной среды ужалась влево');
check(/Бумаги · Офис/.test(await page.textContent('#splitW .split-h h2')), 'в заголовке — пространство и среда');
const fr = page.frameLocator('#splitW iframe');
check(await fr.locator('#desk .fcard', { hasText: 'Договоры' }).count() === 1, 'во второй среде открыт Офис с файлами');
check(/Блоков: 1/.test(await page.textContent('.status')), 'главная среда — своя доска');

console.log('Работа в обеих');
await fr.locator('#desk').click({ button: 'right', position: { x: 400, y: 300 } }); await page.waitForTimeout(250);
const newDoc = fr.locator('#ctx .ctx-i', { hasText: 'Документ' }).first();
if (await newDoc.count()) { await newDoc.click(); await page.waitForTimeout(600); }
await page.waitForTimeout(800);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p2')).files.items.length);
check(stored >= 2, 'правка во второй среде сохранилась в своё пространство');
check(await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.projects')).cur) === 'p1', 'главное «текущее пространство» не сбилось');
await page.locator('.node').first().click(); await page.keyboard.press('Control+d'); await page.waitForTimeout(700);
check(/Блоков: 2/.test(await page.textContent('.status')), 'в главной среде можно работать одновременно');

console.log('Поменять местами');
await page.click('#splitW button[aria-label="Поменять среды местами"]'); await page.waitForTimeout(2200);
check(/Офис/.test(await page.textContent('#envChip')) && /Бумаги/.test(await page.textContent('#projName')) && /Схема · Разработка/.test(await page.textContent('#splitW .split-h h2')), 'среды поменялись местами');
check(/Блоков: 2/.test(await fr.locator('.status').textContent()), 'во второй среде — доска с обоими блоками');

console.log('Перезагрузка и закрытие');
await page.reload(); await page.waitForTimeout(2500);
check(await page.isVisible('#splitW') && /Схема/.test(await page.textContent('#splitW .split-h h2')), 'после перезагрузки вторая среда открыта снова');
await page.click('#splitW button[aria-label="Закрыть"]'); await page.waitForTimeout(900);
check(!(await page.isVisible('#splitW')) && await page.evaluate(() => getComputedStyle(document.querySelector('.row')).paddingRight) === '0px', 'закрыли — главная среда снова во всю ширину');
await page.reload(); await page.waitForTimeout(1500);
check(!(await page.isVisible('#splitW')), 'закрытая вторая среда после перезагрузки не открывается');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await page.screenshot({ path: '/tmp/shots/split-end.png' });
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
