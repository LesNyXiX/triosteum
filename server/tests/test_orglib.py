"""Библиотека организации: плагин, которым поделился сотрудник, видят все сотрудники его компании и не видит никто другой."""
import json
import uuid

from conftest import register
from test_team import invite, new_client


def member(owner, client, role="editor"):
    email = f"m{uuid.uuid4().hex[:8]}@zavod.ru"
    c = new_client(client)
    r = c.post("/api/auth/accept-invite", json={"token": invite(owner, email, role), "password": "password123", "name": "Коллега", "pd_consent": True})
    assert r.status_code == 200, r.text
    return c


PLUGIN = {"name": "Расчёт брака", "lang": "python", "desc": "Доля брака по сменам", "family": None,
          "codes": {"python": "def run(x):\n    return x"}, "my": True, "secret_note": "не уходит"}


def test_share_visible_to_colleagues_only(client):
    register(client, org="Завод Библиотека")
    colleague = member(client, client)
    viewer = member(client, client, "viewer")
    r = client.post("/api/org/items", json={"kind": "plugin", "src": "my-1", "data": PLUGIN})
    assert r.status_code == 201, r.text
    it = r.json()
    assert it["name"] == "Расчёт брака" and "my" not in it["data"] and "secret_note" not in it["data"]
    for c in (client, colleague, viewer):
        assert [x["name"] for x in c.get("/api/org/items").json()["items"]] == ["Расчёт брака"]
    # данные страницы: библиотека приходит сразу
    html = colleague.get("/").text
    boot = json.loads(html.split("window.TRIOSTEUM_BOOT = ", 1)[1].split(";</script>", 1)[0])
    assert boot["org_items"][0]["data"]["codes"]["python"].startswith("def run")
    # другая организация не видит
    stranger = new_client(client)
    register(stranger, org="Чужой завод")
    assert stranger.get("/api/org/items").json()["items"] == []
    assert stranger.delete(f"/api/org/items/{it['id']}").status_code == 404


def test_roles_update_and_remove(client):
    register(client, org="Завод Права")
    ed = member(client, client)
    viewer = member(client, client, "viewer")
    assert viewer.post("/api/org/items", json={"kind": "plugin", "src": "v-1", "data": PLUGIN}).status_code == 403
    it = ed.post("/api/org/items", json={"kind": "plugin", "src": "ed-1", "data": PLUGIN}).json()
    # повторная публикация того же плагина обновляет его, а не плодит копии
    upd = ed.post("/api/org/items", json={"kind": "plugin", "src": "ed-1", "data": {**PLUGIN, "name": "Расчёт брака v2"}})
    assert upd.status_code == 201 and upd.json()["id"] == it["id"]
    assert [x["name"] for x in client.get("/api/org/items").json()["items"]] == ["Расчёт брака v2"]
    # другой редактор чужой плагин не перезапишет и не уберёт, владелец организации — может
    ed2 = member(client, client)
    assert ed2.post("/api/org/items", json={"kind": "plugin", "src": "ed-1", "data": PLUGIN}).status_code == 403
    assert ed2.delete(f"/api/org/items/{it['id']}").status_code == 403
    assert client.delete(f"/api/org/items/{it['id']}").status_code == 200
    assert client.get("/api/org/items").json()["items"] == []
    # после удаления можно поделиться заново
    assert ed.post("/api/org/items", json={"kind": "plugin", "src": "ed-1", "data": PLUGIN}).status_code == 201


def test_bad_items_rejected(client):
    register(client, org="Завод Проверки")
    assert client.post("/api/org/items", json={"kind": "env", "src": "x", "data": PLUGIN}).status_code == 422
    assert client.post("/api/org/items", json={"kind": "plugin", "src": "x", "data": {"lang": "python"}}).status_code == 422
    big = {**PLUGIN, "codes": {"python": "x" * (600 * 1024)}}
    assert client.post("/api/org/items", json={"kind": "plugin", "src": "x", "data": big}).status_code == 413
