  /* ---------- ещё плагины для библиотеки, по разделам ----------
     cat — раздел библиотеки (см. LIB_CATS в library.js). Python-плагины работают в браузере
     на встроенных тестовых данных (sample) и только на стандартной библиотеке Python. */
  PLUGINS.forEach(function(p){
    p.cat = p.cat || { 'py-margin':'fin', 'py-deviation':'fin', 'py-abc':'sales', 'py-forecast':'analytics', 'html-kpi':'viz', 'html-table':'viz', 'html-chart':'viz',
      'cpp-oee':'prod', 'cpp-cost':'fin', 'cpp-filter':'prod', 'cs-telegram':'integr', 'cs-excel':'data', 'cs-email':'integr', '1c-orders':'sales', '1c-stock':'stock', '1c-writeoff':'stock' }[p.id];
  });
  PLUGINS.push(
    /* ===== Финансы ===== */
    { id:'py-npv', lang:'python', cat:'fin', file:'npv_irr', name:'NPV и IRR проекта',
      desc:'Чистая приведённая стоимость и внутренняя норма доходности по денежным потокам.',
      code:`# Плагин Triosteum: NPV и IRR проекта
from triosteum import block

SAMPLE = {"ставка": 0.16, "потоки": [-12_000_000, 3_100_000, 4_200_000, 4_600_000, 4_900_000]}


def npv(rate, flows):
    return sum(f / (1 + rate) ** t for t, f in enumerate(flows))


@block(name="NPV и IRR проекта", sample=SAMPLE)
def run(data):
    flows, rate = data["потоки"], data["ставка"]
    lo, hi = -0.99, 10.0
    for _ in range(200):                       # IRR — делением пополам
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if npv(mid, flows) > 0 else (lo, mid)
    result = {"npv": round(npv(rate, flows)), "irr_pct": round(mid * 100, 2)}
    print(f'NPV при ставке {rate:.0%}: {result["npv"]:,} ₽'.replace(",", " "))
    print(f'IRR: {result["irr_pct"]}%')
    return result
` },
    { id:'py-loan', lang:'python', cat:'fin', file:'loan_schedule', name:'График платежей по кредиту',
      desc:'Аннуитетный график: платёж, проценты, тело долга и остаток по месяцам.',
      code:`# Плагин Triosteum: график платежей по кредиту (аннуитет)
from triosteum import block


@block(name="График платежей по кредиту", sample={"сумма": 5_000_000, "ставка_год": 0.18, "месяцев": 12})
def run(d):
    r = d["ставка_год"] / 12
    n = d["месяцев"]
    pay = d["сумма"] * r / (1 - (1 + r) ** -n)
    rest, rows = d["сумма"], []
    for m in range(1, n + 1):
        interest = rest * r
        body = pay - interest
        rest -= body
        rows.append({"месяц": m, "платёж": round(pay), "проценты": round(interest), "долг": round(body), "остаток": round(max(rest, 0))})
    print(f"Ежемесячный платёж: {pay:,.0f} ₽".replace(",", " "))
    print(f"Переплата: {pay * n - d['сумма']:,.0f} ₽".replace(",", " "))
    return rows
` },
    { id:'py-breakeven', lang:'python', cat:'fin', file:'break_even', name:'Точка безубыточности',
      desc:'Сколько нужно продать, чтобы покрыть постоянные затраты, и запас прочности.',
      code:`# Плагин Triosteum: точка безубыточности
from triosteum import block


@block(name="Точка безубыточности", sample={"постоянные": 2_400_000, "цена": 1_850, "переменные_на_шт": 1_120, "план_шт": 4_200})
def run(d):
    margin = d["цена"] - d["переменные_на_шт"]
    units = d["постоянные"] / margin
    safety = (d["план_шт"] - units) / d["план_шт"]
    print(f"Маржинальный доход с единицы: {margin} ₽")
    print(f"Безубыточность: {units:,.0f} шт. на {units * d['цена']:,.0f} ₽".replace(",", " "))
    print(f"Запас прочности плана: {safety:.1%}")
    return {"шт": round(units), "выручка": round(units * d["цена"]), "запас_прочности_pct": round(safety * 100, 1)}
` },
    { id:'py-vat', lang:'python', cat:'fin', file:'vat', name:'НДС: выделить и начислить',
      desc:'Выделяет НДС из суммы или начисляет сверху; ставка 20%, 10% или своя.',
      code:`# Плагин Triosteum: НДС — выделить из суммы и начислить сверху
from triosteum import block

ROWS = [{"позиция": "Металлопрокат", "сумма": 1_240_000, "ставка": 20, "в_т_ч": True},
        {"позиция": "Доставка", "сумма": 86_000, "ставка": 20, "в_т_ч": False},
        {"позиция": "Продукты в столовую", "сумма": 54_000, "ставка": 10, "в_т_ч": True}]


@block(name="НДС: выделить и начислить", sample=ROWS)
def run(rows):
    out = []
    for r in rows:
        k = r["ставка"] / 100
        if r["в_т_ч"]:
            vat = r["сумма"] * k / (1 + k); total = r["сумма"]
        else:
            vat = r["сумма"] * k; total = r["сумма"] + vat
        out.append({"позиция": r["позиция"], "без_ндс": round(total - vat, 2), "ндс": round(vat, 2), "всего": round(total, 2)})
        print(f'{r["позиция"]:<22} НДС {r["ставка"]}%: {vat:>12,.2f}'.replace(",", " "))
    return out
` },
    { id:'py-cashflow', lang:'python', cat:'fin', file:'cash_flow', name:'Движение денег по месяцам',
      desc:'Поступления и выплаты по месяцам, остаток на конец и предупреждение о кассовом разрыве.',
      code:`# Плагин Triosteum: движение денежных средств
from triosteum import block

SAMPLE = {"остаток": 1_500_000, "месяцы": [
    {"месяц": "Янв", "приход": 8_200_000, "расход": 7_900_000},
    {"месяц": "Фев", "приход": 6_100_000, "расход": 8_300_000},
    {"месяц": "Мар", "приход": 9_400_000, "расход": 7_200_000}]}


@block(name="Движение денег по месяцам", sample=SAMPLE)
def run(d):
    bal, rows = d["остаток"], []
    for m in d["месяцы"]:
        bal += m["приход"] - m["расход"]
        gap = bal < 0
        rows.append({"месяц": m["месяц"], "сальдо": m["приход"] - m["расход"], "остаток": bal, "разрыв": gap})
        print(f'{m["месяц"]}: остаток {bal:>12,} ₽{"  ← КАССОВЫЙ РАЗРЫВ" if gap else ""}'.replace(",", " "))
    return rows
` },
    { id:'py-currency', lang:'python', cat:'fin', file:'currency', name:'Пересчёт в рубли по курсам',
      desc:'Переводит суммы в валютах в рубли по заданным курсам и подводит итог.',
      code:`# Плагин Triosteum: пересчёт валют в рубли
from triosteum import block

SAMPLE = {"курсы": {"USD": 92.4, "EUR": 100.1, "CNY": 12.7, "RUB": 1},
          "платежи": [{"кому": "Поставщик A", "сумма": 12_000, "валюта": "USD"},
                      {"кому": "Поставщик B", "сумма": 85_000, "валюта": "CNY"},
                      {"кому": "Логистика", "сумма": 310_000, "валюта": "RUB"}]}


@block(name="Пересчёт в рубли по курсам", sample=SAMPLE)
def run(d):
    total, out = 0, []
    for p in d["платежи"]:
        rub = p["сумма"] * d["курсы"][p["валюта"]]
        total += rub
        out.append({**p, "в_рублях": round(rub, 2)})
        print(f'{p["кому"]:<14} {p["сумма"]:>10,} {p["валюта"]} = {rub:>14,.2f} ₽'.replace(",", " "))
    print(f"Итого: {total:,.2f} ₽".replace(",", " "))
    return {"строки": out, "итого": round(total, 2)}
` },
    /* ===== Продажи и клиенты ===== */
    { id:'py-rfm', lang:'python', cat:'sales', file:'rfm', name:'RFM-сегментация клиентов',
      desc:'Делит клиентов по давности, частоте и сумме покупок: «лучшие», «уходящие», «новые».',
      code:`# Плагин Triosteum: RFM-сегментация
from triosteum import block

CLIENTS = [
    {"клиент": "Альфа", "дней_с_покупки": 5, "покупок": 24, "сумма": 4_800_000},
    {"клиент": "Бета", "дней_с_покупки": 120, "покупок": 18, "сумма": 3_100_000},
    {"клиент": "Гамма", "дней_с_покупки": 12, "покупок": 2, "сумма": 210_000},
    {"клиент": "Дельта", "дней_с_покупки": 260, "покупок": 3, "сумма": 150_000},
]


def score(v, edges, reverse=False):
    s = sum(v > e for e in edges) + 1
    return 4 - s if reverse else s


@block(name="RFM-сегментация клиентов", sample=CLIENTS)
def run(rows):
    out = []
    for c in rows:
        r = score(c["дней_с_покупки"], [30, 90], reverse=True) + 1
        f = score(c["покупок"], [3, 10])
        m = score(c["сумма"], [300_000, 2_000_000])
        seg = "лучшие" if r + f + m >= 8 else "уходящие" if r == 1 and f >= 2 else "новые" if f == 1 and r == 3 else "спящие" if r == 1 else "обычные"
        out.append({"клиент": c["клиент"], "R": r, "F": f, "M": m, "сегмент": seg})
        print(f'{c["клиент"]:<8} R{r} F{f} M{m} → {seg}')
    return out
` },
    { id:'py-funnel', lang:'python', cat:'sales', file:'sales_funnel', name:'Воронка продаж: конверсии',
      desc:'Конверсия каждого этапа воронки и самое узкое место.',
      code:`# Плагин Triosteum: воронка продаж
from triosteum import block

STAGES = [{"этап": "Заявки", "n": 640}, {"этап": "Квалификация", "n": 410}, {"этап": "КП отправлено", "n": 230},
          {"этап": "Переговоры", "n": 96}, {"этап": "Сделка", "n": 41}]


@block(name="Воронка продаж: конверсии", sample=STAGES)
def run(stages):
    out, worst = [], None
    for prev, cur in zip(stages, stages[1:]):
        conv = cur["n"] / prev["n"]
        out.append({"переход": f'{prev["этап"]} → {cur["этап"]}', "конверсия_pct": round(conv * 100, 1)})
        if worst is None or conv < worst[1]:
            worst = (out[-1]["переход"], conv)
        print(f'{out[-1]["переход"]:<32} {conv:6.1%}')
    print(f"Узкое место: {worst[0]} ({worst[1]:.0%})")
    print(f'Сквозная конверсия: {stages[-1]["n"] / stages[0]["n"]:.1%}')
    return out
` },
    { id:'py-churn', lang:'python', cat:'sales', file:'churn', name:'Отток: кто давно не покупал',
      desc:'Находит клиентов, чья пауза в покупках сильно длиннее их обычного цикла.',
      code:`# Плагин Triosteum: риск оттока клиентов
from triosteum import block

CLIENTS = [{"клиент": "Альфа", "средний_цикл_дн": 14, "дней_без_покупок": 16},
           {"клиент": "Бета", "средний_цикл_дн": 30, "дней_без_покупок": 95},
           {"клиент": "Гамма", "средний_цикл_дн": 7, "дней_без_покупок": 30},
           {"клиент": "Дельта", "средний_цикл_дн": 60, "дней_без_покупок": 40}]


@block(name="Отток: кто давно не покупал", sample={"клиенты": CLIENTS, "порог": 2.0})
def run(d):
    risk = []
    for c in d["клиенты"]:
        k = c["дней_без_покупок"] / c["средний_цикл_дн"]
        if k >= d["порог"]:
            risk.append({"клиент": c["клиент"], "пауза_в_циклах": round(k, 1)})
            print(f'⚠ {c["клиент"]}: молчит {c["дней_без_покупок"]} дн. — это {k:.1f} обычных цикла')
    print(f"В зоне риска: {len(risk)} из {len(d['клиенты'])}")
    return risk
` },
    { id:'py-aging', lang:'python', cat:'sales', file:'receivables_aging', name:'Дебиторка по срокам',
      desc:'Раскладывает долги клиентов по срокам просрочки: до 30, 31–60, 61–90, более 90 дней.',
      code:`# Плагин Triosteum: старение дебиторской задолженности
from triosteum import block

DEBTS = [{"клиент": "Альфа", "сумма": 1_200_000, "просрочка_дн": 0},
         {"клиент": "Бета", "сумма": 640_000, "просрочка_дн": 45},
         {"клиент": "Гамма", "сумма": 310_000, "просрочка_дн": 75},
         {"клиент": "Дельта", "сумма": 980_000, "просрочка_дн": 130}]
BUCKETS = [(0, "в срок"), (30, "до 30"), (60, "31–60"), (90, "61–90"), (10**9, "более 90")]


@block(name="Дебиторка по срокам", sample=DEBTS)
def run(rows):
    agg = {name: 0 for _, name in BUCKETS}
    for r in rows:
        name = next(n for lim, n in BUCKETS if r["просрочка_дн"] <= lim)
        agg[name] += r["сумма"]
    total = sum(agg.values())
    for k, v in agg.items():
        print(f"{k:<9} {v:>12,} ₽  {v / total:6.1%}".replace(",", " "))
    return agg
` },
    /* ===== Склад и закупки ===== */
    { id:'py-reorder', lang:'python', cat:'stock', file:'reorder_point', name:'Точка перезаказа и страховой запас',
      desc:'Когда заказывать: средний расход × срок поставки + страховой запас на колебания спроса.',
      code:`# Плагин Triosteum: точка перезаказа
from statistics import mean, pstdev
from triosteum import block

ITEMS = [{"позиция": "Лист 3 мм", "расход_в_день": [42, 38, 51, 47, 40, 55, 44], "срок_поставки_дн": 6, "остаток": 260},
         {"позиция": "Болт М12", "расход_в_день": [300, 280, 310, 295, 320, 305, 290], "срок_поставки_дн": 3, "остаток": 1400}]


@block(name="Точка перезаказа и страховой запас", sample={"позиции": ITEMS, "z": 1.65})
def run(d):
    out = []
    for it in d["позиции"]:
        avg, sd, lt = mean(it["расход_в_день"]), pstdev(it["расход_в_день"]), it["срок_поставки_дн"]
        safety = d["z"] * sd * lt ** 0.5
        rop = avg * lt + safety
        order = it["остаток"] <= rop
        out.append({"позиция": it["позиция"], "страховой": round(safety), "точка_заказа": round(rop), "заказать": order})
        print(f'{it["позиция"]:<10} точка заказа {rop:.0f}, остаток {it["остаток"]} → {"ЗАКАЗАТЬ" if order else "ждать"}')
    return out
` },
    { id:'py-xyz', lang:'python', cat:'stock', file:'xyz_analysis', name:'XYZ-анализ спроса',
      desc:'Насколько стабилен спрос: X — ровный, Y — колеблется, Z — непредсказуем.',
      code:`# Плагин Triosteum: XYZ-анализ
from statistics import mean, pstdev
from triosteum import block

SALES = {"Подшипник 6204": [120, 118, 125, 122, 119, 121],
         "Фильтр масляный": [40, 65, 30, 72, 38, 60],
         "Насос НШ-32": [0, 4, 0, 11, 1, 0]}


@block(name="XYZ-анализ спроса", sample=SALES)
def run(sales):
    out = {}
    for item, s in sales.items():
        cv = pstdev(s) / mean(s) if mean(s) else 9
        grp = "X" if cv <= 0.1 else "Y" if cv <= 0.25 else "Z"
        out[item] = {"вариация_pct": round(cv * 100, 1), "группа": grp}
        print(f"{item:<18} {cv:6.1%} → {grp}")
    return out
` },
    { id:'py-eoq', lang:'python', cat:'stock', file:'eoq', name:'Оптимальная партия заказа',
      desc:'Формула Уилсона: партия, при которой затраты на заказы и хранение минимальны.',
      code:`# Плагин Triosteum: оптимальный размер заказа (EOQ)
from triosteum import block


@block(name="Оптимальная партия заказа", sample={"спрос_в_год": 24_000, "затраты_на_заказ": 3_500, "хранение_ед_в_год": 42})
def run(d):
    q = (2 * d["спрос_в_год"] * d["затраты_на_заказ"] / d["хранение_ед_в_год"]) ** 0.5
    orders = d["спрос_в_год"] / q
    cost = orders * d["затраты_на_заказ"] + q / 2 * d["хранение_ед_в_год"]
    print(f"Партия: {q:,.0f} шт., заказов в год: {orders:.1f}".replace(",", " "))
    print(f"Годовые затраты на заказы и хранение: {cost:,.0f} ₽".replace(",", " "))
    return {"партия": round(q), "заказов_в_год": round(orders, 1), "затраты": round(cost)}
` },
    { id:'py-turnover', lang:'python', cat:'stock', file:'inventory_turnover', name:'Оборачиваемость запасов',
      desc:'Сколько дней лежит товар на складе и какие позиции «заморожены».',
      code:`# Плагин Triosteum: оборачиваемость запасов
from triosteum import block

ITEMS = [{"позиция": "Профиль 40×20", "средний_запас": 1_800_000, "себестоимость_продаж_год": 21_600_000},
         {"позиция": "Краска RAL 7035", "средний_запас": 640_000, "себестоимость_продаж_год": 2_300_000},
         {"позиция": "Электродвигатель 5,5 кВт", "средний_запас": 2_900_000, "себестоимость_продаж_год": 3_100_000}]


@block(name="Оборачиваемость запасов", sample=ITEMS)
def run(items):
    out = []
    for it in items:
        turns = it["себестоимость_продаж_год"] / it["средний_запас"]
        days = 365 / turns
        out.append({"позиция": it["позиция"], "оборотов": round(turns, 1), "дней": round(days)})
        print(f'{it["позиция"]:<26} {days:5.0f} дн.{"  ← медленно" if days > 120 else ""}')
    return out
` },
    /* ===== Производство и качество ===== */
    { id:'py-capacity', lang:'python', cat:'prod', file:'capacity_load', name:'Загрузка оборудования',
      desc:'Сравнивает нужные часы по заказам с доступным фондом времени каждого станка.',
      code:`# Плагин Triosteum: загрузка оборудования
from triosteum import block

SAMPLE = {"фонд_часов": {"Лазер": 320, "Гибочный": 300, "Сварка": 340},
          "заказы": [{"заказ": "З-1047", "часы": {"Лазер": 140, "Гибочный": 90, "Сварка": 160}},
                     {"заказ": "З-1050", "часы": {"Лазер": 120, "Гибочный": 140, "Сварка": 120}},
                     {"заказ": "З-1052", "часы": {"Лазер": 90, "Гибочный": 40, "Сварка": 50}}]}


@block(name="Загрузка оборудования", sample=SAMPLE)
def run(d):
    need = {k: 0 for k in d["фонд_часов"]}
    for z in d["заказы"]:
        for k, v in z["часы"].items():
            need[k] += v
    out = {}
    for k, fund in d["фонд_часов"].items():
        load = need[k] / fund
        out[k] = round(load * 100)
        print(f"{k:<9} {need[k]:>4} из {fund} ч  {load:6.0%}{'  ← ПЕРЕГРУЗ' if load > 1 else ''}")
    return out
` },
    { id:'py-pareto', lang:'python', cat:'prod', file:'defects_pareto', name:'Брак по причинам (Парето)',
      desc:'Какие причины дают 80% брака — с них и начинать.',
      code:`# Плагин Triosteum: анализ брака по Парето
from triosteum import block

DEFECTS = {"Непровар шва": 46, "Царапины покрытия": 31, "Отклонение размера": 18, "Трещина": 6, "Прочее": 9}


@block(name="Брак по причинам (Парето)", sample=DEFECTS)
def run(defects):
    total = sum(defects.values())
    acc, out = 0, []
    for cause, n in sorted(defects.items(), key=lambda x: -x[1]):
        acc += n
        share = acc / total
        out.append({"причина": cause, "шт": n, "накоплено_pct": round(share * 100, 1), "главные": share <= 0.8 or not out})
        print(f"{cause:<20} {n:>3}  {share:6.1%}{'  ★' if out[-1]['главные'] else ''}")
    return out
` },
    { id:'py-spc', lang:'python', cat:'prod', file:'control_chart', name:'Контрольная карта (3 сигмы)',
      desc:'Границы процесса ±3σ и точки, которые за них вышли.',
      code:`# Плагин Triosteum: контрольная карта Шухарта
from statistics import mean, pstdev
from triosteum import block

DIAMETERS = [24.98, 25.01, 25.00, 24.99, 25.02, 25.00, 25.01, 24.97, 25.00, 25.09, 25.01, 24.99]


@block(name="Контрольная карта (3 сигмы)", sample=DIAMETERS)
def run(values):
    m, s = mean(values), pstdev(values)
    ucl, lcl = m + 3 * s, m - 3 * s
    out = [{"№": i + 1, "значение": v} for i, v in enumerate(values) if v > ucl or v < lcl]
    print(f"Среднее {m:.3f}, границы [{lcl:.3f}; {ucl:.3f}]")
    for o in out:
        print(f'Точка {o["№"]}: {o["значение"]} — процесс вышел из-под контроля')
    if not out:
        print("Все точки в границах — процесс стабилен")
    return {"среднее": round(m, 4), "ВГ": round(ucl, 4), "НГ": round(lcl, 4), "выбросы": out}
` },
    /* ===== Аналитика и прогнозы ===== */
    { id:'py-trend', lang:'python', cat:'analytics', file:'linear_trend', name:'Линейный тренд и прогноз',
      desc:'Метод наименьших квадратов: рост за период и прогноз на несколько шагов вперёд.',
      code:`# Плагин Triosteum: линейный тренд
from triosteum import block

SALES = [410, 432, 455, 448, 476, 501, 497, 523, 540]


@block(name="Линейный тренд и прогноз", sample={"ряд": SALES, "шагов": 3})
def run(d):
    y = d["ряд"]; n = len(y); xs = range(n)
    mx, my = (n - 1) / 2, sum(y) / n
    k = sum((x - mx) * (v - my) for x, v in zip(xs, y)) / sum((x - mx) ** 2 for x in xs)
    b = my - k * mx
    fc = [round(k * (n + i) + b, 1) for i in range(d["шагов"])]
    print(f"Рост за шаг: {k:+.1f}")
    print("Прогноз:", ", ".join(map(str, fc)))
    return {"наклон": round(k, 2), "прогноз": fc}
` },
    { id:'py-season', lang:'python', cat:'analytics', file:'seasonality', name:'Сезонность по месяцам',
      desc:'Индексы сезонности: какие месяцы выше или ниже среднего, по нескольким годам.',
      code:`# Плагин Triosteum: индексы сезонности
from triosteum import block

YEARS = {"2024": [80, 85, 100, 110, 120, 130, 125, 118, 105, 95, 90, 140],
         "2025": [88, 90, 108, 118, 131, 140, 133, 126, 112, 101, 97, 152]}
MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]


@block(name="Сезонность по месяцам", sample=YEARS)
def run(years):
    idx = []
    for m in range(12):
        ratios = [row[m] / (sum(row) / 12) for row in years.values()]
        idx.append(round(sum(ratios) / len(ratios), 2))
    for name, k in zip(MONTHS, idx):
        print(f"{name}  {k:4.2f}  {'█' * round(k * 10)}")
    return dict(zip(MONTHS, idx))
` },
    { id:'py-outliers', lang:'python', cat:'analytics', file:'outliers', name:'Поиск выбросов',
      desc:'Межквартильный размах: находит подозрительно большие и малые значения.',
      code:`# Плагин Triosteum: поиск выбросов (IQR)
from statistics import quantiles
from triosteum import block

PAYMENTS = [12_400, 13_100, 11_900, 12_800, 98_000, 12_300, 13_500, 1_200, 12_900, 12_600]


@block(name="Поиск выбросов", sample=PAYMENTS)
def run(values):
    q1, _, q3 = quantiles(values, n=4)
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    out = [v for v in values if v < lo or v > hi]
    print(f"Норма: от {lo:,.0f} до {hi:,.0f}".replace(",", " "))
    print("Выбросы:", ", ".join(f"{v:,}".replace(",", " ") for v in out) or "нет")
    return {"нижняя": round(lo), "верхняя": round(hi), "выбросы": out}
` },
    { id:'py-pivot', lang:'python', cat:'analytics', file:'pivot', name:'Сводная таблица',
      desc:'Группирует строки по полю и считает сумму, количество и среднее — как сводная в Excel.',
      code:`# Плагин Triosteum: сводная таблица
from collections import defaultdict
from triosteum import block

ROWS = [{"регион": "Центр", "менеджер": "Иванов", "сумма": 1_200_000},
        {"регион": "Центр", "менеджер": "Петрова", "сумма": 860_000},
        {"регион": "Урал", "менеджер": "Сидоров", "сумма": 1_540_000},
        {"регион": "Урал", "менеджер": "Сидоров", "сумма": 410_000},
        {"регион": "Сибирь", "менеджер": "Ким", "сумма": 730_000}]


@block(name="Сводная таблица", sample={"строки": ROWS, "по": "регион", "поле": "сумма"})
def run(d):
    g = defaultdict(list)
    for r in d["строки"]:
        g[r[d["по"]]].append(r[d["поле"]])
    out = [{d["по"]: k, "сумма": sum(v), "кол-во": len(v), "среднее": round(sum(v) / len(v))} for k, v in g.items()]
    out.sort(key=lambda x: -x["сумма"])
    for r in out:
        print(f'{r[d["по"]]:<8} {r["сумма"]:>12,}  ({r["кол-во"]} стр.)'.replace(",", " "))
    return out
` },
    /* ===== Данные ===== */
    { id:'py-clean', lang:'python', cat:'data', file:'clean_data', name:'Очистка данных',
      desc:'Убирает лишние пробелы, пустые строки и дубли, приводит числа к одному виду.',
      code:`# Плагин Triosteum: очистка данных
from triosteum import block

RAW = [{"клиент": "  ООО Альфа ", "сумма": "1 200 000,50"},
       {"клиент": "ООО Альфа", "сумма": "1200000.5"},
       {"клиент": "", "сумма": ""},
       {"клиент": "ИП Бета", "сумма": " 86 000 "}]


def num(s):
    s = str(s).replace(" ", "").replace("\\u00a0", "").replace(",", ".")
    return float(s) if s else None


@block(name="Очистка данных", sample=RAW)
def run(rows):
    seen, out = set(), []
    for r in rows:
        name = " ".join(str(r.get("клиент", "")).split())
        total = num(r.get("сумма", ""))
        if not name or total is None:
            continue
        key = (name.lower(), total)
        if key in seen:
            continue
        seen.add(key)
        out.append({"клиент": name, "сумма": total})
    print(f"Было строк: {len(rows)}, осталось: {len(out)}")
    return out
` },
    { id:'py-csv', lang:'python', cat:'data', file:'parse_csv', name:'Разбор CSV',
      desc:'Превращает текст CSV (с ; или ,) в список строк с названиями колонок.',
      code:`# Плагин Triosteum: разбор CSV-текста
import csv, io
from triosteum import block

TEXT = """Номер;Клиент;Сумма
З-1047;Альфа;12800000
З-1050;Бета;3900000
"""


@block(name="Разбор CSV", sample=TEXT)
def run(text):
    sep = ";" if text.count(";") >= text.count(",") else ","
    rows = list(csv.DictReader(io.StringIO(text), delimiter=sep))
    for r in rows:
        for k, v in r.items():
            try:
                r[k] = float(v) if "." in v else int(v)
            except (ValueError, TypeError):
                pass
    print(f"Колонки: {', '.join(rows[0].keys()) if rows else '—'}; строк: {len(rows)}")
    return rows
` },
    { id:'py-join', lang:'python', cat:'data', file:'join_lists', name:'Объединение по ключу',
      desc:'Склеивает два списка по общему полю — как ВПР в Excel или JOIN в SQL.',
      code:`# Плагин Triosteum: объединение двух списков по ключу
from triosteum import block

SAMPLE = {"ключ": "артикул",
          "левый": [{"артикул": "A-1", "кол-во": 40}, {"артикул": "A-2", "кол-во": 15}, {"артикул": "A-9", "кол-во": 3}],
          "правый": [{"артикул": "A-1", "цена": 1_250}, {"артикул": "A-2", "цена": 860}]}


@block(name="Объединение по ключу", sample=SAMPLE)
def run(d):
    k = d["ключ"]
    right = {r[k]: r for r in d["правый"]}
    out, missing = [], []
    for row in d["левый"]:
        match = right.get(row[k])
        if match:
            out.append({**row, **match})
        else:
            missing.append(row[k])
    print(f"Совпало: {len(out)}; без пары: {', '.join(missing) or 'нет'}")
    return out
` },
    { id:'py-inn', lang:'python', cat:'data', file:'check_inn', name:'Проверка ИНН',
      desc:'Проверяет контрольные цифры ИНН организаций (10 цифр) и ИП (12 цифр).',
      code:`# Плагин Triosteum: проверка ИНН по контрольным цифрам
from triosteum import block


def ok(inn):
    d = [int(c) for c in inn if c.isdigit()]
    def cs(w): return sum(a * b for a, b in zip(w, d)) % 11 % 10
    if len(d) == 10:
        return cs([2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[9]
    if len(d) == 12:
        return cs([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[10] and cs([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) == d[11]
    return False


@block(name="Проверка ИНН", sample=["7707083893", "7707083890", "500100732259"])
def run(items):
    out = []
    for inn in items:
        good = ok(str(inn))
        out.append({"инн": inn, "верный": good})
        print(f"{inn}: {'верный' if good else 'ОШИБКА в контрольных цифрах'}")
    return out
` },
    /* ===== Персонал ===== */
    { id:'py-payroll', lang:'python', cat:'hr', file:'payroll', name:'Зарплата и НДФЛ',
      desc:'Начислено, НДФЛ 13% и к выплате по сотрудникам, плюс страховые взносы работодателя.',
      code:`# Плагин Triosteum: расчёт зарплаты (упрощённо: НДФЛ 13%, взносы 30%)
from triosteum import block

STAFF = [{"сотрудник": "Иванов И.", "оклад": 95_000, "премия": 15_000},
         {"сотрудник": "Петрова А.", "оклад": 120_000, "премия": 0},
         {"сотрудник": "Сидоров П.", "оклад": 78_000, "премия": 9_500}]


@block(name="Зарплата и НДФЛ", sample=STAFF)
def run(staff):
    out, fund = [], 0
    for s in staff:
        gross = s["оклад"] + s["премия"]
        tax = round(gross * 0.13)
        out.append({"сотрудник": s["сотрудник"], "начислено": gross, "ндфл": tax, "к_выплате": gross - tax})
        fund += gross
        print(f'{s["сотрудник"]:<12} {gross:>9,} − {tax:>7,} = {gross - tax:>9,}'.replace(",", " "))
    print(f"Взносы работодателя (≈30%): {fund * 0.3:,.0f} ₽".replace(",", " "))
    return out
` },
    { id:'py-vacation', lang:'python', cat:'hr', file:'vacation_pay', name:'Отпускные',
      desc:'Средний дневной заработок за 12 месяцев (÷ 29,3) × дни отпуска.',
      code:`# Плагин Triosteum: отпускные по среднему заработку
from triosteum import block


@block(name="Отпускные", sample={"заработок_12_мес": 1_380_000, "дней_отпуска": 14})
def run(d):
    daily = d["заработок_12_мес"] / 12 / 29.3
    pay = daily * d["дней_отпуска"]
    print(f"Средний дневной заработок: {daily:,.2f} ₽".replace(",", " "))
    print(f"Отпускные за {d['дней_отпуска']} дн.: {pay:,.2f} ₽ (до НДФЛ)".replace(",", " "))
    return {"в_день": round(daily, 2), "отпускные": round(pay, 2)}
` },
    { id:'py-overtime', lang:'python', cat:'hr', file:'overtime', name:'Табель: переработки',
      desc:'Сверяет отработанные часы с нормой и считает доплату за сверхурочные (×1,5 и ×2).',
      code:`# Плагин Triosteum: переработки по табелю
from triosteum import block

SHEET = [{"сотрудник": "Иванов И.", "часов": 186, "ставка_в_час": 620},
         {"сотрудник": "Петрова А.", "часов": 168, "ставка_в_час": 700},
         {"сотрудник": "Сидоров П.", "часов": 201, "ставка_в_час": 540}]


@block(name="Табель: переработки", sample={"норма": 168, "табель": SHEET})
def run(d):
    out = []
    for s in d["табель"]:
        over = max(0, s["часов"] - d["норма"])
        first, rest = min(over, 2 * 4), max(0, over - 8)      # первые часы ×1,5, остальные ×2 (упрощённо)
        extra = (first * 1.5 + rest * 2) * s["ставка_в_час"]
        out.append({"сотрудник": s["сотрудник"], "сверхурочно_ч": over, "доплата": round(extra)})
        print(f'{s["сотрудник"]:<12} +{over:>3} ч → {extra:>9,.0f} ₽'.replace(",", " "))
    return out
` },
    /* ===== Отчёты и дашборды (HTML) ===== */
    { id:'html-gauge', lang:'html', cat:'viz', file:'plan_gauge', name:'Индикатор выполнения плана',
      desc:'Полукруглый индикатор: процент выполнения плана с цветом по зонам.',
      code:`<!-- Плагин Triosteum: индикатор выполнения плана -->
<div style="font-family:sans-serif;padding:16px;text-align:center">
  <svg viewBox="0 0 200 120" width="260" role="img" aria-label="План выполнен на 78%">
    <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#E5E7EB" stroke-width="18" stroke-linecap="round"/>
    <path id="arc" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#16A34A" stroke-width="18" stroke-linecap="round" pathLength="100" stroke-dasharray="78 100"/>
    <text x="100" y="92" text-anchor="middle" font-size="30" font-weight="700" id="val">78%</text>
  </svg>
  <div style="color:#555;font-size:14px">Выполнение плана продаж за месяц</div>
</div>
<script>
  // поменяйте процент — цвет подберётся сам: до 60% красный, до 90% жёлтый, дальше зелёный
  var pct = 78, arc = document.getElementById('arc');
  arc.setAttribute('stroke-dasharray', Math.min(pct, 100) + ' 100');
  arc.setAttribute('stroke', pct < 60 ? '#DC2626' : pct < 90 ? '#D97706' : '#16A34A');
  document.getElementById('val').textContent = pct + '%';
<\/script>
` },
    { id:'html-line', lang:'html', cat:'viz', file:'line_chart', name:'Линейный график',
      desc:'График динамики по месяцам на SVG — без библиотек, с подписями точек.',
      code:`<!-- Плагин Triosteum: линейный график -->
<div style="font-family:sans-serif;padding:16px">
  <div style="font-weight:600;margin-bottom:8px">Выручка, млн ₽</div>
  <svg id="ch" viewBox="0 0 480 220" width="100%" role="img" aria-label="Линейный график выручки"></svg>
</div>
<script>
  var data = [["Янв", 142], ["Фев", 151], ["Мар", 168], ["Апр", 160], ["Май", 177], ["Июн", 185]];
  var W = 480, H = 220, P = 34, max = Math.max.apply(null, data.map(function(d){ return d[1]; })) * 1.1;
  var x = function(i){ return P + i * (W - P * 2) / (data.length - 1); }, y = function(v){ return H - P - v / max * (H - P * 2); };
  var s = '<polyline fill="none" stroke="#2563EB" stroke-width="3" points="' + data.map(function(d, i){ return x(i) + ',' + y(d[1]); }).join(' ') + '"/>';
  data.forEach(function(d, i){ s += '<circle cx="' + x(i) + '" cy="' + y(d[1]) + '" r="4" fill="#2563EB"/><text x="' + x(i) + '" y="' + (y(d[1]) - 10) + '" font-size="12" text-anchor="middle">' + d[1] + '</text><text x="' + x(i) + '" y="' + (H - 10) + '" font-size="12" fill="#666" text-anchor="middle">' + d[0] + '</text>'; });
  document.getElementById('ch').innerHTML = s;
<\/script>
` },
    { id:'html-donut', lang:'html', cat:'viz', file:'donut', name:'Кольцевая диаграмма',
      desc:'Структура затрат или продаж: доли сегментов в кольце с легендой.',
      code:`<!-- Плагин Triosteum: кольцевая диаграмма -->
<div style="font-family:sans-serif;padding:16px;display:flex;gap:20px;align-items:center;flex-wrap:wrap">
  <svg id="d" viewBox="0 0 42 42" width="180" role="img" aria-label="Структура затрат"></svg>
  <ul id="lg" style="list-style:none;padding:0;margin:0;font-size:14px;line-height:1.9"></ul>
</div>
<script>
  var parts = [["Материалы", 54, "#2563EB"], ["Работа", 21, "#16A34A"], ["Энергия", 9, "#D97706"], ["Накладные", 16, "#9333EA"]];
  var off = 25, svg = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="#E5E7EB" stroke-width="6"/>', lg = '';
  parts.forEach(function(p){
    svg += '<circle cx="21" cy="21" r="15.9" fill="none" stroke="' + p[2] + '" stroke-width="6" stroke-dasharray="' + p[1] + ' ' + (100 - p[1]) + '" stroke-dashoffset="' + off + '"/>';
    off -= p[1];
    lg += '<li><span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px;background:' + p[2] + '"></span>' + p[0] + ' — ' + p[1] + '%</li>';
  });
  document.getElementById('d').innerHTML = svg; document.getElementById('lg').innerHTML = lg;
<\/script>
` },
    { id:'html-funnel', lang:'html', cat:'viz', file:'funnel_view', name:'Воронка продаж (виджет)',
      desc:'Наглядная воронка: ширина полосы — число сделок, справа — конверсия.',
      code:`<!-- Плагин Triosteum: воронка продаж -->
<div id="f" style="font-family:sans-serif;padding:16px;max-width:520px"></div>
<script>
  var st = [["Заявки", 640], ["Квалификация", 410], ["КП", 230], ["Переговоры", 96], ["Сделки", 41]], h = '';
  st.forEach(function(s, i){
    var w = Math.max(18, s[1] / st[0][1] * 100), conv = i ? Math.round(s[1] / st[i - 1][1] * 100) + '%' : '';
    h += '<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><div style="width:' + w + '%;margin:0 auto;background:#2563EB;color:#fff;border-radius:6px;padding:8px 10px;font-size:13px;text-align:center">' + s[0] + ' · ' + s[1] + '</div><div style="width:44px;font-size:12px;color:#666">' + conv + '</div></div>';
  });
  document.getElementById('f').innerHTML = h;
<\/script>
` },
    { id:'html-gantt', lang:'html', cat:'viz', file:'gantt', name:'Диаграмма Ганта',
      desc:'План работ по дням: этапы проекта полосами на шкале времени.',
      code:`<!-- Плагин Triosteum: диаграмма Ганта -->
<div style="font-family:sans-serif;padding:16px">
  <div style="font-weight:600;margin-bottom:10px">Запуск линии покраски</div>
  <div id="g"></div>
</div>
<script>
  var days = 30, tasks = [["Проект", 0, 6, "#2563EB"], ["Закупка оборудования", 4, 14, "#9333EA"], ["Монтаж", 15, 9, "#D97706"], ["Пусконаладка", 23, 5, "#16A34A"], ["Обучение", 26, 4, "#0891B2"]], h = '';
  tasks.forEach(function(t){
    h += '<div style="display:grid;grid-template-columns:170px 1fr;align-items:center;gap:8px;margin:5px 0;font-size:13px"><div>' + t[0] + '</div><div style="position:relative;height:18px;background:#F3F4F6;border-radius:4px"><div style="position:absolute;left:' + (t[1] / days * 100) + '%;width:' + (t[2] / days * 100) + '%;top:0;bottom:0;background:' + t[3] + ';border-radius:4px"></div></div></div>';
  });
  document.getElementById('g').innerHTML = h;
<\/script>
` },
    { id:'html-kanban', lang:'html', cat:'viz', file:'kanban', name:'Канбан задач',
      desc:'Три колонки — «Сделать», «В работе», «Готово»; карточки можно перетаскивать.',
      code:`<!-- Плагин Triosteum: канбан задач -->
<div style="font-family:sans-serif;padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px" id="kb"></div>
<script>
  var cols = { "Сделать": ["Согласовать КП с «Альфой»", "Заказать металл"], "В работе": ["Сварка рам З-1047"], "Готово": ["Раскрой листа"] }, kb = document.getElementById('kb');
  Object.keys(cols).forEach(function(c){
    var col = document.createElement('div'); col.style.cssText = 'background:#F3F4F6;border-radius:10px;padding:8px;min-height:120px';
    col.innerHTML = '<div style="font-weight:600;font-size:13px;margin:2px 4px 8px">' + c + '</div>';
    col.ondragover = function(e){ e.preventDefault(); }; col.ondrop = function(e){ col.appendChild(document.getElementById(e.dataTransfer.getData('id'))); };
    cols[c].forEach(function(t, i){ var d = document.createElement('div'); d.id = c + i; d.draggable = true; d.textContent = t; d.style.cssText = 'background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:8px;margin:6px 0;font-size:13px;cursor:grab'; d.ondragstart = function(e){ e.dataTransfer.setData('id', d.id); }; col.appendChild(d); });
    kb.appendChild(col);
  });
<\/script>
` },
    { id:'html-heatmap', lang:'html', cat:'viz', file:'heatmap', name:'Тепловая карта по дням',
      desc:'Нагрузка по дням недели и часам: чем темнее клетка, тем больше заявок.',
      code:`<!-- Плагин Triosteum: тепловая карта -->
<div style="font-family:sans-serif;padding:16px">
  <div style="font-weight:600;margin-bottom:8px">Заявки по дням и часам</div>
  <div id="hm" style="display:grid;grid-template-columns:40px repeat(10,1fr);gap:3px;font-size:11px"></div>
</div>
<script>
  var days = ["Пн", "Вт", "Ср", "Чт", "Пт"], h = '<div></div>';
  for(var c = 9; c < 19; c++) h += '<div style="text-align:center;color:#666">' + c + '</div>';
  days.forEach(function(d, di){
    h += '<div style="color:#666">' + d + '</div>';
    for(var c = 9; c < 19; c++){ var v = Math.round(Math.abs(Math.sin(di * 1.7 + c / 2)) * 100); h += '<div title="' + d + ', ' + c + ':00 — ' + v + '" style="height:22px;border-radius:3px;background:rgba(37,99,235,' + (0.08 + v / 110) + ')"></div>'; }
  });
  document.getElementById('hm').innerHTML = h;
<\/script>
` },
    { id:'html-form', lang:'html', cat:'viz', file:'request_form', name:'Форма заявки',
      desc:'Простая форма заявки с проверкой полей; данные можно передать дальше по схеме.',
      code:`<!-- Плагин Triosteum: форма заявки -->
<form id="fm" style="font-family:sans-serif;padding:16px;display:grid;gap:10px;max-width:380px">
  <label>Имя<br><input name="name" required style="width:100%;padding:8px"></label>
  <label>Телефон<br><input name="phone" required pattern="[+0-9 ()-]{10,}" style="width:100%;padding:8px"></label>
  <label>Что нужно<br><textarea name="text" rows="3" style="width:100%;padding:8px"></textarea></label>
  <button style="padding:10px;border:0;border-radius:8px;background:#2563EB;color:#fff;font-weight:600">Отправить заявку</button>
  <div id="ok" style="color:#16A34A" role="status"></div>
</form>
<script>
  document.getElementById('fm').onsubmit = function(e){
    e.preventDefault();
    var d = Object.fromEntries(new FormData(e.target));
    document.getElementById('ok').textContent = 'Заявка принята: ' + d.name + ', ' + d.phone;
  };
<\/script>
` },
    /* ===== Интеграции (C#) ===== */
    { id:'cs-webhook', lang:'csharp', cat:'integr', file:'Webhook', name:'Отправка в вебхук (JSON)',
      desc:'Отправляет данные схемы POST-запросом в любой сервис, который принимает JSON.',
      code:`// Плагин Triosteum: отправка данных в вебхук
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Triosteum;

[Block("Отправка в вебхук")]
public class Webhook : IBlock
{
    private static readonly HttpClient Http = new HttpClient();

    public async Task<Data> Run(Data input)
    {
        var url = Secrets.Get("WEBHOOK_URL");          // адрес хранится в секретах блока
        var resp = await Http.PostAsJsonAsync(url, input.Raw);
        resp.EnsureSuccessStatusCode();
        return input.With("отправлено", true);
    }
}
` },
    { id:'cs-sql', lang:'csharp', cat:'integr', file:'SqlQuery', name:'Запрос к SQL Server',
      desc:'Выполняет SQL-запрос к базе и отдаёт строки дальше по схеме (Dapper).',
      code:`// Плагин Triosteum: запрос к Microsoft SQL Server
using System.Linq;
using System.Threading.Tasks;
using Dapper;
using Microsoft.Data.SqlClient;
using Triosteum;

[Block("Запрос к SQL Server")]
public class SqlQuery : IBlock
{
    public async Task<Data> Run(Data input)
    {
        await using var db = new SqlConnection(Secrets.Get("SQL_CONNECTION"));
        var rows = await db.QueryAsync(
            "SELECT TOP 100 Number, Client, Amount FROM Orders WHERE Status = @status ORDER BY Date DESC",
            new { status = input.Get<string>("status") ?? "open" });
        return Data.From(rows.ToList());
    }
}
` },
    { id:'cs-bitrix', lang:'csharp', cat:'integr', file:'BitrixDeal', name:'Сделка в Битрикс24',
      desc:'Создаёт сделку в Битрикс24 через входящий вебхук: название, сумма, ответственный.',
      code:`// Плагин Triosteum: сделка в Битрикс24 (входящий вебхук)
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Triosteum;

[Block("Сделка в Битрикс24")]
public class BitrixDeal : IBlock
{
    private static readonly HttpClient Http = new HttpClient();

    public async Task<Data> Run(Data input)
    {
        var hook = Secrets.Get("BITRIX_WEBHOOK");   // https://ваш-портал.bitrix24.ru/rest/1/xxxx/
        var body = new { fields = new Dictionary<string, object>
        {
            ["TITLE"] = input.Get<string>("название"),
            ["OPPORTUNITY"] = input.Get<decimal>("сумма"),
            ["CURRENCY_ID"] = "RUB",
        }};
        var resp = await Http.PostAsJsonAsync(hook + "crm.deal.add.json", body);
        return input.With("ответ", await resp.Content.ReadAsStringAsync());
    }
}
` },
    { id:'cs-pdf', lang:'csharp', cat:'integr', file:'PdfReport', name:'PDF-отчёт',
      desc:'Собирает PDF с таблицей из входных данных (QuestPDF) и сохраняет файл.',
      code:`// Плагин Triosteum: PDF-отчёт с таблицей
using System.Threading.Tasks;
using QuestPDF.Fluent;
using Triosteum;

[Block("PDF-отчёт")]
public class PdfReport : IBlock
{
    public Task<Data> Run(Data input)
    {
        var rows = input.Rows();
        var path = Files.Temp("отчёт.pdf");
        Document.Create(doc => doc.Page(page =>
        {
            page.Margin(40);
            page.Header().Text(input.Get<string>("заголовок") ?? "Отчёт").FontSize(18).Bold();
            page.Content().Table(t =>
            {
                t.ColumnsDefinition(c => { foreach (var _ in rows.Columns) c.RelativeColumn(); });
                foreach (var col in rows.Columns) t.Cell().Text(col).Bold();
                foreach (var r in rows) foreach (var col in rows.Columns) t.Cell().Text(r[col]?.ToString());
            });
        })).GeneratePdf(path);
        return Task.FromResult(input.With("файл", path));
    }
}
` },
    /* ===== Производство (C++) ===== */
    { id:'cpp-pid', lang:'cpp', cat:'prod', file:'pid', name:'PID-регулятор',
      desc:'Классический ПИД-регулятор для температуры, давления или скорости.',
      code:`// Плагин Triosteum: PID-регулятор
#include "triosteum/block.h"

struct Pid {
    double kp = 1.2, ki = 0.08, kd = 0.4;
    double integral = 0, prev_error = 0;

    double step(double setpoint, double measured, double dt) {
        const double error = setpoint - measured;
        integral += error * dt;
        const double derivative = (error - prev_error) / dt;
        prev_error = error;
        return kp * error + ki * integral + kd * derivative;   // управляющее воздействие
    }
};

TRIOSTEUM_BLOCK("PID-регулятор")
double run(Pid& pid, double setpoint, double measured) {
    return pid.step(setpoint, measured, 0.1);
}
` },
    { id:'cpp-cutting', lang:'cpp', cat:'prod', file:'cutting', name:'Раскрой профиля',
      desc:'Раскладывает детали по хлыстам стандартной длины так, чтобы было меньше обрезков.',
      code:`// Плагин Triosteum: раскрой профиля (первый подходящий по убыванию)
#include <algorithm>
#include <vector>
#include "triosteum/block.h"

TRIOSTEUM_BLOCK("Раскрой профиля")
std::vector<std::vector<int>> run(std::vector<int> parts, int bar_len) {
    std::sort(parts.begin(), parts.end(), std::greater<int>());
    std::vector<std::vector<int>> bars;
    std::vector<int> rest;
    for (int p : parts) {
        bool placed = false;
        for (size_t i = 0; i < bars.size() && !placed; ++i)
            if (rest[i] >= p) { bars[i].push_back(p); rest[i] -= p; placed = true; }
        if (!placed) { bars.push_back({p}); rest.push_back(bar_len - p); }
    }
    return bars;   // каждый хлыст — список длин деталей
}
` },
    { id:'cpp-vibration', lang:'cpp', cat:'prod', file:'vibration_rms', name:'Вибрация: СКЗ и пик',
      desc:'Среднеквадратичное значение и пик виброскорости — признак износа подшипников.',
      code:`// Плагин Triosteum: вибрация — СКЗ и пиковое значение
#include <cmath>
#include <vector>
#include "triosteum/block.h"

struct VibroResult { double rms; double peak; bool alarm; };

TRIOSTEUM_BLOCK("Вибрация: СКЗ и пик")
VibroResult run(const std::vector<double>& samples, double limit_mm_s) {
    double sum = 0, peak = 0;
    for (double v : samples) { sum += v * v; peak = std::max(peak, std::fabs(v)); }
    const double rms = std::sqrt(sum / samples.size());
    return { rms, peak, rms > limit_mm_s };
}
` },
    /* ===== 1С ===== */
    { id:'1c-debts', lang:'1c', cat:'sales', file:'ДолгиКлиентов', name:'Долги клиентов',
      desc:'Дебиторская задолженность по клиентам из взаиморасчётов 1С.',
      code:`// Плагин Triosteum: долги клиентов
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Расчеты.Контрагент КАК Клиент,
    |    СУММА(Расчеты.СуммаОстаток) КАК Долг
    |ИЗ
    |    РегистрНакопления.РасчетыСКлиентами.Остатки(&НаДату) КАК Расчеты
    |СГРУППИРОВАТЬ ПО
    |    Расчеты.Контрагент
    |ИМЕЮЩИЕ
    |    СУММА(Расчеты.СуммаОстаток) > 0
    |УПОРЯДОЧИТЬ ПО
    |    Долг УБЫВ";
    Запрос.УстановитьПараметр("НаДату", ВходныеДанные.Дата);
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` },
    { id:'1c-sales', lang:'1c', cat:'sales', file:'ПродажиЗаПериод', name:'Продажи за период',
      desc:'Выручка и количество по номенклатуре за выбранный период.',
      code:`// Плагин Triosteum: продажи за период
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Продажи.Номенклатура КАК Номенклатура,
    |    СУММА(Продажи.Количество) КАК Количество,
    |    СУММА(Продажи.Сумма) КАК Выручка
    |ИЗ
    |    РегистрНакопления.Продажи.Обороты(&Начало, &Конец) КАК Продажи
    |СГРУППИРОВАТЬ ПО
    |    Продажи.Номенклатура
    |УПОРЯДОЧИТЬ ПО
    |    Выручка УБЫВ";
    Запрос.УстановитьПараметр("Начало", ВходныеДанные.Начало);
    Запрос.УстановитьПараметр("Конец", ВходныеДанные.Конец);
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` },
    { id:'1c-prices', lang:'1c', cat:'stock', file:'ЦеныНоменклатуры', name:'Цены номенклатуры',
      desc:'Действующие цены по виду цен на дату — для прайс-листа или проверки КП.',
      code:`// Плагин Triosteum: цены номенклатуры
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Цены.Номенклатура КАК Номенклатура,
    |    Цены.Цена КАК Цена
    |ИЗ
    |    РегистрСведений.ЦеныНоменклатуры.СрезПоследних(&НаДату, ВидЦены = &ВидЦены) КАК Цены";
    Запрос.УстановитьПараметр("НаДату", ВходныеДанные.Дата);
    Запрос.УстановитьПараметр("ВидЦены", Справочники.ВидыЦен.НайтиПоНаименованию("Оптовая"));
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` },
    { id:'1c-staff', lang:'1c', cat:'hr', file:'НачисленияСотрудникам', name:'Начисления сотрудникам',
      desc:'Начисленная зарплата по сотрудникам и подразделениям за месяц.',
      code:`// Плагин Triosteum: начисления сотрудникам
// Имена объектов зависят от конфигурации 1С
Функция Выполнить(ВходныеДанные) Экспорт
    Запрос = Новый Запрос;
    Запрос.Текст =
    "ВЫБРАТЬ
    |    Начисления.Сотрудник КАК Сотрудник,
    |    Начисления.Подразделение КАК Подразделение,
    |    СУММА(Начисления.Сумма) КАК Начислено
    |ИЗ
    |    РегистрНакопления.НачисленияУдержанияПоСотрудникам КАК Начисления
    |ГДЕ
    |    Начисления.ПериодДействия = &Месяц
    |СГРУППИРОВАТЬ ПО
    |    Начисления.Сотрудник, Начисления.Подразделение";
    Запрос.УстановитьПараметр("Месяц", НачалоМесяца(ВходныеДанные.Дата));
    Возврат Запрос.Выполнить().Выгрузить();
КонецФункции
` }
  );
