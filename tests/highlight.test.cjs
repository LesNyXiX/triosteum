// Подсветка кода: текст не меняется, ключевые элементы получают цвета своей среды.
const fs = require('fs'), path = require('path');
const api = new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'editor', 'highlight.js'), 'utf8') + '\nreturn { hlCode, ideFor, hlInline };')();
let failed = 0, n = 0;
const check = (ok, name) => { n++; console.log((ok ? '  ✓ ' : '  ✗ ') + name); if (!ok) failed++; };
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const cases = [
  ['python', '@block(name="X")\ndef run(data):\n    # комментарий\n    return {"t": sum(data["v"]) * 1.5}  # x\n', ['h-deco', 'h-kw">def', 'h-fn">run', 'h-com', 'h-bi">sum', 'h-num">1.5']],
  ['cpp', '#include <vector>\nstruct Row { double v; };\nTRIOSTEUM_BLOCK("a")\ndouble run(const Row& r) { return r.v * 2; } // c\n', ['h-pre">#include', 'h-inc', 'h-kw">struct', 'h-type">Row', 'h-const">TRIOSTEUM_BLOCK', 'h-ctl">return', 'h-com']],
  ['csharp', 'using System.Linq;\n[Block("Б")]\npublic class B : IBlock { public int Run(Data d) => $"x{d.Get<int>("k")}".Length; }\n', ['h-kw">using', 'h-type">Block', 'h-kw">class', 'h-type">B', 'h-fn">Run', 'h-esc">{']],
  ['html', '<!-- c -->\n<div class="a">x &amp; y</div>\n<script>let a = 1;</script>\n<style>.a{color:red}</style>\n', ['h-com', 'h-tag">div', 'h-attr">class', 'h-aval', 'h-ent', 'h-kw">let', 'h-prop">color']],
  ['1c', 'Функция Выполнить(Вх) Экспорт\n  З = Новый Запрос("ВЫБРАТЬ Т.А КАК Б ИЗ Т");\n  Возврат \'20260101\'; // к\nКонецФункции\n', ['h-kw">Функция', 'h-id">Выполнить', 'h-qkw">ВЫБРАТЬ', 'h-date', 'h-com', 'h-kw">КонецФункции']]
];
cases.forEach(([lang, src, need]) => {
  const h = api.hlCode(src, lang);
  check(text(h) === src, lang + ': текст после подсветки не изменился');
  need.forEach((k) => check(h.indexOf(k) >= 0, lang + ': ' + k.replace(/"?>.*/, '') + ' ' + (k.split('>')[1] || '')));
});
check(api.ideFor('python').ide === 'PyCharm' && api.ideFor('cpp').ide === 'Visual Studio' && api.ideFor('csharp').ide === 'Visual Studio' && api.ideFor('html').ide === 'VS Code' && api.ideFor('1c').ide === 'Конфигуратор 1С', 'у каждого языка своя среда');
check(/style="color:#CC7832/.test(api.hlInline('def x(): pass', 'python')), 'код в документе — с цветами прямо в разметке');
console.log(failed ? '\nНе прошло: ' + failed + ' из ' + n : '\nВсе проверки пройдены: ' + n);
process.exit(failed ? 1 : 0);
