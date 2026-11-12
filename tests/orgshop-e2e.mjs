// Мастерская компании: все доработки (расширения, плагины, среды) в одном месте, история версий и откат,
// выключение для всех одной кнопкой, журнал изменений, права (владелец, автор, наблюдатель).
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/orgshop-e2e.mjs
import { chromium } from 'playwright';

const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const T = Date.now().toString(36);
const SHOTS = process.env.SHOTS || '';
const b = await chromium.launch();
let fail = 0; const errs = [];
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const api = (p, method, path, body) => p.evaluate(async ([m, u, bd]) => { const r = await fetch('/api' + u, { method: m, headers: { 'Content-Type': 'application/json' }, body: bd ? JSON.stringify(bd) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; }, [method, path, body]);
async function register(p, org, name, email) {
  await p.goto(B + '/login'); await p.click('#tReg');
  await p.fill('#org', org); await p.fill('#name', name); await p.fill('#email', email); await p.fill('#pw', 'password123'); await p.check('#pd');
  await p.click('#go'); await p.waitForURL(B + '/'); await p.waitForTimeout(900);
}
async function join(owner, role, name) {
  const inv = await api(owner, 'POST', '/org/invites', { email: `${name.toLowerCase()}${T}@zavod.ru`, role });
  const p = await page();
  await p.goto(B + inv.data.path); await p.waitForTimeout(500);
  await p.fill('#pw', 'password123'); if (await p.locator('#name').isVisible()) await p.fill('#name', name); await p.check('#pd');
  await p.click('#go'); await p.waitForURL(B + '/'); await p.waitForTimeout(900);
  return p;
}
async function palette(p, q) {
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
  await p.fill('#cmdQ', q); await p.waitForTimeout(250);
  return p.locator('#cmdList .cmdk-i', { hasText: q });
}
async function has(p, q) { const n = await (await palette(p, q)).count(); await p.keyboard.press('Escape'); return n; }
async function cmd(p, q) {
  const it = await palette(p, q);
  if (!(await it.count())) { await p.keyboard.press('Escape'); return 0; }
  await p.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await it.first().click(); await p.waitForTimeout(300);
  return 1;
}
async function toastAfter(p, ms = 3000) { const end = Date.now() + ms; let t = ''; while (Date.now() < end) { t = (await p.textContent('#toast').catch(() => '')) || ''; if (t && !/выполняется/.test(t)) break; await p.waitForTimeout(100); } return t; }
const shop = (p) => cmd(p, 'Мастерская компании');
async function openItem(p, name) { await p.click(`.xw-item[data-item]:has-text("${name}")`); await p.waitForTimeout(600); }
const histText = (p) => p.textContent('.xw-hist');

const PLUGIN = { name: 'Расчёт брака', lang: 'python', desc: 'Доля брака по сменам', codes: { python: 'def run(x):\n    return x' } };
const EXT = { id: 'xsvodka', name: 'Сводка доски', perms: ['board.read'], commands: [{ id: 'sum', label: 'Посчитать блоки' }],
  code: "triosteum.command('sum', async () => { const b = await triosteum.board.get(); await triosteum.ui.toast('блоков: ' + b.nodes.length); });" };
const ENV = { id: 'ulabotk', name: 'Лаборатория ОТК', short: 'ОТК', color: '#0D9488', ic: 'lab', kinds: ['oee', 'defects', 'pareto'], desc: 'Контроль качества', step: true, theme: 'graphite' };

console.log('Доработки компании в одном месте');
const a = await page();
await register(a, 'Завод Мастерская ' + T, 'Аня', `anya${T}@zavod.ru`);
const k = await join(a, 'editor', 'Коля');
const v = await join(a, 'viewer', 'Вера');
const pl = await api(k, 'POST', '/org/items', { kind: 'plugin', src: 'my-brak', data: PLUGIN });
ok(pl.status === 201, 'редактор поделился плагином');
ok((await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: EXT })).status === 201, 'владелец опубликовал расширение');
ok((await api(a, 'POST', '/org/items', { kind: 'env', src: ENV.id, data: ENV })).status === 201, 'владелец создал свою среду');
await a.reload(); await a.waitForTimeout(1000);
ok(await shop(a) === 1, '«Мастерская компании» в Ctrl+K');
await a.waitForTimeout(600);
const side = await a.textContent('.xw-side');
ok(/Расширения компании.*Сводка доски/s.test(side) && /Плагины компании.*Расчёт брака/s.test(side) && /Среды компании.*Лаборатория ОТК/s.test(side), 'расширения, плагины и среды — в одном списке');
await openItem(a, 'Расчёт брака');
ok(/Плагин · опубликовал Коля/.test(await a.textContent('.xw-main')), 'у плагина видно, кто опубликовал');
ok(/опубликовано.*Коля.*сейчас/s.test(await histText(a)), 'история: первая версия — текущая');
await openItem(a, 'Лаборатория ОТК');
ok(await a.locator('.xw-main button:has-text("Настроить среду")').count() === 1 && await a.locator('.xw-main button:has-text("Выключить для всех")').count() === 0, 'среду можно настроить, но не выключить');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/orgshop-env.png` });

console.log('Откат плагина');
await api(k, 'POST', '/org/items', { kind: 'plugin', src: 'my-brak', data: { ...PLUGIN, name: 'Расчёт брака — неудачная правка', codes: { python: 'oops' } } });
await a.keyboard.press('Escape'); await shop(a); await a.waitForTimeout(600);
await openItem(a, 'неудачная правка');
const h1 = await histText(a);
ok(/обновлено.*сейчас/s.test(h1) && /опубликовано.*Вернуть эту версию/s.test(h1), 'новая версия текущая, прежнюю можно вернуть');
const backBtn = a.locator('.xw-hist li', { hasText: 'опубликовано' }).locator('button');
await backBtn.click(); ok(/Точно/.test(await backBtn.textContent()), 'откат просит подтверждения');
await backBtn.click(); await a.waitForTimeout(1000);
ok(/возвращена версия/.test(await toastAfter(a)), 'прежняя версия возвращена');
ok(await a.locator('.xw-item[data-item]:has-text("неудачная правка")').count() === 0 && await a.locator('.xw-item[data-item]:has-text("Расчёт брака")').count() === 1, 'название вернулось в списке');
ok(/^\s*\S.*возвращена прежняя версия.*сейчас/s.test(await histText(a)), 'в истории — возврат, он текущий');
const items = (await api(k, 'GET', '/org/items?kind=plugin')).data.items;
ok(items[0].data.codes.python.startsWith('def run'), 'у сотрудников — снова прежний код');

console.log('Выключить расширение для всех');
for (const p of [k]) {
  await cmd(p, 'Расширения компании'); await p.waitForTimeout(700);
  await p.click('.ext-card button:has-text("Включить…")'); await p.click('.ext-card button:has-text("Разрешить и включить")');
  await p.keyboard.press('Escape');
}
await cmd(k, 'Сводка доски: Посчитать блоки');
ok(/блоков: \d+/.test(await toastAfter(k)), 'сотрудник пользуется расширением');
await openItem(a, 'Сводка доски');
await a.click('.xw-main button:has-text("Выключить для всех")'); await a.waitForTimeout(900);
ok(/выключено для всех/.test(await a.textContent('.xw-item-h')) && await a.locator('.xw-item.off:has-text("Сводка доски")').count() === 1, 'расширение выключено для всех');
await k.reload(); await k.waitForTimeout(1200);
ok(await has(k, 'Сводка доски: Посчитать') === 0, 'у сотрудника команды пропали');
await cmd(k, 'Расширения компании'); await k.waitForTimeout(700);
ok(await k.locator('.ext-card[data-ext="xsvodka"]').count() === 0, 'и в списке расширений его нет');
await k.keyboard.press('Escape');
await a.click('.xw-main button:has-text("Включить для всех")'); await a.waitForTimeout(900);
ok(/работает у сотрудников/.test(await a.textContent('.xw-item-h')), 'расширение снова включено');
await k.reload(); await k.waitForTimeout(1200);
ok(await has(k, 'Сводка доски: Посчитать') === 1, 'у сотрудника вернулось — без нового подтверждения');

console.log('Откат расширения');
await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: { ...EXT, perms: ['board.read', 'board.write'], desc: 'с правкой доски' } });
await a.keyboard.press('Escape'); await shop(a); await a.waitForTimeout(600);
await openItem(a, 'Сводка доски');
const old = a.locator('.xw-hist li', { hasText: 'версия 1' }).locator('button');
await old.click(); await old.click(); await a.waitForTimeout(1000);
const xd = (await api(a, 'GET', '/org/items?kind=ext')).data.items[0].data;
ok(xd.ver === 3 && xd.perms.join() === 'board.read', 'расширение вернулось к версии 1 под новым номером 3');
ok(/возвращена прежняя версия · версия 3.*сейчас/s.test(await histText(a)), 'в истории — версия 3, текущая');
await k.reload(); await k.waitForTimeout(1200);
await cmd(k, 'Сводка доски: Посчитать блоки');
ok(/блоков: \d+/.test(await toastAfter(k)), 'у сотрудника работает прежняя версия без нового подтверждения');

console.log('Журнал и права');
await a.click('.xw-journal-b'); await a.waitForTimeout(800);
const j = await a.textContent('.xw-journal');
ok(/возвращена прежняя версия · расширение «Сводка доски»/.test(j) && /выключено для всех · расширение/.test(j) && /включено для всех/.test(j), 'журнал: откат, выключение, включение расширения');
ok(/обновлено · плагин «Расчёт брака — неудачная правка».*Коля/s.test(j) && /опубликовано · среда «Лаборатория ОТК»/.test(j), 'журнал: правка плагина (кто) и среда');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/orgshop-journal.png` });
await a.keyboard.press('Escape');
await shop(k); await k.waitForTimeout(700);
await openItem(k, 'Расчёт брака');
ok(await k.locator('.xw-main button:has-text("Выключить для всех")').count() === 1 && await k.locator('.xw-hist button:has-text("Вернуть")').count() >= 1, 'автор плагина может выключить и откатить свой плагин');
await openItem(k, 'Сводка доски');
ok(await k.locator('.xw-main button:has-text("Выключить для всех")').count() === 0 && await k.locator('.xw-hist button:has-text("Вернуть")').count() === 0
  && await k.locator('.xw-main button:has-text("Убрать")').count() === 0, 'расширение редактор не выключает, не откатывает и не убирает');
await shop(v); await v.waitForTimeout(700);
await openItem(v, 'Расчёт брака');
ok(await v.locator('.xw-main button:has-text("Выключить"), .xw-main button:has-text("Убрать"), .xw-hist button').count() === 0, 'наблюдатель только смотрит историю');
ok(/опубликовано/.test(await histText(v)), 'но историю видит');

console.log('Убрать из компании');
await openItem(k, 'Расчёт брака');
const rm = k.locator('.xw-main .ext-acts button.danger');
await rm.click(); await rm.click(); await k.waitForTimeout(900);
ok(/убрано из компании/.test(await k.textContent('.xw-main')) && await k.locator('.xw-item[data-item]:has-text("Расчёт брака")').count() === 0, 'автор убрал свой плагин');
await k.click('.xw-journal-b'); await k.waitForTimeout(800);
ok(await k.locator('.xw-journal li[data-action="remove"] s').count() === 1, 'в журнале — удаление, название зачёркнуто');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
