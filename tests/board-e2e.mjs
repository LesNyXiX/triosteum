// Доска: точки на связях (снять отросток, встряхнуть, утянуть со связи), желе при перетаскивании,
// варианты блоков в меню «Добавление элементов».
// Запуск: npm run build && node tests/board-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const node = (id, name, lang, x, y) => ({ id, name, lang, x, y, codes:{}, pluginId:null, family:null, desc:'', colors:null });
const graph = { nodes:[node('a', 'Python верх', 'python', 120, 60), node('h', 'HTML', 'html', 120, 200), node('p', 'Python низ', 'python', 60, 420), node('c', 'C#', 'csharp', 640, 160)],
  edges:[{ id:'e1', from:'a', to:'c', taps:[{ id:'p1', t:0.45, nodes:['h'] }, { id:'p2', t:0.8, nodes:['p'] }] }], notes:[], cam:{ x:0, y:0, k:1 }, seq:20 };
await ctx.addInitScript((g) => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur:'p1', list:[{ id:'p1', name:'Доска', t:Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name:'Тест', org:'Завод' }));
}, graph);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(900);
const tapBox = (id) => page.locator('.tap-handle[data-tap="' + id + '"]').boundingBox();
const taps = () => page.$$eval('.tap-handle', (x) => x.length);
const tlinks = () => page.$$eval('.tlink-hit', (x) => x.length);

console.log('Точки на связях');
check(await taps() === 2 && await tlinks() === 2, 'две точки, к каждой подключён блок');
// 1) потрясти точку 2 — блок отцепляется
let b = await tapBox('p2'), x = b.x + b.width / 2, y = b.y + b.height / 2;
await page.mouse.move(x, y); await page.mouse.down();
for (let i = 0; i < 8; i++) await page.mouse.move(x + (i % 2 ? -26 : 26), y + (i % 2 ? -4 : 4), { steps: 2 });
await page.mouse.move(x, y, { steps: 2 }); await page.mouse.up(); await page.waitForTimeout(300);
check(await taps() === 2 && await tlinks() === 1, 'встряхнули точку 2 — блок «Python низ» отцеплен');
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
check(await tlinks() === 2, 'Ctrl+Z вернул подключение');
// 2) утянуть точку 2 далеко от связи — она становится узлом, блок остаётся подключён
b = await tapBox('p2'); x = b.x + b.width / 2; y = b.y + b.height / 2;
await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 10, y + 40, { steps: 3 }); await page.mouse.move(x + 40, y + 220, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
check(await taps() === 1 && await page.$$eval('#nodes .node.hub', (x) => x.length) === 1, 'точку 2 утянули со связи — появился узел');
check(await page.$$eval('.edge-g', (x) => x.length) === 2, 'блок «Python низ» подключён к новому узлу');
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
check(await taps() === 2 && await page.$$eval('#nodes .node.hub', (x) => x.length) === 0, 'Ctrl+Z вернул точку на связь');
// 3) снять отросток к точке 2, потянув за его середину
const mid = await page.evaluate(() => { const p = document.querySelector('.tlink-hit[data-tap="p2"]'), L = p.getTotalLength(), q = p.getPointAtLength(L * 0.5), m = p.getScreenCTM(); return { x: q.x * m.a + m.e, y: q.y * m.d + m.f }; });
await page.mouse.move(mid.x, mid.y); await page.mouse.down(); await page.mouse.move(mid.x + 30, mid.y + 120, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
await page.keyboard.press('Escape'); await page.waitForTimeout(150);
check(await tlinks() === 1, 'отросток к точке 2 снимается протягиванием');

console.log('Встряхивание по диагонали (как на видео)');
await page.keyboard.press('Escape');
const before2 = await page.$$eval('.edge-g', (x) => x.length);
const hb = await page.locator('#nodes .node', { hasText: 'Python верх' }).boundingBox();
let sx = hb.x + 100, sy = hb.y + 30; await page.mouse.move(sx, sy); await page.mouse.down();
for (let i = 0; i < 6; i++) await page.mouse.move(sx + (i % 2 ? -70 : 70) + i * 4, sy + (i % 2 ? -45 : 45), { steps: 4 });
await page.mouse.up(); await page.waitForTimeout(300);
check(await page.$$eval('#nodes .node.hub', (x) => x.length) >= 1 && await page.$$eval('.edge-g', (x) => x.length) === before2, 'диагональная тряска блока — связи перешли на узел');
await page.keyboard.press('Control+z'); await page.waitForTimeout(300);

console.log('Обычное перетаскивание (как на видео)');
const hubsZ = await page.$$eval('#nodes .node.hub', (x) => x.length);
for (let round = 0; round < 3; round++) {
  const b0 = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
  let mx = b0.x + 60, my = b0.y + 25; await page.mouse.move(mx, my); await page.mouse.down();
  for (const [dx, dy] of [[120, 30], [-70, 20], [110, -15], [-50, 35], [90, 10]]) { mx += dx; my += dy; await page.mouse.move(mx, my, { steps: 6 }); }
  await page.mouse.up(); await page.waitForTimeout(30);
}
check(await page.$$eval('#nodes .node.hub', (x) => x.length) === hubsZ, 'перетаскивание с поправками туда-обратно не создаёт узлов');
// схватить блок, пока он ещё «доезжает»: он остаётся под курсором, без рывка
const b0g = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
await page.mouse.move(b0g.x + 50, b0g.y + 20); await page.mouse.down();
const b1 = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
await page.waitForTimeout(200);
const b1s = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
check(Math.abs(b1s.x - b1.x) < 2 && Math.abs(b1s.y - b1.y) < 2, 'схватили на ходу — блок сразу остановился под курсором');
await page.mouse.move(b0g.x + 60, b0g.y + 24, { steps: 2 }); await page.waitForTimeout(250);
const b2 = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
check(Math.abs((b2.x - b1.x) - 10) < 6 && Math.abs((b2.y - b1.y) - 4) < 6, 'блок, схваченный на ходу, не прыгает (сдвиг ' + Math.round(b2.x - b1.x) + ', ' + Math.round(b2.y - b1.y) + ')');
await page.mouse.up(); await page.waitForTimeout(700);
check(await page.$$eval('#nodes .node', (x) => x.every((d) => !d.style.transform)), 'после отпускания блоки без деформации');

console.log('Желе');
const nb = await page.locator('#nodes .node', { hasText: 'C#' }).boundingBox();
await page.mouse.move(nb.x + 100, nb.y + 30); await page.mouse.down();
let tf = '';
for (let i = 1; i <= 6; i++) { await page.mouse.move(nb.x + 100 + i * 30, nb.y + 30 + i * 6); tf = tf || await page.$eval('#nodes .node.dragging', (d) => d.style.transform); }
check(/skew|scale/.test(tf), 'при перетаскивании блок тянется: ' + tf.slice(0, 50));
await page.mouse.up(); await page.waitForTimeout(60);
check(await page.locator('#nodes .node.jelly-end').count() === 1, 'после отпускания — пружинящая волна');

console.log('Встряхивание по диагонали и повторный захват');
const hubs0 = await page.$$eval('#nodes .node.hub', (x) => x.length);
const pb = await page.locator('#nodes .node', { hasText: 'Python верх' }).boundingBox();
let px = pb.x + 90, py = pb.y + 30;
await page.mouse.move(px, py); await page.mouse.down();
for (let i = 0; i < 9; i++) await page.mouse.move(px + (i % 2 ? -22 : 22), py + (i % 2 ? -16 : 16), { steps: 2 });
await page.mouse.up(); await page.waitForTimeout(300);
check(await page.$$eval('#nodes .node.hub', (x) => x.length) === hubs0 + 1, 'встряхивание по диагонали распознано — связи перешли на узел');
// два быстрых захвата с перетаскиванием подряд не открывают редактор
const qb = await page.locator('#nodes .node', { hasText: 'HTML' }).boundingBox();
await page.mouse.move(qb.x + 90, qb.y + 30); await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
await page.mouse.down(); await page.mouse.move(qb.x + 140, qb.y + 60, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(300);
check(!(await page.isVisible('#editor')), 'долгое нажатие и следом захват — редактор не открывается');
await page.locator('#nodes .node', { hasText: 'HTML' }).dblclick(); await page.waitForTimeout(400);
check(await page.isVisible('#editor'), 'настоящий двойной клик по-прежнему открывает блок');
await page.evaluate(() => { const b = document.getElementById('backBtn') || document.getElementById('toBoard'); if (b && !b.hidden) b.click(); }); await page.waitForTimeout(300);
if (await page.isVisible('#editor')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }

console.log('Меню «Добавление элементов»');
await page.click('#bAdd'); await page.waitForTimeout(200);
await page.locator('#addMenu .am-item[data-add="block"]').hover(); await page.waitForTimeout(250);
check(await page.isVisible('.am-sub'), 'наведение на «Блок» сразу показывает варианты');
const kinds = await page.$$eval('.am-sub .am-kind b', (x) => x.map((e) => e.textContent));
check(kinds.length >= 5 && kinds.includes('C++') && kinds.includes('1С'), '«Разработка»: варианты — языки (' + kinds.join(', ') + ')');
await page.locator('.am-sub .am-kind', { hasText: 'C++' }).click(); await page.waitForTimeout(200);
const before = await page.$$eval('#nodes .node', (x) => x.length);
await page.mouse.click(900, 600); await page.waitForTimeout(300);
const last = await page.$$eval('#nodes .node', (x) => x[x.length - 1].querySelector('.ln').textContent);
check(await page.$$eval('#nodes .node', (x) => x.length) === before + 1 && last === 'C++', 'выбран C++ — на доску встал блок C++');
await page.keyboard.press('Escape');
// другая среда — свои варианты
await page.click('#ecoBtn'); await page.waitForTimeout(200);
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Финансы' }).locator('button', { hasText: 'Пример' }).first().click(); await page.waitForTimeout(250);
await page.locator('#ctx .ctx-i').first().click(); await page.waitForTimeout(900);
await page.click('#bAdd'); await page.waitForTimeout(200);
await page.locator('#addMenu .am-item[data-add="block"]').hover(); await page.waitForTimeout(250);
if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/addmenu.png' });
const heads = await page.$$eval('.am-sub .ctx-h', (x) => x.map((e) => e.textContent));
const kinds2 = await page.$$eval('.am-sub .am-kind b', (x) => x.map((e) => e.textContent));
check(heads.some((h) => /Расчёты среды/.test(h)) && heads.some((h) => /Код/.test(h)) && kinds2.length > 10, '«Финансы»: свои расчёты + общие + код (' + heads.join(' / ') + ')');
await page.locator('#addMenu .am-item[data-add="hub"]').hover(); await page.waitForTimeout(500);
check(!(await page.isVisible('.am-sub')), 'на другом пункте варианты скрываются');

check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? '\nНе прошло: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
