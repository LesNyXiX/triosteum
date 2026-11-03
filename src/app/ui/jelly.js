  /* ---------- «желе»: элементы тянутся за курсором и пружинят при остановке ---------- */
  function jellyOff(){ return document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches); }
  function jellyMove(st, e, el){
    if(!el || jellyOff()) return;
    var now = performance.now();
    if(st.jt === undefined){ st.jx = e.clientX; st.jy = e.clientY; st.jt = now; st.vx = 0; st.vy = 0; el.classList.remove('jelly-end'); el.classList.add('jelly-on'); return; }
    var dt = Math.max(8, now - st.jt), vx = (e.clientX - st.jx) / dt, vy = (e.clientY - st.jy) / dt;
    st.vx = st.vx * 0.6 + vx * 0.4; st.vy = st.vy * 0.6 + vy * 0.4; st.jx = e.clientX; st.jy = e.clientY; st.jt = now;
    var sp = Math.min(0.09, Math.hypot(st.vx, st.vy) * 0.035), a = Math.atan2(st.vy, st.vx) * 180 / Math.PI;
    var sk = Math.max(-10, Math.min(10, -st.vx * 5)), sy = Math.max(-5, Math.min(5, -st.vy * 2));
    el.style.transform = 'skew(' + sk.toFixed(2) + 'deg,' + sy.toFixed(2) + 'deg) rotate(' + a.toFixed(1) + 'deg) scale(' + (1 + sp).toFixed(3) + ',' + (1 - sp * 0.8).toFixed(3) + ') rotate(' + (-a).toFixed(1) + 'deg)';
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
