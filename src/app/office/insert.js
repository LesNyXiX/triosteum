  /* =====================================================================
     СОВМЕЩЕНИЕ ВСЕГО СО ВСЕМ: любой файл можно вставить в любой другой.
     Картинки — в таблицы (поверх ячеек, как в Excel), таблицы и тексты —
     в изображения и векторные рисунки, рисунки — в документы и слайды,
     блоки и код — в документы. Если способов несколько — окно «Как вставить?».
     Вставка помнит источник: на схеме файлов это связь, её можно открепить.
     ===================================================================== */
  function svgEsc(s){ return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function svgUrl(svg){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function svgToPng(svg, w, hh, cb){
    var im = new Image();
    im.onload = function(){ var k = Math.min(2, 2400 / Math.max(w, hh)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k)); var g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/png'), w, hh); };
    im.onerror = function(){ cb(null); };
    im.src = svgUrl(svg);
  }
  // таблица → SVG (чёткая, векторная)
  function rowsSvg(aoa, title){
    aoa = (aoa || []).slice(0, 60).map(function(r){ return (r || []).slice(0, 12).map(function(v){ return typeof v === 'number' ? fmtCell(v) : String(v === null || v === undefined ? '' : v); }); });
    if(!aoa.length) aoa = [['(пусто)']];
    var cols = Math.max.apply(0, aoa.map(function(r){ return r.length; })), cw = [];
    for(var c = 0; c < cols; c++) cw.push(Math.min(260, Math.max(56, 14 + 7.2 * Math.max.apply(0, aoa.map(function(r){ return String(r[c] || '').length; })))));
    var rh = 28, top = title ? 40 : 8, W = 16 + cw.reduce(function(s, x){ return s + x; }, 0), H = top + rh * aoa.length + 10, o = [];
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><rect width="100%" height="100%" fill="#fff"/>');
    if(title) o.push('<text x="8" y="26" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#111">' + svgEsc(title) + '</text>');
    aoa.forEach(function(r, ri){
      var x = 8, y = top + ri * rh;
      if(ri === 0) o.push('<rect x="8" y="' + y + '" width="' + (W - 16) + '" height="' + rh + '" fill="#EEF2F7"/>');
      for(var c2 = 0; c2 < cols; c2++){
        var v = r[c2] || '', num = /^-?[\d\s]+([.,]\d+)?$/.test(v.trim()) && v.trim() !== '';
        o.push('<rect x="' + x + '" y="' + y + '" width="' + cw[c2] + '" height="' + rh + '" fill="none" stroke="#CBD5E1"/>');
        var maxCh = Math.floor((cw[c2] - 10) / 7.2), t = v.length > maxCh ? v.slice(0, Math.max(1, maxCh - 1)) + '…' : v;
        o.push('<text x="' + (num ? x + cw[c2] - 6 : x + 6) + '" y="' + (y + 18.5) + '" text-anchor="' + (num ? 'end' : 'start') + '" font-family="Arial,sans-serif" font-size="12.5"' + (ri === 0 ? ' font-weight="700"' : '') + ' fill="#111">' + svgEsc(t) + '</text>');
        x += cw[c2];
      }
    });
    o.push('</svg>');
    return { svg:o.join(''), w:W, h:H };
  }
  // текст → SVG с переносом строк
  function textSvg(title, lines, width){
    var W = width || 720, cpl = Math.floor((W - 48) / 7.6), out = [];
    (lines || []).forEach(function(l){ var s = String(l || ''), head = /^#/.test(s); s = s.replace(/^#+\s*/, ''); if(!s){ out.push({ t:'', h:false }); return; } while(s.length > cpl){ var cut = s.lastIndexOf(' ', cpl); if(cut < cpl * 0.5) cut = cpl; out.push({ t:s.slice(0, cut), h:head }); s = s.slice(cut).replace(/^\s+/, ''); } out.push({ t:s, h:head }); });
    out = out.slice(0, 80);
    var H = (title ? 56 : 24) + out.length * 20 + 16, o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><rect width="100%" height="100%" fill="#fff"/>'];
    if(title) o.push('<text x="24" y="36" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#111">' + svgEsc(title) + '</text>');
    out.forEach(function(l, i){ o.push('<text x="24" y="' + ((title ? 64 : 32) + i * 20) + '" font-family="Arial,sans-serif" font-size="' + (l.h ? 15 : 13.5) + '"' + (l.h ? ' font-weight="700"' : '') + ' fill="#222">' + svgEsc(l.t) + '</text>'); });
    o.push('</svg>');
    return { svg:o.join(''), w:W, h:H };
  }
  function htmlLines(html){
    var d = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html'), out = [];
    d.body.querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote,tr').forEach(function(x){
      if(x.closest('li') && x.tagName !== 'LI') return;
      if(x.tagName === 'TR'){ out.push(Array.prototype.map.call(x.children, function(c){ return c.textContent.trim(); }).join('   ')); return; }
      if(x.closest('tr')) return;
      var t = x.innerText !== undefined && x.innerText !== '' ? x.innerText : x.textContent; t = String(t || '').trim();
      if(x.tagName === 'PRE'){ t.split('\n').forEach(function(l){ out.push(l); }); return; }
      out.push((/^H\d$/.test(x.tagName) ? '# ' : (x.tagName === 'LI' ? '• ' : '')) + t);
    });
    if(!out.length) out = String(d.body.textContent || '').split('\n');
    return out;
  }
  // содержимое любого файла: строки текста
  function fileLines(f){
    if(f.type === 'doc') return htmlLines(f.data.html);
    if(f.type === 'slides') return (f.data.slides || []).map(function(s, i){ return '# ' + (i + 1) + '. ' + (s.title || '') + (s.body ? '\n' + s.body : ''); }).join('\n').split('\n');
    if(f.type === 'form') return [f.data.desc || ''].concat((f.data.fields || []).map(function(q){ return '• ' + q.label + (q.required ? ' *' : '') + (q.options ? ' (' + q.options.join(', ') + ')' : ''); }));
    if(f.type === 'sheet') return fileRows(f).map(function(r){ return r.join('\t'); });
    return [f.name + ' — ' + (f.data.w || 0) + '×' + (f.data.h || 0)];
  }
  // содержимое любого файла: таблица значений
  function fileRows(f){
    if(f.type === 'sheet'){ var sh = f.data.sheets[0], g = usedRange(sh); return rangeValues(f, 0, g).map(function(r){ return r.map(function(v){ return v === null || v === undefined ? '' : v; }); }); }
    if(f.type === 'form') return [['Вопрос', 'Тип', 'Обязательный', 'Варианты']].concat((f.data.fields || []).map(function(q){ return [q.label, q.type, q.required ? 'да' : 'нет', (q.options || []).join(', ')]; }));
    if(f.type === 'slides') return [['№', 'Заголовок', 'Текст']].concat((f.data.slides || []).map(function(s, i){ return [i + 1, s.title || '', s.body || '']; }));
    if(f.type === 'doc'){
      var d = new DOMParser().parseFromString('<body>' + (f.data.html || '') + '</body>', 'text/html'), t = d.body.querySelector('table');
      if(t) return Array.prototype.map.call(t.querySelectorAll('tr'), function(tr){ return Array.prototype.map.call(tr.children, function(c){ var v = c.textContent.trim(), n = num(v); return typeof n === 'number' ? n : v; }); });
      return [['Текст']].concat(htmlLines(f.data.html).filter(function(l){ return l.trim(); }).map(function(l){ return [l.replace(/^#\s*/, '')]; }));
    }
    return [['Файл', 'Тип', 'Ширина', 'Высота'], [f.name, FT[f.type].name, f.data.w || 0, f.data.h || 0]];
  }
  // как файл выглядит: SVG (для векторных вставок) и PNG (для картинок)
  function fileSvg(f){
    if(f.type === 'vector') return { svg:vecSvgString(f, false), w:f.data.w, h:f.data.h };
    if(f.type === 'image') return { svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f.data.w + ' ' + f.data.h + '" width="' + f.data.w + '" height="' + f.data.h + '"><image href="' + svgEsc(f.data.prev || f.data.thumb || '') + '" width="100%" height="100%"/></svg>', w:f.data.w, h:f.data.h };
    if(f.type === 'sheet') return rowsSvg(fileRows(f), f.name);
    return textSvg(f.name, fileLines(f));
  }
  function filePng(f, cb){
    if(f.type === 'image' && (f.data.prev || f.data.thumb)){ cb(f.data.prev || f.data.thumb, f.data.w, f.data.h); return; }
    var s = fileSvg(f); svgToPng(s.svg, s.w, s.h, function(u){ if(!u){ toast('Не удалось отрисовать «' + f.name + '»'); return; } cb(u, s.w, s.h); });
  }
  function fileHtmlStatic(f){
    if(f.type === 'doc') return f.data.html || '';
    if(f.type === 'sheet') return '<table style="border-collapse:collapse" border="1" cellpadding="5">' + fileRows(f).map(function(r, i){ return '<tr>' + r.map(function(v){ var t = i === 0 ? 'th' : 'td'; return '<' + t + (typeof v === 'number' ? ' style="text-align:right"' : '') + '>' + escHtml(typeof v === 'number' ? fmtCell(v) : v) + '</' + t + '>'; }).join('') + '</tr>'; }).join('') + '</table>';
    return fileLines(f).map(function(l){ return /^#\s/.test(l) ? '<h2>' + escHtml(l.slice(2)) + '</h2>' : '<p>' + escHtml(l) + '</p>'; }).join('');
  }
  function fitBox(w, hh, max){ var k = Math.min(1, max / Math.max(w || 1, hh || 1)); return { w:Math.round((w || max) * k), h:Math.round((hh || max) * k) }; }
  function uid(p){ return (p || 'o') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  /* ---------- вставка в конкретный файл ---------- */
  function putImage(b, url, w, hh, from, name){
    if(b.type === 'sheet'){
      var sh = b.data.sheets[b === (typeof SG !== 'undefined' && SG.f) ? SG.idx : 0], sz = fitBox(w, hh, 420);
      (sh.images = sh.images || []).push({ id:uid('im'), src:url, x:60 + (sh.images.length % 5) * 24, y:40 + (sh.images.length % 5) * 24, w:sz.w, h:sz.h, from:from || null, name:name || '' });
    } else if(b.type === 'doc'){
      b.data.html = (b.data.html || '') + '<p data-from="' + (from || '') + '"><img src="' + url + '" alt="' + escHtml(name || '') + '" style="max-width:100%"></p><p><br></p>';
    } else if(b.type === 'slides'){
      b.data.slides.push({ layout:'media', title:name || '', body:'', img:url, from:from || null });
    } else if(b.type === 'image'){
      var im = new Image();
      im.onload = function(){ var d = b.data, c = ieCanvas(d.w, d.h), k = Math.min(1, d.w * 0.9 / im.width, d.h * 0.9 / im.height); c.getContext('2d').drawImage(im, (d.w - im.width * k) / 2, (d.h - im.height * k) / 2, im.width * k, im.height * k);
        if(IE.f === b && $('ieView') && !from){ iePush('Вставка'); ieNewLayer(name || 'Вставка', c); ieAfterStruct(); if(insCb){ var cb0 = insCb; insCb = null; cb0(b); } return; }
        d.layers.push({ id:'l' + uid(''), name:name || 'Вставка', vis:true, op:1, blend:'source-over', src:c.toDataURL('image/png'), from:from || null }); if(IE.f === b) IE.f = null; insDone(b); };
      im.src = url; return;
    } else if(b.type === 'vector'){
      var sz2 = fitBox(w, hh, Math.min(b.data.w, b.data.h) * 0.8);
      var it2 = { id:'v' + uid(''), t:'image', data:url, name:name || 'Картинка', x:Math.round((b.data.w - sz2.w) / 2), y:Math.round((b.data.h - sz2.h) / 2), w:sz2.w, h:sz2.h, r:0, op:1, from:from || null };
      if(VE.f === b && $('veView')){ vePush('Вставка'); veItems().push(it2); VE.sel = [it2.id]; veChanged(); if(insCb){ var cb1 = insCb; insCb = null; cb1(b); } return; }
      (b.data.items = b.data.items || []).push(it2);
      if(VE.f === b) VE.f = null;
    } else if(b.type === 'form'){
      b.data.cover = url;
    }
    insDone(b);
  }
  function putSvg(b, s, from, name){
    var san = veSanitizeSvg(s.svg) || { vb:'0 0 ' + s.w + ' ' + s.h, markup:'' }, sz = fitBox(s.w, s.h, Math.min(b.data.w, b.data.h) * 0.85);
    var it3 = { id:'v' + uid(''), t:'svg', vb:san.vb, markup:san.markup, name:name || 'Вставка', x:Math.round((b.data.w - sz.w) / 2), y:Math.round((b.data.h - sz.h) / 2), w:sz.w, h:sz.h, r:0, op:1, from:from || null };
    if(VE.f === b && $('veView')){ vePush('Вставка'); veItems().push(it3); VE.sel = [it3.id]; veChanged(); if(insCb){ var cb2 = insCb; insCb = null; cb2(b); } return; }
    (b.data.items = b.data.items || []).push(it3);
    if(VE.f === b) VE.f = null;
    insDone(b);
  }
  function putRows(b, rows, from, name){
    rows = rows.map(function(r){ return r.map(function(v){ return v === null || v === undefined ? '' : String(v); }); });
    if(b.type === 'sheet'){
      var nm = String(name || 'Вставка').slice(0, 28).replace(/[!'\/]/g, ''), base = nm, k = 2; while(b.data.sheets.some(function(s){ return s.name === nm; })) nm = base + ' ' + (k++);
      b.data.sheets.push({ name:nm, rows:rows.length ? rows : [['']], fmt:{ '0:0':{ b:1 } }, widths:{}, charts:[], from:from || null });
    } else if(b.type === 'form'){
      var head = rows[0] || [];
      head.filter(function(x){ return String(x).trim(); }).forEach(function(lb, i){ b.data.fields.push({ id:'q' + uid(''), label:lb, type:'text', required:false, from:from || null }); });
      b.data.from = from || b.data.from || null;
    } else if(b.type === 'doc'){
      b.data.html = (b.data.html || '') + '<div data-from="' + (from || '') + '"><table style="border-collapse:collapse" border="1" cellpadding="5">' + rows.map(function(r, i){ return '<tr>' + r.map(function(v){ var t = i === 0 ? 'th' : 'td'; return '<' + t + '>' + escHtml(v) + '</' + t + '>'; }).join('') + '</tr>'; }).join('') + '</table></div><p><br></p>';
    } else if(b.type === 'slides'){
      b.data.slides.push({ layout:'title', title:name || 'Данные', body:rows.slice(0, 8).map(function(r){ return r.join(' · '); }).join('\n'), from:from || null });
    }
    insDone(b);
  }
  function putHtml(b, html, from){
    if(b.type === 'doc'){ b.data.html = (b.data.html || '') + '<div data-from="' + (from || '') + '">' + sanitizeHtml(html) + '</div><p><br></p>'; insDone(b); return; }
    if(b.type === 'slides'){ var ls = htmlLines(html).filter(function(l){ return l.trim(); }); b.data.slides.push({ layout:'title', title:(ls[0] || '').replace(/^#\s*/, ''), body:ls.slice(1, 9).join('\n').replace(/^#\s*/gm, ''), from:from || null }); insDone(b); return; }
  }
  var insCb = null;
  function insDone(b){ b.t = Date.now(); if(typeof calcReset === 'function') calcReset(); saveGraph(); if(insCb){ var cb = insCb; insCb = null; cb(b); } else ofRender(); }

  /* ---------- способы вставить файл A в файл B ---------- */
  function insertOptions(a, b){
    var o = [], IC = HOW_IC, nm = a.name;
    if(b.type === 'sheet'){
      o.push({ label:'Картинкой поверх ячеек', desc:'Как в Excel: двигается и меняет размер, ячейки остаются', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
      if(a.type !== 'image' && a.type !== 'vector') o.push({ label:'Данными на новый лист', desc:'Содержимое «' + nm + '» как таблица значений', ic:IC.table, act:function(){ putRows(b, fileRows(a), a.id, nm); } });
    }
    if(b.type === 'doc'){
      if(a.type !== 'image' && a.type !== 'vector') o.push({ label:a.type === 'sheet' ? 'Таблицей в конец документа' : 'Текстом в конец документа', desc:'Можно править как обычный текст', ic:a.type === 'sheet' ? IC.table : IC.doc, act:function(){ putHtml(b, fileHtmlStatic(a), a.id); } });
      o.push({ label:'Картинкой в конец документа', desc:'Снимок «' + nm + '»', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
    }
    if(b.type === 'slides'){
      o.push({ label:'Новый слайд с картинкой', desc:'Снимок «' + nm + '» на отдельном слайде', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
      if(a.type === 'doc') o.push({ label:'Новый слайд с текстом', desc:'Заголовок и первые абзацы документа', ic:IC.doc, act:function(){ putHtml(b, a.data.html, a.id); } });
      if(a.type === 'sheet' || a.type === 'form') o.push({ label:'Новый слайд с данными', desc:'Первые строки — текстом', ic:IC.table, act:function(){ putRows(b, fileRows(a), a.id, nm); } });
    }
    if(b.type === 'image') o.push({ label:'Новым слоем', desc:'«' + nm + '» станет отдельным слоем — его можно двигать, менять и стирать', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
    if(b.type === 'vector'){
      if(a.type !== 'image') o.push({ label:'Векторным объектом', desc:'Чёткий при любом масштабе: ' + (a.type === 'sheet' ? 'таблица' : a.type === 'vector' ? 'рисунок' : 'текст') + ' как группа фигур', ic:IC.vector, act:function(){ putSvg(b, fileSvg(a), a.id, nm); } });
      o.push({ label:'Картинкой', desc:'Снимок «' + nm + '»', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
    }
    if(b.type === 'form'){
      if(a.type !== 'image' && a.type !== 'vector') o.push({ label:'Вопросы из заголовков', desc:'Каждый столбец / строка заголовка станет вопросом формы', ic:IC.table, act:function(){ putRows(b, fileRows(a), a.id, nm); } });
      o.push({ label:'Обложкой формы', desc:'Снимок «' + nm + '» над вопросами', ic:IC.image, act:function(){ filePng(a, function(u, w, hh){ putImage(b, u, w, hh, a.id, nm); }); } });
    }
    return o;
  }
  // перетаскивание файла прямо на открытый редактор / в другой файл
  function insertFileInto(a, b, cb){
    var opts = insertOptions(a, b);
    if(!opts.length){ toast('«' + a.name + '» — этот файл уже здесь'); return; }
    if(cb) opts.forEach(function(o){ var f = o.act; o.act = function(){ insCb = cb; f(); }; });
    if(opts.length === 1){ opts[0].act(); return; }
    askHow('Как вставить «' + a.name + '» в «' + b.name + '»?', FT[a.type].name + ' → ' + FT[b.type].name.toLowerCase(), opts);
  }

  /* ---------- вставка из буфера обмена и перетаскивание в офисе ---------- */
  function curFile(){ return typeof OF !== 'undefined' ? ofFile(OF.tab) : null; }
  function dataUrlSize(url, cb){ var im = new Image(); im.onload = function(){ cb(im.width, im.height); }; im.onerror = function(){ cb(400, 300); }; im.src = url; }
  function officePasteImage(file){
    readDataUrl(file, function(url){
      var f = curFile(), nm = baseName(file.name || 'Картинка') || 'Картинка';
      dataUrlSize(url, function(w, hh){
        if(f && f.type === 'image'){ insCb = function(){ ofRender(); }; putImage(f, url, w, hh, null, nm); toast('Картинка вставлена новым слоем'); return; }
        if(f && f.type === 'vector'){ insCb = function(){ ofRender(); }; putImage(f, url, w, hh, null, nm); toast('Картинка вставлена на холст'); return; }
        if(f && f.type === 'sheet'){ insCb = function(){ ofRender(); }; putImage(f, url, w, hh, null, nm); toast('Картинка поверх ячеек — потяните, чтобы переместить'); return; }
        if(f && f.type === 'slides'){ insCb = function(){ ofRender(); }; putImage(f, url, w, hh, null, nm); toast('Слайд с картинкой добавлен'); return; }
        if(f && f.type === 'form'){ insCb = function(){ ofRender(); }; putImage(f, url, w, hh, null, nm); toast('Обложка формы обновлена'); return; }
        var opts = ofTypes().indexOf('image') >= 0 ? [{ label:'Новым файлом-изображением', desc:'Откроется в редакторе изображений', ic:HOW_IC.image, act:function(){ importOfficeFile(file.name ? file : new File([file], 'Картинка.png', { type:file.type })); } }] : [];
        if(ofTypes().indexOf('vector') >= 0) opts.push({ label:'В новый векторный рисунок', desc:'Картинка на холсте, вокруг можно рисовать', ic:HOW_IC.vector, act:function(){ var v = newFile('vector', nm, { w:w, h:hh, bg:'transparent', items:[] }, undefined, { silent:true }); insCb = function(){ ofOpen(v.id); }; putImage(v, url, w, hh, null, nm); } });
        opts.push({ label:'В новый документ', desc:'Документ с этой картинкой', ic:HOW_IC.doc, act:function(){ var d = newFile('doc', nm, { html:'<h1>' + escHtml(nm) + '</h1>' }, undefined, { silent:true }); insCb = function(){ ofOpen(d.id); }; putImage(d, url, w, hh, null, nm); } });
        opts.push({ label:'В новую таблицу', desc:'Картинка поверх ячеек', ic:HOW_IC.table, act:function(){ var s = newFile('sheet', nm, null, undefined, { silent:true }); insCb = function(){ ofOpen(s.id); }; putImage(s, url, w, hh, null, nm); } });
        askHow('Как вставить картинку?', file.name || 'Изображение из буфера обмена', opts);
      });
    });
  }
  function officePasteText(txt, html){
    var f = curFile(), rows = tsvRows(txt), lang = guessCodeLang(txt), nm = txt.trim().split('\n')[0].slice(0, 40) || 'Вставка';
    if(f && f.type === 'vector'){
      if(/^\s*<svg[\s>]/i.test(txt)){ var s = veSanitizeSvg(txt); if(s){ insCb = function(){ ofRender(); }; putSvg(f, { svg:txt, w:s.w || 400, h:s.h || 300 }, null, 'SVG'); return; } }
      if(VE.f === f && $('veView')) vePush('Вставка текста');
      (f.data.items = f.data.items || []).push({ id:'v' + uid(''), t:'text', text:txt.slice(0, 2000), x:60, y:60, w:Math.min(f.data.w - 120, 600), h:60, r:0, op:1, fill:'#0F172A', stroke:'none', sw:0, fs:32, ff:VE_FONTS[0], fw:false, name:'Текст' });
      if(VE.f === f && $('veView')){ VE.sel = [f.data.items[f.data.items.length - 1].id]; veChanged(); } else { saveGraph(); ofRender(); } toast('Текст вставлен на холст'); return;
    }
    if(f && f.type === 'image'){
      var s2 = textSvg('', txt.split('\n'), Math.min(1000, f.data.w));
      svgToPng(s2.svg.replace('<rect width="100%" height="100%" fill="#fff"/>', ''), s2.w, s2.h, function(u){ if(!u) return; insCb = function(){ ofRender(); }; putImage(f, u, s2.w, s2.h, null, 'Текст'); toast('Текст вставлен новым слоем'); });
      return;
    }
    if(f && f.type === 'slides'){ f.data.slides.push({ layout:'title', title:nm, body:txt.split('\n').slice(1, 10).join('\n') }); saveGraph(); ofRender(); toast('Слайд из текста добавлен'); return; }
    if(f && f.type === 'form'){ txt.split('\n').filter(function(l){ return l.trim(); }).slice(0, 30).forEach(function(l){ f.data.fields.push({ id:'q' + uid(''), label:l.trim().slice(0, 200), type:'text', required:false }); }); saveGraph(); ofRender(); toast('Вопросы добавлены из текста'); return; }
    var opts = [];
    if(rows) opts.push({ label:'Новой таблицей', desc:rows.length + ' строк × ' + rows[0].length + ' столбцов', ic:HOW_IC.table, act:function(){ newFile('sheet', 'Таблица из буфера', { sheets:[{ name:'Лист1', rows:rows, fmt:{ '0:0':{ b:1 } }, widths:{}, charts:[] }] }); } });
    if(lang && typeof OF !== 'undefined' && document.querySelector('.otab[data-tab="auto"]') && !document.querySelector('.otab[data-tab="auto"]').hidden) opts.push({ label:'Блоком кода на доску «Автоматизация»', desc:shortName(langById(lang)) + ' — выполнится вместе с маршрутом', ic:HOW_IC.code, act:function(){ ofSetTab('auto'); var c = viewCenter(), n = addNode(lang, shortName(langById(lang)) + ' из буфера', c.x - NW / 2, c.y - NH / 2); n.codes[lang] = txt; if(!nativeLang(lang)){ n.env = langHomeEnv(lang); n.colors = colorsOf(n); } saveGraph(); renderGraph(); } });
    opts.push({ label:lang ? 'Новым документом с кодом' : 'Новым документом', desc:lang ? 'Код в моноширинном блоке' : 'Текст с абзацами', ic:HOW_IC.doc, act:function(){ newFile('doc', nm, { html:html && !lang ? sanitizeHtml(html) : (lang ? hlInline(txt, lang) : txt.split(/\n{2,}/).map(function(p){ return '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>'; }).join('')) }); } });
    if(OF.tab === 'map') opts.push({ label:'Заметкой на схеме', desc:'Подпись рядом с файлами', ic:HOW_IC.note, act:function(){ fmAddNote(txt, null); } });
    if(ofTypes().indexOf('vector') >= 0) opts.push({ label:'Текстом в новый векторный рисунок', ic:HOW_IC.vector, act:function(){ var v = newFile('vector', nm, null, undefined, { silent:true }); VE.f = null; ofOpen(v.id); officePasteText(txt); } });
    if(opts.length === 1){ opts[0].act(); return; }
    askHow('Как вставить?', txt.length > 90 ? txt.slice(0, 90).replace(/\s+/g, ' ') + '…' : txt.replace(/\s+/g, ' '), opts);
  }
  // блоки с доски (скопированы в любом пространстве) → в офис
  function officePasteBlocks(mark){
    var nodes = (mark.portable || mark).nodes || [];
    if(!nodes.length){ toast('В буфере нет блоков'); return; }
    var f = curFile(), opts = [];
    var autoTab = document.querySelector('.otab[data-tab="auto"]');
    if(autoTab && !autoTab.hidden) opts.push({ label:'На доску «Автоматизация»', desc:'Блоки сохранят код и связи и будут компилироваться вместе с маршрутом', ic:HOW_IC.block, act:function(){ ofSetTab('auto'); clip = mark; pasteClip(); } });
    nodes.forEach(function(n){
      if(n.kind === 'hub') return;
      var code = (n.codes || {})[n.lang] || '', l = langById(n.lang);
      if(n.lang === 'sheet'){ var rows = []; try{ rows = JSON.parse(code).rows || []; }catch(e){}
        opts.push({ label:'«' + n.name + '» — новой таблицей', ic:HOW_IC.table, act:function(){ newFile('sheet', n.name, { sheets:[{ name:'Лист1', rows:rows.length ? rows : [['']], fmt:{ '0:0':{ b:1 } }, widths:{}, charts:[] }] }); } });
        if(f && f.type !== 'sheet') opts.push({ label:'«' + n.name + '» — в «' + f.name + '»', ic:HOW_IC.table, act:function(){ insCb = function(){ ofRender(); }; putRows(f, rows, null, n.name); } });
      } else if(n.lang === 'doc'){
        opts.push({ label:'«' + n.name + '» — новым документом', ic:HOW_IC.doc, act:function(){ newFile('doc', n.name, { html:sanitizeHtml(code) }); } });
        if(f && f.type === 'doc') opts.push({ label:'«' + n.name + '» — в конец «' + f.name + '»', ic:HOW_IC.doc, act:function(){ insCb = function(){ ofRender(); }; putHtml(f, code, null); } });
      } else {
        var lab = l ? shortName(l) : n.lang, pre = '<p><b>' + escHtml(n.name) + '</b> · ' + escHtml(lab) + '</p>' + hlInline(code, n.lang);
        if(f && f.type === 'doc') opts.push({ label:'Код «' + n.name + '» — в «' + f.name + '»', desc:lab + ' — моноширинным блоком', ic:HOW_IC.code, act:function(){ insCb = function(){ ofRender(); }; putHtml(f, pre, null); } });
        opts.push({ label:'Код «' + n.name + '» — новым документом', desc:lab, ic:HOW_IC.code, act:function(){ newFile('doc', n.name, { html:pre }); } });
        if(f && (f.type === 'image' || f.type === 'vector' || f.type === 'slides' || f.type === 'sheet')) opts.push({ label:'Код «' + n.name + '» — картинкой в «' + f.name + '»', ic:HOW_IC.image, act:function(){ var s = textSvg(n.name + ' · ' + lab, code.split('\n')); if(f.type === 'vector'){ insCb = function(){ ofRender(); }; putSvg(f, s, null, n.name); } else svgToPng(s.svg, s.w, s.h, function(u){ insCb = function(){ ofRender(); }; putImage(f, u, s.w, s.h, null, n.name); }); } });
      }
    });
    if(opts.length === 1){ opts[0].act(); return; }
    askHow('Как вставить блоки?', 'Из пространства «' + (mark.projName || '—') + '»' + (mark.envName ? ' · среда «' + mark.envName + '»' : '') + ': ' + nodes.length, opts.slice(0, 12));
  }
  // копирование файлов рабочего стола и схемы: Ctrl+C → Ctrl+V в любом пространстве
  var FILE_MARK = 'TRIOSTEUM-FILES:', FILE_KEY = 'triosteum.fileclip';
  function ofCopyFiles(ids){
    var list = ids.map(ofFile).filter(function(f){ return f && f.type !== 'folder'; });
    if(!list.length){ toast('Выделите файл, чтобы скопировать'); return null; }
    var pack = { t:Date.now(), env:ENV.id, envName:ENV.name, proj:PROJ.cur, projName:curProj().name, files:JSON.parse(JSON.stringify(list)) };
    try{ localStorage.setItem(FILE_KEY, JSON.stringify(pack)); }catch(e){ toast('Файлы слишком большие для буфера — используйте «Скачать → .tsm»'); }
    OF.fileClip = pack; toast('Скопировано файлов: ' + list.length + ' — вставьте в любом пространстве (' + MOD + 'V)');
    return pack;
  }
  function ofPasteFiles(pack){
    pack = pack || OF.fileClip; if(!pack){ try{ pack = JSON.parse(localStorage.getItem(FILE_KEY) || 'null'); }catch(e){} }
    if(!pack || !pack.files || !pack.files.length){ toast('Буфер файлов пуст'); return; }
    var f = curFile();
    if(f && pack.files.length === 1){ var src = pack.files[0], tmp = ofFile(src.id) || src; insertFileInto(tmp, f); return; }
    var map = {};
    pack.files.forEach(function(x){
      var c = JSON.parse(JSON.stringify(x)), nid = ofId(); map[x.id] = nid; c.id = nid;
      if(ofTypes().indexOf(c.type) < 0 && !FT[c.type]){ return; }
      c.parent = OF.dir || null; c.name = ofUnique(c.name + (ofFile(x.id) ? ' (копия)' : ''), c.parent); var sp = ofFreeSpot(c.parent); c.x = sp.x; c.y = sp.y; c.t = Date.now(); delete c.map;
      if(c.map) c.map = { x:c.map.x + 30, y:c.map.y + 30 };
      ofItems().push(c);
    });
    saveGraph(); ofRender(); toast('Вставлено файлов: ' + Object.keys(map).length + (pack.proj !== PROJ.cur ? ' из «' + pack.projName + '»' : ''));
  }
  document.addEventListener('copy', function(e){
    if(typeof officeOn !== 'function' || !officeOn() || typingIn(e.target) || $('howW')) return;
    var cf = curFile();
    if(cf && cf.type === 'image' && IE.clip && Date.now() - IE.clip.t < 1500 && e.clipboardData){ e.clipboardData.setData('text/plain', 'TRIOSTEUM-IMG:' + IE.clip.t); e.preventDefault(); return; }
    if(cf && cf.type === 'vector' && VE.clip && Date.now() - (VE.clipT || 0) < 1500 && e.clipboardData){ e.clipboardData.setData('text/plain', 'TRIOSTEUM-VEC:' + VE.clipT); e.preventDefault(); return; }
    var ids = OF.tab === 'map' ? (FM.multi && FM.multi.length ? FM.multi : (FM.sel ? [FM.sel] : [])).filter(function(x){ return ofFile(x); }) : (OF.tab === 'desk' ? OF.sel : []);
    if(!ids.length) return;
    var pack = ofCopyFiles(ids); if(!pack || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', FILE_MARK + pack.t); e.preventDefault();
  });
  document.addEventListener('paste', function(e){
    if(typeof officeOn !== 'function' || !officeOn() || $('howW')) return;
    var f = curFile(), t = e.target, dt = e.clipboardData;
    var files = readClipFiles(dt), imgs = files.filter(function(x){ return /^image\//.test(x.type); }), txt = dt ? dt.getData('text/plain') : '', html = dt ? dt.getData('text/html') : '';
    var mark = parseClipMark(txt), fmark = typeof txt === 'string' && txt.indexOf(FILE_MARK) === 0;
    // текст в поле ввода или в документе — обычная вставка; картинки и блоки — через окно выбора
    var editable = typingIn(t);
    if(editable && f && f.type === 'doc' && t.closest && t.closest('#dePaper')){
      if(imgs.length){ e.preventDefault(); readDataUrl(imgs[0], function(u){ document.execCommand('insertHTML', false, '<img src="' + u + '" alt="" style="max-width:100%">'); if(typeof deSaveSoon === 'function') deSaveSoon(); }); return; }
      if(mark){ e.preventDefault(); officePasteBlocks(mark); return; }
      if(fmark){ e.preventDefault(); ofPasteFiles(); return; }
      return;
    }
    if(editable) return;
    clearTimeout(OF.pasteWait); OF.pasteWait = null;
    if(f && f.type === 'image' && /^TRIOSTEUM-IMG:/.test(txt)){ e.preventDefault(); iePasteClip(); return; }
    if(f && f.type === 'vector' && /^TRIOSTEUM-VEC:/.test(txt)){ e.preventDefault(); vePaste(); return; }
    if(f && (f.type === 'image' || f.type === 'vector') && !imgs.length && !mark && !fmark && !(txt && txt.trim())){ e.preventDefault(); if(f.type === 'image') iePasteClip(); else vePaste(); return; }
    if(f && f.type === 'sheet' && document.activeElement && document.activeElement.id === 'sgWrap' && !imgs.length && !mark && !fmark) return;
    e.preventDefault(); e.stopPropagation();
    if(fmark){ ofPasteFiles(); return; }
    if(mark){ officePasteBlocks(mark); return; }
    if(imgs.length){ imgs.forEach(officePasteImage); return; }
    var other = files.filter(function(x){ return !/^image\//.test(x.type); });
    if(other.length){ other.forEach(importOfficeFile); return; }
    if(txt && txt.trim()){ officePasteText(txt, html); return; }
    if(OF.fileClip) ofPasteFiles();
  }, true);
  // перетаскивание: файлы с компьютера на открытый файл — вставка внутрь
  document.addEventListener('drop', function(e){
    if(typeof officeOn !== 'function' || !officeOn()) return;
    var f = curFile(); if(!f || f.type === 'doc') return;
    var fl = e.dataTransfer && e.dataTransfer.files; if(!fl || !fl.length) return;
    var imgs = Array.prototype.filter.call(fl, function(x){ return /^image\//.test(x.type); }); if(!imgs.length) return;
    e.preventDefault(); e.stopPropagation(); imgs.forEach(officePasteImage);
  }, true);
  document.addEventListener('dragover', function(e){ if(typeof officeOn === 'function' && officeOn() && curFile() && e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0){ e.preventDefault(); } }, true);

  /* ---------- картинки поверх ячеек таблицы ---------- */
  function sgRenderObjs(){
    var wrap = $('sgWrap'); if(!wrap || !SG.f) return;
    var old = wrap.querySelector('.sg-objs'); if(old) old.remove();
    var sh = shCur(), list = sh.images || []; if(!list.length) return;
    var layer = h('div', { 'class':'sg-objs' });
    list.forEach(function(o){
      var d = h('div', { 'class':'sg-obj' + (SG.obj === o.id ? ' sel' : ''), 'data-oid':o.id, style:'left:' + o.x + 'px;top:' + o.y + 'px;width:' + o.w + 'px;height:' + o.h + 'px', tabindex:'0', title:(o.name || 'Картинка') + ' — потяните, чтобы переместить; угол — размер; Delete — удалить' }, [
        h('img', { src:o.src, alt:o.name || '', draggable:'false' }),
        h('button', { type:'button', 'class':'sg-ox', 'aria-label':'Удалить картинку', html:'<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
        h('span', { 'class':'sg-orz' })
      ]);
      layer.appendChild(d);
    });
    wrap.appendChild(layer);
  }
  function sgObjDel(id){ shPush(); var sh = shCur(); sh.images = (sh.images || []).filter(function(o){ return o.id !== id; }); SG.obj = null; shChanged(); sgRenderObjs(); toast('Картинка удалена · ' + MOD + 'Z — вернуть'); }
  var _renderGrid = renderGrid;
  renderGrid = function(){ _renderGrid.apply(this, arguments); sgRenderObjs(); };
  (function sgObjEvents(){
    var main = $('ofMain');
    main.addEventListener('pointerdown', function(e){
      var d = e.target.closest && e.target.closest('.sg-obj'); if(!d || !SG.f) return;
      e.preventDefault(); e.stopPropagation();
      var sh = shCur(), o = (sh.images || []).filter(function(x){ return x.id === d.dataset.oid; })[0]; if(!o) return;
      if(e.target.closest('.sg-ox')){ sgObjDel(o.id); return; }
      SG.obj = o.id; Array.prototype.forEach.call(document.querySelectorAll('.sg-obj'), function(x){ x.classList.toggle('sel', x === d); }); d.focus({ preventScroll:true });
      var rz = e.target.closest('.sg-orz'), sx = e.clientX, sy = e.clientY, z = UI.scale / 100 || 1, o0 = { x:o.x, y:o.y, w:o.w, h:o.h }, moved = false;
      var mv = function(ev){ var dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z; if(!moved && Math.abs(dx) + Math.abs(dy) > 2){ moved = true; shPush(); }
        if(rz){ var k = ev.shiftKey ? null : o0.h / o0.w; o.w = Math.max(24, Math.round(o0.w + dx)); o.h = k ? Math.round(o.w * k) : Math.max(24, Math.round(o0.h + dy)); d.style.width = o.w + 'px'; d.style.height = o.h + 'px'; }
        else { o.x = Math.max(0, Math.round(o0.x + dx)); o.y = Math.max(0, Math.round(o0.y + dy)); d.style.left = o.x + 'px'; d.style.top = o.y + 'px'; } };
      var up = function(){ document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); if(moved) shChanged(); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    }, true);
    main.addEventListener('keydown', function(e){
      var d = e.target.closest && e.target.closest('.sg-obj'); if(!d) return;
      if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); e.stopPropagation(); sgObjDel(d.dataset.oid); }
    }, true);
    main.addEventListener('contextmenu', function(e){
      var d = e.target.closest && e.target.closest('.sg-obj'); if(!d) return;
      e.preventDefault(); e.stopPropagation();
      var sh = shCur(), o = (sh.images || []).filter(function(x){ return x.id === d.dataset.oid; })[0]; if(!o) return;
      var src = o.from && ofFile(o.from);
      openMenuAt([{ head:o.name || 'Картинка' },
        src ? { label:'Открыть источник «' + src.name + '»', icon:'file', act:function(){ ofOpen(src.id); } } : null,
        src ? { label:'Обновить из источника', icon:'redo', act:function(){ filePng(src, function(u, w, hh){ shPush(); o.src = u; o.h = Math.round(o.w * hh / w); shChanged(); sgRenderObjs(); }); } } : null,
        { label:'Исходный размер', icon:'layout', act:function(){ dataUrlSize(o.src, function(w, hh){ shPush(); o.w = w; o.h = hh; shChanged(); sgRenderObjs(); }); } },
        { label:'Скачать картинку', icon:'download', act:function(){ var a = document.createElement('a'); a.href = o.src; a.download = (o.name || 'kartinka') + '.png'; a.click(); } },
        { sep:true }, { label:'Удалить', icon:'trash', danger:true, kb:'Del', act:function(){ sgObjDel(o.id); } }].filter(Boolean), e.clientX, e.clientY);
    }, true);
  })();
  function sgInsertImage(){ OF.imgCb = null; var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.addEventListener('change', function(){ if(inp.files[0]) officePasteImage(inp.files[0]); }); inp.click(); }
  // в каждом редакторе — кнопка «Вставить ▾»: картинка с компьютера или любой файл рабочего стола
  var _ofRenderIns = ofRender;
  ofRender = function(){
    _ofRenderIns.apply(this, arguments);
    var f = curFile(); if(!f || f.type === 'folder') return;
    var rb = document.querySelector('#ofMain .ribbon'); if(!rb || rb.querySelector('.rb-ins')) return;
    var b = h('button', { type:'button', 'class':'rb rb-ins', title:'Вставить картинку или любой файл (' + MOD + 'V — из буфера обмена)', 'aria-label':'Вставить', html:'<span class="rt">Вставить ▾</span>' });
    b.addEventListener('mousedown', function(e){ e.preventDefault(); });
    b.addEventListener('click', function(){
      var r = b.getBoundingClientRect(), others = fmFiles().filter(function(x){ return x.id !== f.id; });
      openMenuAt([{ head:'Вставить в «' + f.name + '»' },
        { label:'Картинку с компьютера…', icon:'plus', act:sgInsertImage },
        { label:'Файл с рабочего стола', icon:'file', disabled:!others.length, sub:others.slice(0, 40).map(function(a){ return { label:a.name + ' · ' + FT[a.type].name.toLowerCase(), icon:'file', act:function(){ insertFileInto(a, f, function(){ ofRender(); toast('«' + a.name + '» вставлен в «' + f.name + '» · связь видна на схеме файлов'); }); } }; }) },
        { label:'Блоки из буфера (скопированы на доске)', icon:'paste', disabled:!clip, act:function(){ officePasteBlocks(clip); } }
      ], r.left, r.bottom + 4);
    });
    var g = rb.querySelector('.grow'); rb.insertBefore(b, g || null);
  };
