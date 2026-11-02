  /* ---------- библиотека ---------- */
  function renderChips(){
    el.chips.innerHTML = '';
    var list = [];
    var mv = myVis();
    if(mv.length) list.push({ id:'my', name:'Мои', n:mv.length });
    list.push({ id:'all', name:'Все', n:PLUGINS.length + mv.length });
    LANGS.forEach(function(l){ list.push({ id:l.id, name:shortName(l), n:PLUGINS.concat(mv).filter(function(p){ return p.lang === l.id; }).length }); });
    list.forEach(function(c){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (S.filter === c.id ? ' on' : '');
      b.setAttribute('aria-pressed', S.filter === c.id ? 'true' : 'false');
      b.textContent = c.name + ' · ' + c.n;
      b.addEventListener('click', function(){ S.filter = c.id; renderChips(); renderList(); });
      el.chips.appendChild(b);
    });
  }
  function renderList(){
    var mv = myVis();
    if(S.filter === 'my' && !mv.length) S.filter = 'all';
    var q = S.q.trim().toLowerCase();
    var items = mv.concat(PLUGINS).filter(function(p){
      var f = S.filter === 'all' || (S.filter === 'my' ? p.my : p.lang === S.filter);
      return f && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().indexOf(q) >= 0);
    });
    el.plist.innerHTML = '';
    if(!items.length){
      var e = document.createElement('div'); e.className = 'empty';
      e.textContent = 'Ничего не найдено. Попробуйте другое слово или создайте свой плагин.';
      el.plist.appendChild(e); return;
    }
    items.forEach(function(p){
      var l = langById(p.lang), c = COLORS[p.lang] || ['#888', '#555'];
      var card = document.createElement('article'); card.className = 'pcard';
      card.innerHTML = '<div class="ph1"><h3></h3><span class="lbadge"></span></div><p></p>' +
        '<div class="pf"><span class="run-tag"></span><span style="display:flex;gap:6px"><button type="button" class="btn sm code">Код</button><button type="button" class="btn sm primary open">Открыть</button></span></div>';
      var h3 = card.querySelector('h3'); h3.textContent = p.name;
      if(p.my){ var m = document.createElement('span'); m.className = 'mine'; m.textContent = 'мой'; h3.appendChild(m); }
      var badge = card.querySelector('.lbadge');
      badge.textContent = shortName(l); badge.style.borderColor = c[0];
      card.querySelector('p').textContent = p.desc || 'Ваш плагин';
      var tag = card.querySelector('.run-tag');
      var fam = p.family && VARIANTS[p.family] ? Object.keys(VARIANTS[p.family]).length : 0;
      tag.textContent = isDocs() ? l.tool.split(':')[0].split(',')[0] : (fam > 1 ? 'есть на ' + fam + ' языках' : (l.real ? 'запускается в браузере' : 'запуск после подключения сервера'));
      if(fam > 1 || l.real) tag.className = 'run-tag live';
      card.querySelector('.code').textContent = ENV.word.libOpen;
      var open = card.querySelector('.open'), code = card.querySelector('.code');
      open.setAttribute('aria-label', 'Открыть «' + p.name + '» на доске');
      code.setAttribute('aria-label', ENV.word.libOpen + ' «' + p.name + '»');
      open.addEventListener('click', function(){ openOnBoard(p.id); });
      code.addEventListener('click', function(){ openPlugin(p.id); });
      el.plist.appendChild(card);
    });
  }
  el.search.addEventListener('input', function(){ S.q = el.search.value; renderList(); });
  (function libWindow(){
    var geo = load('triosteum.libgeo', null), libEl = el.lib;
    function apply(){ if(geo){ libEl.style.left = geo.l + 'px'; libEl.style.top = geo.t + 'px'; libEl.style.width = geo.w + 'px'; libEl.style.height = geo.h + 'px'; } }
    function remember(){ if(libEl.hidden || libEl.classList.contains('max') || window.innerWidth <= 640) return; var r = libEl.getBoundingClientRect(); geo = { l:r.left, t:r.top, w:r.width, h:r.height }; save('triosteum.libgeo', geo); }
    apply();
    if(window.ResizeObserver) new ResizeObserver(function(){ remember(); }).observe(libEl);
    var mv = null;
    $('libHead').addEventListener('pointerdown', function(e){
      if(e.target.closest('button') || libEl.classList.contains('max') || window.innerWidth <= 640) return;
      var r = libEl.getBoundingClientRect(); mv = { dx:e.clientX - r.left, dy:e.clientY - r.top };
      $('libHead').setPointerCapture(e.pointerId);
    });
    $('libHead').addEventListener('pointermove', function(e){
      if(!mv) return;
      var x = Math.max(8 - libEl.offsetWidth + 120, Math.min(window.innerWidth - 120, e.clientX - mv.dx));
      var y = Math.max(8, Math.min(window.innerHeight - 60, e.clientY - mv.dy));
      libEl.style.left = x + 'px'; libEl.style.top = y + 'px';
    });
    $('libHead').addEventListener('pointerup', function(){ if(mv){ mv = null; remember(); } });
    $('libHead').addEventListener('dblclick', function(e){ if(!e.target.closest('button')) $('libMax').click(); });
    $('libMax').addEventListener('click', function(){
      var on = libEl.classList.toggle('max');
      $('libMax').setAttribute('aria-label', on ? 'Вернуть размер окна' : 'Развернуть окно');
    });
    libEl.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ S.lib = false; render(); el.bLib.focus(); } });
  })();
