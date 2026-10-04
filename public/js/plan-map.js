(() => {
  'use strict';
  const DAY_COLORS = ['#0d9488', '#f97316', '#2563eb', '#9333ea', '#dc2626', '#0891b2', '#65a30d', '#c2410c', '#7c3aed', '#db2777'];
  const TYPE_EN = { '主题': 'Theme', '行程': 'Itinerary', '餐饮': 'Food' };
  const GENERIC = /^(抵达|返回|返程|入住|退房|早餐|午餐|晚餐|自由活动|休息|出发|前往|市区|酒店|民宿|客栈|附近|当地|美食|城市漫步|市区漫步|夜景|行程结束|收拾行李|办理入住|回酒店|逛市区)$/;
  const GENERIC_PREFIX = /^(抵达|返回|返程|入住|退房|出发|前往|自由活动|休息|收拾行李|办理入住|回酒店|逛市区|市区|夜景|附近|当地|美食|特色晚餐|享用早餐|就近午餐|整理行李)/;
  let amapPromise = null;
  let map = null;
  let infoWindow = null;
  let buildToken = 0;
  const POI_CACHE_KEY = 'jyh_map_poi_cache_v1';
  const POI_CACHE_MAX = 300;

  const t = (zh, en) => ((window.i18n && window.i18n.lang === 'en') ? en : zh);
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const escapeHtml = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function status(text, kind) {
    const el = document.getElementById('planMapStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'plan-map-status' + (kind ? ' ' + kind : '');
  }

  function destinationFor(vals, data) {
    const hit = window.app && window.app.state && window.app.state.destinations
      ? window.app.state.destinations.find((d) => d.id === (vals || {}).destinationId)
      : null;
    if (hit) return hit;
    const fallbackName = clean((vals || {}).destinationName || (data && data.title) || '').split('·')[0].trim();
    return fallbackName ? { name: fallbackName } : null;
  }

  function keywordFrom(text) {
    let s = clean(text);
    if (!s) return '';
    s = s.replace(/^[（(].*?[）)]\s*/g, '').replace(/^[·•\-–—]\s*/, '');
    s = s.replace(/^(上午|中午|下午|晚上|推荐|安排|前往|游览|参观|打卡|体验|品尝|享用|乘坐|乘|去|到|逛|漫步|出发去)\s*/, '');
    s = s.replace(/[·・].*$/, '').trim();
    s = s.replace(/(慢逛|漫步|打卡|游玩|观光|体验|活动|安排|初体验)$/g, '').trim();
    s = s.split(/[，,。；;:：]/)[0].trim();
    // 从「玉龙雪山乘大索道」「丽江古城石板路」这类描述中取地点主体
    s = s.replace(/(乘|登|住|感受|观|游|逛|看|品尝|享用|前往|到达|游览|体验|漫步|慢逛|参观|打卡|拍照|高原湖泊|湖泊|古城石板路|石板路|小桥流水|湿地观鸟|骑马划船|特色客栈|特色晚餐).*$/, '').trim();
    if (s.length > 18) s = s.slice(0, 18);
    if (!s || GENERIC.test(s) || (GENERIC_PREFIX.test(s) && s.length < 20)) return '';
    return s;
  }
  function itineraryDays(data) {
    const out = [];
    (data && data.days || []).forEach((day) => {
      const stops = [];
      const seen = new Set();
      const add = (text, time, type) => {
        const keyword = keywordFrom(text);
        if (!keyword) return;
        const key = keyword.toLowerCase();
        if (seen.has(key) || stops.some((item) => item.keyword.includes(keyword) || keyword.includes(item.keyword))) return;
        seen.add(key);
        stops.push({ keyword, name: keyword, time: clean(time), type });
      };
      add(day.title, '', '主题');
      (day.schedule || []).forEach((item) => {
        add(item.activity, item.time, '行程');
        if (stops.length < 4 && item.detail) add(item.detail, item.time, '行程');
      });
      (day.meals || []).forEach((meal) => {
        if (stops.length < 5 && meal.recommend) add(meal.recommend, meal.type, '餐饮');
      });
      if (stops.length) out.push({ day: Number(day.day) || out.length + 1, title: day.title || '', stops: stops.slice(0, 5) });
    });
    return out.slice(0, 14);
  }

  function searchPlace(AMap, city, keyword) {
    return new Promise((resolve) => {
      AMap.plugin(['AMap.PlaceSearch'], () => {
        const search = new AMap.PlaceSearch({ city: city || '全国', citylimit: !!city, pageSize: 1, pageIndex: 1, extensions: 'base' });
        search.search(keyword, (state, result) => {
          if (state !== 'complete') return resolve(null);
          const poi = result && result.poiList && result.poiList.pois && result.poiList.pois[0];
          const location = poi && poi.location;
          const lng = Number(location && (location.lng != null ? location.lng : location.getLng && location.getLng()));
          const lat = Number(location && (location.lat != null ? location.lat : location.getLat && location.getLat()));
          if (!poi || !Number.isFinite(lng) || !Number.isFinite(lat)) return resolve(null);
          resolve({ name: poi.name || keyword, address: poi.address || poi.district || '', lng, lat });
        });
      });
    });
  }

  function readPoiCache() {
    try { const value = JSON.parse(localStorage.getItem(POI_CACHE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch (e) { return {}; }
  }
  function writePoiCache(cache) {
    try {
      const keys = Object.keys(cache);
      while (keys.length > POI_CACHE_MAX) delete cache[keys.shift()];
      localStorage.setItem(POI_CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* localStorage 不可用时忽略 */ }
  }
  function searchPlaceCached(AMap, city, keyword) {
    const cache = readPoiCache();
    const cacheKey = clean(city) + '|' + clean(keyword);
    if (cache[cacheKey]) return Promise.resolve(cache[cacheKey]);
    return searchPlace(AMap, city, keyword).then((poi) => {
      if (poi) { cache[cacheKey] = poi; writePoiCache(cache); }
      return poi;
    });
  }

  function routeModeFor(group, vals) {
    const text = [vals && vals.transport, group && group.title, ...(group && group.items ? group.items.map((x) => x.name) : [])].filter(Boolean).join(' ').toLowerCase();
    return /步行|漫步|徒步|walk|hiking|trail/.test(text) ? 'walking' : 'driving';
  }
  function routeSegment(AMap, from, to, mode) {
    return new Promise((resolve) => {
      const plugin = mode === 'walking' ? 'AMap.Walking' : 'AMap.Driving';
      AMap.plugin([plugin], () => {
        const Router = mode === 'walking' ? AMap.Walking : AMap.Driving;
        const router = new Router({ hideMarkers: true });
        router.search(from, to, (status, result) => {
          if (status !== 'complete' || !result || !result.routes || !result.routes[0]) return resolve(null);
          const route = result.routes[0];
          const path = [];
          (route.steps || []).forEach((step) => (step.path || []).forEach((point) => path.push([point.lng, point.lat])));
          if (!path.length) return resolve(null);
          resolve({ path, distance: Number(route.distance) || 0, time: Number(route.time) || 0 });
        });
      });
    });
  }
  function fmtDistance(meters) {
    return meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.round(meters) + ' m';
  }
  function fmtDuration(seconds) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes >= 60 ? Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm' : minutes + 'm';
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

  async function loadConfig() {
    const response = await fetch('/api/map/config', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('map config unavailable');
    return response.json();
  }

  function loadAmap(config) {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (amapPromise) return amapPromise;
    if (!config || !config.key) return Promise.reject(new Error('NO_KEY'));
    if (config.securityCode) window._AMapSecurityConfig = { securityJsCode: config.securityCode };
    amapPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(config.key);
      script.async = true;
      script.onload = () => (window.AMap ? resolve(window.AMap) : reject(new Error('AMap unavailable')));
      script.onerror = () => reject(new Error('AMap network error'));
      document.head.appendChild(script);
    });
    return amapPromise;
  }

  function renderStopList(container, groups, markers) {
    container.innerHTML = groups.map((group) => {
      const summary = group.summary && group.summary.routed ? ' · ' + fmtDistance(group.summary.distance) + ' · ' + fmtDuration(group.summary.time) : '';
      return `<div class="plan-map-day">
        <div class="plan-map-day-title" data-map-day="${group.day}"><i style="background:${group.color}"></i><span>${t('第 ' + group.day + ' 天', 'Day ' + group.day)}</span><em>${summary}</em></div>
        ${group.items.map((item) => `<button class="plan-map-stop" type="button" data-map-index="${item.index}"><b>${item.index + 1}</b><span>${escapeHtml(item.name)}</span></button>`).join('')}
      </div>`;
    }).join('');
    container.querySelectorAll('[data-map-day]').forEach((title) => {
      title.addEventListener('click', () => {
        const group = groups.find((item) => item.day === Number(title.dataset.mapDay));
        if (group && group.markers && group.markers.length) map.setFitView(group.markers, false, [40, 40, 40, 40], 16);
      });
    });
    container.querySelectorAll('[data-map-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = markers[Number(button.dataset.mapIndex)];
        if (!item || !map) return;
        map.setZoomAndCenter(15, [item.lng, item.lat]);
        if (infoWindow) infoWindow.open(map, [item.lng, item.lat]);
      });
    });
  }
  async function build(data, vals) {
    const shell = document.getElementById('planMapShell');
    const canvas = document.getElementById('planMap');
    const stopList = document.getElementById('planMapStops');
    if (!shell || !canvas || !stopList) return;
    const token = ++buildToken;
    shell.hidden = false;
    canvas.innerHTML = '';
    stopList.innerHTML = '';
    status(t('正在解析行程地点并生成地图…', 'Resolving itinerary places and generating the map…'));
    if (map) { try { map.destroy(); } catch (e) { /* ignore */ } map = null; }
    try {
      const config = await loadConfig();
      if (!config.enabled) throw new Error('NO_KEY');
      const AMap = await loadAmap(config);
      if (token !== buildToken) return;
      const dest = destinationFor(vals, data);
      const city = dest ? dest.name : '';
      const days = itineraryDays(data);
      const items = [];
      days.forEach((day, dayIndex) => day.stops.forEach((stop) => items.push({ ...stop, day: day.day, dayIndex, color: DAY_COLORS[dayIndex % DAY_COLORS.length] })));
      if (!items.length) {
        status(t('暂时无法从行程中识别可定位地点。', 'No locatable places were found in this itinerary.'), 'empty');
        return;
      }
      status(t('正在搜索地点坐标…', 'Looking up place coordinates…'));
      const located = await mapLimit(items, 2, async (item) => ({ ...item, poi: await searchPlaceCached(AMap, city, item.keyword) }));
      if (token !== buildToken) return;
      const valid = located.filter((item) => item.poi);
      const center = dest && Number.isFinite(Number(dest.lon)) ? [Number(dest.lon), Number(dest.lat)] : [116.397, 39.908];
      map = new AMap.Map(canvas, { zoom: 11, center, viewMode: '2D', resizeEnable: true });
      infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -28) });
      const markerItems = [];
      const markerObjects = [];
      const groupsByDay = new Map();
      valid.forEach((item, index) => {
        const position = [item.poi.lng, item.poi.lat];
        const popup = '<b>' + escapeHtml(item.poi.name) + '</b><br>' + escapeHtml(item.time || '') + (item.poi.address ? '<br>' + escapeHtml(item.poi.address) : '');
        const marker = new AMap.Marker({ position, title: item.poi.name, label: { content: 'D' + item.day + ' · ' + (window.i18n && window.i18n.lang === 'en' ? (TYPE_EN[item.type] || item.type || '') : (item.type || '')), direction: 'top' } });
        marker.on('click', () => { infoWindow.setContent(popup); infoWindow.open(map, position); });
        map.add(marker);
        markerObjects.push(marker);
        markerItems[index] = { ...item, ...item.poi, lng: item.poi.lng, lat: item.poi.lat, position };
        if (!groupsByDay.has(item.day)) groupsByDay.set(item.day, { day: item.day, color: item.color, path: [], markers: [], items: [] });
        const group = groupsByDay.get(item.day);
        group.path.push(position);
        group.markers.push(marker);
        group.items.push({ ...item, index, name: item.poi.name });
      });
      const groups = [...groupsByDay.values()];
      const routeTasks = [];
      groups.forEach((group) => {
        group.summary = { routed: false, distance: 0, time: 0 };
        for (let i = 0; i < group.path.length - 1; i++) routeTasks.push({ group, from: group.path[i], to: group.path[i + 1], mode: routeModeFor(group, vals) });
      });
      if (routeTasks.length) status(t('正在计算每日路线…', 'Calculating daily routes…'));
      const routeResults = await mapLimit(routeTasks, 2, async (task) => ({ task, route: await routeSegment(AMap, task.from, task.to, task.mode) }));
      groups.forEach((group) => { group.routePath = []; });
      routeResults.forEach(({ task, route }) => {
        if (route && route.path.length) {
          task.group.routePath.push(...route.path);
          task.group.summary.distance += route.distance;
          task.group.summary.time += route.time;
          task.group.summary.routed = true;
        } else {
          task.group.routePath.push(task.from, task.to);
        }
      });
      groups.forEach((group) => {
        if (group.routePath.length > 1) map.add(new AMap.Polyline({ path: group.routePath, strokeColor: group.color, strokeWeight: 4, strokeOpacity: 0.8, strokeStyle: group.summary.routed ? 'solid' : 'dashed', lineJoin: 'round' }));
      });
      renderStopList(stopList, groups, markerItems);
      if (markerObjects.length) map.setFitView(markerObjects, false, [40, 40, 40, 40], 15);
      const routedDays = groups.filter((group) => group.summary.routed).length;
      status(t('已定位 ' + valid.length + '/' + items.length + ' 个地点，已完成 ' + routedDays + '/' + groups.length + ' 天路线计算。', 'Located ' + valid.length + '/' + items.length + ' places; routed ' + routedDays + '/' + groups.length + ' days.'));
    } catch (error) {
      if (error && error.message === 'NO_KEY') {
        status(t('未配置高德地图 Key，暂时无法生成地图。请在 config.local.json 的 map 段填写 Web端 JS API Key 和安全密钥。', 'AMap key is not configured. Add a Web JS API key and security code to the map section of config.local.json.'));
      } else {
        status(t('高德地图加载失败，请检查地图 Key、安全密钥和网络。', 'AMap failed to load. Check the map key, security code and network.'));
      }
    }
  }

  window.planMap = { build };
})();
