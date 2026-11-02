  /* ---------- регламент процесса (аналог бэкенда для документов) ---------- */
  function assembleReglament(){
    var plan = boardOrder(), L = [], who = [], days = {}, today = new Date().toLocaleDateString('ru-RU');
    plan.order.forEach(function(n){ days[n.id] = plan.preds[n.id].reduce(function(m, p){ return Math.max(m, days[p] || 0); }, 0) + (n.lang === 'step' ? (+params(n).days || 0) : 0); if(n.lang === 'step'){ var w = params(n).who; if(w && who.indexOf(w) < 0) who.push(w); } });
    var total = Math.max.apply(0, [0].concat(plan.order.map(function(n){ return days[n.id]; })));
    var docs = plan.order.filter(function(n){ return n.lang === 'doc'; }), sheets = plan.order.filter(function(n){ return n.lang === 'sheet'; });
    L.push('# Регламент процесса «' + curProj().name + '»', '', 'Сформирован автоматически по схеме в Triosteum, ' + today + '.', '');
    L.push('## 1. Назначение', '');
    L.push('Регламент описывает порядок подготовки, согласования и учёта документов' + (docs.length ? ': ' + docs.map(function(n){ return '«' + n.name + '»'; }).join(', ') : '') + '.');
    if(sheets.length) L.push('Источники данных: ' + sheets.map(function(n){ return '«' + n.name + '»'; }).join(', ') + '.');
    L.push('', '## 2. Участники', '');
    if(who.length) who.forEach(function(w){ L.push('- ' + w); }); else L.push('- Этапы с ответственными на схеме не заданы.');
    L.push('', '## 3. Порядок действий', '');
    plan.order.forEach(function(n, i){
      var p = params(n), from = plan.preds[n.id].map(function(x){ var y = nodeById(x); return y ? '«' + y.name + '»' : ''; }).filter(Boolean);
      var t = (i + 1) + '. **' + n.name + '** — ';
      if(n.kind === 'hub') t += 'объединение потоков записей' + (from.length ? ' из ' + from.join(', ') : '') + '.';
      else if(n.lang === 'sheet'){ var d = parseSheet(nodeCode(n)); t += from.length ? 'реестр: к имеющимся записям (' + (d.rows.length - 1) + ') добавляются записи из ' + from.join(', ') + '.' : 'таблица-источник: ' + plural(d.rows.length - 1, 'запись', 'записи', 'записей') + ', столбцы — ' + d.rows[0].join(', ') + '.'; }
      else if(n.lang === 'doc'){ var f = docFields(nodeCode(n)); t += 'документ формируется по шаблону для каждой записи' + (from.length ? ' из ' + from.join(', ') : '') + (f.length ? '; заполняемые поля: ' + f.join(', ') : '') + '.'; }
      else if(n.lang === 'step') t += (p.action || 'этап') + '. Ответственный: ' + (p.who || 'не назначен') + '. Срок: ' + (+p.days || 0) + ' раб. дн.' + (p.note ? ' Примечание: ' + p.note + '.' : '');
      else if(n.lang === 'cond') t += 'дальше передаются только записи, где «' + (p.field || '?') + '» ' + (OPS.filter(function(o){ return o[0] === p.op; })[0] || ['', p.op])[1] + ' ' + (p.value || '') + '; остальные останавливаются на этом шаге.';
      else if(n.lang === 'send'){ var fm = FORMATS.filter(function(o){ return o[0] === p.format; })[0]; t += 'выгрузка: ' + (fm ? fm[1] : p.format) + (p.to ? ', получатель — ' + p.to : '') + (p.name ? ', «' + p.name + '»' : '') + '.'; }
      else if(n.lang === 'python') t += 'автоматический расчёт (Python): ' + (n.desc || 'обработка записей') + '.';
      else t += n.desc || '';
      L.push(t);
    });
    if(plan.cyclic.length) L.push('', '> Внимание: блоки ' + plan.cyclic.map(function(n){ return '«' + n.name + '»'; }).join(', ') + ' образуют замкнутый круг и в маршрут не входят.');
    L.push('', '## 4. Сроки', '', 'Нормативный срок прохождения маршрута по самой длинной цепочке этапов — **' + total + ' рабочих дней**.');
    L.push('', '## 5. Контроль и хранение', '', '- Статус каждого документа фиксируется на каждом этапе маршрута в Triosteum.', '- Сформированные документы и выгрузки хранятся в электронном архиве не менее 5 лет.', '- Изменения регламента вносятся изменением схемы; регламент формируется заново автоматически.');
    return L.join('\n') + '\n';
  }
