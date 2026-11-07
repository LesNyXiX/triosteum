  /* =====================================================================
     ОКНО КОМПИЛЯТОРА: плавающее окно запуска доски. Журнал, статус и время
     каждого блока, список ошибок с переходом к блоку, вывод программ,
     остановка, перезапуск, запуск только выделенных блоков.
     ===================================================================== */
  var runEl = { box:$('runp'), out:$('runOut'), sum:$('runSum') };
  var CMP = { blocks:{}, order:[], t0:0, stop:false, tab:'log', only:null, last:{}, errs:[], std:0, cur:null, busy:false };
  var cmpWin = makeWindow(runEl.box, '.runp-h', 'compiler', 'fixed');
  function cmpOpen(){ runEl.box.hidden = false; cmpWin.apply(); }
  function rlog(text, cls){
    var s = document.createElement('span'); if(cls) s.className = cls; s.textContent = text + '\n';
    runEl.out.appendChild(s); runEl.out.scrollTop = runEl.out.scrollHeight;
    if(CMP.cur && /^▶/.test(text) && CMP.blocks[CMP.cur]) CMP.blocks[CMP.cur].t = performance.now();   // время — с начала выполнения, без паузы между блоками
    // строки, напечатанные программой блока, — ещё и во вкладку «Вывод»
    if(CMP.cur && /^ {3}(?!ℹ)/.test(text)){ var b = CMP.blocks[CMP.cur]; if(b) b.out.push(text.slice(3)); cmpStd(b, text.slice(3), cls); }
  }
  function cmpStd(b, text, cls){
    var std = $('runStd');
    if(std.lastBlock !== b.id){ var hd = document.createElement('span'); hd.className = 'std-b'; hd.textContent = (std.childNodes.length ? '\n' : '') + '── ' + b.name + ' ──\n'; std.appendChild(hd); std.lastBlock = b.id; }
    var s = document.createElement('span'); if(cls) s.className = cls; s.textContent = text + '\n'; std.appendChild(s);
    CMP.std++; $('rtStd').textContent = CMP.std;
  }
  function cmpLangName(n){ if(n.kind === 'hub') return 'узел'; var l = typeof langById === 'function' ? langById(n.lang) : null; return (l ? shortName(l) : (n.lang || '')) + (n.xref ? ' ↗ ' + (n.xref.spName || '') : ''); }
  function cmpBegin(plan, title){
    cmpOpen();
    runEl.out.textContent = ''; $('runStd').textContent = ''; $('runStd').lastBlock = null;
    CMP.blocks = {}; CMP.errs = []; CMP.std = 0; CMP.stop = false; CMP.busy = true; CMP.cur = null; CMP.t0 = performance.now();
    CMP.order = plan.order.map(function(n){ return n.id; });
    plan.order.forEach(function(n){ CMP.blocks[n.id] = { id:n.id, name:n.name, lang:cmpLangName(n), s:'wait', ms:null, info:'', out:[] }; });
    (plan.cyclic || []).forEach(function(n){ CMP.blocks[n.id] = { id:n.id, name:n.name, lang:cmpLangName(n), s:'skip', ms:null, info:'Пропущен: замкнутый круг связей', out:[] }; CMP.order.push(n.id); });
    runEl.sum.textContent = (title || 'Запуск') + ' · блоков: ' + plan.order.length + (CMP.only ? ' (выделенные)' : '');
    runEl.box.classList.add('busy'); runEl.box.classList.remove('err');
    $('runStop').disabled = false; $('runGo').disabled = true; $('runSel').disabled = true;
    $('rtStd').textContent = '0';
    cmpRender();
  }
  function cmpBlockStart(n){ var b = CMP.blocks[n.id]; if(!b) return; CMP.cur = n.id; b.s = 'run'; b.t = performance.now(); cmpRender(); }
  // вызывается из setRun: итог блока
  function cmpMark(n, s, info){
    var b = CMP.blocks[n.id]; if(!b || !CMP.busy) return;
    b.s = s; b.info = info || ''; b.ms = b.t ? Math.round(performance.now() - b.t) : 0;
    if(s === 'err'){ CMP.errs.push({ id:n.id, name:n.name, msg:String(info || '').replace(/^Ошибка:\s*/, ''), lang:b.lang }); runEl.box.classList.add('err'); }
    cmpRender();
  }
  function cmpStopped(){ return CMP.stop; }
  function cmpEnd(results, stopped){
    CMP.busy = false; CMP.cur = null;
    if(results) for(var k in results) CMP.last[k] = results[k];
    var done = 0, ok = 0, err = 0, skip = 0;
    CMP.order.forEach(function(id){ var b = CMP.blocks[id]; if(b.s === 'wait' || b.s === 'run'){ if(stopped){ b.s = 'stop'; b.info = 'Не выполнялся: запуск остановлен'; } } else done++; if(b.s === 'ok') ok++; if(b.s === 'err') err++; if(b.s === 'skip') skip++; });
    var ms = Math.round(performance.now() - CMP.t0);
    var tail = (stopped ? 'остановлено · ' : '') + 'успешно: ' + ok + ' · ошибок: ' + err + (skip ? ' · пропущено: ' + skip : '') + ' · ' + cmpTime(ms);
    runEl.sum.textContent = runEl.sum.textContent ? runEl.sum.textContent.split(' · блоков')[0] + ' · ' + tail : tail;
    if(stopped) rlog('■ Запуск остановлен пользователем.', 'warn');
    runEl.box.classList.remove('busy');
    $('runStop').disabled = true; $('runGo').disabled = false; $('runSel').disabled = false;
    CMP.only = null;
    if(err && CMP.tab === 'log') cmpTabs('errs');
    cmpRender();
  }
  function cmpTime(ms){ return ms < 1000 ? ms + ' мс' : (ms / 1000).toFixed(ms < 10000 ? 2 : 1).replace('.', ',') + ' с'; }
  // план запуска: вся доска или только выделенные блоки (их входы берутся из прошлого запуска)
  function cmpPlan(plan){
    if(!CMP.only) return plan;
    var only = CMP.only;
    return { order:plan.order.filter(function(n){ return only[n.id]; }), preds:plan.preds, cyclic:[] };
  }
  function cmpSeed(){ var r = {}; if(CMP.only) for(var k in CMP.last) r[k] = CMP.last[k]; return r; }
  function cmpRender(){
    var total = CMP.order.length, fin = 0;
    CMP.order.forEach(function(id){ var s = CMP.blocks[id].s; if(s !== 'wait' && s !== 'run') fin++; });
    $('runBar').style.width = (total ? Math.round(fin / total * 100) : 0) + '%';
    $('rtBlocks').textContent = total;
    var re = $('rtErrs'); re.textContent = CMP.errs.length; re.classList.toggle('bad', CMP.errs.length > 0);
    if(CMP.tab === 'blocks') cmpRenderBlocks();
    if(CMP.tab === 'errs') cmpRenderErrs();
  }
  var CMP_ST = { wait:'ожидает', run:'выполняется…', ok:'готово', err:'ошибка', skip:'пропущен', stop:'остановлен' };
  function cmpRenderBlocks(){
    var box = $('runBlocks'); box.textContent = '';
    if(!CMP.order.length){ box.appendChild(h('div', { 'class':'rb-empty', text:'Запустите доску — здесь появится каждый блок со статусом и временем выполнения.' })); return; }
    CMP.order.forEach(function(id, i){
      var b = CMP.blocks[id];
      box.appendChild(h('button', { type:'button', 'class':'rb-row', title:'Показать блок на доске', on:{ click:function(){ cmpReveal(id); }, dblclick:function(){ var n = nodeById(id); if(n && typeof openBlock === 'function') openBlock(n); } } }, [
        h('span', { 'class':'rb-dot ' + b.s }),
        h('span', { 'class':'nm' }, [ document.createTextNode((i + 1) + '. ' + b.name), h('small', { text:b.info || CMP_ST[b.s] }) ]),
        h('span', { 'class':'lg', text:b.lang }),
        h('span', { 'class':'ms', text:b.ms === null ? (b.s === 'run' ? '…' : '') : cmpTime(b.ms) })
      ]));
    });
  }
  // подсказка, что делать с типичной ошибкой
  function cmpHint(msg){
    if(/Секрет/.test(msg)) return 'Задайте значение в Настройки → Секреты и запустите снова.';
    if(/из браузера|сервере Triosteum/.test(msg)) return 'Это действие требует сервера: браузер не может отправлять почту или ходить на сайты без разрешения.';
    if(/Неизвестн|не определена|Непонятная|Ожидалось|Неожиданное/.test(msg)) return 'Проверьте написание на указанной строке; дважды щёлкните, чтобы открыть код блока.';
    if(/Python/.test(msg)) return 'Python загружается из локальной копии или CDN — проверьте подключение к интернету.';
    if(/долгое выполнение/.test(msg)) return 'Похоже на бесконечный цикл: проверьте условие выхода.';
    return '';
  }
  function cmpRenderErrs(){
    var box = $('runErrs'); box.textContent = '';
    if(!CMP.errs.length){ box.appendChild(h('div', { 'class':'rb-empty', text:CMP.busy ? 'Ошибок пока нет.' : (CMP.order.length ? 'Ошибок нет — все блоки выполнились.' : 'Ошибок нет.') })); return; }
    CMP.errs.forEach(function(x){
      var hint = cmpHint(x.msg);
      var card = h('div', { 'class':'rb-err' }); box.appendChild(card);
      card.appendChild(h('button', { type:'button', 'class':'rb-err-h', title:'Щелчок — показать блок, двойной — открыть код', on:{ click:function(){ cmpReveal(x.id); }, dblclick:function(){ var n = nodeById(x.id); if(n && typeof openBlock === 'function') openBlock(n); } } }, [
        h('b', { text:x.name + ' · ' + x.lang }), h('code', { text:x.msg }), hint ? h('span', { 'class':'rb-hint', text:hint }) : null
      ]));
      if(typeof errAiSection === 'function') card.appendChild(errAiSection(x));
    });
  }
  function cmpReveal(id){
    var n = nodeById(id); if(!n) return;
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    var r = el.canvas.getBoundingClientRect(), k = G.cam.k || 1;
    G.cam.x = r.width / 2 - (n.x + NWof(n) / 2) * k; G.cam.y = r.height / 2 - (n.y + NHof(n) / 2) * k;
    applyCam(); S.multi = []; S.sel = { type:'node', id:id }; updateSel(); saveGraph();
    var d = domOf('node', id); if(d){ d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); setTimeout(function(){ d.classList.remove('flash'); }, 1200); }
  }
  function cmpTabs(t){
    CMP.tab = t;
    Array.prototype.forEach.call(runEl.box.querySelectorAll('.runp-tabs button'), function(b){ var on = b.dataset.rt === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $('runOut').hidden = t !== 'log'; $('runBlocks').hidden = t !== 'blocks'; $('runErrs').hidden = t !== 'errs'; $('runStd').hidden = t !== 'std';
    cmpRender();
  }
  function cmpText(){
    var lines = ['Triosteum · компилятор · ' + new Date().toLocaleString('ru-RU'), runEl.sum.textContent, '', '== Журнал =='].concat(runEl.out.textContent.replace(/\n+$/, '').split('\n'));
    if(CMP.order.length){ lines.push('', '== Блоки =='); CMP.order.forEach(function(id, i){ var b = CMP.blocks[id]; lines.push((i + 1) + '. ' + b.name + ' [' + b.lang + '] — ' + CMP_ST[b.s] + (b.ms !== null ? ', ' + cmpTime(b.ms) : '') + (b.info ? ' — ' + b.info : '')); }); }
    if(CMP.errs.length){ lines.push('', '== Ошибки =='); CMP.errs.forEach(function(x){ lines.push(x.name + ': ' + x.msg); }); }
    return lines.join('\n');
  }
  Array.prototype.forEach.call(runEl.box.querySelectorAll('.runp-tabs button'), function(b){ b.addEventListener('click', function(){ cmpTabs(b.dataset.rt); }); });
  $('runClose').addEventListener('click', function(){ if(CMP.busy) CMP.stop = true; runEl.box.hidden = true; });
  $('runStop').addEventListener('click', function(){ if(CMP.busy){ CMP.stop = true; $('runStop').disabled = true; rlog('Останавливаю после текущего блока…', 'dim'); } });
  $('runGo').addEventListener('click', function(){ if(!CMP.busy){ CMP.only = null; runBoard(); } });
  $('runSel').addEventListener('click', function(){
    if(CMP.busy) return;
    var ids = {}, cnt = 0;
    (S.multi || []).forEach(function(m){ if(m.type === 'node'){ ids[m.id] = 1; cnt++; } });
    if(!cnt && S.sel && S.sel.type === 'node'){ ids[S.sel.id] = 1; cnt++; }
    if(!cnt){ toast('Выделите блоки на доске (щелчок или Ctrl+щелчок), затем нажмите «Выделенные»'); return; }
    CMP.only = ids; runBoard();
  });
  $('runCopy').addEventListener('click', function(){
    var t = cmpText();
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ toast('Журнал компилятора скопирован'); }, function(){ toast('Браузер не разрешил копирование'); });
    else toast('Браузер не разрешил копирование');
  });
  $('runSave').addEventListener('click', function(){
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([cmpText()], { type:'text/plain;charset=utf-8' }));
    a.href = url; a.download = 'triosteum-компилятор-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  });
  $('runMin').addEventListener('click', function(){ var on = !runEl.box.classList.contains('min'); runEl.box.classList.toggle('min', on); runEl.box.classList.remove('max'); $('runMin').title = on ? 'Развернуть окно' : 'Свернуть'; });
  $('runMax').addEventListener('click', function(){ var on = !runEl.box.classList.contains('max'); runEl.box.classList.toggle('max', on); runEl.box.classList.remove('min'); $('runMax').title = on ? 'Обычный размер' : 'Развернуть'; });
  runEl.box.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !CMP.busy){ runEl.box.hidden = true; } });
