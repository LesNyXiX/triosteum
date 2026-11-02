  setEnv(curProj().env || 'code');
  if(hist.last === null) commitHist();      // исходное состояние — чтобы первое действие можно было отменить
  applyTheme();
  renderChips();
  renderList();
  renderGraph();
  if(G.nodes[0]) S.doc = { kind:'node', id:G.nodes[0].id };
  render();
  ofLoad();