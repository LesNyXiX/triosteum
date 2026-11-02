  /* ---------- первый вход без сервера: «Добро пожаловать» ---------- */
  // На GitHub Pages и при открытии файла с диска сервера нет, поэтому настоящих аккаунтов нет.
  // При первом открытии спрашиваем имя и организацию, храним в этом браузере и переходим в Triosteum.
  // Когда Triosteum работает с сервера (SERVER), вместо этого экрана — настоящий вход /login.
  function localProfile(){ var p = Repo.pref('profile', null); return p && p.name ? p : null; }
  function showWelcome(editing){
    if(SERVER || $('welcome')) return;
    var prof = localProfile() || {};
    var box = h('div', { 'class':'welcome', id:'welcome', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'wcTitle' });
    var name = h('input', { id:'wcName', autocomplete:'name', maxlength:'80', placeholder:'Иван Петров' }); name.value = prof.name || '';
    var org = h('input', { id:'wcOrg', autocomplete:'organization', maxlength:'120', placeholder:'ООО «Завод»' }); org.value = prof.org || '';
    var err = h('p', { 'class':'wc-err', role:'alert' });
    var form = h('form', { novalidate:'novalidate' }, [
      h('label', { 'for':'wcName', text:'Ваше имя' }), name,
      h('label', { 'for':'wcOrg', text:'Организация' }), org,
      err,
      h('button', { 'class':'wc-go', type:'submit', text:editing ? 'Сохранить' : 'Начать работу' })
    ]);
    box.appendChild(h('main', { 'class':'wc-card' }, [
      h('div', { 'class':'wc-brand' }, [ h('span', { 'class':'wc-logo', 'aria-hidden':'true' }), h('span', { text:'Triosteum' }) ]),
      h('h1', { id:'wcTitle', text:editing ? 'Профиль' : 'Добро пожаловать' }),
      h('p', { 'class':'wc-sub', text:editing ? 'Имя и организация видны в меню пространств.' : 'Платформа для предприятия: блоки кода, документы, таблицы и маршруты согласования в одном месте. Представьтесь, чтобы начать.' }),
      form,
      h('p', { 'class':'wc-note', text:'Профиль и пространства хранятся только в этом браузере. Вход по паролю и общая работа с коллегами появятся, когда Triosteum заработает на сервере.' })
    ]));
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var n = name.value.trim(), o = org.value.trim();
      if(!n){ err.textContent = 'Как вас зовут?'; name.focus(); return; }
      if(!o){ err.textContent = 'Укажите организацию'; org.focus(); return; }
      var first = !localProfile();
      Repo.setPref('profile', { name:n, org:o, since:prof.since || new Date().toISOString() });
      closeWelcome(function(){
        if(first){ toast('Добро пожаловать, ' + n.split(' ')[0] + '! Выберите среду, с которой начнёте'); openEco(); }
        else toast('Профиль сохранён');
      });
    });
    if(editing) box.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.stopPropagation(); closeWelcome(); } });
    document.body.appendChild(box);
    setTimeout(function(){ (name.value ? org : name).focus(); }, 60);
  }
  function closeWelcome(after){
    var box = $('welcome'); if(!box) return;
    var done = function(){ if(box.parentNode) box.remove(); if(after) after(); };
    if(document.body.classList.contains('noanim')) return done();
    box.classList.add('leaving'); setTimeout(done, 480);
  }
  function localLogout(){
    Repo.setPref('profile', null);
    toast('Вы вышли. Пространства остались в этом браузере');
    showWelcome(false);
  }
