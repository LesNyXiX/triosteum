"""Общие данные расширения внутри компании (разрешение «org.storage»).

Расширение само на сервер не ходит (песочница без сети): запрос делает Triosteum от имени сотрудника, проверив,
что расширение включено у него и просит «org.storage». Сервер дополнительно проверяет, что расширение опубликовано
в этой организации, не выключено и действительно объявило «org.storage». Читать может любой сотрудник,
менять — редактор и владелец (наблюдатель только смотрит). Другие организации этих данных не видят (RLS).
"""
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text

from .db import tx
from .main import Who, need, need_writer

router = APIRouter(prefix="/api/org/ext-data")

EXT_ID = re.compile(r"^x[a-z0-9]{5,15}$")
VALUE_MAX = 64 * 1024        # одно значение
EXT_MAX = 2 * 1024 * 1024    # все данные одного расширения
KEYS_MAX = 500


def ext_with_storage(c, src: str) -> None:
    if not EXT_ID.match(src):
        raise HTTPException(404, "Такого расширения нет")
    ok = c.execute(text("""SELECT 1 FROM org_items WHERE kind = 'ext' AND src = :s AND deleted_at IS NULL AND NOT disabled
                           AND data->'perms' ? 'org.storage'"""), {"s": src}).first()
    if not ok:
        raise HTTPException(404, "Расширение не опубликовано в компании, выключено или не просит общие данные компании")


def clean_key(key: str) -> str:
    key = key.strip()
    if not 1 <= len(key) <= 100:
        raise HTTPException(422, "Ключ — от 1 до 100 символов")
    return key


@router.get("/{src}")
def get_all(src: str, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        ext_with_storage(c, src)
        rows = c.execute(text("SELECT key, value FROM org_ext_data WHERE ext_src = :s ORDER BY key"), {"s": src}).mappings()
        return {"data": {r["key"]: r["value"] for r in rows}}


class ValueIn(BaseModel):
    value: object = None


@router.put("/{src}/{key}")
def put_value(src: str, key: str, body: ValueIn, request: Request, w: Who = Depends(need_writer)):
    key = clean_key(key)
    with tx(w.org_id) as c:
        ext_with_storage(c, src)
        # блокировка на расширение: пределы считаются без гонок
        c.execute(text("SELECT pg_advisory_xact_lock(hashtext('triosteum-extdata:' || :o || ':' || :s))"), {"o": w.org_id, "s": src})
        if body.value is None:
            c.execute(text("DELETE FROM org_ext_data WHERE ext_src = :s AND key = :k"), {"s": src, "k": key})
            return {"ok": True}
        raw = json.dumps(body.value, ensure_ascii=False)
        size = len(raw.encode())
        if size > VALUE_MAX:
            raise HTTPException(413, "Значение больше 64 КБ")
        st = c.execute(text("""SELECT count(*) AS n, coalesce(sum(bytes), 0) AS b FROM org_ext_data
                               WHERE ext_src = :s AND key <> :k"""), {"s": src, "k": key}).mappings().first()
        if st["n"] >= KEYS_MAX:
            raise HTTPException(413, "У расширения уже 500 ключей в общих данных")
        if st["b"] + size > EXT_MAX:
            raise HTTPException(413, "Общие данные расширения больше 2 МБ")
        c.execute(text("""INSERT INTO org_ext_data (org_id, ext_src, key, value, bytes, updated_by)
                          VALUES (:o, :s, :k, CAST(:v AS jsonb), :b, :u)
                          ON CONFLICT (org_id, ext_src, key) DO UPDATE
                          SET value = EXCLUDED.value, bytes = EXCLUDED.bytes, updated_by = EXCLUDED.updated_by, updated_at = now()"""),
                  {"o": w.org_id, "s": src, "k": key, "v": raw, "b": size, "u": w.user_id})
    return {"ok": True}
