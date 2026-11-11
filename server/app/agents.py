"""Задачи для ИИ: окно в панели администратора, откуда владелец отдаёт задачи Claude и Codex.

Хранилище — задачи (Issues) GitHub-репозитория проекта с меткой «ии-задача»:
  * задача с адресатом Claude — в тексте есть «@claude», её подхватывает workflow .github/workflows/claude.yml
    (Claude по подписке владельца, без платного ключа API);
  * адресат Codex — отдельный комментарий «@codex …», его подхватывает приложение Codex (по подписке ChatGPT).
Ответы обоих — комментарии в той же задаче; окно читает их отсюда.

Нужен токен GitHub владельца (AGENTS_GITHUB_TOKEN в .env, доступ только к этому репозиторию: Issues — чтение и запись).
Без токена окно показывает, как его подключить. Токен никогда не уходит в браузер.
"""
import os
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .admin import _record, need_admin
from .db import tx
from .main import Who

router = APIRouter(prefix="/api/admin/agents")

API = "https://api.github.com"
LABEL = "ии-задача"
BOTS = {"claude[bot]": "claude", "chatgpt-codex-connector[bot]": "codex", "github-actions[bot]": "system"}
_cache: dict[str, tuple[float, object]] = {}


def _cfg() -> tuple[str, str]:
    return os.environ.get("AGENTS_GITHUB_TOKEN", "").strip(), os.environ.get("AGENTS_REPO", "LesNyXiX/triosteum").strip()


def _gh(method: str, path: str, body: dict | None = None, params: dict | None = None):
    """Запрос к GitHub REST от имени владельца. Ошибки — понятным текстом, без токена в сообщении."""
    token, _ = _cfg()
    if not token:
        raise HTTPException(409, "Не подключён токен GitHub — см. инструкцию в окне")
    try:
        with httpx.Client(timeout=httpx.Timeout(20, connect=10)) as client:
            r = client.request(method, API + path, json=body, params=params, headers={
                "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "triosteum-agents"})
    except httpx.HTTPError:
        raise HTTPException(502, "GitHub не отвечает — попробуйте ещё раз")
    if r.status_code in (401, 403):
        raise HTTPException(502, "GitHub не принял токен — проверьте AGENTS_GITHUB_TOKEN и его права (Issues: чтение и запись)")
    if r.status_code == 404:
        raise HTTPException(404, "На GitHub нет такой задачи или у токена нет доступа к репозиторию")
    if r.status_code >= 400:
        raise HTTPException(502, f"GitHub ответил ошибкой {r.status_code}")
    return r.json() if r.content else None


def _cached(key: str, ttl: float, fn):
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl:
        return hit[1]
    v = fn()
    _cache[key] = (time.monotonic(), v)
    return v


def _drop_cache():
    _cache.clear()


def _who(login: str, owner: str) -> str:
    if login in BOTS:
        return BOTS[login]
    if login.lower().startswith("claude"):
        return "claude"
    if "codex" in login.lower() or login.lower().startswith("chatgpt"):
        return "codex"
    return "owner" if login.lower() == owner.lower() else "other"


_MENTION = re.compile(r"(^|\s)@(claude|codex)\b[:,]?\s*", re.I)
_HIDDEN = re.compile(r"<!--.*?-->", re.S)


def _clean(body: str | None) -> str:
    """Текст для окна: без скрытых HTML-комментариев (служебные отметки ботов) и без наших обращений @claude/@codex."""
    s = _HIDDEN.sub("", body or "")
    s = _MENTION.sub(lambda m: m.group(1), s)
    return s.strip()


def _to(body: str | None) -> list[str]:
    s = (body or "").lower()
    return [n for n in ("claude", "codex") if "@" + n in s]


def _task(i: dict) -> dict:
    return {"number": i["number"], "title": i["title"], "state": i["state"], "url": i["html_url"],
            "comments": i.get("comments", 0), "created_at": i["created_at"], "updated_at": i["updated_at"]}


class TaskIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    title: str | None = Field(default=None, max_length=120)
    claude: bool = True
    codex: bool = True


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    claude: bool = True
    codex: bool = False


def _need_target(claude: bool, codex: bool):
    if not claude and not codex:
        raise HTTPException(422, "Выберите, кому задача: Claude, Codex или обоим")


def _title(text: str, title: str | None) -> str:
    t = (title or "").strip() or text.strip().splitlines()[0]
    t = re.sub(r"\s+", " ", _MENTION.sub(" ", t)).strip() or "Задача"
    return t[:100] + ("…" if len(t) > 100 else "")


@router.get("")
def list_tasks(w: Who = Depends(need_admin)):
    token, repo = _cfg()
    if not token:
        return {"configured": False, "repo": repo, "tasks": []}
    items = _cached("list", 10, lambda: _gh("GET", f"/repos/{repo}/issues",
                                            params={"labels": LABEL, "state": "all", "per_page": 50, "sort": "updated"}))
    return {"configured": True, "repo": repo, "tasks": [_task(i) for i in items if "pull_request" not in i]}


@router.post("", status_code=201)
def create_task(body: TaskIn, w: Who = Depends(need_admin)):
    _need_target(body.claude, body.codex)
    _, repo = _cfg()
    text_ = body.text.strip()
    # Claude подхватывает «@claude» в самой задаче (workflow на открытие задачи); Codex — отдельный комментарий
    head = "@claude " if body.claude else ""
    issue = _gh("POST", f"/repos/{repo}/issues", {
        "title": _title(text_, body.title), "labels": [LABEL],
        "body": head + text_ + "\n\n---\n_Задача из окна «Задачи для ИИ» на сервере Triosteum._"})
    if body.codex:
        _gh("POST", f"/repos/{repo}/issues/{issue['number']}/comments", {"body": "@codex " + text_})
    _drop_cache()
    with tx() as c:
        _record(c, w, "agents.task", f"Задача для ИИ №{issue['number']}: {issue['title']}",
                {"number": issue["number"], "to": [n for n, on in (("claude", body.claude), ("codex", body.codex)) if on]})
    return _task(issue)


@router.get("/{number}")
def get_task(number: int, w: Who = Depends(need_admin)):
    _, repo = _cfg()

    def load():
        issue = _gh("GET", f"/repos/{repo}/issues/{number}")
        comments = _gh("GET", f"/repos/{repo}/issues/{number}/comments", params={"per_page": 100})
        return issue, comments

    issue, comments = _cached(f"t{number}", 5, load)
    if "pull_request" in issue:
        raise HTTPException(404, "Это не задача, а PR")
    owner = issue["user"]["login"]
    msgs = [{"id": "i", "who": _who(owner, owner), "to": _to(issue.get("body")), "text": _clean(issue.get("body")),
             "at": issue["created_at"], "edited": issue["updated_at"], "url": issue["html_url"]}]
    first = msgs[0]["text"].split("\n\n---\n")[0].strip()
    msgs[0]["text"] = first
    for cm in comments:
        t = _clean(cm.get("body"))
        if not t:
            continue
        who = _who(cm["user"]["login"], owner)
        if who == "owner" and t == first:
            # та же задача, отправленная Codex отдельным комментарием, — в окне это одно сообщение «обоим»
            msgs[0]["to"] = sorted(set(msgs[0]["to"]) | set(_to(cm.get("body"))))
            continue
        msgs.append({"id": cm["id"], "who": who, "to": _to(cm.get("body")), "text": t,
                     "at": cm["created_at"], "edited": cm["updated_at"], "url": cm["html_url"]})
    # PR, которые ссылаются на задачу (Claude и Codex пишут «#N» или «Closes #N»)
    prs = sorted({int(n) for m in msgs if m["who"] in ("claude", "codex")
                  for n in re.findall(r"/pull/(\d+)", m["text"])})
    return {**_task(issue), "messages": msgs, "prs": [{"number": n, "url": f"https://github.com/{repo}/pull/{n}"} for n in prs]}


@router.post("/{number}/messages", status_code=201)
def add_message(number: int, body: MessageIn, w: Who = Depends(need_admin)):
    _need_target(body.claude, body.codex)
    _, repo = _cfg()
    t = body.text.strip()
    if body.claude:
        _gh("POST", f"/repos/{repo}/issues/{number}/comments", {"body": "@claude " + t})
    if body.codex:
        # Codex — отдельным сообщением: так каждый отвечает на своё и не путается в чужом обращении
        _gh("POST", f"/repos/{repo}/issues/{number}/comments", {"body": "@codex " + t})
    _drop_cache()
    return {"ok": True}


class StateIn(BaseModel):
    open: bool


@router.post("/{number}/state")
def set_state(number: int, body: StateIn, w: Who = Depends(need_admin)):
    _, repo = _cfg()
    issue = _gh("PATCH", f"/repos/{repo}/issues/{number}", {"state": "open" if body.open else "closed"})
    _drop_cache()
    return _task(issue)
