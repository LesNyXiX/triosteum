"""Сервис-исполнитель: принимает задания только от сервера Triosteum по внутренней сети.

Запуск: python service.py  (порт 8100). Проверка подлинности — общий секрет RUNNER_TOKEN в заголовке.
"""
import hmac
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sandbox  # noqa: E402

TOKEN = os.environ.get("RUNNER_TOKEN", "")
SLOTS = threading.BoundedSemaphore(int(os.environ.get("RUNNER_PARALLEL", "4")))   # одновременных запусков


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "net_isolated": sandbox.net_isolation_available()})
        self._send(404, {"detail": "Не найдено"})

    def do_POST(self):
        if self.path != "/run":
            return self._send(404, {"detail": "Не найдено"})
        if not TOKEN or not hmac.compare_digest(self.headers.get("X-Runner-Token", ""), TOKEN):
            return self._send(403, {"detail": "Нет доступа"})
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            return self._send(413, {"detail": "Слишком большое задание"})
        try:
            job = json.loads(self.rfile.read(n))
        except ValueError:
            return self._send(400, {"detail": "Неверное задание"})
        if not SLOTS.acquire(timeout=30):
            return self._send(503, {"detail": "Исполнитель занят — попробуйте через минуту"})
        try:
            self._send(200, sandbox.run(str(job.get("code", "")), job.get("input"), job.get("mode", "block"),
                                             job.get("vars") if isinstance(job.get("vars"), dict) else None,
                                             job.get("secrets") if isinstance(job.get("secrets"), dict) else None))
        finally:
            SLOTS.release()


if __name__ == "__main__":
    if not TOKEN:
        sys.exit("Задайте RUNNER_TOKEN")
    port = int(os.environ.get("RUNNER_PORT", "8100"))
    print(f"Исполнитель Triosteum слушает порт {port}; сеть для кода отключена: {sandbox.net_isolation_available()}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
