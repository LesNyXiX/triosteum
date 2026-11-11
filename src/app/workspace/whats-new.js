  /* =====================================================================
     «ЧТО НОВОГО» — один раз после обновления показывает новые возможности с кнопкой «Попробовать».
     Пункт показывается, только если его функция уже есть в сборке (typeof имя === 'function'; без eval, иначе
     esbuild перестаёт сжимать имена во всей сборке),
     поэтому окно не обещает того, что ещё не слито. Снова открыть — палитра команд → «Что нового».
     ===================================================================== */
  var WN_VER = '2026-11-11';
  var WN_ITEMS = [
    { has:function(){ return typeof rhRender === 'function'; }, t:'История запусков', d:'Каждый запуск сохраняется: итог, время и ошибки каждого блока. Сводка показывает, где схема падает чаще и что работает медленнее всего; выгрузка в Excel.',
      go:function(){ cmpOpen(); cmpTabs('hist'); } },
    { has:function(){ return typeof runOptsSection === 'function'; }, t:'Надёжный запуск', d:'Блок можно выключить или закрепить его результат, чтобы не дёргать 1С и почту при отладке. Повторы при ошибке и «продолжать схему при ошибке» — в настройках блока (ПКМ → «Запуск»).',
      go:function(){ var n = G.nodes.filter(function(x){ return x.kind !== 'hub'; })[0]; if(!n){ toast('Добавьте блок, затем ПКМ по нему → «Запуск»'); return; } S.multi = []; S.sel = { type:'node', id:n.id }; updateSel(); showPop(); } },
    { has:function(){ return typeof openVars === 'function'; }, t:'Переменные и профили «Тест» / «Боевой»', d:'Адреса, ставки и получатели — в одном месте, а не в коде блоков: {{var:ИМЯ}}. Отладили на тестовой базе — переключили на боевую. Секреты скрываются в журнале.',
      go:function(){ openVars(); } },
    { has:function(){ return typeof grpCreate === 'function'; }, t:'Группы блоков', d:'Ctrl+G — рамка с названием вокруг выделенных блоков: двигается целиком, ▶ запускает только её.',
      go:function(){ grpCreate(); } },
    { has:function(){ return typeof openSch === 'function'; }, t:'Расписание запуска', d:'Схема запускается сама: каждые N минут, ежедневно или по будням. Об ошибках придёт уведомление.',
      go:function(){ openSch(); } },
    { has:function(){ return typeof dfChips === 'function'; }, t:'Данные на связях', d:'После запуска на связях видно, сколько записей прошло; щелчок — таблица данных.',
      go:function(){ runBoard(); } },
    { has:function(){ return typeof openAudit === 'function'; }, t:'Журнал действий', d:'Кто, что и когда изменил в схеме; выгрузка в CSV.', go:function(){ openAudit(); } },
    { has:function(){ return typeof openVersions === 'function'; }, t:'Версии схемы', d:'Сохраните версию, сравните с текущей и верните, если что-то пошло не так.', go:function(){ openVersions(); } },
    { has:function(){ return typeof openDocgen === 'function'; }, t:'Описание схемы', d:'Документ по схеме для аудитора или нового сотрудника: блоки, поток данных, код — в HTML, Markdown или PDF.', go:function(){ openDocgen(); } },
    { has:function(){ return typeof importFlows === 'function'; }, t:'Импорт из n8n и Make', d:'Перенесите готовые сценарии: откройте JSON-файл, блоки и связи создадутся сами.', go:function(){ importFlows(); } }
  ];
  function wnAvail(){ return WN_ITEMS.filter(function(x){ try { return x.has(); } catch(e){ return false; } }); }
  var wnWin = null;
  function openWhatsNew(){
    var items = wnAvail(); if(!items.length) return;
    if(!wnWin){
      wnWin = h('section', { 'class':'pers wn-w', id:'wnW', role:'dialog', 'aria-label':'Что нового в Triosteum' });
      wnWin.appendChild(h('div', { 'class':'pers-h' }, [ h('b', { text:'Что нового в Triosteum' }), h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть', text:'✕', on:{ click:closeWhatsNew } }) ]));
      wnWin.appendChild(h('div', { 'class':'pers-b', id:'wnBody' }));
      wnWin.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); closeWhatsNew(); } });
      document.body.appendChild(wnWin);
    }
    var b = $('wnBody'); b.textContent = '';
    b.appendChild(h('p', { 'class':'wn-lead', text:'Сделано по итогам обзора B2B-платформ автоматизации (n8n, Make, KNIME, ELMA365, Битрикс24 и др.) — то, чего пользователям чаще всего не хватает.' }));
    items.forEach(function(x){
      b.appendChild(h('div', { 'class':'wn-i' }, [
        h('div', { 'class':'wn-t' }, [ h('b', { text:x.t }), h('p', { text:x.d }) ]),
        h('button', { type:'button', 'class':'btn sm', text:'Попробовать', on:{ click:function(){ closeWhatsNew(); try { x.go(); } catch(e){ toast('Не получилось открыть: ' + (e && e.message || e)); } } } })
      ]));
    });
    wnWin.hidden = false;
    var f = wnWin.querySelector('.wn-i button'); if(f) f.focus();
  }
  function closeWhatsNew(){ if(wnWin) wnWin.hidden = true; Repo.setPref('seen.whatsnew', WN_VER); }
  (function(){
    var _cc = cmdCommands;
    cmdCommands = function(){ return _cc().concat(wnAvail().length ? [{ sec:'help', label:'Что нового', d:'Новые возможности и где их найти', icon:'pers', act:openWhatsNew, k:'что нового новое обновление changelog' }] : []); };
  })();
  // напомнить один раз — небольшой карточкой в углу (не окном поверх доски): открыть список или закрыть
  function wnNudge(){
    var n = wnAvail().length;
    var card = h('div', { 'class':'wn-card', role:'status' }, [
      h('span', { text:'Что нового: ' + n + ' ' + plural(n, 'возможность', 'возможности', 'возможностей') }),
      h('button', { type:'button', 'class':'btn sm primary', text:'Посмотреть', on:{ click:function(){ card.remove(); openWhatsNew(); } } }),
      h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Скрыть', text:'✕', on:{ click:function(){ card.remove(); Repo.setPref('seen.whatsnew', WN_VER); } } })
    ]);
    document.body.appendChild(card);
    setTimeout(function(){ if(card.isConnected) card.remove(); }, 15000);
  }
  setTimeout(function(){
    if(PANE || Repo.pref('seen.whatsnew', '') === WN_VER) return;
    if((typeof TOUR !== 'undefined' && TOUR) || Repo.pref('tourPending', false) || $('welcome')) return;   // сначала знакомство
    if(wnAvail().length >= 2) wnNudge();
  }, 2500);
