// Библиотека по разделам и окно «Поиск и команды» с разделами.
// Запуск: npm run build && node tests/library-e2e.mjs
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
await page.addInitScript(() => { localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); });
await page.goto(URL); await page.waitForTimeout(900);

console.log('Библиотека');
await page.click('#bLib'); await page.waitForTimeout(400);
const cats = await page.$$eval('.lib-cat .nm', (x) => x.map((e) => e.textContent));
check(cats.length >= 9 && cats.includes('Финансы и экономика') && cats.includes('Склад и закупки'), 'слева разделы: ' + cats.length);
const total = Number((await page.textContent('.lib-cat.on .n')).trim());
check(total >= 60, 'плагинов в библиотеке: ' + total);
check(await page.locator('.pgroup-h').count() >= 8, 'карточки сгруппированы по разделам');
await page.locator('.lib-cat', { hasText: 'Склад и закупки' }).click(); await page.waitForTimeout(200);
const n = Number((await page.textContent('.lib-cat.on .n')).trim());
check(await page.locator('.pcard').count() === n && await page.locator('.pgroup-h').count() === 0, 'раздел «Склад и закупки» — только его карточки (' + n + ')');
await page.locator('#chips .chip', { hasText: 'Python' }).click(); await page.waitForTimeout(200);
check(await page.$$eval('.pcard .lbadge', (x) => x.every((e) => e.textContent === 'Python')), 'фильтр по языку: только Python');
await page.locator('#chips .chip', { hasText: 'Все' }).click();
await page.locator('.lib-cat', { hasText: 'Все разделы' }).click(); await page.waitForTimeout(150);
await page.fill('#libSearch', 'telegram'); await page.waitForTimeout(250);
check(await page.locator('.pcard', { hasText: 'Telegram' }).count() === 1 && /Найдено: 1/.test(await page.textContent('#libHint')), 'поиск находит «Telegram»');
await page.fill('#libSearch', ''); await page.waitForTimeout(200);
const more = page.locator('.pgroup-h button', { hasText: 'Весь раздел' }).first();
if (await more.count()) { await more.click(); await page.waitForTimeout(200); check(await page.locator('.pgroup-h').count() === 0 && await page.locator('.lib-cat.on').count() === 1 && !/Все разделы/.test(await page.textContent('.lib-cat.on')), '«Весь раздел →» открывает раздел'); }
await page.locator('.lib-cat', { hasText: 'Персонал' }).click(); await page.waitForTimeout(150);
await page.locator('.pcard', { hasText: 'Отпускные' }).locator('button.open').click(); await page.waitForTimeout(600);
check(await page.locator('.node', { hasText: 'Отпускные' }).count() === 1, 'плагин из раздела открывается на доске');

console.log('Поиск и команды');
await page.keyboard.press('Escape'); await page.mouse.click(900, 600); await page.keyboard.press('Escape');
await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
const secs = await page.$$eval('#cmdNav .cmdk-s .nm', (x) => x.map((e) => e.textContent));
check(secs[0] === 'Все' && secs.includes('Добавить') && secs.includes('Файл и экспорт') && secs.includes('Справка и настройки'), 'слева разделы команд');
check(await page.locator('.cmdk-i .d').count() > 10, 'у команд есть пояснения');
await page.keyboard.press('Tab'); await page.waitForTimeout(150);
check(/Добавить|На доске/.test(await page.textContent('#cmdNav .cmdk-s.on')) && await page.locator('.cmdk-g').count() === 0, 'Tab — следующий раздел, показан только он');
await page.keyboard.type('экспорт'); await page.waitForTimeout(250);
check(await page.locator('.cmdk-i mark').count() >= 1 && /Найдено/.test(await page.textContent('#cmdCount')), 'поиск подсвечивает совпадение и считает результаты');
await page.fill('#cmdQ', 'маржа'); await page.waitForTimeout(250);
check(await page.locator('#cmdNav .cmdk-s', { hasText: 'Плагины' }).count() === 1, 'при поиске находятся и плагины');
await page.fill('#cmdQ', 'мини-карт'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
check(/мини-карт/.test(await page.textContent('#cmdList')) && await page.locator('.cmdk-g', { hasText: 'Недавние' }).count() === 1, 'выполненная команда — в «Недавних»');
await page.keyboard.press('Escape');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
