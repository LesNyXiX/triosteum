// Прилипание окон к краям, как в Windows: половины, четверти, граница со средой, отлипание.
// Запуск: npm run build && node tests/snap-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const near = (a, b, d = 12) => Math.abs(a - b) <= d;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
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
const box = (s) => page.locator(s).boundingBox();
const row = await box('.row');
const dragHead = async (win, x, y) => {
  const h = await box(win + ' .pers-h'); await page.mouse.move(h.x + 80, h.y + 14); await page.mouse.down();
  await page.mouse.move(h.x + 110, h.y + 40, { steps: 4 }); await page.mouse.move(x, y, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(450);
};
const reloadKeep = async () => {
  const snap = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  await page.reload(); await page.waitForTimeout(300);
  const lost = await page.evaluate((s) => { const o = JSON.parse(s); if (localStorage.getItem('triosteum.win.scheme')) return false; localStorage.clear(); Object.keys(o).forEach((k) => localStorage.setItem(k, o[k])); return true; }, snap);
  if (lost) { await page.reload(); } await page.waitForTimeout(700);
};

console.log('Половины');
await page.click('#bScheme'); await page.waitForTimeout(400);
const hd = await box('#schemeW .pers-h');
await page.mouse.move(hd.x + 80, hd.y + 14); await page.mouse.down(); await page.mouse.move(hd.x + 110, hd.y + 40, { steps: 4 }); await page.mouse.move(row.x + row.width - 3, row.y + 400, { steps: 14 });
check(await page.isVisible('.snap-ghost.on'), 'у правого края видно, куда встанет окно');
await page.mouse.up(); await page.waitForTimeout(450);
let w = await box('#schemeW'), c = await box('#canvas');
check(near(w.x + w.width, row.x + row.width, 8) && near(w.width, row.width / 2, 12) && near(w.height, row.height, 12), 'окно заняло правую половину');
check(near(c.x + c.width, row.x + row.width / 2, 8), 'доска ужалась в левую половину');
check(!(await page.isVisible('.snap-ghost.on')), 'предпросмотр исчез');

console.log('Граница со средой');
const sp = await box('.ss-r');
await page.mouse.move(sp.x + 5, sp.y + 200); await page.mouse.down(); await page.mouse.move(row.x + row.width * 0.65, sp.y + 210, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
w = await box('#schemeW'); c = await box('#canvas');
check(near(w.width, row.width * 0.35, 14) && near(c.x + c.width, row.x + row.width * 0.65, 10), 'границу перетащили — окно и доска поменяли размер');
await page.dblclick('.ss-r'); await page.waitForTimeout(400);
w = await box('#schemeW');
check(near(w.width, row.width / 2, 14), 'двойной щелчок по границе — снова половина');

console.log('Сохранение и закрытие');
await reloadKeep();
await page.click('#bScheme'); await page.waitForTimeout(500);
w = await box('#schemeW');
check(near(w.x + w.width, row.x + row.width, 8) && near(w.width, row.width / 2, 14), 'после перезагрузки окно открывается прилипшим');
await page.click('#schemeW button[aria-label="Закрыть"]'); await page.waitForTimeout(450);
c = await box('#canvas');
check(near(c.x + c.width, row.x + row.width, 4), 'окно закрыли — доска снова во всю ширину');

console.log('Четверти и верх/низ');
await page.click('#bScheme'); await page.waitForTimeout(500);
await dragHead('#schemeW', row.x + row.width - 3, row.y + 3);
await page.click('#setBtn'); await page.waitForTimeout(400);
await dragHead('#pers', row.x + row.width - 3, row.y + row.height - 3);
w = await box('#schemeW'); const p2 = await box('#pers');
check(near(w.height, row.height / 2, 14) && near(p2.height, row.height / 2, 14) && near(w.x, p2.x, 4) && p2.y > w.y + w.height - 12, 'правый верхний и правый нижний углы — окна одно над другим');
await dragHead('#pers', row.x + row.width / 2, row.y + 2);
const p3 = await box('#pers'); c = await box('#canvas');
check(near(p3.y, row.y, 8) && near(p3.height, row.height / 2, 14) && near(c.y, row.y + row.height / 2, 10), 'у верхнего края — верхняя половина, доска под окном');
w = await box('#schemeW');
check(near(w.height, row.height / 2, 14) && await page.isVisible('.snap-slot'), 'угловое окно осталось четвертью, на свободном месте — подсказка «перетащите сюда окно»');

console.log('Отлипание');
await dragHead('#pers', 700, 500);
const p4 = await box('#pers'); c = await box('#canvas');
check(p4.height < row.height * 0.9 && near(c.y, row.y, 4), 'потянули заголовок — окно отлипло, доска вернула место');

console.log('Клавиатура');
await page.focus('#pers .pers-h h2').catch(() => {});
await page.locator('#pers').press('Control+Alt+ArrowLeft'); await page.waitForTimeout(400);
const p5 = await box('#pers');
check(near(p5.x, row.x, 8) && near(p5.height, row.height, 14), 'Ctrl+Alt+← — окно прилипло к левому краю');
await page.locator('#pers').press('Control+Alt+ArrowUp'); await page.waitForTimeout(400);
const p6 = await box('#pers');
check(near(p6.height, row.height / 2, 14) && near(p6.y, row.y, 8), 'затем Ctrl+Alt+↑ — левая верхняя четверть');
await page.locator('#pers').press('Control+Alt+ArrowDown'); await page.waitForTimeout(300);
await page.locator('#pers').press('Control+Alt+ArrowRight'); await page.waitForTimeout(400);

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
