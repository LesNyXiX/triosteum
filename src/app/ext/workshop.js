  /* ---------- мастерская расширений («Triosteum как пластилин», слой 4) ----------
     Расширение компании собирают прямо в Triosteum: описание, разрешения, команды, код.
     «Пробный запуск» — в той же песочнице, что и настоящие расширения, с журналом console.log и ошибок.
     ИИ пишет код по описанию; разрешения и команды подбираются по коду (их можно поправить).
     Черновики — у пользователя (с сервером — в его учётной записи, без сервера — в браузере), каждый отдельной записью:
     у настройки на сервере есть предел размера, и общий список всех черновиков в него бы не влез.
     Публикует в компанию владелец организации. */
  var XW_DRAFT_MAX = 900 * 1024;
  var XW = { drafts:{}, cur:null, run:null };
  // список черновиков — по самим записям, а не по отдельному индексу: индекс из другой вкладки мог бы затереть чужие черновики
  function xwScan(){
    var P = 'triosteum.extdraft.';
    Store.keys(P).forEach(function(k){
      var id = k.slice(P.length); if(XW.drafts[id]) return;
      var d = load(k, null); if(d && d.id === id) XW.drafts[id] = d;
    });
  }
  xwScan();
  var XW_API = [
    'triosteum.command(id, async () => { … })   — команда (id как в списке команд)',
    'await triosteum.board.get()                — { space, nodes:[{id,name,lang,code,desc,x,y}], edges:[{id,from,to}], notes, langs }',
    'await triosteum.board.selection()          — { ids:[…] } выделенные блоки',
    'await triosteum.board.add({ name, lang, code, desc, x, y }) — новый блок',
    'await triosteum.board.update(id, { name, code, desc, x, y })',
    'await triosteum.board.remove(id)           — блок, связь или заметка',
    'await triosteum.board.connect(fromId, toId)',
    'await triosteum.board.note({ text, attach:blockId }) или note({ text, x, y })',
    'await triosteum.ui.toast("текст")          — уведомление',
    'await triosteum.ui.openPanel() / closePanel() — своя панель: рисуйте в document.body',
    'await triosteum.storage.get(key) / set(key, value) — свои настройки (до 256 КБ, у каждого пользователя свои)',
    'triosteum.on("change", fn)                 — доска изменилась',
    'Сети нет: fetch и подобное закрыты. Изменения доски отменяются Ctrl+Z.'
  ].join('\n');
  var XW_START = [
    '// Расширение компании: команды появятся в Ctrl+K, раздел «Расширения».',
    "triosteum.command('count', async () => {",
    '  const board = await triosteum.board.get();',
    "  await triosteum.ui.toast('Блоков на доске: ' + board.nodes.length + ', связей: ' + board.edges.length);",
    '});',
    ''
  ].join('\n');
  // что код вызывает → какие разрешения ему нужны
  var XW_USES = [
    [ /board\.get\s*\(|on\(\s*['"]change/, 'board.read' ],
    [ /board\.(add|update|remove|connect|note)\s*\(/, 'board.write' ],
    [ /board\.selection\s*\(/, 'selection' ],
    [ /storage\.(get|set)\s*\(/, 'storage' ],
    [ /ui\.(openPanel|closePanel)\s*\(|document\.body/, 'panel' ]
  ];
  var XW_KINDS = [ { id:'ext', many:'Расширения компании', one:'Расширение' }, { id:'plugin', many:'Плагины компании', one:'Плагин' }, { id:'env', many:'Среды компании', one:'Среда' } ];
  var XW_ACT = { publish:'опубликовано', update:'обновлено', rollback:'возвращена прежняя версия', disable:'выключено для всех', enable:'включено для всех', remove:'убрано из компании' };
  function xwWhen(t){ try { return new Date(t).toLocaleString('ru-RU', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch(e){ return String(t || ''); } }
  // управлять доработкой: расширением — владелец, плагином и средой — автор или владелец
  function xwCanManage(it){
    if(!SERVER || !SERVER.user || SERVER.role === 'viewer') return false;
    if(it.kind === 'ext') return SERVER.role === 'owner';
    return SERVER.role === 'owner' || it.by === SERVER.user.id;
  }
  function xwLoadItems(){
    if(!SERVER) return Promise.resolve();
    return SERVER.api('GET', '/org/items?all=1').then(function(r){ if(r.status === 200) XW.items = r.data.items; }, function(){});
  }
  function xwNeeds(code){ return XW_USES.filter(function(u){ return u[0].test(code || ''); }).map(function(u){ return u[1]; }); }
  function xwCmdIds(code){
    var re = /triosteum\.command\(\s*['"]([a-z0-9_-]{1,30})['"]/g, m, out = [];
    while((m = re.exec(code || ''))) if(out.indexOf(m[1]) < 0) out.push(m[1]);
    return out;
  }
  function xwNewId(){ var s = ''; while(s.length < 9) s += Math.random().toString(36).slice(2); return 'x' + s.replace(/[^a-z0-9]/g, '').slice(0, 9); }
  function xwNew(){ return { id:xwNewId(), name:'', desc:'', perms:['board.read'], panel:'', commands:[ { id:'count', label:'Сколько блоков на доске', desc:'' } ], code:XW_START, at:Date.now() }; }
  function xwBytes(v){ return new TextEncoder().encode(JSON.stringify(v)).length; }   // сервер считает байты UTF-8
  // false — черновик не сохранён (слишком большой)
  function xwSaveDraft(d){
    if(xwBytes(d) > XW_DRAFT_MAX) return false;
    save('triosteum.extdraft.' + d.id, d); return true;
  }
  function xwDropDraft(id){ delete XW.drafts[id]; save('triosteum.extdraft.' + id, null); }
  function xwCanPublish(){ return !!(SERVER && SERVER.role === 'owner'); }
  // ошибки в описании — до публикации и пробного запуска
  function xwProblems(d){
    var p = [];
    if(!d.name.trim()) p.push('Назовите расширение');
    if(!d.code.trim()) p.push('Напишите код');
    else if(new TextEncoder().encode(d.code).length > 256 * 1024) p.push('Код больше 256 КБ — столько опубликовать нельзя');
    if(!d.commands.length && d.perms.indexOf('panel') < 0) p.push('Нужна хотя бы одна команда или панель');
    var seen = {};
    d.commands.forEach(function(c, i){
      if(!/^[a-z0-9_-]{1,30}$/.test(c.id)) p.push('Команда ' + (i + 1) + ': id — латиница, цифры, «-» и «_»');
      else if(seen[c.id]) p.push('Команда «' + c.id + '» повторяется'); else seen[c.id] = 1;
      if(!c.label.trim()) p.push('Команда ' + (i + 1) + ': нужно название');
    });
    return p;
  }
  function xwWarnings(d){
    var w = [], need = xwNeeds(d.code);
    need.forEach(function(k){ if(d.perms.indexOf(k) < 0) w.push('Код вызывает то, для чего нужно разрешение «' + EXT_PERMS[k] + '»'); });
    var ids = xwCmdIds(d.code);
    d.commands.forEach(function(c){ if(c.id && ids.indexOf(c.id) < 0) w.push('Команда «' + c.id + '» есть в списке, но код её не регистрирует'); });
    ids.forEach(function(id){ if(!d.commands.some(function(c){ return c.id === id; })) w.push('Код регистрирует «' + id + '», а в списке команд её нет'); });
    return w;
  }
  function xwDef(d){
    var o = { id:d.id, name:d.name.trim(), desc:d.desc.trim(), ic:'plug', perms:Object.keys(EXT_PERMS).filter(function(k){ return d.perms.indexOf(k) >= 0; }),
      commands:d.commands.map(function(c){ return { id:c.id, label:c.label.trim(), desc:(c.desc || '').trim() }; }), code:d.code, ver:0 };
    if(o.perms.indexOf('panel') >= 0) o.panel = (d.panel || '').trim() || o.name;
    return o;
  }

  function openWorkshop(startId){
    if($('xw')) return;
    xwScan();
    var back = h('div', { id:'xw', 'class':'cenv-back xw-back', role:'dialog', 'aria-modal':'true', 'aria-label':'Мастерская компании' });
    var side = h('nav', { 'class':'xw-side', 'aria-label':'Черновики и доработки компании' });
    var main = h('div', { 'class':'xw-main' });
    var closeB = h('button', { type:'button', 'class':'btn', text:'Закрыть' });
    back.appendChild(h('div', { 'class':'cenv xw' }, [
      h('header', { 'class':'cenv-h' }, [ h('h2', { text:'Мастерская компании' }),
        h('p', { text:'Всё, что ваша компания достроила в Triosteum: расширения, плагины, свои среды — с историей версий, откатом и журналом. Новое расширение пробуйте здесь же, в песочнице, как у сотрудников.' + (xwCanPublish() ? '' : ' Опубликовать расширение в компанию может владелец организации.') }) ]),
      h('div', { 'class':'xw-body' }, [ side, main ]),
      h('footer', { 'class':'cenv-f' }, [ closeB ]) ]));
    function shut(){ xwStopRun(); back.remove(); document.body.classList.remove('xw-open'); document.removeEventListener('keydown', onEsc, true); }
    // Escape закрывает, даже если фокус ушёл из окна (например, с кнопки, которая на время стала недоступной)
    function onEsc(ev){ if(ev.key === 'Escape' && $('cmdk').hidden && !document.querySelector('.ext-back')){ ev.stopPropagation(); ev.preventDefault(); shut(); } }
    document.addEventListener('keydown', onEsc, true);
    closeB.addEventListener('click', shut);
    back.addEventListener('keydown', function(ev){ ev.stopPropagation(); });

    function drawSide(){
      side.textContent = '';
      var add = h('button', { type:'button', 'class':'btn primary xw-add', text:'+ Новое расширение' });
      add.addEventListener('click', function(){ var d = xwNew(); XW.drafts[d.id] = d; xwSaveDraft(d); edit(d.id); });
      side.appendChild(add);
      var ds = Object.keys(XW.drafts).map(function(k){ return XW.drafts[k]; }).sort(function(a, b){ return (b.at || 0) - (a.at || 0); });
      side.appendChild(h('b', { 'class':'xw-sh', text:'Черновики' }));
      if(!ds.length) side.appendChild(h('p', { 'class':'xw-none', text:'пока нет' }));
      ds.forEach(function(d){
        var b = h('button', { type:'button', 'class':'xw-item' + (XW.cur === d.id ? ' on' : ''), 'aria-current':XW.cur === d.id ? 'true' : 'false', 'data-draft':d.id }, [
          h('span', { text:d.name || 'Без названия' }), extById(d.id) ? h('small', { text:'опубликовано' }) : null ]);
        b.addEventListener('click', function(){ edit(d.id); });
        side.appendChild(b);
      });
      // всё, что компания достроила: расширения, плагины, свои среды — с состоянием, историей и откатом
      if(SERVER){
        XW_KINDS.forEach(function(k){
          var its = (XW.items || []).filter(function(it){ return it.kind === k.id; });
          if(!its.length) return;
          side.appendChild(h('b', { 'class':'xw-sh', text:k.many }));
          its.forEach(function(it){
            var b = h('button', { type:'button', 'class':'xw-item' + (XW.view === it.id ? ' on' : '') + (it.disabled ? ' off' : ''), 'aria-current':XW.view === it.id ? 'true' : 'false', 'data-item':it.id, 'data-kind':it.kind }, [
              h('span', { text:it.name }), h('small', { text:it.disabled ? 'выключено для всех' : (it.kind === 'ext' ? 'версия ' + ((it.data && it.data.ver) || 1) : (it.by_name || '')) }) ]);
            b.addEventListener('click', function(){ showItem(it.id); });
            side.appendChild(b);
          });
        });
        var jb = h('button', { type:'button', 'class':'btn sm xw-journal-b' + (XW.view === 'journal' ? ' on' : ''), text:'Журнал изменений' });
        jb.addEventListener('click', showJournal);
        side.appendChild(jb);
      }
    }

    function openExtDraft(it){
      var d = JSON.parse(JSON.stringify(it.data)), own = xwCanPublish();
      if(own && XW.drafts[d.id]){ edit(d.id); return; }
      var nd = { id:own ? d.id : xwNewId(), name:own ? d.name : (d.name + ' (копия)').slice(0, 40), desc:d.desc || '', perms:d.perms || [], panel:d.panel || '',
        commands:d.commands || [], code:d.code || '', at:Date.now() };
      XW.drafts[nd.id] = nd; xwSaveDraft(nd); edit(nd.id);
    }
    // после изменения в мастерской — обновить то, чем пользуются сотрудники в этой вкладке
    function afterChange(){
      return Promise.all([ xwLoadItems(), extRefresh(), typeof orgRefresh === 'function' ? orgRefresh() : null, typeof cenvRefresh === 'function' ? cenvRefresh() : null ]);
    }
    function showItem(id){
      xwStopRun();
      var it = (XW.items || []).filter(function(x){ return x.id === id; })[0];
      XW.cur = null; XW.view = id; drawSide(); main.textContent = '';
      if(!it){ main.appendChild(h('p', { 'class':'xw-none', text:'Этого больше нет в компании.' })); return; }
      var k = XW_KINDS.filter(function(x){ return x.id === it.kind; })[0], can = xwCanManage(it);
      var err = h('p', { 'class':'cenv-err', role:'alert' });
      main.appendChild(h('div', { 'class':'xw-item-h' }, [
        h('h3', { text:it.name }),
        h('span', { 'class':'ext-state' + (it.disabled ? ' ask' : ' on'), text:it.disabled ? 'выключено для всех' : 'работает у сотрудников' }) ]));
      main.appendChild(h('p', { 'class':'ext-desc', text:k.one + (it.by_name ? ' · опубликовал ' + it.by_name : '') + ' · изменено ' + xwWhen(it.updated_at) }));
      if(it.data && it.data.desc) main.appendChild(h('p', { 'class':'ext-desc', text:it.data.desc }));
      var acts = h('div', { 'class':'ext-acts' });
      if(it.kind === 'ext'){
        var ed = h('button', { type:'button', 'class':'btn', text:xwCanPublish() ? 'Открыть в редакторе' : 'Открыть копию в редакторе' });
        ed.addEventListener('click', function(){ openExtDraft(it); });
        acts.appendChild(ed);
      }
      if(it.kind === 'env' && typeof ENVS !== 'undefined' && ENVS[it.src] && typeof openEnvBuilder === 'function' && cenvCanEdit(ENVS[it.src])){
        var eb = h('button', { type:'button', 'class':'btn', text:'Настроить среду' });
        eb.addEventListener('click', function(){ var e = ENVS[it.src]; shut(); openEnvBuilder(e); });
        acts.appendChild(eb);
      }
      if(can && it.kind !== 'env'){
        var tg = h('button', { type:'button', 'class':'btn', text:it.disabled ? 'Включить для всех' : 'Выключить для всех' });
        tg.addEventListener('click', function(){
          tg.disabled = true; err.textContent = '';
          SERVER.api('PATCH', '/org/items/' + it.id, { disabled:!it.disabled }).then(function(r){
            if(r.status !== 200){ tg.disabled = false; err.textContent = (r.data && r.data.detail) || 'Не получилось'; return; }
            toast('«' + it.name + '» ' + (it.disabled ? 'снова работает у сотрудников' : 'выключено для всех'));
            afterChange().then(function(){ showItem(it.id); var f = main.querySelector('.ext-acts button'); if(f) f.focus(); });
          }, function(){ tg.disabled = false; err.textContent = 'Нет связи с сервером'; });
        });
        acts.appendChild(tg);
      }
      if(can){
        var rm = h('button', { type:'button', 'class':'btn danger', text:'Убрать из компании' }), armed = 0;
        rm.addEventListener('click', function(){
          if(Date.now() - armed > 4000){ armed = Date.now(); rm.textContent = 'Точно убрать у всех?'; return; }
          rm.disabled = true; err.textContent = '';
          SERVER.api('DELETE', '/org/items/' + it.id).then(function(r){
            rm.disabled = false;
            if(r.status !== 200){ err.textContent = (r.data && r.data.detail) || 'Не получилось убрать'; return; }
            toast('«' + it.name + '» убрано из компании');
            XW.view = null;
            afterChange().then(function(){ drawSide(); main.textContent = ''; main.appendChild(h('p', { 'class':'xw-none', text:'«' + it.name + '» убрано из компании. Запись осталась в журнале изменений.' })); var f = side.querySelector('button'); if(f) f.focus(); });
          }, function(){ rm.disabled = false; err.textContent = 'Нет связи с сервером'; });
        });
        acts.appendChild(rm);
      }
      if(acts.childNodes.length) main.appendChild(acts);
      main.appendChild(err);
      main.appendChild(h('div', { 'class':'cenv-l', text:'История версий' }));
      var hist = h('ol', { 'class':'xw-hist', 'aria-label':'История версий «' + it.name + '»' }, [ h('li', { 'class':'xw-none', text:'загружаю…' }) ]);
      main.appendChild(hist);
      SERVER.api('GET', '/org/items/' + it.id + '/versions').then(function(r){
        hist.textContent = '';
        if(r.status !== 200){ hist.appendChild(h('li', { 'class':'xw-none', text:(r.data && r.data.detail) || 'Не получилось загрузить историю' })); return; }
        r.data.versions.forEach(function(v){
          var row = h('li', { 'data-version':v.id }, [
            h('span', { 'class':'xw-when', text:xwWhen(v.at) }),
            h('span', { 'class':'xw-what', text:(XW_ACT[v.action] || v.action) + (v.ver ? ' · версия ' + v.ver : '') + (v.name !== it.name ? ' · «' + v.name + '»' : '') }),
            h('span', { 'class':'xw-who', text:v.by_name || '' }) ]);
          if(v.current) row.appendChild(h('span', { 'class':'xw-cur', text:'сейчас' }));
          else if(v.can_restore && can){
            var back = h('button', { type:'button', 'class':'btn sm', text:'Вернуть эту версию' }), at = 0;
            back.addEventListener('click', function(){
              if(Date.now() - at > 4000){ at = Date.now(); back.textContent = 'Точно вернуть?'; return; }
              back.disabled = true; err.textContent = '';
              SERVER.api('POST', '/org/items/' + it.id + '/rollback', { version:v.id }).then(function(rr){
                if(rr.status !== 200){ back.disabled = false; err.textContent = (rr.data && rr.data.detail) || 'Не получилось вернуть'; return; }
                toast('«' + rr.data.name + '»: возвращена версия от ' + xwWhen(v.at));
                afterChange().then(function(){ showItem(it.id); var f = main.querySelector('.ext-acts button') || main.querySelector('h3'); if(f) f.focus(); });
              }, function(){ back.disabled = false; err.textContent = 'Нет связи с сервером'; });
            });
            row.appendChild(back);
          }
          hist.appendChild(row);
        });
      }, function(){ hist.textContent = ''; hist.appendChild(h('li', { 'class':'xw-none', text:'Нет связи с сервером' })); });
    }
    function showJournal(){
      xwStopRun();
      XW.cur = null; XW.view = 'journal'; drawSide(); main.textContent = '';
      main.appendChild(h('h3', { text:'Журнал изменений компании' }));
      main.appendChild(h('p', { 'class':'ext-desc', text:'Кто, что и когда опубликовал, изменил, вернул, выключил или убрал. Последние 200 записей.' }));
      var list = h('ol', { 'class':'xw-hist xw-journal', 'aria-label':'Журнал изменений' }, [ h('li', { 'class':'xw-none', text:'загружаю…' }) ]);
      main.appendChild(list);
      SERVER.api('GET', '/org/items/journal?limit=200').then(function(r){
        list.textContent = '';
        if(r.status !== 200){ list.appendChild(h('li', { 'class':'xw-none', text:'Не получилось загрузить журнал' })); return; }
        if(!r.data.entries.length) list.appendChild(h('li', { 'class':'xw-none', text:'Пока пусто.' }));
        r.data.entries.forEach(function(e){
          var k = XW_KINDS.filter(function(x){ return x.id === e.kind; })[0];
          list.appendChild(h('li', { 'data-action':e.action }, [
            h('span', { 'class':'xw-when', text:xwWhen(e.at) }),
            h('span', { 'class':'xw-what' }, [ h('span', { text:(XW_ACT[e.action] || e.action) + ' · ' + (k ? k.one.toLowerCase() : e.kind) + ' ' }), h(e.gone ? 's' : 'b', { text:'«' + e.name + '»' }) ]),
            h('span', { 'class':'xw-who', text:e.by_name || '' }) ]));
        });
      }, function(){ list.textContent = ''; list.appendChild(h('li', { 'class':'xw-none', text:'Нет связи с сервером' })); });
    }

    function edit(id){
      xwStopRun();
      XW.view = null; XW.cur = id; var d = XW.drafts[id]; if(!d){ main.textContent = ''; drawSide(); return; }
      drawSide();
      main.textContent = '';
      var big = false;
      var touch = function(){ d.at = Date.now(); big = !xwSaveDraft(d); check(); };
      var name = h('input', { type:'text', maxlength:'40', value:d.name, placeholder:'например, «Проверка схемы»', 'aria-label':'Название расширения' });
      var desc = h('input', { type:'text', maxlength:'300', value:d.desc, placeholder:'что делает — коротко', 'aria-label':'Описание расширения' });
      name.addEventListener('input', function(){ d.name = name.value; touch(); var it = side.querySelector('[data-draft="' + d.id + '"] span'); if(it) it.textContent = d.name || 'Без названия'; });
      desc.addEventListener('input', function(){ d.desc = desc.value; touch(); });
      var perms = h('div', { 'class':'xw-perms', role:'group', 'aria-label':'Разрешения' });
      var panelName = h('input', { type:'text', maxlength:'40', value:d.panel || '', placeholder:'название панели (по умолчанию — название расширения)', 'aria-label':'Название панели' });
      panelName.addEventListener('input', function(){ d.panel = panelName.value; touch(); });
      function drawPerms(){
        perms.textContent = '';
        Object.keys(EXT_PERMS).forEach(function(k){
          var cb = h('input', { type:'checkbox', 'data-perm':k }); cb.checked = d.perms.indexOf(k) >= 0;
          cb.addEventListener('change', function(){ d.perms = Object.keys(EXT_PERMS).filter(function(p){ return p === k ? cb.checked : d.perms.indexOf(p) >= 0; }); panelName.hidden = d.perms.indexOf('panel') < 0; touch(); });
          perms.appendChild(h('label', { 'class':'cenv-op' }, [ cb, h('span', { text:EXT_PERMS[k] }) ]));
        });
        panelName.hidden = d.perms.indexOf('panel') < 0;
      }
      drawPerms();
      var cmds = h('div', { 'class':'xw-cmds' });
      function drawCmds(){
        cmds.textContent = '';
        d.commands.forEach(function(c, i){
          var cid = h('input', { type:'text', maxlength:'30', value:c.id, placeholder:'id', 'aria-label':'id команды ' + (i + 1), 'class':'xw-cid' });
          var lab = h('input', { type:'text', maxlength:'60', value:c.label, placeholder:'название в Ctrl+K', 'aria-label':'Название команды ' + (i + 1) });
          var rm = h('button', { type:'button', 'class':'btn sm ghost', 'aria-label':'Убрать команду ' + (i + 1), html:'&times;' });
          cid.addEventListener('input', function(){ c.id = cid.value.trim(); touch(); });
          lab.addEventListener('input', function(){ c.label = lab.value; touch(); });
          rm.addEventListener('click', function(){ d.commands.splice(i, 1); touch(); drawCmds(); });
          cmds.appendChild(h('div', { 'class':'xw-cmd' }, [ cid, lab, rm ]));
        });
        if(d.commands.length < 20){
          var more = h('button', { type:'button', 'class':'btn sm', text:'+ команда' });
          more.addEventListener('click', function(){ d.commands.push({ id:'cmd' + (d.commands.length + 1), label:'', desc:'' }); touch(); drawCmds(); var ins = cmds.querySelectorAll('input'); if(ins.length) ins[ins.length - 1].focus(); });
          cmds.appendChild(more);
        }
      }
      drawCmds();
      var code = h('textarea', { 'class':'xw-code', rows:'16', spellcheck:'false', autocapitalize:'off', autocomplete:'off', 'aria-label':'Код расширения' }); code.value = d.code;
      code.addEventListener('input', function(){ d.code = code.value; touch(); });
      var fit = h('button', { type:'button', 'class':'btn sm', text:'Подобрать разрешения и команды по коду' });
      fit.addEventListener('click', function(){
        xwNeeds(d.code).forEach(function(k){ if(d.perms.indexOf(k) < 0) d.perms.push(k); });
        xwCmdIds(d.code).forEach(function(id){ if(!d.commands.some(function(c){ return c.id === id; })) d.commands.push({ id:id, label:id, desc:'' }); });
        touch(); drawPerms(); drawCmds();
      });
      // ИИ пишет код по описанию
      var aiBox = null;
      if(AI.api){
        var wish = h('input', { type:'text', maxlength:'600', placeholder:'Опишите, что должно делать расширение — ИИ напишет код', 'aria-label':'Задача для ИИ' });
        var go = h('button', { type:'button', 'class':'btn', text:'Написать код' });
        var aiSt = h('span', { 'class':'xw-ai-st', role:'status' });
        go.addEventListener('click', function(){
          var q = wish.value.trim(); if(!q){ wish.focus(); return; }
          go.disabled = true; aiSt.textContent = 'ИИ пишет код…';
          AI.api(xwPrompt(d, q), { task:'block', cache:false, onText:function(ev){ aiSt.textContent = 'ИИ пишет код… (' + ev.text.length + ' знаков)'; } }).then(function(r){
            go.disabled = false;
            var c = extractCode(r.text);
            if(!c){ aiSt.textContent = 'ИИ не прислал код — уточните задачу'; return; }
            d.code = c; code.value = c;
            xwNeeds(c).forEach(function(k){ if(d.perms.indexOf(k) < 0) d.perms.push(k); });
            var ids = xwCmdIds(c);
            d.commands = d.commands.filter(function(x){ return ids.indexOf(x.id) >= 0; });
            ids.forEach(function(id){ if(!d.commands.some(function(x){ return x.id === id; })) d.commands.push({ id:id, label:id, desc:'' }); });
            if(!d.name.trim()){ d.name = q.slice(0, 40); name.value = d.name; }
            touch(); drawPerms(); drawCmds();
            aiSt.textContent = 'Готово — проверьте код, названия команд и разрешения';
          }, function(err){ go.disabled = false; aiSt.textContent = aiFail(err); });
        });
        aiBox = h('div', { 'class':'xw-ai' }, [ wish, go, aiSt ]);
      }
      var probs = h('ul', { 'class':'xw-probs', role:'status' });
      function check(){
        probs.textContent = '';
        if(big) probs.appendChild(h('li', { 'class':'bad', text:'Черновик больше 900 КБ и не сохраняется — сократите код' }));
        xwProblems(d).forEach(function(t){ probs.appendChild(h('li', { 'class':'bad', text:t })); });
        xwWarnings(d).forEach(function(t){ probs.appendChild(h('li', { 'class':'warn', text:t })); });
      }
      var runBox = h('div', { 'class':'xw-run' });
      var logBox = h('pre', { 'class':'xw-log', 'aria-label':'Журнал пробного запуска', 'aria-live':'polite' });
      var tryB = h('button', { type:'button', 'class':'btn', text:'Пробный запуск' });
      var pubB = h('button', { type:'button', 'class':'btn primary', text:extById(d.id) ? 'Опубликовать новую версию' : 'Опубликовать в компании' });
      var delB = h('button', { type:'button', 'class':'btn danger', text:'Удалить черновик' }), armed = 0;
      var err = h('p', { 'class':'cenv-err', role:'alert' });
      if(!xwCanPublish()){ pubB.disabled = true; pubB.title = SERVER ? 'Публикует владелец организации' : 'Публикация — когда Triosteum открыт с сервера компании'; }
      function log(level, text){
        logBox.appendChild(h('span', { 'class':'l-' + level, text:(level === 'error' ? '✗ ' : level === 'warn' ? '! ' : '› ') + text + '\n' }));
        logBox.scrollTop = logBox.scrollHeight;
      }
      tryB.addEventListener('click', function(){
        var p = xwProblems(d); err.textContent = '';
        if(p.length){ err.textContent = p[0]; return; }
        xwStopRun(); logBox.textContent = ''; runBox.textContent = '';
        var x = XW.run = { id:'~' + d.id, draft:true, def:xwDef(d), onLog:log };
        log('info', 'Запуск в песочнице…');
        extStart(x).then(function(){
          log('info', 'Запущено. Команды:');
          x.def.commands.forEach(function(c){
            var b = h('button', { type:'button', 'class':'btn sm', 'data-cmd':c.id, text:c.label });
            b.addEventListener('click', function(){
              log('info', 'Команда «' + c.label + '»…');
              extInvoke(x, c.id).then(function(v){ log('info', 'Готово' + (v !== null && v !== undefined ? ': ' + JSON.stringify(v).slice(0, 600) : '')); }, function(){});
            });
            runBox.appendChild(b);
          });
          if(x.def.panel){
            var pb = h('button', { type:'button', 'class':'btn sm', text:'Панель «' + x.def.panel + '»' });
            pb.addEventListener('click', function(){ extPanel(x, true); back.classList.add('with-pane'); });
            runBox.appendChild(pb);
          }
        }, function(e){ log('error', e.message); });
      });
      pubB.addEventListener('click', function(){
        var p = xwProblems(d); err.textContent = '';
        if(p.length){ err.textContent = p[0]; return; }
        pubB.disabled = true;
        SERVER.api('POST', '/org/items', { kind:'ext', src:d.id, data:xwDef(d) }).then(function(r){
          pubB.disabled = false; pubB.focus();
          if(r.status !== 201){ err.textContent = (r.data && r.data.detail) || 'Не получилось опубликовать'; return; }
          Promise.all([ extRefresh(), xwLoadItems() ]).then(function(){
            pubB.textContent = 'Опубликовать новую версию';
            log('info', 'Опубликовано в компании, версия ' + r.data.data.ver + '. Сотрудники включают расширение в «Расширения компании» (Ctrl+K).');
            toast('«' + d.name + '» опубликовано, версия ' + r.data.data.ver);
            drawSide();
          });
        }, function(){ pubB.disabled = false; err.textContent = 'Нет связи с сервером'; });
      });
      delB.addEventListener('click', function(){
        if(Date.now() - armed > 4000){ armed = Date.now(); delB.textContent = 'Точно удалить черновик?'; return; }
        xwStopRun(); xwDropDraft(d.id); XW.cur = null; main.textContent = ''; drawSide();
        main.appendChild(h('p', { 'class':'xw-none', text:extById(d.id) ? 'Черновик удалён. Опубликованное расширение осталось в компании — убрать его можно в «Расширения компании».' : 'Черновик удалён.' }));
      });
      main.appendChild(h('div', { 'class':'cenv-row' }, [ h('label', null, [ h('span', { text:'Название' }), name ]), h('label', null, [ h('span', { text:'Описание' }), desc ]) ]));
      main.appendChild(h('div', { 'class':'cenv-l', text:'Разрешения — сотрудник увидит их перед включением' }));
      main.appendChild(perms); main.appendChild(panelName);
      main.appendChild(h('div', { 'class':'cenv-l', text:'Команды в Ctrl+K' }));
      main.appendChild(cmds);
      main.appendChild(h('div', { 'class':'xw-code-h' }, [ h('span', { 'class':'cenv-l', text:'Код (JavaScript)' }), fit ]));
      if(aiBox) main.appendChild(aiBox);
      main.appendChild(code);
      main.appendChild(h('details', { 'class':'xw-api' }, [ h('summary', { text:'Что умеет расширение' }), h('pre', { text:XW_API }) ]));
      main.appendChild(probs);
      main.appendChild(h('div', { 'class':'ext-acts' }, [ tryB, pubB, delB ]));
      main.appendChild(err);
      main.appendChild(runBox);
      main.appendChild(logBox);
      check();
    }
    function xwStopRun(){ if(XW.run){ extStop(XW.run.id); XW.run = null; } back.classList.remove('with-pane'); }
    document.body.classList.add('xw-open');
    document.body.appendChild(back);
    var first = startId && XW.drafts[startId] ? startId : (XW.cur && XW.drafts[XW.cur] ? XW.cur : Object.keys(XW.drafts)[0]);
    if(first) edit(first); else { drawSide(); main.appendChild(h('p', { 'class':'xw-none', text:'Создайте первое расширение — кнопка «+ Новое расширение» слева.' })); }
    setTimeout(function(){ var f = main.querySelector('input') || side.querySelector('button'); if(f) f.focus(); }, 30);
    if(SERVER) xwLoadItems().then(function(){ if(document.contains(back) && !main.querySelector('input:focus, textarea:focus')) drawSide(); });
  }
  function xwPrompt(d, q){
    return [
      'Ты пишешь расширение для Triosteum — платформы, где схема собирается из блоков на доске.',
      'Расширение — JavaScript, который работает в песочнице (iframe без сети и без доступа к странице). С приложением оно говорит только через объект triosteum:',
      XW_API,
      '',
      'Правила:',
      '- Каждая команда регистрируется через triosteum.command(\'id\', async () => { … }); id — латиница в нижнем регистре, цифры, «-» и «_».',
      '- Результат показывай через triosteum.ui.toast или в панели (document.body), если нужна панель.',
      '- Никаких fetch, XMLHttpRequest, внешних библиотек и import.',
      '- Сначала 1–2 предложения о том, что делает расширение, затем ПОЛНЫЙ код одним блоком кода с тегом js.',
      '',
      d.code.trim() && d.code.trim() !== XW_START.trim() ? 'Текущий код расширения:\n' + FENCE + 'js\n' + d.code.trim() + '\n' + FENCE + '\n' : '',
      'Задача: ' + q
    ].join('\n');
  }
