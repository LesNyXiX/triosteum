"""Сервер Triosteum: вход, пространства с версиями, настройки, перенос из браузера.

Контракт API — в server/API.md. Браузерная часть — src/app/core/server-adapter.js.
Запуск для разработки:  uvicorn app.main:app --reload  (из папки server/)
"""
import ipaddress
from contextlib import asynccontextmanager
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import migrate
from .config import settings
from .db import tx
from .security import RateLimiter, hash_password, new_token, token_hash, verify_password

@asynccontextmanager
async def lifespan(_app):
    if settings.migrate_url:                     # при запуске применяем новые миграции базы
        migrate.run(settings.migrate_url, settings.app_db_password)
    yield


app = FastAPI(title="Triosteum", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None, lifespan=lifespan)
login_limiter = RateLimiter(settings.login_attempts_per_min)

COOKIE = "tsid"
SPACE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
PREF_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,80}$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
WRITE_ROLES = {"owner", "editor"}


# ---------- общие проверки ----------

@app.middleware("http")
async def guard(request: Request, call_next):
    # размер тела
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > settings.max_body_bytes:
        return JSONResponse({"detail": "Слишком большой запрос"}, status_code=413)
    # CSRF: изменяющие запросы к API — только со своего сайта
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.url.path.startswith("/api/"):
        if request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Запрос с чужого сайта отклонён"}, status_code=403)
        origin = request.headers.get("origin")
        if origin and origin != "null":
            host = request.headers.get("host", "")
            if urlsplit(origin).netloc != host and origin not in settings.allowed_origins:
                return JSONResponse({"detail": "Запрос с чужого сайта отклонён"}, status_code=403)
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/api/"):
        resp.headers.setdefault("Cache-Control", "no-store")
    return resp


class Who(BaseModel):
    user_id: str
    org_id: str
    role: str
    email: str
    name: str
    org_name: str


def current(request: Request) -> Who | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    with tx() as c:
        row = c.execute(text("""
            SELECT u.id, u.email, u.name, s.org_id, o.name AS org_name, m.role
            FROM sessions s
            JOIN users u ON u.id = s.user_id AND NOT u.disabled
            JOIN organizations o ON o.id = s.org_id
            JOIN memberships m ON m.org_id = s.org_id AND m.user_id = s.user_id
            WHERE s.token_hash = :h AND s.expires_at > now()
        """), {"h": token_hash(token)}).mappings().first()
    if not row:
        return None
    return Who(user_id=str(row["id"]), org_id=str(row["org_id"]), role=row["role"], email=row["email"],
               name=row["name"], org_name=row["org_name"])


def need(request: Request) -> Who:
    w = current(request)
    if not w:
        raise HTTPException(401, "Нужно войти")
    return w


def need_writer(w: Who = Depends(need)) -> Who:
    if w.role not in WRITE_ROLES:
        raise HTTPException(403, "Недостаточно прав для изменения")
    return w


def client_ip(request: Request) -> str | None:
    # X-Forwarded-For учитываем, только если сервер стоит за своим прокси (TRUST_PROXY=1) — иначе его можно подделать
    fwd = request.headers.get("x-forwarded-for") if settings.trust_proxy else None
    raw = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")) or ""
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return None


def audit(c, w_org: str, user_id: str | None, action: str, request: Request, obj_type: str | None = None,
          obj_id: str | None = None, details: dict | None = None) -> None:
    c.execute(text("""INSERT INTO audit_log (org_id, user_id, action, object_type, object_id, ip, details)
                      VALUES (:o, :u, :a, :t, :i, CAST(:ip AS inet), CAST(:d AS jsonb))"""),
              {"o": w_org, "u": user_id, "a": action, "t": obj_type, "i": obj_id, "ip": client_ip(request),
               "d": json.dumps(details, ensure_ascii=False) if details else None})


def start_session(resp: Response, request: Request, user_id: str, org_id: str) -> None:
    token = new_token()
    with tx() as c:
        c.execute(text("""INSERT INTO sessions (token_hash, user_id, org_id, expires_at, user_agent, ip)
                          VALUES (:h, :u, :o, :e, :ua, CAST(:ip AS inet))"""),
                  {"h": token_hash(token), "u": user_id, "o": org_id,
                   "e": datetime.now(timezone.utc) + timedelta(days=settings.session_days),
                   "ua": (request.headers.get("user-agent") or "")[:300], "ip": client_ip(request)})
        c.execute(text("UPDATE users SET last_login_at = now() WHERE id = :u"), {"u": user_id})
        c.execute(text("DELETE FROM sessions WHERE expires_at < now()"))
    resp.set_cookie(COOKIE, token, max_age=settings.session_days * 86400, httponly=True, samesite="lax",
                    secure=settings.cookie_secure, path="/")


# ---------- страницы ----------

_html_cache: dict[Path, tuple[float, str]] = {}


def read_html(path: Path) -> str:
    mtime = path.stat().st_mtime
    hit = _html_cache.get(path)
    if not hit or hit[0] != mtime:
        hit = (mtime, path.read_text(encoding="utf-8"))
        _html_cache[path] = hit
    return hit[1]


def space_out(r) -> dict:
    return {"id": r["id"], "name": r["name"], "env": r["env"], "rev": r["rev"],
            "updated_at": r["updated_at"].isoformat(), "updated_by_name": r["updated_by_name"], "content": r["content"]}


SPACE_SELECT = """SELECT s.id, s.name, s.env, s.rev, s.updated_at, s.content,
                         coalesce(nullif(u.name, ''), u.email) AS updated_by_name
                  FROM spaces s LEFT JOIN users u ON u.id = s.updated_by
                  WHERE s.deleted_at IS NULL"""


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    w = current(request)
    if not w:
        return RedirectResponse("/login", status_code=302)
    with tx(w.org_id) as c:
        spaces = [space_out(r) for r in c.execute(text(SPACE_SELECT + " ORDER BY s.updated_at DESC")).mappings()]
        prefs = {r["name"]: r["value"] for r in c.execute(
            text("SELECT name, value FROM prefs WHERE user_id = :u"), {"u": w.user_id}).mappings()}
    boot = {"user": {"id": w.user_id, "email": w.email, "name": w.name}, "org": {"id": w.org_id, "name": w.org_name},
            "role": w.role, "cur": prefs.get("cur"), "prefs": prefs, "spaces": spaces}
    # «<» в данных экранируем, чтобы строка внутри JSON не смогла закрыть тег <script>
    tag = "<script>window.TRIOSTEUM_BOOT = " + json.dumps(boot, ensure_ascii=False).replace("<", "\\u003c") + ";</script>"
    html = read_html(settings.client_html).replace("<!--@@BOOT@@-->", tag, 1)
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if current(request):
        return RedirectResponse("/", status_code=302)
    return HTMLResponse(read_html(settings.login_html))


# ---------- вход ----------

class RegisterIn(BaseModel):
    org: str = Field(min_length=1, max_length=200)
    name: str = Field(default="", max_length=120)
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    pd_consent: bool = False


class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


def me_out(user_id: str, email: str, name: str) -> dict:
    return {"ok": True, "user": {"id": user_id, "email": email, "name": name}}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterIn, request: Request, response: Response):
    email = body.email.strip()
    if not EMAIL.match(email):
        raise HTTPException(422, "Проверьте почту")
    if len(body.password) < 8:
        raise HTTPException(422, "Пароль — не меньше 8 символов")
    if not body.pd_consent:
        raise HTTPException(422, "Нужно согласие на обработку персональных данных")
    if not login_limiter.hit("ip:" + (client_ip(request) or "?")):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    with tx() as c:
        if c.execute(text("SELECT 1 FROM users WHERE lower(email) = lower(:e)"), {"e": email}).first():
            raise HTTPException(409, "Эта почта уже зарегистрирована — войдите")
        org_id = c.execute(text("INSERT INTO organizations (name) VALUES (:n) RETURNING id"),
                           {"n": body.org.strip()}).scalar_one()
        user_id = c.execute(text("INSERT INTO users (email, name, password_hash) VALUES (:e, :n, :p) RETURNING id"),
                            {"e": email, "n": body.name.strip(), "p": hash_password(body.password)}).scalar_one()
        c.execute(text("INSERT INTO memberships (org_id, user_id, role) VALUES (:o, :u, 'owner')"),
                  {"o": org_id, "u": user_id})
    with tx(str(org_id)) as c:
        audit(c, str(org_id), str(user_id), "register", request, details={"pd_consent": True})
    start_session(response, request, str(user_id), str(org_id))
    return me_out(str(user_id), email, body.name.strip())


@app.post("/api/auth/login")
def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    if not login_limiter.hit("ip:" + (client_ip(request) or "?"), "email:" + email):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    with tx() as c:
        u = c.execute(text("""SELECT u.id, u.email, u.name, u.password_hash, m.org_id
                              FROM users u JOIN memberships m ON m.user_id = u.id
                              WHERE lower(u.email) = :e AND NOT u.disabled
                              ORDER BY m.created_at LIMIT 1"""), {"e": email}).mappings().first()
    if not verify_password(u["password_hash"] if u else None, body.password):
        raise HTTPException(401, "Неверная почта или пароль")
    with tx(str(u["org_id"])) as c:
        audit(c, str(u["org_id"]), str(u["id"]), "login", request)
    start_session(response, request, str(u["id"]), str(u["org_id"]))
    return me_out(str(u["id"]), u["email"], u["name"])


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with tx() as c:
            c.execute(text("DELETE FROM sessions WHERE token_hash = :h"), {"h": token_hash(token)})
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@app.get("/api/me")
def me(w: Who = Depends(need)):
    return {"user": {"id": w.user_id, "email": w.email, "name": w.name}, "org": {"id": w.org_id, "name": w.org_name},
            "role": w.role}


# ---------- пространства ----------

class SpaceIn(BaseModel):
    name: str = Field(default="Пространство", min_length=1, max_length=200)
    env: str = Field(default="code", pattern="^(code|docs)$")
    content: dict[str, Any] = Field(default_factory=dict)
    base_rev: int = Field(default=0, ge=0)


class SpacePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    env: str | None = Field(default=None, pattern="^(code|docs)$")


def check_id(space_id: str) -> str:
    if not SPACE_ID.match(space_id):
        raise HTTPException(422, "Неверный идентификатор пространства")
    return space_id


def snapshot(c, w: Who, space_id: str, rev: int, content_json: str, label: str | None = None) -> None:
    """Снимок в историю версий: по подписи — всегда, автоматически — не чаще раза в VERSION_EVERY_SEC."""
    if label is None:
        recent = c.execute(text("""SELECT 1 FROM space_versions WHERE space_id = :s
                                   AND created_at > now() - make_interval(secs => :sec) LIMIT 1"""),
                           {"s": space_id, "sec": settings.version_every_sec}).first()
        if recent:
            return
    c.execute(text("""INSERT INTO space_versions (org_id, space_id, rev, content, label, created_by)
                      VALUES (:o, :s, :r, CAST(:c AS jsonb), :l, :u) ON CONFLICT (org_id, space_id, rev) DO NOTHING"""),
              {"o": w.org_id, "s": space_id, "r": rev, "c": content_json, "l": label, "u": w.user_id})


@app.get("/api/spaces")
def list_spaces(w: Who = Depends(need)):
    with tx(w.org_id) as c:
        rows = c.execute(text("""SELECT id, name, env, rev, updated_at FROM spaces
                                 WHERE deleted_at IS NULL ORDER BY updated_at DESC""")).mappings()
        return [{"id": r["id"], "name": r["name"], "env": r["env"], "rev": r["rev"],
                 "updated_at": r["updated_at"].isoformat()} for r in rows]


@app.get("/api/spaces/{space_id}")
def get_space(space_id: str, w: Who = Depends(need)):
    check_id(space_id)
    with tx(w.org_id) as c:
        r = c.execute(text(SPACE_SELECT + " AND s.id = :id"), {"id": space_id}).mappings().first()
    if not r:
        raise HTTPException(404, "Нет такого пространства")
    return space_out(r)


@app.put("/api/spaces/{space_id}")
def put_space(space_id: str, body: SpaceIn, w: Who = Depends(need_writer)):
    check_id(space_id)
    content_json = json.dumps(body.content, ensure_ascii=False)
    with tx(w.org_id) as c:
        # сохраняем, только если никто не успел сохранить раньше нас (номер правки совпадает)
        r = c.execute(text("""UPDATE spaces SET name = :n, env = :e, content = CAST(:c AS jsonb), rev = rev + 1,
                                     updated_by = :u, updated_at = now()
                              WHERE id = :id AND rev = :rev AND deleted_at IS NULL
                              RETURNING rev, updated_at"""),
                      {"n": body.name, "e": body.env, "c": content_json, "u": w.user_id, "id": space_id,
                       "rev": body.base_rev}).mappings().first()
        if r:
            snapshot(c, w, space_id, r["rev"], content_json)
            return {"rev": r["rev"], "updated_at": r["updated_at"].isoformat()}
        live = c.execute(text(SPACE_SELECT + " AND s.id = :id"), {"id": space_id}).mappings().first()
        if live:                                             # кто-то сохранил раньше — конфликт
            return JSONResponse(space_out(live), status_code=409)
        if body.base_rev != 0:
            raise HTTPException(404, "Пространство удалено")
        # новое пространство (или повторное создание удалённого с тем же id)
        r = c.execute(text("""INSERT INTO spaces (org_id, id, name, env, content, rev, created_by, updated_by)
                              VALUES (:o, :id, :n, :e, CAST(:c AS jsonb), 1, :u, :u)
                              ON CONFLICT (org_id, id) DO UPDATE SET name = EXCLUDED.name, env = EXCLUDED.env,
                                  content = EXCLUDED.content, rev = spaces.rev + 1, updated_by = EXCLUDED.updated_by,
                                  updated_at = now(), deleted_at = NULL
                              RETURNING rev, updated_at"""),
                      {"o": w.org_id, "id": space_id, "n": body.name, "e": body.env, "c": content_json,
                       "u": w.user_id}).mappings().first()
        snapshot(c, w, space_id, r["rev"], content_json)
    return JSONResponse({"rev": r["rev"], "updated_at": r["updated_at"].isoformat()}, status_code=201)


@app.patch("/api/spaces/{space_id}")
def patch_space(space_id: str, body: SpacePatch, w: Who = Depends(need_writer)):
    check_id(space_id)
    with tx(w.org_id) as c:
        n = c.execute(text("""UPDATE spaces SET name = coalesce(:n, name), env = coalesce(:e, env)
                              WHERE id = :id AND deleted_at IS NULL"""),
                      {"n": body.name, "e": body.env, "id": space_id}).rowcount
    if not n:
        raise HTTPException(404, "Нет такого пространства")
    return {"ok": True}


@app.delete("/api/spaces/{space_id}")
def delete_space(space_id: str, request: Request, w: Who = Depends(need_writer)):
    check_id(space_id)
    with tx(w.org_id) as c:
        n = c.execute(text("UPDATE spaces SET deleted_at = now() WHERE id = :id AND deleted_at IS NULL"),
                      {"id": space_id}).rowcount
        if n:
            audit(c, w.org_id, w.user_id, "space.delete", request, "space", space_id)
    if not n:
        raise HTTPException(404, "Нет такого пространства")
    return {"ok": True}


@app.get("/api/spaces/{space_id}/versions")
def versions(space_id: str, w: Who = Depends(need)):
    check_id(space_id)
    with tx(w.org_id) as c:
        rows = c.execute(text("""SELECT v.id, v.rev, v.label, v.created_at, coalesce(nullif(u.name, ''), u.email) AS who
                                 FROM space_versions v LEFT JOIN users u ON u.id = v.created_by
                                 WHERE v.space_id = :s ORDER BY v.created_at DESC LIMIT 200"""),
                         {"s": space_id}).mappings()
        return [{"id": r["id"], "rev": r["rev"], "label": r["label"], "created_at": r["created_at"].isoformat(),
                 "by": r["who"]} for r in rows]


class VersionIn(BaseModel):
    label: str = Field(min_length=1, max_length=200)


@app.post("/api/spaces/{space_id}/versions", status_code=201)
def save_version(space_id: str, body: VersionIn, w: Who = Depends(need_writer)):
    check_id(space_id)
    with tx(w.org_id) as c:
        r = c.execute(text("SELECT rev, content::text AS c FROM spaces WHERE id = :id AND deleted_at IS NULL"),
                      {"id": space_id}).mappings().first()
        if not r:
            raise HTTPException(404, "Нет такого пространства")
        c.execute(text("""INSERT INTO space_versions (org_id, space_id, rev, content, label, created_by)
                          VALUES (:o, :s, :r, CAST(:c AS jsonb), :l, :u)
                          ON CONFLICT (org_id, space_id, rev) DO UPDATE SET label = EXCLUDED.label"""),
                  {"o": w.org_id, "s": space_id, "r": r["rev"], "c": r["c"], "l": body.label, "u": w.user_id})
    return {"ok": True, "rev": r["rev"]}


# ---------- команда: участники и приглашения ----------

ROLES = ("owner", "editor", "approver", "viewer")
INVITE_ROLES = ("editor", "approver", "viewer")
INVITE_DAYS = 7


def need_owner(w: Who = Depends(need)) -> Who:
    if w.role != "owner":
        raise HTTPException(403, "Это может только владелец организации")
    return w


@app.get("/api/org/members")
def members(w: Who = Depends(need)):
    with tx(w.org_id) as c:
        ms = c.execute(text("""SELECT u.id, u.email, u.name, m.role, m.created_at, u.last_login_at
                               FROM memberships m JOIN users u ON u.id = m.user_id
                               WHERE m.org_id = :o ORDER BY m.created_at"""), {"o": w.org_id}).mappings().all()
        inv = []
        if w.role == "owner":
            inv = c.execute(text("""SELECT id, email, role, created_at, expires_at FROM invites
                                    WHERE accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC""")).mappings().all()
    return {"me": w.user_id, "my_role": w.role,
            "members": [{"id": str(r["id"]), "email": r["email"], "name": r["name"], "role": r["role"],
                         "since": r["created_at"].isoformat(),
                         "last_login": r["last_login_at"].isoformat() if r["last_login_at"] else None} for r in ms],
            "invites": [{"id": str(r["id"]), "email": r["email"], "role": r["role"],
                         "expires_at": r["expires_at"].isoformat()} for r in inv]}


class InviteIn(BaseModel):
    email: str = Field(max_length=254)
    role: str = Field(default="editor")


@app.post("/api/org/invites", status_code=201)
def create_invite(body: InviteIn, request: Request, w: Who = Depends(need_owner)):
    email = body.email.strip()
    if not EMAIL.match(email):
        raise HTTPException(422, "Проверьте почту")
    if body.role not in INVITE_ROLES:
        raise HTTPException(422, "Неверная роль")
    token = new_token()
    with tx(w.org_id) as c:
        if c.execute(text("""SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
                             WHERE m.org_id = :o AND lower(u.email) = lower(:e)"""), {"o": w.org_id, "e": email}).first():
            raise HTTPException(409, "Этот человек уже в организации")
        # старое неиспользованное приглашение на ту же почту больше не действует
        c.execute(text("DELETE FROM invites WHERE lower(email) = lower(:e) AND accepted_at IS NULL"), {"e": email})
        r = c.execute(text("""INSERT INTO invites (org_id, email, role, token_hash, created_by, expires_at)
                              VALUES (:o, :e, :r, :h, :u, now() + make_interval(days => :d)) RETURNING id, expires_at"""),
                      {"o": w.org_id, "e": email, "r": body.role, "h": token_hash(token), "u": w.user_id,
                       "d": INVITE_DAYS}).mappings().first()
        audit(c, w.org_id, w.user_id, "invite.create", request, "invite", str(r["id"]), {"email": email, "role": body.role})
    # ссылку владелец отправляет коллеге сам (почта — следующий шаг); в базе хранится только хеш токена
    return {"id": str(r["id"]), "path": "/invite?t=" + token, "expires_at": r["expires_at"].isoformat()}


@app.delete("/api/org/invites/{invite_id}")
def cancel_invite(invite_id: str, w: Who = Depends(need_owner)):
    with tx(w.org_id) as c:
        try:
            n = c.execute(text("DELETE FROM invites WHERE id = CAST(:i AS uuid) AND accepted_at IS NULL"), {"i": invite_id}).rowcount
        except Exception:
            n = 0
    if not n:
        raise HTTPException(404, "Нет такого приглашения")
    return {"ok": True}


class RoleIn(BaseModel):
    role: str


def _owners(c, org_id: str) -> int:
    return c.execute(text("SELECT count(*) FROM memberships WHERE org_id = :o AND role = 'owner'"), {"o": org_id}).scalar_one()


@app.patch("/api/org/members/{user_id}")
def set_role(user_id: str, body: RoleIn, request: Request, w: Who = Depends(need_owner)):
    if body.role not in ROLES:
        raise HTTPException(422, "Неверная роль")
    with tx(w.org_id) as c:
        cur = c.execute(text("SELECT role FROM memberships WHERE org_id = :o AND user_id = CAST(:u AS uuid)"),
                        {"o": w.org_id, "u": user_id}).scalar_one_or_none()
        if cur is None:
            raise HTTPException(404, "Нет такого участника")
        if cur == "owner" and body.role != "owner" and _owners(c, w.org_id) <= 1:
            raise HTTPException(409, "В организации должен остаться хотя бы один владелец")
        c.execute(text("UPDATE memberships SET role = :r WHERE org_id = :o AND user_id = CAST(:u AS uuid)"),
                  {"r": body.role, "o": w.org_id, "u": user_id})
        audit(c, w.org_id, w.user_id, "member.role", request, "user", user_id, {"role": body.role})
    return {"ok": True}


@app.delete("/api/org/members/{user_id}")
def remove_member(user_id: str, request: Request, w: Who = Depends(need_owner)):
    with tx(w.org_id) as c:
        cur = c.execute(text("SELECT role FROM memberships WHERE org_id = :o AND user_id = CAST(:u AS uuid)"),
                        {"o": w.org_id, "u": user_id}).scalar_one_or_none()
        if cur is None:
            raise HTTPException(404, "Нет такого участника")
        if cur == "owner" and _owners(c, w.org_id) <= 1:
            raise HTTPException(409, "Нельзя удалить единственного владельца")
        c.execute(text("DELETE FROM memberships WHERE org_id = :o AND user_id = CAST(:u AS uuid)"), {"o": w.org_id, "u": user_id})
        # доступ пропадает сразу: закрываем его входы в эту организацию
        c.execute(text("DELETE FROM sessions WHERE org_id = :o AND user_id = CAST(:u AS uuid)"), {"o": w.org_id, "u": user_id})
        audit(c, w.org_id, w.user_id, "member.remove", request, "user", user_id)
    return {"ok": True}


def _invite(token: str):
    with tx() as c:
        r = c.execute(text("SELECT * FROM invite_by_token(:h)"), {"h": token_hash(token)}).mappings().first()
    if not r or r["accepted_at"] is not None or r["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(404, "Приглашение не найдено или уже недействительно")
    return r


@app.get("/api/invites/{token}")
def invite_info(token: str):
    r = _invite(token)
    with tx() as c:
        exists = c.execute(text("SELECT 1 FROM users WHERE lower(email) = lower(:e)"), {"e": r["email"]}).first() is not None
    return {"org": r["org_name"], "email": r["email"], "role": r["role"], "has_account": exists}


class AcceptIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Field(max_length=200)
    name: str = Field(default="", max_length=120)
    pd_consent: bool = False


@app.post("/api/auth/accept-invite")
def accept_invite(body: AcceptIn, request: Request, response: Response):
    if not login_limiter.hit("ip:" + (client_ip(request) or "?"), "invite:" + body.token[:16]):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    inv = _invite(body.token)
    org_id, email = str(inv["org_id"]), inv["email"]
    with tx() as c:
        u = c.execute(text("SELECT id, name, password_hash FROM users WHERE lower(email) = lower(:e)"), {"e": email}).mappings().first()
        if u:                                   # аккаунт уже есть — подтверждаем его паролем
            if not verify_password(u["password_hash"], body.password):
                raise HTTPException(401, "Неверный пароль от аккаунта " + email)
            user_id, name = str(u["id"]), u["name"]
        else:
            if len(body.password) < 8:
                raise HTTPException(422, "Пароль — не меньше 8 символов")
            if not body.pd_consent:
                raise HTTPException(422, "Нужно согласие на обработку персональных данных")
            name = body.name.strip()
            user_id = str(c.execute(text("INSERT INTO users (email, name, password_hash) VALUES (:e, :n, :p) RETURNING id"),
                                    {"e": email, "n": name, "p": hash_password(body.password)}).scalar_one())
        c.execute(text("""INSERT INTO memberships (org_id, user_id, role) VALUES (:o, :u, :r)
                          ON CONFLICT (org_id, user_id) DO NOTHING"""), {"o": org_id, "u": user_id, "r": inv["role"]})
    with tx(org_id) as c:
        c.execute(text("UPDATE invites SET accepted_at = now() WHERE id = :i"), {"i": inv["id"]})
        audit(c, org_id, user_id, "invite.accept", request, "invite", str(inv["id"]))
    start_session(response, request, user_id, org_id)
    return me_out(user_id, email, name)


@app.get("/invite", response_class=HTMLResponse)
def invite_page():
    return HTMLResponse(read_html(settings.login_html))


@app.get("/api/spaces/{space_id}/versions/{version_id}")
def get_version(space_id: str, version_id: int, w: Who = Depends(need)):
    check_id(space_id)
    with tx(w.org_id) as c:
        r = c.execute(text("""SELECT id, rev, label, created_at, content FROM space_versions
                              WHERE space_id = :s AND id = :v"""), {"s": space_id, "v": version_id}).mappings().first()
    if not r:
        raise HTTPException(404, "Нет такой версии")
    return {"id": r["id"], "rev": r["rev"], "label": r["label"], "created_at": r["created_at"].isoformat(), "content": r["content"]}


# ---------- настройки и перенос ----------

class PrefIn(BaseModel):
    value: Any = None


@app.put("/api/prefs/{name}")
def put_pref(name: str, body: PrefIn, w: Who = Depends(need)):
    if not PREF_NAME.match(name):
        raise HTTPException(422, "Неверное имя настройки")
    value = json.dumps(body.value, ensure_ascii=False)
    if len(value.encode()) > settings.max_pref_bytes:
        raise HTTPException(413, "Настройка слишком большая")
    with tx(w.org_id) as c:
        c.execute(text("""INSERT INTO prefs (org_id, user_id, name, value) VALUES (:o, :u, :n, CAST(:v AS jsonb))
                          ON CONFLICT (org_id, user_id, name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"""),
                  {"o": w.org_id, "u": w.user_id, "n": name, "v": value})
    return {"ok": True}


class ImportSpace(BaseModel):
    id: str
    name: str = Field(default="Пространство", min_length=1, max_length=200)
    env: str = Field(default="code", pattern="^(code|docs)$")
    content: dict[str, Any] = Field(default_factory=dict)


class ImportIn(BaseModel):
    spaces: list[ImportSpace] = Field(default_factory=list, max_length=500)
    prefs: dict[str, Any] = Field(default_factory=dict)


@app.post("/api/import")
def import_local(body: ImportIn, request: Request, w: Who = Depends(need_writer)):
    n = 0
    with tx(w.org_id) as c:
        taken = {r[0] for r in c.execute(text("SELECT id FROM spaces"))}
        for s in body.spaces:
            sid = s.id if SPACE_ID.match(s.id) else "p" + new_token()[:10].replace("-", "x").replace("_", "y")
            while sid in taken:                       # такой id уже есть — добавляем суффикс
                sid = (sid[:56] + "-" + new_token()[:6]).replace("_", "x")
            taken.add(sid)
            content_json = json.dumps(s.content, ensure_ascii=False)
            c.execute(text("""INSERT INTO spaces (org_id, id, name, env, content, rev, created_by, updated_by)
                              VALUES (:o, :id, :n, :e, CAST(:c AS jsonb), 1, :u, :u)"""),
                      {"o": w.org_id, "id": sid, "n": s.name, "e": s.env, "c": content_json, "u": w.user_id})
            snapshot(c, w, sid, 1, content_json, label="Перенесено из браузера")
            n += 1
        for name, value in body.prefs.items():
            v = json.dumps(value, ensure_ascii=False)
            if not PREF_NAME.match(name) or len(v.encode()) > settings.max_pref_bytes:
                continue
            c.execute(text("""INSERT INTO prefs (org_id, user_id, name, value) VALUES (:o, :u, :n, CAST(:v AS jsonb))
                              ON CONFLICT (org_id, user_id, name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"""),
                      {"o": w.org_id, "u": w.user_id, "n": name, "v": v})
        audit(c, w.org_id, w.user_id, "import", request, details={"spaces": n})
    return {"spaces": n}


@app.get("/api/health")
def health():
    with tx() as c:
        c.execute(text("SELECT 1"))
    return {"ok": True}
