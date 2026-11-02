"""ИИ-прокси: окно «AI» обращается к серверу, сервер — к модели через сменный адаптер.

Какая модель работает, задаёт переменная AI_PROVIDER:
  openai   — любая программа со стандартным интерфейсом OpenAI: своя модель через Ollama или vLLM
             (AI_BASE_URL=http://ollama:11434/v1, AI_MODEL=qwen2.5-coder:14b), бесплатно, данные не уходят с сервера
  yandex   — YandexGPT в Yandex AI Studio (YANDEX_API_KEY, YANDEX_FOLDER_ID, AI_MODEL=yandexgpt)
  echo     — заглушка для проверок: повторяет начало запроса
  (пусто)  — ИИ выключен
"""
import json
import os
from dataclasses import dataclass, field
from typing import Iterator

import httpx


@dataclass
class Usage:
    tokens_in: int = 0
    tokens_out: int = 0


@dataclass
class Result:
    usage: Usage = field(default_factory=Usage)


def estimate_tokens(text: str) -> int:
    """Оценка, если модель не сообщила расход: ~3 символа на токен для русского текста с кодом."""
    return max(1, len(text) // 3)


class Provider:
    name = "off"
    model = ""

    def stream(self, system: str, prompt: str, max_tokens: int, result: Result) -> Iterator[str]:
        raise NotImplementedError


class EchoProvider(Provider):
    name = "echo"
    model = "echo"

    def stream(self, system, prompt, max_tokens, result):
        text = "Заглушка ИИ. Получен запрос (" + str(len(prompt)) + " симв.): " + prompt[:80].replace("\n", " ")
        for i in range(0, len(text), 12):
            yield text[i:i + 12]
        result.usage = Usage(estimate_tokens(system + prompt), estimate_tokens(text))


class OpenAICompatible(Provider):
    """Стандартный интерфейс /chat/completions с потоковой выдачей (Server-Sent Events)."""
    name = "openai"

    def __init__(self, base_url: str, model: str, api_key: str = "", headers: dict | None = None, timeout: float = 120):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.headers = {"Content-Type": "application/json", **(headers or {})}
        if api_key:
            self.headers["Authorization"] = "Bearer " + api_key
        self.timeout = timeout

    def stream(self, system, prompt, max_tokens, result):
        body = {"model": self.model, "stream": True, "max_tokens": max_tokens, "temperature": 0.3,
                "stream_options": {"include_usage": True},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}]}
        got = []
        with httpx.Client(timeout=httpx.Timeout(self.timeout, connect=10)) as client:
            with client.stream("POST", self.base_url + "/chat/completions", headers=self.headers, json=body) as r:
                if r.status_code >= 400:
                    detail = r.read().decode("utf-8", "replace")[:300]
                    raise AIError(f"Модель ответила ошибкой {r.status_code}: {detail}")
                for line in r.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        ev = json.loads(data)
                    except ValueError:
                        continue
                    if ev.get("usage"):
                        u = ev["usage"]
                        result.usage = Usage(int(u.get("prompt_tokens") or 0), int(u.get("completion_tokens") or 0))
                    for ch in ev.get("choices") or []:
                        piece = (ch.get("delta") or {}).get("content")
                        if piece:
                            got.append(piece)
                            yield piece
        if not result.usage.tokens_in:
            result.usage = Usage(estimate_tokens(system + prompt), estimate_tokens("".join(got)))


class AIError(Exception):
    pass


def from_env() -> Provider | None:
    kind = (os.environ.get("AI_PROVIDER") or "").strip().lower()
    if kind == "echo":
        return EchoProvider()
    if kind == "openai":
        base = os.environ.get("AI_BASE_URL") or "http://127.0.0.1:11434/v1"
        p = OpenAICompatible(base, os.environ.get("AI_MODEL") or "qwen2.5-coder:7b", os.environ.get("AI_API_KEY", ""))
        p.name = "openai"
        return p
    if kind == "yandex":
        key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
        if not key or not folder:
            return None
        model = os.environ.get("AI_MODEL") or "yandexgpt"
        # совместимый с OpenAI интерфейс Yandex AI Studio; модель адресуется через каталог
        p = OpenAICompatible(os.environ.get("AI_BASE_URL") or "https://llm.api.cloud.yandex.net/v1",
                             f"gpt://{folder}/{model}/latest", key, headers={"OpenAI-Project": folder})
        p.name = "yandex"
        return p
    return None
