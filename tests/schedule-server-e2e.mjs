// Расписание на сервере: одно пространство открыто «на двух компьютерах» (два профиля браузера) —
// наступивший срок выполняет только один клиент (общий захват срока на сервере).
// Запуск: TRIOSTEUM_URL=http://127.0.0.1:8000 node tests/schedule-server-e2e.mjs
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const b = await chromium.launch(); const errs = []; let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const email = 'sched' + Date.now() + '@z.ru';
const a = await page();
await a.goto(B + '/login#register');
await a.fill('#org', 'Завод Расписание'); await a.fill('#name', 'Анна'); await a.fill('#email', email); await a.fill('#pw', 'password123'); await a.check('#pd');
await a.click('#go'); await a.waitForURL(B + '/'); await a.waitForTimeout(600);
await a.evaluate(async () => {
  const id = window.TRIOSTEUM_BOOT.cur || 'p1';
  const g = { nodes: [{ id: 'n1', name: 'Блок', lang: 'cpp', x: 200, y: 200, codes: { cpp: 'int run(){ return 1; }' } }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 5,
    schedule: { on: true, kind: 'every', every: 60, notify: false, last: Date.now() - 3 * 3600e3 } };
  const cur = await (await fetch('/api/spaces/' + id)).json().catch(() => null);
  await fetch('/api/spaces/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Цех', env: 'code', content: g, base_rev: cur && cur.rev ? cur.rev : 0 }) });
});
const c2 = await page();
await c2.goto(B + '/login'); await c2.fill('#email', email); await c2.fill('#pw', 'password123'); await c2.click('#go'); await c2.waitForURL(B + '/');
// запуск записывается в историю (настройка runs.<пространство>) — по этим запросам видно, какой клиент выполнил схему
const saves = new Map(); for (const p of [a, c2]) { saves.set(p, 0); p.on('request', (q) => { if (q.method() === 'PUT' && /\/api\/prefs\/runs\./.test(q.url())) saves.set(p, saves.get(p) + 1); }); }
await Promise.all([a.reload(), c2.reload()]);
await a.waitForTimeout(9000);
const r1 = saves.get(a) > 0, r2 = saves.get(c2) > 0;
ok(r1 !== r2, 'наступивший срок выполнил ровно один из двух клиентов (' + [r1, r2].join(', ') + ')');
const sp = await a.evaluate(async () => (await (await fetch('/api/spaces/' + (window.TRIOSTEUM_BOOT.cur || 'p1'))).json()).content.schedule);
ok(sp && sp.last > Date.now() - 60e3, 'отметка о запуске сохранена в пространстве на сервере');
ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
