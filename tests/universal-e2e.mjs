// Универсальность: встряхивание блоков, общий буфер между средами, единая компиляция,
// открытие блока в родной среде, схема файлов (связи с чем угодно, открепление, ×, комментарии,
// заметки, ПКМ), картинки в таблицах, формат .tsm, шестерёнка настроек.
// Запуск: npm run build && node tests/universal-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
const SHOTS = process.env.SHOTS;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  const node = (id, name, lang, x, code) => ({ id, name, lang, x, y: 160, codes: code ? { [lang]: code } : {}, pluginId: null, family: null, desc: '', colors: null });
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Код', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({
    nodes: [node('n1', 'Виджет', 'html', 120, '<b>Привет из разработки</b>'), node('n2', 'Расчёт', 'python', 460), node('n3', 'Итог', 'html', 800, '<i>итог</i>')],
    edges: [{ id: 'e1', from: 'n1', to: 'n2' }, { id: 'e2', from: 'n2', to: 'n3' }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 10 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); });
await page.goto(URL); await page.waitForTimeout(900);
const nodeBox = (name) => page.locator('#nodes .node', { hasText: name }).first().boundingBox();
async function shake(box) {
  const x = box.x + box.width / 2, y = box.y + 20;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 0; i < 7; i++) { await page.mouse.move(x + (i % 2 ? -45 : 45), y, { steps: 2 }); }
  await page.mouse.move(x + 200, y + 140, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(300);
}
async function linksText(name) {
  await page.locator('#nodes .node', { hasText: name }).first().click({ button: 'right' }); await page.waitForTimeout(250);
  const t = await page.locator('#pop .acts').textContent(); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  return t;
}

console.log('Встряхивание на доске');
check(await page.$$eval('#edges .edge-g, .edge-g', (x) => x.length) === 2, 'на доске две связи');
await shake(await nodeBox('Расчёт'));
check(await page.$$eval('#nodes .node.hub', (x) => x.length) === 1, 'на месте блока появилась связующая точка');
check(await page.$$eval('.edge-g', (x) => x.length) === 2, 'связи не потерялись — перешли на точку');
check(/Связей нет/.test(await linksText('Расчёт')), 'блок «Расчёт» свободен');
await shake(await page.locator('#nodes .node.hub').first().boundingBox());
check(await page.$$eval('.edge-g', (x) => x.length) === 0, 'встряхнули точку — все её связи отцеплены');
await page.keyboard.press('Control+z'); await page.waitForTimeout(250);
check(await page.$$eval('.edge-g', (x) => x.length) === 2, 'Ctrl+Z вернул связи точки');

console.log('Двойной клик и шестерёнка');
await page.locator('#nodes .node', { hasText: 'Виджет' }).first().dblclick(); await page.waitForTimeout(400);
check(await page.isVisible('#editor') && await page.$$eval('#nodes .node', (x) => x.length) === 4, 'двойной клик открыл код, блок не удалён');
await page.click('#bBack').catch(() => {}); await page.waitForTimeout(200);
if (await page.isVisible('#editor')) { await page.keyboard.press('Escape'); await page.locator('button', { hasText: 'На доску' }).first().click().catch(() => {}); }
await page.waitForTimeout(300);
await page.click('#setBtn'); await page.waitForTimeout(250);
check(await page.isVisible('#pers'), 'шестерёнка открыла настройки в «Разработке»');
await page.click('#setBtn'); await page.waitForTimeout(500);
check(!(await page.isVisible('#pers')), 'повторное нажатие закрыло настройки');

console.log('Общий буфер между средами и единая компиляция');
if (await page.isVisible('#editor')) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /доск/i.test(x.getAttribute('aria-label') || x.textContent) && x.offsetParent); if (b) b.click(); }); await page.waitForTimeout(300); }
await page.locator('#nodes .node', { hasText: 'Виджет' }).first().click(); await page.waitForTimeout(150);
await page.keyboard.press('Control+c'); await page.waitForTimeout(200);
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Офис' }).locator('button', { hasText: 'Пример офиса' }).click(); await page.waitForTimeout(900);
await page.click('#otabs .otab.fixed[data-tab="auto"]'); await page.waitForTimeout(400);
const before = await page.$$eval('#nodes .node', (x) => x.length);
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await page.keyboard.press('Control+v'); await page.waitForTimeout(500);
check(await page.$$eval('#nodes .node', (x) => x.length) === before + 1, 'блок из «Разработки» вставлен в «Офис»');
check(await page.$$eval('#nodes .node.foreign .env-tag', (x) => x.length) >= 1, 'у блока метка родной среды');
await page.click('#topRun'); await page.waitForTimeout(1500);
const log = await page.textContent('#runOut');
check(/Виджет/.test(log) && /HTML-виджет/.test(log), 'единая компиляция: код и документы в одном маршруте');
check(await page.isVisible('#resW') && /Виджет/.test(await page.textContent('#resW')), 'результат HTML-блока в общих результатах');
await page.click('#resClose').catch(() => {}); await page.click('#runClose').catch(() => {});
if (SHOTS) await page.screenshot({ path: SHOTS + '/u-foreign.png' });

console.log('Открыть блок в родной среде и вернуть правки');
const officeEnv = await page.textContent('#envName'), projBefore = await page.textContent('#projName'), projCount = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.projects')).list.length);
await page.locator('#nodes .node.foreign').first().dblclick(); await page.waitForTimeout(900);
check((await page.textContent('#envName')) === 'Разработка', 'двойной клик перенёс в «Разработку»');
check((await page.textContent('#projName')) === projBefore && await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.projects')).list.length) === projCount, 'то же пространство — без отдельного пространства для правок');
check(await page.isVisible('#bridgeBar'), 'плашка «Вернуть в …»');
await page.click('#bridgeBar .btn.primary'); await page.waitForTimeout(900);
check((await page.textContent('#envName')) === officeEnv, 'правки вернулись в «' + officeEnv + '»');
check(!(await page.isVisible('#bridgeBar')), 'плашка исчезла');

console.log('C++, C# и 1С в общей компиляции');
const pasteBlocks = (nodes, edges) => page.evaluate(([nodes, edges]) => { const c = { t:Date.now() + 1e6, env:'code', envName:'Разработка', proj:'other', projName:'Тест', nodes, notes:[], edges, portable:{ nodes, notes:[], edges } }; localStorage.setItem('triosteum.clip', JSON.stringify(c)); return navigator.clipboard.writeText('TRIOSTEUM-CLIP:' + JSON.stringify(c)).catch(() => {}); }, [nodes, edges]);
const mk = (id, name, lang, x, code) => ({ id, name, lang, x, y:620, codes:{ [lang]:code }, pluginId:null, family:null, desc:'', colors:null });
await pasteBlocks([
  mk('c1', 'Сумма C++', 'cpp', 100, '#include <vector>\nstruct R { double Сумма; };\ndouble run(const std::vector<R>& rows){ double s = 0; for (const auto& r : rows) s += r.Сумма; return s; }'),
  mk('c2', 'Склады 1С', '1c', 420, 'Функция Выполнить(Вх) Экспорт\n З = Новый Запрос("ВЫБРАТЬ Т.Склад КАК Склад, СУММА(Т.ВНаличииОстаток) КАК Всего ИЗ РегистрНакопления.ТоварыНаСкладах.Остатки КАК Т СГРУППИРОВАТЬ ПО Т.Склад");\n Возврат З.Выполнить().Выгрузить();\nКонецФункции'),
  mk('c3', 'Итог C#', 'csharp', 740, 'public class B { public object Run(List<Dictionary<string, object>> rows) => rows.Select(r => new { Склад = r["Склад"], Тонн = Math.Round(Convert.ToDouble(r["Всего"]), 1) }).ToList(); }')
], [{ id:'ce1', from:'c2', to:'c3' }]);
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await page.keyboard.press('Control+v'); await page.waitForTimeout(600);
check(await page.locator('#nodes .node', { hasText: 'Склады 1С' }).count() === 1, 'блоки C++, C# и 1С вставлены в «Офис»');
await page.click('#topRun'); await page.waitForTimeout(1800);
const log2 = await page.textContent('#runOut');
if (process.env.DBG) console.log(log2);
check(/Склады 1С.* — 1С/.test(log2) && /Итог C#.* — C#/.test(log2) && /Сумма C\+\+.* — C\+\+/.test(log2) && !/пропущен: для/.test(log2), 'C++, C# и 1С выполнены в общем маршруте, без пропусков');
check(/Основной/.test(await page.textContent('#resW')) || /Итог C#/.test(await page.textContent('#resW')), 'результат 1С → C# в общих результатах');
await page.click('#resClose').catch(() => {}); await page.click('#runClose').catch(() => {});
await page.locator('#nodes .node', { hasText: 'Сумма C++' }).first().dblclick(); await page.waitForTimeout(900);
check((await page.textContent('#envName')) === 'Разработка' && await page.isVisible('#editor'), 'блок C++ открыт в «Разработке»');
await page.click('#runBtn'); await page.waitForTimeout(400);
check(/Результат: \d/.test(await page.textContent('#out')) && /Выполнено без ошибок/.test(await page.textContent('#out')), 'C++ выполняется в редакторе: ' + (await page.textContent('#out')).split('\n').slice(-3).join(' | '));
await page.click('#bridgeBar .btn.primary'); await page.waitForTimeout(800);
check((await page.textContent('#envName')) === officeEnv, 'вернулись в «' + officeEnv + '»');

console.log('Схема файлов');
await page.click('#otabs .otab.fixed[data-tab="map"]'); await page.waitForTimeout(500);
await page.click('#setBtn'); await page.waitForTimeout(200);
check(await page.isVisible('#pers'), 'шестерёнка работает и в офисе');
await page.click('#setBtn'); await page.waitForTimeout(500);
const wrapB = await page.locator('#fmWrap').boundingBox();
await page.mouse.click(wrapB.x + wrapB.width - 120, wrapB.y + wrapB.height - 60, { button: 'right' }); await page.waitForTimeout(250);
const menu = await page.textContent('#ctx');
check(/Создать файл/.test(menu) && /Текстовая заметка/.test(menu) && /Персонализация/.test(menu), 'ПКМ по пустому месту — меню схемы');
await page.locator('#ctx .ctx-i', { hasText: 'Текстовая заметка' }).click(); await page.waitForTimeout(300);
await page.keyboard.type('Сверить реестр'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check(await page.locator('.fm-note', { hasText: 'Сверить реестр' }).count() === 1, 'текстовая заметка на схеме');
// новый документ и связь «таблица → документ» картинкой
await page.locator('.ribbon .rb', { hasText: '+ Файл' }).click(); await page.waitForTimeout(200);
await page.locator('#ctx .ctx-i', { hasText: 'Документ' }).first().click(); await page.waitForTimeout(500);
const docName = await page.$eval('#otabFiles .otab.on .nm', (x) => x.textContent);
await page.click('#otabs .otab.fixed[data-tab="map"]'); await page.waitForTimeout(400);
const e0 = await page.$$eval('.fm-edges path.fm-edge', (x) => x.length);
const src = page.locator('.fm-node', { hasText: 'Таблица' }).first(), dst = page.locator('.fm-node', { hasText: docName });
const p = await src.locator('.fm-out').boundingBox(), q = await dst.boundingBox();
await page.mouse.move(p.x + 6, p.y + 6); await page.mouse.down(); await page.mouse.move(q.x + 60, q.y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
check(await page.isVisible('#howW'), 'окно «Как связать?»');
await page.locator('.how-i', { hasText: 'Картинкой в конец документа' }).click(); await page.waitForTimeout(800);
check(await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) === e0 + 1, 'таблица вставлена в документ картинкой — связь на схеме');
const eg = page.locator('.fm-eg', { hasText: 'вставки' }).first();
await eg.locator('.fm-ehit').click({ force: true }); await page.waitForTimeout(150);
await page.keyboard.press('Delete'); await page.waitForTimeout(400);
check(await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) === e0, 'связь откреплена (Delete)');
await page.locator('#fmWrap').focus(); await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
check(await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) === e0 + 1, 'Ctrl+Z вернул связь');
// × на связи
const eg2 = page.locator('.fm-eg', { hasText: 'вставки' }).first();
await eg2.locator('.fm-ehit').click({ force: true }); await page.waitForTimeout(150);
await eg2.locator('.fm-ex').click({ force: true }); await page.waitForTimeout(400);
check(await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) === e0, 'крестик на связи открепляет');
// комментарий и крестик на блоке
const dnode = page.locator('.fm-node', { hasText: docName });
await dnode.hover(); await dnode.locator('.fm-c').click(); await page.waitForTimeout(300);
await page.keyboard.type('Проверить подписи'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
check(await page.locator('.fm-note.cm', { hasText: 'Проверить подписи' }).count() === 1, 'комментарий к файлу');
const n0 = await page.$$eval('.fm-node', (x) => x.length);
await dnode.hover(); await dnode.locator('.fm-x').click(); await page.waitForTimeout(400);
check(await page.$$eval('.fm-node', (x) => x.length) === n0 - 1, 'крестик удалил файл');
await page.locator('#toast button, .toast button', { hasText: 'Вернуть' }).first().click().catch(async () => { await page.locator('#fmWrap').focus(); await page.keyboard.press('Control+z'); });
await page.waitForTimeout(400);
check(await page.$$eval('.fm-node', (x) => x.length) === n0, '«Вернуть» восстановил файл');
// встряхнуть файл — связи отцепляются
const linked = page.locator('.fm-node', { hasText: 'Таблица' }).first();
const eBefore = await page.$$eval('.fm-edges path.fm-edge', (x) => x.length);
const lb = await linked.boundingBox();
await page.mouse.move(lb.x + 100, lb.y + 30); await page.mouse.down();
for (let i = 0; i < 7; i++) await page.mouse.move(lb.x + 100 + (i % 2 ? -45 : 45), lb.y + 30, { steps: 2 });
await page.mouse.up(); await page.waitForTimeout(400);
check(await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) < eBefore, 'встряхнули файл — его связи отцеплены (' + eBefore + ' → ' + await page.$$eval('.fm-edges path.fm-edge', (x) => x.length) + ')');
if (SHOTS) await page.screenshot({ path: SHOTS + '/u-map.png' });

console.log('Картинка поверх ячеек таблицы');
await page.locator('.fm-node', { hasText: 'Таблица' }).first().dblclick(); await page.waitForTimeout(600);
check(await page.isVisible('#sgWrap'), 'таблица открыта');
check(await page.locator('.ribbon .rb-ins').count() === 1, 'в ленте кнопка «Вставить ▾»');
await page.locator('#sgWrap td[data-r="1"][data-c="1"]').click();
await page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 80; c.height = 50; const g = c.getContext('2d'); g.fillStyle = '#16A34A'; g.fillRect(0, 0, 80, 50);
  const b = await new Promise((r) => c.toBlob(r)); const dt = new DataTransfer(); dt.items.add(new File([b], 'logo.png', { type: 'image/png' }));
  document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(500);
check(await page.locator('#sgWrap .sg-obj').count() === 1, 'картинка вставлена в таблицу из буфера (как в Excel)');
await page.locator('#sgWrap .sg-obj').click(); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
check(await page.locator('#sgWrap .sg-obj').count() === 0, 'Delete убрал картинку');
if (SHOTS) await page.screenshot({ path: SHOTS + '/u-sheet.png' });

console.log('Формат .tsm');
await page.click('#otabs .otab.fixed[data-tab="desk"]'); await page.waitForTimeout(300);
const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
const tsmPath = await dl.path(); const tsm = JSON.parse(readFileSync(tsmPath, 'utf8'));
check(dl.suggestedFilename().endsWith('.tsm') && tsm.app === 'Triosteum' && tsm.kind === 'space' && tsm.graph.files.items.length > 3, 'пространство сохранено в .tsm: ' + dl.suggestedFilename());
const tmp = '/tmp/triosteum-test.tsm'; writeFileSync(tmp, JSON.stringify(Object.assign(tsm, { name: 'Из файла tsm' })));
await page.setInputFiles('input[type=file][accept^=".tsm,.json"]', tmp); await page.waitForTimeout(900);
check(/Из файла tsm/.test(await page.textContent('#projName')), '.tsm открыт как новое пространство');

console.log('Фоторедактор: копировать и вставить');
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Фоторедактор' }).locator('button', { hasText: 'Пример' }).click(); await page.waitForTimeout(1200);
const L0 = await page.$$eval('.ie-layer', (x) => x.length);
await page.locator('.ribbon .rb', { hasText: 'Коррекция' }).focus();
await page.keyboard.press('Control+c'); await page.waitForTimeout(200); await page.keyboard.press('Control+v'); await page.waitForTimeout(900);
check(await page.$$eval('.ie-layer', (x) => x.length) === L0 + 1, 'Ctrl+C / Ctrl+V — слой скопирован (даже когда фокус на ленте)');

console.log('Автоматизация в графике');
check(await page.isVisible('#otabs .otab.fixed[data-tab="auto"]'), 'в «Фоторедакторе» есть доска «Автоматизация»');
await page.click('#otabs .otab.fixed[data-tab="auto"]'); await page.waitForTimeout(400);
await pasteBlocks([mk('g1', 'Продажи', 'sheet', 100, JSON.stringify({ rows:[['Категория', 'Сумма'], ['Металл', '120'], ['Работа', '80'], ['Энергия', '40']] })), Object.assign(mk('g2', 'График', 'gfxpic', 420, JSON.stringify({ label:'Категория', value:'Сумма', type:'bar', name:'Диаграмма продаж' })), {})], [{ id:'ge1', from:'g1', to:'g2' }]);
await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
await page.keyboard.press('Control+v'); await page.waitForTimeout(500);
await page.click('#topRun'); await page.waitForTimeout(1500);
check(/Файл «Диаграмма продаж/.test(await page.textContent('#runOut')), 'блок «Картинка из данных» выполнен');
await page.click('#resClose').catch(() => {}); await page.click('#runClose').catch(() => {});
await page.click('#otabs .otab.fixed[data-tab="desk"]'); await page.waitForTimeout(400);
check(await page.locator('.fcard', { hasText: 'Диаграмма продаж' }).count() === 1, 'диаграмма появилась файлом-изображением на рабочем столе');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
