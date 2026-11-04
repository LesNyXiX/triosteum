  /* =====================================================================
     ПЕРЕКЛЮЧАТЕЛЬ «CLAUDE» В ШАПКЕ: временно делает Claude системным ИИ
     Triosteum. Пока он включён, все ИИ-функции (помощник блока, архитектор,
     конструктор, бэкенд, ИИ офиса) идут в Claude: внутри claude.ai — без
     ключа, в остальных случаях — напрямую в API Anthropic с ключом
     пользователя. Выключение возвращает прежний ИИ. Состояние живёт до
     закрытия вкладки.
     ===================================================================== */
  var CL_MODELS = [
    { id:'claude-opus-5-5', name:'Claude Opus 5.5 — самая сильная' },
    { id:'claude-sonnet-5-5', name:'Claude Sonnet 5.5 — быстрее и дешевле' },
    { id:'claude-haiku-5-5', name:'Claude Haiku 5.5 — самая быстрая' }
  ];
  var CL_KEY = 'triosteum.claude.key', CL_MODEL = 'triosteum.claude.model', CL_ON = 'triosteum.claude.on';
  var CL = { on:false, prev:undefined, src:null, busy:false, status:null, model:CL_MODELS[0].id, inClaude:!!(window.claude && typeof window.claude.use === 'function'), embedded:null };
  function clStore(kind){ try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch(e){ return null; } }
  function clGet(k){ var s = clStore('session'), l = clStore('local'); try { return (s && s.getItem(k)) || (l && l.getItem(k)) || ''; } catch(e){ return ''; } }
  function clKey(){ return clGet(CL_KEY); }
  function clSetKey(v, remember){
    var s = clStore('session'), l = clStore('local');
    try { if(s){ if(v) s.setItem(CL_KEY, v); else s.removeItem(CL_KEY); } if(l){ if(v && remember) l.setItem(CL_KEY, v); else l.removeItem(CL_KEY); } } catch(e){}
  }
  try { var m0 = clGet(CL_MODEL); if(m0 && CL_MODELS.some(function(m){ return m.id === m0; })) CL.model = m0; } catch(e){}

  var CL_SYSTEM = 'Ты встроен в Triosteum — визуальную среду, где программы собирают из блоков на доске. ' +
    'Отвечай на языке запроса (обычно русском) и строго соблюдай формат, который просит запрос: если нужен код — давай рабочий код в блоке ```.';

  function clError(status, d, raw){
    var msg = d && d.error && d.error.message ? d.error.message : (raw || '');
    var e;
    if(status === 401) e = new Error('Claude: ключ API не подошёл (401). Проверьте ключ в консоли Anthropic.');
    else if(status === 403) e = new Error('Claude: доступ запрещён (403)' + (msg ? ': ' + msg : '') + '. API Anthropic работает не во всех странах — из неподдерживаемого региона запросы отклоняются.');
    else if(status === 429){ e = new Error('Claude: слишком много запросов (429). Подождите немного и повторите.'); e.code = 'rate_limited'; }
    else if(status === 529 || status === 503) e = new Error('Claude сейчас перегружен (' + status + '). Повторите через минуту.');
    else if(status === 404) e = new Error('Claude: модель не найдена (404)' + (msg ? ': ' + msg : '') + '. Выберите другую модель в настройках переключателя.');
    else e = new Error('Claude: ошибка ' + status + (msg ? ' — ' + msg : ''));
    e.status = status; return e;
  }
  // прямой запрос к API Anthropic из браузера, ответ приходит потоком (SSE)
  function claudeHttp(prompt, opts, cfg){
    opts = opts || {}; cfg = cfg || {};
    var key = cfg.key || clKey();
    if(!key) return Promise.reject(new Error('Claude: не задан ключ API — откройте настройки переключателя «Claude» в шапке.'));
    var body = { model:cfg.model || CL.model, max_tokens:cfg.max || 16000, stream:true, system:CL_SYSTEM, messages:[{ role:'user', content:String(prompt) }] };
    return fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify(body)
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ var d = null; try { d = JSON.parse(t); } catch(e){} throw clError(r.status, d, t && t.slice(0, 200)); });
      var text = '', buf = '', stop = null, dec = new TextDecoder();
      function handle(block){
        var ev = '', data = '';
        block.split('\n').forEach(function(line){ if(line.indexOf('event:') === 0) ev = line.slice(6).trim(); else if(line.indexOf('data:') === 0) data += line.slice(5).trim(); });
        if(!data) return;
        var d; try { d = JSON.parse(data); } catch(e){ return; }
        if(d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta'){ text += d.delta.text; if(opts.onText) try { opts.onText({ text:text }); } catch(e){} }
        else if(d.type === 'message_delta' && d.delta && d.delta.stop_reason) stop = d.delta.stop_reason;
        else if(d.type === 'error' || ev === 'error'){ throw clError(d.error && d.error.type === 'overloaded_error' ? 529 : 500, d); }
      }
      if(!r.body || !r.body.getReader) return r.text().then(function(t){ t.split('\n\n').forEach(handle); return { text:text, stop:stop }; });
      var rd = r.body.getReader();
      function pump(){
        return rd.read().then(function(x){
          if(x.done){ buf += dec.decode(); if(buf.trim()) handle(buf); return { text:text, stop:stop }; }
          buf += dec.decode(x.value, { stream:true });
          var k; while((k = buf.indexOf('\n\n')) >= 0){ var blk = buf.slice(0, k); buf = buf.slice(k + 2); handle(blk); }
          return pump();
        });
      }
      return pump();
    }, function(err){
      throw new Error('Claude: нет связи с api.anthropic.com (' + (err && err.message || 'сеть') + '). Сайт может быть недоступен из вашей сети или региона.');
    });
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
  function clPaint(){
    var b = $('claudeBtn'); if(!b) return;
    b.setAttribute('aria-checked', CL.on ? 'true' : 'false');
    b.classList.toggle('busy', CL.busy);
    b.title = CL.on ? 'Claude подключён как ИИ Triosteum (' + (CL.src === 'claude.ai' ? 'через claude.ai' : clModelName()) + '). Нажмите, чтобы вернуть прежний ИИ' : 'Подключить Claude как ИИ Triosteum (временно, до закрытия вкладки)';
    if(!$('claudeP').hidden) clRenderPanel();
  }
  function clModelName(){ var m = CL_MODELS.filter(function(x){ return x.id === CL.model; })[0]; return m ? m.name.split(' — ')[0] : CL.model; }
  function clEnable(silent){
    if(CL.on || CL.busy) return Promise.resolve(CL.on);
    CL.busy = true; clPaint();
    return clEmbedded().then(function(emb){
      CL.busy = false;
      var api = null;
      if(emb){ api = emb; CL.src = 'claude.ai'; }
      else if(clKey()){ api = function(prompt, opts){ return claudeHttp(prompt, opts); }; CL.src = 'api'; }
      if(!api){ clPaint(); if(!silent){ CL.status = { cls:'', text:'Чтобы подключить Claude, вставьте свой ключ API Anthropic и нажмите «Сохранить и включить».' }; clOpenPanel(); } return false; }
      CL.prev = AI.api; AI.api = api; CL.on = true;
      try { var ss = clStore('session'); if(ss) ss.setItem(CL_ON, '1'); } catch(e){}
      clPaint(); clRefreshUIs();
      if(!silent) toast('Claude подключён как ИИ Triosteum' + (CL.src === 'claude.ai' ? '' : ' · ' + clModelName()));
      return true;
    });
  }
  function clDisable(){
    if(!CL.on) return;
    AI.api = CL.prev; CL.prev = undefined; CL.on = false; CL.src = null;
    try { var ss = clStore('session'); if(ss) ss.removeItem(CL_ON); } catch(e){}
    clPaint(); clRefreshUIs();
    toast(AI.api ? 'Claude отключён — работает прежний ИИ Triosteum' : 'Claude отключён');
  }
  function clOpenPanel(){
    var p = $('claudeP'); p.hidden = false; clRenderPanel();
    var inp = p.querySelector('input[type=password]'); if(inp && !inp.value) setTimeout(function(){ inp.focus(); }, 30);
  }
  function clRenderPanel(){
    var b = $('claudePBody'); b.textContent = '';
    var key = clKey(), remembered = false; try { var l = clStore('local'); remembered = !!(l && l.getItem(CL_KEY)); } catch(e){}
    b.appendChild(h('div', { 'class':'clp-src' }, [ h('i', { 'class':CL.on ? 'on' : '' }), h('span', { text:CL.on ? 'Включено: ИИ Triosteum работает через Claude' + (CL.src === 'claude.ai' ? ' (claude.ai)' : ' · ' + clModelName()) : (AI.api ? 'Выключено: работает встроенный ИИ Triosteum' : 'Выключено: встроенный ИИ Triosteum не подключён') }) ]));
    b.appendChild(h('p', { text:'Пока переключатель включён, помощник блока, архитектор, конструктор, бэкенд и ИИ офиса работают через Claude. Выключите — вернётся прежний ИИ. После закрытия вкладки переключатель выключается.' }));
    if(CL.inClaude) b.appendChild(h('div', { 'class':'clp-st ok', text:'Triosteum открыт в claude.ai — ключ API не нужен, просто включите переключатель.' }));
    else {
      var keyIn = h('input', { type:'password', value:CL.draft !== undefined ? CL.draft : key, placeholder:'sk-ant-…', autocomplete:'off', spellcheck:'false', 'aria-label':'Ключ API Anthropic', on:{ input:function(){ CL.draft = keyIn.value; } } });
      var show = h('button', { type:'button', 'class':'btn sm', text:'Показать', on:{ click:function(){ var on = keyIn.type === 'password'; keyIn.type = on ? 'text' : 'password'; show.textContent = on ? 'Скрыть' : 'Показать'; } } });
      b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Ключ API Anthropic'), h('div', { 'class':'row2' }, [ keyIn, show ]) ]));
      keyIn.style.flex = '1';
      var sel = h('select', { 'aria-label':'Модель', on:{ change:function(){ CL.model = sel.value; try { var l2 = clStore('local'); if(l2) l2.setItem(CL_MODEL, CL.model); } catch(e){} var bt = $('claudeBtn'); if(bt && CL.on) bt.title = 'Claude подключён как ИИ Triosteum (' + clModelName() + ')'; } } });
      CL_MODELS.forEach(function(m){ var o = h('option', { value:m.id, text:m.name }); if(m.id === CL.model) o.selected = true; sel.appendChild(o); });
      b.appendChild(h('label', { 'class':'f' }, [ document.createTextNode('Модель'), sel ]));
      var rem = h('input', { type:'checkbox' }); rem.checked = remembered;
      b.appendChild(h('label', { 'class':'chk' }, [ rem, h('span', { text:'Запомнить ключ на этом устройстве. Без галочки ключ забудется при закрытии вкладки.' }) ]));
      b.appendChild(h('div', { 'class':'row2' }, [
        h('button', { type:'button', 'class':'btn sm primary', text:CL.on ? 'Сохранить' : 'Сохранить и включить', on:{ click:function(){
          var v = keyIn.value.trim(); if(!v){ CL.status = { cls:'err', text:'Вставьте ключ API.' }; clRenderPanel(); return; }
          clSetKey(v, rem.checked); CL.draft = undefined; CL.status = { cls:'ok', text:'Ключ сохранён' + (rem.checked ? ' на этом устройстве.' : ' до закрытия вкладки.') };
          if(!CL.on) clEnable(true).then(function(ok){ if(ok) toast('Claude подключён как ИИ Triosteum · ' + clModelName()); clRenderPanel(); }); else clRenderPanel();
        } } }),
        h('button', { type:'button', 'class':'btn sm', text:'Проверить', on:{ click:function(){
          var v = keyIn.value.trim() || clKey(); if(!v){ CL.status = { cls:'err', text:'Сначала вставьте ключ API.' }; clRenderPanel(); return; }
          CL.status = { cls:'', text:'Проверяю связь с Claude…' }; clRenderPanel();
          claudeHttp('Ответь одним словом: готово', {}, { key:v, max:16 }).then(function(r){ CL.status = { cls:'ok', text:'Связь есть: ' + clModelName() + ' ответил «' + String(r.text || '').trim().slice(0, 40) + '».' }; clRenderPanel(); },
            function(err){ CL.status = { cls:'err', text:err.message }; clRenderPanel(); });
        } } }),
        key ? h('button', { type:'button', 'class':'btn sm', text:'Забыть ключ', on:{ click:function(){ clSetKey('', false); CL.draft = undefined; if(CL.on && CL.src === 'api') clDisable(); CL.status = { cls:'', text:'Ключ удалён из браузера.' }; clRenderPanel(); } } }) : null
      ]));
      b.appendChild(h('p', { html:'Ключ хранится только в этом браузере и отправляется только на api.anthropic.com. Запросы оплачиваются по вашему тарифу API Anthropic. Ключ создаётся в <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">консоли Anthropic</a>.' }));
      b.appendChild(h('p', { text:'API Anthropic доступен не во всех странах. Если запрос отклонён из-за региона, Triosteum так и сообщит.' }));
    }
    if(CL.status) b.appendChild(h('div', { 'class':'clp-st ' + (CL.status.cls || ''), text:CL.status.text, role:'status' }));
    if(CL.inClaude) b.appendChild(h('div', { 'class':'row2' }, [ h('button', { type:'button', 'class':'btn sm primary', text:CL.on ? 'Выключить' : 'Включить', on:{ click:function(){ if(CL.on) clDisable(); else clEnable(); } } }) ]));
  }
  $('claudeBtn').addEventListener('click', function(){ if(CL.on) clDisable(); else clEnable(); });
  $('claudeMore').addEventListener('click', function(){ var p = $('claudeP'); if(p.hidden) clOpenPanel(); else p.hidden = true; });
  $('claudePClose').addEventListener('click', function(){ $('claudeP').hidden = true; });
  $('claudeP').addEventListener('keydown', function(e){ if(e.key === 'Escape') $('claudeP').hidden = true; });
  document.addEventListener('pointerdown', function(e){ var p = $('claudeP'); if(!p.hidden && !p.contains(e.target) && !e.target.closest('#clWrap')) p.hidden = true; }, true);
  // вкладку перезагрузили, пока переключатель был включён, — включаем снова (ключ живёт до закрытия вкладки)
  try { var ss0 = clStore('session'); if(ss0 && ss0.getItem(CL_ON) === '1') setTimeout(function(){ clEnable(true); }, 0); } catch(e){}
