// Тестовый сервер Triosteum в памяти — тот же API, что у настоящего (server/), но без базы.
// Нужен, чтобы проверять и разрабатывать браузерную часть без Python и PostgreSQL.
// Запуск: node tests/mock-server.mjs [порт]   → http://localhost:8787
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const db = { users: [], orgs: [], sessions: {}, spaces: {}, prefs: {} };   // spaces[orgId][id], prefs[userId][name]
const now = () => new Date().toISOString();
const hash = (s) => createHash('sha256').update(s).digest('hex');

function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', ...headers });
  res.end(body);
}
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); } }); });
function who(req) {
  const m = /(?:^|;\s*)tsid=([^;]+)/.exec(req.headers.cookie || '');
  const s = m && db.sessions[hash(m[1])];
  if (!s) return null;
  const user = db.users.find((u) => u.id === s.userId);
  const org = db.orgs.find((o) => o.id === s.orgId);
  return { user, org, role: user.roles[org.id] };
}
function startSession(res, user, org, status = 200) {
  const token = randomBytes(32).toString('base64url');
  db.sessions[hash(token)] = { userId: user.id, orgId: org.id };
  send(res, status, { ok: true, user: { id: user.id, email: user.email, name: user.name } }, { 'Set-Cookie': `tsid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` });
}
const spacesOf = (orgId) => (db.spaces[orgId] ||= {});
const pub = (sp) => ({ id: sp.id, name: sp.name, env: sp.env, rev: sp.rev, updated_at: sp.updated_at, updated_by_name: sp.updated_by_name, content: sp.content });

function page(w) {
  const html = readFileSync(join(ROOT, 'docs', 'index.html'), 'utf8');
  const prefs = db.prefs[w.user.id] || {};
  const list = Object.values(spacesOf(w.org.id)).filter((s) => !s.deleted).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const boot = { user: { id: w.user.id, email: w.user.email, name: w.user.name }, org: { id: w.org.id, name: w.org.name }, role: w.role, cur: prefs.cur || null, prefs, spaces: list.map(pub) };
  // </ внутри JSON экранируем, чтобы данные не смогли закрыть тег <script>
  const tag = `<script>window.TRIOSTEUM_BOOT = ${JSON.stringify(boot).replace(/</g, '\\u003c')};</script>`;
  return html.replace('<!--@@BOOT@@-->', () => tag);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'); const path = url.pathname; const M = req.method;
  try {
    if (M === 'GET' && path === '/login') return send(res, 200, readFileSync(join(ROOT, 'server', 'app', 'static', 'login.html'), 'utf8'));
    if (M === 'GET' && path === '/') { const w = who(req); if (!w) { res.writeHead(302, { Location: '/login' }); return res.end(); } return send(res, 200, page(w)); }
    if (M === 'POST' && path === '/api/auth/register') {
      const b = await body(req);
      if (!b.email || !b.password || b.password.length < 8 || !b.org) return send(res, 422, { detail: 'Заполните организацию, почту и пароль (от 8 символов)' });
      if (!b.pd_consent) return send(res, 422, { detail: 'Нужно согласие на обработку персональных данных' });
      if (db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) return send(res, 409, { detail: 'Эта почта уже зарегистрирована — войдите' });
      const org = { id: randomBytes(8).toString('hex'), name: b.org };
      const user = { id: randomBytes(8).toString('hex'), email: b.email, name: b.name || '', pw: hash(b.password), roles: { [org.id]: 'owner' } };
      db.orgs.push(org); db.users.push(user);
      return startSession(res, user, org, 201);
    }
    if (M === 'POST' && path === '/api/auth/login') {
      const b = await body(req); const user = db.users.find((u) => u.email.toLowerCase() === String(b.email || '').toLowerCase());
      if (!user || user.pw !== hash(b.password || '')) return send(res, 401, { detail: 'Неверная почта или пароль' });
      return startSession(res, user, db.orgs.find((o) => o.id === Object.keys(user.roles)[0]));
    }
    if (!path.startsWith('/api/') && !path.startsWith('/__test/')) return send(res, 404, { detail: 'Не найдено' });
    if (path.startsWith('/__test/')) {               // только для тестов: правка «от коллеги»
      const [, , orgName, id] = path.split('/'); const org = db.orgs.find((o) => o.name === decodeURIComponent(orgName));
      const sp = spacesOf(org.id)[id]; sp.content = { ...sp.content, nodes: [...(sp.content.nodes || []), { id: 'col', name: 'Блок коллеги', lang: 'python', x: 420, y: 60, codes: {} }] };
      sp.rev++; sp.updated_at = now(); sp.updated_by_name = 'Коллега'; return send(res, 200, { rev: sp.rev });
    }
    const w = who(req); if (!w) return send(res, 401, { detail: 'Нужно войти' });
    if (M === 'POST' && path === '/api/auth/logout') { const m = /(?:^|;\s*)tsid=([^;]+)/.exec(req.headers.cookie || ''); delete db.sessions[hash(m[1])]; return send(res, 200, { ok: true }, { 'Set-Cookie': 'tsid=; Path=/; Max-Age=0' }); }
    if (M === 'GET' && path === '/api/me') return send(res, 200, { user: { id: w.user.id, email: w.user.email, name: w.user.name }, org: w.org, role: w.role });
    let m;
    if ((m = /^\/api\/spaces\/([A-Za-z0-9_-]{1,64})$/.exec(path))) {
      const id = m[1]; const all = spacesOf(w.org.id); const sp = all[id] && !all[id].deleted ? all[id] : null;
      if (M === 'GET') return sp ? send(res, 200, pub(sp)) : send(res, 404, { detail: 'Нет такого пространства' });
      if (w.role === 'viewer' || w.role === 'approver') return send(res, 403, { detail: 'Недостаточно прав для изменения' });
      if (M === 'PUT') {
        const b = await body(req);
        if (sp && b.base_rev !== sp.rev) return send(res, 409, pub(sp));
        const next = { id, name: b.name || 'Пространство', env: b.env || 'code', content: b.content || {}, rev: (sp ? sp.rev : 0) + 1, updated_at: now(), updated_by_name: w.user.name || w.user.email };
        all[id] = next; return send(res, sp ? 200 : 201, { rev: next.rev, updated_at: next.updated_at });
      }
      if (M === 'PATCH') { if (!sp) return send(res, 404, { detail: 'Нет такого пространства' }); const b = await body(req); if (b.name) sp.name = b.name; if (b.env) sp.env = b.env; return send(res, 200, { ok: true }); }
      if (M === 'DELETE') { if (sp) sp.deleted = true; return send(res, sp ? 200 : 404, { ok: !!sp }); }
    }
    if ((m = /^\/api\/prefs\/([A-Za-z0-9_.-]{1,80})$/.exec(path)) && M === 'PUT') { const b = await body(req); (db.prefs[w.user.id] ||= {})[m[1]] = b.value; return send(res, 200, { ok: true }); }
    if (M === 'POST' && path === '/api/import') {
      const b = await body(req); const all = spacesOf(w.org.id); let n = 0;
      for (const s of b.spaces || []) { let id = s.id; if (all[id]) id = id + '-' + randomBytes(2).toString('hex'); all[id] = { id, name: s.name, env: s.env || 'code', content: s.content, rev: 1, updated_at: now(), updated_by_name: w.user.name }; n++; }
      Object.assign((db.prefs[w.user.id] ||= {}), b.prefs || {});
      return send(res, 200, { spaces: n });
    }
    return send(res, 404, { detail: 'Не найдено' });
  } catch (e) { console.error(e); send(res, 500, { detail: 'Ошибка сервера' }); }
});
server.listen(PORT, () => console.log(`Тестовый сервер Triosteum: http://localhost:${PORT}`));
