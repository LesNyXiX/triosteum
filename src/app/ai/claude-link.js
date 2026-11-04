  /* =====================================================================
     ПЕРЕКЛЮЧАТЕЛЬ ИИ В ШАПКЕ: временно делает выбранную модель системным ИИ
     Triosteum. Пока он включён, все ИИ-функции (помощник блока, архитектор,
     конструктор, бэкенд, ИИ офиса) идут в неё. Поставщики:
       • Claude (Anthropic) — внутри claude.ai без ключа, иначе с ключом API;
       • Ollama — бесплатная модель на своём компьютере, без интернета;
       • любой сервис, совместимый с API OpenAI (адрес, ключ, модель).
     Выключение возвращает прежний ИИ. Включённость живёт до закрытия вкладки.
     ===================================================================== */
  var CL_MODELS = [
    { id:'claude-opus-5-5', name:'Claude Opus 5.5 — самая сильная' },
    { id:'claude-sonnet-5-5', name:'Claude Sonnet 5.5 — быстрее и дешевле' },
    { id:'claude-haiku-5-5', name:'Claude Haiku 5.5 — самая быстрая' }
  ];
  var CL_PROV = {
    claude:{ name:'Claude', title:'Claude (Anthropic)' },
    ollama:{ name:'Ollama', title:'Ollama — модель на этом компьютере' },
    openai:{ name:'Свой ИИ', title:'Совместимый с OpenAI сервис' }
  };
  var CL_KEY = 'triosteum.claude.key', CL_MODEL = 'triosteum.claude.model', CL_ON = 'triosteum.claude.on', CL_CFG = 'triosteum.ai.cfg', CL_OKEY = 'triosteum.ai.key.openai';
  var CL = { on:false, prev:undefined, src:null, busy:false, status:null, model:CL_MODELS[0].id, inClaude:!!(window.claude && typeof window.claude.use === 'function'), embedded:null,
    prov:'claude', cfg:{ ollama:{ url:'http://localhost:11434', model:'' }, openai:{ url:'', model:'', name:'' } }, models:{} };
  function clStore(kind){ try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch(e){ return null; } }
  function clGet(k){ var s = clStore('session'), l = clStore('local'); try { return (s && s.getItem(k)) || (l && l.getItem(k)) || ''; } catch(e){ return ''; } }
  function clKeyName(p){ return (p || CL.prov) === 'openai' ? CL_OKEY : CL_KEY; }
  function clKey(p){ return clGet(clKeyName(p)); }
  function clSetKey(v, remember, p){
    var s = clStore('session'), l = clStore('local'), k = clKeyName(p);
    try { if(s){ if(v) s.setItem(k, v); else s.removeItem(k); } if(l){ if(v && remember) l.setItem(k, v); else l.removeItem(k); } } catch(e){}
  }
  function clSaveCfg(){ try { var l = clStore('local'); if(l) l.setItem(CL_CFG, JSON.stringify({ prov:CL.prov, ollama:CL.cfg.ollama, openai:CL.cfg.openai })); } catch(e){} }
  try {
    var m0 = clGet(CL_MODEL); if(m0 && CL_MODELS.some(function(m){ return m.id === m0; })) CL.model = m0;
    var c0 = JSON.parse(clGet(CL_CFG) || 'null');
    if(c0){ if(CL_PROV[c0.prov]) CL.prov = c0.prov; ['ollama', 'openai'].forEach(function(p){ if(c0[p]) for(var k in c0[p]) CL.cfg[p][k] = c0[p][k]; }); }
  } catch(e){}
  function clProvName(){ return CL.prov === 'openai' && CL.cfg.openai.name ? CL.cfg.openai.name : CL_PROV[CL.prov].name; }

  var CL_SYSTEM = 'Ты встроен в Triosteum — визуальную среду, где программы собирают из блоков на доске. ' +
    'Отвечай на языке запроса (обычно русском) и строго соблюдай формат, который просит запрос: если нужен код — давай рабочий код в блоке ```.';

  function clError(status, d, raw, who){
    who = who || 'Claude';
    var msg = d && d.error && (d.error.message || (typeof d.error === 'string' ? d.error : '')) || (raw || '');
    var e;
    if(status === 401) e = new Error(who + ': ключ API не подошёл (401). Проверьте ключ.');
    else if(status === 403) e = new Error(who + ': доступ запрещён (403)' + (msg ? ': ' + msg : '') + (who === 'Claude' ? '. API Anthropic работает не во всех странах — из неподдерживаемого региона запросы отклоняются.' : '.'));
    else if(status === 429){ e = new Error(who + ': слишком много запросов (429). Подождите немного и повторите.'); e.code = 'rate_limited'; }
    else if(status === 529 || status === 503) e = new Error(who + ' сейчас перегружен (' + status + '). Повторите через минуту.');
    else if(status === 404) e = new Error(who + ': модель или адрес не найдены (404)' + (msg ? ': ' + msg : '') + '. Проверьте модель в настройках переключателя.');
    else e = new Error(who + ': ошибка ' + status + (msg ? ' — ' + msg : ''));
    e.status = status; return e;
  }
  // общий разбор потока SSE: «data: {...}» блоками через пустую строку
  function clSse(r, onData){
    var buf = '', dec = new TextDecoder();
    if(!r.body || !r.body.getReader) return r.text().then(function(t){ t.split('\n\n').forEach(onData); });
    var rd = r.body.getReader();
    function pump(){
      return rd.read().then(function(x){
        if(x.done){ buf += dec.decode(); if(buf.trim()) onData(buf); return; }
        buf += dec.decode(x.value, { stream:true }).replace(/\r\n/g, '\n');
        var k; while((k = buf.indexOf('\n\n')) >= 0){ var blk = buf.slice(0, k); buf = buf.slice(k + 2); onData(blk); }
        return pump();
      });
    }
    return pump();
  }
  function clBlock(block){ var ev = '', data = ''; block.split('\n').forEach(function(line){ if(line.indexOf('event:') === 0) ev = line.slice(6).trim(); else if(line.indexOf('data:') === 0) data += line.slice(5).trim(); }); return { ev:ev, data:data }; }
  // Claude: прямой запрос к API Anthropic из браузера, ответ приходит потоком
  function claudeHttp(prompt, opts, cfg){
    opts = opts || {}; cfg = cfg || {};
    var key = cfg.key || clKey('claude');
    if(!key) return Promise.reject(new Error('Claude: не задан ключ API — откройте настройки переключателя ИИ в шапке.'));
    var body = { model:cfg.model || CL.model, max_tokens:cfg.max || 16000, stream:true, system:CL_SYSTEM, messages:[{ role:'user', content:String(prompt) }] };
    return fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify(body)
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ var d = null; try { d = JSON.parse(t); } catch(e){} throw clError(r.status, d, t && t.slice(0, 200)); });
      var text = '', stop = null;
      return clSse(r, function(block){
        var b = clBlock(block); if(!b.data) return;
        var d; try { d = JSON.parse(b.data); } catch(e){ return; }
        if(d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta'){ text += d.delta.text; if(opts.onText) try { opts.onText({ text:text }); } catch(e){} }
        else if(d.type === 'message_delta' && d.delta && d.delta.stop_reason) stop = d.delta.stop_reason;
        else if(d.type === 'error' || b.ev === 'error'){ throw clError(d.error && d.error.type === 'overloaded_error' ? 529 : 500, d); }
      }).then(function(){ return { text:text, stop:stop }; });
    }, function(err){
      throw new Error('Claude: нет связи с api.anthropic.com (' + (err && err.message || 'сеть') + '). Сайт может быть недоступен из вашей сети или региона.');
    });
  }
  // Ollama и сервисы, совместимые с OpenAI: /v1/chat/completions с потоком
  function clBase(p){ var u = String(p === 'ollama' ? CL.cfg.ollama.url : CL.cfg.openai.url || '').trim().replace(/\/+$/, ''); if(p === 'ollama' && !/\/v1$/.test(u)) u += '/v1'; return u; }
  function clNetErr(p, err){
    if(p === 'ollama') return new Error('Ollama не отвечает по адресу ' + CL.cfg.ollama.url + '. Проверьте, что программа Ollama запущена и что ей разрешены запросы со страницы (OLLAMA_ORIGINS — инструкция в настройках переключателя).');
    return new Error(clProvName() + ': нет связи с ' + clBase(p) + ' (' + (err && err.message || 'сеть') + '). Сервис может не разрешать запросы из браузера (CORS) или быть недоступен.');
  }
  function oaiHttp(prompt, opts, cfg){
    opts = opts || {}; cfg = cfg || {};
    var p = cfg.prov || CL.prov, base = cfg.url ? String(cfg.url).replace(/\/+$/, '') : clBase(p), model = cfg.model || CL.cfg[p].model, key = p === 'openai' ? (cfg.key !== undefined ? cfg.key : clKey('openai')) : '';
    var who = p === 'ollama' ? 'Ollama' : clProvName();
    if(!base) return Promise.reject(new Error(who + ': не задан адрес сервиса — откройте настройки переключателя ИИ.'));
    if(!model) return Promise.reject(new Error(who + ': не выбрана модель — откройте настройки переключателя ИИ.'));
    var headers = { 'content-type':'application/json' }; if(key) headers.authorization = 'Bearer ' + key;
    var body = { model:model, stream:true, messages:[{ role:'system', content:CL_SYSTEM }, { role:'user', content:String(prompt) }] };
    if(cfg.max) body.max_tokens = cfg.max;
    return fetch(base + '/chat/completions', { method:'POST', headers:headers, body:JSON.stringify(body) }).then(function(r){
      // Ollama: указанной модели нет — берём установленную на компьютере и повторяем запрос
      if(r.status === 404 && p === 'ollama' && !cfg.retried) return clListModels('ollama').then(function(ms){
        var pick = clPickModel(ms); if(!pick) throw clError(404, null, 'на компьютере нет ни одной модели — скачайте её: ollama pull qwen2.5-coder:7b', who);
        CL.cfg.ollama.model = pick; CL.models.ollama = ms; clSaveCfg(); clPaint();
        if(typeof toast === 'function') toast('Ollama: выбрана установленная модель ' + pick);
        return oaiHttp(prompt, opts, { prov:'ollama', retried:true, max:cfg.max, model:pick });
      });
      if(!r.ok) return r.text().then(function(t){ var d = null; try { d = JSON.parse(t); } catch(e){} throw clError(r.status, d, t && t.slice(0, 200), who); });
      var text = '', stop = null;
      return clSse(r, function(block){
        var b = clBlock(block); if(!b.data || b.data === '[DONE]') return;
        var d; try { d = JSON.parse(b.data); } catch(e){ return; }
        if(d.error) throw clError(500, d, '', who);
        var ch = d.choices && d.choices[0]; if(!ch) return;
        var piece = ch.delta && ch.delta.content; if(piece){ text += piece; if(opts.onText) try { opts.onText({ text:text }); } catch(e){} }
        if(ch.finish_reason) stop = ch.finish_reason;
      }).then(function(){ return { text:text, stop:stop }; });
    }, function(err){ throw clNetErr(p, err); });
  }
  // какую из установленных моделей взять: для кода — coder, иначе первую
  function clPickModel(ms){ if(!ms || !ms.length) return null; return ms.filter(function(m){ return /coder/i.test(m); })[0] || ms.filter(function(m){ return !/embed/i.test(m); })[0] || ms[0]; }
  // список моделей сервиса (для Ollama — установленные на компьютере)
  function clListModels(p, cfg){
    cfg = cfg || {};
    var base = cfg.url ? String(cfg.url).replace(/\/+$/, '') : clBase(p), key = p === 'openai' ? (cfg.key !== undefined ? cfg.key : clKey('openai')) : '';
    var headers = {}; if(key) headers.authorization = 'Bearer ' + key;
    return fetch(base + '/models', { headers:headers }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ var d = null; try { d = JSON.parse(t); } catch(e){} throw clError(r.status, d, t && t.slice(0, 200), p === 'ollama' ? 'Ollama' : clProvName()); });
      return r.json().then(function(d){ return (d.data || d.models || []).map(function(m){ return m.id || m.name; }).filter(Boolean).sort(); });
    }, function(err){ throw clNetErr(p, err); });
  }
  // внутри claude.ai ключ не нужен: приложение даёт доступ к Claude само
  function clEmbedded(){
    if(CL.embedded) return Promise.resolve(CL.embedded);
    if(!CL.inClaude) return Promise.resolve(null);
    return window.claude.use('sample').then(function(s){ CL.embedded = s || null; return CL.embedded; }, function(){ return null; });
  }
  function clRefreshUIs(){
    try { if(S.pop && S.sel && S.sel.type === 'node') renderPop(); } catch(e){}
    var pairs = [['builder', typeof renderBuilder === 'function' ? renderBuilder : null], ['arcW', typeof renderArc === 'function' ? renderArc : null], ['schemeW', typeof renderScheme === 'function' ? renderScheme : null], ['ofAi', typeof renderOfAi === 'function' ? renderOfAi : null]];
    pairs.forEach(function(p){ var w = $(p[0]); if(w && !w.hidden && p[1]) try { p[1](); } catch(e){} });
  }
  function clModelName(){ if(CL.prov !== 'claude') return CL.cfg[CL.prov].model || '—'; var m = CL_MODELS.filter(function(x){ return x.id === CL.model; })[0]; return m ? m.name.split(' — ')[0] : CL.model; }
  function clSourceText(){ return CL.src === 'claude.ai' ? 'Claude через claude.ai' : clProvName() + ' · ' + clModelName(); }
  function clPaint(){
    var b = $('claudeBtn'); if(!b) return;
    b.setAttribute('aria-checked', CL.on ? 'true' : 'false');
    b.classList.toggle('busy', CL.busy);
    var lbl = b.querySelector('.cl-lbl'); if(lbl) lbl.textContent = CL.on ? (CL.src === 'claude.ai' ? 'Claude' : clProvName()) : clProvName();
    b.title = CL.on ? 'ИИ Triosteum сейчас: ' + clSourceText() + '. Нажмите, чтобы вернуть прежний ИИ' : 'Подключить ' + CL_PROV[CL.prov].title + ' как ИИ Triosteum (временно, до закрытия вкладки)';
    if(!$('claudeP').hidden) clRenderPanel();
  }
  // какой обработчик запросов получит Triosteum при включении (null — не хватает настроек)
  function clMakeApi(){
    if(CL.prov === 'claude'){
      return clEmbedded().then(function(emb){
        if(emb){ CL.src = 'claude.ai'; return emb; }
        if(clKey('claude')){ CL.src = 'claude'; return function(prompt, opts){ return claudeHttp(prompt, opts); }; }
        return null;
      });
    }
    var c = CL.cfg[CL.prov];
    if(CL.prov === 'ollama' && !c.model) return clListModels('ollama').then(function(ms){ var pick = clPickModel(ms); if(!pick) return null; c.model = pick; CL.models.ollama = ms; clSaveCfg(); CL.src = 'ollama'; return function(prompt, opts){ return oaiHttp(prompt, opts, { prov:'ollama' }); }; }, function(){ return null; });
    if(!c.model || (CL.prov === 'openai' && !c.url)) return Promise.resolve(null);
    var p = CL.prov; CL.src = p;
    return Promise.resolve(function(prompt, opts){ return oaiHttp(prompt, opts, { prov:p }); });
  }
  function clNeedText(){ return CL.prov === 'claude' ? 'Чтобы подключить Claude, вставьте свой ключ API Anthropic и нажмите «Сохранить и включить».' : CL.prov === 'ollama' ? 'Выберите модель Ollama (кнопка «Найти модели») и нажмите «Сохранить и включить».' : 'Укажите адрес сервиса, ключ и модель, затем нажмите «Сохранить и включить».'; }
  function clEnable(silent){
    if(CL.on || CL.busy) return Promise.resolve(CL.on);
    CL.busy = true; clPaint();
    return clMakeApi().then(function(api){
      CL.busy = false;
      if(!api){ clPaint(); if(!silent){ CL.status = { cls:'', text:clNeedText() }; clOpenPanel(); } return false; }
      CL.prev = AI.api; AI.api = api; CL.on = true;
      try { var ss = clStore('session'); if(ss) ss.setItem(CL_ON, '1'); } catch(e){}
      clPaint(); clRefreshUIs();
      if(!silent) toast('ИИ Triosteum: ' + clSourceText());
      return true;
    });
  }
  function clDisable(silent){
    if(!CL.on) return;
    AI.api = CL.prev; CL.prev = undefined; CL.on = false; CL.src = null;
    try { var ss = clStore('session'); if(ss) ss.removeItem(CL_ON); } catch(e){}
    clPaint(); clRefreshUIs();
    if(!silent) toast(AI.api ? 'Подключение отключено — работает прежний ИИ Triosteum' : 'ИИ отключён');
  }
  // смена поставщика или его настроек на включённом переключателе — сразу переподключаемся
  function clReconnect(){ if(!CL.on) return Promise.resolve(false); var prev = CL.prev; clDisable(true); return clEnable(true).then(function(ok){ if(!ok){ AI.api = prev; } else CL.prev = prev; clPaint(); clRefreshUIs(); return ok; }); }
  function clOpenPanel(){
    var p = $('claudeP'); p.hidden = false; clRenderPanel();
    var inp = p.querySelector('input[type=password]'); if(inp && !inp.value) setTimeout(function(){ inp.focus(); }, 30);
  }
  function clCheck(fn){ CL.status = { cls:'', text:'Проверяю связь…' }; clRenderPanel(); fn().then(function(r){ CL.status = { cls:'ok', text:'Связь есть: ' + (CL.prov === 'claude' ? clModelName() : clProvName() + ' · ' + (CL.cfg[CL.prov].model || '')) + ' ответил «' + String(r.text || '').trim().slice(0, 40) + '».' }; clRenderPanel(); }, function(err){ CL.status = { cls:'err', text:err.message }; clRenderPanel(); }); }
  function clRenderPanel(){
    var b = $('claudePBody'); b.textContent = '';
    b.appendChild(h('div', { 'class':'clp-src' }, [ h('i', { 'class':CL.on ? 'on' : '' }), h('span', { text:CL.on ? 'Включено: ИИ Triosteum работает через ' + clSourceText() : (AI.api ? 'Выключено: работает встроенный ИИ Triosteum' : 'Выключено: встроенный ИИ Triosteum не подключён') }) ]));
    var seg = h('div', { 'class':'clp-seg', role:'radiogroup', 'aria-label':'Поставщик ИИ' });
    Object.keys(CL_PROV).forEach(function(p){
      var on = CL.prov === p;
      seg.appendChild(h('button', { type:'button', role:'radio', 'aria-checked':on ? 'true' : 'false', 'class':on ? 'on' : '', 'data-prov':p, text:CL_PROV[p].name, title:CL_PROV[p].title, on:{ click:function(){
        if(CL.prov === p) return; CL.prov = p; CL.status = null; CL.draft = undefined; clSaveCfg(); clPaint(); clRenderPanel(); clReconnect();
      } } }));
    });
    b.appendChild(seg);
    if(CL.prov === 'claude') clPanelClaude(b); else clPanelOai(b, CL.prov);
    if(CL.prov === 'ollama' && !CL.models.ollama && !CL.autoFind){ CL.autoFind = true; clListModels('ollama').then(function(ms){ CL.models.ollama = ms; var c = CL.cfg.ollama; if(ms.length && ms.indexOf(c.model) < 0){ c.model = clPickModel(ms); clSaveCfg(); } if(!$('claudeP').hidden && CL.prov === 'ollama') clRenderPanel(); }, function(){}); }
    if(CL.status) b.appendChild(h('div', { 'class':'clp-st ' + (CL.status.cls || ''), text:CL.status.text, role:'status' }));
    b.appendChild(h('p', { text:'Пока переключатель включён, помощник блока, архитектор, конструктор, бэкенд и ИИ офиса работают через выбранный ИИ. Выключите — вернётся прежний. После закрытия вкладки переключатель выключается.' }));
  }
  function clRemember(k){ var rem = h('input', { type:'checkbox' }); try { var l = clStore('local'); rem.checked = !!(l && l.getItem(k)); } catch(e){} return rem; }
  function clPanelClaude(b){
    if(CL.inClaude){
      b.appendChild(h('div', { 'class':'clp-st ok', text:'Triosteum открыт в claude.ai — ключ API не нужен, просто включите переключатель.' }));
      b.appendChild(h('div', { 'class':'row2' }, [ h('button', { type:'button', 'class':'btn sm primary', text:CL.on ? 'Выключить' : 'Включить', on:{ click:function(){ if(CL.on) clDisable(); else clEnable(); } } }) ]));
      return;
    }
    var key = clKey('claude');
    var keyIn = h('input', { type:'password', value:CL.draft !== undefined ? CL.draft : key, placeholder:'sk-ant-…', autocomplete:'off', spellcheck:'false', 'aria-label':'Ключ API Anthropic', on:{ input:function(){ CL.draft = keyIn.value; } } });
    var show = h('button', { type:'button', 'class':'btn sm', text:'Показать', on:{ click:function(){ var on = keyIn.type === 'password'; keyIn.type = on ? 'text' : 'password'; show.textContent = on ? 'Скрыть' : 'Показать'; } } });
    keyIn.style.flex = '1';
    b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Ключ API Anthropic'), h('div', { 'class':'row2' }, [ keyIn, show ]) ]));
    var sel = h('select', { 'aria-label':'Модель', on:{ change:function(){ CL.model = sel.value; try { var l2 = clStore('local'); if(l2) l2.setItem(CL_MODEL, CL.model); } catch(e){} var bt = $('claudeBtn'); if(bt && CL.on) bt.title = 'ИИ Triosteum сейчас: ' + clSourceText(); } } });
    CL_MODELS.forEach(function(m){ var o = h('option', { value:m.id, text:m.name }); if(m.id === CL.model) o.selected = true; sel.appendChild(o); });
    b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Модель'), sel ]));
    var rem = clRemember(CL_KEY);
    b.appendChild(h('label', { 'class':'chk' }, [ rem, h('span', { text:'Запомнить ключ на этом устройстве. Без галочки ключ забудется при закрытии вкладки.' }) ]));
    b.appendChild(h('div', { 'class':'row2' }, [
      h('button', { type:'button', 'class':'btn sm primary', text:CL.on ? 'Сохранить' : 'Сохранить и включить', on:{ click:function(){
        var v = keyIn.value.trim(); if(!v){ CL.status = { cls:'err', text:'Вставьте ключ API.' }; clRenderPanel(); return; }
        clSetKey(v, rem.checked, 'claude'); CL.draft = undefined; CL.status = { cls:'ok', text:'Ключ сохранён' + (rem.checked ? ' на этом устройстве.' : ' до закрытия вкладки.') };
        if(!CL.on) clEnable(true).then(function(ok){ if(ok) toast('ИИ Triosteum: ' + clSourceText()); clRenderPanel(); }); else clRenderPanel();
      } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Проверить', on:{ click:function(){
        var v = keyIn.value.trim() || clKey('claude'); if(!v){ CL.status = { cls:'err', text:'Сначала вставьте ключ API.' }; clRenderPanel(); return; }
        clCheck(function(){ return claudeHttp('Ответь одним словом: готово', {}, { key:v, max:16 }); });
      } } }),
      key ? h('button', { type:'button', 'class':'btn sm', text:'Забыть ключ', on:{ click:function(){ clSetKey('', false, 'claude'); CL.draft = undefined; if(CL.on && CL.src === 'claude') clDisable(); CL.status = { cls:'', text:'Ключ удалён из браузера.' }; clRenderPanel(); } } }) : null
    ]));
    b.appendChild(h('p', { html:'Ключ хранится только в этом браузере и отправляется только на api.anthropic.com. Запросы оплачиваются по вашему тарифу API Anthropic. Ключ создаётся в <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">консоли Anthropic</a>. API Anthropic доступен не во всех странах.' }));
  }
  function clPanelOai(b, p){
    var c = CL.cfg[p], isO = p === 'ollama';
    if(!isO){
      var nm = h('input', { type:'text', value:c.name || '', placeholder:'например, GigaChat', 'aria-label':'Название на переключателе', on:{ input:function(){ c.name = nm.value.trim(); clSaveCfg(); var lb = $('claudeBtn').querySelector('.cl-lbl'); if(lb) lb.textContent = clProvName(); } } });
      b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Название на переключателе'), nm ]));
    }
    var url = h('input', { type:'text', value:c.url || '', placeholder:isO ? 'http://localhost:11434' : 'https://…/v1', spellcheck:'false', 'aria-label':'Адрес сервиса', on:{ change:function(){ c.url = url.value.trim(); clSaveCfg(); } } });
    b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode(isO ? 'Адрес Ollama' : 'Адрес API (до /chat/completions)'), url ]));
    var keyIn = null, rem = null;
    if(!isO){
      keyIn = h('input', { type:'password', value:CL.draft !== undefined ? CL.draft : clKey('openai'), placeholder:'ключ API (если нужен)', autocomplete:'off', spellcheck:'false', 'aria-label':'Ключ API', on:{ input:function(){ CL.draft = keyIn.value; } } });
      b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Ключ API'), keyIn ]));
    }
    var list = CL.models[p] || [], model;
    if(list.length){
      model = h('select', { 'aria-label':'Модель', on:{ change:function(){ c.model = model.value; clSaveCfg(); } } });
      if(!c.model) c.model = list[0];
      list.forEach(function(m){ var o = h('option', { value:m, text:m }); if(m === c.model) o.selected = true; model.appendChild(o); });
    } else model = h('input', { type:'text', value:c.model || '', placeholder:isO ? 'например, qwen2.5-coder:7b' : 'название модели', spellcheck:'false', 'aria-label':'Модель', on:{ change:function(){ c.model = model.value.trim(); clSaveCfg(); } } });
    var find = h('button', { type:'button', 'class':'btn sm', text:'Найти модели', on:{ click:function(){
      c.url = url.value.trim(); clSaveCfg();
      CL.status = { cls:'', text:'Спрашиваю список моделей…' }; clRenderPanel();
      clListModels(p, { key:keyIn ? keyIn.value.trim() : undefined }).then(function(ms){ CL.models[p] = ms; if(ms.length && ms.indexOf(c.model) < 0) c.model = ms[0]; clSaveCfg(); CL.status = ms.length ? { cls:'ok', text:'Найдено моделей: ' + ms.length + '.' } : { cls:'err', text:isO ? 'Моделей нет. Скачайте модель: в терминале «ollama pull qwen2.5-coder:7b».' : 'Сервис не вернул список моделей — впишите название модели вручную.' }; clRenderPanel(); },
        function(err){ CL.status = { cls:'err', text:err.message }; clRenderPanel(); });
    } } });
    model.style.flex = '1';
    b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Модель'), h('div', { 'class':'row2' }, [ model, find ]) ]));
    if(!isO){ rem = clRemember(CL_OKEY); b.appendChild(h('label', { 'class':'chk' }, [ rem, h('span', { text:'Запомнить ключ на этом устройстве.' }) ])); }
    var grab = function(){ c.url = url.value.trim(); c.model = (model.value || '').trim(); clSaveCfg(); if(keyIn){ clSetKey(keyIn.value.trim(), rem && rem.checked, 'openai'); CL.draft = undefined; } };
    b.appendChild(h('div', { 'class':'row2' }, [
      h('button', { type:'button', 'class':'btn sm primary', text:CL.on ? 'Сохранить' : 'Сохранить и включить', on:{ click:function(){
        grab();
        if(!c.url || !c.model){ CL.status = { cls:'err', text:'Укажите адрес и модель.' }; clRenderPanel(); return; }
        CL.status = { cls:'ok', text:'Настройки сохранены.' };
        (CL.on ? clReconnect() : clEnable(true)).then(function(ok){ if(ok) toast('ИИ Triosteum: ' + clSourceText()); clRenderPanel(); });
      } } }),
      h('button', { type:'button', 'class':'btn sm', text:'Проверить', on:{ click:function(){ grab(); clCheck(function(){ return oaiHttp('Ответь одним словом: готово', {}, { prov:p, max:16 }); }); } } })
    ]));
    if(isO){
      b.appendChild(h('p', { html:'<b>Как подключить Ollama (бесплатно, работает без интернета):</b><br>1. Установите Ollama с <a href="https://ollama.com/download" target="_blank" rel="noopener">ollama.com</a>.<br>2. Скачайте модель: в терминале <code>ollama pull qwen2.5-coder:7b</code> (для кода) или <code>ollama pull qwen2.5:7b</code>.<br>3. Разрешите запросы со страницы Triosteum: Windows — <code>setx OLLAMA_ORIGINS "*"</code>, macOS — <code>launchctl setenv OLLAMA_ORIGINS "*"</code>, затем перезапустите Ollama.<br>4. Нажмите «Найти модели», выберите модель и «Сохранить и включить». Если браузер спросит разрешение на доступ к устройствам локальной сети — разрешите.' }));
      b.appendChild(h('p', { text:'Скорость и качество зависят от компьютера: модели 7–8 млрд параметров идут на обычном ноутбуке, для крупных нужна видеокарта.' }));
    } else {
      b.appendChild(h('p', { text:'Подходит любой сервис с API в формате OpenAI (/chat/completions с потоком): облачные модели, LM Studio, vLLM, собственный сервер компании. Сервис должен разрешать запросы из браузера (CORS) — иначе подключайте его через сервер Triosteum (AI_PROVIDER). Ключ хранится только в этом браузере и отправляется только на указанный адрес.' }));
    }
  }
  $('claudeBtn').addEventListener('click', function(){ if(CL.on) clDisable(); else clEnable(); });
  $('claudeMore').addEventListener('click', function(){ var p = $('claudeP'); if(p.hidden) clOpenPanel(); else p.hidden = true; });
  $('claudePClose').addEventListener('click', function(){ $('claudeP').hidden = true; });
  $('claudeP').addEventListener('keydown', function(e){ if(e.key === 'Escape') $('claudeP').hidden = true; });
  document.addEventListener('pointerdown', function(e){ var p = $('claudeP'); if(!p.hidden && !p.contains(e.target) && !e.target.closest('#clWrap')) p.hidden = true; }, true);
  clPaint();
  // вкладку перезагрузили, пока переключатель был включён, — включаем снова
  try { var ss0 = clStore('session'); if(ss0 && ss0.getItem(CL_ON) === '1') setTimeout(function(){ clEnable(true); }, 0); } catch(e){}
