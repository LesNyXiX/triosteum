  /* =====================================================================
     РАСПИСАНИЕ ЗАПУСКА — схема запускается сама: каждые N минут, ежедневно или по будням в заданное время
     Работает, пока Triosteum открыт в браузере (хотя бы одна вкладка с этим пространством).
     Если открыто несколько вкладок, запускает только одна — «ведущая» (метка в localStorage); для пространства
     на сервере, открытого на разных компьютерах, срок дополнительно захватывается на сервере (schedule-claim).
     Пропущенные, пока вкладка была закрыта, запуски не догоняются пачкой: один запуск сразу
     и дальше по расписанию. Ошибка запуска — уведомление браузера (если разрешено) и сообщение.
     Хранится в пространстве: G.schedule = { on, kind:'every'|'daily'|'weekdays', every, at, notify, last }.
     ===================================================================== */
  var SCH = { tab:'t' + Math.random().toString(36).slice(2, 9), timer:0, pending:false, chip:null, claiming:'', claim:null };
  var SCH_KINDS = { every:'Каждые N минут', daily:'Каждый день', weekdays:'По будням' };

  function schOf(){ return G.schedule && typeof G.schedule === 'object' ? G.schedule : null; }
  function schAt(at){ var m = /^(\d{1,2}):(\d{2})$/.exec(String(at || '')); return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [9, 0]; }
  // срок, к которому относится ближайший запуск: первый подходящий срок после последнего запуска.
  // Может быть в прошлом — вкладка была закрыта (например, с понедельника до среды): тогда один запуск сразу.
  function schSlot(s, from){
    if(!s || !s.on) return null;
    if(s.kind === 'every'){ var step = Math.max(1, Math.min(1440, s.every | 0 || 60)) * 60000; return s.last ? s.last + step : Math.floor(from / 60000) * 60000; }
    var hm = schAt(s.at), d = new Date(s.last || from); d.setHours(hm[0], hm[1], 0, 0);
    for(var i = 0; i < 9; i++){   // начиная со дня последнего запуска: пропущенный день не теряется
      if(d.getTime() > (s.last || 0) && (s.kind !== 'weekdays' || (d.getDay() >= 1 && d.getDay() <= 5))) return d.getTime();
      d.setDate(d.getDate() + 1); d.setHours(hm[0], hm[1], 0, 0);
    }
    return null;
  }
  // следующий запуск после момента from
  function schNext(s, from){ var t = schSlot(s, from); return t === null ? null : Math.max(t, from); }
  function schDesc(s){
    if(!s || !s.on) return 'выключено';
    if(s.kind === 'every') return 'каждые ' + (s.every || 60) + ' мин';
    return (s.kind === 'weekdays' ? 'по будням' : 'каждый день') + ' в ' + (s.at || '09:00');
  }
  function schTime(t){ var d = new Date(t), now = new Date(); var same = d.toDateString() === now.toDateString(); return (same ? 'сегодня ' : d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) + ' ') + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }); }

  // ведущая вкладка: держит метку не дольше 45 секунд без обновления
  function schLead(){
    var k = 'triosteum.sched.lead.' + curId(), now = Date.now(), cur = null;
    try { cur = JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){}
    if(cur && cur.tab !== SCH.tab && now - cur.t < 45000) return false;
    try { localStorage.setItem(k, JSON.stringify({ tab:SCH.tab, t:now })); } catch(e){ return true; }
    return true;
  }
  function schTick(){
    schChip();
    var s = schOf(); if(!s || !s.on || PANE) return;
    if(!schLead()) return;
    var due = schNext(s, Date.now());
    if(due === null || due > Date.now()){ SCH.claim = null; return; }
    if(CMP.busy || (typeof running !== 'undefined' && running)){ SCH.pending = true; return; }   // идёт ручной запуск — подождём
    SCH.pending = false;
    var sp = curId(), slot = schSlot(s, Date.now()), key = sp + ':' + slot;
    // захват засчитывается только для того пространства и срока, для которых он запрошен
    if(SERVER && !(SCH.claim && SCH.claim.space === sp && SCH.claim.slot === slot)){   // пространство на сервере может быть открыто и на других компьютерах — срок захватывает один
      if(SCH.claiming === key) return;
      SCH.claiming = key;
      // token — метка вкладки: если ответ потерялся, повторный запрос того же срока с той же меткой сервер подтвердит
      SERVER.api('POST', '/spaces/' + encodeURIComponent(sp) + '/schedule-claim', { slot:slot, token:SCH.tab }).then(function(r){
        if(SCH.claiming === key) SCH.claiming = '';
        if(r.status === 200 && r.data && r.data.ok){ SCH.claim = { space:sp, slot:slot }; schTick(); }   // наш срок — запускаем (если пространство и срок всё ещё те же)
        // иначе срок уже взял другой клиент: его отметка о запуске придёт вместе с пространством
      }, function(){ if(SCH.claiming === key) SCH.claiming = ''; });
      return;
    }
    SCH.claim = null;
    s.last = Date.now(); saveGraph();
    if(typeof RH !== 'undefined') RH.nextTrig = 'schedule';
    CMP.only = null;
    runBoard();
    schChip();
  }
  // итог запуска по расписанию: ошибка — уведомление
  (function(){
    var _norm = normGraph;   // расписание хранится вместе с пространством
    normGraph = function(o){ var g = _norm(o); if(o && o.schedule && typeof o.schedule === 'object') g.schedule = JSON.parse(JSON.stringify(o.schedule)); return g; };
    var _end = cmpEnd;
    cmpEnd = function(results, stopped){
      var bySched = typeof RH !== 'undefined' && RH.trig === 'schedule';
      var r = _end.apply(this, arguments);
      var s = schOf();
      if(bySched && s && s.notify !== false && !stopped && (CMP.errs.length || !results)){
        var msg = (curProj() ? '«' + curProj().name + '»: ' : '') + (results ? 'ошибок при запуске по расписанию — ' + CMP.errs.length + '. Первая: ' + (CMP.errs[0] ? CMP.errs[0].name + ' — ' + CMP.errs[0].msg : '') : 'запуск по расписанию не состоялся');
        toast('⏱ ' + msg);
        try { if(window.Notification && Notification.permission === 'granted') new Notification('Triosteum — ошибка запуска', { body:msg.slice(0, 220), tag:'triosteum-sched-' + curId() }); } catch(e){}
      }
      if(SCH.pending) setTimeout(schTick, 500);
      return r;
    };
    var _show = showProjName;
    showProjName = function(){ var r = _show.apply(this, arguments); schChip(); if(schWin && !schWin.hidden) renderSch(); return r; };
  })();

  // метка у кнопки запуска: когда следующий запуск
  function schChip(){
    var b = $('topRun'); if(!b) return;
    var s = schOf(), on = !!(s && s.on);
    if(!SCH.chip){
      SCH.chip = h('button', { type:'button', 'class':'sch-chip', hidden:'', on:{ click:openSch } });
      b.parentNode.insertBefore(SCH.chip, b);
    }
    SCH.chip.hidden = !on;
    if(on){ var nx = schNext(s, Date.now()); SCH.chip.textContent = '⏱ ' + (nx ? schTime(nx) : '—'); SCH.chip.title = 'Расписание: ' + schDesc(s) + (nx ? '. Следующий запуск: ' + schTime(nx) : '') + ' — щёлкните, чтобы изменить'; SCH.chip.setAttribute('aria-label', SCH.chip.title); }
  }

  /* ---------- окно «Расписание запуска» ---------- */
  var schWin = null;
  function openSch(){
    if(!schWin){
      schWin = h('section', { 'class':'pers sch-w', id:'schW', role:'dialog', 'aria-label':'Расписание запуска' });
      schWin.appendChild(h('div', { 'class':'pers-h' }, [ h('b', { text:'Расписание запуска' }), h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть', text:'✕', on:{ click:function(){ schWin.hidden = true; } } }) ]));
      schWin.appendChild(h('div', { 'class':'pers-b', id:'schBody' }));
      schWin.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); schWin.hidden = true; } });
      document.body.appendChild(schWin);
    }
    schWin.hidden = false; renderSch();
  }
  function schSet(patch){
    G.schedule = Object.assign({ on:false, kind:'daily', every:60, at:'09:00', notify:true, last:0 }, schOf() || {}, patch);
    saveGraph(); renderSch(); schChip();
  }
  function renderSch(){
    var b = $('schBody'); if(!b) return; b.textContent = '';
    var s = Object.assign({ on:false, kind:'daily', every:60, at:'09:00', notify:true }, schOf() || {});
    b.appendChild(toggleRow('Запускать схему по расписанию', s.on, function(v){
      schSet({ on:v, last:v ? Date.now() : (schOf() || {}).last || 0 });   // включили — ближайший запуск по расписанию, а не сразу
      if(v && s.notify !== false) schAskNotify();
    }));
    var kind = h('div', { 'class':'seg sch-kind', role:'radiogroup', 'aria-label':'Как часто' }, Object.keys(SCH_KINDS).map(function(k){
      return h('button', { type:'button', role:'radio', 'aria-checked':s.kind === k ? 'true' : 'false', 'class':'btn sm' + (s.kind === k ? ' primary' : ''), text:SCH_KINDS[k], on:{ click:function(){ schSet({ kind:k }); } } });
    }));
    b.appendChild(h('div', null, [ h('div', { 'class':'flabel', text:'Как часто' }), kind ]));
    if(s.kind === 'every'){
      var ev = h('select', { 'class':'input', id:'schEvery', 'aria-label':'Интервал' }, [5, 10, 15, 30, 60, 120, 240, 480, 720, 1440].map(function(m){ var o = h('option', { value:String(m), text:m < 60 ? m + ' мин' : (m / 60) + ' ч' }); if(m === (s.every | 0)) o.selected = true; return o; }));
      ev.addEventListener('change', function(){ schSet({ every:+ev.value }); });
      b.appendChild(h('div', null, [ h('label', { 'class':'flabel', 'for':'schEvery', text:'Интервал' }), ev ]));
    } else {
      var at = h('input', { type:'time', 'class':'input', id:'schAt', value:s.at || '09:00', 'aria-label':'Время запуска' });
      at.addEventListener('change', function(){ if(at.value) schSet({ at:at.value }); });
      b.appendChild(h('div', null, [ h('label', { 'class':'flabel', 'for':'schAt', text:'Время (по часам этого компьютера)' }), at ]));
    }
    b.appendChild(toggleRow('Уведомлять об ошибках запуска', s.notify !== false, function(v){ schSet({ notify:v }); if(v) schAskNotify(); }));
    var nx = schNext(schOf(), Date.now());
    b.appendChild(h('div', { 'class':'sch-info' }, [
      h('div', null, [ h('b', { text:'Сейчас: ' }), document.createTextNode(schDesc(schOf())) ]),
      s.on && nx ? h('div', null, [ h('b', { text:'Следующий запуск: ' }), document.createTextNode(schTime(nx)) ]) : null,
      s.last ? h('div', null, [ h('b', { text:'Последний по расписанию: ' }), document.createTextNode(new Date(s.last).toLocaleString('ru-RU')) ]) : null
    ]));
    b.appendChild(h('p', { 'class':'sec-note', text:'Расписание работает, пока Triosteum открыт в браузере на этом или другом компьютере с этим пространством; если открыто несколько вкладок, запускает одна. ' +
      'Запуски, пропущенные пока вкладка была закрыта, не повторяются пачкой — будет один запуск при открытии. Каждый запуск виден во вкладке «История» компилятора с пометкой «по расписанию».' }));
  }
  function schAskNotify(){
    try { if(window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch(e){}
  }
  (function(){
    var _cc = cmdCommands;
    cmdCommands = function(){
      var s = schOf();
      return _cc().concat([{ sec:'board', label:'Расписание запуска', d:s && s.on ? 'Сейчас: ' + schDesc(s) : 'Запускать схему каждые N минут или в заданное время', icon:'run', act:openSch, k:'расписание таймер cron автозапуск каждый день schedule' }]);
    };
  })();
  SCH.timer = setInterval(schTick, 15000);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) schTick(); });
  setTimeout(schTick, 1500);
