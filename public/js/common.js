(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    destinations: [],
    elderly: localStorage.getItem('jyh_elderly') === '1',
    ai: JSON.parse(localStorage.getItem('jyh_ai') || '{}'),
    serverKey: false
  };

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

  /* ---------------- 长辈模式 ---------------- */
  function applyElderly() {
    document.documentElement.classList.toggle('elderly', state.elderly);
    const btn = $('#elderlyToggle');
    if (btn) btn.setAttribute('aria-pressed', state.elderly ? 'true' : 'false');
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
    if (!st) return;
    const keyGroup = $('#aiKeyGroup');
    const storeBtn = $('#aiStoreServer');
    const clearBtn = $('#aiClearServer');
    if (state.serverKey) {
      st.hidden = false;
      if (keyGroup) keyGroup.hidden = true;
      if (storeBtn) storeBtn.hidden = true;
      if (clearBtn) clearBtn.hidden = false;
    } else {
      st.hidden = true;
      if (keyGroup) keyGroup.hidden = false;
      if (storeBtn) storeBtn.hidden = false;
      if (clearBtn) clearBtn.hidden = true;
    }
  }

  function updateAiHints() {
    const m = $('#aiModeHint');
    if (m) m.textContent = state.serverKey ? '🔒 服务端已内置 Key（仅服务器持有，浏览器不保存）· ' + (state.ai.model || '默认模型')
      : (state.ai.apiKey ? '🤖 当前使用浏览器本地 Key：' + (state.ai.model || '默认') + '（可点「内置到服务器」改为服务端保存）'
      : '📋 演示模式（内置规则引擎）。配置 DeepSeek Key 后启用大模型。');
    const ph = $('#planAiHint');
    if (ph) ph.textContent = state.serverKey ? '🔒 AI 主理人已接入（服务端内置 Key，仅服务器持有）'
      : (state.ai.apiKey ? '🤖 AI 主理人已接入（浏览器本地 Key：' + (state.ai.model || '已配置') + '）'
      : '📋 演示模式：未配置 AI Key，将使用内置规划引擎（点右上角 ⚙️ AI 设置 接入 DeepSeek）');
    const ct = $('#chatModeTag');
    if (ct) ct.textContent = state.serverKey ? '🔒 AI 模式' : (state.ai.apiKey ? 'AI 模式 · ' + (state.ai.model || '') : '演示模式');
  }

  async function refreshAiStatus() {
    try {
      const h = await api('/api/health');
      state.serverKey = !!h.hasServerKey;
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
    toast(state.ai.apiKey ? '🤖 AI 设置已保存，开始使用大模型' : '已切换为演示模式（内置规则引擎）');
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
    const store = $('#aiStoreServer');
    if (store) store.addEventListener('click', async () => {
      const k = $('#ai-key').value.trim();
      if (!k) { toast('请先在上方输入 API Key'); return; }
      try {
        await api('/api/ai-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: k }) });
        localStorage.removeItem('jyh_ai');
        state.ai = {};
        state.serverKey = true;
        updateAiHints(); updateAiModal();
        toast('🔒 Key 已内置到服务器（仅本机），浏览器中的 Key 已清除');
      } catch (e) { toast('保存失败：' + e.message); }
    });
    const clear = $('#aiClearServer');
    if (clear) clear.addEventListener('click', async () => {
      try {
        await api('/api/ai-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: '' }) });
        state.serverKey = false;
        updateAiHints(); updateAiModal();
        toast('已清除服务端 Key');
      } catch (e) { toast('清除失败：' + e.message); }
    });
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
          <p class="auth-sub">家庭旅行推荐与攻略 · 请输入访问口令</p>
          <input id="authPasscode" type="password" class="input" placeholder="访问口令" autocomplete="off" />
          <button id="authSubmit" class="btn btn-primary btn-lg btn-block" type="button" style="margin-top:12px">进入</button>
          <p class="form-hint" id="authError" style="color:var(--danger);text-align:center" hidden>口令错误，请重试</p>
        </div>
      </div>`;
    }
    if (!document.getElementById('aiModal')) {
      html += `<div class="modal-backdrop" id="aiModal" hidden>
        <div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="AI 设置">
          <button class="modal-close" id="aiModalClose" type="button" aria-label="关闭">✕</button>
          <h3>🤖 AI 大模型设置</h3>
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
          <button id="aiStoreServer" class="btn btn-ghost btn-block" type="button">🔒 内置到服务器（仅本机保存，浏览器不留 Key）</button>
          <button id="aiClearServer" class="btn btn-ghost btn-block" type="button" hidden>🗑️ 清除服务端 Key</button>
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
    if (html) document.body.insertAdjacentHTML('beforeend', html);
  }

  /* ---------------- 导航高亮 ---------------- */
  function navActive() {
    const p = location.pathname.split('/').pop() || 'index.html';
    const map = { 'index.html': 'home', 'destinations.html': 'destinations', 'plan.html': 'plan', 'packing.html': 'packing', 'hot.html': 'hot', 'about.html': 'about' };
    const key = map[p] || 'home';
    $$('#navLinks a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
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
    ensureShell();
    applyElderly();
    navActive();
    bindSettings();
    bindAuth();
    try {
      const st = await api('/api/auth/status');
      if (st.enabled && !st.authed) { showAuthGate(); return; }
    } catch (e) { /* 状态接口异常则放行 */ }
    startPage();
  }

  window.__jyhImgFallback = imgFallback;
  window.app = { state, api, esc, toast, speak, $, $$, imgFallback, setBg, updateAiHints };
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};

  document.addEventListener('DOMContentLoaded', init);
})();