  /* ---------- камера ---------- */
  // сетка доски — отдельный слой, который только сдвигается (transform): при панораме экран не перерисовывается
  var gridBg = document.createElement('div'); gridBg.className = 'grid-bg'; gridBg.setAttribute('aria-hidden', 'true'); el.canvas.insertBefore(gridBg, el.canvas.firstChild);
  var gridG = 0;
  function applyCam(){
    var c = G.cam;
    el.world.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px) scale(' + c.k + ')';
    if(c.k !== camK){ camK = c.k; el.world.style.setProperty('--ik', 1 / c.k); }   // курсоры коллег не масштабируются вместе с доской; переменную меняем только при смене масштаба — иначе браузер пересчитывает стили всех блоков
    var g = Math.round(24 * c.k * 100) / 100;
    if(g !== gridG){ gridG = g; var gs = gridBg.style; gs.backgroundSize = g + 'px ' + g + 'px'; gs.left = gs.top = -g + 'px'; gs.width = 'calc(100% + ' + (2 * g) + 'px)'; gs.height = 'calc(100% + ' + (2 * g) + 'px)'; }
    var mx = ((c.x % g) + g) % g, my = ((c.y % g) + g) % g;
    gridBg.style.transform = 'translate3d(' + mx.toFixed(2) + 'px,' + my.toFixed(2) + 'px,0)';
    // подпись масштаба и строка состояния — раз в кадр, а не на каждое событие колеса/мыши
    // во время движения не трогаем остальную страницу (подпись масштаба, строка состояния, мини-карта):
    // любая перерисовка вне доски заставляет браузер заново раскладывать все слои — это и съедало кадры
    clearTimeout(camUiT); camUiT = setTimeout(camUi, 120);
    // пока доска двигается — без дорогих эффектов (размытие заметок), браузер держит кадры ровными
    if(!camMoving){ camMoving = true; el.canvas.classList.add('moving'); }
    clearTimeout(camMoveT); camMoveT = setTimeout(function(){ camMoving = false; el.canvas.classList.remove('moving'); }, 180);
  }
  function camUi(){ var z = Math.round(G.cam.k * 100) + '%'; if(el.zVal.textContent !== z) el.zVal.textContent = z; if(S.view === 'canvas') status(); miniDraw(); }
  var camUiT = 0, camMoving = false, camMoveT = 0, camK = null;
  function toWorld(cx, cy){
    var r = el.canvas.getBoundingClientRect(), c = G.cam;
    return { x:(cx - r.left - c.x) / c.k, y:(cy - r.top - c.y) / c.k };
  }
  function zoomAt(k, cx, cy){
    var c = G.cam, r = el.canvas.getBoundingClientRect();
    k = Math.max(0.25, Math.min(3, k));
    var px = (cx === undefined ? r.width / 2 : cx - r.left), py = (cy === undefined ? r.height / 2 : cy - r.top);
    c.x = px - (px - c.x) * (k / c.k);
    c.y = py - (py - c.y) * (k / c.k);
    c.k = k;
    applyCam(); saveGraph(); hidePop();
  }
