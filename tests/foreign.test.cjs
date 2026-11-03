// Встроенные исполнители C++, C# и 1С: готовые плагины, аналоги и отдельные конструкции языков.
// Запуск: node tests/foreign.test.cjs
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'app', f), 'utf8');
const code = [src('core/langs-plugins.js'), src('editor/lang-cfam.js'), src('editor/lang-bsl.js'), src('editor/lang-run.js'), 'return { runForeign, PLUGINS, VARIANTS };'].join('\n');
const api = new Function('sheetValues', 'ofByName', code)(() => [['Номер', 'Сумма'], ['Д-1', 100], ['Д-2', 250]], (n) => n === 'Реестр' ? { data:{ sheets:[{ name:'Лист1' }] } } : null);
let failed = 0, n = 0;
const check = (ok, name, extra) => { n++; if (!ok) { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); } else console.log('  ✓ ' + name); };
const run = (lang, c, input) => api.runForeign(lang, c, input === undefined ? null : input);
const near = (a, b) => Math.abs(a - b) < 1e-6;

console.log('Готовые плагины (демо-данные)');
const expectErr = { 'cs-telegram':/Секрет/, 'cs-email':/Секрет|почт/, 'cs-excel':/не найдена на рабочем столе|Во входных данных нет поля/ };
api.PLUGINS.filter((p) => ['cpp', 'csharp', '1c'].includes(p.lang)).forEach((p) => {
  const r = run(p.lang, p.code);
  if (expectErr[p.id]) check(!r.ok && expectErr[p.id].test(r.error), p.name + ': понятная ошибка', r.error);
  else check(r.ok, p.name + ': ' + (r.ok ? JSON.stringify(r.output).slice(0, 90) : ''), r.error);
});
console.log('Аналоги на C++ / C# / 1С');
Object.keys(api.VARIANTS).forEach((fam) => ['cpp', 'csharp', '1c'].forEach((l) => { const c = api.VARIANTS[fam][l]; if (!c) return; const r = run(l, c); check(r.ok, fam + ' · ' + l + ': ' + (r.ok ? JSON.stringify(r.output).slice(0, 80) : ''), r.error); }));

console.log('Значения');
const P = (id) => api.PLUGINS.find((p) => p.id === id).code;
let r = run('cpp', P('cpp-oee'), [{ planned_min:480, run_min:420, ideal_rate:2, produced:800, good:768 }]);
check(r.ok && near(r.output[0]['Результат'], 0.8), 'OEE по строке: 0.8', JSON.stringify(r.output || r.error));
r = run('cpp', P('cpp-cost'), [{ qty:2, price:150 }, { qty:3, price:10 }]);
check(r.ok && r.output === 330, 'себестоимость партии: 330', JSON.stringify(r.output || r.error));
r = run('cpp', P('cpp-filter'), [{ 'Значение':10 }, { 'Значение':20 }, { 'Значение':30 }]);
check(r.ok && JSON.stringify(r.output) === '[10,15,20]', 'сглаживание из строк с полем «Значение»', JSON.stringify(r.output || r.error));
r = run('cpp', api.VARIANTS.margin.cpp, [{ Заказ:'A', Выручка:100, Себестоимость:80 }]);
check(r.ok && r.output[0].id === 'A' && near(r.output[0].margin_pct, 20), 'C++ маржа с русскими полями (синонимы)', JSON.stringify(r.output || r.error));
r = run('csharp', api.VARIANTS.margin.csharp, [{ id:'A', revenue:100, cost:80 }, { id:'B', revenue:0, cost:5 }]);
check(r.ok && r.output.length === 1 && near(r.output[0].MarginPct, 20), 'C# маржа: LINQ Where/Select, записи', JSON.stringify(r.output || r.error));
r = run('1c', P('1c-orders'));
check(r.ok && r.output.length === 2 && r.output[0]['Номер'] === 'З-1047' && r.output[0]['Сумма'] === 12800000, '1С запрос: ГДЕ Проведен И Статус = &Статус', JSON.stringify(r.output || r.error));
r = run('1c', P('1c-writeoff'));
check(r.ok && r.output.length === 2 && near(r.output.find((x) => /Лист/.test(x['Материал']))['Списано'], 4.3), '1С запрос: СУММА и СГРУППИРОВАТЬ ПО', JSON.stringify(r.output || r.error));
r = run('1c', P('1c-stock'));
check(r.ok && r.output.length === 3, '1С: виртуальная таблица Остатки, поле ВНаличииОстаток', JSON.stringify(r.output || r.error));
r = run('1c', P('1c-orders'), [{ Номер:'X-1', Дата:'01.11.2026', Контрагент:'ООО Тест', СуммаДокумента:500, Проведен:true, Статус:'КВыполнению' }, { Номер:'X-2', Дата:'01.11.2026', Контрагент:'ООО Б', СуммаДокумента:900, Проведен:false, Статус:'КВыполнению' }]);
check(r.ok && r.output.length === 1 && r.output[0]['Номер'] === 'X-1', '1С запрос над входными записями схемы', JSON.stringify(r.output || r.error));
r = run('1c', api.VARIANTS.forecast['1c']);
check(r.ok && near(r.output, 22.6), '1С: прогноз Окр(…, 2) = 22.6', JSON.stringify(r.output || r.error));

console.log('Конструкции языков');
r = run('cpp', '#include <vector>\nint run(){ int a = 7 / 2; double b = 7 / 2.0; std::vector<int> v{3,1,2}; std::sort(v.begin(), v.end()); int s = 0; for (auto x : v) s += x; std::cout << "a=" << a << std::endl; return a * 100 + s; }');
check(r.ok && r.output === 306 && r.stdout[0] === 'a=3', 'C++: целочисленное деление, sort, range-for, cout', JSON.stringify(r));
r = run('cpp', '#include <map>\n#include <string>\nstruct P { std::string k; double v; };\nstd::map<std::string,double> run(const std::vector<P>& ps){ std::map<std::string,double> m; for (const auto& p : ps) m[p.k] += p.v; return m; }', [{ k:'a', v:1 }, { k:'b', v:2 }, { k:'a', v:3 }]);
check(r.ok && r.output.a === 4 && r.output.b === 2, 'C++: std::map с накоплением, struct', JSON.stringify(r.output || r.error));
r = run('cpp', 'double run(double x){ auto sq = [](double t){ return t * t; }; return std::max(sq(x), 10.0); }', 5);
check(r.ok && r.output === 25, 'C++: лямбда и std::max', JSON.stringify(r.output || r.error));
r = run('csharp', 'using System; using System.Linq; using System.Collections.Generic;\npublic class B { public object Run(List<Dictionary<string, object>> rows) { var g = rows.GroupBy(r => r["Склад"]).Select(x => new { Склад = x.Key, Всего = x.Sum(r => Convert.ToDouble(r["Кол"])) }).OrderByDescending(x => x.Всего).ToList(); Console.WriteLine($"Групп: {g.Count}, первая {g[0].Склад} = {g[0].Всего:N1}"); return g; } }', [{ Склад:'А', Кол:2 }, { Склад:'Б', Кол:5 }, { Склад:'А', Кол:1.5 }]);
check(r.ok && r.output[0]['Склад'] === 'Б' && r.output[1]['Всего'] === 3.5 && /Групп: 2, первая Б = 5,0/.test(r.stdout[0]), 'C#: GroupBy, анонимные объекты, интерполяция с форматом', JSON.stringify(r));
r = run('csharp', 'public class B { private int n = 0; public int Run(Data input) { var d = new Dictionary<string,int>(); foreach (var w in "a b a c a".Split(\' \')) { if (d.TryGetValue(w, out var c)) d[w] = c + 1; else d[w] = 1; } n = d["a"]; return n * 10 + input.Get<int>("k"); } }', { k:7 });
check(r.ok && r.output === 37, 'C#: Dictionary, TryGetValue out var, поле класса, Data.Get<int>', JSON.stringify(r.output || r.error));
r = run('csharp', 'using ClosedXML.Excel;\npublic class B { public object Run(Data input) { using var book = new XLWorkbook("Реестр"); var sh = book.Worksheet(1); return sh.RowsUsed().Skip(1).Select(x => x.Cell(2).GetDouble()).Sum(); } }', {});
check(r.ok && r.output === 350, 'C#: ClosedXML читает таблицу с рабочего стола Triosteum', JSON.stringify(r.output || r.error));
r = run('1c', 'Функция Выполнить(Вх) Экспорт\n  Т = Новый ТаблицаЗначений; Т.Колонки.Добавить("Склад"); Т.Колонки.Добавить("Кол");\n  Для Каждого С Из Вх Цикл Н = Т.Добавить(); Н.Склад = С.Склад; Н.Кол = С.Кол; КонецЦикла;\n  Т.Свернуть("Склад", "Кол"); Т.Сортировать("Кол Убыв");\n  С = Новый Структура("Всего", Т.Итог("Кол"));\n  Сообщить("Итого: " + Формат(С.Всего, "ЧДЦ=1"));\n  Возврат Т;\nКонецФункции', [{ Склад:'А', Кол:2 }, { Склад:'Б', Кол:5 }, { Склад:'А', Кол:1.5 }]);
check(r.ok && r.output[0]['Склад'] === 'Б' && r.output[1]['Кол'] === 3.5 && r.stdout[0] === 'Итого: 8,5', '1С: ТаблицаЗначений, Свернуть, Сортировать, Итог, Формат', JSON.stringify(r));
r = run('1c', 'Функция Выполнить(Вх) Экспорт\n Попытка\n  А = 1 / 0;\n Исключение\n  Возврат "поймано: " + ОписаниеОшибки();\n КонецПопытки;\nКонецФункции', {});
check(r.ok && /поймано: Деление на 0/.test(r.output), '1С: Попытка / Исключение', JSON.stringify(r.output || r.error));
r = run('1c', 'Функция Выполнить(Вх) Экспорт\n  Возврат Вх.Нет;\nКонецФункции', {});
check(!r.ok && /Поле объекта не обнаружено \(Нет\).*строка 2/.test(r.error), '1С: понятная ошибка с номером строки', r.error);
r = run('cpp', 'int run(){ return undefined_var + 1; }');
check(!r.ok && /Неизвестное имя «undefined_var».*строка 1/.test(r.error), 'C++: понятная ошибка с номером строки', r.error);

console.log(failed ? '\nНе прошло: ' + failed + ' из ' + n : '\nВсе проверки пройдены: ' + n);
process.exit(failed ? 1 : 0);
