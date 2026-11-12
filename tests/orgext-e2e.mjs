// Расширения компании в браузере: владелец публикует, сотрудник включает с подтверждением разрешений,
// команды работают в песочнице (без сети, страницы приложения, хранилища и куки), уход со страницы останавливает расширение,
// новые разрешения в новой версии снова спрашиваются.
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/orgext-e2e.mjs
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
  await it.first().click(); await p.waitForTimeout(200);
  return 1;
}
async function toastAfter(p, ms = 2500) {
  const end = Date.now() + ms; let t = '';
  while (Date.now() < end) { t = (await p.textContent('#toast').catch(() => '')) || ''; if (t && !/выполняется/.test(t)) break; await p.waitForTimeout(100); }
  return t;
}

const CODE = `
triosteum.command('count', async () => {
  const b = await triosteum.board.get();
  const n = await triosteum.board.add({ name: 'Из расширения', code: 'print(1)' });
  const n2 = await triosteum.board.add({ name: 'Второй', x: n.x + 300, y: n.y });
  await triosteum.board.connect(n.id, n2.id);
  await triosteum.board.note({ text: 'Заметка расширения', attach: n.id });
  await triosteum.ui.toast('было ' + b.nodes.length + ', стало ' + (b.nodes.length + 2));
});
triosteum.command('probe', async () => {
  const r = [];
  try { await fetch('/api/spaces'); r.push('fetch:ok'); } catch (e) { r.push('fetch:no'); }
  try { await fetch('https://example.com/'); r.push('net:ok'); } catch (e) { r.push('net:no'); }
  try { parent.document.title; r.push('dom:ok'); } catch (e) { r.push('dom:no'); }
  try { localStorage.length; r.push('ls:ok'); } catch (e) { r.push('ls:no'); }
  try { document.cookie; r.push('cookie:ok'); } catch (e) { r.push('cookie:no'); }
  try { await triosteum.storage.get('a'); r.push('storage:ok'); } catch (e) { r.push('storage:no'); }
  await triosteum.ui.toast(r.join(' '));
});
triosteum.command('panel', async () => { document.body.innerHTML = '<h3 id="hi">Привет из панели</h3>'; await triosteum.ui.openPanel(); });
triosteum.command('boom', () => { throw new Error('сломалось нарочно'); });
triosteum.command('nav', () => { location.href = 'about:blank'; });
`;
const EXT = {
  id: 'xproverka', name: 'Проверка схемы', desc: 'Тестовое расширение', perms: ['board.read', 'board.write', 'panel'], panel: 'Проверка',
  commands: [{ id: 'count', label: 'Посчитать и добавить' }, { id: 'probe', label: 'Проверить песочницу' }, { id: 'panel', label: 'Показать панель' },
    { id: 'boom', label: 'Упасть' }, { id: 'nav', label: 'Уйти со страницы' }],
  code: CODE,
};

console.log('Владелец публикует расширение, редактор — не может');
const a = await page();
await register(a, 'Завод Расширения ' + T, 'Аня', `anya${T}@zavod.ru`);
const inv = await api(a, 'POST', '/org/invites', { email: `kolya${T}@zavod.ru`, role: 'editor' });
const pub = await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: EXT });
ok(pub.status === 201 && pub.data.data.ver === 1, 'владелец опубликовал расширение');
const k = await page();
await k.goto(B + inv.data.path); await k.waitForTimeout(500);
await k.fill('#pw', 'password123'); if (await k.locator('#name').isVisible()) await k.fill('#name', 'Коля'); await k.check('#pd');
await k.click('#go'); await k.waitForURL(B + '/'); await k.waitForTimeout(900);
ok((await api(k, 'POST', '/org/items', { kind: 'ext', src: 'xchuzhoe', data: { ...EXT, id: 'xchuzhoe' } })).status === 403, 'редактор опубликовать расширение не может');

console.log('Сотрудник включает расширение');
ok(await has(k, 'Проверка схемы: Посчитать') === 0, 'до включения команд расширения нет');
await cmd(k, 'Расширения компании'); await k.waitForTimeout(600);
const cardK = k.locator('.ext-card[data-ext="xproverka"]');
ok(await cardK.count() === 1, 'расширение видно в окне «Расширения компании»');
ok(/выключено/.test(await cardK.locator('.ext-state').textContent()), 'по умолчанию выключено');
ok(await cardK.locator('button:has-text("Убрать из компании")').count() === 0, 'редактор не может убрать расширение');
await cardK.locator('button:has-text("Включить…")').click(); await k.waitForTimeout(200);
const conf = await cardK.locator('.ext-confirm').textContent();
ok(/читать блоки/.test(conf) && /добавлять и менять/.test(conf) && /боковую панель/.test(conf) && /интернет/.test(conf), 'перед включением показаны разрешения и что недоступно');
if (SHOTS) await k.screenshot({ path: `${SHOTS}/ext-confirm.png` });
await cardK.locator('button:has-text("Разрешить и включить")').click(); await k.waitForTimeout(300);
ok(/включено/.test(await cardK.locator('.ext-state').textContent()), 'расширение включено');
await k.keyboard.press('Escape');

console.log('Команды в песочнице');
const before = await k.locator('#nodes .node').count();
await cmd(k, 'Проверка схемы: Посчитать');
const t1 = await toastAfter(k);
ok(/было \d+, стало \d+/.test(t1), 'команда прочитала доску и ответила: ' + t1);
await k.waitForTimeout(500);
ok(await k.locator('#nodes .node').count() === before + 2, 'расширение добавило два блока');
ok(await k.locator('#nodes .node:has-text("Из расширения")').count() === 1, 'с нужным названием');
await k.keyboard.press('Control+z'); await k.waitForTimeout(500);
ok(await k.locator('#nodes .node').count() === before, 'Ctrl+Z отменяет всё, что сделала команда');
await cmd(k, 'Проверка схемы: Проверить песочницу');
const t2 = await toastAfter(k);
ok(/fetch:no/.test(t2) && /net:no/.test(t2), 'запросы к серверу и в интернет закрыты: ' + t2);
ok(/dom:no/.test(t2) && /ls:no/.test(t2) && /cookie:no/.test(t2), 'страница приложения, его хранилище и куки недоступны');
ok(/storage:no/.test(t2), 'без разрешения «storage» хранилище расширения не работает');
await cmd(k, 'Проверка схемы: Упасть');
ok(/сломалось нарочно/.test(await toastAfter(k)), 'ошибка команды показана пользователю');
await cmd(k, 'Панель «Проверка»'); await k.waitForTimeout(800);
const pane = k.locator('.ext-pane.open');
ok(await pane.count() === 1, 'панель расширения открылась');
await cmd(k, 'Проверка схемы: Показать панель'); await k.waitForTimeout(500);
ok(await k.frameLocator('.ext-pane.open iframe').locator('#hi').textContent() === 'Привет из панели', 'расширение рисует в своей панели');
ok(await k.locator('.ext-frame').first().getAttribute('sandbox') === 'allow-scripts', 'панель — iframe-песочница без allow-same-origin');
if (SHOTS) await k.screenshot({ path: `${SHOTS}/ext-panel.png` });
await cmd(k, 'Проверка схемы: Уйти');
ok(/перейти на другую страницу/.test(await toastAfter(k, 4000)), 'уход со страницы замечен');
await k.waitForTimeout(300);
ok(await k.locator('.ext-pane').count() === 0, 'расширение остановлено');
await cmd(k, 'Проверка схемы: Посчитать');
ok(/было \d+/.test(await toastAfter(k, 4000)), 'при следующем вызове расширение запускается заново');

console.log('Новая версия с новыми разрешениями');
const v2 = await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: { ...EXT, perms: [...EXT.perms, 'storage'] } });
ok(v2.status === 201 && v2.data.data.ver === 2, 'владелец выпустил версию 2 с хранилищем');
await cmd(k, 'Расширения компании'); await k.waitForTimeout(800);
ok(/просит новые разрешения/.test(await cardK.locator('.ext-state').textContent()), 'расширение просит подтвердить новые разрешения');
await k.keyboard.press('Escape');
ok(await has(k, 'Проверка схемы: Проверить') === 0, 'пока не подтверждено — команд нет');
await cmd(k, 'Расширения компании'); await k.waitForTimeout(600);
await cardK.locator('button:has-text("Посмотреть разрешения")').click();
ok(/хранить свои настройки/.test(await cardK.locator('.ext-confirm').textContent()), 'в подтверждении — новое разрешение');
await cardK.locator('button:has-text("Разрешить и включить")').click(); await k.waitForTimeout(200);
await k.keyboard.press('Escape');
await cmd(k, 'Проверка схемы: Проверить песочницу');
ok(/storage:ok/.test(await toastAfter(k)), 'после подтверждения хранилище работает');

console.log('Владелец убирает расширение');
await cmd(a, 'Расширения компании'); await a.waitForTimeout(600);
const cardA = a.locator('.ext-card[data-ext="xproverka"]');
await cardA.locator('button:has-text("Убрать из компании")').click();
await cardA.locator('button:has-text("Точно")').click(); await a.waitForTimeout(800);
ok(await a.locator('.ext-card').count() === 0 && /пока нет/.test(await a.textContent('.ext-list')), 'расширение убрано из компании');
const other = await page();
await register(other, 'Чужой завод ' + T, 'Петя', `petya${T}@zavod.ru`);
await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: EXT });
ok((await api(other, 'GET', '/org/items?kind=ext')).data.items.length === 0, 'чужая организация расширений компании не видит');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
