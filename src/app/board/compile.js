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
  // краткий вид результата для журнала и статуса: секреты скрываются до обрезки (иначе часть секрета останется)
  function cmpCut(t, max){ if(t === null || t === undefined) return t; t = String(t); if(typeof varMask === 'function') t = varMask(t); return t.length > max ? t.slice(0, max) + '…' : t; }
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
    var needPy = plan.order.some(function(n){ return n.lang === 'python' && !n.off && !n.pin; });   // выключенный и закреплённый Python среду не требуют
    var results = cmpSeed(), stat = { ok:0, err:0, skip:0 }, failed = {};
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
        var preds = plan.preds[n.id];
        var ins = preds.map(function(p){ return results[p]; }).filter(function(v){ return v !== undefined && v !== null; });
        var input = ins.length === 0 ? null : (ins.length === 1 ? ins[0] : ins);
        function done(){ if(d) d.classList.remove('running'); next(); }
        // выше по схеме упал блок без «продолжать при ошибке» — этот не запускаем
        var badUp = preds.filter(function(p){ return failed[p]; });
        if(badUp.length){
          var bn = nodeById(badUp[0]);
          rlog('⤼ ' + n.name + ' — пропущен: ошибка выше по схеме, в блоке «' + (bn ? bn.name : '?') + '»', 'warn'); results[n.id] = null; stat.skip++; failed[n.id] = true;
          setRun(n, 'skip', 'Пропущен: ошибка выше по схеме — «' + (bn ? bn.name : '?') + '». Включите у того блока «Продолжать схему при ошибке», чтобы запускать дальше.');
          done(); return;
        }
        // блок выключен — пропускаем, входные данные идут дальше без изменений
        if(n.off){
          rlog('⏸ ' + n.name + ' — выключен, данные проходят дальше без изменений', 'dim'); results[n.id] = input; stat.skip++;
          setRun(n, 'skip', 'Блок выключен — входные данные переданы дальше без изменений');
          done(); return;
        }
        // закреплённый результат — блок не выполняется (не дёргаем внешние системы при отладке)
        if(n.pin && n.kind !== 'hub'){
          var pj = JSON.stringify(n.pin.v); results[n.id] = pj === undefined ? null : JSON.parse(pj);   // копия: следующий блок (C# dynamic) не должен менять снимок
          rlog('📌 ' + n.name + ' — закреплённый результат' + (n.pin.t ? ' от ' + new Date(n.pin.t).toLocaleString('ru-RU') : '') + ': ' + cmpCut(pj, 160), 'ok'); stat.ok++;
          setRun(n, 'ok', 'Закреплённый результат — блок не выполнялся. ' + cmpCut(pj, 200));
          done(); return;
        }
        var tries = Math.max(0, Math.min(5, n.retry | 0)), attempt = 0;
        function fail(msg){
          if(attempt < tries){
            attempt++; rlog('  ↻ повтор ' + attempt + ' из ' + tries + ' — ' + msg, 'warn');
            setTimeout(go, Math.min(4000, 400 * Math.pow(2, attempt - 1)));   // пауза растёт: 0,4 с, 0,8 с, 1,6 с…
            return;
          }
          rlog('  ✗ ошибка: ' + msg + (tries ? ' (после ' + tries + ' ' + (tries === 1 ? 'повтора' : 'повторов') + ')' : ''), 'err'); stat.err++; results[n.id] = null;
          if(n.cont) rlog('  ↳ «Продолжать схему при ошибке» включено — следующие блоки получат пустой результат', 'dim');
          else failed[n.id] = true;
          setRun(n, 'err', 'Ошибка: ' + msg); done();
        }
        function ok(out, note){
          results[n.id] = out === undefined ? null : out; var oj = out === undefined || out === null ? null : JSON.stringify(out);
          rlog('  ✓ результат: ' + (oj ? cmpCut(oj, 160) : 'нет') + (note || '') + (attempt ? ' · с ' + (attempt + 1) + '-й попытки' : ''), 'ok'); stat.ok++;
          setRun(n, 'ok', 'Выполнен' + (attempt ? ' с ' + (attempt + 1) + '-й попытки' : '') + '. Результат: ' + (oj ? cmpCut(oj, 200) : 'нет'));
          done();
        }
        function go(){
          if(cmpStopped()){ done(); return; }
          if(n.lang === 'python' && RUN_SERVER){
            if(!attempt) rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — тестовые данные блока)' : ''));
            serverRun(nodeCode(n), input, 'block').then(function(r){
              printLines(r.stdout, function(t){ rlog('   ' + t); }); printLines(r.stderr, function(t){ rlog('   ' + t, 'err'); });
              if(r.ok) ok(r.output, ' · ' + r.ms + ' мс'); else fail(String(r.error));
            }, function(e){ fail(String(e && e.message || e)); });
            return;
          }
          try{
            if(n.lang === 'python' && py){
              if(!attempt) rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — тестовые данные блока)' : ''));
              py.setStdout({ batched:function(t){ rlog('   ' + t); } });
              py.setStderr({ batched:function(t){ rlog('   ' + t, 'err'); } });
              py.runPython(PY_STUB);
              py.runPython(nodeCode(n));
              py.globals.set('_inp_json', JSON.stringify(input));
              py.runPython(PY_RUN_BOARD);
              var oj = py.globals.get('_out_json');
              ok(oj ? JSON.parse(oj) : null);
            } else if(n.kind === 'hub'){
              rlog('▶ ' + n.name + ' — связующая точка: объединено входов: ' + ins.length, 'dim'); results[n.id] = input; stat.ok++; setRun(n, 'ok', 'Объединено входов: ' + ins.length); done();
            } else if(n.lang === 'html'){
              rlog('▶ ' + n.name + ' — HTML-виджет, отображается в предпросмотре', 'dim'); stat.ok++; setRun(n, 'ok', 'HTML-виджет — смотрите предпросмотр в редакторе'); done();
            } else if(FOREIGN_LANGS[n.lang]){
              if(!attempt) rlog('▶ ' + n.name + (input === null ? '  (входных данных нет — демо-данные блока)' : ''));
              var fr = runForeign(n.lang, nodeCode(n), input, { resultName:n.name });
              fr.stdout.forEach(function(t){ rlog('   ' + t); }); fr.notes.forEach(function(t){ rlog('   ℹ ' + t, 'dim'); });
              if(!fr.ok) throw new Error(fr.error);
              ok(fr.output);
            } else {
              rlog('▶ ' + n.name + ' — пропущен: для ' + shortName(l) + ' нет исполнителя', 'warn'); stat.skip++; setRun(n, 'skip', 'Пропущен: нет исполнителя'); done();
            }
          }catch(err){
            var msg = String(err && err.message || err).split('\n').filter(function(x){ return x.trim(); });
            fail(msg.slice(-1)[0]);
          }
        }
        setTimeout(go, 120);
      }
      function finish(stopped){
        running = false;
        if(!stopped) rlog('Готово.', stat.err ? 'warn' : 'ok');
        cmpEnd(results, stopped);
      }
      next();
    }, function(err){ running = false; rlog(err.message + '. Проверьте подключение к интернету.', 'err'); cmpEnd(null, false); });
  }
