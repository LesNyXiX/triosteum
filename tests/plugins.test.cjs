// Каждый Python-плагин библиотеки запускается на своих тестовых данных (как в браузере), без ошибок.
// У каждого плагина есть раздел, название, описание и код. Запуск: node tests/plugins.test.cjs
const fs = require('fs'), vm = require('vm'), path = require('path'), { execFileSync } = require('child_process');
const src = ['langs-plugins.js', 'plugins-more.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'core', f), 'utf8')).join('\n');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\nthis.PLUGINS = PLUGINS;', ctx);
const STUB = `import sys, types, json
_blocks = []
def block(name="Блок", sample=None, **kw):
    def deco(fn):
        fn._t_name = name; fn._t_sample = sample; _blocks.append(fn); return fn
    return deco
for _m in ("triosteum", "yadro"):
    _mod = types.ModuleType(_m); _mod.block = block; sys.modules[_m] = _mod
`;
const RUN = `
_b = _blocks[-1]
_res = _b(_b._t_sample if _b._t_sample is not None else {"values": [120, 340, 95]})
print("<<RESULT>>" + json.dumps(_res, ensure_ascii=False, default=str))
`;
let fail = 0, n = 0;
const ids = new Set();
for (const p of ctx.PLUGINS) {
  const bad = [];
  if (ids.has(p.id)) bad.push('повтор id'); ids.add(p.id);
  if (!p.cat) bad.push('нет раздела (cat)');
  if (!p.name || !p.desc || !p.code) bad.push('нет названия, описания или кода');
  if (p.lang === 'python') {
    n++;
    try {
      const out = execFileSync('python3', ['-c', STUB + p.code + RUN], { encoding: 'utf8', timeout: 20000, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      if (!out.includes('<<RESULT>>')) bad.push('нет результата');
    } catch (e) { bad.push('ошибка запуска: ' + String(e.stderr || e.message).trim().split('\n').slice(-1)[0]); }
  }
  if (bad.length) { fail++; console.log('  ✗ ' + p.id + ' — ' + bad.join('; ')); }
}
console.log(`Плагинов: ${ctx.PLUGINS.length}, Python запущено: ${n}`);
if (fail) { console.log('Провалено: ' + fail); process.exit(1); }
console.log('Все плагины в порядке');
