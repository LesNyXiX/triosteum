// Python на сервере: triosteum.var() и triosteum.secret() работают через настоящий server/runner/harness.py.
// Берём функции подстановки из src/app/board/vars.js и гоняем результат в harness. Запуск: node tests/vars-server.test.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'board', 'vars.js'), 'utf8');
const head = src.slice(src.indexOf('  var VAR_RX'), src.indexOf('  (function(){\n    var _norm'));   // константы и функции до обёрток
const G = { vars: [{ k: 'СТАВКА', test: '5', prod: '7' }], varProfile: 'prod' }, warns = [];
const api = new Function('G', 'secretGet', 'toast', 'rlog', 'CMP', head + '\nreturn { varServerCtx: varServerCtx, varSubst: varSubst, varMask: varMask, varPyApi: varPyApi, SCHEME_MOD: SCHEME_MOD };')(
  G, (n) => (n === 'ТОКЕН' ? 'tok-12345' : undefined), (t) => warns.push(t), (t) => warns.push(t), { busy: false });
let failed = 0; const check = (ok, name) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const harness = path.join(__dirname, '..', 'server', 'runner', 'harness.py');
const os = require('os');
const run = (code) => {
  const ctx = api.varServerCtx(code) || {};   // как serverRun(): переменные и названные секреты — отдельными полями задания   // harness пишет итог в result.json текущей папки — запускаем во временной
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvars-'));
  try { execFileSync('python3', [harness], { input: JSON.stringify({ code, input: {}, mode: 'block', vars: ctx.vars, secrets: ctx.secrets }), cwd: dir, encoding: 'utf8' }); } catch (e) { /* ошибка кода — в result.json */ }
  const r = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); fs.rmSync(dir, { recursive: true, force: true }); return r;
};
let r = run(('import triosteum\n@triosteum.block("Т")\ndef run(d):\n    return [triosteum.var("СТАВКА"), triosteum.secret("ТОКЕН"), triosteum.var("НЕТ", "по умолчанию")]\n'));
check(r.ok && JSON.stringify(r.output) === JSON.stringify(['7', 'tok-12345', 'по умолчанию']), 'triosteum.var/secret на сервере: ' + JSON.stringify(r.output || r.error));
r = run(('from triosteum import block, var\n@block("Т")\ndef run(d):\n    return var("СТАВКА")\n'));
check(r.ok && r.output === '7', 'from triosteum import var — тоже работает: ' + JSON.stringify(r.output || r.error));
r = run(('import triosteum\n@triosteum.block("Т")\ndef run(d):\n    x = 1\n    return undefined_name\n'));
check(!r.ok && /line 5|строка 5|<блок>", line 5/.test(JSON.stringify(r)), 'номер строки ошибки не сдвинут');
r = run('import triosteum\nrate = triosteum.var("СТАВКА")\ntok = triosteum.secret("ТОКЕН")\n@triosteum.block("Т")\ndef run(d):\n    return [rate, tok]\n');
check(r.ok && JSON.stringify(r.output) === JSON.stringify(['7', 'tok-12345']), 'чтение переменной и секрета на уровне модуля: ' + JSON.stringify(r.output || r.error));
r = run('import triosteum\n@triosteum.block("Т")\ndef run(d):\n    return triosteum.secret("ДРУГОЙ")\n');
check(r.ok && r.output === null, 'неизвестный секрет — значение по умолчанию (None)');
check(api.varMask('ошибка: tok-12345 не принят') === 'ошибка: •••••• не принят', 'секрет скрывается в тексте ошибки');
{
  const api2 = new Function('G', 'secretGet', 'toast', 'rlog', 'CMP', head + '\nreturn { varSubst: varSubst, varMask: varMask };')(G, (n) => (n === 'П' ? 'ab"cd\\ef\ngh' : undefined), () => {}, () => {}, { busy: false });
  api2.varSubst('{{secret:П}}');
  const shown = JSON.stringify({ out: 'ab"cd\\ef\ngh' });
  check(!/ab\\"cd/.test(api2.varMask(shown)) && /••••••/.test(api2.varMask(shown)), 'секрет с кавычкой, \\ и переводом строки скрыт и в JSON-виде: ' + api2.varMask(shown));
}
{
  // короткий секрет (PIN) тоже скрывается — отдельным значением, но не внутри других чисел
  const api3 = new Function('G', 'secretGet', 'toast', 'rlog', 'CMP', head + '\nreturn { varSubst: varSubst, varMask: varMask };')(G, (n) => (n === 'PIN' ? '123' : undefined), () => {}, () => {}, { busy: false });
  api3.varSubst('{{secret:PIN}}');
  check(api3.varMask('PIN=123') === 'PIN=••••••' && api3.varMask('{"pin":"123"}') === '{"pin":"••••••"}' && api3.varMask('счёт 41234') === 'счёт 41234', 'короткий секрет «123» скрыт: ' + api3.varMask('PIN=123') + ' · ' + api3.varMask('счёт 41234'));
}
{
  // «Целостный код схемы»: сборщик создаёт свой модуль triosteum — var()/secret() должны остаться
  const bsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'ai', 'backend-code.js'), 'utf8');
  const from = bsrc.indexOf("L.push('_blocks = []');"), to = bsrc.indexOf("L.push('sys.modules[\"triosteum\"] = _mod');");
  const lits = (bsrc.slice(from, to) + "L.push('sys.modules[\"triosteum\"] = _mod');").match(/L\.push\(('(?:[^'\\]|\\.)*')\);/g).map((x) => new Function('return ' + x.slice(7, -2))());
  const prelude = 'import json, sys, types\n' + lits.join('\n') + '\n';
  const body = 'import triosteum\nassert triosteum.var("СТАВКА") == "7", triosteum.var("СТАВКА")\nassert triosteum.secret("ТОКЕН") == "tok-12345"\n';
  // сервер: модуль среды запуска (harness) уже есть — сборщик сохраняет его var()/secret()
  const ctx = api.varServerCtx(prelude + body) || {}, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tvars-'));
  try { execFileSync('python3', [harness], { input: JSON.stringify({ code: prelude + body, input: null, mode: 'script', vars: ctx.vars, secrets: ctx.secrets }), cwd: dir, encoding: 'utf8' }); } catch (e) {}
  const rs = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')); fs.rmSync(dir, { recursive: true, force: true });
  check(rs.ok, 'целостный код схемы на сервере: triosteum.var/secret работают' + (rs.ok ? '' : ': ' + rs.error));
  // браузер: обёртка Pyodide вставляет API сразу после модуля сборщика (js.__tSecret — заглушка)
  const code = (prelude + body).replace(api.SCHEME_MOD, api.SCHEME_MOD + '\n' + api.varPyApi());
  const fake = 'import sys, types\n_js = types.ModuleType("js"); _js.__tSecret = lambda n: "tok-12345" if n == "ТОКЕН" else None; sys.modules["js"] = _js\n';
  let ok = true, err = '';
  try { execFileSync('python3', ['-c', fake + code], { encoding: 'utf8', stdio: 'pipe' }); } catch (e) { ok = false; err = String(e.stderr).trim().split('\n').pop(); }
  check(ok, 'целостный код схемы в браузере: API вставлен после модуля сборщика' + (ok ? '' : ': ' + err));
  // вне Triosteum (без среды запуска) — значения по умолчанию, без ошибки
  let ok2 = true;
  try { execFileSync('python3', ['-c', prelude + 'import triosteum\nassert triosteum.var("X", 5) == 5 and triosteum.secret("Y") is None\n'], { stdio: 'pipe' }); } catch (e) { ok2 = false; }
  check(ok2, 'вне Triosteum var()/secret() возвращают значения по умолчанию');
}
{
  // многострочный секрет: вывод приходит по строкам — каждая строка секрета тоже скрыта
  const api4 = new Function('G', 'secretGet', 'toast', 'rlog', 'CMP', head + '\nreturn { varSubst: varSubst, varMask: varMask };')(G, (n) => (n === 'М' ? 'abcd\nefgh' : undefined), () => {}, () => {}, { busy: false });
  api4.varSubst('{{secret:М}}');
  check(api4.varMask('abcd') === '••••••' && api4.varMask('  efgh') === '  ••••••' && api4.varMask('abcd\nefgh') === '••••••', 'многострочный секрет скрыт и по строкам: ' + JSON.stringify([api4.varMask('abcd'), api4.varMask('  efgh')]));
}
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло'); process.exit(failed ? 1 : 0);
