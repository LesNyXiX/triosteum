  /* ---------- корзина при перетаскивании ----------
     Пока что-то тащат (файл на рабочем столе, блок или заметку на доске), внизу всплывает кружок с корзиной.
     Навели — корзина «открывает крышку» и притягивает; отпустили — элементы улетают в неё и удаляются.
     trashShow(area) · trashOver(x, y) → true, если над корзиной · trashHide() · trashEat(els, done) */
  var TRASH = { el:null, on:false, hot:false, cx:0, cy:0, r:34 };
  function trashEl(){
    if(TRASH.el) return TRASH.el;
    var d = document.createElement('div');
    d.className = 'drop-trash'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="dt-tip">Перетащите сюда, чтобы удалить</div><div class="dt-ring"></div><div class="dt-ball">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="dt-lid"><path d="M3.5 6.5h17"/><path d="M9 6.5V4.2h6v2.3"/></g>' +
      '<path d="M5.8 6.5l1 13.3c.1.9.8 1.6 1.7 1.6h7c.9 0 1.6-.7 1.7-1.6l1-13.3"/><path class="dt-ln" d="M10 10.5v6.5M14 10.5v6.5"/></svg></div>';
    document.body.appendChild(d); TRASH.el = d; return d;
  }
  // area — элемент, внизу которого появляется корзина (доска, рабочий стол)
  function trashShow(area){
    var d = trashEl(), r = (area || document.body).getBoundingClientRect();
    TRASH.cx = r.left + r.width / 2; TRASH.cy = Math.min(window.innerHeight, r.bottom) - 64;
    d.style.left = TRASH.cx + 'px'; d.style.top = TRASH.cy + 'px';
    if(TRASH.on) return;
    TRASH.on = true; TRASH.hot = false;
    d.classList.remove('hot', 'eat', 'out'); void d.offsetWidth; d.classList.add('on'); document.body.classList.add('trash-on');
  }
  function trashOver(x, y){
    if(!TRASH.on) return false;
    var dx = x - TRASH.cx, dy = y - TRASH.cy, hot = dx * dx + dy * dy < (TRASH.r + (TRASH.hot ? 30 : 18)) * (TRASH.r + (TRASH.hot ? 30 : 18));
    if(hot !== TRASH.hot){
      TRASH.hot = hot; TRASH.el.classList.toggle('hot', hot);
      TRASH.el.querySelector('.dt-tip').textContent = hot ? 'Отпустите — удалится' : 'Перетащите сюда, чтобы удалить';
      if(hot && navigator.vibrate) try { navigator.vibrate(12); } catch(e){}
    }
    return hot;
  }
  function trashHide(){
    if(!TRASH.on) return; TRASH.on = false; TRASH.hot = false;
    var d = TRASH.el; d.classList.remove('on', 'hot'); d.classList.add('out'); document.body.classList.remove('trash-on');
  }
  // элементы улетают в корзину, корзина «глотает», затем done() удаляет их по-настоящему
  function trashEat(els, done){
    var d = trashEl(), still = document.body.classList.contains('noanim') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    TRASH.on = false; TRASH.hot = false;
    if(still){ d.classList.remove('on', 'hot'); d.classList.add('out'); document.body.classList.remove('trash-on'); done(); return; }
    var flies = [];
    (els || []).filter(Boolean).forEach(function(el, i){
      var r = el.getBoundingClientRect(); if(!r.width) return;
      var c = el.cloneNode(true); c.removeAttribute('id'); c.classList.add('dt-fly'); c.classList.remove('dragging', 'drag', 'sel', 'to-trash');
      c.style.cssText += ';position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;margin:0;transform:none;transform-origin:50% 50%;z-index:171;pointer-events:none;';
      document.body.appendChild(c); el.style.visibility = 'hidden';
      var tx = TRASH.cx - (r.left + r.width / 2), ty = TRASH.cy - (r.top + r.height / 2), k = Math.min(0.12, 40 / Math.max(r.width, r.height));
      flies.push(c);
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        c.style.transition = 'transform .42s cubic-bezier(.55,0,.75,.2) ' + (i * 0.04) + 's, opacity .42s ease-in ' + (i * 0.04) + 's, filter .42s';
        c.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + k + ') rotate(' + (i % 2 ? -14 : 14) + 'deg)';
        c.style.opacity = '0.15'; c.style.filter = 'blur(1px)';
      }); });
    });
    var wait = 420 + Math.min(4, flies.length) * 40;
    setTimeout(function(){
      flies.forEach(function(c){ c.remove(); });
      d.classList.remove('hot'); d.classList.add('eat');
      done();
      setTimeout(function(){ d.classList.remove('on', 'eat'); d.classList.add('out'); document.body.classList.remove('trash-on'); }, 420);
    }, wait);
  }
