  /* ---------- библиотека ---------- */
  /* Разделы библиотеки. У плагина есть поле cat; если его нет (шаблоны других сред, свои плагины) —
     раздел подбирается по словам в названии и описании. */
  var LIB_CATS = [
    { id:'fin', name:'Финансы и экономика', color:'#16A34A', ic:'<path d="M7 20V4h6a4 4 0 010 8H7M5 16h9"/>', re:/марж|себестоим|бюджет|npv|irr|кредит|ндс|налог|финанс|денеж|платеж|платёж|курс|валют|затрат|прибыл|рентаб|смет|безубыт|счёт на оплату|счет на оплату|калькуляц/i },
    { id:'sales', name:'Продажи и клиенты', color:'#2563EB', ic:'<path d="M4 19h16M7 15l3-4 3 2 4-6"/>', re:/продаж|клиент|сделк|воронк|дебитор|crm|покупат|коммерческ|прайс|отток|rfm|abc/i },
    { id:'stock', name:'Склад и закупки', color:'#D97706', ic:'<path d="M3 8l9-5 9 5v10l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v10"/>', re:/склад|остат|запас|закуп|поставщ|номенклат|списан|перезаказ|партия заказа|оборачив|xyz|логист|доставк/i },
    { id:'prod', name:'Производство и качество', color:'#DC2626', ic:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>', re:/производ|станок|оборудов|oee|смен|брак|качеств|датчик|вибрац|раскрой|техкарт|ремонт|pid|регулятор|сигнал|контрольн|деталь|чертёж|чертеж|резк|свар|покраск/i },
    { id:'analytics', name:'Аналитика и прогнозы', color:'#7C3AED', ic:'<path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/>', re:/прогноз|анализ|тренд|сезон|выброс|сводн|статист|среднее|отклонен/i },
    { id:'viz', name:'Отчёты и дашборды', color:'#0891B2', ic:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>', re:/диаграмм|график|дашборд|карточк|таблиц|отчёт|отчет|виджет|индикатор|канбан|гант|тепловая|форма заявки|kpi|презентац|слайд/i },
    { id:'data', name:'Данные: загрузка и очистка', color:'#64748B', ic:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>', re:/импорт|экспорт|csv|excel|очистк|объедин|разбор|проверк|json|xml|инн|загрузк|выгрузк|данны/i },
    { id:'integr', name:'Интеграции и уведомления', color:'#DB2777', ic:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', re:/telegram|почт|email|e-mail|вебхук|webhook|api|битрикс|sql|pdf|уведомл|сообщени|рассылк|интеграц/i },
    { id:'hr', name:'Персонал', color:'#0D9488', ic:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>', re:/сотрудник|зарплат|персонал|отпуск|табел|кадр|ндфл|найм|обучени|вакан/i },
    { id:'docs', name:'Документы', color:'#9333EA', ic:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>', re:/договор|акт\b|акт |письм|записк|приказ|накладн|документ|заявлен|доверен|протокол|положени|регламент|инструкци|согласован|подписан|эцп|журнал|реестр|статус/i },
    { id:'other', name:'Прочее', color:'#78716C', ic:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>' }
  ];
  var LIB_DIRTY = true;
  new MutationObserver(function(){ if(!el.lib.hidden && LIB_DIRTY){ LIB_DIRTY = false; renderChips(); renderList(); } }).observe(el.lib, { attributes:true, attributeFilter:['hidden'] });
  var LIB_CAT_ORDER_GUESS = ['integr', 'hr', 'docs', 'prod', 'stock', 'fin', 'sales', 'analytics', 'viz', 'data'];
  function libCatOf(p){
    if(p.cat && LIB_CATS.some(function(c){ return c.id === p.cat; })) return p.cat;
    if(p._cat) return p._cat;
    var hay = (p.name || '') + ' ' + (p.desc || ''), found = 'other';
    if(p.lang === 'doc' || p.lang === 'sheet' || p.lang === 'slides' || p.lang === 'form'){ var dc = LIB_CATS.filter(function(c){ return c.id === 'docs'; })[0]; if(p.lang === 'doc' && dc.re.test(hay)) found = 'docs'; }
    if(found === 'other') LIB_CAT_ORDER_GUESS.some(function(id){ var c = LIB_CATS.filter(function(x){ return x.id === id; })[0]; if(c.re.test(hay)){ found = id; return true; } return false; });
    if(found === 'other' && p.lang === 'html') found = 'viz';
    try { Object.defineProperty(p, '_cat', { value:found, enumerable:false, configurable:true }); } catch(e){}
    return found;
  }
  function libCat(id){ return LIB_CATS.filter(function(c){ return c.id === id; })[0] || LIB_CATS[LIB_CATS.length - 1]; }
  function libCatName(p){ return libCat(libCatOf(p)).name; }
  function libIco(c, sz){ return '<svg viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + c.ic + '</svg>'; }
  if(!S.libCat) S.libCat = 'all';
  if(!S.libLang) S.libLang = 'all';
  function libAll(){ return myVis().concat(orgVis(), PLUGINS); }
  function libMatch(p, q){ return !q || (p.name + ' ' + (p.desc || '') + ' ' + libCatName(p) + ' ' + ((langById(p.lang) || {}).name || '')).toLowerCase().indexOf(q) >= 0; }
  function libLangOk(p){ return S.libLang === 'all' || p.lang === S.libLang; }
  // слева — разделы с количеством, сверху — языки
  function renderChips(){
    if(el.lib.hidden){ LIB_DIRTY = true; return; }      // закрытая библиотека не строится — догонит при открытии
    var q = S.q.trim().toLowerCase(), base = libAll().filter(function(p){ return libMatch(p, q); });
    if(S.libLang !== 'all' && !LANGS.some(function(l){ return l.id === S.libLang; })) S.libLang = 'all';
    var nav = $('libCats'); nav.innerHTML = '';
    var mine = base.filter(function(p){ return p.my && libLangOk(p); }).length;
    var rows = [{ id:'all', name:'Все разделы', n:base.filter(libLangOk).length, color:'var(--red)', ic:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' }];
    if(myVis().length) rows.push({ id:'my', name:'Мои', n:mine, color:'var(--red)', ic:'<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>' });
    if(orgVis().length) rows.push({ id:'org', name:'Компания', n:base.filter(function(p){ return p.org && libLangOk(p); }).length, color:'#0D9488', ic:'<path d="M3 21V8l6-4v17M9 21V10l6-3v14M15 21V12l6-3v12M3 21h18"/>' });
    LIB_CATS.forEach(function(c){ var n = base.filter(function(p){ return libLangOk(p) && libCatOf(p) === c.id; }).length; if(n) rows.push({ id:c.id, name:c.name, n:n, color:c.color, ic:c.ic }); });
    if(S.libCat !== 'all' && !rows.some(function(r){ return r.id === S.libCat; })) S.libCat = 'all';
    rows.forEach(function(r){
      var b = h('button', { type:'button', 'class':'lib-cat' + (S.libCat === r.id ? ' on' : ''), 'aria-pressed':S.libCat === r.id ? 'true' : 'false', style:'--cc:' + r.color }, [
        h('span', { 'class':'ic', html:libIco(r) }), h('span', { 'class':'nm', text:r.name }), h('span', { 'class':'n', text:String(r.n) }) ]);
      b.addEventListener('click', function(){ S.libCat = r.id; renderChips(); renderList(); });
      nav.appendChild(b);
    });
    el.chips.innerHTML = '';
    el.chips.appendChild(h('span', { 'class':'chips-l', text:ENV.word.lang + ':' }));
    [{ id:'all', name:'Все' }].concat(LANGS.map(function(l){ return { id:l.id, name:shortName(l) }; })).forEach(function(c){
      var n = c.id === 'all' ? base.length : base.filter(function(p){ return p.lang === c.id; }).length;
      if(c.id !== 'all' && !n) return;
      var b = h('button', { type:'button', 'class':'chip' + (S.libLang === c.id ? ' on' : ''), 'aria-pressed':S.libLang === c.id ? 'true' : 'false', text:c.name + ' · ' + n });
      if(c.id !== 'all' && COLORS[c.id]) b.style.setProperty('--chip-c', COLORS[c.id][0]);
      b.addEventListener('click', function(){ S.libLang = c.id; renderChips(); renderList(); });
      el.chips.appendChild(b);
    });
  }
  function pluginCard(p){
    var l = langById(p.lang), c = COLORS[p.lang] || ['#888', '#555'], cat = libCat(libCatOf(p));
    var card = document.createElement('article'); card.className = 'pcard'; card.style.setProperty('--cc', cat.color);
    card.innerHTML = '<div class="ph1"><span class="pc-ic"></span><h3></h3><span class="lbadge"></span></div><p></p>' +
      '<div class="pf"><span class="run-tag"></span><span style="display:flex;gap:6px"><button type="button" class="btn sm code">Код</button><button type="button" class="btn sm primary open">Открыть</button></span></div>';
    card.querySelector('.pc-ic').innerHTML = libIco(cat, 15);
    card.querySelector('.pc-ic').title = cat.name;
    var h3 = card.querySelector('h3'); h3.textContent = p.name;
    if(p.my){ var m = document.createElement('span'); m.className = 'mine'; m.textContent = 'мой'; h3.appendChild(m); }
    if(p.org){ var mo = document.createElement('span'); mo.className = 'mine org-mine'; mo.textContent = 'компании'; mo.title = 'Из библиотеки компании' + (p.byName ? ' · поделился ' + p.byName : ''); h3.appendChild(mo); }
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
    var ob = orgCardButton(p); if(ob) card.querySelector('.pf > span:last-child').insertBefore(ob, code);
    return card;
  }
  function renderList(){
    if(el.lib.hidden){ LIB_DIRTY = true; return; }
    var q = S.q.trim().toLowerCase();
    var items = libAll().filter(function(p){ return libLangOk(p) && libMatch(p, q) && (S.libCat === 'all' || (S.libCat === 'my' ? p.my : S.libCat === 'org' ? p.org : libCatOf(p) === S.libCat)); });
    el.plist.innerHTML = '';
    var head = $('libHint');
    if(head) head.textContent = S.libCat === 'all' ? (q ? 'Найдено: ' + items.length : 'Всего: ' + items.length + ' · выберите раздел слева') : (S.libCat === 'my' ? 'Мои' : S.libCat === 'org' ? 'Библиотека компании' : libCat(S.libCat).name) + ' · ' + items.length;
    if(!items.length){
      el.plist.appendChild(h('div', { 'class':'empty', text:'Ничего не найдено. Попробуйте другое слово, другой раздел или создайте свой плагин.' }));
      return;
    }
    if(S.libCat !== 'all'){ var g0 = h('div', { 'class':'pgrid' }); items.forEach(function(p){ g0.appendChild(pluginCard(p)); }); el.plist.appendChild(g0); return; }
    // «Все разделы» — карточки сгруппированы по разделам
    LIB_CATS.forEach(function(c){
      var part = items.filter(function(p){ return libCatOf(p) === c.id; }); if(!part.length) return;
      var hd = h('div', { 'class':'pgroup-h', style:'--cc:' + c.color }, [ h('span', { 'class':'ic', html:libIco(c) }), h('h3', { text:c.name }), h('span', { 'class':'n', text:String(part.length) }) ]);
      if(part.length > 6 && !q){
        hd.appendChild(h('button', { type:'button', 'class':'btn sm ghost', text:'Весь раздел →', on:{ click:function(){ S.libCat = c.id; renderChips(); renderList(); el.plist.scrollTop = 0; } } }));
        part = part.slice(0, 6);
      }
      el.plist.appendChild(hd);
      var g = h('div', { 'class':'pgrid' }); part.forEach(function(p){ g.appendChild(pluginCard(p)); }); el.plist.appendChild(g);
    });
  }
  el.search.addEventListener('input', function(){ S.q = el.search.value; renderChips(); renderList(); });
  (function libWindow(){
    var geo = cleanGeo(load('triosteum.libgeo', null)), libEl = el.lib;
    if(geo && (geo.l === undefined || geo.w === undefined)) geo = null;
    function apply(){
      if(!geo || window.innerWidth <= 640) return;
      var vw = window.innerWidth, vh = window.innerHeight, w = Math.min(geo.w, vw - 16), hh = Math.min(geo.h, vh - 64);
      libEl.style.width = w + 'px'; libEl.style.height = hh + 'px';
      libEl.style.left = Math.max(8, Math.min(vw - w - 8, geo.l)) + 'px'; libEl.style.top = Math.max(52, Math.min(vh - hh - 8, geo.t)) + 'px';
    }
    window.addEventListener('resize', apply);
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

  /* ---------- библиотека компании: поделиться своим плагином с сотрудниками и убрать его ---------- */
  function orgCanShare(){ return !!(SERVER && (SERVER.role === 'owner' || SERVER.role === 'editor')); }
  function orgMine(p){ return !!(SERVER && SERVER.user && (p.by === SERVER.user.id || SERVER.role === 'owner')); }
  function orgShared(p){ return ORG.filter(function(o){ return o.src === p.id && SERVER.user && o.by === SERVER.user.id; })[0] || null; }
  function orgCardButton(p){
    if(!orgCanShare()) return null;
    if(p.my){
      var was = orgShared(p);
      var b = h('button', { type:'button', 'class':'btn sm org-share', text:was ? 'Обновить в компании' : 'В компанию',
        title:was ? 'Заменить плагин в библиотеке компании этой версией' : 'Поделиться с компанией: плагин появится в библиотеке у всех сотрудников организации' });
      b.addEventListener('click', function(){ orgShare(p, b); });
      return b;
    }
    if(p.org && orgMine(p)){
      var rm = h('button', { type:'button', 'class':'btn sm ghost org-remove', text:'Убрать', title:'Убрать из библиотеки компании' });
      var armed = 0;
      rm.addEventListener('click', function(){
        if(Date.now() - armed > 4000){ armed = Date.now(); rm.textContent = 'Точно?'; toast('Нажмите ещё раз: «' + p.name + '» пропадёт из библиотеки у всех сотрудников'); return; }
        rm.disabled = true;
        SERVER.api('DELETE', '/org/items/' + p.orgItem).then(function(r){
          rm.disabled = false;
          if(r.status !== 200){ toast((r.data && r.data.detail) || 'Не получилось убрать'); return; }
          ORG = ORG.filter(function(o){ return o.orgItem !== p.orgItem; });
          toast('«' + p.name + '» убран из библиотеки компании'); renderChips(); renderList();
        });
      });
      return rm;
    }
    return null;
  }
  function orgShare(p, btn){
    if(btn) btn.disabled = true;
    SERVER.api('POST', '/org/items', { kind:'plugin', src:p.id, data:p }).then(function(r){
      if(btn) btn.disabled = false;
      if(r.status !== 201){ toast((r.data && r.data.detail) || 'Не получилось поделиться'); return; }
      orgRefresh().then(function(){ toast('«' + p.name + '» теперь в библиотеке компании — его видят все сотрудники организации'); });
    });
  }
  // при каждом открытии библиотеки подтягиваем свежую библиотеку компании: коллеги могли чем-то поделиться
  function orgRefresh(){
    if(!SERVER) return Promise.resolve();
    return SERVER.api('GET', '/org/items?kind=plugin').then(function(r){ if(r.status === 200){ orgFromItems(r.data.items); renderChips(); renderList(); } }, function(){});
  }
  if(SERVER) new MutationObserver(function(){ if(!el.lib.hidden) orgRefresh(); }).observe(el.lib, { attributes:true, attributeFilter:['hidden'] });
