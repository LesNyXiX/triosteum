// Расписание запуска: включение, метка у кнопки, запуск «по расписанию» по наступлении срока, одна вкладка из двух,
// пропущенный запуск догоняется один раз, ошибка — сообщение. Запуск: npm run build && node tests/schedule-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, code) => ({ id, name, lang: 'cpp', x, y: 220, codes: { cpp: code }, pluginId: null, family: null, desc: '', colors: null });
const browser = await chromium.launch();
async function ctxWith(schedule, code) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((g) => {
    if (window.top !== window || localStorage.getItem('__seeded')) return; localStorage.setItem('__seeded', '1');
    localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Расписание', t: Date.now() }] }));
    localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
  }, { nodes: [node('a', 'Блок', 200, code || 'int run(){ return 1; }')], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3, schedule });
  return ctx;
}
const hist = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.runs.p1') || '[]'));

console.log('Окно и включение');
{
  const ctx = await ctxWith(null); const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL); await page.waitForTimeout(1000);
  check(await page.locator('.sch-chip').isHidden(), 'без расписания метки у кнопки нет');
  await page.keyboard.press('Control+k'); await page.keyboard.type('Расписание запуска'); await page.waitForTimeout(600); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  check(await page.isVisible('#schW'), 'окно открывается из палитры');
  await page.locator('#schW .tgl', { hasText: 'Запускать схему по расписанию' }).locator('input').check(); await page.waitForTimeout(200);
  await page.locator('#schW button', { hasText: 'По будням' }).click(); await page.fill('#schAt', '07:30'); await page.locator('#schAt').dispatchEvent('change'); await page.waitForTimeout(700);
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).schedule);
  check(g.on && g.kind === 'weekdays' && g.at === '07:30', 'расписание сохранено в пространстве: по будням в 07:30');
  check(await page.locator('.sch-chip').isVisible() && /07:30/.test(await page.textContent('.sch-chip')), 'у кнопки запуска — время следующего запуска');
  check((await hist(page)).length === 0, 'включение не запускает схему сразу');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Срок наступил: запуск один раз и в одной вкладке из двух');
{
  const ctx = await ctxWith({ on: true, kind: 'every', every: 60, notify: true, last: Date.now() - 3 * 3600e3 });
  const p1 = await ctx.newPage(); const p2 = await ctx.newPage();
  await p1.goto(URL); await p2.goto(URL);
  await p1.waitForTimeout(6000);
  const h = await hist(p1);
  check(h.length === 1 && h[0].trig === 'schedule', 'пропущенные за 3 часа запуски — один запуск, отмечен «по расписанию» (запусков: ' + h.length + ')');
  await p1.waitForTimeout(16000);
  check((await hist(p1)).length === 1, 'следующий — только через час, не каждую проверку');
  await p1.locator('#runp .runp-tabs button[data-rt="hist"]').click().catch(() => {}); await p1.waitForTimeout(200);
  await ctx.close();
}
console.log('Ошибка при запуске по расписанию');
{
  const ctx = await ctxWith({ on: true, kind: 'daily', at: '00:00', notify: true, last: Date.now() - 2 * 86400e3 }, 'int run(){ return undefinedThing; }');
  const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(5000);
  const t = await page.evaluate(() => [...document.querySelectorAll('.toast, #toast, [role="status"]')].map((x) => x.textContent).join(' | '));
  check(/ошибок при запуске по расписанию — 1/.test(t), 'сообщение об ошибке запуска по расписанию');
  await ctx.close();
}
console.log('Пропущенные дни: догоняющий запуск, а не ожидание следующего срока');
async function missed(now, schedule) {
  const ctx = await ctxWith(schedule); const page = await ctx.newPage();
  await page.clock.setFixedTime(now);
  await page.goto(URL); await page.waitForTimeout(4500);
  const n = (await hist(page)).length; await ctx.close(); return n;
}
{
  const at = (d) => new Date(d).getTime();
  // среда 08:00, последний запуск — понедельник 09:00: вторник пропущен
  check(await missed(at('2026-11-11T08:00:00'), { on: true, kind: 'daily', at: '09:00', notify: false, last: at('2026-11-09T09:00:05') }) === 1, 'ежедневно: вторник пропущен — при открытии в среду до 09:00 один запуск сразу');
  check(await missed(at('2026-11-11T08:00:00'), { on: true, kind: 'daily', at: '09:00', notify: false, last: at('2026-11-10T09:00:05') }) === 0, 'ежедневно: вчерашний запуск был — ждём сегодняшних 09:00');
  // суббота 10:00, последний запуск — четверг: пятница пропущена
  check(await missed(at('2026-11-14T10:00:00'), { on: true, kind: 'weekdays', at: '09:00', notify: false, last: at('2026-11-12T09:00:05') }) === 1, 'по будням: пятница пропущена — в субботу один запуск сразу');
  check(await missed(at('2026-11-14T10:00:00'), { on: true, kind: 'weekdays', at: '09:00', notify: false, last: at('2026-11-13T09:00:05') }) === 0, 'по будням: в выходные без пропусков запуска нет');
}
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
