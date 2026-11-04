// Набор типичных программ на C++, C# и 1С: каждая должна выполниться встроенным исполнителем
// и дать тот же результат, что настоящий компилятор/платформа.
// Запуск: node tests/lang-corpus.test.cjs
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'app', f), 'utf8');
const api = new Function('sheetValues', 'ofByName', [src('core/langs-plugins.js'), src('editor/lang-cfam.js'), src('editor/lang-bsl.js'), src('editor/lang-run.js'), 'return { runForeign };'].join('\n'))(() => [], () => null);
const dir = path.join(__dirname, 'lang-cases');
let failed = 0, n = 0;
fs.readdirSync(dir).filter((f) => f.endsWith('.cjs')).sort().forEach((f) => {
  console.log(f);
  require(path.join(dir, f)).forEach((c) => {
    n++;
    const r = api.runForeign(c.l, c.c, c.i === undefined ? null : c.i);
    const ok = r.ok && (c.e === undefined || JSON.stringify(r.output) === JSON.stringify(c.e)) && (!c.so || r.stdout.length > 0);
    if (!ok) failed++;
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + c.l + ': ' + c.n + (ok ? '' : ' → ' + (r.ok ? JSON.stringify(r.output) + ' ожидалось ' + JSON.stringify(c.e) : r.error)));
  });
});
console.log(failed ? '\nНе прошло: ' + failed + ' из ' + n : '\nВсе проверки пройдены: ' + n);
process.exit(failed ? 1 : 0);
