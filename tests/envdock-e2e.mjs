// Док сред внизу (как на Mac): увеличение у курсора, подписи, переключение среды, режимы.
// Запуск: npm run build && node tests/envdock-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.addInitScript(() => { localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); if (!localStorage.getItem('triosteum.ui')) localStorage.setItem('triosteum.ui', JSON.stringify({ envDock: 'on' })); });
await page.goto(URL); await page.waitForTimeout(900);

console.log('Свёрнутый вид (по умолчанию)');
{
  const pg = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  await pg.addInitScript(() => { localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}'); });
  await pg.goto(URL); await pg.waitForTimeout(900); await pg.mouse.move(800, 300);
  const st = () => pg.evaluate(() => [document.querySelector('#envDock').classList.contains('mini'), document.querySelector('.ed-mini').classList.contains('on')].join());
  check(await st() === 'false,false', 'сначала док развёрнут');
  await pg.waitForTimeout(3700);
  check(await st() === 'true,true', 'через 3 секунды без наведения — полоска');
  check(await pg.locator('.ed-mini .edm-seg').count() >= 8 && /Разработка/.test(await pg.textContent('.ed-mini .edm-seg.here')), 'в полоске — все среды, открытая — плашкой с названием');
  const segs = await pg.$$eval('.ed-mini .edm-seg', (x) => x.map((e) => e.getBoundingClientRect().width));
  check(Math.max(...segs) > 2 * Math.min(...segs), 'открытая среда заметно крупнее');
  const mb = await pg.locator('.ed-mini').boundingBox(); await pg.mouse.move(mb.x + 30, mb.y + mb.height / 2, { steps: 3 }); await pg.waitForTimeout(700);
  check(await st() === 'false,false', 'навели — док развернулся');
  await pg.mouse.move(800, 300, { steps: 3 }); await pg.waitForTimeout(3700);
  check(await st() === 'true,true', 'увели — снова свернулся');
  await pg.keyboard.press('Tab'); await pg.locator('#envDock .ed-i').first().focus(); await pg.waitForTimeout(400);
  check(await st() === 'false,false', 'фокус с клавиатуры разворачивает док');
  const cur = await pg.locator('#envDock .ed-i[aria-current="true"]').boundingBox(), oth = await pg.locator('#envDock .ed-i').nth(4).boundingBox();
  check(cur.width > oth.width + 3, 'в доке значок открытой среды чуть крупнее');
  await pg.context().close();
}

console.log('Вид');
const n = await page.locator('#envDock .ed-i').count();
check(n >= 5, 'в доке значки всех сред и «Все среды»: ' + n);
check(await page.locator('#envDock .ed-i[aria-current="true"]').count() === 1 && /Разработка/.test(await page.getAttribute('#envDock .ed-i[aria-current="true"]', 'aria-label')), 'открытая среда отмечена');
check(await page.locator('#envDock .ed-dot.here').count() === 1, 'под открытой средой — точка');
const w0 = (await page.locator('#envDock .ed-i').nth(2).boundingBox()).width;
const r2 = await page.locator('#envDock .ed-i').nth(2).boundingBox();
await page.mouse.move(r2.x + r2.width / 2, r2.y + r2.height / 2, { steps: 5 }); await page.waitForTimeout(350);
const w1 = (await page.locator('#envDock .ed-i').nth(2).boundingBox()).width, wN = (await page.locator('#envDock .ed-i').nth(3).boundingBox()).width, wF = (await page.locator('#envDock .ed-i').nth(7).boundingBox()).width;
check(w1 > w0 * 1.4 && wN > w0 && wN < w1 && Math.abs(wF - w0) < 2, 'под курсором значок крупнее, соседи — чуть, дальние — как были (' + [w0, w1, wN, wF].map(Math.round).join('/') + ')');
check(await page.locator('#envDock .ed-i').nth(2).locator('.ed-tip').evaluate((x) => getComputedStyle(x).opacity) === '1', 'над значком — подпись');
await page.mouse.move(800, 300, { steps: 4 }); await page.waitForTimeout(400);
check(Math.abs((await page.locator('#envDock .ed-i').nth(2).boundingBox()).width - w0) < 2, 'увели курсор — значки вернулись');

console.log('Переключение');
const office = page.locator('#envDock .ed-i', { hasText: 'Офис' });
await office.click(); await page.waitForTimeout(120);
check(await office.evaluate((x) => x.classList.contains('jump')), 'щелчок — значок подпрыгивает');
await page.waitForTimeout(1100);
check(/Офис/.test(await page.textContent('#envChip')), 'открылась среда «Офис»');
check(/Офис/.test(await page.getAttribute('#envDock .ed-i[aria-current="true"]', 'aria-label')), 'точка переехала под «Офис»');
await page.locator('#envDock .ed-i', { hasText: 'Все среды' }).click(); await page.waitForTimeout(700);
check(await page.isVisible('#eco'), '«Все среды» открывает экосистему'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);

console.log('Клавиатура');
await page.locator('#envDock .ed-i').first().focus();
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
check(await page.evaluate(() => document.activeElement.classList.contains('kb') && [...document.querySelectorAll('#envDock .ed-i')].indexOf(document.activeElement) === 2), '← → переходят по значкам, подпись видна');
await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
check(!/Офис/.test(await page.textContent('#envChip')), 'Enter открывает выбранную среду');

console.log('Редактор');
await page.locator('#envDock .ed-i').first().click(); await page.waitForTimeout(1200);
await page.click('#bLib'); await page.waitForTimeout(300); await page.locator('.pcard').first().locator('button.code').click(); await page.waitForTimeout(600);
check(await page.$eval('#envDock', (x) => getComputedStyle(x).opacity) === '0', 'в редакторе кода док прячется и не закрывает консоль');
await page.evaluate(() => { const b = document.querySelector('#backBtn'); if (b && !b.hidden) b.click(); }); await page.waitForTimeout(400); if (await page.isVisible('#editor')) { await page.keyboard.press('Escape'); await page.locator('.ed-i').first().click().catch(() => {}); } await page.waitForTimeout(600);
check(await page.$eval('#envDock', (x) => getComputedStyle(x).opacity) === '1' || await page.isVisible('#editor'), 'вернулись на доску — док снова виден');

console.log('Режимы');
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.locator('#pers button', { hasText: 'Прятать, пока не нужен' }).click(); await page.waitForTimeout(400);
await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(400);
await page.mouse.move(800, 400); await page.waitForTimeout(900);
const hidden = await page.$eval('#envDock', (x) => getComputedStyle(x).opacity);
const row = await page.locator('.row').boundingBox();
await page.mouse.move(800, row.y + row.height - 4, { steps: 3 }); await page.waitForTimeout(600);
check(hidden === '0' && await page.$eval('#envDock', (x) => getComputedStyle(x).opacity) === '1', '«Прятать»: док выезжает у нижнего края');
await page.click('#setBtn'); await page.waitForTimeout(300);
await page.locator('#pers button', { hasText: 'Выключить' }).first().click(); await page.waitForTimeout(300);
check(!(await page.isVisible('#envDock')), '«Выключить»: дока нет');
await page.locator('#pers button', { hasText: 'Показывать' }).first().click(); await page.waitForTimeout(300);
check(await page.isVisible('#envDock'), '«Показывать»: док снова на месте');

console.log('Меню среды (правый щелчок)');
const officeI = () => page.locator('#envDock .ed-i', { hasText: 'Офис' });
const ctxItem = (t) => page.locator('.ctx .ctx-i', { hasText: t }).first();
// данные приложения — в localStorage: список пространств и содержимое каждого
await page.evaluate(() => { window.__L = () => JSON.parse(localStorage.getItem('triosteum.projects')).list; window.__S = (id) => JSON.parse(localStorage.getItem('triosteum.proj.' + id) || 'null'); });
const spaces = () => page.evaluate(() => __L().map((p) => (p.env || 'code') + ':' + p.name));
const before = (await spaces()).length;
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
check(await page.isVisible('#ctx') && /Офис/.test(await page.textContent('#ctx .ctx-h')), 'правый щелчок по среде — меню с её названием');
const cb = await page.locator('#ctx').boundingBox(), ib = await officeI().boundingBox();
check(cb.y + cb.height <= ib.y + 2, 'меню над значком, не закрывает док (' + [cb.y, cb.height, ib.y].map(Math.round) + ')');
await ctxItem('Новое пространство').click(); await page.waitForTimeout(500);
check((await spaces()).length === before + 1 && /Офис/.test(await page.textContent('#envChip')), '«Новое пространство» создаёт пространство в этой среде');
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
await ctxItem('Новое пространство').click(); await page.waitForTimeout(500);
const offN = (await spaces()).filter((x) => x.startsWith('docs:')).length;
check(offN >= 2, 'в «Офисе» несколько пространств: ' + offN);
await page.evaluate(() => { const id = __L().filter((p) => p.env === 'docs').map((p) => p.id).filter((i) => i !== JSON.parse(localStorage.getItem('triosteum.projects')).cur)[0]; localStorage.setItem('triosteum.proj.' + id, JSON.stringify({ nodes: [], edges: [], notes: [{ id: 't1', text: 'метка', x: 0, y: 0 }], cam: { x: 0, y: 0, k: 1 }, seq: 2 })); });   // не открытое — его доска не перезапишет
await page.locator('#envDock .ed-i').first().click({ button: 'right' }); await page.waitForTimeout(450);
await ctxItem('Открыть пространство').hover(); await page.waitForTimeout(450);
check(await page.locator('.ctx').nth(1).locator('.ctx-i').count() >= 1, '«Открыть пространство» — подменю со списком');
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
await ctxItem('Очистить все в среде').click(); await page.waitForTimeout(300);
check(await page.isVisible('#askModal'), 'очистка просит подтверждения'); await page.click('#askYes'); await page.waitForTimeout(500);
check(await page.evaluate(() => __L().filter((p) => p.env === 'docs').every((p) => { const g = __S(p.id); return !g || !(g.notes || []).length; })), 'пространства среды очищены, названия на месте');
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
check(await ctxItem('Вернуть').isVisible(), 'в меню есть «Вернуть»'); await ctxItem('Вернуть').click(); await page.waitForTimeout(500);
check(await page.evaluate(() => __L().filter((p) => p.env === 'docs').some((p) => ((__S(p.id) || {}).notes || []).length)), '«Вернуть» возвращает содержимое');
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
await ctxItem('Удалить пространство').hover(); await page.waitForTimeout(450);
await page.locator('.ctx').nth(1).locator('.ctx-i').first().click(); await page.waitForTimeout(300); await page.click('#askYes'); await page.waitForTimeout(500);
check((await spaces()).filter((x) => x.startsWith('docs:')).length === offN - 1, 'удалить одно пространство');
await officeI().click({ button: 'right' }); await page.waitForTimeout(450);
await page.locator('.ctx .ctx-i', { hasText: /^Удалить (все в среде|«)/ }).first().click(); await page.waitForTimeout(300); await page.click('#askYes'); await page.waitForTimeout(600);
check((await spaces()).filter((x) => x.startsWith('docs:')).length === 0 && (await spaces()).length >= 1, 'удалить все пространства среды — остальные целы');
await page.locator('#envDock .ed-i', { hasText: 'Все среды' }).click({ button: 'right' }); await page.waitForTimeout(450);
check(await ctxItem('Очистить все пространства').isVisible() && await ctxItem('Удалить все пространства').isVisible(), '«Все среды»: очистить или удалить всё');
await page.keyboard.press('Escape'); await page.waitForTimeout(200);

console.log('Открытый файл и подсказки');
await page.locator('#envDock .ed-i', { hasText: 'Вектор' }).click(); await page.waitForTimeout(1300);
await page.locator('button', { hasText: 'Векторный рисунок' }).first().click(); await page.waitForTimeout(1200);
const dop = () => page.$eval('#envDock', (x) => getComputedStyle(x).opacity);
await page.mouse.move(800, 400); await page.waitForTimeout(900);
check(await dop() === '0' && await page.isVisible('.ed-handle'), 'в открытом файле док спрятан, внизу — полоска');
await page.hover('.ed-handle'); await page.waitForTimeout(600);
check(await dop() === '1', 'навели на полоску — док выехал');
check(await page.locator('.ie-hint.hk .hk-r').count() >= 3, 'подсказка редактора — таблицей «клавиша — действие»');
await page.locator('.otab', { hasText: 'Рабочий стол' }).first().click().catch(() => {}); await page.waitForTimeout(500);
await page.locator('#envDock .ed-i').first().click().catch(() => {}); await page.waitForTimeout(1300);
await page.hover('#bKeys'); await page.waitForTimeout(500);
const tb = await page.locator('#tip').boundingBox();
check(await page.locator('#tip .hk-r').count() > 15 && await page.locator('#tip .hk-h').count() >= 3, 'горячие клавиши — по разделам, клавиши плашками');
check(tb.y >= 0 && tb.y + tb.height <= 900 && tb.width > 400, 'подсказка широкая и целиком на экране');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
