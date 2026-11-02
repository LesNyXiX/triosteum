import uuid

from fastapi.testclient import TestClient

from conftest import register


def new_client(client):
    return TestClient(client.app, base_url="http://testserver")


def invite(owner, email, role="editor"):
    r = owner.post("/api/org/invites", json={"email": email, "role": role})
    assert r.status_code == 201, r.text
    return r.json()["path"].split("t=", 1)[1]


def test_invite_new_person_joins_with_role(client):
    register(client, org="Завод Команда")
    email = f"kolya{uuid.uuid4().hex[:6]}@zavod.ru"
    token = invite(client, email, "approver")
    guest = new_client(client)
    info = guest.get(f"/api/invites/{token}").json()
    assert info == {"org": "Завод Команда", "email": email, "role": "approver", "has_account": False}
    assert guest.post("/api/auth/accept-invite", json={"token": token, "password": "password123", "name": "Коля"}).status_code == 422
    r = guest.post("/api/auth/accept-invite", json={"token": token, "password": "password123", "name": "Коля", "pd_consent": True})
    assert r.status_code == 200, r.text
    me = guest.get("/api/me").json()
    assert me["role"] == "approver" and me["org"]["name"] == "Завод Команда"
    # ссылка одноразовая
    assert new_client(client).get(f"/api/invites/{token}").status_code == 404
    # согласующий читает, но не меняет
    client.put("/api/spaces/p1", json={"content": {"a": 1}, "base_rev": 0})
    assert guest.get("/api/spaces/p1").status_code == 200
    assert guest.put("/api/spaces/p1", json={"content": {}, "base_rev": 1}).status_code == 403
    names = [m["name"] for m in client.get("/api/org/members").json()["members"]]
    assert "Коля" in names


def test_invite_existing_account_needs_password(client):
    other = new_client(client)
    email = register(other, org="Своя фирма")
    register(client, org="Головная")
    token = invite(client, email)
    guest = new_client(client)
    assert guest.get(f"/api/invites/{token}").json()["has_account"] is True
    assert guest.post("/api/auth/accept-invite", json={"token": token, "password": "wrong-pass"}).status_code == 401
    assert guest.post("/api/auth/accept-invite", json={"token": token, "password": "password123"}).status_code == 200
    assert guest.get("/api/me").json()["org"]["name"] == "Головная"


def test_only_owner_manages_team(client):
    register(client)
    email = f"ed{uuid.uuid4().hex[:6]}@zavod.ru"
    token = invite(client, email, "editor")
    ed = new_client(client)
    ed.post("/api/auth/accept-invite", json={"token": token, "password": "password123", "pd_consent": True})
    assert ed.post("/api/org/invites", json={"email": "x@y.ru", "role": "editor"}).status_code == 403
    assert ed.get("/api/org/members").json()["invites"] == []          # приглашения видит только владелец
    owner_id = client.get("/api/me").json()["user"]["id"]
    assert ed.patch(f"/api/org/members/{owner_id}", json={"role": "viewer"}).status_code == 403
    assert client.post("/api/org/invites", json={"email": "x@y.ru", "role": "owner"}).status_code == 422


def test_role_change_and_removal(client):
    register(client)
    email = f"v{uuid.uuid4().hex[:6]}@zavod.ru"
    token = invite(client, email, "viewer")
    v = new_client(client)
    v.post("/api/auth/accept-invite", json={"token": token, "password": "password123", "pd_consent": True})
    vid = v.get("/api/me").json()["user"]["id"]
    assert client.patch(f"/api/org/members/{vid}", json={"role": "editor"}).status_code == 200
    assert v.get("/api/me").json()["role"] == "editor"
    assert client.delete(f"/api/org/members/{vid}").status_code == 200
    assert v.get("/api/me").status_code == 401                       # доступ пропал сразу


def test_last_owner_protected(client):
    register(client)
    me = client.get("/api/me").json()["user"]["id"]
    assert client.patch(f"/api/org/members/{me}", json={"role": "editor"}).status_code == 409
    assert client.delete(f"/api/org/members/{me}").status_code == 409


def test_invite_other_org_isolated(client):
    register(client, org="А")
    token = invite(client, f"z{uuid.uuid4().hex[:6]}@zavod.ru")
    b = new_client(client)
    register(b, org="Б")
    inv_id = client.get("/api/org/members").json()["invites"][0]["id"]
    assert b.delete(f"/api/org/invites/{inv_id}").status_code == 404     # чужое приглашение не отменить
    assert b.get("/api/org/members").json()["invites"] == []
    assert client.delete(f"/api/org/invites/{inv_id}").status_code == 200
    assert new_client(client).get(f"/api/invites/{token}").status_code == 404


def test_bad_token(client):
    assert client.get("/api/invites/nonsense").status_code == 404
    assert client.post("/api/auth/accept-invite", json={"token": "nonsense", "password": "password123", "pd_consent": True}).status_code == 404


def test_version_restore_content(client):
    register(client)
    client.put("/api/spaces/h1", json={"content": {"n": 1}, "base_rev": 0})
    client.put("/api/spaces/h1", json={"content": {"n": 2}, "base_rev": 1})
    vs = client.get("/api/spaces/h1/versions").json()
    first = [v for v in vs if v["rev"] == 1][0]
    assert client.get(f"/api/spaces/h1/versions/{first['id']}").json()["content"] == {"n": 1}
    assert client.get("/api/spaces/h1/versions/999999").status_code == 404
