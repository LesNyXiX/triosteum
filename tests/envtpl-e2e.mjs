// Шаблон нового пространства своей среды и примеры расширений в мастерской.
// Владелец собирает доску в своей среде, делает её шаблоном — новое пространство этой среды (и у коллеги) начинается с неё;
// шаблон можно убрать. В мастерской — «Начать с примера…»: черновик готов к пробному запуску.
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/envtpl-e2e.mjs
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
async function eco(p) { await p.keyboard.press('Escape'); await p.click('#ecoBtn'); await p.waitForTimeout(800); }
const nodes = (p) => p.locator('#nodes .node').count();

const ENV = { id: 'ulabotk', name: 'Лаборатория ОТК', short: 'ОТК', color: '#0D9488', ic: 'lab', kinds: ['oee', 'defects', 'pareto'], desc: 'Контроль качества', step: false };

console.log('Шаблон своей среды');
const a = await page();
await register(a, 'Завод Шаблоны ' + T, 'Аня', `anya${T}@zavod.ru`);
const inv = await api(a, 'POST', '/org/invites', { email: `kolya${T}@zavod.ru`, role: 'editor' });
ok((await api(a, 'POST', '/org/items', { kind: 'env', src: ENV.id, data: ENV })).status === 201, 'владелец создал свою среду');
await a.reload(); await a.waitForTimeout(1000);
await eco(a);
await a.locator('.eco-card:has-text("Лаборатория ОТК") button:has-text("Новое пространство")').click(); await a.waitForTimeout(1000);
ok(await nodes(a) === 0, 'без шаблона новое пространство пустое');
await cmd(a, 'Новый блок'); await a.waitForTimeout(400); await a.keyboard.press('Escape');
await cmd(a, 'Новый блок'); await a.waitForTimeout(400); await a.keyboard.press('Escape');
await cmd(a, 'Новая заметка'); await a.waitForTimeout(400); await a.keyboard.press('Escape');
const built = await nodes(a);
ok(built === 2, 'на доске два блока');
await eco(a);
await a.click('.eco-card:has-text("Лаборатория ОТК") button:has-text("Настроить")'); await a.waitForTimeout(400);
ok(/Шаблона нет/.test(await a.textContent('.cenv-tpl')), 'в настройке среды — раздел шаблона, шаблона пока нет');
await a.click('.cenv-tpl button:has-text("Сделать шаблоном текущую доску")'); await a.waitForTimeout(200);
ok(/блоков 2/.test(await a.textContent('.cenv-tpl')), 'текущая доска стала шаблоном');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/env-tpl.png` });
await a.click('.cenv-f button:has-text("Сохранить")'); await a.waitForTimeout(800);
const env = (await api(a, 'GET', '/org/items?kind=env')).data.items[0].data;
ok(env.tpl && env.tpl.nodes.length === 2 && !('files' in env.tpl), 'шаблон сохранён в среде компании');
await eco(a);
await a.locator('.eco-card:has-text("Лаборатория ОТК") button:has-text("Новое пространство")').click(); await a.waitForTimeout(1200);
ok(await nodes(a) === 2, 'новое пространство среды начинается с шаблона');
ok(/по шаблону/.test(await a.textContent('#toast')), 'и об этом сказано');

console.log('Коллега и чужая среда');
const k = await page();
await k.goto(B + inv.data.path); await k.waitForTimeout(500);
await k.fill('#pw', 'password123'); if (await k.locator('#name').isVisible()) await k.fill('#name', 'Коля'); await k.check('#pd');
await k.click('#go'); await k.waitForURL(B + '/'); await k.waitForTimeout(900);
await eco(k);
await k.locator('.eco-card:has-text("Лаборатория ОТК") button:has-text("Новое пространство")').click(); await k.waitForTimeout(1200);
ok(await nodes(k) === 2, 'у коллеги новое пространство тоже начинается с шаблона');
await eco(a);
await a.click('.eco-card:has-text("Лаборатория ОТК") button:has-text("Настроить")'); await a.waitForTimeout(400);
await a.click('.cenv-tpl button:has-text("Убрать шаблон")'); await a.waitForTimeout(100);
ok(/Шаблона нет/.test(await a.textContent('.cenv-tpl')), 'шаблон можно убрать');
await a.click('.cenv-f button:has-text("Сохранить")'); await a.waitForTimeout(800);
await eco(a);
await a.locator('.eco-card:has-text("Лаборатория ОТК") button:has-text("Новое пространство")').click(); await a.waitForTimeout(1200);
ok(await nodes(a) === 0, 'без шаблона — снова пустая доска');
// пространство другой среды открыто — сделать шаблон нельзя
await eco(a);
await a.locator('.eco-card:not(:has-text("Лаборатория ОТК")) button:has-text("Новое пространство")').first().click(); await a.waitForTimeout(1000);
await eco(a);
await a.click('.eco-card:has-text("Лаборатория ОТК") button:has-text("Настроить")'); await a.waitForTimeout(400);
const take = a.locator('.cenv-tpl button:has-text("Сделать шаблоном")');
ok(await take.isDisabled() && /Откройте пространство этой среды/.test(await take.getAttribute('title')), 'в пространстве другой среды сделать шаблон нельзя — с подсказкой');
await a.keyboard.press('Escape');

console.log('Примеры расширений');
await cmd(a, 'Мастерская компании'); await a.waitForTimeout(700);
await a.selectOption('.xw-sample', 'summary'); await a.waitForTimeout(300);
ok(await a.inputValue('.xw-main input[aria-label="Название расширения"]') === 'Сводка доски', 'черновик из примера «Сводка доски»');
ok(!/(Назовите|Нужна|Код вызывает|не регистрирует|нет в списке)/.test(await a.textContent('.xw-probs')), 'пример без замечаний: разрешения и команды согласованы с кодом');
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await a.waitForTimeout(1500);
await a.click('.xw-run button[data-cmd="summary"]'); await a.waitForTimeout(900);
ok(/Готово/.test(await a.textContent('.xw-log')) && /Блоков \d+/.test(await a.textContent('#toast')), 'пример работает в пробном запуске');
for (const key of ['check', 'catalog', 'watch']) {
  await a.selectOption('.xw-sample', key); await a.waitForTimeout(300);
  const pr = await a.textContent('.xw-probs');
  ok(!/(Назовите|Нужна|Код вызывает|не регистрирует|нет в списке)/.test(pr), `пример «${key}» без замечаний` + (pr ? ': ' + pr : ''));
}
await a.click('.xw .ext-acts button:has-text("Пробный запуск")'); await a.waitForTimeout(1500);
ok(/Запущено/.test(await a.textContent('.xw-log')) && !/✗/.test(await a.textContent('.xw-log')), 'фоновый пример запускается без ошибок');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fail ? `\nОшибок: ${fail}` : '\nВсе проверки пройдены');
process.exit(fail ? 1 : 0);
