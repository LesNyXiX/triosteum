// Мастерская расширений: черновик, проверки описания, подбор разрешений и команд по коду, пробный запуск в песочнице
// с журналом, панель, публикация владельцем, копия у редактора, черновики переживают перезагрузку.
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/workshop-e2e.mjs
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
async function cmd(p, q) {
  await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
  await p.fill('#cmdQ', q); await p.waitForTimeout(250);
  const it = p.locator('#cmdList .cmdk-i', { hasText: q });
  if (!(await it.count())) { await p.keyboard.press('Escape'); return 0; }
  await it.first().click(); await p.waitForTimeout(300);
  return 1;
}
const log = (p) => p.textContent('.xw-log').catch(() => '');
async function waitLog(p, re, ms = 5000) { const end = Date.now() + ms; let t = ''; while (Date.now() < end) { t = await log(p); if (re.test(t)) return t; await p.waitForTimeout(100); } return t; }
const probs = (p) => p.textContent('.xw-probs').catch(() => '');

console.log('Новое расширение в мастерской');
const a = await page();
await register(a, 'Завод Мастерская ' + T, 'Аня', `anya${T}@zavod.ru`);
ok(await cmd(a, 'Мастерская расширений') === 1, 'мастерская есть в Ctrl+K');
ok(await a.locator('#xw').count() === 1 && /Создайте первое/.test(await a.textContent('.xw-main')), 'мастерская открылась, черновиков нет');
await a.click('.xw-add'); await a.waitForTimeout(200);
ok(/count/.test(await a.inputValue('.xw-code')) && await a.locator('.xw-cmd').count() === 1, 'черновик с готовым примером и командой');
ok(/Назовите расширение/.test(await probs(a)), 'без названия — подсказка');
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await a.waitForTimeout(200);
ok(/Назовите/.test(await a.textContent('.xw .cenv-err')), 'без названия пробный запуск не начинается');
await a.fill('.xw-main input[aria-label="Название расширения"]', 'Счётчик');
ok(await a.locator('.xw-item.on:has-text("Счётчик")').count() === 1, 'название сразу видно в списке черновиков');
ok(!/Назовите/.test(await probs(a)), 'подсказка ушла');

console.log('Пробный запуск');
await a.click('.xw .ext-acts button:has-text("Пробный запуск")');
ok(/Запущено/.test(await waitLog(a, /Запущено/)), 'расширение запущено в песочнице');
await a.click('.xw-run button[data-cmd="count"]');
ok(/Готово/.test(await waitLog(a, /Готово/)), 'команда выполнена — в журнале «Готово»');
ok(/Блоков на доске: 0/.test(await a.textContent('#toast')), 'уведомление расширения видно поверх мастерской');

console.log('Подбор разрешений и команд по коду');
await a.fill('.xw-code', `triosteum.command('add', async () => {
  const n = await triosteum.board.add({ name: 'Из мастерской' });
  console.log('добавлен', n.name);
  return { id: n.id };
});
triosteum.command('bad', () => { undefinedFn(); });`);
await a.waitForTimeout(200);
const w = await probs(a);
ok(/менять блоки/.test(w), 'предупреждение: коду нужно разрешение менять доску');
ok(/«add».*в списке команд её нет/.test(w) && /«count» есть в списке, но код её не регистрирует/.test(w), 'предупреждения о расхождении команд и кода');
await a.click('button:has-text("Подобрать разрешения и команды по коду")'); await a.waitForTimeout(200);
ok(await a.isChecked('.xw-perms input[data-perm="board.write"]'), 'разрешение «менять доску» подобрано');
ok(await a.locator('.xw-cid').evaluateAll((els) => els.map((e) => e.value).join(',')) === 'count,add,bad', 'команды из кода добавлены');
await a.locator('.xw-cmd').first().locator('button').click(); await a.waitForTimeout(150);
await a.locator('.xw-cmd input[aria-label="Название команды 1"]').fill('Добавить блок');
await a.locator('.xw-cmd input[aria-label="Название команды 2"]').fill('Ошибка');
ok(!/есть в списке, но код/.test(await probs(a)), 'лишняя команда убрана');
await a.click('.xw .ext-acts button:has-text("Пробный запуск")');
await waitLog(a, /Запущено/);
await a.click('.xw-run button[data-cmd="add"]');
const l1 = await waitLog(a, /Готово/);
ok(/добавлен Из мастерской/.test(l1) && /Готово: \{"id"/.test(l1), 'console.log и результат команды — в журнале');
await a.click('.xw-run button[data-cmd="bad"]');
ok(/✗.*undefinedFn/.test(await waitLog(a, /undefinedFn/)), 'ошибка команды — в журнале');
await a.fill('.xw-code', 'triosteum.command(\'add\', () => 1);\nэто не код');
await a.click('.xw .ext-acts button:has-text("Пробный запуск")');
ok(/✗/.test(await waitLog(a, /✗/)), 'синтаксическая ошибка показана в журнале');

console.log('Панель');
await a.check('.xw-perms input[data-perm="panel"]');
ok(await a.locator('.xw-main input[aria-label="Название панели"]').isVisible(), 'для панели появилось поле названия');
await a.fill('.xw-main input[aria-label="Название панели"]', 'Сводка');
await a.fill('.xw-code', `triosteum.command('add', async () => { const n = await triosteum.board.add({ name: 'Из мастерской' }); return n.id; });
triosteum.command('bad', () => 0);
document.body.innerHTML = '<p id="sv">Сводка завода</p>';`);
await a.click('.xw .ext-acts button:has-text("Пробный запуск")');
await waitLog(a, /Запущено/);
await a.click('.xw-run button:has-text("Панель «Сводка»")'); await a.waitForTimeout(400);
ok(await a.frameLocator('.ext-pane.open iframe').frameLocator('iframe').locator('#sv').textContent() === 'Сводка завода', 'панель черновика открылась и рисует');
ok(await a.locator('.ext-pane.open').evaluate((e) => { const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return e.contains(top); }), 'панель поверх мастерской');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/workshop.png` });

console.log('Публикация');
await a.click('.xw .ext-acts button:has-text("Опубликовать в компании")');
ok(/опубликовано, версия 1/.test(await waitLog(a, /версия 1/, 4000) + await a.textContent('#toast')), 'опубликовано, версия 1');
ok(await a.locator('.xw-item.on small:has-text("опубликовано")').count() === 1, 'черновик помечен как опубликованный');
await a.click('.xw .ext-acts button:has-text("Опубликовать новую версию")');
ok(/версия 2/.test(await waitLog(a, /версия 2/, 4000)), 'повторная публикация — версия 2');
const items = (await api(a, 'GET', '/org/items?kind=ext')).data.items;
ok(items.length === 1 && items[0].data.panel === 'Сводка' && items[0].data.perms.join() === 'board.read,board.write,panel', 'на сервере — нужные разрешения и панель');
await a.keyboard.press('Escape'); await a.waitForTimeout(200);
ok(await a.locator('#xw').count() === 0 && await a.locator('.ext-pane').count() === 0, 'мастерская закрыта, пробный запуск остановлен');

console.log('Сотрудник включает, черновики на месте после перезагрузки');
await cmd(a, 'Расширения компании'); await a.waitForTimeout(600);
await a.click('.ext-card button:has-text("Включить…")'); await a.click('.ext-card button:has-text("Разрешить и включить")');
await a.keyboard.press('Escape');
const before = await a.locator('#nodes .node').count();
await cmd(a, 'Счётчик: Добавить блок'); await a.waitForTimeout(1200);
ok(await a.locator('#nodes .node').count() === before + 1, 'опубликованная команда работает из Ctrl+K');
// ИИ подменяем: страница думает, что модель подключена, а ответ приходит готовый
await a.route(B + '/', async (route) => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()).replace('"ai": {"enabled": false', '"ai": {"enabled": true') }); });
const FENCE = '`'.repeat(3);
let aiPrompt = '';
await a.route('**/api/ai/complete', (route) => { aiPrompt = route.request().postDataJSON().prompt; route.fulfill({ status: 200, contentType: 'text/plain', body: 'Расширение отмечает выделенные блоки.\n' + FENCE + "js\ntriosteum.command('mark', async () => {\n  const s = await triosteum.board.selection();\n  for (const id of s.ids) await triosteum.board.note({ text: 'проверено', attach: id });\n});\n" + FENCE + '\n' }); });
// хранилище пробного запуска сохраняется на сервере
await cmd(a, 'Мастерская расширений');
await a.click('.xw-add'); await a.waitForTimeout(150);
await a.fill('.xw-main input[aria-label="Название расширения"]', 'Хранилище');
await a.fill('.xw-code', "triosteum.command('put', () => triosteum.storage.set('k', 42));\ntriosteum.command('get', () => triosteum.storage.get('k'));");
await a.click('button:has-text("Подобрать разрешения и команды по коду")'); await a.waitForTimeout(100);
await a.locator('.xw-cmd').first().locator('button').click();
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await waitLog(a, /Запущено/);
await a.click('.xw-run button[data-cmd="put"]'); await waitLog(a, /Готово/);
await a.keyboard.press('Escape'); await a.waitForTimeout(3000);
await a.reload(); await a.waitForTimeout(1200);
await cmd(a, 'Мастерская расширений');
await a.click('.xw-item[data-draft]:has-text("Хранилище")'); await a.waitForTimeout(150);
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await waitLog(a, /Запущено/);
await a.click('.xw-run button[data-cmd="get"]');
ok(/Готово: 42/.test(await waitLog(a, /Готово/)), 'хранилище пробного запуска пережило перезагрузку');
await a.click('.xw .ext-acts button:has-text("Удалить черновик")'); await a.click('.xw .ext-acts button:has-text("Точно")');
await a.keyboard.press('Escape');

// много больших черновиков: каждый — своей записью, все переживают перезагрузку
await cmd(a, 'Мастерская расширений');
const big = '// ' + 'x'.repeat(220 * 1024) + '\ntriosteum.command("count", () => 1);';
for (let i = 1; i <= 5; i++) {
  await a.click('.xw-add'); await a.waitForTimeout(150);
  await a.fill('.xw-main input[aria-label="Название расширения"]', 'Большой ' + i);
  await a.fill('.xw-code', big);
}
ok(!/не сохраняется/.test(await a.textContent('.xw-probs')), 'черновик 220 КБ сохраняется');
await a.fill('.xw-code', big + big + big + big + big);
ok(/не сохраняется/.test(await a.textContent('.xw-probs')) && /больше 256 КБ/.test(await a.textContent('.xw-probs')), 'слишком большой черновик — понятное предупреждение');
await a.fill('.xw-code', big);
await a.keyboard.press('Escape'); await a.waitForTimeout(3500);
await a.reload(); await a.waitForTimeout(1200);
await cmd(a, 'Мастерская расширений');
ok(await a.locator('.xw-item[data-draft]:has-text("Большой")').count() === 5, 'все пять больших черновиков на месте после перезагрузки');
for (let i = 1; i <= 5; i++) {
  await a.click(`.xw-item[data-draft]:has-text("Большой ${i}")`); await a.waitForTimeout(100);
  await a.click('.xw .ext-acts button:has-text("Удалить черновик")'); await a.click('.xw .ext-acts button:has-text("Точно")'); await a.waitForTimeout(100);
}
await a.keyboard.press('Escape'); await a.waitForTimeout(2500);
await a.reload(); await a.waitForTimeout(1200);
await cmd(a, 'Мастерская расширений');
ok(await a.locator('.xw-item[data-draft]:has-text("Большой")').count() === 0, 'удалённые черновики не возвращаются');
ok(await a.inputValue('.xw-main input[aria-label="Название расширения"]') === 'Счётчик', 'черновик сохранился после перезагрузки');
await a.click('.xw-add'); await a.waitForTimeout(200);
await a.fill('.xw-ai input', 'Отметить выделенные блоки заметкой «проверено»');
await a.click('.xw-ai button:has-text("Написать код")');
const st = await (async () => { for (let i = 0; i < 40; i++) { const t = await a.textContent('.xw-ai-st'); if (/Готово|не прислал|Не получилось/.test(t)) return t; await a.waitForTimeout(100); } return ''; })();
ok(/Готово/.test(st), 'ИИ написал код по описанию');
ok(/triosteum\.board\.selection/.test(aiPrompt) && /Задача: Отметить/.test(aiPrompt), 'ИИ получил справку по API и задачу');
ok(/command\('mark'/.test(await a.inputValue('.xw-code')), 'код из ответа ИИ в редакторе');
ok(await a.locator('.xw-cid').evaluateAll((els) => els.map((e) => e.value).join(',')) === 'mark', 'команды подобраны по коду ИИ');
ok(await a.isChecked('.xw-perms input[data-perm="selection"]') && await a.isChecked('.xw-perms input[data-perm="board.write"]'), 'разрешения подобраны по коду ИИ');
ok(/Отметить выделенные/.test(await a.inputValue('.xw-main input[aria-label="Название расширения"]')), 'название подставлено из задачи');
await a.click('.xw .ext-acts button:has-text("Удалить черновик")'); await a.click('.xw .ext-acts button:has-text("Точно")');
await a.keyboard.press('Escape');

console.log('Редактор: без публикации, копия');
const inv = await api(a, 'POST', '/org/invites', { email: `kolya${T}@zavod.ru`, role: 'editor' });
const k = await page();
await k.goto(B + inv.data.path); await k.waitForTimeout(500);
await k.fill('#pw', 'password123'); if (await k.locator('#name').isVisible()) await k.fill('#name', 'Коля'); await k.check('#pd');
await k.click('#go'); await k.waitForURL(B + '/'); await k.waitForTimeout(900);
await cmd(k, 'Мастерская расширений');
ok(/может владелец/.test(await k.textContent('.xw .cenv-h')), 'редактору сказано, кто публикует');
ok(await k.locator('.xw-item[data-pub]:has-text("Счётчик")').count() === 1, 'расширение компании в списке мастерской');
await k.click('.xw-item[data-pub]'); await k.waitForTimeout(200);
ok(/копия/.test(await k.inputValue('.xw-main input[aria-label="Название расширения"]')), 'открывается копией-черновиком');
ok(await k.locator('.xw .ext-acts button:has-text("Опубликовать")').isDisabled(), 'кнопка публикации у редактора выключена');
await k.click('.xw .ext-acts button:has-text("Удалить черновик")'); await k.click('.xw .ext-acts button:has-text("Точно")'); await k.waitForTimeout(200);
ok(await k.locator('.xw-item[data-draft]').count() === 0, 'черновик удалён');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
