  /* =====================================================================
     ИИ-архитектор (кнопка «AI» на доске) и окно «Целостный код схемы»
     ===================================================================== */
  function langTag(l){ return l === 'csharp' ? 'csharp' : (l === '1c' ? 'bsl' : l); }
  function pyStr(s){ return JSON.stringify(String(s)); }
  function indent(s, pad){ return String(s).replace(/\s+$/, '').split('\n').map(function(l){ return l ? pad + l : l; }).join('\n'); }

  // ---------- автоматическая сборка бэкенда из блоков ----------
  function assembleBackend(){
    var plan = boardOrder(), name = curProj().name, L = [];
    var bar = function(t){ return '# ' + '─'.repeat(3) + ' ' + t + ' ' + '─'.repeat(Math.max(3, 66 - t.length)); };
    L.push('# Triosteum — целостный код схемы «' + name + '»');
    L.push('# Собран автоматически из блоков доски в порядке компиляции:');
    L.push('#   ' + (plan.order.map(function(n){ return n.name; }).join(' → ') || 'блоков нет'));
    if(plan.cyclic.length) L.push('# ВНИМАНИЕ: в замкнутом круге и не выполняются: ' + plan.cyclic.map(function(n){ return n.name; }).join(', '));
    L.push('# Python-блоки выполняются здесь же; 1С, C++ и C# вызываются через адаптеры на сервере.');
    L.push('');
    L.push('import json, sys, types');
    L.push('');
    L.push(bar('среда Triosteum'));
    L.push('_blocks = []');
    L.push('def block(name="Блок", sample=None, **kw):');
    L.push('    def deco(fn):');
    L.push('        fn._t_name, fn._t_sample = name, sample');
    L.push('        _blocks.append(fn)');
    L.push('        return fn');
    L.push('    return deco');
    // var()/secret() берём у модуля среды запуска (сервер Triosteum), вне Triosteum — значения по умолчанию
    L.push('_prev = sys.modules.get("triosteum")');
    L.push('_mod = types.ModuleType("triosteum"); _mod.block = block');
    L.push('_mod.var = getattr(_prev, "var", lambda name, default=None: default)');
    L.push('_mod.secret = getattr(_prev, "secret", lambda name, default=None: default)');
    L.push('sys.modules["triosteum"] = _mod');
    L.push('');
    L.push('def external(runtime, name, source, data):');
    L.push('    """Адаптер внешней среды. На сервере Triosteum передаёт код и данные в ' + "1С / .NET / GCC" + '."""');
    L.push('    print(f"   ↪ {name}: выполняется в среде {runtime} (в браузере — пропуск, данные идут дальше)")');
    L.push('    return data');
    L.push('');
    L.push('def _inputs(results, ids):');
    L.push('    vals = [results[i] for i in ids if results.get(i) is not None]');
    L.push('    return None if not vals else (vals[0] if len(vals) == 1 else vals)');
    L.push('');
    var steps = [];
    plan.order.forEach(function(n, i){
      var l = langById(n.lang), title = (i + 1) + '. ' + n.name + ' (' + shortName(l) + ')';
      L.push(bar(title));
      if(n.lang === 'python'){
        L.push(nodeCode(n).replace(/\s+$/, ''));
        L.push('STEP_' + (i + 1) + ' = _blocks[-1]');
        steps.push({ n:n, i:i + 1, kind:'py' });
      } else if(n.lang === 'html'){
        L.push('# HTML-виджет: отображается на дашборде, в бэкенде данные передаются дальше без изменений');
        steps.push({ n:n, i:i + 1, kind:'html' });
      } else {
        L.push('SOURCE_' + (i + 1) + ' = ' + pyStr(nodeCode(n)));
        steps.push({ n:n, i:i + 1, kind:'ext', rt:shortName(l) });
      }
      L.push('');
    });
    L.push(bar('конвейер'));
    L.push('def main():');
    L.push('    results = {}');
    if(!steps.length) L.push('    pass');
    steps.forEach(function(s){
      var ids = '[' + plan.preds[s.n.id].map(function(x){ return pyStr(x); }).join(', ') + ']';
      L.push('    # ' + s.i + '. ' + s.n.name);
      L.push('    data = _inputs(results, ' + ids + ')');
      if(s.kind === 'py'){
        L.push('    if data is None: data = STEP_' + s.i + '._t_sample');
        L.push('    print("▶ ' + s.n.name.replace(/"/g, '\\"') + '")');
        L.push('    results[' + pyStr(s.n.id) + '] = STEP_' + s.i + '(data)');
      } else if(s.kind === 'ext'){
        L.push('    results[' + pyStr(s.n.id) + '] = external(' + pyStr(s.rt) + ', ' + pyStr(s.n.name) + ', SOURCE_' + s.i + ', data)');
      } else {
        L.push('    results[' + pyStr(s.n.id) + '] = data');
      }
    });
    L.push('    final = [results[k] for k in ' + '[' + plan.order.filter(function(n){ return !G.edges.some(function(e){ return e.from === n.id; }); }).map(function(n){ return pyStr(n.id); }).join(', ') + ']' + ' if results.get(k) is not None]');
    L.push('    print("◀ Итог схемы:", json.dumps(final[0] if len(final) == 1 else final, ensure_ascii=False, default=str)[:2000])');
    L.push('    return results');
    L.push('');
    L.push('if __name__ == "__main__":');
    L.push('    main()');
    return L.join('\n') + '\n';
  }

  // ---------- окно «Целостный код схемы» ----------
  var SC = { tab:'auto', busy:false, err:null, out:'' }, scWin = null;
  function openScheme(){
    closeCtx(); hidePop(); closeAddMenu();
    if(S.view !== 'canvas'){ S.view = 'canvas'; render(); renderGraph(); }
    $('schemeW').hidden = false; $('bScheme').setAttribute('aria-pressed', 'true');
    if(!scWin) scWin = makeWindow($('schemeW'), '.pers-h', 'scheme', 'fixed');
    scWin.apply(); if(SC.tab === 'ai' && !G.backend) SC.tab = 'auto'; renderScheme();
  }
  function closeScheme(){ $('schemeW').hidden = true; $('bScheme').setAttribute('aria-pressed', 'false'); }
  $('bScheme').addEventListener('click', function(){ $('schemeW').hidden ? openScheme() : closeScheme(); });
  $('scClose').addEventListener('click', closeScheme);
  $('schemeW').addEventListener('keydown', function(e){ if(e.key === 'Escape'){ closeScheme(); $('bScheme').focus(); } });
  function autoScheme(){ return isDocs() ? assembleReglament() : assembleBackend(); }
  function schemeCode(){ return SC.tab === 'ai' && G.backend ? G.backend.code : autoScheme(); }
  function renderScheme(){
    var b = $('scBody'); b.innerHTML = '';
    var tabs = h('div', { 'class':'seg', role:'tablist' });
    (isDocs() ? [['auto', 'Из схемы'], ['ai', 'Регламент от ИИ']] : [['auto', 'Собран из блоков'], ['ai', 'Бэкенд от ИИ']]).forEach(function(t){
      var on = SC.tab === t[0];
      tabs.appendChild(h('button', { type:'button', role:'tab', 'aria-selected':on ? 'true' : 'false', 'class':'btn sm' + (on ? ' on' : ''), text:t[1],
        on:{ click:function(){ SC.tab = t[0]; SC.out = ''; renderScheme(); } } }));
    });
    var bar = h('div', { 'class':'sc-bar' }, [ tabs ]);
    b.appendChild(bar);
    var code = null;
    if(SC.tab === 'auto'){
      b.appendChild(h('div', { 'class':'bld-stat', text:isDocs() ? 'Всегда совпадает с доской: участники, порядок действий, ответственные и сроки собираются из этапов маршрута.' : 'Всегда совпадает с доской: блоки Python встроены как есть, 1С / C++ / C# подключены через адаптеры, данные идут по связям.' }));
      code = autoScheme();
    } else if(G.backend){
      b.appendChild(h('div', { 'class':'bld-stat', text:'Написан ИИ ' + new Date(G.backend.at).toLocaleString('ru-RU', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' }) + (G.backend.prompt ? ' по запросу: «' + G.backend.prompt.slice(0, 140) + '»' : '') + '. Если схема менялась — сгенерируйте заново.' }));
      code = G.backend.code;
    } else {
      b.appendChild(h('div', { 'class':'bld-issue info', text:isDocs() ? 'ИИ ещё не писал регламент для этой схемы. Он прочитает шаблоны, таблицы и этапы и напишет положение о процессе: участники, ответственность, порядок, сроки, контроль.' : 'ИИ ещё не писал бэкенд для этой схемы. Он прочитает все блоки и связи и напишет единый файл с конвейером, обработкой ошибок и подключением к 1С и серверным модулям.' }));
    }
    if(code !== null){
      var pre = h('pre', { 'class':'sc-code', tabindex:'0', 'aria-label':'Код схемы' }); if(isDocs()) pre.textContent = code; else hlBlock(pre, code, 'python');
      b.appendChild(pre);
      b.appendChild(h('div', { 'class':'bld-stat', text:'Строк: ' + code.split('\n').length }));
    }
    var aiOff = !AI.api;
    var acts = h('div', { 'class':'bld-acts' }, [
      code !== null && !isDocs() ? h('button', { type:'button', 'class':'btn primary', text:'Запустить в Python', on:{ click:function(){ runScheme(code); } } }) : null,
      code !== null ? h('button', { type:'button', 'class':'btn', text:'Копировать', on:{ click:function(){ copyText(code, 'Код схемы скопирован'); } } }) : null,
      code !== null ? h('button', { type:'button', 'class':'btn', text:isDocs() ? 'Скачать .md' : 'Скачать .py', on:{ click:function(){
        if(isDocs()) download(fileBase(curProj().name, 'reglament') + '_reglament.md', code, 'text/markdown', 'Регламент сохранён');
        else download(fileBase(curProj().name, 'shema') + '_backend.py', code, 'text/plain', 'Файл бэкенда сохранён'); } } }) : null,
      SC.tab === 'ai' ? h('button', { type:'button', 'class':'btn' + (G.backend ? '' : ' primary'), text:SC.busy ? 'ИИ пишет…' : (G.backend ? 'Сгенерировать заново' : (isDocs() ? 'Написать регламент с ИИ' : 'Написать бэкенд с ИИ')),
        disabled:(SC.busy || aiOff || !G.nodes.length) ? 'disabled' : null, on:{ click:genBackend } }) : null
    ].filter(Boolean));
    bar.appendChild(acts);
    if(SC.tab === 'ai' && aiOff) b.appendChild(h('div', { 'class':'bld-issue warn', text:aiOffText() }));
    if(SC.err) b.appendChild(h('div', { 'class':'bld-issue err', text:SC.err }));
    if(SC.out){ var o = h('pre', { 'class':'sc-out', 'aria-live':'polite' }); o.textContent = SC.out; b.appendChild(o); }
  }
  function copyText(t, msg){
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ toast(msg); }, function(){ toast('Браузер не разрешил копирование'); });
    else toast('Браузер не разрешил копирование');
  }
  function runScheme(code){
    SC.out = RUN_SERVER ? 'Запуск на сервере…\n' : 'Загружаю Python…\n'; SC.err = null; renderScheme();
    // секреты блоков в выводе схемы не показываем
    function log(t){ SC.out += (typeof varMask === 'function' ? varMask(String(t)) : t) + '\n'; var o = $('scBody').querySelector('.sc-out'); if(!o){ renderScheme(); o = $('scBody').querySelector('.sc-out'); } if(o){ o.textContent = SC.out; o.scrollTop = o.scrollHeight; } }
    if(RUN_SERVER){
      serverRun(code, null, 'script').then(function(r){
        SC.out = ''; renderScheme();
        printLines(r.stdout, log); printLines(r.stderr, log);
        log(r.ok ? 'Готово за ' + r.ms + ' мс.' : '✗ ' + r.error);
      });
      return;
    }
    loadPy(log).then(function(py){
      SC.out = ''; renderScheme();
      py.setStdout({ batched:log }); py.setStderr({ batched:log });
      try{ py.runPython(code.replace(/if __name__ == "__main__":/, 'if True:')); log('Готово.'); }
      catch(err){ var m = String(err && err.message || err).split('\n').filter(function(x){ return x.trim(); }); log('✗ ' + m.slice(-1)[0]); }
    }, function(err){ log(err.message + '. Проверьте подключение к интернету.'); });
  }
  function blocksForPrompt(maxLines){
    var plan = boardOrder();
    return plan.order.concat(plan.cyclic).map(function(n, i){
      var code = nodeCode(n).split('\n').slice(0, maxLines).join('\n');
      return '### ' + (i + 1) + '. id=' + n.id + ' «' + n.name + '» (' + langById(n.lang).name + ')\nполучает от: ' +
        (plan.preds[n.id].map(function(p){ var x = nodeById(p); return x ? x.name : p; }).join(', ') || 'нет') + '\n' + FENCE + langTag(n.lang) + '\n' + code.replace(/\s+$/, '') + '\n' + FENCE;
    }).join('\n\n');
  }
  var BACKEND_RULES = [
    'Бэкенд — один файл Python 3, который выполняет всю схему: шаги в порядке связей, результат шага передаётся следующим по связям.',
    'Python-логику блоков перенеси в функции. Шаги на 1С, C++, C# оформи адаптерами (1С — через HTTP-сервис или COM, C++/C# — через собранный модуль / REST-сервис), с понятными комментариями, что настроить.',
    'Добавь логирование шагов, обработку ошибок, конфигурацию (строки подключения, токены) через переменные окружения и функцию main().',
    'Файл должен запускаться в браузерном Python (Pyodide) без внешних пакетов: внешние вызовы оберни так, чтобы без настроек они выводили сообщение и передавали тестовые данные дальше.'
  ].join('\n');
  function genBackend(){
    if(!AI.api || SC.busy) return;
    SC.busy = true; SC.err = null; renderScheme();
    var prompt = isDocs() ? [
      'Ты — эксперт по документообороту и организационному проектированию на российских производственных предприятиях.',
      'По схеме маршрута «' + curProj().name + '» ниже напиши регламент процесса (положение) в Markdown: назначение и область применения, термины, участники и их ответственность, порядок действий по шагам со сроками, контрольные точки и эскалация, хранение документов, перечень шаблонов и форм.',
      'Пиши по существу, деловым языком, опираясь на реальные блоки схемы (таблицы, шаблоны, этапы с ответственными и сроками, условия, выгрузки).',
      'Ответь кратко (1–2 предложения) и затем ПОЛНЫЙ текст регламента одним блоком ' + FENCE + 'markdown.', '', blocksForPrompt(40)
    ].join('\n') : [
      'Ты — ведущий бэкенд-разработчик Triosteum (платформа автоматизации производственных компаний).',
      'Напиши целостный бэкенд-код схемы «' + curProj().name + '» по блокам ниже.', BACKEND_RULES,
      'Ответь кратко (1–2 предложения) и затем ПОЛНЫЙ код одним блоком ' + FENCE + 'python.', '', blocksForPrompt(60)
    ].join('\n');
    AI.api(prompt, { task:'scheme', cache:false }).then(function(r){
      SC.busy = false;
      var code = extractCode(r.text);
      if(!code){ SC.err = 'ИИ не прислал ответ в нужном виде. Попробуйте ещё раз.'; }
      else { G.backend = { code:code, lang:isDocs() ? 'markdown' : 'python', at:Date.now(), prompt:isDocs() ? 'регламент для текущей схемы' : 'бэкенд для текущей схемы' }; saveGraph(); SC.tab = 'ai'; SC.out = ''; }
      if(!$('schemeW').hidden) renderScheme();
    }, function(err){ SC.busy = false; SC.err = aiFail(err); if(!$('schemeW').hidden) renderScheme(); });
  }
