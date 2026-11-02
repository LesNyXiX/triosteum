// Сквозная проверка писем: приглашение и «Забыли пароль?» — ссылки берутся из настоящих писем.
// Адрес TRIOSTEUM_URL должен совпадать с PUBLIC_URL сервера (ссылки в письмах ведут туда).
// Нужны: сервер с SMTP и папка, куда тестовый почтовый сервер складывает письма (MAIL_DIR, по умолчанию /tmp/mails).
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
const B = process.env.TRIOSTEUM_URL || 'http://localhost:8000', DIR = process.env.MAIL_DIR || '/tmp/mails';
const OWNER = 'own' + Date.now() + '@zavod.ru', GUEST = 'gst' + Date.now() + '@zavod.ru';
const b = await chromium.launch(); const errs = []; let fail = 0;
const ok = (c, n) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) fail++; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1366, height: 800 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
async function mailTo(addr) {
  for (let i = 0; i < 60; i++) {
    for (const f of readdirSync(DIR).sort().reverse()) {
      const raw = readFileSync(DIR + '/' + f, 'utf8');
      if (raw.includes('To: ' + addr)) {
        // текстовая часть письма закодирована — достаём ссылку из HTML-части (quoted-printable или base64)
        const dec = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        let m = dec.match(/https?:\/\/[^\s"<]+\/(?:invite|reset)\?t=[A-Za-z0-9_-]+/);
        if (!m) { const b64 = [...raw.matchAll(/\r?\n\r?\n([A-Za-z0-9+/=\r\n]{40,})/g)].map((x) => Buffer.from(x[1].replace(/\s/g, ''), 'base64').toString('utf8')).join(' '); m = b64.match(/https?:\/\/[^\s"<]+\/(?:invite|reset)\?t=[A-Za-z0-9_-]+/); }
        if (m) return m[0];
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}
const o = await page();
await o.goto(B + '/login#register');
await o.fill('#org', 'Завод Письма'); await o.fill('#name', 'Анна'); await o.fill('#email', OWNER); await o.fill('#pw', 'password123'); await o.check('#pd');
await o.click('#go'); await o.waitForURL(B + '/'); await o.waitForTimeout(700);
console.log('Приглашение письмом');
await o.click('#projBtn'); await o.click('.ctx .ctx-i:has-text("Команда…")'); await o.waitForTimeout(600);
await o.fill('#teamBody input[type=email]', GUEST); await o.click('#teamBody form button[type=submit]'); await o.waitForTimeout(900);
ok((await o.textContent('#toast')).includes('отправлено на ' + GUEST), 'владелец видит «Приглашение отправлено»');
const inv = await mailTo(GUEST);
ok(!!inv, 'письмо с приглашением пришло');
const g = await page();
await g.goto(inv); await g.waitForTimeout(700);
ok((await g.textContent('#title')).includes('Завод Письма'), 'ссылка из письма открывает приглашение');
await g.fill('#name', 'Борис'); await g.fill('#pw', 'password456'); await g.check('#pd'); await g.click('#go'); await g.waitForURL(B + '/'); await g.waitForTimeout(600);
ok(await g.evaluate(() => window.TRIOSTEUM_BOOT.org.name) === 'Завод Письма', 'гость вошёл в организацию');

console.log('Забыли пароль');
const f = await page();
await f.goto(B + '/login'); await f.waitForTimeout(500);
ok(await f.isVisible('#forgotBtn'), 'есть ссылка «Забыли пароль?»');
await f.click('#forgotBtn'); await f.fill('#email', GUEST); await f.click('#go'); await f.waitForTimeout(700);
ok((await f.textContent('#err')).includes('ссылка уже в пути'), 'сообщение «ссылка в пути»');
let rst = null;
for (let i = 0; i < 40 && !rst; i++) { const l = await mailTo(GUEST); if (l && l.includes('/reset?')) rst = l; else await new Promise((r) => setTimeout(r, 200)); }
ok(!!rst, 'письмо со ссылкой на смену пароля пришло');
await f.goto(rst); await f.waitForTimeout(500);
ok((await f.textContent('#title')) === 'Новый пароль', 'страница «Новый пароль»');
await f.fill('#pw', 'brand-new-pass'); await f.click('#go'); await f.waitForURL(B + '/'); await f.waitForTimeout(600);
ok(await f.evaluate(() => window.TRIOSTEUM_BOOT.user.name) === 'Борис', 'вход с новым паролем');
await g.reload(); await g.waitForTimeout(600);
ok(new URL(g.url()).pathname === '/login', 'старый вход на другом устройстве закрыт');
ok(errs.length === 0, 'нет ошибок JavaScript' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close();
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе проверки пройдены'); process.exit(fail ? 1 : 0);
