"""Письма: приглашение и восстановление пароля, через настоящий SMTP-сервер, который ловит письма."""
import email
import re
import time
import uuid
from email import policy

import pytest
from aiosmtpd.controller import Controller
from fastapi.testclient import TestClient

from conftest import register


class Box:
    def __init__(self):
        self.msgs = []

    async def handle_DATA(self, server, session, envelope):
        self.msgs.append(email.message_from_bytes(envelope.content, policy=policy.default))
        return "250 OK"


@pytest.fixture
def smtp(monkeypatch):
    import socket
    box = Box()
    with socket.socket() as sk:                        # свободный порт
        sk.bind(("127.0.0.1", 0)); port = sk.getsockname()[1]
    ctl = Controller(box, hostname="127.0.0.1", port=port)
    ctl.start()
    monkeypatch.setenv("SMTP_HOST", "127.0.0.1")
    monkeypatch.setenv("SMTP_PORT", str(port))
    monkeypatch.setenv("SMTP_STARTTLS", "0")
    monkeypatch.setenv("MAIL_FROM", "Triosteum <noreply@triosteum.test>")
    monkeypatch.setenv("PUBLIC_URL", "https://triosteum.test")
    yield box
    ctl.stop()


def wait_mail(box, n=1):
    for _ in range(50):
        if len(box.msgs) >= n:
            return box.msgs[n - 1]
        time.sleep(0.05)
    raise AssertionError("письмо не пришло")


def body_text(msg):
    return msg.get_body(preferencelist=("plain",)).get_content()


def test_invite_email_sent(client, smtp):
    register(client, org="Завод Почта", name="Анна")
    to = f"kolya{uuid.uuid4().hex[:6]}@zavod.ru"
    r = client.post("/api/org/invites", json={"email": to, "role": "approver"}).json()
    assert r["emailed"] is True and r["mail_error"] is None
    m = wait_mail(smtp)
    assert m["To"] == to and "Анна" in m["Subject"]
    text = body_text(m)
    assert "Завод Почта" in text and "согласующий" in text
    link = re.search(r"https://triosteum\.test/invite\?t=\S+", text).group(0)
    assert link.endswith(r["path"].split("t=")[1])
    html = m.get_body(preferencelist=("html",)).get_content()
    assert "Принять приглашение" in html and "<script" not in html


def test_invite_without_mail_still_gives_link(client, monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    register(client)
    r = client.post("/api/org/invites", json={"email": "x@zavod.ru"}).json()
    assert r["emailed"] is False and r["path"].startswith("/invite?t=")


def test_invite_mail_failure_reported(client, monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "127.0.0.1"); monkeypatch.setenv("SMTP_PORT", "1"); monkeypatch.setenv("SMTP_STARTTLS", "0")
    register(client)
    r = client.post("/api/org/invites", json={"email": "y@zavod.ru"}).json()
    assert r["emailed"] is False and r["mail_error"] and r["path"]


def test_org_name_escaped_in_mail(client, smtp):
    register(client, org='<img src=x onerror=alert(1)>')
    client.post("/api/org/invites", json={"email": "z@zavod.ru"})
    html = wait_mail(smtp).get_body(preferencelist=("html",)).get_content()
    assert "<img src=x" not in html and "&lt;img" in html


def test_password_reset_flow(client, smtp):
    email_addr = register(client)
    anon = TestClient(client.app, base_url="http://testserver")
    assert anon.post("/api/auth/forgot", json={"email": email_addr.upper()}).json() == {"ok": True}
    m = wait_mail(smtp)
    assert m["To"] == email_addr
    token = re.search(r"/reset\?t=(\S+)", body_text(m)).group(1)
    assert anon.post("/api/auth/reset", json={"token": token, "password": "short"}).status_code == 422
    r = anon.post("/api/auth/reset", json={"token": token, "password": "new-password-1"})
    assert r.status_code == 200 and anon.get("/api/me").status_code == 200
    assert client.get("/api/me").status_code == 401                       # старые входы закрыты
    assert anon.post("/api/auth/reset", json={"token": token, "password": "again-pass-2"}).status_code == 404   # одноразовая
    fresh = TestClient(client.app, base_url="http://testserver")
    assert fresh.post("/api/auth/login", json={"email": email_addr, "password": "password123"}).status_code == 401
    assert fresh.post("/api/auth/login", json={"email": email_addr, "password": "new-password-1"}).status_code == 200


def test_forgot_unknown_email_same_answer(client, smtp):
    r = client.post("/api/auth/forgot", json={"email": "nobody-here@zavod.ru"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    time.sleep(0.3)
    assert smtp.msgs == []


def test_reset_token_expired(client, smtp, admin):
    email_addr = register(client)
    client.post("/api/auth/forgot", json={"email": email_addr})
    token = re.search(r"/reset\?t=(\S+)", body_text(wait_mail(smtp))).group(1)
    admin.execute("UPDATE password_resets SET expires_at = now() - interval '1 minute'")
    assert client.post("/api/auth/reset", json={"token": token, "password": "new-password-1"}).status_code == 404


def test_forgot_without_mail(client, monkeypatch):
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert client.post("/api/auth/forgot", json={"email": "a@b.ru"}).status_code == 503
    assert client.get("/api/auth/options").json()["mail"] is False


def test_brand_files_and_mail_logo(client, monkeypatch):
    r = client.get("/brand/mark-96.png")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert client.get("/brand/../main.py").status_code == 404
    assert client.get("/brand/nope.png").status_code == 404
    monkeypatch.setenv("PUBLIC_URL", "https://triosteum.example.ru")
    from app import mail
    assert 'src="https://triosteum.example.ru/brand/mark-96.png"' in mail._layout("Т", ["x"], "Открыть", "https://a", "f")
