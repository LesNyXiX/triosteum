  /* ---------- параметры этапов, условий, выгрузок ---------- */
  function params(n){ try{ return JSON.parse(nodeCode(n)) || {}; }catch(e){ return {}; } }
  var ACTIONS = ['Согласовать', 'Проверить', 'Подписать', 'Зарегистрировать', 'Утвердить', 'Ознакомить', 'Исполнить'];
  var OPS = [['>', 'больше'], ['<', 'меньше'], ['>=', 'не меньше'], ['<=', 'не больше'], ['=', 'равно'], ['!=', 'не равно'], ['содержит', 'содержит']];
  var FORMATS = [['xlsx', 'Файл Excel (.xlsx)'], ['csv', 'Файл CSV'], ['html', 'Пакет документов (.html)'], ['email', 'Письмо по почте'], ['1c', 'Передача в 1С'], ['archive', 'Электронный архив']];
  function autoDesc(n){
    if(!isDocs()) return '';
    var p = params(n);
    if(n.lang === 'step') return (p.action || 'Этап') + ' · ' + (p.who || 'ответственный') + (p.days ? ' · ' + p.days + ' дн.' : '');
    if(n.lang === 'cond') return 'если «' + (p.field || '?') + '» ' + (OPS.filter(function(o){ return o[0] === p.op; })[0] || ['', p.op])[1] + ' ' + (p.value || '');
    if(n.lang === 'send'){ var f = FORMATS.filter(function(o){ return o[0] === p.format; })[0]; return (f ? f[1] : 'выгрузка') + (p.to ? ' → ' + p.to : ''); }
    if(n.lang === 'sheet'){ var d = parseSheet(nodeCode(n)); return (d.rows.length - 1) + ' строк · ' + d.rows[0].length + ' столбцов'; }
    if(n.lang === 'doc'){ var fl = docFields(nodeCode(n)); return fl.length ? 'поля: ' + fl.slice(0, 4).join(', ') + (fl.length > 4 ? '…' : '') : 'шаблон документа'; }
    return '';
  }
  function paramSection(n){
    var p = params(n), box = h('div', { 'class':'prm' });
    function upd(k, v){ p[k] = v; n.codes[n.lang] = JSON.stringify(p); saveGraph(); refreshNode(n); }
    function field(label, ctl){ return h('label', { 'class':'prm-f' }, [ h('span', { text:label }), ctl ]); }
    function sel(list, val, k){ var s = h('select', { 'class':'input' }); list.forEach(function(o){ var op = h('option', { value:o[0], text:o[1] }); if(o[0] === val) op.selected = true; s.appendChild(op); }); s.addEventListener('change', function(){ upd(k, s.value); }); return s; }
    function inp(val, k, type){ var i = h('input', { 'class':'input', type:type || 'text' }); i.value = val === undefined ? '' : val; i.addEventListener('input', function(){ upd(k, type === 'number' ? Math.max(0, +i.value || 0) : i.value); }); return i; }
    if(n.lang === 'step'){
      var acts = ACTIONS.map(function(a){ return [a, a]; }); if(p.action && ACTIONS.indexOf(p.action) < 0) acts.unshift([p.action, p.action]);
      box.appendChild(field('Действие', sel(acts, p.action, 'action')));
      box.appendChild(field('Ответственный', inp(p.who, 'who')));
      box.appendChild(field('Срок, рабочих дней', inp(p.days || 0, 'days', 'number')));
      box.appendChild(field('Комментарий', inp(p.note, 'note')));
    } else if(n.lang === 'cond'){
      var fl = []; var rows = upstreamRows(n); if(rows && rows[0]) fl = Object.keys(rows[0]);
      var fi = inp(p.field, 'field'); if(fl.length){ var dl = h('datalist', { id:'fl-' + n.id }); fl.forEach(function(f){ dl.appendChild(h('option', { value:f })); }); fi.setAttribute('list', 'fl-' + n.id); box.appendChild(dl); }
      box.appendChild(field('Поле', fi));
      box.appendChild(field('Сравнение', sel(OPS, p.op, 'op')));
      box.appendChild(field('Значение', inp(p.value, 'value')));
      if(fl.length) box.appendChild(h('div', { 'class':'prm-hint', text:'Поля из таблицы выше по схеме: ' + fl.join(', ') }));
    } else if(n.lang === 'send'){
      box.appendChild(field('Куда', sel(FORMATS, p.format, 'format')));
      box.appendChild(field('Название файла / тема', inp(p.name, 'name')));
      box.appendChild(field('Получатель (почта, база 1С)', inp(p.to, 'to')));
    }
    return box;
  }
  function condPass(row, p){
    var a = lookup(row, p.field || ''), b = p.value === undefined ? '' : p.value, na = num(a), nb = num(b);
    var both = typeof na === 'number' && typeof nb === 'number';
    switch(p.op){
      case '>': return both && na > nb; case '<': return both && na < nb;
      case '>=': return both && na >= nb; case '<=': return both && na <= nb;
      case '!=': return both ? na !== nb : String(a || '').toLowerCase() !== String(b).toLowerCase();
      case 'содержит': return String(a || '').toLowerCase().indexOf(String(b).toLowerCase()) >= 0;
      default: return both ? na === nb : String(a || '').toLowerCase() === String(b).toLowerCase();
    }
  }
  function doneWord(action){
    var m = { 'Согласовать':'Согласовано', 'Проверить':'Проверено', 'Подписать':'Подписано', 'Зарегистрировать':'Зарегистрировано', 'Утвердить':'Утверждено', 'Ознакомить':'Ознакомлены', 'Исполнить':'Исполнено' };
    return m[action] || (action ? action + ' — выполнено' : 'Выполнено');
  }
