// Расширения: работа в фоне и события (выделение, смена пространства), команды в меню блока,
// обмен расширением между компаниями файлом (скачать → загрузить в мастерскую другой компании).
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/extevents-e2e.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const T = Date.now().toString(36);
const SHOTS = process.env.SHOTS || '';
const b = await chromium.launch();
let fail = 0; const errs = [];
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
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
  await p.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await it.first().click(); await p.waitForTimeout(300);
  return 1;
}
async function waitToast(p, re, ms = 4000) { const end = Date.now() + ms; let t = ''; while (Date.now() < end) { t = (await p.textContent('#toast').catch(() => '')) || ''; if (re.test(t)) return t; await p.waitForTimeout(100); } return t; }
const clearToast = (p) => p.evaluate(() => { document.getElementById('toast').textContent = ''; });

const EXT = {
  id: 'xstorozh', name: 'Сторож', desc: 'Следит за выделением', perms: ['board.read', 'board.write', 'background'],
  commands: [{ id: 'mark', label: 'Отметить проверенным', where: ['block'] }, { id: 'count', label: 'Сколько блоков', where: ['palette', 'block'] }],
  code: `
triosteum.on('selection', ({ ids }) => { if (ids.length) triosteum.ui.toast('выделено: ' + ids.length); });
triosteum.on('space', ({ name }) => triosteum.ui.toast('пространство: ' + name));
triosteum.command('mark', async ({ block }) => { await triosteum.board.update(block, { name: 'Проверено' }); });
triosteum.command('count', async () => { const b = await triosteum.board.get(); await triosteum.ui.toast('блоков: ' + b.nodes.length); });
`,
};

console.log('Фоновое расширение и события');
const a = await page();
await register(a, 'Завод События ' + T, 'Аня', `anya${T}@zavod.ru`);
ok((await api(a, 'POST', '/org/items', { kind: 'ext', src: EXT.id, data: EXT })).status === 201, 'владелец опубликовал фоновое расширение');
await a.reload(); await a.waitForTimeout(1200);
await cmd(a, 'Расширения компании'); await a.waitForTimeout(700);
const card = a.locator('.ext-card[data-ext="xstorozh"]');
ok(/Отметить проверенным \(меню блока\)/.test(await card.textContent()) && /Работает в фоне/.test(await card.textContent()), 'в карточке видно, где команды и что расширение работает в фоне');
await card.locator('button:has-text("Включить…")').click();
ok(/работать в фоне/.test(await card.locator('.ext-confirm').textContent()), 'работа в фоне — отдельное разрешение в подтверждении');
await card.locator('button:has-text("Разрешить и включить")').click(); await a.waitForTimeout(1500);
await a.keyboard.press('Escape');
ok(await a.locator('.ext-host .ext-pane').count() === 1, 'включённое фоновое расширение запустилось само');
ok(await has(a, 'Сторож: Отметить') === 0 && await has(a, 'Сторож: Сколько блоков') === 1, 'команда «только для блока» не попадает в Ctrl+K');
// новый блок выделяется сам: второй новый блок — смена выделения
await cmd(a, 'Новый блок'); await a.waitForTimeout(800); await a.keyboard.press('Escape'); await clearToast(a);
await cmd(a, 'Новый блок');
ok(/выделено: 1/.test(await waitToast(a, /выделено/)), 'выделение блока — событие «selection»');
await clearToast(a);
await cmd(a, 'Создать пространство');
ok(/пространство: /.test(await waitToast(a, /пространство:/)), 'новое пространство — событие «space»');

console.log('Перезагрузка — расширение снова в фоне');
await a.reload(); await a.waitForTimeout(2500);
ok(await a.locator('.ext-host .ext-pane').count() === 1, 'после перезагрузки фоновое расширение запущено без команды');
await clearToast(a);
await cmd(a, 'Новый блок');
ok(/выделено: 1/.test(await waitToast(a, /выделено/)), 'и реагирует на выделение');

console.log('Команда в меню блока');
await a.click('#nodes .node >> nth=0', { button: 'right' }); await a.waitForTimeout(500);
const blockBtn = a.locator('#pop .ext-block-cmd[data-cmd="mark"]');
ok(await blockBtn.count() === 1 && await a.locator('#pop .ext-block-cmd[data-cmd="count"]').count() === 1, 'в окне настроек блока — «Расширения компании» с командами');
await blockBtn.click(); await a.waitForTimeout(900);
ok(await a.locator('#nodes .node:has-text("Проверено")').count() === 1, 'команда из меню блока изменила именно этот блок');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/ext-block-menu.png` });
await a.keyboard.press('Escape');

console.log('Выключение — фоновое расширение останавливается');
await cmd(a, 'Расширения компании'); await a.waitForTimeout(700);
await a.click('.ext-card[data-ext="xstorozh"] button:has-text("Выключить")'); await a.waitForTimeout(400);
await a.keyboard.press('Escape');
ok(await a.locator('.ext-host .ext-pane').count() === 0, 'выключенное расширение остановлено');

console.log('Обмен между компаниями файлом');
await cmd(a, 'Мастерская компании'); await a.waitForTimeout(700);
await a.click('.xw-item[data-item]:has-text("Сторож")'); await a.waitForTimeout(500);
await a.click('.xw-main button:has-text("Открыть в редакторе")'); await a.waitForTimeout(300);
ok(await a.locator('.xw-cmd .xw-where').evaluateAll((s) => s.map((x) => x.value).join(' ')) === 'block palette,block', 'в редакторе видно, где каждая команда');
const [dl] = await Promise.all([a.waitForEvent('download'), a.click('.xw .ext-acts button:has-text("Скачать файлом")')]);
const dir = mkdtempSync(join(tmpdir(), 'ext-'));
const file = join(dir, dl.suggestedFilename());
await dl.saveAs(file);
const exp = JSON.parse(readFileSync(file, 'utf8'));
ok(exp.format === 'triosteum-extension' && exp.extension.name === 'Сторож' && !('id' in exp.extension) && exp.extension.commands[0].where.join() === 'block', 'файл расширения: формат, название, без id, с местами команд');
ok(dl.suggestedFilename() === 'storozh.triosteum-ext.json', 'понятное имя файла: ' + dl.suggestedFilename());

const other = await page();
await register(other, 'Другой завод ' + T, 'Петя', `petya${T}@zavod.ru`);
await cmd(other, 'Мастерская компании'); await other.waitForTimeout(600);
await other.setInputFiles('.xw-io input[type=file]', file); await other.waitForTimeout(800);
ok(await other.inputValue('.xw-main input[aria-label="Название расширения"]') === 'Сторож', 'другая компания загрузила расширение черновиком');
ok(/загружено из файла — прочитайте код/.test(await other.textContent('.xw-probs')), 'с предупреждением проверить код');
ok(await other.isChecked('.xw-perms input[data-perm="background"]') && await other.locator('.xw-cmd').count() === 2, 'разрешения и команды сохранились');
await other.click('.xw .ext-acts button:has-text("Опубликовать в компании")'); await other.waitForTimeout(1200);
const theirs = (await api(other, 'GET', '/org/items?kind=ext')).data.items;
ok(theirs.length === 1 && theirs[0].data.id !== 'xstorozh' && theirs[0].data.name === 'Сторож', 'опубликовано у них под своим id');
ok(!/загружено из файла/.test(await other.textContent('.xw-probs')), 'после публикации предупреждение снято');
const bad = join(dir, 'bad.json'); writeFileSync(bad, JSON.stringify({ format: 'что-то другое' }));
await clearToast(other);
await other.setInputFiles('.xw-io input[type=file]', bad);
ok(/не файл расширения/.test(await waitToast(other, /Не получилось/)), 'чужой файл — понятный отказ');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
