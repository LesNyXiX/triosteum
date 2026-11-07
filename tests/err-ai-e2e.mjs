// ИИ-разбор ошибок в окне компилятора: причина, 2–3 варианта, «Применить», повторный запуск.
// ИИ подменяется заглушкой (как в claude.ai: window.claude.use). Запуск: npm run build && node tests/err-ai-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html')).href;
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const node = (id, name, lang, x, y, code) => ({ id, name, lang, x, y, codes: { [lang]: code }, pluginId: null, family: null, desc: '', colors: null });
const graph = { nodes: [node('c', 'Сломанный C++', 'cpp', 300, 200, 'int run(){ return undefinedThing + 1; }')], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 5 };
const F = '`'.repeat(3);
const ANSWER = ['Причина: переменная undefinedThing нигде не объявлена.',
  '### Вариант 1: Объявить переменную', 'Задаём значение перед использованием.', F + 'cpp', 'int run(){ int undefinedThing = 41; return undefinedThing + 1; }', F,
  '### Вариант 2: Вернуть константу', 'Если переменная не нужна — возвращаем число.', F + 'cpp', 'int run(){ return 42; }', F].join('\n');

async function open(withAi) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([g, ans, ai]) => {
    localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'ИИ', t: Date.now() }] }));
    localStorage.setItem('triosteum.proj.p1', JSON.stringify(g));
    localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Т', org: 'З' })); localStorage.setItem('triosteum.tour', '{"done":true}');
    window.__prompts = [];
    if (ai) window.claude = { use: () => Promise.resolve((prompt, o) => { window.__prompts.push(prompt); return new Promise((ok) => { let i = 0; const t = setInterval(() => { i += 60; o && o.onText && o.onText({ text: ans.slice(0, i) }); if (i >= ans.length) { clearInterval(t); ok({ text: ans }); } }, 20); }); }) };
  }, [graph, ANSWER, withAi]);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
  await page.goto(URL); await page.waitForTimeout(1000);
  return { page, errors, ctx };
}

console.log('С ИИ');
{
  const { page, errors, ctx } = await open(true);
  await page.keyboard.press('Control+r'); await page.waitForTimeout(2500);
  check(await page.isVisible('#runErrs .ea'), 'под ошибкой — блок «ИИ-разбор»');
  await page.waitForFunction(() => document.querySelectorAll('#runErrs .ea-opt').length >= 2 && !document.querySelector('#runErrs .ea-spin'), null, { timeout: 8000 }).catch(() => {});
  check(/undefinedThing нигде не объявлена/.test(await page.textContent('#runErrs .ea-cause')), 'ИИ сам, без нажатия, назвал причину');
  check(await page.locator('#runErrs .ea-opt').count() === 2, 'и предложил варианты решения: ' + await page.locator('#runErrs .ea-opt').count());
  const pr = await page.evaluate(() => window.__prompts[0] || '');
  check(/undefinedThing \+ 1/.test(pr) && /Ошибка:/.test(pr), 'в запрос ушли код блока и текст ошибки');
  await page.locator('#runErrs .ea-opt').first().locator('button', { hasText: 'Показать код' }).click();
  check(await page.locator('#runErrs .ea-opt').first().locator('.ea-code').isVisible(), '«Показать код» раскрывает исправленный код');
  await page.locator('#runErrs .ea-opt').first().locator('button', { hasText: 'Применить' }).click(); await page.waitForTimeout(500);
  const code = await page.evaluate(() => JSON.parse(localStorage.getItem('triosteum.proj.p1')).nodes[0].codes.cpp);
  check(/int undefinedThing = 41/.test(code), '«Применить» меняет код блока');
  check(await page.isVisible('#runErrs .ea-ok'), 'вариант отмечен «Применено»');
  await page.locator('#runErrs button', { hasText: 'Запустить снова' }).click(); await page.waitForTimeout(2500);
  check(await page.locator('#runErrs .rb-err').count() === 0, 'после повторного запуска ошибок нет');
  check(errors.length === 0, 'ошибок JavaScript нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
console.log('Без ИИ');
{
  const { page, ctx } = await open(false);
  await page.keyboard.press('Control+r'); await page.waitForTimeout(2500);
  check(/Включите ИИ/.test(await page.textContent('#runErrs .ea')), 'подсказывает включить ИИ');
  await ctx.close();
}
await browser.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
