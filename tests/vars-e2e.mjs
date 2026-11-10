// Переменные пространства: профили «Тест»/«Боевой», подстановка {{var:…}} и {{secret:…}}, скрытие секретов в журнале.
// Запуск: npm run build && node tests/vars-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const node = (id, name, x, lang, code) => ({ id, name, lang, x, y: 220, codes: { [lang]: code }, pluginId: null, family: null, desc: '', colors: null });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((g) => {
  sessionStorage.setItem('triosteum.secrets', JSON.stringify({ ТОКЕН: 'tok-secret-12345' }));
  if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Переменные', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
}, { nodes: [node('a', 'Ставка', 160, 'cpp', 'int run(){ return {{var:СТАВКА}}; }'),
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
await cmd('переключить на «Боевой»');
check(await page.$eval('#topRun', (b) => b.classList.contains('prof-prod')), 'у кнопки запуска — метка «боевой»');
log = await run();
check(/Профиль переменных: «Боевой»/.test(log) && /✓ результат: 7\b/.test(log), 'в «Боевом» → 7');
console.log('Хранение');
await page.reload(); await page.waitForTimeout(1000);
check(await page.$eval('#topRun', (b) => b.classList.contains('prof-prod')), 'профиль и переменные — после перезагрузки на месте');
const g = await page.evaluate(() => localStorage.getItem('triosteum.proj.p1'));
check(!/tok-secret-12345/.test(g), 'секрет не попал в данные пространства');
check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
