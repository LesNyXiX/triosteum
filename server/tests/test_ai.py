import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from fastapi.testclient import TestClient

from app import ai as ai_mod
from app import main
from conftest import register


def test_ai_status_and_echo(client):
    register(client)
    st = client.get("/api/ai/status").json()
    assert st["enabled"] and st["provider"] == "echo" and st["used_tokens"] == 0
    r = client.post("/api/ai/complete", json={"prompt": "Собери схему из трёх блоков", "task": "architect"})
    assert r.status_code == 200 and "Заглушка ИИ" in r.text and "Собери схему" in r.text
    assert client.get("/api/ai/status").json()["used_tokens"] > 0          # расход записан


def test_ai_boot_flag(client):
    register(client)
    html = client.get("/").text
    boot = json.loads(html.split("window.TRIOSTEUM_BOOT = ", 1)[1].split(";</script>", 1)[0])
    assert boot["ai"] == {"enabled": True, "name": "Infinitum", "provider": "echo", "model": "echo"}


def test_infinitum_is_the_server_ai(client, monkeypatch):
    """Системный ИИ сервера — Infinitum: модели уходит его характер и справка о Triosteum."""
    from app import infinitum
    register(client)
    assert client.get("/api/ai/status").json()["name"] == "Infinitum"
    seen = {}

    class Spy(ai_mod.EchoProvider):
        def stream(self, system, prompt, max_tokens, result):
            seen["system"] = system
            yield from super().stream(system, prompt, max_tokens, result)

    monkeypatch.setattr(main, "AI", Spy())
    assert client.post("/api/ai/complete", json={"prompt": "кто ты?"}).status_code == 200
    sp = seen["system"]
    assert sp == infinitum.system_prompt()
    assert "Ты — Infinitum, собственный ИИ Triosteum" in sp and "«Разработка»" in sp and "Ctrl+K" in sp


def test_ai_budget_exhausted(client, admin):
    register(client)
    org = client.get("/api/me").json()["org"]["id"]
    admin.execute("UPDATE organizations SET ai_budget_tokens = 1 WHERE id = %s", (org,))
    assert client.post("/api/ai/complete", json={"prompt": "раз"}).status_code == 200
    r = client.post("/api/ai/complete", json={"prompt": "два"})
    assert r.status_code == 402 and "исчерпан" in r.json()["detail"]


def test_ai_off(client, monkeypatch):
    register(client)
    monkeypatch.setattr(main, "AI", None)
    assert client.post("/api/ai/complete", json={"prompt": "x"}).status_code == 503
    assert client.get("/api/ai/status").json()["enabled"] is False


def test_ai_needs_login_and_rights(client, admin):
    assert TestClient(client.app).post("/api/ai/complete", json={"prompt": "x"}).status_code == 401
    register(client)
    uid = client.get("/api/me").json()["user"]["id"]
    admin.execute("UPDATE memberships SET role = 'viewer' WHERE user_id = %s", (uid,))
    assert client.post("/api/ai/complete", json={"prompt": "x"}).status_code == 403


def test_ai_budget_isolated_between_orgs(client, admin):
    register(client, org="Тратит")
    for _ in range(3):
        client.post("/api/ai/complete", json={"prompt": "длинный запрос " * 50})
    other = TestClient(client.app, base_url="http://testserver")
    register(other, org="Не тратит")
    assert other.get("/api/ai/status").json()["used_tokens"] == 0


# ---------- адаптер стандартного интерфейса OpenAI (Ollama, vLLM, YandexGPT) ----------

class FakeModel(BaseHTTPRequestHandler):
    seen = {}

    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        FakeModel.seen = {"path": self.path, "auth": self.headers.get("Authorization"), "project": self.headers.get("OpenAI-Project"), "body": body}
        if body["model"] == "broken":
            self.send_response(400); self.end_headers(); self.wfile.write(b'{"error":"bad model"}'); return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream"); self.end_headers()
        for part in ["Привет", ", ", "завод!"]:
            self.wfile.write(("data: " + json.dumps({"choices": [{"delta": {"content": part}}]}, ensure_ascii=False) + "\n\n").encode())
        self.wfile.write(b'data: {"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":3}}\n\n')
        self.wfile.write(b"data: [DONE]\n\n")


@pytest.fixture
def fake_model():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeModel)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}/v1"
    srv.shutdown()


def test_openai_adapter_streams_and_counts(fake_model):
    p = ai_mod.OpenAICompatible(fake_model, "qwen2.5-coder:7b", "k-123")
    res = ai_mod.Result()
    assert "".join(p.stream("sys", "запрос", 100, res)) == "Привет, завод!"
    assert (res.usage.tokens_in, res.usage.tokens_out) == (11, 3)
    s = FakeModel.seen
    assert s["path"] == "/v1/chat/completions" and s["auth"] == "Bearer k-123"
    assert s["body"]["stream"] is True and s["body"]["messages"][1]["content"] == "запрос"


def test_openai_adapter_error(fake_model):
    p = ai_mod.OpenAICompatible(fake_model, "broken")
    with pytest.raises(ai_mod.AIError):
        list(p.stream("s", "q", 10, ai_mod.Result()))


def test_yandex_config(monkeypatch, fake_model):
    monkeypatch.setenv("AI_PROVIDER", "yandex")
    monkeypatch.delenv("YANDEX_API_KEY", raising=False)
    assert ai_mod.from_env() is None                                   # без ключа ИИ выключен
    monkeypatch.setenv("YANDEX_API_KEY", "ya-key"); monkeypatch.setenv("YANDEX_FOLDER_ID", "b1gfolder")
    monkeypatch.setenv("AI_BASE_URL", fake_model)
    p = ai_mod.from_env()
    assert p.name == "yandex" and p.model == "gpt://b1gfolder/yandexgpt/latest"
    "".join(p.stream("s", "q", 10, ai_mod.Result()))
    assert FakeModel.seen["auth"] == "Bearer ya-key" and FakeModel.seen["project"] == "b1gfolder"


def test_server_streams_from_model(client, monkeypatch, fake_model):
    register(client)
    monkeypatch.setattr(main, "AI", ai_mod.OpenAICompatible(fake_model, "local"))
    r = client.post("/api/ai/complete", json={"prompt": "x", "task": "block"})
    assert r.text == "Привет, завод!"
    monkeypatch.setattr(main, "AI", ai_mod.OpenAICompatible(fake_model, "broken"))
    r = client.post("/api/ai/complete", json={"prompt": "x"})
    assert "\x00ERR:" in r.text and "ошибкой 400" in r.text
