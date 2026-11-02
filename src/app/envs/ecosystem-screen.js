  /* ---------- экран экосистемы ---------- */
  function envProjects(id){ return PROJ.list.filter(function(p){ return (p.env || 'code') === id; }).sort(function(a, b){ return b.t - a.t; }); }
  function goEnv(id, demo){
    closeEco();
    if(demo && id === 'docs'){ makeDocsDemo(); return; }
    var list = envProjects(id);
    if(list.length){ if(list[0].id !== PROJ.cur) switchProj(list[0].id); else toast('Вы уже в среде «' + ENVS[id].name + '»'); }
    else { newProj(id === 'docs' ? 'Документооборот' : 'Новое пространство', null, id); toast('Создано пространство в среде «' + ENVS[id].name + '»'); }
  }
  function openEco(){
    closeCtx(); hidePop(); renderEco(); $('eco').hidden = false;
    var f = $('eco').querySelector('.eco-card.go'); if(f) f.focus();
  }
  function closeEco(){ $('eco').hidden = true; }
  function renderEco(){
    var g = $('ecoGrid'); g.innerHTML = '';
    Object.keys(ENVS).forEach(function(k){
      var e = ENVS[k], n = envProjects(k).length, here = ENV.id === k;
      var ic = k === 'code' ? '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' : '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>';
      var card = h('article', { 'class':'eco-card go' + (here ? ' here' : ''), style:'--ec:' + e.color, role:'button', tabindex:'0', 'aria-label':'Открыть среду «' + e.name + '»' }, [
        h('div', { 'class':'eco-top' }, [ h('span', { 'class':'eco-ic', html:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ic + '</svg>' }),
          here ? h('span', { 'class':'eco-tag', text:'вы здесь' }) : null ].filter(Boolean)),
        h('h3', { text:e.name }), h('p', { text:e.desc }),
        h('div', { 'class':'eco-meta', text:'Пространств: ' + n + ' · типов блоков: ' + e.langs.length + ' · в библиотеке: ' + e.plugins.length }),
        h('div', { 'class':'eco-acts' }, [
          h('button', { type:'button', 'class':'btn', text:'Новое пространство', on:{ click:function(ev){ ev.stopPropagation(); closeEco(); newProj(k === 'docs' ? 'Документооборот' : 'Новое пространство', null, k); } } }),
          k === 'docs' ? h('button', { type:'button', 'class':'btn', text:'Пример офиса', on:{ click:function(ev){ ev.stopPropagation(); goEnv('docs', true); } } }) : null
        ].filter(Boolean))
      ]);
      card.addEventListener('click', function(){ goEnv(k); });
      card.addEventListener('keydown', function(ev){ if(ev.target === card && (ev.key === 'Enter' || ev.key === ' ')){ ev.preventDefault(); goEnv(k); } });
      g.appendChild(card);
    });
    FUTURE_ENVS.forEach(function(f){
      g.appendChild(h('article', { 'class':'eco-card soon' }, [
        h('div', { 'class':'eco-top' }, [ h('span', { 'class':'eco-ic', html:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.ic + '</svg>' }), h('span', { 'class':'eco-tag', text:'скоро' }) ]),
        h('h3', { text:f.name }), h('p', { text:f.desc })
      ]));
    });
    var rec = $('ecoRecent'); rec.innerHTML = '';
    PROJ.list.slice().sort(function(a, b){ return b.t - a.t; }).slice(0, 8).forEach(function(p){
      var e = ENVS[p.env || 'code'];
      rec.appendChild(h('button', { type:'button', 'class':'eco-rec' + (p.id === PROJ.cur ? ' on' : ''), on:{ click:function(){ closeEco(); switchProj(p.id); } } }, [
        h('i', { style:'background:' + e.color }), h('span', { 'class':'nm', text:p.name }), h('span', { 'class':'ev', text:e.name })
      ]));
    });
  }
  $('ecoBtn').addEventListener('click', openEco);
  $('envChip').addEventListener('click', openEco);
  $('ecoClose').addEventListener('click', closeEco);
  $('eco').addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); closeEco(); } });
  $('eco').addEventListener('pointerdown', function(e){ if(e.target === $('eco')) closeEco(); });

  // демонстрационный маршрут: реестр → договор → условие → согласования → подпись → регистрация → выгрузки
  function makeDocsDemo(){
    newProj('Офис — пример', null, 'docs'); OF.tab = 'desk'; seedOffice(); return;
    newProj('Договоры поставки', null, 'docs');
    var spec = [['sh-contracts'], ['py-words'], ['doc-contract'], ['st-head'], ['cd-big'], ['st-fin'], ['st-sign'], ['st-reg'], ['sn-xlsx'], ['sn-pack']];
    var ids = spec.map(function(s){
      var p = pluginById(s[0]);
      var n = { id:'n' + (G.seq++), name:p.name, lang:p.lang, x:0, y:0, codes:{}, pluginId:p.id, family:null, desc:p.desc, colors:null };
      G.nodes.push(n); return n;
    });
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 9]].forEach(function(l){ G.edges.push({ id:'e' + (G.seq++), from:ids[l[0]].id, to:ids[l[1]].id, taps:[] }); });
    var c = viewCenter(); layoutSet(ids, c.x - 900, c.y);
    G.notes.push({ id:'t' + (G.seq++), text:'Пример маршрута: из реестра формируются договоры, крупные (больше 1 млн) идут на согласование к финансовому директору, затем подпись, регистрация и выгрузка. Нажмите «Запустить».', x:Math.round(c.x - 900), y:Math.round(c.y - 230), fs:14, tint:'blue' });
    saveGraph(); renderGraph(); setTimeout(fitView, 30);
    toast('Открыт пример: маршрут договоров поставки');
  }