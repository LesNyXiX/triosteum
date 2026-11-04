  /* ---------- компиляция всей доски ---------- */
  popWin = makeWindow(el.pop, '.pop-head', 'pop', 'fixed', function(){ placePop(); });
  var modalWin = makeWindow(el.form, 'h2', 'create', 'shift');
  modalWin.apply();
  function boardOrder(){
    var preds = {}; G.nodes.forEach(function(n){ preds[n.id] = []; });
    function dep(a, b){ if(preds[b] && preds[a] && a !== b && preds[b].indexOf(a) < 0) preds[b].push(a); }
    G.edges.forEach(function(e){
      var chain = [[e.from]];
      sortedTaps(e).forEach(function(tp){ var g = tapIds(tp).filter(function(x){ return nodeById(x); }); if(g.length) chain.push(g); });
      chain.push([e.to]);
      for(var i = 0; i + 1 < chain.length; i++) chain[i].forEach(function(a){ chain[i + 1].forEach(function(b){ dep(a, b); }); });
    });
    var order = [], done = {}, left = G.nodes.slice();
    while(left.length){
      var ready = left.filter(function(n){ return preds[n.id].every(function(p){ return done[p]; }); });
      if(!ready.length) break;
      ready.sort(function(a, b){ return a.x - b.x || a.y - b.y; });
      ready.forEach(function(n){ order.push(n); done[n.id] = true; });
      left = left.filter(function(n){ return !done[n.id]; });
    }
    return { order:order, preds:preds, cyclic:left };
  }
  var running = false;
  var PY_RUN_BOARD = [
    'import json',
    '_out_json = None',
    'if _blocks:',
    '    _b = _blocks[-1]',
    '    _inp = json.loads(_inp_json)',
    '    if _inp is None:',
    '        _inp = _b._t_sample if _b._t_sample is not None else {"values": [120, 340, 95]}',
    '    _res = _b(_inp)',
    '    _out_json = json.dumps(_res, ensure_ascii=False, default=str)'
  ].join('\n');
  function runBoard(){
    // единый компилятор: если на доске есть блоки других сред (таблицы, документы, расчёты), вся схема идёт одним маршрутом
    if(isDocs() || G.nodes.some(function(n){ return n.kind !== 'hub' && !CODE_LANGS.some(function(l){ return l.id === n.lang; }); })) return runRoute();
    if(running) return;
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    if(!G.nodes.length){ cmpOpen(); runEl.out.textContent = ''; runEl.sum.textContent = ''; rlog('На доске нет блоков.', 'dim'); CMP.only = null; return; }
    clearRun();
    var plan = cmpPlan(boardOrder());
    cmpBegin(plan, 'Разработка');
    rlog('Порядок выполнения: ' + plan.order.map(function(n){ return n.name; }).join(' → '), 'dim');
    if(plan.cyclic.length) rlog('Пропущены из-за замкнутого круга связей: ' + plan.cyclic.map(function(n){ return n.name; }).join(', '), 'warn');
    var needPy = plan.order.some(function(n){ return n.lang === 'python'; });
    var results = cmpSeed(), stat = { ok:0, err:0, skip:0 };
    running = true;
    if(needPy && RUN_SERVER) rlog('Python выполняется на сервере', 'dim');
    (needPy && !RUN_SERVER ? loadPyFor(rlog) : Promise.resolve(null)).then(function(py){
      var i = 0;
      function next(){
        if(i >= plan.order.length){ finish(); return; }
        if(cmpStopped()){ finish(true); return; }
        var n = plan.order[i++], d = domOf('node', n.id), l = langById(n.lang);
        if(d) d.classList.add('running');
        cmpBlockStart(n);
        var ins = plan.preds[n.id].map(function(p){ return results[p]; }).filter(function(v){ return v !== undefined && v !== null; });
        var input = ins.length === 0 ? null : (ins.length === 1 ? ins[0] : ins);
        setTimeout(function(){
          if(n.lang === 'python' && RUN_SERVER){
            rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — тестовые данные блока)' : ''));
            serverRun(nodeCode(n), input, 'block').then(function(r){
              printLines(r.stdout, function(t){ rlog('   ' + t); }); printLines(r.stderr, function(t){ rlog('   ' + t, 'err'); });
              if(r.ok){
                var oj = r.output === undefined ? null : JSON.stringify(r.output);
                results[n.id] = r.output === undefined ? null : r.output;
                rlog('  ✓ результат: ' + (oj ? (oj.length > 160 ? oj.slice(0, 160) + '…' : oj) : 'нет') + ' · ' + r.ms + ' мс', 'ok'); stat.ok++;
                setRun(n, 'ok', 'Выполнен на сервере. Результат: ' + (oj ? (oj.length > 200 ? oj.slice(0, 200) + '…' : oj) : 'нет'));
              } else {
                rlog('  ✗ ошибка: ' + r.error, 'err'); stat.err++; results[n.id] = null; setRun(n, 'err', 'Ошибка: ' + r.error);
              }
              if(d) d.classList.remove('running');
              next();
            });
            return;
          }
          try{
            if(n.lang === 'python' && py){
              rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — тестовые данные блока)' : ''));
              py.setStdout({ batched:function(t){ rlog('   ' + t); } });
              py.setStderr({ batched:function(t){ rlog('   ' + t, 'err'); } });
              py.runPython(PY_STUB);
              py.runPython(nodeCode(n));
              py.globals.set('_inp_json', JSON.stringify(input));
              py.runPython(PY_RUN_BOARD);
              var oj = py.globals.get('_out_json');
              results[n.id] = oj ? JSON.parse(oj) : null;
              rlog('  ✓ результат: ' + (oj ? (oj.length > 160 ? oj.slice(0, 160) + '…' : oj) : 'нет'), 'ok'); stat.ok++;
              setRun(n, 'ok', 'Выполнен. Результат: ' + (oj ? (oj.length > 200 ? oj.slice(0, 200) + '…' : oj) : 'нет'));
            } else if(n.kind === 'hub'){
              rlog('▶ ' + n.name + ' — связующая точка: объединено входов: ' + ins.length, 'dim'); results[n.id] = input; stat.ok++; setRun(n, 'ok', 'Объединено входов: ' + ins.length);
            } else if(n.lang === 'html'){
              rlog('▶ ' + n.name + ' — HTML-виджет, отображается в предпросмотре', 'dim'); stat.ok++; setRun(n, 'ok', 'HTML-виджет — смотрите предпросмотр в редакторе');
            } else if(FOREIGN_LANGS[n.lang]){
              rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — демо-данные блока)' : ''));
              var fr = runForeign(n.lang, nodeCode(n), input, { resultName:n.name });
              fr.stdout.forEach(function(t){ rlog('   ' + t); }); fr.notes.forEach(function(t){ rlog('   ℹ ' + t, 'dim'); });
              if(!fr.ok) throw new Error(fr.error);
              results[n.id] = fr.output; var oj2 = JSON.stringify(fr.output);
              rlog('  ✓ результат: ' + (oj2 && oj2.length > 160 ? oj2.slice(0, 160) + '…' : oj2), 'ok'); stat.ok++; setRun(n, 'ok', 'Выполнен. Результат: ' + (oj2 && oj2.length > 200 ? oj2.slice(0, 200) + '…' : oj2));
            } else {
              rlog('▶ ' + n.name + ' — пропущен: для ' + shortName(l) + ' нет исполнителя', 'warn'); stat.skip++; setRun(n, 'skip', 'Пропущен: нет исполнителя');
            }
          }catch(err){
            var msg = String(err && err.message || err).split('\n').filter(function(x){ return x.trim(); });
            rlog('  ✗ ошибка: ' + msg.slice(-1)[0], 'err'); stat.err++; results[n.id] = null; setRun(n, 'err', 'Ошибка: ' + msg.slice(-1)[0]);
          }
          if(d) d.classList.remove('running');
          next();
        }, 120);
      }
      function finish(stopped){
        running = false;
        if(!stopped) rlog('Готово.', stat.err ? 'warn' : 'ok');
        cmpEnd(results, stopped);
      }
      next();
    }, function(err){ running = false; rlog(err.message + '. Проверьте подключение к интернету.', 'err'); cmpEnd(null, false); });
  }
