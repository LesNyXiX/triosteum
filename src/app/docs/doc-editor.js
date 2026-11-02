  /* ---------- редактор документа ---------- */
  var DP = { el:null, timer:null, preview:false };
  function wrapFields(html){ return html.replace(FIELD_RE, function(m, k){ return '<span class="fld" contenteditable="false" data-f="' + escHtml(k) + '">{{' + escHtml(k) + '}}</span>'; }); }
  function serializeDoc(){
    var c = $('paper').cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.fld'), function(s){ s.replaceWith(document.createTextNode('{{' + s.getAttribute('data-f') + '}}')); });
    return c.innerHTML;
  }
  function loadDocPane(){
    DP.preview = false; $('dpPreview').setAttribute('aria-pressed', 'false'); $('dpPreview').classList.remove('on');
    var paper = $('paper'); paper.contentEditable = 'true'; paper.classList.remove('pv');
    paper.innerHTML = wrapFields(sanitizeHtml(getCode()));
    docInfo();
  }
  function docInfo(){
    var f = docFields(DP.preview ? getCode() : serializeDoc()), n = docNode(), rows = n ? upstreamRows(n) : null;
    el.out.textContent = '';
    print('> Поля шаблона: ' + (f.length ? f.join(', ') : 'нет — вставьте кнопкой «Поле»'));
    if(rows && rows.length){
      var keys = Object.keys(rows[0]), miss = f.filter(function(x){ return !/^(дата|сегодня)$/i.test(x) && lookup(rows[0], x) === undefined; });
      print('> Данные: таблица выше по схеме, ' + rows.length + ' записей. Столбцы: ' + keys.join(', '), 'ok');
      var pyUp = (function(){ var plan = boardOrder(), seen = {}, q = (plan.preds[n.id] || []).slice(), out = []; while(q.length){ var id = q.shift(); if(seen[id]) continue; seen[id] = 1; var x = nodeById(id); if(!x) continue; if(x.lang === 'python') out.push(x.name); q = q.concat(plan.preds[id] || []); } return out; })();
      if(miss.length) print('> Нет в таблице: ' + miss.join(', ') + (pyUp.length ? ' — их может добавить расчёт ' + pyUp.map(function(x){ return '«' + x + '»'; }).join(', ') + ' при запуске маршрута' : ' — при запуске останутся пустыми'), pyUp.length ? 'dim' : 'warn');
    } else if(n) print('> Подключите таблицу ко входу блока — документ сформируется для каждой строки.', 'dim');
  }
  function saveDocSoon(){ clearTimeout(DP.timer); DP.timer = setTimeout(function(){ setCode(serializeDoc()); docInfo(); var n = docNode(); if(n) refreshNode(n); }, 350); }
  function docPreview(on){
    var paper = $('paper'), btn = $('dpPreview');
    if(on === undefined) on = !DP.preview;
    if(!DP.preview) setCode(serializeDoc());
    DP.preview = on; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.classList.toggle('on', on);
    Array.prototype.forEach.call(document.querySelectorAll('#docPane .dp-edit'), function(b){ b.disabled = on; });
    if(on){
      var n = docNode(), rows = n ? upstreamRows(n) : null, html = getCode();
      var row = rows && rows[0] ? rows[0] : {}; if(!rows) docFields(html).forEach(function(k){ if(!/^(дата|сегодня)$/i.test(k)) row[k] = '«' + k + '»'; });
      paper.contentEditable = 'false'; paper.classList.add('pv'); paper.innerHTML = fillTemplate(sanitizeHtml(html), row, true);
      print('> Предпросмотр: ' + (rows && rows[0] ? 'данные первой строки таблицы' : 'вместо данных — названия полей'), 'ok');
    } else { paper.contentEditable = 'true'; paper.classList.remove('pv'); paper.innerHTML = wrapFields(sanitizeHtml(getCode())); }
  }
  function fieldMenu(btn){
    var n = docNode(), rows = n ? upstreamRows(n) : null, have = docFields(serializeDoc());
    var list = (rows && rows[0] ? Object.keys(rows[0]) : []).concat(have, ['Дата', 'Номер', 'Контрагент', 'Сумма', 'Срок', 'Ответственный']);
    list = list.filter(function(x, i){ return list.indexOf(x) === i; });
    var sel = window.getSelection(), range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var r = btn.getBoundingClientRect();
    openMenuAt([{ head:rows ? 'Поля из таблицы и шаблона' : 'Поля' }].concat(list.map(function(f){
      return { label:'{{' + f + '}}', icon:'text', act:function(){ insertField(f, range); } };
    })).concat([{ sep:true }, { label:'Своё поле…', icon:'plus', act:function(){ customField(range); } }]), r.left, r.bottom + 6);
  }
  function insertField(f, range){
    var paper = $('paper'); paper.focus();
    var sel = window.getSelection();
    if(range && paper.contains(range.commonAncestorContainer)){ sel.removeAllRanges(); sel.addRange(range); }
    document.execCommand('insertHTML', false, '<span class="fld" contenteditable="false" data-f="' + escHtml(f) + '">{{' + escHtml(f) + '}}</span>&nbsp;');
    saveDocSoon();
  }
  function customField(range){
    var bar = $('dpTools'), inp = h('input', { 'class':'input dp-new', placeholder:'Название поля и Enter', 'aria-label':'Название нового поля' });
    bar.appendChild(inp); inp.focus();
    inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); var v = inp.value.trim(); inp.remove(); if(v) insertField(v, range); } else if(e.key === 'Escape'){ inp.remove(); } });
    inp.addEventListener('blur', function(){ setTimeout(function(){ if(inp.parentNode) inp.remove(); }, 150); });
  }
  function exportDocHtml(){
    var n = docNode(), p = docPlugin(), title = n ? n.name : (p ? p.name : 'Документ');
    var html = DP.preview ? $('paper').innerHTML.replace(/<span class="fv( miss)?">([\s\S]*?)<\/span>/g, '$2') : getCode();
    download(fileBase(title, 'dokument') + '.html', paperDoc(title, '<div class="page">' + html + '</div>'), 'text/html', 'Документ сохранён (.html — откроется в Word)');
  }
