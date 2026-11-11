  /* =====================================================================
     ИИ-РАЗБОР ОШИБОК КОМПИЛЯТОРА
     Для каждой ошибки во вкладке «Ошибки» ИИ сам, без нажатия кнопок, объясняет причину
     и предлагает 2–3 варианта исправления. У варианта с кодом — «Применить» (отменяется Ctrl+Z)
     и «Показать код». Работает с тем ИИ, что подключён: сервер Triosteum, Claude или Ollama.
     ===================================================================== */
  var ERRAI = { st:{}, queue:[], running:0, MAX:2 };

  function eaKey(x){ var n = nodeById(x.id); return x.id + '|' + x.msg + '|' + (n ? nodeCode(n).length + ':' + nodeCode(n).slice(0, 400) : ''); }
  function eaTag(n){ return n.lang === 'csharp' ? 'csharp' : n.lang === '1c' ? 'bsl' : n.lang === 'doc' ? 'html' : (n.lang === 'sheet' || n.lang === 'step' || n.lang === 'cond' || n.lang === 'out') ? 'json' : n.lang; }
  function eaShort(v, max){ var t; try { t = typeof v === 'string' ? v : JSON.stringify(v); } catch(e){ t = String(v); } t = t || ''; if(typeof varMask === 'function') t = varMask(t); return t.length > max ? t.slice(0, max) + ' …(обрезано)' : t; }

  function eaPrompt(x, n){
    var l = langById(n.lang), b = CMP.blocks[x.id] || {};
    var ins = G.edges.filter(function(e){ return e.to === n.id; }).map(function(e){
      var a = nodeById(e.from); if(!a) return '';
      return '- «' + a.name + '»' + (CMP.last && CMP.last[a.id] !== undefined ? ': ' + eaShort(CMP.last[a.id], 500) : '');
    }).filter(Boolean);
    return [
      'Ты — ИИ-помощник Triosteum. Блок на доске упал с ошибкой при запуске. Найди причину и предложи исправления.',
      'Отвечай по-русски, коротко. Строго в таком формате, без вступлений:',
      'Причина: <одно-два предложения, почему возникла ошибка>',
      '### Вариант 1: <короткое название, до 6 слов>',
      '<одно-два предложения: что меняем и почему это поможет>',
      FENCE + eaTag(n),
      '<ПОЛНЫЙ исправленный код блока целиком, не фрагмент>',
      FENCE,
      '### Вариант 2: …',
      'Дай 2 или 3 разных варианта: от самого надёжного к простому. Если исправление не в коде (например, нужно задать секрет или подключить сервер) — опиши шаги и не присылай код.',
      'Сохраняй структуру плагина Triosteum (декоратор или макрос блока и функцию run / Run / Выполнить).',
      '',
      'Блок: ' + n.name + ' (' + (l ? l.name : n.lang) + ')',
      'Описание: ' + (n.desc || 'нет'),
      'Ошибка: ' + x.msg,
      b.out && b.out.length ? 'Что блок успел напечатать:\n' + b.out.slice(-12).join('\n') : '',
      'Входные данные от блоков выше по схеме:\n' + (ins.join('\n') || 'нет'),
      '',
      'Код блока:',
      FENCE + eaTag(n),
      nodeCode(n).replace(/\s+$/, ''),
      FENCE
    ].filter(function(s){ return s !== ''; }).join('\n');
  }

  // разбор ответа: «Причина: …» и разделы «### Вариант N: название», в каждом — текст и, возможно, код
  function eaParse(text){
    var r = { cause:'', opts:[] };
    var parts = String(text || '').split(/^\s*#{2,4}\s*Вариант\s*\d+\s*[:.)—-]?\s*/mi);
    var head = parts.shift() || '';
    r.cause = head.replace(/^\s*\**Причина\**\s*[:—-]\s*/i, '').replace(/\s+/g, ' ').trim();
    parts.forEach(function(p){
      var nl = p.indexOf('\n'), title = (nl < 0 ? p : p.slice(0, nl)).replace(/[*_#]/g, '').trim(), body = nl < 0 ? '' : p.slice(nl + 1);
      var code = extractCode(body), why = body.split(FENCE)[0].replace(/\s+/g, ' ').trim();
      if(title || why) r.opts.push({ title:title || 'Вариант', why:why, code:code });
    });
    return r;
  }

  function eaRun(x){
    var k = eaKey(x), n = nodeById(x.id);
    if(!n || !AI.api) return;
    var st = ERRAI.st[k] = { busy:true, text:'', err:null, res:null, applied:-1 };
    ERRAI.running++;
    AI.api(eaPrompt(x, n), { task:'block', cache:false, onText:function(ev){ st.text = ev.text; st.res = eaParse(st.text); eaPaint(k); } })
      .then(function(r){ st.text = r.text; st.res = eaParse(r.text); },
            function(err){ st.err = aiFail(err); })
      .then(function(){ st.busy = false; ERRAI.running--; eaPaint(k); eaPump(); });
    eaPaint(k);
  }
  function eaPump(){
    while(ERRAI.running < ERRAI.MAX && ERRAI.queue.length){ var x = ERRAI.queue.shift(); if(!ERRAI.st[eaKey(x)]) eaRun(x); }
  }
  function eaWant(x){
    if(!AI.api || ERRAI.st[eaKey(x)] || ERRAI.queue.some(function(q){ return eaKey(q) === eaKey(x); })) return;
    ERRAI.queue.push(x); eaPump();
  }
  // перерисовать только блок ИИ у одной ошибки (пока печатается ответ)
  function eaPaint(k){
    var host = Array.prototype.filter.call(document.querySelectorAll('#runErrs .ea'), function(e){ return e.eaKey === k; })[0];
    if(host) eaFill(host, host.eaErr);
  }

  // блок «ИИ-разбор» под ошибкой
  function errAiSection(x){
    var box = h('div', { 'class':'ea', 'aria-live':'polite' });
    box.eaKey = eaKey(x); box.eaErr = x;
    eaFill(box, x);
    if(AI.api && !CMP.busy) setTimeout(function(){ eaWant(x); }, 0);
    return box;
  }
  function eaFill(box, x){
    var k = box.eaKey, st = ERRAI.st[k], n = nodeById(x.id);
    box.textContent = '';
    var head = h('div', { 'class':'ea-h' }, [ h('span', { 'class':'ea-badge', text:'✦ ИИ-разбор' }) ]);
    box.appendChild(head);
    if(!AI.api){
      box.appendChild(h('div', { 'class':'ea-off', text:'Включите ИИ в шапке (Claude или бесплатная Ollama) — он сам предложит, как исправить ошибку.' }));
      return;
    }
    if(!st){ head.appendChild(h('span', { 'class':'ea-wait', text:CMP.busy ? 'после запуска' : 'в очереди…' })); return; }
    if(st.busy) head.appendChild(h('span', { 'class':'ea-wait' }, [ h('i', { 'class':'ea-spin' }), document.createTextNode(st.res && st.res.opts.length ? 'пишет варианты…' : 'разбирает ошибку…') ]));
    else head.appendChild(h('button', { type:'button', 'class':'ea-again', text:'Ещё варианты', on:{ click:function(e){ e.stopPropagation(); delete ERRAI.st[k]; eaRun(x); } } }));
    if(st.err && !(st.res && (st.res.cause || st.res.opts.length))){ box.appendChild(h('div', { 'class':'ea-err', text:st.err })); return; }
    var res = st.res || { cause:'', opts:[] };
    if(res.cause) box.appendChild(h('div', { 'class':'ea-cause' }, [ h('b', { text:'Причина: ' }), document.createTextNode(res.cause) ]));
    if(!st.busy && !res.opts.length && st.text){ var raw = h('div', { 'class':'ea-raw' }); renderAiText(raw, st.text); box.appendChild(raw); }
    res.opts.forEach(function(o, i){
      var card = h('div', { 'class':'ea-opt' + (st.applied === i ? ' done' : '') });
      card.appendChild(h('div', { 'class':'ea-ot' }, [ h('span', { 'class':'ea-num', text:String(i + 1) }), h('b', { text:o.title }) ]));
      if(o.why) card.appendChild(h('p', { text:o.why }));
      if(o.code && !st.busy){
        var pre = h('pre', { 'class':'ea-code', hidden:'' }); pre.textContent = o.code;
        var acts = h('div', { 'class':'ea-acts' }, [
          st.applied === i ? h('span', { 'class':'ea-ok', text:'✓ Применено' }) : h('button', { type:'button', 'class':'btn sm primary', text:'Применить', on:{ click:function(e){
            e.stopPropagation(); if(!n) return;
            n.codes[n.lang] = o.code; saveGraph(); refreshNode(n); st.applied = i; ERRAI.st[eaKey(x)] = st; box.eaKey = eaKey(x); eaFill(box, x);   // код сменился — разбор остаётся тем же
            toast('Код блока «' + n.name + '» исправлен — запустите снова. Отменить: ' + (IS_MAC ? '⌘Z' : 'Ctrl+Z'));
          } } }),
          h('button', { type:'button', 'class':'btn sm', text:'Показать код', on:{ click:function(e){ e.stopPropagation(); pre.hidden = !pre.hidden; this.textContent = pre.hidden ? 'Показать код' : 'Скрыть код'; } } }),
          st.applied === i ? h('button', { type:'button', 'class':'btn sm', text:'Запустить снова', on:{ click:function(e){ e.stopPropagation(); var g = $('runGo'); if(g && !g.disabled) g.click(); } } }) : null
        ]);
        card.appendChild(acts); card.appendChild(pre);
      }
      box.appendChild(card);
    });
  }
  // после запуска — разобрать все ошибки (по две одновременно)
  (function(){
    var _end = cmpEnd;
    cmpEnd = function(){ var r = _end.apply(this, arguments); if(AI.api) CMP.errs.forEach(eaWant); return r; };
  })();
