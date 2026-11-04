module.exports = [
 { l:'cpp', n:'templates', c:`template<typename T> T maxOf(const std::vector<T>& v){ T m = v[0]; for (const T& x : v) if (x > m) m = x; return m; }
int run(){ std::vector<int> v = {3, 9, 2}; return maxOf(v); }`, e:9 },
 { l:'cpp', n:'class methods+this', c:`class Acc { double s = 0; int n = 0; public: void add(double x){ s += x; ++n; } double avg() const { return n ? s / n : 0; } };
double run(const std::vector<double>& v){ Acc a; for (double x : v) a.add(x); return a.avg(); }`, i:[2,4,6], e:4 },
 { l:'cpp', n:'unordered_map + auto& [k,v]', c:`#include <unordered_map>
std::map<std::string,int> run(){ std::unordered_map<std::string,int> m; m["a"]++; m["a"]++; m["b"] = 5; std::map<std::string,int> out; for (auto& [k, v] : m) out[k] = v * 10; return out; }`, e:{a:20,b:50} },
 { l:'cpp', n:'string ops', c:`std::string run(){ std::string s = "Hello, World"; std::string up; for (char c : s) up += std::toupper(c); auto pos = s.find(","); return up.substr(0, pos) + "|" + std::to_string(s.size()); }`, e:'HELLO|12' },
 { l:'cpp', n:'while/do/switch/ternary', c:`int run(){ int i = 0, s = 0; do { switch (i % 3) { case 0: s += 1; break; case 1: s += 10; break; default: s += 100; } i++; } while (i < 6); return s > 200 ? s : -1; }`, e:222 },
 { l:'cpp', n:'sort with lambda by field + accumulate', c:`#include <algorithm>
#include <numeric>
struct P { std::string name; double v; };
std::vector<std::string> run(std::vector<P> ps){ std::sort(ps.begin(), ps.end(), [](const P& a, const P& b){ return a.v > b.v; }); std::vector<std::string> r; for (auto& p : ps) r.push_back(p.name); return r; }`, i:[{name:'a',v:1},{name:'b',v:3},{name:'c',v:2}], e:['b','c','a'] },
 { l:'cpp', n:'std::pair, make_pair, emplace_back', c:`std::vector<std::pair<std::string,int>> run(){ std::vector<std::pair<std::string,int>> v; v.emplace_back("x", 1); v.push_back(std::make_pair("y", 2)); return v; }`, e:[{first:'x',second:1},{first:'y',second:2}] },
 { l:'cpp', n:'printf + cout setprecision', c:`#include <iomanip>
int run(){ printf("%.2f %d\\n", 3.14159, 42); std::cout << std::fixed << std::setprecision(1) << 2.25 << std::endl; return 0; }`, e:0, so:1 },
 { l:'cpp', n:'const static + enum class + namespace', c:`namespace calc { const double RATE = 0.2; enum class Kind { A, B }; double tax(double x, Kind k){ return k == Kind::A ? x * RATE : 0; } }
double run(){ return calc::tax(100, calc::Kind::A); }`, e:20 },
 { l:'cpp', n:'operator overload', c:`struct V { double x, y; V operator+(const V& o) const { return {x + o.x, y + o.y}; } };
double run(){ V a{1,2}, b{3,4}; V c = a + b; return c.x * 10 + c.y; }`, e:46 },
 { l:'cpp', n:'recursion + std::function', c:`#include <functional>
int fib(int n){ return n < 2 ? n : fib(n-1) + fib(n-2); }
int run(){ std::function<int(int)> f = [](int x){ return x * 2; }; return f(fib(10)); }`, e:110 },
 { l:'cpp', n:'2D vector + size_t loops', c:`int run(){ std::vector<std::vector<int>> g(3, std::vector<int>(3, 1)); g[1][1] = 5; int s = 0; for (size_t i = 0; i < g.size(); ++i) for (size_t j = 0; j < g[i].size(); ++j) s += g[i][j]; return s; }`, e:13 },
 { l:'cpp', n:'set + count + insert', c:`#include <set>
int run(){ std::set<int> s; for (int x : {3,1,3,2}) s.insert(x); return s.size() * 10 + (s.count(2) ? 1 : 0); }`, e:31 },
 { l:'cpp', n:'Data in/out JSON fields', c:`Data run(const Data& input){ Data out; out["total"] = input["a"].get<double>() + input["b"].get<double>(); return out; }`, i:{a:2,b:3}, e:{total:5} },
 { l:'csharp', n:'generic class + interface', c:`public interface IShape { double Area(); }
public class Sq : IShape { public double S { get; } public Sq(double s){ S = s; } public double Area() => S * S; }
public class Box<T> { private List<T> items = new List<T>(); public void Add(T x) => items.Add(x); public int Count => items.Count; }
public class B { public double Run(Data d){ var b = new Box<IShape>(); b.Add(new Sq(2)); b.Add(new Sq(3)); IShape s = new Sq(4); return b.Count * 100 + s.Area(); } }`, i:{}, e:216 },
 { l:'csharp', n:'switch expression + pattern', c:`public class B { static string Grade(int x) => x switch { >= 90 => "A", >= 70 => "B", _ => "C" }; public string Run(Data d) => Grade(95) + Grade(75) + Grade(10); }`, i:{}, e:'ABC' },
 { l:'csharp', n:'LINQ query syntax', c:`using System.Linq;
public class B { public object Run(List<Dictionary<string, object>> rows){ var q = from r in rows where (double)r["v"] > 1 orderby r["n"] descending select r["n"]; return q.ToList(); } }`, i:[{n:'a',v:1},{n:'b',v:2},{n:'c',v:3}], e:['c','b'] },
 { l:'csharp', n:'tuples + deconstruction + local function', c:`public class B { public int Run(Data d){ (int a, int b) Pair() => (2, 3); var (x, y) = Pair(); int Sq(int k) => k * k; return Sq(x) + y; } }`, i:{}, e:7 },
 { l:'csharp', n:'record with + nullable + ??=', c:`public record P(string Name, int Age);
public class B { public string Run(Data d){ var p = new P("A", 1); var q = p with { Age = 5 }; string s = null; s ??= "x"; int? n = null; return q.Name + q.Age + s + (n ?? 7); } }`, i:{}, e:'A5x7' },
 { l:'csharp', n:'static class + extension method', c:`public static class Ext { public static int Twice(this int x) => x * 2; }
public class B { public int Run(Data d) => 21.Twice(); }`, i:{}, e:42 },
 { l:'csharp', n:'string.Join, Format, interpolation, StringBuilder', c:`using System.Text;
public class B { public string Run(Data d){ var sb = new StringBuilder(); foreach (var x in new[]{1,2,3}) sb.Append(x).Append(','); return string.Join("-", new List<string>{"a","b"}) + string.Format("{0:F1}", 2.25) + sb.ToString().TrimEnd(',') + $"{3*2,3}"; } }`, i:{}, e:'a-b2,31,2,3  6' },
 { l:'csharp', n:'Dictionary iteration + GroupBy + ToDictionary', c:`public class B { public object Run(List<Dictionary<string,object>> rows){ return rows.GroupBy(r => (string)r["k"]).ToDictionary(g => g.Key, g => g.Sum(r => Convert.ToDouble(r["v"]))); } }`, i:[{k:'a',v:1},{k:'b',v:2},{k:'a',v:3}], e:{a:4,b:2} },
 { l:'csharp', n:'try/catch/throw custom exception', c:`public class MyEx : Exception { public MyEx(string m) : base(m) {} }
public class B { public string Run(Data d){ try { throw new MyEx("bad"); } catch (MyEx e) { return "caught:" + e.Message; } } }`, i:{}, e:'caught:bad' },
 { l:'csharp', n:'foreach over Dictionary KeyValuePair', c:`public class B { public int Run(Data d){ var m = new Dictionary<string,int>{ {"a",1}, {"b",2} }; int s = 0; foreach (KeyValuePair<string,int> kv in m) s += kv.Value; foreach (var (k, v) in m) s += v; return s; } }`, i:{}, e:6 },
 { l:'csharp', n:'DateTime + TimeSpan', c:`public class B { public int Run(Data d){ var a = new DateTime(2026, 1, 1); var b = a.AddDays(10); return (int)(b - a).TotalDays + b.Day; } }`, i:{}, e:21 },
 { l:'csharp', n:'Console.WriteLine + Math', c:`public class B { public double Run(Data d){ Console.WriteLine("x={0}", 5); return Math.Round(Math.Sqrt(2), 3); } }`, i:{}, e:1.414, so:1 },
 { l:'csharp', n:'static Main program', c:`using System;
class Program { static void Main(string[] args){ int s = 0; for (int i = 1; i <= 10; i++) s += i; Console.WriteLine($"Сумма: {s}"); } }`, so:1 },
 { l:'csharp', n:'properties with backing + ctor chain', c:`public class Acc { private decimal _b; public decimal Balance { get { return _b; } private set { _b = value; } } public Acc() : this(10m) {} public Acc(decimal b){ Balance = b; } public void Dep(decimal x){ if (x <= 0) throw new ArgumentException("x"); Balance += x; } }
public class B { public decimal Run(Data d){ var a = new Acc(); a.Dep(5); return a.Balance; } }`, i:{}, e:15 },
 { l:'1c', n:'Вычислить + Выполнить', c:`Функция Выполнить(Вх) Экспорт
 А = 2; Б = Вычислить("А * 10 + 1");
 Выполнить("В = Б + 1;");
 Возврат В;
КонецФункции`, i:{}, e:22 },
 { l:'1c', n:'JSON чтение/запись', c:`Функция Выполнить(Вх) Экспорт
 Чтение = Новый ЧтениеJSON; Чтение.УстановитьСтроку("{""a"": 1, ""b"": [1, 2, 3]}");
 Данные = ПрочитатьJSON(Чтение); Чтение.Закрыть();
 Запись = Новый ЗаписьJSON; Запись.УстановитьСтроку();
 ЗаписатьJSON(Запись, Новый Структура("сумма", Данные.a + Данные.b.Количество()));
 Возврат Запись.Закрыть();
КонецФункции`, i:{}, e:'{"сумма":4}' },
 { l:'1c', n:'Процедура с параметрами по ссылке', c:`Процедура Удвоить(Х)
 Х = Х * 2;
КонецПроцедуры
Функция Выполнить(Вх) Экспорт
 Ч = 5; Удвоить(Ч); Возврат Ч;
КонецФункции`, i:{}, e:10 },
 { l:'1c', n:'ТаблицаЗначений.Колонки.Добавить с типом + НайтиСтроки + ВыгрузитьКолонку', c:`Функция Выполнить(Вх) Экспорт
 Т = Новый ТаблицаЗначений; Т.Колонки.Добавить("Имя", Новый ОписаниеТипов("Строка")); Т.Колонки.Добавить("Сумма", Новый ОписаниеТипов("Число"));
 Для Каждого С Из Вх Цикл З = Т.Добавить(); ЗаполнитьЗначенияСвойств(З, С); КонецЦикла;
 Отбор = Новый Структура("Имя", "a"); Найдено = Т.НайтиСтроки(Отбор);
 Итог = 0; Для Каждого Н Из Найдено Цикл Итог = Итог + Н.Сумма; КонецЦикла;
 Возврат Строка(Итог) + "/" + Т.ВыгрузитьКолонку("Имя").Количество();
КонецФункции`, i:[{Имя:'a',Сумма:1},{Имя:'b',Сумма:2},{Имя:'a',Сумма:3}], e:'4/3' },
 { l:'1c', n:'Запрос с соединением и временной таблицей', c:`Функция Выполнить(Вх) Экспорт
 З = Новый Запрос;
 З.УстановитьПараметр("Т1", Вх.Заказы); З.УстановитьПараметр("Т2", Вх.Клиенты);
 З.Текст = "ВЫБРАТЬ Т.Клиент КАК Клиент, Т.Сумма КАК Сумма ПОМЕСТИТЬ ВТ ИЗ &Т1 КАК Т;
 |ВЫБРАТЬ К.Имя КАК Имя, СУММА(ВТ.Сумма) КАК Сумма ИЗ ВТ КАК ВТ ЛЕВОЕ СОЕДИНЕНИЕ &Т2 КАК К ПО ВТ.Клиент = К.Код СГРУППИРОВАТЬ ПО К.Имя УПОРЯДОЧИТЬ ПО Сумма УБЫВ";
 Возврат З.Выполнить().Выгрузить();
КонецФункции`, i:{Заказы:[{Клиент:1,Сумма:5},{Клиент:2,Сумма:7},{Клиент:1,Сумма:4}], Клиенты:[{Код:1,Имя:'Альфа'},{Код:2,Имя:'Бета'}]}, e:[{Имя:'Альфа',Сумма:9},{Имя:'Бета',Сумма:7}] },
 { l:'1c', n:'Строки: СтрРазделить/СтрСоединить/СтрНайти/Формат даты', c:`Функция Выполнить(Вх) Экспорт
 Ч = СтрРазделить("a;b;c", ";"); 
 Д = Дата(2026, 3, 5);
 Возврат СтрСоединить(Ч, "+") + " " + Формат(Д, "ДФ=dd.MM.yyyy") + " " + СтрНайти("abc", "c") + " " + Формат(1234.5, "ЧДЦ=2; ЧРГ=' '");
КонецФункции`, i:{}, e:'a+b+c 05.03.2026 3 1 234,50' },
 { l:'1c', n:'Соответствие по ключам и Массив.Найти, цикл Для с Прервать', c:`Функция Выполнить(Вх) Экспорт
 С = Новый Соответствие; С.Вставить("x", 1); С["y"] = 2;
 М = Новый Массив; Для И1 = 1 По 10 Цикл Если И1 > 4 Тогда Прервать; КонецЕсли; М.Добавить(И1); КонецЦикла;
 Возврат С["x"] + С.Получить("y") + М.Количество() + ?(М.Найти(3) = Неопределено, 100, 0);
КонецФункции`, i:{}, e:7 },
 { l:'1c', n:'Модульные переменные, рекурсия, Попытка с ВызватьИсключение', c:`Перем Счётчик;
Функция Ф(Н) Возврат ?(Н <= 1, 1, Н * Ф(Н - 1)); КонецФункции
Функция Выполнить(Вх) Экспорт
 Счётчик = 0;
 Попытка ВызватьИсключение "Ошибка теста"; Исключение Счётчик = СтрДлина(ОписаниеОшибки()); КонецПопытки;
 Возврат Ф(5) + Счётчик;
КонецФункции`, i:{}, e:132 },
 { l:'1c', n:'ТипЗнч + Тип сравнение', c:`Функция Выполнить(Вх) Экспорт
 Возврат ТипЗнч(5) = Тип("Число") И ТипЗнч("a") = Тип("Строка") И ТипЗнч(Новый Массив) = Тип("Массив");
КонецФункции`, i:{}, e:true },
];
