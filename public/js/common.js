(() => {
  'use strict';

  // 动效钩子：JS 可用时挂 html.js，入场/滚动动画类只在此时生效（无 JS 时内容直出）
  document.documentElement.classList.add('js');

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    destinations: [],
    elderly: localStorage.getItem('jyh_elderly') === '1',
    ai: JSON.parse(localStorage.getItem('jyh_ai') || '{}'),
    serverKey: false,
    accessEnabled: false
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
    const token = localStorage.getItem('jyh_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && data.needAuth) showAuthGate();
    if (!r.ok) throw new Error(data.error || `请求失败（${r.status}）`);
    return data;
  }
  function imgFallback(img, emoji = '🏡', name = '', accent = '#0f766e') {
    if (!img) return;
    img.onerror = null;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${accent}'/><stop offset='1' stop-color='${accent}' stop-opacity='.6'/></linearGradient></defs><rect width='800' height='500' fill='url(#g)'/><text x='400' y='250' font-size='130' text-anchor='middle'>${emoji}</text><text x='400' y='370' font-size='52' fill='rgba(255,255,255,.95)' text-anchor='middle' font-family='PingFang SC, Microsoft YaHei, sans-serif'>${name}</text></svg>`;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function setBg(el, url) { if (url) el.style.backgroundImage = `url('${url}')`; }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音朗读'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.92;
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'));
    if (zh) u.voice = zh;
    window.speechSynthesis.speak(u);
  }

  /** 轮询后台任务，直到完成（AI 生成期间可放心离开页面） */
  async function pollJob(jobId, { interval = 2000, timeout = 240000, onDone, onError } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try {
        const j = await api('/api/job?id=' + encodeURIComponent(jobId));
        if (j.status === 'done') { onDone(j.result); return; }
        if (j.status === 'error') { onError(j.error || '生成失败'); return; }
      } catch (e) { /* 继续轮询 */ }
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
    toast(state.elderly ? '👴 长辈模式已开启：字体放大、对比增强、支持语音朗读' : '已退出长辈模式');
  }

  /* ---------------- 访问口令门禁 ---------------- */
  function showAuthGate() {
    const g = $('#authGate');
    if (!g) return;
    g.hidden = false;
    document.body.style.overflow = 'hidden';
    const input = $('#authPasscode');
    if (input) input.focus();
  }
  function hideAuthGate() {
    const g = $('#authGate');
    if (g) g.hidden = true;
    document.body.style.overflow = '';
    const err = $('#authError');
    if (err) err.hidden = true;
  }
  function bindAuth() {
    const submit = async () => {
      const code = $('#authPasscode').value.trim();
      if (!code) return;
      try {
        const r = await api('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: code })
        });
        localStorage.setItem('jyh_token', r.token);
        hideAuthGate();
        startPage();
        toast('🔓 口令验证成功，欢迎回来');
      } catch (e) {
        const err = $('#authError');
        if (err) err.hidden = false;
        $('#authPasscode').value = '';
        $('#authPasscode').focus();
      }
    };
    const btn = $('#authSubmit');
    if (btn) btn.addEventListener('click', submit);
    const inp = $('#authPasscode');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  /* ---------------- AI 设置（共享） ---------------- */
  const PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
  };

  function updateAiModal() {
    const st = $('#aiServerStatus');
    const keyGroup = $('#aiKeyGroup');
    if (state.serverKey) {
      if (st) st.hidden = false;
      if (keyGroup) keyGroup.hidden = true;
    } else {
      if (st) st.hidden = true;
      if (keyGroup) keyGroup.hidden = false;
    }
  }
  function updateAiHints() {
    const m = $('#aiModeHint');
    if (m) m.textContent = state.serverKey ? '🔒 服务端已内置 Key（仅服务器持有，浏览器不保存）· ' + (state.ai.model || '默认模型')
      : (state.ai.apiKey ? '🐱 当前使用浏览器本地 Key：' + (state.ai.model || '默认')
      : '📋 演示模式（内置规则引擎）。配置 DeepSeek Key 后启用大模型。');
    const ph = $('#planAiHint');
    if (ph) ph.textContent = state.serverKey ? '🔒 AI 主理人已接入（服务端内置 Key，仅服务器持有）'
      : (state.ai.apiKey ? '🐱 AI 主理人已接入（浏览器本地 Key：' + (state.ai.model || '已配置') + '）'
      : '📋 演示模式：未配置 AI Key，将使用内置规划引擎（点右上角 ⚙️ AI 设置 接入 DeepSeek）');
    const ct = $('#chatModeTag');
    if (ct) ct.textContent = state.serverKey ? '🔒 AI 模式' : (state.ai.apiKey ? 'AI 模式 · ' + (state.ai.model || '') : '演示模式');
  }

  async function refreshAiStatus() {
    try {
      const h = await api('/api/health');
      state.serverKey = !!h.hasServerKey;
      const st = await api('/api/auth/status');
      state.accessEnabled = !!st.enabled;
    } catch (e) { /* 忽略 */ }
    updateAiHints();
    updateAiModal();
  }

  function openAiModal() {
    $('#ai-key').value = state.ai.apiKey || '';
    $('#ai-base').value = state.ai.baseUrl || '';
    $('#ai-model').value = state.ai.model || '';
    $('#aiModal').hidden = false;
    document.body.style.overflow = 'hidden';
    updateAiModal();
  }
  function closeAiModal() {
    $('#aiModal').hidden = true;
    document.body.style.overflow = '';
  }
  function saveAi() {
    state.ai = {
      apiKey: $('#ai-key').value.trim(),
      baseUrl: $('#ai-base').value.trim(),
      model: $('#ai-model').value.trim()
    };
    localStorage.setItem('jyh_ai', JSON.stringify(state.ai));
    updateAiHints();
    closeAiModal();
    toast(state.ai.apiKey ? '🐱 AI 设置已保存，开始使用大模型' : '已切换为演示模式（内置规则引擎）');
  }

  function openMobilePreview() {
    const pv = $('#mobilePreview');
    if (!pv) return;
    const frame = $('#previewIframe');
    if (frame) frame.src = location.pathname === '/' ? '/' : location.pathname;
    pv.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeMobilePreview() {
    const pv = $('#mobilePreview');
    if (pv) pv.hidden = true;
    document.body.style.overflow = '';
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
    const mm = $('#menuMobile');
    if (mm) mm.addEventListener('click', () => { closeMenu(); openMobilePreview(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.settings-wrap')) closeMenu(); });
    // 手机预览
    const pc = $('#previewClose');
    if (pc) pc.addEventListener('click', closeMobilePreview);
    const pv = $('#mobilePreview');
    if (pv) pv.addEventListener('click', (e) => { if (e.target === pv) closeMobilePreview(); });
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
    if (!document.getElementById('authGate')) {
      html += `<div id="authGate" class="auth-gate" hidden>
        <div class="auth-card card">
          <div class="auth-logo">🏡 家游汇</div>
          <p class="auth-sub">家庭旅行推荐与攻略 · 请输入邀请码</p>
          <input id="authPasscode" type="password" class="input" placeholder="邀请码" autocomplete="off" />
          <button id="authSubmit" class="btn btn-primary btn-lg btn-block" type="button" style="margin-top:12px">进入</button>
          <p class="form-hint" id="authError" style="color:var(--danger);text-align:center" hidden>口令错误，请重试</p>
        </div>
      </div>`;
    }
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
          <div id="aiServerStatus" class="ai-server-status" hidden>🔒 服务端已内置 Key（仅服务器持有，浏览器不保存）</div>
          <div class="form-group" id="aiKeyGroup">
            <label class="form-label" for="ai-key">API Key</label>
            <input id="ai-key" type="password" class="input" placeholder="sk-..." autocomplete="off" />
          </div>
          <div style="height:10px"></div>
          <div class="form-group">
            <label class="form-label" for="ai-base">接口地址 Base URL</label>
            <input id="ai-base" type="text" class="input" placeholder="https://api.deepseek.com/v1" />
          </div>
          <div class="form-group">
            <label class="form-label" for="ai-model">模型</label>
            <input id="ai-model" type="text" class="input" placeholder="deepseek-chat" />
          </div>
          <button id="ai-save" class="btn btn-primary btn-lg btn-block" type="button">保存设置</button>
        </div>
      </div>`;
    }
    if (!document.getElementById('toast')) {
      html += '<div id="toast" class="toast" hidden></div>';
    }
    if (!document.getElementById('mobilePreview')) {
      html += `<div class="preview-backdrop" id="mobilePreview" hidden>
        <div class="preview-frame">
          <div class="preview-bar"><span>📱 手机预览 · 390px</span><button id="previewClose" type="button" class="btn btn-ghost" style="padding:6px 12px">✕ 关闭</button></div>
          <iframe id="previewIframe" src="/" title="手机预览"></iframe>
        </div>
      </div>`;
    }
    if (html) document.body.insertAdjacentHTML('beforeend', html);
    // 导航栏：把长辈模式 / AI设置 / 手机预览 / 关于 收进「⚙️ 设置」菜单
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
          <button id="menuMobile" type="button">📱 手机预览</button>
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
          ['/hot.html', 'hot', '平台热度'], ['/draw.html', 'draw', '🎲 抽取']
        ].map(([href, k, label]) => '<a href="' + href + '" data-nav="' + k + '">' + label + '</a>').join('');
        inner.insertBefore(inlineNav, actions);
      }
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
    const map = { 'index.html': 'home', 'destinations.html': 'destinations', 'plan.html': 'plan', 'packing.html': 'packing', 'hot.html': 'hot', 'draw.html': 'draw', 'about.html': 'about' };
    const key = map[p] || 'home';
    $$('#navLinks a, .nav-links-inline a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
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

  /* ---------------- 启动 ---------------- */
  async function startPage() {
    refreshAiStatus();
    // 统一先加载目的地数据（各页面共享）
    try {
      if (!state.destinations.length) {
        const data = await api('/api/destinations');
        state.destinations = data.destinations || [];
      }
    } catch (e) { /* 由页面自行处理 */ }
    if (typeof window.pageInit === 'function') {
      try { await window.pageInit(); } catch (e) { console.error('[pageInit]', e); }
    }
  }
  async function init() {
    // 关闭浏览器自动滚动恢复（返回键关闭弹窗时不跳回顶部）
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    ensureShell();
    applyElderly();
    navActive();
    bindNav();
    bindNavScroll();
    bindSettings();
    bindAuth();
    try {
      const st = await api('/api/auth/status');
      if (st.enabled && !st.authed) { showAuthGate(); return; }
    } catch (e) { /* 状态接口异常则放行 */ }
    startPage();
  }

  /* ---------- 城市输入提示（各页面共用） ---------- */
  function normCity(s) { return String(s || '').trim().replace(/[省市]$/, ''); }
  function findCityInList(raw) {
    const n = normCity(raw);
    if (!n) return null;
    return (state.cities || []).find((c) => normCity(c.name) === n) || null;
  }
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
      const list = (state.cities || []).filter((c) => c.name.startsWith(v)).slice(0, 8);
      const items = list.length ? list : (state.cities || []).filter((c) => c.name.includes(v)).slice(0, 8);
      if (!items.length) { sug.hidden = true; sug.innerHTML = ''; active = -1; return; }
      sug.innerHTML = items.map((c, i) => `<div class="ac-item${i === active ? ' active' : ''}" data-name="${esc(c.name)}"><span>${esc(c.name)}</span><small>${esc(c.province)}</small></div>`).join('');
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
  /* ---------- 保存为图片（结果区截图，html2canvas） ---------- */
  async function saveAsImage(elId, filename) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!window.html2canvas) { toast('当前浏览器暂不支持截图，请用「打印 / 存为 PDF」'); return; }
    try {
      const actions = el.querySelector('.result-actions');
      const prev = actions ? actions.style.display : '';
      if (actions) actions.style.display = 'none'; // 截图时先藏按钮
      const canvas = await window.html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
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
  window.__jyhImgFallback = imgFallback;
  window.app = { state, api, esc, toast, speak, $, $$, imgFallback, setBg, updateAiHints, pollJob, normCity, findCityInList, cityAutocomplete, saveAsImage };
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};

  document.addEventListener('DOMContentLoaded', init);
})();
