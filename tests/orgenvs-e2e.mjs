// Свои среды компании в браузере: владелец собирает среду из блоков отраслевых сред, коллега её видит и работает в ней,
// чужая организация — не видит; настройка и защита от удаления среды с пространствами.
// Нужен настоящий сервер на чистой базе с открытой регистрацией: REGISTRATION=open node tests/orgenvs-e2e.mjs
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
async function eco(p) { await p.keyboard.press('Escape'); await p.click('#ecoBtn'); await p.waitForTimeout(800); }

console.log('Владелец собирает свою среду');
const a = await page();
await register(a, 'Завод Среды ' + T, 'Аня', `anya${T}@zavod.ru`);
await eco(a);
ok(await a.locator('.eco-card.add').count() === 1, 'на экране сред есть карточка «Своя среда»');
await a.click('.eco-card.add'); await a.waitForTimeout(400);
ok(await a.locator('.cenv-src').count() >= 5, 'в конструкторе — блоки отраслевых сред по группам');
await a.click('.cenv-f .btn.primary'); await a.waitForTimeout(200);
ok(/Назовите/.test(await a.textContent('.cenv-err')), 'без названия не создаёт');
await a.fill('.cenv input[aria-label="Название среды"]', 'Лаборатория ОТК');
await a.fill('.cenv input[aria-label="Короткое название"]', 'ОТК');
await a.click('.cenv-f .btn.primary'); await a.waitForTimeout(200);
ok(/хотя бы один/.test(await a.textContent('.cenv-err')), 'без типов блоков не создаёт');
await a.click('.cenv-src:has-text("Производство") .cenv-src-h button');
await a.click('.cenv-ic button[aria-label="Значок lab"]');
ok(/выбрано типов блоков: \d+/.test(await a.textContent('.cenv-n')), 'кнопка «все» выбирает типы блоков группы');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/builder.png` });
await a.click('.cenv-f .btn.primary'); await a.waitForTimeout(1500);
ok(await a.locator('.cenv-back').count() === 0, 'среда создана, конструктор закрылся');
const sp = (await api(a, 'GET', '/spaces')).data.filter((s) => s.env.startsWith('u'));
ok(sp.length === 1 && sp[0].name === 'ОТК', 'сразу создано пространство в новой среде');
const envId = sp[0].env;
await eco(a);
const card = a.locator('.eco-card:has-text("Лаборатория ОТК")');
ok(await card.count() === 1 && await card.locator('.eco-tag').count() === 1, 'среда на экране сред, с пометкой');
if (SHOTS) await a.screenshot({ path: `${SHOTS}/eco.png` });

console.log('Коллега видит и работает в среде');
const inv = await api(a, 'POST', '/org/invites', { email: `kolya${T}@zavod.ru`, role: 'editor' });
const k = await page();
await k.goto(B + inv.data.path); await k.waitForTimeout(500);
await k.fill('#pw', 'password123'); if (await k.locator('#name').isVisible()) await k.fill('#name', 'Коля'); await k.check('#pd');
await k.click('#go'); await k.waitForURL(B + '/'); await k.waitForTimeout(900);
await eco(k);
const kc = k.locator('.eco-card:has-text("Лаборатория ОТК")');
ok(await kc.count() === 1, 'коллега видит среду компании');
ok(await kc.locator('button:has-text("Настроить")').count() === 0, 'коллега-редактор не может настроить чужую среду');
await kc.locator('button:has-text("Новое пространство")').click(); await k.waitForTimeout(1200);
const ksp = (await api(k, 'GET', '/spaces')).data.filter((s) => s.env === envId);
ok(ksp.length === 2, 'коллега создал пространство в среде компании');
await k.click('#bLib'); await k.waitForTimeout(700);
ok(await k.locator('.pcard').count() > 0, 'в библиотеке среды — шаблоны выбранных блоков');

console.log('Чужая организация не видит');
const s = await page();
await register(s, 'Чужой завод ' + T, 'Сергей', `serg${T}@zavod.ru`);
await eco(s);
ok(await s.locator('.eco-card:has-text("Лаборатория ОТК")').count() === 0, 'у чужой организации среды нет');

console.log('Настройка и удаление');
await eco(a);
await a.click('.eco-card:has-text("Лаборатория ОТК") button:has-text("Настроить")'); await a.waitForTimeout(400);
await a.fill('.cenv input[aria-label="Название среды"]', 'Лаборатория ОТК и метрологии');
await a.click('.cenv-f .btn.primary'); await a.waitForTimeout(1200);
await eco(a);
ok(await a.locator('.eco-card:has-text("Лаборатория ОТК и метрологии")').count() === 1, 'название среды изменено');
await a.click('.eco-card:has-text("Лаборатория ОТК и метрологии") button:has-text("Настроить")'); await a.waitForTimeout(400);
await a.click('.cenv-del'); await a.waitForTimeout(300);
ok(/пространства \(2\)/.test(await a.textContent('.cenv-err')), 'среду с пространствами удалить нельзя — объясняет почему');
await a.keyboard.press('Escape'); await a.waitForTimeout(200);
for (const x of (await api(a, 'GET', '/spaces')).data.filter((q) => q.env === envId)) await api(a, 'DELETE', '/spaces/' + x.id);
await a.reload(); await a.waitForTimeout(1200);          // пространства убраны мимо интерфейса — перечитываем страницу
await eco(a);
await a.click('.eco-card:has-text("Лаборатория ОТК и метрологии") button:has-text("Настроить")'); await a.waitForTimeout(400);
await a.click('.cenv-del'); await a.waitForTimeout(500);
ok((await a.textContent('.cenv-del')) === 'Точно?', 'пустую среду удаляет после подтверждения');
await a.click('.cenv-del'); await a.waitForTimeout(1200);
ok((await api(a, 'GET', '/org/items?kind=env')).data.items.length === 0, 'среда удалена из библиотеки компании');
ok(await a.locator('.eco-card:has-text("Лаборатория ОТК")').count() === 0, 'и пропала с экрана сред');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
