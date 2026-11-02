  var LANGS = [
    { id:'html', name:'HTML', tool:'Браузер, живой предпросмотр', ext:'html', real:true,
      tpl:'<!-- Плагин Triosteum: новый виджет -->\n<div style="font-family:sans-serif;padding:24px">\n  <h3 style="margin:0;color:#7F1D1D">Маржа</h3>\n  <p style="font-size:40px;margin:8px 0">21,4%</p>\n</div>\n' },
    { id:'python', name:'Python', tool:'Python в браузере (Pyodide)', ext:'py', real:true,
      tpl:'# Плагин Triosteum: новый блок\nfrom triosteum import block\n\n\n@block(name="Мой блок")\ndef run(data):\n    # data — входные данные из схемы\n    total = sum(data["values"])\n    print("Сумма:", total)\n    return {"total": total}\n' },
    { id:'cpp', name:'C++', tool:'Компилятор GCC / Clang (будет на сервере)', ext:'cpp', real:false,
      tpl:'// Плагин Triosteum: новый блок\n#include "triosteum/block.h"\n\nTRIOSTEUM_BLOCK("Мой блок")\nData run(const Data& input) {\n    // input — входные данные из схемы\n    return input;\n}\n' },
    { id:'csharp', name:'C# (C Sharp)', tool:'Компилятор .NET Roslyn (будет на сервере)', ext:'cs', real:false,
      tpl:'// Плагин Triosteum: новый блок\nusing Triosteum;\n\n[Block("Мой блок")]\npublic class MyBlock : IBlock\n{\n    public Data Run(Data input)\n    {\n        // input — входные данные из схемы\n        return input;\n    }\n}\n' },
    { id:'1c', name:'1С', tool:'Платформа 1С:Предприятие 8.3 (будет на сервере)', ext:'bsl', real:false,
      tpl:'// Плагин Triosteum: новый блок\nФункция Выполнить(ВходныеДанные) Экспорт\n    // ВходныеДанные — данные из схемы\n    Возврат ВходныеДанные;\nКонецФункции\n' }
  ];

  var PLUGINS = [
    /* ---------- Python ---------- */
    { id:'py-margin', lang:'python', family:'margin', file:'margin_by_order', name:'Маржа по заказам',
      desc:'Считает валовую маржу каждого заказа из выручки и себестоимости.',
      code:`# Плагин Triosteum: маржа по заказам
from triosteum import block

ORDERS = [
    {"id": "З-1047", "revenue": 12_800_000, "cost": 11_570_000},
    {"id": "З-1050", "revenue": 3_900_000, "cost": 2_913_000},
    {"id": "З-1052", "revenue": 7_400_000, "cost": 6_505_000},
]


@block(name="Маржа по заказам", sample=ORDERS)
def run(orders):
    result = []
    for o in orders:
        margin = (o["revenue"] - o["cost"]) / o["revenue"]
        print(f'{o["id"]}: маржа {margin:.1%}')
        result.append({"id": o["id"], "margin_pct": round(margin * 100, 1)})
    return result
` },
    { id:'py-deviation', lang:'python', family:'deviation', file:'plan_vs_fact', name:'Отклонение план / факт',
      desc:'Сравнивает план и факт по статьям затрат и отмечает превышения порога.',
      code:`# Плагин Triosteum: отклонение план / факт
from triosteum import block

ITEMS = [
    {"статья": "Металл", "план": 6.20, "факт": 7.07},
    {"статья": "Работа", "план": 2.38, "факт": 2.53},
    {"статья": "Энергия", "план": 0.38, "факт": 0.40},
    {"статья": "Накладные", "план": 1.12, "факт": 1.12},
]


@block(name="Отклонение план / факт", sample={"items": ITEMS, "порог": 5})
def run(data):
    flagged = []
    for it in data["items"]:
        dev = (it["факт"] - it["план"]) / it["план"] * 100
        mark = "ПРЕВЫШЕНИЕ" if dev > data["порог"] else "норма"
        print(f'{it["статья"]:<10} {dev:+6.1f}%  {mark}')
        if dev > data["порог"]:
            flagged.append(it["статья"])
    return {"превышения": flagged}
` },
    { id:'py-abc', lang:'python', file:'abc_analysis', name:'ABC-анализ клиентов',
      desc:'Делит клиентов на группы A, B, C по доле в выручке (правило 80/15/5).',
      code:`# Плагин Triosteum: ABC-анализ клиентов
from triosteum import block

REVENUE = {
    "ТехСтрой": 41.3, "Нива": 18.2, "ПромЛогистика": 9.6,
    "Вектор-Т": 6.1, "Ладога-Пак": 4.2, "СеверСтрой": 2.4,
}


@block(name="ABC-анализ клиентов", sample=REVENUE)
def run(revenue):
    total = sum(revenue.values())
    acc = 0
    groups = {}
    for name, value in sorted(revenue.items(), key=lambda x: -x[1]):
        acc += value
        share = acc / total
        group = "A" if share <= 0.80 else ("B" if share <= 0.95 else "C")
        groups[name] = group
        print(f"{name:<14} {value:>6.1f} млн  накопл. {share:>5.0%}  {group}")
    return groups
` },
    { id:'py-forecast', lang:'python', family:'forecast', file:'moving_average', name:'Прогноз: скользящее среднее',
      desc:'Прогнозирует следующее значение показателя по последним периодам.',
      code:`# Плагин Triosteum: прогноз скользящим средним
from triosteum import block

MARGIN = [24.1, 23.8, 23.5, 22.9, 23.5, 21.4]


@block(name="Прогноз: скользящее среднее", sample={"ряд": MARGIN, "окно": 3})
def run(data):
    series, n = data["ряд"], data["окно"]
    window = series[-n:]
    forecast = sum(window) / n
    print(f"Последние {n} значения: {window}")
    print(f"Прогноз на следующий период: {forecast:.2f}")
    return round(forecast, 2)
` },

    /* ---------- HTML ---------- */
    { id:'html-kpi', lang:'html', file:'kpi_cards', name:'Карточки показателей',
      desc:'Три карточки KPI для дашборда: выручка, маржа, заказы.',
      code:`<!-- Плагин Triosteum: карточки показателей -->
<div style="display:flex;gap:12px;flex-wrap:wrap;padding:16px;font-family:sans-serif">
  <div style="flex:1;min-width:140px;padding:16px;border-radius:12px;border:1px solid #E5E7EB">
    <div style="font-size:13px;color:#555">Выручка</div>
    <div style="font-size:26px;font-weight:700;margin-top:6px">184,6 млн ₽</div>
    <div style="font-size:13px;color:#047857;margin-top:4px">+6% к прошлому месяцу</div>
  </div>
  <div style="flex:1;min-width:140px;padding:16px;border-radius:12px;border:1px solid #E5E7EB">
    <div style="font-size:13px;color:#555">Маржа</div>
    <div style="font-size:26px;font-weight:700;margin-top:6px">21,4%</div>
    <div style="font-size:13px;color:#B45309;margin-top:4px">−2,1 п.п.</div>
  </div>
  <div style="flex:1;min-width:140px;padding:16px;border-radius:12px;border:1px solid #E5E7EB">
    <div style="font-size:13px;color:#555">Заказов в работе</div>
    <div style="font-size:26px;font-weight:700;margin-top:6px">37</div>
  </div>
</div>
` },
    { id:'html-table', lang:'html', file:'orders_table', name:'Таблица заказов с подсветкой',
      desc:'Таблица заказов: маржа ниже нормы подсвечивается автоматически.',
      code:`<!-- Плагин Triosteum: таблица заказов с подсветкой -->
<div style="padding:16px;font-family:sans-serif">
  <table id="t" style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="text-align:left;color:#555">
      <th style="padding:8px">Заказ</th><th style="padding:8px">Клиент</th><th style="padding:8px;text-align:right">Маржа</th>
    </tr></thead>
    <tbody></tbody>
  </table>
</div>
<script>
  var NORM = 15;
  var orders = [
    ["З-1047", "ТехСтрой", 9.6],
    ["З-1050", "Вектор-Т", 25.3],
    ["З-1052", "Нива", 12.1],
    ["З-1055", "Ладога-Пак", 27.8]
  ];
  var body = document.querySelector("#t tbody");
  orders.forEach(function (o) {
    var tr = document.createElement("tr");
    tr.style.borderTop = "1px solid #eee";
    if (o[2] < NORM) tr.style.background = "#FFF1F2";
    tr.innerHTML = "<td style='padding:8px'>" + o[0] + "</td><td style='padding:8px'>" + o[1] +
      "</td><td style='padding:8px;text-align:right;font-weight:600;color:" +
      (o[2] < NORM ? "#B91C1C" : "#047857") + "'>" + o[2].toFixed(1) + "%</td>";
    body.appendChild(tr);
  });
<\/script>
` },
    { id:'html-chart', lang:'html', file:'bar_chart', name:'Столбчатая диаграмма',
      desc:'Диаграмма по месяцам на чистом SVG, данные задаются массивом.',
      code:`<!-- Плагин Triosteum: столбчатая диаграмма -->
<div style="padding:16px;font-family:sans-serif">
  <div style="font-weight:600;margin-bottom:8px">Маржа по месяцам, %</div>
  <svg id="c" width="100%" viewBox="0 0 360 200"></svg>
</div>
<script>
  var data = [["май", 24.1], ["июн", 23.8], ["июл", 23.5], ["авг", 22.9], ["сен", 23.5], ["окт", 21.4]];
  var svg = document.getElementById("c"), max = 30, w = 40, gap = 20;
  data.forEach(function (d, i) {
    var h = d[1] / max * 150, x = 10 + i * (w + gap), y = 170 - h;
    var last = i === data.length - 1;
    svg.innerHTML +=
      "<rect x='" + x + "' y='" + y + "' width='" + w + "' height='" + h + "' rx='4' fill='" + (last ? "#B91C1C" : "#D6B4BA") + "'/>" +
      "<text x='" + (x + w / 2) + "' y='" + (y - 6) + "' font-size='11' text-anchor='middle'>" + d[1] + "</text>" +
      "<text x='" + (x + w / 2) + "' y='188' font-size='11' text-anchor='middle' fill='#555'>" + d[0] + "</text>";
  });
<\/script>
` },

    /* ---------- C++ ---------- */
    { id:'cpp-oee', lang:'cpp', file:'oee', name:'OEE оборудования',
      desc:'Общая эффективность оборудования: доступность × производительность × качество.',
      code:`// Плагин Triosteum: OEE оборудования
#include "triosteum/block.h"

struct Shift {
    double planned_min;   // плановое время смены, мин
    double run_min;       // фактическая работа, мин
    double ideal_rate;    // норма, шт/мин
    double produced;      // выпущено, шт
    double good;          // годных, шт
};

TRIOSTEUM_BLOCK("OEE оборудования")
double run(const Shift& s) {
    const double availability = s.run_min / s.planned_min;
    const double performance  = s.produced / (s.run_min * s.ideal_rate);
    const double quality      = s.good / s.produced;
    return availability * performance * quality;  // от 0 до 1
}
` },
    { id:'cpp-cost', lang:'cpp', file:'batch_cost', name:'Себестоимость партии',
      desc:'Быстрый расчёт себестоимости по спецификации на тысячи позиций.',
      code:`// Плагин Triosteum: себестоимость партии
#include "triosteum/block.h"
#include <vector>

struct Line {
    double qty;    // количество на партию
    double price;  // цена за единицу, руб
};

TRIOSTEUM_BLOCK("Себестоимость партии")
double run(const std::vector<Line>& spec) {
    double total = 0.0;
    for (const auto& line : spec) {
        total += line.qty * line.price;
    }
    return total;
}
` },
    { id:'cpp-filter', lang:'cpp', file:'sensor_filter', name:'Сглаживание сигналов датчиков',
      desc:'Скользящее среднее для потока данных со станков и датчиков.',
      code:`// Плагин Triosteum: сглаживание сигналов датчиков
#include "triosteum/block.h"
#include <vector>
#include <cstddef>

TRIOSTEUM_BLOCK("Сглаживание сигналов датчиков")
std::vector<double> run(const std::vector<double>& signal, std::size_t window = 5) {
    std::vector<double> out;
    out.reserve(signal.size());
    double sum = 0.0;
    for (std::size_t i = 0; i < signal.size(); ++i) {
        sum += signal[i];
        if (i >= window) sum -= signal[i - window];
        const std::size_t n = i + 1 < window ? i + 1 : window;
        out.push_back(sum / n);
    }
    return out;
}
` },

    /* ---------- C# ---------- */
    { id:'cs-telegram', lang:'csharp', file:'TelegramNotify', name:'Уведомление в Telegram',
      desc:'Отправляет сообщение в Telegram, когда схема срабатывает.',
      code:`// Плагин Triosteum: уведомление в Telegram
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Triosteum;

[Block("Уведомление в Telegram")]
public class TelegramNotify : IBlock
{
    private static readonly HttpClient Http = new HttpClient();

    public async Task<Data> Run(Data input)
    {
        var token = Secrets.Get("TELEGRAM_TOKEN");
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["chat_id"] = input.Get<string>("chat_id"),
            ["text"] = input.Get<string>("text"),
        });
        await Http.PostAsync($"https://api.telegram.org/bot{token}/sendMessage", form);
        return input;
    }
}
` },
    { id:'cs-excel', lang:'csharp', file:'ExcelImport', name:'Импорт из Excel',
      desc:'Читает лист Excel и превращает строки в данные для схемы (ClosedXML).',
      code:`// Плагин Triosteum: импорт из Excel
using System.Collections.Generic;
using System.Linq;
using ClosedXML.Excel;
using Triosteum;

[Block("Импорт из Excel")]
public class ExcelImport : IBlock
{
    public Data Run(Data input)
    {
        using var book = new XLWorkbook(input.Get<string>("path"));
        var sheet = book.Worksheet(1);
        var headers = sheet.Row(1).CellsUsed().Select(c => c.GetString()).ToList();

        var rows = new List<Dictionary<string, string>>();
        foreach (var row in sheet.RowsUsed().Skip(1))
        {
            var item = new Dictionary<string, string>();
            for (int i = 0; i < headers.Count; i++)
                item[headers[i]] = row.Cell(i + 1).GetString();
            rows.Add(item);
        }
        return Data.From(rows);
    }
}
` },
    { id:'cs-email', lang:'csharp', file:'EmailReport', name:'Отчёт на почту',
      desc:'Отправляет отчёт руководителю по расписанию через SMTP.',
      code:`// Плагин Triosteum: отчёт на почту
using System.Net;
using System.Net.Mail;
using Triosteum;

[Block("Отчёт на почту")]
public class EmailReport : IBlock
{
    public Data Run(Data input)
    {
        using var smtp = new SmtpClient(Secrets.Get("SMTP_HOST"), 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(Secrets.Get("SMTP_USER"), Secrets.Get("SMTP_PASSWORD")),
        };
        var mail = new MailMessage(Secrets.Get("SMTP_USER"), input.Get<string>("to"))
        {
            Subject = input.Get<string>("subject"),
            Body = input.Get<string>("html"),
            IsBodyHtml = true,
        };
        smtp.Send(mail);
        return input;
    }
}
` },

    /* ---------- 1С ---------- */
    { id:'1c-orders', lang:'1c', file:'ЗаказыВРаботе', name:'Заказы клиентов в работе',
      desc:'Выгружает из 1С открытые заказы клиентов с суммами.',
      code:`// Плагин Triosteum: заказы клиентов в работе
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Заказ.Номер КАК Номер,
    |    Заказ.Дата КАК Дата,
    |    Заказ.Контрагент КАК Клиент,
    |    Заказ.СуммаДокумента КАК Сумма
    |ИЗ
    |    Документ.ЗаказКлиента КАК Заказ
    |ГДЕ
    |    Заказ.Проведен
    |    И Заказ.Статус = &Статус";
    Запрос.УстановитьПараметр("Статус", Перечисления.СтатусыЗаказовКлиентов.КВыполнению);
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` },
    { id:'1c-stock', lang:'1c', file:'ОстаткиНаСкладах', name:'Остатки на складах',
      desc:'Остатки материалов и продукции по складам на дату.',
      code:`// Плагин Triosteum: остатки на складах
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Остатки.Номенклатура КАК Номенклатура,
    |    Остатки.Склад КАК Склад,
    |    Остатки.ВНаличииОстаток КАК Количество
    |ИЗ
    |    РегистрНакопления.ТоварыНаСкладах.Остатки(&НаДату) КАК Остатки
    |ГДЕ
    |    Остатки.ВНаличииОстаток > 0";
    Запрос.УстановитьПараметр("НаДату", ВходныеДанные.Дата);
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` },
    { id:'1c-writeoff', lang:'1c', file:'СписаниеПоЗаказу', name:'Списание материалов по заказу',
      desc:'Сколько материалов списано на заказ: основа для контроля перерасхода.',
      code:`// Плагин Triosteum: списание материалов по заказу
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Строки.Номенклатура КАК Материал,
    |    СУММА(Строки.Количество) КАК Списано
    |ИЗ
    |    Документ.ТребованиеНакладная.Товары КАК Строки
    |ГДЕ
    |    Строки.Ссылка.Проведен
    |    И Строки.Ссылка.Заказ = &Заказ
    |СГРУППИРОВАТЬ ПО
    |    Строки.Номенклатура";
    Запрос.УстановитьПараметр("Заказ", ВходныеДанные.Заказ);
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` }
  ];

  /* Аналоги плагинов на других языках: одна задача — разные языки.
     Python-версии берутся из библиотеки (поле family у плагина). */
  var VARIANTS = {
    margin: {
      cpp:`// Плагин Triosteum: маржа по заказам (C++)
#include "triosteum/block.h"
#include <string>
#include <vector>

struct Order  { std::string id; double revenue; double cost; };
struct Margin { std::string id; double margin_pct; };

TRIOSTEUM_BLOCK("Маржа по заказам")
std::vector<Margin> run(const std::vector<Order>& orders) {
    std::vector<Margin> result;
    result.reserve(orders.size());
    for (const auto& o : orders) {
        const double m = (o.revenue - o.cost) / o.revenue * 100.0;
        result.push_back({o.id, m});
    }
    return result;
}
`,
      csharp:`// Плагин Triosteum: маржа по заказам (C#)
using System.Collections.Generic;
using System.Linq;
using Triosteum;

public record Order(string Id, decimal Revenue, decimal Cost);
public record Margin(string Id, decimal MarginPct);

[Block("Маржа по заказам")]
public class OrderMargin : IBlock
{
    public List<Margin> Run(List<Order> orders) =>
        orders
            .Where(o => o.Revenue != 0)
            .Select(o => new Margin(o.Id, (o.Revenue - o.Cost) / o.Revenue * 100m))
            .ToList();
}
`,
      '1c':`// Плагин Triosteum: маржа по заказам (1С)
// ВходныеДанные — таблица значений: Заказ, Выручка, Себестоимость
Функция Выполнить(ВходныеДанные) Экспорт
    Результат = Новый ТаблицаЗначений;
    Результат.Колонки.Добавить("Заказ");
    Результат.Колонки.Добавить("МаржаПроцент");
    Для Каждого Строка Из ВходныеДанные Цикл
        Если Строка.Выручка = 0 Тогда
            Продолжить;
        КонецЕсли;
        НоваяСтрока = Результат.Добавить();
        НоваяСтрока.Заказ = Строка.Заказ;
        НоваяСтрока.МаржаПроцент = Окр((Строка.Выручка - Строка.Себестоимость) / Строка.Выручка * 100, 1);
    КонецЦикла;
    Возврат Результат;
КонецФункции
`,
      html:`<!-- Плагин Triosteum: маржа по заказам (HTML + JavaScript) -->
<div style="padding:16px;font-family:sans-serif">
  <h3 style="margin:0 0 8px">Маржа по заказам</h3>
  <ul id="list" style="margin:0;padding-left:18px;line-height:1.8"></ul>
</div>
<script>
  var NORM = 15;
  var orders = [
    { id: "З-1047", revenue: 12800000, cost: 11570000 },
    { id: "З-1050", revenue: 3900000, cost: 2913000 },
    { id: "З-1052", revenue: 7400000, cost: 6505000 }
  ];
  var list = document.getElementById("list");
  orders.forEach(function (o) {
    var m = (o.revenue - o.cost) / o.revenue * 100;
    var li = document.createElement("li");
    li.textContent = o.id + ": маржа " + m.toFixed(1) + "%";
    li.style.color = m < NORM ? "#B91C1C" : "#047857";
    list.appendChild(li);
  });
<\/script>
`
    },
    deviation: {
      cpp:`// Плагин Triosteum: отклонение план / факт (C++)
#include "triosteum/block.h"
#include <string>
#include <vector>

struct Item { std::string name; double plan; double fact; };

TRIOSTEUM_BLOCK("Отклонение план / факт")
std::vector<std::string> run(const std::vector<Item>& items, double threshold_pct = 5.0) {
    std::vector<std::string> flagged;
    for (const auto& it : items) {
        const double dev = (it.fact - it.plan) / it.plan * 100.0;
        if (dev > threshold_pct) flagged.push_back(it.name);
    }
    return flagged;
}
`,
      csharp:`// Плагин Triosteum: отклонение план / факт (C#)
using System.Collections.Generic;
using System.Linq;
using Triosteum;

public record Item(string Name, decimal Plan, decimal Fact);

[Block("Отклонение план / факт")]
public class PlanVsFact : IBlock
{
    public List<string> Run(List<Item> items, decimal thresholdPct = 5m) =>
        items
            .Where(i => i.Plan != 0 && (i.Fact - i.Plan) / i.Plan * 100m > thresholdPct)
            .Select(i => i.Name)
            .ToList();
}
`,
      '1c':`// Плагин Triosteum: отклонение план / факт (1С)
// ВходныеДанные.Статьи — таблица значений: Статья, План, Факт
Функция Выполнить(ВходныеДанные) Экспорт
    Порог = ?(ВходныеДанные.Свойство("Порог"), ВходныеДанные.Порог, 5);
    Превышения = Новый Массив;
    Для Каждого Строка Из ВходныеДанные.Статьи Цикл
        Если Строка.План = 0 Тогда
            Продолжить;
        КонецЕсли;
        Отклонение = (Строка.Факт - Строка.План) / Строка.План * 100;
        Если Отклонение > Порог Тогда
            Превышения.Добавить(Строка.Статья);
        КонецЕсли;
    КонецЦикла;
    Возврат Превышения;
КонецФункции
`,
      html:`<!-- Плагин Triosteum: отклонение план / факт (HTML + JavaScript) -->
<div style="padding:16px;font-family:sans-serif">
  <h3 style="margin:0 0 8px">Отклонение план / факт</h3>
  <table id="t" style="border-collapse:collapse;font-size:14px;width:100%"></table>
</div>
<script>
  var LIMIT = 5;
  var items = [["Металл", 6.20, 7.07], ["Работа", 2.38, 2.53], ["Энергия", 0.38, 0.40], ["Накладные", 1.12, 1.12]];
  var t = document.getElementById("t");
  items.forEach(function (i) {
    var dev = (i[2] - i[1]) / i[1] * 100;
    var tr = t.insertRow();
    tr.insertCell().textContent = i[0];
    var c = tr.insertCell();
    c.textContent = (dev > 0 ? "+" : "") + dev.toFixed(1) + "%";
    c.style.cssText = "text-align:right;padding:4px 8px;font-weight:600;color:" + (dev > LIMIT ? "#B91C1C" : "#047857");
  });
<\/script>
`
    },
    forecast: {
      cpp:`// Плагин Triosteum: прогноз скользящим средним (C++)
#include "triosteum/block.h"
#include <vector>
#include <numeric>
#include <cstddef>

TRIOSTEUM_BLOCK("Прогноз: скользящее среднее")
double run(const std::vector<double>& series, std::size_t window = 3) {
    if (series.empty()) return 0.0;
    const std::size_t n = window < series.size() ? window : series.size();
    const double sum = std::accumulate(series.end() - n, series.end(), 0.0);
    return sum / n;
}
`,
      csharp:`// Плагин Triosteum: прогноз скользящим средним (C#)
using System.Collections.Generic;
using System.Linq;
using Triosteum;

[Block("Прогноз: скользящее среднее")]
public class MovingAverage : IBlock
{
    public double Run(List<double> series, int window = 3) =>
        series.Count == 0 ? 0 : series.TakeLast(window).Average();
}
`,
      '1c':`// Плагин Triosteum: прогноз скользящим средним (1С)
// ВходныеДанные.Ряд — массив чисел, ВходныеДанные.Окно — число периодов
Функция Выполнить(ВходныеДанные) Экспорт
    Ряд = ВходныеДанные.Ряд;
    Окно = Мин(ВходныеДанные.Окно, Ряд.Количество());
    Если Окно = 0 Тогда
        Возврат 0;
    КонецЕсли;
    Сумма = 0;
    Для Индекс = Ряд.Количество() - Окно По Ряд.ВГраница() Цикл
        Сумма = Сумма + Ряд[Индекс];
    КонецЦикла;
    Возврат Окр(Сумма / Окно, 2);
КонецФункции
`,
      html:`<!-- Плагин Triosteum: прогноз скользящим средним (HTML + JavaScript) -->
<div style="padding:16px;font-family:sans-serif">
  <h3 style="margin:0 0 8px">Прогноз маржи</h3>
  <p id="out" style="font-size:32px;margin:0"></p>
  <p id="note" style="color:#555;margin:6px 0 0"></p>
</div>
<script>
  var series = [24.1, 23.8, 23.5, 22.9, 23.5, 21.4], n = 3;
  var last = series.slice(-n);
  var f = last.reduce(function (a, b) { return a + b; }, 0) / n;
  document.getElementById("out").textContent = f.toFixed(2) + "%";
  document.getElementById("note").textContent = "среднее за последние " + n + " периода: " + last.join(", ");
<\/script>
`
    }
  };
  PLUGINS.forEach(function(p){ if(p.family && VARIANTS[p.family]) VARIANTS[p.family][p.lang] = p.code; });
