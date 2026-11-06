// Корзина при перетаскивании: доска разработки и рабочий стол Офиса.
// Запуск: npm run build && node tests/trash-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Тест', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [{ id: 'a', name: 'Первый', lang: 'python', x: 200, y: 160, codes: {}, pluginId: null, family: null, desc: '', colors: null }, { id: 'b', name: 'Второй', lang: 'python', x: 600, y: 160, codes: {}, pluginId: null, family: null, desc: '', colors: null }], edges: [{ id: 'e1', from: 'a', to: 'b' }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);
const st = () => page.textContent('.status');

console.log('Доска');
check(!(await page.isVisible('.drop-trash .dt-ball')) || (await page.$eval('.drop-trash', (x) => !x.classList.contains('on')).catch(() => true)), 'без перетаскивания корзины нет');
let n = await page.locator('.node[data-id="b"] .ln, .node').nth(1).boundingBox();
await page.mouse.move(n.x + 30, n.y + 20); await page.mouse.down(); await page.mouse.move(n.x + 60, n.y + 60, { steps: 5 });
await page.waitForTimeout(400);
check(await page.$eval('.drop-trash', (x) => x.classList.contains('on')), 'начали тащить блок — внизу появилась корзина');
const cv = await page.locator('#canvas').boundingBox();
const tx = cv.x + cv.width / 2, ty = cv.y + cv.height - 64;
await page.mouse.move(n.x + 300, n.y + 300, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(500);
check(/Блоков: 2/.test(await st()) && await page.$eval('.drop-trash', (x) => !x.classList.contains('on')), 'отпустили мимо — блок на месте, корзина спряталась');
n = await page.locator('.node').nth(1).boundingBox();
await page.mouse.move(n.x + 30, n.y + 20); await page.mouse.down(); await page.mouse.move(n.x + 60, n.y + 60, { steps: 5 }); await page.mouse.move(tx, ty, { steps: 14 }); await page.waitForTimeout(300);
check(await page.$eval('.drop-trash', (x) => x.classList.contains('hot')) && /Отпустите/.test(await page.textContent('.dt-tip')), 'над корзиной — она открывается: «Отпустите — удалится»');
check(await page.locator('.node.to-trash').count() === 1, 'блок помечен к удалению');
await page.screenshot({ path: '/tmp/shots/trash-hot.png' });
await page.mouse.up(); await page.waitForTimeout(150);
check(await page.locator('.dt-fly').count() === 1, 'блок улетает в корзину (анимация)');
await page.waitForTimeout(900);
check(/Блоков: 1/.test(await st()) && /Связей: 0/.test(await st()), 'блок удалён вместе со связью');
await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
check(/Блоков: 2/.test(await st()), 'Ctrl+Z возвращает блок');

console.log('Офис');
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Офис' }).locator('button', { hasText: 'Пример офиса' }).click(); await page.waitForTimeout(900);
const count0 = await page.locator('#desk .fcard').count();
const card = await page.locator('#desk .fcard').first().boundingBox();
const desk = await page.locator('#desk').boundingBox();
await page.mouse.move(card.x + 40, card.y + 40); await page.mouse.down(); await page.mouse.move(card.x + 70, card.y + 70, { steps: 5 });
await page.waitForTimeout(350);
check(await page.$eval('.drop-trash', (x) => x.classList.contains('on')), 'тащим файл — корзина внизу рабочего стола');
await page.mouse.move(desk.x + desk.width / 2, desk.y + desk.height - 64, { steps: 14 }); await page.waitForTimeout(250);
check(await page.$eval('.drop-trash', (x) => x.classList.contains('hot')), 'над корзиной — горит');
await page.mouse.up(); await page.waitForTimeout(1100);
check(await page.locator('#desk .fcard').count() === count0 - 1, 'файл удалён');
check(/вернуть/i.test(await page.textContent('#toast')), 'подсказка, как вернуть');
await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
const back = await page.locator('#desk .fcard').count();
if (back !== count0) { await page.click('#desk', { button: 'right', position: { x: 20, y: desk.height - 20 } }); await page.waitForTimeout(200); await page.locator('.ctx-i', { hasText: 'Вернуть удалённое' }).click(); await page.waitForTimeout(400); }
check(await page.locator('#desk .fcard').count() === count0, 'удалённое возвращается');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
