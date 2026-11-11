// Библиотека компании в браузере: сотрудник делится своим плагином — коллега видит его в разделе «Компания»
// и ставит на доску; сотрудник другой организации — не видит. Нужен настоящий сервер на чистой базе
// с открытой регистрацией: REGISTRATION=open, TRIOSTEUM_URL=http://127.0.0.1:8000 node tests/orglib-e2e.mjs
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
async function openLib(p) { await p.keyboard.press('Escape'); await p.click('#bLib'); await p.waitForTimeout(700); }

console.log('Сотрудник делится плагином с компанией');
const a = await page();
await register(a, 'Завод Пластилин ' + T, 'Аня', `anya${T}@zavod.ru`);
await a.click('#bCreate'); await a.waitForTimeout(300);
await a.fill('#newName', 'Расчёт брака по сменам'); await a.fill('#newDesc', 'Доля брака за смену');
await a.click('#newForm button[type=submit]'); await a.waitForTimeout(800);
await openLib(a);
const mine = a.locator('.pcard:has-text("Расчёт брака по сменам")');
ok(await mine.locator('.org-share').count() === 1 && (await mine.locator('.org-share').textContent()) === 'В компанию', 'у своего плагина — кнопка «В компанию»');
await mine.locator('.org-share').click(); await a.waitForTimeout(900);
ok(await a.locator('.lib-cat:has-text("Компания")').count() === 1, 'в библиотеке появился раздел «Компания»');
ok((await a.locator('.pcard:has-text("Расчёт брака по сменам") .org-share').textContent()) === 'Обновить в компании', 'кнопка сменилась на «Обновить в компании»');
await a.click('.lib-cat:has-text("Компания")'); await a.waitForTimeout(300);
ok(await a.locator('.pcard:has-text("Расчёт брака по сменам") .org-mine').count() === 1, 'в разделе «Компания» — плагин с пометкой «компании»');

console.log('Коллега видит и ставит на доску');
const inv = await api(a, 'POST', '/org/invites', { email: `kolya${T}@zavod.ru`, role: 'editor' });
const k = await page();
await k.goto(B + inv.data.path); await k.waitForTimeout(500);
await k.fill('#pw', 'password123'); if (await k.locator('#name').isVisible()) await k.fill('#name', 'Коля'); await k.check('#pd');
await k.click('#go'); await k.waitForURL(B + '/'); await k.waitForTimeout(900);
await openLib(k);
await k.click('.lib-cat:has-text("Компания")'); await k.waitForTimeout(300);
const card = k.locator('.pcard:has-text("Расчёт брака по сменам")');
ok(await card.count() === 1, 'коллега видит плагин в разделе «Компания»');
ok(await card.locator('.org-remove').count() === 0, 'коллега не может убрать чужой плагин');
await card.locator('.open').click(); await k.waitForTimeout(800);
ok(await k.evaluate(() => [...document.querySelectorAll('.node .nm, .node')].some((n) => /Расчёт брака по сменам/.test(n.textContent))), 'плагин компании встал на доску');

console.log('Другая организация не видит');
const s = await page();
await register(s, 'Чужой завод ' + T, 'Сергей', `serg${T}@zavod.ru`);
await openLib(s);
ok(await s.locator('.lib-cat:has-text("Компания")').count() === 0 && await s.locator('.pcard:has-text("Расчёт брака по сменам")').count() === 0, 'у чужой организации нет ни раздела, ни плагина');

console.log('Автор убирает плагин');
await a.click('.pcard:has-text("Расчёт брака по сменам") .org-remove'); await a.waitForTimeout(200);
await a.click('.pcard:has-text("Расчёт брака по сменам") .org-remove'); await a.waitForTimeout(900);
ok((await api(a, 'GET', '/org/items')).data.items.length === 0, 'после второго нажатия плагин убран из библиотеки компании');
await openLib(k); await openLib(k);
ok(await k.locator('.lib-cat:has-text("Компания")').count() === 0, 'у коллеги раздел «Компания» пропал после открытия библиотеки');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
