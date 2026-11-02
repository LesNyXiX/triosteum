  /* ---------- редактор документа (как Word) ---------- */
  var DE = { f:null, timer:null, range:null };
  function deWrap(html){
    // живые вставки отрисовываем заново при каждом открытии — данные всегда свежие
    var d = document.createElement('div'); d.innerHTML = sanitizeHtml(html);
    Array.prototype.forEach.call(d.querySelectorAll('.lnk'), function(x){ x.setAttribute('contenteditable', 'false'); x.innerHTML = embedHtml(lnkSpec(x)) + '<span class="lnk-tag">' + escHtml(lnkLabel(lnkSpec(x))) + '</span>'; });
    Array.prototype.forEach.call(d.querySelectorAll('.lv'), function(x){ x.setAttribute('contenteditable', 'false'); x.textContent = liveValue(x.getAttribute('data-ref')); });
    return d.innerHTML.replace(FIELD_RE, function(m, k){ return '<span class="fld" contenteditable="false" data-f="' + escHtml(k) + '">{{' + escHtml(k) + '}}</span>'; });
  }
  function deSerialize(root){
    var c = (root || $('dePaper')).cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.fld'), function(s){ s.replaceWith(document.createTextNode('{{' + s.getAttribute('data-f') + '}}')); });
    Array.prototype.forEach.call(c.querySelectorAll('.lnk'), function(x){ x.innerHTML = ''; x.removeAttribute('contenteditable'); });
    Array.prototype.forEach.call(c.querySelectorAll('.lv'), function(x){ x.textContent = '…'; x.removeAttribute('contenteditable'); });
    return c.innerHTML;
  }
  function lnkSpec(x){ return { src:x.getAttribute('data-src'), sheet:+(x.getAttribute('data-sheet') || 0), range:x.getAttribute('data-range') || '', kind:x.getAttribute('data-kind') || 'table', ctype:x.getAttribute('data-ctype') || 'bar', title:x.getAttribute('data-title') || '', name:x.getAttribute('data-name') || '' }; }
  function lnkLabel(s){ var f = ofFile(s.src); return '↻ ' + (f ? f.name : s.name || 'нет источника') + (f && f.data.sheets[s.sheet] && f.data.sheets.length > 1 ? ' · ' + f.data.sheets[s.sheet].name : '') + (s.range ? ' · ' + s.range : ''); }
  function liveValue(ref){
    calcReset();
    var m = /^(?:'([^']+)'|([^!]+))!\$?([A-Z]{1,3})\$?(\d+)$/.exec(String(ref || '').trim()); if(!m) return '#ССЫЛКА';
    var t = sheetRef({ file:null }, m[1] || m[2]); if(!t) return '#ССЫЛКА';
    var v = cellVal(t.file, t.idx, colIdx(m[3]), +m[4] - 1), cf = (t.file.data.sheets[t.idx].fmt || {})[(+m[4] - 1) + ':' + colIdx(m[3])] || {};
    return fmtNum(v, cf.nf);
  }
  function deSaveSoon(){ clearTimeout(DE.timer); DE.timer = setTimeout(deSaveNow, 400); deCount(); }
  function deSaveNow(){ clearTimeout(DE.timer); if(!DE.f || !$('dePaper') || DE.preview) return; DE.f.data.html = deSerialize(); DE.f.t = Date.now(); saveGraph(); }
  function deCount(){
    var p = $('dePaper'); if(!p) return;
    var t = p.innerText || '', w = (t.match(/[\wА-Яа-яЁё]+/g) || []).length;
    el.stLeft.textContent = 'Документ «' + DE.f.name + '» · Слов: ' + w + ' · Знаков: ' + t.replace(/\s/g, '').length;
  }
  function renderDocEd(m, f){
    DE.f = f; DE.preview = false;
    var X = function(cmd, val){ return function(){ if(DE.preview) return; deFocus(); document.execCommand(cmd, false, val || null); deSaveSoon(); }; };
    var B = function(label, icon, fn, cls){ var b = h('button', { type:'button', 'class':'rb' + (cls ? ' ' + cls : ''), title:label, 'aria-label':label, html:icon }); b.addEventListener('mousedown', function(e){ e.preventDefault(); }); b.addEventListener('click', fn); return b; };
    var S = function(label, items, fn, w){ var s = h('select', { 'class':'input rb-sel', 'aria-label':label, title:label, style:w ? 'width:' + w + 'px' : '' }); items.forEach(function(o){ s.appendChild(h('option', { value:o[0], text:o[1] })); }); s.addEventListener('change', function(){ if(s.value){ deFocus(); fn(s.value); deSaveSoon(); } s.selectedIndex = 0; }); return s; };
    var ribbon = h('div', { 'class':'ribbon', role:'toolbar', 'aria-label':'Оформление документа' }, [
      B('Отменить', SVGI('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>', 16), X('undo')), B('Повторить', SVGI('<path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>', 16), X('redo')),
      h('span', { 'class':'rsep' }),
      S('Стиль', [['', 'Стиль'], ['p', 'Обычный'], ['h1', 'Заголовок 1'], ['h2', 'Заголовок 2'], ['h3', 'Заголовок 3'], ['blockquote', 'Цитата']], function(v){ document.execCommand('formatBlock', false, v); }, 112),
      S('Шрифт', [['', 'Шрифт'], ['Times New Roman', 'Times New Roman'], ['Arial', 'Arial'], ['Georgia', 'Georgia'], ['Verdana', 'Verdana'], ['Courier New', 'Courier New']], function(v){ document.execCommand('fontName', false, v); }, 128),
      S('Размер', [['', 'Размер'], ['10', '10'], ['11', '11'], ['12', '12'], ['14', '14'], ['16', '16'], ['18', '18'], ['20', '20'], ['24', '24'], ['28', '28'], ['36', '36']], function(v){ deFontSize(v); }, 80),
      B('Жирный (Ctrl+B)', '<b>Ж</b>', X('bold')), B('Курсив (Ctrl+I)', '<i>К</i>', X('italic')), B('Подчёркнутый (Ctrl+U)', '<u>Ч</u>', X('underline')), B('Зачёркнутый', '<s>З</s>', X('strikeThrough')),
      B('Цвет текста', '<span style="border-bottom:3px solid #DC2626;font-weight:700;line-height:1">А</span>', function(e){ deColor(e.currentTarget, 'foreColor'); }),
      B('Выделение цветом', '<span style="background:#FDE047;color:#111;padding:0 3px;border-radius:2px;font-weight:700">ab</span>', function(e){ deColor(e.currentTarget, 'hiliteColor'); }),
      h('span', { 'class':'rsep' }),
      B('По левому краю', SVGI('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', 16), X('justifyLeft')), B('По центру', SVGI('<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', 16), X('justifyCenter')),
      B('По правому краю', SVGI('<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', 16), X('justifyRight')), B('По ширине', SVGI('<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>', 16), X('justifyFull')),
      B('Маркированный список', SVGI('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', 16), X('insertUnorderedList')),
      B('Нумерованный список', SVGI('<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 013 0c0 1.2-3 2-3 3.5h3"/>', 16), X('insertOrderedList')),
      B('Увеличить отступ', SVGI('<path d="M4 6h16M10 10h10M10 14h10M4 18h16M4 9l3 3-3 3"/>', 16), X('indent')), B('Уменьшить отступ', SVGI('<path d="M4 6h16M10 10h10M10 14h10M4 18h16M7 9l-3 3 3 3"/>', 16), X('outdent')),
      h('span', { 'class':'rsep' }),
      B('Вставить таблицу', SVGI('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>', 16), function(e){ deTableMenu(e.currentTarget); }),
      B('Вставить изображение', SVGI('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', 16), function(){ deImgIn.click(); }),
      B('Разрыв страницы', SVGI('<path d="M5 4v5h14V4M5 20v-5h14v5M3 12h2M8 12h2M13 12h2M18 12h3"/>', 16), function(){ deFocus(); document.execCommand('insertHTML', false, '<hr class="pb"><p><br></p>'); deSaveSoon(); }),
      h('span', { 'class':'rsep' }),
      B('Данные из таблицы (живые)', '<span class="rt">Данные из таблицы</span>', function(e){ deLinkMenu(e.currentTarget); }, 'pri2'),
      B('Поле для слияния {{…}}', '<span class="rt">{{ }} Поле</span>', function(e){ deFieldMenu(e.currentTarget); }),
      B('Слияние: документ на каждую строку таблицы', '<span class="rt">Слияние</span>', function(e){ deMergeMenu(e.currentTarget); }),
      h('span', { 'class':'grow' }),
      B('Скачать .docx', '<span class="rt">.docx</span>', function(){ deSaveNow(); exportFileAs(DE.f, 'docx'); }, 'pri')
    ]);
    m.appendChild(ribbon);
    var paper = h('div', { 'class':'paper de-paper', id:'dePaper', contenteditable:'true', spellcheck:'true', role:'textbox', 'aria-multiline':'true', 'aria-label':'Текст документа «' + f.name + '»' });
    paper.innerHTML = deWrap(f.data.html);
    m.appendChild(h('div', { 'class':'de-scroll' }, [ paper ]));
    paper.addEventListener('input', deSaveSoon);
    paper.addEventListener('keyup', deRemember); paper.addEventListener('mouseup', deRemember);
    paper.addEventListener('keydown', function(e){ if(e.key === 'Tab'){ e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); } });
    paper.addEventListener('click', function(e){ var l = e.target.closest('.lnk,.lv'); if(l) deEmbedMenu(l, e.clientX, e.clientY); });
    paper.addEventListener('paste', function(e){
      var html = e.clipboardData && e.clipboardData.getData('text/html');
      if(html){ e.preventDefault(); document.execCommand('insertHTML', false, sanitizeHtml(new DOMParser().parseFromString(html, 'text/html').body.innerHTML)); deSaveSoon(); }
    });
    OF.commit = deSaveNow;
    deCount();
    setTimeout(function(){ if(document.activeElement === document.body) paper.focus({ preventScroll:true }); }, 0);
  }
  function deRemember(){ var s = window.getSelection(); if(s && s.rangeCount && $('dePaper') && $('dePaper').contains(s.anchorNode)) DE.range = s.getRangeAt(0).cloneRange(); }
  function deFocus(){
    var p = $('dePaper'); if(!p) return; p.focus({ preventScroll:true });
    var s = window.getSelection();
    if(DE.range && p.contains(DE.range.commonAncestorContainer)){ s.removeAllRanges(); s.addRange(DE.range); }
    else if(!s.rangeCount || !p.contains(s.anchorNode)){ var r = document.createRange(); r.selectNodeContents(p); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
  }
  function deInsert(html){ deFocus(); document.execCommand('insertHTML', false, html); deRemember(); deSaveSoon(); }
  function deFontSize(pt){
    document.execCommand('fontSize', false, '7');
    Array.prototype.forEach.call($('dePaper').querySelectorAll('font[size="7"]'), function(x){ var s = document.createElement('span'); s.style.fontSize = pt + 'pt'; s.innerHTML = x.innerHTML; x.replaceWith(s); });
  }
  function deColor(btn, cmd){
    var r = btn.getBoundingClientRect(), cols = cmd === 'foreColor' ? ['#111827', '#DC2626', '#16A34A', '#2563EB', '#CA8A04', '#9333EA', '#6B7280'] : ['#FDE047', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA', 'transparent'];
    openMenuAt([{ head:cmd === 'foreColor' ? 'Цвет текста' : 'Выделение' }].concat(cols.map(function(c){ return { label:c === 'transparent' ? 'Без выделения' : c, swatch:c === 'transparent' ? '#fff' : c, act:function(){ deFocus(); document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, c); deSaveSoon(); } }; })), r.left, r.bottom + 4);
  }
  function deTableMenu(btn){
    var r = btn.getBoundingClientRect();
    openMenuAt([{ head:'Таблица' }].concat([[2, 2], [3, 3], [4, 3], [5, 4], [6, 5]].map(function(d){ return { label:d[0] + ' × ' + d[1] + ' (столбцы × строки)', icon:'grid', act:function(){
      var html = '<table class="dt"><tbody>' + Array.apply(0, Array(d[1])).map(function(x, ri){ return '<tr>' + Array.apply(0, Array(d[0])).map(function(){ return ri === 0 ? '<th><br></th>' : '<td><br></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><p><br></p>';
      deInsert(html);
    } }; })), r.left, r.bottom + 4);
  }
  var deImgIn = document.createElement('input'); deImgIn.type = 'file'; deImgIn.accept = 'image/*'; deImgIn.hidden = true; document.body.appendChild(deImgIn);
  deImgIn.addEventListener('change', function(){ var f = deImgIn.files[0]; deImgIn.value = ''; if(!f) return; shrinkImage(f, 1200).then(function(url){ (OF.imgCb || function(u){ deInsert('<img src="' + u + '" alt="" style="max-width:100%">'); })(url); OF.imgCb = null; }); });
  function shrinkImage(file, max){
    return new Promise(function(res){
      var fr = new FileReader(); fr.onload = function(){ var img = new Image(); img.onload = function(){ var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL(/png/i.test(file.type) ? 'image/png' : 'image/jpeg', 0.82)); }; img.src = fr.result; }; fr.readAsDataURL(file);
    });
  }
  function sheetFiles(){ return ofItems().filter(function(x){ return x.type === 'sheet'; }); }
  function pickSheet(btn, title, cb){
    var list = sheetFiles(), r = btn.getBoundingClientRect();
    if(!list.length){ toast('Сначала создайте таблицу — данные берутся из неё'); return; }
    openMenuAt([{ head:title }].concat(list.map(function(sf){
      return sf.data.sheets.length > 1 ? { label:sf.name, swatch:FT.sheet.color, sub:sf.data.sheets.map(function(s, i){ return { label:s.name, icon:'grid', act:function(){ cb(sf, i); } }; }) }
        : { label:sf.name, swatch:FT.sheet.color, act:function(){ cb(sf, 0); } };
    })), r.left, r.bottom + 4);
  }
  function deLinkMenu(btn){
    pickSheet(btn, 'Из какой таблицы', function(sf, i){
      var sh = sf.data.sheets[i], g = usedRange(sh), rg = rangeStr(g);
      var r = btn.getBoundingClientRect();
      openMenuAt([{ head:'«' + sf.name + '» · ' + sh.name + ' · ' + rg },
        { label:'Таблица целиком (живая)', icon:'grid', act:function(){ deInsertLink(sf, i, rg, 'table'); } },
        { label:'Диаграмма: гистограмма', icon:'grid', act:function(){ deInsertLink(sf, i, rg, 'chart', 'bar'); } },
        { label:'Диаграмма: график', icon:'redo', act:function(){ deInsertLink(sf, i, rg, 'chart', 'line'); } },
        { label:'Диаграмма: круговая', icon:'zoom', act:function(){ deInsertLink(sf, i, rg, 'chart', 'pie'); } },
        { label:'Значение одной ячейки…', icon:'text', act:function(){ deCellPick(sf, i); } }
      ], r.left, r.bottom + 4);
    });
  }
  function deInsertLink(sf, i, rg, kind, ctype){
    var spec = { src:sf.id, sheet:i, range:rg, kind:kind, ctype:ctype || '', name:sf.name };
    deInsert('<div class="lnk" contenteditable="false" data-src="' + sf.id + '" data-sheet="' + i + '" data-range="' + rg + '" data-kind="' + kind + '" data-ctype="' + (ctype || '') + '" data-name="' + escHtml(sf.name) + '">' + embedHtml(spec) + '<span class="lnk-tag">' + escHtml(lnkLabel(spec)) + '</span></div><p><br></p>');
    toast('Вставлено. Данные обновляются сами при изменении таблицы «' + sf.name + '»');
  }
  function deCellPick(sf, i){
    var bar = document.querySelector('#ofMain .ribbon'), inp = h('input', { 'class':'input rb-sel', style:'width:130px', placeholder:'Ячейка, напр. C7', 'aria-label':'Адрес ячейки' });
    bar.insertBefore(inp, bar.querySelector('.grow')); inp.focus();
    inp.addEventListener('keydown', function(e){
      e.stopPropagation();
      if(e.key === 'Enter'){ e.preventDefault(); var g = parseRange(inp.value); inp.remove(); if(!g){ toast('Нужен адрес вида C7'); return; }
        var ref = "'" + sf.name + (sf.data.sheets.length > 1 ? '/' + sf.data.sheets[i].name : '') + "'!" + colName(g.c0) + (g.r0 + 1);
        deInsert('<span class="lv" contenteditable="false" data-ref="' + escHtml(ref) + '">' + escHtml(liveValue(ref)) + '</span>&nbsp;'); }
      else if(e.key === 'Escape') inp.remove();
    });
    inp.addEventListener('blur', function(){ setTimeout(function(){ if(inp.parentNode) inp.remove(); }, 200); });
  }
  function deEmbedMenu(x, cx, cy){
    var isV = x.classList.contains('lv'), s = isV ? null : lnkSpec(x), src = isV ? null : ofFile(s.src);
    openMenuAt([{ head:isV ? 'Живое значение ' + x.getAttribute('data-ref') : lnkLabel(s) },
      !isV && src ? { label:'Открыть таблицу-источник', icon:'file', act:function(){ ofOpen(src.id); } } : null,
      !isV ? { label:'Показать как таблицу', icon:'grid', act:function(){ x.setAttribute('data-kind', 'table'); deRefresh(); } } : null,
      !isV ? { label:'Показать как диаграмму', icon:'grid', sub:[['bar', 'Гистограмма'], ['line', 'График'], ['pie', 'Круговая']].map(function(t){ return { label:t[1], icon:'grid', act:function(){ x.setAttribute('data-kind', 'chart'); x.setAttribute('data-ctype', t[0]); deRefresh(); } }; }) } : null,
      { label:'Обновить данные', icon:'redo', act:deRefresh },
      { label:'Превратить в обычный текст (отвязать)', icon:'edit', act:function(){ var d = document.createElement('div'); d.innerHTML = isV ? escHtml(x.textContent) : embedHtml(s); x.replaceWith.apply(x, Array.prototype.slice.call(d.childNodes)); deSaveSoon(); } },
      { label:'Удалить', icon:'trash', danger:true, act:function(){ x.remove(); deSaveSoon(); } }
    ], cx, cy);
  }
  function deRefresh(){ var p = $('dePaper'); if(!p) return; DE.f.data.html = deSerialize(); p.innerHTML = deWrap(DE.f.data.html); saveGraph(); }
  function deFieldMenu(btn){
    var r = btn.getBoundingClientRect(), heads = [];
    sheetFiles().forEach(function(sf){ (sf.data.sheets[0].rows[0] || []).forEach(function(x){ x = String(x).trim(); if(x && heads.indexOf(x) < 0 && x.charAt(0) !== '=') heads.push(x); }); });
    var list = heads.concat(['Дата', 'Номер', 'Контрагент', 'Сумма']).filter(function(x, i, a){ return a.indexOf(x) === i; }).slice(0, 24);
    openMenuAt([{ head:'Поле заполнится из столбца таблицы при слиянии' }].concat(list.map(function(x){ return { label:'{{' + x + '}}', icon:'text', act:function(){ deInsert('<span class="fld" contenteditable="false" data-f="' + escHtml(x) + '">{{' + escHtml(x) + '}}</span>&nbsp;'); } }; })), r.left, r.bottom + 4);
  }
  function deMergeMenu(btn){
    deSaveNow();
    var fl = docFields(DE.f.data.html);
    if(!fl.length){ toast('Сначала вставьте поля {{…}} кнопкой «Поле»'); return; }
    pickSheet(btn, 'Строки из какой таблицы', function(sf, i){ deMerge(sf, i); });
  }
  function sheetRows(sf, i){ calcReset(); var vals = sheetValues(sf, i), head = (vals[0] || []).map(function(x, k){ return String(x || colName(k)).trim(); }); return vals.slice(1).filter(function(r){ return r.some(function(x){ return String(x).trim() !== ''; }) && !/^итог/i.test(String(r[0])); }).map(function(r){ var o = {}; head.forEach(function(k, j){ o[k] = r[j]; }); return o; }); }
  function deMerge(sf, i){
    var rows = sheetRows(sf, i); if(!rows.length){ toast('В таблице нет строк'); return; }
    var dir = newFile('folder', 'Слияние — ' + DE.f.name, null, DE.f.parent, { silent:true });
    var tpl = DE.f.data.html;
    rows.forEach(function(r, k){ var nm = DE.f.name + ' — ' + (lookup(r, 'Номер') || lookup(r, Object.keys(r)[0]) || (k + 1)); newFile('doc', String(nm).slice(0, 80), { html:fillTemplate(tpl, r) }, dir.id, { silent:true }); });
    saveGraph(); OF.dir = dir.id; ofSetTab('desk');
    toast('Слияние: создано документов — ' + rows.length + ' (папка «' + dir.name + '»)');
  }
  function dePreview(){
    var p = $('dePaper'), btn = document.querySelector('.pv-btn'); if(!p) return;
    if(DE.preview){ DE.preview = false; p.contentEditable = 'true'; p.classList.remove('pv'); p.innerHTML = deWrap(DE.f.data.html); if(btn) btn.classList.remove('on'); $('topRun').textContent = 'Предпросмотр'; return; }
    deSaveNow();
    var fl = docFields(DE.f.data.html), src = sheetFiles().filter(function(sf){ var h0 = (sf.data.sheets[0].rows[0] || []).map(String); return fl.some(function(x){ return h0.indexOf(x) >= 0; }); })[0];
    var row = src ? sheetRows(src, 0)[0] || {} : {};
    DE.preview = true; p.contentEditable = 'false'; p.classList.add('pv'); if(btn) btn.classList.add('on'); $('topRun').textContent = 'Вернуться к правке';
    var d = document.createElement('div'); d.innerHTML = deWrap(DE.f.data.html);
    Array.prototype.forEach.call(d.querySelectorAll('.fld'), function(s){ var v = lookup(row, s.getAttribute('data-f')); if(v === undefined && /^(дата|сегодня)$/i.test(s.getAttribute('data-f'))) v = new Date().toLocaleDateString('ru-RU'); var sp = document.createElement('span'); sp.className = 'fv' + (v === undefined ? ' miss' : ''); sp.textContent = v === undefined ? '{{' + s.getAttribute('data-f') + '}}' : fmtCell(num(v)); s.replaceWith(sp); });
    p.innerHTML = d.innerHTML;
    toast(src ? 'Предпросмотр: первая строка таблицы «' + src.name + '»' : 'Нет таблицы со столбцами, как у полей — показаны пустые поля');
  }