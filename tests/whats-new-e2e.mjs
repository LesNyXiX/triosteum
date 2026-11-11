// «Что нового»: команда палитры открывает список доступных новинок; «Попробовать» ведёт к функции.
// Запуск: npm run build && node tests/whats-new-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { if (window.top !== window || localStorage.getItem('__seeded')) return; localStorage.setItem('__seeded', '1'); localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(3200);
const n = await page.evaluate(() => document.querySelectorAll('.wn-card').length);
await page.keyboard.press('Control+k'); await page.keyboard.type('Что нового'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
check(await page.isVisible('#wnW'), 'палитра команд → «Что нового» открывает окно');
const items = await page.locator('#wnW .wn-i').count();
check(items >= 1 && /История запусков/.test(await page.textContent('#wnW')), 'в окне — только уже доступные возможности (' + items + ')');
check(n === (items >= 2 ? 1 : 0), 'карточка-напоминание: ' + (items >= 2 ? 'показана' : 'не показана, пока новинок меньше двух'));
await page.locator('#wnW .wn-i', { hasText: 'История запусков' }).locator('button').click(); await page.waitForTimeout(300);
check(!(await page.isVisible('#wnW')) && await page.isVisible('#runHist'), '«Попробовать» ведёт к функции (вкладка «История»)');
check(await page.evaluate(() => localStorage.getItem('triosteum.seen.whatsnew')) === '"2026-11-11"', 'после закрытия больше не напоминает');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
