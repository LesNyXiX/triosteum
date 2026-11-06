// Доступность: axe-core по главным экранам (серьёзные и критичные нарушения WCAG 2.1 A/AA).
// Запуск: npm run build && node tests/a11y-e2e.mjs   (VERBOSE=1 — подробности)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects')) return;
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Схема', t: Date.now(), env: 'code' }, { id: 'p2', name: 'Бумаги', t: Date.now() - 1000, env: 'docs' }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [{ id: 'a', name: 'Блок', lang: 'python', x: 200, y: 160, codes: {}, pluginId: null, family: null, desc: '', colors: null }, { id: 'b', name: 'Второй', lang: 'python', x: 560, y: 200, codes: {}, pluginId: null, family: null, desc: '', colors: null }], edges: [{ id: 'e1', from: 'a', to: 'b' }], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
  localStorage.setItem('triosteum.tour', JSON.stringify({ done: true }));
});
const page = await ctx.newPage();
await page.goto(URL); await page.waitForTimeout(1000);
await page.addScriptTag({ content: AXE });
async function audit(name, include) {
  await page.waitForTimeout(350);
  const res = await page.evaluate(async (inc) => {
    const r = await window.axe.run(inc ? { include: [inc] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ') + ' — ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ')) }));
  }, include || null);
  check(res.length === 0, name + (res.length ? ': ' + res.map((v) => v.id + '×' + v.nodes.length).join(', ') : ''));
  if (res.length && process.env.VERBOSE) res.forEach((v) => { console.log('     ' + v.id + ' (' + v.impact + '): ' + v.help); v.nodes.forEach((n) => console.log('       · ' + n)); });
}
console.log('Экраны');
await audit('доска разработки');
await page.click('#bAdd'); await audit('меню добавления', '#addMenu'); await page.keyboard.press('Escape');
await page.click('#bLib'); await audit('библиотека плагинов', '#lib'); await page.click('#libClose');
await page.click('#setBtn'); await audit('персонализация', '#pers'); await page.click('#pers button[aria-label="Закрыть"]');
await page.click('#claudeMore'); await audit('выбор ИИ', '#claudeP'); await page.keyboard.press('Escape'); await page.mouse.click(700, 600);
await page.keyboard.press('Control+k'); await audit('поиск и команды', '.cmdk'); await page.keyboard.press('Escape');
await page.click('#bScheme'); await audit('целостный код схемы', '#schemeW'); await page.keyboard.press('Escape');
await page.locator('.node').first().dblclick(); await page.waitForTimeout(500); await audit('окно блока'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await page.keyboard.press('Control+k'); await page.keyboard.type('тур'); await page.keyboard.press('Enter'); await audit('тур', '.tour'); await page.keyboard.press('Escape');
await page.click('#ecoBtn'); await audit('экосистема (выбор среды)', '#eco');
await page.locator('#ecoGrid .eco-card.go', { hasText: 'Офис' }).locator('button', { hasText: 'Пример офиса' }).click(); await page.waitForTimeout(900);
await audit('офис: рабочий стол');
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
