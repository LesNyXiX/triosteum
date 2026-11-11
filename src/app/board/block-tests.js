  /* Тест-кейсы сохраняются в узле, результаты проверок живут только до изменения кода или кейсов. */
  var BT = { busy:false, node:null, drafts:[], results:{}, back:null };
  function btRunnable(n){ return n && n.kind !== 'hub' && (n.lang === 'python' || !!FOREIGN_LANGS[n.lang]); }
  function btCases(n){ return Array.isArray(n.tests) ? n.tests : []; }
  function btSignature(n){ return JSON.stringify([n.lang, nodeCode(n), btCases(n)]); }
  function btBadges(){
    Array.prototype.forEach.call(el.nodes.querySelectorAll('.bt-badge'), function(b){ b.remove(); });
    G.nodes.forEach(function(n){
      var r = BT.results[n.id], d = domOf('node', n.id);
      if(!d || !r || r.node !== n || r.space !== curId() || r.signature !== btSignature(n) || !r.items.length) return;
      var ok = r.items.every(function(x){ return x.ok; });
      d.appendChild(h('span', { 'class':'bt-badge ' + (ok ? 'bt-pass' : 'bt-fail'), text:ok ? '✓' : '✗', role:'img', 'aria-label':ok ? 'Все тесты блока прошли' : 'Есть ошибки в тестах блока', title:ok ? 'Все тесты блока прошли' : 'Есть ошибки в тестах блока' }));
    });
  }
  var btLayer = h('div', { 'class':'bt-layer', hidden:'' });
  var btDialog = h('div', { 'class':'bt-dialog', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'btTitle' });
  btLayer.appendChild(btDialog); document.body.appendChild(btLayer);
  function btClose(){ btLayer.hidden = true; if(BT.back && document.contains(BT.back)) BT.back.focus(); }
  btDialog.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); btClose(); }
    if(e.key !== 'Tab') return;
    var items = Array.prototype.filter.call(btDialog.querySelectorAll('button,input,textarea,select'), function(x){ return !x.disabled; });
    if(!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  function btDraft(test){ return { name:test.name || '', input:JSON.stringify(test.input, null, 2), expected:JSON.stringify(test.expected, null, 2), mode:test.mode || 'exact', tolerance:test.tolerance === undefined ? '0.001' : String(test.tolerance) }; }
  function btOpen(n){
    if(!btRunnable(n)) return;
    BT.back = document.activeElement; BT.node = n;
    BT.drafts = (btCases(n)).map(btDraft);
    btLayer.hidden = false; btRenderEditor();
    btDialog.querySelector('button').focus();
  }
  function btSample(){
    var n = BT.node, s = n && CMP.samples && CMP.samples[n.id];
    return s && s.node === n && s.space === curId() && s.lang === n.lang && s.code === nodeCode(n) ? s : null;
  }
  function btRenderEditor(){
    var n = BT.node; btDialog.textContent = '';
    btDialog.appendChild(h('div', { 'class':'bt-head' }, [h('h2', { id:'btTitle', text:'Тесты блока «' + n.name + '»' }), h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть тесты блока', text:'×', on:{ click:btClose } })]));
    btDialog.appendChild(h('p', { 'class':'bt-note', text:'Кейсы сохраняются вместе с блоком. Запуск выполняет настоящий код: внешние действия блока тоже могут выполниться. Изменения кейсов применяются кнопками «Сохранить» или «Прогнать».' }));
    var list = h('div', { 'class':'bt-cases' }); btDialog.appendChild(list);
    BT.drafts.forEach(function(t, i){
      var card = h('div', { 'class':'bt-case' }), ix = i + 1;
      var name = h('input', { 'class':'input', 'aria-label':'Название теста ' + ix, maxlength:'100' }); name.value = t.name;
      name.addEventListener('input', function(){ t.name = name.value; });
      var inp = h('textarea', { 'class':'input', 'aria-label':'Вход JSON теста ' + ix, spellcheck:'false' }); inp.value = t.input;
      inp.addEventListener('input', function(){ t.input = inp.value; inp.removeAttribute('aria-invalid'); });
      var expected = h('textarea', { 'class':'input', 'aria-label':'Ожидаемый JSON теста ' + ix, spellcheck:'false' }); expected.value = t.expected;
      expected.addEventListener('input', function(){ t.expected = expected.value; expected.removeAttribute('aria-invalid'); });
      var mode = h('select', { 'class':'input', 'aria-label':'Сравнение теста ' + ix }, [h('option', { value:'exact', text:'Точно' }), h('option', { value:'subset', text:'Содержит поля' }), h('option', { value:'number', text:'Число ± погрешность' })]); mode.value = t.mode;
      var tolerance = h('input', { 'class':'input', type:'number', min:'0', step:'any', 'aria-label':'Погрешность теста ' + ix }); tolerance.value = t.tolerance; tolerance.hidden = t.mode !== 'number';
      mode.addEventListener('change', function(){ t.mode = mode.value; tolerance.hidden = t.mode !== 'number'; });
      tolerance.addEventListener('input', function(){ t.tolerance = tolerance.value; });
      card.appendChild(h('b', { text:'Тест ' + ix })); card.appendChild(name);
      card.appendChild(h('div', { 'class':'bt-json' }, [section('Вход (JSON)', inp), section('Ожидаемый результат (JSON)', expected)]));
      card.appendChild(mode); card.appendChild(tolerance);
      card.appendChild(h('div', { 'class':'acts' }, [
        h('button', { type:'button', 'class':'btn sm', text:'Прогнать тест ' + ix, disabled:BT.busy ? '' : null, on:{ click:function(){ var tests = btSave(); if(tests) btRun([{ node:n, tests:[tests[i]] }]); } } }),
        h('button', { type:'button', 'class':'btn sm danger', text:'Удалить тест ' + ix, on:{ click:function(){ BT.drafts.splice(i, 1); btRenderEditor(); } } })
      ])); list.appendChild(card);
    });
    if(!BT.drafts.length) list.appendChild(h('p', { 'class':'bt-note', text:'Пока нет тестов. Добавьте кейс или возьмите вход и результат последнего успешного запуска.' }));
    btDialog.appendChild(h('div', { 'class':'acts bt-actions' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Добавить тест', on:{ click:function(){ if(BT.drafts.length >= 50) return toast('Не больше 50 тестов на блок'); BT.drafts.push(btDraft({ input:{}, expected:null })); btRenderEditor(); var fields = btDialog.querySelectorAll('input[aria-label^="Название"]'); fields[fields.length - 1].focus(); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Взять из последнего запуска', disabled:btSample() ? null : '', on:{ click:function(){ var s = btSample(); if(!s) return; if(BT.drafts.length >= 50) return toast('Не больше 50 тестов на блок'); BT.drafts.push(btDraft({ name:'Последний запуск', input:s.input, expected:s.output })); btRenderEditor(); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Сохранить тесты', on:{ click:function(){ if(btSave()) $('btEditStatus').textContent = 'Тесты блока сохранены'; } } }),
      h('button', { type:'button', 'class':'btn sm primary', text:'Прогнать тесты блока', disabled:BT.busy ? '' : null, on:{ click:function(){ var tests = btSave(); if(tests) btRun([{ node:n, tests:tests }]); } } })
    ]));
    btDialog.appendChild(h('div', { id:'btEditStatus', role:'status', 'aria-live':'polite', 'class':'bt-note' }));
  }
  function btSave(){
    var n = BT.node, tests = [];
    if(!n || nodeById(n.id) !== n){ toast('Блок больше не находится в текущем пространстве'); return null; }
    for(var i = 0; i < BT.drafts.length; i++){
      var t = BT.drafts[i], inp, expected;
      try{ inp = JSON.parse(t.input); }catch(e){ return btInvalid('Вход JSON теста ' + (i + 1), 'Вход теста ' + (i + 1) + ': неверный JSON'); }
      try{ expected = JSON.parse(t.expected); }catch(e){ return btInvalid('Ожидаемый JSON теста ' + (i + 1), 'Ожидаемый результат теста ' + (i + 1) + ': неверный JSON'); }
      var tol = Number(t.tolerance);
      if(t.mode === 'number' && (typeof expected !== 'number' || t.tolerance.trim() === '' || !isFinite(tol) || tol < 0)) return btInvalid('Погрешность теста ' + (i + 1), 'Укажите числовой результат и неотрицательную погрешность');
      tests.push({ name:t.name.trim() || 'Тест ' + (i + 1), input:inp, expected:expected, mode:t.mode, tolerance:tol });
    }
    n.tests = tests; saveGraph(); flushSave(); btBadges(); return tests;
  }
  function btInvalid(label, message){
    $('btEditStatus').textContent = message;
    var field = btDialog.querySelector('[aria-label="' + label + '"]'); if(field){ field.setAttribute('aria-invalid', 'true'); field.focus(); }
    return null;
  }
  var btTab = h('button', { type:'button', role:'tab', 'data-rt':'tests', 'aria-selected':'false', text:'Тесты' });
  var btPanel = h('div', { id:'runTests', 'class':'runp-list bt-results', hidden:'', 'aria-live':'polite' });
  runEl.box.querySelector('.runp-tabs').appendChild(btTab); $('runStd').parentNode.appendChild(btPanel);
  btTab.addEventListener('click', function(){ cmpTabs('tests'); });
  function btAll(){
    var jobs = G.nodes.filter(function(n){ return btRunnable(n) && btCases(n).length; }).map(function(n){ return { node:n, tests:btCases(n) }; });
    btRun(jobs);
  }
  function btRun(jobs){
    if(running || CMP.busy || BT.busy){ toast('Дождитесь завершения текущего запуска'); return; }
    var work = [], space = curId();
    jobs.forEach(function(job){
      delete BT.results[job.node.id];
      var rec = { node:job.node, space:space, signature:btSignature(job.node), items:[], complete:job.tests.length === (btCases(job.node)).length };
      job.tests.forEach(function(t){ work.push({ rec:rec, node:blockSnapshot(job.node), test:blockSnapshot(t) }); });
    });
    if(!work.length){ toast('Добавьте тесты в настройках кодовых блоков'); return; }
    btBadges(); btClose(); cmpOpen(); cmpTabs('tests'); btPanel.textContent = '';
    var summary = h('p', { 'class':'bt-note', role:'status', text:'Выполняю тесты…' }); btPanel.appendChild(summary);
    BT.busy = true; running = true; CMP.busy = true; CMP.stop = false;
    $('runGo').disabled = true; $('runSel').disabled = true; $('runStop').disabled = false;
    var ix = 0, passed = 0, failed = 0;
    function finish(){
      var stopped = CMP.stop || ix < work.length;
      BT.busy = false; running = false; CMP.busy = false; CMP.stop = false;
      $('runGo').disabled = false; $('runSel').disabled = false; $('runStop').disabled = true;
      summary.textContent = 'Тесты: успешно ' + passed + ' · ошибок ' + failed + (stopped ? ' · остановлено' : '');
      work.forEach(function(x){ if(x.rec.complete && x.rec.items.length === (btCases(x.rec.node)).length) BT.results[x.rec.node.id] = x.rec; });
      btBadges();
    }
    function next(){
      if(ix >= work.length || CMP.stop || curId() !== space){ finish(); return; }
      var x = work[ix++], t = x.test;
      executeBlock(x.node, t.input, { exact:true }).then(function(r){
        var ok = r.ok && btMatches(r.output, t), result = { ok:ok };
        x.rec.items.push(result); if(ok) passed++; else failed++;
        var card = h('div', { 'class':'bt-result ' + (ok ? 'bt-pass' : 'bt-fail') });
        card.appendChild(h('b', { text:(ok ? '✓ ' : '✗ ') + x.node.name + ' · ' + (t.name || 'Тест') }));
        var report = 'Вход: ' + JSON.stringify(t.input, null, 2) + '\nОжидалось: ' + JSON.stringify(t.expected, null, 2) + '\nПолучено: ' + (r.ok ? JSON.stringify(r.output, null, 2) : 'Ошибка: ' + r.error);
        card.appendChild(h('pre', { text:typeof varMask === 'function' ? varMask(report) : report }));
        btPanel.appendChild(card); next();
      }, function(e){ failed++; summary.textContent = 'Не удалось выполнить тест: ' + e.message; finish(); });
    }
    next();
  }
  (function(){
    var tabs = cmpTabs; cmpTabs = function(t){ tabs(t); btPanel.hidden = t !== 'tests'; };
    var pop = renderNodePop; renderNodePop = function(p, n){
      pop(p, n); if(!btRunnable(n)) return;
      var sec = section('Проверка блока', h('button', { type:'button', 'class':'btn sm', text:'Тесты блока (' + (btCases(n)).length + ')', on:{ click:function(){ btOpen(n); } } }));
      p.insertBefore(sec, p.children[3] || null);
    };
    var render = renderGraph; renderGraph = function(){ var r = render.apply(this, arguments); btBadges(); return r; };
    var code = setCode; setCode = function(v){ var n = docNode(), r = code(v); if(n){ delete BT.results[n.id]; var d = domOf('node', n.id), badge = d && d.querySelector('.bt-badge'); if(badge) badge.remove(); } return r; };
    var clear = clearCode; clearCode = function(){ var r = clear(); btBadges(); return r; };
    var commands = cmdCommands; cmdCommands = function(){ return commands().concat([
      { sec:'board', label:'Прогнать все тесты доски', d:'Выполнить сохранённые кейсы кодовых блоков', icon:'run', act:btAll, k:'тесты проверки вход выход test' }
    ]); };
  })();
