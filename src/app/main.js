  setEnv(curProj().env || 'code');
  if(hist.last === null) commitHist();      // исходное состояние — чтобы первое действие можно было отменить
  applyTheme();
  renderChips();
  renderList();
  renderGraph();
  if(G.nodes[0]) S.doc = { kind:'node', id:G.nodes[0].id };
  render();
  ofLoad();
  // первый вход в облако: в этом браузере остались пространства — предложим перенести
  if(SERVER && SERVER.localCount() && !Repo.pref('imported', false)){
    setTimeout(function(){ toastAct('В этом браузере есть пространства (' + SERVER.localCount() + '). Перенести их в облако?', 'Перенести', function(){ Repo.setPref('imported', true); importLocal(); }); }, 1200);
  }
  // первый вход без сервера — экран «Добро пожаловать»
  if(!SERVER && !localProfile()) showWelcome(false);
  // совместная работа: подключаемся к комнате текущего пространства
  if(SERVER) liveConnect();
