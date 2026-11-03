  /* ---------- совместная работа: кто онлайн, курсоры, живые правки ---------- */
  // Только с сервером. Пространство — «комната» на WebSocket: сервер рассылает присутствие
  // (курсор, выделение) и каждую сохранённую правку. Чужая правка сливается с нашими
  // несохранёнными изменениями (merge3) и аккуратно вливается в G: выделение, камера,
  // перетаскивание и история отмены сохраняются.
  var LIVE = { ws:null, space:null, peers:{}, retry:0, sentSel:'', lastMove:0, pend:null, dead:false };
  function livePeersEl(){
    var c = $('livePeers');
    if(!c){ c = h('div', { 'class':'live-peers', id:'livePeers', 'aria-label':'Сейчас в пространстве' }); el.saved.parentNode.insertBefore(c, el.saved); }
    return c;
  }
  function initials(n){ return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase(); }
  function livePaint(){
    if(!SERVER) return;
    // кружки: по одному на человека (несколько вкладок одного человека — один кружок)
    var c = livePeersEl(), byUser = {};
    Object.keys(LIVE.peers).forEach(function(sid){ var p = LIVE.peers[sid]; if(p.uid !== SERVER.user.id) byUser[p.uid] = p; });
    var people = Object.keys(byUser).map(function(k){ return byUser[k]; });
    c.innerHTML = '';
    people.slice(0, 5).forEach(function(p){ c.appendChild(h('span', { 'class':'live-av', style:'background:' + p.color, title:p.name + ' — сейчас здесь', text:initials(p.name) })); });
    if(people.length > 5) c.appendChild(h('span', { 'class':'live-av more', title:people.slice(5).map(function(p){ return p.name; }).join(', '), text:'+' + (people.length - 5) }));
    // курсоры на доске
    Array.prototype.forEach.call(el.world.querySelectorAll('.live-cur'), function(x){ if(!LIVE.peers[x.dataset.sid] || !LIVE.peers[x.dataset.sid].cursor) x.remove(); });
    Object.keys(LIVE.peers).forEach(function(sid){
      var p = LIVE.peers[sid]; if(!p.cursor) return;
      var d = el.world.querySelector('.live-cur[data-sid="' + sid + '"]');
      if(!d){
        d = h('div', { 'class':'live-cur', 'data-sid':sid, 'aria-hidden':'true' });
        d.innerHTML = '<svg width="18" height="20" viewBox="0 0 18 20"><path d="M2 2l13 7.5-6 1.5-3 6z" fill="' + p.color + '" stroke="#12090B" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        d.appendChild(h('span', { style:'background:' + p.color, text:p.name }));
        el.world.appendChild(d);
      }
      d.style.setProperty('--x', p.cursor.x + 'px'); d.style.setProperty('--y', p.cursor.y + 'px');
    });
    // что выделили коллеги — обводка их цветом
    Array.prototype.forEach.call(el.nodes.children, function(nd){ nd.classList.remove('live-sel'); nd.removeAttribute('data-live'); });
    Object.keys(LIVE.peers).forEach(function(sid){
      var p = LIVE.peers[sid];
      (p.sel || []).forEach(function(id){ var nd = domOf('node', id); if(nd){ nd.classList.add('live-sel'); nd.style.setProperty('--live-c', p.color); nd.setAttribute('data-live', p.name); } });
    });
  }
  function liveSend(m){ if(LIVE.ws && LIVE.ws.readyState === 1) try{ LIVE.ws.send(JSON.stringify(m)); }catch(e){} }
  function liveConnect(){
    if(!SERVER || LIVE.dead) return;
    var id = curId(); LIVE.space = id;
    if(LIVE.ws){ try{ LIVE.ws.onclose = null; LIVE.ws.close(); }catch(e){} }
    LIVE.peers = {}; livePaint();
    var ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws/spaces/' + encodeURIComponent(id));
    LIVE.ws = ws;
    ws.onopen = function(){ LIVE.retry = 0; LIVE.sentSel = ''; };
    ws.onmessage = function(ev){
      var m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
      if(m.t === 'hello'){ SERVER.sid = m.sid; LIVE.peers = {}; (m.peers || []).forEach(function(p){ LIVE.peers[p.sid] = p; }); livePaint(); }
      else if(m.t === 'join'){ LIVE.peers[m.sid] = m; livePaint(); if(m.uid !== SERVER.user.id) el.saved.textContent = m.name + ' открыл(а) пространство'; }
      else if(m.t === 'leave'){ delete LIVE.peers[m.sid]; livePaint(); }
      else if(m.t === 'presence'){ var p = LIVE.peers[m.sid]; if(p){ if('cursor' in m) p.cursor = m.cursor; if(m.sel) p.sel = m.sel; if('file' in m) p.file = m.file; livePaint(); } }
      else if(m.t === 'rev'){ liveRemote(m); }
    };
    ws.onclose = function(ev){
      SERVER.sid = null; LIVE.peers = {}; livePaint();
      if(ev.code === 4403 || ev.code === 4401){ LIVE.dead = true; toast('Доступ к пространству закрыт'); setTimeout(function(){ location.reload(); }, 2500); return; }
      LIVE.retry = Math.min(LIVE.retry + 1, 6);
      setTimeout(function(){ if(LIVE.ws === ws) liveConnect(); }, 500 * Math.pow(2, LIVE.retry - 1));
    };
  }
  // ---- чужая правка ----
  var LIVE_KEYS = { cam:1 };
  function hpick(o){ return { nodes:o.nodes || [], edges:o.edges || [], notes:o.notes || [], seq:o.seq || 1 }; }
  function patchInto(t, src, path){
    Object.keys(t).forEach(function(k){ var p = path ? path + '.' + k : k; if(!(k in src) && !MERGE_LOCAL[p]) delete t[k]; });
    Object.keys(src).forEach(function(k){
      var p = path ? path + '.' + k : k, sv = src[k], tv = t[k];
      if(MERGE_LOCAL[p]) return;
      if(Array.isArray(sv) && Array.isArray(tv) && (mIdList(sv) || mIdList(tv))){
        var by = {}; tv.forEach(function(v){ if(mObj(v) && v.id) by[v.id] = v; });
        t[k] = sv.map(function(v){ return mObj(v) && by[v.id] ? patchInto(by[v.id], v, p + '[]') : v; });
      } else if(mObj(sv) && mObj(tv)) patchInto(tv, sv, p);
      else if(!mEq(sv, tv)) t[k] = sv;
    });
    return t;
  }
  function liveRemote(m){
    var id = m.space || LIVE.space;
    if(id !== curId()){ SERVER.remote(id, m.rev, m.content); return; }
    flushSave();                                            // наши несохранённые правки — в хранилище, они войдут в слияние
    var prevBase = SERVER.baseOf(id);
    var mine = JSON.parse(JSON.stringify(G));
    var merged = SERVER.remote(id, m.rev, m.content, mine);
    if(!merged) return;
    applyMerged(merged, prevBase, m.content, m.by);
  }
  function applyMerged(merged, prevBase, theirs, by){
    var before = JSON.stringify(hpick(G));
    patchInto(G, merged, '');
    if(JSON.stringify(hpick(G)) !== before){
      // историю отмены перестраиваем поверх чужой правки: Ctrl+Z отменяет только наше
      try{
        // чужое = то, чем итог слияния отличается от того, что было у нас на экране
        var b0 = JSON.parse(before), t0 = hpick(G);
        var rb = function(s){ return JSON.stringify(merge3(b0, JSON.parse(s), t0)); };
        hist.undo = hist.undo.map(rb); hist.redo = hist.redo.map(rb);
        // и последнее зафиксированное состояние: если мы прямо сейчас тащим блок, отмена вернёт его на исходное место
        hist.last = hist.last ? rb(hist.last) : snap();
      }catch(e){ hist.undo = []; hist.redo = []; hist.last = snap(); }
      if(S.sel && S.sel.type === 'node' && !nodeById(S.sel.id)) S.sel = null;
      if(S.sel && S.sel.type === 'note' && !noteById(S.sel.id)) S.sel = null;
      if(S.sel && S.sel.type === 'edge' && !edgeById(S.sel.id)) S.sel = null;
      S.multi = (S.multi || []).filter(function(x){ return x.type === 'node' ? nodeById(x.id) : noteById(x.id); });
      renderGraph();
      if(typeof drag !== 'undefined' && drag && drag.item && drag.type){       // перетаскивание продолжается на новом элементе
        var nd = domOf(drag.type, drag.item.id); if(nd){ drag.el = nd; nd.classList.add('dragging'); }
      }
      var fa = document.activeElement;
      if(S.pop && S.sel){ if(fa && el.pop.contains(fa)) placePop(); else renderPop(); }
      else if(S.pop && !S.sel) hidePop();
    }
    if(typeof ofLoad === 'function' && ENV && ENV.id === 'docs'){
      var fe = document.activeElement, editing = fe && fe.closest && fe.closest('#ofMain') && (fe.isContentEditable || /INPUT|TEXTAREA/.test(fe.tagName));
      if(!editing){ var keep = OF.tab; ofLoad(); if(keep && keep !== OF.tab && (keep === 'auto' || keep === 'desk' || ofFile(keep))) ofSetTab(keep); }
    }
    if(by) el.saved.textContent = 'обновлено: ' + by;
  }
  if(SERVER){
    SERVER.onMerged = function(id, merged, by, theirs, mineSent){
      if(id !== curId()) return;
      // пока шёл запрос, на экране могли появиться новые правки — сливаем и их
      var finalObj = merged;
      try{ finalObj = merge3(JSON.parse(mineSent), JSON.parse(JSON.stringify(G)), merged); }catch(e){}
      applyMerged(finalObj, null, theirs, by);
      if(!mEq(hpick(finalObj), hpick(merged)) || saveGraphTimer) saveGraph();
      if(by) toast('Правки объединены с изменениями: ' + by);
    };
    // курсор: в координатах доски, не чаще ~16 раз в секунду
    el.canvas.addEventListener('pointermove', function(e){
      if(e.pointerType !== 'mouse') return;
      var now = Date.now(); if(now - LIVE.lastMove < 60) return; LIVE.lastMove = now;
      var w = toWorld(e.clientX, e.clientY); liveSend({ t:'presence', cursor:{ x:Math.round(w.x), y:Math.round(w.y) } });
    }, { passive:true });
    el.canvas.addEventListener('pointerleave', function(){ liveSend({ t:'presence', cursor:null }); });
    // выделение и смена пространства — опросом, без вмешательства в десятки мест кода
    setInterval(function(){
      if(LIVE.space !== curId()) liveConnect();
      var sel = (S.multi && S.multi.length ? S.multi.map(function(x){ return x.id; }) : S.sel ? [S.sel.id] : []).join(',');
      if(sel !== LIVE.sentSel){ LIVE.sentSel = sel; liveSend({ t:'presence', sel:sel ? sel.split(',') : [] }); }
    }, 400);
    setInterval(function(){ liveSend({ t:'ping' }); }, 25000);
    window.addEventListener('online', function(){ if(!LIVE.ws || LIVE.ws.readyState > 1) liveConnect(); });
  }
