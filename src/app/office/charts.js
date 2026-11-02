  /* ---------- диаграммы (SVG) ---------- */
  var CH_COLORS = ['#2563EB', '#16A34A', '#EA580C', '#9333EA', '#DC2626', '#0891B2', '#CA8A04', '#DB2777'];
  function chartData(aoa){
    // первая колонка — подписи, остальные — ряды; первая строка — заголовки, если в ней не числа
    if(!aoa.length) return { labels:[], series:[] };
    var head = aoa[0].slice(1).some(function(x){ return typeof num(x) !== 'number'; }) || typeof num(aoa[0][0]) !== 'number' && aoa.length > 1 && aoa[0].slice(1).every(function(x){ return typeof num(x) !== 'number'; });
    var body = head ? aoa.slice(1) : aoa, names = head ? aoa[0].slice(1).map(String) : aoa[0].slice(1).map(function(x, i){ return 'Ряд ' + (i + 1); });
    var labels = body.map(function(r){ return fmtCell(r[0]); });
    var series = names.map(function(n, i){ return { name:n, values:body.map(function(r){ var v = num(r[i + 1]); return typeof v === 'number' ? v : 0; }) }; });
    return { labels:labels, series:series.filter(function(s){ return s.values.some(function(v){ return v !== 0; }) || series.length === 1; }) };
  }
  function shortNum(v){ var a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(1).replace('.0', '') + ' млрд' : a >= 1e6 ? (v / 1e6).toFixed(1).replace('.0', '') + ' млн' : a >= 1e3 ? (v / 1e3).toFixed(0) + ' тыс' : String(Math.round(v * 100) / 100); }
  function chartSvg(aoa, type, title, w, hgt, dark){
    var d = chartData(aoa), ink = dark ? '#E5E7EB' : '#1F2937', mute = dark ? '#9CA3AF' : '#6B7280', grid = dark ? 'rgba(255,255,255,.12)' : '#E5E7EB';
    w = w || 520; hgt = hgt || 300;
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + hgt + '" width="100%" style="max-width:' + w + 'px;font-family:Inter,Arial,sans-serif" role="img" aria-label="' + escHtml(title || 'Диаграмма') + '">'];
    if(title) o.push('<text x="' + w / 2 + '" y="20" text-anchor="middle" font-size="14" font-weight="700" fill="' + ink + '">' + escHtml(title) + '</text>');
    var top = title ? 36 : 14, bottom = hgt - 46, left = 56, right = w - 14;
    if(!d.series.length || !d.labels.length){ o.push('<text x="' + w / 2 + '" y="' + hgt / 2 + '" text-anchor="middle" font-size="13" fill="' + mute + '">Нет числовых данных в диапазоне</text></svg>'); return o.join(''); }
    if(type === 'pie'){
      var vals = d.series[0].values.map(function(v){ return Math.max(0, v); }), tot = vals.reduce(function(s, v){ return s + v; }, 0) || 1;
      var cx = Math.min(w * 0.36, 150), cy = (top + hgt - 10) / 2, rad = Math.min(cx - 16, (hgt - top - 20) / 2), a = -Math.PI / 2;
      vals.forEach(function(v, i){
        var b = a + v / tot * Math.PI * 2, large = b - a > Math.PI ? 1 : 0;
        var p = vals.length === 1 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="' + CH_COLORS[0] + '"/>' :
          '<path d="M' + cx + ',' + cy + ' L' + (cx + rad * Math.cos(a)).toFixed(1) + ',' + (cy + rad * Math.sin(a)).toFixed(1) + ' A' + rad + ',' + rad + ' 0 ' + large + ' 1 ' + (cx + rad * Math.cos(b)).toFixed(1) + ',' + (cy + rad * Math.sin(b)).toFixed(1) + ' Z" fill="' + CH_COLORS[i % CH_COLORS.length] + '" stroke="' + (dark ? '#111' : '#fff') + '" stroke-width="2"/>';
        o.push(p); a = b;
      });
      d.labels.slice(0, 10).forEach(function(l, i){ var y = top + 8 + i * 22; o.push('<rect x="' + (cx * 2 + 10) + '" y="' + (y - 9) + '" width="11" height="11" rx="2" fill="' + CH_COLORS[i % CH_COLORS.length] + '"/><text x="' + (cx * 2 + 28) + '" y="' + y + '" font-size="12" fill="' + ink + '">' + escHtml(String(l).slice(0, 22)) + ' — ' + Math.round(vals[i] / tot * 100) + '%</text>'); });
      o.push('</svg>'); return o.join('');
    }
    var all = []; d.series.forEach(function(s){ all = all.concat(s.values); });
    var mx = Math.max.apply(0, all.concat([0])), mn = Math.min.apply(0, all.concat([0])); if(mx === mn) mx = mn + 1;
    var sy = function(v){ return bottom - (v - mn) / (mx - mn) * (bottom - top); };
    for(var g = 0; g <= 4; g++){ var gv = mn + (mx - mn) * g / 4, y = sy(gv); o.push('<line x1="' + left + '" x2="' + right + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + grid + '"/><text x="' + (left - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + mute + '">' + shortNum(gv) + '</text>'); }
    var n = d.labels.length, bw = (right - left) / n;
    if(type === 'line'){
      d.series.forEach(function(s, si){
        var pts = s.values.map(function(v, i){ return (left + bw * (i + 0.5)).toFixed(1) + ',' + sy(v).toFixed(1); });
        o.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + CH_COLORS[si % CH_COLORS.length] + '" stroke-width="2.5" stroke-linejoin="round"/>');
        pts.forEach(function(p){ var xy = p.split(','); o.push('<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3.5" fill="' + CH_COLORS[si % CH_COLORS.length] + '"/>'); });
      });
    } else {
      var k = d.series.length, inner = bw * 0.72, each = inner / k;
      d.series.forEach(function(s, si){ s.values.forEach(function(v, i){ var x = left + bw * i + (bw - inner) / 2 + each * si, y0 = sy(Math.max(0, mn)), y1 = sy(v); o.push('<rect x="' + x.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + Math.max(1, each - 2).toFixed(1) + '" height="' + Math.abs(y0 - y1).toFixed(1) + '" rx="2" fill="' + CH_COLORS[si % CH_COLORS.length] + '"/>'); }); });
    }
    d.labels.forEach(function(l, i){ if(n > 12 && i % Math.ceil(n / 12)) return; o.push('<text x="' + (left + bw * (i + 0.5)).toFixed(1) + '" y="' + (bottom + 15) + '" text-anchor="middle" font-size="10.5" fill="' + mute + '">' + escHtml(String(l).slice(0, 14)) + '</text>'); });
    if(d.series.length > 1 || d.series[0].name) d.series.slice(0, 6).forEach(function(s, i){ var x = left + i * 120; o.push('<rect x="' + x + '" y="' + (hgt - 16) + '" width="10" height="10" rx="2" fill="' + CH_COLORS[i % CH_COLORS.length] + '"/><text x="' + (x + 15) + '" y="' + (hgt - 7) + '" font-size="11" fill="' + ink + '">' + escHtml(s.name.slice(0, 16)) + '</text>'); });
    o.push('</svg>'); return o.join('');
  }
  function embedHtml(spec, dark){
    // живая вставка из таблицы: таблица или диаграмма
    var f = ofFile(spec.src);
    if(!f || f.type !== 'sheet') return '<div class="lnk-miss">Источник «' + escHtml(spec.name || 'таблица') + '» не найден</div>';
    var idx = Math.min(spec.sheet || 0, f.data.sheets.length - 1), sh = f.data.sheets[idx], g = parseRange(spec.range) || usedRange(sh);
    var aoa = rangeValues(f, idx, g);
    if(spec.kind === 'chart') return chartSvg(aoa, spec.ctype || 'bar', spec.title || '', 560, 300, spec.dark);
    var fmt = sh.fmt || {};
    return '<table class="lnk-t"><tbody>' + aoa.map(function(row, ri){ return '<tr>' + row.map(function(v, ci){ var cf = fmt[(g.r0 + ri) + ':' + (g.c0 + ci)] || {}; var tag = ri === 0 && g.r0 === 0 ? 'th' : 'td'; return '<' + tag + (typeof v === 'number' ? ' style="text-align:right"' : '') + '>' + escHtml(fmtNum(v, cf.nf)) + '</' + tag + '>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
