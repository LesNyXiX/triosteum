// Общий исполнитель отправляет Python на настоящий серверный harness, без контейнерного sandbox.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const harness = fs.readFileSync(path.join(root, 'server/runner/harness.py'), 'utf8');
const python = process.env.PYTHON || 'python3';
const CMP = {}, n = { id:'a', lang:'python', codes:{} };
async function serverRun(code, input, mode) {
  code = code.replaceAll('{{var:x}}', 'SUB');   // как обёртка serverRun в vars.js: подстановка во всём исходнике
  // Файлы harness перенаправлены в память: тест одинаково работает в Linux и Windows.
  const job = JSON.stringify({ code, input, mode });
  const script = 'import io, sys, builtins, os\n' +
    'sys.stdin = io.StringIO(' + JSON.stringify(job) + ')\n' +
    '_result = io.StringIO()\n_open = builtins.open\n' +
    'class Capture(io.StringIO):\n    def close(self):\n        pass\n' +
    '_result = Capture()\n' +
    'builtins.open = lambda name, *args, **kw: _result if name == "result.json" else _open(os.devnull if name == "/dev/null" else name, *args, **kw)\n' +
    'exec(' + JSON.stringify(harness) + ')\nprint("__TS_RESULT__" + _result.getvalue())';
  const r = spawnSync(python, ['-c', script], { encoding:'utf8', env:{...process.env, PYTHONIOENCODING:'utf-8'}, timeout:10000 });
  assert.equal(r.status, 0, r.stderr);
  const marker = r.stdout.split('\n').find((l) => l.startsWith('__TS_RESULT__'));
  assert(marker, r.stdout);
  return JSON.parse(marker.slice(13));
}
const api = new Function('RUN_SERVER', 'serverRun', 'nodeCode', 'curId', 'nodeById', 'CMP', 'varMask',
  fs.readFileSync(path.join(root, 'src/app/board/block-exec.js'), 'utf8') + '\nreturn { executeBlock };')(
  true, serverRun, (node) => node.codes.python, () => 'p1', () => n, CMP, t => t.replaceAll('SENSITIVE_VALUE','••••••'));
(async () => {
  n.codes.python = 'from __future__ import annotations\ndef run(data):\n    return data["a"] + data["b"]';
  let r = await api.executeBlock(n, { a:2, b:3 }, { exact:true });
  assert.equal(r.ok, true); assert.equal(r.output, 5);
  n.codes.python = 'from triosteum import block\n@block(sample={"a":2,"b":3})\ndef f(data):\n    return data is None';
  r = await api.executeBlock(n, null, { exact:true }); assert.equal(r.output, true);
  n.codes.python = 'from triosteum import block\n@block(sample={"a":2,"b":3})\ndef f(data):\n    return data["a"] + data["b"]';
  r = await api.executeBlock(n, null, { capture:true }); assert.equal(r.output, 5);
  assert.deepEqual(CMP.samples.a.input, { a:2, b:3 }); assert.equal(CMP.samples.a.output, 5);
  n.codes.python = 'def run(data):\n    data["a"] += 1\n    return data["a"]';
  r = await api.executeBlock(n, {a:2}, {capture:true}); assert.equal(r.output,3); assert.deepEqual(CMP.samples.a.input,{a:2});
  r = await api.executeBlock(n, CMP.samples.a.input, {exact:true}); assert.equal(r.output,3);
  n.codes.python = 'def run(data):\n    raise ValueError("ошибка теста")';
  r = await api.executeBlock(n, {}, { exact:true }); assert.equal(r.ok, false); assert.match(r.error, /ошибка теста/);
  n.codes.python = 'def run(data):\n    return data'; r = await api.executeBlock(n, 'SENSITIVE_VALUE', {capture:true}); assert.equal(r.ok,true); assert.equal(CMP.samples.a,undefined,'секрет не сохраняется как тестовый пример');
  n.codes.python = 'def run(data):\n    return data'; r = await api.executeBlock(n, { s:'{{var:x}} и «кириллица»' }, { exact:true });
  assert.equal(r.ok, true); assert.deepEqual(r.output, { s:'{{var:x}} и «кириллица»' }, 'подстановка переменных не меняет входные данные');
  n.codes.python = 'x = 1'; r = await api.executeBlock(n, {}, { exact:true });
  assert.equal(r.ok, false); assert.match(r.error, /нет функции/);
  console.log('Серверный Python: обычная функция, декоратор, null, фактический вход и ошибки — прошли');
})().catch((e) => { console.error(e); process.exitCode = 1; });
