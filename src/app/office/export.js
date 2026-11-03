  /* ---------- экспорт файлов ---------- */
  function exportItems(f){
    var L = { doc:[['docx', 'Word (.docx)'], ['html', 'Веб-страница (.html)'], ['md', 'Текст (.md)']], sheet:[['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV текущего листа']], slides:[['pptx', 'PowerPoint (.pptx)'], ['html', 'Показ в браузере (.html)']], form:[['html', 'Форма (.html)'], ['xlsx', 'Ответы в Excel']], image:[['png', 'PNG'], ['jpg', 'JPEG'], ['webp', 'WebP']], vector:[['svg', 'SVG (вектор)'], ['png', 'PNG'], ['jpg', 'JPEG']] }[f.type] || [];
    var sel = (OF.tab === 'desk' && OF.sel.length > 1 && OF.sel.indexOf(f.id) >= 0) ? OF.sel.map(ofFile) : ((OF.tab === 'map' && FM.multi && FM.multi.length > 1 && FM.multi.indexOf(f.id) >= 0) ? FM.multi.map(ofFile).filter(Boolean) : null);
    return L.map(function(x){ return { label:x[1], icon:'download', act:function(){ exportFileAs(f, x[0]); } }; })
      .concat([{ sep:true }, { label:'Triosteum (.tsm) — со всеми данными', icon:'download', act:function(){ exportTsmFiles([f]); } }],
        sel ? [{ label:'Выделенные файлы (' + sel.length + ') одним .tsm', icon:'download', act:function(){ exportTsmFiles(sel, curProj().name); } }] : []);
  }
  function docExportHtml(f){ var d = document.createElement('div'); d.innerHTML = deWrap(f.data.html); d.querySelectorAll('.lnk-tag').forEach(function(x){ x.remove(); }); d.querySelectorAll('[contenteditable]').forEach(function(x){ x.removeAttribute('contenteditable'); }); d.querySelectorAll('.fld').forEach(function(x){ x.replaceWith(document.createTextNode(x.textContent)); }); d.querySelectorAll('hr.pb').forEach(function(x){ var b = document.createElement('div'); b.style.pageBreakAfter = 'always'; x.replaceWith(b); }); return d.innerHTML; }
  function exportFileAs(f, fmt){
    if(f.id === OF.tab) ofCommit();
    var name = fileBase(f.name, f.type);
    if(f.type === 'image'){ if(IE.f === f && IE.layers) ieExport(fmt); else ieLoad(f, function(ls){ var c = document.createElement('canvas'); c.width = f.data.w; c.height = f.data.h; var x = c.getContext('2d'); if(fmt === 'jpg'){ x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } ls.forEach(function(L){ if(!L.vis) return; x.save(); x.globalAlpha = L.op; x.globalCompositeOperation = L.blend; x.drawImage(L.c, 0, 0); x.restore(); }); var type = fmt === 'jpg' ? 'image/jpeg' : (fmt === 'webp' ? 'image/webp' : 'image/png'); c.toBlob(function(b){ download(name + '.' + fmt, b, type, 'Изображение сохранено (.' + fmt + ')'); }, type, 0.92); }); return; }
    if(f.type === 'vector'){ var keep = VE.f; VE.f = f; veExport(fmt, 1); VE.f = keep; return; }
    if(f.type === 'doc'){
      var body = docExportHtml(f);
      if(fmt === 'md'){ var t = document.createElement('div'); t.innerHTML = body; download(name + '.md', t.innerText, 'text/markdown', 'Текст сохранён'); return; }
      var full = paperDoc(f.name, '<div class="page">' + body + '</div>');
      if(fmt === 'html'){ download(name + '.html', full, 'text/html', 'Документ сохранён (.html)'); return; }
      loadLib('htmlDocx', 'https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js').then(function(H){
        var docHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman";font-size:12pt}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px}</style></head><body>' + body.replace(/<svg[\s\S]*?<\/svg>/g, '[диаграмма]') + '</body></html>';
        download(name + '.docx', H.asBlob(docHtml), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Документ Word сохранён');
      }, function(){ download(name + '.html', full, 'text/html', 'Модуль Word недоступен — сохранено в .html (Word откроет)'); });
      return;
    }
    if(f.type === 'sheet' || (f.type === 'form' && fmt === 'xlsx')){
      var book = f.type === 'form' ? formTarget(f) : f;
      calcReset();
      var aoas = book.data.sheets.map(function(s, i){ return { name:s.name, aoa:sheetValues(book, i).map(function(r){ return r.map(fmtExport); }), raw:s.rows }; });
      if(fmt === 'csv'){ var a = aoas[f.type === 'sheet' && SG.f === f ? SG.idx : 0]; download(name + '.csv', csvOf(a.aoa), 'text/csv', 'CSV сохранён'); return; }
      loadXLSX().then(function(X){
        var wb = X.utils.book_new();
        aoas.forEach(function(a){
          var ws = X.utils.aoa_to_sheet(a.aoa);
          // переносим формулы, которые Excel поймёт сам (ссылки внутри книги)
          a.raw.forEach(function(row, r){ row.forEach(function(v, c){ if(typeof v === 'string' && v.charAt(0) === '=' && !/'[^']*\//.test(v)){ var cell = ws[X.utils.encode_cell({ r:r, c:c })]; if(cell){ cell.f = v.slice(1).replace(/;/g, ',').replace(/СУММ\(/gi, 'SUM(').replace(/СРЗНАЧ\(/gi, 'AVERAGE(').replace(/ОКРУГЛ\(/gi, 'ROUND(').replace(/ЕСЛИ\(/gi, 'IF('); } } }); });
          ws['!cols'] = (a.aoa[0] || []).map(function(x, i){ var w = 8; a.aoa.forEach(function(r){ w = Math.max(w, String(r[i] === undefined ? '' : r[i]).length + 2); }); return { wch:Math.min(50, w) }; });
          X.utils.book_append_sheet(wb, ws, String(a.name).slice(0, 31).replace(/[\\\/?*\[\]:]/g, ' '));
        });
        download(name + '.xlsx', X.write(wb, { bookType:'xlsx', type:'array' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Книга Excel сохранена');
      }, function(){ download(name + '.csv', csvOf(aoas[0].aoa), 'text/csv', 'Модуль Excel недоступен — сохранено в CSV'); });
      return;
    }
    if(f.type === 'slides'){
      var th = slTheme(f);
      var htmlShow = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>' + escHtml(f.name) + '</title><style>' + SLIDE_CSS + 'body{margin:0;background:#000;overflow:hidden}.sl-show-frame{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}.slide{transform-origin:center}</style></head><body><div class="sl-show-frame" id="fr"></div><scr' + 'ipt>var S=' + JSON.stringify(f.data.slides.map(function(s){ return slideHtml(f, s); })).replace(/<\//g, '<\\/') + ',i=0,fr=document.getElementById("fr");function d(){fr.innerHTML=S[i];var k=Math.min(innerWidth/960,innerHeight/540);fr.firstChild.style.transform="scale("+k+")";}addEventListener("keydown",function(e){if(/Right|Down| |Enter|PageDown/.test(e.key))i=Math.min(S.length-1,i+1);else if(/Left|Up|PageUp/.test(e.key))i=Math.max(0,i-1);d();});addEventListener("click",function(e){i=e.clientX<innerWidth/4?Math.max(0,i-1):Math.min(S.length-1,i+1);d();});addEventListener("resize",d);d();<\/script></body></html>';
      if(fmt === 'html'){ download(name + '.html', htmlShow, 'text/html', 'Презентация сохранена (.html — откройте в браузере)'); return; }
      loadLib('PptxGenJS', 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js').then(function(P){
        var p = new P(); p.layout = 'LAYOUT_WIDE';
        var hx = function(c){ return c.replace('#', ''); };
        f.data.slides.forEach(function(s){
          var sl = p.addSlide(); sl.background = { color:hx(th.bg) };
          var lay = s.layout || 'content', lines = String(s.body || '').split('\n').filter(function(x){ return x.trim(); });
          if(lay === 'title'){
            sl.addText(s.title || '', { x:0.8, y:2.3, w:11.7, h:1.4, fontSize:40, bold:true, color:hx(th.ink), align:'center', fontFace:'Arial' });
            sl.addText(s.body || '', { x:0.8, y:3.8, w:11.7, h:0.8, fontSize:20, color:hx(th.sub), align:'center', fontFace:'Arial' });
          } else {
            sl.addText(s.title || '', { x:0.6, y:0.4, w:12.1, h:0.9, fontSize:30, bold:true, color:hx(th.ink), fontFace:'Arial' });
            sl.addShape(p.ShapeType.rect, { x:0.6, y:1.3, w:1.2, h:0.06, fill:{ color:hx(th.acc) }, line:{ color:hx(th.acc) } });
            var half = lay === 'two' || lay === 'media';
            if(lay !== 'head' && lines.length) sl.addText(lines.map(function(l){ return { text:l.replace(/^[-•*]\s*/, ''), options:{ bullet:true } }; }), { x:0.6, y:1.6, w:half ? 5.9 : 12.1, h:5.2, fontSize:20, color:hx(th.ink), valign:'top', fontFace:'Arial', paraSpaceAfter:8 });
            if(lay === 'two'){ var l2 = String(s.body2 || '').split('\n').filter(function(x){ return x.trim(); }); if(l2.length) sl.addText(l2.map(function(l){ return { text:l, options:{ bullet:true } }; }), { x:6.8, y:1.6, w:5.9, h:5.2, fontSize:20, color:hx(th.ink), valign:'top', fontFace:'Arial' }); }
            var mx = half ? 6.8 : 0.6, mw = half ? 5.9 : 12.1, my = lay === 'head' ? 1.6 : (half ? 1.6 : 1.6 + Math.min(lines.length, 4) * 0.55), mh = 6.9 - my;
            if(s.img) sl.addImage({ data:s.img, x:mx, y:my, w:mw, h:mh, sizing:{ type:'contain', w:mw, h:mh } });
            else if(s.embed){
              var sf = ofFile(s.embed.src);
              if(sf){
                var g = parseRange(s.embed.range) || usedRange(sf.data.sheets[s.embed.sheet || 0]), aoa = rangeValues(sf, s.embed.sheet || 0, g);
                if(s.embed.kind === 'chart'){
                  var cd = chartData(aoa), type = { bar:p.ChartType.bar, line:p.ChartType.line, pie:p.ChartType.pie }[s.embed.ctype || 'bar'];
                  if(cd.series.length) sl.addChart(type, (s.embed.ctype === 'pie' ? cd.series.slice(0, 1) : cd.series).map(function(se){ return { name:se.name, labels:cd.labels, values:se.values }; }), { x:mx, y:my, w:mw, h:mh, showLegend:true, legendPos:'b', chartColors:CH_COLORS.map(hx), catAxisLabelColor:hx(th.sub), valAxisLabelColor:hx(th.sub), legendColor:hx(th.ink) });
                } else sl.addTable(aoa.map(function(r, ri){ return r.map(function(v){ return { text:fmtCell(v), options:{ bold:ri === 0, color:hx(th.ink), fontSize:12 } }; }); }), { x:mx, y:my, w:mw, border:{ type:'solid', color:'999999', pt:0.5 }, autoPage:false });
              }
            }
          }
          if(s.notes) sl.addNotes(s.notes);
        });
        return p.write({ outputType:'blob' }).then(function(b){ download(name + '.pptx', b, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Презентация PowerPoint сохранена'); });
      }).catch(function(){ download(name + '.html', htmlShow, 'text/html', 'Модуль PowerPoint недоступен — сохранено как показ в браузере (.html)'); });
      return;
    }
    if(f.type === 'form'){
      var fh = '<h1>' + escHtml(f.data.title) + '</h1>' + (f.data.desc ? '<p>' + escHtml(f.data.desc) + '</p>' : '') + f.data.fields.map(function(fl){ return '<p><b>' + escHtml(fl.label) + (fl.required ? ' *' : '') + '</b><br>' + ((fl.type === 'select' || fl.type === 'radio') ? (fl.options || []).map(function(o){ return '☐ ' + escHtml(o); }).join('<br>') : '______________________________') + '</p>'; }).join('');
      download(name + '.html', paperDoc(f.name, '<div class="page">' + fh + '</div>'), 'text/html', 'Бланк формы сохранён (.html — можно распечатать)');
    }
  }
