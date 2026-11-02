"""Пароли, токены сессий, ограничение попыток входа."""
import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_ph = PasswordHasher()   # argon2id с параметрами по умолчанию библиотеки
# хеш-«пустышка»: проверяем его, если пользователя нет, чтобы время ответа не выдавало, есть ли такая почта
_DUMMY = _ph.hash("triosteum-dummy-password")


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(stored: str | None, pw: str) -> bool:
    try:
        return _ph.verify(stored or _DUMMY, pw) and stored is not None
    except (VerificationError, InvalidHashError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


class RateLimiter:
    """Не больше N событий в минуту на ключ (IP, почту). Хранится в памяти процесса."""

    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, *keys: str) -> bool:
        now = time.monotonic()
        with self._lock:
            ok = True
            for k in keys:
                q = self._hits[k]
                while q and now - q[0] > 60:
                    q.popleft()
                if len(q) >= self.per_minute:
                    ok = False
            if ok:
                for k in keys:
                    self._hits[k].append(now)
            return ok

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
