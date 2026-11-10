  /* =====================================================================
     ИСТОРИЯ ЗАПУСКОВ И СТАТИСТИКА — вкладка «История» в окне компилятора
     Каждый запуск схемы сохраняется: когда, сколько длился, итог, статус и время каждого блока,
     короткие результаты, ошибки и журнал. По истории считается статистика по блокам:
     как часто падают, сколько в среднем выполняются, где узкое место.
     Хранится отдельно для каждого пространства, последние RH_MAX запусков.
     ===================================================================== */
  var RH_MAX = 30, RH_LOG = 6000, RH_RES = 600;
  var RH = { open:{}, t:0 };

  function rhKey(){ return 'runs.' + curId(); }
  function rhList(){ var v = Repo.pref(rhKey(), []); return Array.isArray(v) ? v : []; }
  function rhSave(list){ try { Repo.setPref(rhKey(), list.slice(0, RH_MAX)); } catch(e){ if(list.length > 5) rhSave(list.slice(0, Math.floor(list.length / 2))); } }
  function rhShort(v, max){ var t; try { t = JSON.stringify(v); } catch(e){ t = String(v); } if(t === undefined) return ''; return t.length > max ? t.slice(0, max) + '…' : t; }
  function rhDate(t){ var d = new Date(t); return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit', second:'2-digit' }); }

  // запись запуска — в конце cmpEnd, когда статусы блоков уже окончательные
  (function(){
    var _begin = cmpBegin, _end = cmpEnd;
    cmpBegin = function(){ RH.t = Date.now(); RH.only = !!CMP.only; return _begin.apply(this, arguments); };
    cmpEnd = function(results, stopped){
      var r = _end.apply(this, arguments);
      try { rhRecord(results, stopped); } catch(e){}
      return r;
    };
  })();
  function rhRecord(results, stopped){
    if(!CMP.order.length) return;
    var st = { ok:0, err:0, skip:0 };
    var blocks = CMP.order.map(function(id){
      var b = CMP.blocks[id]; if(!b) return null;
      if(b.s === 'ok') st.ok++; else if(b.s === 'err') st.err++; else if(b.s === 'skip') st.skip++;
      var res = results && Object.prototype.hasOwnProperty.call(results, id) ? rhShort(results[id], RH_RES) : '';
      return { id:id, name:b.name, lang:b.lang, s:b.s, ms:b.ms, info:String(b.info || '').slice(0, 300), res:res };
    }).filter(Boolean);
    var log = runEl.out.textContent || '';
    var rec = { id:'r' + Date.now().toString(36), t:RH.t || Date.now(), ms:Math.round(performance.now() - CMP.t0), env:ENV.short || ENV.name || '',
      stopped:!!stopped, only:!!RH.only, ok:st.ok, err:st.err, skip:st.skip, blocks:blocks,
      log:log.length > RH_LOG ? '…' + log.slice(-RH_LOG) : log };
    var list = rhList(); list.unshift(rec); rhSave(list);
    rhBadge();
    if(CMP.tab === 'hist') rhRender();
  }

  // статистика по блокам за все сохранённые запуски
  function rhStats(list){
    var by = {};
    list.forEach(function(r){ r.blocks.forEach(function(b){
      var x = by[b.id] || (by[b.id] = { id:b.id, name:b.name, lang:b.lang, runs:0, err:0, ms:0, n:0 });
      x.name = x.name || b.name;
      if(b.s === 'ok' || b.s === 'err'){ x.runs++; if(b.s === 'err') x.err++; }
      if(typeof b.ms === 'number'){ x.ms += b.ms; x.n++; }
    }); });
    var arr = Object.keys(by).map(function(k){ var x = by[k]; x.avg = x.n ? Math.round(x.ms / x.n) : null; return x; });
    var slow = arr.filter(function(x){ return x.avg !== null; }).sort(function(a, b){ return b.avg - a.avg; })[0];
    arr.sort(function(a, b){ return (b.err / Math.max(1, b.runs)) - (a.err / Math.max(1, a.runs)) || (b.avg || 0) - (a.avg || 0); });
    // «самый медленный» — только если он правда выделяется: от 100 мс и вдвое дольше следующего
    var times = arr.filter(function(x){ return x.avg !== null; }).map(function(x){ return x.avg; }).sort(function(a, b){ return b - a; });
    var marked = slow && slow.avg >= 100 && (times.length < 2 || slow.avg >= times[1] * 2);
    return { blocks:arr, slow:marked ? slow.id : null };
  }

  // вкладка «История»
  var rhTab = h('button', { type:'button', role:'tab', 'data-rt':'hist', 'aria-selected':'false' }, [ document.createTextNode('История '), h('em', { id:'rtHist', text:'0' }) ]);
  var rhBox = h('div', { 'class':'runp-list rh', id:'runHist', hidden:'' });
  (function(){
    var tabs = runEl.box.querySelector('.runp-tabs'); if(tabs) tabs.appendChild(rhTab);
    var std = $('runStd'); if(std && std.parentNode) std.parentNode.insertBefore(rhBox, std.nextSibling);
    rhTab.addEventListener('click', function(){ cmpTabs('hist'); });
    var _tabs = cmpTabs;
    cmpTabs = function(t){
      _tabs(t);
      rhBox.hidden = t !== 'hist';
      rhTab.classList.toggle('on', t === 'hist'); rhTab.setAttribute('aria-selected', t === 'hist' ? 'true' : 'false');
      if(t === 'hist') rhRender();
    };
    var _show = showProjName;   // другое пространство — своя история
    showProjName = function(){ var r = _show.apply(this, arguments); rhBadge(); if(CMP.tab === 'hist' && !rhBox.hidden) rhRender(); return r; };
  })();
  function rhBadge(){ var e = $('rtHist'); if(e) e.textContent = String(rhList().length); }

  function rhRender(){
    var list = rhList(); rhBox.textContent = '';
    if(!list.length){ rhBox.appendChild(h('div', { 'class':'rh-empty', text:'Запусков ещё не было. Нажмите «Запустить» — каждый запуск сохранится здесь с итогом по блокам.' })); return; }
    var okRuns = list.filter(function(r){ return !r.err && !r.stopped; }).length, avg = Math.round(list.reduce(function(a, r){ return a + r.ms; }, 0) / list.length);
    rhBox.appendChild(h('div', { 'class':'rh-sum' }, [
      rhKpi(String(list.length), 'запусков'),
      rhKpi(Math.round(okRuns / list.length * 100) + '%', 'без ошибок'),
      rhKpi(cmpTime(avg), 'в среднем'),
      rhKpi(String(list.reduce(function(a, r){ return a + r.err; }, 0)), 'ошибок всего')
    ]));
    // блоки: где падает и где медленно
    var stt = rhStats(list), tb = h('table', { 'class':'rh-tbl' });
    tb.appendChild(h('thead', null, [ h('tr', null, ['Блок', 'Запусков', 'Ошибок', 'Среднее время'].map(function(t){ return h('th', { scope:'col', text:t }); })) ]));
    var tbody = h('tbody');
    stt.blocks.slice(0, 12).forEach(function(x){
      var rate = x.runs ? Math.round(x.err / x.runs * 100) : 0;
      tbody.appendChild(h('tr', { 'class':(x.err ? 'bad' : '') + (stt.slow === x.id ? ' slow' : '') }, [
        h('td', null, [ h('button', { type:'button', 'class':'rh-name', text:x.name, title:'Показать блок на доске', on:{ click:function(){ if(nodeById(x.id)) cmpReveal(x.id); } } }), stt.slow === x.id ? h('span', { 'class':'rh-tag', text:'самый медленный' }) : null ]),
        h('td', { text:String(x.runs) }),
        h('td', { text:x.err ? x.err + ' (' + rate + '%)' : '0' }),
        h('td', { text:x.avg !== null ? cmpTime(x.avg) : '—' })
      ]));
    });
    tb.appendChild(tbody);
    rhBox.appendChild(h('div', { 'class':'rh-h', text:'Блоки — сначала те, что падают чаще' })); rhBox.appendChild(tb);
    // запуски
    rhBox.appendChild(h('div', { 'class':'rh-h' }, [ document.createTextNode('Запуски'), h('span', { 'class':'rh-acts' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Выгрузить CSV', on:{ click:rhCsv } }),
      h('button', { type:'button', 'class':'btn sm', text:'Очистить', on:{ click:function(){ askConfirm('Очистить историю запусков?', 'Будут удалены все ' + list.length + ' записей этого пространства.', 'Очистить', function(){ rhSave([]); rhBadge(); rhRender(); }); } } })
    ]) ]));
    list.forEach(function(r){ rhBox.appendChild(rhRun(r)); });
  }
  function rhKpi(v, l){ return h('div', { 'class':'rh-kpi' }, [ h('b', { text:v }), h('span', { text:l }) ]); }
  function rhRun(r){
    var open = !!RH.open[r.id], st = r.stopped ? 'stop' : r.err ? 'err' : 'ok';
    var head = h('button', { type:'button', 'class':'rh-run-h', 'aria-expanded':open ? 'true' : 'false', on:{ click:function(){ RH.open[r.id] = !RH.open[r.id]; rhRender(); } } }, [
      h('span', { 'class':'rh-st ' + st, text:st === 'ok' ? '✓' : st === 'err' ? '✗' : '■' }),
      h('span', { 'class':'rh-t', text:rhDate(r.t) }),
      h('span', { 'class':'rh-c', text:'успешно ' + r.ok + (r.err ? ' · ошибок ' + r.err : '') + (r.skip ? ' · пропущено ' + r.skip : '') + (r.stopped ? ' · остановлен' : '') }),
      h('span', { 'class':'rh-ms', text:cmpTime(r.ms) })
    ]);
    var box = h('div', { 'class':'rh-run ' + st }, [ head ]);
    if(open){
      var ol = h('ol', { 'class':'rh-blocks' });
      r.blocks.forEach(function(b){
        ol.appendChild(h('li', { 'class':'s-' + b.s }, [
          h('span', { 'class':'rh-bs', text:CMP_ST[b.s] || b.s }),
          h('b', { text:b.name }), h('span', { 'class':'rh-bl', text:b.lang }),
          b.ms !== null && b.ms !== undefined ? h('span', { 'class':'rh-bms', text:cmpTime(b.ms) }) : null,
          b.info && b.s !== 'ok' ? h('div', { 'class':'rh-info', text:b.info }) : null,
          b.res ? h('code', { 'class':'rh-res', text:b.res }) : null
        ]));
      });
      box.appendChild(ol);
      var pre = h('pre', { 'class':'out rh-log', hidden:'' }); pre.textContent = r.log || '';
      box.appendChild(h('div', { 'class':'acts' }, [
        h('button', { type:'button', 'class':'btn sm', text:'Журнал запуска', on:{ click:function(){ pre.hidden = !pre.hidden; this.textContent = pre.hidden ? 'Журнал запуска' : 'Скрыть журнал'; } } }),
        h('button', { type:'button', 'class':'btn sm', text:'Скопировать отчёт', on:{ click:function(){ rhCopy(r); } } })
      ]));
      box.appendChild(pre);
    }
    return box;
  }
  function rhText(r){
    return ['Triosteum · запуск ' + rhDate(r.t) + ' · ' + r.env, 'Итог: успешно ' + r.ok + ', ошибок ' + r.err + ', пропущено ' + r.skip + (r.stopped ? ', остановлен' : '') + ' · ' + cmpTime(r.ms), '']
      .concat(r.blocks.map(function(b, i){ return (i + 1) + '. ' + b.name + ' [' + b.lang + '] — ' + (CMP_ST[b.s] || b.s) + (b.ms !== null && b.ms !== undefined ? ', ' + cmpTime(b.ms) : '') + (b.info && b.s !== 'ok' ? ' — ' + b.info : ''); }))
      .concat(['', '== Журнал ==', r.log || '']).join('\n');
  }
  function rhCopy(r){
    var t = rhText(r);
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ toast('Отчёт о запуске скопирован'); }, function(){ toast('Не удалось скопировать — браузер не дал доступ к буферу'); });
  }
  function rhCsv(){
    var q = function(v){ v = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Запуск', 'Дата и время', 'Длительность, мс', 'Итог', 'Блок', 'Язык', 'Статус', 'Время блока, мс', 'Сообщение']];
    rhList().forEach(function(r){
      var st = r.stopped ? 'остановлен' : r.err ? 'с ошибками' : 'успешно';
      r.blocks.forEach(function(b){ rows.push([r.id, new Date(r.t).toLocaleString('ru-RU'), r.ms, st, b.name, b.lang, CMP_ST[b.s] || b.s, b.ms === null || b.ms === undefined ? '' : b.ms, b.s !== 'ok' ? b.info : '']); });
    });
    var csv = '﻿' + rows.map(function(r){ return r.map(q).join(';'); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    a.download = 'Запуски — ' + (curProj() ? curProj().name : 'схема') + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }
  rhBadge();
