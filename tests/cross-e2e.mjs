// Сквозная компиляция: запрос ссылается на таблицу и блок из других пространств и сред —
// Triosteum ставит живые ссылки и компилирует всё одним маршрутом (без ИИ и с ИИ).
// Запуск: npm run build && node tests/cross-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const CS = 'public class B { public object Run(List<Dictionary<string, object>> rows){ return rows.Select(r => new { Товар = r["Товар"], Дефицит = Math.Max(0, Convert.ToDouble(r["Прогноз"]) - Convert.ToDouble(r["Остаток"])) }).ToList(); } }';
await ctx.addInitScript((cs) => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Анализ', t: 3, env: 'code' }, { id: 'p2', name: 'Склад', t: 2, env: 'docs' }, { id: 'p3', name: 'Продажи', t: 1, env: 'code' }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1 }));
  localStorage.setItem('triosteum.proj.p2', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1,
    files: { items: [{ id: 'f1', type: 'sheet', name: 'Остатки на складах', t: 1, data: { sheets: [{ name: 'Лист1', rows: [['Товар', 'Остаток', 'Прогноз'], ['Лист 4 мм', '10', '25'], ['Электроды', '50', '30']], fmt: {}, widths: {}, charts: [] }] } }], open: [], active: 'desk' } }));
  localStorage.setItem('triosteum.proj.p3', JSON.stringify({ nodes: [{ id: 'n1', name: 'Расчёт дефицита', lang: 'csharp', x: 100, y: 100, codes: { csharp: cs }, pluginId: null, family: null, desc: 'прогноз минус остаток', colors: null }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 2 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
  const projects = JSON.parse(localStorage.getItem('triosteum.projects'));
  projects.list.push({ id: 'p4', name: 'Финансы', t: 0, env: 'finance' });
  localStorage.setItem('triosteum.projects', JSON.stringify(projects));
  localStorage.setItem('triosteum.proj.p4', JSON.stringify({ nodes: [{ id: 'filter', name: 'Вне бюджета', lang: 'cond', x: 0, y: 0, codes: {}, desc: 'Статьи с перерасходом' }], edges: [], notes: [], seq: 2 }));
  const office = JSON.parse(localStorage.getItem('triosteum.proj.p2'));
  office.files.items.push({ id: 'budget', type: 'sheet', name: 'Бюджет отдела', t: 1, data: { sheets: [{ name: 'План', rows: [['Статья', 'План', 'Факт'], ['Материалы', '100', '120']], fmt: {}, widths: {}, charts: [] }] } },
    { id: 'report', type: 'doc', name: 'Отчёт об исполнении бюджета', t: 1, data: { html: '<p>Статья: {{Статья}}</p>' } });
  localStorage.setItem('triosteum.proj.p2', JSON.stringify(office));
}, CS);
// подмена ИИ (Claude) для второй части
let lastPrompt = '';
await ctx.route('https://api.anthropic.com/v1/messages', async (route) => {
  lastPrompt = JSON.parse(route.request().postData()).messages[0].content;
  const json = { title: 'Дефицит по складу', summary: 'Остатки и расчёт из других пространств, итог в HTML.', blocks: [{ key: 'b1', ref: 'x1' }, { key: 'b2', ref: 'x2' }, { key: 'b3', new: true, name: 'Отчёт', lang: 'html', desc: 'виджет', code: '<p>Отчёт</p>' }], links: [{ from: 'b1', to: 'b2' }, { from: 'b2', to: 'b3' }] };
  const text = '```json\n' + JSON.stringify(json) + '\n```';
  const ev = (t, d) => 'event: ' + t + '\ndata: ' + JSON.stringify(d) + '\n\n';
  return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) + ev('message_stop', { type: 'message_stop' }) });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);
const PROMPT = 'Возьми таблицу «Остатки на складах» и расчёт дефицита из других пространств, выведи дефицит';

console.log('Без ИИ: найти в других средах и скомпилировать');
await page.click('#aiFab'); await page.waitForTimeout(250);
await page.fill('#arcW .arc-in', PROMPT); await page.waitForTimeout(400);
const found = await page.$eval('#arcW .arc-x', (x) => x.textContent);
check(/Остатки на складах/.test(found) && /Расчёт дефицита/.test(found) && /Офис/.test(found), 'под задачей видно найденное в других пространствах и средах');
await page.click('#arcW button:has-text("Собрать из готового и скомпилировать")'); await page.waitForTimeout(2200);
const refs = await page.$$eval('#nodes .node.xref', (x) => x.map((d) => d.querySelector('.nt').textContent));
check(refs.length === 2 && refs.includes('Остатки на складах') && refs.includes('Расчёт дефицита'), 'на доске две ссылки: таблица из «Офиса» и блок C# из «Продажи»');
check(await page.$$eval('.edge-g', (x) => x.length) === 1, 'таблица связана с расчётом (источник → обработка)');
check(!(await page.$eval('#runp', (x) => x.hidden)), 'компилятор запустился сам');
const closeRes = async () => { if (await page.isVisible('#resW')) { await page.click('#resClose'); await page.waitForTimeout(350); } };
const blocksTxt = async () => { await closeRes(); await page.click('.runp-tabs [data-rt="blocks"]'); return page.$eval('#runBlocks', (x) => x.textContent); };
let bt = await blocksTxt();
check(/Дефицит/.test(await page.$eval('#runOut', (x) => x.textContent) + bt) || /Записей на выходе: 2/.test(bt), 'C# посчитал по данным таблицы из другого пространства');
check(await page.$eval('#rtErrs', (x) => x.textContent) === '0', 'ошибок нет');
// живая ссылка: меняем таблицу в источнике — следующий запуск берёт новые данные
await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('triosteum.proj.p2')); g.files.items[0].data.sheets[0].rows.push(['Краска', '0', '7']); localStorage.setItem('triosteum.proj.p2', JSON.stringify(g)); });
await closeRes(); await page.click('#runGo'); await page.waitForTimeout(1800);
bt = await blocksTxt();
check(/Записей на выходе: 3/.test(bt) || /Записей: 3/.test(bt), 'ссылка живая: новая строка из источника попала в расчёт');

console.log('С ИИ: архитектор использует найденное вместо того, чтобы писать заново');
await closeRes(); await page.click('#claudeMore'); await page.waitForTimeout(150);
await page.click('#claudeP .clp-seg [data-prov="claude"]'); await page.waitForTimeout(100);
await page.fill('#claudeP input[type=password]', 'sk-ant-test');
await page.click('#claudeP button:has-text("Сохранить и включить")'); await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.click('#aiFab'); await page.waitForTimeout(250);
await page.fill('#arcW .arc-in', PROMPT); await page.waitForTimeout(300);
await page.click('#arcW button:has-text("Собрать схему")'); await page.waitForTimeout(900);
check(/x1 \|/.test(lastPrompt) && /Остатки на складах/.test(lastPrompt) && /Расчёт дефицита/.test(lastPrompt), 'ИИ получил список найденного в других пространствах');
check(/из «Склад»/.test(await page.$eval('#arcW', (x) => x.textContent)), 'в предложенной схеме видны блоки-ссылки');
await page.click('#arcW button:has-text("Поставить на доску")'); await page.waitForTimeout(2200);
check(await page.$$eval('#nodes .node.xref', (x) => x.length) === 2 && await page.$$eval('#nodes .node', (x) => x.length) === 3, 'в новом пространстве: две ссылки и новый блок');
check(await page.$$eval('.edge-g', (x) => x.length) === 2, 'связи по схеме ИИ');
check(!(await page.$eval('#runp', (x) => x.hidden)) && await page.$eval('#rtErrs', (x) => x.textContent) === '0', 'схема сразу скомпилировалась без ошибок');

console.log('Точные названия не захватывают посторонний фильтр');
await closeRes();
await page.click('#aiFab');
await page.fill('#arcW .arc-in', 'Используй «Бюджет отдела» и «Отчёт об исполнении бюджета» из Офиса.');
await page.waitForTimeout(400);
const budgetFound = await page.locator('#arcW .arc-x').innerText();
check(budgetFound.includes('Бюджет отдела') && budgetFound.includes('Отчёт об исполнении бюджета') && !budgetFound.includes('Вне бюджета'), 'предпросмотр содержит только два указанных файла');
await page.click('#arcW button:has-text("Собрать из готового и скомпилировать")');
await page.waitForTimeout(2200);
const budgetRefs = await page.$$eval('#nodes .node.xref .nt', nodes => nodes.map(n => n.textContent));
check(budgetRefs.length === 2 && budgetRefs.includes('Бюджет отдела') && budgetRefs.includes('Отчёт об исполнении бюджета'), 'на доске только запрошенные файлы, без фильтра из другой среды');
check(await page.$$eval('.edge-g', edges => edges.length) === 1, 'два файла соединены напрямую');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
