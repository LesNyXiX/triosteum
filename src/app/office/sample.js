  /* ---------- пример офиса: связанные файлы ---------- */
  function seedOffice(){
    var fin = newFile('folder', 'Финансы', null, null, { silent:true });
    var budget = newFile('sheet', 'Бюджет отдела', { activeSheet:0, sheets:[
      { name:'План', rows:[['Статья', 'Январь', 'Февраль', 'Март', 'Квартал'], ['Сырьё и материалы', '4100000', '4200000', '4200000', '=SUM(B2:D2)'], ['Энергоресурсы', '700000', '700000', '700000', '=SUM(B3:D3)'], ['ФОТ', '2800000', '2800000', '2800000', '=SUM(B4:D4)'], ['Ремонт', '300000', '320000', '330000', '=SUM(B5:D5)'], ['Итого', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)']], fmt:{ '0:0':{ b:1 }, '0:1':{ b:1 }, '0:2':{ b:1 }, '0:3':{ b:1 }, '0:4':{ b:1 }, '5:0':{ b:1 }, '5:4':{ b:1, nf:'money' } }, widths:{ 0:170 }, charts:[] },
      { name:'Факт', rows:[['Статья', 'Январь', 'Февраль', 'Март', 'Квартал'], ['Сырьё и материалы', '4310000', '4405000', '4405000', '=SUM(B2:D2)'], ['Энергоресурсы', '655000', '660000', '665000', '=SUM(B3:D3)'], ['ФОТ', '2800000', '2800000', '2800000', '=SUM(B4:D4)'], ['Ремонт', '470000', '490000', '450000', '=SUM(B5:D5)'], ['Итого', '=SUM(B2:B5)', '=SUM(C2:C5)', '=SUM(D2:D5)', '=SUM(E2:E5)']], fmt:{ '0:0':{ b:1 }, '0:1':{ b:1 }, '0:2':{ b:1 }, '0:3':{ b:1 }, '0:4':{ b:1 }, '5:0':{ b:1 } }, widths:{ 0:170 }, charts:[] },
      { name:'Итоги', rows:[['Статья', 'План', 'Факт', 'Отклонение', 'Отклонение, %'], ['Сырьё и материалы', '=План!E2', '=Факт!E2', '=C2-B2', '=D2/B2'], ['Энергоресурсы', '=План!E3', '=Факт!E3', '=C3-B3', '=D3/B3'], ['ФОТ', '=План!E4', '=Факт!E4', '=C4-B4', '=D4/B4'], ['Ремонт', '=План!E5', '=Факт!E5', '=C5-B5', '=D5/B5'], ['Итого', '=SUM(B2:B5)', '=SUM(C2:C5)', '=C6-B6', '=D6/B6']],
        fmt:{ '0:0':{ b:1 }, '0:1':{ b:1 }, '0:2':{ b:1 }, '0:3':{ b:1 }, '0:4':{ b:1 }, '1:4':{ nf:'pct' }, '2:4':{ nf:'pct' }, '3:4':{ nf:'pct' }, '4:4':{ nf:'pct', bg:'#FEE2E2' }, '5:0':{ b:1 }, '5:4':{ nf:'pct', b:1 }, '1:1':{ nf:'int' }, '1:2':{ nf:'int' }, '1:3':{ nf:'int' } }, widths:{ 0:170 }, charts:[{ id:'c1', type:'bar', range:'A1:C5', title:'План и факт за квартал' }] }
    ] }, fin.id, { silent:true });
    var rep = newFile('doc', 'Отчёт об исполнении бюджета', { html:'<h1 style="text-align:center">Отчёт об исполнении бюджета за I квартал</h1><p style="text-align:right">' + new Date().toLocaleDateString('ru-RU') + '</p><p>Фактические расходы отдела за квартал составили <b><span class="lv" data-ref="\'Бюджет отдела/Итоги\'!C6">…</span> руб.</b> при плане <span class="lv" data-ref="\'Бюджет отдела/Итоги\'!B6">…</span> руб. Отклонение — <b><span class="lv" data-ref="\'Бюджет отдела/Итоги\'!E6">…</span></b>.</p><h2>Исполнение по статьям</h2><div class="lnk" data-src="' + budget.id + '" data-sheet="2" data-range="A1:E6" data-kind="table" data-name="Бюджет отдела"></div><h2>Динамика</h2><div class="lnk" data-src="' + budget.id + '" data-sheet="2" data-range="A1:C5" data-kind="chart" data-ctype="bar" data-name="Бюджет отдела"></div><p>Основной перерасход — по статье «Ремонт» (<span class="lv" data-ref="\'Бюджет отдела/Итоги\'!E5">…</span>): внеплановая замена подшипниковых узлов на линии №2.</p><p>Начальник отдела ____________</p>' }, fin.id, { silent:true });
    newFile('slides', 'Бюджет — презентация для руководства', { theme:'green', slides:[
      { layout:'title', title:'Исполнение бюджета', body:'I квартал · отдел производства' },
      { layout:'media', title:'План и факт по статьям', body:'Данные из таблицы «Бюджет отдела»\nОбновляются автоматически', embed:{ src:budget.id, sheet:2, range:'A1:C5', kind:'chart', ctype:'bar', name:'Бюджет отдела' } },
      { layout:'two', title:'Выводы', body:'Перерасход по ремонту\nЭкономия на энергоресурсах', body2:'Пересмотреть график ППР\nЗакупить подшипники заранее' }
    ] }, fin.id, { silent:true });
    var reg = newFile('sheet', 'Реестр договоров', { sheets:[{ name:'Договоры', rows:parseSheet(pluginById('sh-contracts').code).rows, fmt:{ '0:0':{ b:1 }, '0:1':{ b:1 }, '0:2':{ b:1 }, '0:3':{ b:1 }, '0:4':{ b:1 }, '0:5':{ b:1 }, '0:6':{ b:1 } }, widths:{ 2:170, 3:200 }, charts:[] }] }, null, { silent:true });
    newFile('doc', 'Договор поставки (шаблон)', { html:pluginById('doc-contract').code }, null, { silent:true });
    var form = newFile('form', 'Заявка на закупку', tplList().filter(function(x){ return x.name === 'Заявка на закупку'; })[0].make(), null, { silent:true });
    formTarget(form);
    // автоматизация: маршрут, который берёт договоры прямо из файла «Реестр договоров»
    var spec = [['sh-contracts', reg.id], ['doc-contract'], ['cd-big'], ['st-fin'], ['st-sign'], ['sn-xlsx']];
    var ns = spec.map(function(s){ var p = pluginById(s[0]); var n = { id:'n' + (G.seq++), name:p.name, lang:p.lang, x:0, y:0, codes:{}, pluginId:p.id, family:null, desc:p.desc, colors:null }; if(s[1]){ n.src = s[1]; n.name = 'Реестр договоров (файл)'; } G.nodes.push(n); return n; });
    for(var i = 0; i + 1 < ns.length; i++) G.edges.push({ id:'e' + (G.seq++), from:ns[i].id, to:ns[i + 1].id, taps:[] });
    layoutSet(ns, 100, 300);
    arrangeDesk(); saveGraph(); ofRender();
    toast('Пример загружен: бюджет, отчёт и презентация связаны с таблицей; маршрут — во вкладке «Автоматизация»');
  }
