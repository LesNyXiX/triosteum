// Хранение: копия в IndexedDB, переполнение localStorage, резервные копии, файл копии.
// Запуск: npm run build && node tests/storage-e2e.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';

// по http, как настоящий сайт: на file:// Chromium иногда теряет localStorage при перезагрузке
const HTML = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'index.html');
const srv = createServer((q, r) => { if (q.url === '/' || q.url.startsWith('/?')) { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(readFileSync(HTML)); } else { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const URL = 'http://127.0.0.1:' + srv.address().port + '/';
let failed = 0;
const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  if (localStorage.getItem('triosteum.projects') || sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('triosteum.projects', JSON.stringify({ cur: 'p1', list: [{ id: 'p1', name: 'Склад', t: Date.now() }] }));
  localStorage.setItem('triosteum.proj.p1', JSON.stringify({ nodes: [{ id: 'a', name: 'Блок', lang: 'python', x: 300, y: 200, codes: {}, pluginId: null, family: null, desc: '', colors: null }], edges: [], notes: [], cam: { x: 0, y: 0, k: 1 }, seq: 3 }));
  localStorage.setItem('triosteum.profile', JSON.stringify({ name: 'Тест', org: 'Завод' }));
  localStorage.setItem('triosteum.claude.key', 'sk-секрет-не-копировать');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { if (!/sandboxed/.test(e.message)) errors.push(e.message); });
await page.goto(URL); await page.waitForTimeout(1000);
const blocks = () => page.evaluate(() => (document.querySelector('.status')?.textContent.match(/Блоков: (\d+)/) || [])[1] | 0);
const idbKeys = () => page.evaluate(() => new Promise((res) => { const rq = indexedDB.open('triosteum'); rq.onsuccess = () => { const g = rq.result.transaction('kv').objectStore('kv').getAllKeys(); g.onsuccess = () => res(g.result); }; rq.onerror = () => res([]); }));
const addBlock = async () => { await page.locator('.node').last().click({ force: true }); await page.keyboard.press('Control+d'); await page.waitForTimeout(500); };

console.log('Копия в IndexedDB');
const k1 = await idbKeys();
check(k1.includes('triosteum.proj.p1') && k1.includes('triosteum.projects'), 'данные продублированы в IndexedDB');
check(!k1.includes('triosteum.claude.key'), 'ключ ИИ в копию не попал');
await addBlock();
check(await blocks() === 2, 'добавили блок — их 2');
await page.evaluate(() => { Object.keys(localStorage).filter((k) => k !== 'triosteum.claude.key').forEach((k) => localStorage.removeItem(k)); });
await page.reload(); await page.waitForTimeout(1200);
check(await blocks() === 2, 'localStorage очистили — после перезагрузки всё на месте из копии');
check(/Склад/.test(await page.textContent('#projName').catch(() => '')) || /Склад/.test(await page.textContent('body')), 'имя пространства тоже вернулось');

console.log('Переполнение localStorage');
await page.evaluate(() => { const s = 'x'.repeat(1024 * 1024); for (let i = 0; i < 12; i++) { try { localStorage.setItem('junk' + i, s); } catch (e) { break; } } });
await addBlock(); await page.waitForTimeout(400);
check(await blocks() === 3, 'места в localStorage нет, а блок добавился');
await page.reload(); await page.waitForTimeout(1200);
check(await blocks() === 3, 'после перезагрузки третий блок не потерялся (хранится в IndexedDB)');
await page.evaluate(() => { Object.keys(localStorage).filter((k) => /^junk/.test(k)).forEach((k) => localStorage.removeItem(k)); });

console.log('Резервные копии');
await page.click('#setBtn'); await page.waitForTimeout(400);
const bkBtn = page.locator('.bk-bar button', { hasText: 'Сделать копию сейчас' });
await bkBtn.scrollIntoViewIfNeeded(); await bkBtn.click(); await page.waitForTimeout(700);
check(await page.locator('.bk-row').count() >= 1, 'копия появилась в списке');
check(/3 простр|1 простр/.test(await page.textContent('.bk-row')), 'в строке видно, сколько пространств в копии');
// скачать файлом
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.bk-bar button:has-text("Скачать всё файлом")')]);
const tmp = mkdtempSync(join(tmpdir(), 'tsbk-')), fp = join(tmp, 'copy.json'); await dl.saveAs(fp);
const file = JSON.parse(readFileSync(fp, 'utf8'));
check(file.app === 'triosteum' && file.kind === 'backup' && file.data['triosteum.proj.p1'], 'файл копии содержит пространства');
check(!JSON.stringify(file).includes('sk-секрет'), 'в файле копии нет ключа ИИ');
// изменили — вернули из копии
await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(400);
await page.locator('.node').last().click({ force: true }); await page.keyboard.press('Delete'); await page.waitForTimeout(400);
check(await blocks() === 2, 'удалили блок — их 2');
await page.click('#setBtn'); await page.waitForTimeout(500);
const back = page.locator('.bk-row', { hasText: 'Вручную' }).locator('button', { hasText: 'Вернуть' }).first();
await back.scrollIntoViewIfNeeded(); await back.click(); await page.waitForTimeout(300);
await page.click('#askYes'); await page.waitForTimeout(2500);
check(await blocks() === 3, 'вернули копию — снова 3 блока');
await page.click('#setBtn'); await page.waitForTimeout(700);
check(await page.locator('.bk-row', { hasText: 'Перед восстановлением' }).count() >= 1, 'перед возвратом снялась копия «Перед восстановлением»');
// загрузка из файла: файл с одним пространством
file.data['triosteum.proj.p1'].nodes = file.data['triosteum.proj.p1'].nodes.slice(0, 1);
writeFileSync(fp, JSON.stringify(file));
const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('.bk-bar button:has-text("Загрузить из файла")')]);
await fc.setFiles(fp); await page.waitForTimeout(400); await page.click('#askYes'); await page.waitForTimeout(2500);
check(await blocks() === 1, 'данные загружены из файла — 1 блок');
check(await page.evaluate(() => localStorage.getItem('triosteum.claude.key')) === 'sk-секрет-не-копировать', 'ключ ИИ после восстановления остался на месте');

console.log('Перед очисткой');
await page.click('#setBtn'); await page.waitForTimeout(500);
const n0 = await page.locator('.bk-row').count();
const clr = page.locator('.clr-grid button', { hasText: 'Очистить доску' }); await clr.scrollIntoViewIfNeeded(); await clr.click(); await page.waitForTimeout(300);
await page.click('#askYes'); await page.waitForTimeout(900);
await page.click('#pers button[aria-label="Закрыть"]'); await page.waitForTimeout(300); await page.click('#setBtn'); await page.waitForTimeout(700);
check(await page.locator('.bk-row', { hasText: 'Перед очисткой' }).count() >= 1 && await page.locator('.bk-row').count() > n0, 'очистка доски сначала сняла копию');

console.log('Ошибки');
check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); srv.close();
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло');
process.exit(failed ? 1 : 0);
