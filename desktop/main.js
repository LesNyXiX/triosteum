// Triosteum для Windows: окно приложения с двумя режимами.
//   • Сервер организации — открывает Triosteum с сервера (по умолчанию https://triosteum.ru): вход, команда, Infinitum.
//   • Без интернета — встроенная копия Triosteum, данные хранятся на этом компьютере.
// Режим выбирается на стартовом экране; «Режим работы…» (Ctrl+Shift+M) возвращает к выбору.
'use strict';
const { app, BrowserWindow, Menu, shell, ipcMain, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DEFAULT_SERVER = 'https://triosteum.ru';
const WEB_DIR = path.join(__dirname, 'web');          // встроенная копия сайта (готовит prepare.mjs)
const OFFLINE_URL = 'triosteum://app/index.html';
const OLLAMA = /^http:\/\/(localhost|127\.0\.0\.1):11434\//;

// своя схема для автономного режима: постоянный адрес — значит, данные в localStorage не теряются между запусками
protocol.registerSchemesAsPrivileged([{ scheme: 'triosteum', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
// страница с сервера обращается к Ollama на этом компьютере — браузерная защита локальной сети здесь не нужна
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,LocalNetworkAccessChecks');

// для автотестов: отдельная папка настроек и данных
if (process.env.TRIOSTEUM_USER_DATA) app.setPath('userData', process.env.TRIOSTEUM_USER_DATA);

let win = null;
let cfg = {};
const cfgFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadCfg() { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) || {}; } catch { return {}; } }
function saveCfg() {
  try { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); } catch {}
}
function serverOrigin() { try { return new URL(cfg.server || DEFAULT_SERVER).origin; } catch { return DEFAULT_SERVER; } }
function normServer(s) {
  let v = String(s || '').trim() || DEFAULT_SERVER;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && !/^https?:\/\//i.test(v)) throw new Error('нужен адрес http:// или https://');
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  const u = new URL(v);                                 // бросит ошибку на кривом адресе
  if (!/^https?:$/.test(u.protocol)) throw new Error('Нужен адрес http:// или https://');
  return u.origin;
}
// своё ли это окно Triosteum: встроенная копия или выбранный сервер
function isOwn(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'triosteum:' || u.protocol === 'file:' || u.protocol === 'about:' || u.protocol === 'blob:' || u.protocol === 'data:') return true;
    return cfg.mode === 'server' && u.origin === serverOrigin();
  } catch { return false; }
}

function openLauncher(msg) {
  win.loadFile(path.join(__dirname, 'launcher.html'), { query: msg ? { msg } : {} });
}
function openMode() {
  if (cfg.mode === 'offline') { win.loadURL(OFFLINE_URL); return; }
  if (cfg.mode === 'server') { win.loadURL(serverOrigin() + '/').catch(() => {}); return; }
  openLauncher();
}

function buildMenu() {
  const tpl = [
    { label: 'Triosteum', submenu: [
      { label: 'Режим работы…', accelerator: 'CmdOrCtrl+Shift+M', click: () => openLauncher() },
      { label: 'Обновить страницу', accelerator: 'F5', click: () => win && win.webContents.reload() },
      { label: 'Открыть в браузере', click: () => { if (cfg.mode === 'server') shell.openExternal(serverOrigin() + '/'); } },
      { type: 'separator' },
      { label: 'Проверить обновления', click: () => checkUpdates(true) },
      { type: 'separator' },
      { label: 'Выход', role: 'quit' }
    ] },
    { label: 'Вид', submenu: [
      { label: 'Полный экран', role: 'togglefullscreen' },
      { label: 'Крупнее', role: 'zoomIn' },
      { label: 'Мельче', role: 'zoomOut' },
      { label: 'Обычный масштаб', role: 'resetZoom' },
      { type: 'separator' },
      { label: 'Инструменты разработчика', role: 'toggleDevTools' }
    ] },
    { label: 'Справка', submenu: [
      { label: 'Сайт Triosteum', click: () => shell.openExternal(DEFAULT_SERVER) },
      { label: 'О программе', click: () => dialog.showMessageBox(win, { type: 'info', title: 'О программе', message: 'Triosteum ' + app.getVersion(),
        detail: 'Экосистема для производств: доска блоков кода, офис, отраслевые среды.\n\nРежим: ' + (cfg.mode === 'offline' ? 'без интернета' : cfg.mode === 'server' ? 'сервер ' + serverOrigin() : 'не выбран') }) }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// Ollama на этом компьютере отвечает приложению без настройки OLLAMA_ORIGINS — но только страницам самого Triosteum
// (встроенная копия или выбранный сервер). Изолированный предпросмотр (Origin: null) и посторонние страницы
// получают обычную защиту Ollama. Удалять модели через это разрешение нельзя.
function trustedOrigin(origin) {
  if (!origin || origin === 'null') return '';
  if (origin === 'triosteum://app') return origin;
  return cfg.mode === 'server' && origin === serverOrigin() ? origin : '';
}
function allowLocalOllama(ses) {
  const filter = { urls: ['http://localhost:11434/*', 'http://127.0.0.1:11434/*'] };
  const allowed = new Map();                         // id запроса → доверенный Origin
  ses.webRequest.onBeforeSendHeaders(filter, (d, cb) => {
    const h = { ...d.requestHeaders };
    const key = Object.keys(h).find((k) => k.toLowerCase() === 'origin');
    const origin = trustedOrigin(key ? h[key] : '');
    if (!origin || d.method === 'DELETE') return cb({ requestHeaders: h });
    allowed.set(d.id, origin);
    delete h[key];
    cb({ requestHeaders: h });
  });
  ses.webRequest.onHeadersReceived(filter, (d, cb) => {
    const origin = allowed.get(d.id);
    allowed.delete(d.id);
    if (!origin || !OLLAMA.test(d.url)) return cb({});
    const h = { ...d.responseHeaders };
    for (const k of Object.keys(h)) if (/^access-control-/i.test(k)) delete h[k];
    h['Access-Control-Allow-Origin'] = [origin];
    h['Access-Control-Allow-Headers'] = ['Content-Type, Authorization'];
    h['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
    h['Access-Control-Allow-Private-Network'] = ['true'];
    h['Vary'] = ['Origin'];
    cb(d.method === 'OPTIONS' ? { responseHeaders: h, statusLine: 'HTTP/1.1 204 No Content' } : { responseHeaders: h });
  });
  ses.webRequest.onErrorOccurred(filter, (d) => allowed.delete(d.id));
}

function createWindow() {
  const b = cfg.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1440, height: b.height || 900, x: b.x, y: b.y, minWidth: 960, minHeight: 600,
    title: 'Triosteum', backgroundColor: '#14090C', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  if (cfg.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  const remember = () => { if (!win.isMaximized() && !win.isMinimized()) cfg.bounds = win.getBounds(); cfg.maximized = win.isMaximized(); saveCfg(); };
  win.on('close', remember);

  const wc = win.webContents;
  // чужие ссылки — в обычном браузере; свои всплывающие окна (печать, предпросмотр) — внутри приложения
  wc.setWindowOpenHandler(({ url }) => {
    if (isOwn(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, 'build', 'icon.png') } };
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (isOwn(url)) return;
    e.preventDefault();
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
  });
  // сервер недоступен — возвращаемся к выбору режима с понятной причиной
  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3 || cfg.mode !== 'server') return;      // -3 — переход отменён, это не ошибка
    if (!String(url).startsWith(serverOrigin())) return;
    openLauncher('Сервер ' + serverOrigin() + ' не открылся (' + desc + '). Проверьте интернет или выберите режим без интернета.');
  });
  openMode();
}

// ---- обращения стартового экрана ----
function fromLauncher(e) { try { return new URL(e.senderFrame.url).protocol === 'file:'; } catch { return false; } }
ipcMain.handle('desktop:settings', (e) => fromLauncher(e) ? { mode: cfg.mode || '', server: cfg.server || DEFAULT_SERVER, remember: cfg.remember !== false, version: app.getVersion() } : null);
ipcMain.handle('desktop:choose', (e, a) => {
  if (!fromLauncher(e)) return { ok: false };
  const mode = a && a.mode === 'offline' ? 'offline' : 'server';
  if (mode === 'server') {
    try { cfg.server = normServer(a.server); } catch (err) { return { ok: false, error: 'Адрес сервера неверный: ' + err.message }; }
  }
  if (mode === 'offline' && !fs.existsSync(path.join(WEB_DIR, 'index.html'))) return { ok: false, error: 'Встроенная копия Triosteum не найдена — переустановите приложение.' };
  cfg.mode = mode; cfg.remember = !!(a && a.remember); saveCfg();
  buildMenu(); openMode();
  return { ok: true };
});
ipcMain.on('desktop:switch', () => { if (win) openLauncher(); });

// ---- обновления: новые версии публикуются в GitHub Releases ----
let updater = null;
function checkUpdates(manual) {
  if (!app.isPackaged) { if (manual) dialog.showMessageBox(win, { message: 'Обновления проверяются только в установленном приложении.' }); return; }
  try {
    if (!updater) {
      updater = require('electron-updater').autoUpdater;
      updater.autoDownload = true;
      updater.on('update-downloaded', (info) => {
        dialog.showMessageBox(win, { type: 'info', buttons: ['Перезапустить сейчас', 'Позже'], defaultId: 0, cancelId: 1,
          title: 'Обновление Triosteum', message: 'Скачана версия ' + info.version + '.', detail: 'Перезапустить приложение, чтобы установить её?' })
          .then((r) => { if (r.response === 0) updater.quitAndInstall(); });
      });
    }
    const p = updater.checkForUpdates();
    if (manual) p.then((r) => {
      const v = r && r.updateInfo && r.updateInfo.version;
      if (!v || v === app.getVersion()) dialog.showMessageBox(win, { message: 'У вас последняя версия Triosteum (' + app.getVersion() + ').' });
      else dialog.showMessageBox(win, { message: 'Нашлась версия ' + v + ' — скачиваю, сообщу, когда будет готова.' });
    }, (err) => dialog.showMessageBox(win, { type: 'warning', message: 'Не удалось проверить обновления', detail: String(err && err.message || err) }));
    else p.catch(() => {});
  } catch (err) {
    if (manual) dialog.showMessageBox(win, { type: 'warning', message: 'Не удалось проверить обновления', detail: String(err && err.message || err) });
  }
}

// ---- запуск ----
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    cfg = loadCfg();
    protocol.handle('triosteum', (req) => {
      const u = new URL(req.url);
      let p = decodeURIComponent(u.pathname);
      if (!p || p === '/') p = '/index.html';
      const file = path.normalize(path.join(WEB_DIR, p));
      if (!file.startsWith(WEB_DIR + path.sep)) return new Response('Нет доступа', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    allowLocalOllama(session.defaultSession);
    buildMenu();
    // без «Запомнить выбор» — каждый раз стартовый экран (прошлый выбор на нём уже отмечен)
    if (!cfg.remember) { const keep = cfg.mode; cfg.mode = ''; createWindow(); cfg.mode = keep; }
    else createWindow();
    setTimeout(() => checkUpdates(false), 8000);
  });
  app.on('window-all-closed', () => app.quit());
}
