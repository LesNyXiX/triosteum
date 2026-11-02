  /* ---------- формы и анкеты ---------- */
  var FE = { f:null, mode:'build' };
  var FIELD_TYPES = [['text', 'Строка'], ['textarea', 'Абзац'], ['number', 'Число'], ['date', 'Дата'], ['select', 'Выбор из списка'], ['radio', 'Один вариант'], ['checkbox', 'Да / нет'], ['email', 'Почта']];
  function formTarget(f){
    var t = f.data.target && ofFile(f.data.target);
    if(t && t.type === 'sheet') return t;
    t = newFile('sheet', 'Ответы — ' + f.name, { sheets:[{ name:'Ответы', rows:[['Дата и время'].concat(f.data.fields.map(function(x){ return x.label; }))], fmt:{}, widths:{ 0:150 }, charts:[] }] }, f.parent, { silent:true });
    f.data.target = t.id; saveGraph(); return t;
  }
  function renderFormEd(m, f){
    if(FE.f !== f){ FE = { f:f, mode:'build' }; }
    var seg = h('div', { 'class':'seg fe-seg', role:'tablist' });
    [['build', 'Конструктор'], ['fill', 'Заполнить'], ['answers', 'Ответы']].forEach(function(o){
      seg.appendChild(h('button', { type:'button', role:'tab', 'class':'btn sm' + (FE.mode === o[0] ? ' on' : ''), 'aria-selected':FE.mode === o[0] ? 'true' : 'false', text:o[1], on:{ click:function(){
        if(o[0] === 'answers'){ var t = formTarget(f); ofOpen(t.id); return; }
        FE.mode = o[0]; ofRender(); } } }));
    });
    var t = f.data.target && ofFile(f.data.target), n = t ? Math.max(0, t.data.sheets[0].rows.length - 1) : 0;
    m.appendChild(h('div', { 'class':'ribbon' }, [ seg, h('span', { 'class':'grow' }), h('span', { 'class':'bld-stat', text:t ? 'Ответы сохраняются в таблицу «' + t.name + '» · ' + plural(n, 'ответ', 'ответа', 'ответов') : 'Ответы будут сохраняться в новую таблицу «Ответы — ' + f.name + '»' }) ]));
    var page = h('div', { 'class':'fe-page' }); m.appendChild(h('div', { 'class':'fe-scroll' }, [ page ]));
    if(FE.mode === 'fill') renderFormFill(page, f); else renderFormBuild(page, f);
  }
  function renderFormBuild(page, f){
    var d = f.data;
    var title = h('input', { 'class':'fe-title', value:d.title, 'aria-label':'Заголовок формы', placeholder:'Заголовок формы' });
    var desc = h('textarea', { 'class':'fe-desc', rows:'2', 'aria-label':'Описание формы', placeholder:'Описание (необязательно)' }); desc.value = d.desc || '';
    title.addEventListener('input', function(){ d.title = title.value; saveGraph(); }); desc.addEventListener('input', function(){ d.desc = desc.value; saveGraph(); });
    page.appendChild(h('div', { 'class':'fe-card head' }, [ title, desc ]));
    d.fields.forEach(function(fl, i){
      var lab = h('input', { 'class':'input', value:fl.label, 'aria-label':'Вопрос ' + (i + 1), placeholder:'Вопрос' });
      lab.addEventListener('input', function(){ var old = fl.label; fl.label = lab.value; syncHeader(f, old, fl.label); saveGraph(); });
      var typ = h('select', { 'class':'input', 'aria-label':'Тип ответа' }); FIELD_TYPES.forEach(function(o){ var op = h('option', { value:o[0], text:o[1] }); if(o[0] === fl.type) op.selected = true; typ.appendChild(op); });
      typ.addEventListener('change', function(){ fl.type = typ.value; if((fl.type === 'select' || fl.type === 'radio') && !(fl.options || []).length) fl.options = ['Вариант 1', 'Вариант 2']; saveGraph(); ofRender(); });
      var req = toggleRow('Обязательный', !!fl.required, function(v){ fl.required = v; saveGraph(); });
      var card = h('div', { 'class':'fe-card' }, [
        h('div', { 'class':'fe-row' }, [ lab, typ ]),
        (fl.type === 'select' || fl.type === 'radio') ? (function(){ var ta = h('textarea', { 'class':'input', rows:'2', 'aria-label':'Варианты ответа, каждый с новой строки', placeholder:'Варианты, каждый с новой строки' }); ta.value = (fl.options || []).join('\n'); ta.addEventListener('input', function(){ fl.options = ta.value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean); saveGraph(); }); return ta; })() : null,
        h('div', { 'class':'fe-row fe-foot' }, [ req, h('span', { 'class':'grow' }),
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Выше', html:SVGI('<path d="M12 19V5M6 11l6-6 6 6"/>', 15), on:{ click:function(){ if(i){ d.fields.splice(i - 1, 0, d.fields.splice(i, 1)[0]); saveGraph(); ofRender(); } } } }),
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Ниже', html:SVGI('<path d="M12 5v14M6 13l6 6 6-6"/>', 15), on:{ click:function(){ if(i < d.fields.length - 1){ d.fields.splice(i + 1, 0, d.fields.splice(i, 1)[0]); saveGraph(); ofRender(); } } } }),
          h('button', { type:'button', 'class':'icon-btn', 'aria-label':'Удалить вопрос', html:SVGI('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 15), on:{ click:function(){ d.fields.splice(i, 1); saveGraph(); ofRender(); } } })
        ])
      ].filter(Boolean));
      page.appendChild(card);
    });
    page.appendChild(h('div', { 'class':'fe-add' }, FIELD_TYPES.map(function(o){
      return h('button', { type:'button', 'class':'btn sm', text:'+ ' + o[1], on:{ click:function(){ d.fields.push({ id:'q' + Date.now().toString(36), label:o[1] === 'Да / нет' ? 'Согласен с условиями' : 'Новый вопрос', type:o[0], required:false, options:(o[0] === 'select' || o[0] === 'radio') ? ['Вариант 1', 'Вариант 2'] : undefined }); syncHeader(f); saveGraph(); ofRender(); } } });
    })));
  }
  function syncHeader(f, oldL, newL){
    var t = f.data.target && ofFile(f.data.target); if(!t) return;
    var head = t.data.sheets[0].rows[0];
    if(oldL !== undefined){ var i = head.indexOf(oldL); if(i >= 0) head[i] = newL; return; }
    f.data.fields.forEach(function(fl){ if(head.indexOf(fl.label) < 0) head.push(fl.label); });
  }
  function renderFormFill(page, f){
    var d = f.data, form = h('form', { 'class':'fe-fill', novalidate:'novalidate' });
    form.appendChild(h('div', { 'class':'fe-card head' }, [ h('h2', { text:d.title || 'Форма' }), d.desc ? h('p', { text:d.desc }) : null ].filter(Boolean)));
    d.fields.forEach(function(fl){
      var id = 'ff-' + fl.id, ctl;
      if(fl.type === 'textarea') ctl = h('textarea', { 'class':'input', id:id, rows:'3' });
      else if(fl.type === 'select'){ ctl = h('select', { 'class':'input', id:id }); ctl.appendChild(h('option', { value:'', text:'— выберите —' })); (fl.options || []).forEach(function(o){ ctl.appendChild(h('option', { value:o, text:o })); }); }
      else if(fl.type === 'radio'){ ctl = h('div', { 'class':'fe-radios', role:'radiogroup', 'aria-labelledby':id + '-l' }); (fl.options || []).forEach(function(o, k){ ctl.appendChild(h('label', null, [ h('input', { type:'radio', name:id, value:o, id:id + '-' + k }), h('span', { text:o }) ])); }); }
      else if(fl.type === 'checkbox') ctl = h('label', { 'class':'fe-check' }, [ h('input', { type:'checkbox', id:id }), h('span', { text:'Да' }) ]);
      else ctl = h('input', { 'class':'input', id:id, type:fl.type === 'number' ? 'number' : (fl.type === 'date' ? 'date' : (fl.type === 'email' ? 'email' : 'text')) });
      form.appendChild(h('div', { 'class':'fe-card' }, [ h('label', { 'class':'fe-q', id:id + '-l', 'for':fl.type === 'radio' ? null : id, text:fl.label + (fl.required ? ' *' : '') }), ctl, h('div', { 'class':'fe-err', id:id + '-e', 'aria-live':'polite' }) ]));
    });
    form.appendChild(h('div', { 'class':'bld-acts' }, [ h('button', { type:'submit', 'class':'btn primary', text:'Отправить' }), h('button', { type:'reset', 'class':'btn', text:'Очистить' }) ]));
    form.addEventListener('submit', function(e){
      e.preventDefault(); var ok = true, row = [new Date().toLocaleString('ru-RU')];
      d.fields.forEach(function(fl){
        var id = 'ff-' + fl.id, v;
        if(fl.type === 'radio'){ var r = form.querySelector('input[name="' + id + '"]:checked'); v = r ? r.value : ''; }
        else if(fl.type === 'checkbox') v = $(id).checked ? 'Да' : 'Нет';
        else v = $(id).value.trim();
        var err = '';
        if(fl.required && (!v || (fl.type === 'checkbox' && v === 'Нет'))) err = 'Обязательный вопрос';
        else if(fl.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) err = 'Нужен адрес вида name@company.ru';
        $(id + '-e').textContent = err; if(err) ok = false;
        row.push(fl.type === 'date' && v ? v.split('-').reverse().join('.') : v);
      });
      if(!ok){ toast('Проверьте отмеченные поля'); var fe = form.querySelector('.fe-err:not(:empty)'); if(fe) fe.parentNode.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
      var t = formTarget(f), rows = t.data.sheets[0].rows, head = rows[0];
      var out = head.map(function(hd, k){ if(k === 0) return row[0]; var j = d.fields.map(function(x){ return x.label; }).indexOf(hd); return j >= 0 ? row[j + 1] : ''; });
      d.fields.forEach(function(fl, j){ if(head.indexOf(fl.label) < 0){ head.push(fl.label); out.push(row[j + 1]); } });
      rows.push(out); t.t = Date.now(); saveGraph(); form.reset();
      toast('Ответ сохранён в таблицу «' + t.name + '» (всего: ' + (rows.length - 1) + ')');
      ofRender();
    });
    page.appendChild(form);
  }