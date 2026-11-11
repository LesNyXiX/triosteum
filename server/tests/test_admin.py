"""Панель администратора сервера: регистрация по приглашению, доступ, пользователи, журнал с отменой, точки восстановления."""
import uuid

import pytest
from fastapi.testclient import TestClient

from conftest import register


def new_client(client):
    return TestClient(client.app, base_url="http://testserver")


def mail():
    return f"a{uuid.uuid4().hex[:8]}@zavod.ru"


@pytest.fixture
def boss(client, admin):
    """Администратор сервера (флаг ставим напрямую) и сброс настроек сервера после теста."""
    from app.main import _inst
    email = register(client, org="Головной завод", name="Админ")
    admin.execute("UPDATE users SET is_admin = true WHERE lower(email) = lower(%s)", (email,))
    yield client
    admin.execute("DELETE FROM instance_settings")
    _inst["t"] = 0.0


def last_action(boss):
    return boss.get("/api/admin/actions").json()[0]


def test_only_admin_sees_panel(client, boss):
    other = new_client(client)
    register(other, org="Чужой завод")
    assert other.get("/api/admin/overview").status_code == 403
    assert other.get("/api/me").json()["user"]["is_admin"] is False
    o = boss.get("/api/admin/overview")
    assert o.status_code == 200, o.text
    d = o.json()
    assert d["users"]["active"] >= 2 and d["orgs"] >= 2 and len(d["days"]) == 14
    assert boss.get("/api/me").json()["user"]["is_admin"] is True


def test_registration_by_invite_only(client, boss):
    assert boss.post("/api/admin/registration", json={"mode": "invite"}).status_code == 200
    guest = new_client(client)
    assert guest.get("/api/auth/options").json()["registration"] == "invite"
    body = {"org": "Новый цех", "name": "Петя", "email": mail(), "password": "password123", "pd_consent": True}
    r = guest.post("/api/auth/register", json=body)
    assert r.status_code == 403 and "приглашению" in r.json()["detail"]
    inv = boss.post("/api/admin/invites", json={"kind": "org", "note": "Для Пети", "max_uses": 1, "days": 3})
    assert inv.status_code == 201, inv.text
    token = inv.json()["path"].split("t=", 1)[1]
    assert guest.get(f"/api/join/{token}").json()["kind"] == "org"
    r = guest.post("/api/auth/register", json={**body, "invite": token})
    assert r.status_code == 201, r.text
    assert guest.get("/api/me").json()["role"] == "owner"
    # одноразовая ссылка больше не работает
    assert new_client(client).get(f"/api/join/{token}").status_code == 404
    listed = boss.get("/api/admin/invites").json()
    assert next(i for i in listed if i["id"] == inv.json()["id"])["state"] == "used"
    # отмена смены режима — снова открыто
    reg = next(a for a in boss.get("/api/admin/actions").json() if a["summary"].startswith("Регистрация"))
    assert boss.post(f"/api/admin/actions/{reg['id']}/undo").status_code == 200
    assert guest.get("/api/auth/options").json()["registration"] == "open"


def test_member_invite_and_email_lock(client, boss):
    org = boss.get("/api/me").json()["org"]["id"]
    who = mail()
    inv = boss.post("/api/admin/invites", json={"kind": "member", "org_id": org, "role": "viewer", "email": who})
    assert inv.status_code == 201, inv.text
    token = inv.json()["path"].split("t=", 1)[1]
    guest = new_client(client)
    info = guest.get(f"/api/join/{token}").json()
    assert info["kind"] == "member" and info["role"] == "viewer" and info["org"] == "Головной завод"
    bad = guest.post("/api/auth/join", json={"token": token, "email": mail(), "password": "password123", "pd_consent": True})
    assert bad.status_code == 403
    ok = guest.post("/api/auth/join", json={"token": token, "email": who, "password": "password123", "name": "Оля", "pd_consent": True})
    assert ok.status_code == 200, ok.text
    me = guest.get("/api/me").json()
    assert me["role"] == "viewer" and me["org"]["id"] == org
    # приглашение «в организацию» нельзя использовать для создания новой
    inv2 = boss.post("/api/admin/invites", json={"kind": "member", "org_id": org, "role": "editor", "max_uses": 5})
    t2 = inv2.json()["path"].split("t=", 1)[1]
    r = new_client(client).post("/api/auth/register", json={"org": "X", "email": mail(), "password": "password123", "pd_consent": True, "invite": t2})
    assert r.status_code == 422
    # отзыв и его отмена
    assert boss.delete(f"/api/admin/invites/{inv2.json()['id']}").status_code == 200
    assert new_client(client).get(f"/api/join/{t2}").status_code == 404
    assert boss.post(f"/api/admin/actions/{last_action(boss)['id']}/undo").status_code == 200
    assert new_client(client).get(f"/api/join/{t2}").status_code == 200


def test_disable_delete_and_undo(client, boss):
    guest = new_client(client)
    email = register(guest, org="Цех Отключение")
    uid = guest.get("/api/me").json()["user"]["id"]
    assert boss.post(f"/api/admin/users/{uid}/disable").status_code == 200
    assert guest.get("/api/me").status_code == 401                       # сессии закрыты сразу
    assert new_client(client).post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 401
    assert boss.post(f"/api/admin/actions/{last_action(boss)['id']}/undo").status_code == 200
    assert guest.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 200
    # удаление — мягкое: вход закрыт, пользователь в списке с пометкой; отмена возвращает
    assert boss.delete(f"/api/admin/users/{uid}").status_code == 200
    u = next(x for x in boss.get("/api/admin/users").json()["users"] if x["id"] == uid)
    assert u["deleted"] is True
    assert guest.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 401
    act = last_action(boss)
    assert boss.post(f"/api/admin/actions/{act['id']}/undo").status_code == 200
    assert boss.post(f"/api/admin/actions/{act['id']}/undo").status_code == 409     # второй раз — уже отменено
    assert guest.post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 200
    # отмену можно отменить (вернуть удаление)
    redo = last_action(boss)
    assert redo["summary"].startswith("Отмена") and redo["can_undo"]
    assert boss.post(f"/api/admin/actions/{redo['id']}/undo").status_code == 200
    assert next(x for x in boss.get("/api/admin/users").json()["users"] if x["id"] == uid)["deleted"] is True
    # навсегда — организация, где больше никого нет, уходит вместе с ним
    r = boss.delete(f"/api/admin/users/{uid}/purge")
    assert r.status_code == 200 and r.json()["orgs_removed"] == 1
    assert all(x["id"] != uid for x in boss.get("/api/admin/users").json()["users"])


def test_cannot_lock_out_self(client, boss):
    me = boss.get("/api/me").json()["user"]["id"]
    assert boss.post(f"/api/admin/users/{me}/disable").status_code == 409
    assert boss.delete(f"/api/admin/users/{me}").status_code == 409
    assert boss.delete(f"/api/admin/users/{me}/admin").status_code == 409


def test_close_access_for_everyone_but_admins(client, boss):
    guest = new_client(client)
    email = register(guest, org="Цех Закрыто")
    assert boss.post("/api/admin/access", json={"open": False, "message": "обновление до 18:00"}).status_code == 200
    r = guest.get("/api/me")
    assert r.status_code == 423 and "обновление до 18:00" in r.json()["detail"]
    assert guest.get("/", follow_redirects=False).headers["location"] == "/login?closed=1"
    assert new_client(client).post("/api/auth/login", json={"email": email, "password": "password123"}).status_code == 423
    opts = guest.get("/api/auth/options").json()
    assert opts["access"]["open"] is False and "18:00" in opts["access"]["message"]
    assert boss.get("/api/me").status_code == 200                         # администратор работает как обычно
    assert boss.post(f"/api/admin/actions/{last_action(boss)['id']}/undo").status_code == 200
    assert guest.get("/api/me").status_code == 200


def test_restore_point_and_undo(client, boss):
    assert boss.put("/api/spaces/rp1", json={"name": "Цех", "content": {"v": 1}, "base_rev": 0}).status_code == 201
    p = boss.post("/api/admin/points", json={"label": "До экспериментов", "note": "проверка"})
    assert p.status_code == 201, p.text
    assert p.json()["stats"]["spaces"] >= 1
    rev = boss.get("/api/spaces/rp1").json()["rev"]
    assert boss.put("/api/spaces/rp1", json={"name": "Цех", "content": {"v": 2}, "base_rev": rev}).status_code == 200
    assert boss.put("/api/spaces/rp2", json={"name": "Новое", "content": {"x": 1}, "base_rev": 0}).status_code == 201
    guest = new_client(client)
    later = register(guest, org="Появился позже")
    r = boss.post(f"/api/admin/points/{p.json()['id']}/restore")
    assert r.status_code == 200, r.text
    assert boss.get("/api/spaces/rp1").json()["content"] == {"v": 1}
    assert boss.get("/api/spaces/rp2").status_code == 404                     # появилось после точки — удалено (можно вернуть)
    assert guest.get("/api/me").status_code == 401                            # пользователь после точки — убран
    labels = [v["label"] for v in boss.get("/api/spaces/rp1/versions").json()]
    assert any(l and l.startswith("До восстановления") for l in labels)
    pts = boss.get("/api/admin/points").json()
    assert pts[0]["kind"] == "auto" and pts[0]["label"].startswith("Перед восстановлением")
    # отмена восстановления возвращает всё, как было до него
    assert boss.post(f"/api/admin/actions/{last_action(boss)['id']}/undo").status_code == 200
    assert boss.get("/api/spaces/rp1").json()["content"] == {"v": 2}
    assert boss.get("/api/spaces/rp2").json()["content"] == {"x": 1}
    assert guest.post("/api/auth/login", json={"email": later, "password": "password123"}).status_code == 200
    # удаление точки — отменить нельзя, но создание точки отменяется её удалением
    create = next(a for a in boss.get("/api/admin/actions").json() if a["summary"].startswith("Сохранена точка"))
    assert create["can_undo"]
    assert boss.post(f"/api/admin/actions/{create['id']}/undo").status_code == 200
    assert all(x["id"] != p.json()["id"] for x in boss.get("/api/admin/points").json())


def test_restore_point_brings_back_default_settings(client, boss):
    """Точка, сохранённая до первого изменения настроек, возвращает их значения по умолчанию."""
    from app.main import _inst
    p = boss.post("/api/admin/points", json={"label": "Чистый сервер"}).json()["id"]
    assert boss.post("/api/admin/access", json={"open": False, "message": "тест"}).status_code == 200
    assert boss.post("/api/admin/registration", json={"mode": "invite"}).status_code == 200
    assert boss.post(f"/api/admin/points/{p}/restore").status_code == 200
    _inst["t"] = 0.0
    opts = new_client(client).get("/api/auth/options").json()
    assert opts["access"]["open"] is True and opts["registration"] == "open"
