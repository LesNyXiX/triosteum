"""Обвязка, которая выполняется ВНУТРИ песочницы.

Читает задание из stdin: {"code": "...", "input": <данные или null>, "mode": "block" | "script"}.
mode=block — как блок на доске: код объявляет функцию с @block, она вызывается с входными данными
             (или с тестовыми данными блока), результат пишется в result.json.
mode=script — просто выполняет код (целостный код схемы).
"""
import json
import sys
import traceback
import types

job = json.loads(sys.stdin.read())
sys.stdin = open("/dev/null")          # пользовательскому коду stdin не нужен

_blocks = []


def block(name="Блок", sample=None, **kw):
    def deco(fn):
        fn._t_name, fn._t_sample = name, sample
        _blocks.append(fn)
        return fn
    return deco


for _m in ("triosteum", "yadro"):
    mod = types.ModuleType(_m)
    mod.block = block
    sys.modules[_m] = mod

ns = {"__name__": "__main__" if job.get("mode") == "script" else "triosteum_block", "block": block}
status = {"ok": True}
try:
    exec(compile(job["code"], "<блок>", "exec"), ns)
    if job.get("mode", "block") == "block" and _blocks:
        b = _blocks[-1]
        inp = job.get("input")
        if inp is None:
            inp = b._t_sample if b._t_sample is not None else {"values": [120, 340, 95]}
        res = b(inp)
        status["output"] = json.loads(json.dumps(res, ensure_ascii=False, default=str))
        status["block"] = b._t_name
except BaseException as e:      # noqa: BLE001 — сообщаем о любой ошибке кода пользователя
    status = {"ok": False, "error": "".join(traceback.format_exception_only(type(e), e)).strip(),
              "trace": traceback.format_exc(limit=-3)}
sys.stdout.flush()
with open("result.json", "w", encoding="utf-8") as f:
    json.dump(status, f, ensure_ascii=False)
