"""Общие данные расширения внутри компании: только для опубликованного расширения с «org.storage», пределы, роли, изоляция."""
from conftest import register
from test_orglib import EXT, member
from test_team import new_client

X = {**EXT, "id": "xspravka", "name": "Справочник", "perms": ["board.read", "org.storage"]}


def pub(c, data=X):
    r = c.post("/api/org/items", json={"kind": "ext", "src": data["id"], "data": data})
    assert r.status_code == 201, r.text
    return r.json()


def test_shared_data(client):
    register(client, org="Завод Общие данные")
    it = pub(client)
    ed = member(client, client)
    viewer = member(client, client, "viewer")
    assert ed.put("/api/org/ext-data/xspravka/цеха", json={"value": ["литейный", "сборочный"]}).status_code == 200
    assert client.get("/api/org/ext-data/xspravka").json()["data"] == {"цеха": ["литейный", "сборочный"]}
    assert viewer.get("/api/org/ext-data/xspravka").json()["data"]["цеха"][0] == "литейный"
    assert viewer.put("/api/org/ext-data/xspravka/цеха", json={"value": 1}).status_code == 403
    # перезапись и удаление (null)
    client.put("/api/org/ext-data/xspravka/цеха", json={"value": {"n": 3}})
    assert client.get("/api/org/ext-data/xspravka").json()["data"] == {"цеха": {"n": 3}}
    client.put("/api/org/ext-data/xspravka/цеха", json={"value": None})
    assert client.get("/api/org/ext-data/xspravka").json()["data"] == {}
    # пределы
    assert client.put("/api/org/ext-data/xspravka/big", json={"value": "я" * 40000}).status_code == 413
    assert client.put("/api/org/ext-data/xspravka/" + "k" * 101, json={"value": 1}).status_code == 422
    # выключили расширение для всех — данные недоступны
    client.patch(f"/api/org/items/{it['id']}", json={"disabled": True})
    assert client.get("/api/org/ext-data/xspravka").status_code == 404
    client.patch(f"/api/org/items/{it['id']}", json={"disabled": False})
    assert client.get("/api/org/ext-data/xspravka").status_code == 200


def test_requires_permission_and_publication(client):
    register(client, org="Завод Без права")
    pub(client, {**X, "id": "xbezprava", "perms": ["board.read"]})
    assert client.get("/api/org/ext-data/xbezprava").status_code == 404
    assert client.put("/api/org/ext-data/xbezprava/a", json={"value": 1}).status_code == 404
    assert client.get("/api/org/ext-data/xnetakogo").status_code == 404
    assert client.get("/api/org/ext-data/не-id").status_code == 404


def test_isolation(client):
    register(client, org="Завод А данные")
    pub(client)
    client.put("/api/org/ext-data/xspravka/секрет", json={"value": "только наше"})
    other = new_client(client)
    register(other, org="Завод Б данные")
    # у другой компании своё расширение с тем же id — и свои, пустые данные
    assert other.get("/api/org/ext-data/xspravka").status_code == 404
    pub(other)
    assert other.get("/api/org/ext-data/xspravka").json()["data"] == {}
    other.put("/api/org/ext-data/xspravka/секрет", json={"value": "их"})
    assert client.get("/api/org/ext-data/xspravka").json()["data"] == {"секрет": "только наше"}


def test_limits_per_extension(client):
    register(client, org="Завод Пределы")
    pub(client)
    v = "x" * 60000
    codes = [client.put(f"/api/org/ext-data/xspravka/k{i}", json={"value": v}).status_code for i in range(36)]
    assert codes[:34] == [200] * 34 and 413 in codes[34:]
