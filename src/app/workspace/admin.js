  /* ---------- панель администратора сервера (только с сервером и только для администратора) ---------- */
  var ADM = { el:null, tab:'overview', ov:null, orgs:null, userFilter:'all', userQuery:'', lastLink:null };
  var ADM_TABS = [
    { id:'overview', label:'Обзор', ic:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>' },
    { id:'users', label:'Пользователи', ic:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c1-3.5 3.4-5.5 6-5.5s5 2 6 5.5M16 4.5a3.5 3.5 0 010 7M18 14.5c1.6.7 2.6 2.6 3 5.5"/>' },
    { id:'invites', label:'Приглашения', ic:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>' },
    { id:'access', label:'Доступ', ic:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>' },
    { id:'points', label:'Точки восстановления', ic:'<circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><circle cx="12" cy="12" r="2.2"/><path d="M12 7.2v2.6M12 14.2v2.6"/>' },
    { id:'log', label:'Журнал и отмена', ic:'<path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>' }
  ];
  var ADM_ROLES = { owner:'Владелец', editor:'Редактор', approver:'Согласующий', viewer:'Наблюдатель' };
  // цвета графика проверены на различимость (в том числе при нарушениях цветового зрения) на тёмном фоне
  var ADM_SERIES = [ { key:'logins', label:'Входы', color:'#EF4444' }, { key:'saves', label:'Сохранения', color:'#0D9488' }, { key:'joins', label:'Новые пользователи', color:'#8B5CF6' } ];

  function admIcon(path){ return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  function admErr(r){ return (r && r.data && r.data.detail) || 'Не получилось — проверьте связь'; }
  function admWhen(iso){
    if(!iso) return '—';
    var d = new Date(iso); if(isNaN(d)) return '—';
    var same = d.toDateString() === new Date().toDateString();
    return (same ? 'сегодня' : d.toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })) + ', ' + d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  }
  function admBytes(n){
    if(n == null) return '—';
    var u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'], i = 0; while(n >= 1024 && i < u.length - 1){ n /= 1024; i++; }
    return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + ' ' + u[i];
  }
  function admInitials(u){ var s = (u.name || u.email || '?').trim(); var p = s.split(/\s+/); return ((p[0] || '')[0] + ((p[1] || '')[0] || '')).toUpperCase(); }
  // кнопка с подтверждением вторым нажатием (как «Убрать» в окне команды)
  function admArm(btn, warn, fn){
    var armed = 0, txt = btn.textContent;
    btn.addEventListener('click', function(){
      if(Date.now() - armed > 4000){ armed = Date.now(); btn.textContent = 'Точно?'; btn.classList.add('armed'); toast(warn); setTimeout(function(){ if(Date.now() - armed >= 4000){ btn.textContent = txt; btn.classList.remove('armed'); } }, 4100); return; }
      armed = 0; btn.textContent = txt; btn.classList.remove('armed'); fn();
    });
  }
  // любое действие администратора: тост с «Отменить» (если действие можно отменить) и перерисовка панели
  function admAct(method, path, body, okText){
    return SERVER.api(method, '/admin' + path, body).then(function(r){
      if(r.status >= 300){ toast(admErr(r)); return null; }
      var aid = r.data && r.data.action;
      if(aid && typeof toastAct === 'function') toastAct(okText || r.data.summary, 'Отменить', function(){ admUndo(aid); });
      else toast(okText || (r.data && r.data.summary) || 'Готово');
      admRefresh();
      return r.data;
    });
  }
  function admUndo(aid){
    SERVER.api('POST', '/admin/actions/' + aid + '/undo').then(function(r){
      if(r.status !== 200){ toast(admErr(r)); return; }
      var nid = r.data.action;
      if(typeof toastAct === 'function') toastAct(r.data.summary, 'Вернуть', function(){ admUndo(nid); }); else toast(r.data.summary);
      admRefresh();
    });
  }

  function openAdmin(tab){
    if(!SERVER || !SERVER.admin) return;
    if(!ADM.el) admBuild();
    if(tab) ADM.tab = tab;
    ADM.el.hidden = false; document.body.classList.add('adm-open');
    var ab = $('admBtn'); if(ab) ab.setAttribute('aria-pressed', 'true');
    admKeyChip();
    admRefresh();
    setTimeout(function(){ var b = ADM.el.querySelector('.adm-nav button[aria-selected="true"]'); if(b) b.focus(); }, 30);
  }
  function closeAdmin(){
    if(ADM.el) ADM.el.hidden = true; document.body.classList.remove('adm-open');
    var b = $('admBtn'); if(b){ b.setAttribute('aria-pressed', 'false'); }
  }
  // горячая клавиша и кнопка в шапке: открыть или закрыть
  function admToggle(){ if(ADM.el && !ADM.el.hidden) closeAdmin(); else openAdmin(); }
  // клавиша панели прямо в её шапке: нажать — затем нужное сочетание (Esc — отмена, Backspace — убрать)
  function admKeyChip(){
    var box = $('admKey'); if(!box || typeof keyCatcher !== 'function') return;
    var tk = toolKeyFor('#admBtn'); if(!tk) return;
    box.innerHTML = '';
    box.appendChild(h('span', { 'class':'adm-key-l', text:'Клавиша' }));
    box.appendChild(keyCatcher(tk, 'Панель администратора', admKeyChip));
  }

  function admBuild(){
    var back = h('div', { 'class':'adm-back', id:'admW', role:'dialog', 'aria-modal':'true', 'aria-label':'Панель администратора', hidden:'' });
    var nav = h('nav', { 'class':'adm-nav', role:'tablist', 'aria-label':'Разделы панели' });
    ADM_TABS.forEach(function(t){
      var b = h('button', { type:'button', role:'tab', 'data-tab':t.id, 'aria-selected':'false', html:admIcon(t.ic) + '<span>' + t.label + '</span>' });
      b.addEventListener('click', function(){ ADM.tab = t.id; admRender(); });
      nav.appendChild(b);
    });
    var close = h('button', { type:'button', 'class':'adm-x', 'aria-label':'Закрыть панель', html:admIcon('<path d="M6 6l12 12M18 6L6 18"/>') });
    close.addEventListener('click', closeAdmin);
    var head = h('header', { 'class':'adm-head' }, [
      h('div', { 'class':'adm-title' }, [ h('h2', { text:'Панель администратора' }), h('p', { 'class':'adm-host', text:location.host }) ]),
      h('div', { 'class':'adm-pills', id:'admPills' }), h('div', { 'class':'adm-key', id:'admKey', title:'Горячая клавиша панели — работает в любой среде' }), close ]);
    var main = h('main', { 'class':'adm-main', id:'admMain', role:'tabpanel' });
    back.appendChild(h('div', { 'class':'adm' }, [ head, h('div', { 'class':'adm-body' }, [ nav, main ]) ]));
    back.addEventListener('mousedown', function(e){ if(e.target === back) closeAdmin(); });
    // клавиши внутри панели не доходят до доски (стрелки, Delete, сочетания) — элементы панели работают как обычно
    back.addEventListener('keydown', function(e){
      e.stopPropagation();
      if(e.key === 'Escape'){ closeAdmin(); return; }
      // та же клавиша закрывает панель (кроме набора текста в полях)
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if(!e.repeat && typeof toolKeyMatch === 'function' && toolKeyMatch('#admBtn', e) && (!typing || e.ctrlKey || e.metaKey)){ e.preventDefault(); closeAdmin(); }
    });
    document.body.appendChild(back);
    ADM.el = back;
  }

  function admPills(ov){
    var box = $('admPills'); if(!box) return; box.innerHTML = '';
    if(!ov) return;
    var open = !ov.access || ov.access.open !== false;
    var pa = h('button', { type:'button', 'class':'adm-pill ' + (open ? 'ok' : 'bad'), html:'<i></i>' + (open ? 'Доступ открыт' : 'Доступ закрыт') });
    var pr = h('button', { type:'button', 'class':'adm-pill ' + (ov.registration === 'open' ? 'warn' : 'ok'), html:'<i></i>' + (ov.registration === 'open' ? 'Регистрация открыта всем' : 'Регистрация по приглашению') });
    pa.addEventListener('click', function(){ ADM.tab = 'access'; admRender(); });
    pr.addEventListener('click', function(){ ADM.tab = 'access'; admRender(); });
    box.appendChild(pa); box.appendChild(pr);
  }

  function admRefresh(){
    return SERVER.api('GET', '/admin/overview').then(function(r){
      if(r.status !== 200){ toast(admErr(r)); return; }
      ADM.ov = r.data; SERVER.instance = { registration:r.data.registration, access:r.data.access };
      admPills(r.data); admBanner(); admRender();
    });
  }

  function admRender(){
    if(!ADM.el) return;
    ADM.el.querySelectorAll('.adm-nav button').forEach(function(b){ b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === ADM.tab)); });
    var m = $('admMain'); m.innerHTML = '';
    ({ overview:admOverview, users:admUsers, invites:admInvites, access:admAccess, points:admPoints, log:admLog })[ADM.tab](m);
  }
  function admSec(title, sub, kids){
    return h('section', { 'class':'adm-sec' }, [ h('div', { 'class':'adm-sec-h' }, [ h('h3', { text:title }), sub ? h('p', { text:sub }) : null ]) ].concat(kids || []));
  }

  // ---- обзор ----
  function admOverview(m){
    var o = ADM.ov; if(!o){ m.appendChild(h('p', { 'class':'adm-empty', text:'Загружаем…' })); return; }
    var tile = function(label, value, note, tab){
      var t = h(tab ? 'button' : 'div', { 'class':'adm-tile' + (tab ? ' link' : ''), type:tab ? 'button' : null }, [ h('div', { 'class':'k', text:label }), h('div', { 'class':'v', text:String(value) }), note ? h('div', { 'class':'n', text:note }) : null ]);
      if(tab) t.addEventListener('click', function(){ ADM.tab = tab; admRender(); });
      return t;
    };
    var u = o.users || {};
    var disk = o.disk ? Math.round(o.disk.used / o.disk.total * 100) : null;
    m.appendChild(h('div', { 'class':'adm-tiles' }, [
      tile('Пользователи', u.active || 0, (u.disabled ? u.disabled + ' отключено · ' : '') + (u.deleted ? u.deleted + ' удалено · ' : '') + 'админов: ' + (u.admins || 0), 'users'),
      tile('Сейчас в пространствах', o.online, 'с активным входом: ' + o.sessions),
      tile('Организации', o.orgs, 'пространств: ' + o.spaces),
      tile('Приглашения', o.invites_active, 'действующих ссылок', 'invites'),
      tile('База данных', admBytes(o.db_bytes), disk != null ? 'диск сервера занят на ' + disk + '%' : null),
      tile('Последняя точка', o.last_point ? admWhen(o.last_point.created_at) : 'нет', o.last_point ? '«' + o.last_point.label + '»' : 'сохраните первую', 'points')
    ]));
    m.appendChild(admSec('Активность за 14 дней', 'Входы, сохранения пространств и новые пользователи по дням', [ admChart(o.days || []) ]));
    var open = !o.access || o.access.open !== false;
    var qa = h('div', { 'class':'adm-quick' });
    var b1 = h('button', { type:'button', 'class':'btn sm' + (open ? '' : ' primary'), text:open ? 'Закрыть доступ всем' : 'Открыть доступ' });
    b1.addEventListener('click', function(){ ADM.tab = 'access'; admRender(); });
    var b2 = h('button', { type:'button', 'class':'btn sm', text:'Пригласить человека' });
    b2.addEventListener('click', function(){ ADM.tab = 'invites'; admRender(); });
    var b3 = h('button', { type:'button', 'class':'btn sm', text:'Сохранить точку восстановления' });
    b3.addEventListener('click', function(){ ADM.tab = 'points'; admRender(); });
    [b1, b2, b3].forEach(function(b){ qa.appendChild(b); });
    m.appendChild(admSec('Быстрые действия', null, [ qa ]));
  }

  // столбики по дням: три серии рядом, общая ось, подсказка при наведении и таблица значений
  function admChart(days){
    var W = 720, H = 200, pl = 34, pr = 8, pt = 10, pb = 26, n = days.length || 1;
    var max = 1; days.forEach(function(d){ ADM_SERIES.forEach(function(s){ max = Math.max(max, d[s.key] || 0); }); });
    var step = Math.max(1, Math.ceil(max / 4)), top = step * 4;
    var gw = (W - pl - pr) / n, bw = Math.max(3, Math.min(12, (gw - 8) / 3 - 2));
    var y = function(v){ return pt + (H - pt - pb) * (1 - v / top); };
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="adm-chart" role="img" aria-label="Активность за 14 дней">';
    for(var g = 0; g <= 4; g++){ var gy = y(step * g); svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" class="grid"/><text x="' + (pl - 6) + '" y="' + (gy + 4) + '" class="ax" text-anchor="end">' + step * g + '</text>'; }
    days.forEach(function(d, i){
      var x0 = pl + gw * i + (gw - (bw * 3 + 4)) / 2, dt = new Date(d.date + 'T00:00:00');
      var lab = dt.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
      svg += '<g class="day"><title>' + lab + ': ' + ADM_SERIES.map(function(s){ return s.label.toLowerCase() + ' ' + (d[s.key] || 0); }).join(', ') + '</title>';
      svg += '<rect x="' + (pl + gw * i) + '" y="' + pt + '" width="' + gw + '" height="' + (H - pt - pb) + '" class="hit"/>';
      ADM_SERIES.forEach(function(s, k){
        var v = d[s.key] || 0; if(!v) return;
        var yy = y(v), hh = Math.max(2, H - pb - yy);
        svg += '<rect x="' + (x0 + k * (bw + 2)) + '" y="' + (H - pb - hh) + '" width="' + bw + '" height="' + hh + '" rx="' + Math.min(4, bw / 2) + '" fill="' + s.color + '"/>';
      });
      svg += '</g>';
      if(i % 2 === n % 2 || i === n - 1) svg += '<text x="' + (pl + gw * i + gw / 2) + '" y="' + (H - 8) + '" class="ax" text-anchor="middle">' + lab + '</text>';
    });
    svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (H - pb) + '" y2="' + (H - pb) + '" class="base"/></svg>';
    var totals = ADM_SERIES.map(function(s){ var t = 0; days.forEach(function(d){ t += d[s.key] || 0; }); return t; });
    var legend = h('div', { 'class':'adm-legend' }, ADM_SERIES.map(function(s, k){ return h('span', { html:'<i style="background:' + s.color + '"></i>' + s.label + ' · <b>' + totals[k] + '</b>' }); }));
    var tbl = h('table', { 'class':'adm-table small' }, [ h('thead', {}, [ h('tr', {}, [ h('th', { text:'День' }) ].concat(ADM_SERIES.map(function(s){ return h('th', { text:s.label }); }))) ]),
      h('tbody', {}, days.slice().reverse().map(function(d){ return h('tr', {}, [ h('td', { text:new Date(d.date + 'T00:00:00').toLocaleDateString('ru-RU', { day:'numeric', month:'long' }) }) ].concat(ADM_SERIES.map(function(s){ return h('td', { text:String(d[s.key] || 0) }); }))); })) ]);
    var det = h('details', { 'class':'adm-details' }, [ h('summary', { text:'Таблица по дням' }), tbl ]);
    return h('div', { 'class':'adm-chart-wrap' }, [ legend, h('div', { html:svg }), det ]);
  }

  // ---- пользователи ----
  function admUsers(m){
    var tools = h('div', { 'class':'adm-tools' });
    var q = h('input', { type:'search', placeholder:'Поиск по имени, почте или организации', 'aria-label':'Поиск пользователей', value:ADM.userQuery });
    var chips = h('div', { 'class':'adm-seg', role:'group', 'aria-label':'Фильтр' });
    [['all', 'Все'], ['active', 'Активные'], ['disabled', 'Отключённые'], ['deleted', 'Удалённые'], ['admin', 'Администраторы']].forEach(function(f){
      var b = h('button', { type:'button', 'aria-pressed':String(ADM.userFilter === f[0]), text:f[1] });
      b.addEventListener('click', function(){ ADM.userFilter = f[0]; admRender(); });
      chips.appendChild(b);
    });
    var add = h('button', { type:'button', 'class':'btn primary sm', text:'Добавить пользователя' });
    add.addEventListener('click', function(){ ADM.tab = 'invites'; ADM.inviteKind = 'member'; admRender(); });
    tools.appendChild(q); tools.appendChild(chips); tools.appendChild(add);
    m.appendChild(tools);
    var list = h('div', { 'class':'adm-users' }, [ h('p', { 'class':'adm-empty', text:'Загружаем…' }) ]);
    m.appendChild(list);
    var timer = 0;
    q.addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(function(){ ADM.userQuery = q.value; draw(); }, 120); });
    var data = null;
    SERVER.api('GET', '/admin/users').then(function(r){ if(r.status !== 200){ list.innerHTML = ''; list.appendChild(h('p', { 'class':'adm-empty', text:admErr(r) })); return; } data = r.data; draw(); });
    function draw(){
      if(!data) return;
      var qq = ADM.userQuery.trim().toLowerCase();
      var rows = data.users.filter(function(u){
        var f = ADM.userFilter;
        if(f === 'active' && (u.disabled || u.deleted)) return false;
        if(f === 'disabled' && !u.disabled) return false;
        if(f === 'deleted' && !u.deleted) return false;
        if(f === 'admin' && !u.is_admin) return false;
        if(!qq) return true;
        return (u.name + ' ' + u.email + ' ' + u.orgs.map(function(o){ return o.name; }).join(' ')).toLowerCase().indexOf(qq) >= 0;
      });
      list.innerHTML = '';
      if(!rows.length){ list.appendChild(h('p', { 'class':'adm-empty', text:'Никого не нашлось' })); return; }
      rows.forEach(function(u){ list.appendChild(admUserRow(u, u.id === data.me)); });
    }
  }
  function admUserRow(u, me){
    var status = u.deleted ? ['bad', 'удалён'] : u.disabled ? ['warn', 'вход отключён'] : u.online ? ['ok', 'в сети'] : null;
    var av = h('div', { 'class':'adm-av' + (u.online ? ' on' : ''), text:admInitials(u), 'aria-hidden':'true' });
    var who = h('div', { 'class':'adm-who' }, [
      h('div', { 'class':'nm' }, [ document.createTextNode((u.name || u.email) + (me ? ' (вы)' : '')),
        u.is_admin ? h('span', { 'class':'adm-badge acc', text:'админ' }) : null,
        status ? h('span', { 'class':'adm-badge ' + status[0], text:status[1] }) : null ]),
      h('div', { 'class':'em', text:u.email + ' · ' + (u.last_login ? 'входил(а) ' + admWhen(u.last_login) : 'ещё не входил(а)') }),
      h('div', { 'class':'orgs' }, u.orgs.map(function(o){ return h('span', { 'class':'adm-org', text:o.name + ' · ' + (ADM_ROLES[o.role] || o.role) }); }))
    ]);
    var acts = h('div', { 'class':'adm-acts' });
    if(!me){
      if(u.deleted){
        var rs = h('button', { type:'button', 'class':'btn sm', text:'Восстановить' });
        rs.addEventListener('click', function(){ admAct('POST', '/users/' + u.id + '/restore'); });
        var pg = h('button', { type:'button', 'class':'btn sm danger', text:'Удалить навсегда' });
        admArm(pg, 'Нажмите ещё раз: ' + (u.name || u.email) + ' удалится без возможности вернуть', function(){
          SERVER.api('DELETE', '/admin/users/' + u.id + '/purge').then(function(r){ toast(r.status === 200 ? 'Удалён навсегда' + (r.data.orgs_removed ? ' вместе с пустыми организациями: ' + r.data.orgs_removed : '') : admErr(r)); admRefresh(); });
        });
        acts.appendChild(rs); acts.appendChild(pg);
      } else {
        var dis = h('button', { type:'button', 'class':'btn sm', text:u.disabled ? 'Включить вход' : 'Отключить вход' });
        dis.addEventListener('click', function(){ admAct('POST', '/users/' + u.id + (u.disabled ? '/enable' : '/disable')); });
        var adm = h('button', { type:'button', 'class':'btn sm', text:u.is_admin ? 'Снять админа' : 'Сделать админом' });
        adm.addEventListener('click', function(){ admAct(u.is_admin ? 'DELETE' : 'POST', '/users/' + u.id + '/admin'); });
        var del = h('button', { type:'button', 'class':'btn sm danger', text:'Удалить' });
        admArm(del, 'Нажмите ещё раз: ' + (u.name || u.email) + ' сразу потеряет доступ (это можно отменить)', function(){ admAct('DELETE', '/users/' + u.id); });
        acts.appendChild(dis); acts.appendChild(adm); acts.appendChild(del);
      }
    }
    return h('div', { 'class':'adm-urow' + (u.deleted ? ' gone' : u.disabled ? ' off' : '') }, [ av, who, acts ]);
  }

  // ---- приглашения ----
  function admInvites(m){
    var kind = ADM.inviteKind || 'org';
    var seg = h('div', { 'class':'adm-seg big', role:'radiogroup', 'aria-label':'Куда приглашаем' });
    [['org', 'Новая организация', 'Человек создаст свою организацию и станет её владельцем'], ['member', 'В существующую организацию', 'Человек войдёт в выбранную организацию с выбранной ролью']].forEach(function(k){
      var b = h('button', { type:'button', role:'radio', 'aria-checked':String(kind === k[0]) }, [ h('b', { text:k[1] }), h('span', { text:k[2] }) ]);
      b.addEventListener('click', function(){ ADM.inviteKind = k[0]; admRender(); });
      seg.appendChild(b);
    });
    var orgSel = h('select', { 'aria-label':'Организация' }), roleSel = h('select', { 'aria-label':'Роль' });
    ['editor', 'approver', 'viewer', 'owner'].forEach(function(k){ roleSel.appendChild(h('option', { value:k, text:ADM_ROLES[k] })); });
    var email = h('input', { type:'email', placeholder:'почта (необязательно — тогда войдёт любой с этой ссылкой)', 'aria-label':'Почта', autocomplete:'off' });
    var note = h('input', { type:'text', placeholder:'подпись для себя, например «Для Пети из цеха 3»', 'aria-label':'Подпись', maxlength:'200' });
    var uses = h('input', { type:'number', min:'1', max:'1000', value:'1', 'aria-label':'Сколько раз можно использовать' });
    var days = h('select', { 'aria-label':'Срок действия' });
    [[1, '1 день'], [3, '3 дня'], [7, '7 дней'], [30, '30 дней'], [90, '90 дней']].forEach(function(d){ var o = h('option', { value:String(d[0]), text:d[1] }); if(d[0] === 7) o.selected = true; days.appendChild(o); });
    var go = h('button', { type:'submit', 'class':'btn primary sm', text:'Создать ссылку' });
    var memberRow = h('div', { 'class':'adm-frow' }, [ h('label', {}, [ h('span', { text:'Организация' }), orgSel ]), h('label', {}, [ h('span', { text:'Роль' }), roleSel ]) ]);
    memberRow.hidden = kind !== 'member';
    var form = h('form', { 'class':'adm-form' }, [ seg, memberRow,
      h('div', { 'class':'adm-frow' }, [ h('label', { 'class':'wide' }, [ h('span', { text:'Почта' }), email ]) ]),
      h('div', { 'class':'adm-frow' }, [ h('label', { 'class':'wide' }, [ h('span', { text:'Подпись' }), note ]) ]),
      h('div', { 'class':'adm-frow' }, [ h('label', {}, [ h('span', { text:'Использований' }), uses ]), h('label', {}, [ h('span', { text:'Действует' }), days ]), go ]) ]);
    if(kind === 'member'){
      SERVER.api('GET', '/admin/orgs').then(function(r){
        if(r.status !== 200) return;
        r.data.forEach(function(o){ var op = h('option', { value:o.id, text:o.name + ' · участников: ' + o.members }); if(SERVER.org && o.id === SERVER.org.id) op.selected = true; orgSel.appendChild(op); });
      });
    }
    var linkBox = h('div', { 'class':'adm-link', hidden:'' });
    function showLink(url, what){
      linkBox.hidden = false; linkBox.innerHTML = '';
      var inp = h('input', { type:'text', readonly:'', value:url, 'aria-label':'Ссылка-приглашение' });
      var cp = h('button', { type:'button', 'class':'btn primary sm', text:'Скопировать' });
      cp.addEventListener('click', function(){ inp.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function(){ toast('Ссылка скопирована'); }, function(){ document.execCommand('copy'); toast('Ссылка скопирована'); }); });
      linkBox.appendChild(h('div', { 'class':'t', text:'Ссылка готова: ' + what + '. Сохраните её сейчас — второй раз её не показать, только отозвать и создать новую.' }));
      linkBox.appendChild(h('div', { 'class':'r' }, [ inp, cp ]));
      setTimeout(function(){ inp.select(); }, 30);
    }
    if(ADM.lastLink) showLink(ADM.lastLink.url, ADM.lastLink.what);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var body = { kind:kind, note:note.value.trim(), email:email.value.trim() || null, max_uses:Math.max(1, Math.min(1000, parseInt(uses.value, 10) || 1)), days:parseInt(days.value, 10) };
      if(kind === 'member'){ body.org_id = orgSel.value; body.role = roleSel.value; }
      if(body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)){ toast('Проверьте почту'); email.focus(); return; }
      go.disabled = true;
      SERVER.api('POST', '/admin/invites', body).then(function(r){
        go.disabled = false;
        if(r.status !== 201){ toast(admErr(r)); return; }
        var what = kind === 'org' ? 'новая организация' : 'вход в «' + (orgSel.selectedOptions[0] ? orgSel.selectedOptions[0].text.split(' · ')[0] : '') + '» (' + ADM_ROLES[roleSel.value] + ')';
        ADM.lastLink = { url:location.origin + r.data.path, what:what };
        showLink(ADM.lastLink.url, what);
        drawList(); admRefreshQuiet();
      });
    });
    m.appendChild(admSec('Новая ссылка-приглашение', 'Регистрация на сервере — только по таким ссылкам (если она не открыта для всех в разделе «Доступ»)', [ form, linkBox ]));
    var list = h('div', { 'class':'adm-inv-list' });
    m.appendChild(admSec('Выданные ссылки', null, [ list ]));
    function drawList(){
      SERVER.api('GET', '/admin/invites').then(function(r){
        list.innerHTML = '';
        if(r.status !== 200){ list.appendChild(h('p', { 'class':'adm-empty', text:admErr(r) })); return; }
        if(!r.data.length){ list.appendChild(h('p', { 'class':'adm-empty', text:'Ссылок пока нет' })); return; }
        var ST = { active:['ok', 'действует'], used:['dim', 'использована'], expired:['dim', 'истекла'], revoked:['bad', 'отозвана'] };
        r.data.forEach(function(i){
          var st = ST[i.state] || ['dim', i.state];
          var pct = Math.round(i.uses / i.max_uses * 100);
          var bar = h('div', { 'class':'adm-uses', title:'Использовано ' + i.uses + ' из ' + i.max_uses }, [ h('i', { style:'width:' + pct + '%' }), h('span', { text:i.uses + ' / ' + i.max_uses }) ]);
          var acts = h('div', { 'class':'adm-acts' });
          if(i.state === 'active'){
            var rv = h('button', { type:'button', 'class':'btn sm', text:'Отозвать' });
            rv.addEventListener('click', function(){ admAct('DELETE', '/invites/' + i.id).then(drawList); });
            acts.appendChild(rv);
          }
          list.appendChild(h('div', { 'class':'adm-irow' + (i.state === 'active' ? '' : ' past') }, [
            h('div', { 'class':'adm-who' }, [
              h('div', { 'class':'nm' }, [ document.createTextNode(i.note || (i.kind === 'org' ? 'Новая организация' : 'В «' + i.org + '»')), h('span', { 'class':'adm-badge ' + st[0], text:st[1] }) ]),
              h('div', { 'class':'em', text:(i.kind === 'org' ? 'создать организацию' : 'в «' + i.org + '» · ' + (ADM_ROLES[i.role] || i.role)) + (i.email ? ' · только для ' + i.email : '') + ' · до ' + admWhen(i.expires_at) }) ]),
            bar, acts ]));
        });
      });
    }
    drawList();
  }
  function admRefreshQuiet(){ SERVER.api('GET', '/admin/overview').then(function(r){ if(r.status === 200){ ADM.ov = r.data; admPills(r.data); } }); }

  // ---- доступ и регистрация ----
  function admAccess(m){
    var o = ADM.ov || {}, open = !o.access || o.access.open !== false;
    var msg = h('input', { type:'text', maxlength:'300', placeholder:'причина для пользователей, например «обновление до 18:00»', 'aria-label':'Причина закрытия', value:(o.access && o.access.message) || '' });
    var sw = h('button', { type:'button', role:'switch', 'aria-checked':String(open), 'class':'adm-switch' + (open ? ' on' : ''), 'aria-label':'Доступ к серверу' }, [ h('i') ]);
    sw.addEventListener('click', function(){ admAct('POST', '/access', { open:!open, message:open ? msg.value.trim() : '' }); });
    var card = h('div', { 'class':'adm-gate ' + (open ? 'open' : 'closed') }, [
      h('div', { 'class':'adm-gate-ic', html:admIcon(open ? '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 017.5-2"/>' : '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>') }),
      h('div', { 'class':'adm-gate-t' }, [ h('b', { text:open ? 'Сервер открыт' : 'Сервер закрыт для всех, кроме администраторов' }),
        h('span', { text:open ? 'Все пользователи входят и работают как обычно. Закрытие сразу отключит их открытые вкладки и вход — ваши данные и данные пользователей не меняются.'
                              : 'Пользователи видят страницу входа с причиной. Администраторы работают как обычно. Откройте доступ, когда закончите.' }) ]),
      sw ]);
    var kids = [ card ];
    if(open) kids.push(h('label', { 'class':'adm-msg' }, [ h('span', { text:'Причина, которую увидят пользователи' }), msg ]));
    // схема: кто сейчас может войти
    var who = [ ['Администраторы', true], ['Участники организаций', open], ['Новые люди по ссылке-приглашению', open], ['Новые люди без приглашения', open && o.registration === 'open'] ];
    var flow = h('div', { 'class':'adm-flow' }, who.map(function(w){ return h('div', { 'class':'adm-flow-r ' + (w[1] ? 'yes' : 'no') }, [ h('i', { html:admIcon(w[1] ? '<path d="M5 12l5 5 9-10"/>' : '<path d="M6 6l12 12M18 6L6 18"/>') }), h('span', { text:w[0] }), h('b', { text:w[1] ? 'могут войти' : 'не могут' }) ]); }));
    m.appendChild(admSec('Доступ к серверу', null, kids));
    var seg = h('div', { 'class':'adm-seg big', role:'radiogroup', 'aria-label':'Регистрация' });
    [['invite', 'Только по приглашению', 'Новые организации и люди — только по ссылкам из раздела «Приглашения». Рекомендуется.'], ['open', 'Открыта для всех', 'Любой, кто откроет сайт, создаст свою организацию. Подходит, когда сервис готов к публичному запуску.']].forEach(function(k){
      var b = h('button', { type:'button', role:'radio', 'aria-checked':String(o.registration === k[0]) }, [ h('b', { text:k[1] }), h('span', { text:k[2] }) ]);
      b.addEventListener('click', function(){ if(o.registration !== k[0]) admAct('POST', '/registration', { mode:k[0] }); });
      seg.appendChild(b);
    });
    m.appendChild(admSec('Регистрация', null, [ seg ]));
    m.appendChild(admSec('Кто сейчас может войти', null, [ flow ]));
  }

  // ---- точки восстановления ----
  function admPoints(m){
    var label = h('input', { type:'text', maxlength:'200', placeholder:'название, например «Перед запуском для цеха 3»', 'aria-label':'Название точки' });
    var note = h('input', { type:'text', maxlength:'1000', placeholder:'заметка (необязательно)', 'aria-label':'Заметка' });
    var go = h('button', { type:'submit', 'class':'btn primary sm', text:'Сохранить точку' });
    var form = h('form', { 'class':'adm-form row' }, [ label, note, go ]);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!label.value.trim()){ toast('Назовите точку'); label.focus(); return; }
      go.disabled = true;
      SERVER.api('POST', '/admin/points', { label:label.value.trim(), note:note.value.trim() }).then(function(r){
        go.disabled = false;
        if(r.status !== 201){ toast(admErr(r)); return; }
        toast('Точка сохранена: ' + r.data.stats.spaces + ' пространств, ' + r.data.stats.users + ' пользователей');
        admRefresh();
      });
    });
    m.appendChild(admSec('Новая точка', 'Снимок всех пространств, пользователей, участников организаций и настроек сервера. К нему можно вернуться одним нажатием — перед возвратом сервер сам сохранит точку «Перед восстановлением», так что возврат тоже отменяется.', [ form ]));
    var tl = h('ol', { 'class':'adm-tl' }, [ h('li', { 'class':'adm-empty', text:'Загружаем…' }) ]);
    m.appendChild(admSec('История точек', null, [ tl ]));
    SERVER.api('GET', '/admin/points').then(function(r){
      tl.innerHTML = '';
      if(r.status !== 200){ tl.appendChild(h('li', { 'class':'adm-empty', text:admErr(r) })); return; }
      if(!r.data.length){ tl.appendChild(h('li', { 'class':'adm-empty', text:'Точек пока нет — сохраните первую' })); return; }
      tl.appendChild(h('li', { 'class':'adm-tl-now' }, [ h('i'), h('b', { text:'Сейчас' }) ]));
      r.data.forEach(function(p){
        var s = p.stats || {};
        var acts = h('div', { 'class':'adm-acts' });
        var rs = h('button', { type:'button', 'class':'btn sm', text:'Вернуться к этой точке' });
        admArm(rs, 'Нажмите ещё раз: пространства, пользователи и настройки вернутся к «' + p.label + '» (это можно отменить)', function(){ admAct('POST', '/points/' + p.id + '/restore'); });
        var dl = h('button', { type:'button', 'class':'btn sm danger', text:'Удалить' });
        admArm(dl, 'Нажмите ещё раз: точка «' + p.label + '» удалится навсегда', function(){ admAct('DELETE', '/points/' + p.id); });
        acts.appendChild(rs); acts.appendChild(dl);
        tl.appendChild(h('li', { 'class':'adm-tl-p ' + p.kind }, [ h('i'),
          h('div', { 'class':'adm-who' }, [
            h('div', { 'class':'nm' }, [ document.createTextNode(p.label), p.kind === 'auto' ? h('span', { 'class':'adm-badge dim', text:'автоматически' }) : null ]),
            h('div', { 'class':'em', text:admWhen(p.created_at) + (p.by ? ' · ' + p.by : '') + (p.note ? ' · ' + p.note : '') }),
            h('div', { 'class':'orgs' }, [ h('span', { 'class':'adm-org', text:'пространств: ' + (s.spaces || 0) }), h('span', { 'class':'adm-org', text:'пользователей: ' + (s.users || 0) }),
              h('span', { 'class':'adm-org', text:'организаций: ' + (s.orgs || 0) }), h('span', { 'class':'adm-org', text:admBytes(s.bytes || 0) }) ]) ]),
          acts ]));
      });
    });
  }

  // ---- журнал ----
  function admLog(m){
    var box = h('div', { 'class':'adm-log' }, [ h('p', { 'class':'adm-empty', text:'Загружаем…' }) ]);
    m.appendChild(admSec('Действия администраторов', 'Почти любое действие можно отменить, а отмену — вернуть. Отмена выполняет обратное действие и тоже попадает в журнал.', [ box ]));
    SERVER.api('GET', '/admin/actions?limit=200').then(function(r){
      box.innerHTML = '';
      if(r.status !== 200){ box.appendChild(h('p', { 'class':'adm-empty', text:admErr(r) })); return; }
      if(!r.data.length){ box.appendChild(h('p', { 'class':'adm-empty', text:'Пока ничего не происходило' })); return; }
      var day = '';
      r.data.forEach(function(a){
        var d = new Date(a.created_at), dk = d.toDateString();
        if(dk !== day){ day = dk; box.appendChild(h('h4', { text:dk === new Date().toDateString() ? 'Сегодня' : d.toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) })); }
        var acts = h('div', { 'class':'adm-acts' });
        if(a.can_undo){
          var u = h('button', { type:'button', 'class':'btn sm', text:'Отменить' });
          u.addEventListener('click', function(){ admUndo(a.id); });
          acts.appendChild(u);
        }
        box.appendChild(h('div', { 'class':'adm-lrow' + (a.undone_at ? ' undone' : '') }, [
          h('time', { text:d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' }) }),
          h('div', { 'class':'adm-who' }, [ h('div', { 'class':'nm', text:a.summary }),
            h('div', { 'class':'em', text:(a.by || '—') + (a.undone_at ? ' · отменено ' + admWhen(a.undone_at) : a.can_undo ? '' : ' · не отменяется') }) ]),
          acts ]));
      });
    });
  }

  // полоса для администратора, пока доступ закрыт: чтобы не забыть открыть
  function admBanner(){
    var inst = SERVER && SERVER.instance, closed = inst && inst.access && inst.access.open === false;
    var b = $('admBanner');
    if(!closed){ if(b) b.hidden = true; return; }
    if(!b){
      b = h('div', { 'class':'adm-banner', id:'admBanner', role:'status' }, [ h('span', { text:'Доступ к серверу закрыт для всех, кроме администраторов.' }) ]);
      var op = h('button', { type:'button', 'class':'btn sm', text:'Открыть панель' });
      op.addEventListener('click', function(){ openAdmin('access'); });
      b.appendChild(op);
      document.body.appendChild(b);
    }
    b.hidden = false;
  }
  if(SERVER && SERVER.admin){
    setTimeout(admBanner, 0);
    var admB = $('admBtn');
    if(admB){
      admB.hidden = (UI.tools || {}).admin === false;
      admB.setAttribute('aria-pressed', 'false');
      admB.addEventListener('click', function(){ admToggle(); });
    }
    if(typeof cmdCommands === 'function'){
      var _admCmds = cmdCommands;
      cmdCommands = function(){ return _admCmds().concat([{ sec:'help', label:'Панель администратора', d:'Пользователи, приглашения, доступ, точки восстановления', icon:'keys', act:function(){ openAdmin(); }, k:'админ администратор панель пользователи приглашения доступ точки восстановления' }]); };
    }
  }
