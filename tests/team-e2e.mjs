// Сквозная проверка команды и истории версий на настоящем сервере.
// Запуск: TRIOSTEUM_URL=http://localhost:8000 node tests/team-e2e.mjs
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://localhost:8000';
const OWNER = 'owner' + Date.now() + '@zavod.ru', GUEST = 'guest' + Date.now() + '@zavod.ru';
const b = await chromium.launch(); const errs = []; let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const menu = async (p, item) => { await p.click('#projBtn'); await p.waitForTimeout(300); await p.click(`.ctx .ctx-i:has-text("${item}")`); await p.waitForTimeout(700); };

// владелец
const o = await page();
await o.goto(B + '/login#register');
await o.fill('#org', 'Завод Команда'); await o.fill('#name', 'Анна'); await o.fill('#email', OWNER); await o.fill('#pw', 'password123'); await o.check('#pd');
await o.click('#go'); await o.waitForURL(B + '/'); await o.waitForTimeout(800);
await o.click('#bAdd'); await o.click('[data-add="block"]'); await o.mouse.click(600, 400); await o.waitForTimeout(1500);
console.log('Команда');
await menu(o, 'Команда…');
ok(await o.isVisible('#teamW'), 'окно «Команда» открывается');
ok((await o.textContent('#teamBody')).includes('Анна (вы)'), 'владелец в списке');
await o.fill('#teamBody input[type=email]', GUEST); await o.selectOption('#teamBody form select', 'approver'); await o.click('#teamBody form button[type=submit]'); await o.waitForTimeout(800);
const link = await o.inputValue('.tm-link input');
ok(link.includes('/invite?t='), 'появилась ссылка-приглашение');
ok((await o.textContent('#teamBody')).includes(GUEST), 'приглашение в списке «Ждут ответа»');

const g = await page();
await g.goto(link); await g.waitForTimeout(800);
ok((await g.textContent('#title')).includes('Завод Команда'), 'гость видит, куда его пригласили');
ok(await g.inputValue('#email') === GUEST, 'почта подставлена');
await g.fill('#name', 'Борис'); await g.fill('#pw', 'password456'); await g.check('#pd'); await g.click('#go');
await g.waitForURL(B + '/'); await g.waitForTimeout(900);
ok(await g.$$eval('.node', (x) => x.length) === 1, 'гость видит пространство организации');
const role = await g.evaluate(() => window.TRIOSTEUM_BOOT.role);
ok(role === 'approver', 'роль гостя — согласующий');
await g.goto(link); await g.waitForTimeout(700);
ok((await g.textContent('#sub')).includes('недействительно') || (await g.url()).endsWith('/'), 'ссылка одноразовая');

await o.click('#teamClose'); await menu(o, 'Команда…'); await o.waitForTimeout(500);
ok((await o.textContent('#teamBody')).includes('Борис'), 'владелец видит нового участника');
await o.click('#teamClose'); await o.waitForTimeout(400);

console.log('История версий');
await menu(o, 'История версий…');
ok(await o.isVisible('#histW'), 'окно открывается');
await o.fill('#histBody input', 'Один блок'); await o.click('#histBody form button'); await o.waitForTimeout(900);
ok((await o.textContent('#histBody')).includes('Один блок'), 'версия с подписью сохранена');
await o.click('#histClose');
await o.click('#bAdd'); await o.click('[data-add="block"]'); await o.mouse.click(800, 500); await o.waitForTimeout(1500);
ok(await o.$$eval('.node', (x) => x.length) === 2, 'добавлен второй блок');
await menu(o, 'История версий…');
await o.click('#histBody .tm-row:has-text("Один блок") button'); await o.waitForTimeout(2200);
ok(await o.$$eval('.node', (x) => x.length) === 1, 'возврат к версии «Один блок»');
await o.reload(); await o.waitForTimeout(900);
ok(await o.$$eval('.node', (x) => x.length) === 1, 'после перезагрузки — возвращённая версия');
await menu(o, 'История версий…');
ok((await o.textContent('#histBody')).includes('Перед возвратом'), 'состояние до возврата сохранено отдельной версией');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
