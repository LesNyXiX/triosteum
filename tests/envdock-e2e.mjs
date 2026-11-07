// Док сред внизу (как на Mac): увеличение у курсора, подписи, переключение среды, режимы.
// Запуск: npm run build && node tests/envdock-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.addInitScript(() => { localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); });
await page.goto(URL); await page.waitForTimeout(900);

console.log('Вид');
const n = await page.locator('#envDock .ed-i').count();
check(n >= 5, 'в доке значки всех сред и «Все среды»: ' + n);
check(await page.locator('#envDock .ed-i[aria-current="true"]').count() === 1 && /Разработка/.test(await page.getAttribute('#envDock .ed-i[aria-current="true"]', 'aria-label')), 'открытая среда отмечена');
check(await page.locator('#envDock .ed-dot.here').count() === 1, 'под открытой средой — точка');
const w0 = (await page.locator('#envDock .ed-i').nth(2).boundingBox()).width;
const r2 = await page.locator('#envDock .ed-i').nth(2).boundingBox();
await page.mouse.move(r2.x + r2.width / 2, r2.y + r2.height / 2, { steps: 5 }); await page.waitForTimeout(350);
const w1 = (await page.locator('#envDock .ed-i').nth(2).boundingBox()).width, wN = (await page.locator('#envDock .ed-i').nth(3).boundingBox()).width, wF = (await page.locator('#envDock .ed-i').nth(7).boundingBox()).width;
check(w1 > w0 * 1.4 && wN > w0 && wN < w1 && Math.abs(wF - w0) < 2, 'под курсором значок крупнее, соседи — чуть, дальние — как были (' + [w0, w1, wN, wF].map(Math.round).join('/') + ')');
check(await page.locator('#envDock .ed-i').nth(2).locator('.ed-tip').evaluate((x) => getComputedStyle(x).opacity) === '1', 'над значком — подпись');
await page.mouse.move(800, 300, { steps: 4 }); await page.waitForTimeout(400);
check(Math.abs((await page.locator('#envDock .ed-i').nth(2).boundingBox()).width - w0) < 2, 'увели курсор — значки вернулись');

console.log('Переключение');
const office = page.locator('#envDock .ed-i', { hasText: 'Офис' });
await office.click(); await page.waitForTimeout(120);
check(await office.evaluate((x) => x.classList.contains('jump')), 'щелчок — значок подпрыгивает');
await page.waitForTimeout(1100);
check(/Офис/.test(await page.textContent('#envChip')), 'открылась среда «Офис»');
check(/Офис/.test(await page.getAttribute('#envDock .ed-i[aria-current="true"]', 'aria-label')), 'точка переехала под «Офис»');
await page.locator('#envDock .ed-i', { hasText: 'Все среды' }).click(); await page.waitForTimeout(700);
check(await page.isVisible('#eco'), '«Все среды» открывает экосистему'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);

console.log('Клавиатура');
await page.locator('#envDock .ed-i').first().focus();
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement.classList.contains('kb') && [...document.querySelectorAll('#envDock .ed-i')].indexOf(document.activeElement) === 2), '← → переходят по значкам, подпись видна');
await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
check(!/Офис/.test(await page.textContent('#envChip')), 'Enter открывает выбранную среду');

console.log('Режимы');
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.locator('#pers button', { hasText: 'Прятать, пока не нужен' }).click(); await page.waitForTimeout(400);
await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(400);
await page.mouse.move(800, 400); await page.waitForTimeout(900);
const hidden = await page.$eval('#envDock', (x) => getComputedStyle(x).opacity);
const row = await page.locator('.row').boundingBox();
await page.mouse.move(800, row.y + row.height - 4, { steps: 3 }); await page.waitForTimeout(600);
check(hidden === '0' && await page.$eval('#envDock', (x) => getComputedStyle(x).opacity) === '1', '«Прятать»: док выезжает у нижнего края');
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.locator('#pers button', { hasText: 'Выключить' }).first().click(); await page.waitForTimeout(300);
check(!(await page.isVisible('#envDock')), '«Выключить»: дока нет');
await page.locator('#pers button', { hasText: 'Показывать' }).first().click(); await page.waitForTimeout(300);
check(await page.isVisible('#envDock'), '«Показывать»: док снова на месте');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
