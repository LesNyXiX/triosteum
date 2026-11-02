  /* ---------- ИИ-помощник офиса ---------- */
  var OA = { busy:false, text:'', res:null, err:null, q:'' };
  function oaKind(){ var f = ofFile(OF.tab); return f ? f.type : 'desk'; }
  var OA_QUICK = {
    desk:[['Отчёт по продажам', 'Сделай таблицу продаж по месяцам за полгода с итогами, документ-отчёт с выводами и презентацию на 4 слайда'], ['Бюджет отдела', 'Создай таблицу бюджета отдела план/факт с отклонениями и служебную записку о перерасходе'], ['Заявки на ремонт', 'Сделай форму заявки на ремонт оборудования и таблицу для учёта заявок']],
    doc:[['Написать по описанию', 'Напиши документ: '], ['Улучшить текст', 'Улучши текст документа: деловой стиль, без воды, сохрани структуру и все поля {{…}}.'], ['Проверить', 'Проверь документ на ошибки, пропущенные реквизиты и противоречия и пришли исправленную версию.'], ['Сократить', 'Сократи документ вдвое, сохранив смысл.']],
    sheet:[['Создать таблицу', 'Создай таблицу: '], ['Добавить итоги', 'Добавь строку «Итого» с формулами SUM по числовым столбцам.'], ['Добавить формулы', 'Добавь полезные вычисляемые столбцы с формулами (отклонения, доли, НДС) там, где это уместно.'], ['Объяснить', 'Кратко объясни, что в таблице и что считают формулы.']],
    slides:[['Сделать презентацию', 'Сделай презентацию на тему: '], ['Улучшить слайды', 'Сделай текст слайдов короче и сильнее, максимум 4 пункта на слайд.'], ['Добавить слайд выводов', 'Добавь в конец слайд с выводами и следующими шагами.']],
    form:[['Создать форму', 'Создай форму: '], ['Улучшить вопросы', 'Сделай вопросы понятнее, добавь недостающие и обязательность там, где нужно.']]
  };
  function renderOfAi(){
    var p = $('ofAi'); p.innerHTML = '';
    var k = oaKind(), f = ofFile(OF.tab);
    p.appendChild(h('div', { 'class':'oa-h' }, [ h('b', { text:'AI-помощник' }), h('span', { text:f ? FT[f.type].name + ' «' + f.name + '»' : 'Рабочий стол: создам файлы по задаче' }),
      h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Закрыть помощника', html:SVGI('<path d="M6 6l12 12M18 6L6 18"/>', 14), on:{ click:function(){ OF.ai = false; ofRender(); } } }) ]));
    if(AI.api === null){ p.appendChild(h('div', { 'class':'bld-issue warn', text:aiOffText() })); return; }
    var chips = h('div', { 'class':'arc-ex' });
    (OA_QUICK[k] || []).forEach(function(q){ chips.appendChild(h('button', { type:'button', 'class':'chip', text:q[0], disabled:OA.busy ? 'disabled' : null, on:{ click:function(){ if(/: $/.test(q[1])){ ta.value = q[1]; ta.focus(); } else { ta.value = q[1]; oaAsk(ta.value); } } } })); });
    var ta = h('textarea', { 'class':'bld-wish', rows:'4', placeholder:k === 'desk' ? 'Опишите задачу: какие файлы нужны и что в них должно быть…' : 'Что сделать с файлом?', 'aria-label':'Запрос к ИИ' });
    ta.value = OA.q; ta.addEventListener('input', function(){ OA.q = ta.value; });
    ta.addEventListener('keydown', function(e){ if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); oaAsk(ta.value); } });
    p.appendChild(chips); p.appendChild(ta);
    p.appendChild(h('div', { 'class':'bld-acts' }, [ h('button', { type:'button', 'class':'btn primary', text:OA.busy ? 'ИИ работает…' : 'Отправить', disabled:OA.busy || AI.api === undefined ? 'disabled' : null, on:{ click:function(){ oaAsk(ta.value); } } }), h('span', { 'class':'bld-stat', text:(IS_MAC ? '⌘' : 'Ctrl') + '+Enter' }) ]));
    if(OA.busy) p.appendChild(h('div', { 'class':'arc-prog' }, [ h('span', { 'class':'arc-spin' }), h('span', { 'class':'oa-pt', text:'Готовлю ответ… ' + (OA.text ? OA.text.length + ' симв.' : '') }) ]));
    if(OA.err) p.appendChild(h('div', { 'class':'bld-issue err', text:OA.err }));
    if(OA.res){
      var box = h('div', { 'class':'oa-res' });
      if(OA.res.note) box.appendChild(h('p', { text:OA.res.note }));
      if(OA.res.files) box.appendChild(h('ul', null, OA.res.files.map(function(x){ return h('li', null, [ h('span', { 'class':'ic', style:'color:' + FT[x.type].color, html:ofIcon(x.type, 14) }), h('span', { text:' ' + x.name + ' — ' + FT[x.type].name.toLowerCase() }) ]); })));
      box.appendChild(h('div', { 'class':'bld-acts' }, [
        h('button', { type:'button', 'class':'btn primary', text:OA.res.files ? 'Создать файлы' : 'Применить к файлу', on:{ click:oaApply } }),
        OA.res.mode === 'doc' ? h('button', { type:'button', 'class':'btn', text:'Добавить в конец', on:{ click:function(){ oaApply('append'); } } }) : null,
        h('button', { type:'button', 'class':'btn', text:'Отклонить', on:{ click:function(){ OA.res = null; renderOfAi(); } } })
      ].filter(Boolean)));
      p.appendChild(box);
    } else if(OA.text && !OA.busy) p.appendChild(h('div', { 'class':'ai-out', text:OA.text.replace(new RegExp(FENCE + '[\\s\\S]*?' + FENCE, 'g'), '').trim() }));
  }
  var OA_FMT = {
    doc:'HTML документа: простые теги h1, h2, h3, p, b, i, u, ul, ol, li, table, tr, th, td, br; style="text-align:…" можно. Поля для слияния — {{Название столбца}}.',
    sheet:'JSON книги: {"sheets":[{"name":"Лист1","rows":[["Заголовок",…],["значение","=B2*C2"],…]}]}. Все значения — строки; формулы как в Excel с «=», разделитель аргументов «;», функции SUM, AVERAGE, MIN, MAX, COUNT, ROUND, IF; ссылки на другие листы: =Лист2!B3, на другие файлы: =\'Имя файла\'!B3.',
    slides:'JSON: {"theme":"light|dark|green|wine|blue","slides":[{"layout":"title|content|two|head","title":"…","body":"пункты через \\n","body2":"для two","notes":"…"}]}. 3–4 пункта на слайд, коротко.',
    form:'JSON: {"title":"…","desc":"…","fields":[{"label":"…","type":"text|textarea|number|date|select|radio|checkbox|email","required":true,"options":["…"]}]}.'
  };
  function oaContent(f){
    if(f.type === 'doc'){ deSaveNow(); return f.data.html.slice(0, 12000); }
    if(f.type === 'sheet') return JSON.stringify({ sheets:f.data.sheets.map(function(s){ return { name:s.name, rows:s.rows.slice(0, 200) }; }) });
    if(f.type === 'slides'){ slCommitText(); return JSON.stringify({ theme:f.data.theme, slides:f.data.slides.map(function(s){ return { layout:s.layout, title:s.title, body:s.body, body2:s.body2, notes:s.notes }; }) }); }
    if(f.type === 'form') return JSON.stringify({ title:f.data.title, desc:f.data.desc, fields:f.data.fields });
    return '';
  }
  function oaAsk(q){
    q = (q || '').trim(); if(!q || OA.busy || !AI.api) return;
    var f = ofFile(OF.tab), k = f ? f.type : 'desk';
    OA.busy = true; OA.text = ''; OA.res = null; OA.err = null; renderOfAi();
    var others = ofItems().filter(function(x){ return x.type === 'sheet' && (!f || x.id !== f.id); }).slice(0, 8).map(function(x){ return '«' + x.name + '»: листы ' + x.data.sheets.map(function(s){ return s.name + ' [' + (s.rows[0] || []).join(', ') + ']'; }).join('; '); }).join('\n');
    var prompt;
    if(k === 'desk') prompt = [
      'Ты — ИИ-помощник офисной среды Triosteum для производственной компании в России. По задаче пользователя создай нужные файлы.',
      'Типы и форматы content:', '- doc: ' + OA_FMT.doc, '- sheet: ' + OA_FMT.sheet, '- slides: ' + OA_FMT.slides, '- form: ' + OA_FMT.form,
      'Связывай файлы: формулы в таблицах могут ссылаться на другие создаваемые таблицы по имени (=\'Имя\'!C5). Реалистичные данные, деловой русский язык.',
      'Ответь ТОЛЬКО блоком ' + FENCE + 'json: {"note":"1–2 предложения","files":[{"type":"doc|sheet|slides|form","name":"…","content":…}]} — content для doc строка HTML, для остальных объект.',
      others ? 'Уже есть таблицы:\n' + others : '', 'Задача: ' + q ].join('\n');
    else prompt = [
      'Ты — ИИ-помощник офисной среды Triosteum для производственной компании в России. Пользователь работает с файлом «' + f.name + '» (' + FT[k].name + ').',
      'Формат содержимого: ' + OA_FMT[k],
      'Если файл нужно изменить или создать содержимое — 1–2 предложения о правках, затем ПОЛНОЕ новое содержимое одним блоком ' + FENCE + (k === 'doc' ? 'html' : 'json') + '. Если нужен только ответ на вопрос — без блока кода.',
      others ? 'Другие таблицы (на них можно ссылаться в формулах):\n' + others : '',
      'Текущее содержимое:', FENCE + (k === 'doc' ? 'html' : 'json'), oaContent(f), FENCE, '', 'Запрос: ' + q ].join('\n');
    AI.api(prompt, { task:'office', cache:false, onText:function(ev){ OA.text = ev.text; var s = $('ofAi').querySelector('.oa-pt'); if(s) s.textContent = 'Готовлю ответ… ' + ev.text.length + ' симв.'; } }).then(function(r){
      OA.busy = false; OA.text = r.text;
      try{ OA.res = oaParse(r.text, k); }catch(e){ OA.res = null; if(extractCode(r.text)) OA.err = 'Не удалось разобрать ответ ИИ. Попробуйте ещё раз.'; }
      renderOfAi();
    }, function(err){ OA.busy = false; OA.err = aiFail(err); renderOfAi(); });
  }
  function oaParse(text, k){
    var code = extractCode(text); if(!code) return null;
    var note = text.slice(0, text.indexOf(FENCE)).trim();
    if(k === 'doc') return { mode:'doc', note:note, html:sanitizeHtml(code) };
    var o = JSON.parse(code.slice(code.indexOf('{'), code.lastIndexOf('}') + 1));
    if(k === 'desk'){
      var files = (o.files || []).filter(function(x){ return x && FT[x.type] && x.type !== 'folder' && x.name; }).map(function(x){ return { type:x.type, name:String(x.name).slice(0, 80), data:oaData(x.type, x.content) }; }).filter(function(x){ return x.data; });
      if(!files.length) throw new Error('empty');
      return { mode:'desk', note:o.note || note, files:files };
    }
    return { mode:k, note:note, data:oaData(k, o) };
  }
  function oaData(type, c){
    try{
      if(type === 'doc') return { html:sanitizeHtml(typeof c === 'string' ? c : String(c && c.html || '')) };
      if(typeof c === 'string') c = JSON.parse(c);
      if(type === 'sheet'){ var sh = (c.sheets || (c.rows ? [{ name:'Лист1', rows:c.rows }] : [])).map(function(s, i){ return { name:String(s.name || 'Лист' + (i + 1)).slice(0, 28), rows:parseSheet({ rows:s.rows }).rows, fmt:{ }, widths:{}, charts:[] }; }); if(!sh.length) return null; sh.forEach(function(s){ (s.rows[0] || []).forEach(function(x, ci){ s.fmt['0:' + ci] = { b:1 }; }); }); return { sheets:sh }; }
      if(type === 'slides'){ var sl = (c.slides || []).map(function(s){ return { layout:SL_LAYOUTS.map(function(x){ return x[0]; }).indexOf(s.layout) >= 0 ? s.layout : 'content', title:String(s.title || ''), body:String(s.body || ''), body2:s.body2 ? String(s.body2) : '', notes:s.notes ? String(s.notes) : '' }; }); if(!sl.length) return null; return { theme:SL_THEMES[c.theme] ? c.theme : 'light', slides:sl }; }
      if(type === 'form'){ var fl = (c.fields || []).map(function(x, i){ return { id:'q' + (i + 1), label:String(x.label || 'Вопрос'), type:FIELD_TYPES.map(function(t){ return t[0]; }).indexOf(x.type) >= 0 ? x.type : 'text', required:!!x.required, options:Array.isArray(x.options) ? x.options.map(String) : undefined }; }); if(!fl.length) return null; return { title:String(c.title || 'Форма'), desc:String(c.desc || ''), fields:fl, target:null }; }
    }catch(e){ return null; }
    return null;
  }
  function oaApply(how){
    var r = OA.res; if(!r) return;
    if(r.mode === 'desk'){
      var dir = r.files.length > 1 ? newFile('folder', (OA.q || 'Файлы от ИИ').slice(0, 40), null, OF.dir, { silent:true }) : null;
      var made = r.files.map(function(x){ return newFile(x.type, x.name, x.data, dir ? dir.id : OF.dir, { silent:true }); });
      OA.res = null; saveGraph();
      if(dir) OF.dir = dir.id;
      ofOpen(made[0].id); toast('Создано файлов: ' + made.length + (dir ? ' (папка «' + dir.name + '»)' : ''));
      return;
    }
    var f = ofFile(OF.tab); if(!f) return;
    if(r.mode === 'doc'){ f.data.html = how === 'append' ? deSerialize() + r.html : r.html; }
    else if(r.data){ if(f.type === 'form') r.data.target = f.data.target; f.data = r.data; if(f.type === 'sheet'){ SG.f = null; } if(f.type === 'slides') SE.f = null; }
    f.t = Date.now(); OA.res = null; saveGraph(); ofRender(); toast('Изменения ИИ применены к «' + f.name + '»');
  }
