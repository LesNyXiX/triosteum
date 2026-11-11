// Проверка приложения Triosteum для Windows (запускается и на Linux): стартовый экран, режим без интернета
// с сохранением данных между запусками, режим сервера, недоступный сервер, переключение режима и Ollama без OLLAMA_ORIGINS.
// Запуск: npm test (в Linux без экрана — через xvfb-run).
import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const data = mkdtempSync(join(tmpdir(), 'triosteum-desktop-'));
const ELECTRON = createRequire(import.meta.url)('electron');   // путь к Electron из desktop/node_modules
const launch = () => electron.launch({ executablePath: ELECTRON, args: [HERE, '--no-sandbox'], env: { ...process.env, TRIOSTEUM_USER_DATA: data } });
const listen = (srv, port) => new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv.address().port)));

// «сервер организации» и «Ollama», которая, как настоящая, отказывает запросам с чужим Origin
const site = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!DOCTYPE html><title>Сервер</title><h1 id="srv">Triosteum на сервере</h1><a id="ext" href="https://example.com/">внешняя</a>');
});
const ollama = createServer((req, res) => {
  if (req.headers.origin) { res.writeHead(403); res.end('forbidden origin'); return; }
  if (req.method === 'OPTIONS') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ models: [{ name: 'qwen2.5:1.5b' }] }));
});
const sitePort = await listen(site, 0);
let ollamaUp = true;
try { await listen(ollama, 11434); } catch { ollamaUp = false; }

console.log('Стартовый экран');
let app = await launch();
let w = await app.firstWindow();
await w.waitForSelector('#goServer');
ok(/режим работы/.test(await w.title()), 'при первом запуске — выбор режима');
ok((await w.inputValue('#server')) === 'https://triosteum.ru', 'адрес сервера по умолчанию — triosteum.ru');
ok(/Версия \d/.test(await w.textContent('#ver')), 'видна версия приложения');

console.log('Без интернета');
await w.check('#remember');
await w.click('#goOffline');
await w.waitForURL('triosteum://app/index.html');
await w.waitForSelector('#canvas', { timeout: 20000 });
ok(true, 'встроенная копия Triosteum открылась (доска на месте)');
await w.evaluate(() => localStorage.setItem('desktop-test', 'сохранено'));
if (ollamaUp) {
  const r = await w.evaluate(() => fetch('http://localhost:11434/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then((x) => x.json()).then((d) => d.models[0].name, (e) => 'ошибка: ' + e.message));
  ok(r === 'qwen2.5:1.5b', 'Ollama на компьютере отвечает без настройки OLLAMA_ORIGINS (' + r + ')');
} else ok(true, 'порт 11434 занят — проверка Ollama пропущена');
await app.close();

app = await launch();
w = await app.firstWindow();
await w.waitForURL('triosteum://app/index.html');
await w.waitForSelector('#canvas', { timeout: 20000 });
ok((await w.evaluate(() => localStorage.getItem('desktop-test'))) === 'сохранено', 'выбор запомнен, данные пережили перезапуск');

console.log('Сервер организации');
await w.keyboard.press('Escape');
await w.evaluate(() => document.getElementById('projBtn').click()); await w.waitForTimeout(300);
const item = w.locator('text=Режим работы приложения…');
ok(await item.count() === 1, 'в меню Triosteum есть «Режим работы приложения…»');
await item.evaluate((el) => el.closest('button').click());
await w.waitForSelector('#goServer');
ok(await w.locator('#cOffline.on').count() === 1, 'смена режима — снова стартовый экран, прошлый выбор отмечен');
await w.fill('#server', 'http://127.0.0.1:' + sitePort);
await w.click('#goServer');
await w.waitForSelector('#srv');
ok(true, 'страница сервера открылась в окне приложения');
ok((await w.evaluate(() => window.triosteumDesktop && typeof window.triosteumDesktop.choose)) === 'function', 'мост приложения доступен странице');
ok((await w.evaluate(() => window.triosteumDesktop.settings())) === null, 'настройки приложения странице сервера не отдаются');
await w.click('#ext', { noWaitAfter: true }); await w.waitForTimeout(800);
ok(w.url().startsWith('http://127.0.0.1:' + sitePort), 'внешняя ссылка не уводит окно приложения');

console.log('Сервер недоступен');
await w.evaluate(() => window.triosteumDesktop.switchMode());
await w.waitForSelector('#goServer');
await w.fill('#server', 'http://127.0.0.1:1');
await w.click('#goServer');
await w.waitForSelector('#msg:not([hidden])', { timeout: 15000 });
ok(/не открылся/.test(await w.textContent('#msg')), 'недоступный сервер — понятная причина на стартовом экране');
await w.fill('#server', 'ftp://x');
await w.click('#goServer'); await w.waitForTimeout(300);
ok(/неверный/.test(await w.textContent('#msg')), 'неверный адрес сервера — сообщение, а не падение');
// внешняя ссылка запустила в системе браузер — он может держать процесс; закрываем с запасом
await Promise.race([app.close(), new Promise((r) => setTimeout(r, 5000))]);
try { app.process().kill('SIGKILL'); } catch {}

site.close(); ollama.close();
rmSync(data, { recursive: true, force: true });
console.log(fail ? `\nПровалено: ${fail}` : '\nВсё прошло');
process.exit(fail ? 1 : 0);
