"""Задачи для ИИ: окно администратора создаёт задачи GitHub с обращениями к Claude и Codex и показывает их ответы.
GitHub подменён: проверяем, какие запросы уходят и как ответы ботов попадают в окно."""
import re

import pytest
from fastapi import HTTPException

from conftest import register
from test_admin import new_client


class FakeGitHub:
    def __init__(self):
        self.issues, self.comments, self.calls = {}, {}, []

    def __call__(self, method, path, body=None, params=None):
        self.calls.append((method, path, body))
        m = re.match(r"/repos/[^/]+/[^/]+/issues(?:/(\d+))?(?:/(comments))?$", path)
        assert m, path
        num, sub = m.group(1), m.group(2)
        if method == "POST" and not num:
            n = len(self.issues) + 1
            self.issues[n] = {"number": n, "title": body["title"], "body": body["body"], "state": "open", "labels": body["labels"],
                              "html_url": f"https://github.com/o/r/issues/{n}", "comments": 0, "user": {"login": "LesNyXiX"},
                              "created_at": "2026-11-11T18:00:00Z", "updated_at": "2026-11-11T18:00:00Z"}
            self.comments[n] = []
            return self.issues[n]
        if method == "GET" and not num:
            return list(self.issues.values())
        n = int(num)
        if n not in self.issues:
            raise HTTPException(404, "нет")
        if sub and method == "POST":
            return self.add(n, "LesNyXiX", body["body"])
        if sub:
            return self.comments[n]
        if method == "PATCH":
            self.issues[n]["state"] = body["state"]
        return self.issues[n]

    def add(self, n, login, text):
        c = {"id": 1000 + sum(len(v) for v in self.comments.values()), "user": {"login": login}, "body": text,
             "html_url": f"https://github.com/o/r/issues/{n}#c", "created_at": "2026-11-11T18:01:00Z", "updated_at": "2026-11-11T18:01:00Z"}
        self.comments[n].append(c)
        self.issues[n]["comments"] = len(self.comments[n])
        return c


@pytest.fixture
def gh(monkeypatch):
    from app import agents
    fake = FakeGitHub()
    monkeypatch.setattr(agents, "_gh", fake)
    monkeypatch.setenv("AGENTS_GITHUB_TOKEN", "test-token")
    agents._drop_cache()
    yield fake
    agents._drop_cache()


@pytest.fixture
def boss(client, admin):
    email = register(client, org="Штаб", name="Админ")
    admin.execute("UPDATE users SET is_admin = true WHERE lower(email) = lower(%s)", (email,))
    return client


def test_not_configured_without_token(boss, monkeypatch):
    from app import agents
    monkeypatch.delenv("AGENTS_GITHUB_TOKEN", raising=False)
    agents._drop_cache()
    r = boss.get("/api/admin/agents")
    assert r.status_code == 200 and r.json()["configured"] is False
    assert boss.post("/api/admin/agents", json={"text": "сделай"}).status_code == 409


def test_only_admin(client, gh):
    other = new_client(client)
    register(other, org="Чужие")
    assert other.get("/api/admin/agents").status_code == 403
    assert other.post("/api/admin/agents", json={"text": "x"}).status_code == 403
    assert gh.calls == []


def test_task_to_both_and_replies(boss, gh):
    r = boss.post("/api/admin/agents", json={"text": "Добавь тёмную тему в отчёты\nи кнопку печати", "claude": True, "codex": True})
    assert r.status_code == 201, r.text
    n = r.json()["number"]
    issue = gh.issues[n]
    assert issue["title"] == "Добавь тёмную тему в отчёты" and issue["labels"] == ["ии-задача"]
    assert issue["body"].startswith("@claude Добавь тёмную тему")                # Claude подхватит задачу при открытии
    assert gh.comments[n][0]["body"].startswith("@codex Добавь тёмную тему")    # Codex — отдельным комментарием
    # ответы ботов: служебные HTML-комментарии скрыты, PR из ответа собраны
    gh.add(n, "claude[bot]", "<!-- sticky -->Готово: https://github.com/o/r/pull/31")
    gh.add(n, "chatgpt-codex-connector[bot]", "<!-- codex-task -->Взял в работу")
    from app import agents
    agents._drop_cache()
    d = boss.get(f"/api/admin/agents/{n}").json()
    who = [m["who"] for m in d["messages"]]
    assert who == ["owner", "claude", "codex"]                                   # задача для Codex не дублируется
    assert d["messages"][0]["to"] == ["claude", "codex"] and d["messages"][0]["text"] == "Добавь тёмную тему в отчёты\nи кнопку печати"
    assert d["messages"][1]["text"] == "Готово: https://github.com/o/r/pull/31"
    assert d["prs"] == [{"number": 31, "url": "https://github.com/LesNyXiX/triosteum/pull/31"}]
    lst = boss.get("/api/admin/agents").json()
    assert lst["configured"] and lst["tasks"][0]["number"] == n
    # записано в журнал администратора
    assert any(a["summary"].startswith("Задача для ИИ №") for a in boss.get("/api/admin/actions").json())


def test_follow_up_and_close(boss, gh):
    n = boss.post("/api/admin/agents", json={"text": "Почини поиск", "claude": True, "codex": False}).json()["number"]
    assert gh.comments[n] == []                                                   # Codex не звали
    assert boss.post(f"/api/admin/agents/{n}/messages", json={"text": "и добавь тест", "claude": False, "codex": True}).status_code == 201
    assert [c["body"] for c in gh.comments[n]] == ["@codex и добавь тест"]
    assert boss.post(f"/api/admin/agents/{n}/messages", json={"text": "оба посмотрите", "claude": True, "codex": True}).status_code == 201
    assert [c["body"] for c in gh.comments[n]][-2:] == ["@claude оба посмотрите", "@codex оба посмотрите"]
    assert boss.post(f"/api/admin/agents/{n}/messages", json={"text": "никому", "claude": False, "codex": False}).status_code == 422
    assert boss.post(f"/api/admin/agents/{n}/state", json={"open": False}).json()["state"] == "closed"
    assert gh.issues[n]["state"] == "closed"


def test_token_never_leaks(boss, gh):
    boss.post("/api/admin/agents", json={"text": "проверка"})
    for path in ("/api/admin/agents", "/api/admin/agents/1", "/api/me"):
        assert "test-token" not in boss.get(path).text
