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


ENV = {"id": "ulabotk", "name": "Лаборатория ОТК", "short": "ОТК", "color": "#0D9488", "ic": "lab",
       "kinds": ["oee", "defects", "pareto"], "desc": "Контроль качества", "step": True, "theme": "graphite", "junk": 1}


def test_custom_env(client):
    register(client, org="Завод Среды")
    colleague = member(client, client)
    r = client.post("/api/org/items", json={"kind": "env", "src": "ulabotk", "data": ENV})
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["name"] == "Лаборатория ОТК" and d["kinds"] == ["oee", "defects", "pareto"] and "junk" not in d
    assert [x["data"]["id"] for x in colleague.get("/api/org/items?kind=env").json()["items"]] == ["ulabotk"]
    assert colleague.get("/api/org/items?kind=plugin").json()["items"] == []
    # пространство в своей среде создаётся как обычное
    assert colleague.put("/api/spaces/otk1", json={"name": "ОТК", "env": "ulabotk", "content": {}, "base_rev": 0}).status_code == 201
    # чужой редактор не меняет, автор меняет
    assert colleague.post("/api/org/items", json={"kind": "env", "src": "ulabotk", "data": {**ENV, "name": "Чужое"}}).status_code == 403
    assert client.post("/api/org/items", json={"kind": "env", "src": "ulabotk", "data": {**ENV, "name": "ОТК и лаборатория"}}).status_code == 201
    stranger = new_client(client)
    register(stranger, org="Чужой завод среды")
    assert stranger.get("/api/org/items?kind=env").json()["items"] == []


def test_custom_env_validation(client):
    register(client, org="Завод Проверки сред")
    bad = [({**ENV, "id": "wh"}, "wh"), ({**ENV, "id": "ulabotk"}, "uother"), ({**ENV, "kinds": []}, "ulabotk"),
           ({**ENV, "kinds": ["bad kind!"]}, "ulabotk"), ({**ENV, "color": "red"}, "ulabotk"), ({**ENV, "name": ""}, "ulabotk")]
    for data, src in bad:
        assert client.post("/api/org/items", json={"kind": "env", "src": src, "data": data}).status_code == 422, data


def test_env_delete_guard(client):
    """Удалить среду с пространствами нельзя и прямым запросом; пространство в несуществующей среде не создаётся."""
    register(client, org="Завод Удаление сред")
    assert client.put("/api/spaces/nx1", json={"name": "X", "env": "unothere", "content": {}, "base_rev": 0}).status_code == 422
    it = client.post("/api/org/items", json={"kind": "env", "src": "ulabotk", "data": ENV}).json()
    assert client.put("/api/spaces/otk2", json={"name": "ОТК", "env": "ulabotk", "content": {}, "base_rev": 0}).status_code == 201
    r = client.delete(f"/api/org/items/{it['id']}")
    assert r.status_code == 409 and "пространства (1)" in r.json()["detail"]
    assert client.delete("/api/spaces/otk2").status_code == 200
    assert client.delete(f"/api/org/items/{it['id']}").status_code == 200
    # среды больше нет — пространство в ней не создать, не вернуть и не перенести в неё
    assert client.put("/api/spaces/other1", json={"name": "Другое", "env": "code", "content": {}, "base_rev": 0}).status_code == 201
    assert client.patch("/api/spaces/other1", json={"env": "ulabotk"}).status_code == 422
    imp = client.post("/api/import", json={"spaces": [{"id": "imp1", "name": "Из браузера", "env": "ulabotk", "content": {}}], "prefs": {}})
    assert imp.status_code == 200, imp.text
    assert [x["env"] for x in client.get("/api/spaces").json() if x["name"] == "Из браузера"] == ["code"]
    assert client.put("/api/spaces/otk3", json={"name": "ОТК", "env": "ulabotk", "content": {}, "base_rev": 0}).status_code == 422
    assert client.put("/api/spaces/otk2", json={"name": "ОТК", "env": "ulabotk", "content": {}, "base_rev": 0}).status_code == 422


EXT = {"id": "xkachestvo", "name": "Контроль качества", "desc": "Проверяет схему", "perms": ["board.read", "board.write", "net"],
       "commands": [{"id": "check", "label": "Проверить схему"}], "code": "triosteum.command('check', () => 1)"}


def test_ext_owner_only_and_validation(client):
    register(client, org="Завод Расширения")
    ed = member(client, client)
    ok = {**EXT, "perms": ["board.read", "board.write"]}
    # код расширения запускается у коллег — редактор опубликовать не может
    r = ed.post("/api/org/items", json={"kind": "ext", "src": "xkachestvo", "data": ok})
    assert r.status_code == 403 and "владелец" in r.json()["detail"]
    # неизвестное разрешение (например, «сеть») не принимается
    assert client.post("/api/org/items", json={"kind": "ext", "src": "xkachestvo", "data": EXT}).status_code == 422
    for bad in ({**ok, "id": "kachestvo"}, {**ok, "code": " "}, {**ok, "commands": [], "perms": ["board.read"]},
                {**ok, "commands": [{"id": "a"}, {"id": "a", "label": "x"}]}, {**ok, "code": "x" * (256 * 1024 + 1)}):
        r = client.post("/api/org/items", json={"kind": "ext", "src": bad.get("id") or "xkachestvo", "data": bad})
        assert r.status_code in (413, 422), (bad.get("id"), r.text)
    r = client.post("/api/org/items", json={"kind": "ext", "src": "xkachestvo", "data": {**ok, "perms": ["board.write", "board.read", "board.read"], "extra": 1}})
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["perms"] == ["board.read", "board.write"] and d["ver"] == 1 and "extra" not in d and "panel" not in d
    # новая версия — номер растёт; панель получает название
    d2 = client.post("/api/org/items", json={"kind": "ext", "src": "xkachestvo", "data": {**ok, "perms": ["panel"], "commands": []}}).json()["data"]
    assert d2["ver"] == 2 and d2["panel"] == "Контроль качества"
    # коллеги видят расширение; редактор не уберёт, владелец — может
    items = ed.get("/api/org/items?kind=ext").json()["items"]
    assert [x["name"] for x in items] == ["Контроль качества"]
    assert ed.delete(f"/api/org/items/{items[0]['id']}").status_code == 403
    assert client.delete(f"/api/org/items/{items[0]['id']}").status_code == 200
    # чужая организация расширений компании не видит
    stranger = new_client(client)
    register(stranger, org="Чужой завод 2")
    client.post("/api/org/items", json={"kind": "ext", "src": "xkachestvo", "data": ok})
    assert stranger.get("/api/org/items?kind=ext").json()["items"] == []
