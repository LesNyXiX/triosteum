  /* =====================================================================
     ГРУППЫ БЛОКОВ — именованные цветные рамки вокруг части схемы
     Большие схемы читаются по разделам: «Сбор данных», «Расчёт», «Отчёты». Рамка охватывает свои
     блоки и следует за ними; за заголовок группу двигают целиком; ▶ запускает только её блоки
     (входы от блоков вне группы берутся из последнего запуска). Ctrl+G — сгруппировать выделенное.
     Хранится в G.groups: { id, name, color, ids:[id блоков] }.
     ===================================================================== */
  var GRP_COLORS = ['#60A5FA', '#34D399', '#F59E0B', '#F472B6', '#A78BFA', '#94A3B8'];
  var GRP_PAD = 26, GRP_HEAD = 30;
  var grpLayer = document.createElement('div');
  grpLayer.id = 'grpLayer'; grpLayer.className = 'grp-layer';
  el.world.insertBefore(grpLayer, el.world.firstChild);   // самый нижний слой: под связями и блоками

  function grpList(){ return Array.isArray(G.groups) ? G.groups : []; }
  function grpOf(nodeId){ return grpList().filter(function(g){ return g.ids.indexOf(nodeId) >= 0; })[0] || null; }
  function grpClean(){   // удалённые блоки уходят из групп, пустые группы исчезают
    if(!Array.isArray(G.groups)) return;
    G.groups.forEach(function(g){ g.ids = g.ids.filter(function(id){ return !!nodeById(id); }); });
    G.groups = G.groups.filter(function(g){ return g.ids.length; });
  }
  function grpBox(g){
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    g.ids.forEach(function(id){ var n = nodeById(id); if(!n) return; x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + NWof(n)); y2 = Math.max(y2, n.y + NHof(n)); });
    if(x1 === Infinity) return null;
    return { x:x1 - GRP_PAD, y:y1 - GRP_PAD - GRP_HEAD, w:x2 - x1 + GRP_PAD * 2, h:y2 - y1 + GRP_PAD * 2 + GRP_HEAD };
  }

  function grpRender(){
    grpClean();
    var have = {};
    grpList().forEach(function(g){
      have[g.id] = 1;
      var d = grpLayer.querySelector('.grp[data-id="' + g.id + '"]') || grpEl(g);
      grpPlace(d, g);
    });
    Array.prototype.forEach.call(grpLayer.querySelectorAll('.grp'), function(d){ if(!have[d.dataset.id]) d.remove(); });
  }
  function grpPlace(d, g){
    var b = grpBox(g); if(!b){ d.hidden = true; return; }
    d.hidden = false;
    d.style.left = b.x + 'px'; d.style.top = b.y + 'px'; d.style.width = b.w + 'px'; d.style.height = b.h + 'px';
    d.style.setProperty('--gc', g.color || GRP_COLORS[0]);
    var t = d.querySelector('.grp-name'); if(t && t.textContent !== g.name) t.textContent = g.name;   // во время переименования на месте названия — поле ввода
    d.querySelector('.grp-cnt').textContent = g.ids.length;
  }
  function grpMoved(ids){   // пересчитать только рамки групп, в которые входят сдвинутые блоки
    var m = {}; (ids || []).forEach(function(id){ m[id] = 1; });
    grpList().forEach(function(g){
      if(!g.ids.some(function(id){ return m[id]; })) return;
      var d = grpLayer.querySelector('.grp[data-id="' + g.id + '"]');
      if(d) grpPlace(d, g); else grpRender();
    });
  }
  function grpEl(g){
    var d = h('div', { 'class':'grp', 'data-id':g.id });
    var head = h('div', { 'class':'grp-h', title:'Потяните, чтобы передвинуть группу; двойной щелчок — переименовать' }, [
      h('span', { 'class':'grp-name' }), h('span', { 'class':'grp-cnt', 'aria-label':'блоков в группе' }),
      h('button', { type:'button', 'class':'grp-b', 'aria-label':'Запустить только эту группу', title:'Запустить только эту группу', text:'▶', on:{ click:function(e){ e.stopPropagation(); grpRun(grpById(d.dataset.id)); } } }),
      h('button', { type:'button', 'class':'grp-b', 'aria-label':'Действия с группой', title:'Действия с группой', text:'⋯', on:{ click:function(e){ e.stopPropagation(); grpMenu(grpById(d.dataset.id), e.currentTarget); } } })
    ]);
    // доска ловит указатель на себя (захват) — без stopPropagation щелчок по кнопкам заголовка до них не доходит
    head.addEventListener('pointerdown', function(e){ e.stopPropagation(); if(e.button !== 0 || e.target.closest('button,input')) return; grpDrag(e, grpById(d.dataset.id)); });
    head.addEventListener('dblclick', function(e){ if(!e.target.closest('button')) grpRename(grpById(d.dataset.id)); });
    d.appendChild(head);
    grpLayer.appendChild(d);
    return d;
  }
  function grpById(id){ return grpList().filter(function(g){ return g.id === id; })[0] || null; }

  // перетаскивание за заголовок: двигаются все блоки группы
  function grpDrag(e, g){
    if(!g) return;
    e.preventDefault(); e.stopPropagation();
    var k = G.cam.k || 1, sx = e.clientX, sy = e.clientY, start = g.ids.map(function(id){ var n = nodeById(id); return n ? [n, n.x, n.y] : null; }).filter(Boolean), moved = false, raf = 0;
    var head = e.currentTarget; try { head.setPointerCapture(e.pointerId); } catch(er){}
    grpSelect(g, true);
    function move(ev){
      var dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if(!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      start.forEach(function(s){ s[0].x = Math.round(s[1] + dx); s[0].y = Math.round(s[2] + dy); var dn = domOf('node', s[0].id); if(dn){ dn.style.left = s[0].x + 'px'; dn.style.top = s[0].y + 'px'; }
        commentsOf(s[0].id).forEach(function(t){ syncNote(t); var cd = domOf('note', t.id); if(cd){ cd.style.left = t.x + 'px'; cd.style.top = t.y + 'px'; } });   // прикреплённые комментарии едут вместе с блоком
      });
      if(!raf) raf = requestAnimationFrame(function(){ raf = 0; edgesMoved(g.ids); });
    }
    function up(){
      head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up);
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      if(moved){ edgesMoved(g.ids); saveGraph(); }
    }
    head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
  }
  function grpSelect(g, quiet){
    if(!g) return;
    S.sel = null; S.multi = g.ids.map(function(id){ return { type:'node', id:id }; }); hidePop(); updateSel();
    if(!quiet) toast('Выделено блоков: ' + g.ids.length);
  }
  function grpRun(g){
    if(!g || CMP.busy) return;
    var ids = {}; g.ids.forEach(function(id){ ids[id] = 1; });
    CMP.only = ids; runBoard();
  }
  function grpRename(g){
    if(!g) return;
    var d = grpLayer.querySelector('.grp[data-id="' + g.id + '"]'), t = d && d.querySelector('.grp-name'); if(!t) return;
    var inp = h('input', { 'class':'grp-in', maxlength:'60', 'aria-label':'Название группы' }); inp.value = g.name;
    t.replaceWith(inp); inp.focus(); inp.select();
    var done = false;
    function fin(save){
      if(done) return; done = true;
      if(save){ var v = inp.value.trim(); if(v) g.name = v; }
      inp.replaceWith(t); t.textContent = g.name; saveGraph();
    }
    inp.addEventListener('keydown', function(ev){ ev.stopPropagation(); if(ev.key === 'Enter') fin(true); else if(ev.key === 'Escape') fin(false); });
    inp.addEventListener('blur', function(){ fin(true); });
    inp.addEventListener('pointerdown', function(ev){ ev.stopPropagation(); });
  }
  function grpMenu(g, anchor){
    if(!g) return;
    var r = anchor.getBoundingClientRect();
    openMenuAt([
      { head:g.name + ' · блоков: ' + g.ids.length },
      { label:'Запустить только группу', icon:'run', act:function(){ grpRun(g); } },
      { label:'Выделить блоки группы', icon:'all', act:function(){ grpSelect(g); } },
      { label:'Переименовать', icon:'edit', act:function(){ grpRename(g); } },
      { label:'Цвет', icon:'pers', sub:GRP_COLORS.map(function(c, i){ return { label:['Синий', 'Зелёный', 'Янтарный', 'Розовый', 'Фиолетовый', 'Серый'][i] + (g.color === c ? '  ✓' : ''), swatch:c, act:function(){ g.color = c; grpRender(); saveGraph(); } }; }) },
      { sep:true },
      { label:'Разгруппировать', icon:'trash', act:function(){ G.groups = grpList().filter(function(x){ return x !== g; }); grpRender(); saveGraph(); toast('Группа «' + g.name + '» снята, блоки на месте'); } }
    ], r.left, r.bottom + 4, anchor);
  }
  function grpTargets(){ var m = (S.multi || []).filter(function(x){ return x.type === 'node'; }).map(function(x){ return x.id; }); if(!m.length && S.sel && S.sel.type === 'node') m = [S.sel.id]; return m.filter(function(id){ var n = nodeById(id); return n; }); }
  function grpCreate(){
    var ids = grpTargets();
    if(!ids.length){ toast('Выделите блоки (Shift+щелчок или рамкой), затем Ctrl+G'); return; }
    if(!Array.isArray(G.groups)) G.groups = [];
    G.groups.forEach(function(g){ g.ids = g.ids.filter(function(id){ return ids.indexOf(id) < 0; }); });   // блок — только в одной группе
    var n = grpList().length + 1, g = { id:'g' + Date.now().toString(36), name:'Группа ' + n, color:GRP_COLORS[(n - 1) % GRP_COLORS.length], ids:ids };
    G.groups.push(g); grpRender(); saveGraph();
    toast('Группа из ' + ids.length + ' ' + plural(ids.length, 'блока', 'блоков', 'блоков') + ' — двойной щелчок по названию, чтобы переименовать');
    setTimeout(function(){ grpRename(g); }, 50);
  }
  function grpRemoveSel(){
    var ids = grpTargets(), k = 0;
    grpList().forEach(function(g){ var before = g.ids.length; g.ids = g.ids.filter(function(id){ return ids.indexOf(id) < 0; }); k += before - g.ids.length; });
    grpRender(); saveGraph(); toast(k ? 'Убрано из групп: ' + k : 'Выделенные блоки не входят в группы');
  }

  (function(){
    var _norm = normGraph;
    normGraph = function(o){ var g = _norm(o); if(o && Array.isArray(o.groups)) g.groups = JSON.parse(JSON.stringify(o.groups)); return g; };
    // группы — в истории отмены вместе с блоками
    var _snap = snap;
    snap = function(){ var s = _snap(); return s.slice(0, -1) + ',"groups":' + JSON.stringify(grpList()) + '}'; };
    var _restore = restoreSnap;
    restoreSnap = function(s){ try { var o = JSON.parse(s); G.groups = Array.isArray(o.groups) ? o.groups : []; } catch(e){} return _restore(s); };
    var _rg = renderGraph;
    renderGraph = function(){ var r = _rg.apply(this, arguments); grpRender(); return r; };
    var _re = renderEdges;   // блоки двигают по-разному (перетаскивание, выравнивание, стрелки) — рамки догоняют вместе со связями
    renderEdges = function(){ var r = _re.apply(this, arguments); if(grpList().length) grpRender(); return r; };
    // быстрый путь (edgeFast) обновляет только затронутые связи и не зовёт renderEdges — рамки этих блоков двигаем отдельно
    var _em = edgesMoved;
    edgesMoved = function(ids){ var r = _em.apply(this, arguments); grpMoved(ids); return r; };
    var _cc = cmdCommands;
    cmdCommands = function(){
      var t = grpTargets(), extra = [
        { sec:'board', label:'Сгруппировать выделенные блоки', d:'Рамка с названием: двигается целиком, запускается отдельно', icon:'layout', kb:MOD + 'G', act:grpCreate, k:'группа рамка раздел сгруппировать group frame' }
      ];
      if(t.length && t.some(function(id){ return grpOf(id); })) extra.push({ sec:'board', label:'Убрать выделенные из группы', icon:'layout', act:grpRemoveSel, k:'разгруппировать убрать из группы' });
      grpList().forEach(function(g){ extra.push({ sec:'board', label:'Группа «' + g.name + '»: запустить', d:'Блоков: ' + g.ids.length, icon:'run', act:function(){ grpRun(g); }, k:'группа запустить ' + g.name }); });
      return _cc().concat(extra);
    };
  })();
  document.addEventListener('keydown', function(e){
    if(!(e.ctrlKey || e.metaKey) || e.altKey || e.code !== 'KeyG') return;
    if(e.target.closest && e.target.closest('input,textarea,[contenteditable="true"],.cm-editor,#editor')) return;
    if(S.view !== 'canvas') return;
    e.preventDefault();
    if(e.shiftKey) grpRemoveSel(); else grpCreate();
  });
