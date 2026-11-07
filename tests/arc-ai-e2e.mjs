// ИИ-архитектор: ответы «почти JSON» от локальных моделей разбираются, обрезанный ответ спасается,
// ответ одними блоками кода тоже собирается. ИИ — заглушка (window.claude.use). Запуск: npm run build && node tests/arc-ai-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const F = '`'.repeat(3);
const PY = 'from triosteum import block\n\n@block("Проверка имени")\ndef run(data):\n    name = (data or {}).get("name", "")\n    print("Имя:", name)\n    return "да" if name == "Анна" else "нет"\n';
const CASES = {
  // переводы строк и кавычки внутри "code" без экранирования, запятая перед скобкой
  loose: { stop: 'stop', text: 'Вот схема:\n' + F + 'json\n{"title":"Проверка имени","summary":"Сравнивает имя.","blocks":[{"key":"b1","new":true,"name":"Проверка имени","lang":"python","desc":"сравнение","code":"' + PY + '"},],"links":[]}\n' + F },
  // ответ оборвался посреди второго блока
  cut: { stop: 'length', text: F + 'json\n{"title":"Отчёт","summary":"Два шага.","blocks":[{"key":"b1","new":true,"name":"Чтение","lang":"python","desc":"читает","code":"def run(data):\\n    return [1, 2]\\n"},{"key":"b2","new":true,"name":"Сумма","lang":"python","code":"def run(data):\\n    return sum(da' },
  // без JSON — только код
  fences: { stop: 'stop', text: 'Сделал так:\n' + F + 'python\n' + PY + F + '\nГотово.' },
};
const browser = await chromium.launch();
for (const [name, ans] of Object.entries(CASES)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((a) => {
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
    window.claude = { use: () => Promise.resolve(() => Promise.resolve(a)) };
  }, ans);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
  await page.goto(URL); await page.waitForTimeout(1000);
  await page.click('#aiFab'); await page.waitForTimeout(250);
  await page.fill('#arcW .arc-in', 'Программа: если имя Анна — ответ да, иначе нет. На питоне'); await page.waitForTimeout(200);
  await page.click('#arcW button:has-text("Собрать схему")'); await page.waitForTimeout(800);
  const txt = await page.$eval('#arcW', (x) => x.textContent);
  console.log(name);
  check(!/неожиданном формате/.test(txt) && await page.locator('#arcW .arc-blocks li').count() >= 1, 'схема разобрана: блоков ' + await page.locator('#arcW .arc-blocks li').count());
  if (name === 'cut') check(/оборвался/.test(txt) && await page.locator('#arcW .arc-blocks li').count() === 1, 'обрезанный ответ: спасён законченный блок и есть предупреждение');
  await page.click('#arcW button:has-text("Поставить на доску")'); await page.waitForTimeout(1500);
  // код новых блоков ИИ хранится в «моих плагинах» — ищем его во всём сохранённом
  const code = await page.evaluate(() => Object.keys(localStorage).map((k) => { try { return JSON.stringify(JSON.parse(localStorage.getItem(k))); } catch (e) { return ''; } }).join('\n').replace(/\\n/g, '\n').replace(/\\"/g, '"'));
  if (name !== 'cut') check(/return "да" if name == "Анна" else "нет"/.test(code) && /\n {4}print/.test(code), 'код блока целиком, с кавычками и переносами строк' + (/Анна/.test(code) ? '' : ': ' + code.slice(0, 200)));
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
