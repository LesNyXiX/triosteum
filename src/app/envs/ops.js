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
  var GEN_OPS = [OP_CALC, OP_GROUP, OP_SORT, OP_ABC, OP_CHART];
  var GEN_COLORS = { calc:['#64748B', '#CBD5E1'], group:['#0891B2', '#67E8F9'], sort:['#475569', '#94A3B8'], abc:['#DB2777', '#F9A8D4'], chart:['#7C3AED', '#C4B5FD'] };

  /* ---------- диаграмма в окне результатов ---------- */
  function routeChartSvg(it){
    var v = it.values, L = it.labels, n = v.length; if(!n) return '<p>Нет данных для диаграммы.</p>';
    var max = Math.max.apply(0, v.concat([0])), min = Math.min.apply(0, v.concat([0])), span = (max - min) || 1;
    var W = 720, padL = 12, padB = 70, H = 300, top = 16, cw = (W - padL * 2) / n, y = function(x){ return top + (max - x) / span * (H - top - padB); };
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
