  /* ---------- запуск ---------- */
  function print(text, cls){
    var span = document.createElement('span');
    if(cls) span.className = cls;
    span.textContent = text + '\n';
    el.out.appendChild(span);
    el.out.scrollTop = el.out.scrollHeight;
  }
  var pyodide = null, pyLoading = null;
  function loadPyFor(logFn){ return loadPy(logFn); }
  function loadPy(logFn){
    if(pyodide) return Promise.resolve(pyodide);
    if(pyLoading) return pyLoading;
    (logFn || print)('> Загружаю Python в браузер (один раз, около 10 секунд)…');
    pyLoading = new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
      s.onload = function(){ window.loadPyodide().then(function(p){ pyodide = p; res(p); }, rej); };
      s.onerror = function(){ pyLoading = null; rej(new Error('не удалось загрузить Python')); };
      document.head.appendChild(s);
    });
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
    print('> ' + l.tool);
    print('> Код сохранён (' + el.code.value.split('\n').length + ' строк). Запуск ' + l.name + ' появится, когда подключим серверный компилятор.');
  }
  $('runBtn').addEventListener('click', runCode);
  $('topRun').addEventListener('click', function(){
    if(officeOn()){ officeRun(); return; }
    if(S.view === 'editor'){ runCode(); return; }
    runBoard();
  });
