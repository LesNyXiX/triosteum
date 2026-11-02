// Быстрая проверка собранного docs/index.html в настоящем браузере.
// Перед запуском: npm install && npx playwright install chromium && npm run build
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
const seed = {
  nodes: [
    { id: 'a', name: 'Блок A', lang: 'python', x: 140, y: 140, codes: {} },
    { id: 'b', name: 'Блок B', lang: 'python', x: 520, y: 320, codes: {} }
  ],
  edges: [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 10
};
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((g) => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Тест', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
}, seed);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(700);

console.log('Доска');
check(await page.$$eval('.node', (x) => x.length) === 2, 'блоки загружены из хранилища');
check(await page.$$eval('.edge-hit', (x) => x.length) === 1, 'связь нарисована');

const a = await page.$('.node[data-id="a"]'); const box = await a.boundingBox();
await page.mouse.move(box.x + 60, box.y + 40); await page.mouse.down();
await page.mouse.move(box.x + 160, box.y + 90, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(600);
const left = await a.evaluate((n) => parseFloat(n.style.left));
check(Math.abs(left - 240) < 2, 'перетаскивание блока');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).nodes[0].x);
check(Math.abs(saved - 240) < 2, 'позиция сохранена через Store');

await page.mouse.click(box.x + 160, box.y + 90, { button: 'right' }); await page.waitForTimeout(300);
check(await page.evaluate(() => !document.getElementById('pop').hidden), 'ПКМ открывает настройки блока');
await page.keyboard.press('Escape');

console.log('Первый вход');
const fresh = await (await browser.newContext()).newPage();
await fresh.goto(URL); await fresh.waitForTimeout(500);
check(await fresh.isVisible('#welcome'), 'новый посетитель видит «Добро пожаловать»');
await fresh.fill('#wcName', 'Иван'); await fresh.fill('#wcOrg', 'Завод'); await fresh.click('.wc-go'); await fresh.waitForTimeout(800);
check(!(await fresh.$('#welcome')) && await fresh.isVisible('.eco'), 'после входа — выбор среды');

console.log('Среды');
await page.click('#ecoBtn'); await page.waitForTimeout(300);
check(await page.$$eval('.eco-card', (x) => x.length) >= 2, 'экран экосистемы со средами');

console.log('Ошибки');
check(errors.length === 0, 'нет ошибок JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
