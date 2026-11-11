// Надёжность запуска: выключение блока, закреплённый результат, повторы при ошибке, «продолжать при ошибке».
// Запуск: npm run build && node tests/run-opts-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// по http: на file:// Chromium иногда теряет localStorage и sessionStorage при перезагрузке
const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, code, extra) => Object.assign({ id, name, lang: 'cpp', x, y: 220, codes: { cpp: code }, pluginId: null, family: null, desc: '', colors: null }, extra || {});
const OK = 'int run(){ return 42; }', BAD = 'int run(){ return undefinedThing + 1; }';
const browser = await browser0();
async function browser0() { return chromium.launch(); }

async function open(nodes, edges) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((g) => {
    if (window.top !== window || sessionStorage.getItem('seeded')) return; /* только главная страница, один раз */ sessionStorage.setItem('seeded', '1');
    localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Запуск', t: Date.now() }] }));
    localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
  }, { nodes, edges: edges || [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
  await page.goto(URL); await page.waitForTimeout(1000);
  return { page, ctx, errors };
}
const run = async (page) => { await page.keyboard.press('Escape'); await page.keyboard.press('Control+r'); await page.waitForFunction(() => !document.querySelector('#runp.busy') && /Готово|остановлено|успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300); return page.textContent('#runOut'); };
const graph = async (page) => { await page.waitForTimeout(700); return page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1'))); };
const pop = async (page, id) => { await page.keyboard.press('Escape'); const b = await page.locator(`.node[data-id="${id}"]`).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + 20, { button: 'right' }); await page.waitForTimeout(400); };

console.log('Ошибка выше по схеме и «продолжать при ошибке»');
{
  const { page, ctx, errors } = await open([node('a', 'Источник', 160, BAD), node('b', 'Приёмник', 520, OK)]);
  let log = await run(page);
  check(/пропущен: ошибка выше по схеме, в блоке «Источник»/.test(log), 'блок ниже упавшего пропускается');
  await pop(page, 'a');
  check(await page.isVisible('#pop .ropts'), 'в настройках блока есть раздел «Запуск»');
  await page.locator('#pop .ropts .tgl', { hasText: 'Продолжать схему при ошибке' }).locator('input').check();
  await page.waitForTimeout(300);
  check((await graph(page)).nodes.find((n) => n.id === 'a').cont === true, 'включили «продолжать при ошибке» — сохранилось');
  check(await page.locator('.node[data-id="a"] .nmark.cont').count() === 1, 'на блоке появилась метка');
  log = await run(page);
  check(/Продолжать схему при ошибке» включено/.test(log) && /▶ Приёмник/.test(log), 'теперь блок ниже выполняется');
  console.log('Повторы');
  await pop(page, 'a'); await page.locator('#pop .ropts-retry button', { hasText: '×2' }).click(); await page.waitForTimeout(200);
  log = await run(page);
  check(/повтор 1 из 2/.test(log) && /повтор 2 из 2/.test(log) && /после 2 повторов/.test(log), 'повторы при ошибке: 2 попытки и итог');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Выключение и закреплённый результат');
{
  const { page, ctx, errors } = await open([node('a', 'Источник', 160, OK), node('b', 'Приёмник', 520, OK)]);
  await pop(page, 'a');
  check(await page.locator('#pop .ropts button', { hasText: 'сначала запустите схему' }).isDisabled(), 'до запуска закреплять нечего');
  let log = await run(page);
  await pop(page, 'a'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  check(JSON.stringify((await graph(page)).nodes.find((n) => n.id === 'a').pin.v) === '42' && await page.locator('.node[data-id="a"].n-pin .nmark.pin').count() === 1, 'результат закреплён и сохранён, на блоке 📌');
  // ломаем код — закреплённый результат всё равно отдаётся
  await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('triosteum.proj.p1')); g.nodes[0].codes.cpp = 'int run(){ return undefinedThing + 1; }'; localStorage.setItem('triosteum.proj.p1', JSON.stringify(g)); });
  await page.reload(); await page.waitForTimeout(1000);
  log = await run(page);
  check(/📌 Источник — закреплённый результат/.test(log) && !/undefinedThing/.test(log) && /▶ Приёмник/.test(log), 'с закреплённым результатом блок не выполняется, следующий получает данные');
  await pop(page, 'a'); await page.locator('#pop .ropts button', { hasText: 'Открепить' }).click(); await page.waitForTimeout(200);
  check(!(await graph(page)).nodes.find((n) => n.id === 'a').pin, 'открепить');
  // выключение через палитру команд
  await pop(page, 'a'); await page.keyboard.press('Escape');
  const b = await page.locator('.node[data-id="a"]').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + 20); await page.waitForTimeout(200);
  await page.keyboard.press('Control+k'); await page.keyboard.type('Выключить «Источник»'); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check((await graph(page)).nodes.find((n) => n.id === 'a').off === true && await page.locator('.node[data-id="a"].n-off').count() === 1, 'палитра команд: «Выключить «Источник»» — блок выключен и выглядит выключенным');
  log = await run(page);
  check(/⏸ Источник — выключен/.test(log) && /▶ Приёмник/.test(log), 'выключенный блок пропускается, следующий выполняется');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

console.log('Ошибка проходит через выключенный блок; смешанная схема');
{
  let { page, ctx, errors } = await open([node('a', 'Источник', 120, BAD), node('b', 'Посредник', 420, OK, { off: true }), node('c', 'Итог', 720, OK)],
    [{ id: 'e1', from: 'a', to: 'b', taps: [] }, { id: 'e2', from: 'b', to: 'c', taps: [] }]);
  let log = await run(page);
  check(/⤼ Посредник — пропущен: ошибка выше/.test(log) && /⤼ Итог — пропущен: ошибка выше/.test(log) && !/▶ Итог/.test(log), 'A падает, B выключен → C не запускается (ошибка не теряется на выключенном блоке)');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
  // смешанная схема: таблица + код → идёт через исполнитель маршрутов, настройки тоже работают
  ({ page, ctx, errors } = await open([{ id: 's', name: 'Таблица', lang: 'sheet', x: 120, y: 220, codes: { sheet: JSON.stringify({ rows: [['Имя', 'Сумма'], ['А', '1']] }) }, pluginId: null, family: null, desc: '', colors: null },
    node('b', 'Расчёт', 420, BAD, { off: true })], [{ id: 'e1', from: 's', to: 'b', taps: [] }]));
  log = await run(page);
  check(/⏸ Расчёт — выключен/.test(log) && !/undefinedThing/.test(log), 'смешанная схема (таблица + код): выключенный блок не выполняется');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Повторное ревью Codex: пространство, остановка, Python без среды');
{
  // результат последнего запуска не переходит в другое пространство (копия хранит те же id)
  let { page, ctx, errors } = await open([node('a', 'Источник', 160, OK), node('b', 'Приёмник', 520, OK)]);
  await run(page);
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+k'); await page.keyboard.type('Дублировать пространство'); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  await pop(page, 'a');
  const pinBtn = page.locator('#pop .ropts button', { hasText: 'сначала запустите схему' });
  check(await pinBtn.count() === 1 && await pinBtn.isDisabled(), 'в копии пространства нельзя закрепить результат чужого запуска');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
  // выключенный Python не требует загрузки среды: без Pyodide остальные блоки выполняются
  ({ page, ctx, errors } = await open([{ id: 'p', name: 'Питон', lang: 'python', x: 120, y: 220, codes: { python: 'import triosteum\n@triosteum.block\ndef run(x):\n    return 1' }, pluginId: null, family: null, desc: '', colors: null, off: true },
    node('b', 'Плюсы', 420, OK)], [{ id: 'e1', from: 'p', to: 'b', taps: [] }]));
  await page.route(/pyodide/, (r) => r.abort());
  let log = await run(page);
  check(/⏸ Питон — выключен/.test(log) && /▶ Плюсы/.test(log), 'выключенный Python-блок: среда не загружается, схема выполняется');
  await ctx.close();
  // смешанная схема: «Остановить» во время паузы перед повтором — блок больше не выполняется
  ({ page, ctx, errors } = await open([{ id: 's', name: 'Таблица', lang: 'sheet', x: 120, y: 220, codes: { sheet: JSON.stringify({ rows: [['Имя', 'Сумма'], ['А', '1']] }) }, pluginId: null, family: null, desc: '', colors: null },
    node('b', 'Расчёт', 420, BAD, { retry: 5 })], [{ id: 'e1', from: 's', to: 'b', taps: [] }]));
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+r');
  await page.waitForFunction(() => /повтор 1 из 5/.test(document.querySelector('#runOut').textContent), null, { timeout: 8000 }).catch(() => {});
  await page.click('#runStop');
  const tries0 = ((await page.textContent('#runOut')).match(/повтор \d из 5/g) || []).length;
  await page.waitForTimeout(3500);
  log = await page.textContent('#runOut');
  const tries1 = (log.match(/повтор \d из 5/g) || []).length;
  check(tries0 >= 1 && tries1 === tries0 && /остановлен пользователем/.test(log) && !/после 5 повторов/.test(log), 'остановка во время паузы перед повтором: блок больше не выполняется (' + tries0 + ' → ' + tries1 + ')');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Третий раунд Codex: вложенные поля «__…» и блоки с документами');
{
  // вложенные пользовательские поля с «__» сохраняются в закреплённом снимке
  let { page, ctx, errors } = await open([node('a', 'Источник', 160, 'public class R { public object Run(object d){ return new { payload = new { __id = 7, value = 10 } }; } }', { lang: 'csharp', codes: { csharp: 'public class R { public object Run(object d){ return new { payload = new { __id = 7, value = 10 } }; } }' } }), node('b', 'Приёмник', 520, OK)]);
  await run(page);
  await pop(page, 'a'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  const pv = JSON.stringify(((await graph(page)).nodes.find((n) => n.id === 'a').pin || {}).v);
  check(/"__id":7/.test(pv) && /"value":10/.test(pv), 'вложенное поле «__id» осталось в снимке: ' + pv);
  await ctx.close();
  // блок, создающий документы, закрепить нельзя (снимок ссылался бы на документы прошлого запуска)
  ({ page, ctx, errors } = await open([{ id: 'a', name: 'Договор', lang: 'doc', x: 160, y: 220, codes: { doc: '<p>Договор</p>' }, pluginId: null, family: null, desc: '', colors: null }, node('b', 'Приёмник', 520, OK)]));
  await pop(page, 'a');
  check(await page.locator('#pop .ropts', { hasText: 'Закрепить результат нельзя' }).count() === 1 && await page.locator('#pop .ropts button', { hasText: 'Закрепить' }).count() === 0, 'у блока «Документ» нет кнопки закрепления, есть пояснение');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Четвёртый раунд Codex: снимок не меняется, показатели закреплённого блока доходят до дашборда');
{
  const CS = 'public class R { public object Run(dynamic d){ d.value = d.value + 1; return d; } }';
  let { page, ctx, errors } = await open([node('a', 'Источник', 160, OK, { pin: { v: { value: 1 }, t: 1 } }), node('b', 'Меняет вход', 520, CS, { lang: 'csharp', codes: { csharp: CS } })]);
  await run(page); const l2 = await run(page);
  check(/✓/.test(l2) && !/Меняет вход[^\n]*ошибк/i.test(l2) && !/✗/.test(l2), 'блок ниже выполнился (меняет полученный объект)');
  const g1 = await graph(page);
  check(JSON.stringify(g1.nodes.find((n) => n.id === 'a').pin.v) === '{"value":1}', 'закреплённый снимок не изменился после двух запусков: ' + JSON.stringify(g1.nodes.find((n) => n.id === 'a').pin.v));
  await ctx.close();
  const opn = (id, name, x, lang, p) => ({ id, name, lang, x, y: 220, codes: { [lang]: JSON.stringify(p) }, pluginId: null, family: null, desc: '', colors: null });
  ({ page, ctx, errors } = await open([
    { id: 's', name: 'Продажи', lang: 'sheet', x: 80, y: 220, codes: { sheet: JSON.stringify({ rows: [['Имя', 'Сумма'], ['А', '5'], ['Б', '7']] }) }, pluginId: null, family: null, desc: '', colors: null },
    opn('m', 'Выручка', 380, 'metric', { title: 'Выручка', field: 'Сумма', fn: 'sum', target: 0, unit: 'руб.' }),
    opn('d', 'Сводка', 680, 'dashboard', { title: 'Сводка', tables: 'no' })],
    [{ id: 'e1', from: 's', to: 'm', taps: [] }, { id: 'e2', from: 'm', to: 'd', taps: [] }]));
  let log = await run(page);
  check(/Показателей: 1/.test(log), 'до закрепления: на дашборде один показатель');
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  const pin = (await graph(page)).nodes.find((n) => n.id === 'm').pin;
  check(pin && Array.isArray(pin.items) && pin.items.some((x) => x.type === 'metric' && x.value === 12), 'в снимке сохранён и сам показатель (12)');
  log = await run(page);
  check(/📌 Выручка — закреплённый результат/.test(log) && /Показателей: 1/.test(log), 'после закрепления дашборд по-прежнему получает показатель');
  // запуск только таблицы не стирает показатель из кэша: закреплённый потом показатель сохраняет элементы
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Открепить' }).click(); await page.waitForTimeout(200);
  await run(page);
  await page.keyboard.press('Escape'); const sb = await page.locator('.node[data-id="s"]').boundingBox(); await page.mouse.click(sb.x + sb.width / 2, sb.y + 20); await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById('runSel').click()); await page.waitForFunction(() => !document.querySelector('#runp.busy'), null, { timeout: 15000 }); await page.waitForTimeout(300);
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  const pin2 = (await graph(page)).nodes.find((n) => n.id === 'm').pin;
  check(pin2 && Array.isArray(pin2.items) && pin2.items.some((x) => x.type === 'metric'), 'после запуска только таблицы показатель закрепляется вместе с элементом');
  log = await run(page);
  check(/Показателей: 1/.test(log), 'и дашборд его получает');
  // запуск, остановленный до показателя, не стирает его элементы из кэша
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Открепить' }).click(); await page.waitForTimeout(200);
  await run(page); await page.keyboard.press('Escape');
  await page.evaluate(() => { document.getElementById('runGo').click(); document.getElementById('runStop').click(); });
  await page.waitForFunction(() => !document.querySelector('#runp.busy'), null, { timeout: 15000 }); await page.waitForTimeout(300);
  check(/остановлен пользователем/.test(await page.textContent('#runOut')), 'запуск остановлен до показателя');
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  const pin3 = (await graph(page)).nodes.find((n) => n.id === 'm').pin;
  check(pin3 && Array.isArray(pin3.items) && pin3.items.some((x) => x.type === 'metric' && x.value === 12), 'после остановленного запуска показатель закрепляется вместе с элементом');
  log = await run(page);
  check(/Показателей: 1/.test(log), 'и дашборд его получает');
  // выключенный показатель: CMP.last получает проходящие записи — старый элемент в снимок не попадает
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Открепить' }).click(); await page.waitForTimeout(200);
  await page.locator('#pop label.tgl', { hasText: 'Блок включён' }).locator('input').uncheck(); await page.waitForTimeout(200);
  log = await run(page);
  check(/⏸ Выручка — выключен/.test(log), 'показатель выключен и пропущен');
  await pop(page, 'm'); await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(300);
  const pin4 = (await graph(page)).nodes.find((n) => n.id === 'm').pin;
  check(pin4 && !(pin4.items || []).some((x) => x.type === 'metric'), 'снимок выключенного блока не содержит устаревший показатель');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
