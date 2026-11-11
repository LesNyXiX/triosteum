  /* ---------- всплывающее окно (логика) ---------- */
  function hidePop(){ S.pop = false; el.pop.hidden = true; }
  function showPop(){ if(!S.sel) return hidePop(); S.pop = true; renderPop(); }
  var popWin = null;
  function placePop(){
    if(el.pop.hidden || !S.sel) return;
    if(window.innerWidth <= 640){ el.pop.style.left = ''; el.pop.style.top = ''; return; }
    if(popWin){ popWin.apply(); if(popWin.pinned()) return; }
    var rect;
    if(S.sel.type === 'tap'){
      var th = el.world.querySelector('.tap-handle[data-tap="' + S.sel.id + '"]');
      if(!th) return hidePop();
      rect = th.getBoundingClientRect();
    } else if(S.sel.type === 'edge'){
      var hit = el.world.querySelector('[data-edge="' + S.sel.id + '"].edge-hit');
      if(!hit) return hidePop();
      var len = hit.getTotalLength(), pt = hit.getPointAtLength(len / 2), m = hit.getScreenCTM();
      var x = pt.x * m.a + m.e, y = pt.y * m.d + m.f;
      rect = { left:x - 10, right:x + 10, top:y - 10, bottom:y + 10 };
    } else {
      var d = domOf(S.sel.type, S.sel.id); if(!d) return hidePop();
      rect = d.getBoundingClientRect();
      if(S.sel.type === 'node') rect = { left:rect.left, right:rect.right + STEM * G.cam.k + 10, top:rect.top, bottom:rect.bottom };
    }
    var pw = el.pop.offsetWidth, ph = el.pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = rect.right + 14;
    if(left + pw > vw - 8) left = rect.left - pw - 14;
    if(left < 8) left = Math.max(8, Math.min(vw - pw - 8, rect.left));
    var top = Math.max(60, Math.min(vh - ph - 36, rect.top - 10));
    el.pop.style.left = left + 'px'; el.pop.style.top = top + 'px';
  }
  function h(tag, attrs, kids){
    var e = document.createElement(tag);
    if(attrs) for(var k in attrs){
      if(k === 'text') e.textContent = attrs[k];
      else if(k === 'on') for(var ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else if(k === 'style') e.style.cssText = attrs[k];
      else if(k === 'html') e.innerHTML = attrs[k];
      else if(attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function(c){ if(c) e.appendChild(c); });
    return e;
  }
  function popHead(kind, sw){
    return h('div', { 'class':'pop-head' }, [
      h('div', { 'class':'k' }, [ sw ? h('span', { 'class':'sw', style:'background:' + sw }) : null, h('span', { text:kind }) ]),
      h('button', { 'class':'icon-btn', type:'button', 'aria-label':'Закрыть', on:{ click:hidePop } }, [ iconX() ])
    ]);
  }
  function iconX(){ var s = svg('svg', { 'class':'i', viewBox:'0 0 24 24', style:'width:16px;height:16px;stroke-width:2', 'aria-hidden':'true' }); s.appendChild(svg('path', { d:'M6 6l12 12M18 6L6 18' })); return s; }
  function section(label, body, forId){ return h('div', null, [ h(forId ? 'label' : 'div', forId ? { 'class':'flabel', 'for':forId, text:label } : { 'class':'flabel', text:label }), body ]); }

  function renderPop(){
    el.pop.innerHTML = ''; el.pop.hidden = false;
    var p = h('div', { 'class':'pop-in' }); el.pop.appendChild(p);
    if(S.sel.type === 'node') renderNodePop(p, nodeById(S.sel.id));
    else if(S.sel.type === 'note') renderNotePop(p, noteById(S.sel.id));
    else if(S.sel.type === 'tap') renderTapPop(p, edgeById(S.sel.edge));
    else renderEdgePop(p, edgeById(S.sel.id));
    placePop();
  }
  function renderNodePop(p, n){
    if(!n) return hidePop();
    var c = colorsOf(n), d = domOf('node', n.id);
    p.setAttribute('aria-label', 'Настройки блока «' + n.name + '»');
    p.appendChild(popHead('Блок · ' + shortName(langById(n.lang)), grad(c)));

    var name = h('input', { 'class':'input', id:'popName', maxlength:'60' }); name.value = n.name;
    name.addEventListener('input', function(){
      n.name = name.value.trim() || 'Блок';
      if(d){ d.querySelector('.nt').textContent = n.name; d.querySelector('.nt').title = n.name; }
      saveGraph();
    });
    p.appendChild(section('Название', name, 'popName'));

    var desc = h('textarea', { 'class':'input', id:'popDesc', maxlength:'140', placeholder:'Коротко: что делает блок' }); desc.value = n.desc || '';
    desc.addEventListener('input', function(){
      n.desc = desc.value; if(d){ d.querySelector('.nd').textContent = n.desc || 'ПКМ — настройки · 2× — открыть · потрясти — отцепить связи'; } saveGraph();
    });
    p.appendChild(section('Описание', desc, 'popDesc'));
    if(isDocs() && isParamKind(n.lang) && n.kind !== 'hub') p.appendChild(section('Параметры', paramSection(n)));
    if(isOffice() && (n.lang === 'sheet' || n.lang === 'doc') && n.kind !== 'hub') p.appendChild(section('Источник данных', srcSection(n)));
    var fsBox = h('div', null, [
      fsRow('Название', fsControl(n.fs || (n.kind === 'hub' ? 12 : 14), 9, 28, function(v){ n.fs = v; refreshNode(n); placePop(); }, 'шрифт названия блока')),
      n.kind === 'hub' ? null : fsRow('Описание', fsControl(n.dfs || 11.5, 8, 20, function(v){ n.dfs = v; refreshNode(n); }, 'шрифт описания блока'))
    ]);
    p.appendChild(section('Размер шрифта', fsBox));
    if(n.kind !== 'hub'){
      var szBox = h('div', null, [
        fsRow('Ширина', fsControl(NWof(n), NMIN_W, NMAX_W, function(v){ n.w = v === NW ? undefined : v; refreshNode(n); renderEdges(); placePop(); saveGraph(); }, 'ширина блока', 'px')),
        fsRow('Высота', fsControl(NHof(n), NMIN_H, NMAX_H, function(v){ n.h = v === NH ? undefined : v; refreshNode(n); renderEdges(); placePop(); saveGraph(); }, 'высота блока', 'px')),
        h('button', { type:'button', 'class':'btn sm', style:'width:100%;margin-top:6px', text:'Стандартный размер', on:{ click:function(){ n.w = undefined; n.h = undefined; refreshNode(n); renderEdges(); saveGraph(); renderPop(); } } })
      ]);
      p.appendChild(section('Размер блока', szBox));
    }
    if(!n.ts) n.ts = {};
    p.appendChild(section('Оформление текста', textStyleSection(n.ts, function(rerender){ refreshNode(n); if(rerender) renderPop(); }, { boldDefault:true })));

    var lg = h('div', { 'class':'lgrid', role:'radiogroup', 'aria-label':'Язык блока' });
    LANGS.forEach(function(l){
      var v = variantKind(n, l.id), on = l.id === n.lang;
      lg.appendChild(h('button', { type:'button', 'class':'lchip' + (on ? ' on' : ''), role:'radio', 'aria-checked':on ? 'true' : 'false',
        on:{ click:function(){ if(l.id !== n.lang) setNodeLang(n, l.id); } } }, [
        h('span', { 'class':'lt' }, [ h('i', { style:'background:' + grad(COLORS[l.id]) }), h('span', { text:shortName(l) }) ]),
        h('span', { 'class':'sub' + (v.ok ? ' ok' : ''), text:on ? 'сейчас' : v.t })
      ]));
    });
    if(!isDocs()) p.appendChild(section('Язык программирования', lg));

    var sws = h('div', { 'class':'swatches' });
    var langC = colorsOf({ lang:n.lang });   // и для блоков другой среды (документ на кодовой доске)
    sws.appendChild(h('button', { type:'button', 'class':'swb lang' + (!n.colors ? ' on' : ''), title:'Цвета языка', 'aria-label':'Цвета языка',
      style:'background:' + grad(langC), on:{ click:function(){ n.colors = null; refreshNode(n); renderPop(); } } }));
    PALETTES.forEach(function(pc){
      var on = n.colors && n.colors[0] === pc[0] && n.colors[1] === pc[1];
      sws.appendChild(h('button', { type:'button', 'class':'swb' + (on ? ' on' : ''), 'aria-label':'Цвета ' + pc.join(' и '),
        style:'background:' + grad(pc), on:{ click:function(){ n.colors = pc.slice(); refreshNode(n); renderPop(); } } }));
    });
    var c1 = h('input', { type:'color', 'aria-label':'Первый цвет рамки' }); c1.value = c[0];
    var c2 = h('input', { type:'color', 'aria-label':'Второй цвет рамки' }); c2.value = c[1];
    function custom(){ n.colors = [c1.value, c2.value]; refreshNode(n); p.querySelector('.pop-head .sw').style.background = grad(n.colors); }
    c1.addEventListener('input', custom); c2.addEventListener('input', custom);
    sws.appendChild(h('span', { 'class':'custom' }, [ h('span', { text:'свои' }), c1, c2 ]));
    p.appendChild(section('Цвета рамки', sws));

    if(n.kind === 'hub'){
      var hi = h('div', { style:'display:flex;flex-direction:column;gap:2px' }, [
        toggleRow('Счётчик входящих подключений', !!n.showCount, function(v){ n.showCount = v; saveGraph(); renderEdges(); renderPop(); })
      ]);
      if(n.showCount) hi.appendChild(h('div', { style:'margin-top:6px' }, [ h('div', { 'class':'flabel', text:'Цвет счётчика' }),
        colorRow(BADGE_COLORS, n.badgeColor || BADGE_COLORS[0], function(c, live){ n.badgeColor = c || BADGE_COLORS[0]; saveGraph(); renderEdges(); if(!live) renderPop(); }, 'Цвет счётчика') ]));
      p.appendChild(section('Индикаторы', hi));
    }
    p.appendChild(aiSection(n));

    var links = G.edges.filter(function(e){ return e.from === n.id || e.to === n.id; }).length;
    p.appendChild(section('Действия', h('div', { 'class':'acts' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Комментарий', on:{ click:function(){ addComment(n); } } }),
      (isDocs() && (isParamKind(n.lang) || n.kind === 'hub')) ? null : h('button', { type:'button', 'class':'btn sm primary', text:isDocs() ? (n.lang === 'doc' ? 'Открыть документ' : (n.lang === 'sheet' ? 'Открыть таблицу' : 'Открыть код')) : 'Открыть код', on:{ click:function(){ openNode(n.id); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Дублировать', on:{ click:function(){ duplicateNode(n); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'В «Мои плагины»', on:{ click:function(){ saveNodeAsPlugin(n); } } }),
      h('button', { type:'button', 'class':'btn sm', text:isDocs() ? 'Сбросить к шаблону' : 'Сбросить код', on:{ click:function(){ n.codes = {}; saveGraph(); refreshNode(n); toast(isDocs() ? 'Блок возвращён к шаблону' : 'Код блока возвращён к исходному'); renderPop(); } } }),
      h('button', { type:'button', 'class':'btn sm', text:links ? 'Отсоединить связи (' + links + ')' : 'Связей нет', disabled:links ? null : 'disabled',
        on:{ click:function(){ G.edges = G.edges.filter(function(e){ return e.from !== n.id && e.to !== n.id; }); saveGraph(); renderEdges(); status(); renderPop(); } } }),
      h('button', { type:'button', 'class':'btn sm danger', text:'Удалить', on:{ click:deleteSel } })
    ])));
  }
  function renderNotePop(p, t){
    if(!t) return hidePop();
    p.setAttribute('aria-label', t.attach ? 'Комментарий к блоку' : 'Настройки заметки');
    var owner = t.attach && nodeById(t.attach);
    p.appendChild(popHead(owner ? 'Комментарий · ' + owner.name : 'Текст', null));
    var ta = h('textarea', { 'class':'input', id:'popText', placeholder:'Введите текст…' }); ta.value = t.text || '';
    ta.addEventListener('input', function(){ t.text = ta.value; var d = domOf('note', t.id); if(d) d.textContent = t.text; saveGraph(); renderEdges(); placePop(); });
    p.appendChild(section('Текст', ta, 'popText'));
    p.appendChild(section('Размер шрифта', fsControl(noteFs(t), 8, 72, function(v){
      t.fs = v; delete t.size;
      var d = domOf('note', t.id); if(d) d.style.setProperty('--fs', v + 'px');
      if(t.attach && t.auto && d){ t.dx = -(d.offsetWidth + 44); syncNote(t); d.style.left = t.x + 'px'; }
      saveGraph(); renderEdges(); placePop();
    }, 'размер шрифта заметки')));
    if(!t.ts) t.ts = {};
    p.appendChild(section('Оформление текста', textStyleSection(t.ts, function(rerender){
      var d = domOf('note', t.id); styleHtml(d, t.ts);
      if(t.attach && t.auto && d){ t.dx = -(d.offsetWidth + 44); syncNote(t); d.style.left = t.x + 'px'; }
      saveGraph(); renderEdges(); if(rerender) renderPop();
    })));
    var sws = h('div', { 'class':'swatches' });
    [['grey','Серый'],['red','Бордовый'],['yellow','Жёлтый'],['blue','Синий']].forEach(function(o){
      sws.appendChild(h('button', { type:'button', 'class':'swb' + ((t.tint || 'grey') === o[0] ? ' on' : ''), 'aria-label':'Фон: ' + o[1],
        style:'background:' + TINTS[o[0]].replace(/,\.\d+\)/, ',.7)'), on:{ click:function(){ t.tint = o[0]; saveGraph(); renderGraph(); updateSel(); renderPop(); } } }));
    });
    p.appendChild(section('Фон', sws));
    p.appendChild(section('Действия', h('div', { 'class':'acts' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Редактировать на доске', on:{ click:function(){ editNote(t.id); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Дублировать', on:{ click:function(){
        var c = JSON.parse(JSON.stringify(t)); c.id = newId('t'); c.x += 24; c.y += 24; G.notes.push(c);
        S.sel = { type:'note', id:c.id }; saveGraph(); renderGraph(); renderPop(); } } }),
      h('button', { type:'button', 'class':'btn sm danger', text:'Удалить', on:{ click:deleteSel } })
    ])));
  }
  function renderEdgePop(p, e){
    if(!e) return hidePop();
    var a = nodeById(e.from), b = nodeById(e.to);
    p.appendChild(popHead('Связь', null));
    var ol = h('ol', { style:'margin:0;padding-left:20px;font-size:14px;line-height:1.7' });
    flowText(e).forEach(function(t){ ol.appendChild(h('li', { text:t })); });
    p.appendChild(section('Порядок выполнения', ol));
    p.appendChild(h('div', { style:'font-size:12px;color:var(--dim);line-height:1.5', text:'Двойной клик по связи добавляет точку. Потяните к точке отросток блока — он встроится в поток. Точку можно двигать вдоль связи, номер показывает порядок.' }));
    p.appendChild(h('div', { 'class':'acts' }, [
      h('button', { type:'button', 'class':'btn sm', text:'Добавить точку', on:{ click:function(){
        var tp = addTap(e, freeT(e, 0.5)); S.sel = { type:'tap', id:tp.id, edge:e.id }; renderEdges(); renderPop(); } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Развернуть', on:{ click:function(){
        var f = e.from; e.from = e.to; e.to = f;
        (e.taps || []).forEach(function(tp){ tp.t = 1 - tp.t; });
        if(G.edges.filter(function(x){ return x.from === e.from && x.to === e.to; }).length > 1){ G.edges = G.edges.filter(function(x){ return x !== e; }); S.sel = null; hidePop(); }
        saveGraph(); renderEdges(); if(S.sel) renderPop(); } } }),
      h('button', { type:'button', 'class':'btn sm danger', text:'Удалить', on:{ click:deleteSel } })
    ]));
  }
  function freeT(e, t){
    var taken = (e.taps || []).map(function(x){ return x.t; });
    var cands = [t, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85];
    for(var i = 0; i < cands.length; i++){ if(taken.every(function(x){ return Math.abs(x - cands[i]) > 0.07; })) return cands[i]; }
    return t;
  }
  function toggleRow(label, on, change){
    var inp = h('input', { type:'checkbox', role:'switch' }); inp.checked = !!on;
    inp.addEventListener('change', function(){ change(inp.checked); });
    return h('label', { 'class':'tgl' }, [ h('span', { text:label }), inp ]);
  }
  function colorRow(list, current, pick, ariaPrefix, autoTitle, autoBg){
    var row = h('div', { 'class':'swatches' });
    if(autoTitle) row.appendChild(h('button', { type:'button', 'class':'swb lang' + (!current ? ' on' : ''), title:autoTitle, 'aria-label':autoTitle,
      style:'background:' + (autoBg || 'linear-gradient(135deg,#3776AB,#FFD43B)'), on:{ click:function(){ pick(null); } } }));
    list.forEach(function(c){
      row.appendChild(h('button', { type:'button', 'class':'swb' + (current === c ? ' on' : ''), 'aria-label':ariaPrefix + ' ' + c, style:'background:' + c, on:{ click:function(){ pick(c); } } }));
    });
    var ci = h('input', { type:'color', 'aria-label':ariaPrefix + ': свой цвет' }); ci.value = current || list[0];
    ci.addEventListener('input', function(){ pick(ci.value, true); });
    row.appendChild(h('span', { 'class':'custom' }, [ h('span', { text:'свой' }), ci ]));
    return row;
  }
  function renderTapPop(p, e){
    var tp = e && tapById(e, S.sel.id);
    if(!tp) return hidePop();
    var idx = sortedTaps(e).indexOf(tp) + 1, a = nodeById(e.from), b = nodeById(e.to), ns = tapNodes(tp);
    function upd(rerender){ saveGraph(); renderEdges(); if(rerender) renderPop(); }
    p.setAttribute('aria-label', 'Настройки точки ' + idx);
    p.appendChild(popHead('Точка ' + idx + ' · ' + (a ? a.name : '?') + ' → ' + (b ? b.name : '?'), tp.color || (ns.length ? grad(colorsOf(ns[0])) : null)));

    var nm = h('input', { 'class':'input', id:'tapName', maxlength:'40', placeholder:'Например: «Сверка с бюджетом»' }); nm.value = tp.name || '';
    nm.addEventListener('input', function(){ tp.name = nm.value.trim(); upd(false); });
    p.appendChild(section('Название (подпись под точкой)', nm, 'tapName'));
    p.appendChild(fsRow('Размер шрифта подписи', fsControl(tp.fs || 11.5, 8, 36, function(v){ tp.fs = v; upd(false); }, 'шрифт подписи точки')));
    if(tp.name){
      if(!tp.ts) tp.ts = {};
      p.appendChild(section('Оформление подписи', textStyleSection(tp.ts, function(rerender){ upd(rerender); }, { boldDefault:true })));
    }

    p.appendChild(section('Цвет точки', colorRow(DOT_COLORS, tp.color, function(c, live){ tp.color = c; upd(!live); }, 'Цвет точки', 'Как у подключённого блока')));
    var seg = h('div', { 'class':'seg' });
    [['s','Мелкая'],['m','Обычная'],['l','Крупная']].forEach(function(o){
      var on = (tp.size || 'm') === o[0];
      seg.appendChild(h('button', { type:'button', 'class':'btn sm' + (on ? ' on' : ''), 'aria-pressed':on ? 'true' : 'false', text:o[1], on:{ click:function(){ tp.size = o[0]; upd(true); } } }));
    });
    p.appendChild(section('Размер', seg));

    var ind = h('div', { style:'display:flex;flex-direction:column;gap:2px' }, [
      toggleRow('Номер в порядке выполнения', tp.showNum !== false, function(v){ tp.showNum = v; upd(false); }),
      toggleRow('Счётчик подключённых блоков', !!tp.showCount, function(v){ tp.showCount = v; upd(true); }),
      tp.name ? toggleRow('Показывать подпись', tp.showLabel !== false, function(v){ tp.showLabel = v; upd(false); }) : null
    ]);
    if(tp.showCount) ind.appendChild(h('div', { style:'margin-top:6px' }, [ h('div', { 'class':'flabel', text:'Цвет счётчика' }),
      colorRow(BADGE_COLORS, tp.badgeColor || BADGE_COLORS[0], function(c, live){ tp.badgeColor = c || BADGE_COLORS[0]; upd(!live); }, 'Цвет счётчика') ]));
    p.appendChild(section('Индикаторы', ind));

    if(!ns.length){
      p.appendChild(h('div', { style:'font-size:13px;line-height:1.5;color:var(--muted)', text:'Точка пустая. Потяните к ней отросток любого блока, чтобы встроить его в поток. Подключить можно несколько блоков.' }));
    } else {
      var list = h('div', { style:'display:flex;flex-direction:column;gap:6px' });
      ns.forEach(function(n){
        list.appendChild(h('div', { style:'display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg)' }, [
          h('span', { style:'width:10px;height:10px;border-radius:3px;flex:none;background:' + grad(colorsOf(n)) }),
          h('button', { type:'button', style:'flex:1;min-width:0;text-align:left;background:none;border:0;padding:4px 0;cursor:pointer;font-size:13px;color:var(--ink-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
            text:n.name, title:'Открыть настройки блока', on:{ click:function(){ S.sel = { type:'node', id:n.id }; updateSel(); renderPop(); } } }),
          h('button', { type:'button', 'class':'btn sm', text:'Отсоединить', on:{ click:function(){
            tp.nodes = tapIds(tp).filter(function(x){ return x !== n.id; }); upd(true); } } })
        ]));
      });
      p.appendChild(section('Подключено блоков: ' + ns.length, list));
    }
    var ol = h('ol', { style:'margin:0;padding-left:20px;font-size:13px;line-height:1.7;color:var(--muted)' });
    flowText(e).forEach(function(t){ ol.appendChild(h('li', { text:t })); });
    p.appendChild(section('Порядок выполнения', ol));
    p.appendChild(h('div', { style:'font-size:12px;color:var(--dim);line-height:1.5', text:'Зажмите точку и двигайте вдоль связи — номер точки её место в порядке.' }));
    p.appendChild(h('div', { 'class':'acts' }, [
      ns.length > 1 ? h('button', { type:'button', 'class':'btn sm', text:'Отсоединить все', on:{ click:function(){ tp.nodes = []; upd(true); } } }) : null,
      h('button', { type:'button', 'class':'btn sm', text:'Сбросить вид', on:{ click:function(){
        delete tp.color; delete tp.size; delete tp.showNum; delete tp.showCount; delete tp.badgeColor; delete tp.showLabel; upd(true); } } }),
      h('button', { type:'button', 'class':'btn sm danger', text:'Удалить точку', on:{ click:deleteSel } })
    ]));
  }
