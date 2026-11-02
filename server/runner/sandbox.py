"""Выполнение недоверенного Python-кода с ограничениями. Только стандартная библиотека.

Слои защиты:
  1. Отдельный сервис-исполнитель в своём контейнере: без доступа к базе, секретам и интернету
     (docker-compose: внутренняя сеть, read_only, cap_drop ALL; по возможности gVisor — runtime runsc).
  2. Каждый запуск — новый процесс в пустой временной папке, с пустым окружением (никаких паролей
     и ключей), от непривилегированного пользователя, в своей группе процессов.
  3. Лимиты ядра: процессорное время, память, число процессов, размер файлов, открытые файлы;
     плюс общий таймаут по часам и ограничение объёма вывода.
  4. Если доступно — отдельное пустое сетевое пространство (unshare --net): сети нет вообще.
"""
import json
import os
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HARNESS = Path(__file__).with_name("harness.py")
PY = sys.executable


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


LIMITS = {
    "timeout_sec": _int_env("RUN_TIMEOUT_SEC", 20),       # по часам
    "cpu_sec": _int_env("RUN_CPU_SEC", 15),               # процессорное время
    "memory_mb": _int_env("RUN_MEMORY_MB", 512),
    "max_output": _int_env("RUN_MAX_OUTPUT", 200_000),    # символов вывода
    "file_mb": _int_env("RUN_FILE_MB", 16),
    "procs": _int_env("RUN_PROCS", 32),
}

_NET_ISOLATION = None
NET_OFF = False


def _try_unshare_net() -> bool:
    if not hasattr(os, "unshare"):
        return False
    try:
        os.unshare(os.CLONE_NEWNET)
        return True
    except OSError:
        return False


def net_isolation_available() -> bool:
    """Можно ли отключить сеть процессу: отдельное пустое сетевое пространство (нужны права root в контейнере)."""
    global _NET_ISOLATION
    if _NET_ISOLATION is None:
        try:
            pid = os.fork()
            if pid == 0:
                os._exit(0 if _try_unshare_net() else 1)
            _NET_ISOLATION = os.waitpid(pid, 0)[1] == 0
        except OSError:
            _NET_ISOLATION = False
    return _NET_ISOLATION


def _limits(mem_mb, cpu, file_mb, procs):
    def apply():
        os.setsid()                                            # своя группа — убьём вместе с дочерними
        if NET_OFF:
            _try_unshare_net()                                 # сеть отключаем, пока ещё есть права
        resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
        resource.setrlimit(resource.RLIMIT_AS, (mem_mb * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_FSIZE, (file_mb * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (procs, procs))
        except (ValueError, OSError):
            pass
        if os.getuid() == 0:                                   # если исполнитель запущен от root — сбрасываем права
            os.setgroups([])
            os.setgid(65534)
            os.setuid(65534)
    return apply


def run(code: str, input_data=None, mode: str = "block") -> dict:
    """Выполнить код. Возвращает {ok, stdout, stderr, output?, error?, ms, limits}."""
    global NET_OFF
    lim = LIMITS
    NET_OFF = net_isolation_available()
    work = tempfile.mkdtemp(prefix="trun-")
    os.chmod(work, 0o777)
    job = json.dumps({"code": code, "input": input_data, "mode": mode}, ensure_ascii=False)
    cmd = [PY, "-I", "-X", "utf8", "-B", str(HARNESS)]
    env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": work, "LANG": "C.UTF-8", "PYTHONIOENCODING": "utf-8", "MPLBACKEND": "Agg"}
    t0 = time.monotonic()
    timed_out = False
    try:
        p = subprocess.Popen(cmd, cwd=work, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             preexec_fn=_limits(lim["memory_mb"], lim["cpu_sec"], lim["file_mb"], lim["procs"]))
        try:
            out, err = p.communicate(job.encode(), timeout=lim["timeout_sec"])
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            out, err = p.communicate()
        rc = p.returncode
        res_file = Path(work) / "result.json"
        status = {}
        if res_file.exists() and res_file.stat().st_size < 5_000_000:
            try:
                status = json.loads(res_file.read_text(encoding="utf-8"))
            except ValueError:
                status = {}
    finally:
        shutil.rmtree(work, ignore_errors=True)
    ms = int((time.monotonic() - t0) * 1000)
    mx = lim["max_output"]
    stdout, stderr = out.decode("utf-8", "replace"), err.decode("utf-8", "replace")
    res = {"stdout": stdout[:mx] + ("\n… вывод обрезан" if len(stdout) > mx else ""), "stderr": stderr[-mx:], "ms": ms,
           "limits": {k: lim[k] for k in ("timeout_sec", "memory_mb")}, "net_isolated": net_isolation_available()}
    if timed_out:
        return {**res, "ok": False, "error": f"Превышено время выполнения ({lim['timeout_sec']} с)"}
    if rc is not None and rc < 0:
        sig = -rc
        why = {signal.SIGXCPU: f"Превышено процессорное время ({lim['cpu_sec']} с)", signal.SIGKILL: "Процесс остановлен: превышены ограничения",
               signal.SIGXFSZ: f"Слишком большой файл (больше {lim['file_mb']} МБ)", signal.SIGSEGV: "Аварийное завершение"}.get(sig, f"Процесс остановлен сигналом {sig}")
        return {**res, "ok": False, "error": why}
    if not status:
        tail = stderr.strip().splitlines()[-1:] if stderr.strip() else []
        if "MemoryError" in stderr:
            return {**res, "ok": False, "error": f"Не хватило памяти (лимит {lim['memory_mb']} МБ)"}
        return {**res, "ok": False, "error": tail[0] if tail else "Код завершился без результата"}
    if not status.get("ok") and "MemoryError" in (status.get("error") or ""):
        status["error"] = f"Не хватило памяти (лимит {lim['memory_mb']} МБ)"
    return {**res, **status}
