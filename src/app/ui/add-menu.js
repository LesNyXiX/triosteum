  /* ---------- меню «Добавление элементов» ---------- */
  var addMenu = $('addMenu'), bAdd = $('bAdd');
  function openAddMenu(anchor){
    if(typeof closeTextMenu === 'function') closeTextMenu();
    $('amBlockD').textContent = (isDocs() ? 'Тип «' + langById(S.lang).name + '». ' : 'Плагин с кодом на ' + shortName(langById(S.lang)) + '. ') + 'Нажмите на доску, чтобы поставить';
    Array.prototype.forEach.call(addMenu.querySelectorAll('.am-item'), function(b){ b.classList.toggle('on', b.dataset.add === S.tool); });
    addMenu.hidden = false;
    if(anchor && anchor !== bAdd){          // кнопка в центре пустой доски: меню под ней
      var ar = anchor.getBoundingClientRect(), mw = addMenu.offsetWidth;
      addMenu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, ar.left + ar.width / 2 - mw / 2)) + 'px';
      addMenu.style.top = Math.max(8 + 24, Math.min(ar.bottom + 10 + 24, window.innerHeight - addMenu.offsetHeight - 8 + 24)) + 'px';
      anchor.setAttribute('aria-expanded', 'true'); addMenu._anchor = anchor; addMenu.classList.add('below');
    } else {
      addMenu.classList.remove('below');
      var r = bAdd.getBoundingClientRect();
      placeBeside(addMenu, r);
    }
    bAdd.setAttribute('aria-expanded', 'true'); hideTip();
    var first = addMenu.querySelector('.am-item'); if(first) first.focus();
  }
  function closeAddMenu(){ addMenu.hidden = true; bAdd.setAttribute('aria-expanded', 'false'); if(addMenu._anchor){ addMenu._anchor.setAttribute('aria-expanded', 'false'); addMenu._anchor = null; } }
  bAdd.addEventListener('click', function(e){ e.stopPropagation(); addMenu.hidden ? openAddMenu() : closeAddMenu(); });
  $('hintAdd').addEventListener('click', function(e){ e.stopPropagation(); addMenu.hidden ? openAddMenu(this) : closeAddMenu(); });
  Array.prototype.forEach.call(addMenu.querySelectorAll('.am-item'), function(b){
    b.addEventListener('click', function(){
      S.tool = b.dataset.add; closeAddMenu(); closeLang(); hidePop();
      if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); } else render();
    });
  });
  addMenu.addEventListener('keydown', function(e){
    var items = Array.prototype.slice.call(addMenu.querySelectorAll('.am-item')), i = items.indexOf(document.activeElement);
    if(e.key === 'Escape'){ closeAddMenu(); bAdd.focus(); }
    if(e.key === 'ArrowDown'){ e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if(e.key === 'ArrowUp'){ e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  document.addEventListener('click', function(e){ if(!addMenu.hidden && !addMenu.contains(e.target) && e.target !== bAdd) closeAddMenu(); });
