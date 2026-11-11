// Python на сервере: triosteum.var() и triosteum.secret() работают через настоящий server/runner/harness.py.
// Берём функции подстановки из src/app/board/vars.js и гоняем результат в harness. Запуск: node tests/vars-server.test.cjs
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'board', 'vars.js'), 'utf8');
const head = src.slice(src.indexOf('  var VAR_RX'), src.indexOf('  (function(){\n    var _norm'));   // константы и функции до обёрток
const G = { vars: [{ k: 'СТАВКА', test: '5', prod: '7' }], varProfile: 'prod' }, warns = [];
const api = new Function('G', 'secretGet', 'toast', 'rlog', 'CMP', head + '\nreturn { varServerCtx: varServerCtx, varSubst: varSubst, varMask: varMask };')(
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
console.log(failed ? '\nПровалено: ' + failed : '\nВсё прошло'); process.exit(failed ? 1 : 0);
