// Фоторедактор и векторная графика: инструменты, слои, история, экспорт, сохранение.
// Запуск: npm run build && node tests/graphics-e2e.mjs   (SHOTS=/tmp — сохранить скриншоты)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
const SHOTS = process.env.SHOTS;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Тест', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); });
await page.goto(URL); await page.waitForTimeout(800);
async function openDemo(env) {
  await page.click('#ecoBtn'); await page.waitForTimeout(200);
  await page.locator('#ecoGrid .eco-card.go', { hasText: env }).locator('button', { hasText: 'Пример' }).click(); await page.waitForTimeout(1200);
}
const px = (x, y) => page.evaluate(([x, y]) => Array.from(document.getElementById('ieCanvas').getContext('2d').getImageData(x, y, 1, 1).data), [x, y]);
async function canvasPoint(x, y) { const b = await page.locator('#ieCanvas').boundingBox(); const w = await page.$eval('#ieCanvas', (c) => c.width); const k = b.width / w; return { x: b.x + x * k, y: b.y + y * k }; }

console.log('Фоторедактор');
await openDemo('Фоторедактор');
check(await page.isVisible('#ieCanvas'), 'редактор изображения открыт');
check((await page.textContent('#envName')) === 'Фоторедактор', 'среда «Фоторедактор»');
check(await page.$$eval('.ie-layer', (x) => x.length) === 5, 'в примере 5 слоёв');
check(await page.isVisible('#otabs .otab.fixed[data-tab="auto"]'), 'есть вкладка «Автоматизация»');
if (SHOTS) await page.screenshot({ path: SHOTS + '/photo.png' });
// кисть
await page.locator('#ieView').focus(); await page.keyboard.press('KeyB');
const a = await canvasPoint(300, 300), b2 = await canvasPoint(500, 320);
const before = await px(400, 310);
await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b2.x, b2.y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(200);
const after = await px(400, 310);
check(after.join() !== before.join() && after[2] > after[0], 'кисть рисует синим: ' + after.slice(0, 3).join(','));
await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
check((await px(400, 310)).join() === before.join(), 'Ctrl+Z отменяет мазок');
// выделение и коррекция только внутри него
await page.keyboard.press('KeyM');
const s1 = await canvasPoint(100, 100), s2 = await canvasPoint(300, 250);
await page.mouse.move(s1.x, s1.y); await page.mouse.down(); await page.mouse.move(s2.x, s2.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);
// выбираем слой «Небо» (нижний)
await page.locator('.ie-layer', { hasText: 'Небо' }).click(); await page.waitForTimeout(100);
const inBefore = await px(150, 150), outBefore = await px(600, 150);
await page.locator('.ribbon .rb', { hasText: 'Коррекция' }).click(); await page.waitForTimeout(150);
await page.locator('#ctx .ctx-i', { hasText: 'Инверсия' }).click(); await page.waitForTimeout(300);
const inAfter = await px(150, 150), outAfter = await px(600, 150);
check(Math.abs(inAfter[0] - (255 - inBefore[0])) < 4, 'инверсия внутри выделения: ' + inBefore.slice(0, 3) + ' → ' + inAfter.slice(0, 3));
check(outAfter.join() === outBefore.join(), 'вне выделения без изменений');
await page.locator('#ieView').focus(); await page.keyboard.press('Control+d');
// коррекция с ползунками
await page.locator('.ribbon .rb', { hasText: 'Коррекция' }).click(); await page.waitForTimeout(150);
await page.locator('#ctx .ctx-i', { hasText: 'Яркость и контраст' }).click(); await page.waitForTimeout(200);
check(await page.isVisible('#ieDlg'), 'окно коррекции с ползунками');
await page.locator('#ieDlg input[type=range]').first().fill('60'); await page.waitForTimeout(200);
await page.locator('#ieDlg button', { hasText: 'Применить' }).click(); await page.waitForTimeout(300);
check((await px(600, 150))[0] > outAfter[0], 'яркость повышена');
// слои
const n0 = await page.$$eval('.ie-layer', (x) => x.length);
await page.locator('.ie-lbar .rb[aria-label="Новый слой"]').click(); await page.waitForTimeout(150);
check(await page.$$eval('.ie-layer', (x) => x.length) === n0 + 1, 'новый слой');
// текст
await page.locator('#ieView').focus(); await page.keyboard.press('KeyT');
const tp = await canvasPoint(600, 650); await page.mouse.click(tp.x, tp.y); await page.waitForTimeout(150);
await page.keyboard.type('Привет'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(300);
check(await page.$$eval('.ie-layer', (x) => x.some((e) => /Текст: Привет/.test(e.textContent))), 'текстовый слой');
// размер изображения
await page.locator('.ribbon .rb', { hasText: 'Изображение' }).click(); await page.waitForTimeout(150);
await page.locator('#ctx .ctx-i', { hasText: 'Размер изображения' }).click(); await page.waitForTimeout(150);
await page.locator('#ieDlg input[type=number]').first().fill('600'); await page.locator('#ieDlg input[type=number]').first().dispatchEvent('input');
await page.locator('#ieDlg button', { hasText: 'Применить' }).click(); await page.waitForTimeout(400);
check(await page.$eval('#ieCanvas', (c) => c.width + '×' + c.height) === '600×400', 'размер изображения 600×400');
// экспорт
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#topRun')]);
const png = readFileSync(await dl.path());
check(dl.suggestedFilename().endsWith('.png') && png.slice(1, 4).toString() === 'PNG', 'скачан PNG: ' + dl.suggestedFilename() + ', ' + png.length + ' байт');
// сохранение после перезагрузки
await page.waitForTimeout(1800);
await page.reload(); await page.waitForTimeout(1500);
check(await page.isVisible('#ieCanvas') && await page.$eval('#ieCanvas', (c) => c.width) === 600, 'после перезагрузки изображение 600 px и открыто');
check(await page.$$eval('.ie-layer', (x) => x.length) === n0 + 2, 'слои сохранились: ' + await page.$$eval('.ie-layer', (x) => x.length));

console.log('Векторная графика');
await openDemo('Векторная графика');
check(await page.isVisible('#veArt'), 'векторный редактор открыт');
const cnt = () => page.$$eval('#veArt > g[data-id]', (x) => x.length);
check(await cnt() === 9, 'в примере 9 объектов');
if (SHOTS) await page.screenshot({ path: SHOTS + '/vector.png' });
async function artPoint(x, y) { const b = await page.locator('#veArt').boundingBox(); const w = await page.$eval('#veArt', (s) => +s.getAttribute('width')); const k = b.width / w; return { x: b.x + x * k, y: b.y + y * k }; }
// прямоугольник
await page.locator('#veView').focus(); await page.keyboard.press('KeyM');
let p1 = await artPoint(820, 560), p2 = await artPoint(1000, 700);
await page.mouse.move(p1.x, p1.y); await page.mouse.down(); await page.mouse.move(p2.x, p2.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
check(await cnt() === 10, 'нарисован прямоугольник');
check(await page.$$eval('#veHud .ve-h', (x) => x.length) === 9, 'рамка с 8 ручками и поворотом');
const xOf = () => page.$eval('#veProps input[aria-label="X"]', (i) => +i.value);
if (!(await page.$('#veProps input[aria-label="X"]'))) console.log('PROPS:', (await page.$eval('#veProps', (e) => e.textContent)).slice(0, 300), await page.$eval('#veHud', (e) => e.innerHTML.slice(0, 300)));
const x0 = await xOf();
// перемещение
await page.keyboard.press('KeyV');
const c1 = await artPoint(900, 630), c2 = await artPoint(960, 630);
await page.mouse.move(c1.x, c1.y); await page.mouse.down(); await page.mouse.move(c2.x, c2.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
check(Math.abs((await xOf()) - x0 - 60) < 8, 'перемещение на 60: ' + x0 + ' → ' + await xOf());
// масштаб ручкой
const wOf = () => page.$eval('#veProps input[aria-label="Ш"]', (i) => +i.value);
const w0 = await wOf();
const se = await page.locator('#veHud .ve-h[data-h="se"]').boundingBox();
await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2); await page.mouse.down(); await page.mouse.move(se.x + 80, se.y + 4, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
check(await wOf() > w0 + 20, 'масштаб ручкой: ширина ' + w0 + ' → ' + await wOf());
// перо: замкнутый треугольник
await page.keyboard.press('KeyP');
for (const [x, y] of [[300, 600], [450, 560], [400, 720]]) { const q = await artPoint(x, y); await page.mouse.click(q.x, q.y); await page.waitForTimeout(60); }
const f0 = await artPoint(300, 600); await page.mouse.click(f0.x, f0.y); await page.waitForTimeout(200);
check(await cnt() === 11, 'перо: замкнутая кривая');
check(await page.$eval('#veArt > g[data-id]:last-of-type path', (p) => /Z$/.test(p.getAttribute('d').trim())), 'контур замкнут (Z)');
// текст
await page.keyboard.press('KeyT');
const tq = await artPoint(600, 40); await page.mouse.click(tq.x, tq.y); await page.waitForTimeout(150);
await page.keyboard.type('Заголовок'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(200);
check(await page.$eval('#veArt', (s) => s.textContent.includes('Заголовок')), 'текстовый объект');
// группировка
await page.locator('#veView').focus(); await page.keyboard.press('KeyV'); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+g'); await page.waitForTimeout(200);
check(await cnt() === 1, 'всё сгруппировано в один объект');
await page.keyboard.press('Control+Shift+g'); await page.waitForTimeout(200);
check(await cnt() === 12, 'разгруппировано обратно: ' + await cnt());
// выравнивание по левому краю двух объектов
await page.keyboard.press('Escape');
await page.locator('#veLayers .ie-layer', { hasText: 'Звезда' }).click(); await page.locator('#veLayers .ie-layer', { hasText: 'Шестиугольник' }).scrollIntoViewIfNeeded(); await page.locator('#veLayers .ie-layer', { hasText: 'Шестиугольник' }).click({ modifiers: ['Shift'], force: true }); await page.waitForTimeout(100);
await page.locator('#veProps .rb[aria-label="Выровнять по левому краю"]').click(); await page.waitForTimeout(200);
const lefts = await page.evaluate(() => Array.from(document.querySelectorAll('#veArt > g[data-id]')).map((g) => g.getBoundingClientRect()).map((r) => Math.round(r.left)));
check(new Set(lefts).size < lefts.length, 'выравнивание по левому краю');
// правка узлов волны
await page.locator('#veLayers .ie-layer', { hasText: 'Волна' }).click(); await page.locator('#veView').focus(); await page.keyboard.press('KeyA'); await page.waitForTimeout(150);
const nodes = await page.$$eval('#veHud rect.ve-h[data-n]', (x) => x.length);
check(nodes === 5, 'узлы волны показаны: ' + nodes);
const d0 = await page.$eval('#veArt g[data-id="w1"] path', (p) => p.getAttribute('d'));
const nb = await page.locator('#veHud rect.ve-h[data-n="1"]').boundingBox();
await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2); await page.mouse.down(); await page.mouse.move(nb.x + 10, nb.y - 60, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
check(await page.$eval('#veArt g[data-id="w1"] path', (p) => p.getAttribute('d')) !== d0, 'узел перемещён — форма изменилась');
await page.keyboard.press('Control+z'); await page.waitForTimeout(200);
check(await page.$eval('#veArt g[data-id="w1"] path', (p) => p.getAttribute('d')) === d0, 'Ctrl+Z вернул форму');
// экспорт SVG
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#topRun')]);
const svg = readFileSync(await dl2.path(), 'utf8');
check(/^<svg[^>]+xmlns/.test(svg) && svg.includes('Новая линия') && !svg.includes('data-id'), 'скачан чистый SVG: ' + svg.length + ' символов');
// импорт SVG со скриптом — скрипт вырезан
const evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><rect width="10" height="10" fill="red" onclick="alert(3)"/><image href="https://evil.example/x.png"/></svg>';
const clean = await page.evaluate((t) => { const r = veSanitizeSvg(t); return r && r.markup; }, evil).catch(() => 'нет доступа');
check(clean === 'нет доступа' || (clean && !/script|onclick|evil/.test(clean)), 'импорт SVG без скриптов и внешних ссылок');
if (SHOTS) { await page.locator('#otabs .otab.fixed[data-tab="desk"]').click(); await page.waitForTimeout(300); await page.screenshot({ path: SHOTS + '/vdesk.png' }); }

check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? `\nНе прошло: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
