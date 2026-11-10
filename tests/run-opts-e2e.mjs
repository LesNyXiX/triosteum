// Надёжность запуска: выключение блока, закреплённый результат, повторы при ошибке, «продолжать при ошибке».
// Запуск: npm run build && node tests/run-opts-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, code, extra) => Object.assign({ id, name, lang: 'cpp', x, y: 220, codes: { cpp: code }, pluginId: null, family: null, desc: '', colors: null }, extra || {});
const OK = 'int run(){ return 42; }', BAD = 'int run(){ return undefinedThing + 1; }';
const browser = await browser0();
async function browser0() { return chromium.launch(); }

async function open(nodes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((g) => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Запуск', t: Date.now() }] }));
    localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
  }, { nodes, edges: [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
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
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
