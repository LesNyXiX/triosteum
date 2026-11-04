module.exports = [
 { l:'csharp', n:'abstract+virtual override+base call', c:`public abstract class Animal { public string Name { get; set; } protected Animal(string n){ Name = n; } public abstract string Sound(); public virtual string Describe() => Name + " says " + Sound(); }
public class Dog : Animal { public Dog(string n) : base(n) {} public override string Sound() => "Woof"; public override string Describe() => base.Describe() + "!"; }
public class B { public string Run(Data d){ Animal a = new Dog("Rex"); return a.Describe(); } }`, i:{}, e:'Rex says Woof!' },
 { l:'csharp', n:'static counter + generic method CompareTo', c:`public class B { static int calls = 0; static T Max<T>(T a, T b) where T : IComparable<T> { calls++; return a.CompareTo(b) >= 0 ? a : b; } public string Run(Data d){ return Max(3, 7) + Max("a", "b") + calls; } }`, i:{}, e:'7b2' },
 { l:'csharp', n:'Split + int.Parse + TryGetValue out var', c:`public class B { public int Run(Data d){ var parts = "1,2,3".Split(','); int s = 0; foreach (var p in parts) s += int.Parse(p); var m = new Dictionary<string,int>{ ["a"] = 10 }; if (m.TryGetValue("a", out var v)) s += v; return s; } }`, i:{}, e:16 },
 { l:'csharp', n:'async Task<int> + await', c:`using System.Threading.Tasks;
public class B { async Task<int> Get(){ await Task.Delay(1); return 5; } public async Task<int> Run(Data d){ var x = await Get(); return x * 2; } }`, i:{}, e:10 },
 { l:'csharp', n:'enum + switch statement + char ops', c:`public enum Color { Red, Green, Blue }
public class B { public string Run(Data d){ var c = Color.Green; string r; switch (c) { case Color.Red: r = "R"; break; case Color.Green: r = "G"; break; default: r = "?"; break; } char ch = 'a'; ch++; return r + ch + c.ToString(); } }`, i:{}, e:'GbGreen' },
 { l:'csharp', n:'struct + interface default + is pattern binding', c:`public struct Pt { public int X; public int Y; public Pt(int x, int y){ X = x; Y = y; } }
public class B { public int Run(Data d){ object o = new Pt(3, 4); if (o is Pt p && p.X > 0) return p.X * p.Y; return -1; } }`, i:{}, e:12 },
 { l:'csharp', n:'LINQ chain on input rows', c:`public class B { public object Run(List<Dictionary<string, object>> rows){ return rows.Where(r => Convert.ToDouble(r["Сумма"]) > 100).OrderByDescending(r => Convert.ToDouble(r["Сумма"])).Select(r => new { Имя = r["Имя"], Сумма = r["Сумма"] }).ToList(); } }`, i:[{Имя:'a',Сумма:50},{Имя:'b',Сумма:300},{Имя:'c',Сумма:200}], e:[{Имя:'b',Сумма:300},{Имя:'c',Сумма:200}] },
 { l:'csharp', n:'string methods', c:`public class B { public string Run(Data d){ var s = "  Hello World  ".Trim(); return s.ToUpper().Substring(0, 5) + s.IndexOf("World") + s.Replace("World", "C#") + s.Contains("lo") + string.IsNullOrEmpty("") + s.Split(' ').Length + s.PadLeft(13, '*'); } }`, i:{}, e:'HELLO6Hello C#TrueTrue2**Hello World' },
 { l:'csharp', n:'while + continue + nested loops + array 2D jagged', c:`public class B { public int Run(Data d){ int[][] g = new int[3][]; for (int i = 0; i < 3; i++) { g[i] = new int[3]; for (int j = 0; j < 3; j++) g[i][j] = i * j; } int s = 0, k = 0; while (k < 3) { k++; if (k == 2) continue; s += g[k - 1].Sum(); } return s; } }`, i:{}, e:6 },
 { l:'csharp', n:'string.Format with N2 and interpolation format', c:`public class B { public string Run(Data d){ double x = 1234.5; return $"{x:N2}|{x:F0}|{0.256:P1}"; } }`, i:{}, e:'1 234,50|1235|25,6%' },
 { l:'csharp', n:'List<T> of class, Sort with Comparison, FindAll', c:`public class Item { public string Name; public int Qty; }
public class B { public int Run(Data d){ var l = new List<Item> { new Item { Name = "a", Qty = 3 }, new Item { Name = "b", Qty = 1 } }; l.Sort((x, y) => x.Qty.CompareTo(y.Qty)); return l[0].Qty * 10 + l.FindAll(i => i.Qty > 2).Count; } }`, i:{}, e:11 },
 { l:'csharp', n:'HashSet + Queue + Stack', c:`public class B { public int Run(Data d){ var h = new HashSet<int> { 1, 2, 2, 3 }; var q = new Queue<int>(); q.Enqueue(5); q.Enqueue(6); var st = new Stack<int>(); st.Push(7); st.Push(8); return h.Count * 100 + q.Dequeue() * 10 + st.Pop() - 8 + (h.Contains(2) ? 1 : 0); } }`, i:{}, e:351 },
 { l:'cpp', n:'inheritance virtual', c:`class Shape { public: virtual double area() const { return 0; } virtual ~Shape() {} };
class Rect : public Shape { double w, h; public: Rect(double w, double h) : w(w), h(h) {} double area() const override { return w * h; } };
double run(){ std::vector<Shape*> v; v.push_back(new Rect(2, 3)); v.push_back(new Rect(1, 1)); double s = 0; for (auto* p : v) s += p->area(); return s; }`, e:7 },
 { l:'cpp', n:'struct ctor + operator< sort', c:`struct E { std::string n; int a; E(std::string n, int a) : n(n), a(a) {} bool operator<(const E& o) const { return a < o.a; } };
std::string run(){ std::vector<E> v{ E("x", 3), E("y", 1), E("z", 2) }; std::sort(v.begin(), v.end()); std::string r; for (const auto& e : v) r += e.n; return r; }`, e:'yzx' },
 { l:'cpp', n:'char arithmetic + string compare', c:`std::string run(){ std::string s = "abc"; std::string out; for (char c : s) out += char(c + 1); return out + (std::string("a") < std::string("b") ? "<" : ">"); }`, e:'bcd<' },
 { l:'cpp', n:'map ordered + iterator loop', c:`#include <map>
std::string run(){ std::map<std::string,int> m{{"b",2},{"a",1}}; std::string r; for (auto it = m.begin(); it != m.end(); ++it) r += it->first + std::to_string(it->second); return r; }`, e:'a1b2' },
 { l:'cpp', n:'pass by reference', c:`void inc(int& x){ x += 5; } void addAll(std::vector<int>& v){ for (auto& x : v) x *= 2; }
int run(){ int a = 1; inc(a); std::vector<int> v{1,2}; addAll(v); return a * 100 + v[0] + v[1]; }`, e:606 },
 { l:'cpp', n:'stringstream', c:`#include <sstream>
int run(){ std::stringstream ss("10 20 30"); int x, s = 0; while (ss >> x) s += x; std::ostringstream os; os << "s=" << s; return os.str().size(); }`, e:4 },
 { l:'cpp', n:'try/catch std::exception', c:`#include <stdexcept>
std::string run(){ try { throw std::runtime_error("boom"); } catch (const std::exception& e) { return std::string("caught ") + e.what(); } }`, e:'caught boom' },
 { l:'cpp', n:'auto lambda capture + count_if', c:`#include <algorithm>
int run(){ int lim = 2; std::vector<int> v{1,2,3,4}; auto big = [lim](int x){ return x > lim; }; return std::count_if(v.begin(), v.end(), big); }`, e:2 },
 { l:'cpp', n:'main with cout', c:`#include <iostream>
using namespace std;
int main(){ for (int i = 0; i < 3; i++) cout << i << " "; cout << endl; return 0; }`, e:0, so:1 },
 { l:'cpp', n:'optional/ternary chain + static func var', c:`int counter(){ static int n = 0; return ++n; }
int run(){ counter(); counter(); return counter(); }`, e:3 },
 { l:'1c', n:'Соответствие обход КлючИЗначение', c:`Функция Выполнить(Вх) Экспорт
 С = Новый Соответствие; С.Вставить("a", 1); С.Вставить("b", 2); Итог = "";
 Для Каждого КЗ Из С Цикл Итог = Итог + КЗ.Ключ + КЗ.Значение; КонецЦикла;
 Возврат Итог;
КонецФункции`, i:{}, e:'a1b2' },
 { l:'1c', n:'Сортировать + Свернуть + Итог', c:`Функция Выполнить(Вх) Экспорт
 Т = Вх.Скопировать(); Т.Свернуть("Имя", "Сумма"); Т.Сортировать("Сумма Убыв");
 Возврат Т[0].Имя + Т.Итог("Сумма");
КонецФункции`, i:[{Имя:'a',Сумма:1},{Имя:'b',Сумма:5},{Имя:'a',Сумма:2}], e:'b8' },
 { l:'1c', n:'Необязательные параметры и Знач', c:`Функция Сум(Знач А, Б = 10) А = А + 1; Возврат А + Б; КонецФункции
Функция Выполнить(Вх) Экспорт
 Х = 1; Р = Сум(Х) + Сум(Х, 1);
 Возврат Строка(Р) + "/" + Х;
КонецФункции`, i:{}, e:'15/1' },
 { l:'1c', n:'Запрос ВЫБОР КОГДА + ГДЕ параметр', c:`Функция Выполнить(Вх) Экспорт
 З = Новый Запрос("ВЫБРАТЬ Т.Имя, ВЫБОР КОГДА Т.Сумма > &Порог ТОГДА ""Крупный"" ИНАЧЕ ""Мелкий"" КОНЕЦ КАК Вид ИЗ &Т КАК Т ГДЕ Т.Сумма > 0");
 З.УстановитьПараметр("Т", Вх); З.УстановитьПараметр("Порог", 2);
 Возврат З.Выполнить().Выгрузить();
КонецФункции`, i:[{Имя:'a',Сумма:1},{Имя:'b',Сумма:5},{Имя:'c',Сумма:0}], e:[{Имя:'a',Вид:'Мелкий'},{Имя:'b',Вид:'Крупный'}] },
 { l:'1c', n:'Пока + Продолжить + Массив Структур', c:`Функция Выполнить(Вх) Экспорт
 М = Новый Массив; Н1 = 0;
 Пока Н1 < 5 Цикл Н1 = Н1 + 1; Если Н1 % 2 = 0 Тогда Продолжить; КонецЕсли; М.Добавить(Новый Структура("Н, К", Н1, Н1 * Н1)); КонецЦикла;
 С = 0; Для Каждого Э Из М Цикл С = С + Э.К; КонецЦикла;
 Возврат С;
КонецФункции`, i:{}, e:35 },
 { l:'1c', n:'Сообщить + СтрШаблон + Формат ЧН', c:`Процедура Выполнить(Вх) Экспорт
 Сообщить(СтрШаблон("Итого %1 из %2", 3, 5));
 Сообщить(Формат(0, "ЧН=ноль"));
КонецПроцедуры`, i:{}, so:1 },
 { l:'1c', n:'Процедура с Возврат и глобальная переменная модуля', c:`Перем Лог;
Процедура Записать(Т) Если Т = "" Тогда Возврат; КонецЕсли; Лог.Добавить(Т); КонецПроцедуры
Функция Выполнить(Вх) Экспорт
 Лог = Новый Массив; Записать("a"); Записать(""); Записать("b");
 Возврат Лог.Количество();
КонецФункции`, i:{}, e:2 },
 { l:'1c', n:'английский синтаксис', c:`Function Execute(Input) Export
 Total = 0;
 For Each Row In Input Do Total = Total + Row.Amount; EndDo;
 If Total > 5 Then Return "big"; Else Return "small"; EndIf;
EndFunction`, i:[{Amount:3},{Amount:4}], e:'big' },
 { l:'1c', n:'Дата арифметика + НачалоМесяца', c:`Функция Выполнить(Вх) Экспорт
 Д = Дата(2026, 3, 15); Д2 = Д + 86400 * 2;
 Возврат Формат(Д2, "ДФ=dd.MM.yyyy") + " " + Формат(НачалоМесяца(Д), "ДФ=dd.MM") + " " + Окр((Д2 - Д) / 86400);
КонецФункции`, i:{}, e:'17.03.2026 01.03 2' },
];
