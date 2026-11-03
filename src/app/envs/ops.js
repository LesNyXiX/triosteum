  /* =====================================================================
     РАСЧЁТНЫЕ БЛОКИ ОТРАСЛЕВЫХ СРЕД. Блок = параметры (JSON) + функция,
     которая получает записи от блоков выше по схеме и отдаёт записи дальше.
     Поля описания: [ключ, подпись, тип, варианты]; тип: f — поле записи,
     t — текст, n — число, s — выбор из списка.
     ===================================================================== */
  function nv(r, f){ var v = num(lookup(r, f)); return typeof v === 'number' && isFinite(v) ? v : 0; }
  function sv(r, f){ var v = lookup(r, f); return v === undefined || v === null ? '' : String(v); }
  function r2(x, d){ var m = Math.pow(10, d === undefined ? 2 : d); return Math.round(x * m) / m; }
  function cpRow(r){ var o = {}; for(var k in r) o[k] = r[k]; return o; }
  function pct(a, b, d){ return b ? r2(a / b * 100, d === undefined ? 1 : d) : 0; }
  function ruDate(s){
    if(s instanceof Date) return s;
    var m = String(s || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if(m){ var y = +m[3]; if(y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
    m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function ruDateStr(d){ return d ? d.toLocaleDateString('ru-RU') : ''; }
  function today0(){ var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dayDiff(a, b){ return Math.round((b - a) / 864e5); }
  function money(x){ return fmtCell(r2(x, 2)); }
  function opKind(id, name, tool, defaults, fields, apply, sum){
    return { id:id, name:name, tool:tool, ext:'json', real:true, param:true, op:true, tpl:JSON.stringify(defaults), fields:fields, apply:apply, sum:sum };
  }
  var FNS = [['sum', 'сумма'], ['avg', 'среднее'], ['count', 'количество'], ['min', 'минимум'], ['max', 'максимум']];
  function agg(list, fn){
    if(fn === 'count') return list.length;
    if(!list.length) return 0;
    if(fn === 'avg') return r2(list.reduce(function(s, x){ return s + x; }, 0) / list.length);
    if(fn === 'min') return Math.min.apply(0, list);
    if(fn === 'max') return Math.max.apply(0, list);
    return r2(list.reduce(function(s, x){ return s + x; }, 0));
  }
  function groupBy(rows, key){
    var order = [], g = {};
    rows.forEach(function(r){ var k = sv(r, key) || '(пусто)'; if(!g[k]){ g[k] = []; order.push(k); } g[k].push(r); });
    return { keys:order, map:g };
  }
  // вычисление выражения с полями {Поле} через движок формул таблиц (ЕСЛИ, ОКРУГЛ, СУММ…)
  function evalExpr(expr, row){
    var keys = Object.keys(row).filter(function(k){ return k.indexOf('__') !== 0; });
    var f = String(expr || '').replace(/^=/, '').replace(/\{([^{}]+)\}/g, function(m, k){
      k = k.trim(); var i = keys.indexOf(k);
      if(i < 0){ var lk = k.toLowerCase(); i = keys.map(function(x){ return x.toLowerCase(); }).indexOf(lk); }
      return i < 0 ? '0' : colName(i) + '2';
    });
    var aoa = [keys.concat(['_']), keys.map(function(k){ var v = row[k]; return v === undefined || v === null ? '' : String(v); }).concat(['=' + f])];
    return computeSheet(aoa)[1][keys.length];
  }

  /* ---------- общие для всех отраслевых сред ---------- */
  var OP_CALC = opKind('calc', 'Вычисление', 'Новое поле по формуле: {Количество}*{Цена}, ЕСЛИ, ОКРУГЛ',
    { name:'Сумма', expr:'{Количество}*{Цена}', round:2 },
    [['name', 'Новое поле', 't'], ['expr', 'Формула (поля в фигурных скобках)', 't'], ['round', 'Знаков после запятой', 'n']],
    function(rows, p, ctx){
      var bad = 0, out = rows.map(function(r){ var o = cpRow(r), v = evalExpr(p.expr, r); if(v === '#ОШИБКА') bad++; else if(typeof v === 'number') v = r2(v, p.round === undefined ? 2 : +p.round); o[p.name || 'Результат'] = v; return o; });
      if(bad) ctx.log('ошибка в формуле у ' + plural(bad, 'записи', 'записей', 'записей') + ' — проверьте названия полей', 'warn');
      ctx.info = '«' + (p.name || 'Результат') + '» для ' + plural(out.length, 'записи', 'записей', 'записей'); return out;
    }, function(p){ return (p.name || 'поле') + ' = ' + (p.expr || '…'); });
  var OP_GROUP = opKind('group', 'Группировка', 'Итоги по группам: сумма, среднее, количество',
    { by:'Категория', field:'Сумма', fn:'sum', order:'value' },
    [['by', 'Группировать по полю', 'f'], ['field', 'Считать поле', 'f'], ['fn', 'Как считать', 's', FNS], ['order', 'Порядок групп', 's', [['value', 'по убыванию итога'], ['source', 'как в данных (для дат и месяцев)']]]],
    function(rows, p, ctx){
      var g = groupBy(rows, p.by), fnName = (FNS.filter(function(x){ return x[0] === p.fn; })[0] || FNS[0])[1];
      var col = p.fn === 'count' ? 'Записей' : p.field + (p.fn === 'sum' ? '' : ' (' + fnName + ')');
      var out = g.keys.map(function(k){ var o = {}; o[p.by] = k; o[col] = agg(g.map[k].map(function(r){ return nv(r, p.field); }), p.fn); if(p.fn !== 'count') o['Записей'] = g.map[k].length; return o; });
      if(p.order !== 'source') out.sort(function(a, b){ return b[col] - a[col]; });
      ctx.table(ctx.name, out); ctx.info = 'Групп: ' + out.length; return out;
    }, function(p){ return 'по «' + (p.by || '?') + '»: ' + ((FNS.filter(function(x){ return x[0] === p.fn; })[0] || FNS[0])[1]) + (p.fn === 'count' ? '' : ' «' + (p.field || '?') + '»'); });
  var OP_SORT = opKind('sort', 'Сортировка и топ', 'Упорядочить записи и оставить первые N',
    { field:'Сумма', dir:'desc', top:10 },
    [['field', 'Поле', 'f'], ['dir', 'Порядок', 's', [['desc', 'по убыванию'], ['asc', 'по возрастанию']]], ['top', 'Оставить первых (0 — все)', 'n']],
    function(rows, p, ctx){
      var k = p.dir === 'asc' ? 1 : -1, out = rows.slice().sort(function(a, b){
        var x = num(lookup(a, p.field)), y = num(lookup(b, p.field));
        if(typeof x === 'number' && typeof y === 'number') return (x - y) * k;
        return String(x === undefined ? '' : x).localeCompare(String(y === undefined ? '' : y), 'ru') * k;
      });
      if(+p.top > 0) out = out.slice(0, +p.top);
      ctx.info = 'Записей: ' + out.length; return out;
    }, function(p){ return '«' + (p.field || '?') + '» ' + (p.dir === 'asc' ? '↑' : '↓') + (+p.top > 0 ? ', топ ' + p.top : ''); });
  function abcRows(rows, nameF, valF, a, b, groupF){
    var src = rows;
    if(groupF){ var g = groupBy(rows, nameF); src = g.keys.map(function(k){ var o = {}; o[nameF] = k; o[valF] = r2(g.map[k].reduce(function(s, r){ return s + nv(r, valF); }, 0)); return o; }); }
    var total = src.reduce(function(s, r){ return s + nv(r, valF); }, 0), acc = 0;
    return src.slice().sort(function(x, y){ return nv(y, valF) - nv(x, valF); }).map(function(r){
      var o = cpRow(r), share = total ? nv(r, valF) / total * 100 : 0, before = acc; acc += share;
      o['Доля, %'] = r2(share, 1); o['Накопительно, %'] = r2(acc, 1); o['Группа'] = before < a ? 'A' : (before < b ? 'B' : 'C'); return o;
    });
  }
  var OP_ABC = opKind('abc', 'ABC-анализ', 'Группы A, B, C по вкладу в итог (правило Парето)',
    { name:'Артикул', field:'Сумма', a:80, b:95 },
    [['name', 'Объект анализа (поле)', 'f'], ['field', 'Показатель', 'f'], ['a', 'Граница группы A, %', 'n'], ['b', 'Граница группы B, %', 'n']],
    function(rows, p, ctx){
      var out = abcRows(rows, p.name, p.field, +p.a || 80, +p.b || 95, true), c = { A:0, B:0, C:0 };
      out.forEach(function(r){ c[r['Группа']]++; });
      ctx.table(ctx.name, out); ctx.info = 'A: ' + c.A + ' · B: ' + c.B + ' · C: ' + c.C; return out;
    }, function(p){ return '«' + (p.name || '?') + '» по «' + (p.field || '?') + '», A до ' + (p.a || 80) + '%'; });
  var OP_CHART = opKind('chart', 'Диаграмма', 'Столбцы или линия по записям — в окне результатов',
    { label:'Категория', value:'Сумма', type:'bar', top:15 },
    [['label', 'Подписи (поле)', 'f'], ['value', 'Значения (поле)', 'f'], ['type', 'Вид', 's', [['bar', 'столбцы'], ['line', 'линия']]], ['top', 'Не больше элементов', 'n']],
    function(rows, p, ctx){
      var list = rows.slice(0, +p.top > 0 ? +p.top : 30);
      ctx.chart({ title:ctx.name, kind:p.type || 'bar', labels:list.map(function(r){ return sv(r, p.label); }), values:list.map(function(r){ return nv(r, p.value); }), unit:p.value });
      ctx.info = 'Элементов: ' + list.length; return rows;
    }, function(p){ return (p.type === 'line' ? 'линия' : 'столбцы') + ': «' + (p.value || '?') + '» по «' + (p.label || '?') + '»'; });
  var OP_PERIOD = opKind('period', 'Период', 'Оставляет записи за период: с — по или последние N дней',
    { date:'Дата', from:'', to:'', last:0 },
    [['date', 'Дата (поле)', 'f'], ['from', 'С (дд.мм.гггг, можно пусто)', 't'], ['to', 'По (дд.мм.гггг, можно пусто)', 't'], ['last', 'Или последние N дней (0 — не использовать)', 'n']],
    function(rows, p, ctx){
      var a = ruDate(p.from), b = ruDate(p.to), t = today0(), bad = 0;
      if(+p.last > 0){ a = new Date(t); a.setDate(a.getDate() - (+p.last) + 1); b = t; }
      var out = rows.filter(function(r){ var d = ruDate(sv(r, p.date)); if(!d){ bad++; return false; } return (!a || d >= a) && (!b || d <= b); });
      if(bad) ctx.log('без даты или с неверной датой: ' + bad, 'dim');
      ctx.info = 'За период: ' + out.length + ' из ' + rows.length; return out;
    }, function(p){ return +p.last > 0 ? 'последние ' + p.last + ' дн.' : (p.from || '…') + ' — ' + (p.to || '…'); });
  function normKey(s, legal){
    s = String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`“”]/g, ' ');
    if(legal) s = s.replace(/\b(ооо|оао|зао|пао|ао|ип|нао)\b/g, ' ');
    return s.replace(/[\s.,]+/g, ' ').trim();
  }
  var OP_DEDUPE = opKind('dedupe', 'Удаление дублей', 'Убирает повторы по полю: регистр, кавычки и ООО/АО не мешают',
    { key:'Клиент', keep:'first', legal:'yes' },
    [['key', 'Сравнивать по полю', 'f'], ['keep', 'Какую запись оставить', 's', [['first', 'первую'], ['last', 'последнюю']]], ['legal', 'Не учитывать ООО, АО, ИП', 's', [['yes', 'да'], ['no', 'нет']]]],
    function(rows, p, ctx){
      var seen = {}, out = [], src = p.keep === 'last' ? rows.slice().reverse() : rows, dup = [];
      src.forEach(function(r){ var k = normKey(sv(r, p.key), p.legal !== 'no'); if(seen[k]){ dup.push(sv(r, p.key)); return; } seen[k] = 1; out.push(r); });
      if(p.keep === 'last') out.reverse();
      if(dup.length) ctx.log('повторы: ' + dup.slice(0, 5).join('; ') + (dup.length > 5 ? '…' : ''), 'dim');
      ctx.info = 'Убрано дублей: ' + dup.length + ', осталось ' + out.length; return out;
    }, function(p){ return 'по «' + (p.key || '?') + '»'; });
  var OP_JOIN = opKind('join', 'Объединение по ключу', 'Склеивает таблицы по общему полю (как ВПР)',
    { key:'Артикул', mode:'left' },
    [['key', 'Общее поле', 'f'], ['mode', 'Какие записи оставить', 's', [['left', 'все из первой таблицы'], ['inner', 'только с парой']]]],
    function(rows, p, ctx){
      if(ctx.ins.length < 2){ ctx.info = 'Один вход — данные без изменений'; return rows; }
      var base = ctx.ins[0], idx = {}, miss = 0;
      ctx.ins.slice(1).forEach(function(set){ set.forEach(function(r){ var k = normKey(sv(r, p.key)); idx[k] = idx[k] || {}; for(var f in r){ if(f.indexOf('__') !== 0) idx[k][f] = r[f]; } }); });
      var out = [];
      base.forEach(function(r){ var o = cpRow(r), x = idx[normKey(sv(r, p.key))]; if(!x){ miss++; if(p.mode !== 'inner') out.push(o); return; } for(var f in x){ if(o[f] === undefined) o[f] = x[f]; } out.push(o); });
      if(miss) ctx.log('без пары: ' + miss, 'dim');
      ctx.info = 'Объединено: ' + (base.length - miss) + ' из ' + base.length; return out;
    }, function(p){ return 'по «' + (p.key || '?') + '»'; });
  var OP_PLANFACT = opKind('planfact', 'План-факт', 'Отклонение факта от плана и статус',
    { plan:'План', fact:'Факт', limit:10, mode:'cost' },
    [['plan', 'План (поле)', 'f'], ['fact', 'Факт (поле)', 'f'], ['limit', 'Допустимое отклонение, %', 'n'], ['mode', 'Что это', 's', [['cost', 'расходы — плохо, если больше плана'], ['income', 'доходы, выпуск — плохо, если меньше плана']]]],
    function(rows, p, ctx){
      var k = 0, lim = +p.limit || 0, out = rows.map(function(r){
        var o = cpRow(r), pl = nv(r, p.plan), f = nv(r, p.fact), d = f - pl, dp = pct(d, pl, 1), bad = p.mode === 'income' ? dp < -lim : dp > lim;
        o['Отклонение'] = r2(d); o['Отклонение, %'] = dp; o['Выполнение, %'] = pct(f, pl, 1); o['Статус'] = bad ? (p.mode === 'income' ? 'Недовыполнение' : 'Перерасход') : 'В пределах'; if(bad) k++; return o;
      });
      ctx.info = 'Вне допуска: ' + k + ' из ' + out.length; ctx.table(ctx.name, out); return out;
    }, function(p){ return (p.mode === 'income' ? 'доходы' : 'расходы') + ', допуск ' + (p.limit || 0) + '%'; });
  var OP_METRIC = opKind('metric', 'Показатель', 'Одно число для дашборда: итог, среднее, цель и выполнение',
    { title:'Выручка', field:'Сумма', fn:'sum', target:0, unit:'руб.' },
    [['title', 'Название показателя', 't'], ['field', 'Поле', 'f'], ['fn', 'Как считать', 's', FNS], ['target', 'Цель (0 — без цели)', 'n'], ['unit', 'Единица', 't']],
    function(rows, p, ctx){
      var v = agg(rows.map(function(r){ return nv(r, p.field); }), p.fn), o = { 'Показатель':p.title || p.field, 'Значение':v, 'Единица':p.unit || '' };
      if(+p.target){ o['Цель'] = +p.target; o['Выполнение, %'] = pct(v, +p.target, 1); }
      ctx.item({ type:'metric', title:o['Показатель'], value:v, unit:p.unit || '', target:+p.target || 0, pct:o['Выполнение, %'] });
      ctx.info = (p.title || p.field) + ': ' + fmtCell(v) + (+p.target ? ' (' + o['Выполнение, %'] + '% цели)' : ''); return [o];
    }, function(p){ return (p.title || '?') + (+p.target ? ', цель ' + fmtCell(+p.target) : ''); });
  var OP_DASH = opKind('dashboard', 'Дашборд', 'Одна страница: все показатели, диаграммы и таблицы блоков выше по схеме',
    { title:'Дашборд', tables:'no' },
    [['title', 'Заголовок', 't'], ['tables', 'Показывать таблицы', 's', [['no', 'нет, только показатели и графики'], ['yes', 'да, первые 10 строк']]]],
    function(rows, p, ctx){
      var up = ctx.upItems(), tiles = up.filter(function(x){ return x.type === 'metric'; }), charts = up.filter(function(x){ return x.type === 'chart'; }), tabs = p.tables === 'yes' ? up.filter(function(x){ return x.type === 'table'; }) : [];
      ctx.item({ type:'dash', title:p.title || ctx.name, tiles:tiles, charts:charts, tables:tabs });
      ctx.info = 'Показателей: ' + tiles.length + ', диаграмм: ' + charts.length + (tabs.length ? ', таблиц: ' + tabs.length : ''); return rows;
    }, function(p){ return p.title || 'дашборд'; });
  OP_CHART.fields[2][3] = [['bar', 'столбцы'], ['line', 'линия'], ['pie', 'круговая']];
  var GEN_OPS = [OP_CALC, OP_GROUP, OP_SORT, OP_PERIOD, OP_DEDUPE, OP_JOIN, OP_PLANFACT, OP_ABC, OP_CHART, OP_METRIC, OP_DASH];
  var GEN_COLORS = { calc:['#64748B', '#CBD5E1'], group:['#0891B2', '#67E8F9'], sort:['#475569', '#94A3B8'], abc:['#DB2777', '#F9A8D4'], chart:['#7C3AED', '#C4B5FD'],
    period:['#0284C7', '#7DD3FC'], dedupe:['#71717A', '#D4D4D8'], join:['#14B8A6', '#5EEAD4'], planfact:['#2563EB', '#93C5FD'], metric:['#F59E0B', '#FDE68A'], dashboard:['#A855F7', '#E9D5FF'] };

  /* ---------- диаграмма в окне результатов ---------- */
  function routeChartSvg(it){
    var v = it.values, L = it.labels, n = v.length; if(!n) return '<p>Нет данных для диаграммы.</p>';
    var max = Math.max.apply(0, v.concat([0])), min = Math.min.apply(0, v.concat([0])), span = (max - min) || 1;
    var W = 720, padL = 12, padB = 70, H = 300, top = 16, cw = (W - padL * 2) / n, y = function(x){ return top + (max - x) / span * (H - top - padB); };
    if(it.kind === 'pie') return pieSvg(it);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="font:11px Arial;max-width:' + W + 'px" role="img" aria-label="' + escHtml(it.title) + '">';
    s += '<line x1="' + padL + '" x2="' + (W - padL) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#999"/>';
    if(it.kind === 'line'){
      s += '<polyline fill="none" stroke="#2563EB" stroke-width="2.5" points="' + v.map(function(x, i){ return (padL + cw * (i + 0.5)).toFixed(1) + ',' + y(x).toFixed(1); }).join(' ') + '"/>';
      v.forEach(function(x, i){ var cx = (padL + cw * (i + 0.5)).toFixed(1); s += '<circle cx="' + cx + '" cy="' + y(x).toFixed(1) + '" r="3.5" fill="#2563EB"><title>' + escHtml(L[i] + ': ' + fmtCell(x)) + '</title></circle>'; if(n <= 24) s += '<text x="' + cx + '" y="' + (y(x) - 8).toFixed(1) + '" text-anchor="middle" fill="#333">' + escHtml(fmtCell(r2(x, 1))) + '</text>'; });
    } else v.forEach(function(x, i){
      var y0 = y(Math.max(x, 0)), hh = Math.max(1, Math.abs(y(x) - y(0)));
      s += '<rect x="' + (padL + cw * i + cw * 0.15).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (cw * 0.7).toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="2" fill="' + (x < 0 ? '#DC2626' : '#2563EB') + '"><title>' + escHtml(L[i] + ': ' + fmtCell(x)) + '</title></rect>';
      if(n <= 16) s += '<text x="' + (padL + cw * (i + 0.5)).toFixed(1) + '" y="' + (y0 - 4).toFixed(1) + '" text-anchor="middle" fill="#333">' + escHtml(fmtCell(r2(x, 1))) + '</text>';
    });
    L.forEach(function(l, i){ var x = padL + cw * (i + 0.5); s += '<text transform="translate(' + x.toFixed(1) + ',' + (H - padB + 14) + ') rotate(-35)" text-anchor="end" fill="#333">' + escHtml(String(l).slice(0, 22)) + '</text>'; });
    return s + '</svg><p style="font:12px Arial;color:#555">Показатель: ' + escHtml(it.unit || '') + '</p>';
  }
  var PIE_COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#475569'];
  function pieSvg(it){
    var v = it.values.map(function(x){ return Math.max(0, x); }), tot = v.reduce(function(a, b){ return a + b; }, 0);
    if(!tot) return '<p>Нет положительных значений для круговой диаграммы.</p>';
    var cx = 150, cy = 150, R = 130, a = -Math.PI / 2, s = '<svg viewBox="0 0 640 300" width="100%" style="font:12px Arial;max-width:640px" role="img" aria-label="' + escHtml(it.title) + '">';
    v.forEach(function(x, i){
      var c = PIE_COLORS[i % PIE_COLORS.length], b = a + x / tot * Math.PI * 2, big = b - a > Math.PI ? 1 : 0;
      if(x / tot > 0.9999) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + c + '"/>';
      else if(x > 0) s += '<path d="M' + cx + ',' + cy + 'L' + (cx + R * Math.cos(a)).toFixed(1) + ',' + (cy + R * Math.sin(a)).toFixed(1) + 'A' + R + ',' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(b)).toFixed(1) + ',' + (cy + R * Math.sin(b)).toFixed(1) + 'Z" fill="' + c + '" stroke="#fff" stroke-width="1.5"><title>' + escHtml(it.labels[i] + ': ' + fmtCell(x)) + '</title></path>';
      a = b;
      if(i < 12) s += '<rect x="310" y="' + (20 + i * 22) + '" width="12" height="12" rx="2" fill="' + c + '"/><text x="330" y="' + (31 + i * 22) + '" fill="#333">' + escHtml(String(it.labels[i]).slice(0, 30) + ' — ' + fmtCell(r2(x, 1)) + ' (' + r2(x / tot * 100, 1) + '%)') + '</text>';
    });
    return s + '</svg>';
  }
  function dashHtml(it){
    var h = '<h1>' + escHtml(it.title) + '</h1><div style="display:flex;flex-wrap:wrap;gap:12px;margin:8px 0 16px">';
    it.tiles.forEach(function(t){
      var col = t.target ? (t.pct >= 100 ? '#16A34A' : (t.pct >= 90 ? '#D97706' : '#DC2626')) : '#111';
      h += '<div style="flex:1 1 180px;border:1px solid #ddd;border-radius:10px;padding:12px 14px;font-family:Arial"><div style="font-size:12px;color:#666">' + escHtml(t.title) + '</div><div style="font-size:24px;font-weight:700;margin-top:4px">' + escHtml(fmtCell(t.value)) + ' <span style="font-size:13px;font-weight:400;color:#666">' + escHtml(t.unit || '') + '</span></div>' +
        (t.target ? '<div style="font-size:12px;color:' + col + ';margin-top:2px">' + t.pct + '% от цели ' + escHtml(fmtCell(t.target)) + '</div>' : '') + '</div>';
    });
    h += '</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px">';
    it.charts.forEach(function(c){ h += '<div style="border:1px solid #eee;border-radius:10px;padding:8px 12px"><h2>' + escHtml(c.title) + '</h2>' + routeChartSvg(c) + '</div>'; });
    h += '</div>';
    it.tables.forEach(function(t){ h += '<h2>' + escHtml(t.title) + '</h2>' + tableHtml(t.rows.slice(0, 10)).replace('class="rt"', 'style="width:100%;font:12px Arial"'); });
    return h;
  }
