// Стартовый экран: выбор режима работы приложения.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const api = window.triosteumDesktop;
  const msg = $('msg');
  function show(text) { msg.textContent = text || ''; msg.hidden = !text; }
  const q = new URLSearchParams(location.search).get('msg');
  if (q) show(q);
  if (!api) { show('Стартовый экран открыт не в приложении Triosteum.'); return; }

  api.settings().then((s) => {
    if (!s) return;
    $('server').value = s.server || '';
    $('remember').checked = !!s.remember;
    $('ver').textContent = 'Версия ' + s.version;
    if (s.mode === 'server') $('cServer').classList.add('on');
    if (s.mode === 'offline') $('cOffline').classList.add('on');
    (s.mode === 'offline' ? $('goOffline') : $('goServer')).focus();
  });

  function go(mode, btn) {
    btn.disabled = true; show('');
    api.choose(mode, $('server').value, $('remember').checked).then((r) => {
      btn.disabled = false;
      if (!r || !r.ok) show((r && r.error) || 'Не получилось открыть выбранный режим.');
    }, () => { btn.disabled = false; show('Не получилось открыть выбранный режим.'); });
  }
  $('goServer').addEventListener('click', (e) => go('server', e.currentTarget));
  $('goOffline').addEventListener('click', (e) => go('offline', e.currentTarget));
  $('server').addEventListener('keydown', (e) => { if (e.key === 'Enter') go('server', $('goServer')); });
})();
