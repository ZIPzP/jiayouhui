(() => {
  'use strict';

  // 动效钩子：JS 可用时挂 html.js，入场/滚动动画类只在此时生效（无 JS 时内容直出）
  document.documentElement.classList.add('js');

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const ICON_DEFS = {
    home: '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z"/>',
    map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/>',
    sparkles: '<path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z"/><path d="m5 16 .8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z"/><path d="M19 14v6M16 17h6"/>',
    backpack: '<path d="M6 9a6 6 0 0 1 12 0v11H6V9Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2M9 13h6M10 20v-4h4v4"/>',
    route: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h4a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-6-4-8 0 3-2 4-3 5 0-3-2-6-4-8 0 4-3 7-3 11 0 4 3 7 7 7Z"/>',
    settings: '<path d="M4 7h7M15 7h5M4 17h5M13 17h7"/><circle cx="13" cy="7" r="2"/><circle cx="11" cy="17" r="2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
    book: '<path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22V5.5ZM21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22V5.5Z"/>',
    warning: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17.5v.1"/>',
    plane: '<path d="M22 2 9.5 14.5M22 2l-7 20-5.5-7.5L2 9l20-7Z"/>',
    train: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 7h8M8 12h.1M16 12h.1M8 18l-2 3M16 18l2 3M7 21h10"/>',
    car: '<path d="m5 11 2-5h10l2 5M3 14a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4H3v-4Z"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M7 7h10M7 12h.1M17 12h.1M7 18l-2 3M17 18l2 3M6 21h12"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.1.8-1.8 1.2-1.8 2.7M12 17.5v.1"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    leaf: '<path d="M20 4C9 4 4 9 4 16c0 2 1 4 1 4 4-8 8-9 14-10-4 3-7 6-9 10"/>',
    landmark: '<path d="m3 9 9-5 9 5M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 9h18M16 14h2"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
    gem: '<path d="m7 3-4 6 9 12 9-12-4-6H7Z"/><path d="M3 9h18M9 3l3 6 3-6M8 9l4 12 4-12"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    'star-filled': '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill="currentColor"/>',
    bed: '<path d="M3 20V8M21 20v-6a3 3 0 0 0-3-3H9v5M3 14h18M6 11H3v3h3v-3Z"/>',
    mountain: '<path d="m3 20 7-12 4 7 2-3 5 8H3Z"/><path d="m8 11 2 3 2-3"/>',
    food: '<path d="M6 3v8M9 3v8M6 7h3M7.5 11v10M16 3c-2 2-2 6 0 8v10M16 3c3 2 3 6 0 8"/>',
    waves: '<path d="M2 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 13c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
    moon: '<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
    ticket: '<path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 0 0-6V5H3v4Z"/><path d="M9 5v14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17h2M14 17h2"/>',
    cloudSun: '<path d="M8 9a4 4 0 0 1 7.5-2M5 5V3M5 15H3M10 3h-.1M3 10h-.1M7 7 5.5 5.5M13 5l1.5-1.5"/><path d="M7 19h9a4 4 0 0 0 .7-7.9A5 5 0 0 0 7 13a3 3 0 0 0 0 6Z"/>',
    wrench: '<path d="M14.5 6.5a4.5 4.5 0 0 0-6 5.8L3 17.8 6.2 21l5.5-5.5a4.5 4.5 0 0 0 5.8-6L14 13l-3-3 3.5-3.5Z"/>',
    message: '<path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1.2-4.2A8 8 0 1 1 21 12Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 17 5-5 4 4 2-2 7 7"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/>',
    package: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    'arrow-left': '<path d="m15 18-6-6 6-6"/>',
    'arrow-right': '<path d="m9 18 6-6-6-6"/>',
    'arrow-up': '<path d="m6 15 6-6 6 6"/>',
    buildings: '<path d="M4 21V7l6-4v18M10 21V9l10-3v15M2 21h20M7 8v.1M7 12v.1M7 16v.1M14 10v.1M14 14v.1M14 18v.1"/>',
    rocket: '<path d="M14 4c3-2 6-2 6-2s0 3-2 6l-6 6-4-4 6-6ZM8 14l-3 1-2 4 4-2 1-3ZM4 16l4 4M14 10l2 2"/>'
  };

  const EMOJI_ICONS = {
    '🏠':'home','🏡':'home','🗺️':'map','🗺':'map','🧭':'compass','🏞️':'mountain','🏞':'mountain',
    '🐱':'sparkles','🎒':'backpack','🧳':'backpack','📦':'package','🔥':'flame','🎲':'dice',
    '📖':'book','⚠️':'warning','⚠':'warning','👴':'user','🧑':'user','🧒':'user','👨‍👩‍👧':'users',
    '⚙️':'settings','⚙':'settings','☰':'menu','✕':'close','‹':'arrow-left','›':'arrow-right','↑':'arrow-up',
    '📅':'calendar','🌤️':'cloudSun','🌤':'cloudSun','✈️':'plane','✈':'plane','🚄':'train','🚗':'car','🚌':'bus',
    '❓':'help','🤷':'help','🌅':'sun','☀️':'sun','☀':'sun','🌇':'sun','🌶️':'warning','🌶':'warning',
    '🦐':'warning','🥜':'warning','🥛':'warning','🥬':'leaf','🕌':'landmark','🏯':'landmark','🏛️':'landmark',
    '🏛':'landmark','✅':'check','💰':'wallet','💳':'card','💎':'gem','🏨':'bed','🏰':'bed','🍜':'food',
    '🌊':'waves','🏘️':'buildings','🏘':'buildings','🌃':'moon','🎡':'ticket','🕘':'clock','📍':'pin',
    '🔒':'lock','🔓':'unlock','🌏':'globe','🖼️':'image','🖼':'image','🛠️':'wrench','🛠':'wrench','💬':'message','🚀':'rocket',
    '✨':'sparkles','☆':'star','★':'star-filled'
  };

  const ICON_SELECTOR = [
    '.btn','.chip','.tt-emoji','.ft-icon','.entry-icon','.result-empty-icon','.disc-hero-mark',
    '.settings-menu button','.settings-menu a','#navLinks a','.about-card h3','.quick-title',
    '.date-icon','#planDateWeatherTitle','.chat-desktop-only','.chat-mobile-only','.num-group span',
    '.nav-toggle','.modal-close','.lightbox-close','.lightbox-nav','.to-top','#langSwitch'
  ].join(',');
  const EMOJI_KEYS = Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length);

  function injectIconSprite() {
    if (document.getElementById('ui-icon-sprite')) return;
    const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sprite.id = 'ui-icon-sprite';
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    sprite.innerHTML = Object.entries(ICON_DEFS).map(([name, path]) =>
      `<symbol id="ui-icon-${name}" viewBox="0 0 24 24">${path}</symbol>`
    ).join('');
    document.body.prepend(sprite);
  }

  function makeUiIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#ui-icon-' + name);
    svg.appendChild(use);
    return svg;
  }

  function upgradeEmojiIcons(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    const targets = [];
    if (scope.matches && scope.matches(ICON_SELECTOR)) targets.push(scope);
    if (scope.querySelectorAll) targets.push(...scope.querySelectorAll(ICON_SELECTOR));
    targets.forEach((el) => {
      const hasIcon = !!el.querySelector('.ui-icon');
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || '';
        const leading = text.match(/^\s*/)[0];
        const trimmed = text.slice(leading.length);
        const emoji = EMOJI_KEYS.find((key) => trimmed.startsWith(key));
        if (!emoji) continue;
        const icon = makeUiIcon(EMOJI_ICONS[emoji]);
        node.nodeValue = trimmed.slice(emoji.length).replace(/^\s+/, '');
        if (!hasIcon) node.parentNode.insertBefore(icon, node);
        el.classList.add('has-ui-icon');
        break;
      }
    });
  }

  function observeEmojiIcons() {
    if (!('MutationObserver' in window)) return;
    let pending = false;
    let roots = [];
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node && node.nodeType === 1) roots.push(node);
        }
        if (mutation.type === 'characterData' && mutation.target.parentElement) {
          roots.push(mutation.target.parentElement);
        }
      }
      if (pending || !roots.length) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const batch = roots;
        roots = [];
        batch.forEach((node) => upgradeEmojiIcons(node));
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function bindButtonMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const control = event.target.closest('.btn, .chip');
      if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
      const rect = control.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.2;
      const ripple = document.createElement('span');
      ripple.className = 'ui-ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
      control.appendChild(ripple);
      setTimeout(() => ripple.remove(), 560);
    }, { passive: true });
  }

  const CLIENT_ID_KEY = 'jyh_client_id';
  function loadClientId() {
    try {
      const saved = String(localStorage.getItem(CLIENT_ID_KEY) || '').trim();
      if (/^[A-Za-z0-9_-]{16,80}$/.test(saved)) return saved;
      const id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(CLIENT_ID_KEY, id);
      return id;
    } catch {
      return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
  }

  const state = {
    destinations: [],
    elderly: localStorage.getItem('jyh_elderly') === '1',
    ai: JSON.parse(localStorage.getItem('jyh_ai') || '{}'),
    clientId: loadClientId(),
    aiUsage: null,
    serverKey: false,
    aiUnlocked: false
  };

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, ms = 2800) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, ms);
  }
  async function api(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    // 让服务端错误信息也跟随界面语言（解析请求体之前就能拿到）
    headers['x-lang'] = (window.i18n && window.i18n.lang) || 'zh';
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    const data = await r.json().catch(() => ({}));
    const creditHeader = r.headers.get('X-AI-Credits');
    if (creditHeader != null && Number.isFinite(Number(creditHeader))) {
      state.aiUsage = Object.assign({}, state.aiUsage || {}, {
        credits: Number(creditHeader),
        lowBalance: Number(creditHeader) <= Number(state.aiUsage?.lowBalanceThreshold || 3),
        exhausted: Number(creditHeader) <= 0
      });
      updateAiHints();
      if (state.aiUsage.lowBalance && !state.aiUsage.exhausted && !state.lowCreditWarned) {
        state.lowCreditWarned = true;
        toast(`⚠️ AI 额度仅剩 ${state.aiUsage.credits} 点，请及时充值`, 5000);
      } else if (!state.aiUsage.lowBalance) {
        state.lowCreditWarned = false;
      }
    }
    if (!r.ok) {
      const error = new Error(data.error || `请求失败（${r.status}）`);
      error.status = r.status;
      error.code = data.code || '';
      error.usage = data.usage || null;
      if (data.usage) {
        state.aiUsage = data.usage;
        updateAiHints();
      }
      throw error;
    }
    return data;
  }
  const TRIP_HISTORY_KEY = 'jyh_trip_history_v1';
  function loadTripHistory() {
    try {
      const rows = JSON.parse(localStorage.getItem(TRIP_HISTORY_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter((row) => row && row.id && row.title).slice(0, 50) : [];
    } catch {
      return [];
    }
  }
  function saveTripHistory(rows) {
    try { localStorage.setItem(TRIP_HISTORY_KEY, JSON.stringify(rows.slice(0, 50))); } catch { /* ignore */ }
  }
  function recordTrip(vals, result) {
    if (!vals || !result || !Array.isArray(result.days) || !result.days.length) return null;
    const rows = loadTripHistory();
    const destination = String(vals.destinationName || (vals.customDest && vals.customDest.name) || result.title || '').trim();
    const signature = [destination, vals.startDate || '', vals.endDate || '', vals.origin || ''].join('|');
    const existing = rows.find((row) => row.signature === signature);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(String(vals.endDate || ''))
      ? new Date(String(vals.endDate) + 'T23:59:59')
      : null;
    const record = {
      id: existing?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
      signature,
      title: String(result.title || destination + ' 家庭行程').slice(0, 120),
      destination,
      origin: String(vals.origin || ''),
      startDate: String(vals.startDate || ''),
      endDate: String(vals.endDate || ''),
      days: result.days.length,
      travelers: Number(vals.elderly || 0) + Number(vals.adults || 0) + Number(vals.children || 0),
      dietary: Array.isArray(vals.dietary) ? vals.dietary.slice(0, 8) : [],
      status: end && end.getTime() < Date.now() ? 'completed' : 'upcoming',
      provider: String(result.provider || 'rule'),
      citations: Array.isArray(result.citations) ? result.citations.length : 0,
      toolCalls: Array.isArray(result.toolTrace) ? result.toolTrace.length : 0,
      budget: String(result.budget && result.budget.totalPerPerson || ''),
      lang: (window.i18n && window.i18n.lang) || 'zh',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    const next = existing
      ? rows.map((row) => row.id === existing.id ? record : row)
      : [record, ...rows];
    saveTripHistory(next);
    return record;
  }
  function clearTripHistory() {
    try { localStorage.removeItem(TRIP_HISTORY_KEY); } catch { /* ignore */ }
  }
  function imgFallback(img, emoji = '🏡', name = '', accent = '#0f766e') {
    if (!img) return;
    img.onerror = null;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${accent}'/><stop offset='1' stop-color='${accent}' stop-opacity='.6'/></linearGradient></defs><rect width='800' height='500' fill='url(#g)'/><text x='400' y='250' font-size='130' text-anchor='middle'>${emoji}</text><text x='400' y='370' font-size='52' fill='rgba(255,255,255,.95)' text-anchor='middle' font-family='PingFang SC, Microsoft YaHei, sans-serif'>${name}</text></svg>`;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function setBg(el, url) { if (url) { el.style.backgroundImage = `url('${url}')`; el.classList.remove('bg-in'); void el.offsetWidth; el.classList.add('bg-in'); } }
  /** 轮询后台任务，直到完成（AI 生成期间可放心离开页面） */
  async function pollJob(jobId, { interval = 2000, timeout = 240000, onProgress, onDone, onError } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        const j = await api('/api/job?id=' + encodeURIComponent(jobId));
        if (onProgress) onProgress(j.progress || null);
        if (j.status === 'done') { onDone(j.result); return; }
        if (j.status === 'error') { onError(j.error || '生成失败'); return; }
      } catch (e) {
        // 任务已经不存在或无权读取时立即结束，不能把 404 当成网络抖动反复等待。
        if (e && [403, 404].includes(Number(e.status))) {
          onError(e.message || '任务已结束或过期');
          return;
        }
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    onError('生成超时，请重试');
  }

  /* ---------------- 长辈模式 ---------------- */
  function applyElderly() {
    document.documentElement.classList.toggle('elderly', state.elderly);
    const btn = $('#elderlyToggle');
    if (btn) btn.setAttribute('aria-pressed', state.elderly ? 'true' : 'false');
    const meLabel = $('#menuElderly span');
    if (meLabel) meLabel.textContent = state.elderly ? '长辈模式（已开启）' : '长辈模式';
  }
  function toggleElderly() {
    state.elderly = !state.elderly;
    localStorage.setItem('jyh_elderly', state.elderly ? '1' : '0');
    applyElderly();
    toast(state.elderly ? '👴 长辈模式已开启：字体放大、对比增强、按钮放大' : '已退出长辈模式');
  }

  /* ---------------- AI 设置（共享） ---------------- */
  const PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
  };

  function updateAiModal() {
    const st = $('#aiServerStatus');
    const keyGroup = $('#aiKeyGroup');
    const invGroup = $('#aiInviteGroup');
    const invStatus = $('#aiInviteStatus');
    const offBtn = $('#ai-unlock-off');
    if (state.aiUnlocked) {
      if (st) { st.hidden = false; st.textContent = '✅ 已解锁服务端 AI（使用我的 Key，仅服务器持有）'; }
      if (keyGroup) keyGroup.hidden = true;
      if (invGroup) invGroup.hidden = true;
      if (invStatus) invStatus.hidden = true;
      if (offBtn) offBtn.hidden = false;
    } else if (state.serverKey) {
      if (st) { st.hidden = false; st.textContent = '🔒 服务端 AI 已就绪：输入邀请码解锁后用我的 Key；不输则用下方自带 Key'; }
      if (keyGroup) keyGroup.hidden = false;
      if (invGroup) invGroup.hidden = false;
      if (invStatus) invStatus.hidden = true;
      if (offBtn) offBtn.hidden = true;
    } else {
      if (st) st.hidden = true;
      if (keyGroup) keyGroup.hidden = false;
      if (invGroup) invGroup.hidden = true;
      if (invStatus) invStatus.hidden = true;
      if (offBtn) offBtn.hidden = true;
    }
  }
  function updateAiHints() {
    const usageText = state.aiUsage && Number.isFinite(state.aiUsage.credits)
      ? ' · 剩余 ' + state.aiUsage.credits + ' 点'
      : '';
    const m = $('#aiModeHint');
    if (m) m.textContent = state.aiUnlocked ? '🔒 已解锁服务端 AI（使用我的 Key）· ' + (state.ai.model || '默认模型') + usageText
      : (state.serverKey ? '🔑 服务端 AI 需邀请码解锁；也可用下方自带 Key'
      : (state.ai.apiKey ? '🐱 当前使用浏览器本地 Key：' + (state.ai.model || '默认')
      : '📋 演示模式（内置规则引擎）。配置 DeepSeek Key 后启用大模型。'));
    const ph = $('#planAiHint');
    if (ph) ph.textContent = state.aiUnlocked ? '🔒 AI 主理人已接入（服务端 Key，仅服务器持有）' + usageText
      : (state.serverKey ? '🔑 输入邀请码解锁服务端 AI，或填自带 Key'
      : (state.ai.apiKey ? '🐱 AI 主理人已接入（浏览器本地 Key：' + (state.ai.model || '已配置') + '）'
      : '📋 演示模式：未配置 AI Key，将使用内置规划引擎（点右上角 ⚙️ AI 设置 接入 DeepSeek）'));
    const ct = $('#chatModeTag');
    if (ct) ct.textContent = state.aiUnlocked ? '🔒 AI 模式' : (state.ai.apiKey ? 'AI 模式 · ' + (state.ai.model || '') : '演示模式');
    const usage = $('#aiUsageStatus');
    const recharge = $('#aiRechargeLink');
    if (usage) {
      if (state.aiUnlocked && state.aiUsage) {
        const u = state.aiUsage;
        usage.hidden = false;
        usage.textContent = u.lowBalance
          ? `⚠️ AI 额度仅剩 ${u.credits} 点，请及时充值`
          : `可用 AI 额度：${u.credits} 点 · 生成行程 ${u.costs.plan} 点 / 修改与问答 ${u.costs.revision} 点`;
      } else {
        usage.hidden = true;
        usage.textContent = '';
      }
    }
    if (recharge) recharge.hidden = !state.aiUnlocked;
    if (state.aiUnlocked && state.aiUsage?.lowBalance && !state.lowCreditWarned) {
      state.lowCreditWarned = true;
      toast(`⚠️ AI 额度仅剩 ${state.aiUsage.credits} 点，请及时充值`, 5000);
    } else if (!state.aiUsage?.lowBalance) {
      state.lowCreditWarned = false;
    }
  }

  async function refreshAiStatus() {
    try {
      const h = await api('/api/health');
      // 公网健康检查不会暴露 Key 状态；邀请码状态仍可公开查询，供用户主动解锁。
      const r = await api('/api/ai/status', { headers: { 'x-ai-token': state.ai.aiToken || '', 'x-client-id': state.clientId } });
      state.serverKey = !!h.hasServerKey || !!r.hasInvite;
      state.aiUnlocked = !!r.unlocked;
      state.aiUsage = r.usage || null;
    } catch (e) { /* 忽略 */ }
    updateAiHints();
    updateAiModal();
  }

  async function openAiModal() {
    $('#ai-key').value = '';
    $('#ai-base').value = state.ai.baseUrl || '';
    $('#ai-model').value = state.ai.model || '';
    // 让服务商预设显示真实保存值，避免「实际是阿里云、界面却高亮 DeepSeek」
    const savedBase = (state.ai.baseUrl || '').replace(/\/+$/, '');
    const savedModel = state.ai.model || '';
    const matched = Object.keys(PROVIDERS).find((key) => PROVIDERS[key].baseUrl.replace(/\/+$/, '') === savedBase && PROVIDERS[key].model === savedModel);
    const activeKey = matched || (!savedBase && !savedModel ? 'deepseek' : '');
    $$('#providerPresets .chip[data-provider]').forEach((chip) => chip.classList.toggle('active', chip.dataset.provider === activeKey));
    const kh = $('#aiKeyHint');
    if (kh) kh.textContent = state.ai.apiKey ? '✅ 已保存 Key（留空保持现有，填写新 Key 可更换）' : '';
    const iv = $('#ai-invite'); if (iv) iv.value = '';
    // 检查当前解锁状态（服务端是否配了邀请码、本地令牌是否仍有效）
    if (state.serverKey) {
      try {
        const r = await api('/api/ai/status', { headers: { 'x-ai-token': state.ai.aiToken || '', 'x-client-id': state.clientId } });
        state.aiUnlocked = !!r.unlocked;
        state.aiUsage = r.usage || null;
      } catch (e) { state.aiUnlocked = false; }
    } else { state.aiUnlocked = false; }
    $('#aiModal').hidden = false;
    document.body.style.overflow = 'hidden';
    updateAiModal();
  }
  function closeAiModal() {
    $('#aiModal').hidden = true;
    document.body.style.overflow = '';
  }
  function saveAi() {
    const enteredKey = $('#ai-key').value.trim();
    state.ai = {
      // 输入框留空表示沿用已保存的 Key，而不是把它清空
      apiKey: enteredKey || state.ai.apiKey || '',
      baseUrl: $('#ai-base').value.trim(),
      model: $('#ai-model').value.trim(),
      aiToken: state.ai.aiToken || ''
    };
    localStorage.setItem('jyh_ai', JSON.stringify(state.ai));
    updateAiHints();
    const kh2 = $('#aiKeyHint');
    if (kh2) kh2.textContent = state.ai.apiKey ? '✅ 已保存 Key（留空保持现有，填写新 Key 可更换）' : '';
    $('#ai-key').value = '';
    closeAiModal();
    toast(enteredKey ? '✅ AI 设置已保存，开始使用大模型' : (state.ai.apiKey ? '✅ AI 设置已保存' : '已切换为演示模式（内置规则引擎）'));
  }

  function bindSettings() {
    const et = $('#elderlyToggle');
    if (et) et.addEventListener('click', toggleElderly);
    const ab = $('#aiSettingsBtn');
    if (ab) ab.addEventListener('click', openAiModal);
    const ac = $('#aiModalClose');
    if (ac) ac.addEventListener('click', closeAiModal);
    const save = $('#ai-save');
    if (save) save.addEventListener('click', saveAi);
    const ib = $('#ai-invite-btn');
    if (ib) ib.addEventListener('click', async () => {
      const code = $('#ai-invite').value.trim();
      const st = $('#aiInviteStatus');
      if (!code) { app.toast('请输入邀请码'); return; }
      ib.disabled = true;
      try {
        const r = await api('/api/ai/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, clientId: state.clientId }) });
        state.ai.aiToken = r.aiToken;
        state.aiUsage = r.usage || null;
        localStorage.setItem('jyh_ai', JSON.stringify(state.ai));
        state.aiUnlocked = true;
        if (st) { st.hidden = true; st.textContent = ''; }
        updateAiModal(); updateAiHints();
        toast('✅ 已解锁服务端 AI，正在使用我的 Key');
      } catch (e) {
        if (st) { st.textContent = (e && e.message) || '邀请码错误'; st.hidden = false; }
      } finally { ib.disabled = false; }
    });
    const uo = $('#ai-unlock-off');
    if (uo) uo.addEventListener('click', () => {
      state.ai.aiToken = '';
      state.aiUsage = null;
      localStorage.setItem('jyh_ai', JSON.stringify(state.ai));
      state.aiUnlocked = false;
      updateAiModal(); updateAiHints();
      toast('已退出解锁，改用自带 Key');
    });
    // 设置菜单
    const closeMenu = () => { const m = $('#settingsMenu'); if (m) m.hidden = true; };
    const sb = $('#settingsBtn');
    if (sb) sb.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = $('#settingsMenu');
      if (m) m.hidden = !m.hidden;
    });
    const me = $('#menuElderly');
    if (me) me.addEventListener('click', toggleElderly);
    const ma = $('#menuAi');
    if (ma) ma.addEventListener('click', () => { closeMenu(); openAiModal(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.settings-wrap')) closeMenu(); });
    const presets = $('#providerPresets');
    if (presets) presets.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip[data-provider]');
      if (!btn) return;
      const p = PROVIDERS[btn.dataset.provider];
      if (!p) return;
      $$('#providerPresets .chip').forEach((c) => c.classList.toggle('active', c === btn));
      $('#ai-base').value = p.baseUrl;
      $('#ai-model').value = p.model;
      toast(`已选择 ${btn.textContent.trim()}，请粘贴 API Key 后保存`);
      $('#ai-key').focus();
    });
  }

  /* ---------------- 共享外壳注入 ---------------- */
  function ensureShell() {
    let html = '';
    if (!document.getElementById('aiModal')) {
      html += `<div class="modal-backdrop" id="aiModal" hidden>
        <div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="AI 设置">
          <button class="modal-close" id="aiModalClose" type="button" aria-label="关闭">✕</button>
          <h3>🐱 AI 大模型设置</h3>
          <p class="form-hint">推荐 DeepSeek：点「🚀 DeepSeek」一键填入接口与模型，再粘贴你的 API Key。Key 仅保存在本地。</p>
          <div class="provider-presets" id="providerPresets">
            <button class="chip active" data-provider="deepseek" type="button">🚀 DeepSeek</button>
            <button class="chip" data-provider="openai" type="button">OpenAI</button>
            <button class="chip" data-provider="qwen" type="button">通义千问</button>
            <button class="chip" data-provider="moonshot" type="button">Moonshot</button>
          </div>
          <div id="aiServerStatus" class="ai-server-status" hidden></div>
          <div class="form-group" id="aiInviteGroup" hidden>
            <label class="form-label" for="ai-invite">🔑 邀请码（解锁服务端 AI，用我的 Key）</label>
            <input id="ai-invite" type="password" class="input" placeholder="输入邀请码" autocomplete="off" />
            <button id="ai-invite-btn" class="btn btn-primary" type="button" style="margin-top:8px;width:100%">🔓 解锁服务端 AI</button>
          </div>
          <div id="aiInviteStatus" class="ai-server-status form-hint" hidden></div>
          <div id="aiUsageStatus" class="ai-server-status form-hint" hidden></div>
          <a id="aiRechargeLink" class="btn btn-ghost" href="/profile.html#billing" hidden style="margin:4px 0 10px;width:100%">查看额度与充值</a>
          <button id="ai-unlock-off" class="btn btn-ghost" type="button" hidden style="margin:4px 0 10px;width:100%">退出解锁（改用自带 Key）</button>
          <div class="form-group" id="aiKeyGroup">
            <label class="form-label" for="ai-key">API Key</label>
            <input id="ai-key" type="password" class="input" placeholder="sk-..." autocomplete="off" />
            <p id="aiKeyHint" class="form-hint" style="color:var(--primary-dark)"></p>
          </div>
          <div style="height:10px"></div>
          <div class="form-group">
            <label class="form-label" for="ai-base">接口地址 Base URL</label>
            <input id="ai-base" type="text" class="input" placeholder="https://api.deepseek.com/v1" />
          </div>
          <div class="form-group">
            <label class="form-label" for="ai-model">模型</label>
            <input id="ai-model" type="text" class="input" placeholder="deepseek-flash" />
          </div>
          <button id="ai-save" class="btn btn-primary btn-lg btn-block" type="button">保存设置</button>
        </div>
      </div>`;
    }
    if (!document.getElementById('toast')) {
      html += '<div id="toast" class="toast" hidden></div>';
    }
    if (html) document.body.insertAdjacentHTML('beforeend', html);
    // 导航栏：把长辈模式 / AI 设置 / 关于收进「⚙️ 设置」菜单
    const actions = document.querySelector('.nav-actions');
    if (actions && !document.getElementById('settingsBtn')) {
      const et = document.getElementById('elderlyToggle');
      if (et) et.hidden = true;
      const ab = document.getElementById('aiSettingsBtn');
      if (ab) ab.hidden = true;
      const aboutLink = document.querySelector('.nav-links a[data-nav="about"]');
      if (aboutLink) aboutLink.remove();
      actions.innerHTML = `<div class="settings-wrap">
        <button class="nav-toggle" id="navToggle" type="button" aria-label="打开菜单" aria-expanded="false" title="菜单">☰</button>
        <button id="settingsBtn" class="btn btn-ghost" type="button">⚙️ 设置</button>
        <div class="settings-menu" id="settingsMenu" hidden>
          <button id="menuElderly" type="button">👴 <span>长辈模式</span></button>
          <button id="menuAi" type="button">🐱 AI 设置</button>
          <a href="/about.html">📖 关于</a>
        </div>
      </div>
      <a class="btn btn-primary btn-start-desktop" href="/plan.html">开始规划</a>`;
      // 电脑端专属：顶部一排导航（仅 ≥901px 显示，手机端不受影响）
      const inner = document.querySelector('.nav-inner');
      if (inner && !document.querySelector('.nav-links-inline')) {
        const inlineNav = document.createElement('nav');
        inlineNav.className = 'nav-links-inline';
        inlineNav.innerHTML = [
          ['/', 'home', '首页'], ['/destinations.html', 'destinations', '目的地'],
          ['/plan.html', 'plan', '行程规划'], ['/packing.html', 'packing', '出行清单'],
          ['/draw.html', 'discovery', '发现']
        ].map(([href, k, label]) => '<a href="' + href + '" data-nav="' + k + '">' + label + '</a>').join('');
        inner.insertBefore(inlineNav, actions);
      }
    }
  }

  /* ---------------- 个人旅行档案入口 ---------------- */
  function ensureProfileEntry() {
    const actions = document.querySelector('.nav-actions');
    if (actions && !document.querySelector('.nav-profile-link')) {
      const link = document.createElement('a');
      link.className = 'btn btn-ghost nav-profile-link';
      link.href = '/profile.html';
      link.dataset.nav = 'profile';
      link.textContent = '旅行档案';
      const start = actions.querySelector('.btn-start-desktop');
      actions.insertBefore(link, start || null);
    }
    const links = document.getElementById('navLinks');
    if (links && !links.querySelector('[data-nav="profile"]')) {
      const link = document.createElement('a');
      link.href = '/profile.html';
      link.dataset.nav = 'profile';
      link.textContent = '旅行档案';
      links.appendChild(link);
    }
  }

  /* ---------------- 导航高亮 ---------------- */
  function bindNav() {
    const toggle = document.getElementById('navToggle');
    const drawer = document.getElementById('navDrawer');
    const backdrop = document.getElementById('navBackdrop');
    if (!toggle || !drawer) return;
    function openNav() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); if (backdrop) backdrop.classList.add('show'); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
    function closeNav() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); if (backdrop) backdrop.classList.remove('show'); toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
    toggle.addEventListener('click', () => { drawer.classList.contains('open') ? closeNav() : openNav(); });
    if (backdrop) backdrop.addEventListener('click', closeNav);
    const links = document.getElementById('navLinks');
    if (links) links.addEventListener('click', (e) => { if (e.target.closest('a')) closeNav(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  }
  function navActive() {
    const p = location.pathname.split('/').pop() || 'index.html';
    const map = { 'index.html': 'home', 'destinations.html': 'destinations', 'plan.html': 'plan', 'packing.html': 'packing', 'hot.html': 'hot', 'draw.html': 'discovery', 'draw-mobile.html': 'draw', 'about.html': 'about', 'profile.html': 'profile' };
    const key = map[p] || 'home';
    $$('#navLinks a, .nav-links-inline a, .nav-profile-link').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }

  function adaptLegacyMobileNav() {
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    $$('a[data-nav="discovery"]').forEach((link) => {
      if (link.dataset.mobileExpanded === '1') return;
      const hot = document.createElement('a');
      hot.href = '/hot.html';
      hot.dataset.nav = 'hot';
      hot.textContent = '🔥 平台热度';
      const draw = document.createElement('a');
      draw.href = '/draw.html';
      draw.dataset.nav = 'draw';
      draw.textContent = '🎲 抽取';
      link.replaceWith(hot, draw);
    });
  }

  /* ---------------- 导航毛玻璃两态：滚动后加深 + 阴影 ---------------- */
  function bindNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      nav.classList.toggle('scrolled', window.scrollY > 8); // 状态翻转时才改 DOM，其余滚动零开销
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update(); // 初始状态（锚点直达/页面中部刷新时立即正确）
  }

  function bindNavPrefetch() {
    const connection = navigator.connection || {};
    if (connection.saveData || /^(slow-2g|2g)$/.test(connection.effectiveType || '')) return;
    const links = [...document.querySelectorAll('.nav-links-inline a[href], #navDrawer a[href]')]
      .filter((a) => a.origin === location.origin && a.pathname !== location.pathname);
    const seen = new Set();
    const prefetch = (href) => {
      if (!href || seen.has(href)) return;
      seen.add(href);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = href;
      document.head.appendChild(link);
    };
    links.forEach((a) => {
      ['pointerenter', 'focus', 'touchstart'].forEach((type) => {
        a.addEventListener(type, () => prefetch(a.href), { once: true, passive: true });
      });
    });
    const idle = window.requestIdleCallback
      ? (cb) => requestIdleCallback(cb, { timeout: 1200 })
      : (cb) => setTimeout(cb, 900);
    idle(() => links.forEach((a) => prefetch(a.href)));
  }

  /* ---------------- 启动 ---------------- */
  async function startPage() {
    refreshAiStatus();
    // 统一先加载目的地数据（各页面共享）
    try {
      if (!state.destinations.length) {
        const data = await api('/api/destinations');
        state.destinations = data.destinations || [];
      }
      if (!(state.cities || []).length) {
        const cd = await api('/api/cities');
        state.cities = cd.cities || [];
      }
    } catch (e) { /* 由页面自行处理 */ }
    if (typeof window.pageInit === 'function') {
      try { await window.pageInit(); } catch (e) { console.error('[pageInit]', e); }
    }
  }
  /* ---------- 动态背景层：流动渐变 + 漂浮光斑（纯视觉，不影响功能） ---------- */
  function injectBgFx() {
    if (document.querySelector('.bg-fx')) return;
    const fx = document.createElement('div');
    fx.className = 'bg-fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<span class="aurora"></span><span class="orb orb-1"></span><span class="orb orb-2"></span><span class="orb orb-3"></span>';
    document.body.insertBefore(fx, document.body.firstChild);
    // 顶部滚动进度条
    if (!document.querySelector('.scroll-progress')) {
      const bar = document.createElement('div');
      bar.className = 'scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
    makeParticles(fx);
    if (!document.querySelector('.to-top')) {
      const t = document.createElement('button');
      t.className = 'to-top'; t.type = 'button'; t.setAttribute('aria-label', '回到顶部'); t.innerHTML = '↑';
      document.body.appendChild(t);
    }
  }

  /* ---------- 滚动入场：元素进入视口时淡入上浮（尊重系统"减少动态"） ---------- */
  const revealIO = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
    }
  }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' }) : null;
  function observeReveal(root) {
    if (!revealIO) return;
    (root || document).querySelectorAll('[data-reveal]:not(.in)').forEach((el) => revealIO.observe(el));
  }
  // 动态插入的内容（目的地卡片/榜单/结果等）自动纳入入场观察
  if (revealIO && 'MutationObserver' in window) {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;
          if (node.matches && node.matches('[data-reveal]:not(.in)')) revealIO.observe(node);
          if (node.querySelectorAll) node.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => revealIO.observe(el));
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 顶部滚动进度条 ---------- */
  function bindScrollProgress() {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ')';
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- 首页标题逐字浮现（保留 <br>，尊重减少动态） ---------- */
  function animateHeroTitles() {
    const els = document.querySelectorAll('.hero-title, .hd-title');
    if (!els.length) return;
    // 长辈模式 / 减少动态：不拆字。拆字后每个字是 opacity:0 + 动画填充，
    // 而长辈模式会全局禁用动画，结果整段标题不可见。
    if (state.elderly) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    els.forEach((el) => {
      if (el.querySelector('.ch')) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      let idx = 0;
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        // 中文按字拆分做逐字浮现；拉丁文按词拆分。
        // .ch 是 inline-block，若把英文也按字母拆开，浏览器只能在字母之间断行，
        // 会出现 "togeth / er" 这种单词被截断的排版（英文模式下首页标题实测过）。
        const tokens = [];
        let word = '';
        const flush = () => { if (word) { tokens.push({ t: 'w', v: word }); word = ''; } };
        for (const ch of node.nodeValue) {
          if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) {
            flush();
            tokens.push({ t: 'c', v: ch });
          } else if (/\s/.test(ch)) {
            flush();
            tokens.push({ t: 's', v: ch });
          } else {
            word += ch;
          }
        }
        flush();
        tokens.forEach((tok) => {
          if (tok.t === 's') { frag.appendChild(document.createTextNode(tok.v)); return; }
          const span = document.createElement('span');
          span.className = 'ch';
          span.textContent = tok.v;
          span.style.animationDelay = (idx * 0.028) + 's';
          frag.appendChild(span);
          idx++;
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  /* ---------- 背景漂浮粒子（动态感） ---------- */
  function makeParticles(wrap) {
    if (!wrap) return;
    const count = window.innerWidth > 900 ? 26 : 14;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'pdot';
      const size = (3 + Math.random() * 5).toFixed(1);
      p.style.width = size + 'px'; p.style.height = size + 'px';
      p.style.left = (Math.random() * 100).toFixed(1) + '%';
      p.style.animationDuration = (9 + Math.random() * 14).toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * 20).toFixed(1) + 's';
      p.style.opacity = (0.25 + Math.random() * 0.4).toFixed(2);
      frag.appendChild(p);
    }
    wrap.appendChild(frag);
  }

  /* ---------- 回到顶部按钮 ---------- */
  function bindToTop() {
    const btn = document.querySelector('.to-top');
    if (!btn) return;
    let ticking = false;
    const update = () => { btn.classList.toggle('show', (document.documentElement.scrollTop || document.body.scrollTop) > 420); ticking = false; };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }

  async function init() {
    injectBgFx();
    observeReveal();
    // 老浏览器没有 IntersectionObserver 时，直接显示所有入场元素
    if (!revealIO) document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
    bindScrollProgress();
    bindToTop();
    animateHeroTitles();
    // 关闭浏览器自动滚动恢复（返回键关闭弹窗时不跳回顶部）
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    ensureShell();
    ensureProfileEntry();
    applyElderly();
    adaptLegacyMobileNav();
    injectIconSprite();
    upgradeEmojiIcons();
    observeEmojiIcons();
    bindButtonMotion();
    navActive();
    bindNav();
    bindNavScroll();
    bindNavPrefetch();
    bindSettings();
    startPage();
  }

  /* ---------- 城市输入提示（各页面共用） ---------- */
  function normCity(s) { return String(s || '').trim().replace(/[省市]$/, ''); }
  /* 城市匹配：支持中文名、拼音/英文（如 pingxiang、Beijing），忽略大小写与空格连字符 */
  function cityKey(s) { return String(s || "").trim().toLowerCase().replace(/[\s\-_\.]+/g, ""); }
  function resolveCity(raw) {
    const k = cityKey(raw);
    if (!k) return null;
    const list = state.cities || [];
    return list.find((c) => normCity(c.name) === normCity(raw))
      || list.find((c) => cityKey(c.name) === k)
      || list.find((c) => c.py && cityKey(c.py) === k)
      || null;
  }
  function findCityInList(raw) { return resolveCity(raw); }
  function showFormErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; el.textContent = ''; }
  }
  function cityAutocomplete(inputId, sugId, errId, label) {
    const input = document.getElementById(inputId);
    const sug = document.getElementById(sugId);
    if (!input || !sug) return;
    let active = -1;
    function close() { sug.hidden = true; sug.innerHTML = ''; active = -1; }
    function render(v) {
      const vk = cityKey(v);
      const en = !!(window.i18n && window.i18n.lang === "en");
      const match = (c, mode) => {
        const nm = c.name, py = c.py || "";
        if (mode === "prefix") return nm.startsWith(v) || (py && py.startsWith(vk));
        return nm.includes(v) || (py && py.includes(vk));
      };
      const list = (state.cities || []).filter((c) => match(c, "prefix")).slice(0, 8);
      const items = list.length ? list : (state.cities || []).filter((c) => match(c, "any")).slice(0, 8);
      if (!items.length) { sug.hidden = true; sug.innerHTML = ''; active = -1; return; }
      // 英文模式：拼音与英文名相同则不重复显示（Beijing 后面不再跟 beijing），否则显示拼音
      const subOf = (c) => {
        if (!en) return c.province;
        const enName = window.i18n ? String(window.i18n.t(c.name) || '') : '';
        const norm = enName.toLowerCase().replace(/[\s\-_\.]+/g, '');
        return (c.py && c.py !== norm) ? c.py : '';
      };
      sug.innerHTML = items.map((c, i) => { const sub = subOf(c); return `<div class="ac-item${i === active ? ' active' : ''}" data-name="${esc(c.name)}"><span>${esc(c.name)}</span>${sub ? '<small>' + esc(sub) + '</small>' : ''}</div>`; }).join('');
      sug.hidden = false;
    }
    function highlight() { [...sug.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('active', i === active)); }
    input.addEventListener('input', () => {
      showFormErr(errId, '');
      const v = normCity(input.value);
      if (!v) { close(); return; }
      active = -1;
      render(v);
    });
    sug.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.ac-item');
      if (!item) return;
      e.preventDefault();
      input.value = item.dataset.name;
      showFormErr(errId, '');
      close();
    });
    input.addEventListener('keydown', (e) => {
      const items = [...sug.querySelectorAll('.ac-item')];
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = items[active]; if (it) { input.value = it.dataset.name; showFormErr(errId, ''); } close(); }
      else if (e.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(() => {
      close();
      const v = normCity(input.value);
      if (!v) showFormErr(errId, '请填写' + label);
      else if (!findCityInList(v)) showFormErr(errId, '未找到「' + input.value.trim() + '」，请从提示中选择');
      else showFormErr(errId, '');
    }, 200));
  }
  /** AI 请求负载：附带当前界面语言，服务端据此决定生成内容的语言 */
  function aiPayload(extra) {
    return Object.assign({}, state.ai, {
      clientId: state.clientId,
      lang: (window.i18n && window.i18n.lang) || 'zh'
    }, extra || {});
  }
  /* ---------- 结果区导出：保存图片 / 三等分导出 / 导出 Word ---------- */
  // 关键修复：html2canvas 会先克隆 DOM 再渲染，克隆体里的入场动画会重放
  // （.day-card 的 dayRise 起点是 opacity:0），导致逐日行程被截成一片空白。
  // 这里在克隆体里统一关掉动画/过渡，并把滚动入场元素强制显示。
  const CAPTURE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;}' +
    'html.js [data-reveal],html.js .reveal{opacity:1!important;transform:none!important;filter:none!important;}';
  function captureOptions() {
    return {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      onclone: (doc) => { const s = doc.createElement('style'); s.textContent = CAPTURE_CSS; doc.head.appendChild(s); }
    };
  }
  function saveBlob(href, filename) {
    const a = document.createElement('a');
    a.download = filename;
    a.href = href;
    a.click();
  }
  async function saveAsImage(elId, filename) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!window.html2canvas) { toast('当前浏览器暂不支持截图，请用「打印 / 存为 PDF」'); return; }
    try {
      const actions = el.querySelector('.result-actions');
      const prev = actions ? actions.style.display : '';
      if (actions) actions.style.display = 'none'; // 截图时先藏按钮
      const canvas = await window.html2canvas(el, captureOptions());
      if (actions) actions.style.display = prev;
      const a = document.createElement('a');
      a.download = filename || '家游汇.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('✅ 图片已保存');
    } catch (e) {
      toast('保存图片失败，请用「打印 / 存为 PDF」');
    }
  }
  /* 三等分拼图：整图只截一次，切成 3 段后横向并排合成 1 张（图变矮变宽，手机放大左右滑动看） */
  async function saveAsImageParts(elId, filename, parts) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!window.html2canvas) { toast('当前浏览器暂不支持截图，请用「打印 / 存为 PDF」'); return; }
    const n = Math.max(2, Number(parts) || 3);
    const actions = el.querySelector('.result-actions');
    const prev = actions ? actions.style.display : '';
    if (actions) actions.style.display = 'none';
    try {
      const src = await window.html2canvas(el, captureOptions());
      const sliceH = Math.ceil(src.height / n);
      const gap = Math.round(src.width * 0.03) + 16; // 列间距（随宽度自适应）
      const out = document.createElement('canvas');
      out.width = src.width * n + gap * (n - 1);
      out.height = sliceH;
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      for (let i = 0; i < n; i++) {
        const top = i * sliceH;
        const h = Math.min(sliceH, src.height - top);
        if (h <= 0) break;
        const x = i * (src.width + gap);
        ctx.drawImage(src, 0, top, src.width, h, x, 0, src.width, h);
        if (i) { // 列间细分隔线，方便看出三段边界
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(x - Math.round(gap / 2), 0, Math.max(2, Math.round(gap / 12)), out.height);
          ctx.fillStyle = '#ffffff';
        }
      }
      const base = String(filename || '家游汇.png').replace(/\.png$/i, '');
      saveBlob(out.toDataURL('image/png'), base + ((window.i18n && window.i18n.lang === 'en') ? '-3-column.png' : '-三等分拼图.png'));
      toast('✅ 已导出 1 张拼图（三列并排，放大后左右滑动看）');
    } catch (e) {
      toast('导出失败，请用「打印 / 存为 PDF」');
    } finally {
      if (actions) actions.style.display = prev;
    }
  }
  /* 导出 Word：生成真正的 .docx（OOXML），不再用 HTML 伪装成 .doc */
  function docxEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function docxPara(text, style) {
    const pPr = style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '';
    return '<w:p>' + pPr + '<w:r><w:t xml:space="preserve">' + docxEsc(text) + '</w:t></w:r></w:p>';
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    const chunks = [];
    const central = [];
    let offset = 0;
    files.forEach((file) => {
      const name = enc.encode(file.name);
      const data = enc.encode(file.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034B50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      chunks.push(local, data);
      const cen = new Uint8Array(46 + name.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014B50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cen.set(name, 46);
      central.push(cen);
      offset += local.length + data.length;
    });
    const centralSize = central.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob(chunks.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function saveAsWord(elId, filename) {
    const el = document.getElementById(elId);
    if (!el) return;
    const clone = el.cloneNode(true);
    const acts = clone.querySelector('.result-actions');
    if (acts) acts.remove();
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const titleSet = new Set([...clone.querySelectorAll('h3')].map((x) => norm(x.innerText || x.textContent)));
    const headingSet = new Set([...clone.querySelectorAll('h4')].map((x) => norm(x.innerText || x.textContent)));
    const bulletSet = new Set([...clone.querySelectorAll('li, .check-item')].map((x) => norm(x.innerText || x.textContent)));
    const lines = String(clone.innerText || clone.textContent || '').split(/\n+/).map(norm).filter(Boolean);
    const body = [];
    lines.forEach((line, i) => {
      const style = (i === 0 && titleSet.has(line)) ? 'Title' : (headingSet.has(line) ? 'Heading2' : '');
      body.push(docxPara(bulletSet.has(line) ? '• ' + line : line, style));
    });
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Microsoft YaHei" w:eastAsia="Microsoft YaHei" w:hAnsi="Microsoft YaHei"/><w:sz w:val="21"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="0F766E"/><w:sz w:val="30"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="0F766E"/><w:sz w:val="23"/></w:rPr></w:style>' +
      '</w:styles>';
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body.join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:document>';
    const blob = zipStore([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'word/document.xml', data: doc },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/_rels/document.xml.rels', data: docRels }
    ]);
    const url = URL.createObjectURL(blob);
    saveBlob(url, String(filename || '家游汇').replace(/\.[a-z]+$/i, '') + '.docx');
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('✅ Word (.docx) 已导出');
  }

  window.__jyhImgFallback = imgFallback;
  window.app = { state, api, esc, toast, $, $$, imgFallback, setBg, updateAiHints, pollJob, normCity, findCityInList, cityAutocomplete, saveAsImage, saveAsImageParts, saveAsWord, aiPayload, resolveCity, cityKey, loadTripHistory, recordTrip, clearTripHistory };

  document.addEventListener('DOMContentLoaded', init);
})();
