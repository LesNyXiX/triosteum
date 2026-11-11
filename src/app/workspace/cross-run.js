  /* =====================================================================
     СКВОЗНАЯ КОМПИЛЯЦИЯ: запрос к ИИ может опираться на то, что лежит в
     других пространствах и средах. Triosteum находит упомянутые в запросе
     блоки, таблицы, документы и целые пространства, ставит на доску живые
     ссылки на них (блок-ссылка всегда берёт свежий код или данные из
     источника) и компилирует всё одним маршрутом.
     ===================================================================== */
  var XSTOP = { 'взять':1, 'взяв':1, 'сделать':1, 'нужно':1, 'надо':1, 'чтобы':1, 'который':1, 'которые':1, 'данные':0, 'потом':1, 'затем':1, 'после':1, 'через':1, 'всех':1, 'всего':1, 'каждый':1, 'каждого':1, 'среды':1, 'среде':1, 'среда':1, 'пространство':1, 'пространства':1, 'пространстве':1, 'блок':1, 'блока':1, 'блоки':1, 'таблица':0, 'таблицу':0, 'таблицы':0, 'новый':1, 'новое':1, 'вывести':1, 'посчитать':1, 'отправить':1, 'сравнить':1, 'сравнение':1 };
  function xNorm(s){ return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`(),.;:!?/\\|[\]{}<>+=*#№%-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function xStems(s){ return xNorm(s).split(' ').filter(function(w){ return w.length >= 4 && !XSTOP[w]; }).map(function(w){ return w.slice(0, Math.max(4, Math.min(6, w.length - 2))); }); }
  function xSpaceGraph(id){ if(id === PROJ.cur) return G; var g = Repo.space(id); return g && typeof g === 'object' ? g : null; }
  function xEnvName(id){ return ENVS[id || 'code'] ? ENVS[id || 'code'].name : 'Разработка'; }
  // всё, на что может сослаться запрос: пространства, их блоки и файлы
  function xIndex(){
    var out = [];
    PROJ.list.forEach(function(p){
      var g = xSpaceGraph(p.id); if(!g) return;
      var env = p.env || 'code', base = { sp:p.id, spName:p.name, env:env, envName:xEnvName(env), here:p.id === PROJ.cur };
      out.push(Object.assign({ kind:'space', name:p.name, count:(g.nodes || []).length }, base));
      (g.nodes || []).forEach(function(n){ if(n.kind === 'hub' || n.xref) return; out.push(Object.assign({ kind:'node', id:n.id, name:n.name, lang:n.lang, desc:n.desc || '' }, base)); });
      ((g.files && g.files.items) || []).forEach(function(f){ if(f.type !== 'sheet' && f.type !== 'doc') return; out.push(Object.assign({ kind:'file', id:f.id, name:f.name, lang:f.type, desc:f.type === 'sheet' ? 'таблица' : 'документ' }, base)); });
    });
    return out;
  }
  // Точные названия имеют приоритет над похожими словами: лишний блок меняет исполнение схемы.
  function xFind(prompt, opts){
    opts = opts || {};
    var idx = xIndex(), q = xNorm(prompt), qs = {}, quoted = [];
    xStems(prompt).forEach(function(s){ qs[s] = 1; });
    var unquoted = xNorm(String(prompt).replace(/[«"]([^»"]{2,80})[»"]/g, function(m, x){ quoted.push(xNorm(x)); return ' '; }));
    var hits = [], exact = [];
    idx.forEach(function(it){
      if(it.here && !opts.withHere) return;
      var nm = xNorm(it.name), score = 0;
      if(!nm) return;
      if(quoted.indexOf(nm) >= 0) score = 2;
      else if(nm.length >= 5 && (' ' + unquoted + ' ').indexOf(' ' + nm + ' ') >= 0) score = 1.5;
      else {
        var st = xStems(it.name); if(!st.length) return;
        var m = st.filter(function(s){ return qs[s]; }).length;
        if(m && m / st.length >= 0.6 && (m >= 2 || st.length === 1)) score = m / st.length;
      }
      if(!score) return;
      var isExact = score >= 1.5;
      if(it.kind === 'space' && /пространств|сред/.test(q)) score += 0.3;
      if(new RegExp('сред[аеуы]? «?' + xNorm(it.envName).split(' ')[0]).test(q) || q.indexOf(xNorm(it.envName)) >= 0) score += 0.2;
      var hit = Object.assign({ score:score }, it);
      hits.push(hit); if(isExact) exact.push(hit);
    });
    // Если названия заданы явно, не добавляем фильтры и другие блоки по совпадению основ.
    // Несуществующее название в кавычках также не заменяем похожим объектом.
    if(exact.length || quoted.length) hits = exact;
    // целое пространство поглощает упоминания своих же блоков
    var spaces = {}; hits.forEach(function(x){ if(x.kind === 'space' && x.score >= 1) spaces[x.sp] = 1; });
    hits = hits.filter(function(x){ return x.kind === 'space' || !spaces[x.sp]; });
    hits.sort(function(a, b){ return b.score - a.score; });
    return hits.slice(0, opts.max || 24);
  }
  /* ---------- блок-ссылка ---------- */
  // свежий код или данные источника; null — источник пропал (тогда работает сохранённая копия)
  function xrefCode(n){
    var r = n.xref, g = r && xSpaceGraph(r.sp); if(!g) return null;
    if(r.file){
      var f = ((g.files && g.files.items) || []).filter(function(x){ return x.id === r.file; })[0];
      return f && typeof fileAsBlockCode === 'function' ? fileAsBlockCode(f, n.lang) : null;
    }
    var s = (g.nodes || []).filter(function(x){ return x.id === r.node; })[0]; if(!s) return null;
    if(s.src && g.files){ var sf = (g.files.items || []).filter(function(x){ return x.id === s.src; })[0]; if(sf && typeof fileAsBlockCode === 'function'){ var fc = fileAsBlockCode(sf, s.lang); if(fc !== null) return fc; } }
    if(s.codes && s.codes[s.lang] !== undefined) return s.codes[s.lang];
    if(s.pluginId && pluginById(s.pluginId) || s.family) return nodeOriginal(s);
    return null;
  }
  var _xNodeCode = nodeCode;
  nodeCode = function(n){ if(n && n.xref){ var c = xrefCode(n); if(c !== null && c !== undefined) return c; } return _xNodeCode(n); };
  function xMakeNode(it, x, y){
    var g = xSpaceGraph(it.sp), src = it.kind === 'node' ? (g.nodes || []).filter(function(z){ return z.id === it.id; })[0] : null;
    var lang = it.lang || (src && src.lang), n = { id:newId('n'), name:it.name, lang:lang, x:Math.round(x), y:Math.round(y), codes:{}, pluginId:src ? src.pluginId || null : null, orig:src && src.orig ? src.orig : undefined, family:src ? src.family || null : null,
      desc:'↗ из «' + it.spName + '» · ' + it.envName + (src && src.desc ? ' — ' + src.desc : ''), colors:src ? colorsOf(src) : (COLORS[lang] || foreignColors(lang) || null), env:it.env,
      xref:it.kind === 'file' ? { sp:it.sp, file:it.id, spName:it.spName, env:it.env } : { sp:it.sp, node:it.id, spName:it.spName, env:it.env } };
    if(src && src.w) n.w = src.w; if(src && src.h) n.h = src.h;
    var c = null; try { c = xrefCode(n); } catch(e){}
    if(c !== null && c !== undefined) n.codes[lang] = c;   // копия на случай, если источник удалят
    return n;
  }
  // тип блока для порядка «источник → обработка → результат», когда связи не заданы
  function xRank(lang){ if(/^(sheet|src|source|1c)$/.test(lang)) return 0; if(/^(doc|send|step|html|report)$/.test(lang)) return 2; return 1; }
  // поставить найденное на доску ссылками; целое пространство — со своими связями
  function xPlace(hits, opts){
    opts = opts || {};
    var made = [], tail = [], c = viewCenter(), x0 = G.nodes.length ? Math.max.apply(0, G.nodes.map(function(n){ return n.x + NWof(n); })) + 200 : c.x - 300, y = c.y - 120;
    hits.forEach(function(it){
      if(it.kind === 'space'){
        var g = xSpaceGraph(it.sp); if(!g) return;
        var map = {}, nodes = (g.nodes || []).filter(function(n){ return n.kind !== 'hub' && !n.xref; });
        nodes.forEach(function(sn, i){ var n = xMakeNode({ kind:'node', id:sn.id, name:sn.name, lang:sn.lang, sp:it.sp, spName:it.spName, env:it.env, envName:it.envName }, x0 + (i % 4) * (NW + 80), y + Math.floor(i / 4) * (NH + 50)); G.nodes.push(n); made.push(n); map[sn.id] = n.id; });
        (g.edges || []).forEach(function(e){ if(map[e.from] && map[e.to]) G.edges.push({ id:newId('e'), from:map[e.from], to:map[e.to], taps:[] }); });
        var outs = nodes.filter(function(sn){ return !(g.edges || []).some(function(e){ return e.from === sn.id && map[e.to]; }); }).map(function(sn){ return nodeById(map[sn.id]); });
        tail.push({ rank:1, outs:outs, ins:nodes.filter(function(sn){ return !(g.edges || []).some(function(e){ return e.to === sn.id && map[e.from]; }); }).map(function(sn){ return nodeById(map[sn.id]); }) });
        y += (Math.ceil(nodes.length / 4)) * (NH + 50) + 60;
      } else {
        var n = xMakeNode(it, x0, y); G.nodes.push(n); made.push(n); tail.push({ rank:xRank(n.lang), outs:[n], ins:[n] }); y += NH + 50;
      }
    });
    // связи между найденным: источники → обработка → результаты
    if(opts.link !== false && tail.length > 1){
      tail.sort(function(a, b){ return a.rank - b.rank; });
      for(var i = 0; i + 1 < tail.length; i++) tail[i].outs.forEach(function(a){ tail[i + 1].ins.forEach(function(b){ if(a && b && a !== b) G.edges.push({ id:newId('e'), from:a.id, to:b.id, taps:[] }); }); });
    }
    if(typeof layoutSet === 'function' && made.length) layoutSet(made, x0, c.y);
    return made;
  }
  // описание найденного для ИИ-архитектора: на это он ссылается вместо того, чтобы писать заново
  function xForPrompt(hits){
    return hits.map(function(it, i){ return '- x' + (i + 1) + ' | ' + (it.kind === 'space' ? 'пространство целиком (' + it.count + ' блоков)' : it.kind === 'file' ? (it.lang === 'sheet' ? 'таблица' : 'документ') : 'блок ' + (langById(it.lang) ? shortName(langById(it.lang)) : it.lang)) + ' | «' + it.name + '» | из «' + it.spName + '», среда «' + it.envName + '»' + (it.desc && it.kind === 'node' ? ' — ' + it.desc : ''); }).join('\n');
  }
  // без ИИ: найти упомянутое, поставить на доску и сразу скомпилировать
  function xBuildRun(prompt, fresh){
    var hits = xFind(prompt);
    if(!hits.length){ toast('В других пространствах ничего из запроса не нашлось. Назовите блоки, таблицы или пространства как в Triosteum — можно в «кавычках»'); return false; }
    if(fresh) newProj('Сводная: ' + String(prompt).slice(0, 40), null, ENV.id);
    var made = xPlace(hits);
    S.sel = null; S.multi = made.map(function(n){ return { type:'node', id:n.id }; });
    saveGraph(); renderGraph(); updateSel(); setTimeout(fitView, 30);
    toast('Поставлено ссылок: ' + made.length + ' — из ' + hits.map(function(h0){ return '«' + h0.spName + '»'; }).filter(function(v, i, a){ return a.indexOf(v) === i; }).join(', ') + '. Компилирую…');
    setTimeout(function(){ runBoard(); }, 400);
    return true;
  }
  // двойной клик по ссылке — открыть источник там, где он живёт
  var _xOpenBlock = openBlock;
  openBlock = function(n){
    if(!n || !n.xref) return _xOpenBlock(n);
    var r = n.xref; if(!PROJ.list.some(function(p){ return p.id === r.sp; })){ toast('Пространство-источник удалено — блок работает на сохранённой копии'); return _xOpenBlock(n); }
    switchProj(r.sp);
    setTimeout(function(){
      if(r.file && typeof ofOpen === 'function' && ENV.office){ ofOpen(r.file); return; }
      var s = nodeById(r.node); if(s){ S.sel = { type:'node', id:s.id }; updateSel(); _xOpenBlock(s); }
    }, 60);
  };
