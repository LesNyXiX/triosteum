"""Библиотека организации: то, что сотрудники «наращивают» в Triosteum для своей компании.

Плагины: сотрудник делится своим плагином с компанией, и он появляется в библиотеке у всех её сотрудников.
Среды: своя среда компании, собранная из типов блоков отраслевых сред (название, цвет, значок, блоки, шаблоны).
Расширения: код компании, который работает у сотрудников в песочнице (iframe без доступа к приложению и сети)
и добавляет свои команды и панель. Публикует только владелец организации; каждый сотрудник включает сам.
Другие организации эти плагины не видят (построчная защита по org_id, как у пространств).
Добавлять и обновлять могут владелец и редакторы; убрать — автор или владелец организации.
"""
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from .db import tx
from .main import Who, audit, need, need_writer

router = APIRouter(prefix="/api/org/items")

KINDS = {"plugin", "env", "ext"}
ENV_ID = re.compile(r"^u[a-z]{5,11}$")          # свои среды — с «u», чтобы не совпасть со встроенными
KIND_ID = re.compile(r"^[a-z0-9_-]{1,40}$")
COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
THEMES = {"burgundy", "emerald", "graphite", "midnight"}
EXT_ID = re.compile(r"^x[a-z0-9]{5,15}$")
CMD_ID = re.compile(r"^[a-z0-9_-]{1,30}$")
# что расширение может попросить; всё остальное (сеть, сервер, другие пространства) ему недоступно в принципе
EXT_PERMS = ("board.read", "board.write", "selection", "storage", "panel")
EXT_CODE_MAX = 256 * 1024
MAX_BYTES = 512 * 1024
# поля плагина, которые хранятся в библиотеке; остальное (личные пометки) отбрасывается
PLUGIN_FIELDS = ("name", "lang", "desc", "family", "codes", "params", "tpl", "io")


def item_out(r) -> dict:
    return {"id": str(r["id"]), "kind": r["kind"], "src": r["src"], "name": r["name"], "data": r["data"],
            "by": str(r["created_by"]) if r["created_by"] else None, "by_name": r.get("by_name") or "",
            "updated_at": r["updated_at"].isoformat()}


SELECT = """SELECT i.id, i.kind, i.src, i.name, i.data, i.created_by, i.updated_at,
                   coalesce(nullif(u.name, ''), u.email) AS by_name
            FROM org_items i LEFT JOIN users u ON u.id = i.created_by
            WHERE i.deleted_at IS NULL"""


def list_items(c, kind: str | None = None) -> list[dict]:
    q = SELECT + (" AND i.kind = :k" if kind else "") + " ORDER BY i.updated_at DESC"
    return [item_out(r) for r in c.execute(text(q), {"k": kind} if kind else {}).mappings()]


class ItemIn(BaseModel):
    kind: str = Field(default="plugin", max_length=20)
    src: str = Field(min_length=1, max_length=120)
    data: dict


def clean_plugin(d: dict) -> dict:
    out = {k: d[k] for k in PLUGIN_FIELDS if k in d}
    name = str(out.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "У плагина нет названия")
    if not isinstance(out.get("lang"), str) or not out["lang"]:
        raise HTTPException(422, "У плагина не указан язык")
    if "codes" in out and not isinstance(out["codes"], dict):
        raise HTTPException(422, "Код плагина в неверном формате")
    out["name"] = name[:200]
    return out


def clean_env(d: dict, src: str) -> dict:
    eid = str(d.get("id") or "")
    if not ENV_ID.match(eid) or eid != src:
        raise HTTPException(422, "Неверный идентификатор среды")
    name = str(d.get("name") or "").strip()
    if not 1 <= len(name) <= 40:
        raise HTTPException(422, "Название среды — от 1 до 40 символов")
    short = str(d.get("short") or name).strip()[:20] or name[:20]
    kinds = d.get("kinds")
    if not isinstance(kinds, list) or not 1 <= len(kinds) <= 60 or not all(isinstance(k, str) and KIND_ID.match(k) for k in kinds):
        raise HTTPException(422, "Выберите хотя бы один тип блоков среды")
    color = str(d.get("color") or "")
    if not COLOR.match(color):
        raise HTTPException(422, "Неверный цвет среды")
    out = {"id": eid, "name": name, "short": short, "color": color, "kinds": list(dict.fromkeys(kinds)),
           "ic": str(d.get("ic") or "box")[:30], "desc": str(d.get("desc") or "").strip()[:300], "step": bool(d.get("step"))}
    if d.get("theme") in THEMES:
        out["theme"] = d["theme"]
    return out


def clean_ext(d: dict, src: str, prev: dict | None) -> dict:
    xid = str(d.get("id") or "")
    if not EXT_ID.match(xid) or xid != src:
        raise HTTPException(422, "Неверный идентификатор расширения")
    name = str(d.get("name") or "").strip()
    if not 1 <= len(name) <= 40:
        raise HTTPException(422, "Название расширения — от 1 до 40 символов")
    code = d.get("code")
    if not isinstance(code, str) or not code.strip():
        raise HTTPException(422, "У расширения нет кода")
    if len(code.encode()) > EXT_CODE_MAX:
        raise HTTPException(413, "Код расширения больше 256 КБ")
    perms = d.get("perms") or []
    if not isinstance(perms, list) or not all(isinstance(p, str) and p in EXT_PERMS for p in perms):
        raise HTTPException(422, "Неизвестное разрешение расширения")
    cmds = d.get("commands") or []
    if not isinstance(cmds, list) or len(cmds) > 20:
        raise HTTPException(422, "Команд у расширения — не больше 20")
    out_cmds, seen = [], set()
    for c in cmds:
        if not isinstance(c, dict):
            raise HTTPException(422, "Команда расширения в неверном формате")
        cid, label = str(c.get("id") or ""), str(c.get("label") or "").strip()
        if not CMD_ID.match(cid) or cid in seen or not 1 <= len(label) <= 60:
            raise HTTPException(422, "У каждой команды нужен свой id (a-z, 0-9, -, _) и название до 60 символов")
        seen.add(cid)
        out_cmds.append({"id": cid, "label": label, "desc": str(c.get("desc") or "").strip()[:120]})
    order = [p for p in EXT_PERMS if p in perms]
    if not out_cmds and "panel" not in order:
        raise HTTPException(422, "Расширению нужна хотя бы одна команда или панель")
    out = {"id": xid, "name": name, "desc": str(d.get("desc") or "").strip()[:300], "ic": str(d.get("ic") or "plug")[:30],
           "perms": order, "commands": out_cmds, "code": code,
           "ver": int((prev or {}).get("ver") or 0) + 1}
    if "panel" in order:
        out["panel"] = str(d.get("panel") or name).strip()[:40] or name
    return out


@router.get("")
def get_items(kind: str | None = None, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        return {"items": list_items(c, kind)}


@router.post("", status_code=201)
def share_item(body: ItemIn, request: Request, w: Who = Depends(need_writer)):
    """Поделиться с компанией. Повторный вызов с тем же src обновляет уже опубликованное."""
    if body.kind not in KINDS:
        raise HTTPException(422, "Неизвестный вид")
    if body.kind == "ext" and w.role != "owner":
        # код расширения запускается у коллег — публикует только владелец организации
        raise HTTPException(403, "Расширения для компании публикует владелец организации")
    with tx(w.org_id) as c:
        cur = c.execute(text("""SELECT id, created_by, data FROM org_items
                                WHERE kind = :k AND src = :s AND deleted_at IS NULL FOR UPDATE"""),
                        {"k": body.kind, "s": body.src}).mappings().first()
        if body.kind == "env":
            data = clean_env(body.data, body.src)
        elif body.kind == "ext":
            data = clean_ext(body.data, body.src, cur["data"] if cur else None)
        else:
            data = clean_plugin(body.data)
        raw = json.dumps(data, ensure_ascii=False)
        if len(raw.encode()) > MAX_BYTES:
            raise HTTPException(413, "Слишком большой для библиотеки (больше 512 КБ)")
        if cur and str(cur["created_by"]) != w.user_id and w.role != "owner":
            raise HTTPException(403, ("Эту среду создал" if body.kind == "env" else "Этот плагин в библиотеке опубликовал")
                                + " другой сотрудник — изменить может он или владелец организации")
        if cur:
            c.execute(text("""UPDATE org_items SET name = :n, data = CAST(:d AS jsonb), updated_by = :u, updated_at = now()
                              WHERE id = :id"""), {"n": data["name"], "d": raw, "u": w.user_id, "id": cur["id"]})
            iid, action = cur["id"], "orglib.update"
        else:
            iid = c.execute(text("""INSERT INTO org_items (org_id, kind, src, name, data, created_by, updated_by)
                                    VALUES (:o, :k, :s, :n, CAST(:d AS jsonb), :u, :u) RETURNING id"""),
                            {"o": w.org_id, "k": body.kind, "s": body.src, "n": data["name"], "d": raw, "u": w.user_id}).scalar_one()
            action = "orglib.share"
        audit(c, w.org_id, w.user_id, action, request, "org_item", str(iid), {"name": data["name"], "kind": body.kind})
        r = c.execute(text(SELECT + " AND i.id = :id"), {"id": iid}).mappings().first()
    return item_out(r)


@router.delete("/{item_id}")
def remove_item(item_id: str, request: Request, w: Who = Depends(need_writer)):
    with tx(w.org_id) as c:
        try:
            r = c.execute(text("SELECT id, kind, src, name, created_by FROM org_items WHERE id = CAST(:i AS uuid) AND deleted_at IS NULL FOR UPDATE"),
                          {"i": item_id}).mappings().first()
        except Exception:
            r = None
        if not r:
            raise HTTPException(404, "В библиотеке компании такого нет")
        if str(r["created_by"]) != w.user_id and w.role != "owner":
            raise HTTPException(403, "Убрать из библиотеки может автор или владелец организации")
        if r["kind"] == "env":
            # среду с пространствами не удаляем; блокировка общая с созданием пространства (main.env_guard)
            c.execute(text("SELECT pg_advisory_xact_lock(hashtext('triosteum-env:' || :o || ':' || :e))"), {"o": w.org_id, "e": r["src"]})
            n = c.execute(text("SELECT count(*) FROM spaces WHERE env = :e AND deleted_at IS NULL"), {"e": r["src"]}).scalar_one()
            if n:
                raise HTTPException(409, f"В среде есть пространства ({n}). Сначала удалите или перенесите их — потом удалите среду.")
        c.execute(text("UPDATE org_items SET deleted_at = now(), updated_by = :u WHERE id = :i"), {"u": w.user_id, "i": r["id"]})
        audit(c, w.org_id, w.user_id, "orglib.remove", request, "org_item", item_id, {"name": r["name"]})
    return {"ok": True}
