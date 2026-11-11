  /* =====================================================================
     ЗАПУСК БЛОКОВ C++, C# И 1С: вход блока → аргументы функции,
     результат → записи для следующих блоков. Без входа — демо-данные.
     ===================================================================== */
  // синонимы полей: блок на английском читает данные с русскими заголовками и наоборот
  var FIELD_SYN = [
    ['id', 'номер', 'код', 'заказ', 'артикул', 'number', 'no'], ['name', 'наименование', 'название', 'статья', 'имя', 'номенклатура', 'материал', 'title'],
    ['revenue', 'выручка', 'доход', 'сумма', 'суммадокумента', 'amount', 'sales'], ['cost', 'себестоимость', 'затраты', 'расход', 'costs'],
    ['plan', 'план', 'плановое', 'бюджет'], ['fact', 'факт', 'фактическое', 'actual'], ['qty', 'количество', 'кол', 'колво', 'quantity', 'count', 'остаток', 'вналичии'],
    ['price', 'цена', 'стоимость'], ['value', 'значение', 'показатель', 'величина'], ['date', 'дата', 'период', 'day'], ['client', 'клиент', 'контрагент', 'покупатель', 'customer'],
    ['warehouse', 'склад', 'stock'], ['status', 'статус', 'состояние'], ['total', 'итого', 'всего'], ['margin', 'маржа'], ['marginpct', 'маржапроцент', 'маржа%', 'margin_pct'],
    ['planned_min', 'плановоевремя', 'планмин'], ['run_min', 'работа', 'работамин', 'фактвремя'], ['ideal_rate', 'норма', 'нормавыработки'], ['produced', 'выпущено', 'выпуск'], ['good', 'годных', 'годные'],
    ['signal', 'сигнал', 'ряд', 'series', 'values', 'значения'], ['window', 'окно', 'период'], ['threshold_pct', 'порог', 'thresholdpct', 'threshold']
  ];
  function fieldSyn(n){
    var lo = String(n).toLowerCase().replace(/[\s_]/g, ''), out = [];
    FIELD_SYN.forEach(function(g){ var hit = g.some(function(x){ return x.replace(/[\s_]/g, '') === lo; }); if(hit) g.forEach(function(x){ if(out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  // демо-данные для запуска без входа (кнопка «Запустить» в редакторе)
  function demoRows1c(){
    return {
      rows:[{ Заказ:'З-1047', Выручка:12800000, Себестоимость:11570000 }, { Заказ:'З-1050', Выручка:3900000, Себестоимость:2913000 }, { Заказ:'З-1052', Выручка:7400000, Себестоимость:6505000 }],
      props:{
        ЗаказКлиента:[{ Номер:'З-1047', Дата:'03.11.2026', Контрагент:'ООО «СтальПром»', СуммаДокумента:12800000, Проведен:true, Статус:'КВыполнению' },
          { Номер:'З-1050', Дата:'05.11.2026', Контрагент:'АО «ТехМаш»', СуммаДокумента:3900000, Проведен:true, Статус:'КВыполнению' },
          { Номер:'З-1051', Дата:'06.11.2026', Контрагент:'ООО «ЛогистикПлюс»', СуммаДокумента:1380000, Проведен:false, Статус:'КВыполнению' },
          { Номер:'З-1052', Дата:'10.11.2026', Контрагент:'ООО «ЭнергоРесурс»', СуммаДокумента:7400000, Проведен:true, Статус:'Закрыт' }],
        ТоварыНаСкладах:[{ Номенклатура:'Лист г/к 4 мм', Склад:'Основной', ВНаличии:42.5 }, { Номенклатура:'Подшипник 6205', Склад:'Основной', ВНаличии:1200 }, { Номенклатура:'Электроды МР-3', Склад:'Цех 2', ВНаличии:0 }, { Номенклатура:'Лист г/к 4 мм', Склад:'Цех 2', ВНаличии:8 }],
        Товары:[{ Номенклатура:'Лист г/к 4 мм', Количество:3.2, Проведен:true, Заказ:'З-1047' }, { Номенклатура:'Электроды МР-3', Количество:0.4, Проведен:true, Заказ:'З-1047' }, { Номенклатура:'Лист г/к 4 мм', Количество:1.1, Проведен:true, Заказ:'З-1047' }, { Номенклатура:'Подшипник 6205', Количество:40, Проведен:true, Заказ:'З-1050' }],
        Статьи:[{ Статья:'Металл', План:6.2, Факт:7.07 }, { Статья:'Работа', План:2.38, Факт:2.53 }, { Статья:'Энергия', План:0.38, Факт:0.40 }],
        Ряд:[24.1, 23.8, 23.5, 22.9, 23.5, 21.4], Окно:3, Порог:5, Дата:'30.11.2026', Заказ:'З-1047'
      }
    };
  }
  var DEMO_SERIES = [12, 15, 11, 18, 20, 17, 21];
  function sampleNum(name, i){
    var n = String(name || '').toLowerCase();
    var M = { planned_min:480, run_min:420, ideal_rate:2, produced:800, good:768, revenue:1280000, cost:1157000, plan:100, fact:108, qty:12, price:250, threshold:5, window:3 };
    for(var k in M) if(n.indexOf(k) >= 0) return M[k] * (1 + (i || 0) * 0.13);
    return Math.round(100 * (1 + (i || 0) * 0.37));
  }
  function cfSample(t, vm, i, name){
    if(!t) return null;
    var n = t.name;
    if(/^(vector|List|IEnumerable|IList|array|IReadOnlyList|ICollection)$/.test(n)){ var el = t.args[0]; if(el && /^(double|float|decimal|int|long)$/.test(el.name)) return DEMO_SERIES.slice(); if(!el || /^(Dictionary|IDictionary|IReadOnlyDictionary|object|dynamic|Data|map|unordered_map|JsonObject|ExpandoObject)$/.test(el.name)) return demoRows1c().rows; var out = []; for(var j = 0; j < 3; j++) out.push(cfSample(el, vm, j)); return out; }
    if(vm.types[n] && vm.types[n].k === 'type'){ var td = vm.types[n], o = {}; td.fields.forEach(function(f, k){ o[f.name] = cfSample(f.type, vm, (i || 0) + k * 0.1, f.name); }); if(td.fields.some(function(f){ return /^(id|Id|name|Name)$/.test(f.name); })){} return o; }
    if(/^(string|String)$/.test(n)) return /id/i.test(name || '') ? 'З-' + (1047 + (i | 0)) : ['Металл', 'Работа', 'Энергия', 'Накладные'][(i | 0) % 4];
    if(/^(double|float|decimal|int|long|size_t|short|unsigned)/.test(n)) return Math.round(sampleNum(name, i) * 100) / 100;
    if(n === 'bool') return true;
    if(/^(Data|dynamic|object|auto)$/.test(n)) return demoRows1c().rows;
    return null;
  }
  // аргумент функции из входных данных блока
  function cfBind(t, v, vm){
    if(!t) return v;
    var n = t.name;
    if(/^(vector|List|IEnumerable|IList|array|IReadOnlyList|ICollection)$/.test(n)){
      var el = t.args[0], arr = Array.isArray(v) ? v : (v && typeof v === 'object' ? (function(){ for(var k in v) if(Array.isArray(v[k])) return v[k]; return [v]; })() : [v]);
      if(el && /^(double|float|decimal|int|long|size_t)$/.test(el.name)) return arr.map(function(x){ if(typeof x === 'number') return x; if(x && typeof x === 'object'){ for(var k in x){ var nv = typeof x[k] === 'number' ? x[k] : parseFloat(String(x[k]).replace(/\s/g, '').replace(',', '.')); if(typeof x[k] !== 'boolean' && !isNaN(nv) && k.indexOf('__') !== 0) return nv; } } return parseFloat(x) || 0; });
      return arr.map(function(x){ return cfBind(el, x, vm); });
    }
    if(vm.types[n] && vm.types[n].k === 'type' && v && typeof v === 'object' && !Array.isArray(v)){
      var td = vm.types[n], o = new CfObj(n);
      td.fields.forEach(function(f){ var k = cfFindKey(v, f.name), raw = k !== null ? v[k] : undefined; o[f.name] = raw === undefined ? vm.defVal(f.type) : (/^(double|float|decimal|int|long|size_t)$/.test(f.type.name) && typeof raw !== 'number' ? (parseFloat(String(raw).replace(/\s/g, '').replace(',', '.')) || 0) : raw); });
      return o;
    }
    if(/^(double|float|decimal|int|long)$/.test(n) && typeof v !== 'number'){ if(v && typeof v === 'object' && !Array.isArray(v)){ for(var k2 in v) if(typeof v[k2] === 'number') return v[k2]; } return parseFloat(v) || 0; }
    return v;
  }
  /* ---------- секреты блоков: ключи и пароли хранит только этот браузер ---------- */
  var SECRET_KEY = 'triosteum.secrets';
  function secretStores(){ var o = {}; try { o.s = window.sessionStorage; } catch(e){} try { o.l = window.localStorage; } catch(e){} return o; }
  function secretRead(st){ try { return st ? JSON.parse(st.getItem(SECRET_KEY) || '{}') || {} : {}; } catch(e){ return {}; } }
  function secretAll(){ var st = secretStores(), l = secretRead(st.l), s = secretRead(st.s), out = {}; Object.keys(l).forEach(function(k){ out[k] = { v:l[k], kept:true }; }); Object.keys(s).forEach(function(k){ out[k] = { v:s[k], kept:!!l[k] }; }); return out; }
  function secretGet(name){ var all = secretAll(); if(all[name]) return all[name].v; var lo = String(name).toLowerCase(); for(var k in all) if(k.toLowerCase() === lo) return all[k].v; return undefined; }
  function secretSet(name, val, keep){ var st = secretStores(); [['s', true], ['l', keep]].forEach(function(x){ var store = st[x[0]]; if(!store) return; var m = secretRead(store); if(x[1] && val !== null) m[name] = val; else delete m[name]; try { store.setItem(SECRET_KEY, JSON.stringify(m)); } catch(e){} }); }
  /* ---------- окружение C#: Data, секреты, сеть, Excel с рабочего стола ---------- */
  function csIO(){
    var XL = function(f, idx){ var vals = sheetValues(f, idx); return vals; };
    var cellObj = function(v){ return { __t:'XLCell', v:v, GetString:function(){ return v === null || v === undefined ? '' : String(v); }, GetDouble:function(){ return typeof v === 'number' ? v : parseFloat(v) || 0; }, Value:v }; };
    var rowObj = function(vals, r){ var row = vals[r] || []; return { __t:'XLRow', RowNumber:function(){ return r + 1; }, Cell:function(c){ return cellObj(row[(typeof c === 'number' ? c : 1) - 1]); }, CellsUsed:function(){ return row.filter(function(x){ return x !== '' && x !== null && x !== undefined; }).map(cellObj); } }; };
    return {
      global:function(n){ if(/^(Data|Secrets|Triosteum|IBlock|Block|XLWorkbook|HttpClient|Task|File|Path|Encoding|JsonSerializer)$/.test(n)) return { __type:n }; },
      staticCall:function(cls, n, a, vm){
        if(cls === 'Data'){ if(n === 'From' || n === 'Of') return a[0]; if(n === 'Empty') return {}; }
        if(cls === 'Secrets' && /^(Get|get|GetOrDefault|TryGet)$/.test(n)){ var sv = secretGet(a[0]); if(sv !== undefined) return sv; if(n === 'GetOrDefault') return a.length > 1 ? a[1] : null; throw CfErr('Секрет «' + a[0] + '» не задан. Добавьте его: Настройки (шестерёнка) → Секреты для блоков'); }
        if(cls === 'Secrets' && /^(Has|Contains)$/.test(n)) return secretGet(a[0]) !== undefined;
        if(cls === 'Task'){ if(n === 'FromResult') return a[0]; if(n === 'Delay' || n === 'WhenAll') return null; }
        if(cls === 'JsonSerializer'){ if(n === 'Serialize') return JSON.stringify(cfToJson(a[0])); if(n === 'Deserialize') return JSON.parse(a[0]); }
      },
      staticMember:function(cls, n){ if(cls === 'Task' && n === 'CompletedTask') return null; },
      newObj:function(n, a, vm){
        if(n === 'HttpClient') return { __t:'HttpClient' };
        if(n === 'FormUrlEncodedContent' || n === 'StringContent') return { __t:'Content', body:a[0] instanceof CfMap ? a[0].pairs().map(function(p){ return encodeURIComponent(p.k) + '=' + encodeURIComponent(p.v); }).join('&') : String(a[0]), type:n === 'StringContent' ? (a[2] || 'text/plain') : 'application/x-www-form-urlencoded' };
        if(n === 'XLWorkbook'){
          var nm = String(a[0] || '').replace(/^.*[\\\/]/, '').replace(/\.(xlsx|xls|csv)$/i, ''), f = typeof ofByName === 'function' ? ofByName(nm, 'sheet') : null;
          if(!f) throw CfErr('Таблица «' + nm + '» не найдена на рабочем столе Triosteum — откройте или импортируйте её как файл «Таблица»');
          return { __t:'XLWorkbook', Worksheet:function(i){ var idx = typeof i === 'number' ? i - 1 : f.data.sheets.map(function(s){ return s.name; }).indexOf(i); var vals = XL(f, Math.max(0, idx)); return { __t:'XLSheet', Row:function(r){ return rowObj(vals, r - 1); }, RowsUsed:function(){ var out = []; vals.forEach(function(row, r){ if(row.some(function(x){ return x !== '' && x !== null && x !== undefined; })) out.push(rowObj(vals, r)); }); return out; }, Cell:function(r, c){ return cellObj((vals[r - 1] || [])[c - 1]); } }; }, Dispose:function(){} };
        }
        if(n === 'SmtpClient' || n === 'MailMessage' || n === 'NetworkCredential') return { __t:n, Send:function(){ throw CfErr('Отправка почты из браузера невозможна — почту отправляет сервер Triosteum (SMTP)'); } };
      },
      method:function(o, n, a, vm, f){
        if(o && o.__t === 'HttpClient' && /^(GetStringAsync|GetAsync|PostAsync|PutAsync|DeleteAsync)$/.test(n)){
          var xhr = new XMLHttpRequest(), method = /^Post/.test(n) ? 'POST' : /^Put/.test(n) ? 'PUT' : /^Delete/.test(n) ? 'DELETE' : 'GET';
          try { xhr.open(method, String(a[0]), false); if(a[1] && a[1].type) xhr.setRequestHeader('Content-Type', a[1].type); xhr.send(a[1] ? a[1].body : null); }
          catch(e){ throw CfErr('Запрос к ' + String(a[0]).replace(/^(https?:\/\/[^\/]+).*/, '$1') + ' из браузера не выполнен (сайт не разрешает запросы из браузера). Такой блок выполняйте на сервере Triosteum'); }
          if(n === 'GetStringAsync') return xhr.responseText;
          return { __t:'HttpResponse', StatusCode:xhr.status, IsSuccessStatusCode:xhr.status >= 200 && xhr.status < 300, Content:{ __t:'HttpContent', ReadAsStringAsync:function(){ return xhr.responseText; } }, EnsureSuccessStatusCode:function(){ if(xhr.status >= 300) throw CfErr('HTTP ' + xhr.status); } };
        }
        if(o && o.__t === 'XLWorkbook' && n === 'Worksheet') return o.Worksheet(a[0]);
        if(o && o.__t && typeof o[n] === 'function') return o[n].apply(o, a);
        // Data: input.Get<T>("ключ") и input.Set("ключ", значение)
        if(o && typeof o === 'object' && !o.__t && !(o instanceof CfMap) && /^(Get|get|GetValue|Value)$/.test(n) && typeof a[0] === 'string'){
          var key = cfFindKey(o, a[0]), v = key !== null ? o[key] : undefined, T = f && f.targs && f.targs[0] && f.targs[0].name;
          if(v === undefined) throw CfErr('Во входных данных нет поля «' + a[0] + '»', f && f.line);
          if(T && /^(double|decimal|float|int|long)$/.test(T)) return typeof v === 'number' ? v : (parseFloat(String(v).replace(/\s/g, '').replace(',', '.')) || 0);
          if(T === 'string') return v == null ? '' : String(v);
          return v;
        }
        if(o && typeof o === 'object' && !o.__t && !(o instanceof CfMap) && !Array.isArray(o) && /^(Set|set)$/.test(n)){ o[a[0]] = a[1]; return o; }
        if(o && typeof o === 'object' && !o.__t && !(o instanceof CfMap) && !Array.isArray(o) && /^(Has|Contains|ContainsKey)$/.test(n) && !Array.isArray(o)) return cfFindKey(o, a[0]) !== null;
        if(o && o.__t === 'HttpContent' && n === 'ReadAsStringAsync') return o.ReadAsStringAsync();
      },
      member:function(o, n){ if(o && o.__t === 'HttpResponse' && n in o) return o[n]; }
    };
  }
  /* ---------- общий запуск ---------- */
  function runForeign(lang, code, input, opts){
    opts = opts || {};
    var res = { ok:false, output:null, stdout:[], notes:[], error:null, demo:input === null || input === undefined }, live = null;
    try {
      if(lang === '1c'){
        var mod = new BslParser(code).module(), data;
        if(res.demo){ var d = demoRows1c(), t = bslFromJson(d.rows); Object.keys(d.props).forEach(function(k){ t.props.set(k, bslFromJson(d.props[k])); }); data = t; }
        else { data = bslFromJson(input); if(Array.isArray(input) && !(data instanceof BTable)){ var t0 = new BTable(); data = t0; } if(data instanceof BStruct){ var tt = new BTable(); tt.props = data; data = tt; } }
        var vm = new BslVM(mod, { input:data }); live = { bsl:vm };
        var entry = mod.procs['выполнить'] || mod.procs['execute'] || mod.procs['run'] || mod.procs['обработать'];
        var out;
        if(entry) out = vm.callProc(entry, [data]); else { var sc = new Map(); sc.set('входныеданные', data); try { vm.block(mod.body, sc); } catch(e){ if(!(e instanceof BslRet)) throw e; out = e.v; } }
        res.output = bslToJson(out); res.stdout = vm.out; res.notes = vm.notes; res.ok = true;
        return res;
      }
      if(lang === 'cpp' || lang === 'csharp'){
        var P = new CfParser(code, lang), prog = P.program(), cvm = new CfVM(prog, lang, lang === 'csharp' ? csIO() : { global:function(n){ if(n === 'Data') return { __type:'Data' }; }, method:csIO().method }); live = { cf:cvm };
        var fn = null, self = null, td = null;
        if(lang === 'csharp'){
          Object.keys(cvm.types).some(function(k){ var x = cvm.types[k]; if(x.k === 'type' && x.methods && (x.methods.Run || x.methods.Execute)){ td = x; fn = x.methods.Run || x.methods.Execute; return true; } return false; });
          if(!fn) Object.keys(cvm.types).some(function(k){ var x = cvm.types[k]; if(x.k === 'type' && x.methods && x.methods.Main){ td = x; fn = x.methods.Main; return true; } return false; });
          if(!fn) throw CfErr('Не найден метод Run(…) — блок C# должен содержать класс с методом Run');
          if(!fn.static) self = cvm.construct(td, [], null, { vars:new Map(), up:{ vars:cvm.globals, up:null } });
        } else {
          var f0 = cvm.funcs.run || cvm.funcs.Run || cvm.funcs.main; if(!f0) throw CfErr('Не найдена функция run(…) — блок C++ должен содержать функцию run');
          fn = f0.filter(function(x){ return x.body; })[0];
        }
        var p0 = fn.params[0], perRow = false;
        var arg0 = null;
        if(p0){
          if(res.demo) arg0 = cfSample(p0.type, cvm, 0, p0.name);
          else {
            var isStruct = cvm.types[p0.type.name] && cvm.types[p0.type.name].k === 'type';
            if(isStruct && Array.isArray(input)) perRow = true;
            else arg0 = cfBind(p0.type, input, cvm);
          }
        }
        cvm.curFunc = fn;
        var call = function(a0){ return fn.name === 'Main' ? cvm.callFunc(fn, [[]], self, td) : cvm.callFunc(fn, p0 ? [a0] : [], self, td); };
        var outv;
        if(perRow){
          outv = input.map(function(row){ var r = call(cfBind(p0.type, row, cvm)), js = cfToJson(r), o = {}; for(var k in row) if(k.indexOf('__') !== 0) o[k] = row[k]; if(js && typeof js === 'object' && !Array.isArray(js)){ for(var k2 in js) o[k2] = js[k2]; } else o[opts.resultName || 'Результат'] = js; return o; });
        } else outv = cfToJson(call(arg0));
        res.output = outv; res.stdout = cvm.out.join('').split('\n').filter(function(x, i, a){ return x !== '' || i < a.length - 1; }); res.ok = true;
        return res;
      }
      throw new Error('Язык «' + lang + '» не поддерживается встроенным исполнителем');
    } catch(e){
      if(live && live.bsl){ res.stdout = live.bsl.out; res.notes = live.bsl.notes; }
      if(live && live.cf) res.stdout = live.cf.out.join('').split('\n').filter(function(x, i, a){ return x !== '' || i < a.length - 1; });
      if(e instanceof CfRet || e instanceof BslRet){ res.ok = true; res.output = cfToJson(e.v); return res; }
      res.error = String(e && e.message || e).replace(/^Error:\s*/, '');
      if(!e.cf && !e.bsl && !/строка/.test(res.error)) res.error = 'Ошибка исполнителя: ' + res.error;
      return res;
    }
  }
  var FOREIGN_LANGS = { cpp:1, csharp:1, '1c':1 };
  function foreignLabel(lang){ return lang === 'cpp' ? 'C++' : lang === 'csharp' ? 'C#' : '1С'; }
  function fmtOut(v){ var s = JSON.stringify(v); if(s && typeof varMask === 'function') s = varMask(s); return s && s.length > 200 ? s.slice(0, 200) + '…' : s; }   // секреты — до обрезки
