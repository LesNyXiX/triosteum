  /* ---------- «желе»: элементы тянутся за курсором и пружинят при остановке ---------- */
  function jellyOff(){ return document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches); }
  function jellyMove(st, e, el){
    if(!el || jellyOff()) return;
    var now = performance.now();
    if(st.jt === undefined){ st.jx = e.clientX; st.jy = e.clientY; st.jt = now; st.vx = 0; st.vy = 0; el.classList.remove('jelly-end'); el.classList.add('jelly-on'); return; }
    var dt = Math.max(8, now - st.jt), vx = (e.clientX - st.jx) / dt, vy = (e.clientY - st.jy) / dt;
    st.vx = st.vx * 0.6 + vx * 0.4; st.vy = st.vy * 0.6 + vy * 0.4; st.jx = e.clientX; st.jy = e.clientY; st.jt = now;
    // лёгкая деформация: вытягивание по направлению движения и небольшой наклон «отстающей» части
    var speed = Math.hypot(st.vx, st.vy), sp = Math.min(0.04, speed * 0.018), hor = Math.abs(st.vx) >= Math.abs(st.vy);
    var sk = Math.max(-4, Math.min(4, -st.vx * 2.2));
    el.style.transform = 'skewX(' + sk.toFixed(2) + 'deg) scale(' + (hor ? 1 + sp : 1 - sp * 0.7).toFixed(3) + ',' + (hor ? 1 - sp * 0.7 : 1 + sp).toFixed(3) + ')';
    clearTimeout(st.jidle);
    st.jidle = setTimeout(function(){ st.vx = 0; st.vy = 0; el.style.transform = ''; }, 90);
  }
  // отпустили — короткая пружинящая волна
  function jellyEnd(st, el){
    if(!el) return;
    if(st) clearTimeout(st.jidle);
    el.style.transform = ''; el.classList.remove('jelly-on');
    if(jellyOff()) return;
    el.classList.remove('jelly-end'); void el.offsetWidth; el.classList.add('jelly-end');
    setTimeout(function(){ el.classList.remove('jelly-end'); }, 620);
  }
  document.addEventListener('pointerup', function(){ setTimeout(function(){ Array.prototype.forEach.call(document.querySelectorAll('.jelly-on'), function(x){ if(!x.classList.contains('dragging')){ x.style.transform = ''; x.classList.remove('jelly-on'); } }); }, 0); }, true);
