  /* =====================================================================
     НАДЁЖНОСТЬ ЗАПУСКА — настройки блока для отладки и работы «в бою»
     • Выключить блок: при запуске он пропускается, входные данные идут дальше без изменений.
     • Закрепить результат: блок не выполняется, следующие получают сохранённый результат
       (не дёргаем 1С, почту и внешние сервисы при каждой проверке схемы).
     • Повторять при ошибке: 1–5 повторов с растущей паузой — для нестабильных сетевых вызовов.
     • Продолжать схему при ошибке: иначе блоки ниже упавшего пропускаются.
     Само выполнение — в runBoard() (board/compile.js); здесь — интерфейс и метки на блоках.
     ===================================================================== */
  var PIN_MAX = 200000;   // символов JSON: больше — не закрепляем, чтобы не раздувать сохранение

  function nodeLast(n){ return CMP && CMP.last && Object.prototype.hasOwnProperty.call(CMP.last, n.id) ? CMP.last[n.id] : undefined; }
  // служебная ссылка записи маршрута на документ текущего запуска (__doc) в снимок не попадает;
  // убираем только её и только у самих записей — вложенные пользовательские поля «__…» сохраняем
  function pinClean(v){
    function rec(r){ if(!r || typeof r !== 'object' || Array.isArray(r) || !('__doc' in r)) return r; var o = {}; for(var k in r){ if(k !== '__doc') o[k] = r[k]; } return o; }
    return Array.isArray(v) ? v.map(rec) : rec(v);
  }
  // блоки маршрута, которые создают документы, меняют их статус или выгружают их, работают с документами
  // текущего запуска — снимок их результата был бы ссылкой на старые документы, поэтому их не закрепляем
  var PIN_NO = { doc:'создаёт документы', step:'меняет статус документов', send:'выгружает документы', cond:'направляет документы по условию' };
  function pinAllowed(n){ return !!n && n.kind !== 'hub' && !PIN_NO[n.lang]; }
  function pinNode(n, v){
    if(!pinAllowed(n)){ toast('Результат «' + n.name + '» нельзя закрепить: блок ' + (PIN_NO[n.lang] || 'служебный') + ' — он выполняется при каждом запуске'); return false; }
    var j; try { j = JSON.stringify(pinClean(v)); } catch(e){ j = null; }
    if(j === undefined || j === null && v !== null){ toast('Этот результат нельзя закрепить'); return false; }
    if(j && j.length > PIN_MAX){ toast('Результат слишком большой для закрепления (' + Math.round(j.length / 1000) + ' тыс. символов, можно до ' + PIN_MAX / 1000 + ' тыс.)'); return false; }
    // элементы результатов маршрута от этого блока (показатели, диаграммы, таблицы) — вместе с записями, их берёт дашборд
    var it = CMP && CMP.lastItems && CMP.lastItems[n.id], ij = null;
    if(it && it.length){ try { ij = JSON.stringify(it); } catch(e){ ij = null; } }
    if(ij && (j || '').length + ij.length > PIN_MAX){ toast('Результат слишком большой для закрепления (' + Math.round(((j || '').length + ij.length) / 1000) + ' тыс. символов, можно до ' + PIN_MAX / 1000 + ' тыс.)'); return false; }
    n.pin = { v:v === undefined ? null : JSON.parse(j || 'null'), t:Date.now() };
    if(ij) n.pin.items = JSON.parse(ij);
    refreshNode(n); return true;
  }
  function unpinNode(n){ delete n.pin; refreshNode(n); }
  function setNodeOff(n, off){ if(off) n.off = true; else delete n.off; refreshNode(n); }
  function runOptsBrief(n){
    var a = [];
    if(n.off) a.push('выключен');
    if(n.pin) a.push('результат закреплён');
    if(n.retry) a.push('повторов: ' + n.retry);
    if(n.cont) a.push('продолжать при ошибке');
    return a.join(' · ');
  }

  // последние результаты принадлежат пространству: при смене графа (другое пространство, загрузка с сервера)
  // сбрасываем их, иначе блок с тем же id мог бы закрепить чужой результат
  (function(){
    var _sg = setGraph;
    setGraph = function(o){ if(CMP){ CMP.last = {}; CMP.lastItems = {}; } return _sg(o); };
  })();
  // элементы результатов последнего запуска маршрута по блокам. Запуск маршрута создаёт новый RES.items —
  // по нему и отличаем: запуск кодовой доски старые элементы маршрута не трогает
  (function(){
    var seen = null, _end = cmpEnd;
    cmpEnd = function(results){
      if(results && typeof RES !== 'undefined' && RES && RES.items && RES.items !== seen){
        seen = RES.items; CMP.lastItems = CMP.lastItems || {};
        // только блоки, успешно выполненные в этом запуске: при запуске выделенного results дополнен прежними
        // результатами (cmpSeed), а при остановке или ошибке CMP.last блока остаётся прежним — их кэш не трогаем
        var ran = {}; (CMP.order || []).forEach(function(id){ var b = CMP.blocks && CMP.blocks[id]; if(b && b.s === 'ok') ran[id] = 1; });
        for(var k in ran) delete CMP.lastItems[k];
        RES.items.forEach(function(x){
          if(!x || !x.node || !ran[x.node] || x.type === 'doc' || x.type === 'pack') return;
          (CMP.lastItems[x.node] = CMP.lastItems[x.node] || []).push(x);
        });
      }
      return _end.apply(this, arguments);
    };
  })();

  // метки на блоке: выключен, закреплён, повторы
  (function(){
    var _nodeEl = nodeEl;
    nodeEl = function(n){
      var d = _nodeEl(n);
      if(n.kind === 'hub') return d;
      d.classList.toggle('n-off', !!n.off);
      d.classList.toggle('n-pin', !!n.pin);
      var marks = [];
      if(n.off) marks.push(['off', 'выкл', 'Блок выключен: при запуске пропускается']);
      if(n.pin) marks.push(['pin', '📌', 'Результат закреплён' + (n.pin.t ? ' ' + new Date(n.pin.t).toLocaleString('ru-RU') : '') + ': блок не выполняется']);
      if(n.retry) marks.push(['retry', '↻' + n.retry, 'Повторять при ошибке: ' + n.retry]);
      if(n.cont) marks.push(['cont', '⤳', 'Продолжать схему при ошибке']);
      if(marks.length){
        var box = document.createElement('span'); box.className = 'nmarks';
        marks.forEach(function(m){ var s = document.createElement('span'); s.className = 'nmark ' + m[0]; s.textContent = m[1]; s.title = m[2]; s.setAttribute('aria-label', m[2]); box.appendChild(s); });
        d.appendChild(box);
      }
      return d;
    };
  })();

  // раздел «Запуск» в настройках блока (ПКМ по блоку)
  function runOptsSection(n){
    var last = nodeLast(n), box = h('div', { 'class':'ropts' });
    box.appendChild(toggleRow('Блок включён', !n.off, function(v){ setNodeOff(n, !v); renderPop(); }));
    var pinRow = h('div', { 'class':'ropts-pin' });
    if(!pinAllowed(n) && !n.pin){
      pinRow.appendChild(h('div', { 'class':'ropts-note', text:'Закрепить результат нельзя: блок ' + (PIN_NO[n.lang] || 'служебный') + ' и выполняется при каждом запуске.' }));
    } else if(n.pin){
      var pj = JSON.stringify(n.pin.v);
      pinRow.appendChild(h('div', { 'class':'ropts-note', text:'📌 Закреплён результат' + (n.pin.t ? ' от ' + new Date(n.pin.t).toLocaleString('ru-RU') : '') + ': ' + (pj && pj.length > 120 ? pj.slice(0, 120) + '…' : pj) }));
      pinRow.appendChild(h('div', { 'class':'acts' }, [
        last !== undefined ? h('button', { type:'button', 'class':'btn sm', text:'Обновить из последнего запуска', on:{ click:function(){ if(pinNode(n, last)) { toast('Закреплённый результат обновлён'); renderPop(); } } } }) : null,
        h('button', { type:'button', 'class':'btn sm', text:'Открепить', on:{ click:function(){ unpinNode(n); toast('Результат откреплён — блок снова выполняется'); renderPop(); } } })
      ]));
    } else {
      pinRow.appendChild(h('button', { type:'button', 'class':'btn sm', style:'width:100%', text:last !== undefined ? 'Закрепить результат последнего запуска' : 'Закрепить результат — сначала запустите схему',
        disabled:last !== undefined ? null : 'disabled', title:'Блок перестанет выполняться, следующие получат сохранённый результат',
        on:{ click:function(){ if(pinNode(n, last)){ toast('Результат «' + n.name + '» закреплён'); renderPop(); } } } }));
    }
    box.appendChild(pinRow);
    var seg = h('div', { 'class':'seg ropts-retry', role:'radiogroup', 'aria-label':'Повторять при ошибке' });
    [0, 1, 2, 3, 5].forEach(function(k){
      var on = (n.retry | 0) === k;
      seg.appendChild(h('button', { type:'button', role:'radio', 'aria-checked':on ? 'true' : 'false', 'class':'btn sm' + (on ? ' primary' : ''), text:k ? '×' + k : 'нет',
        on:{ click:function(){ if(k) n.retry = k; else delete n.retry; refreshNode(n); renderPop(); } } }));
    });
    box.appendChild(h('div', { 'class':'flabel', text:'Повторять при ошибке' }));
    box.appendChild(seg);
    box.appendChild(toggleRow('Продолжать схему при ошибке', !!n.cont, function(v){ if(v) n.cont = true; else delete n.cont; refreshNode(n); renderPop(); }));
    return box;
  }
  (function(){
    var _rnp = renderNodePop;
    renderNodePop = function(p, n){
      _rnp(p, n);
      if(!n || n.kind === 'hub' || isDocs()) return;
      var sec = section('Запуск', runOptsSection(n));
      var host = p.querySelector('#popDesc');                   // «Запуск» — сразу после описания: важнее размеров и шрифтов
      while(host && host.parentNode !== p) host = host.parentNode;
      if(host) p.insertBefore(sec, host.nextSibling); else p.appendChild(sec);
    };
  })();

  // команды палитры: для выделенных блоков
  function runOptsTargets(){ var ids = (S.multi && S.multi.length) ? S.multi.filter(function(x){ return x.type === 'node'; }).map(function(x){ return x.id; }) : (S.sel && S.sel.type === 'node' ? [S.sel.id] : []); return ids.map(nodeById).filter(function(n){ return n && n.kind !== 'hub'; }); }
  (function(){
    var _cc = cmdCommands;
    cmdCommands = function(){
      var t = runOptsTargets(), w = t.length === 1 ? '«' + t[0].name + '»' : t.length + ' блоков';
      var extra = t.length ? [
        { sec:'board', label:(t.every(function(n){ return n.off; }) ? 'Включить ' : 'Выключить ') + w, d:'Выключенный блок пропускается при запуске, данные идут дальше', icon:'run', k:'выключить отключить пропустить блок disable',
          act:function(){ var on = t.every(function(n){ return n.off; }); t.forEach(function(n){ setNodeOff(n, !on); }); toast(on ? 'Включено: ' + w : 'Выключено: ' + w); } },
        { sec:'board', label:'Закрепить результат: ' + w, d:'Блок не выполняется — следующие получают результат последнего запуска', icon:'run', k:'закрепить результат pin данные',
          act:function(){ var k = 0; t.forEach(function(n){ var v = nodeLast(n); if(v !== undefined && pinNode(n, v)) k++; }); toast(k ? 'Закреплено: ' + k : 'Нечего закреплять — сначала запустите схему'); } },
        { sec:'board', label:'Открепить результат: ' + w, icon:'run', k:'открепить unpin', act:function(){ t.forEach(function(n){ if(n.pin) unpinNode(n); }); toast('Откреплено'); } }
      ] : [];
      var pinned = G.nodes.filter(function(n){ return n.pin; });
      if(pinned.length) extra.push({ sec:'board', label:'Открепить все результаты (' + pinned.length + ')', d:'Все блоки снова выполняются по-настоящему', icon:'run', k:'открепить все unpin',
        act:function(){ pinned.forEach(function(n){ delete n.pin; refreshNode(n); }); toast('Все результаты откреплены'); } });
      return _cc().concat(extra);
    };
  })();
