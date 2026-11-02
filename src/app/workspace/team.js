  /* ---------- команда и история версий (только с сервером) ---------- */
  var ROLE_NAMES = { owner:'Владелец', editor:'Редактор', approver:'Согласующий', viewer:'Наблюдатель' };
  var ROLE_HINT = { editor:'создаёт и меняет пространства', approver:'смотрит и согласует', viewer:'только смотрит' };
  var teamWin = null, histWin = null;
  function fmtWhen(iso){
    var d = new Date(iso); if(isNaN(d)) return '';
    var today = new Date(); var same = d.toDateString() === today.toDateString();
    return (same ? 'сегодня' : d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' })) + ', ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  }
  function apiErr(r){ return (r && r.data && r.data.detail) || 'Не получилось — проверьте связь'; }

  // ---- команда ----
  function openTeam(){
    if(!SERVER) return;
    $('teamW').hidden = false;
    if(!teamWin) teamWin = makeWindow($('teamW'), '.pers-h', 'team', 'fixed');
    teamWin.apply(); renderTeam();
  }
  $('teamClose').addEventListener('click', function(){ $('teamW').hidden = true; });
  function renderTeam(link){
    var body = $('teamBody'); body.innerHTML = '<p class="tm-empty">Загружаем…</p>';
    SERVER.api('GET', '/org/members').then(function(r){
      if(r.status !== 200){ body.innerHTML = ''; body.appendChild(h('p', { 'class':'tm-empty', text:apiErr(r) })); return; }
      var d = r.data, owner = d.my_role === 'owner'; body.innerHTML = '';
      var list = h('div', { 'class':'tm-sec' }, [ h('h3', { text:'Участники · ' + d.members.length }) ]);
      d.members.forEach(function(m){
        var row = h('div', { 'class':'tm-row' }, [ h('div', { 'class':'who' }, [
          h('div', { 'class':'nm', text:(m.name || m.email) + (m.id === d.me ? ' (вы)' : '') }),
          h('div', { 'class':'em', text:m.email + (m.last_login ? ' · был(а) ' + fmtWhen(m.last_login) : ' · ещё не входил(а)') }) ]) ]);
        if(owner && m.id !== d.me){
          var sel = h('select', { 'aria-label':'Роль: ' + (m.name || m.email) });
          Object.keys(ROLE_NAMES).forEach(function(k){ var o = h('option', { value:k, text:ROLE_NAMES[k] }); if(k === m.role) o.selected = true; sel.appendChild(o); });
          sel.addEventListener('change', function(){
            SERVER.api('PATCH', '/org/members/' + m.id, { role:sel.value }).then(function(x){ toast(x.status === 200 ? 'Роль изменена: ' + ROLE_NAMES[sel.value] : apiErr(x)); renderTeam(); });
          });
          row.appendChild(sel);
          var del = h('button', { type:'button', 'class':'btn sm', text:'Убрать', 'aria-label':'Убрать из организации: ' + (m.name || m.email) });
          var armed = 0;
          del.addEventListener('click', function(){
            if(Date.now() - armed > 4000){ armed = Date.now(); del.textContent = 'Точно?'; toast('Нажмите ещё раз: ' + (m.name || m.email) + ' сразу потеряет доступ'); return; }
            SERVER.api('DELETE', '/org/members/' + m.id).then(function(x){ toast(x.status === 200 ? 'Участник убран' : apiErr(x)); renderTeam(); });
          });
          row.appendChild(del);
        } else row.appendChild(h('span', { 'class':'tag', text:ROLE_NAMES[m.role] || m.role }));
        list.appendChild(row);
      });
      body.appendChild(list);
      if(!owner){ body.appendChild(h('p', { 'class':'tm-hint', text:'Приглашать коллег и менять роли может владелец организации.' })); return; }
      if(d.invites.length){
        var inv = h('div', { 'class':'tm-sec' }, [ h('h3', { text:'Ждут ответа' }) ]);
        d.invites.forEach(function(i){
          var cancel = h('button', { type:'button', 'class':'btn sm', text:'Отменить' });
          cancel.addEventListener('click', function(){ SERVER.api('DELETE', '/org/invites/' + i.id).then(function(){ toast('Приглашение отменено'); renderTeam(); }); });
          inv.appendChild(h('div', { 'class':'tm-row' }, [ h('div', { 'class':'who' }, [ h('div', { 'class':'nm', text:i.email }),
            h('div', { 'class':'em', text:(ROLE_NAMES[i.role] || i.role) + ' · ссылка действует до ' + fmtWhen(i.expires_at) }) ]), cancel ]));
        });
        body.appendChild(inv);
      }
      var email = h('input', { type:'email', placeholder:'почта коллеги', 'aria-label':'Почта коллеги', autocomplete:'off' });
      var role = h('select', { 'aria-label':'Роль приглашённого' });
      ['editor', 'approver', 'viewer'].forEach(function(k){ role.appendChild(h('option', { value:k, text:ROLE_NAMES[k] + ' — ' + ROLE_HINT[k] })); });
      var go = h('button', { type:'submit', 'class':'btn primary sm', text:'Пригласить' });
      var form = h('form', { 'class':'tm-form' }, [ email, role, go ]);
      form.addEventListener('submit', function(e){
        e.preventDefault();
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())){ toast('Проверьте почту'); email.focus(); return; }
        go.disabled = true;
        SERVER.api('POST', '/org/invites', { email:email.value.trim(), role:role.value }).then(function(x){
          go.disabled = false;
          if(x.status !== 201){ toast(apiErr(x)); return; }
          renderTeam(location.origin + x.data.path);
        });
      });
      var sec = h('div', { 'class':'tm-sec' }, [ h('h3', { text:'Пригласить коллегу' }), form ]);
      if(link){
        var inp = h('input', { readonly:'readonly', 'aria-label':'Ссылка-приглашение' }); inp.value = link;
        var copy = h('button', { type:'button', 'class':'btn sm', text:'Копировать' });
        copy.addEventListener('click', function(){
          inp.select();
          (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function(){ toast('Ссылка скопирована — отправьте её коллеге'); }, function(){ document.execCommand && document.execCommand('copy'); toast('Ссылка выделена — скопируйте её'); });
        });
        sec.appendChild(h('div', { 'class':'tm-link' }, [ inp, copy ]));
        sec.appendChild(h('p', { 'class':'tm-hint', text:'Отправьте ссылку коллеге в почте или мессенджере. Она одноразовая и действует 7 дней. Показываем её только сейчас.' }));
        setTimeout(function(){ inp.select(); }, 30);
      } else sec.appendChild(h('p', { 'class':'tm-hint', text:'Появится ссылка-приглашение: коллега откроет её, задаст пароль и сразу попадёт в организацию.' }));
      body.appendChild(sec);
    });
  }

  // ---- история версий ----
  function openHistory(){
    if(!SERVER) return;
    $('histW').hidden = false;
    if(!histWin) histWin = makeWindow($('histW'), '.pers-h', 'hist', 'fixed');
    histWin.apply(); renderHistory();
  }
  $('histClose').addEventListener('click', function(){ $('histW').hidden = true; });
  function renderHistory(){
    var body = $('histBody'), id = curId(), canEdit = SERVER.role === 'owner' || SERVER.role === 'editor';
    body.innerHTML = '<p class="tm-empty">Загружаем…</p>';
    SERVER.flush().then(function(){ return SERVER.api('GET', '/spaces/' + encodeURIComponent(id) + '/versions'); }).then(function(r){
      body.innerHTML = '';
      if(canEdit){
        var label = h('input', { placeholder:'Подпись, например «Перед запуском в цех»', maxlength:'200', 'aria-label':'Подпись версии' });
        var save = h('button', { type:'submit', 'class':'btn primary sm', text:'Сохранить версию' });
        var form = h('form', { 'class':'tm-form' }, [ label, save ]);
        form.addEventListener('submit', function(e){
          e.preventDefault();
          var l = label.value.trim(); if(!l){ label.focus(); toast('Подпишите версию — так её легче найти'); return; }
          SERVER.flush().then(function(){ return SERVER.api('POST', '/spaces/' + encodeURIComponent(id) + '/versions', { label:l }); }).then(function(x){
            toast(x.status === 201 ? 'Версия «' + l + '» сохранена' : apiErr(x)); renderHistory();
          });
        });
        body.appendChild(h('div', { 'class':'tm-sec' }, [ h('h3', { text:'Сохранить текущее состояние' }), form ]));
      }
      var sec = h('div', { 'class':'tm-sec' }, [ h('h3', { text:'Версии пространства «' + curProj().name + '»' }) ]);
      if(r.status !== 200 || !r.data.length){
        sec.appendChild(h('p', { 'class':'tm-empty', text:r.status === 200 ? 'Пока нет снимков: они появляются автоматически каждые 10 минут работы.' : apiErr(r) }));
      }
      (r.data || []).forEach(function(v, i){
        var row = h('div', { 'class':'tm-row' }, [ h('div', { 'class':'who' }, [
          h('div', { 'class':'hv-lbl' + (v.label ? '' : ' hv-auto'), text:v.label || 'Автосохранение' }),
          h('div', { 'class':'em', text:fmtWhen(v.created_at) + (v.by ? ' · ' + v.by : '') + ' · правка ' + v.rev + (i === 0 ? ' · последняя' : '') }) ]) ]);
        if(canEdit && v.rev !== SERVER.rev(id)){
          var back = h('button', { type:'button', 'class':'btn sm', text:'Вернуть' });
          back.addEventListener('click', function(){ restoreVersion(id, v); });
          row.appendChild(back);
        }
        sec.appendChild(row);
      });
      body.appendChild(sec);
      body.appendChild(h('p', { 'class':'tm-hint', text:'Перед возвратом текущее состояние сохраняется отдельной версией, так что вернуть можно что угодно.' }));
    });
  }
  function restoreVersion(id, v){
    var when = fmtWhen(v.created_at);
    SERVER.flush()
      .then(function(){ return SERVER.api('POST', '/spaces/' + encodeURIComponent(id) + '/versions', { label:'Перед возвратом к версии от ' + when }); })
      .then(function(){ return SERVER.api('GET', '/spaces/' + encodeURIComponent(id) + '/versions/' + v.id); })
      .then(function(r){
        if(r.status !== 200){ toast(apiErr(r)); return; }
        setGraph(r.data.content);                   // сохранится на сервер обычным путём, новой правкой
        toast('Возвращена версия «' + (v.label || 'Автосохранение') + '» от ' + when);
        setTimeout(renderHistory, 1500);
      });
  }
