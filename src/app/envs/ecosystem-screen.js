  /* ---------- экран экосистемы ---------- */
  function envProjects(id){ return PROJ.list.filter(function(p){ return (p.env || 'code') === id; }).sort(function(a, b){ return b.t - a.t; }); }
  function envNewName(k){ return k === 'docs' ? 'Документооборот' : (ENVS[k] && ENVS[k].newName) || 'Новое пространство'; }
  function goEnv(id, demo){
    closeEco();
    if(demo && id === 'docs'){ makeDocsDemo(); return; }
    if(demo && ENVS[id] && ENVS[id].seed){ ENVS[id].seed(); return; }
    if(demo && ENVS[id] && ENVS[id].demo){ makeEnvDemo(id, typeof demo === 'number' ? demo - 1 : 0); return; }
    var list = envProjects(id);
    if(list.length){ if(list[0].id !== PROJ.cur) switchProj(list[0].id); else toast('Вы уже в среде «' + ENVS[id].name + '»'); }
    else { newProj(envNewName(id), null, id); toast('Создано пространство в среде «' + ENVS[id].name + '»'); }
  }
  function openEco(){
    closeCtx(); hidePop(); renderEco(); $('eco').hidden = false;
    // свои среды компании могли появиться у коллег — подтягиваем и перерисовываем
    if(SERVER) cenvRefresh().then(function(){ if(!$('eco').hidden) renderEco(); });
    var f = $('eco').querySelector('.eco-card.go .eco-open'); if(f) f.focus();
  }
  function closeEco(){ $('eco').hidden = true; }
  function renderEco(){
    var g = $('ecoGrid'); g.innerHTML = '';
    Object.keys(ENVS).forEach(function(k){
      var e = ENVS[k], n = envProjects(k).length, here = ENV.id === k;
      var ic = e.ic || (k === 'code' ? '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>' : '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>');
      var card = h('article', { 'class':'eco-card go' + (here ? ' here' : ''), style:'--ec:' + e.color }, [
        h('div', { 'class':'eco-top' }, [ h('span', { 'class':'eco-ic art', html:envIconSvg(k) }),
          here ? h('span', { 'class':'eco-tag', text:'вы здесь' }) : e.custom ? h('span', { 'class':'eco-tag org', text:'компании', title:'Своя среда вашей организации' + (e.byName ? ' · создал ' + e.byName : '') }) : null ].filter(Boolean)),
        h('h3', null, [ h('button', { type:'button', 'class':'eco-open', text:e.name, title:'Открыть среду «' + e.name + '»' }) ]), h('p', { text:e.desc }),
        h('div', { 'class':'eco-meta', text:'Пространств: ' + n + ' · типов блоков: ' + e.langs.length + ' · в библиотеке: ' + e.plugins.length }),
        h('div', { 'class':'eco-acts' }, [
          h('button', { type:'button', 'class':'btn', text:'Новое пространство', on:{ click:function(ev){ ev.stopPropagation(); closeEco(); newProj(envNewName(k), null, k); } } }),
          k === 'docs' || e.demo || e.seed ? h('button', { type:'button', 'class':'btn', text:k === 'docs' ? 'Пример офиса' : (e.demos && e.demos.length > 1 ? 'Примеры ▾' : 'Пример'), on:{ click:function(ev){ ev.stopPropagation();
            if(e.demos && e.demos.length > 1){ var r = ev.currentTarget.getBoundingClientRect(); openMenuAt([{ head:'Примеры: ' + e.short.toLowerCase() }].concat(e.demos.map(function(d, i){ return { label:d.menu ? d.menu.charAt(0).toUpperCase() + d.menu.slice(1) : d.name, icon:'layout', act:function(){ goEnv(k, i + 1); } }; })), r.left, r.bottom + 4); return; }
            goEnv(k, true); } } }) : null,
          e.custom && cenvCanEdit(e) ? h('button', { type:'button', 'class':'btn ghost', text:'Настроить', on:{ click:function(ev){ ev.stopPropagation(); openEnvBuilder(e); } } }) : null
        ].filter(Boolean))
      ]);
      card.addEventListener('click', function(){ goEnv(k); });
      g.appendChild(card);
    });
    if(cenvCanEdit(null)){
      var add = h('article', { 'class':'eco-card add' }, [
        h('div', { 'class':'eco-top' }, [ h('span', { 'class':'eco-ic', html:'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' }) ]),
        h('h3', null, [ h('button', { type:'button', 'class':'eco-open', text:'Своя среда' }) ]),
        h('p', { text:'Соберите среду под работу вашей компании из блоков склада, производства, финансов и других сред. Её увидят только сотрудники вашей организации.' }) ]);
      add.addEventListener('click', function(){ openEnvBuilder(null); });
      g.appendChild(add);
    }
    FUTURE_ENVS.forEach(function(f){
      g.appendChild(h('article', { 'class':'eco-card soon' }, [
        h('div', { 'class':'eco-top' }, [ h('span', { 'class':'eco-ic', html:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.ic + '</svg>' }), h('span', { 'class':'eco-tag', text:'скоро' }) ]),
        h('h3', { text:f.name }), h('p', { text:f.desc })
      ]));
    });
    var rec = $('ecoRecent'); rec.innerHTML = '';
    PROJ.list.slice().sort(function(a, b){ return b.t - a.t; }).slice(0, 8).forEach(function(p){
      var e = ENVS[p.env || 'code'] || ENVS.code;          // среда могла исчезнуть — показываем как «Разработку», а не падаем
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
      var n = { id:newId('n'), name:p.name, lang:p.lang, x:0, y:0, codes:{}, pluginId:p.id, family:null, desc:p.desc, colors:null };
      G.nodes.push(n); return n;
    });
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 9]].forEach(function(l){ G.edges.push({ id:newId('e'), from:ids[l[0]].id, to:ids[l[1]].id, taps:[] }); });
    var c = viewCenter(); layoutSet(ids, c.x - 900, c.y);
    G.notes.push({ id:newId('t'), text:'Пример маршрута: из реестра формируются договоры, крупные (больше 1 млн) идут на согласование к финансовому директору, затем подпись, регистрация и выгрузка. Нажмите «Запустить».', x:Math.round(c.x - 900), y:Math.round(c.y - 230), fs:14, tint:'blue' });
    saveGraph(); renderGraph(); setTimeout(fitView, 30);
    toast('Открыт пример: маршрут договоров поставки');
  }