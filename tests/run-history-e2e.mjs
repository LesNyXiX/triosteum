// История запусков: каждый запуск сохраняется по пространству, статистика по блокам, CSV, очистка.
// Запуск: npm run build && node tests/run-history-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, code) => ({ id, name, lang: 'cpp', x, y: 220, codes: { cpp: code }, pluginId: null, family: null, desc: '', colors: null });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript((g) => {
  if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'История', t: Date.now() }, { id: 'p2', name: 'Другое', t: 1 }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.proj.p2', JSON.stringify({ nodes: [], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 1 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
}, { nodes: [node('a', 'Источник', 160, 'int run(){ return 42; }'), node('b', 'Расчёт', 520, 'int run(){ return undefinedThing; }')], edges: [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);
const run = async () => { await page.keyboard.press('Escape'); await page.keyboard.press('Control+r'); await page.waitForFunction(() => !document.querySelector('#runp.busy') && /успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300); };

console.log('Запись запусков');
await run(); await run();
check(await page.textContent('#rtHist') === '2', 'на вкладке «История» — 2 запуска');
await page.click('#runp .runp-tabs button[data-rt="hist"]'); await page.waitForTimeout(200);
check(await page.isVisible('#runHist') && !(await page.isVisible('#runOut')), 'вкладка «История» открывается вместо журнала');
check(await page.locator('#runHist .rh-run').count() === 2 && await page.locator('#runHist .rh-run.err').count() === 2, 'оба запуска в списке, отмечены как с ошибками');
const kpi = await page.locator('#runHist .rh-kpi b').allTextContents();
check(kpi[0] === '2' && kpi[1] === '0%' && kpi[3] === '2', 'сводка: 2 запуска, 0% без ошибок, 2 ошибки: ' + kpi.join(' | '));
const first = await page.locator('#runHist .rh-tbl tbody tr').first().textContent();
check(/Расчёт/.test(first) && /2 \(100%\)/.test(first), 'статистика: первым — блок, который падает (2 из 2)');
await page.locator('#runHist .rh-run-h').first().click(); await page.waitForTimeout(200);
check(await page.locator('#runHist .rh-blocks li').count() === 2 && /undefinedThing|ошибка|Ошибка/.test(await page.locator('#runHist .rh-blocks li.s-err').textContent()), 'подробности запуска: статусы блоков и текст ошибки');
await page.locator('#runHist button', { hasText: 'Журнал запуска' }).click();
check(/Источник/.test(await page.locator('#runHist .rh-log').textContent()), 'журнал запуска сохранён');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#runHist button', { hasText: 'Выгрузить CSV' }).click()]);
const csv = (await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8'));
check(csv.charCodeAt(0) === 0xfeff && csv.split('\r\n').length === 5 && /Расчёт;cpp|Расчёт;C\+\+/.test(csv), 'CSV для Excel: BOM, заголовок + 4 строки');
console.log('Хранение');
await page.reload(); await page.waitForTimeout(1000);
check(await page.textContent('#rtHist') === '2', 'после перезагрузки история на месте');
const goSpace = async (name) => { await page.keyboard.press('Escape'); await page.keyboard.press('Control+k'); await page.keyboard.type(name); await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.waitForTimeout(800); };
await goSpace('Другое');
check(await page.textContent('#rtHist') === '0', 'у другого пространства — своя история');
await goSpace('История');
check(await page.textContent('#rtHist') === '2', 'вернулись — снова своя история (2)');
await run(); await page.click('#runp .runp-tabs button[data-rt="hist"]'); await page.waitForTimeout(200);
await page.locator('#runHist button', { hasText: 'Очистить' }).click(); await page.waitForTimeout(200); await page.click('#askYes'); await page.waitForTimeout(300);
check(await page.textContent('#rtHist') === '0' && /Запусков ещё не было/.test(await page.textContent('#runHist')), 'очистка истории с подтверждением');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
