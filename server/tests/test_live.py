"""Совместная работа: комнаты, присутствие, рассылка правок, изоляция и выгон."""
import time
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from conftest import register


def friend(client, role="editor"):
    """Второй человек в той же организации."""
    email = f"f{uuid.uuid4().hex[:6]}@zavod.ru"
    tok = client.post("/api/org/invites", json={"email": email, "role": role, "send_email": False}).json()["path"].split("t=")[1]
    other = TestClient(client.app, base_url="http://testserver")
    assert other.post("/api/auth/accept-invite", json={"token": tok, "password": "password123", "name": "Борис", "pd_consent": True}).status_code == 200
    return other


def recv_until(ws, t, n=10):
    for _ in range(n):
        m = ws.receive_json()
        if m["t"] == t:
            return m
    raise AssertionError("не дождались " + t)


def test_presence_and_rev_broadcast(client):
    register(client, name="Анна")
    client.put("/api/spaces/live1", json={"content": {"nodes": []}, "base_rev": 0})
    b = friend(client)
    with client.websocket_connect("/api/ws/spaces/live1") as wa:
        hello_a = wa.receive_json()
        assert hello_a["t"] == "hello" and hello_a["peers"] == []
        with b.websocket_connect("/api/ws/spaces/live1") as wb:
            hello_b = wb.receive_json()
            assert [p["name"] for p in hello_b["peers"]] == ["Анна"]
            assert recv_until(wa, "join")["name"] == "Борис"
            # курсор Бориса виден Анне
            wb.send_json({"t": "presence", "cursor": {"x": 120, "y": 80}, "sel": ["n1"], "evil": "<script>"})
            pr = recv_until(wa, "presence")
            assert pr["cursor"] == {"x": 120.0, "y": 80.0} and pr["sel"] == ["n1"] and "evil" not in pr
            # Анна сохранила — Борис получает правку, а сама Анна (её вкладка) — нет
            sid_a = hello_a["sid"]
            r = client.put("/api/spaces/live1", json={"content": {"nodes": [{"id": "n1"}]}, "base_rev": 1}, headers={"X-Live-Sid": sid_a})
            assert r.status_code == 200
            rev = recv_until(wb, "rev")
            assert rev["rev"] == 2 and rev["content"] == {"nodes": [{"id": "n1"}]} and rev["by"] == "Анна"
        assert recv_until(wa, "leave")["sid"] == hello_b["sid"]


def test_other_org_isolated(client):
    register(client, org="А")
    client.put("/api/spaces/same", json={"content": {"a": 1}, "base_rev": 0})
    other = TestClient(client.app, base_url="http://testserver")
    register(other, org="Б")
    with other.websocket_connect("/api/ws/spaces/same") as wb:
        assert wb.receive_json()["peers"] == []
        with client.websocket_connect("/api/ws/spaces/same") as wa:
            assert wa.receive_json()["peers"] == []             # пространство «same» у А и Б — разные комнаты
            client.put("/api/spaces/same", json={"content": {"a": 2}, "base_rev": 1})
            other.put("/api/spaces/same", json={"content": {"b": 1}, "base_rev": 0})
            wb.send_json({"t": "ping"})
            assert wb.receive_json()["t"] == "rev"             # своё сохранение Б (без X-Live-Sid) приходит самому Б
            wb.send_json({"t": "ping"})
            m = wb.receive_json()
            assert m["t"] == "pong"                             # а правка А в комнату Б не попала


def test_requires_login_and_same_origin(client):
    anon = TestClient(client.app, base_url="http://testserver")
    with pytest.raises(WebSocketDisconnect):
        with anon.websocket_connect("/api/ws/spaces/x") as ws:
            ws.receive_json()
    register(client)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/ws/spaces/x", headers={"Origin": "https://evil.example"}) as ws:
            ws.receive_json()


def test_removed_member_kicked(client):
    register(client)
    b = friend(client)
    bid = b.get("/api/me").json()["user"]["id"]
    with b.websocket_connect("/api/ws/spaces/k1") as wb:
        wb.receive_json()
        assert client.delete(f"/api/org/members/{bid}").status_code == 200
        with pytest.raises(WebSocketDisconnect):
            for _ in range(5):
                wb.receive_json()


def test_viewer_gets_updates_but_cannot_save(client):
    register(client)
    client.put("/api/spaces/v1", json={"content": {}, "base_rev": 0})
    v = friend(client, role="viewer")
    with v.websocket_connect("/api/ws/spaces/v1") as wv:
        wv.receive_json()
        client.put("/api/spaces/v1", json={"content": {"x": 1}, "base_rev": 1})
        assert recv_until(wv, "rev")["content"] == {"x": 1}
    assert v.put("/api/spaces/v1", json={"content": {}, "base_rev": 2}).status_code == 403
