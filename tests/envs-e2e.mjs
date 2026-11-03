// Отраслевые среды: каждый пример открывается, считается без ошибок и даёт результаты.
// Запуск: npm run build && node tests/envs-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 } });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Тест', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(800);

await page.click('#ecoBtn'); await page.waitForTimeout(200);
const cards = await page.$$eval('#ecoGrid .eco-card.go h3', (x) => x.map((h) => h.textContent));
check(cards.length === 8, 'в экосистеме 8 сред: ' + cards.join(', '));
check(await page.$$eval('#ecoGrid .eco-card.soon', (x) => x.length) === 0, 'карточек «скоро» не осталось');

const expect = {
  'Склад и логистика': ['Точка заказа — Заказать: 4 из 6', 'Резерв под заказы — Собрано полностью: 4 из 6', 'Рейсы доставки — Рейсов: 3'],
  'Производство (MES)': ['OEE оборудования — Средний OEE', 'Парето простоев — Главных причин: 3 из 5', 'Сменное задание — Линия 1'],
  'Финансы и бюджет': ['Платёжный календарь — Остаток на конец', 'разрыв', 'План-факт расходов — Вне допуска: 2 из 6'],
  'Персонал и табель': ['Расчёт зарплаты — Фонд оплаты', 'Премия по KPI — Выполнили план: 3 из 5'],
  'Продажи и CRM': ['Воронка продаж — Сквозная конверсия', 'Зависшие сделки — Зависло', 'Прогноз выручки — Прогноз'],
  'Аналитика и дашборды': ['Выручка: подразделения × месяцы — 2 × 3', 'Выручка за период — Выручка: 34', 'Факт + план — Объединено: 2 из 2']
};
for (const [name, lines] of Object.entries(expect)) {
  console.log(name);
  if (!(await page.isVisible('#eco'))) { await page.click('#ecoBtn'); await page.waitForTimeout(200); }
  const card = page.locator('#ecoGrid .eco-card.go', { hasText: name });
  await card.locator('button', { hasText: 'Пример' }).click(); await page.waitForTimeout(500);
  const n = await page.$$eval('.node', (x) => x.length);
  check(n >= 9, 'пример открыт, блоков: ' + n);
  check((await page.textContent('#envName')) === name, 'среда переключилась');
  await page.click('#topRun'); await page.waitForTimeout(400 + n * 120);
  const out = await page.textContent('#runOut');
  check(!/ошибка/i.test(out), 'расчёт без ошибок');
  for (const l of lines) check(out.includes(l), '«' + l + '»');
  const res = await page.$$eval('#resW .res-i', (x) => x.length);
  check(res > 0, 'окно результатов: ' + res);
  if (name.startsWith('Аналитика')) {
    await page.locator('#resW .res-i', { hasText: 'Динамика выручки' }).click(); await page.waitForTimeout(200);
    const svg = await page.frameLocator('#resW .res-frame').locator('svg polyline').count();
    check(svg === 1, 'диаграмма-линия нарисована');
  }
  await page.click('#resClose');
  // параметры расчётного блока в карточке
  const op = await page.$('.node:nth-of-type(2)');
  if (op) { await op.click({ button: 'right' }); await page.waitForTimeout(250); check(await page.$$eval('#pop .prm-f', (x) => x.length) > 0, 'параметры блока в карточке'); await page.keyboard.press('Escape'); }
}
console.log('Офис и Разработка после отраслевых сред');
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Офис' }).locator('button', { hasText: 'Пример офиса' }).click(); await page.waitForTimeout(700);
check(await page.isVisible('#office'), 'рабочий стол «Офиса» открылся');
check((await page.getAttribute('body', 'data-mode')) === 'office', 'режим офиса');
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Склад' }).click(); await page.waitForTimeout(500);
check(!(await page.isVisible('#office')) && (await page.getAttribute('body', 'data-mode')) === 'code', 'в «Складе» рабочего стола офиса нет');
check(!(await page.isVisible('#otabs')), 'вкладки офиса скрыты');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\nНе прошло: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
