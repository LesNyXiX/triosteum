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
    var back = h('div', { id:'xw', 'class':'cenv-back xw-back', role:'dialog', 'aria-modal':'true', 'aria-label':'Мастерская расширений' });
    var side = h('nav', { 'class':'xw-side', 'aria-label':'Черновики и расширения' });
    var main = h('div', { 'class':'xw-main' });
    var closeB = h('button', { type:'button', 'class':'btn', text:'Закрыть' });
    back.appendChild(h('div', { 'class':'cenv xw' }, [
      h('header', { 'class':'cenv-h' }, [ h('h2', { text:'Мастерская расширений' }),
        h('p', { text:'Своя программа для вашей компании: команды в Ctrl+K и боковая панель. Пробуйте здесь же — в песочнице, как у сотрудников.' + (xwCanPublish() ? '' : ' Опубликовать в компанию может владелец организации.') }) ]),
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
      var pub = EXT.list.filter(function(x){ return !XW.drafts[x.id]; });
      if(pub.length){
        side.appendChild(h('b', { 'class':'xw-sh', text:'В компании' }));
        pub.forEach(function(x){
          var b = h('button', { type:'button', 'class':'xw-item', 'data-pub':x.id }, [ h('span', { text:x.def.name }), h('small', { text:'версия ' + (x.def.ver || 1) }) ]);
          b.title = xwCanPublish() ? 'Открыть для правки' : 'Открыть копию как черновик';
          b.addEventListener('click', function(){
            var d = JSON.parse(JSON.stringify(x.def)), own = xwCanPublish();
            var nd = { id:own ? d.id : xwNewId(), name:own ? d.name : (d.name + ' (копия)').slice(0, 40), desc:d.desc || '', perms:d.perms || [], panel:d.panel || '',
              commands:d.commands || [], code:d.code || '', at:Date.now() };
            XW.drafts[nd.id] = nd; xwSaveDraft(nd); edit(nd.id);
          });
          side.appendChild(b);
        });
      }
    }

    function edit(id){
      xwStopRun();
      XW.cur = id; var d = XW.drafts[id]; if(!d){ main.textContent = ''; drawSide(); return; }
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
          extRefresh().then(function(){
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
    if(SERVER) extRefresh().then(function(){ if(document.contains(back) && !main.querySelector('input:focus, textarea:focus')) drawSide(); });
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
