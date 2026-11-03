// Офис: схема файлов (связи, связывание линией, компиляция) и мастер функций.
// Запуск: npm run build && node tests/office-map-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
const SHOTS = process.env.SHOTS;
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
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Офис' }).locator('button', { hasText: 'Пример офиса' }).click(); await page.waitForTimeout(800);

console.log('Схема файлов');
await page.click('#otabs .otab.fixed[data-tab="map"]'); await page.waitForTimeout(500);
const nodes = await page.$$eval('.fm-node', (x) => x.length);
const edges = await page.$$eval('.fm-edges path.fm-edge', (x) => x.length);
check(nodes >= 4, 'блоки-файлы: ' + nodes);
check(edges >= 2, 'связи найдены сами: ' + edges);
check((await page.textContent('#topRun')) === 'Скомпилировать', 'кнопка «Скомпилировать»');
if (SHOTS) await page.screenshot({ path: SHOTS + '/map.png' });
await page.click('#topRun'); await page.waitForTimeout(800);
check(await page.isVisible('.fm-report'), 'отчёт компиляции');
const rep = await page.textContent('.fm-report');
check(/Порядок пересчёта: .+→/.test(rep), 'порядок пересчёта: ' + rep.match(/Порядок пересчёта: [^З]*/)[0].slice(0, 90));
check(await page.$$eval('.fm-node.ok, .fm-node.err, .fm-node.warn', (x) => x.length) === nodes, 'у каждого блока статус');

// новая книга и связь линией: живая копия листа
await page.locator('.ribbon .rb', { hasText: '+ Файл' }).click(); await page.waitForTimeout(200);
await page.locator('#ctx .ctx-i', { hasText: 'Таблица' }).first().click(); await page.waitForTimeout(500);
const newName = await page.$eval('#otabFiles .otab.on .nm', (x) => x.textContent);
await page.click('#otabs .otab.fixed[data-tab="map"]'); await page.waitForTimeout(400);
const src = page.locator('.fm-node', { hasText: 'Таблица' }).filter({ hasNotText: newName }).first();
const srcName = await src.locator('.fm-name').textContent();
const dst = page.locator('.fm-node', { hasText: newName });
const p = await src.locator('.fm-out').boundingBox(), q = await dst.boundingBox();
await page.mouse.move(p.x + 6, p.y + 6); await page.mouse.down(); await page.mouse.move(q.x + 60, q.y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
check(await page.isVisible('#howW'), 'после протягивания — окно «Как связать?»');
await page.locator('.how-i', { hasText: 'Живая копия листа' }).first().click(); await page.waitForTimeout(500);
const edges2 = await page.$$eval('.fm-edges path.fm-edge', (x) => x.length);
check(edges2 === edges + 1, 'появилась новая связь «' + srcName + '» → «' + newName + '»');
await page.click('#topRun'); await page.waitForTimeout(600);
const st = await dst.getAttribute('class');
check(/\bok\b/.test(st), 'новая книга скомпилирована без ошибок');

console.log('Мастер функций');
await dst.dblclick(); await page.waitForTimeout(600);
const tabs = await page.$$eval('.sg-tabs button, .sg-tabs [role=tab]', (x) => x.map((t) => t.textContent));
check(tabs.length >= 2, 'в книге лист-копия: ' + tabs.join(', '));
await page.click('#sgFxBtn'); await page.waitForTimeout(250);
check(await page.isVisible('#fxw'), 'окно функций открылось');
const total = await page.$$eval('#fxw .fxw-i', (x) => x.length);
check(total > 100, 'функций в списке: ' + total);
await page.fill('#fxw input', 'корень'); await page.waitForTimeout(150);
await page.locator('#fxw .fxw-i').first().click(); await page.waitForTimeout(150);
check((await page.inputValue('#sgFx')) === '=КОРЕНЬ()', 'вставлено «=КОРЕНЬ()»');
await page.fill('#sgFx', '=КОРЕНЬ(16)+ВПР("б";{x};1;0)'.replace('ВПР("б";{x};1;0)', 'СТЕПЕНЬ(2;3)')); await page.press('#sgFx', 'Enter'); await page.waitForTimeout(300);
await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
const ref = await page.textContent('#sgRef');
const shown = await page.$eval('#sgWrap', (w) => w.innerText);
check(/\b12\b/.test(shown), 'ячейка посчитала =КОРЕНЬ(16)+СТЕПЕНЬ(2;3) = 12 (' + ref + ')');
await page.fill('#sgFx', '=ВПР'); await page.locator('#sgFx').press('End'); await page.locator('#sgFx').type('('); await page.waitForTimeout(150);
const hint = await page.textContent('#sgFxHint');
check(/ВПР\(искомое/.test(hint), 'подсказка синтаксиса: ' + hint.slice(0, 60));
if (SHOTS) { await page.click('#sgFxBtn'); await page.waitForTimeout(200); await page.screenshot({ path: SHOTS + '/fx.png' }); }

check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\nНе прошло: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
