  /* ---------- шаблоны ---------- */
  function tplList(){
    var docT = DOC_PLUGINS.filter(function(p){ return p.lang === 'doc'; }).map(function(p){ return { type:'doc', name:p.name, desc:p.desc, make:function(){ return { html:p.code }; } }; });
    var shT = DOC_PLUGINS.filter(function(p){ return p.lang === 'sheet'; }).map(function(p){ return { type:'sheet', name:p.name, desc:p.desc, make:function(){ return { sheets:[{ name:'Лист1', rows:parseSheet(p.code).rows, fmt:{}, widths:{}, charts:[] }] }; } }; });
    return [
      { type:'doc', name:'Пустой документ', desc:'Чистый лист', make:function(){ return defaultData('doc'); } },
      { type:'sheet', name:'Пустая таблица', desc:'Один лист', make:function(){ return defaultData('sheet'); } },
      { type:'slides', name:'Пустая презентация', desc:'Титульный слайд', make:function(){ return defaultData('slides'); } },
      { type:'form', name:'Пустая форма', desc:'Два вопроса', make:function(){ return defaultData('form'); } }
    ].concat(docT, shT, [
      { type:'sheet', name:'Учёт рабочего времени', desc:'Табель с итогами часов и переработками', make:function(){ return { sheets:[{ name:'Табель', rows:[['Сотрудник', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Итого', 'Переработка'], ['Иванов И. И.', '8', '9', '8', '10', '8', '=SUM(B2:F2)', '=IF(G2>40;G2-40;0)'], ['Петрова А. С.', '8', '8', '8', '8', '7', '=SUM(B3:F3)', '=IF(G3>40;G3-40;0)'], ['Сидоров П. В.', '9', '9', '9', '9', '9', '=SUM(B4:F4)', '=IF(G4>40;G4-40;0)'], ['Итого', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)', '=SUM(G2:G4)', '=SUM(H2:H4)']], fmt:{ '0:0':{ b:1 }, '4:0':{ b:1 } }, widths:{ 0:170 }, charts:[{ id:'c1', type:'bar', range:'A1:A4', title:'' }].slice(0, 0) }] }; } },
      { type:'slides', name:'Отчёт за месяц', desc:'5 слайдов: итоги, показатели, проблемы, планы', make:function(){ return { theme:'green', slides:[
        { layout:'title', title:'Итоги месяца', body:'Отчёт подразделения · ' + new Date().toLocaleDateString('ru-RU', { month:'long', year:'numeric' }) },
        { layout:'content', title:'Главное за месяц', body:'План выпуска выполнен на 103%\nЗапущена новая линия упаковки\nСнижены простои оборудования на 12%' },
        { layout:'two', title:'Показатели', body:'Выручка: 184,6 млн ₽\nМаржа: 21,4%', body2:'OEE: 71%\nБрак: 1,8%' },
        { layout:'content', title:'Проблемы и риски', body:'Рост цен на металлопрокат\nЗадержки поставок подшипников' },
        { layout:'content', title:'Планы на следующий месяц', body:'Закупка второй линии\nПереход на электронный документооборот\nОбучение операторов' } ] }; } },
      { type:'form', name:'Заявка на закупку', desc:'Подразделение, что купить, количество, срок, обоснование', make:function(){ return { title:'Заявка на закупку', desc:'Заполните заявку — она попадёт в таблицу ответов снабжения.', target:null, fields:[
        { id:'q1', label:'ФИО заявителя', type:'text', required:true }, { id:'q2', label:'Подразделение', type:'select', options:['Производство', 'Склад', 'Ремонтная служба', 'Офис'], required:true },
        { id:'q3', label:'Что купить', type:'text', required:true }, { id:'q4', label:'Количество', type:'number', required:true }, { id:'q5', label:'Нужно к дате', type:'date' },
        { id:'q6', label:'Срочность', type:'radio', options:['Обычная', 'Срочно', 'Авария'] }, { id:'q7', label:'Обоснование', type:'textarea' } ] }; } },
      { type:'form', name:'Опрос сотрудников', desc:'Удовлетворённость условиями работы', make:function(){ return { title:'Опрос сотрудников', desc:'Анонимно. 2 минуты.', target:null, fields:[
        { id:'q1', label:'Подразделение', type:'select', options:['Производство', 'Склад', 'Офис'] }, { id:'q2', label:'Оценка условий труда (1–10)', type:'number', required:true },
        { id:'q3', label:'Что улучшить в первую очередь', type:'radio', options:['Оборудование', 'Зарплата', 'График', 'Обучение'] }, { id:'q4', label:'Комментарий', type:'textarea' } ] }; } }
    ]);
  }
  var tplWin = null;
  function openTpl(){
    closeCtx();
    var w = $('tplW'); w.hidden = false; if(!tplWin) tplWin = makeWindow(w, '.pers-h', 'tpl', 'fixed'); tplWin.apply();
    var b = $('tplBody'); b.innerHTML = '';
    ['doc', 'sheet', 'slides', 'form'].filter(function(t){ return ofTypes().indexOf(t) >= 0; }).forEach(function(t){
      var grid = h('div', { 'class':'tpl-grid' });
      tplList().filter(function(x){ return x.type === t; }).forEach(function(x){
        grid.appendChild(h('button', { type:'button', 'class':'tpl', style:'--fc:' + FT[t].color, on:{ click:function(){ w.hidden = true; newFile(t, x.name.indexOf('Пуст') === 0 ? undefined : x.name, x.make()); } } }, [
          h('span', { 'class':'ic', html:ofIcon(t, 20) }), h('b', { text:x.name }), h('span', { text:x.desc || '' }) ]));
      });
      b.appendChild(section(FT[t].many, grid));
    });
  }
  $('tplClose').addEventListener('click', function(){ $('tplW').hidden = true; });
  $('tplW').addEventListener('keydown', function(e){ if(e.key === 'Escape') $('tplW').hidden = true; });
