// Совместная работа в двух браузерах: кто онлайн, курсоры, живые правки, одновременные правки сливаются.
// Запуск: TRIOSTEUM_URL=http://127.0.0.1:8000 node tests/live-e2e.mjs
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const b = await chromium.launch(); const errs = []; let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const cons = []; const page = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LIVE')) cons.push(m.text().slice(0, 200)); }); return p; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(150); } return false; }
const names = (p) => p.$$eval('.node .nt', (x) => x.map((e) => e.textContent).sort());

// Анна — владелец, в пространстве два блока
const a = await page();
await a.goto(B + '/login#register');
await a.fill('#org', 'Завод Вместе'); await a.fill('#name', 'Анна Смирнова'); await a.fill('#email', 'anna' + Date.now() + '@z.ru'); await a.fill('#pw', 'password123'); await a.check('#pd');
await a.click('#go'); await a.waitForURL(B + '/'); await a.waitForTimeout(600);
const sid = await a.evaluate(async () => {
  const id = window.TRIOSTEUM_BOOT.cur || 'p1';
  const g = { nodes: [{ id: 'n1', name: 'Блок 1', lang: 'python', x: 120, y: 140, codes: {} }, { id: 'n2', name: 'Блок 2', lang: 'python', x: 520, y: 140, codes: {} }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 10 };
  const cur = await (await fetch('/api/spaces/' + id)).json().catch(() => null);
  await fetch('/api/spaces/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Цех', env: 'code', content: g, base_rev: cur && cur.rev ? cur.rev : 0 }) });
  return id;
});
const inv = await a.evaluate(async () => (await (await fetch('/api/org/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'boris' + Date.now() + '@z.ru', role: 'editor', send_email: false }) })).json()).path);
await a.reload(); await a.waitForTimeout(800);

// Борис принимает приглашение и открывает то же пространство
const bb = await page();
await bb.goto(B + inv); await bb.waitForTimeout(500);
await bb.fill('#name', 'Борис Ким'); await bb.fill('#pw', 'password456'); await bb.check('#pd'); await bb.click('#go'); await bb.waitForURL(B + '/'); await bb.waitForTimeout(1000);
ok((await names(bb)).join() === 'Блок 1,Блок 2', 'Борис видит пространство Анны');

console.log('Кто онлайн и курсоры');
ok(await until(async () => (await a.$$eval('#livePeers .live-av', (x) => x.map((e) => e.title))).some((t) => t.includes('Борис'))), 'у Анны в шапке кружок «Борис»');
ok(await until(async () => (await bb.$$eval('#livePeers .live-av', (x) => x.map((e) => e.textContent))).includes('АС')), 'у Бориса — кружок «АС»');
await bb.mouse.move(700, 450); await bb.mouse.move(720, 470, { steps: 4 });
ok(await until(async () => (await a.$$eval('.live-cur span', (x) => x.map((e) => e.textContent))).includes('Борис Ким')), 'у Анны виден курсор Бориса с подписью');
const n2 = await (await bb.$('.node[data-id="n2"]')).boundingBox(); await bb.mouse.click(n2.x + 60, n2.y + 30);
ok(await until(() => a.$eval('.node[data-id="n2"]', (e) => e.classList.contains('live-sel') && e.getAttribute('data-live') === 'Борис Ким')), 'выделенный Борисом блок обведён у Анны');

console.log('Живые правки');
await a.click('#bAdd'); await a.click('[data-add="block"]'); await a.mouse.click(400, 500); await a.waitForTimeout(200); await a.click('[data-tool="select"]');
ok(await until(async () => (await bb.$$eval('.node', (x) => x.length)) === 3, 6000), 'блок, добавленный Анной, появился у Бориса без перезагрузки');
const newIds = await a.$$eval('.node', (x) => x.map((e) => e.dataset.id));
ok(newIds.some((id) => /_[a-z0-9]{3}$/.test(id)), 'новый блок получил номер с меткой вкладки');

console.log('Одновременные правки');
// почти одновременно: Анна двигает Блок 1, Борис двигает Блок 2
const a1 = await (await a.$('.node[data-id="n1"]')).boundingBox(), b2 = await (await bb.$('.node[data-id="n2"]')).boundingBox();
await Promise.all([
  (async () => { await a.mouse.move(a1.x + 60, a1.y + 30); await a.mouse.down(); await a.mouse.move(a1.x + 60, a1.y + 230, { steps: 5 }); await a.mouse.up(); })(),
  (async () => { await bb.mouse.move(b2.x + 60, b2.y + 30); await bb.mouse.down(); await bb.mouse.move(b2.x + 260, b2.y + 30, { steps: 5 }); await bb.mouse.up(); })()
]);
const pos = (p, id) => p.$eval(`.node[data-id="${id}"]`, (e) => [parseFloat(e.style.left), parseFloat(e.style.top)]);
const settled = await until(async () => {
  const [A1, A2, B1, B2] = [await pos(a, 'n1'), await pos(a, 'n2'), await pos(bb, 'n1'), await pos(bb, 'n2')];
  return A1[1] > 300 && B1[1] > 300 && A2[0] > 700 && B2[0] > 700;
}, 8000);
ok(settled, 'у обоих: Блок 1 сдвинут Анной вниз, Блок 2 сдвинут Борисом вправо');
await wait(1500);
const server = await a.evaluate(async (id) => (await (await fetch('/api/spaces/' + id)).json()).content.nodes.map((n) => [n.id, Math.round(n.x), Math.round(n.y)]), sid);
const s1 = server.find((x) => x[0] === 'n1'), s2 = server.find((x) => x[0] === 'n2');
ok(s1[2] > 300 && s2[1] > 700 && server.length === 3, 'на сервере сохранились обе правки и третий блок');
ok(!(await a.$$eval('.ctx .ctx-i', () => 0).catch(() => 0)) && !(await names(a)).some((n) => n.includes('мои правки')), 'копий «мои правки» не появилось');

console.log('Отмена');
await bb.click('#bAdd'); await bb.click('[data-add="block"]'); await bb.mouse.click(900, 600); await bb.waitForTimeout(200); await bb.click('[data-tool="select"]');
ok(await until(async () => (await a.$$eval('.node', (x) => x.length)) === 4, 6000), 'блок Бориса появился у Анны');
await a.click('[data-tool="select"]'); await a.waitForTimeout(200);   // инструмент «Выбор», чтобы клик не добавил блок
await a.mouse.click(640, 700); await a.keyboard.press('Control+z'); await a.waitForTimeout(600);
const afterUndo = await a.$$eval('.node', (x) => x.length);
const a1y = (await pos(a, 'n1'))[1];
ok(afterUndo === 4 && a1y < 300, 'Ctrl+Z у Анны отменил её перемещение, а блок Бориса остался');

console.log('Группы');
await bb.click('[data-tool="select"]'); await bb.keyboard.press('Escape');
const bn2 = await (await bb.$('.node[data-id="n2"]')).boundingBox(); await bb.mouse.click(bn2.x + 60, bn2.y + 18);
await bb.keyboard.press('Control+g'); await bb.waitForTimeout(300);
await bb.keyboard.press('Control+a'); await bb.keyboard.type('Расчёт'); await bb.keyboard.press('Enter');
ok(await until(async () => (await a.$$eval('.grp .grp-name', (x) => x.map((e) => e.textContent))).includes('Расчёт'), 6000), 'группа, созданная Борисом, появилась у Анны без перезагрузки');
await a.mouse.click(640, 760); await a.keyboard.press('Control+z'); await a.waitForTimeout(800);
ok((await a.$$eval('.grp', (x) => x.length)) === 1, 'Ctrl+Z у Анны не убирает группу Бориса');
ok(await until(async () => (await bb.$$eval('.grp', (x) => x.length)) === 1, 3000), 'у Бориса группа тоже на месте');

if (process.env.SHOT) await a.screenshot({ path: process.env.SHOT });
ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
