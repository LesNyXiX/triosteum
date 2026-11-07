  /* ---------- значки сред в стиле приложений macOS ----------
     Каждый — полноцветная картинка 64×64: «сквиркл» с градиентом и бликом, на нём объёмный рисунок.
     envIconSvg(id) → строка SVG. Идентификаторы градиентов уникальны для каждого вызова. */
  var ENV_IC_N = 0;
  // lite — без фильтра-тени внутри картинки (для дока: значки там меняют размер на каждом кадре)
  function envIconSvg(k, lite){
    var u = 'ei' + (++ENV_IC_N) + '_', D = ENV_ICON_ART[k] || ENV_ICON_ART._other;
    var bg = D.bg;
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<linearGradient id="' + u + 'bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></linearGradient>' +
      '<linearGradient id="' + u + 'gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<filter id="' + u + 'sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".28"/></filter>' +
      (D.defs ? D.defs(u) : '') + '</defs>' +
      '<path d="M32 4c10.6 0 17.2.5 21.1 4.4S58 18.4 58 29v6c0 10.6-.9 16.7-4.9 20.6S42.6 60 32 60s-17.2-.5-21.1-4.4S6 45.6 6 35v-6c0-10.6.9-16.7 4.9-20.6S21.4 4 32 4z" fill="url(#' + u + 'bg)"/>' +
      '<clipPath id="' + u + 'cl"><path d="M32 4c10.6 0 17.2.5 21.1 4.4S58 18.4 58 29v6c0 10.6-.9 16.7-4.9 20.6S42.6 60 32 60s-17.2-.5-21.1-4.4S6 45.6 6 35v-6c0-10.6.9-16.7 4.9-20.6S21.4 4 32 4z"/></clipPath><rect x="0" y="0" width="64" height="30" fill="url(#' + u + 'gl)" clip-path="url(#' + u + 'cl)"/>' +
      (lite ? '<g>' : '<g filter="url(#' + u + 'sh)">') + D.art(u) + '</g>' +
      '<path d="M32 4c10.6 0 17.2.5 21.1 4.4S58 18.4 58 29v6c0 10.6-.9 16.7-4.9 20.6S42.6 60 32 60s-17.2-.5-21.1-4.4S6 45.6 6 35v-6c0-10.6.9-16.7 4.9-20.6S21.4 4 32 4z" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/></svg>';
  }
  var ENV_ICON_ART = {
    // Разработка: окно редактора с цветными строками кода и значком </>
    code:{ bg:['#3B82F6', '#1E3A8A'], art:function(u){ return '' +
      '<rect x="11" y="15" width="42" height="33" rx="5" fill="#0F172A"/>' +
      '<rect x="11" y="15" width="42" height="8" rx="5" fill="#1E293B"/><rect x="11" y="20" width="42" height="3" fill="#1E293B"/>' +
      '<circle cx="16.5" cy="19" r="1.6" fill="#FF5F57"/><circle cx="21.5" cy="19" r="1.6" fill="#FEBC2E"/><circle cx="26.5" cy="19" r="1.6" fill="#28C840"/>' +
      '<rect x="16" y="28" width="9" height="2.6" rx="1.3" fill="#F472B6"/><rect x="27" y="28" width="14" height="2.6" rx="1.3" fill="#93C5FD"/>' +
      '<rect x="20" y="33.5" width="12" height="2.6" rx="1.3" fill="#86EFAC"/><rect x="34" y="33.5" width="8" height="2.6" rx="1.3" fill="#FDE68A"/>' +
      '<rect x="20" y="39" width="16" height="2.6" rx="1.3" fill="#C4B5FD"/>' +
      '<circle cx="46" cy="44" r="9" fill="#fff"/><path d="M43 40.5l-3.4 3.5 3.4 3.5M49 40.5l3.4 3.5-3.4 3.5" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'; } },
    // Офис: лист документа с загнутым углом, строки текста и мини-таблица
    docs:{ bg:['#4ADE80', '#15803D'], defs:function(u){ return '<linearGradient id="' + u + 'pp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E8F5EC"/></linearGradient>'; }, art:function(u){ return '' +
      '<path d="M18 10h20l10 10v32a3 3 0 01-3 3H18a3 3 0 01-3-3V13a3 3 0 013-3z" fill="url(#' + u + 'pp)"/>' +
      '<path d="M38 10v8a2 2 0 002 2h8z" fill="#BBF7D0"/>' +
      '<rect x="20" y="17" width="13" height="2.4" rx="1.2" fill="#16A34A"/>' +
      '<rect x="20" y="23" width="22" height="1.8" rx=".9" fill="#94A3B8"/><rect x="20" y="27" width="18" height="1.8" rx=".9" fill="#94A3B8"/>' +
      '<rect x="20" y="33" width="23" height="14" rx="1.6" fill="#DCFCE7" stroke="#16A34A" stroke-width="1"/>' +
      '<path d="M20 37.7h23M20 42.3h23M27.7 33v14M35.3 33v14" stroke="#16A34A" stroke-width=".9"/>' +
      '<rect x="20.5" y="33.5" width="22" height="3.7" rx="1" fill="#22C55E" opacity=".55"/>'; } },
    // Склад: две картонные коробки с лентой
    wh:{ bg:['#FBBF24', '#B45309'], defs:function(u){ return '<linearGradient id="' + u + 'bx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E7B57A"/><stop offset="1" stop-color="#B9814A"/></linearGradient>'; }, art:function(u){ return '' +
      '<path d="M20 30l12-6 12 6v13l-12 6-12-6z" fill="#C8925A"/><path d="M20 30l12 6v13l-12-6z" fill="url(#' + u + 'bx)"/><path d="M44 30l-12 6v13l12-6z" fill="#A86F3A"/>' +
      '<path d="M20 30l12-6 12 6-12 6z" fill="#E9BE88"/><path d="M26 27l12 6v5l-2.5-1.2v-3.6L23.5 28.2z" fill="#F8E7C8"/>' +
      '<path d="M26 16l8-4 8 4v8.5l-8 4-8-4z" fill="#C8925A"/><path d="M26 16l8 4v8.5l-8-4z" fill="url(#' + u + 'bx)"/><path d="M42 16l-8 4v8.5l8-4z" fill="#A86F3A"/>' +
      '<path d="M26 16l8-4 8 4-8 4z" fill="#E9BE88"/><path d="M30 14l8 4v3.4l-1.7-.8v-2.4l-8-4z" fill="#F8E7C8"/>' +
      '<path d="M14 49h36" stroke="#78350F" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>'; } },
    // Производство: металлическая шестерня и маленькая шестерёнка
    mes:{ bg:['#F87171', '#991B1B'], defs:function(u){ return '<linearGradient id="' + u + 'mt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8FAFC"/><stop offset=".55" stop-color="#CBD5E1"/><stop offset="1" stop-color="#64748B"/></linearGradient>'; }, art:function(u){
      var g = function(cx, cy, r, R, n){ var d = ''; for(var i = 0; i < n * 2; i++){ var a = i * Math.PI / n, rr = i % 2 ? r : R, a2 = a + Math.PI / n * 0.62; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2) + 'L' + (cx + rr * Math.cos(a2)).toFixed(2) + ' ' + (cy + rr * Math.sin(a2)).toFixed(2); } return d + 'Z'; };
      return '<path d="' + g(28, 34, 14.5, 18, 10) + '" fill="url(#' + u + 'mt)"/><circle cx="28" cy="34" r="10.5" fill="none" stroke="#94A3B8" stroke-width="1.2"/><circle cx="28" cy="34" r="6" fill="#991B1B"/><circle cx="28" cy="34" r="6" fill="none" stroke="#475569" stroke-width="1.6"/>' +
        '<path d="' + g(46, 19, 6.2, 8, 8) + '" fill="url(#' + u + 'mt)"/><circle cx="46" cy="19" r="2.8" fill="#991B1B" stroke="#475569" stroke-width="1"/>'; } },
    // Финансы: стопка золотых монет со знаком рубля и стрелка роста
    fin:{ bg:['#38BDF8', '#0369A1'], defs:function(u){ return '<linearGradient id="' + u + 'au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#D97706"/></linearGradient><linearGradient id="' + u + 'as" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B45309"/><stop offset=".5" stop-color="#F59E0B"/><stop offset="1" stop-color="#B45309"/></linearGradient>'; }, art:function(u){
      var coin = function(y){ return '<path d="M15 ' + y + 'v4c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5v-4z" fill="url(#' + u + 'as)"/><ellipse cx="27" cy="' + y + '" rx="12" ry="4.5" fill="url(#' + u + 'au)"/>'; };
      return coin(46) + coin(40) + coin(34) + coin(28) +
        '<path d="M24.3 25.6h3.6a2.1 2.1 0 010 4.2h-3.6m0-4.2v7.6m-1.6-1.9h4.6" fill="none" stroke="#92400E" stroke-width="1.3" stroke-linecap="round" transform="translate(0 -2)"/>' +
        '<path d="M37 30l6-6 4 4 7-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M48.5 19h5.5v5.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'; } },
    // Персонал: два человека и пропуск
    hr:{ bg:['#A78BFA', '#5B21B6'], art:function(u){ return '' +
      '<circle cx="40" cy="22" r="6" fill="#DDD6FE"/><path d="M29.5 41c0-6.5 4.7-10.5 10.5-10.5S50.5 34.5 50.5 41z" fill="#DDD6FE"/>' +
      '<circle cx="26" cy="25" r="7.5" fill="#FDE2C8"/><path d="M18.5 22.5c.5-5 3.6-7.5 7.5-7.5s7 2.5 7.5 7.5c-2-2-4.5-3-7.5-3s-5.5 1-7.5 3z" fill="#7C2D12"/>' +
      '<path d="M13 46c0-8 5.8-13 13-13s13 5 13 13z" fill="#fff"/>' +
      '<rect x="33" y="38" width="18" height="13" rx="2.5" fill="#FDE68A" stroke="#B45309" stroke-width="1"/><circle cx="38.5" cy="43.5" r="2.4" fill="#B45309"/><rect x="42.5" y="42" width="6" height="1.5" rx=".75" fill="#B45309"/><rect x="42.5" y="45" width="4.5" height="1.5" rx=".75" fill="#B45309"/>'; } },
    // Продажи: воронка из цветных слоёв и монета внизу
    crm:{ bg:['#F472B6', '#9D174D'], art:function(u){ return '' +
      '<path d="M12 14h40l-3.5 7h-33z" fill="#FDE68A"/><path d="M16 22h32l-3.5 7h-25z" fill="#FDBA74"/><path d="M21 30h22l-3.5 7h-15z" fill="#FCA5A5"/>' +
      '<path d="M26 38h12l-2 6h-8z" fill="#fff"/><ellipse cx="32" cy="14" rx="20" ry="2.4" fill="#FEF3C7"/>' +
      '<circle cx="32" cy="51" r="5" fill="#FACC15" stroke="#A16207" stroke-width="1.2"/><path d="M30.5 49.2h2.1a1.3 1.3 0 010 2.6h-2.1m0-2.6v4.4m-.9-1.1h2.7" fill="none" stroke="#A16207" stroke-width=".9" stroke-linecap="round"/>'; } },
    // Аналитика: карточка с цветными столбцами и линией
    bi:{ bg:['#2DD4BF', '#0F766E'], art:function(u){ return '' +
      '<rect x="11" y="13" width="42" height="38" rx="5" fill="#fff"/>' +
      '<path d="M16 45h32" stroke="#CBD5E1" stroke-width="1"/>' +
      '<rect x="18" y="33" width="5.5" height="12" rx="1.2" fill="#38BDF8"/><rect x="26" y="27" width="5.5" height="18" rx="1.2" fill="#A78BFA"/><rect x="34" y="31" width="5.5" height="14" rx="1.2" fill="#F472B6"/><rect x="42" y="21" width="5.5" height="24" rx="1.2" fill="#14B8A6"/>' +
      '<path d="M19 27l8-6 8 3 10-7" fill="none" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="45" cy="17" r="2.2" fill="#F59E0B"/>'; } },
    // Фоторедактор: фотоаппарат со стеклянным объективом
    photo:{ bg:['#22D3EE', '#0E7490'], defs:function(u){ return '<radialGradient id="' + u + 'ln" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#93C5FD"/><stop offset=".35" stop-color="#1E3A8A"/><stop offset="1" stop-color="#020617"/></radialGradient><linearGradient id="' + u + 'cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1E293B"/></linearGradient>'; }, art:function(u){ return '' +
      '<path d="M22 17h10l2.5 4H22z" fill="#334155"/>' +
      '<rect x="10" y="20" width="44" height="29" rx="6" fill="url(#' + u + 'cb)"/><rect x="10" y="26" width="44" height="2" fill="#0F172A" opacity=".35"/>' +
      '<circle cx="32" cy="35" r="11" fill="#CBD5E1"/><circle cx="32" cy="35" r="8.6" fill="url(#' + u + 'ln)"/><circle cx="29" cy="32" r="2.3" fill="#fff" opacity=".75"/><circle cx="35" cy="38.2" r="1" fill="#fff" opacity=".45"/>' +
      '<circle cx="47.5" cy="24.5" r="2" fill="#FBBF24"/><rect x="14" y="23" width="6" height="2.4" rx="1.2" fill="#94A3B8"/>'; } },
    // Векторная графика: перо и кривая с опорными точками
    vector:{ bg:['#F472B6', '#86198F'], defs:function(u){ return '<linearGradient id="' + u + 'nb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8FAFC"/><stop offset="1" stop-color="#94A3B8"/></linearGradient>'; }, art:function(u){ return '' +
      '<path d="M10 46C20 20 44 52 54 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M10 46l9-15M54 22l-12 3" stroke="#FDE68A" stroke-width="1.2"/>' +
      '<rect x="7.5" y="43.5" width="5" height="5" rx="1" fill="#fff" stroke="#86198F" stroke-width="1"/><rect x="51.5" y="19.5" width="5" height="5" rx="1" fill="#fff" stroke="#86198F" stroke-width="1"/>' +
      '<circle cx="19" cy="31" r="2" fill="#FDE68A"/><circle cx="42" cy="25" r="2" fill="#FDE68A"/>' +
      '<path d="M32 13l7 10-7 13-7-13z" fill="url(#' + u + 'nb)"/><path d="M32 13v23" stroke="#475569" stroke-width="1"/><circle cx="32" cy="25" r="1.8" fill="#475569"/><path d="M25 23h14v-3H25z" fill="#334155"/>'; } },
    // Все среды: сетка цветных плиток, как Launchpad
    _all:{ bg:['#94A3B8', '#334155'], art:function(u){
      var c = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4'], s = '';
      for(var i = 0; i < 9; i++) s += '<rect x="' + (14 + (i % 3) * 13) + '" y="' + (14 + Math.floor(i / 3) * 13) + '" width="10" height="10" rx="3" fill="' + c[i] + '"/>';
      return s; } },
    _other:{ bg:['#94A3B8', '#475569'], art:function(u){ return '<rect x="18" y="18" width="28" height="28" rx="7" fill="#fff" opacity=".9"/>'; } }
  };
