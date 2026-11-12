// Расширения: общие данные компании (разрешение «org.storage») и закреплённая панель.
// Владелец и редактор пишут общие данные, наблюдатель только читает; черновик в мастерской работает с учебной копией;
// закреплённая панель открывается сама после перезагрузки, откреплённая — нет.
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/extorgdata-e2e.mjs
import { chromium } from 'playwright';

const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const T = Date.now().toString(36);
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
async function cmd(p, q) {
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
  await p.fill('#cmdQ', q); await p.waitForTimeout(250);
  const it = p.locator('#cmdList .cmdk-i', { hasText: q });
  if (!(await it.count())) { await p.keyboard.press('Escape'); return 0; }
  await p.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await it.first().click(); await p.waitForTimeout(300);
  return 1;
}
async function waitToast(p, re, ms = 5000) { const end = Date.now() + ms; let t = ''; while (Date.now() < end) { t = (await p.textContent('#toast').catch(() => '')) || ''; if (re.test(t)) return t; await p.waitForTimeout(100); } return t; }
async function enable(p) {
  await cmd(p, 'Расширения компании'); await p.waitForTimeout(700);
  await p.click('.ext-card[data-ext="xspravka"] button:has-text("Включить…")');
  const t = await p.textContent('.ext-card[data-ext="xspravka"] .ext-confirm');
  await p.click('.ext-card[data-ext="xspravka"] button:has-text("Разрешить и включить")'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  return t;
}
const paneOpen = (p) => p.locator('.ext-pane.open').count();

const EXT = {
  id: 'xspravka', name: 'Справочник цехов', perms: ['org.storage', 'panel'], panel: 'Цеха',
  commands: [{ id: 'add', label: 'Добавить цех' }, { id: 'show', label: 'Показать цеха' }],
  code: `
const who = () => 'цех-' + Math.random().toString(36).slice(2, 6);
triosteum.command('add', async () => {
  const list = (await triosteum.org.get('цеха')) || [];
  list.push(who());
  await triosteum.org.set('цеха', list);
  await triosteum.ui.toast('цехов: ' + list.length);
});
triosteum.command('show', async () => { const all = await triosteum.org.all(); await triosteum.ui.toast('общие: ' + JSON.stringify(all)); });
async function draw() { const l = (await triosteum.org.get('цеха')) || []; document.body.innerHTML = '<h3 id="n">Цехов: ' + l.length + '</h3>'; }
draw();
`,
};

console.log('Общие данные компании');
const a = await page();
await register(a, 'Завод Справочник ' + T, 'Аня', `anya${T}@zavod.ru`);
const k = await join(a, 'editor', 'Коля');
const v = await join(a, 'viewer', 'Вера');
ok((await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: EXT })).status === 201, 'владелец опубликовал расширение с общими данными');
for (const p of [a, k, v]) { await p.reload(); await p.waitForTimeout(1000); }
const conf = await enable(a);
ok(/общие данные компании/.test(conf), 'в подтверждении — разрешение на общие данные компании');
await cmd(a, 'Справочник цехов: Добавить цех');
ok(/цехов: 1/.test(await waitToast(a, /цехов/)), 'владелец записал общие данные');
await enable(k);
await cmd(k, 'Справочник цехов: Добавить цех');
ok(/цехов: 2/.test(await waitToast(k, /цехов/)), 'редактор видит запись владельца и добавляет свою');
await cmd(a, 'Справочник цехов: Показать цеха');
ok(/общие: \{"цеха":\["цех-\w+","цех-\w+"\]\}/.test(await waitToast(a, /общие/)), 'владелец видит обе записи');
await enable(v);
await cmd(v, 'Справочник цехов: Показать цеха');
ok(/цех-/.test(await waitToast(v, /общие/)), 'наблюдатель читает общие данные');
await cmd(v, 'Справочник цехов: Добавить цех');
ok(/только для просмотра/.test(await waitToast(v, /Справочник цехов/)), 'наблюдателю менять нельзя — понятное объяснение');
const srv = await api(a, 'GET', '/org/ext-data/xspravka');
ok(srv.status === 200 && srv.data.data['цеха'].length === 2, 'на сервере — две записи');

console.log('Закреплённая панель');
await cmd(a, 'Расширения компании'); await a.waitForTimeout(700);
await a.click('.ext-card[data-ext="xspravka"] button:has-text("Закрепить панель")'); await a.waitForTimeout(1200);
ok(await paneOpen(a) === 1, 'закреплённая панель открылась');
await a.keyboard.press('Escape');
await a.reload(); await a.waitForTimeout(3000);
ok(await paneOpen(a) === 1, 'после перезагрузки панель открылась сама');
ok(/Цехов: 2/.test(await a.frameLocator('.ext-pane.open iframe').frameLocator('iframe').locator('#n').textContent()), 'панель показывает общие данные');
ok(/Открепить/.test(await a.textContent('.ext-pane.open .ext-pin')), 'в заголовке панели — «Открепить»');
await a.click('.ext-pane.open .ext-x'); await a.waitForTimeout(300);
ok(await paneOpen(a) === 0, 'крестик закрывает панель до следующего запуска');
await cmd(a, 'Расширения компании'); await a.waitForTimeout(700);
const pinBtn = a.locator('.ext-card[data-ext="xspravka"] button', { hasText: 'панель' });
if (/Открепить/.test(await pinBtn.textContent())) { await pinBtn.click(); await a.waitForTimeout(300); }
await a.keyboard.press('Escape');
await a.reload(); await a.waitForTimeout(3000);
ok(await paneOpen(a) === 0, 'откреплённая панель сама не открывается');

console.log('Черновик — учебная копия');
await cmd(a, 'Мастерская компании'); await a.waitForTimeout(700);
await a.click('.xw-add'); await a.waitForTimeout(150);
await a.fill('.xw-main input[aria-label="Название расширения"]', 'Проба общих данных');
await a.fill('.xw-code', "triosteum.command('w', () => triosteum.org.set('цеха', ['учебный']));\ntriosteum.command('r', () => triosteum.org.get('цеха'));");
await a.click('button:has-text("Подобрать разрешения и команды по коду")'); await a.waitForTimeout(100);
ok(await a.isChecked('.xw-perms input[data-perm="org.storage"]'), 'мастерская подобрала разрешение «общие данные компании»');
await a.locator('.xw-cmd').first().locator('button').click();
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await a.waitForTimeout(1500);
await a.click('.xw-run button[data-cmd="w"]'); await a.waitForTimeout(600);
await a.click('.xw-run button[data-cmd="r"]'); await a.waitForTimeout(800);
ok(/Готово: \["учебный"\]/.test(await a.textContent('.xw-log')), 'в пробном запуске — учебная копия');
const after = await api(a, 'GET', '/org/ext-data/xspravka');
ok(after.data.data['цеха'].length === 2 && !JSON.stringify(after.data).includes('учебный'), 'настоящие общие данные компании не тронуты');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
