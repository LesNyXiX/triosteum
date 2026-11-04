  /* ---------- запуск ---------- */
  function print(text, cls){
    var span = document.createElement('span');
    if(cls) span.className = cls;
    span.textContent = text + '\n';
    el.out.appendChild(span);
    el.out.scrollTop = el.out.scrollHeight;
  }
  // Python на сервере Triosteum (песочница), если сервер его поддерживает; иначе — Pyodide в браузере
  var RUN_SERVER = !!(SERVER && window.TRIOSTEUM_BOOT.runner && window.TRIOSTEUM_BOOT.runner.enabled);
  function serverRun(code, input, mode){
    return SERVER.api('POST', '/run/python', { code:code, input:input === undefined ? null : input, mode:mode || 'block' }).then(function(r){
      if(r.status !== 200) return { ok:false, stdout:'', stderr:'', error:(r.data && r.data.detail) || ('ошибка ' + r.status) };
      return r.data;
    }, function(){ return { ok:false, stdout:'', stderr:'', error:'нет связи с сервером' }; });
  }
  function printLines(text, fn, cls){ String(text || '').replace(/\n+$/, '').split('\n').forEach(function(t){ if(t) fn(t, cls); }); }
  var pyodide = null, pyLoading = null;
  function loadPyFor(logFn){ return loadPy(logFn); }
  function loadPy(logFn){
    if(pyodide) return Promise.resolve(pyodide);
    if(pyLoading) return pyLoading;
    (logFn || print)('> Загружаю Python в браузер (один раз, около 10 секунд)…');
    // сначала локальная копия рядом с приложением (работает без CDN), затем jsdelivr
    var SOURCES = [{ js:'vendor/pyodide/pyodide.js', index:'vendor/pyodide/' }, { js:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js', index:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' }];
    if(location.protocol === 'file:') SOURCES.shift();
    function tryFrom(k){
      return new Promise(function(res, rej){
        if(k >= SOURCES.length){ rej(new Error('не удалось загрузить Python (нет ни локальной копии, ни доступа к CDN)')); return; }
        var src = SOURCES[k], go = function(){ window.loadPyodide({ indexURL:src.index }).then(res, function(){ tryFrom(k + 1).then(res, rej); }); };
        if(window.loadPyodide){ go(); return; }
        var s = document.createElement('script');
        s.src = src.js;
        s.onload = go;
        s.onerror = function(){ s.remove(); tryFrom(k + 1).then(res, rej); };
        document.head.appendChild(s);
      });
    }
    pyLoading = tryFrom(0).then(function(p){ pyodide = p; return p; }, function(err){ pyLoading = null; throw err; });
    return pyLoading;
  }
  var PY_STUB = [
    'import sys, types',
    '_blocks = []',
    'def block(name="Блок", sample=None, **kw):',
    '    def deco(fn):',
    '        fn._t_name = name',
    '        fn._t_sample = sample',
    '        _blocks.append(fn)',
    '        return fn',
    '    return deco',
    'for _m in ("triosteum", "yadro"):',
    '    _mod = types.ModuleType(_m)',
    '    _mod.block = block',
    '    sys.modules[_m] = _mod'
  ].join('\n');
  var PY_RUN = [
    'import json',
    'if _blocks:',
    '    _b = _blocks[-1]',
    '    _sample = _b._t_sample if _b._t_sample is not None else {"values": [120, 340, 95]}',
    '    print("▶ Блок «" + _b._t_name + "»: запуск на тестовых данных")',
    '    _res = _b(_sample)',
    '    print("◀ Результат:", json.dumps(_res, ensure_ascii=False, default=str))'
  ].join('\n');
  function runCode(){
    var l = cur();
    el.out.textContent = '';
    var pane = paneFor();
    if(pane === 'doc'){ docPreview(); return; }
    if(pane === 'sheet'){ refreshVals(); sheetInfo(); return; }
    if(isDocs() && isParamKind(l.id)){ try{ JSON.parse(el.code.value); print('> Параметры записаны верно.', 'ok'); }catch(err){ print('> Ошибка в параметрах: ' + err.message, 'err'); } return; }
    if(l.id === 'html'){ updatePreview(true); print('> Предпросмотр обновлён.', 'ok'); return; }
    if(l.id === 'python' && RUN_SERVER){
      print('> Запуск на сервере…', 'dim');
      serverRun(el.code.value, null, 'block').then(function(r){
        printLines(r.stdout, print); printLines(r.stderr, print, 'err');
        if(r.ok){
          if(r.block) print('◀ Результат блока «' + r.block + '»: ' + JSON.stringify(r.output));
          print('> Выполнено без ошибок за ' + r.ms + ' мс.', 'ok');
        } else { print('> Ошибка:', 'err'); print(r.error, 'err'); }
      });
      return;
    }
    if(l.id === 'python'){
      var src = el.code.value;
      loadPy().then(function(py){
        py.setStdout({ batched:function(t){ print(t); } });
        py.setStderr({ batched:function(t){ print(t, 'err'); } });
        py.runPython(PY_STUB);
        try{ py.runPython(src); py.runPython(PY_RUN); print('> Выполнено без ошибок.', 'ok'); }
        catch(err){
          var msg = String(err && err.message || err).split('\n').filter(function(x){ return x.trim(); });
          print('> Ошибка:', 'err'); print(msg.slice(-3).join('\n'), 'err');
        }
      }, function(err){ print('> ' + err.message + '. Проверьте подключение к интернету.', 'err'); });
      return;
    }
    if(FOREIGN_LANGS[l.id]){
      print('> ' + foreignLabel(l.id) + ': встроенный исполнитель Triosteum, запуск на демо-данных…', 'dim');
      var r = runForeign(l.id, el.code.value, null);
      r.stdout.forEach(function(t){ print(t); });
      r.notes.forEach(function(t){ print('  ℹ ' + t, 'dim'); });
      if(r.ok){ print('◀ Результат: ' + fmtOut(r.output)); print('> Выполнено без ошибок.', 'ok'); }
      else { print('> Ошибка:', 'err'); print(r.error, 'err'); }
      return;
    }
    print('> ' + l.tool);
    print('> Код сохранён (' + el.code.value.split('\n').length + ' строк).');
  }
  $('runBtn').addEventListener('click', runCode);
  $('topRun').addEventListener('click', function(){
    if(officeOn()){ officeRun(); return; }
    if(S.view === 'editor'){ runCode(); return; }
    runBoard();
  });
