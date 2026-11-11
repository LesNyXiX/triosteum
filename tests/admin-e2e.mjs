// Панель администратора сервера в браузере: первый пользователь — администратор, регистрация по приглашению,
// приглашения (новая организация и вход в существующую), отключение пользователя, закрытие доступа,
// точки восстановления и отмена из журнала.
// Запуск на чистой базе: TRIOSTEUM_URL=http://127.0.0.1:8000 node tests/admin-e2e.mjs  (SHOTS=папка — снимки разделов)
import { chromium } from 'playwright';
const B = process.env.TRIOSTEUM_URL || 'http://127.0.0.1:8000';
const SHOTS = process.env.SHOTS || '';
const T = Date.now();
const b = await chromium.launch(); const errs = []; let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const api = (p, method, path, body) => p.evaluate(async ([m, u, bd]) => { const r = await fetch('/api' + u, { method: m, headers: { 'Content-Type': 'application/json' }, body: bd ? JSON.stringify(bd) : undefined }); return { status: r.status, data: await r.json().catch(() => null) }; }, [method, path, body]);
async function tab(p, name) { await p.click(`.adm-nav button:has-text("${name}")`); await p.waitForTimeout(500); }

console.log('Первый пользователь становится администратором');
const a = await page();
await a.goto(B + '/login');
await a.click('#tReg'); await a.fill('#org', 'Головной завод'); await a.fill('#name', 'Даниил'); await a.fill('#email', `boss${T}@zavod.ru`);
await a.fill('#pw', 'password123'); await a.check('#pd'); await a.click('#go'); await a.waitForURL(B + '/'); await a.waitForTimeout(900);
ok(await a.evaluate(() => window.TRIOSTEUM_BOOT.user.is_admin === true), 'в данных страницы is_admin = true');
await a.click('#projBtn'); await a.waitForTimeout(300);
ok(await a.locator('text=Панель администратора…').count() === 1, 'в меню аккаунта есть «Панель администратора…»');
await a.click('text=Панель администратора…'); await a.waitForTimeout(900);
ok(await a.locator('#admW').isVisible(), 'панель открылась');
ok(await a.locator('.adm-tile').count() === 6 && await a.locator('.adm-chart rect').count() > 0, 'обзор: 6 плиток и график активности');
ok(/по приглашению/.test(await a.textContent('#admPills')), 'по умолчанию регистрация по приглашению');
await shot(a, '1-overview');

console.log('Без приглашения новую организацию не создать');
const g = await page();
await g.goto(B + '/login'); await g.waitForTimeout(600);
ok(await g.locator('#tReg').isHidden() && await g.locator('#regHint').isVisible(), 'вкладка «Новая организация» скрыта, есть подсказка');
const direct = await g.evaluate(async (e) => (await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: 'X', email: e, password: 'password123', pd_consent: true }) })).status, `x${T}@zavod.ru`);
ok(direct === 403, 'API регистрации без приглашения отвечает 403');

console.log('Приглашение: новая организация');
await tab(a, 'Приглашения');
await a.fill('input[aria-label="Подпись"]', 'Для Пети');
await a.click('button:has-text("Создать ссылку")'); await a.waitForTimeout(700);
const orgLink = await a.inputValue('.adm-link input');
ok(/\/join\?t=/.test(orgLink), 'ссылка показана: ' + orgLink.replace(/t=.*/, 't=…'));
ok(await a.locator('.adm-irow:has-text("Для Пети") .adm-badge:has-text("действует")').count() === 1, 'ссылка в списке со статусом «действует»');
await shot(a, '2-invites');
await g.goto(orgLink); await g.waitForTimeout(700);
ok(/Новая организация/.test(await g.textContent('#title')), 'страница приглашения: «Новая организация»');
await g.fill('#org', 'Цех Пети'); await g.fill('#name', 'Петя'); await g.fill('#email', `petya${T}@zavod.ru`); await g.fill('#pw', 'password123'); await g.check('#pd');
await g.click('#go'); await g.waitForURL(B + '/'); await g.waitForTimeout(700);
ok(await g.evaluate(() => window.TRIOSTEUM_BOOT.org.name === 'Цех Пети' && window.TRIOSTEUM_BOOT.role === 'owner' && !window.TRIOSTEUM_BOOT.user.is_admin), 'Петя создал организацию и владеет ею, но не администратор сервера');
const g2 = await page(); await g2.goto(orgLink); await g2.waitForTimeout(600);
ok(/недействительно/.test(await g2.textContent('#sub')), 'одноразовая ссылка второй раз не работает');

console.log('Приглашение: вход в существующую организацию');
await a.click('.adm-seg.big button:has-text("В существующую организацию")'); await a.waitForTimeout(500);
await a.selectOption('select[aria-label="Роль"]', 'viewer');
await a.fill('input[aria-label="Подпись"]', 'Для Оли');
await a.click('button:has-text("Создать ссылку")'); await a.waitForTimeout(700);
const memLink = await a.inputValue('.adm-link input');
const o = await page(); await o.goto(memLink); await o.waitForTimeout(700);
ok(/Присоединиться к «Головной завод»/.test(await o.textContent('#title')), 'страница приглашения: «Присоединиться к «Головной завод»»');
await o.fill('#name', 'Оля'); await o.fill('#email', `olya${T}@zavod.ru`); await o.fill('#pw', 'password123'); await o.check('#pd');
await o.click('#go'); await o.waitForURL(B + '/'); await o.waitForTimeout(700);
ok(await o.evaluate(() => window.TRIOSTEUM_BOOT.org.name === 'Головной завод' && window.TRIOSTEUM_BOOT.role === 'viewer'), 'Оля вошла в «Головной завод» наблюдателем');

console.log('Пользователи: отключить и отменить');
await tab(a, 'Пользователи');
ok(await a.locator('.adm-urow').count() === 3, 'в списке трое');
await shot(a, '3-users');
await a.click('.adm-urow:has-text("Петя") button:has-text("Отключить вход")'); await a.waitForTimeout(800);
ok(await a.locator('.adm-urow:has-text("Петя") .adm-badge:has-text("вход отключён")').count() === 1, 'у Пети пометка «вход отключён»');
ok((await api(g, 'GET', '/me')).status === 401, 'Петя сразу потерял доступ');
ok(/Отменить/.test(await a.textContent('#toast')), 'в уведомлении есть «Отменить»');
await a.click('#toast button:has-text("Отменить")'); await a.waitForTimeout(900);
ok(await a.locator('.adm-urow:has-text("Петя") .adm-badge:has-text("вход отключён")').count() === 0, 'отмена из уведомления вернула вход');
await a.fill('input[aria-label="Поиск пользователей"]', 'оля'); await a.waitForTimeout(400);
ok(await a.locator('.adm-urow').count() === 1, 'поиск находит Олю');

console.log('Доступ: закрыть всем, кроме администратора');
await tab(a, 'Доступ');
await a.fill('input[aria-label="Причина закрытия"]', 'обновление до 18:00');
await a.click('.adm-switch'); await a.waitForTimeout(900);
ok(await a.locator('.adm-gate.closed').count() === 1 && /Доступ закрыт/.test(await a.textContent('#admPills')), 'панель показывает «закрыто»');
await shot(a, '4-access');
await o.reload(); await o.waitForTimeout(800);
ok(/\/login\?closed=1/.test(o.url()) && /обновление до 18:00/.test(await o.textContent('#closedNote')), 'Оля видит страницу входа с причиной');
ok((await api(a, 'GET', '/me')).status === 200, 'администратор работает как обычно');
await a.click('.adm-switch'); await a.waitForTimeout(900);
await o.goto(B + '/'); await o.waitForTimeout(700);
ok(new URL(o.url()).pathname === '/', 'после открытия Оля снова в приложении');

console.log('Точки восстановления');
const sid = await a.evaluate(() => window.TRIOSTEUM_BOOT.cur || (window.TRIOSTEUM_BOOT.spaces[0] || {}).id);
await api(a, 'PUT', '/spaces/adm1', { name: 'Цех 1', content: { nodes: [], v: 1 }, base_rev: 0 });
await tab(a, 'Точки восстановления');
await a.fill('input[aria-label="Название точки"]', 'Перед экспериментом'); await a.click('button:has-text("Сохранить точку")'); await a.waitForTimeout(900);
ok(await a.locator('.adm-tl-p:has-text("Перед экспериментом")').count() === 1, 'точка на таймлайне');
const rev = (await api(a, 'GET', '/spaces/adm1')).data.rev;
await api(a, 'PUT', '/spaces/adm1', { name: 'Цех 1', content: { nodes: [], v: 2 }, base_rev: rev });
const btn = await a.$('.adm-tl-p:has-text("Перед экспериментом") button:has-text("Вернуться к этой точке")');
await btn.click(); await a.waitForTimeout(200);
ok((await btn.textContent()) === 'Точно?', 'возврат к точке просит подтверждения');
await btn.click(); await a.waitForTimeout(1500);
ok((await api(a, 'GET', '/spaces/adm1')).data.content.v === 1, 'пространство вернулось к точке (v = 1)');
ok(await a.locator('.adm-tl-p.auto:has-text("Перед восстановлением")').count() === 1, 'сервер сам сохранил точку «Перед восстановлением»');
await shot(a, '5-points');

console.log('Журнал и отмена');
await tab(a, 'Журнал и отмена');
ok(await a.locator('.adm-lrow').count() >= 6, 'в журнале записаны действия');
await shot(a, '6-log');
await a.click('.adm-lrow:has-text("Восстановлена точка") button:has-text("Отменить")'); await a.waitForTimeout(1500);
ok((await api(a, 'GET', '/spaces/adm1')).data.content.v === 2, 'отмена восстановления вернула v = 2');
await tab(a, 'Журнал и отмена');
ok(await a.locator('.adm-lrow.undone:has-text("Восстановлена точка")').count() === 1, 'отменённое действие приглушено');
ok(await a.locator('.adm-lrow:has-text("Отмена: Восстановлена точка") button:has-text("Отменить")').count() === 1, 'отмену можно вернуть');

console.log('Кнопка в шапке и горячая клавиша');
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
ok(!(await a.locator('#admW').isVisible()), 'Esc закрыл панель');
ok(await a.locator('#admBtn').isVisible(), 'у администратора в шапке есть кнопка панели');
await a.click('#admBtn'); await a.waitForTimeout(700);
ok(await a.locator('#admW').isVisible() && (await a.getAttribute('#admBtn', 'aria-pressed')) === 'true', 'кнопка открывает панель и подсвечена');
ok((await a.textContent('#admKey .key-set')).trim() === '—', 'по умолчанию клавиши нет');
await a.click('#admKey .key-set'); await a.waitForTimeout(150);
await a.keyboard.press('Control+KeyM'); await a.waitForTimeout(300);
ok((await a.textContent('#admKey .key-set')).trim() === 'Ctrl+M', 'клавишу задали прямо в шапке панели: Ctrl+M');
ok(/Ctrl\+M/.test(await a.getAttribute('#admBtn', 'title')), 'клавиша видна в подсказке кнопки');
ok(await a.locator('#admW').isVisible(), 'выбор клавиши не закрыл панель');
await a.keyboard.press('Control+KeyM'); await a.waitForTimeout(300);
ok(!(await a.locator('#admW').isVisible()), 'та же клавиша закрывает панель');
await a.keyboard.press('Control+KeyM'); await a.waitForTimeout(700);
ok(await a.locator('#admW').isVisible(), 'и открывает снова');
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
await a.reload(); await a.waitForTimeout(1200);
await a.keyboard.press('Control+KeyM'); await a.waitForTimeout(700);
ok(await a.locator('#admW').isVisible(), 'клавиша сохраняется после перезагрузки');
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
await a.click('#setBtn'); await a.waitForTimeout(500);
const persRow = a.locator('#persBody .tgl:has-text("Панель администратора")');
ok(await persRow.count() === 1 && /Ctrl\+M/.test(await persRow.textContent()), 'в Настройках есть строка панели с её клавишей');
await persRow.locator('.key-set').click(); await a.waitForTimeout(150);
await a.keyboard.press('F9'); await a.waitForTimeout(300);
ok(/F9/.test(await a.locator('#persBody .tgl:has-text("Панель администратора")').textContent()), 'клавишу можно сменить в Настройках (F9)');
await a.click('#persClose'); await a.waitForTimeout(300);
await a.keyboard.press('F9'); await a.waitForTimeout(700);
ok(await a.locator('#admW').isVisible(), 'F9 открывает панель');
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
await shot(a, '7-header-button');

console.log('Задачи для ИИ');
await a.click('#admBtn'); await a.waitForTimeout(600);
await tab(a, 'Задачи для ИИ'); await a.waitForTimeout(400);
ok(await a.locator('.ag-steps li').count() === 4, 'без токена — инструкция подключения из 4 шагов');
// дальше GitHub подменён в браузере: проверяем окно, а не сеть
const AG = { tasks: [], msgs: {}, sent: [] };
await a.route(/\/api\/admin\/agents(\/.*)?$/, async (route) => {
  const req = route.request(), u = new URL(req.url()), m = u.pathname.match(/agents(?:\/(\d+))?(?:\/(messages|state))?$/);
  const body = req.postData() ? JSON.parse(req.postData()) : null, json = (st, d) => route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(d) });
  if (req.method() === 'GET' && !m[1]) return json(200, { configured: true, repo: 'LesNyXiX/triosteum', tasks: AG.tasks });
  if (req.method() === 'POST' && !m[1]) {
    AG.sent.push(body); const n = AG.tasks.length + 7;
    const t = { number: n, title: body.text.split('\n')[0], state: 'open', url: 'https://github.com/x/y/issues/' + n, comments: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    AG.tasks.unshift(t);
    AG.msgs[n] = [{ id: 'i', who: 'owner', to: ['claude', 'codex'].filter((k) => body[k]), text: body.text, at: t.created_at, edited: t.created_at, url: t.url }];
    return json(201, t);
  }
  const n = +m[1], t = AG.tasks.find((x) => x.number === n);
  if (m[2] === 'messages') { AG.sent.push(body); AG.msgs[n].push({ id: Math.random(), who: 'owner', to: ['claude', 'codex'].filter((k) => body[k]), text: body.text, at: new Date().toISOString() }); return json(201, { ok: true }); }
  if (m[2] === 'state') { t.state = body.open ? 'open' : 'closed'; return json(200, t); }
  return json(200, { ...t, messages: AG.msgs[n], prs: AG.msgs[n].some((x) => /pull\/41/.test(x.text)) ? [{ number: 41, url: 'https://github.com/x/y/pull/41' }] : [] });
});
await tab(a, 'Обзор'); await tab(a, 'Задачи для ИИ'); await a.waitForTimeout(400);
ok(await a.locator('.ag-comp textarea').isVisible(), 'с токеном — поле новой задачи');
ok((await a.getAttribute('.ag-chip.claude', 'aria-pressed')) === 'true' && (await a.getAttribute('.ag-chip.codex', 'aria-pressed')) === 'true', 'по умолчанию задача обоим');
await a.click('.ag-comp button:has-text("Отправить")'); await a.waitForTimeout(200);
ok(AG.sent.length === 0, 'пустую задачу не отправляет');
await a.fill('.ag-comp textarea', 'Добавь фильтр по поставщику\nи тест к нему');
await a.keyboard.press('Control+Enter'); await a.waitForTimeout(900);
ok(AG.sent[0] && AG.sent[0].claude === true && AG.sent[0].codex === true && /поставщику/.test(AG.sent[0].text), 'Ctrl+Enter отправил задачу обоим');
ok(await a.locator('.ag-it.on:has-text("Добавь фильтр по поставщику")').count() === 1, 'задача появилась в списке и открыта');
ok(/Claude и Codex/.test(await a.textContent('.ag-msg.owner .ag-tob')), 'в ленте видно, кому отправлено');
ok(await a.locator('.ag-wait').isVisible(), 'пока нет ответа — «Ждём ответ»');
// пришли ответы ботов
AG.msgs[7].push({ id: 2, who: 'claude', to: [], text: '**Готово.** Сделал PR: https://github.com/x/y/pull/41\n```\nnpm test — ок\n```', at: new Date().toISOString() });
AG.msgs[7].push({ id: 3, who: 'codex', to: [], text: 'Взял в работу <img src=x onerror="window.__xss=1">', at: new Date().toISOString() });
await a.click('.ag-it:has-text("Добавь фильтр")'); await a.waitForTimeout(700);
ok(await a.locator('.ag-msg.claude b:has-text("Готово.")').count() === 1 && await a.locator('.ag-msg.claude pre').count() === 1, 'ответ Claude: жирный текст и блок кода');
ok(await a.locator('.ag-msg.codex').count() === 1 && !(await a.evaluate(() => window.__xss)), 'ответ Codex показан, HTML из ответа не выполняется');
ok(await a.locator('.ag-pr:has-text("PR #41")').count() === 1, 'ссылка на PR из ответа — вверху');
await a.click('.ag-chip.codex'); await a.click('.ag-chip.claude');
await a.fill('.ag-main .ag-comp textarea', 'Codex, добавь ещё проверку');
await a.click('.ag-main .ag-comp button:has-text("Отправить")'); await a.waitForTimeout(700);
ok(AG.sent[1] && AG.sent[1].codex === true && AG.sent[1].claude === false, 'уточнение ушло только Codex');
ok(await a.locator('.ag-msg.owner:has-text("Codex, добавь ещё проверку")').count() === 1 && (await a.inputValue('.ag-main .ag-comp textarea')) === '', 'уточнение в ленте, поле очищено');
await a.click('.ag-head button:has-text("Закрыть задачу")'); await a.waitForTimeout(700);
ok(await a.locator('.ag-it.closed').count() === 1, 'задачу можно закрыть');
await shot(a, '8-agents');
await a.unroute(/\/api\/admin\/agents(\/.*)?$/);
await a.keyboard.press('Escape'); await a.waitForTimeout(300);

console.log('Не администратор панель не видит');
ok(!(await o.locator('#admBtn').isVisible()), 'у Оли в шапке нет кнопки панели');
await o.click('#setBtn'); await o.waitForTimeout(400);
ok(await o.locator('#persBody .tgl:has-text("Панель администратора")').count() === 0, 'и нет строки в Настройках');
await o.click('#persClose'); await o.waitForTimeout(200);
await o.keyboard.press('Control+KeyM'); await o.waitForTimeout(300);
ok(await o.locator('#admW').count() === 0, 'чужая клавиша панель не открывает');
await o.click('#projBtn'); await o.waitForTimeout(300);
ok(await o.locator('text=Панель администратора…').count() === 0, 'в меню Оли нет панели');
ok((await api(o, 'GET', '/admin/overview')).status === 403, 'API панели для Оли — 403');
ok((await api(o, 'GET', '/admin/agents')).status === 403, 'задачи для ИИ для Оли — 403');

ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
void sid;
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
