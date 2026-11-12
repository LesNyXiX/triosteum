  /* ---------- свои среды организации ----------
     Среда компании собирается из типов блоков отраслевых сред (склад, MES, финансы, персонал, продажи, аналитика):
     своё название, цвет, значок и описание; шаблоны библиотеки приходят вместе с выбранными блоками.
     Хранится в библиотеке компании (вид «env») — её видят только сотрудники этой организации. */
  var CENV_ICONS = {
    box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    lab:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/><path d="M7.5 15h9"/>',
    gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    truck:'<path d="M2 6h11v10H2zM13 10h4l4 3v3h-8z"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    factory:'<path d="M3 20V9l6 4V9l6 4V5h6v15z"/>',
    leaf:'<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l8-8"/>',
    bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    shield:'<path d="M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    coins:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M17 11a3 3 0 100-6M21 20a6 6 0 00-4-5.6"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    tools:'<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'
  };
  var CENV_COLORS = ['#0D9488', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#16A34A'];
  var CENV_BASE = {};
  [K_SHEET, K_DOC, K_COND, K_SEND, K_STEP, PY_LANG].concat(GEN_OPS).forEach(function(k){ if(k) CENV_BASE[k.id] = 1; });
  // отраслевые среды-источники и их собственные типы блоков
  function cenvSources(){
    return Object.keys(ENVS).filter(function(k){ return ENVS[k].ops && !ENVS[k].custom; }).map(function(k){
      return { env:ENVS[k], ops:ENVS[k].langs.filter(function(l){ return !CENV_BASE[l.id]; }) };
    }).filter(function(s){ return s.ops.length; });
  }
  function cenvOp(id){ var f = null; cenvSources().some(function(s){ f = s.ops.filter(function(o){ return o.id === id; })[0] || null; return !!f; }); return f; }
  function cenvShade(hex){ var n = parseInt(hex.slice(1), 16), f = function(v){ return Math.max(0, Math.round(v * 0.55)); }; return '#' + [f(n >> 16 & 255), f(n >> 8 & 255), f(n & 255)].map(function(v){ return v.toString(16).padStart(2, '0'); }).join(''); }
  function cenvRegister(it){
    var d = it && it.data; if(!d || !/^u[a-z]{5,11}$/.test(d.id || '')) return;
    if(ENVS[d.id] && !ENVS[d.id].custom) return;
    var ops = (d.kinds || []).map(cenvOp).filter(Boolean); if(!ops.length) return;
    var want = {}; (d.kinds || []).forEach(function(k){ want[k] = 1; });
    var srcs = cenvSources().filter(function(s){ return s.ops.some(function(o){ return want[o.id]; }); });
    var colors = {}, lib = [], seen = {};
    srcs.forEach(function(s){
      var c = s.env.colors || {}; for(var k in c) colors[k] = c[k];
      s.env.plugins.forEach(function(p){ if(!seen[p.id] && p.lang !== 'python' && (want[p.lang] || p.lang === 'doc' || p.lang === 'sheet')){ seen[p.id] = 1; lib.push(p); } });
    });
    var ic = CENV_ICONS[d.ic] || CENV_ICONS.box;
    industryEnv(d.id, { name:d.name, short:d.short || d.name, color:d.color, theme:d.theme || 'midnight', newName:d.short || d.name, ic:ic, ops:ops, step:!!d.step,
      colors:colors, desc:d.desc || 'Своя среда компании', hint:'Соберите схему из блоков этой среды и нажмите «Запустить».', examples:[], lib:lib, demo:null });
    var e = ENVS[d.id];
    e.demo = null; e.demos = []; e.custom = true; e.orgItem = it.id; e.by = it.by; e.byName = it.by_name || ''; e.def = d;
    e.iconArt = { bg:[d.color, cenvShade(d.color)], art:function(){ return '<g transform="translate(14 14) scale(1.5)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ic + '</g>'; } };
  }
  function cenvLoad(items){
    var live = {};
    (items || []).filter(function(it){ return it && it.kind === 'env'; }).forEach(function(it){ live[it.data && it.data.id] = 1; cenvRegister(it); });
    // убранные из библиотеки — убираем и из списка сред (кроме той, где пользователь сейчас)
    var gone = false;
    Object.keys(ENVS).forEach(function(k){ if(ENVS[k].custom && !live[k] && ENV.id !== k){ delete ENVS[k]; gone = true; } });
    ALLP = null;
    if(gone && typeof envDockRender === 'function') try { envDockRender(); } catch(e){}
    // автор изменил среду, в которой сотрудник сейчас работает: подхватываем новые блоки и библиотеку, доску не трогаем
    if(ENV && ENV.custom && ENVS[ENV.id] && ENVS[ENV.id] !== ENV){
      setEnv(ENV.id);
      try { renderChips(); renderList(); } catch(e){}
    }
  }
  cenvLoad(SERVER && window.TRIOSTEUM_BOOT && window.TRIOSTEUM_BOOT.org_items);
  function cenvCanEdit(e){ return !!(SERVER && SERVER.user && (SERVER.role === 'owner' || (SERVER.role === 'editor' && (!e || e.by === SERVER.user.id)))); }
  function cenvRefresh(){
    if(!SERVER) return Promise.resolve();
    return SERVER.api('GET', '/org/items?kind=env').then(function(r){ if(r.status === 200) cenvLoad(r.data.items); }, function(){});
  }

  // конструктор: название, коротко, описание, цвет, значок, типы блоков по отраслевым средам, шаги согласования
  function openEnvBuilder(e){
    var d = e && e.def ? JSON.parse(JSON.stringify(e.def)) : { id:'u' + Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 7).padEnd(7, 'x'), name:'', short:'', desc:'', color:CENV_COLORS[0], ic:'lab', kinds:[], step:false };
    var chosen = {}; (d.kinds || []).forEach(function(k){ chosen[k] = 1; });
    var back = h('div', { 'class':'cenv-back', role:'dialog', 'aria-modal':'true', 'aria-label':e ? 'Настройка среды' : 'Своя среда' });
    var name = h('input', { type:'text', maxlength:'40', value:d.name, placeholder:'например, «Лаборатория ОТК»', 'aria-label':'Название среды' });
    var short = h('input', { type:'text', maxlength:'20', value:d.short, placeholder:'коротко: «ОТК»', 'aria-label':'Короткое название' });
    var desc = h('textarea', { rows:'2', maxlength:'300', placeholder:'Для чего среда: что считаем и какие документы готовим', 'aria-label':'Описание среды' }); desc.value = d.desc || '';
    var sw = h('div', { 'class':'cenv-sw', role:'radiogroup', 'aria-label':'Цвет' });
    CENV_COLORS.forEach(function(c){ var b = h('button', { type:'button', role:'radio', 'aria-checked':String(d.color === c), 'aria-label':'Цвет ' + c, style:'--c:' + c }); b.addEventListener('click', function(){ d.color = c; sw.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-checked', String(x === b)); }); }); sw.appendChild(b); });
    var icg = h('div', { 'class':'cenv-ic', role:'radiogroup', 'aria-label':'Значок' });
    Object.keys(CENV_ICONS).forEach(function(k){ var b = h('button', { type:'button', role:'radio', 'aria-checked':String(d.ic === k), 'aria-label':'Значок ' + k, html:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CENV_ICONS[k] + '</svg>' }); b.addEventListener('click', function(){ d.ic = k; icg.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-checked', String(x === b)); }); }); icg.appendChild(b); });
    var count = h('span', { 'class':'cenv-n' });
    var err = h('p', { 'class':'cenv-err', role:'alert' });
    function recount(){ var n = Object.keys(chosen).length; count.textContent = n ? 'выбрано типов блоков: ' + n : 'выберите хотя бы один тип блоков'; if(n && /тип блоков/.test(err.textContent)) err.textContent = ''; }
    var kinds = h('div', { 'class':'cenv-kinds' });
    cenvSources().forEach(function(s){
      var all = h('button', { type:'button', 'class':'btn sm ghost', text:'все' });
      var box = h('div', { 'class':'cenv-src', style:'--c:' + s.env.color }, [ h('div', { 'class':'cenv-src-h' }, [ h('b', { text:s.env.name }), all ]) ]);
      var cbs = [];
      s.ops.forEach(function(o){
        var cb = h('input', { type:'checkbox' }); cb.checked = !!chosen[o.id]; cbs.push([cb, o]);
        cb.addEventListener('change', function(){ if(cb.checked) chosen[o.id] = 1; else delete chosen[o.id]; recount(); });
        box.appendChild(h('label', { 'class':'cenv-op', title:o.tool || '' }, [ cb, h('span', { text:o.name }) ]));
      });
      all.addEventListener('click', function(){ var on = cbs.some(function(x){ return !x[0].checked; }); cbs.forEach(function(x){ x[0].checked = on; if(on) chosen[x[1].id] = 1; else delete chosen[x[1].id]; }); recount(); });
      kinds.appendChild(box);
    });
    var step = h('input', { type:'checkbox' }); step.checked = !!d.step;
    var save = h('button', { type:'button', 'class':'btn primary', text:e ? 'Сохранить' : 'Создать среду' });
    var cancel = h('button', { type:'button', 'class':'btn', text:'Отмена' });
    var acts = [ cancel, save ];
    if(e){
      var del = h('button', { type:'button', 'class':'btn danger cenv-del', text:'Удалить среду' }), armed = 0;
      del.addEventListener('click', function(){
        // считаем пространства среды на сервере: у коллег могут быть свои, которых нет в списке этого браузера
        SERVER.api('GET', '/spaces').then(function(rs){
          var list = rs.status === 200 && Array.isArray(rs.data) ? rs.data : null;
          var n = list ? list.filter(function(x){ return x.env === d.id; }).length : envProjects(d.id).length;
          if(n){ err.textContent = 'В среде есть пространства (' + n + '). Сначала удалите или перенесите их — потом удалите среду.'; return; }
          if(Date.now() - armed > 4000){ armed = Date.now(); del.textContent = 'Точно?'; return; }
          cenvDelete();
        });
      });
      function cenvDelete(){
        SERVER.api('DELETE', '/org/items/' + e.orgItem).then(function(r){
          if(r.status !== 200){ err.textContent = (r.data && r.data.detail) || 'Не получилось удалить'; return; }
          close(); if(ENV.id !== d.id){ delete ENVS[d.id]; } toast('Среда «' + d.name + '» удалена');
          if(typeof envDockRender === 'function') try { envDockRender(); } catch(e2){}
          if(typeof renderEco === 'function' && !$('eco').hidden) renderEco();
        });
      }
      acts.unshift(del);
    }
    back.appendChild(h('div', { 'class':'cenv' }, [
      h('header', { 'class':'cenv-h' }, [ h('h2', { text:e ? 'Настройка среды «' + d.name + '»' : 'Своя среда компании' }),
        h('p', { text:'Соберите среду под свою работу из блоков отраслевых сред. Её увидят все сотрудники вашей организации — и только они.' }) ]),
      h('div', { 'class':'cenv-body' }, [
        h('div', { 'class':'cenv-row' }, [ h('label', null, [ h('span', { text:'Название' }), name ]), h('label', null, [ h('span', { text:'Коротко' }), short ]) ]),
        h('label', null, [ h('span', { text:'Описание' }), desc ]),
        h('div', { 'class':'cenv-row' }, [ h('div', null, [ h('span', { 'class':'cenv-l', text:'Цвет' }), sw ]), h('div', null, [ h('span', { 'class':'cenv-l', text:'Значок' }), icg ]) ]),
        h('div', { 'class':'cenv-l' }, [ document.createTextNode('Типы блоков · '), count ]),
        kinds,
        h('label', { 'class':'cenv-op' }, [ step, h('span', { text:'Этапы согласования (подпись, регистрация) — как в «Финансах» и «Продажах»' }) ]),
        err ]),
      h('footer', { 'class':'cenv-f' }, acts) ]));
    function close(){ back.remove(); }
    cancel.addEventListener('click', close);
    back.addEventListener('mousedown', function(ev){ if(ev.target === back) close(); });
    back.addEventListener('keydown', function(ev){ ev.stopPropagation(); if(ev.key === 'Escape') close(); });
    save.addEventListener('click', function(){
      d.name = name.value.trim(); d.short = short.value.trim() || d.name.slice(0, 20); d.desc = desc.value.trim(); d.step = step.checked; d.kinds = Object.keys(chosen);
      if(!d.name){ err.textContent = 'Назовите среду'; name.focus(); return; }
      if(!d.kinds.length){ err.textContent = 'Выберите хотя бы один тип блоков'; return; }
      save.disabled = true; err.textContent = '';
      SERVER.api('POST', '/org/items', { kind:'env', src:d.id, data:d }).then(function(r){
        save.disabled = false;
        if(r.status !== 201){ err.textContent = (r.data && r.data.detail) || 'Не получилось сохранить'; return; }
        cenvRegister(r.data); ALLP = null; close();
        if(e){ if(ENV.id === d.id) setEnv(d.id); toast('Среда «' + d.name + '» обновлена'); if(!$('eco').hidden) renderEco(); return; }
        closeEco(); newProj(d.short || d.name, null, d.id);
        toast('Среда «' + d.name + '» создана — её видят все сотрудники вашей организации');
      });
    });
    recount();
    document.body.appendChild(back);
    setTimeout(function(){ name.focus(); }, 30);
  }
