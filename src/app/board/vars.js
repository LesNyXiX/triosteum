  /* =====================================================================
     ПЕРЕМЕННЫЕ ПРОСТРАНСТВА И ПРОФИЛИ «ТЕСТ» / «БОЕВОЙ»
     Адреса, ставки, получатели отчётов — в одном месте, а не в коде каждого блока.
     У каждой переменной два значения: для профиля «Тест» и «Боевой»; профиль переключается
     одной кнопкой (отладили на тестовой базе — переключили на боевую).
     В коде любого языка: {{var:ИМЯ}} и {{secret:ИМЯ}} подставляются перед запуском.
     В Python ещё есть triosteum.var("ИМЯ") и triosteum.secret("ИМЯ").
     Переменные хранятся в пространстве (попадают в файл и копии), секреты — только в браузере
     (раздел «Секреты для блоков» в Персонализации). Значения секретов в журнале скрываются.
     ===================================================================== */
  var VAR_RX = /\{\{\s*(var|secret)\s*:\s*([A-Za-zА-Яа-яЁё0-9_.\-]+)\s*\}\}/g;
  var VAR_PROF = { test:'Тест', prod:'Боевой' };
  var VARS_RUN = { used:{}, miss:{} };

  function varsList(){ return Array.isArray(G.vars) ? G.vars : []; }
  function varProfile(){ return G.varProfile === 'prod' ? 'prod' : 'test'; }
  function varGet(name){
    var lo = String(name).toLowerCase(), v = varsList().filter(function(x){ return String(x.k).toLowerCase() === lo; })[0];
    if(!v) return undefined;
    var p = varProfile(), val = v[p];
    return val === undefined || val === null || val === '' ? (p === 'prod' ? undefined : v.prod) : val;   // в «Тесте» пусто — берём боевое
  }
  function varSecret(name){ return typeof secretGet === 'function' ? secretGet(name) : undefined; }
  // подстановка в код перед запуском; недостающие — пустая строка и предупреждение в журнал
  function varSubst(code){
    if(typeof code !== 'string' || code.indexOf('{{') < 0) return code;
    return code.replace(VAR_RX, function(m, kind, name){
      var v = kind === 'var' ? varGet(name) : varSecret(name);
      if(v === undefined){
        var key = kind + ':' + name;
        if(!VARS_RUN.miss[key]){ VARS_RUN.miss[key] = 1; varWarn(kind === 'var' ? 'Не задана переменная «' + name + '» для профиля «' + VAR_PROF[varProfile()] + '» — подставлена пустая строка' : 'Нет секрета «' + name + '» — добавьте его в Персонализации → «Секреты для блоков»'); }
        return '';
      }
      if(kind === 'secret') VARS_RUN.used[String(v)] = 1;
      return String(v);
    });
  }
  // Python на сервере: triosteum.var() и triosteum.secret() создаёт сам сервер (server/runner/harness.py) до выполнения
  // кода — так работают и чтения на уровне модуля, а код и номера строк не меняются. Передаём все переменные
  // активного профиля и только те секреты, что названы в коде.
  function varServerCtx(code){
    if(typeof code !== 'string' || !/\b(var|secret)\s*\(/.test(code)) return null;
    var vals = {}; varsList().forEach(function(x){ var v = varGet(x.k); if(v !== undefined) vals[x.k] = v; });
    var secs = {};
    code.replace(/\bsecret\(\s*["']([^"']+)["']/g, function(m, name){ var v = varSecret(name); if(v !== undefined){ secs[name] = String(v); VARS_RUN.used[String(v)] = 1; } else varWarn('Нет секрета «' + name + '» — добавьте его в Персонализации → «Секреты для блоков»'); return m; });
    return { vars:vals, secrets:secs };
  }
  function varWarn(t){ if(typeof CMP !== 'undefined' && CMP.busy) rlog('  ⚠ ' + t, 'warn'); else toast(t); }
  // значения секретов не должны попасть в журнал, вывод и историю запусков
  function varMask(t){
    if(typeof t !== 'string') return t;
    Object.keys(VARS_RUN.used).forEach(function(s){
      if(!s) return;
      // сам секрет и его вид внутри JSON (кавычки, \\, переводы строк экранированы) — результаты блоков сериализуются
      // многострочный секрет: вывод Python приходит по строкам — скрываем и каждую его строку
      var parts = [s, JSON.stringify(s).slice(1, -1)];
      if(/[\r\n]/.test(s)) s.split(/\r?\n|\r/).forEach(function(x){ if(x.trim()) parts.push(x); });
      parts.forEach(function(x, i){
        if(i === 1 && x === s) return;
        if(x.length >= 4){ t = t.split(x).join('••••••'); return; }
        // короткий секрет (PIN, код) — только отдельным значением, не внутри других чисел и слов
        t = t.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'gu'), '$1••••••');
      });
    });
    return t;
  }
  // копия значения с замаскированными строками — для показа результатов (данные на связях), исходные данные не меняем
  function varMaskDeep(v){
    if(!Object.keys(VARS_RUN.used).length || v === null || v === undefined) return v;
    if(typeof v === 'string') return varMask(v);
    if(typeof v !== 'object') return v;
    try { return JSON.parse(varMask(JSON.stringify(v))); } catch(e){ return v; }
  }

  // var() и secret() для Python в браузере: значения переменных — активного профиля, секреты — по запросу через js.__tSecret
  var SCHEME_MOD = 'sys.modules["triosteum"] = _mod';   // строка из assembleBackend (ai/backend-code.js)
  function varPyApi(){
    var vals = {}; varsList().forEach(function(x){ vals[x.k] = varGet(x.k); });
    return 'import json as _tj\n_t_vars = _tj.loads(' + JSON.stringify(JSON.stringify(vals)) + ')\n' +
      'def _t_var(name, default=None):\n    v = _t_vars.get(name)\n    return default if v is None else v\n' +
      'def _t_secret(name, default=None):\n    import js\n    v = js.__tSecret(name)\n    return default if v is None else v\n' +
      'for _m in ("triosteum", "yadro"):\n    if _m in sys.modules:\n        sys.modules[_m].var = _t_var\n        sys.modules[_m].secret = _t_secret\n';
  }

  (function(){
    var _norm = normGraph;   // переменные и профиль сохраняются вместе с пространством
    normGraph = function(o){ var g = _norm(o); if(o && Array.isArray(o.vars)) g.vars = JSON.parse(JSON.stringify(o.vars)); if(o && o.varProfile) g.varProfile = o.varProfile; return g; };
    var _sr = serverRun;
    serverRun = function(code, input, mode, extra){ code = varSubst(code); var c = varServerCtx(code); if(c){ extra = extra || {}; extra.vars = c.vars; extra.secrets = c.secrets; } return _sr(code, input, mode, extra); };
    var _rf = runForeign;
    runForeign = function(lang, code, input, opts){ return _rf(lang, varSubst(code), input, opts); };
    var _lp = loadPy;
    loadPy = function(logFn){
      return _lp(logFn).then(function(py){
        if(py && !py.__tvars){
          py.__tvars = true;
          var _run = py.runPython.bind(py);
          py.runPython = function(code, o){
            code = varSubst(code);
            if(typeof code === 'string' && code.indexOf('sys.modules[_m] = _mod') >= 0) code += '\n' + varPyApi();   // заглушка модуля triosteum — добавляем var() и secret()
            else if(typeof code === 'string' && code.indexOf(SCHEME_MOD) >= 0) code = code.replace(SCHEME_MOD, SCHEME_MOD + '\n' + varPyApi());   // целостный код схемы: свой модуль — API сразу после него
            return _run(code, o);
          };
        }
        return py;
      });
    };
    window.__tSecret = function(name){ var v = varSecret(name); if(v === undefined) { varWarn('Нет секрета «' + name + '» — добавьте его в Персонализации → «Секреты для блоков»'); return null; } VARS_RUN.used[String(v)] = 1; return String(v); };
    // секреты скрываем и в статусах блоков, вкладке «Ошибки», отчёте и запросе к ИИ (они идут через setRun → cmpMark)
    var _setRun = setRun;
    setRun = function(n, st, info){ return _setRun(n, st, varMask(info)); };
    var _mark = cmpMark;
    cmpMark = function(n, st, info){ return _mark(n, st, varMask(info)); };
    var _print = print;   // вывод редактора (stdout, результат и ошибки «Запустить код»)
    print = function(text, cls){ return _print(varMask(text), cls); };
    // история запусков: результаты блоков сохраняются в настройки пространства — маскируем до обрезки
    if(typeof rhShort === 'function'){
      var _rhs = rhShort;
      rhShort = function(v, max){ var t = varMask(_rhs(v, 1e9)); return t.length > max ? t.slice(0, max) + '…' : t; };
    }
    // данные на связях и результат блока в его настройках
    if(typeof dfView === 'function'){ var _dfv = dfView; dfView = function(v){ return _dfv(varMaskDeep(v)); }; }
    if(typeof dfKind === 'function'){ var _dfk = dfKind; dfKind = function(v){ return _dfk(varMaskDeep(v)); }; }
    // вывод по строкам (stdout/stderr сервера): маскируем целиком до разбиения
    if(typeof printLines === 'function'){ var _pl = printLines; printLines = function(text, fn, cls){ return _pl(varMask(String(text || '')), fn, cls); }; }
    // закреплённый результат сохраняется в пространстве (экспорт, сервер) — результат с секретом не закрепляем
    if(typeof pinNode === 'function'){
      var _pn = pinNode;
      pinNode = function(n, v){
        var j; try { j = JSON.stringify(v); } catch(e){ j = null; }
        if(j && varMask(j) !== j){ toast('Результат «' + n.name + '» содержит секрет — его нельзя закрепить: снимок сохраняется вместе с пространством'); return false; }
        return _pn(n, v);
      };
    }
    var _rlog = rlog;
    rlog = function(text, cls){ return _rlog(varMask(text), cls); };
    var _std = cmpStd;
    cmpStd = function(b, text, cls){ return _std(b, varMask(text), cls); };
    var _begin = cmpBegin;
    cmpBegin = function(){
      VARS_RUN.miss = {};
      var r = _begin.apply(this, arguments);
      if(varsList().length) rlog('Профиль переменных: «' + VAR_PROF[varProfile()] + '» · переменных: ' + varsList().length, 'dim');
      return r;
    };
  })();

  /* ---------- окно «Переменные пространства» ---------- */
  var varsWin = null;
  function openVars(){
    if(!varsWin){
      varsWin = h('section', { 'class':'pers vars-w', id:'varsW', role:'dialog', 'aria-label':'Переменные пространства' });
      varsWin.appendChild(h('div', { 'class':'pers-h' }, [ h('b', { text:'Переменные пространства' }),
        h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть', text:'✕', on:{ click:closeVars } }) ]));
      varsWin.appendChild(h('div', { 'class':'pers-b', id:'varsBody' }));
      document.body.appendChild(varsWin);
      varsWin.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); closeVars(); } });
    }
    varsWin.hidden = false; renderVars();
    var f = varsWin.querySelector('input'); if(f) f.focus();
  }
  function closeVars(){ if(varsWin) varsWin.hidden = true; }
  function varsSave(){ saveGraph(); varsBadge(); }
  function renderVars(){
    var b = $('varsBody'); if(!b) return; b.textContent = '';
    var p = varProfile();
    var seg = h('div', { 'class':'seg vars-prof', role:'radiogroup', 'aria-label':'Профиль переменных' }, Object.keys(VAR_PROF).map(function(k){
      return h('button', { type:'button', role:'radio', 'aria-checked':p === k ? 'true' : 'false', 'class':'btn sm' + (p === k ? ' primary' : ''), text:VAR_PROF[k],
        on:{ click:function(){ G.varProfile = k; varsSave(); renderVars(); toast('Профиль переменных: «' + VAR_PROF[k] + '»'); } } });
    }));
    b.appendChild(h('div', { 'class':'vars-top' }, [ h('span', { 'class':'flabel', text:'Профиль при запуске' }), seg ]));
    b.appendChild(h('p', { 'class':'sec-note', html:'В коде блока: <code>{{var:ИМЯ}}</code> — подставится значение активного профиля, <code>{{secret:ИМЯ}}</code> — секрет из Персонализации. ' +
      'В Python также <code>triosteum.var("ИМЯ")</code> и <code>triosteum.secret("ИМЯ")</code>. Пустое значение в «Тесте» берётся из «Боевого».' }));
    var tbl = h('table', { 'class':'vars-tbl' });
    tbl.appendChild(h('thead', null, [ h('tr', null, ['Имя', 'Тест', 'Боевой', ''].map(function(t){ return h('th', { scope:'col', text:t }); })) ]));
    var tb = h('tbody');
    varsList().forEach(function(v, i){
      function inp(f, lab){ var x = h('input', { type:'text', 'class':'input', 'aria-label':lab + ' — ' + (v.k || 'без имени'), spellcheck:'false' }); x.value = v[f] === undefined ? '' : v[f];
        x.addEventListener('change', function(){ var val = x.value; if(f === 'k'){ val = val.trim().replace(/\s+/g, '_'); if(!/^[A-Za-zА-Яа-яЁё0-9_.\-]+$/.test(val)){ toast('Имя: буквы, цифры, «_», «.» или «-»'); x.value = v.k; return; } if(varsList().some(function(o, j){ return j !== i && String(o.k).toLowerCase() === val.toLowerCase(); })){ toast('Переменная «' + val + '» уже есть'); x.value = v.k; return; } } v[f] = val; varsSave(); });
        return x; }
      tb.appendChild(h('tr', null, [ h('td', null, [ inp('k', 'Имя переменной') ]), h('td', null, [ inp('test', 'Значение для теста') ]), h('td', null, [ inp('prod', 'Боевое значение') ]),
        h('td', { 'class':'vars-act' }, [
          h('button', { type:'button', 'class':'icon-btn', title:'Скопировать вставку для кода', 'aria-label':'Скопировать {{var:' + v.k + '}}', text:'⧉', on:{ click:function(){ var t = '{{var:' + v.k + '}}'; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ toast('Скопировано: ' + t); }, function(){ toast(t); }); } } }),
          h('button', { type:'button', 'class':'icon-btn', title:'Удалить', 'aria-label':'Удалить переменную ' + v.k, text:'🗑', on:{ click:function(){ G.vars.splice(i, 1); varsSave(); renderVars(); } } })
        ]) ]));
    });
    if(!varsList().length) tb.appendChild(h('tr', null, [ h('td', { colspan:'4', 'class':'vars-empty', text:'Переменных пока нет. Например: АДРЕС_1С, СТАВКА_НДС, ПОЧТА_РУКОВОДИТЕЛЯ.' }) ]));
    tbl.appendChild(tb); b.appendChild(tbl);
    b.appendChild(h('button', { type:'button', 'class':'btn sm primary', text:'+ Добавить переменную', on:{ click:function(){
      if(!Array.isArray(G.vars)) G.vars = [];
      var n = 1; while(varsList().some(function(o){ return o.k === 'ПЕРЕМЕННАЯ_' + n; })) n++;
      G.vars.push({ k:'ПЕРЕМЕННАЯ_' + n, test:'', prod:'' }); varsSave(); renderVars();
      var rows = $('varsBody').querySelectorAll('tbody tr'), last = rows[rows.length - 1]; if(last){ var x = last.querySelector('input'); x.focus(); x.select(); }
    } } }));
    var used = varsUsage();
    if(used.missing.length) b.appendChild(h('p', { 'class':'vars-miss', text:'В коде блоков используются, но не заданы: ' + used.missing.join(', ') }));
  }
  // где используются переменные: подсказка о недостающих
  function varsUsage(){
    var names = {}, have = {}; varsList().forEach(function(v){ have[String(v.k).toLowerCase()] = 1; });
    G.nodes.forEach(function(n){ var c = nodeCode(n); if(typeof c !== 'string') return; c.replace(VAR_RX, function(m, kind, name){ if(kind === 'var') names[name] = 1; return m; });
      c.replace(/triosteum\.var\(\s*["']([^"']+)["']/g, function(m, name){ names[name] = 1; return m; }); });
    return { missing:Object.keys(names).filter(function(k){ return !have[k.toLowerCase()]; }) };
  }
  // метка профиля у кнопки запуска: «Боевой» должен быть заметен
  function varsBadge(){
    var b = $('topRun'); if(!b) return;
    var on = varsList().length && varProfile() === 'prod';
    b.classList.toggle('prof-prod', !!on);
    b.title = varsList().length ? 'Профиль переменных: «' + VAR_PROF[varProfile()] + '»' : '';
  }
  (function(){
    var _show = showProjName;
    showProjName = function(){ var r = _show.apply(this, arguments); varsBadge(); if(varsWin && !varsWin.hidden) renderVars(); return r; };
    var _cc = cmdCommands;
    cmdCommands = function(){
      var p = varProfile();
      return _cc().concat([
        { sec:'board', label:'Переменные пространства', d:'Адреса, ставки, получатели — с профилями «Тест» и «Боевой»', icon:'pers', act:openVars, k:'переменные настройки окружение var profile профиль тест боевой' },
        { sec:'board', label:'Профиль переменных: ' + (p === 'prod' ? 'переключить на «Тест»' : 'переключить на «Боевой»'), d:'Сейчас: «' + VAR_PROF[p] + '»', icon:'run', k:'профиль тест боевой prod test',
          act:function(){ G.varProfile = p === 'prod' ? 'test' : 'prod'; varsSave(); toast('Профиль переменных: «' + VAR_PROF[varProfile()] + '»'); } }
      ]);
    };
  })();
  varsBadge();
