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
check(cards.length === 10, 'в экосистеме 10 сред: ' + cards.join(', '));
check(await page.$$eval('#ecoGrid .eco-card.soon', (x) => x.length) === 0, 'карточек «скоро» не осталось');

// [среда, пример (часть названия в меню, пусто — первый), ожидаемые строки журнала]
const cases = [
  ['Склад и логистика', '', ['Точка заказа — Заказать: 4 из 6', 'Резерв под заказы — Собрано полностью: 4 из 6', 'Рейсы доставки — Рейсов: 3']],
  ['Склад и логистика', 'Оборотка', ['Оборотная ведомость — Позиций: 6', 'Результаты инвентаризации — Излишки 1 260 руб., недостачи 4 010 руб.', 'XYZ-анализ спроса — X: 2 · Y: 1 · Z: 2', 'Оптимальная партия — Затраты']],
  ['Производство (MES)', '', ['OEE оборудования — Средний OEE', 'Парето простоев — Главных причин: 3 из 5', 'Сменное задание — Линия 1']],
  ['Производство (MES)', 'Материалы', ['Потребность в материалах — Материалов: 6, закупить: 3', 'Загрузка линий на неделю — Линия 1 100.5% · Линия 2 86.3% — перегруз: 1', 'Надёжность оборудования — Ниже нормы: 2 из 4']],
  ['Финансы и бюджет', '', ['Платёжный календарь — Остаток на конец', 'разрыв', 'План-факт расходов — Вне допуска: 2 из 6']],
  ['Финансы и бюджет', 'Кредит', ['Кредит на оборудование — Переплата', 'Окупаемость проекта — Проект окупается: NPV 2 1', 'Акт сверки — Расхождений: 3 на 669 000 руб.', 'Точка безубыточности — В зоне риска: 3 из 4']],
  ['Персонал и табель', '', ['Расчёт зарплаты — Фонд оплаты', 'Премия по KPI — Выполнили план: 3 из 5']],
  ['Персонал и табель', 'Вакансии', ['Вакансии по штату — Вакансий: 6', 'Текучесть кадров — По компании: 19.8%, высокая в 3', 'Пересечения отпусков — С конфликтом: 2 из 6', 'Страховые взносы — Взносы за месяц']],
  ['Продажи и CRM', '', ['Воронка продаж — Сквозная конверсия', 'Зависшие сделки — Зависло', 'Прогноз выручки — Прогноз']],
  ['Продажи и CRM', 'RFM', ['RFM-сегменты клиентов — ', 'Уходящие ценные', 'Расчёт прайс-листа — Дороже конкурента', 'Выполнение плана — Вне допуска: 1 из 3']],
  ['Аналитика и дашборды', '', ['Выручка: подразделения × месяцы — 2 × 3', 'Выручка за период — Выручка: 34', 'Факт + план — Объединено: 2 из 2']],
  ['Аналитика и дашборды', 'Год к году', ['Год к году — Рост в 10 из 10', 'Прогноз выручки — Прогноз через 3 пер.', 'Дашборд руководителя — Показателей: 3, диаграмм: 2', 'Подозрительные платежи — Выбросов: 2 из 10']]
];
for (const [name, demo, lines] of cases) {
  console.log(name + (demo ? ' · ' + demo : ''));
  if (!(await page.isVisible('#eco'))) { await page.click('#ecoBtn'); await page.waitForTimeout(200); }
  const card = page.locator('#ecoGrid .eco-card.go', { hasText: name });
  await card.locator('button', { hasText: 'Пример' }).click(); await page.waitForTimeout(250);
  const item = page.locator('#ctx .ctx-i', { hasText: demo || 'пример' }).first();
  if (demo) await page.locator('#ctx .ctx-i', { hasText: demo }).first().click(); else await page.locator('#ctx .ctx-i').first().click();
  await page.waitForTimeout(600);
  const n = await page.$$eval('.node', (x) => x.length);
  check(n >= 9, 'пример открыт, блоков: ' + n);
  check((await page.textContent('#envName')) === name, 'среда переключилась');
  await page.click('#topRun'); await page.waitForTimeout(500 + n * 120);
  const out = (await page.textContent('#runOut')).replace(/[\u00a0\u202f]/g, ' ');
  check(!/ошибка/i.test(out) && !/✗/.test(out), 'расчёт без ошибок');
  for (const l of lines) check(out.includes(l), '«' + l + '»');
  if (/ошибка|✗/i.test(out) || lines.some((l) => !out.includes(l))) console.log(out);
  const res = await page.$$eval('#resW .res-i', (x) => x.length);
  check(res > 0, 'окно результатов: ' + res);
  if (name.startsWith('Аналитика') && !demo) {
    await page.locator('#resW .res-i', { hasText: 'Динамика выручки' }).click(); await page.waitForTimeout(200);
    check(await page.frameLocator('#resW .res-frame').locator('svg polyline').count() === 1, 'диаграмма-линия нарисована');
  }
  if (demo === 'Год к году') {
    await page.locator('#resW .res-i', { hasText: 'Дашборд' }).first().click(); await page.waitForTimeout(250);
    const fr = page.frameLocator('#resW .res-frame');
    check(await fr.locator('svg').count() === 2 && (await fr.locator('body').textContent()).includes('% от цели'), 'дашборд: 3 плитки и 2 графика');
  }
  if (demo === 'Вакансии') {
    await page.locator('#resW .res-i', { hasText: 'Взносы по сотрудникам' }).click(); await page.waitForTimeout(200);
    check(await page.frameLocator('#resW .res-frame').locator('svg path').count() === 4, 'круговая диаграмма: 4 сектора');
  }
  await page.click('#resClose');
  const boxes = await page.$$eval('.node', (x) => x.map((e, i) => { const r = e.getBoundingClientRect(); return { i, x: r.x, y: r.y }; }));
  const pick = boxes.find((b) => b.y > 90 && b.y < 480 && b.x > 380);
  const op = pick ? (await page.$$('.node'))[pick.i] : null;
  if (op) { await op.click({ button: 'right' }); await page.waitForTimeout(250); check(await page.$$eval('#pop .prm-f', (x) => x.length) > 0 || await page.isVisible('#pop'), 'карточка блока открывается'); await page.keyboard.press('Escape'); }
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
