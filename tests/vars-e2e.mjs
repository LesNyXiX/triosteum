// Переменные пространства: профили «Тест»/«Боевой», подстановка {{var:…}} и {{secret:…}}, скрытие секретов в журнале.
// Запуск: npm run build && node tests/vars-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// по http: на file:// Chromium иногда теряет localStorage и sessionStorage при перезагрузке
const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, lang, code) => ({ id, name, lang, x, y: 220, codes: { [lang]: code }, pluginId: null, family: null, desc: '', colors: null });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((g) => {
  sessionStorage.setItem('triosteum.secrets', JSON.stringify({ ТОКЕН: 'tok-secret-12345' }));
  if (window.top !== window || sessionStorage.getItem('seeded')) return; /* только главная страница, один раз */ sessionStorage.setItem('seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Переменные', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
}, { nodes: [node('a', 'Ставка', 160, 'cpp', 'int run(){ return {{var:СТАВКА}}; }'),
             node('c', 'Падает', 160, 'csharp', 'public class C { public object Run(object d){ throw new Exception("доступ запрещён для {{secret:ТОКЕН}}"); } }'),
             node('r', 'Отдаёт секрет', 520, 'csharp', 'public class R { public object Run(object d){ return "{{secret:ТОКЕН}}"; } }'),
             node('L', 'Длинный результат', 520, 'csharp', 'public class R { public object Run(object d){ return "' + 'x'.repeat(150) + '{{secret:ТОКЕН}}"; } }'),
             node('b', 'Токен', 520, 'csharp', 'public class B { public object Run(object d){ Console.WriteLine("токен: {{secret:ТОКЕН}}"); return "{{var:НЕТ_ТАКОЙ}}"; } }')],
     edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 9 });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);
const run = async () => { await page.keyboard.press('Escape'); await page.keyboard.press('Control+r'); await page.waitForFunction(() => !document.querySelector('#runp.busy') && /успешно/.test(document.querySelector('#runSum').textContent), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300); return page.textContent('#runOut'); };
const cmd = async (t) => { await page.keyboard.press('Escape'); await page.keyboard.press('Control+k'); await page.keyboard.type(t); await page.waitForTimeout(700); await page.keyboard.press('Enter'); await page.waitForTimeout(600); };

console.log('Окно переменных');
await cmd('Переменные пространства');
check(await page.isVisible('#varsW'), 'окно открывается из палитры команд');
check(/В коде блоков используются, но не заданы: (СТАВКА, НЕТ_ТАКОЙ|НЕТ_ТАКОЙ, СТАВКА)/.test(await page.textContent('#varsW')), 'подсказка: какие переменные используются в коде, но не заданы');
await page.click('#varsW button:has-text("Добавить переменную")'); await page.waitForTimeout(200);
const row = page.locator('#varsW tbody tr').first();
await row.locator('input').nth(0).fill('СТАВКА'); await row.locator('input').nth(0).dispatchEvent('change');
await row.locator('input').nth(1).fill('5'); await row.locator('input').nth(1).dispatchEvent('change');
await row.locator('input').nth(2).fill('7'); await row.locator('input').nth(2).dispatchEvent('change');
await page.waitForTimeout(700);
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).vars);
check(saved && saved[0].k === 'СТАВКА' && saved[0].test === '5' && saved[0].prod === '7', 'переменная сохранена в пространстве');
await page.keyboard.press('Escape');

console.log('Запуск');
let log = await run();
check(/Профиль переменных: «Тест»/.test(log), 'в журнале — активный профиль');
check(/✓ результат: 5\b/.test(log), '{{var:СТАВКА}} в «Тесте» → 5');
check(/токен: ••••••/.test(log) && !/tok-secret-12345/.test(log), 'секрет подставлен, но в журнале скрыт');
check(/Не задана переменная «НЕТ_ТАКОЙ»/.test(log), 'про незаданную переменную — предупреждение');
const runs = await page.evaluate(() => Object.keys(localStorage).filter((k) => /runs\./.test(k)).map((k) => localStorage.getItem(k)).join(''));
check(runs.length > 0 && !/tok-secret-12345/.test(runs) && /••••••/.test(runs), 'секрет из результата блока не попал в историю запусков');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
const shown = await page.evaluate(() => [...document.querySelectorAll('.df-chip')].map((c) => c.textContent).join(' ') + document.body.innerText);
check(!/tok-secret-12345/.test(shown), 'и не виден на доске (плашки данных на связях)');
{
  await page.keyboard.press('Escape'); const rb = await page.locator('.node[data-id="r"]').boundingBox(); await page.mouse.click(rb.x + rb.width / 2, rb.y + 20, { button: 'right' }); await page.waitForTimeout(400);
  await page.locator('#pop .ropts button', { hasText: 'Закрепить результат последнего запуска' }).click(); await page.waitForTimeout(700);
  const gp = await page.evaluate(() => localStorage.getItem('triosteum.proj.p1'));
  check(!/tok-secret-12345/.test(gp) && !JSON.parse(gp).nodes.find((n) => n.id === 'r').pin && /содержит секрет/.test(await page.textContent('body')), 'результат с секретом не закрепляется (снимок ушёл бы в пространство)');
  await page.keyboard.press('Escape');
}
check(!/tok-secr/.test(log) && !/tok-secr/.test(runs), 'секрет на границе обрезки результата (160 символов) не виден даже частично');
const errsTxt = await page.$eval('#runErrs', (e) => e.textContent);
check(/доступ запрещён для ••••••/.test(errsTxt) && !/tok-secret-12345/.test(errsTxt) && !/tok-secret-12345/.test(await page.evaluate(() => document.body.innerText)), 'секрет в тексте ошибки скрыт и во вкладке «Ошибки», и на странице');
await cmd('переключить на «Боевой»');
check(await page.$eval('#topRun', (b) => b.classList.contains('prof-prod')), 'у кнопки запуска — метка «боевой»');
log = await run();
check(/Профиль переменных: «Боевой»/.test(log) && /✓ результат: 7\b/.test(log), 'в «Боевом» → 7');
// редактор: вывод «Запустить код» (stdout и текст ошибки) тоже скрывает секрет
await page.dblclick('#runErrs .rb-err-h:has-text("Падает")'); await page.waitForTimeout(600);
await page.click('#runBtn'); await page.waitForTimeout(800);
const edOut = await page.textContent('#out');
check(/••••••/.test(edOut) && !/tok-secret-12345/.test(edOut), 'вывод редактора: секрет в тексте ошибки скрыт');
console.log('Хранение');
await page.reload(); await page.waitForTimeout(1000);
check(await page.$eval('#topRun', (b) => b.classList.contains('prof-prod')), 'профиль и переменные — после перезагрузки на месте');
const g = await page.evaluate(() => localStorage.getItem('triosteum.proj.p1'));
check(!/tok-secret-12345/.test(g), 'секрет не попал в данные пространства');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
