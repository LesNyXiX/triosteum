  /* ---------- две среды рядом ----------
     Вторая среда — это ещё один живой Triosteum в окне справа (index.html?pane=<пространство>).
     Окно прилипает к любому краю как обычное, граница тянется; правки в обеих средах сохраняются
     в одно хранилище, как в двух вкладках. Кнопка в шапке окна меняет среды местами. */
  var SPLIT = { win:null, frame:null, api:null, id:null, title:null };
  function splitSpaces(){ return PROJ.list.filter(function(p){ return p.id !== PROJ.cur && p.id !== SPLIT.id; }).sort(function(a, b){ return (b.t || 0) - (a.t || 0); }); }
  function splitPick(anchor){
    if(PANE) return;
    var list = splitSpaces(), r = (anchor || $('splitBtn')).getBoundingClientRect();
    var items = [{ head:'Открыть рядом вторую среду' }];
    if(!list.length) items.push({ label:'Других пространств пока нет — создайте ещё одно', disabled:true });
    // по средам: сначала другие среды — ради них обычно и делят экран
    var cur = ENV.id, sorted = list.filter(function(p){ return (p.env || 'code') !== cur; }).concat(list.filter(function(p){ return (p.env || 'code') === cur; }));
    sorted.slice(0, 14).forEach(function(p){ var e = ENVS[p.env || 'code'] || ENVS.code; items.push({ label:p.name, kb:e.name, swatch:e.color, act:function(){ splitOpen(p.id); } }); });
    if(SPLIT.id) items.push({ sep:true }, { label:'Закрыть вторую среду', icon:'x', act:splitClose });
    openMenuAt(items, r.left, r.bottom + 6, anchor || $('splitBtn'));
  }
  function splitUrl(id){ return location.pathname + '?pane=' + encodeURIComponent(id); }
  function splitBuild(){
    if(SPLIT.win) return;
    var w = h('div', { 'class':'pers split-w', id:'splitW', role:'region', 'aria-label':'Вторая среда', hidden:'hidden' });
    var hd = h('div', { 'class':'pers-h split-h' });
    SPLIT.title = h('h2', { text:'Вторая среда' });
    hd.appendChild(h('span', { 'class':'split-dot', 'aria-hidden':'true' }));
    hd.appendChild(SPLIT.title);
    hd.appendChild(h('span', { 'class':'sp' }));
    hd.appendChild(h('button', { type:'button', 'class':'icon-btn', title:'Поменять среды местами', 'aria-label':'Поменять среды местами', html:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h13l-4-4M17 17H4l4 4"/></svg>', on:{ click:splitSwap } }));
    hd.appendChild(h('button', { type:'button', 'class':'icon-btn', title:'Другое пространство', 'aria-label':'Открыть рядом другое пространство', html:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>', on:{ click:function(e){ splitPick(e.currentTarget); } } }));
    hd.appendChild(h('button', { type:'button', 'class':'icon-btn', title:'Открыть в отдельной вкладке', 'aria-label':'Открыть вторую среду в отдельной вкладке', html:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>', on:{ click:splitTab } }));
    hd.appendChild(h('button', { type:'button', 'class':'icon-btn', title:'Закрыть вторую среду', 'aria-label':'Закрыть', html:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>', on:{ click:splitClose } }));
    w.appendChild(hd);
    SPLIT.frame = h('iframe', { 'class':'split-frame', title:'Вторая среда Triosteum' });
    w.appendChild(SPLIT.frame);
    document.body.appendChild(w);
    SPLIT.win = w;
    SPLIT.api = makeWindow(w, '.split-h', 'split', 'fixed', function(){ SPLIT.api.snap('r'); });
  }
  function splitOpen(id){
    if(PANE || !id) return;
    splitBuild();
    var p = PROJ.list.filter(function(x){ return x.id === id; })[0]; if(!p) return;
    stashCur();
    SPLIT.id = id;
    splitTitle(p);
    var url = splitUrl(id);
    if(SPLIT.frame.getAttribute('src') !== url) SPLIT.frame.setAttribute('src', url);
    var first = SPLIT.win.hidden;
    SPLIT.win.hidden = false;
    // впервые — сразу половина справа; дальше окно помнит своё место
    if(first && !SPLIT.api.pinned()) SPLIT.api.snap('r'); else SPLIT.api.apply();
    Repo.setPref('split', { id:id });
    $('splitBtn').classList.add('on'); $('splitBtn').setAttribute('aria-pressed', 'true');
  }
  function splitTitle(p){ var e = ENVS[p.env || 'code'] || ENVS.code; SPLIT.title.textContent = p.name + ' · ' + e.name; SPLIT.win.style.setProperty('--split-c', e.color || 'var(--red)'); }
  function splitClose(){
    if(!SPLIT.win || SPLIT.win.hidden) return;
    splitAsk('stash', function(){
      SPLIT.win.hidden = true; SPLIT.id = null;
      SPLIT.frame.setAttribute('src', 'about:blank');
      Repo.setPref('split', null);
      $('splitBtn').classList.remove('on'); $('splitBtn').setAttribute('aria-pressed', 'false');
    });
  }
  function splitTab(){ if(!SPLIT.id) return; var id = SPLIT.id; splitAsk('stash', function(){ window.open(location.pathname + '?space=' + encodeURIComponent(id), '_blank', 'noopener'); }); }
  // попросить вторую среду сохраниться (ответит «готово»); не ответила за полсекунды — идём дальше
  function splitAsk(what, cb){
    var done = false, t = setTimeout(fin, 500);
    function fin(){ if(done) return; done = true; clearTimeout(t); window.removeEventListener('message', on); cb(); }
    function on(e){ if(e.source === (SPLIT.frame && SPLIT.frame.contentWindow) && e.data && e.data.ts === what + ':ok') fin(); }
    window.addEventListener('message', on);
    try { SPLIT.frame.contentWindow.postMessage({ ts:what }, '*'); } catch(e){ fin(); }
  }
  function splitSwap(){
    if(!SPLIT.id) return;
    var mine = PROJ.cur, theirs = SPLIT.id;
    splitAsk('stash', function(){
      switchProj(theirs);
      SPLIT.id = mine; splitTitle(PROJ.list.filter(function(x){ return x.id === mine; })[0] || curProj());
      SPLIT.frame.setAttribute('src', splitUrl(mine));
      Repo.setPref('split', { id:mine });
      toast('Среды поменялись местами');
    });
  }
  // сообщения от второй среды: открыла другое пространство — обновляем заголовок
  window.addEventListener('message', function(e){
    if(!SPLIT.frame || e.source !== SPLIT.frame.contentWindow || !e.data) return;
    if(e.data.ts === 'pane:space' && e.data.id){ SPLIT.id = e.data.id; var p = PROJ.list.filter(function(x){ return x.id === e.data.id; })[0]; if(p) splitTitle(p); Repo.setPref('split', { id:e.data.id }); }
  });
  /* ---------- сторона второй среды (внутри окна) ---------- */
  if(PANE){
    window.addEventListener('message', function(e){
      if(e.source !== window.parent || !e.data) return;
      if(e.data.ts === 'stash'){ try { stashCur(); } catch(x){} e.source.postMessage({ ts:'stash:ok' }, '*'); }
    });
    // открыли другое пространство во второй среде — сообщаем главному окну
    var _show = showProjName, paneSent = PANE;
    showProjName = function(){ _show.apply(this, arguments); try { var p = curProj(); if(p.id !== paneSent){ paneSent = p.id; window.parent.postMessage({ ts:'pane:space', id:p.id }, '*'); } } catch(x){} };
  }
  // ?space=<id> — открыть пространство сразу (кнопка «в отдельной вкладке»)
  (function(){ if(PANE) return; var m = /[?&]space=([^&#]+)/.exec(location.search); if(m){ var id = decodeURIComponent(m[1]); if(id !== PROJ.cur && PROJ.list.some(function(p){ return p.id === id; })) setTimeout(function(){ switchProj(id); }, 0); } })();
  if(!PANE){
    $('splitBtn').addEventListener('click', function(e){ e.stopPropagation(); splitPick(e.currentTarget); });
    // после перезагрузки вторая среда открывается снова
    (function(){ var s = Repo.pref('split', null); if(s && s.id && s.id !== PROJ.cur && PROJ.list.some(function(p){ return p.id === s.id; })) setTimeout(function(){ splitOpen(s.id); }, 300); })();
  }
