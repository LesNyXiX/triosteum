"""Мастерская компании: история версий доработок, откат, выключение для всех и журнал."""
import json

from conftest import register
from test_orglib import ENV, EXT, PLUGIN, member
from test_team import new_client


def share(c, kind, src, data):
    r = c.post("/api/org/items", json={"kind": kind, "src": src, "data": data})
    assert r.status_code == 201, r.text
    return r.json()


def test_versions_and_rollback(client):
    register(client, org="Завод История")
    ed = member(client, client)
    it = share(ed, "plugin", "p-1", PLUGIN)
    share(ed, "plugin", "p-1", {**PLUGIN, "name": "Расчёт брака 2", "codes": {"python": "return 2"}})
    vs = ed.get(f"/api/org/items/{it['id']}/versions").json()["versions"]
    assert [v["action"] for v in vs] == ["update", "publish"]
    assert vs[0]["current"] and not vs[0]["can_restore"] and vs[1]["can_restore"]
    # откат к первой версии — её снимок становится текущим, в журнале — запись «rollback»
    r = ed.post(f"/api/org/items/{it['id']}/rollback", json={"version": vs[1]["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Расчёт брака" and r.json()["data"]["codes"]["python"].startswith("def run")
    vs2 = ed.get(f"/api/org/items/{it['id']}/versions").json()["versions"]
    assert [v["action"] for v in vs2] == ["rollback", "update", "publish"] and vs2[0]["current"]
    # другой редактор чужой плагин не откатит; владелец — может
    other = member(client, client)
    assert other.post(f"/api/org/items/{it['id']}/rollback", json={"version": vs2[1]["id"]}).status_code == 403
    assert client.post(f"/api/org/items/{it['id']}/rollback", json={"version": vs2[1]["id"]}).status_code == 200
    # чужая или несуществующая версия
    assert client.post(f"/api/org/items/{it['id']}/rollback", json={"version": "00000000-0000-0000-0000-000000000000"}).status_code == 404
    assert client.post(f"/api/org/items/{it['id']}/rollback", json={"version": "не-uuid"}).status_code == 404


def test_ext_rollback_bumps_version(client):
    register(client, org="Завод Откат")
    ext = {**EXT, "perms": ["board.read"]}
    it = share(client, "ext", "xkachestvo", ext)
    share(client, "ext", "xkachestvo", {**ext, "perms": ["board.read", "board.write"]})
    vs = client.get(f"/api/org/items/{it['id']}/versions").json()["versions"]
    assert [v["ver"] for v in vs] == [2, 1]
    d = client.post(f"/api/org/items/{it['id']}/rollback", json={"version": vs[1]["id"]}).json()["data"]
    # снимок версии 1, но номер — новый: у сотрудников расширение перезапустится
    assert d["perms"] == ["board.read"] and d["ver"] == 3
    ed = member(client, client)
    assert ed.post(f"/api/org/items/{it['id']}/rollback", json={"version": vs[0]["id"]}).status_code == 403


def test_disable_for_everyone(client):
    register(client, org="Завод Выключатель")
    ed = member(client, client)
    viewer = member(client, client, "viewer")
    p = share(ed, "plugin", "p-1", PLUGIN)
    x = share(client, "ext", "xkachestvo", {**EXT, "name": "Выключаемое расширение", "perms": ["board.read"]})
    env = share(client, "env", "ulabotk", ENV)
    assert viewer.patch(f"/api/org/items/{p['id']}", json={"disabled": True}).status_code == 403
    assert ed.patch(f"/api/org/items/{x['id']}", json={"disabled": True}).status_code == 403   # расширение — только владелец
    assert client.patch(f"/api/org/items/{env['id']}", json={"disabled": True}).status_code == 422  # среду не выключают
    assert ed.patch(f"/api/org/items/{p['id']}", json={"disabled": True}).json()["disabled"] is True
    assert client.patch(f"/api/org/items/{x['id']}", json={"disabled": True}).status_code == 200
    # сотрудникам выключенное не отдаётся — ни в списке, ни при загрузке; мастерская видит всё
    names = [i["name"] for i in viewer.get("/api/org/items").json()["items"]]
    assert names == ["Лаборатория ОТК"]
    page = viewer.get("/").text   # данные загрузки страницы — тоже без выключенного (там JSON, кириллица может быть в \\u-виде)
    seen = lambda t: t in page or json.dumps(t)[1:-1] in page
    assert seen("Лаборатория ОТК") and not seen("Расчёт брака") and not seen("Выключаемое расширение")
    al = {i["name"]: i["disabled"] for i in viewer.get("/api/org/items?all=1").json()["items"]}
    assert al == {"Расчёт брака": True, "Выключаемое расширение": True, "Лаборатория ОТК": False}
    # включить обратно; повторное выключение того же состояния журнал не засоряет
    ed.patch(f"/api/org/items/{p['id']}", json={"disabled": False})
    ed.patch(f"/api/org/items/{p['id']}", json={"disabled": False})
    assert [v["action"] for v in ed.get(f"/api/org/items/{p['id']}/versions").json()["versions"]] == ["enable", "disable", "publish"]
    # обновление выключенного не включает его
    share(client, "ext", "xkachestvo", {**EXT, "perms": ["board.read"], "desc": "новое"})
    assert next(i for i in client.get("/api/org/items?all=1").json()["items"] if i["kind"] == "ext")["disabled"] is True


def test_journal_and_isolation(client):
    register(client, org="Завод Журнал")
    p = share(client, "plugin", "p-1", PLUGIN)
    share(client, "plugin", "p-1", {**PLUGIN, "name": "Новое имя"})
    client.patch(f"/api/org/items/{p['id']}", json={"disabled": True})
    client.delete(f"/api/org/items/{p['id']}")
    j = client.get("/api/org/items/journal").json()["entries"]
    assert [e["action"] for e in j] == ["remove", "disable", "update", "publish"]
    assert j[0]["gone"] and j[0]["kind"] == "plugin" and j[1]["name"] == "Новое имя" and j[0]["by_name"]
    assert len(client.get("/api/org/items/journal?limit=2").json()["entries"]) == 2
    # удалённое — без истории и отката
    assert client.get(f"/api/org/items/{p['id']}/versions").status_code == 404
    # другая организация не видит ни журнала, ни истории
    stranger = new_client(client)
    register(stranger, org="Чужой завод Журнал")
    assert stranger.get("/api/org/items/journal").json()["entries"] == []
    q = share(client, "plugin", "p-2", PLUGIN)
    assert stranger.get(f"/api/org/items/{q['id']}/versions").status_code == 404
    assert stranger.patch(f"/api/org/items/{q['id']}", json={"disabled": True}).status_code == 404
    v = client.get(f"/api/org/items/{q['id']}/versions").json()["versions"][0]
    assert stranger.post(f"/api/org/items/{q['id']}/rollback", json={"version": v["id"]}).status_code == 404


def test_old_snapshots_pruned(client):
    register(client, org="Завод Снимки")
    for i in range(35):
        share(client, "plugin", "p-1", {**PLUGIN, "desc": f"версия {i}"})
    it = client.get("/api/org/items").json()["items"][0]
    vs = client.get(f"/api/org/items/{it['id']}/versions").json()["versions"]
    assert len(vs) == 35
    assert sum(1 for v in vs if v["can_restore"] or v["current"]) == 30
