  /* ---------- ИИ-помощник для блока ---------- */
  var AI = { api:undefined, state:{} };   // state[nodeId] = { busy, text, err, code }
  // где работает ИИ: на своём сервере (модель подключена к серверу Triosteum) или в claude.ai
  if(SERVER && window.TRIOSTEUM_BOOT.ai && window.TRIOSTEUM_BOOT.ai.enabled){
    AI.api = serverAI;
  } else if(!SERVER && window.claude && typeof window.claude.use === 'function'){
    window.claude.use('sample').then(function(s){ AI.api = s || null; if(S.pop && S.sel && S.sel.type === 'node') renderPop(); },
                                       function(){ AI.api = null; if(S.pop && S.sel && S.sel.type === 'node') renderPop(); });
  } else AI.api = null;

  function aiOffText(){
    return SERVER ? 'ИИ на этом сервере не подключён. Его включает администратор: модель указывается в настройках сервера (AI_PROVIDER).'
                  : 'ИИ работает, когда Triosteum открыт в claude.ai или с сервера, к которому подключена модель.';
  }
  // запрос к ИИ через сервер Triosteum: ответ приходит по частям, как печатается
  function serverAI(prompt, opts){
    opts = opts || {};
    return fetch('/api/ai/complete', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ prompt:prompt, task:opts.task || 'other' }) }).then(function(r){
      if(!r.ok) return r.json().catch(function(){ return {}; }).then(function(d){
        var e = new Error(d.detail || ('ошибка ' + r.status)); if(r.status === 429) e.code = 'rate_limited'; throw e;
      });
      var text = '', dec = new TextDecoder();
      function done(){
        var k = text.indexOf('\u0000ERR:');
        if(k >= 0){ throw new Error(text.slice(k + 5)); }
        return { text:text };
      }
      if(!r.body || !r.body.getReader) return r.text().then(function(t){ text = t; return done(); });
      var rd = r.body.getReader();
      function pump(){
        return rd.read().then(function(x){
          if(x.done){ text += dec.decode(); return done(); }
          text += dec.decode(x.value, { stream:true });
          var shown = text.split('\n\u0000ERR:')[0];
          if(opts.onText) try{ opts.onText({ text:shown }); }catch(e){}
          return pump();
        });
      }
      return pump();
    });
  }

  var FENCE = String.fromCharCode(96, 96, 96);
  function extractCode(text){
    var i = text.indexOf(FENCE); if(i < 0) return null;
    var j = text.indexOf('\n', i); var k = text.indexOf(FENCE, j + 1);
    if(j < 0 || k < 0) return null;
    return text.slice(j + 1, k).replace(/\s+$/, '') + '\n';
  }
  function renderAiText(box, text){
    box.innerHTML = '';
    text.split(FENCE).forEach(function(part, i){
      if(i % 2 === 0){ var t = part.replace(/^\n+|\n+$/g, ''); if(t) box.appendChild(document.createTextNode(t + '\n')); }
      else { var pre = document.createElement('pre'); pre.textContent = part.replace(/^[^\n]*\n/, ''); box.appendChild(pre); }
    });
  }
  function aiFail(err){
    if(err && err.code === 'rate_limited') return 'Слишком много запросов. Попробуйте через минуту.';
    if(err && err.code === 'not_granted') return 'Доступ к ИИ не разрешён в этом просмотре.';
    return 'Не получилось получить ответ: ' + ((err && err.message) || 'неизвестная ошибка');
  }
  function askAI(n, question){
    if(!AI.api || !question || !question.trim()) return;
    var st = AI.state[n.id] = { busy:true, text:'', err:null, code:null };
    renderPop();
    var l = langById(n.lang);
    var ins = G.edges.filter(function(e){ return e.to === n.id; }).map(function(e){ var a = nodeById(e.from); return a ? a.name : ''; }).filter(Boolean);
    var outs = G.edges.filter(function(e){ return e.from === n.id; }).map(function(e){ var b = nodeById(e.to); return b ? b.name : ''; }).filter(Boolean);
    var cms = commentsOf(n.id).map(function(t){ return t.text; }).filter(Boolean);
    var tag = n.lang === 'csharp' ? 'csharp' : (n.lang === '1c' ? 'bsl' : (n.lang === 'doc' ? 'html' : (isDocs() && n.lang !== 'python' ? 'json' : n.lang)));
    var rules = !isDocs() || n.lang === 'python' ? [
      'Если просят изменить код — сначала 1–3 предложения о том, что изменено, затем ПОЛНЫЙ новый код блока одним блоком кода с тегом языка.',
      'Если код менять не нужно — не присылай блок кода.',
      'Сохраняй структуру плагина Triosteum (декоратор или макрос блока и функцию run / Run / Выполнить).' + (isDocs() ? ' В среде документов run получает список записей (словарей) и возвращает список записей.' : '')
    ] : n.lang === 'doc' ? [
      'Блок — шаблон документа в HTML. Используй только простые теги: h1, h2, p, b, i, u, ol, ul, li, table, tr, th, td, br и style="text-align:…".',
      'Поля для подстановки из таблицы пишутся как {{Название поля}}. Деловой русский язык, реквизиты и формулировки как в российском документообороте.',
      'Если просят изменить — 1–3 предложения о правках, затем ПОЛНЫЙ новый HTML одним блоком с тегом html. Если менять не нужно — без блока кода.'
    ] : n.lang === 'sheet' ? [
      'Блок — таблица в формате JSON: {"rows":[["Заголовок 1","Заголовок 2"],["значение","=B2*C2"]]}. Первая строка — заголовки, все значения строками.',
      'Формулы как в Excel начинаются с «=»: ссылки A1, диапазоны A2:A9, функции SUM/СУММ, AVERAGE/СРЗНАЧ, MIN, MAX, COUNT, ROUND/ОКРУГЛ, IF/ЕСЛИ, разделитель аргументов «;».',
      'Если просят изменить — 1–3 предложения о правках, затем ПОЛНЫЙ JSON одним блоком с тегом json. Если менять не нужно — без блока кода.'
    ] : [
      'Блок — параметры этапа маршрута в JSON. ' + (n.lang === 'step' ? 'Поля: action (Согласовать / Проверить / Подписать / Зарегистрировать / Утвердить / Ознакомить / Исполнить), who (должность), days (рабочих дней), note.' :
        n.lang === 'cond' ? 'Поля: field (название столбца), op (> < >= <= = != содержит), value.' : 'Поля: format (xlsx / csv / html / email / 1c / archive), to (получатель), name (название файла или тема письма).'),
      'Если просят изменить — 1–2 предложения, затем ПОЛНЫЙ JSON одним блоком с тегом json.'
    ];
    var prompt = [
      'Ты — ИИ-помощник в Triosteum, платформе для автоматизации и аналитики производственных компаний.',
      'Пользователь работает с блоком на доске (среда «' + ENV.name + '»). Отвечай по-русски, кратко и по делу.'
    ].concat(rules).concat([
      '',
      'Блок: ' + n.name,
      'Язык: ' + l.name,
      'Описание: ' + (n.desc || 'нет'),
      'Получает данные от блоков: ' + (ins.join(', ') || 'нет'),
      'Передаёт данные блокам: ' + (outs.join(', ') || 'нет'),
      'Комментарии пользователя к блоку: ' + (cms.join(' | ') || 'нет'),
      '',
      isDocs() && n.lang !== 'python' ? 'Текущее содержимое блока:' : 'Текущий код:',
      FENCE + tag,
      nodeCode(n).replace(/\s+$/, ''),
      FENCE,
      '',
      'Запрос пользователя: ' + question.trim()
    ]).join('\n');
    AI.api(prompt, {
      task:'block', cache:false,
      onText:function(ev){
        st.text = ev.text;
        var box = el.pop.querySelector('.ai-out');
        if(box && S.sel && S.sel.id === n.id){ renderAiText(box, st.text); box.scrollTop = box.scrollHeight; }
      }
    }).then(function(r){
      st.busy = false; st.text = r.text; st.code = extractCode(r.text);
      if(S.pop && S.sel && S.sel.id === n.id) renderPop();
    }, function(err){
      st.busy = false; st.err = aiFail(err);
      if(err && err.text) st.text = err.text;
      if(S.pop && S.sel && S.sel.id === n.id) renderPop();
    });
  }
  function aiSection(n){
    var box = h('div', { 'class':'ai' });
    box.appendChild(h('div', { 'class':'flabel', style:'margin:0', text:'ИИ-помощник' }));
    if(AI.api === null){
      box.appendChild(h('div', { 'class':'ai-note', text:aiOffText() }));
      return box;
    }
    if(AI.api === undefined){
      box.appendChild(h('div', { 'class':'ai-note', text:'Подключаю ИИ…' }));
      return box;
    }
    var st = AI.state[n.id], busy = !!(st && st.busy);
    var quick = isDocs() && n.lang === 'doc' ? [
      ['Объяснить', 'Кратко объясни, что это за документ, какие поля в нём заполняются и откуда их брать.'],
      ['Проверить', 'Проверь документ: пропущенные реквизиты, противоречия, юридические риски. Если нужно — пришли исправленный HTML.'],
      ['Улучшить текст', 'Улучши формулировки в деловом стиле, сохрани все поля {{…}}. Пришли новый HTML.'],
      ['Добавить раздел', 'Добавь недостающие разделы (ответственность сторон, форс-мажор, порядок разрешения споров), если их нет. Пришли новый HTML.']
    ] : isDocs() && n.lang === 'sheet' ? [
      ['Объяснить', 'Кратко объясни, что в таблице и что считают формулы.'],
      ['Проверить формулы', 'Проверь формулы на ошибки и пропущенные ссылки. Если нужно — пришли исправленный JSON.'],
      ['Добавить итоги', 'Добавь строку «Итого» с суммами по числовым столбцам. Пришли новый JSON.'],
      ['Добавить НДС', 'Добавь столбцы «НДС 20%» и «Сумма без НДС» с формулами от столбца с суммой. Пришли новый JSON.']
    ] : isDocs() && n.lang !== 'python' ? [
      ['Объяснить', 'Кратко объясни, что делает этот этап маршрута.'],
      ['Предложить параметры', 'Предложи разумные параметры для этого блока на производственном предприятии и пришли JSON.']
    ] : [
      ['Объяснить', 'Объясни простыми словами, что делает этот блок и какие данные он ждёт на входе.'],
      ['Найти ошибки', 'Проверь код на ошибки и слабые места. Если есть что исправить — пришли исправленный код.'],
      ['Улучшить', 'Улучши код: читаемость, надёжность, обработка пустых и некорректных данных. Пришли новый код.'],
      ['Комментарии в коде', 'Добавь в код понятные комментарии на русском, логику не меняй. Пришли новый код.']
    ];
    var chips = h('div', { 'class':'ai-chips' });
    quick.forEach(function(q){
      chips.appendChild(h('button', { type:'button', 'class':'chip', text:q[0], disabled:busy ? 'disabled' : null, on:{ click:function(){ askAI(n, q[1]); } } }));
    });
    box.appendChild(chips);
    var ta = h('textarea', { 'class':'input', id:'aiQ', rows:'2', placeholder:'Что сделать с блоком? Например: «добавь порог 15% и предупреждение»' });
    var send = h('button', { type:'button', 'class':'btn sm primary', text:busy ? 'Думаю…' : 'Спросить', disabled:busy ? 'disabled' : null,
      on:{ click:function(){ askAI(n, ta.value); } } });
    ta.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); askAI(n, ta.value); } });
    box.appendChild(h('label', { 'for':'aiQ', 'class':'sr', text:'Запрос к ИИ' }));
    box.appendChild(h('div', { 'class':'ai-row' }, [ ta, send ]));
    if(st){
      var out = h('div', { 'class':'ai-out' + (st.err && !st.text ? ' err' : ''), 'aria-live':'polite' });
      if(st.text) renderAiText(out, st.text); else out.textContent = st.err || 'Думаю…';
      if(st.err && st.text) out.appendChild(h('div', { style:'color:var(--danger,#FCA5A5);margin-top:6px', text:st.err }));
      box.appendChild(out);
      if(!busy && st.code){
        box.appendChild(h('div', { 'class':'acts' }, [
          h('button', { type:'button', 'class':'btn sm primary', text:isDocs() ? 'Применить' : 'Применить код', on:{ click:function(){
            n.codes[n.lang] = st.code; saveGraph(); refreshNode(n); st.code = null; st.text += '\n\n✓ Изменения применены к блоку.'; toast('Блок обновлён'); renderPop(); } } }),
          (isDocs() && isParamKind(n.lang)) ? null : h('button', { type:'button', 'class':'btn sm', text:isDocs() ? 'Открыть' : 'Открыть код', on:{ click:function(){ openNode(n.id); } } })
        ]));
      }
    }
    return box;
  }

  function refreshNode(n){
    var old = domOf('node', n.id);
    if(old){ var fresh = nodeEl(n); old.parentNode.replaceChild(fresh, old); }
    renderEdges(); saveGraph();
  }
  function setNodeLang(n, id){
    n.lang = id; refreshNode(n); renderPop();
    var v = variantKind(n, id);
    toast(v.ok ? 'Блок переключён на ' + shortName(langById(id)) + ': ' + v.t : 'Для ' + shortName(langById(id)) + ' готового аналога нет — подставлен шаблон');
  }
  function duplicateNode(n){
    var c = JSON.parse(JSON.stringify(n));
    c.id = newId('n'); c.x += 32; c.y += 32; c.name = n.name + ' (копия)';
    G.nodes.push(c); S.sel = { type:'node', id:c.id }; saveGraph(); renderGraph(); renderPop();
  }
  function saveNodeAsPlugin(n){
    var p = { id:'my-' + Date.now(), my:true, name:n.name, lang:n.lang, desc:n.desc || 'Сохранено с доски', family:n.family || null, codes:{} };
    p.codes[n.lang] = nodeCode(n);
    MY.unshift(p); saveMy(); renderChips(); renderList();
    toast('«' + n.name + '» сохранён в «Мои плагины»');
  }
