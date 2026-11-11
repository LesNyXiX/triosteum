"""Сервер Triosteum: вход, пространства с версиями, настройки, перенос из браузера.

Контракт API — в server/API.md. Браузерная часть — src/app/core/server-adapter.js.
Запуск для разработки:  uvicorn app.main:app --reload  (из папки server/)
"""
import asyncio
import ipaddress
import json
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from . import ai as ai_mod
from . import infinitum
from . import mail
from .live import Peer, hub
from . import migrate
from .config import settings
from .db import tx
from .security import RateLimiter, hash_password, new_token, token_hash, verify_password

@asynccontextmanager
async def lifespan(_app):
    hub.loop = asyncio.get_running_loop()       # чтобы рассылать правки из обработчиков HTTP
    if settings.migrate_url:                     # при запуске применяем новые миграции базы
        migrate.run(settings.migrate_url, settings.app_db_password)
    yield


app = FastAPI(title="Triosteum", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None, lifespan=lifespan)
login_limiter = RateLimiter(settings.login_attempts_per_min)
ai_limiter = RateLimiter(int(os.environ.get("AI_REQUESTS_PER_MIN", "20")))
AI = ai_mod.from_env()
run_limiter = RateLimiter(int(os.environ.get("RUN_REQUESTS_PER_MIN", "30")))
# Исполнитель Python: отдельный сервис (RUNNER_URL + RUNNER_TOKEN) или, для разработки, прямо здесь (RUNNER_LOCAL=1)
RUNNER_URL = (os.environ.get("RUNNER_URL") or "").rstrip("/")
RUNNER_TOKEN = os.environ.get("RUNNER_TOKEN", "")
RUNNER_LOCAL = os.environ.get("RUNNER_LOCAL", "") in ("1", "true", "yes")
RUNNER_ON = bool(RUNNER_URL and RUNNER_TOKEN) or RUNNER_LOCAL

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
    is_admin: bool = False


# ---------- настройки сервера (панель администратора) ----------
# registration: 'open' — любой создаёт организацию, 'invite' — только по приглашению администратора
# access: {"open": bool, "message": str} — закрыть вход всем, кроме администраторов
INST_DEFAULTS: dict[str, Any] = {"registration": os.environ.get("REGISTRATION", "invite"), "access": {"open": True, "message": ""}}
_inst: dict[str, Any] = {"t": 0.0, "v": {}}


def inst(key: str):
    """Настройка сервера; читается из базы не чаще раза в 3 секунды."""
    if time.monotonic() - _inst["t"] > 3:
        with tx() as c:
            _inst["v"] = {k: v for k, v in c.execute(text("SELECT key, value FROM instance_settings")).all()}
        _inst["t"] = time.monotonic()
    v = _inst["v"].get(key)
    return INST_DEFAULTS.get(key) if v is None else v


def inst_set(c, key: str, value, user_id: str | None) -> None:
    c.execute(text("""INSERT INTO instance_settings (key, value, updated_by) VALUES (:k, CAST(:v AS jsonb), :u)
                      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by"""),
              {"k": key, "v": json.dumps(value, ensure_ascii=False), "u": user_id})
    _inst["t"] = 0.0


def access_open() -> bool:
    a = inst("access")
    return not isinstance(a, dict) or bool(a.get("open", True))


def closed_detail() -> str:
    a = inst("access")
    msg = (a.get("message") or "").strip() if isinstance(a, dict) else ""
    return "Доступ к серверу временно закрыт администратором" + (": " + msg if msg else "")


def current(request: Request) -> Who | None:
    return who_by_token(request.cookies.get(COOKIE))


def who_by_token(token: str | None) -> Who | None:
    if not token:
        return None
    with tx() as c:
        row = c.execute(text("""
            SELECT u.id, u.email, u.name, u.is_admin, s.org_id, o.name AS org_name, m.role
            FROM sessions s
            JOIN users u ON u.id = s.user_id AND NOT u.disabled AND u.deleted_at IS NULL
            JOIN organizations o ON o.id = s.org_id
            JOIN memberships m ON m.org_id = s.org_id AND m.user_id = s.user_id
            WHERE s.token_hash = :h AND s.expires_at > now()
        """), {"h": token_hash(token)}).mappings().first()
    if not row:
        return None
    return Who(user_id=str(row["id"]), org_id=str(row["org_id"]), role=row["role"], email=row["email"],
               name=row["name"], org_name=row["org_name"], is_admin=bool(row["is_admin"]))


def need(request: Request) -> Who:
    w = current(request)
    if not w:
        raise HTTPException(401, "Нужно войти")
    if not w.is_admin and not access_open():
        raise HTTPException(423, closed_detail())        # 423 Locked: браузер покажет страницу входа с причиной
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
    if not w.is_admin and not access_open():
        return RedirectResponse("/login?closed=1", status_code=302)
    with tx(w.org_id) as c:
        spaces = [space_out(r) for r in c.execute(text(SPACE_SELECT + " ORDER BY s.updated_at DESC")).mappings()]
        prefs = {r["name"]: r["value"] for r in c.execute(
            text("SELECT name, value FROM prefs WHERE user_id = :u"), {"u": w.user_id}).mappings()}
    boot = {"user": {"id": w.user_id, "email": w.email, "name": w.name, "is_admin": w.is_admin},
            "org": {"id": w.org_id, "name": w.org_name},
            "role": w.role, "cur": prefs.get("cur"), "prefs": prefs, "spaces": spaces,
            "ai": {"enabled": AI is not None, "name": infinitum.NAME, "provider": AI.name if AI else None, "model": AI.model if AI else None},
            "runner": {"enabled": RUNNER_ON}, "mail": {"enabled": mail.configured()}}
    if w.is_admin:
        boot["instance"] = {"registration": inst("registration"), "access": inst("access")}
    # «<» в данных экранируем, чтобы строка внутри JSON не смогла закрыть тег <script>
    tag = "<script>window.TRIOSTEUM_BOOT = " + json.dumps(boot, ensure_ascii=False).replace("<", "\\u003c") + ";</script>"
    html = read_html(settings.client_html).replace("<!--@@BOOT@@-->", tag, 1)
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


BRAND_DIR = Path(__file__).parent / "static" / "brand"
VENDOR_DIR = settings.client_html.parent / "vendor"


@app.get("/vendor/{rel:path}")
def vendor_file(rel: str):
    """Шрифты и Python для браузера (Pyodide) — рядом с index.html, только чтение и только внутри папки vendor."""
    root = VENDOR_DIR.resolve()
    path = (root / rel).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "Нет такого файла")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=2592000"})



@app.get("/brand/{name}")
def brand_file(name: str):
    """Логотип и иконки: для писем, страницы входа и закладок браузера."""
    path = BRAND_DIR / name
    if not re.fullmatch(r"[a-z0-9-]+\.(png|svg)", name) or not path.is_file():
        raise HTTPException(404, "Нет такого файла")
    return FileResponse(path, headers={"Cache-Control": "public, max-age=604800"})


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    w = current(request)
    if w and (w.is_admin or access_open()):
        return RedirectResponse("/", status_code=302)
    return HTMLResponse(read_html(settings.login_html))


# ---------- вход ----------

class RegisterIn(BaseModel):
    org: str = Field(min_length=1, max_length=200)
    name: str = Field(default="", max_length=120)
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    pd_consent: bool = False
    invite: str | None = Field(default=None, max_length=200)   # приглашение на сервер (kind = 'org'), если регистрация закрыта


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
    pw_hash = hash_password(body.password)               # до блокировки: хеширование медленное
    with tx() as c:
        # регистрации идут по одной: иначе две одновременные на пустом сервере обе станут администраторами
        c.execute(text("SELECT pg_advisory_xact_lock(87214)"))
        first = c.execute(text("SELECT NOT EXISTS (SELECT 1 FROM users)")).scalar_one()
        inv = None
        if body.invite:
            inv = _server_invite(c, body.invite, lock=True)
            if inv["kind"] != "org":
                raise HTTPException(422, "Это приглашение — в существующую организацию")
            _invite_email_ok(inv, email)
        elif not first and inst("registration") != "open":
            raise HTTPException(403, "Регистрация на этом сервере — только по приглашению администратора")
        if not access_open() and not first:
            raise HTTPException(423, closed_detail())
        if c.execute(text("SELECT 1 FROM users WHERE lower(email) = lower(:e)"), {"e": email}).first():
            raise HTTPException(409, "Эта почта уже зарегистрирована — войдите")
        org_id = c.execute(text("INSERT INTO organizations (name) VALUES (:n) RETURNING id"),
                           {"n": body.org.strip()}).scalar_one()
        # самый первый человек на сервере становится его администратором
        user_id = c.execute(text("INSERT INTO users (email, name, password_hash, is_admin) VALUES (:e, :n, :p, :a) RETURNING id"),
                            {"e": email, "n": body.name.strip(), "p": pw_hash, "a": bool(first)}).scalar_one()
        c.execute(text("INSERT INTO memberships (org_id, user_id, role) VALUES (:o, :u, 'owner')"),
                  {"o": org_id, "u": user_id})
        if inv:
            c.execute(text("UPDATE instance_invites SET uses = uses + 1 WHERE id = :i"), {"i": inv["id"]})
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
        u = c.execute(text("""SELECT u.id, u.email, u.name, u.password_hash, u.is_admin, m.org_id
                              FROM users u JOIN memberships m ON m.user_id = u.id
                              WHERE lower(u.email) = :e AND NOT u.disabled AND u.deleted_at IS NULL
                              ORDER BY m.created_at LIMIT 1"""), {"e": email}).mappings().first()
    if not verify_password(u["password_hash"] if u else None, body.password):
        raise HTTPException(401, "Неверная почта или пароль")
    if not u["is_admin"] and not access_open():
        raise HTTPException(423, closed_detail())
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


class ForgotIn(BaseModel):
    email: str = Field(max_length=254)


RESET_MINUTES = 60


@app.post("/api/auth/forgot")
def forgot(body: ForgotIn, request: Request):
    """Всегда отвечает одинаково, есть такая почта или нет — чтобы нельзя было проверять, кто зарегистрирован."""
    email = body.email.strip().lower()
    if not login_limiter.hit("ip:" + (client_ip(request) or "?"), "forgot:" + email):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    if not mail.configured():
        raise HTTPException(503, "Отправка писем не настроена — обратитесь к владельцу организации")
    with tx() as c:
        u = c.execute(text("SELECT id, email FROM users WHERE lower(email) = :e AND NOT disabled AND deleted_at IS NULL"), {"e": email}).mappings().first()
        if u:
            token = new_token()
            c.execute(text("DELETE FROM password_resets WHERE user_id = :u AND used_at IS NULL"), {"u": u["id"]})
            c.execute(text("""INSERT INTO password_resets (token_hash, user_id, expires_at)
                              VALUES (:h, :u, now() + make_interval(mins => :m))"""), {"h": token_hash(token), "u": u["id"], "m": RESET_MINUTES})
    if u:
        # письмо уходит в фоне: ответ приходит одинаково быстро, есть почта в базе или нет
        link = mail.public_url(str(request.base_url)) + "/reset?t=" + token
        threading.Thread(target=_quiet, args=(mail.reset_mail, u["email"], link), daemon=True).start()
    return {"ok": True}


def _quiet(fn, *args):
    try:
        fn(*args)
    except Exception:
        pass


class ResetIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Field(max_length=200)


@app.post("/api/auth/reset")
def reset_password(body: ResetIn, request: Request, response: Response):
    if not login_limiter.hit("ip:" + (client_ip(request) or "?"), "reset:" + body.token[:16]):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    if len(body.password) < 8:
        raise HTTPException(422, "Пароль — не меньше 8 символов")
    with tx() as c:
        r = c.execute(text("""UPDATE password_resets SET used_at = now()
                              WHERE token_hash = :h AND used_at IS NULL AND expires_at > now() RETURNING user_id"""),
                      {"h": token_hash(body.token)}).mappings().first()
        if not r:
            raise HTTPException(404, "Ссылка недействительна — запросите новую")
        uid = str(r["user_id"])
        c.execute(text("UPDATE users SET password_hash = :p WHERE id = :u"), {"p": hash_password(body.password), "u": uid})
        c.execute(text("DELETE FROM sessions WHERE user_id = :u"), {"u": uid})       # выйти со всех устройств
        u = c.execute(text("""SELECT u.email, u.name, m.org_id FROM users u JOIN memberships m ON m.user_id = u.id
                              WHERE u.id = :u ORDER BY m.created_at LIMIT 1"""), {"u": uid}).mappings().first()
    if not u:
        return {"ok": True}
    with tx(str(u["org_id"])) as c:
        audit(c, str(u["org_id"]), uid, "password.reset", request)
    start_session(response, request, uid, str(u["org_id"]))
    return me_out(uid, u["email"], u["name"])


@app.get("/reset", response_class=HTMLResponse)
def reset_page():
    return HTMLResponse(read_html(settings.login_html))


@app.get("/api/auth/options")
def auth_options():
    a = inst("access")
    with tx() as c:
        first = c.execute(text("SELECT NOT EXISTS (SELECT 1 FROM users)")).scalar_one()
    return {"mail": mail.configured(), "registration": "open" if first else inst("registration"),
            "access": {"open": access_open(), "message": closed_detail() if not access_open() else ""}}


@app.get("/api/me")
def me(w: Who = Depends(need)):
    return {"user": {"id": w.user_id, "email": w.email, "name": w.name, "is_admin": w.is_admin},
            "org": {"id": w.org_id, "name": w.org_name}, "role": w.role}


# ---------- пространства ----------

class SpaceIn(BaseModel):
    name: str = Field(default="Пространство", min_length=1, max_length=200)
    env: str = Field(default="code", pattern="^[a-z]{2,12}$")
    content: dict[str, Any] = Field(default_factory=dict)
    base_rev: int = Field(default=0, ge=0)


class SpacePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    env: str | None = Field(default=None, pattern="^[a-z]{2,12}$")


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


def _announce(w: Who, space_id: str, rev: int, updated_at, content: dict, request: Request):
    """Разослать новую правку тем, кто сейчас в этом пространстве (кроме вкладки, которая сохранила)."""
    hub.publish_rev(w.org_id, space_id, {"t": "rev", "rev": rev, "updated_at": updated_at.isoformat(), "by": w.name or w.email,
                                         "uid": w.user_id, "content": content}, except_sid=request.headers.get("x-live-sid"))


@app.put("/api/spaces/{space_id}")
def put_space(space_id: str, body: SpaceIn, request: Request, w: Who = Depends(need_writer)):
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
            out = {"rev": r["rev"], "updated_at": r["updated_at"].isoformat()}
    if r:
        _announce(w, space_id, r["rev"], r["updated_at"], body.content, request)
        return out
    with tx(w.org_id) as c:
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
    _announce(w, space_id, r["rev"], r["updated_at"], body.content, request)
    return JSONResponse({"rev": r["rev"], "updated_at": r["updated_at"].isoformat()}, status_code=201)


class ScheduleClaim(BaseModel):
    slot: int = Field(ge=0, le=2**62)
    token: str = Field(default="", max_length=32, pattern=r"^[A-Za-z0-9_-]*$")


class ScheduleDone(ScheduleClaim):
    last: int | None = Field(default=None, ge=0, le=2**62)   # время запуска по часам клиента


def _space_sched_last(c, org_id, space_id) -> int:
    """schedule.last из сохранённого пространства: до какого времени сроки уже выполнены."""
    v = c.execute(text("""SELECT content->'schedule'->'last' FROM spaces
                          WHERE org_id = :o AND id = :id AND deleted_at IS NULL"""), {"o": org_id, "id": space_id}).scalar()
    return int(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0 else 0


@app.post("/api/spaces/{space_id}/schedule-claim")
def schedule_claim(space_id: str, body: ScheduleClaim, w: Who = Depends(need_writer)):
    """Захват срока запуска по расписанию: из всех открытых клиентов запускает только первый.

    Срок захватывается, если он новее захваченного раньше и новее отметки schedule.last в сохранённом
    пространстве (клиент мог открыть пространство из кеша со старой отметкой); захваты чаще раза
    в 30 секунд отклоняются (у клиентов в разных часовых поясах один и тот же срок — разные числа).
    Повтор того же срока с тем же token (метка вкладки) подтверждается: ответ мог потеряться в сети.
    Тот же срок, захваченный больше 10 минут назад, можно захватить заново, только если о его запуске
    так и не пришла отметка (schedule-done): вкладка закрылась раньше — иначе расписание остановилось бы.
    При отказе возвращается последний захваченный срок, выполнен ли он и время последнего запуска (last):
    клиент с устаревшим пространством сдвигает по нему свою отметку и не просит прошедшие сроки."""
    check_id(space_id)
    with tx(w.org_id) as c:
        space_last = _space_sched_last(c, w.org_id, space_id)
        r = None
        if body.slot > space_last:
            r = c.execute(text("""INSERT INTO schedule_claims (org_id, space_id, slot, claimed_by, token) VALUES (:o, :id, :slot, :u, :t)
                                  ON CONFLICT (org_id, space_id) DO UPDATE
                                    SET slot = EXCLUDED.slot, claimed_by = EXCLUDED.claimed_by, token = EXCLUDED.token,
                                        claimed_at = CASE WHEN schedule_claims.slot = EXCLUDED.slot AND schedule_claims.token = EXCLUDED.token
                                                          THEN schedule_claims.claimed_at ELSE now() END,
                                        done_at = CASE WHEN schedule_claims.slot = EXCLUDED.slot THEN schedule_claims.done_at END,
                                        last_run = CASE WHEN schedule_claims.slot = EXCLUDED.slot THEN schedule_claims.last_run END
                                    WHERE (schedule_claims.slot < EXCLUDED.slot
                                           AND schedule_claims.claimed_at < now() - interval '30 seconds')
                                       OR (schedule_claims.slot = EXCLUDED.slot AND schedule_claims.done_at IS NULL
                                           AND ((EXCLUDED.token <> '' AND schedule_claims.token = EXCLUDED.token)
                                                OR schedule_claims.claimed_at < now() - interval '10 minutes'))
                                  RETURNING slot"""),
                          {"o": w.org_id, "id": space_id, "slot": body.slot, "u": w.user_id, "t": body.token}).first()
        if r is not None:
            return {"ok": True}
        cur = c.execute(text("SELECT slot, done_at IS NOT NULL, last_run FROM schedule_claims WHERE org_id = :o AND space_id = :id"),
                        {"o": w.org_id, "id": space_id}).first()
    last = max(space_last, (cur[2] or 0) if cur else 0)
    return {"ok": False, "slot": cur[0] if cur else None, "done": bool(cur and cur[1]), "last": last or None}


@app.post("/api/spaces/{space_id}/schedule-done")
def schedule_done(space_id: str, body: ScheduleDone, w: Who = Depends(need_writer)):
    """Отметка «срок запущен» от вкладки, которая его захватила: после неё срок заново не выдаётся.
    Повтор отметки (ответ потерялся) безопасен: время первой отметки не меняется."""
    check_id(space_id)
    with tx(w.org_id) as c:
        n = c.execute(text("""UPDATE schedule_claims SET done_at = coalesce(done_at, now()), last_run = coalesce(last_run, :last)
                              WHERE org_id = :o AND space_id = :id AND slot = :slot AND token = :t AND :t <> ''"""),
                      {"o": w.org_id, "id": space_id, "slot": body.slot, "t": body.token, "last": body.last}).rowcount
    return {"ok": bool(n)}


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


# ---------- совместная работа (WebSocket) ----------

@app.websocket("/api/ws/spaces/{space_id}")
async def live_space(ws: WebSocket, space_id: str):
    # вход — та же cookie, что у страницы; чужой сайт не подключится (проверяем Origin)
    origin = ws.headers.get("origin")
    host = ws.headers.get("host", "")
    if origin and urlsplit(origin).netloc != host and origin not in settings.allowed_origins:
        await ws.close(code=4403)
        return
    w = await asyncio.to_thread(who_by_token, ws.cookies.get(COOKIE))
    if w and not w.is_admin and not await asyncio.to_thread(access_open):
        w = None
    if not w or not SPACE_ID.match(space_id):
        await ws.close(code=4401)
        return
    await ws.accept()
    hub._n += 1
    peer = Peer(ws=ws, sid=f"s{hub._n}{new_token()[:4]}", user_id=w.user_id, name=w.name or w.email.split("@")[0],
                color=hub.color_for(w.user_id), role=w.role)
    key = (w.org_id, space_id)
    await hub.join(key, peer)
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > 20_000:
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if msg.get("t") == "presence":
                # только безопасные поля: курсор в координатах доски, выделенные объекты, открытый файл
                st = {}
                cur = msg.get("cursor")
                if isinstance(cur, dict) and all(isinstance(cur.get(k), (int, float)) for k in ("x", "y")):
                    st["cursor"] = {"x": float(cur["x"]), "y": float(cur["y"])}
                elif cur is None:
                    st["cursor"] = None
                sel = msg.get("sel")
                if isinstance(sel, list):
                    st["sel"] = [str(x)[:64] for x in sel[:50]]
                if isinstance(msg.get("file"), (str, type(None))):
                    st["file"] = (msg.get("file") or None) and str(msg["file"])[:64]
                peer.state.update(st)
                await hub.broadcast(key, {"t": "presence", "sid": peer.sid, **st}, except_sid=peer.sid)
            elif msg.get("t") == "ping":
                await hub.send(peer, {"t": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.leave(key, peer.sid)


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
    send_email: bool = True


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
    path = "/invite?t=" + token
    emailed, mail_error = False, None
    if mail.configured() and body.send_email:
        try:
            mail.invite_mail(email, w.org_name, w.name or w.email, body.role, mail.public_url(str(request.base_url)) + path)
            emailed = True
        except Exception as e:                       # письмо не ушло — ссылку всё равно показываем
            mail_error = "Письмо не отправлено: " + str(e)[:200]
    # в базе хранится только хеш токена, саму ссылку видит только владелец в этом ответе
    return {"id": str(r["id"]), "path": path, "expires_at": r["expires_at"].isoformat(), "emailed": emailed, "mail_error": mail_error}


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
    hub.kick(w.org_id, user_id)                      # открытые вкладки тоже теряют доступ сразу
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
        u = c.execute(text("SELECT id, name, password_hash, deleted_at, disabled FROM users WHERE lower(email) = lower(:e)"), {"e": email}).mappings().first()
        if u and (u["deleted_at"] or u["disabled"]):
            raise HTTPException(403, "Аккаунт " + email + " отключён администратором сервера")
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


# ---------- приглашения на сервер (выдаёт администратор) ----------

def _server_invite(c, token: str, lock: bool = False):
    r = c.execute(text("""SELECT i.*, o.name AS org_name FROM instance_invites i LEFT JOIN organizations o ON o.id = i.org_id
                           WHERE i.token_hash = :h""" + (" FOR UPDATE OF i" if lock else "")),
                  {"h": token_hash(token)}).mappings().first()
    if (not r or r["revoked_at"] is not None or r["uses"] >= r["max_uses"]
            or r["expires_at"] < datetime.now(timezone.utc)):
        raise HTTPException(404, "Приглашение не найдено или уже недействительно")
    return r


def _invite_email_ok(inv, email: str) -> None:
    if inv["email"] and inv["email"].strip().lower() != email.strip().lower():
        raise HTTPException(403, "Это приглашение выдано для другой почты")


@app.get("/api/join/{token}")
def join_info(token: str):
    with tx() as c:
        r = _server_invite(c, token)
    return {"kind": r["kind"], "org": r["org_name"], "role": r["role"], "email": r["email"],
            "expires_at": r["expires_at"].isoformat()}


class JoinIn(BaseModel):
    token: str = Field(max_length=200)
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)
    name: str = Field(default="", max_length=120)
    pd_consent: bool = False


@app.post("/api/auth/join")
def join(body: JoinIn, request: Request, response: Response):
    """Войти по приглашению сервера в существующую организацию (kind = 'member')."""
    if not login_limiter.hit("ip:" + (client_ip(request) or "?"), "join:" + body.token[:16]):
        raise HTTPException(429, "Слишком много попыток — подождите минуту")
    email = body.email.strip()
    if not EMAIL.match(email):
        raise HTTPException(422, "Проверьте почту")
    with tx() as c:
        inv = _server_invite(c, body.token, lock=True)
        if inv["kind"] != "member":
            raise HTTPException(422, "По этой ссылке создают новую организацию")
        _invite_email_ok(inv, email)
        u = c.execute(text("SELECT id, name, password_hash, is_admin, disabled, deleted_at FROM users WHERE lower(email) = lower(:e)"),
                      {"e": email}).mappings().first()
        if u and (u["deleted_at"] or u["disabled"]):
            raise HTTPException(403, "Аккаунт " + email + " отключён администратором сервера")
        if u:
            if not verify_password(u["password_hash"], body.password):
                raise HTTPException(401, "Неверный пароль от аккаунта " + email)
            user_id, name, is_admin = str(u["id"]), u["name"], u["is_admin"]
        else:
            if len(body.password) < 8:
                raise HTTPException(422, "Пароль — не меньше 8 символов")
            if not body.pd_consent:
                raise HTTPException(422, "Нужно согласие на обработку персональных данных")
            name, is_admin = body.name.strip(), False
            user_id = str(c.execute(text("INSERT INTO users (email, name, password_hash) VALUES (:e, :n, :p) RETURNING id"),
                                    {"e": email, "n": name, "p": hash_password(body.password)}).scalar_one())
        if not is_admin and not access_open():
            raise HTTPException(423, closed_detail())
        org_id = str(inv["org_id"])
        c.execute(text("""INSERT INTO memberships (org_id, user_id, role) VALUES (:o, :u, :r)
                          ON CONFLICT (org_id, user_id) DO NOTHING"""), {"o": org_id, "u": user_id, "r": inv["role"]})
        c.execute(text("UPDATE instance_invites SET uses = uses + 1 WHERE id = :i"), {"i": inv["id"]})
    with tx(org_id) as c:
        audit(c, org_id, user_id, "invite.accept", request, "server_invite", str(inv["id"]))
    start_session(response, request, user_id, org_id)
    return me_out(user_id, email, name)


@app.get("/join", response_class=HTMLResponse)
def join_page():
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


# ---------- ИИ ----------

# системный ИИ сервера — Infinitum: характер и знание Triosteum поверх подключённой модели (см. infinitum.py)
AI_TASKS = {"block", "architect", "constructor", "scheme", "office", "other"}


class AIIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=200_000)
    task: str = Field(default="other", max_length=20)
    max_tokens: int = Field(default=4000, ge=16, le=8000)


def month_tokens(c) -> int:
    return c.execute(text("""SELECT coalesce(sum(tokens_in + tokens_out), 0) FROM ai_requests
                             WHERE created_at >= date_trunc('month', now())""")).scalar_one()


@app.get("/api/ai/status")
def ai_status(w: Who = Depends(need)):
    with tx(w.org_id) as c:
        used = month_tokens(c)
        budget = c.execute(text("SELECT ai_budget_tokens FROM organizations WHERE id = :o"), {"o": w.org_id}).scalar_one()
    return {"enabled": AI is not None, "name": infinitum.NAME, "provider": AI.name if AI else None, "model": AI.model if AI else None,
            "used_tokens": int(used), "budget_tokens": int(budget)}


@app.post("/api/ai/complete")
def ai_complete(body: AIIn, w: Who = Depends(need)):
    if AI is None:
        raise HTTPException(503, "ИИ на этом сервере не подключён")
    if w.role == "viewer":
        raise HTTPException(403, "Наблюдателю ИИ недоступен")
    if not ai_limiter.hit("user:" + w.user_id):
        raise HTTPException(429, "Слишком много запросов к ИИ — подождите минуту")
    with tx(w.org_id) as c:
        used = month_tokens(c)
        budget = c.execute(text("SELECT ai_budget_tokens FROM organizations WHERE id = :o"), {"o": w.org_id}).scalar_one()
    if used >= budget:
        raise HTTPException(402, "Лимит ИИ организации на этот месяц исчерпан")
    task = body.task if body.task in AI_TASKS else "other"
    result = ai_mod.Result()
    provider = AI

    def gen():
        failed = None
        try:
            for piece in provider.stream(infinitum.system_prompt(), body.prompt, body.max_tokens, result):
                yield piece
        except ai_mod.AIError as e:
            failed = str(e)
        except httpx.HTTPError:
            failed = "Модель недоступна — проверьте, что она запущена"
        if failed:
            # ошибку отдаём отдельной строкой-маркером: браузер покажет её вместо ответа
            yield "\n\u0000ERR:" + failed
        try:
            with tx(w.org_id) as c:
                c.execute(text("""INSERT INTO ai_requests (org_id, user_id, task, model, tokens_in, tokens_out)
                                  VALUES (:o, :u, :t, :m, :i, :out)"""),
                          {"o": w.org_id, "u": w.user_id, "t": task, "m": provider.model,
                           "i": result.usage.tokens_in, "out": result.usage.tokens_out})
        except Exception:
            pass

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


# ---------- запуск Python на сервере ----------

class RunIn(BaseModel):
    code: str = Field(max_length=500_000)
    input: Any = None
    mode: str = Field(default="block", pattern="^(block|script)$")
    vars: dict[str, Any] | None = None       # переменные пространства для triosteum.var()
    secrets: dict[str, str] | None = None    # секреты, названные в коде, для triosteum.secret()


def _run_local(job: dict) -> dict:
    import sys as _sys
    runner_dir = str(Path(__file__).resolve().parents[1] / "runner")
    if runner_dir not in _sys.path:
        _sys.path.insert(0, runner_dir)
    import sandbox  # type: ignore
    return sandbox.run(job["code"], job["input"], job["mode"], job.get("vars"), job.get("secrets"))


@app.post("/api/run/python")
def run_python(body: RunIn, w: Who = Depends(need)):
    if not RUNNER_ON:
        raise HTTPException(503, "Запуск Python на сервере не подключён")
    if w.role == "viewer":
        raise HTTPException(403, "Наблюдателю запуск недоступен")
    if not run_limiter.hit("user:" + w.user_id):
        raise HTTPException(429, "Слишком много запусков — подождите минуту")
    if len(json.dumps(body.input, ensure_ascii=False, default=str)) > 1_000_000:
        raise HTTPException(413, "Входные данные слишком большие")
    if len(json.dumps([body.vars, body.secrets], ensure_ascii=False, default=str)) > 200_000:
        raise HTTPException(413, "Слишком много переменных")
    job = {"code": body.code, "input": body.input, "mode": body.mode, "vars": body.vars or {}, "secrets": body.secrets or {}}
    if RUNNER_URL:
        try:
            r = httpx.post(RUNNER_URL + "/run", json=job, headers={"X-Runner-Token": RUNNER_TOKEN}, timeout=90)
        except httpx.HTTPError:
            raise HTTPException(503, "Исполнитель Python недоступен")
        if r.status_code != 200:
            raise HTTPException(503, (r.json().get("detail") if r.headers.get("content-type", "").startswith("application/json") else None) or "Исполнитель Python недоступен")
        return r.json()
    return _run_local(job)


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
    env: str = Field(default="code", pattern="^[a-z]{2,12}$")
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


from . import admin as _admin   # noqa: E402  (панель администратора; модуль использует функции выше)
app.include_router(_admin.router)
from . import agents as _agents   # noqa: E402  (задачи для ИИ: Claude и Codex через задачи GitHub)
app.include_router(_agents.router)
