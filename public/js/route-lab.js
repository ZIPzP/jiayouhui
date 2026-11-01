(() => {
    'use strict';
    const COLORS = ['#0f766e', '#f97316', '#2563eb', '#9333ea'];
    const PACE = {
      relaxed: { label: '轻松慢游', budget: 330, start: 9.5, maxStops: 3 },
      standard: { label: '标准', budget: 450, start: 9, maxStops: 4 },
      packed: { label: '紧凑', budget: 570, start: 8.5, maxStops: 5 }
    };
    const CITIES = {
      beijing: {
        name: '北京',
        hotel: { name: '王府井酒店', lat: 39.915, lon: 116.407 },
        spots: [
          { name: '故宫博物院', lat: 39.9163, lon: 116.3972, zone: '中心轴', duration: 180, tag: '历史' },
          { name: '八达岭长城', lat: 40.3590, lon: 116.0160, zone: '北郊', duration: 240, tag: '必去' },
          { name: '颐和园', lat: 39.9999, lon: 116.2755, zone: '西北', duration: 180, tag: '皇家园林' },
          { name: '天坛公园', lat: 39.8822, lon: 116.4066, zone: '南城', duration: 120, tag: '文化' },
          { name: '圆明园', lat: 40.0080, lon: 116.2980, zone: '西北', duration: 120, tag: '历史' },
          { name: '景山公园', lat: 39.9250, lon: 116.3967, zone: '中心轴', duration: 60, tag: '登高' },
          { name: '前门大街', lat: 39.8990, lon: 116.3970, zone: '南城', duration: 90, tag: '美食' },
          { name: '北海公园', lat: 39.9256, lon: 116.3893, zone: '中心轴', duration: 90, tag: '亲子' },
          { name: '什刹海', lat: 39.9400, lon: 116.3860, zone: '中心轴', duration: 90, tag: '慢逛' }
        ]
      },
      shanghai: {
        name: '上海',
        hotel: { name: '人民广场酒店', lat: 31.2304, lon: 121.4737 },
        spots: [
          { name: '外滩', lat: 31.2400, lon: 121.4900, zone: '黄浦江', duration: 90, tag: '夜景' },
          { name: '朱家角古镇', lat: 31.1140, lon: 121.0560, zone: '青浦', duration: 180, tag: '水乡' },
          { name: '豫园', lat: 31.2270, lon: 121.4920, zone: '老城厢', duration: 90, tag: '园林' },
          { name: '田子坊', lat: 31.2100, lon: 121.4680, zone: '法租界', duration: 90, tag: '文艺' },
          { name: '上海博物馆', lat: 31.2300, lon: 121.4730, zone: '人民广场', duration: 150, tag: '博物馆' },
          { name: '武康路', lat: 31.2070, lon: 121.4380, zone: '法租界', duration: 90, tag: '漫步' },
          { name: '南京路步行街', lat: 31.2350, lon: 121.4750, zone: '人民广场', duration: 90, tag: '购物' },
          { name: '上海迪士尼', lat: 31.1430, lon: 121.6570, zone: '浦东', duration: 420, tag: '亲子' }
        ]
      },
      hangzhou: {
        name: '杭州',
        hotel: { name: '湖滨酒店', lat: 30.2580, lon: 120.1640 },
        spots: [
          { name: '西湖断桥', lat: 30.2590, lon: 120.1480, zone: '西湖', duration: 60, tag: '经典' },
          { name: '灵隐寺', lat: 30.2400, lon: 120.1020, zone: '西湖西', duration: 150, tag: '人文' },
          { name: '雷峰塔', lat: 30.2310, lon: 120.1480, zone: '西湖南', duration: 90, tag: '登高' },
          { name: '河坊街', lat: 30.2440, lon: 120.1710, zone: '老城', duration: 90, tag: '美食' },
          { name: '西溪湿地', lat: 30.2700, lon: 120.0620, zone: '城西', duration: 180, tag: '自然' },
          { name: '龙井村', lat: 30.2200, lon: 120.1040, zone: '西湖西', duration: 120, tag: '茶文化' },
          { name: '京杭大运河', lat: 30.3190, lon: 120.1500, zone: '城北', duration: 90, tag: '夜景' },
          { name: '西溪天堂', lat: 30.2680, lon: 120.0700, zone: '城西', duration: 90, tag: '亲子' }
        ]
      }
    };

    const $ = (id) => document.getElementById(id);
    const R = 6371;
    const fmtKm = (km) => km >= 1 ? km.toFixed(1) + ' km' : Math.round(km * 1000) + ' m';
    const fmtMin = (min) => { const m = Math.max(1, Math.round(min)); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };
    const fmtClock = (minutes) => { const h = Math.floor(minutes / 60) % 24; const m = Math.round(minutes % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); };
    function dist(a, b) {
      const dLat = (b.lat - a.lat) * Math.PI / 180;
      const dLon = (b.lon - a.lon) * Math.PI / 180;
      const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    }
    function travelMin(km) {
      if (km <= 1.2) return Math.max(6, Math.round(km / 4.5 * 60));
      return Math.max(12, Math.round((km > 25 ? km / 65 * 60 + 15 : km / 28 * 60 + 8)));
    }
    function mode(km) { return km <= 1.2 ? '🚶' : '🚗'; }
    function routeMetrics(stops, hotel) {
      let prev = hotel, km = 0, min = 0;
      stops.forEach((s) => { const d = dist(prev, s); km += d; min += travelMin(d); prev = s; });
      if (stops.length) { const back = dist(prev, hotel); km += back; min += travelMin(back); }
      return { km, min };
    }
    function twoOpt(stops, hotel) {
      let best = stops.slice();
      let improved = true;
      const cost = (arr) => routeMetrics(arr, hotel).km;
      while (improved) {
        improved = false;
        for (let i = 0; i < best.length - 1; i++) {
          for (let j = i + 1; j < best.length; j++) {
            const cand = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
            if (cost(cand) + 0.01 < cost(best)) { best = cand; improved = true; }
          }
        }
      }
      return best;
    }
    function decorate(stops, hotel) {
      let prev = hotel;
      return stops.map((s, i) => {
        const d = dist(prev, s);
        prev = s;
        return Object.assign({}, s, { legKm: d, legMin: travelMin(d), index: i });
      });
    }
    function dayZone(stops) {
      const counts = {};
      stops.forEach((s) => { counts[s.zone] = (counts[s.zone] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]).join(' + ');
    }
    function centroid(stops) {
      return {
        lat: stops.reduce((s, x) => s + x.lat, 0) / stops.length,
        lon: stops.reduce((s, x) => s + x.lon, 0) / stops.length
      };
    }
    function finalizeDay(stops, hotel) {
      if (!stops.length) return { stops: [], metrics: { km: 0, min: 0 }, zone: '自由活动', used: 0 };
      const ordered = twoOpt(stops, hotel);
      const metrics = routeMetrics(ordered, hotel);
      return {
        stops: decorate(ordered, hotel),
        metrics,
        zone: dayZone(ordered),
        used: ordered.reduce((s, x) => s + x.duration, 0) + metrics.min
      };
    }
    function buildDays(city, dayCount, pace) {
      const cfg = PACE[pace];
      const dayBudget = cfg.budget;
      const maxStops = cfg.maxStops;
      const zoneGapLimit = 12; // 同一天不合并相距过远的片区
      const zones = [];
      city.spots.forEach((s, i) => {
        let z = zones.find((x) => x.name === s.zone);
        if (!z) { z = { name: s.zone, spots: [] }; zones.push(z); }
        z.spots.push(Object.assign({}, s, { originalIndex: i }));
      });
      zones.forEach((z) => { z.center = centroid(z.spots); z.distance = dist(city.hotel, z.center); });
      zones.sort((a, b) => a.distance - b.distance);
      const days = [];
      const leftover = [];
      let current = null;
      for (const zone of zones) {
        const ordered = twoOpt(zone.spots, city.hotel);
        for (const spot of ordered) {
          const candidate = current ? current.stops.concat(spot) : [spot];
          const travel = routeMetrics(candidate, city.hotel).min;
          const duration = candidate.reduce((sum, x) => sum + x.duration, 0);
          const last = current && current.stops.length ? current.stops[current.stops.length - 1] : city.hotel;
          const gap = current && current.stops.length ? dist(last, spot) : 0;
          const tooFar = current && current.stops.length > 0 && gap > zoneGapLimit;
          const overBudget = travel + duration > dayBudget;
          const overStops = candidate.length > maxStops;
          if (current && (tooFar || overBudget || overStops)) {
            days.push(finalizeDay(current.stops, city.hotel));
            current = null;
          }
          if (!current) {
            if (days.length >= dayCount) { leftover.push(spot); continue; }
            current = { stops: [spot] };
          } else {
            current.stops.push(spot);
          }
        }
      }
      if (current) days.push(finalizeDay(current.stops, city.hotel));
      while (days.length < dayCount) days.push({ stops: [], metrics: { km: 0, min: 0 }, zone: '自由活动', used: 0 });
      return { days, leftover };
    }
    function maxSpotGap(dayStops) {
      let max = 0;
      dayStops.forEach((stops) => {
        for (let i = 1; i < stops.length; i++) max = Math.max(max, dist(stops[i - 1], stops[i]));
      });
      return max;
    }
    function originalMetrics(city) {
      return routeMetrics(city.spots, city.hotel);
    }
    function crossZones(stops) {
      let n = 0;
      for (let i = 1; i < stops.length; i++) if (stops[i].zone !== stops[i - 1].zone) n++;
      return n;
    }

    let cityKey = 'beijing';
    let originalOrder = [];
    let dayCache = [];
    function currentCity() {
      const city = CITIES[cityKey];
      if (originalOrder.length !== city.spots.length) originalOrder = city.spots.map((_, i) => i);
      return { city, spots: originalOrder.map((i) => city.spots[i]) };
    }
    function render() {
      const { city, spots } = currentCity();
      const dayCount = Number($('days').value);
      const pace = $('pace').value;
      const built = buildDays({ ...city, spots }, dayCount, pace);
      dayCache = built.days;
      const leftover = built.leftover;
      const optimizedMin = dayCache.reduce((s, d) => s + d.metrics.min, 0);
      const originalZones = crossZones(spots);
      const optimizedZones = dayCache.reduce((s, d) => s + crossZones(d.stops), 0);
      const originalGap = maxSpotGap([spots]);
      const optimizedGap = maxSpotGap(dayCache.map((d) => d.stops));
      const leftoverHtml = leftover.length ? `<article class="day-card leftover-card" style="--day-color:#94a3b8">
        <div class="day-top">
          <div><div class="day-kicker"><span class="day-dot"></span>未安排 · 行程偏紧</div><h2 class="day-title">${leftover.length} 个景点放不下</h2></div>
          <div class="day-stats">建议增加一天<br />或减少景点</div>
        </div>
        <div class="timeline">
          ${leftover.map((s) => `<div class="stop"><div class="stop-dot">·</div><div class="stop-body"><div class="stop-top"><span class="stop-name">${s.name}</span></div><div class="stop-meta"><span class="pill">${s.zone}</span><span class="pill">${s.tag}</span><span>建议 ${fmtMin(s.duration)}</span></div></div></div>`).join('')}
          <p class="leftover-note">当前 ${dayCount} 天装不下全部景点，建议增加到 ${dayCount + 1} 天，或把远郊景点单独安排。</p>
        </div>
      </article>` : '';

      $('dayList').innerHTML = dayCache.map((day, di) => {
        const color = COLORS[di % COLORS.length];
        let clock = PACE[pace].start * 60;
        const startLeg = day.stops.length ? day.stops[0].legMin : 0;
        const endLeg = day.stops.length ? travelMin(dist(day.stops[day.stops.length - 1], city.hotel)) : 0;
        clock += startLeg;
        const stopHtml = day.stops.map((s, si) => {
          const time = fmtClock(clock);
          clock += s.duration;
          if (si < day.stops.length - 1) clock += day.stops[si + 1].legMin;
          return `
            <div class="stop">
              <div class="stop-dot">${si + 1}</div>
              <div class="stop-body">
                <div class="stop-top"><span class="stop-name">${s.name}</span><span class="stop-time">${time}</span></div>
                <div class="stop-meta"><span class="pill">${s.zone}</span><span class="pill">${s.tag}</span><span>建议 ${fmtMin(s.duration)}</span></div>
              </div>
            </div>
            ${si < day.stops.length - 1 ? `<div class="leg">${mode(day.stops[si + 1].legKm)} <b>${fmtKm(day.stops[si + 1].legKm)}</b> · ${fmtMin(day.stops[si + 1].legMin)}</div>` : ''}`;
        }).join('');
        return `<article class="day-card" style="--day-color:${color}">
          <div class="day-top">
            <div><div class="day-kicker"><span class="day-dot"></span>Day ${di + 1} · ${day.zone || '自由活动'}</div><h2 class="day-title">${day.zone ? day.zone + '片区' : '城市慢游'}</h2></div>
            <div class="day-stats">${day.stops.length} 个地点<br />${fmtKm(day.metrics.km)} · ${fmtMin(day.metrics.min)} 路上</div>
          </div>
          <div class="timeline">
            <div class="start-line"><span class="pin">🏨</span>从 ${city.hotel.name} 出发 · ${fmtMin(startLeg)}</div>
            ${stopHtml}
            <div class="end-line"><span class="pin">🏨</span>返回 ${city.hotel.name} · ${fmtMin(endLeg)}</div>
          </div>
        </article>`;
      }).join('') + leftoverHtml;

      renderMap(city, spots, leftover);
      $('legend').innerHTML = dayCache.map((d, i) => `<span class="legend-item"><span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>Day ${i + 1} · ${d.zone || '自由活动'}</span>`).join('') + ($('compare').checked ? '<span class="legend-item"><span class="legend-dot" style="background:#94a3b8"></span>原始顺序</span>' : '');
      $('metrics').innerHTML = `
        <div class="metric"><span>跨区切换</span><b class="good">${originalZones} → ${optimizedZones}</b><small>越少越顺路</small></div>
        <div class="metric"><span>同日景点最大跨度</span><b class="good">${fmtKm(originalGap)} → ${fmtKm(optimizedGap)}</b><small>避免同一天横穿城市</small></div>
        <div class="metric"><span>未安排景点</span><b class="${leftover.length ? '' : 'good'}">${leftover.length}</b><small>${leftover.length ? '建议增加一天' : '全部安排完成'}</small></div>
        <div class="metric"><span>路上时间</span><b>${fmtMin(optimizedMin)}</b><small>${PACE[pace].label}节奏</small></div>`;
      $('mapSub').textContent = $('compare').checked ? '按天着色，灰色虚线为未优化的原始顺序。' : '按天着色，每天从酒店出发并返回。';
      $('mapStatus').textContent = leftover.length ? `建议 ${dayCount + 1} 天` : (optimizedZones <= originalZones ? '已按地理位置排序' : '建议调整节奏');
    }
    function renderMap(city, spots, leftover = []) {
      const svg = $('map');
      const W = 640, H = 470, pad = 54;
      const all = [city.hotel].concat(spots);
      const lats = all.map((s) => s.lat), lons = all.map((s) => s.lon);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
      const spanLat = Math.max(maxLat - minLat, .02), spanLon = Math.max(maxLon - minLon, .02);
      const project = (p) => ({
        x: pad + (p.lon - minLon) / spanLon * (W - pad * 2),
        y: H - pad - (p.lat - minLat) / spanLat * (H - pad * 2)
      });
      const grid = [];
      for (let x = 40; x < W; x += 48) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#eef2f2" stroke-width="1"/>`);
      for (let y = 36; y < H; y += 48) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#eef2f2" stroke-width="1"/>`);
      const hotel = project(city.hotel);
      const originalPoints = [hotel].concat(spots.map(project), [hotel]).map((p) => p.x + ',' + p.y).join(' ');
      const originalLine = $('compare').checked ? `<polyline points="${originalPoints}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 7" opacity=".55"/>` : '';
      const dayLines = dayCache.map((day, di) => {
        const pts = [hotel].concat(day.stops.map(project)).map((p) => p.x + ',' + p.y).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="${COLORS[di % COLORS.length]}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
      }).join('');
      const dayMarkers = dayCache.map((day, di) => day.stops.map((s, si) => {
        const p = project(s);
        const color = COLORS[di % COLORS.length];
        const dx = si % 2 === 0 ? 18 : -18;
        const anchor = si % 2 === 0 ? 'start' : 'end';
        const dy = si % 3 === 0 ? -10 : (si % 3 === 1 ? 4 : 16);
        return `<g><circle cx="${p.x}" cy="${p.y}" r="14" fill="${color}" stroke="#fff" stroke-width="3"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${si + 1}</text><text x="${p.x + dx}" y="${p.y + dy}" text-anchor="${anchor}" font-size="10" font-weight="700" fill="#334155" paint-order="stroke" stroke="#fbfaf7" stroke-width="3">${s.name}</text></g>`;
      }).join('')).join('');
      const leftoverMarkers = leftover.map((s) => {
        const p = project(s);
        return `<g><circle cx="${p.x}" cy="${p.y}" r="12" fill="#fff" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3 3"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="9" font-weight="800" fill="#64748b">备选</text><text x="${p.x + 16}" y="${p.y + 4}" font-size="10" font-weight="700" fill="#94a3b8">${s.name}</text></g>`;
      }).join('');
      svg.innerHTML = `${grid.join('')}
        ${originalLine}${dayLines}
        <g><circle cx="${hotel.x}" cy="${hotel.y}" r="17" fill="#fff" stroke="#0f766e" stroke-width="3"/><text x="${hotel.x}" y="${hotel.y + 5}" text-anchor="middle" font-size="16">🏨</text><text x="${hotel.x + 22}" y="${hotel.y + 5}" font-size="11" font-weight="800" fill="#0f766e">${city.hotel.name}</text></g>
        ${dayMarkers}${leftoverMarkers}`;
    }
    $('city').addEventListener('change', () => { cityKey = $('city').value; originalOrder = []; render(); });
    $('days').addEventListener('change', render);
    $('pace').addEventListener('change', render);
    $('compare').addEventListener('change', render);
    $('rerun').addEventListener('click', render);
    $('shuffle').addEventListener('click', () => { originalOrder = CITIES[cityKey].spots.map((_, i) => i).sort(() => Math.random() - .5); render(); });
    const params = new URLSearchParams(location.search);
    if (params.get('city') && CITIES[params.get('city')]) { cityKey = params.get('city'); $('city').value = cityKey; }
    if (params.get('days')) $('days').value = params.get('days');
    if (params.get('pace') && PACE[params.get('pace')]) $('pace').value = params.get('pace');
    render();
  })();
