// Окно компилятора (вкладки, ошибки, остановка, запуск выделенных) и переключатель «Claude» в шапке.
// Запуск: npm run build && node tests/compiler-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const node = (id, name, lang, x, y, code) => ({ id, name, lang, x, y, codes: code ? { [lang]: code } : {}, pluginId: null, family: null, desc: '', colors: null });
const CS = `public class B { public object Run(List<Dictionary<string, object>> rows){ Console.WriteLine("строк: " + rows.Count); return rows.Where(r => Convert.ToDouble(r["Сумма"]) > 1).Select(r => new { Имя = r["Имя"], Сумма = r["Сумма"] }).ToList(); } }`;
const BSL = `Функция Выполнить(Вх) Экспорт
  Итог = 0;
  Для Каждого С Из Вх Цикл Итог = Итог + С.Сумма; КонецЦикла;
  Сообщить("Итог: " + Итог);
  Возврат Новый Структура("Итог", Итог);
КонецФункции`;
const CPP_BAD = `int run(){ return undefinedThing + 1; }`;
const graph = { nodes: [
  node('a', 'Строки C#', 'csharp', 80, 80, CS.replace('return rows', 'rows.Add(new Dictionary<string, object>{ ["Имя"] = "x", ["Сумма"] = 5.0 }); return rows')),
  node('b', 'Итог 1С', '1c', 420, 80, BSL),
  node('c', 'Сломанный C++', 'cpp', 420, 300, CPP_BAD),
  node('s', 'Секрет C#', 'csharp', 80, 300, 'public class B { public string Run(Data d) => Secrets.GetOrDefault("TOKEN", "нет").ToUpper(); }')]
  .concat([0, 1, 2, 3, 4, 5].map((i) => node('z' + i, 'Шаг ' + i, '1c', 760, 40 + i * 90, 'Функция Выполнить(В) Экспорт Возврат ' + i + '; КонецФункции'))),
  edges: [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 20 };
await ctx.addInitScript((g) => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Компилятор', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
}, graph);
// API Anthropic подменяем: отвечаем потоком SSE, как настоящий сервер
let apiCalls = 0, lastHeaders = null, lastBody = null;
await ctx.route('https://api.anthropic.com/v1/messages', async (route) => {
  apiCalls++; lastHeaders = route.request().headers(); lastBody = JSON.parse(route.request().postData() || '{}');
  if (lastHeaders['x-api-key'] === 'bad-key') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  const ev = (t, d) => 'event: ' + t + '\ndata: ' + JSON.stringify(d) + '\n\n';
  const body = ev('message_start', { type: 'message_start', message: { id: 'm1' } }) +
    ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'готово' } }) +
    ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' — ответ Claude' } }) +
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' } }) + ev('message_stop', { type: 'message_stop' });
  return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);

console.log('Окно компилятора');
await page.click('#topRun'); await page.waitForTimeout(1500);
const win = await page.$eval('#runp', (w) => ({ hidden: w.hidden, pos: getComputedStyle(w).position, parent: w.parentElement.tagName }));
check(!win.hidden && win.pos === 'fixed' && win.parent === 'BODY', 'компилятор открылся отдельным плавающим окном');
check(await page.$eval('#rtBlocks', (x) => x.textContent) === '10', 'вкладка «Блоки»: все 10 блоков');
check(await page.$eval('#rtErrs', (x) => x.textContent) === '1', 'вкладка «Ошибки»: одна ошибка (сломанный C++)');
check(!(await page.$eval('#runErrs', (x) => x.hidden)), 'после ошибок окно само переключилось на «Ошибки»');
check(/undefinedThing/.test(await page.$eval('#runErrs', (x) => x.textContent)), 'в ошибке названо неизвестное имя');
check(await page.$eval('#runBar', (x) => x.style.width) === '100%', 'прогресс дошёл до 100%');
await page.click('.runp-tabs [data-rt="std"]');
const std = await page.$eval('#runStd', (x) => x.textContent);
check(/строк: \d+/.test(std) && /Итог: \d/.test(std), 'вкладка «Вывод»: напечатанное C# и 1С, по блокам');
await page.click('.runp-tabs [data-rt="blocks"]');
const rows = await page.$$eval('#runBlocks .rb-row', (r) => r.map((x) => x.querySelector('.rb-dot').className));
check(rows.length === 10 && rows.filter((c) => /ok/.test(c)).length === 9 && rows.filter((c) => /err/.test(c)).length === 1, 'у каждого блока статус: девять готовы, один с ошибкой');
check(/НЕТ/.test(await page.$eval('#runBlocks', (x) => x.textContent)), 'секрет не задан — блок берёт значение по умолчанию');
await page.click('.runp-tabs [data-rt="errs"]');
await page.click('#runErrs .rb-err'); await page.waitForTimeout(200);
check(await page.$eval('#nodes .node[data-id="c"]', (x) => x.classList.contains('sel')), 'щелчок по ошибке выделяет блок на доске');
// запустить только выделенный блок
await page.click('#runSel'); await page.waitForTimeout(900);
check(await page.$eval('#rtBlocks', (x) => x.textContent) === '1', '«Выделенные» запускает только выделенный блок');
// остановка
await page.click('#runGo'); await page.waitForTimeout(250); await page.click('#runStop'); await page.waitForTimeout(1200);
check(/остановлено/.test(await page.$eval('#runSum', (x) => x.textContent)), 'кнопка «Стоп» останавливает запуск');
await page.click('#runMax'); check(await page.$eval('#runp', (x) => x.classList.contains('max')), 'окно разворачивается');
await page.click('#runMax'); await page.click('#runMin'); check(await page.$eval('#runp', (x) => x.classList.contains('min')), 'окно сворачивается в заголовок');
await page.click('#runMin');
// перетаскивание за заголовок
const hb = await page.locator('#runp .runp-h b').boundingBox();
await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x - 300, hb.y - 200, { steps: 6 }); await page.mouse.up();
const hb2 = await page.locator('#runp .runp-h b').boundingBox();
check(Math.abs(hb2.x - (hb.x - 305)) < 3 && Math.abs(hb2.y - (hb.y - 205)) < 3, 'окно перетаскивается за заголовок');

console.log('Переключатель «Claude»');
const tog = await page.locator('#claudeBtn').boundingBox(), gear = await page.locator('#setBtn').boundingBox();
check(tog && gear && tog.x + tog.width <= gear.x + 1, 'переключатель стоит в шапке слева от настроек');
const pickB = async () => { await page.keyboard.press('Escape'); const nb = await page.locator('#nodes .node[data-id="b"]').boundingBox(); await page.mouse.click(nb.x + nb.width / 2, nb.y + 14, { button: 'right' }); await page.waitForTimeout(300); };
await pickB();
check(/переключатель «Claude»/.test(await page.$eval('#pop .ai-note', (x) => x.textContent)), 'без сервера и claude.ai ИИ нет — подсказка предлагает переключатель «Claude»');
await page.click('#claudeBtn'); await page.waitForTimeout(200);
check(!(await page.$eval('#claudeP', (x) => x.hidden)), 'без ключа открываются настройки подключения');
await page.fill('#claudeP input[type=password]', 'bad-key');
await page.click('#claudeP button:has-text("Проверить")'); await page.waitForTimeout(400);
check(/401/.test(await page.$eval('#claudeP .clp-st', (x) => x.textContent)), 'неверный ключ — понятная ошибка 401');
await page.fill('#claudeP input[type=password]', 'sk-ant-test');
await page.selectOption('#claudeP select', 'claude-sonnet-5-5');
await page.click('#claudeP button:has-text("Сохранить и включить")'); await page.waitForTimeout(300);
check(await page.$eval('#claudeBtn', (x) => x.getAttribute('aria-checked')) === 'true', 'с ключом переключатель включается');
await pickB();
check(!(await page.$('#pop .ai-note')) && !!(await page.$('#pop .ai-row textarea')), 'в карточке блока появился ИИ-помощник');
await page.fill('#pop .ai-row textarea', 'Что делает этот блок?');
await page.click('#pop .ai-row button'); await page.waitForTimeout(700);
check(/ответ Claude/.test(await page.$eval('#pop', (x) => x.textContent)), 'помощник блока отвечает через Claude');
check(lastHeaders['anthropic-version'] === '2023-06-01' && lastHeaders['x-api-key'] === 'sk-ant-test' && lastBody.model === 'claude-sonnet-5-5' && lastBody.stream === true, 'запрос в API: ключ, версия, выбранная модель, поток');
check(await page.evaluate(() => sessionStorage.getItem('triosteum.claude.key') === 'sk-ant-test' && !localStorage.getItem('triosteum.claude.key')), 'ключ без «запомнить» живёт только в этой вкладке');
// перезагрузка вкладки — переключатель остаётся включённым
await page.reload(); await page.waitForTimeout(900);
check(await page.$eval('#claudeBtn', (x) => x.getAttribute('aria-checked')) === 'true', 'после перезагрузки вкладки Claude по-прежнему подключён');
await page.click('#claudeBtn'); await page.waitForTimeout(200);
await pickB();
check(await page.$eval('#claudeBtn', (x) => x.getAttribute('aria-checked')) === 'false' && /переключатель «Claude»/.test(await page.$eval('#pop .ai-note', (x) => x.textContent)), 'выключение возвращает прежнее состояние ИИ');

console.log('Секреты для блоков');
await page.keyboard.press('Escape');
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.fill('#persBody .sec-add input[type=text]', 'TOKEN'); await page.fill('#persBody .sec-add input[type=password]', 'abc123');
await page.click('#persBody .sec-add button'); await page.waitForTimeout(200);
check(await page.evaluate(() => /abc123/.test(sessionStorage.getItem('triosteum.secrets') || '') && !/abc123/.test(localStorage.getItem('triosteum.secrets') || '')), 'секрет сохранён только в этой вкладке');
check(/TOKEN/.test(await page.$eval('#persBody', (x) => x.textContent)) && !/abc123/.test(await page.$eval('#persBody', (x) => x.innerHTML)), 'в настройках виден секрет, но не его значение');

await page.click('#persClose');
await page.click('#topRun'); await page.waitForTimeout(1800);
const ns = await page.locator('#nodes .node[data-id="s"]').boundingBox(); await page.mouse.click(ns.x + ns.width / 2, ns.y + 14); await page.waitForTimeout(200);
await page.click('#runSel'); await page.waitForTimeout(900);
await page.click('.runp-tabs [data-rt="blocks"]');
check(/ABC123/.test(await page.$eval('#runBlocks', (x) => x.textContent)), 'C#: Secrets.Get берёт значение из настроек');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
