"""Библиотека организации: то, что сотрудники «наращивают» в Triosteum для своей компании.

Сейчас — плагины: сотрудник делится своим плагином с компанией, и он появляется в библиотеке у всех её сотрудников.
Другие организации эти плагины не видят (построчная защита по org_id, как у пространств).
Добавлять и обновлять могут владелец и редакторы; убрать — автор или владелец организации.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from .db import tx
from .main import Who, audit, need, need_writer

router = APIRouter(prefix="/api/org/items")

KINDS = {"plugin"}
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


@router.get("")
def get_items(kind: str | None = None, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        return {"items": list_items(c, kind)}


@router.post("", status_code=201)
def share_item(body: ItemIn, request: Request, w: Who = Depends(need_writer)):
    """Поделиться с компанией. Повторный вызов с тем же src обновляет уже опубликованное."""
    if body.kind not in KINDS:
        raise HTTPException(422, "Неизвестный вид")
    data = clean_plugin(body.data)
    raw = json.dumps(data, ensure_ascii=False)
    if len(raw.encode()) > MAX_BYTES:
        raise HTTPException(413, "Плагин слишком большой для библиотеки (больше 512 КБ)")
    with tx(w.org_id) as c:
        cur = c.execute(text("""SELECT id, created_by FROM org_items
                                WHERE kind = :k AND src = :s AND deleted_at IS NULL FOR UPDATE"""),
                        {"k": body.kind, "s": body.src}).mappings().first()
        if cur and str(cur["created_by"]) != w.user_id and w.role != "owner":
            raise HTTPException(403, "Этот плагин в библиотеке опубликовал другой сотрудник — обновить его может он или владелец")
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
            r = c.execute(text("SELECT id, name, created_by FROM org_items WHERE id = CAST(:i AS uuid) AND deleted_at IS NULL FOR UPDATE"),
                          {"i": item_id}).mappings().first()
        except Exception:
            r = None
        if not r:
            raise HTTPException(404, "В библиотеке компании такого нет")
        if str(r["created_by"]) != w.user_id and w.role != "owner":
            raise HTTPException(403, "Убрать из библиотеки может автор или владелец организации")
        c.execute(text("UPDATE org_items SET deleted_at = now(), updated_by = :u WHERE id = :i"), {"u": w.user_id, "i": r["id"]})
        audit(c, w.org_id, w.user_id, "orglib.remove", request, "org_item", item_id, {"name": r["name"]})
    return {"ok": True}
