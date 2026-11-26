"""Контроль брака: роли пространства, карточки и решения, повторяемый импорт."""
import base64
import binascii
import csv
import json
import re
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO, StringIO
from itertools import islice
from pathlib import Path
from unicodedata import normalize
from urllib.parse import quote
from uuid import UUID
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool

from .db import tx
from .main import SPACE_ID, Who, access_open, current, need, need_owner

router = APIRouter()
API = "/api/quality/{space}"
STATIC = Path(__file__).parent / "static"
NO_STORE = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
FIELDS = ("article", "lot", "inspected", "defects", "note")
REQUIRED = set(FIELDS[:4])
IMPORT_ROWS = 200
UPLOAD_LIMIT = 2 * 1024 * 1024


class CleanInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class SettingsIn(CleanInput):
    reviewer_id: UUID
    threshold: Decimal = Field(ge=0, le=100, decimal_places=2)
    due_hours: int = Field(ge=1, le=720)
    contributors: list[UUID] = Field(max_length=200)


class CaseIn(CleanInput):
    article: str = Field(min_length=1, max_length=100)
    lot: str = Field(min_length=1, max_length=100)
    inspected: int = Field(ge=1, le=10_000_000)
    defects: int = Field(ge=0, le=10_000_000)
    note: str = Field(default="", max_length=1000)
    photo: str | None = Field(default=None, max_length=720_000)

    @model_validator(mode="after")
    def check_counts(self):
        if self.defects > self.inspected:
            raise ValueError("Число дефектных изделий больше числа проверенных")
        if any("\0" in value for value in (self.article, self.lot, self.note)):
            raise ValueError("В тексте есть недопустимый символ")
        return self


class CorrectionIn(CleanInput):
    revision: int = Field(ge=1)
    inspected: int = Field(ge=1, le=10_000_000)
    defects: int = Field(ge=0, le=10_000_000)
    note: str = Field(default="", max_length=1000)
    photo: str | None = Field(default=None, max_length=720_000)


class DecisionIn(CleanInput):
    revision: int = Field(ge=1)
    action: str
    comment: str = Field(min_length=1, max_length=1000, pattern=r"^[^\x00]+$")


class ImportIn(CleanInput):
    rows: list[dict] = Field(min_length=1, max_length=IMPORT_ROWS)
    mapping: dict[str, str]
    save_mapping: bool = False

    @model_validator(mode="after")
    def check_mapping(self):
        if not REQUIRED <= self.mapping.keys() or set(self.mapping) - set(FIELDS):
            raise ValueError("Укажите колонки артикула, партии, проверенных изделий и брака")
        if len(set(self.mapping.values())) != len(self.mapping) or any(
            not header or len(header) > 200 or "\0" in header for header in self.mapping.values()
        ):
            raise ValueError("Каждому полю должна соответствовать отдельная колонка")
        return self


def params(space, w):
    return {"space": space, "org": w.org_id, "user": w.user_id}


def get_space(c, space, w):
    if not SPACE_ID.fullmatch(space):
        raise HTTPException(404, "Пространство не найдено")
    row = c.execute(text("SELECT name FROM spaces WHERE id=:space AND deleted_at IS NULL"),
                    params(space, w)).first()
    if row is None:
        raise HTTPException(404, "Пространство не найдено")
    return row.name


def get_settings(c, space, w, lock=False):
    clause = " FOR UPDATE" if lock else ""
    return c.execute(text("SELECT * FROM quality_settings WHERE space_id=:space" + clause),
                     params(space, w)).mappings().first()


def active_member(c, org, uid):
    return c.execute(text("""SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id
                             WHERE m.org_id=:org AND m.user_id=:uid AND NOT u.disabled AND u.deleted_at IS NULL"""),
                     {"org": org, "uid": uid}).first() is not None


def settings_out(s):
    return {k: s[k] for k in ("reviewer_id", "threshold", "due_hours", "contributors", "import_map")} if s else None


def can_submit(s, w):
    return w.role == "owner" or w.user_id in s["contributors"]


def require_submission(s, w):
    if not s or not can_submit(s, w):
        raise HTTPException(403, "Нет права отправлять проверки в этом пространстве")


def visibility(s, w):
    owner = w.role == "owner"
    reviewer = bool(s and str(s["reviewer_id"]) == w.user_id)
    contributor = bool(s and can_submit(s, w))
    if not (owner or reviewer or contributor):
        raise HTTPException(403, "Нет доступа к контролю брака в этом пространстве")
    return {"owner": owner, "reviewer_scope": reviewer, "contributor": contributor}


def history(w, action, comment=""):
    return json.dumps([{"action": action, "comment": comment, "actor": w.name or "Сотрудник",
                        "at": datetime.now(timezone.utc).isoformat()}], ensure_ascii=False)


def image_bytes(value):
    if value is None:
        return None, None
    match = re.fullmatch(r"data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)", value)
    if match:
        try:
            mime, encoded = match.groups()
            data = base64.b64decode(encoded, validate=True)
            valid = {"image/jpeg": data.startswith(b"\xff\xd8\xff"), "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
                     "image/webp": data.startswith(b"RIFF") and data[8:12] == b"WEBP"}
            if valid[mime] and len(data) <= 512 * 1024:
                return data, mime
        except binascii.Error:
            pass
    raise HTTPException(422, "Фотография должна быть JPEG, PNG или WebP размером до 512 КБ")


CASE_COLS = """id, created_by, reviewer_id, article, lot, inspected, defects, note, status,
               threshold, due_at, created_at, updated_at, revision, history, (photo IS NOT NULL) AS has_photo,
               (SELECT coalesce(nullif(u.name,''), 'Сотрудник') FROM users u
                WHERE u.id=quality_cases.reviewer_id) AS reviewer_name"""
VISIBLE = "space_id=:space AND (:owner OR (:reviewer_scope AND reviewer_id=:user) OR (:contributor AND created_by=:user))"


def case_out(row, w):
    result = dict(row)
    result["percent"] = round(100 * row["defects"] / row["inspected"], 2)
    result["mine"] = str(row["reviewer_id"]) == w.user_id
    result["can_decide"] = row["status"] == "pending" and (result["mine"] or w.role == "owner")
    result["is_author"] = str(row["created_by"]) == w.user_id
    return result


def get_case(c, space, number, w, scope, *, lock=False, photo=False):
    columns = CASE_COLS + (", photo, photo_type" if photo else "")
    suffix = " FOR UPDATE" if lock else ""
    row = c.execute(text(f"SELECT {columns} FROM quality_cases WHERE {VISIBLE} AND id=:id{suffix}"),
                    {**params(space, w), **scope, "id": number}).mappings().first()
    if row is None:
        raise HTTPException(404, "Карточка не найдена")
    return row


def route_case(c, s, body, w):
    # Сравниваем без округления процента, который показываем в интерфейсе.
    pending = body.defects * 100 > s["threshold"] * body.inspected
    reviewer = s["reviewer_id"] if pending else None
    if reviewer and not active_member(c, w.org_id, reviewer):
        reviewer = None
    return {"status": "pending" if pending else "within_limit", "reviewer": reviewer,
            "hours": s["due_hours"], "threshold": s["threshold"]}


def insert_case(c, space, s, body, w):
    keys = {key + "_key": normalize("NFC", getattr(body, key)).casefold() for key in ("article", "lot")}
    duplicate = c.execute(text("""SELECT id FROM quality_cases WHERE space_id=:space
                                  AND article_key=:article_key AND lot_key=:lot_key"""),
                          {**params(space, w), **keys}).first()
    if duplicate:
        return None
    photo, mime = image_bytes(body.photo)
    routing = route_case(c, s, body, w)
    return c.execute(text(f"""INSERT INTO quality_cases
        (org_id, space_id, created_by, reviewer_id, article, lot, article_key, lot_key, inspected, defects, note,
         photo, photo_type, status, threshold, due_at, history)
        VALUES (:org, :space, :user, :reviewer, :article, :lot, :article_key, :lot_key, :inspected, :defects, :note,
                :photo, :mime, :status, :threshold,
                CASE WHEN :status='pending' THEN now() + make_interval(hours => :hours) END, CAST(:history AS jsonb))
        ON CONFLICT DO NOTHING RETURNING {CASE_COLS}"""),
        {**params(space, w), **body.model_dump(exclude={"photo"}), **keys, **routing, "photo": photo, "mime": mime,
         "history": history(w, routing["status"])}).mappings().first()


@router.get("/quality/{space}")
def quality_page(space: str, request: Request):
    if not SPACE_ID.fullmatch(space):
        raise HTTPException(404, "Пространство не найдено")
    w = current(request)
    if not w:
        target = request.url.path + ("?" + request.url.query if request.url.query else "")
        return RedirectResponse("/login?next=" + quote(target, safe=""), status_code=302)
    if not w.is_admin and not access_open():
        return RedirectResponse("/login?closed=1", status_code=302)
    return FileResponse(STATIC / "quality.html", headers=NO_STORE)


@router.get("/quality-assets/{file}")
def quality_asset(file: str):
    if file not in ("quality.js", "quality.css"):
        raise HTTPException(404)
    return FileResponse(STATIC / file, headers=NO_STORE)


@router.get(API)
def dashboard(space: str, before: int | None = None, mine: bool = False, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        name = get_space(c, space, w)
        s = get_settings(c, space, w)
        owner = w.role == "owner"
        p = {**params(space, w), **visibility(s, w), "before": before or 2**63 - 1, "mine": mine}
        items = c.execute(text(f"""SELECT {CASE_COLS} FROM quality_cases WHERE {VISIBLE}
                                AND id < :before AND (NOT :mine OR (reviewer_id=:user AND status='pending'))
                                ORDER BY id DESC LIMIT 51"""), p).mappings().all()
        counts = c.execute(text(f"""SELECT count(*) FILTER (WHERE status='pending') AS pending,
                                 count(*) FILTER (WHERE status='pending' AND due_at < now()) AS overdue,
                                 count(*) FILTER (WHERE status='pending' AND reviewer_id=:user) AS mine,
                                 count(*) FILTER (WHERE status='pending' AND NOT EXISTS (
                                   SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id
                                   WHERE m.org_id=:org AND m.user_id=quality_cases.reviewer_id
                                   AND NOT u.disabled AND u.deleted_at IS NULL)) AS unassigned,
                                 round(avg(extract(epoch FROM updated_at-created_at)/3600)
                                   FILTER (WHERE status IN ('approved','rejected')), 1) AS avg_hours
                                 FROM quality_cases WHERE {VISIBLE}"""), p).mappings().one()
    return {"name": name, "owner": owner, "can_submit": bool(s and can_submit(s, w)), "settings": settings_out(s) if owner else None,
            "counts": dict(counts), "cases": [case_out(row, w) for row in items[:50]],
            "next": items[49]["id"] if len(items) > 50 else None}


@router.put(API + "/settings")
def save_settings(space: str, body: SettingsIn, w: Who = Depends(need_owner)):
    with tx(w.org_id) as c:
        get_space(c, space, w)
        members = set(body.contributors) | {body.reviewer_id}
        if any(not active_member(c, w.org_id, uid) for uid in members):
            raise HTTPException(422, "Выберите действующих сотрудников этой организации")
        p = {**params(space, w), "reviewer": body.reviewer_id, "threshold": body.threshold,
             "hours": body.due_hours, "contributors": json.dumps(sorted(map(str, set(body.contributors)))),
             "history": history(w, "reassigned")}
        c.execute(text("""INSERT INTO quality_settings (org_id,space_id,reviewer_id,threshold,due_hours,contributors)
                          VALUES (:org,:space,:reviewer,:threshold,:hours,CAST(:contributors AS jsonb))
                          ON CONFLICT (org_id,space_id) DO UPDATE SET reviewer_id=EXCLUDED.reviewer_id,
                          threshold=EXCLUDED.threshold,due_hours=EXCLUDED.due_hours,contributors=EXCLUDED.contributors"""), p)
        c.execute(text("""UPDATE quality_cases SET reviewer_id=:reviewer, revision=revision+1, updated_at=now(),
                          history=history || CAST(:history AS jsonb)
                          WHERE space_id=:space AND status IN ('pending','returned')
                          AND reviewer_id IS DISTINCT FROM :reviewer"""), p)
    return {"ok": True}


@router.post(API + "/cases", status_code=201)
def submit(space: str, body: CaseIn, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        get_space(c, space, w)
        s = get_settings(c, space, w, lock=True)
        require_submission(s, w)
        row = insert_case(c, space, s, body, w)
        if row is None:
            return {"duplicate": True}
        return {"case": case_out(row, w)}


@router.get(API + "/cases/{number}")
def detail(space: str, number: int, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        get_space(c, space, w)
        scope = visibility(get_settings(c, space, w), w)
        return case_out(get_case(c, space, number, w, scope), w)


@router.get(API + "/cases/{number}/photo")
def photo(space: str, number: int, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        get_space(c, space, w)
        scope = visibility(get_settings(c, space, w), w)
        row = get_case(c, space, number, w, scope, photo=True)
        if not row["photo"]:
            raise HTTPException(404, "Фотографии нет")
        return Response(bytes(row["photo"]), media_type=row["photo_type"], headers=NO_STORE)


@router.post(API + "/cases/{number}/decision")
def decide(space: str, number: int, body: DecisionIn, w: Who = Depends(need)):
    if body.action not in ("approved", "rejected", "returned"):
        raise HTTPException(422, "Выберите решение")
    with tx(w.org_id) as c:
        get_space(c, space, w)
        scope = visibility(get_settings(c, space, w, lock=True), w)
        row = get_case(c, space, number, w, scope, lock=True)
        if not scope["owner"] and not (scope["reviewer_scope"] and str(row["reviewer_id"]) == w.user_id):
            raise HTTPException(403, "Решение принимает ответственный или владелец")
        if row["revision"] != body.revision or row["status"] != "pending":
            raise HTTPException(409, "Карточка уже изменилась. Обновите её перед новым решением")
        c.execute(text("""UPDATE quality_cases SET status=:status, revision=revision+1, updated_at=now(),
                          history=history || CAST(:history AS jsonb) WHERE id=:id"""),
                  {"id": number, "status": body.action, "history": history(w, body.action, body.comment)})
        return case_out(get_case(c, space, number, w, scope), w)


@router.post(API + "/cases/{number}/resubmit")
def resubmit(space: str, number: int, body: CorrectionIn, w: Who = Depends(need)):
    with tx(w.org_id) as c:
        get_space(c, space, w)
        s = get_settings(c, space, w, lock=True)
        require_submission(s, w)
        scope = visibility(s, w)
        row = get_case(c, space, number, w, scope, lock=True)
        if str(row["created_by"]) != w.user_id:
            raise HTTPException(403, "Исправить и отправить запись может её автор")
        if row["revision"] != body.revision or row["status"] != "returned":
            raise HTTPException(409, "Карточка уже изменилась. Обновите её перед отправкой")
        try:
            entry = CaseIn(article=row["article"], lot=row["lot"], **body.model_dump(exclude={"revision"}))
        except ValidationError as e:
            raise HTTPException(422, validation_message(e)) from e
        picture, mime = image_bytes(entry.photo)
        routing = route_case(c, s, entry, w)
        c.execute(text("""UPDATE quality_cases SET inspected=:inspected, defects=:defects, note=:note,
                         photo=coalesce(:photo,photo), photo_type=coalesce(:mime,photo_type), status=:status,
                         reviewer_id=CASE WHEN :status='pending' THEN :reviewer ELSE reviewer_id END,
                         threshold=:threshold, revision=revision+1,
                         due_at=CASE WHEN :status='pending' THEN now() + make_interval(hours => :hours) END,
                         updated_at=now(), history=history || CAST(:history AS jsonb) WHERE id=:id"""),
                  {**entry.model_dump(exclude={"photo", "article", "lot"}), **routing, "id": number,
                   "photo": picture, "mime": mime, "history": history(w, "resubmitted")})
        return case_out(get_case(c, space, number, w, scope), w)


def validation_message(error):
    fields = {"article": "артикул", "lot": "партия", "inspected": "проверено", "defects": "брак", "note": "примечание"}
    first = error.errors()[0]
    loc = first["loc"]
    return "Проверьте поле «" + fields.get(loc[0], str(loc[0])) + "»" if loc else first["msg"].removeprefix("Value error, ")


def read_table(raw, kind):
    try:
        if kind == "csv":
            source = raw.decode("utf-8-sig")
            first = source.splitlines()[0]
            delimiter = max((",", ";", "\t"), key=lambda key: len(next(csv.reader([first], delimiter=key))))
            values = list(islice(csv.reader(StringIO(source), delimiter=delimiter, strict=True), IMPORT_ROWS + 2))
        elif kind == "xlsx":
            with ZipFile(BytesIO(raw)) as archive:
                if sum(i.file_size for i in archive.infolist()) > 20 * 1024 * 1024:
                    raise HTTPException(413, "Книга XLSX слишком большая после распаковки")
            workbook = load_workbook(BytesIO(raw), read_only=True, data_only=True)
            try:
                sheet = workbook.worksheets[0]
                if (sheet.max_column or 0) > 100 or (sheet.max_row or 0) > IMPORT_ROWS + 1:
                    raise HTTPException(413, "На первом листе допускается до 200 строк данных и 100 колонок")
                values = list(sheet.iter_rows(max_row=IMPORT_ROWS + 2 if sheet.max_row is None else sheet.max_row,
                                              max_col=101 if sheet.max_column is None else sheet.max_column, values_only=True))
            finally:
                workbook.close()
        else:
            raise HTTPException(415, "Поддерживаются CSV в UTF-8 и XLSX")
    except (UnicodeError, csv.Error, BadZipFile, InvalidFileException, IndexError, KeyError, ValueError, SyntaxError) as e:
        raise HTTPException(422, "Не удалось прочитать таблицу. Проверьте формат файла") from e
    if not values or len(values) > IMPORT_ROWS + 1 or max(map(len, values)) > 100:
        raise HTTPException(422, "Нужна строка заголовков и до 200 строк данных, до 100 колонок")
    headers = [str(v).strip() if v is not None else "" for v in values[0]]
    present = [header for header in headers if header]
    if not present or len(set(present)) != len(present) or any(len(h) > 200 or "\0" in h for h in present):
        raise HTTPException(422, "Заголовки колонок должны быть уникальными и не длиннее 200 символов")
    rows = []
    for line, values_row in enumerate(values[1:], 2):
        cells = {key: str(v).strip() for key, v in zip(headers, values_row) if key and v is not None}
        if any(cells.values()):
            rows.append({"line": line, "cells": cells})
    if not rows:
        raise HTTPException(422, "В таблице нет строк данных")
    return {"headers": present, "rows": rows}


@router.post(API + "/import/preview")
async def preview_import(space: str, kind: str, request: Request, w: Who = Depends(need)):
    def check():
        with tx(w.org_id) as c:
            get_space(c, space, w)
            s = get_settings(c, space, w)
            require_submission(s, w)
            return s["import_map"]

    mapping = await run_in_threadpool(check)
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > UPLOAD_LIMIT:
            raise HTTPException(413, "Файл превышает 2 МБ")
    table = await run_in_threadpool(read_table, bytes(raw), kind)
    return {**table, "mapping": mapping}


@router.post(API + "/import")
def import_cases(space: str, body: ImportIn, w: Who = Depends(need)):
    if body.save_mapping and w.role != "owner":
        raise HTTPException(403, "Общее сопоставление колонок сохраняет владелец")
    with tx(w.org_id) as c:
        get_space(c, space, w)
        # Настройки блокируем до обработки пачки, чтобы порог и ответственный были общими для всех строк.
        if body.save_mapping:
            c.execute(text("UPDATE quality_settings SET import_map=CAST(:map AS jsonb) WHERE space_id=:space"),
                      {**params(space, w), "map": json.dumps(body.mapping, ensure_ascii=False)})
        s = get_settings(c, space, w, lock=True)
        require_submission(s, w)
        result = []
        for index, row in enumerate(body.rows, 1):
            cells = row.get("cells")
            line = row.get("line")
            line = line if type(line) is int and 2 <= line <= IMPORT_ROWS + 1 else index + 1
            if not isinstance(cells, dict):
                result.append({"line": line, "status": "error", "message": "Ячейки строки не найдены"})
                continue
            fields = {key: cells.get(column) for key, column in body.mapping.items()}
            fields["note"] = fields.get("note") or ""
            try:
                entry = CaseIn.model_validate(fields)
                created = insert_case(c, space, s, entry, w)
            except ValidationError as e:
                result.append({"line": line, "status": "error", "message": validation_message(e)})
            except HTTPException as e:
                result.append({"line": line, "status": "error", "message": e.detail})
            else:
                result.append({"line": line, "status": "created", "id": created["id"]} if created else
                              {"line": line, "status": "duplicate", "message": "Артикул и партия уже есть в реестре"})
    return {"rows": result}
