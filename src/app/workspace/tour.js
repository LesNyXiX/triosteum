  /* ---------- тур для новичка ----------
     Сразу после первого входа (после выбора среды) — несколько шагов с подсветкой главных мест.
     Повторить: Ctrl+K → «Тур по Triosteum». Esc — закрыть, ← → или Enter — листать. */
  var TOUR_STEPS = [
    { title:'Коротко о главном', text:'Покажу, где что лежит — это займёт минуту. Листайте стрелками ← → или Enter, Esc — закрыть.' },
    { sel:'#bAdd', title:'Блоки', text:'Добавление элементов: выберите язык блока (стрелки ↑ ↓, → — в список языков) и нажмите на доску. Клавиша A.' },
    { sel:'#canvas', title:'Связи', text:'Тяните из точки на краю блока к другому блоку — данные пойдут по связи. Двойной щелчок по блоку открывает его код.', pad:-80 },
    { sel:'#topRun', title:'Запуск', text:'Компилирует всю доску по порядку связей и показывает, что вышло у каждого блока. Ctrl+R.' },
    { sel:'#aiFab', title:'ИИ-архитектор', text:'Опишите задачу словами — ИИ соберёт схему и найдёт готовые блоки даже в других средах.' },
    { sel:'#clWrap', title:'Какой ИИ', text:'Переключатель включает ИИ, а стрелка рядом — выбор: Claude, Ollama на вашем компьютере или свой сервер.' },
    { sel:'#envChip', title:'Среды', text:'Разработка, документы, таблицы, графика… У каждой среды свои пространства, а блоки из разных сред можно соединять.' },
    { sel:'nav.tools[data-side=left]', title:'Панели и окна', text:'Любую кнопку можно перетащить к другому краю и задать ей свою клавишу. Окна прилепляются к краям экрана, как в Windows.' },
    { sel:'#setBtn', title:'Настройки', text:'Темы, кнопки, клавиши, резервные копии и очистка. Повторить тур: Ctrl+K → «Тур по Triosteum».' }
  ];
  var TOUR = null;
  function tourVisible(n){ if(!n) return false; var r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !n.closest('[hidden]'); }
  function tourStart(){
    if(TOUR) tourEnd();
    if(typeof closeAddMenu === 'function') closeAddMenu();
    var steps = TOUR_STEPS.filter(function(s){ return !s.sel || tourVisible(document.querySelector(s.sel)); });
    var back = h('div', { 'class':'tour', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'tourT' });
    var hole = h('div', { 'class':'tour-hole', 'aria-hidden':'true' });
    var card = h('div', { 'class':'tour-card' });
    back.appendChild(hole); back.appendChild(card); document.body.appendChild(back);
    TOUR = { i:0, steps:steps, back:back, hole:hole, card:card, prev:document.activeElement };
    back.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); tourEnd(); }
      else if(e.key === 'ArrowRight' || (e.key === 'Enter' && e.target.tagName !== 'BUTTON')){ e.preventDefault(); tourGo(1); }
      else if(e.key === 'ArrowLeft'){ e.preventDefault(); tourGo(-1); }
    });
    back.addEventListener('pointerdown', function(e){ if(e.target === back || e.target === hole) e.preventDefault(); });
    window.addEventListener('resize', tourPlace);
    tourShow();
  }
  function tourGo(d){ if(!TOUR) return; var j = TOUR.i + d; if(j < 0) return; if(j >= TOUR.steps.length) return tourEnd(true); TOUR.i = j; tourShow(); }
  function tourShow(){
    var T = TOUR, s = T.steps[T.i], n = T.steps.length, last = T.i === n - 1;
    T.card.innerHTML = '';
    T.card.appendChild(h('div', { 'class':'tour-n', text:(T.i + 1) + ' из ' + n }));
    T.card.appendChild(h('h3', { id:'tourT', text:s.title }));
    T.card.appendChild(h('p', { text:s.text }));
    var dots = h('div', { 'class':'tour-dots', 'aria-hidden':'true' }); for(var k = 0; k < n; k++) dots.appendChild(h('i', { 'class':k === T.i ? 'on' : '' })); T.card.appendChild(dots);
    var next = h('button', { type:'button', 'class':'btn sm primary', text:last ? 'Готово' : 'Далее', on:{ click:function(){ tourGo(1); } } });
    T.card.appendChild(h('div', { 'class':'tour-btns' }, [
      h('button', { type:'button', 'class':'btn sm ghost', text:'Пропустить', on:{ click:function(){ tourEnd(); } } }),
      h('span', { 'class':'sp' }),
      T.i ? h('button', { type:'button', 'class':'btn sm', text:'Назад', on:{ click:function(){ tourGo(-1); } } }) : null,
      next
    ].filter(Boolean)));
    tourPlace();
    next.focus();
  }
  function tourPlace(){
    if(!TOUR) return;
    var T = TOUR, s = T.steps[T.i], n = s.sel ? document.querySelector(s.sel) : null, W = window.innerWidth, H = window.innerHeight;
    var cw = Math.min(340, W - 24), cr;
    T.card.style.width = cw + 'px';
    if(!n || !tourVisible(n)){
      T.hole.classList.add('none');
      T.card.style.left = (W - cw) / 2 + 'px'; T.card.style.top = Math.max(12, H / 2 - T.card.offsetHeight / 2) + 'px';
      return;
    }
    T.hole.classList.remove('none');
    var r = n.getBoundingClientRect(), p = s.pad || 6;
    var x = r.left - p, y = r.top - p, w = r.width + p * 2, hh = r.height + p * 2;
    T.hole.style.left = x + 'px'; T.hole.style.top = y + 'px'; T.hole.style.width = w + 'px'; T.hole.style.height = hh + 'px';
    // карточка — с той стороны, где больше места
    var ch = T.card.offsetHeight, gap = 14, cx, cy;
    var room = { right:W - (x + w), left:x, below:H - (y + hh), above:y };
    if(room.right >= cw + gap * 2 && hh < H * 0.8){ cx = x + w + gap; cy = y + hh / 2 - ch / 2; }
    else if(room.below >= ch + gap * 2){ cx = x + w / 2 - cw / 2; cy = y + hh + gap; }
    else if(room.left >= cw + gap * 2){ cx = x - cw - gap; cy = y + hh / 2 - ch / 2; }
    else if(room.above >= ch + gap * 2){ cx = x + w / 2 - cw / 2; cy = y - ch - gap; }
    else { cx = x + w / 2 - cw / 2; cy = y + hh / 2 - ch / 2; }
    T.card.style.left = Math.max(12, Math.min(W - cw - 12, cx)) + 'px';
    T.card.style.top = Math.max(12, Math.min(H - ch - 12, cy)) + 'px';
  }
  function tourEnd(done){
    if(!TOUR) return;
    var T = TOUR; TOUR = null;
    window.removeEventListener('resize', tourPlace);
    Repo.setPref('tour', { done:true, t:Date.now() });
    T.back.classList.add('leaving');
    setTimeout(function(){ T.back.remove(); }, document.body.classList.contains('noanim') ? 0 : 200);
    if(T.prev && T.prev.focus) try { T.prev.focus(); } catch(e){}
    if(done) toast('Готово! Повторить тур: Ctrl+K → «Тур по Triosteum»');
  }
  // первый вход: тур начинается, когда закрыт выбор среды и открыта доска
  function tourMaybe(){
    if(SERVER || TOUR || PANE) return;
    var t = Repo.pref('tour', null); if(t && t.done) return;
    if(!Repo.pref('tourPending', false)) return;
    if($('welcome') || !$('eco').hidden || S.view !== 'canvas' || (typeof officeOn === 'function' && officeOn())) return;
    Repo.setPref('tourPending', false);
    setTimeout(function(){ if(!$('welcome') && $('eco').hidden) tourStart(); }, 500);
  }
  new MutationObserver(tourMaybe).observe($('eco'), { attributes:true, attributeFilter:['hidden'] });
  // профиль только что создан — отмечаем, что тур нужен
  (function(){
    if(typeof showWelcome !== 'function') return;
    var _sw = showWelcome;
    showWelcome = function(editing){ var r = _sw.apply(this, arguments); if(!editing && !localProfile()) Repo.setPref('tourPending', true); return r; };
  })();
