// Тур для новичка: после первого входа и выбора среды, листание, повтор из поиска команд.
// Запуск: npm run build && node tests/tour-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);

console.log('Первый вход');
check(await page.isVisible('#welcome'), 'экран «Добро пожаловать»');
await page.fill('#wcName', 'Анна Смирнова'); await page.fill('#wcOrg', 'ООО «Завод»'); await page.click('.wc-go'); await page.waitForTimeout(900);
check(await page.isVisible('#eco'), 'дальше — выбор среды');
check(!(await page.isVisible('.tour')), 'тур не мешает выбору среды');
await page.locator('.eco-card.go', { hasText: 'Разработка' }).first().click(); await page.waitForTimeout(1200);
check(await page.isVisible('.tour'), 'после выбора среды начался тур');
check(/1 из \d/.test(await page.textContent('.tour-n')), 'видно номер шага');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);
const hole = await page.locator('.tour-hole').boundingBox(), add = await page.locator('#bAdd').boundingBox();
check(/Блоки/.test(await page.textContent('.tour-card h3')) && hole.x <= add.x && hole.x + hole.width >= add.x + add.width, '→ — второй шаг подсвечивает кнопку добавления');
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(300);
check(/1 из/.test(await page.textContent('.tour-n')), '← — назад');
const n = Number((await page.textContent('.tour-n')).match(/из (\d+)/)[1]);
for (let i = 0; i < n - 1; i++) { await page.click('.tour-btns .btn.primary'); await page.waitForTimeout(250); }
check(/Готово/.test(await page.textContent('.tour-btns .btn.primary')), 'на последнем шаге — «Готово»');
// карточка всегда в пределах экрана
let inside = true;
const c = await page.locator('.tour-card').boundingBox(); if (c.x < 0 || c.y < 0 || c.x + c.width > 1440 || c.y + c.height > 900) inside = false;
check(inside, 'карточка не уходит за край экрана');
await page.click('.tour-btns .btn.primary'); await page.waitForTimeout(400);
check(!(await page.isVisible('.tour')), 'тур закрылся');
await page.reload(); await page.waitForTimeout(1200);
check(!(await page.isVisible('.tour')), 'после перезагрузки тур больше не показывается');

console.log('Повтор');
await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
await page.keyboard.type('тур'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
check(await page.isVisible('.tour'), 'Ctrl+K → «тур» — тур снова');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
check(!(await page.isVisible('.tour')), 'Esc закрывает тур');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
