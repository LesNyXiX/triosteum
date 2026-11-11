import json
import re

import pytest
from fastapi.testclient import TestClient

from conftest import register


def boot(client):
    html = client.get("/").text
    m = re.search(r"window\.TRIOSTEUM_BOOT = (.*?);</script>", html)
    assert m, "в странице нет данных пользователя"
    return json.loads(m.group(1))


def put(client, sid, content, rev, name="Цех"):
    return client.put(f"/api/spaces/{sid}", json={"name": name, "env": "code", "content": content, "base_rev": rev})


# ---------- вход ----------

def test_register_login_logout(client):
    email = register(client)
    assert client.get("/api/me").json()["role"] == "owner"
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
    assert client.get("/", follow_redirects=False).headers["location"] == "/login"
    r = client.post("/api/auth/login", json={"email": email.upper(), "password": "password123"})
    assert r.status_code == 200
    assert client.get("/api/me").status_code == 200


def test_register_rules(client):
    base = {"org": "З", "email": "a@b.ru", "password": "password123", "pd_consent": True}
    assert client.post("/api/auth/register", json={**base, "pd_consent": False}).status_code == 422
    assert client.post("/api/auth/register", json={**base, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={**base, "email": "нет-почты"}).status_code == 422
    email = register(client)
    assert client.post("/api/auth/register", json={**base, "email": email}).status_code == 409


def test_wrong_password_same_message(client):
    email = register(client)
    client.cookies.clear()
    a = client.post("/api/auth/login", json={"email": email, "password": "wrong-pass"})
    b = client.post("/api/auth/login", json={"email": "nobody@zavod.ru", "password": "wrong-pass"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_login_rate_limit(client):
    email = register(client)
    client.cookies.clear()
    codes = [client.post("/api/auth/login", json={"email": email, "password": "bad-pass-1"}).status_code for _ in range(12)]
    assert 429 in codes
    assert client.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 429


def test_password_stored_as_argon2(client, admin):
    email = register(client)
    h = admin.execute("SELECT password_hash FROM users WHERE email = %s", (email,)).fetchone()[0]
    assert h.startswith("$argon2id$") and "password123" not in h


def test_session_cookie_flags(client):
    r = client.post("/api/auth/register", json={"org": "З", "email": "c@zavod.ru", "password": "password123", "pd_consent": True})
    sc = r.headers["set-cookie"].lower()
    assert "httponly" in sc and "samesite=lax" in sc


# ---------- пространства ----------

def test_space_create_update_conflict(client):
    register(client)
    r = put(client, "p1", {"nodes": [1]}, 0)
    assert r.status_code == 201 and r.json()["rev"] == 1
    assert put(client, "p1", {"nodes": [1, 2]}, 1).json()["rev"] == 2
    stale = put(client, "p1", {"nodes": ["старое"]}, 1)        # правка поверх устаревшей версии
    assert stale.status_code == 409
    assert stale.json()["content"] == {"nodes": [1, 2]} and stale.json()["rev"] == 2
    assert client.get("/api/spaces/p1").json()["content"] == {"nodes": [1, 2]}


def test_space_rename_delete(client):
    register(client)
    put(client, "s1", {}, 0)
    assert client.patch("/api/spaces/s1", json={"name": "Новое имя"}).status_code == 200
    assert client.get("/api/spaces/s1").json()["name"] == "Новое имя"
    assert client.delete("/api/spaces/s1").status_code == 200
    assert client.get("/api/spaces/s1").status_code == 404
    assert [s for s in boot(client)["spaces"] if s["id"] == "s1"] == []
    assert put(client, "s1", {"again": True}, 0).status_code == 201    # тот же id можно создать заново


def test_industry_envs(client):
    register(client)
    for env in ("wh", "mes", "fin", "hr", "crm", "bi", "photo", "vector"):
        r = client.put(f"/api/spaces/e-{env}", json={"name": env, "env": env, "content": {}, "base_rev": 0})
        assert r.status_code == 201, r.text
        assert client.get(f"/api/spaces/e-{env}").json()["env"] == env
    bad = client.put("/api/spaces/e-bad", json={"name": "x", "env": "DROP TABLE", "content": {}, "base_rev": 0})
    assert bad.status_code == 422


def test_bad_space_id(client):
    register(client)
    assert put(client, "../etc", {}, 0).status_code in (404, 422)
    assert put(client, "a" * 65, {}, 0).status_code == 422


def test_versions(client):
    register(client)
    put(client, "v1", {"n": 1}, 0)
    put(client, "v1", {"n": 2}, 1)
    assert client.post("/api/spaces/v1/versions", json={"label": "Перед отпуском"}).status_code == 201
    vs = client.get("/api/spaces/v1/versions").json()
    assert any(v["label"] == "Перед отпуском" for v in vs) and len(vs) >= 2


# ---------- изоляция организаций ----------

def test_org_isolation(client):
    register(client, org="Завод А")
    put(client, "secret", {"tajna": "А"}, 0, name="Секрет А")
    other = TestClient(client.app, base_url="http://testserver")
    register(other, org="Завод Б")
    assert other.get("/api/spaces/secret").status_code == 404
    assert put(other, "secret", {"hack": True}, 0).status_code == 201       # создаётся СВОЁ пространство Б
    assert client.get("/api/spaces/secret").json()["content"] == {"tajna": "А"}   # у А ничего не изменилось
    assert other.delete("/api/spaces/nope").status_code == 404
    assert "Секрет А" not in json.dumps(boot(other), ensure_ascii=False)
    assert [s["name"] for s in other.get("/api/spaces").json()] == ["Цех"]


def test_rls_blocks_even_without_app_filter(client, admin):
    """Даже прямой SQL от роли приложения без указания организации ничего не видит."""
    register(client)
    put(client, "rls", {"x": 1}, 0)
    import psycopg, os
    url = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(url) as c:
        assert c.execute("SELECT count(*) FROM spaces").fetchone()[0] == 0


# ---------- роли ----------

def test_viewer_cannot_write(client, admin):
    register(client)
    put(client, "ro", {"a": 1}, 0)
    org = client.get("/api/me").json()["org"]["id"]
    viewer = TestClient(client.app, base_url="http://testserver")
    email = register(viewer, org="Временная")
    uid = viewer.get("/api/me").json()["user"]["id"]
    admin.execute("INSERT INTO memberships (org_id, user_id, role) VALUES (%s, %s, 'viewer')", (org, uid))
    admin.execute("DELETE FROM memberships WHERE user_id = %s AND org_id <> %s", (uid, org))
    viewer.cookies.clear()
    assert viewer.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 200
    assert viewer.get("/api/me").json()["role"] == "viewer"
    assert viewer.get("/api/spaces/ro").status_code == 200
    assert put(viewer, "ro", {"hack": 1}, 1).status_code == 403
    assert viewer.delete("/api/spaces/ro").status_code == 403


def test_schedule_claim(client, admin):
    register(client)
    put(client, "sc", {"a": 1}, 0)
    claim = lambda c, slot: c.post("/api/spaces/sc/schedule-claim", json={"slot": slot})
    assert claim(client, 1000).json() == {"ok": True}
    assert claim(client, 1000).json() == {"ok": False, "slot": 1000, "done": False, "last": None}, "второй клиент не запускает тот же срок"
    assert claim(client, 2000).json()["ok"] is False, "новый срок раньше чем через 30 с не захватывается"
    admin.execute("UPDATE schedule_claims SET claimed_at = now() - interval '1 minute'")
    assert claim(client, 900).json()["ok"] is False, "старый срок не захватывается"
    assert claim(client, 2000).json() == {"ok": True}
    assert claim(client, -1).status_code == 422
    tclaim = lambda c, slot, t: c.post("/api/spaces/sc/schedule-claim", json={"slot": slot, "token": t})
    admin.execute("UPDATE schedule_claims SET claimed_at = now() - interval '1 minute'")
    assert tclaim(client, 3000, "tabA").json() == {"ok": True}
    assert tclaim(client, 3000, "tabA").json() == {"ok": True}, "ответ потерялся — повтор той же вкладкой подтверждается"
    assert tclaim(client, 3000, "tabB").json()["ok"] is False, "другая вкладка тот же срок не получает"
    assert claim(client, 3000).json()["ok"] is False, "без метки повтор не подтверждается"
    admin.execute("UPDATE schedule_claims SET claimed_at = now() - interval '11 minutes'")
    assert tclaim(client, 3000, "tabB").json() == {"ok": True}, "незавершённый захват старше 10 минут можно взять заново"
    # срок, о запуске которого пришла отметка, заново не выдаётся даже спустя 10 минут
    done = lambda c, slot, t: c.post("/api/spaces/sc/schedule-done", json={"slot": slot, "token": t})
    c_done = lambda c, slot, t, last: c.post("/api/spaces/sc/schedule-done", json={"slot": slot, "token": t, "last": last})
    assert done(client, 3000, "tabA").json() == {"ok": False}, "отметку ставит только вкладка, захватившая срок"
    assert done(client, 3000, "tabB").json() == {"ok": True}
    admin.execute("UPDATE schedule_claims SET claimed_at = now() - interval '11 minutes'")
    assert tclaim(client, 3000, "tabC").json() == {"ok": False, "slot": 3000, "done": True, "last": None}, "выполненный срок не повторяется, клиент узнаёт об этом"
    assert tclaim(client, 3000, "tabB").json()["ok"] is False, "и той же вкладке после отметки"
    assert tclaim(client, 4000, "tabC").json() == {"ok": True}, "следующий срок захватывается как обычно"
    # отметка с временем запуска: клиент с устаревшим пространством получает его и сдвигает свой срок
    assert c_done(client, 4000, "tabC", 4500).json() == {"ok": True}
    assert c_done(client, 4000, "tabC", 9999).json() == {"ok": True}, "повтор отметки безопасен"
    assert tclaim(client, 4000, "tabD").json() == {"ok": False, "slot": 4000, "done": True, "last": 4500}, "время первого запуска не перезаписано"
    # пространство сохранено с schedule.last: сроки до этой отметки не выдаются никому, даже новые
    put(client, "sc", {"a": 1, "schedule": {"on": True, "last": 8000}}, 1)
    admin.execute("UPDATE schedule_claims SET claimed_at = now() - interval '1 minute'")
    assert tclaim(client, 6000, "tabE").json() == {"ok": False, "slot": 4000, "done": True, "last": 8000}, "срок раньше отметки в пространстве не выдаётся"
    assert tclaim(client, 9000, "tabE").json() == {"ok": True}, "срок после отметки — как обычно"
    assert tclaim(client, 4000, "bad token!").status_code == 422
    other = TestClient(client.app, base_url="http://testserver")
    register(other, org="Другой завод")
    assert claim(other, 5000).json() == {"ok": True}, "у другой организации свои захваты"


# ---------- защита запросов ----------

def test_csrf_foreign_origin_rejected(client):
    register(client)
    r = client.put("/api/spaces/x", json={"content": {}, "base_rev": 0}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    r = client.put("/api/spaces/x", json={"content": {}, "base_rev": 0}, headers={"Sec-Fetch-Site": "cross-site"})
    assert r.status_code == 403
    assert client.put("/api/spaces/x", json={"content": {}, "base_rev": 0}, headers={"Origin": "http://testserver"}).status_code == 201


def test_body_size_limit(client):
    register(client)
    r = client.put("/api/spaces/big", content=b"{}", headers={"Content-Type": "application/json", "Content-Length": str(50 * 1024 * 1024)})
    assert r.status_code == 413


def test_boot_escapes_script(client):
    register(client)
    put(client, "xss", {"t": "</script><script>alert(1)</script>"}, 0, name="</script><img src=x onerror=alert(1)>")
    html = client.get("/").text
    data = html.split("window.TRIOSTEUM_BOOT = ", 1)[1].split(";</script>", 1)[0]
    assert "</script>" not in data and "<img" not in data
    assert boot(client)["spaces"][0]["name"] == "</script><img src=x onerror=alert(1)>"


# ---------- настройки и перенос ----------

def test_prefs_in_boot(client):
    register(client)
    assert client.put("/api/prefs/ui", json={"value": {"theme": "emerald"}}).status_code == 200
    assert client.put("/api/prefs/bad name", json={"value": 1}).status_code == 422
    assert boot(client)["prefs"]["ui"] == {"theme": "emerald"}


def test_import(client):
    register(client)
    put(client, "p1", {"server": True}, 0)
    r = client.post("/api/import", json={"spaces": [{"id": "p1", "name": "Из браузера", "content": {"local": True}},
                                                     {"id": "loc2", "name": "Второе", "env": "docs", "content": {}}],
                                         "prefs": {"my": [1, 2], "bad name": 1}})
    assert r.json() == {"spaces": 2}
    names = {s["name"]: s for s in boot(client)["spaces"]}
    assert names["Цех"]["content"] == {"server": True}                 # существующее не затёрто
    assert names["Из браузера"]["id"] != "p1" and names["Из браузера"]["content"] == {"local": True}
    assert names["Второе"]["env"] == "docs"
    assert boot(client)["prefs"]["my"] == [1, 2]


def test_audit_log(client, admin):
    email = register(client)
    put(client, "a1", {}, 0)
    client.delete("/api/spaces/a1")
    acts = [r[0] for r in admin.execute("""SELECT action FROM audit_log a JOIN users u ON u.id = a.user_id
                                           WHERE u.email = %s ORDER BY a.id""", (email,))]
    assert acts[:1] == ["register"] and "space.delete" in acts


def test_forwarded_for_not_trusted_by_default(client):
    """Подставной X-Forwarded-For не помогает обойти ограничение попыток входа."""
    email = register(client)
    client.cookies.clear()
    codes = [client.post("/api/auth/login", json={"email": email, "password": "bad-pass-1"},
                         headers={"X-Forwarded-For": f"10.0.0.{i}"}).status_code for i in range(12)]
    assert 429 in codes


def test_vendor_files_served_safely(client):
    """Шрифты из vendor/ отдаются; выйти за пределы папки нельзя."""
    r = client.get("/vendor/fonts/inter-latin-wght-normal.woff2")
    assert r.status_code == 200 and len(r.content) > 10_000
    assert "max-age" in r.headers.get("cache-control", "")
    for bad in ("/vendor/../index.html", "/vendor/%2e%2e/index.html", "/vendor/fonts/../../index.html", "/vendor/nope.woff2"):
        assert client.get(bad).status_code == 404, bad
