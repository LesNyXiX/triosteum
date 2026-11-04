  /* =====================================================================
     РЕДАКТОР ТЕМ (как темы чатов в Telegram): любую тему можно изменить,
     можно создать свою — с нуля или копией. Изменения видны сразу во всём
     приложении; «Отмена» возвращает как было. Тему можно передать коллеге
     кодом и вставить у себя.
     ===================================================================== */
  var THEME_FIELDS = [
    ['accent', 'Акцент', 'кнопки, выделение, активные инструменты'],
    ['bg', 'Фон', 'доска и фон окна'],
    ['panel', 'Панели', 'шапка, панели, карточки'],
    ['tip', 'Меню и подсказки', 'всплывающие окна'],
    ['line', 'Тонкие линии', 'разделители'],
    ['line2', 'Рамки', 'рамки окон и полей'],
    ['dot', 'Сетка', 'точки и линии доски'],
    ['ink', 'Текст', 'основной текст'],
    ['strong', 'Заголовки', 'самый яркий текст'],
    ['muted', 'Второй текст', 'подписи, описания'],
    ['dim', 'Подсказки', 'самый тихий текст']
  ];
  var TH_ED = null;   // { key, custom, draft, prevTheme, prevAccent, name }
  function themeLight(t){ return lum(t.bg) > 0.45; }
  function themeOf(k){
    if(TH_ED && TH_ED.key === k) return TH_ED.draft;
    var c = (UI.customThemes || {})[k]; if(c) return c;
    var base = THEMES[k]; if(!base) return THEMES.burgundy;
    var ed = (UI.themeEdits || {})[k];
    if(!ed) return base;
    var o = {}; for(var x in base) o[x] = base[x]; for(var y in ed) o[y] = ed[y]; o.light = themeLight(o); return o;
  }
  function themeKeys(){ var ks = Object.keys(THEMES); Object.keys(UI.customThemes || {}).forEach(function(k){ ks.push(k); }); if(TH_ED && TH_ED.custom && ks.indexOf(TH_ED.key) < 0) ks.push(TH_ED.key); return ks; }
  function themeEdited(k){ return !!(UI.themeEdits || {})[k]; }
  // остальные цвета из двух: фона и акцента
  function themeDerive(bg, accent, name){
    var light = lum(bg) > 0.45, ink = light ? mixHex(bg, '#000000', 0.82) : mixHex(bg, '#FFFFFF', 0.9);
    var tint = function(c){ return mixHex(c, accent, 0.12); };
    return { name:name || 'Своя тема', bg:bg, panel:light ? mixHex(bg, '#FFFFFF', 0.75) : mixHex(bg, '#FFFFFF', 0.045),
      line:tint(mixHex(bg, ink, 0.12)), line2:tint(mixHex(bg, ink, 0.2)), ink:ink, strong:light ? mixHex(bg, '#000000', 0.94) : mixHex(bg, '#FFFFFF', 0.97),
      muted:mixHex(ink, bg, 0.32), dim:mixHex(ink, bg, 0.45), dot:tint(mixHex(bg, ink, 0.15)), tip:light ? '#FFFFFF' : mixHex(bg, ink, 0.08), accent:accent, light:light };
  }
  function themeOpen(key, opts){
    opts = opts || {};
    if(TH_ED) themeCancel(true);
    var custom = !THEMES[key] || opts.asNew, src = themeOf(key), draft = {};
    for(var k in src) draft[k] = src[k];
    if(opts.asNew){ key = 'c' + Date.now().toString(36); draft.name = opts.name || (src.name + ' — копия'); }
    TH_ED = { key:key, custom:custom, isNew:!!opts.asNew, draft:draft, prevTheme:UI.theme, prevAccent:UI.accent };
    UI.theme = key; UI.accent = null; applyTheme();
    var w = $('themeEd'); w.hidden = false;
    if(!themeEdWin) themeEdWin = makeWindow(w, '.pers-h', 'themeEd', 'fixed');
    themeEdWin.apply(); themeRender();
    if(!$('pers').hidden) renderPers();
  }
  var themeEdWin = null;
  function themeCancel(silent){
    if(!TH_ED) return;
    var t = TH_ED; TH_ED = null;
    UI.theme = t.prevTheme; UI.accent = t.prevAccent;
    if(!themeOf(UI.theme) || (!THEMES[UI.theme] && !(UI.customThemes || {})[UI.theme])) UI.theme = 'burgundy';
    applyTheme(); $('themeEd').hidden = true;
    if(!silent && !$('pers').hidden) renderPers();
  }
  function themeSave(){
    if(!TH_ED) return;
    var t = TH_ED, d = t.draft; d.light = themeLight(d); d.name = String(d.name || 'Своя тема').trim() || 'Своя тема';
    if(t.custom){ UI.customThemes = UI.customThemes || {}; var o = {}; THEME_FIELDS.forEach(function(f){ o[f[0]] = d[f[0]]; }); o.name = d.name; o.light = d.light; UI.customThemes[t.key] = o; }
    else { var base = THEMES[t.key], diff = {}, any = false; THEME_FIELDS.forEach(function(f){ if(String(d[f[0]]).toLowerCase() !== String(base[f[0]]).toLowerCase()){ diff[f[0]] = d[f[0]]; any = true; } }); UI.themeEdits = UI.themeEdits || {}; if(any) UI.themeEdits[t.key] = diff; else delete UI.themeEdits[t.key]; }
    TH_ED = null; UI.theme = t.key; UI.accent = null; applyTheme(); $('themeEd').hidden = true;
    toast('Тема «' + d.name + '» сохранена');
    if(!$('pers').hidden) renderPers();
  }
  function themeDelete(){
    if(!TH_ED || !TH_ED.custom) return;
    var t = TH_ED, nm = t.draft.name;
    if(UI.customThemes) delete UI.customThemes[t.key];
    TH_ED = null; UI.theme = t.prevTheme === t.key ? 'burgundy' : t.prevTheme; UI.accent = t.prevAccent;
    if(UI.envs) Object.keys(UI.envs).forEach(function(e){ if(UI.envs[e] && UI.envs[e].theme === t.key) UI.envs[e].theme = 'burgundy'; });
    applyTheme(); $('themeEd').hidden = true; toast('Тема «' + nm + '» удалена');
    if(!$('pers').hidden) renderPers();
  }
  function themeCode(d){ var o = { triosteumTheme:1, name:d.name }; THEME_FIELDS.forEach(function(f){ o[f[0]] = d[f[0]]; }); return JSON.stringify(o); }
  function themeImport(text){
    var o; try { o = JSON.parse(String(text).trim()); } catch(e){ return 'Это не код темы Triosteum'; }
    if(!o || !o.triosteumTheme) return 'Это не код темы Triosteum';
    var ok = THEME_FIELDS.every(function(f){ return /^#[0-9a-f]{6}$/i.test(o[f[0]] || ''); });
    if(!ok) return 'В коде темы не хватает цветов';
    var key = 'c' + Date.now().toString(36), t = { name:String(o.name || 'Тема').slice(0, 40) };
    THEME_FIELDS.forEach(function(f){ t[f[0]] = o[f[0]]; }); t.light = themeLight(t);
    UI.customThemes = UI.customThemes || {}; UI.customThemes[key] = t; UI.theme = key; UI.accent = null; applyTheme();
    toast('Тема «' + t.name + '» добавлена'); return null;
  }
  // мини-превью приложения в цветах темы
  function themePreview(d){
    var ac = d.accent, btn = mixHex(ac, '#000000', 0.18), on = bestText(btn);
    var pv = h('div', { 'class':'th-pv', style:'background:' + d.bg + ';border-color:' + d.line2 });
    pv.appendChild(h('div', { 'class':'th-top', style:'background:' + d.panel + ';border-bottom:1px solid ' + d.line }, [ h('b', { style:'color:' + d.strong, text:'Triosteum' }), h('span', { style:'color:' + d.muted, text:'Пространство' }), h('i', { style:'background:' + btn + ';color:' + on, text:'Запустить' }) ]));
    var body = h('div', { 'class':'th-body' });
    body.appendChild(h('div', { 'class':'th-side', style:'background:' + d.panel + ';border-right:1px solid ' + d.line }, [0, 1, 2, 3].map(function(i){ return h('span', { style:i === 1 ? 'background:' + mixHex(ac, d.bg, 0.62) + ';border:1px solid ' + ac : 'background:' + d.line }); })));
    var board = h('div', { 'class':'th-board', style:'background-color:' + d.bg + ';background-image:radial-gradient(' + d.dot + ' 1.2px,transparent 1.3px)' });
    board.appendChild(h('div', { 'class':'th-card', style:'background:' + d.panel + ';border:1.5px solid ' + ac }, [ h('b', { style:'color:' + d.ink, text:'Блок' }), h('small', { style:'color:' + d.muted, text:'данные → итог' }) ]));
    board.appendChild(h('div', { 'class':'th-tip', style:'background:' + d.tip + ';border:1px solid ' + d.line2 + ';color:' + d.strong }, [ document.createTextNode('Подсказка'), h('small', { style:'color:' + d.dim, text:'тихий текст' }) ]));
    body.appendChild(board);
    pv.appendChild(body);
    return pv;
  }
  function themeRender(){
    var b = $('themeEdBody'), t = TH_ED; if(!b || !t) return;
    b.textContent = '';
    var d = t.draft;
    $('themeEdTitle').textContent = t.isNew ? 'Новая тема' : (t.custom ? 'Своя тема' : 'Тема «' + THEMES[t.key].name + '»');
    var upd = function(){ applyTheme(); var old = b.querySelector('.th-pv'); if(old) old.replaceWith(themePreview(d)); };
    b.appendChild(themePreview(d));
    var nm = h('input', { type:'text', 'class':'input', value:d.name || '', 'aria-label':'Название темы', maxlength:'40', on:{ input:function(){ d.name = nm.value; } } });
    b.appendChild(section('Название', nm));
    // основа: фон и акцент; остальное подбирается само
    var quick = h('div', { 'class':'th-quick' });
    [['bg', 'Фон'], ['accent', 'Акцент']].forEach(function(f){
      var ci = h('input', { type:'color', 'aria-label':f[1] }); ci.value = d[f[0]];
      ci.addEventListener('input', function(){ d[f[0]] = ci.value; var row = b.querySelector('[data-f="' + f[0] + '"] input'); if(row) row.value = ci.value; upd(); });
      quick.appendChild(h('label', { 'class':'th-q' }, [ ci, h('span', { text:f[1] }) ]));
    });
    quick.appendChild(h('button', { type:'button', 'class':'btn sm primary', text:'Подобрать остальные цвета', title:'Панели, линии, текст и сетка — под выбранные фон и акцент', on:{ click:function(){ var nd = themeDerive(d.bg, d.accent, d.name); for(var k in nd) if(k !== 'name') d[k] = nd[k]; themeRender(); applyTheme(); } } }));
    b.appendChild(section('Основа — как в Telegram: выберите фон и акцент', quick));
    var bgs = h('div', { 'class':'swatches' });
    ['#12090B', '#0E0F12', '#0A0F1C', '#07110E', '#14101F', '#1B1410', '#F6F2F3', '#F4F7FB', '#F3F7F2', '#FFF8EE'].forEach(function(c){
      bgs.appendChild(h('button', { type:'button', 'class':'swb', 'aria-label':'Фон ' + c, style:'background:' + c + ';box-shadow:inset 0 0 0 1px rgba(128,128,128,.4)', on:{ click:function(){ var nd = themeDerive(c, d.accent, d.name); for(var k in nd) if(k !== 'name') d[k] = nd[k]; themeRender(); applyTheme(); } } }));
    });
    b.appendChild(section('Готовые фоны (остальные цвета подберутся)', bgs));
    var acs = h('div', { 'class':'swatches' });
    ACCENTS.concat(['#14B8A6', '#A3E635', '#F43F5E']).forEach(function(c){ acs.appendChild(h('button', { type:'button', 'class':'swb' + (String(d.accent).toLowerCase() === c.toLowerCase() ? ' on' : ''), 'aria-label':'Акцент ' + c, style:'background:' + c, on:{ click:function(){ d.accent = c; themeRender(); applyTheme(); } } })); });
    b.appendChild(section('Акцент', acs));
    var grid = h('div', { 'class':'th-grid' });
    THEME_FIELDS.forEach(function(f){
      var ci = h('input', { type:'color', 'aria-label':f[1] }); ci.value = d[f[0]];
      ci.addEventListener('input', function(){ d[f[0]] = ci.value; if(f[0] === 'bg' || f[0] === 'accent'){ var q = quick.querySelector('input[aria-label="' + (f[0] === 'bg' ? 'Фон' : 'Акцент') + '"]'); if(q) q.value = ci.value; } upd(); });
      grid.appendChild(h('label', { 'class':'th-f', 'data-f':f[0] }, [ ci, h('span', null, [ h('b', { text:f[1] }), h('small', { text:f[2] }) ]) ]));
    });
    b.appendChild(section('Все цвета', grid));
    var low = contrast(d.ink, d.bg) < 4.5 || contrast(d.ink, d.panel) < 4.5;
    if(low) b.appendChild(h('div', { 'class':'bld-issue warn', text:'Текст плохо читается на фоне (контраст ниже 4,5:1). Сделайте текст ярче или фон темнее — или нажмите «Подобрать остальные цвета».' }));
    var codeBox = h('div', { 'class':'th-code', hidden:'hidden' });
    var ta = h('textarea', { 'class':'input', rows:'3', placeholder:'Вставьте код темы, который вам прислали', 'aria-label':'Код темы' });
    codeBox.appendChild(ta);
    codeBox.appendChild(h('button', { type:'button', 'class':'btn sm', text:'Добавить тему из кода', on:{ click:function(){ var err = themeImport(ta.value); if(err){ toast(err); return; } TH_ED = null; $('themeEd').hidden = true; if(!$('pers').hidden) renderPers(); } } }));
    b.appendChild(h('div', { 'class':'th-acts' }, [
      h('button', { type:'button', 'class':'btn primary', text:'Сохранить', on:{ click:themeSave } }),
      h('button', { type:'button', 'class':'btn', text:'Отмена', on:{ click:function(){ themeCancel(); } } }),
      t.custom && !t.isNew ? h('button', { type:'button', 'class':'btn', text:'Удалить тему', on:{ click:themeDelete } }) : null,
      !t.custom && themeEdited(t.key) ? h('button', { type:'button', 'class':'btn', text:'Вернуть как было', on:{ click:function(){ var base = THEMES[t.key]; for(var k in base) d[k] = base[k]; delete UI.themeEdits[t.key]; save('triosteum.ui', UI); themeRender(); applyTheme(); toast('Тема «' + base.name + '» возвращена к исходной'); } } }) : null,
      h('button', { type:'button', 'class':'btn', text:'Копия как своя тема', on:{ click:function(){ var src = {}; for(var k in d) src[k] = d[k]; themeCancel(true); var key = 'c' + Date.now().toString(36); src.name = (src.name || 'Тема') + ' — копия'; TH_ED = { key:key, custom:true, isNew:true, draft:src, prevTheme:UI.theme, prevAccent:UI.accent }; UI.theme = key; UI.accent = null; applyTheme(); $('themeEd').hidden = false; themeRender(); } } }),
      h('button', { type:'button', 'class':'btn', text:'Поделиться кодом', title:'Скопировать код темы — его можно вставить в другом Triosteum', on:{ click:function(){ var c = themeCode(d); if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c).then(function(){ toast('Код темы скопирован'); }, function(){ toast('Браузер не разрешил копирование'); }); } } }),
      h('button', { type:'button', 'class':'btn', text:'Вставить код темы', on:{ click:function(){ codeBox.hidden = !codeBox.hidden; if(!codeBox.hidden) ta.focus(); } } })
    ]));
    b.appendChild(codeBox);
  }
  $('themeEdClose').addEventListener('click', function(){ themeCancel(); });
  $('themeEd').addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); themeCancel(); } });
