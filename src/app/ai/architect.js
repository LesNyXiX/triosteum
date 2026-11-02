  // ---------- ИИ-архитектор ----------
  var ARC = { busy:false, chars:0, res:null, err:null, prompt:'', fresh:null }, arcWin = null;
  var ARC_EXAMPLES_DOCS = [
    'Договоры поставки из реестра: сформировать договор, крупные согласовать с финдиректором, подписать ЭЦП, зарегистрировать и выгрузить реестр в Excel',
    'Входящие счета: оставить новые, согласовать с руководителем и финдиректором, передать в 1С на оплату и отправить отчёт на почту',
    'Бюджет отдела: найти статьи с перерасходом больше 10%, сформировать служебные записки с объяснением и отправить на согласование'
  ];
  var ARC_EXAMPLES = [
    'Взять из 1С открытые заказы, посчитать маржу по каждому и отправить отчёт руководителю на почту',
    'Контроль OEE оборудования по сменам с уведомлением в Telegram, если OEE ниже 65%',
    'Прогноз продаж на 3 месяца и сравнение с остатками на складах, вывести таблицу дефицита'
  ];
  function openArc(){
    closeCtx(); hidePop(); closeAddMenu();
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    $('arcW').hidden = false; $('aiFab').setAttribute('aria-expanded', 'true');
    if(!arcWin) arcWin = makeWindow($('arcW'), '.pers-h', 'arc', 'fixed');
    arcWin.apply(); renderArc();
    var ta = $('arcW').querySelector('.arc-in'); if(ta && !ARC.res) ta.focus();
  }
  function closeArc(){ $('arcW').hidden = true; $('aiFab').setAttribute('aria-expanded', 'false'); }
  $('aiFab').addEventListener('click', function(){ $('arcW').hidden ? openArc() : closeArc(); });
  $('arcClose').addEventListener('click', closeArc);
  $('arcW').addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeArc(); $('aiFab').focus(); } });
  function renderArc(){
    var b = $('arcBody'); b.innerHTML = '';
    var aiOff = AI.api === null, aiWait = AI.api === undefined;
    var ta = h('textarea', { 'class':'bld-wish arc-in', rows:'4', placeholder:isDocs() ? 'Опишите процесс: какие документы, откуда данные, кто согласует и подписывает, куда выгрузить…' : 'Опишите задачу: откуда берём данные, что считаем, куда отправляем результат…', 'aria-label':'Задача для ИИ' });
    ta.value = ARC.prompt; ta.addEventListener('input', function(){ ARC.prompt = ta.value; });
    ta.addEventListener('keydown', function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); buildArc(); } });
    var ex = h('div', { 'class':'arc-ex' }, (isDocs() ? ARC_EXAMPLES_DOCS : ARC_EXAMPLES).map(function(t){ return h('button', { type:'button', 'class':'chip', text:t, on:{ click:function(){ ARC.prompt = t; ta.value = t; ta.focus(); } } }); }));
    if(ARC.fresh === null) ARC.fresh = G.nodes.length > 0;
    var fresh = toggleRow('Собрать в новом пространстве (текущая доска не изменится)', ARC.fresh, function(v){ ARC.fresh = v; });
    b.appendChild(section('Задача', h('div', { 'class':'arc-col' }, [ ta, ex, fresh,
      h('div', { 'class':'bld-acts' }, [
        h('button', { type:'button', 'class':'btn primary', text:ARC.busy ? 'ИИ проектирует…' : 'Собрать схему', disabled:(ARC.busy || aiOff || aiWait) ? 'disabled' : null, on:{ click:buildArc } }),
        h('span', { 'class':'bld-stat', text:(IS_MAC ? '⌘' : 'Ctrl') + '+Enter' })
      ]),
      aiOff ? h('div', { 'class':'bld-issue warn', text:'ИИ доступен, когда среда открыта в claude.ai.' }) : null
    ].filter(Boolean))));
    if(ARC.busy) b.appendChild(h('div', { 'class':'arc-prog' }, [ h('span', { 'class':'arc-spin', 'aria-hidden':'true' }), h('span', { 'class':'arc-pt', text:(isDocs() ? 'ИИ подбирает шаблоны, пишет недостающие и составляет регламент… ' : 'ИИ подбирает плагины, пишет недостающие и собирает бэкенд… ') + (ARC.chars ? ARC.chars + ' симв.' : '') }) ]));
    if(ARC.err) b.appendChild(h('div', { 'class':'bld-issue err', text:ARC.err }));
    if(ARC.res) b.appendChild(section('Предложенная схема', arcPreview()));
  }
  function arcPreview(){
    var r = ARC.res, box = h('div', { 'class':'bld-res' });
    box.appendChild(h('div', { 'class':'bld-t', text:r.title }));
    if(r.summary) box.appendChild(h('p', { 'class':'bld-sum', text:r.summary }));
    var ol = h('ol', { 'class':'arc-blocks' });
    r.blocks.forEach(function(bk){
      var l = langById(bk.lang);
      ol.appendChild(h('li', null, [
        h('i', { style:'background:' + grad(COLORS[bk.lang]) }),
        h('span', { 'class':'nm', text:bk.name }),
        h('span', { 'class':'tag' + (bk.isNew ? ' new' : ''), text:(bk.isNew ? 'новый ' + ENV.word.plugin : 'из библиотеки') + ' · ' + shortName(l) }),
        bk.desc ? h('span', { 'class':'ds', text:bk.desc }) : null
      ].filter(Boolean)));
    });
    box.appendChild(ol);
    var nNew = r.blocks.filter(function(x){ return x.isNew; }).length;
    box.appendChild(h('div', { 'class':'bld-stat', text:'Блоков: ' + r.blocks.length + ' (из библиотеки: ' + (r.blocks.length - nNew) + ', новых: ' + nNew + ') · Связей: ' + r.links.length + (r.backend ? ' · ' + (isDocs() ? 'Регламент' : 'Бэкенд') + ': ' + r.backend.split('\n').length + ' строк' : '') }));
    box.appendChild(h('div', { 'class':'bld-acts' }, [
      h('button', { type:'button', 'class':'btn primary', text:'Поставить на доску', on:{ click:applyArc } }),
      h('button', { type:'button', 'class':'btn', text:'Собрать заново', on:{ click:buildArc } }),
      h('button', { type:'button', 'class':'btn', text:'Отклонить', on:{ click:function(){ ARC.res = null; renderArc(); } } })
    ]));
    return box;
  }
  function buildArc(){
    var q = (ARC.prompt || '').trim();
    if(!AI.api || ARC.busy) return;
    if(!q){ toast('Опишите задачу для ИИ'); return; }
    ARC.busy = true; ARC.chars = 0; ARC.res = null; ARC.err = null; renderArc();
    var catalog = PLUGINS.concat(myVis()).map(function(p){ return '- ' + p.id + ' | ' + langById(p.lang).name + ' | ' + p.name + ' — ' + (p.desc || ''); }).join('\n');
    var fmts = LANGS.map(function(l){ return '#### ' + l.name + ' (lang="' + l.id + '")\n' + FENCE + langTag(l.id) + '\n' + l.tpl.replace(/\s+$/, '') + '\n' + FENCE; }).join('\n');
    var ctxBoard = !ARC.fresh && G.nodes.length ? 'На доске уже есть блоки (новые ставятся рядом, связывать с ними нельзя): ' + G.nodes.map(function(n){ return n.name; }).join(', ') : '';
    var prompt = isDocs() ? docsArcPrompt(q, catalog, ctxBoard) : [
      'Ты — ИИ-архитектор Triosteum, платформы автоматизации и аналитики для производственных компаний России.',
      'Схема — это блоки с кодом (плагины), соединённые связями: результат блока передаётся по связи следующему (функция run получает данные предыдущего блока).',
      'По задаче пользователя спроектируй схему:',
      '1) В первую очередь используй готовые плагины из каталога (указывай их id).',
      '2) Чего нет в каталоге — создай новый плагин сам: полный рабочий код в формате Triosteum для выбранного языка (образцы ниже). У Python-плагинов задай sample — тестовые данные, чтобы блок работал и без входа; функция run должна принимать данные предыдущего блока.',
      '3) Связи — по реальному потоку данных. 3–8 блоков. Названия блоков — по-русски, по смыслу.',
      '4) Напиши целостный бэкенд всей схемы. ' + BACKEND_RULES,
      'Ответь ТОЛЬКО одним блоком JSON (без текста до и после):',
      FENCE + 'json',
      '{"title":"короткое название схемы","summary":"2–3 предложения: что делает схема",',
      ' "blocks":[{"key":"b1","plugin":"<id из каталога>","name":"название на доске"},',
      '           {"key":"b2","new":true,"name":"название","lang":"python|html|cpp|csharp|1c","desc":"одна строка","code":"полный код плагина"}],',
      ' "links":[{"from":"b1","to":"b2"}],',
      ' "backend":"полный код бэкенда на Python"}',
      FENCE,
      '', 'Каталог плагинов (id | язык | название — описание):', catalog,
      '', 'Форматы плагинов по языкам:', fmts,
      ctxBoard ? '\n' + ctxBoard : '',
      '', 'Задача пользователя: ' + q
    ].join('\n');
    AI.api(prompt, { cache:false, onText:function(ev){ ARC.chars = ev.text.length; var s = $('arcBody').querySelector('.arc-pt'); if(s) s.textContent = 'ИИ подбирает плагины, пишет недостающие и собирает бэкенд… ' + ARC.chars + ' симв.'; } })
      .then(function(r){
        ARC.busy = false;
        try{ ARC.res = parseArc(r.text); if(!ARC.res.blocks.length) throw new Error('empty'); }
        catch(e){ ARC.res = null; ARC.err = 'ИИ ответил в неожиданном формате. Нажмите «Собрать схему» ещё раз или уточните задачу.'; }
        if(!$('arcW').hidden) renderArc();
      }, function(err){ ARC.busy = false; ARC.err = aiFail(err); if(!$('arcW').hidden) renderArc(); });
  }
  function docsArcPrompt(q, catalog, ctxBoard){
    return [
      'Ты — ИИ-архитектор Triosteum в среде «Документы и таблицы»: документооборот российского производственного предприятия.',
      'Схема — блоки, соединённые связями; по связям идут записи (строки таблиц). Типы блоков:',
      '- sheet — таблица-источник или реестр. code: JSON {"rows":[["Заголовок",...],["значение",...]]}, все значения строками, формулы Excel начинаются с «=» (=B2*C2, =SUM(D2:D9), разделитель «;»).',
      '- doc — шаблон документа. code: HTML (h1, h2, p, b, i, u, ol, ul, li, table, tr, th, td, br, style="text-align:…"), поля из таблицы — {{Название столбца}}. Формируется по документу на каждую входящую запись.',
      '- step — этап: code JSON {"action":"Согласовать|Проверить|Подписать|Зарегистрировать|Утвердить|Ознакомить|Исполнить","who":"должность","days":число,"note":""}.',
      '- cond — условие-фильтр: code JSON {"field":"столбец","op":"> < >= <= = != содержит","value":"…"}.',
      '- send — выгрузка: code JSON {"format":"xlsx|csv|html|email|1c|archive","to":"получатель","name":"название"}.',
      '- python — расчёт: плагин Triosteum, run(rows) получает список записей-словарей и возвращает список (формат ниже).',
      'Правила: 1) в первую очередь бери готовые блоки из каталога (по id); 2) чего нет — создай сам с полным содержимым; 3) поля {{…}} в документах должны совпадать с заголовками таблиц; 4) 4–10 блоков, связи по ходу документа; 5) реалистичные данные и должности.',
      'Также напиши регламент процесса в Markdown (назначение, участники и ответственность, порядок действий со сроками, контроль, хранение) — поле backend.',
      'Ответь ТОЛЬКО одним блоком JSON (без текста до и после):',
      FENCE + 'json',
      '{"title":"короткое название","summary":"2–3 предложения","blocks":[{"key":"b1","plugin":"<id из каталога>","name":"название на доске"},{"key":"b2","new":true,"name":"…","lang":"sheet|doc|step|cond|send|python","desc":"одна строка","code":"содержимое строкой"}],"links":[{"from":"b1","to":"b2"}],"backend":"регламент в Markdown"}',
      FENCE,
      '', 'Каталог (id | тип | название — описание):', catalog,
      '', 'Формат Python-плагина:', FENCE + 'python', PY_LANG.tpl.replace(/\s+$/, ''), FENCE,
      ctxBoard ? '\n' + ctxBoard : '',
      '', 'Задача пользователя: ' + q
    ].join('\n');
  }
  function parseArc(text){
    var body = text, i = text.indexOf(FENCE + 'json');
    if(i >= 0){ var j = text.indexOf('\n', i), k = text.lastIndexOf(FENCE); body = text.slice(j + 1, k > j ? k : undefined); }
    var a = body.indexOf('{'), z = body.lastIndexOf('}'), o = JSON.parse(body.slice(a, z + 1));
    var keys = {}, blocks = [];
    (o.blocks || []).forEach(function(bk){
      if(!bk || !bk.key || keys[bk.key]) return;
      var p = bk.plugin && pluginById(bk.plugin);
      if(p && langById(p.lang) && !bk.code){ blocks.push({ key:bk.key, plugin:p.id, lang:p.lang, name:String(bk.name || p.name).slice(0, 80), desc:p.desc || '', isNew:false }); keys[bk.key] = 1; return; }
      var lang = String(bk.lang || '').toLowerCase().replace('c#', 'csharp').replace('1с', '1c');
      if(bk.code && typeof bk.code === 'object') bk.code = JSON.stringify(bk.code);
      if(!langById(lang) || !bk.code || typeof bk.code !== 'string') return;
      blocks.push({ key:bk.key, lang:lang, name:String(bk.name || 'Новый блок').slice(0, 80), desc:String(bk.desc || 'Создан ИИ').slice(0, 160), code:bk.code.replace(/\s+$/, '') + '\n', isNew:true });
      keys[bk.key] = 1;
    });
    var seen = {}, links = (o.links || []).map(function(l){ return Array.isArray(l) ? { from:l[0], to:l[1] } : l; }).filter(function(l){
      if(!l || !keys[l.from] || !keys[l.to] || l.from === l.to) return false;
      var k = l.from + '>' + l.to; if(seen[k]) return false; seen[k] = 1; return true;
    });
    return { title:String(o.title || 'Схема от ИИ').slice(0, 80), summary:String(o.summary || ''), blocks:blocks, links:links,
      backend:typeof o.backend === 'string' && o.backend.trim() ? o.backend.replace(/\s+$/, '') + '\n' : null };
  }
  function layoutSet(list, x0, cy){
    var ids = {}; list.forEach(function(n){ ids[n.id] = 1; });
    var preds = {}; list.forEach(function(n){ preds[n.id] = []; });
    G.edges.forEach(function(e){ if(ids[e.from] && ids[e.to]) preds[e.to].push(e.from); });
    var lvl = {};
    for(var pass = 0; pass < list.length + 1; pass++){
      var changed = false;
      list.forEach(function(n){ var L = 0; preds[n.id].forEach(function(p){ L = Math.max(L, (lvl[p] || 0) + 1); }); L = Math.min(L, list.length); if(lvl[n.id] !== L){ lvl[n.id] = L; changed = true; } });
      if(!changed) break;
    }
    var cols = {}; list.forEach(function(n){ (cols[lvl[n.id]] = cols[lvl[n.id]] || []).push(n); });
    Object.keys(cols).sort(function(a, b){ return a - b; }).forEach(function(L, ci){
      var col = cols[L], top = cy - (col.length * (NH + 48) - 48) / 2;
      col.forEach(function(n, i){ n.x = Math.round(x0 + ci * (NW + 120)); n.y = Math.round(top + i * (NH + 48)); });
    });
  }
  function applyArc(){
    var r = ARC.res; if(!r) return;
    if(ARC.fresh) newProj(r.title, null, ENV.id);
    var map = {}, made = [], nNew = 0;
    r.blocks.forEach(function(bk, i){
      var pid = bk.plugin, fam = null, desc = bk.desc;
      if(bk.isNew){
        var np = { id:'my-' + Date.now().toString(36) + i, my:true, name:bk.name, lang:bk.lang, desc:bk.desc, family:null, codes:{}, ai:true };
        np.codes[bk.lang] = bk.code; MY.unshift(np); pid = np.id; nNew++;
      } else { var p = pluginById(pid); fam = p && p.family || null; }
      var n = { id:'n' + (G.seq++), name:bk.name, lang:bk.lang, x:0, y:0, codes:{}, pluginId:pid, family:fam, desc:desc, colors:null };
      G.nodes.push(n); map[bk.key] = n.id; made.push(n);
    });
    r.links.forEach(function(l){ G.edges.push({ id:'e' + (G.seq++), from:map[l.from], to:map[l.to], taps:[] }); });
    var others = G.nodes.filter(function(n){ return made.indexOf(n) < 0; });
    var x0, cy;
    if(others.length){ x0 = Math.max.apply(0, others.map(function(n){ return n.x + NWof(n); })) + 200; cy = others.reduce(function(s, n){ return s + n.y; }, 0) / others.length + NH / 2; }
    else { var c = viewCenter(); x0 = c.x - 300; cy = c.y; }
    layoutSet(made, x0, cy);
    if(r.backend) G.backend = { code:r.backend, lang:isDocs() ? 'markdown' : 'python', at:Date.now(), prompt:ARC.prompt.trim() };
    if(nNew){ saveMy(); renderChips(); renderList(); }
    S.sel = null; S.multi = made.map(function(n){ return { type:'node', id:n.id }; });
    saveGraph(); renderGraph(); updateSel();
    setTimeout(fitView, 30);
    ARC.res = null; ARC.fresh = null; closeArc();
    toast('Схема «' + r.title + '» собрана: блоков ' + made.length + (nNew ? ', новых: ' + nNew + ' (в «Мои»)' : '') + (r.backend ? ' · ' + (isDocs() ? 'регламент' : 'бэкенд') + ' — в окне «' + ENV.word.scheme + '»' : ''));
  }
