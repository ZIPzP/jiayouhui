(() => {
  'use strict';

  // AMap 在本地域名白名单不匹配时会抛内部错误；地图已有直线降级，这里只抑制其内部报错。
  window.addEventListener('error', (event) => {
    if (/Unimplemented type|FlyDataAuthTask/.test(String((event && event.message) || ''))) {
      event.preventDefault();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (/Unimplemented type|FlyDataAuthTask/.test(String((event && event.reason) || ''))) {
      event.preventDefault();
    }
  });

  const COLORS = ['#0f766e', '#f97316', '#2563eb', '#9333ea'];
  const DEFAULT_HOTEL = { name: '王府井酒店', lat: 39.915, lon: 116.407 };
  const HOTEL = { ...DEFAULT_HOTEL };
  const CITY = '北京';
  const SAMPLE_HOTELS = [
    { name: '王府井酒店', address: '北京市东城区王府井大街', lat: 39.915, lon: 116.407, rating: '4.6' },
    { name: '北京饭店', address: '北京市东城区东长安街33号', lat: 39.908, lon: 116.407, rating: '4.7' },
    { name: '国贸大酒店', address: '北京市朝阳区建国门外大街1号', lat: 39.908, lon: 116.460, rating: '4.8' },
    { name: '三里屯通盈中心洲际酒店', address: '北京市朝阳区南三里屯路1号', lat: 39.933, lon: 116.455, rating: '4.6' }
  ];
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SPOTS = {
    gugong: { id: 'gugong', name: '故宫博物院', lat: 39.9163, lon: 116.3972, zone: '中心轴', duration: 180, tag: '历史', heat: 98 },
    beihai: { id: 'beihai', name: '北海公园', lat: 39.9256, lon: 116.3893, zone: '中心轴', duration: 90, tag: '亲子', heat: 87 },
    shichahai: { id: 'shichahai', name: '什刹海', lat: 39.9400, lon: 116.3860, zone: '中心轴', duration: 90, tag: '慢逛', heat: 86 },
    jingshan: { id: 'jingshan', name: '景山公园', lat: 39.9250, lon: 116.3967, zone: '中心轴', duration: 60, tag: '登高', heat: 88 },
    tiantan: { id: 'tiantan', name: '天坛公园', lat: 39.8822, lon: 116.4066, zone: '南城', duration: 120, tag: '文化', heat: 93 },
    qianmen: { id: 'qianmen', name: '前门大街', lat: 39.8990, lon: 116.3970, zone: '南城', duration: 90, tag: '美食', heat: 90 },
    yiheyuan: { id: 'yiheyuan', name: '颐和园', lat: 39.9999, lon: 116.2755, zone: '西北', duration: 180, tag: '皇家园林', heat: 94 },
    yuanmingyuan: { id: 'yuanmingyuan', name: '圆明园', lat: 40.0080, lon: 116.2980, zone: '西北', duration: 120, tag: '历史', heat: 85 },
    badaling: { id: 'badaling', name: '八达岭长城', lat: 40.3590, lon: 116.0160, zone: '北郊', duration: 240, tag: '必去', heat: 97 },
    nanluoguxiang: { id: 'nanluoguxiang', name: '南锣鼓巷', lat: 39.9370, lon: 116.4030, zone: '中心轴', duration: 90, tag: '胡同', heat: 89 },
    tiananmen: { id: 'tiananmen', name: '天安门广场', lat: 39.9055, lon: 116.3976, zone: '中心轴', duration: 60, tag: '城市地标', heat: 96 },
    guobo: { id: 'guobo', name: '中国国家博物馆', lat: 39.9042, lon: 116.4013, zone: '中心轴', duration: 150, tag: '博物馆', heat: 92 },
    yonghegong: { id: 'yonghegong', name: '雍和宫', lat: 39.9475, lon: 116.4174, zone: '北城', duration: 90, tag: '人文', heat: 88 },
    gongwangfu: { id: 'gongwangfu', name: '恭王府', lat: 39.9365, lon: 116.3830, zone: '中心轴', duration: 90, tag: '历史', heat: 85 },
    birdnest: { id: 'birdnest', name: '国家体育场·鸟巢', lat: 39.9928, lon: 116.3965, zone: '北城', duration: 90, tag: '地标', heat: 90 },
    shuilifang: { id: 'shuilifang', name: '水立方', lat: 39.9927, lon: 116.3902, zone: '北城', duration: 90, tag: '亲子', heat: 86 },
    zoo: { id: 'zoo', name: '北京动物园', lat: 39.9385, lon: 116.3388, zone: '西城', duration: 150, tag: '亲子', heat: 89 },
    huanqiu: { id: 'huanqiu', name: '北京环球影城', lat: 39.8550, lon: 116.6730, zone: '东南', duration: 480, tag: '亲子', heat: 95 },
    art798: { id: 'art798', name: '798艺术区', lat: 39.9840, lon: 116.4950, zone: '东城', duration: 120, tag: '艺术', heat: 82 },
    xiangshan: { id: 'xiangshan', name: '香山公园', lat: 39.9900, lon: 116.1870, zone: '西北', duration: 180, tag: '自然', heat: 80 },
    wangfujing: { id: 'wangfujing', name: '王府井步行街', lat: 39.9140, lon: 116.4100, zone: '中心轴', duration: 90, tag: '美食', heat: 83 },
    sanlitun: { id: 'sanlitun', name: '三里屯', lat: 39.9340, lon: 116.4550, zone: '东城', duration: 90, tag: '夜生活', heat: 78 },
    liulichang: { id: 'liulichang', name: '琉璃厂文化街', lat: 39.8950, lon: 116.3900, zone: '南城', duration: 60, tag: '文化', heat: 70 }
  };
  const ALIASES = {
    gugong: ['故宫', '紫禁城', 'Forbidden City', 'The Forbidden City', 'Palace Museum'],
    beihai: ['北海公园', 'Beihai Park'],
    shichahai: ['什刹海', 'Shichahai'],
    jingshan: ['景山', 'Jingshan'],
    tiantan: ['天坛', 'Temple of Heaven'],
    qianmen: ['前门', 'Qianmen', 'Dashilan'],
    yiheyuan: ['颐和园', 'Summer Palace'],
    yuanmingyuan: ['圆明园', 'Old Summer Palace', 'Yuanmingyuan'],
    badaling: ['八达岭', 'Badaling', 'Great Wall'],
    nanluoguxiang: ['南锣鼓巷', 'Nanluoguxiang'],
    tiananmen: ['天安门', 'Tiananmen'],
    guobo: ['国家博物馆', 'National Museum'],
    yonghegong: ['雍和宫', 'Yonghe'],
    gongwangfu: ['恭王府', 'Prince Gong'],
    birdnest: ['鸟巢', 'Bird Nest', 'National Stadium'],
    shuilifang: ['水立方', 'Water Cube'],
    zoo: ['动物园', 'Beijing Zoo'],
    huanqiu: ['环球影城', 'Universal Studios'],
    art798: ['798', '798 Art'],
    xiangshan: ['香山', 'Fragrant Hills'],
    wangfujing: ['王府井', 'Wangfujing'],
    sanlitun: ['三里屯', 'Sanlitun'],
    liulichang: ['琉璃厂', 'Liulichang']
  };
  const INITIAL = {
    days: [
      { spots: ['gugong', 'beihai', 'shichahai'] },
      { spots: ['jingshan', 'tiantan', 'qianmen'] },
      { spots: ['yiheyuan', 'yuanmingyuan'] },
      { spots: ['badaling'] }
    ],
    pool: ['nanluoguxiang', 'tiananmen', 'guobo', 'yonghegong', 'gongwangfu', 'birdnest', 'shuilifang', 'zoo', 'huanqiu', 'art798', 'xiangshan', 'wangfujing', 'sanlitun', 'liulichang']
  };
  const SAMPLE_TRAINS = {
    outbound: [
      { no: 'G1', fromTime: '06:30', toTime: '11:24', duration: '4h54m', prices: { '二等座': '795.0', '一等座': '1272.0' }, second: '有', first: '有' },
      { no: 'G3', fromTime: '07:00', toTime: '11:37', duration: '4h37m', prices: { '二等座': '800.0', '一等座': '1281.0' }, second: '有', first: '有' },
      { no: 'G5', fromTime: '07:20', toTime: '12:02', duration: '4h42m', prices: { '二等座': '795.0', '一等座': '1272.0' }, second: '有', first: '有' }
    ],
    inbound: [
      { no: 'G2', fromTime: '06:43', toTime: '11:32', duration: '4h49m', prices: { '二等座': '795.0', '一等座': '1272.0' }, second: '有', first: '有' },
      { no: 'G4', fromTime: '07:00', toTime: '11:37', duration: '4h37m', prices: { '二等座': '800.0', '一等座': '1281.0' }, second: '有', first: '有' }
    ]
  };
  const SAMPLE_BUDGET = {
    transport: '往返交通（人均约 ¥1100）',
    accommodation: '住宿 3 晚（人均约 ¥1050）',
    meals: '餐饮（人均约 ¥880）',
    tickets: '门票（人均约 ¥720）',
    totalPerPerson: '约 ¥3750（5 人同行）',
    note: '示例预算，实际以官方票价为准。'
  };
  const SAMPLE_TIPS = [
    '故宫、天坛等热门景点建议提前预约；',
    '八达岭长城建议早上出发，预留约 1.5 小时车程；',
    '带老人孩子每天安排午休，避免连续赶路；',
    '北京烤鸭、炸酱面适合家庭用餐，豆汁儿可尝鲜。'
  ];
  const STORE_KEY = 'jyh_map_lab_state';
  const $ = (id) => document.getElementById(id);
  let state = loadState();
  let map = null;
  let markers = [];
  let polylines = [];
  let infoWindow = null;
  let firstFit = true;
  let mapRenderToken = 0;
  const routeCache = new Map();
  let currentInfoTab = 'transport';
  let weatherCache = null;
  let weatherRenderToken = 0;
  let selectedSpotId = null;
  let pendingJumpId = null;
  let sortables = [];

  function cloneInitial() {
    return {
      days: INITIAL.days.map((d) => ({ spots: d.spots.slice() })),
      pool: INITIAL.pool.slice()
    };
  }
  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && Array.isArray(raw.days) && raw.days.every((d) => d && Array.isArray(d.spots))) {
        if (raw.hotel && Number.isFinite(Number(raw.hotel.lat)) && Number.isFinite(Number(raw.hotel.lon))) {
          HOTEL.name = String(raw.hotel.name || HOTEL.name);
          HOTEL.lat = Number(raw.hotel.lat);
          HOTEL.lon = Number(raw.hotel.lon);
        }
        return { days: raw.days.map((d) => ({ spots: d.spots.filter((id) => SPOTS[id]) })), pool: (raw.pool || []).filter((id) => SPOTS[id]) };
      }
    } catch (e) { /* ignore */ }
    return cloneInitial();
  }
  function saveState() {
    state.pool = availableSpotIds();
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...state, hotel: { name: HOTEL.name, lat: HOTEL.lat, lon: HOTEL.lon } })); } catch (e) { /* ignore */ }
  }
  function spot(id) { return SPOTS[id]; }
  function availableSpotIds() {
    const used = new Set(state.days.flatMap((d) => d.spots));
    return Object.keys(SPOTS).filter((id) => !used.has(id));
  }
  function dist(a, b) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function dayZone(day) {
    return [...new Set(day.spots.map((id) => spot(id).zone))].join(' + ') || '自由活动';
  }

  function renderEditor() {
    $('dayList').innerHTML = state.days.map((day, di) => {
      const color = COLORS[di % COLORS.length];
      const stops = day.spots.map((id, si) => {
        const s = spot(id);
        return `<div class="stop-row${selectedSpotId === id ? ' active' : ''}" data-spot-id="${id}">
          <span class="stop-index" style="--c:${color}">${si + 1}</span>
          <div class="stop-main"><b>${s.name}</b><small>${s.zone} · 建议 ${s.duration} 分钟</small></div>
          <div class="stop-actions">
            <span class="drag-handle" title="拖动排序" aria-hidden="true">⠿</span>
            <button type="button" data-act="up" data-day="${di}" data-i="${si}" title="上移">↑</button>
            <button type="button" data-act="down" data-day="${di}" data-i="${si}" title="下移">↓</button>
            <select data-act="move" data-day="${di}" data-i="${si}" aria-label="移到哪一天">${state.days.map((_, j) => `<option value="${j}" ${j === di ? 'selected' : ''}>D${j + 1}</option>`).join('')}</select>
            <button type="button" class="danger" data-act="delete" data-day="${di}" data-i="${si}" title="移除">×</button>
          </div>
        </div>`;
      }).join('');
      return `<section class="day-card" style="--c:${color}">
        <div class="day-head"><span class="day-dot"></span><span class="day-title">Day ${di + 1}</span><span class="day-zone">${dayZone(day)} · ${day.spots.length} 站</span></div>
        <div class="day-body" data-day-index="${di}">${stops || '<p class="pool-empty">暂无安排，从下方备选景点添加</p>'}</div>
      </section>`;
    }).join('');
    const addDay = $('addDay');
    const prevAddDay = addDay ? Number(addDay.value) : 0;
    const dayOptions = state.days.map((_, i) => `<option value="${i}">Day ${i + 1}</option>`).join('');
    if (addDay) {
      addDay.innerHTML = dayOptions;
      addDay.value = String(Math.min(prevAddDay || 0, state.days.length - 1));
    }
    const pool = availableSpotIds().map((id) => spot(id)).filter(Boolean).sort((a, b) => (b.heat || 0) - (a.heat || 0));
    $('poolList').innerHTML = pool.length
      ? pool.map((s) => `<div class="pool-row"><input type="checkbox" data-hot-select="${s.id}" aria-label="选择${s.name}" /><span>${s.name}${s.heat >= 90 ? ' <em class="hot-badge">🔥 热门</em>' : ''}<small>${s.zone} · ${s.tag} · 热度 ${s.heat || '—'}</small></span><button type="button" data-act="add" data-id="${s.id}">加入</button></div>`).join('')
      : '<p class="pool-empty">暂无备选景点。可能都已经加入行程，点右上角「重置示例」恢复。</p>';
    updatePoolSelection();
    initSortables();
  }

  function initSortables() {
    sortables.forEach((s) => { try { s.destroy(); } catch (e) { /* ignore */ } });
    sortables = [];
    if (!window.Sortable) return;
    document.querySelectorAll('#dayList .day-body').forEach((el) => {
      sortables.push(new Sortable(el, {
        group: 'plan-stops',
        handle: '.drag-handle',
        draggable: '.stop-row',
        animation: 150,
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        onEnd: (evt) => moveSpotByDrag(evt)
      }));
    });
  }

  function moveSpotByDrag(evt) {
    const id = evt.item && evt.item.dataset.spotId;
    const from = Number(evt.from && evt.from.dataset.dayIndex);
    const to = Number(evt.to && evt.to.dataset.dayIndex);
    if (!id || !Number.isInteger(from) || !Number.isInteger(to)) return;
    const fromSpots = state.days[from].spots;
    const oldIndex = fromSpots.indexOf(id);
    if (oldIndex < 0) return;
    fromSpots.splice(oldIndex, 1);
    const target = state.days[to].spots;
    const insertAt = Math.max(0, Math.min(Number(evt.newIndex), target.length));
    target.splice(insertAt, 0, id);
    selectedSpotId = id;
    saveState();
    renderEditor();
    renderMap(false);
  }

  function updatePoolSelection() {
    const boxes = [...document.querySelectorAll('#poolList [data-hot-select]')];
    const count = boxes.filter((b) => b.checked).length;
    const btn = $('addSelected');
    const label = $('poolSelectedCount');
    if (btn) btn.disabled = count === 0;
    if (label) label.textContent = `已选 ${count} 个`;
  }

  function jumpToSpot(id) {
    const s = spot(id);
    if (!s) return;
    selectedSpotId = id;
    document.querySelectorAll('#dayList .stop-row').forEach((row) => {
      row.classList.toggle('active', row.dataset.spotId === id);
    });
    if (!map || !window.AMap) {
      pendingJumpId = id;
      return;
    }
    pendingJumpId = null;
    map.setZoomAndCenter(16, [s.lon, s.lat]);
    if (infoWindow) {
      infoWindow.setContent(`<b>${esc(s.name)}</b><br>${esc(s.zone)} · 建议 ${s.duration} 分钟`);
      infoWindow.open(map, [s.lon, s.lat]);
    }
  }

  function optimizeDay(day) {
    if (day.spots.length < 2) return day.spots.slice();
    let current = HOTEL;
    const remaining = day.spots.slice();
    const ordered = [];
    while (remaining.length) {
      remaining.sort((a, b) => dist(current, spot(a)) - dist(current, spot(b)));
      const next = remaining.shift();
      ordered.push(next);
      current = spot(next);
    }
    const cost = (arr) => {
      let prev = HOTEL, total = 0;
      arr.forEach((id) => { total += dist(prev, spot(id)); prev = spot(id); });
      return total;
    };
    let best = ordered;
    let improved = true;
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
  function optimizeAll() {
    state.days = state.days.map((day) => ({ spots: optimizeDay(day) }));
    saveState();
    renderEditor();
    renderMap(true);
  }

  function loadAiPlan(silent = false) {
    const status = $('dataStatus');
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('jyh_last_plan') || 'null'); } catch (e) { /* ignore */ }
    if (!raw || !raw.result || !Array.isArray(raw.result.days)) {
      if (!silent && status) status.textContent = '没有找到最近一次 AI 行程，当前显示示例';
      return false;
    }
    const dest = String((raw.vals && raw.vals.destinationName) || '') + ' ' + String((raw.result && raw.result.title) || '');
    if (!/北京|Beijing/i.test(dest)) {
      if (!silent && status) status.textContent = '最近一次 AI 行程不是北京，当前显示北京示例';
      return false;
    }
    const days = raw.result.days.map((day) => {
      const ids = [];
      (day.schedule || []).forEach((item) => {
        const text = String(item.activity || '');
        const hit = Object.keys(SPOTS).find((id) => (ALIASES[id] || [SPOTS[id].name]).some((alias) => text.includes(alias)));
        if (hit && !ids.includes(hit)) ids.push(hit);
      });
      return { spots: ids };
    });
    const matched = days.reduce((sum, d) => sum + d.spots.length, 0);
    if (!matched) {
      if (!silent && status) status.textContent = 'AI 行程里没有匹配到可定位的北京景点，当前显示示例';
      return false;
    }
    const used = new Set(days.flatMap((d) => d.spots));
    state = { days, pool: Object.keys(SPOTS).filter((id) => !used.has(id)) };
    saveState();
    renderEditor();
    renderMap(false);
    renderInfoPanel(currentInfoTab);
    if (status) status.textContent = `已载入最近 AI 行程 · ${matched} 个地点`;
    return true;
  }

  function lastPlan() {
    try { return JSON.parse(localStorage.getItem('jyh_last_plan') || 'null'); } catch (e) { return null; }
  }
  function budgetLabel(key) {
    return { transport: '交通', accommodation: '住宿', meals: '餐饮', tickets: '门票', totalPerPerson: '人均总计' }[key] || key;
  }
  function trainHtml(list) {
    return (list || []).slice(0, 4).map((t) => {
      const prices = t.prices || {};
      const price = Object.keys(prices).slice(0, 2).map((k) => `${k} ¥${prices[k]}`).join(' · ') || '票价以 12306 为准';
      return `<div class="train-row"><b>${t.no || '车次'}</b><div class="train-meta"><span>${t.fromTime || ''}–${t.toTime || ''}</span><span>${t.duration || ''}</span></div><div class="train-meta"><span>二等座：${t.second || '—'}</span><span>一等座：${t.first || '—'}</span></div><div class="train-price">${price}</div></div>`;
    }).join('') || '<p class="info-note">暂无车次数据。</p>';
  }
  async function renderWeather(plan) {
    const body = $('infoBody');
    const token = ++weatherRenderToken;
    try {
      if (!weatherCache) weatherCache = await fetch('/api/weather?id=beijing').then((r) => r.json());
      if (token !== weatherRenderToken || currentInfoTab !== 'weather') return;
      const start = plan && plan.vals && plan.vals.startDate;
      const end = plan && plan.vals && plan.vals.endDate;
      let days = weatherCache.days || [];
      if (start && end) days = days.filter((d) => d.date >= start && d.date <= end);
      days = days.slice(0, 6);
      body.innerHTML = `<h3 class="info-section-title">🌤️ ${start && end ? '所选日期天气' : '未来天气'}</h3><p class="info-note">${days.length ? '来自最新 15 天预报。' : '所选日期暂无预报。'}</p>${days.map((d) => `<div class="weather-row"><span>${d.date.slice(5)} ${d.weekday}</span><span>${d.icon} ${d.label}</span><b>${d.tmin}°~${d.tmax}°</b></div>`).join('')}`;
    } catch (e) {
      if (token !== weatherRenderToken || currentInfoTab !== 'weather') return;
      body.innerHTML = '<h3 class="info-section-title">🌤️ 天气</h3><p class="info-note">天气暂时获取失败。</p>';
    }
  }
  function renderHotelTab() {
    const body = $('infoBody');
    if (!body) return;
    body.innerHTML = `<h3 class="info-section-title">🏨 酒店</h3>
      <p class="info-note">只搜索当前城市（${CITY}）的酒店；选中后会成为行程起终点。</p>
      <div class="hotel-current">当前酒店：<b>${esc(HOTEL.name)}</b><br><small>${Number(HOTEL.lat).toFixed(4)}, ${Number(HOTEL.lon).toFixed(4)}</small></div>
      <div class="hotel-search"><input id="hotelSearch" type="search" placeholder="输入酒店名，如 王府井 / 国贸 / 三里屯" autocomplete="off" /><button id="hotelSearchBtn" type="button">搜索</button></div>
      <div id="hotelResults"><p class="info-note">输入关键词搜索当前城市酒店；也可以直接搜“酒店”。</p></div>`;
    const input = $('hotelSearch');
    const btn = $('hotelSearchBtn');
    const run = () => searchHotels(input ? input.value.trim() : '');
    if (btn) btn.onclick = run;
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') run(); };
  }
  function renderHotelResults(hotels, note) {
    const box = $('hotelResults');
    if (!box) return;
    const intro = note ? `<p class="info-note">${esc(note)}</p>` : '';
    if (!hotels.length) {
      box.innerHTML = intro + '<p class="info-note">没有找到当前城市的酒店，试试“国贸”“王府井”等关键词。</p>';
      return;
    }
    box.innerHTML = intro + hotels.map((h) => `<div class="hotel-row"><b>${esc(h.name)}</b><small>${esc(h.address || '')}${h.rating ? ' · 评分 ' + esc(h.rating) : ''}</small><button type="button" data-hotel-lat="${h.lat}" data-hotel-lon="${h.lon}" data-hotel-name="${encodeURIComponent(h.name)}">设为酒店</button></div>`).join('');
  }
  function searchHotels(keyword) {
    const box = $('hotelResults');
    if (!box) return;
    if (!window.AMap) {
      renderHotelResults(SAMPLE_HOTELS, '高德地图尚未加载，先显示示例酒店；正式环境会实时搜索。');
      return;
    }
    box.innerHTML = '<p class="info-note">正在搜索当前城市酒店…</p>';
    let done = false;
    const finish = (hotels, note) => {
      if (done) return;
      done = true;
      renderHotelResults(hotels, note);
    };
    const timer = setTimeout(() => finish(SAMPLE_HOTELS, '高德搜索超时，先显示示例酒店。'), 5000);
    try {
      AMap.plugin(['AMap.PlaceSearch'], () => {
        if (done) return;
        try {
          const search = new AMap.PlaceSearch({ city: CITY, citylimit: true, type: '100000', pageSize: 10, extensions: 'all' });
          search.search(keyword || '酒店', (status, result) => {
            clearTimeout(timer);
            if (status !== 'complete') {
              finish(SAMPLE_HOTELS, '高德搜索暂不可用，先显示示例酒店。');
              return;
            }
            const pois = (result.poiList && result.poiList.pois) || [];
            const hotels = pois.map((p) => {
              const loc = p.location || {};
              const lng = Number(typeof loc.getLng === 'function' ? loc.getLng() : loc.lng);
              const lat = Number(typeof loc.getLat === 'function' ? loc.getLat() : loc.lat);
              return {
                name: p.name || '酒店',
                address: p.address || p.cityname || '',
                lat,
                lon: lng,
                rating: p.biz_ext && p.biz_ext.rating ? String(p.biz_ext.rating) : ''
              };
            }).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
            finish(hotels.length ? hotels : SAMPLE_HOTELS, hotels.length ? '' : '没有搜到当前城市酒店，先显示示例酒店。');
          });
        } catch (e) {
          clearTimeout(timer);
          finish(SAMPLE_HOTELS, '高德搜索失败，先显示示例酒店。');
        }
      });
    } catch (e) {
      clearTimeout(timer);
      finish(SAMPLE_HOTELS, '高德搜索失败，先显示示例酒店。');
    }
  }
  function selectHotel(lat, lon, name) {
    HOTEL.name = name || '酒店';
    HOTEL.lat = lat;
    HOTEL.lon = lon;
    saveState();
    renderMap(true);
    renderInfoPanel('hotel');
  }
  function renderInfoPanel(tab = currentInfoTab) {
    currentInfoTab = tab;
    const body = $('infoBody');
    if (!body) return;
    const plan = lastPlan();
    const result = plan && plan.result;
    if (tab === 'transport') {
      const rt = result && result.realTrains;
      body.innerHTML = `<h3 class="info-section-title">🚄 12306 实时车次</h3>
        <p class="info-note">${rt ? '来自最近一次 AI 行程的 12306 数据。' : '示例数据；正式版展示实时 12306 车次。'}</p>
        <h4 class="info-section-title">去程</h4>${trainHtml((rt && rt.outbound) || SAMPLE_TRAINS.outbound)}
        <h4 class="info-section-title" style="margin-top:14px">返程</h4>${trainHtml((rt && rt.inbound) || SAMPLE_TRAINS.inbound)}`;
    } else if (tab === 'hotel') {
      renderHotelTab();
    } else if (tab === 'budget') {
      const budget = (result && result.budget) || SAMPLE_BUDGET;
      body.innerHTML = `<h3 class="info-section-title">💰 预算明细</h3>
        <p class="info-note">${result && result.budget ? '来自最近一次 AI 行程。' : '示例预算；正式版按 AI 结果实时计算。'}</p>
        ${Object.keys(budget).filter((k) => k !== 'note').map((k) => `<div class="info-kv"><span>${budgetLabel(k)}</span><b>${budget[k]}</b></div>`).join('')}
        ${budget.note ? `<p class="info-note" style="margin-top:10px">${budget.note}</p>` : ''}`;
    } else if (tab === 'weather') {
      body.innerHTML = '<h3 class="info-section-title">🌤️ 所选日期天气</h3><p class="info-note">正在获取天气…</p>';
      renderWeather(plan);
    } else {
      const tips = (result && result.tips && result.tips.length) ? result.tips : SAMPLE_TIPS;
      body.innerHTML = `<h3 class="info-section-title">💡 行程建议</h3>
        <p class="info-note">${result ? '来自最近一次 AI 行程。' : '示例建议；正式版会结合 AI 行程与预约信息。'}</p>
        <ul class="info-list">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    }
  }

  function routeKey(from, to, mode) {
    return [from.lon, from.lat, to.lon, to.lat, mode].map((x) => Number(x).toFixed(5)).join('|');
  }
  function routeSegment(AMap, from, to, mode) {
    return new Promise((resolve) => {
      const plugin = mode === 'walking' ? 'AMap.Walking' : 'AMap.Driving';
      AMap.plugin([plugin], () => {
        const Router = mode === 'walking' ? AMap.Walking : AMap.Driving;
        const router = new Router({ hideMarkers: true });
        router.search([from.lon, from.lat], [to.lon, to.lat], (status, result) => {
          if (status !== 'complete' || !result || !result.routes || !result.routes[0]) return resolve(null);
          const route = result.routes[0];
          const path = [];
          (route.steps || []).forEach((step) => (step.path || []).forEach((p) => path.push([p.lng, p.lat])));
          if (!path.length) return resolve(null);
          resolve({ path, distance: Number(route.distance) || 0, time: Number(route.time) || 0 });
        });
      });
    });
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await fn(items[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  async function renderMap(fit = false) {
    if (!map || !window.AMap) return;
    const token = ++mapRenderToken;
    map.remove(markers);
    map.remove(polylines);
    markers = [];
    polylines = [];

    const hotel = new AMap.Marker({
      position: [HOTEL.lon, HOTEL.lat],
      content: '<div class="map-hotel">🏨</div>',
      offset: new AMap.Pixel(-17, -17),
      title: HOTEL.name
    });
    hotel.on('click', () => {
      infoWindow.setContent(`<b>${HOTEL.name}</b><br>行程起终点`);
      infoWindow.open(map, [HOTEL.lon, HOTEL.lat]);
    });
    markers.push(hotel);

    state.days.forEach((day, di) => {
      const color = COLORS[di % COLORS.length];
      day.spots.forEach((id, si) => {
        const s = spot(id);
        const marker = new AMap.Marker({
          position: [s.lon, s.lat],
          content: `<div class="map-pin" style="--c:${color}">${si + 1}</div>`,
          offset: new AMap.Pixel(-13, -13),
          title: s.name,
          label: { content: `<span class="map-label">${s.name}</span>`, direction: ['top', 'right', 'bottom', 'left'][si % 4] }
        });
        marker.on('click', () => {
          infoWindow.setContent(`<b>${s.name}</b><br>${s.zone} · 建议 ${s.duration} 分钟`);
          infoWindow.open(map, [s.lon, s.lat]);
        });
        markers.push(marker);
      });
    });
    map.add(markers);
    if (fit) map.setFitView(markers, false, [70, 70, 70, 70], 15);

    const legs = [];
    state.days.forEach((day, di) => {
      if (!day.spots.length) return;
      const color = COLORS[di % COLORS.length];
      const points = [{ ...HOTEL }, ...day.spots.map((id) => ({ ...spot(id) })), { ...HOTEL }];
      for (let i = 0; i < points.length - 1; i++) {
        const from = points[i], to = points[i + 1];
        const gap = dist(from, to);
        const mode = gap <= 1.2 ? 'walking' : 'driving';
        legs.push({ from, to, mode, color, hotelLeg: i === 0 || i === points.length - 2, key: routeKey(from, to, mode) });
      }
    });
    const status = $('mapStatus');
    if (legs.length) status.textContent = '正在计算真实道路路线…';
    const localTest = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
    const results = localTest
      ? legs.map((leg) => ({ leg, route: null }))
      : await mapLimit(legs, 2, async (leg) => {
        let route = routeCache.get(leg.key);
        if (route === undefined) {
          route = await routeSegment(AMap, leg.from, leg.to, leg.mode);
          routeCache.set(leg.key, route || null);
        }
        return { leg, route };
      });
    if (token !== mapRenderToken) return;
    results.forEach(({ leg, route }) => {
      const path = route && route.path.length ? route.path : [[leg.from.lon, leg.from.lat], [leg.to.lon, leg.to.lat]];
      polylines.push(new AMap.Polyline({
        path,
        strokeColor: leg.color,
        strokeWeight: leg.hotelLeg ? 3 : 4,
        strokeOpacity: leg.hotelLeg ? .45 : .9,
        strokeStyle: leg.hotelLeg ? 'dashed' : 'solid',
        lineJoin: 'round'
      }));
    });
    map.add(polylines);
    const routed = results.filter((r) => r.route).length;
    const count = state.days.reduce((sum, d) => sum + d.spots.length, 0);
    status.textContent = localTest
      ? `本地测试 · ${count} 个地点 · 直线示意（正式域名显示真实道路）`
      : `已加载 · ${count} 个地点 · ${routed}/${legs.length} 段真实道路`;
    $('legend').innerHTML = state.days.map((d, i) => `<span class="legend-item"><span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>Day ${i + 1} · ${dayZone(d)}</span>`).join('');
  }

  async function loadAmap() {
    const status = $('mapStatus');
    try {
      const cfg = await fetch('/api/map/config', { headers: { Accept: 'application/json' } }).then((r) => r.json());
      if (!cfg.enabled || !cfg.key) {
        status.textContent = '未配置高德地图 Key，暂时只显示日程编辑。';
        return;
      }
      if (cfg.securityCode) window._AMapSecurityConfig = { securityJsCode: cfg.securityCode };
      await new Promise((resolve, reject) => {
        if (window.AMap) return resolve();
        const script = document.createElement('script');
        script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(cfg.key);
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('AMap load failed'));
        document.head.appendChild(script);
      });
      map = new AMap.Map('mapCanvas', {
        zoom: 11,
        center: [116.4074, 39.9042],
        viewMode: '2D',
        resizeEnable: true,
        mapStyle: 'amap://styles/whitesmoke'
      });
      infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) });
      firstFit = true;
      renderMap(firstFit);
      firstFit = false;
      if (pendingJumpId) {
        const id = pendingJumpId;
        pendingJumpId = null;
        jumpToSpot(id);
      }
    } catch (e) {
      status.textContent = '高德地图加载失败，日程编辑仍可使用。';
    }
  }

  $('dayList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) {
      if (e.target.closest('.stop-actions')) return;
      const row = e.target.closest('.stop-row[data-spot-id]');
      if (row) jumpToSpot(row.dataset.spotId);
      return;
    }
    const di = Number(btn.dataset.day);
    const i = Number(btn.dataset.i);
    const act = btn.dataset.act;
    const stops = state.days[di].spots;
    if (act === 'up' && i > 0) [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]];
    if (act === 'down' && i < stops.length - 1) [stops[i + 1], stops[i]] = [stops[i], stops[i + 1]];
    if (act === 'delete') {
      const [id] = stops.splice(i, 1);
      if (!state.pool.includes(id)) state.pool.push(id);
    }
    saveState();
    renderEditor();
    renderMap(false);
  });
  $('dayList').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-act="move"]');
    if (!sel) return;
    const di = Number(sel.dataset.day);
    const i = Number(sel.dataset.i);
    const to = Number(sel.value);
    if (to === di) return;
    const [id] = state.days[di].spots.splice(i, 1);
    state.days[to].spots.push(id);
    saveState();
    renderEditor();
    renderMap(false);
  });
  $('poolList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act="add"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const to = Number($('addDay').value) || 0;
    state.pool = state.pool.filter((x) => x !== id);
    state.days[to].spots.push(id);
    saveState();
    renderEditor();
    renderMap(false);
  });
  $('poolList').addEventListener('change', (e) => {
    if (e.target.closest('[data-hot-select]')) updatePoolSelection();
  });
  $('addSelected').addEventListener('click', () => {
    const ids = [...document.querySelectorAll('#poolList [data-hot-select]:checked')].map((b) => b.dataset.hotSelect);
    if (!ids.length) return;
    const to = Number($('addDay').value) || 0;
    const add = new Set(ids);
    state.pool = state.pool.filter((id) => !add.has(id));
    add.forEach((id) => {
      if (!state.days[to].spots.includes(id)) state.days[to].spots.push(id);
    });
    saveState();
    renderEditor();
    renderMap(false);
  });
  $('optimizeBtn').addEventListener('click', optimizeAll);
  const infoBody = $('infoBody');
  if (infoBody) {
    infoBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-hotel-lat]');
      if (!btn) return;
      const lat = Number(btn.dataset.hotelLat);
      const lon = Number(btn.dataset.hotelLon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      selectHotel(lat, lon, decodeURIComponent(btn.dataset.hotelName || ''));
    });
  }
  const infoTabs = $('infoTabs');
  if (infoTabs) {
    infoTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      [...infoTabs.querySelectorAll('button')].forEach((b) => b.classList.toggle('active', b === btn));
      renderInfoPanel(btn.dataset.tab);
    });
  }
  const loadAiBtn = $('loadAiBtn');
  if (loadAiBtn) loadAiBtn.addEventListener('click', () => loadAiPlan(false));
  $('resetBtn').addEventListener('click', () => {
    Object.assign(HOTEL, DEFAULT_HOTEL);
    state = cloneInitial();
    saveState();
    renderEditor();
    renderMap(true);
    renderInfoPanel(currentInfoTab);
    const status = $('dataStatus');
    if (status) status.textContent = '示例行程';
  });
  window.addEventListener('resize', () => { if (map) map.resize(); });

  window.planMapLab = {
    getMapState: () => ({
      selected: selectedSpotId,
      center: map ? { lng: map.getCenter().lng, lat: map.getCenter().lat } : null,
      zoom: map ? map.getZoom() : null
    })
  };
  if (!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
    const localTip = document.querySelector('.map-tip');
    if (localTip) localTip.hidden = true;
  }
  renderEditor();
  const initialTab = new URLSearchParams(location.search).get('tab');
  const validTab = ['transport', 'hotel', 'budget', 'weather', 'tips'].includes(initialTab) ? initialTab : 'transport';
  document.querySelectorAll('#infoTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === validTab));
  renderInfoPanel(validTab);
  loadAmap();
  if (!localStorage.getItem(STORE_KEY)) loadAiPlan(true);
})();
