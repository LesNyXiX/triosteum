// Сквозная проверка: Python-блоки выполняются на сервере (песочница), а не в браузере.
// Запуск: TRIOSTEUM_URL=http://localhost:8000 node tests/run-e2e.mjs  (сервер с RUNNER_URL или RUNNER_LOCAL=1)
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://localhost:8000';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); const p = await ctx.newPage();
const errs = []; let fail = 0; p.on('pageerror', (e) => errs.push(e.message));
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
let pyodideRequested = false; p.on('request', (r) => { if (r.url().includes('pyodide')) pyodideRequested = true; });
await p.goto(B + '/login#register');
await p.fill('#org', 'Завод Python'); await p.fill('#email', 'py' + Date.now() + '@z.ru'); await p.fill('#pw', 'password123'); await p.check('#pd');
await p.click('#go'); await p.waitForURL(B + '/'); await p.waitForTimeout(700);
ok(await p.evaluate(() => window.TRIOSTEUM_BOOT.runner.enabled), 'сервер сообщает, что запуск Python доступен');
// две связанные Python-блока: первый отдаёт числа, второй фильтрует
await p.evaluate(async () => {
  const id = window.TRIOSTEUM_BOOT.cur || window.TRIOSTEUM_BOOT.spaces[0]?.id || 'p1';
  const g = { nodes: [
    { id: 'a', name: 'Источник', lang: 'python', x: 120, y: 160, codes: { python: 'from triosteum import block\n@block("Источник")\ndef run(d):\n    print("отдаю 4 значения")\n    return {"values": [5, 18, 40, 12]}\n' } },
    { id: 'b', name: 'Фильтр', lang: 'python', x: 460, y: 160, codes: { python: 'from triosteum import block\n@block("Фильтр")\ndef run(d):\n    import sys, platform\n    print("Python", platform.python_version())\n    return [v for v in d["values"] if v > 15]\n' } }],
    edges: [{ id: 'e1', from: 'a', to: 'b', taps: [] }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 10 };
  const r = await fetch('/api/spaces/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Новое пространство', env: 'code', content: g, base_rev: 0 }) });
  if (r.status === 409) { const cur = await r.json(); await fetch('/api/spaces/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cur.name, env: 'code', content: g, base_rev: cur.rev }) }); }
});
await p.reload(); await p.waitForTimeout(900);
ok(await p.$$eval('.node', (x) => x.length) === 2, 'на доске два Python-блока');
await p.click('#topRun'); await p.waitForTimeout(3000);
const log = await p.textContent('.runp');
ok(log.includes('Python выполняется на сервере'), 'схема запущена на сервере');
ok(log.includes('отдаю 4 значения') && log.includes('Python 3.'), 'вывод print из песочницы виден');
ok(log.includes('[18,40]'), 'данные прошли по связи: результат [18, 40]');
// редактор кода блока
const nb = await (await p.$('.node[data-id="b"]')).boundingBox();
await p.keyboard.press('Escape'); await p.mouse.click(nb.x + 40, nb.y + 30, { button: 'right' }); await p.waitForTimeout(400);
await p.click('#pop button:has-text("Открыть код")'); await p.waitForTimeout(500);
await p.click('#runBtn'); await p.waitForTimeout(2000);
const out = await p.textContent('#out');
ok(out.includes('Запуск на сервере') && out.includes('Выполнено без ошибок'), 'редактор: запуск блока на сервере');
// целостный код схемы
await p.click('#bScheme').catch(() => {}); await p.waitForTimeout(600);
const runBtn = await p.$('#scBody button:has-text("Запустить в Python")');
if (runBtn) { await runBtn.click(); await p.waitForTimeout(2500); }
const sc = runBtn ? await p.textContent('#scBody .sc-out') : '';
ok(sc.includes('Готово за'), 'целостный код схемы выполнен на сервере');
ok(!pyodideRequested, 'Pyodide в браузер не загружался');
ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
