  /* ---------- документы: поля {{…}} ---------- */
  var FIELD_RE = /\{\{\s*([^{}<>]+?)\s*\}\}/g;
  function escHtml(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function docFields(html){ var f = [], m; FIELD_RE.lastIndex = 0; while((m = FIELD_RE.exec(html))){ if(f.indexOf(m[1]) < 0) f.push(m[1]); } return f; }
  function lookup(row, key){
    if(!row) return undefined;
    if(row[key] !== undefined) return row[key];
    var lk = key.toLowerCase(); for(var k in row){ if(k.toLowerCase() === lk) return row[k]; }
    return undefined;
  }
  function fillTemplate(html, row, mark){
    return html.replace(FIELD_RE, function(m, key){
      var v = lookup(row, key);
      if(v === undefined || v === ''){
        if(/^(дата|сегодня)$/i.test(key)) v = new Date().toLocaleDateString('ru-RU');
        else return mark ? '<span class="fv miss">' + escHtml(m) + '</span>' : '________';
      }
      var s = escHtml(fmtCell(num(v)));
      return mark ? '<span class="fv">' + s + '</span>' : s;
    });
  }
  function paperDoc(title, body){
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>' + escHtml(title) + '</title><style>' +
      'body{margin:0;background:#EEE;font:15px/1.55 "Times New Roman",Georgia,serif;color:#111}' +
      '.page{max-width:794px;margin:24px auto;padding:56px 64px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.15)}' +
      'h1{font-size:20px;margin:0 0 12px}h2{font-size:16px;margin:18px 0 6px}p{margin:0 0 10px}table{border-collapse:collapse}td,th{border:1px solid #999;padding:6px}' +
      '@media print{body{background:#fff}.page{box-shadow:none;margin:0;padding:0}}' +
      '.doc-sep{page-break-after:always}</style></head><body>' + body + '</body></html>';
  }
  function upstreamRows(n){
    // ближайшая таблица выше по схеме — источник данных для предпросмотра
    var plan = boardOrder(), seen = {}, q = (plan.preds[n.id] || []).slice();
    while(q.length){
      var id = q.shift(); if(seen[id]) continue; seen[id] = 1;
      var x = nodeById(id); if(!x) continue;
      if(x.lang === 'sheet') return sheetObjects(nodeCode(x));
      q = q.concat(plan.preds[id] || []);
    }
    return null;
  }
