"""Панель администратора сервера: регистрация и доступ, приглашения, пользователи, журнал с отменой,
точки восстановления. Все запросы — только для пользователей с флагом is_admin.

Каждое действие записывается в admin_actions вместе с обратным действием (undo). «Отменить» выполняет
обратное действие и записывает его так же — поэтому отмену можно отменить (вернуть).
"""
import json
import shutil
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from .db import tx
from .live import hub
from .main import EMAIL, INST_DEFAULTS, ROLES, Who, _inst, inst, inst_set, need
from .security import new_token, token_hash

router = APIRouter(prefix="/api/admin")

MAX_MANUAL_POINTS = 50
MAX_AUTO_POINTS = 20


def need_admin(w: Who = Depends(need)) -> Who:
    if not w.is_admin:
        raise HTTPException(403, "Это может только администратор сервера")
    return w


def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


def _record(c, w: Who, action: str, summary: str, details: dict | None = None, undo: dict | None = None) -> int:
    return c.execute(text("""INSERT INTO admin_actions (admin_id, action, summary, details, undo)
                             VALUES (:a, :ac, :s, CAST(:d AS jsonb), CAST(:u AS jsonb)) RETURNING id"""),
                     {"a": w.user_id, "ac": action, "s": summary,
                      "d": json.dumps(details, ensure_ascii=False) if details else None,
                      "u": json.dumps(undo, ensure_ascii=False) if undo else None}).scalar_one()


def _orgs(c) -> list[dict]:
    return [dict(r) for r in c.execute(text("SELECT id, name, created_at FROM organizations ORDER BY created_at")).mappings()]


def _user(c, uid: str):
    try:
        r = c.execute(text("SELECT id, email, name, is_admin, disabled, deleted_at FROM users WHERE id = CAST(:u AS uuid)"),
                      {"u": uid}).mappings().first()
    except Exception:
        r = None
    if not r:
        raise HTTPException(404, "Нет такого пользователя")
    return r


def _who(u) -> str:
    return (u["name"] or "").strip() or u["email"]


def _active_admins(c) -> int:
    return c.execute(text("SELECT count(*) FROM users WHERE is_admin AND NOT disabled AND deleted_at IS NULL")).scalar_one()


def _kick_user(uid: str):
    hub.kick_where(lambda _o, p: p.user_id == uid)


# ---------- действия (их же выполняет «Отменить») ----------

def op_registration(w: Who, mode: str) -> tuple[str, dict]:
    if mode not in ("open", "invite"):
        raise HTTPException(422, "Режим регистрации: open или invite")
    old = inst("registration")
    with tx() as c:
        inst_set(c, "registration", mode, w.user_id)
    text_mode = "открыта для всех" if mode == "open" else "только по приглашению"
    return "Регистрация " + text_mode, {"op": "registration", "mode": old}


def op_access(w: Who, open_: bool, message: str = "") -> tuple[str, dict]:
    old = inst("access")
    old = old if isinstance(old, dict) else {"open": True, "message": ""}
    with tx() as c:
        inst_set(c, "access", {"open": bool(open_), "message": (message or "")[:300]}, w.user_id)
        admins = {str(r[0]) for r in c.execute(text("SELECT id FROM users WHERE is_admin"))}
    if not open_:
        hub.kick_where(lambda _o, p: p.user_id not in admins)     # открытые вкладки остальных теряют доступ сразу
    return ("Доступ к серверу открыт для всех" if open_ else "Доступ закрыт для всех, кроме администраторов"), \
        {"op": "access", "open": bool(old.get("open", True)), "message": old.get("message") or ""}


def op_user_disabled(w: Who, uid: str, disabled: bool) -> tuple[str, dict]:
    with tx() as c:
        u = _user(c, uid)
        if disabled and str(u["id"]) == w.user_id:
            raise HTTPException(409, "Нельзя отключить самого себя")
        if disabled and u["is_admin"] and _active_admins(c) <= 1:
            raise HTTPException(409, "Должен остаться хотя бы один администратор")
        c.execute(text("UPDATE users SET disabled = :d WHERE id = :u"), {"d": disabled, "u": u["id"]})
        if disabled:
            c.execute(text("DELETE FROM sessions WHERE user_id = :u"), {"u": u["id"]})
    if disabled:
        _kick_user(uid)
    return ("Отключён вход: " if disabled else "Включён вход: ") + _who(u), {"op": "user.disabled", "user": uid, "disabled": not disabled}


def op_user_deleted(w: Who, uid: str, deleted: bool) -> tuple[str, dict]:
    with tx() as c:
        u = _user(c, uid)
        if deleted and str(u["id"]) == w.user_id:
            raise HTTPException(409, "Нельзя удалить самого себя")
        if deleted and u["is_admin"] and _active_admins(c) <= 1:
            raise HTTPException(409, "Должен остаться хотя бы один администратор")
        c.execute(text("UPDATE users SET deleted_at = " + ("now()" if deleted else "NULL") + " WHERE id = :u"), {"u": u["id"]})
        if deleted:
            c.execute(text("DELETE FROM sessions WHERE user_id = :u"), {"u": u["id"]})
    if deleted:
        _kick_user(uid)
    return ("Удалён пользователь: " if deleted else "Восстановлен пользователь: ") + _who(u), \
        {"op": "user.deleted", "user": uid, "deleted": not deleted}


def op_user_admin(w: Who, uid: str, flag: bool) -> tuple[str, dict]:
    with tx() as c:
        u = _user(c, uid)
        if not flag and u["is_admin"] and _active_admins(c) <= 1:
            raise HTTPException(409, "Должен остаться хотя бы один администратор")
        if not flag and str(u["id"]) == w.user_id:
            raise HTTPException(409, "Нельзя снять права администратора с самого себя")
        c.execute(text("UPDATE users SET is_admin = :f WHERE id = :u"), {"f": flag, "u": u["id"]})
    return ("Назначен администратором: " if flag else "Сняты права администратора: ") + _who(u), \
        {"op": "user.admin", "user": uid, "flag": not flag}


def op_invite_revoked(w: Who, iid: str, revoked: bool) -> tuple[str, dict]:
    with tx() as c:
        try:
            r = c.execute(text("UPDATE instance_invites SET revoked_at = " + ("now()" if revoked else "NULL")
                               + " WHERE id = CAST(:i AS uuid) RETURNING note, kind"), {"i": iid}).mappings().first()
        except Exception:
            r = None
    if not r:
        raise HTTPException(404, "Нет такого приглашения")
    what = r["note"] or ("новая организация" if r["kind"] == "org" else "вход в организацию")
    return ("Отозвано приглашение: " if revoked else "Возвращено приглашение: ") + what, \
        {"op": "invite.revoked", "invite": iid, "revoked": not revoked}


def op_point_restore(w: Who, pid: int) -> tuple[str, dict]:
    with tx() as c:
        p = c.execute(text("SELECT id, label, data FROM restore_points WHERE id = :p"), {"p": pid}).mappings().first()
    if not p:
        raise HTTPException(404, "Нет такой точки восстановления")
    before = _make_point(w, "Перед восстановлением «" + p["label"] + "»", None, "auto")
    _apply_point(w, p["data"], p["label"])
    return "Восстановлена точка «" + p["label"] + "»", {"op": "point.restore", "point": before}


def op_point_delete(w: Who, pid: int) -> tuple[str, None]:
    with tx() as c:
        r = c.execute(text("DELETE FROM restore_points WHERE id = :p RETURNING label"), {"p": pid}).scalar_one_or_none()
    if r is None:
        raise HTTPException(404, "Нет такой точки восстановления")
    return "Удалена точка «" + r + "»", None


def run_op(w: Who, op: dict) -> tuple[str, dict | None]:
    kind = op.get("op")
    if kind == "registration":
        return op_registration(w, op["mode"])
    if kind == "access":
        return op_access(w, op["open"], op.get("message") or "")
    if kind == "user.disabled":
        return op_user_disabled(w, op["user"], op["disabled"])
    if kind == "user.deleted":
        return op_user_deleted(w, op["user"], op["deleted"])
    if kind == "user.admin":
        return op_user_admin(w, op["user"], op["flag"])
    if kind == "invite.revoked":
        return op_invite_revoked(w, op["invite"], op["revoked"])
    if kind == "point.restore":
        return op_point_restore(w, int(op["point"]))
    if kind == "point.delete":
        return op_point_delete(w, int(op["point"]))
    raise HTTPException(422, "Это действие нельзя отменить")


def do(w: Who, action: str, op: dict, details: dict | None = None) -> dict:
    summary, undo = run_op(w, op)
    with tx() as c:
        aid = _record(c, w, action, summary, details, undo)
    return {"ok": True, "action": aid, "summary": summary}


# ---------- точки восстановления ----------

def _snapshot_data() -> tuple[dict, dict]:
    with tx() as c:
        users = [{"id": str(r["id"]), "disabled": r["disabled"], "deleted_at": _iso(r["deleted_at"]), "is_admin": r["is_admin"]}
                 for r in c.execute(text("SELECT id, disabled, deleted_at, is_admin FROM users")).mappings()]
        mem = [{"org": str(r["org_id"]), "user": str(r["user_id"]), "role": r["role"]}
               for r in c.execute(text("SELECT org_id, user_id, role FROM memberships")).mappings()]
        orgs = [{"id": str(o["id"]), "name": o["name"]} for o in _orgs(c)]
        # действующие значения всех настроек, в том числе ещё не менявшихся (значения по умолчанию)
        settings = {**INST_DEFAULTS, **{k: v for k, v in c.execute(text("SELECT key, value FROM instance_settings")).all()}}
    spaces, size = [], 0
    for o in orgs:
        with tx(o["id"]) as c:
            for r in c.execute(text("""SELECT id, name, env, rev, content, deleted_at, length(content::text) AS n
                                       FROM spaces""")).mappings():
                spaces.append({"org": o["id"], "id": r["id"], "name": r["name"], "env": r["env"], "rev": r["rev"],
                               "content": r["content"], "deleted_at": _iso(r["deleted_at"])})
                size += r["n"] or 0
    data = {"v": 1, "settings": settings, "users": users, "memberships": mem, "orgs": orgs, "spaces": spaces}
    stats = {"users": sum(1 for u in users if not u["deleted_at"]), "orgs": len(orgs),
             "spaces": sum(1 for s in spaces if not s["deleted_at"]), "bytes": size}
    return data, stats


def _make_point(w: Who, label: str, note: str | None, kind: str) -> int:
    data, stats = _snapshot_data()
    with tx() as c:
        pid = c.execute(text("""INSERT INTO restore_points (label, note, kind, stats, data, created_by)
                                VALUES (:l, :n, :k, CAST(:s AS jsonb), CAST(:d AS jsonb), :u) RETURNING id"""),
                        {"l": label[:200], "n": note, "k": kind, "s": json.dumps(stats), "d": json.dumps(data, ensure_ascii=False),
                         "u": w.user_id}).scalar_one()
        # старые автоматические и лишние ручные точки уходят
        keep = MAX_AUTO_POINTS if kind == "auto" else MAX_MANUAL_POINTS
        c.execute(text("""DELETE FROM restore_points WHERE kind = :k AND id NOT IN
                          (SELECT id FROM restore_points WHERE kind = :k ORDER BY created_at DESC LIMIT :n)"""), {"k": kind, "n": keep})
    return pid


def _apply_point(w: Who, data: dict, label: str) -> None:
    """Вернуть сервер к точке: настройки, пользователи, участники, пространства. Себя администратор не отключает."""
    snap_users = {u["id"]: u for u in data.get("users", [])}
    snap_orgs = {o["id"] for o in data.get("orgs", [])}
    mem_by_org: dict[str, dict[str, str]] = {}
    for m in data.get("memberships", []):
        mem_by_org.setdefault(m["org"], {})[m["user"]] = m["role"]
    kicked: set[str] = set()
    with tx() as c:
        snap_settings = data.get("settings") or {}
        for k, v in snap_settings.items():
            inst_set(c, k, v, w.user_id)
        # настройки, которых в точке не было, возвращаются к значению по умолчанию
        c.execute(text("DELETE FROM instance_settings WHERE NOT (key = ANY(:keys))"), {"keys": list(snap_settings)})
        _inst["t"] = 0.0
        existing = {str(r[0]): r for r in c.execute(text("SELECT id, disabled, deleted_at, is_admin FROM users")).all()}
        for uid in existing:
            if uid == w.user_id:
                continue
            su = snap_users.get(uid)
            if su is None:                                  # появился после точки — убираем (вернуть можно точкой «Перед восстановлением»)
                c.execute(text("UPDATE users SET deleted_at = coalesce(deleted_at, now()) WHERE id = CAST(:u AS uuid)"), {"u": uid})
                kicked.add(uid)
                continue
            c.execute(text("""UPDATE users SET disabled = :d, deleted_at = CAST(:x AS timestamptz), is_admin = :a
                              WHERE id = CAST(:u AS uuid)"""),
                      {"d": su["disabled"], "x": su["deleted_at"], "a": su["is_admin"], "u": uid})
            if su["disabled"] or su["deleted_at"]:
                kicked.add(uid)
        for oid in snap_orgs:
            want = mem_by_org.get(oid, {})
            cur = {str(r[0]): r[1] for r in c.execute(text("SELECT user_id, role FROM memberships WHERE org_id = CAST(:o AS uuid)"),
                                                     {"o": oid}).all()}
            for uid in cur:
                if uid not in want and uid != w.user_id:
                    c.execute(text("DELETE FROM memberships WHERE org_id = CAST(:o AS uuid) AND user_id = CAST(:u AS uuid)"), {"o": oid, "u": uid})
                    kicked.add(uid)
            for uid, role in want.items():
                if uid in existing:
                    c.execute(text("""INSERT INTO memberships (org_id, user_id, role) VALUES (CAST(:o AS uuid), CAST(:u AS uuid), :r)
                                      ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role"""), {"o": oid, "u": uid, "r": role})
        if kicked:
            c.execute(text("DELETE FROM sessions WHERE user_id = ANY(CAST(:ids AS uuid[]))"), {"ids": list(kicked)})
        live_orgs = {str(o["id"]) for o in _orgs(c)}
        admins = {str(r[0]) for r in c.execute(text("SELECT id FROM users WHERE is_admin AND NOT disabled AND deleted_at IS NULL"))}
    for uid in kicked:
        _kick_user(uid)
    access = snap_settings.get("access", INST_DEFAULTS["access"])
    if isinstance(access, dict) and access.get("open") is False:
        # в точке доступ был закрыт: открытые вкладки всех, кроме администраторов, теряют доступ сразу
        hub.kick_where(lambda _o, p: p.user_id not in admins)
    # пространства: изменённые получают новую правку (прежняя остаётся в истории версий), новые — удаляются (30 дней можно вернуть)
    by_org: dict[str, dict[str, dict]] = {}
    for s in data.get("spaces", []):
        by_org.setdefault(s["org"], {})[s["id"]] = s
    for oid in (snap_orgs | set(by_org)) & live_orgs:
        want = by_org.get(oid, {})
        announce = []
        with tx(oid) as c:
            cur = {r["id"]: r for r in c.execute(text("SELECT id, name, env, rev, content::text AS c, deleted_at FROM spaces")).mappings()}
            for sid, s in want.items():
                cj = json.dumps(s["content"], ensure_ascii=False)
                r = cur.get(sid)
                if r is None:
                    c.execute(text("""INSERT INTO spaces (org_id, id, name, env, content, rev, created_by, updated_by, deleted_at)
                                      VALUES (CAST(:o AS uuid), :id, :n, :e, CAST(:c AS jsonb), 1, :u, :u, CAST(:x AS timestamptz))"""),
                              {"o": oid, "id": sid, "n": s["name"], "e": s["env"], "c": cj, "u": w.user_id, "x": s["deleted_at"]})
                    continue
                same = (json.loads(r["c"]) == s["content"] and r["name"] == s["name"] and r["env"] == s["env"]
                        and bool(r["deleted_at"]) == bool(s["deleted_at"]))
                if same:
                    continue
                # прежнее содержимое — в историю версий с подписью (если автоснимок этой правки уже есть — подписываем его)
                c.execute(text("""INSERT INTO space_versions (org_id, space_id, rev, content, label, created_by)
                                  VALUES (CAST(:o AS uuid), :s, :r, CAST(:c AS jsonb), :l, :u)
                                  ON CONFLICT (org_id, space_id, rev) DO UPDATE SET label = EXCLUDED.label"""),
                          {"o": oid, "s": sid, "r": r["rev"], "c": r["c"], "l": ("До восстановления точки «" + label + "»")[:200], "u": w.user_id})
                nr = c.execute(text("""UPDATE spaces SET name = :n, env = :e, content = CAST(:c AS jsonb), rev = rev + 1,
                                              updated_by = :u, updated_at = now(), deleted_at = CAST(:x AS timestamptz)
                                       WHERE id = :id RETURNING rev, updated_at"""),
                               {"n": s["name"], "e": s["env"], "c": cj, "u": w.user_id, "x": s["deleted_at"], "id": sid}).mappings().first()
                if not s["deleted_at"]:
                    announce.append((sid, nr["rev"], nr["updated_at"], s["content"]))
            for sid, r in cur.items():
                if sid not in want and r["deleted_at"] is None:
                    c.execute(text("UPDATE spaces SET deleted_at = now() WHERE id = :id"), {"id": sid})
        for sid, rev, at, content in announce:          # открытые вкладки получают восстановленное содержимое
            hub.publish_rev(oid, sid, {"t": "rev", "rev": rev, "updated_at": at.isoformat(), "by": w.name or w.email,
                                       "uid": w.user_id, "content": content})


# ---------- обзор ----------

@router.get("/overview")
def overview(w: Who = Depends(need_admin)):
    since = datetime.now(timezone.utc).date() - timedelta(days=13)
    days = {(since + timedelta(days=i)).isoformat(): {"logins": 0, "saves": 0, "joins": 0} for i in range(14)}
    with tx() as c:
        u = c.execute(text("""SELECT count(*) FILTER (WHERE deleted_at IS NULL AND NOT disabled) AS active,
                                     count(*) FILTER (WHERE deleted_at IS NULL AND disabled) AS disabled,
                                     count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted,
                                     count(*) FILTER (WHERE is_admin AND deleted_at IS NULL) AS admins FROM users""")).mappings().first()
        orgs = _orgs(c)
        sessions = c.execute(text("SELECT count(DISTINCT user_id) FROM sessions WHERE expires_at > now()")).scalar_one()
        for d, n in c.execute(text("""SELECT created_at::date, count(*) FROM users WHERE created_at::date >= :s GROUP BY 1"""), {"s": since}).all():
            if d.isoformat() in days:
                days[d.isoformat()]["joins"] = n
        db_bytes = c.execute(text("SELECT pg_database_size(current_database())")).scalar_one()
        last_point = c.execute(text("SELECT id, label, created_at FROM restore_points ORDER BY created_at DESC LIMIT 1")).mappings().first()
        pending = c.execute(text("""SELECT count(*) FROM instance_invites WHERE revoked_at IS NULL AND uses < max_uses
                                    AND expires_at > now()""")).scalar_one()
    spaces = 0
    for o in orgs:
        with tx(str(o["id"])) as c:
            spaces += c.execute(text("SELECT count(*) FROM spaces WHERE deleted_at IS NULL")).scalar_one()
            for d, n in c.execute(text("""SELECT created_at::date, count(*) FROM audit_log WHERE action = 'login'
                                          AND created_at::date >= :s GROUP BY 1"""), {"s": since}).all():
                if d.isoformat() in days:
                    days[d.isoformat()]["logins"] += n
            for d, n in c.execute(text("""SELECT created_at::date, count(*) FROM space_versions
                                          WHERE created_at::date >= :s GROUP BY 1"""), {"s": since}).all():
                if d.isoformat() in days:
                    days[d.isoformat()]["saves"] += n
    try:
        du = shutil.disk_usage("/")
        disk = {"total": du.total, "used": du.used, "free": du.free}
    except OSError:
        disk = None
    return {"users": dict(u), "orgs": len(orgs), "spaces": spaces, "sessions": sessions, "online": len(hub.online_users()),
            "registration": inst("registration"), "access": inst("access"), "invites_active": pending,
            "db_bytes": db_bytes, "disk": disk,
            "last_point": {"id": last_point["id"], "label": last_point["label"], "created_at": last_point["created_at"].isoformat()} if last_point else None,
            "days": [{"date": k, **v} for k, v in days.items()]}


# ---------- регистрация и доступ ----------

class RegistrationIn(BaseModel):
    mode: str


@router.post("/registration")
def set_registration(body: RegistrationIn, w: Who = Depends(need_admin)):
    return do(w, "registration", {"op": "registration", "mode": body.mode})


class AccessIn(BaseModel):
    open: bool
    message: str = Field(default="", max_length=300)


@router.post("/access")
def set_access(body: AccessIn, w: Who = Depends(need_admin)):
    return do(w, "access", {"op": "access", "open": body.open, "message": body.message})


# ---------- пользователи и организации ----------

@router.get("/users")
def users(w: Who = Depends(need_admin)):
    online = hub.online_users()
    with tx() as c:
        rows = c.execute(text("""SELECT u.id, u.email, u.name, u.is_admin, u.disabled, u.deleted_at, u.created_at, u.last_login_at,
                                        coalesce(json_agg(json_build_object('org', o.id, 'org_name', o.name, 'role', m.role)
                                                 ORDER BY m.created_at) FILTER (WHERE o.id IS NOT NULL), '[]') AS orgs,
                                        (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions
                                 FROM users u LEFT JOIN memberships m ON m.user_id = u.id LEFT JOIN organizations o ON o.id = m.org_id
                                 GROUP BY u.id ORDER BY u.created_at""")).mappings().all()
    return {"me": w.user_id, "users": [{
        "id": str(r["id"]), "email": r["email"], "name": r["name"], "is_admin": r["is_admin"], "disabled": r["disabled"],
        "deleted": r["deleted_at"] is not None, "deleted_at": _iso(r["deleted_at"]), "created_at": _iso(r["created_at"]),
        "last_login": _iso(r["last_login_at"]), "orgs": [{"id": str(o["org"]), "name": o["org_name"], "role": o["role"]} for o in r["orgs"]],
        "sessions": r["sessions"], "online": str(r["id"]) in online} for r in rows]}


@router.get("/orgs")
def orgs(w: Who = Depends(need_admin)):
    with tx() as c:
        rows = c.execute(text("""SELECT o.id, o.name, o.created_at, count(m.user_id) AS members
                                 FROM organizations o LEFT JOIN memberships m ON m.org_id = o.id
                                 GROUP BY o.id ORDER BY o.created_at""")).mappings().all()
    return [{"id": str(r["id"]), "name": r["name"], "members": r["members"], "created_at": _iso(r["created_at"])} for r in rows]


@router.post("/users/{uid}/disable")
def disable_user(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.disable", {"op": "user.disabled", "user": uid, "disabled": True})


@router.post("/users/{uid}/enable")
def enable_user(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.enable", {"op": "user.disabled", "user": uid, "disabled": False})


@router.delete("/users/{uid}")
def delete_user(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.delete", {"op": "user.deleted", "user": uid, "deleted": True})


@router.post("/users/{uid}/restore")
def restore_user(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.restore", {"op": "user.deleted", "user": uid, "deleted": False})


@router.post("/users/{uid}/admin")
def grant_admin(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.admin", {"op": "user.admin", "user": uid, "flag": True})


@router.delete("/users/{uid}/admin")
def revoke_admin(uid: str, w: Who = Depends(need_admin)):
    return do(w, "user.unadmin", {"op": "user.admin", "user": uid, "flag": False})


@router.delete("/users/{uid}/purge")
def purge_user(uid: str, w: Who = Depends(need_admin)):
    """Удалить навсегда: только уже удалённого пользователя. Организации, где больше никого нет, удаляются вместе с ним."""
    with tx() as c:
        u = _user(c, uid)
        if u["deleted_at"] is None:
            raise HTTPException(409, "Сначала удалите пользователя — навсегда удаляются только удалённые")
        lonely = [str(r[0]) for r in c.execute(text("""SELECT m.org_id FROM memberships m WHERE m.user_id = :u
                                                       AND NOT EXISTS (SELECT 1 FROM memberships x WHERE x.org_id = m.org_id AND x.user_id <> :u)"""),
                                               {"u": u["id"]}).all()]
        c.execute(text("DELETE FROM users WHERE id = :u"), {"u": u["id"]})
        if lonely:
            c.execute(text("DELETE FROM organizations WHERE id = ANY(CAST(:ids AS uuid[]))"), {"ids": lonely})
        _record(c, w, "user.purge", "Удалён навсегда: " + _who(u), {"orgs_removed": len(lonely)})
    return {"ok": True, "orgs_removed": len(lonely)}


# ---------- приглашения на сервер ----------

class ServerInviteIn(BaseModel):
    kind: str = Field(default="org", pattern="^(org|member)$")
    org_id: str | None = None
    role: str = "editor"
    email: str | None = Field(default=None, max_length=254)
    note: str = Field(default="", max_length=200)
    max_uses: int = Field(default=1, ge=1, le=1000)
    days: int = Field(default=7, ge=1, le=365)


@router.get("/invites")
def list_invites(w: Who = Depends(need_admin)):
    with tx() as c:
        rows = c.execute(text("""SELECT i.id, i.kind, i.role, i.email, i.note, i.max_uses, i.uses, i.created_at, i.expires_at, i.revoked_at,
                                        o.name AS org_name
                                 FROM instance_invites i LEFT JOIN organizations o ON o.id = i.org_id
                                 ORDER BY i.created_at DESC LIMIT 200""")).mappings().all()
    now = datetime.now(timezone.utc)

    def state(r):
        if r["revoked_at"]:
            return "revoked"
        if r["uses"] >= r["max_uses"]:
            return "used"
        return "expired" if r["expires_at"] < now else "active"
    return [{"id": str(r["id"]), "kind": r["kind"], "org": r["org_name"], "role": r["role"], "email": r["email"], "note": r["note"],
             "uses": r["uses"], "max_uses": r["max_uses"], "created_at": _iso(r["created_at"]), "expires_at": _iso(r["expires_at"]),
             "state": state(r)} for r in rows]


@router.post("/invites", status_code=201)
def create_invite(body: ServerInviteIn, w: Who = Depends(need_admin)):
    email = (body.email or "").strip() or None
    if email and not EMAIL.match(email):
        raise HTTPException(422, "Проверьте почту")
    org_name = None
    if body.kind == "member":
        if body.role not in ROLES:
            raise HTTPException(422, "Неверная роль")
        with tx() as c:
            try:
                org_name = c.execute(text("SELECT name FROM organizations WHERE id = CAST(:o AS uuid)"), {"o": body.org_id or ""}).scalar_one_or_none()
            except Exception:
                org_name = None
        if not org_name:
            raise HTTPException(422, "Выберите организацию")
    token = new_token()
    note = body.note.strip() or None
    with tx() as c:
        r = c.execute(text("""INSERT INTO instance_invites (token_hash, kind, org_id, role, email, note, max_uses, created_by, expires_at)
                              VALUES (:h, :k, CAST(:o AS uuid), :r, :e, :n, :m, :u, now() + make_interval(days => :d))
                              RETURNING id, expires_at"""),
                      {"h": token_hash(token), "k": body.kind, "o": body.org_id if body.kind == "member" else None,
                       "r": body.role if body.kind == "member" else None, "e": email, "n": note, "m": body.max_uses,
                       "u": w.user_id, "d": body.days}).mappings().first()
        what = note or ("новая организация" if body.kind == "org" else "вход в «" + org_name + "»")
        _record(c, w, "invite.create", "Создано приглашение: " + what, {"kind": body.kind, "max_uses": body.max_uses},
                {"op": "invite.revoked", "invite": str(r["id"]), "revoked": True})
    # в базе только хеш токена: саму ссылку администратор видит один раз, в этом ответе
    return {"id": str(r["id"]), "path": "/join?t=" + token, "expires_at": r["expires_at"].isoformat()}


@router.delete("/invites/{iid}")
def revoke_invite(iid: str, w: Who = Depends(need_admin)):
    return do(w, "invite.revoke", {"op": "invite.revoked", "invite": iid, "revoked": True})


# ---------- журнал и отмена ----------

@router.get("/actions")
def actions(w: Who = Depends(need_admin), limit: int = 100):
    with tx() as c:
        rows = c.execute(text("""SELECT a.id, a.action, a.summary, a.details, a.undo IS NOT NULL AS can_undo, a.undone_at, a.created_at,
                                        coalesce(nullif(u.name, ''), u.email) AS who
                                 FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
                                 ORDER BY a.created_at DESC, a.id DESC LIMIT :n"""), {"n": max(1, min(limit, 500))}).mappings().all()
    return [{"id": r["id"], "action": r["action"], "summary": r["summary"], "by": r["who"], "created_at": _iso(r["created_at"]),
             "can_undo": r["can_undo"] and r["undone_at"] is None, "undone_at": _iso(r["undone_at"])} for r in rows]


@router.post("/actions/{aid}/undo")
def undo(aid: int, w: Who = Depends(need_admin)):
    with tx() as c:
        a = c.execute(text("SELECT id, summary, undo, undone_at FROM admin_actions WHERE id = :i FOR UPDATE"), {"i": aid}).mappings().first()
        if not a:
            raise HTTPException(404, "Нет такого действия")
        if a["undo"] is None:
            raise HTTPException(409, "Это действие нельзя отменить")
        if a["undone_at"] is not None:
            raise HTTPException(409, "Действие уже отменено")
        c.execute(text("UPDATE admin_actions SET undone_at = now(), undone_by = :u WHERE id = :i"), {"u": w.user_id, "i": aid})
    try:
        summary, inverse = run_op(w, a["undo"])
    except HTTPException:
        with tx() as c:
            c.execute(text("UPDATE admin_actions SET undone_at = NULL, undone_by = NULL WHERE id = :i"), {"i": aid})
        raise
    with tx() as c:
        nid = _record(c, w, "undo", "Отмена: " + a["summary"], {"of": aid, "result": summary}, inverse)
    return {"ok": True, "action": nid, "summary": "Отменено: " + a["summary"]}


# ---------- точки восстановления ----------

class PointIn(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    note: str = Field(default="", max_length=1000)


@router.get("/points")
def points(w: Who = Depends(need_admin)):
    with tx() as c:
        rows = c.execute(text("""SELECT p.id, p.label, p.note, p.kind, p.stats, p.created_at, coalesce(nullif(u.name, ''), u.email) AS who
                                 FROM restore_points p LEFT JOIN users u ON u.id = p.created_by
                                 ORDER BY p.created_at DESC, p.id DESC""")).mappings().all()
    return [{"id": r["id"], "label": r["label"], "note": r["note"], "kind": r["kind"], "stats": r["stats"],
             "by": r["who"], "created_at": _iso(r["created_at"])} for r in rows]


@router.post("/points", status_code=201)
def create_point(body: PointIn, w: Who = Depends(need_admin)):
    pid = _make_point(w, body.label.strip(), body.note.strip() or None, "manual")
    with tx() as c:
        stats = c.execute(text("SELECT stats FROM restore_points WHERE id = :p"), {"p": pid}).scalar_one()
        _record(c, w, "point.create", "Сохранена точка «" + body.label.strip() + "»", {"point": pid},
                {"op": "point.delete", "point": pid})
    return {"id": pid, "stats": stats}


@router.post("/points/{pid}/restore")
def restore_point(pid: int, w: Who = Depends(need_admin)):
    return do(w, "point.restore", {"op": "point.restore", "point": pid}, {"point": pid})


@router.delete("/points/{pid}")
def delete_point(pid: int, w: Who = Depends(need_admin)):
    return do(w, "point.delete", {"op": "point.delete", "point": pid}, {"point": pid})

