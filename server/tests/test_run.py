"""Песочница Python: обычные блоки работают, злонамеренный и сломанный код — нет."""
import os
import sys
from pathlib import Path

import pytest

from conftest import register

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "runner"))
import sandbox  # noqa: E402

BLOCK = 'from triosteum import block\n@block("Контроль", sample={"values": [5, 20, 30]})\ndef run(d):\n    print("строк:", len(d["values"]))\n    return [v for v in d["values"] if v > 15]\n'


def run(code, inp=None, mode="script"):
    return sandbox.run(code, inp, mode)


def test_block_with_input_and_sample():
    r = sandbox.run(BLOCK, {"values": [1, 16, 40]}, "block")
    assert r["ok"] and r["output"] == [16, 40] and r["block"] == "Контроль" and "строк: 3" in r["stdout"]
    assert sandbox.run(BLOCK, None, "block")["output"] == [20, 30]          # тестовые данные блока


def test_script_mode_and_errors():
    assert run('if __name__ == "__main__":\n    print("главный")')["stdout"].strip() == "главный"
    r = run("1/0")
    assert not r["ok"] and "ZeroDivisionError" in r["error"]
    r = run("def f(:\n  pass")
    assert not r["ok"] and "SyntaxError" in r["error"]


def test_stdlib_and_json_safe_output():
    r = sandbox.run('from triosteum import block\nimport datetime, statistics\n@block("Д")\ndef run(d):\n    return {"t": datetime.date(2026, 1, 1), "m": statistics.mean([1, 2, 3])}', None, "block")
    assert r["ok"] and r["output"] == {"t": "2026-01-01", "m": 2}


def test_infinite_loop_stopped(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "cpu_sec", 2)
    monkeypatch.setitem(sandbox.LIMITS, "timeout_sec", 4)
    r = run("while True:\n    pass")
    assert not r["ok"] and ("время" in r["error"]) and r["ms"] < 6000


def test_sleep_stopped_by_wall_clock(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "timeout_sec", 2)
    r = run("import time\ntime.sleep(30)")
    assert not r["ok"] and "время" in r["error"] and r["ms"] < 4000


def test_memory_limit(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "memory_mb", 200)
    r = run("x = bytearray(1024 * 1024 * 1024)")
    assert not r["ok"] and "памяти" in r["error"]


def test_big_file_limit(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "file_mb", 1)
    r = run("open('big.bin', 'wb').write(b'0' * 5 * 1024 * 1024)")
    assert not r["ok"]


def test_fork_bomb_contained(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "timeout_sec", 5)
    r = run("import os\nfor _ in range(200):\n    try:\n        os.fork()\n    except OSError:\n        break\nprint('ok')")
    assert r["ms"] < 8000                                                    # не повисло и не уронило исполнителя


def test_no_secrets_in_environment(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://secret")
    r = run("import os\nprint(sorted(os.environ))")
    assert "DATABASE_URL" not in r["stdout"] and "secret" not in r["stdout"]


def test_unprivileged_user():
    if os.getuid() != 0:
        pytest.skip("проверка смены пользователя нужна, только когда исполнитель запущен от root")
    assert run("import os\nprint(os.getuid())")["stdout"].strip() == "65534"


def test_no_network():
    if not sandbox.net_isolation_available():
        pytest.skip("отключение сети недоступно в этой среде")
    r = run("import socket\nsocket.create_connection(('1.1.1.1', 80), timeout=3)")
    assert not r["ok"] and "unreachable" in r["error"].lower()


def test_output_truncated(monkeypatch):
    monkeypatch.setitem(sandbox.LIMITS, "max_output", 1000)
    r = run("print('x' * 100000)")
    assert len(r["stdout"]) < 1100 and "обрезан" in r["stdout"]


def test_workdir_cleaned():
    r = run("import os\nprint(os.getcwd())")
    assert not os.path.exists(r["stdout"].strip())


# ---------- через API ----------

def test_api_run_block(client):
    register(client)
    r = client.post("/api/run/python", json={"code": BLOCK, "input": {"values": [99]}, "mode": "block"})
    assert r.status_code == 200 and r.json()["output"] == [99]


def test_api_run_rights(client, admin):
    from fastapi.testclient import TestClient
    assert TestClient(client.app).post("/api/run/python", json={"code": "1"}).status_code == 401
    register(client)
    uid = client.get("/api/me").json()["user"]["id"]
    admin.execute("UPDATE memberships SET role = 'viewer' WHERE user_id = %s", (uid,))
    assert client.post("/api/run/python", json={"code": "1"}).status_code == 403


def test_api_runner_off(client, monkeypatch):
    from app import main
    register(client)
    monkeypatch.setattr(main, "RUNNER_ON", False)
    assert client.post("/api/run/python", json={"code": "1"}).status_code == 503


def test_vars_and_secrets_before_user_code():
    code = 'import triosteum\nrate = triosteum.var("СТАВКА")\n@triosteum.block("П")\ndef run(d):\n    return [rate, triosteum.secret("ТОКЕН"), triosteum.var("НЕТ", "по умолчанию")]\n'
    r = sandbox.run(code, {}, "block", {"СТАВКА": "7"}, {"ТОКЕН": "t-1"})
    assert r["ok"] and r["output"] == ["7", "t-1", "по умолчанию"]
    assert sandbox.run(code, {}, "block")["output"] == [None, None, "по умолчанию"]     # без переменных — значения по умолчанию
