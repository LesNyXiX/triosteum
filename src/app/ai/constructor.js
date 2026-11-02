  /* =====================================================================
     Конструктор схемы: выравнивание по связям и правки от ИИ
     ===================================================================== */
  var BLD = { busy:false, text:'', res:null, err:null, wish:'' };
  var bldWin = null;
  function openBuilder(){
    closeCtx(); hidePop(); closeAddMenu();
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    $('builder').hidden = false; $('bBuild').setAttribute('aria-pressed', 'true');
    if(!bldWin) bldWin = makeWindow($('builder'), '.pers-h', 'builder', 'fixed');
    bldWin.apply(); renderBuilder();
    var f = $('builder').querySelector('.bld-go'); if(f) f.focus();
  }
  function closeBuilder(){ $('builder').hidden = true; $('bBuild').setAttribute('aria-pressed', 'false'); }
  $('bBuild').addEventListener('click', function(){ $('builder').hidden ? openBuilder() : closeBuilder(); });
  $('bldClose').addEventListener('click', closeBuilder);
  $('builder').addEventListener('keydown', function(e){ if(e.key === 'Escape' && e.target.tagName !== 'TEXTAREA'){ closeBuilder(); $('bBuild').focus(); } });

  // проверка схемы на месте, без ИИ
  function checkScheme(){
    var plan = boardOrder(), used = {};
    G.edges.forEach(function(e){ used[e.from] = 1; used[e.to] = 1; (e.taps || []).forEach(function(tp){ tapIds(tp).forEach(function(x){ used[x] = 1; }); }); });
    var lone = G.nodes.filter(function(n){ return !used[n.id]; });
    var issues = [];
    if(plan.cyclic.length) issues.push({ lvl:'err', text:'Замкнутый круг связей: ' + plan.cyclic.map(function(n){ return n.name; }).join(', ') + ' — эти блоки не будут выполнены' });
    if(lone.length && G.nodes.length > 1) issues.push({ lvl:'warn', text:'Без связей: ' + lone.map(function(n){ return n.name; }).join(', ') + ' — выполнятся отдельно, без входных данных' });
    var starts = plan.order.filter(function(n){ return used[n.id] && !plan.preds[n.id].length; });
    if(starts.length > 1) issues.push({ lvl:'info', text:'Несколько начальных блоков: ' + starts.map(function(n){ return n.name; }).join(', ') });
    return { plan:plan, issues:issues };
  }
  function renderBuilder(){
    var b = $('bldBody'); b.innerHTML = '';
    var ck = checkScheme();
    var ord = h('ol', { 'class':'bld-order' });
    ck.plan.order.forEach(function(n){ ord.appendChild(h('li', null, [ h('i', { style:'background:' + grad(colorsOf(n)) }), h('span', { text:n.name }) ])); });
    var stat = h('div', null, [
      h('div', { 'class':'bld-stat', text:'Блоков: ' + G.nodes.length + ' · Связей: ' + G.edges.length + (ck.issues.length ? '' : ' · проблем не найдено') }),
      G.nodes.length ? ord : h('div', { 'class':'bld-stat', text:'На доске пока нет блоков.' })
    ]);
    ck.issues.forEach(function(i){ stat.appendChild(h('div', { 'class':'bld-issue ' + i.lvl, text:i.text })); });
    b.appendChild(section('Текущий порядок компиляции', stat));

    var few = G.nodes.length < 2;
    var c1 = h('div', { 'class':'bld-card' }, [
      h('div', { 'class':'bld-t', text:'Только по связям' }),
      h('div', { 'class':'bld-d', text:'Расставит блоки столбцами слева направо в порядке выполнения. Связи и порядок компиляции не меняются.' }),
      h('button', { type:'button', 'class':'btn primary bld-go', text:'Выровнять', disabled:few ? 'disabled' : null, on:{ click:function(){ autoLayout(); renderBuilder(); } } })
    ]);
    var wish = h('textarea', { 'class':'bld-wish', rows:'2', placeholder:'Что учесть (необязательно): например, «сначала загрузка из 1С, потом расчёт маржи»', 'aria-label':'Пожелания для ИИ' });
    wish.value = BLD.wish; wish.addEventListener('input', function(){ BLD.wish = wish.value; });
    var aiOff = AI.api === null, aiWait = AI.api === undefined;
    var c2 = h('div', { 'class':'bld-card' }, [
      h('div', { 'class':'bld-t', text:'С правками ИИ' }),
      h('div', { 'class':'bld-d', text:'ИИ прочитает код блоков и связи, найдёт недостающие, лишние и перевёрнутые связи, замкнутые круги. Сначала покажет правки — вы выберете, какие принять, затем схема выровняется.' }),
      wish,
      h('button', { type:'button', 'class':'btn primary', text:BLD.busy ? 'ИИ анализирует…' : 'Проанализировать',
        disabled:(few || BLD.busy || aiOff || aiWait) ? 'disabled' : null, on:{ click:analyzeAI } }),
      aiOff ? h('div', { 'class':'bld-issue warn', text:'ИИ доступен, когда среда открыта в claude.ai.' }) : null
    ].filter(Boolean));
    b.appendChild(section('Выберите режим', h('div', { 'class':'bld-cards' }, [c1, c2])));
    if(few) b.appendChild(h('div', { 'class':'bld-stat', text:'Нужно хотя бы два блока на доске.' }));

    if(BLD.busy || BLD.res || BLD.err) b.appendChild(section('Предложения ИИ', aiResultView()));
  }
  function nodeLabel(id){ var n = nodeById(id); return n ? '«' + n.name + '»' : id; }
  function changeText(c){
    if(c.op === 'add_edge') return 'Добавить связь ' + nodeLabel(c.from) + ' → ' + nodeLabel(c.to);
    var e = edgeById(c.edge);
    var t = e ? nodeLabel(e.from) + ' → ' + nodeLabel(e.to) : c.edge;
    return (c.op === 'remove_edge' ? 'Удалить связь ' : 'Развернуть связь ') + t;
  }
  function aiResultView(){
    var box = h('div', { 'class':'bld-res' });
    if(BLD.busy){ box.appendChild(h('div', { 'class':'bld-stat', text:'ИИ читает схему и код блоков…' + (BLD.text ? ' получено ' + BLD.text.length + ' симв.' : '') })); return box; }
    if(BLD.err){ box.appendChild(h('div', { 'class':'bld-issue err', text:BLD.err })); return box; }
    var r = BLD.res;
    if(r.summary) box.appendChild(h('p', { 'class':'bld-sum', text:r.summary }));
    if(!r.changes.length) box.appendChild(h('div', { 'class':'bld-issue info', text:'Правок связей не требуется — схема собрана верно.' }));
    r.changes.forEach(function(c){
      var cb = h('input', { type:'checkbox' }); cb.checked = c.on !== false;
      cb.addEventListener('change', function(){ c.on = cb.checked; });
      var row = h('label', { 'class':'bld-ch' }, [ cb, h('span', null, [ h('b', { text:changeText(c) }), c.reason ? h('span', { text:c.reason }) : null ].filter(Boolean)) ]);
      row.addEventListener('mouseenter', function(){ flashNodes(c); });
      box.appendChild(row);
    });
    (r.advice || []).forEach(function(a){ box.appendChild(h('div', { 'class':'bld-issue info', text:'Совет: ' + a })); });
    box.appendChild(h('div', { 'class':'bld-acts' }, [
      h('button', { type:'button', 'class':'btn primary', text:r.changes.length ? 'Применить выбранное и выровнять' : 'Выровнять схему', on:{ click:applyAI } }),
      h('button', { type:'button', 'class':'btn', text:'Отклонить', on:{ click:function(){ BLD.res = null; renderBuilder(); } } })
    ]));
    return box;
  }
  function flashNodes(c){
    var ids = c.op === 'add_edge' ? [c.from, c.to] : (function(){ var e = edgeById(c.edge); return e ? [e.from, e.to] : []; })();
    ids.forEach(function(id){ var d = domOf('node', id); if(d){ d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash'); } });
  }
  function analyzeAI(){
    if(!AI.api || BLD.busy) return;
    BLD.busy = true; BLD.text = ''; BLD.res = null; BLD.err = null; renderBuilder();
    var plan = boardOrder();
    var nodes = G.nodes.map(function(n){
      var code = nodeCode(n).split('\n').slice(0, 40).join('\n'); if(code.length > 1500) code = code.slice(0, 1500) + '\n…';
      return '- id=' + n.id + ' | ' + (n.kind === 'hub' ? 'связующая точка' : 'блок') + ' «' + n.name + '» | язык ' + langById(n.lang).name +
        (n.desc ? ' | описание: ' + n.desc : '') + '\n  код:\n' + code.split('\n').map(function(l){ return '    ' + l; }).join('\n');
    }).join('\n');
    var edges = G.edges.map(function(e){
      var mid = sortedTaps(e).map(function(tp){ return tapNodes(tp).map(function(n){ return n.id; }).join('+'); }).filter(Boolean);
      return '- id=' + e.id + ': ' + e.from + ' → ' + e.to + (mid.length ? ' (через точки на линии: ' + mid.join(', ') + ')' : '');
    }).join('\n') || 'нет';
    var prompt = [
      'Ты — инженер Triosteum, платформы, где блоки с кодом соединяются связями в поток данных.',
      'Результат блока передаётся по связи в следующий блок; порядок компиляции = топологический порядок связей.',
      'Проверь схему: какие связи нужны по смыслу кода (кто что производит и потребляет), какие лишние, какие направлены не туда, есть ли замкнутые круги.',
      'Меняй только связи. Не предлагай правки ради правок: если схема верна, верни пустой список changes.',
      'Ответь по-русски ТОЛЬКО одним блоком JSON без текста вокруг, строго в формате:',
      FENCE + 'json',
      '{"summary":"1–2 предложения о схеме","changes":[{"op":"add_edge","from":"<id>","to":"<id>","reason":"почему"},{"op":"remove_edge","edge":"<id связи>","reason":"почему"},{"op":"reverse_edge","edge":"<id связи>","reason":"почему"}],"advice":["короткий совет, если нужен"]}',
      FENCE,
      '',
      'Блоки:', nodes, '', 'Связи:', edges, '',
      'Текущий порядок выполнения: ' + plan.order.map(function(n){ return n.name; }).join(' → '),
      plan.cyclic.length ? 'В замкнутом круге: ' + plan.cyclic.map(function(n){ return n.name; }).join(', ') : '',
      BLD.wish.trim() ? 'Пожелание пользователя: ' + BLD.wish.trim() : ''
    ].join('\n');
    AI.api(prompt, { cache:false, onText:function(ev){ BLD.text = ev.text; var s = $('bldBody').querySelector('.bld-res .bld-stat'); if(s) s.textContent = 'ИИ читает схему и код блоков… получено ' + ev.text.length + ' симв.'; } })
      .then(function(r){ BLD.busy = false; try{ BLD.res = parseAI(r.text); }catch(e){ BLD.err = 'ИИ ответил в неожиданном формате. Попробуйте ещё раз.'; } if(!$('builder').hidden) renderBuilder(); },
            function(err){ BLD.busy = false; BLD.err = aiFail(err); if(!$('builder').hidden) renderBuilder(); });
  }
  function parseAI(text){
    var body = extractCode(text) || text, a = body.indexOf('{'), z = body.lastIndexOf('}');
    var o = JSON.parse(body.slice(a, z + 1));
    var seen = {};
    var changes = (o.changes || []).filter(function(c){
      if(!c || !c.op) return false;
      if(c.op === 'add_edge'){
        if(!nodeById(c.from) || !nodeById(c.to) || c.from === c.to) return false;
        if(G.edges.some(function(e){ return e.from === c.from && e.to === c.to; })) return false;
      } else if(c.op === 'remove_edge' || c.op === 'reverse_edge'){
        if(!edgeById(c.edge)) return false;
      } else return false;
      var k = c.op + (c.edge || c.from + '>' + c.to); if(seen[k]) return false; seen[k] = 1;
      return true;
    });
    return { summary:String(o.summary || ''), changes:changes, advice:(o.advice || []).filter(function(x){ return typeof x === 'string' && x.trim(); }).slice(0, 4) };
  }
  function applyAI(){
    var r = BLD.res; if(!r) return;
    var n = 0;
    r.changes.forEach(function(c){
      if(c.on === false) return;
      if(c.op === 'add_edge'){
        if(!G.edges.some(function(e){ return e.from === c.from && e.to === c.to; })){ G.edges.push({ id:'e' + (G.seq++), from:c.from, to:c.to, taps:[] }); n++; }
      } else if(c.op === 'remove_edge'){
        var before = G.edges.length; G.edges = G.edges.filter(function(e){ return e.id !== c.edge; }); if(G.edges.length < before) n++;
      } else if(c.op === 'reverse_edge'){
        var e = edgeById(c.edge); if(e){ var t = e.from; e.from = e.to; e.to = t; (e.taps || []).forEach(function(tp){ tp.t = 1 - tp.t; }); n++; }
      }
    });
    BLD.res = null;
    S.sel = null; S.multi = [];
    autoLayout();
    var ck = checkScheme();
    toast((n ? 'Принято правок: ' + n + '. ' : '') + 'Схема выровнена' + (ck.plan.cyclic.length ? ' — но остался замкнутый круг' : '') + ' · ' + MOD + 'Z — вернуть');
    renderBuilder();
  }
