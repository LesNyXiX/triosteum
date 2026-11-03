  /* ---------- запуск маршрута документов ---------- */
  var RES = { items:[], cur:0 }, resWin = null;
  function toRows(x){
    var out = [];
    (function f(v){ if(Array.isArray(v)) v.forEach(f); else if(v && typeof v === 'object') out.push(v); else if(v !== null && v !== undefined) out.push({ 'Значение':v }); })(x);
    return out;
  }
  function plainRow(r){ var o = {}; for(var k in r){ if(k.indexOf('__') !== 0) o[k] = r[k]; } return o; }
  function runRoute(){
    if(running) return;
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    runEl.box.hidden = false; runEl.out.textContent = ''; runEl.sum.textContent = '';
    if(!G.nodes.length){ rlog('На доске нет блоков.', 'dim'); return; }
    clearRun(); RES.items = []; RES.cur = 0;
    var plan = boardOrder();
    rlog('Маршрут: ' + plan.order.map(function(n){ return n.name; }).join(' → '), 'dim');
    if(plan.cyclic.length) rlog('Пропущены из-за замкнутого круга: ' + plan.cyclic.map(function(n){ return n.name; }).join(', '), 'warn');
    var needPy = plan.order.some(function(n){ return n.lang === 'python'; });
    var results = {}, stat = { ok:0, err:0, skip:0 }, days = {}, regN = 0, docN = 0;
    running = true;
    if(needPy && RUN_SERVER) rlog('Python выполняется на сервере', 'dim');
    (needPy && !RUN_SERVER ? loadPyFor(rlog).then(null, function(e){ rlog('Python недоступен: ' + e.message + ' — расчётные блоки будут пропущены', 'warn'); return null; }) : Promise.resolve(null)).then(function(py){
      var i = 0;
      function next(){
        if(i >= plan.order.length){ finish(); return; }
        var n = plan.order[i++], d = domOf('node', n.id), ins = plan.preds[n.id].map(function(p){ return results[p]; }).filter(function(v){ return v !== undefined && v !== null; });
        var rows = toRows(ins), hasIn = plan.preds[n.id].length > 0;
        days[n.id] = plan.preds[n.id].reduce(function(m, p){ return Math.max(m, days[p] || 0); }, 0);
        if(d) d.classList.add('running');
        setTimeout(function(){
          // код из «Разработки» на сервере: результат идёт дальше по маршруту вместе с остальными блоками
          if(n.lang === 'python' && RUN_SERVER && !py){
            rlog('▶ ' + n.name + ' — Python на сервере');
            serverRun(nodeCode(n), hasIn ? rows.map(plainRow) : null, 'block').then(function(r){
              printLines(r.stdout, function(t){ rlog('   ' + t); }); printLines(r.stderr, function(t){ rlog('   ' + t, 'err'); });
              if(r.ok){ var back = toRows(r.output); back.forEach(function(x, k){ if(rows[k] && rows[k].__doc) x.__doc = rows[k].__doc; }); results[n.id] = back; stat.ok++; setRun(n, 'ok', 'Записей на выходе: ' + back.length); rlog('  ✓ записей на выходе: ' + back.length, 'ok'); }
              else { rlog('  ✗ ошибка: ' + r.error, 'err'); stat.err++; results[n.id] = null; setRun(n, 'err', 'Ошибка: ' + r.error); }
              if(d) d.classList.remove('running');
              next();
            });
            return;
          }
          try{
            var out = rows, p;
            if(n.kind === 'hub'){
              rlog('▶ ' + n.name + ' — объединено записей: ' + rows.length); setRun(n, 'ok', 'Объединено записей: ' + rows.length);
            } else if(n.lang === 'sheet'){
              var own = sheetObjects(nodeCode(n));
              if(hasIn){ out = own.concat(rows.map(plainRow)); rlog('▶ ' + n.name + ' — реестр: ' + own.length + ' записей + ' + rows.length + ' новых'); RES.items.push({ type:'table', title:n.name, rows:out.map(plainRow) }); }
              else { out = own; rlog('▶ ' + n.name + ' — записей: ' + own.length); }
              setRun(n, 'ok', 'Записей: ' + out.length);
            } else if(n.lang === 'doc'){
              var tpl = nodeCode(n), src = hasIn ? rows : [{}];
              if(hasIn && !rows.length){ rlog('▶ ' + n.name + ' — входных записей нет, документы не сформированы', 'warn'); setRun(n, 'skip', 'Нет входных записей'); out = []; }
              else {
                out = src.map(function(r, ri){
                  docN++;
                  var title = n.name + (lookup(r, 'Номер') ? ' № ' + lookup(r, 'Номер') : (src.length > 1 ? ' — ' + (ri + 1) : ''));
                  var item = { type:'doc', title:title, html:sanitizeHtml(fillTemplate(tpl, r)), status:[] };
                  RES.items.push(item);
                  var o = {}; for(var k in r) o[k] = r[k]; o.__doc = item; o['Документ'] = title; return o;
                });
                rlog('▶ ' + n.name + ' — сформировано документов: ' + out.length, 'ok'); setRun(n, 'ok', 'Документов: ' + out.length);
              }
            } else if(n.lang === 'step'){
              p = params(n); var dn = doneWord(p.action);
              days[n.id] += +p.days || 0;
              out = rows.map(function(r){
                var o = {}; for(var k in r) o[k] = r[k];
                o['Статус'] = dn; o['Этап'] = p.action + ' — ' + (p.who || 'ответственный');
                if(/регистр/i.test(p.action || '')){ regN++; o['Рег. №'] = 'ВН-' + new Date().getFullYear() + '/' + String(regN).padStart(4, '0'); }
                if(r.__doc) r.__doc.status.push(dn + ' (' + (p.who || '—') + ')' + (o['Рег. №'] ? ', рег. № ' + o['Рег. №'] : ''));
                return o;
              });
              rlog('▶ ' + n.name + ' — ' + (p.who || 'ответственный') + ', срок ' + (+p.days || 0) + ' дн.: ' + plural(out.length, 'запись', 'записи', 'записей') + ' → «' + dn + '»' + (out.length ? '' : ' (нет записей)'));
              rlog('   в демо подтверждается автоматически; в работе задача придёт ответственному', 'dim');
              setRun(n, 'ok', dn + ': ' + out.length);
            } else if(n.lang === 'cond'){
              p = params(n);
              var yes = rows.filter(function(r){ return condPass(r, p); });
              rlog('▶ ' + n.name + ' — прошли условие: ' + yes.length + ' из ' + rows.length + (rows.length - yes.length ? ', остальные остановлены' : ''));
              out = yes; setRun(n, 'ok', 'Прошли: ' + yes.length + ' из ' + rows.length);
            } else if(n.lang === 'send'){
              p = params(n); var nm = p.name || n.name, docs = rows.filter(function(r){ return r.__doc; }).map(function(r){ return r.__doc; });
              if(p.format === 'xlsx' || p.format === 'csv'){ RES.items.push({ type:'table', title:nm, rows:rows.map(plainRow), fmt:p.format }); rlog('▶ ' + n.name + ' — подготовлен файл ' + p.format.toUpperCase() + ': ' + plural(rows.length, 'строка', 'строки', 'строк') + ' (скачать — в окне результатов)', 'ok'); }
              else if(p.format === 'html' || p.format === 'archive'){ RES.items.push({ type:'pack', title:nm, docs:docs }); rlog('▶ ' + n.name + ' — пакет: ' + plural(docs.length, 'документ', 'документа', 'документов') + (p.format === 'archive' ? ', передан в архив' : ''), 'ok'); }
              else if(p.format === 'email'){ rlog('▶ ' + n.name + ' — письмо «' + nm + '» для ' + (p.to || 'получателя') + ': вложений ' + docs.length + '. Отправка — после подключения почтового сервера', 'warn'); }
              else if(p.format === '1c'){ rlog('▶ ' + n.name + ' — передача ' + rows.length + ' записей в «' + (p.to || '1С') + '». Обмен — после подключения HTTP-сервиса 1С', 'warn'); }
              setRun(n, 'ok', 'Выгружено записей: ' + rows.length);
            } else if(langById(n.lang) && langById(n.lang).apply){
              p = params(n);
              var nid = n.id, ctx = { name:n.name, info:'', ins:ins.map(toRows),
                log:function(t, c){ rlog('   ' + t, c || 'dim'); },
                table:function(title, rs){ RES.items.push({ type:'table', title:title, rows:rs.map(plainRow), node:nid }); },
                chart:function(o){ o.type = 'chart'; o.node = nid; RES.items.push(o); },
                item:function(o){ o.node = nid; RES.items.push(o); },
                upItems:function(){
                  var anc = {}, q = (plan.preds[nid] || []).slice();
                  while(q.length){ var x = q.shift(); if(anc[x]) continue; anc[x] = 1; q = q.concat(plan.preds[x] || []); }
                  return RES.items.filter(function(it){ return it.node && anc[it.node]; });
                } };
              out = langById(n.lang).apply(rows, p, ctx) || [];
              rlog('▶ ' + n.name + ' — ' + (ctx.info || 'записей: ' + out.length), 'ok'); setRun(n, 'ok', ctx.info || 'Записей: ' + out.length);
            } else if(n.lang === 'html'){
              RES.items.push({ type:'html', title:n.name, html:nodeCode(n), node:n.id });
              rlog('▶ ' + n.name + ' — HTML-виджет добавлен в результаты, записи идут дальше: ' + rows.length, 'ok'); setRun(n, 'ok', 'HTML-виджет в результатах');
            } else if(FOREIGN_LANGS[n.lang]){
              var fr = runForeign(n.lang, nodeCode(n), hasIn ? rows.map(plainRow) : null, { resultName:n.name });
              rlog('▶ ' + n.name + ' — ' + foreignLabel(n.lang) + (fr.demo ? ' (входа нет — демо-данные блока)' : ''));
              fr.stdout.forEach(function(t){ rlog('   ' + t); }); fr.notes.forEach(function(t){ rlog('   ℹ ' + t, 'dim'); });
              if(!fr.ok) throw new Error(fr.error);
              out = toRows(fr.output); out.forEach(function(x, k){ if(rows[k] && rows[k].__doc) x.__doc = rows[k].__doc; });
              if(out.length && Object.keys(out[0]).length > 1) RES.items.push({ type:'table', title:n.name, rows:out.map(plainRow), node:n.id });
              rlog('  ✓ записей на выходе: ' + out.length, 'ok'); setRun(n, 'ok', 'Записей на выходе: ' + out.length);
            } else if(n.lang !== 'python' && !(langById(n.lang) && langById(n.lang).real)){
              var fl = langById(n.lang);
              rlog('▶ ' + n.name + ' — пропущен: для ' + (fl ? shortName(fl) : n.lang) + ' нет исполнителя, записи переданы дальше без изменений', 'warn');
              stat.skip++; setRun(n, 'skip', 'Пропущен: нет исполнителя');
            } else if(n.lang === 'python'){
              if(!py){ rlog('▶ ' + n.name + ' — пропущен: Python не загрузился', 'warn'); stat.skip++; setRun(n, 'skip', 'Python не загрузился'); out = rows; }
              else {
                rlog('▶ ' + n.name);
                py.setStdout({ batched:function(t){ rlog('   ' + t); } }); py.setStderr({ batched:function(t){ rlog('   ' + t, 'err'); } });
                py.runPython(PY_STUB); py.runPython(nodeCode(n));
                py.globals.set('_inp_json', JSON.stringify(hasIn ? rows.map(plainRow) : null));
                py.runPython(PY_RUN_BOARD);
                var oj = py.globals.get('_out_json'), res = oj ? JSON.parse(oj) : null, back = toRows(res);
                // документы, привязанные к записям, сохраняем при пересчёте
                back.forEach(function(r, k){ if(rows[k] && rows[k].__doc) r.__doc = rows[k].__doc; });
                out = back; setRun(n, 'ok', 'Записей на выходе: ' + back.length); rlog('  ✓ записей на выходе: ' + back.length, 'ok');
              }
            }
            results[n.id] = out; stat.ok++;
          }catch(err){
            var msg = String(err && err.message || err).split('\n').filter(function(x){ return x.trim(); });
            rlog('  ✗ ошибка: ' + msg.slice(-1)[0], 'err'); stat.err++; results[n.id] = null; setRun(n, 'err', 'Ошибка: ' + msg.slice(-1)[0]);
          }
          if(d) d.classList.remove('running');
          next();
        }, 90);
      }
      function finish(){
        running = false;
        var total = Math.max.apply(0, [0].concat(Object.keys(days).map(function(k){ return days[k]; })));
        var nd = RES.items.filter(function(x){ return x.type === 'doc'; }).length, nt = RES.items.filter(function(x){ return x.type !== 'doc'; }).length;
        var hasStep = plan.order.some(function(n){ return n.lang === 'step'; });
        runEl.sum.textContent = (nd ? 'документов: ' + nd + ' · ' : '') + 'результатов: ' + nt + (hasStep ? ' · срок маршрута: ' + total + ' раб. дн.' : '');
        if(hasStep) rlog('Готово. Срок прохождения маршрута по самой длинной цепочке: ' + plural(total, 'рабочий день', 'рабочих дня', 'рабочих дней') + '.', stat.err ? 'warn' : 'ok');
        else rlog('Готово' + (stat.err ? ', с ошибками: ' + stat.err : '') + '.', stat.err ? 'warn' : 'ok');
        if(RES.items.length){
          var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm primary'; b.style.marginTop = '8px'; b.textContent = 'Открыть результаты (' + RES.items.length + ')';
          b.addEventListener('click', openRes); runEl.out.appendChild(document.createElement('br')); runEl.out.appendChild(b);
          openRes();
        }
      }
      next();
    });
  }
  function openRes(){
    $('resW').hidden = false;
    if(!resWin) resWin = makeWindow($('resW'), '.pers-h', 'res', 'fixed');
    resWin.apply(); renderRes();
  }
  $('resClose').addEventListener('click', function(){ $('resW').hidden = true; });
  $('resW').addEventListener('keydown', function(e){ if(e.key === 'Escape') $('resW').hidden = true; });
  function tableHtml(rows){
    var aoa = rowsToAoa(rows);
    return '<table class="rt"><thead><tr>' + aoa[0].map(function(x){ return '<th>' + escHtml(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      aoa.slice(1).map(function(r){ return '<tr>' + r.map(function(x){ var v = num(x); return '<td' + (typeof v === 'number' ? ' class="n"' : '') + '>' + escHtml(fmtCell(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function itemBody(it){
    if(it.type === 'doc') return '<div class="page">' + it.html + (it.status.length ? '<p style="margin-top:24px;font:12px Arial;color:#555;border-top:1px solid #ccc;padding-top:8px">Отметки маршрута: ' + escHtml(it.status.join(' → ')) + '</p>' : '') + '</div>';
    if(it.type === 'dash') return '<div class="page" style="max-width:1100px">' + dashHtml(it) + '</div>';
    if(it.type === 'metric') return '<div class="page">' + dashHtml({ title:it.title, tiles:[it], charts:[], tables:[] }) + '</div>';
    if(it.type === 'chart') return '<div class="page" style="max-width:none"><h1>' + escHtml(it.title) + '</h1>' + routeChartSvg(it) + '</div>';
    if(it.type === 'html') return '<div class="page" style="max-width:none"><h1>' + escHtml(it.title) + '</h1><iframe sandbox="" style="width:100%;height:520px;border:1px solid #ddd;border-radius:8px;background:#fff" srcdoc="' + escHtml(it.html) + '"></iframe></div>';
    if(it.type === 'pack') return it.docs.map(function(d, i){ return '<div class="page' + (i < it.docs.length - 1 ? ' doc-sep' : '') + '">' + d.html + '</div>'; }).join('') || '<div class="page"><p>В пакете нет документов.</p></div>';
    return '<div class="page" style="max-width:none">' + '<h1>' + escHtml(it.title) + '</h1>' + tableHtml(it.rows).replace('class="rt"', 'style="width:100%;font:13px Arial"') + '</div>';
  }
  function renderRes(){
    var b = $('resBody'); b.innerHTML = '';
    if(!RES.items.length){ b.appendChild(h('div', { 'class':'bld-stat', text:'Запустите схему — здесь появятся документы, таблицы и диаграммы.' })); return; }
    var list = h('div', { 'class':'res-list', role:'listbox', 'aria-label':'Результаты' });
    RES.items.forEach(function(it, i){
      var kind = it.type === 'doc' ? 'Документ' : it.type === 'dash' ? 'Дашборд · ' + (it.tiles.length + it.charts.length) + ' эл.' : it.type === 'metric' ? 'Показатель · ' + fmtCell(it.value) : it.type === 'chart' ? 'Диаграмма · ' + it.values.length : (it.type === 'pack' ? 'Пакет · ' + it.docs.length + ' док.' : (it.type === 'html' ? 'HTML-виджет' : 'Таблица · ' + (it.rows || []).length + ' стр.'));
      list.appendChild(h('button', { type:'button', role:'option', 'aria-selected':i === RES.cur ? 'true' : 'false', 'class':'res-i' + (i === RES.cur ? ' on' : ''),
        on:{ click:function(){ RES.cur = i; renderRes(); } } }, [ h('b', { text:it.title }), h('span', { text:kind + (it.status && it.status.length ? ' · ' + it.status[it.status.length - 1] : '') }) ]));
    });
    var it = RES.items[RES.cur] || RES.items[0];
    var fr = h('iframe', { 'class':'res-frame', title:'Просмотр: ' + it.title, sandbox:'' });
    fr.srcdoc = paperDoc(it.title, itemBody(it));
    var name = fileBase(it.title, 'rezultat');
    var acts = h('div', { 'class':'bld-acts' }, [
      it.type === 'table' ? h('button', { type:'button', 'class':'btn primary', text:'Скачать Excel', on:{ click:function(){ saveXlsx(name, rowsToAoa(it.rows), it.title); } } }) : null,
      it.type === 'table' ? h('button', { type:'button', 'class':'btn', text:'CSV', on:{ click:function(){ download(name + '.csv', csvOf(rowsToAoa(it.rows)), 'text/csv', 'Файл CSV сохранён'); } } }) : null,
      it.type !== 'table' ? h('button', { type:'button', 'class':'btn primary', text:'Скачать .html', on:{ click:function(){ download(name + '.html', paperDoc(it.title, itemBody(it)), 'text/html', 'Документ сохранён (.html — откроется в Word)'); } } }) : null,
      !isOffice() ? null : h('button', { type:'button', 'class':'btn', text:'Сохранить в «Файлы»', on:{ click:function(){ var d = saveResultsToFiles(); if(d){ $('resW').hidden = true; OF.dir = d.id; ofSetTab('desk'); } } } }),
      h('button', { type:'button', 'class':'btn', text:'Все документы одним файлом', on:{ click:function(){
        var docs = RES.items.filter(function(x){ return x.type === 'doc'; });
        if(!docs.length){ toast('Документов нет'); return; }
        download(fileBase(curProj().name, 'dokumenty') + '_vse.html', paperDoc(curProj().name, itemBody({ type:'pack', docs:docs })), 'text/html', 'Документы сохранены одним файлом');
      } } })
    ].filter(Boolean));
    b.appendChild(h('div', { 'class':'res-wrap' }, [ list, h('div', { 'class':'res-view' }, [ acts, fr ]) ]));
  }
