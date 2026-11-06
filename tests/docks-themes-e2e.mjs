// Кнопки инструментов у любого края (перетаскивание и выбор в настройках) и редактор тем.
// Запуск: npm run build && node tests/docks-themes-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Доска', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [{ id: 'a', name: 'Блок', lang: 'python', x: 300, y: 200, codes: {}, pluginId: null, family: null, desc: '', colors: null }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);
const dockOf = (sel) => page.$eval(sel, (b) => { const d = b.closest('.dock'); return d ? d.dataset.side : null; });
const drag = async (sel, x, y) => { const r = await page.locator(sel).boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(r.x + 40, r.y + 20, { steps: 4 }); await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(250); };
const row = await page.locator('.row').boundingBox();
// file:// в Chromium иногда теряет localStorage при перезагрузке — переносим его вручную, проверяем само приложение
const reloadKeep = async () => {
  const snap = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  await page.reload(); await page.waitForTimeout(300);
  const lost = await page.evaluate((s) => { const o = JSON.parse(s), cur = JSON.parse(localStorage.getItem('triosteum.ui') || '{}'), was = JSON.parse(o['triosteum.ui'] || '{}'); if (Object.keys(cur).length >= Object.keys(was).length) return false; localStorage.clear(); Object.keys(o).forEach((k) => localStorage.setItem(k, o[k])); return true; }, snap);
  if (lost) { await page.reload(); await page.waitForTimeout(300); }
};

console.log('Кнопки у любого края');
check(await dockOf('#bLib') === 'left', 'сначала все кнопки на панели слева');
await drag('#bLib', row.x + row.width / 2, row.y + 30);
check(await dockOf('#bLib') === 'top', 'библиотеку перетащили наверх — появилась верхняя панель');
check(await page.isHidden('#lib'), 'перетаскивание не нажало кнопку');
await drag('#bAdd', row.x + row.width - 30, row.y + row.height / 2);
check(await dockOf('#bAdd') === 'right', '«Добавление элементов» — на правой панели');
await drag('#bTextSize', row.x + row.width / 2, row.y + row.height - 25);
check(await dockOf('#bTextSize') === 'bottom', '«Размер текста» — на нижней панели');
await drag('#bCreate', row.x + row.width / 2 + 30, row.y + 30);
const topOrder = await page.$$eval('.dock-top > .tool', (x) => x.map((b) => b.id));
check(topOrder.join() === 'bLib,bCreate', 'вторая кнопка встала рядом, порядок по месту отпускания (' + topOrder.join() + ')');
// меню и подсказки у новых краёв
await page.click('#bAdd'); await page.waitForTimeout(250);
const am = await page.locator('#addMenu').boundingBox(), ab = await page.locator('#bAdd').boundingBox();
check(await page.isVisible('#addMenu') && am.x + am.width <= ab.x && await page.$eval('#addMenu', (m) => m.classList.contains('leftof')), 'меню кнопки справа открывается слева от неё');
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
await page.hover('#bLib'); await page.waitForTimeout(250);
const tp = await page.locator('#tip').boundingBox(), lb = await page.locator('#bLib').boundingBox();
check(await page.$eval('#tip', (t) => t.classList.contains('s-top')) && tp.y > lb.y + lb.height, 'подсказка у верхней панели — под кнопкой');
await page.mouse.move(700, 600);
// после перезагрузки
await reloadKeep(); await page.waitForTimeout(900);
check(await dockOf('#bLib') === 'top' && await dockOf('#bAdd') === 'right' && await dockOf('#bTextSize') === 'bottom', 'расположение кнопок сохраняется');
// вернуть перетаскиванием
await drag('#bTextSize', row.x + 20, row.y + row.height / 2);
check(await dockOf('#bTextSize') === 'left' && await page.isHidden('.dock-bottom'), 'кнопку вернули влево — пустая нижняя панель исчезла');
// выбор края в настройках
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.selectOption('#persBody select[aria-label="Где кнопка «Конструктор»"]', 'bottom'); await page.waitForTimeout(150);
check(await dockOf('#bBuild') === 'bottom', 'в Персонализации у кнопки выбирается край');
await page.click('#persBody button:has-text("Вернуть все кнопки на панель слева")'); await page.waitForTimeout(200);
check(await dockOf('#bBuild') === 'left' && await dockOf('#bLib') === 'left' && await page.isHidden('.dock-top') && await page.isHidden('.dock-right'), '«Вернуть все кнопки» — всё снова слева');

console.log('Порядок кнопок внутри панели');
await page.click('#persClose'); await page.waitForTimeout(200);
const leftIds = () => page.$$eval('nav.tools.dock[data-side="left"] > .tool', (x) => x.filter((b) => b.offsetWidth > 0).map((b) => b.id || b.dataset.tool));
const l0 = await leftIds();
// «Создать плагин» перетащить выше «Библиотеки»
const lib0 = await page.locator('#bLib').boundingBox();
await drag('#bCreate', lib0.x + lib0.width / 2, lib0.y + 4);
const l1 = await leftIds();
check(l1.indexOf('bCreate') < l1.indexOf('bLib'), 'кнопки меняются местами на левой панели (' + l1.slice(0, 3).join(',') + ')');
await drag('#bLib', row.x + row.width / 2, row.y + 30);
await drag('#bScheme', row.x + row.width / 2 + 40, row.y + 30);
const lb1 = await page.locator('.dock-top #bLib').boundingBox();
await drag('#bScheme', lb1.x + 3, lb1.y + lb1.height / 2);
check((await page.$$eval('.dock-top > .tool', (x) => x.map((b) => b.id))).join() === 'bScheme,bLib', 'и на верхней панели тоже');
await reloadKeep(); await page.waitForTimeout(900);
const l2 = await leftIds();
check(l2.indexOf('bCreate') < l2.indexOf('bAdd') && (await page.$$eval('.dock-top > .tool', (x) => x.map((b) => b.id))).join() === 'bScheme,bLib', 'новый порядок сохраняется после перезагрузки');
await page.click('#setBtn'); await page.waitForTimeout(300);
const before = await leftIds();
await page.click('#persBody button[aria-label="«Добавление элементов» — на место раньше"]'); await page.waitForTimeout(150);
const after = await leftIds();
check(after.indexOf('bAdd') === before.indexOf('bAdd') - 1, 'стрелки в Персонализации двигают кнопку на место раньше');
await page.click('#persBody button:has-text("Вернуть все кнопки на панель слева")'); await page.waitForTimeout(200);
check((await leftIds()).join() === l0.join(), '«Вернуть все кнопки» восстанавливает исходный порядок');

console.log('Закреплённые шапки окон');
const pinned = async (scroller, head) => { const h0 = await page.locator(head).boundingBox(); await page.$eval(scroller, (x) => { x.scrollTop = 400; }); await page.waitForTimeout(100); const h1 = await page.locator(head).boundingBox(); const moved = await page.$eval(scroller, (x) => x.scrollTop); return moved > 0 && Math.abs(h1.y - h0.y) < 1; };
await page.click('#persClose'); await page.waitForTimeout(200);
await page.setViewportSize({ width: 1440, height: 560 });
await page.click('#claudeMore'); await page.click('#claudeP [data-prov="ollama"]'); await page.waitForTimeout(200);
check(await pinned('#claudeP .clp-b', '#claudeP .clp-h'), 'окно «ИИ в Triosteum»: шапка на месте при прокрутке');
await page.click('#claudePClose');
const nb = await page.locator('#nodes .node').first().boundingBox();
await page.mouse.click(nb.x + nb.width / 2, nb.y + 14, { button: 'right' }); await page.waitForTimeout(300);
check(await pinned('#pop', '#pop .pop-head'), 'карточка блока: шапка на месте при прокрутке');
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 1440, height: 900 });

console.log('Очистка');
const menuClick = async (label) => { await page.click('#projBtn'); await page.waitForTimeout(150); await page.hover('#ctx [role=menuitem]:has-text("Очистка")'); await page.waitForTimeout(250); await page.click('[role=menuitem]:has-text("' + label + '")'); await page.waitForTimeout(250); };
const count = () => page.$$eval('#nodes .node', (x) => x.length);
check(await count() === 1, 'на доске есть блок');
await menuClick('Очистить это пространство целиком');
check(await count() === 1 && await page.isVisible('#askModal'), 'сначала спрашивается подтверждение');
await page.click('#askNo'); await page.waitForTimeout(350);
check(await count() === 1 && await page.isHidden('#askModal'), '«Отмена» ничего не трогает');
await menuClick('Очистить это пространство целиком');
await page.click('#askYes'); await page.waitForTimeout(250);
check(await count() === 0, 'подтвердили — пространство очищено');
await menuClick('Вернуть');
check(await count() === 1, '«Вернуть» возвращает очищенное');
await page.click('#setBtn'); await page.waitForTimeout(300);
check(await page.$$eval('#persBody .clr-grid button', (x) => x.length) >= 6, 'те же кнопки очистки — в настройках');
await page.click('#persBody .clr-grid button:has-text("Очистить доску")'); await page.waitForTimeout(200);
await page.click('#askYes'); await page.waitForTimeout(250);
check(await count() === 0, 'очистка доски из настроек');
await page.click('#persClose'); await page.waitForTimeout(200);
await menuClick('Вернуть'); check(await count() === 1, 'и её тоже можно вернуть');

console.log('Редактор тем');
if (await page.isHidden('#pers')) { await page.keyboard.press('Escape'); await page.click('#setBtn'); await page.waitForTimeout(300); }
const cssv = (n) => page.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim(), n);
const setColor = (sel, v) => page.$eval(sel, (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);
const red0 = await cssv('--red');
await page.click('#persBody .theme-w:has-text("Графит") .theme-ed'); await page.waitForTimeout(300);
check(await page.isVisible('#themeEd'), 'карандаш открывает редактор темы');
check(await cssv('--bg') === '#0E0F12', 'пока редактируете, приложение показывает эту тему');
await setColor('#themeEdBody .th-f[data-f="accent"] input', '#22c55e'); await page.waitForTimeout(100);
check((await cssv('--red')).toLowerCase() === '#22c55e', 'смена цвета видна сразу во всём приложении');
await page.click('#themeEdBody button:has-text("Отмена")'); await page.waitForTimeout(450); check(await cssv('--red') === red0 && await page.isHidden('#themeEd'), '«Отмена» возвращает прежнюю тему');
await page.click('#persBody .theme-w:has-text("Графит") .theme-ed'); await page.waitForTimeout(300);
await setColor('#themeEdBody .th-f[data-f="accent"] input', '#22c55e');
await page.click('#themeEdBody button:has-text("Сохранить")'); await page.waitForTimeout(250);
check(/Графит ✎/.test(await page.$eval('#persBody .themes', (x) => x.textContent)) && (await cssv('--red')).toLowerCase() === '#22c55e', 'изменённая тема сохранена и выбрана');
// своя тема
const tiles0 = await page.$$eval('#persBody .theme-w', (x) => x.length);
await page.click('#persBody .theme-new'); await page.waitForTimeout(300);
await page.fill('#themeEdBody input[aria-label="Название темы"]', 'Утро');
await page.click('#themeEdBody button[aria-label="Фон #F4F7FB"]'); await page.waitForTimeout(150);
await page.click('#themeEdBody button[aria-label="Акцент #3B82F6"]'); await page.waitForTimeout(150);
check(await cssv('--bg') === '#F4F7FB' && (await cssv('--ink')).toLowerCase() !== '#e7e9ee', 'готовый фон подбирает остальные цвета (светлая тема)');
await page.click('#themeEdBody button:has-text("Сохранить")'); await page.waitForTimeout(250);
check(await page.$$eval('#persBody .theme-w', (x) => x.length) === tiles0 + 1 && /Утро/.test(await page.$eval('#persBody .themes', (x) => x.textContent)), 'своя тема появилась в списке');
await reloadKeep(); await page.waitForTimeout(1200);
check(await cssv('--bg') === '#F4F7FB', 'своя тема сохраняется после перезагрузки');
// вернуть исходную «Графит»
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.click('#persBody .theme-w:has-text("Графит") .theme-ed'); await page.waitForTimeout(300);
await page.click('#themeEdBody button:has-text("Вернуть как было")'); await page.waitForTimeout(150);
await page.click('#themeEdBody button:has-text("Сохранить")'); await page.waitForTimeout(200);
check(!/Графит ✎/.test(await page.$eval('#persBody .themes', (x) => x.textContent)) && await cssv('--red') === '#F97316', '«Вернуть как было» восстанавливает встроенную тему');
// код темы: вставить
await page.click('#persBody .theme-w:has-text("Утро") .theme-ed'); await page.waitForTimeout(300);
await page.click('#themeEdBody button:has-text("Вставить код темы")');
await page.fill('#themeEdBody textarea', JSON.stringify({ triosteumTheme: 1, name: 'Подарок', accent: '#EC4899', bg: '#14101F', panel: '#1C1729', tip: '#231D33', line: '#2C2440', line2: '#3A3052', dot: '#2A2340', ink: '#ECE6F5', strong: '#F8F5FC', muted: '#B3A8C7', dim: '#958AA9' }));
await page.click('#themeEdBody button:has-text("Добавить тему из кода")'); await page.waitForTimeout(250);
check(await cssv('--bg') === '#14101F' && /Подарок/.test(await page.$eval('#persBody .themes', (x) => x.textContent)), 'тему можно передать кодом и добавить');
await page.click('#persBody .theme-w:has-text("Утро") .theme-ed'); await page.waitForTimeout(300);
await page.click('#themeEdBody button:has-text("Удалить тему")'); await page.waitForTimeout(200);
check(!/Утро/.test(await page.$eval('#persBody .themes', (x) => x.textContent)), 'свою тему можно удалить');

console.log('Свои горячие клавиши');
{
  if (!(await page.isVisible('#pers'))) { await page.click('#setBtn'); await page.waitForTimeout(400); }
  const libKey = page.locator('.docks-grid .tgl', { hasText: 'Библиотека плагинов' }).locator('.key-set');
  await libKey.scrollIntoViewIfNeeded(); await libKey.click(); await page.waitForTimeout(100);
  check(/нажмите/.test(await libKey.textContent()), 'нажали на клавишу — ждёт новую');
  await page.keyboard.press('k'); await page.waitForTimeout(300);
  check((await page.locator('.docks-grid .tgl', { hasText: 'Библиотека плагинов' }).locator('.key-set').textContent()).trim() === 'K', 'библиотеке задали K');
  const bldKey = page.locator('.docks-grid .tgl', { hasText: 'Конструктор' }).locator('.key-set');
  await bldKey.click(); await page.keyboard.press('v'); await page.waitForTimeout(300);
  check((await page.locator('.docks-grid .tgl', { hasText: 'Выбор и перемещение' }).locator('.key-set').textContent()).trim() === '—', 'отдали V конструктору — у «Выбора» клавиша снята');
  const k3 = page.locator('.docks-grid .tgl', { hasText: 'Сетка доски' }).locator('.key-set');
  await k3.click(); await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
  check(/нажмите/.test(await k3.textContent()), 'занятое Ctrl+Z не принимается — ждёт другую');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(400);
  await page.mouse.click(row.x + row.width / 2, row.y + row.height / 2); await page.keyboard.press('Escape');
  await page.keyboard.press('k'); await page.waitForTimeout(500);
  check(await page.isVisible('#lib'), 'K на доске открывает библиотеку');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  check(/K/.test(await page.getAttribute('#bLib', 'data-key')), 'клавиша видна в подсказке кнопки');
  await page.click('#setBtn'); await page.waitForTimeout(400);
  const rs = page.locator('button', { hasText: 'Вернуть клавиши по умолчанию' }); await rs.scrollIntoViewIfNeeded(); await rs.click(); await page.waitForTimeout(300);
  check((await page.locator('.docks-grid .tgl', { hasText: 'Библиотека плагинов' }).locator('.key-set').textContent()).trim() === 'L', 'сброс — снова L');
  await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(300);
}

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
