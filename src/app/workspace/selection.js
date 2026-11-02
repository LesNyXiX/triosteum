  // ---------- выделение: Shift+клик и рамка ----------
  function toggleMulti(type, id){
    var m = (S.multi || []).slice();
    if(S.sel && (S.sel.type === 'node' || S.sel.type === 'note') && !m.some(function(x){ return x.type === S.sel.type && x.id === S.sel.id; })) m.push({ type:S.sel.type, id:S.sel.id });
    var i = -1; m.forEach(function(x, j){ if(x.type === type && x.id === id) i = j; });
    if(i >= 0) m.splice(i, 1); else m.push({ type:type, id:id });
    S.multi = m; S.sel = null; hidePop(); updateSel();
  }
  function startMarquee(e){
    hidePop();
    var base = (S.multi || []).slice();
    if(S.sel && (S.sel.type === 'node' || S.sel.type === 'note') && !inMulti(S.sel.type, S.sel.id)) base.push({ type:S.sel.type, id:S.sel.id });
    var mq = document.createElement('div'); mq.className = 'marquee'; el.canvas.appendChild(mq);
    drag = { mode:'marquee', sx:e.clientX, sy:e.clientY, ex:e.clientX, ey:e.clientY, el:mq, base:base };
    moveMarquee(e);
  }
  function moveMarquee(e){
    var r = el.canvas.getBoundingClientRect();
    drag.ex = e.clientX; drag.ey = e.clientY;
    var x = Math.min(drag.sx, drag.ex) - r.left, y = Math.min(drag.sy, drag.ey) - r.top;
    drag.el.style.left = x + 'px'; drag.el.style.top = y + 'px';
    drag.el.style.width = Math.abs(drag.ex - drag.sx) + 'px'; drag.el.style.height = Math.abs(drag.ey - drag.sy) + 'px';
  }
  function endMarquee(dd){
    dd.el.remove();
    var a = toWorld(Math.min(dd.sx, dd.ex), Math.min(dd.sy, dd.ey)), b = toWorld(Math.max(dd.sx, dd.ex), Math.max(dd.sy, dd.ey));
    function hit(x, y, w, hh){ return x < b.x && x + w > a.x && y < b.y && y + hh > a.y; }
    var sel = dd.base.slice();
    function add(type, id){ if(!sel.some(function(m){ return m.type === type && m.id === id; })) sel.push({ type:type, id:id }); }
    if(Math.abs(dd.ex - dd.sx) + Math.abs(dd.ey - dd.sy) > 4){
      G.nodes.forEach(function(n){ if(hit(n.x, n.y, NWof(n), NHof(n))) add('node', n.id); });
      G.notes.forEach(function(t){ if(t.attach || t.hidden) return; var d = domOf('note', t.id); if(hit(t.x, t.y, d ? d.offsetWidth : 160, d ? d.offsetHeight : 40)) add('note', t.id); });
    }
    S.sel = null; S.multi = sel; updateSel();
    if(sel.length) toast('Выделено элементов: ' + sel.length + (sel.length > 1 ? ' — правый клик: выровнять' : ''));
  }
