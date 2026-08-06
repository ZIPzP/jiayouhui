(() => {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  const state = {
    destinations: [],
    filter: '全部',
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
  function setBg(el, url) {
    if (url) el.style.backgroundImage = `url('${url}')`;
  }
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

  /* ---------------- 初始化 ---------------- */
  function fillMonths() {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date().getMonth() + 1;
    ['hf-month', 'pf-month'].forEach((id) => {
      const sel = $('#' + id);
      sel.innerHTML = labels.map((m, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${m}</option>`).join('');
    });
  }
  function populateDestSelects() {
    const opts = state.destinations.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}（${esc(d.province)}）</option>`).join('');
    $('#hf-dest').innerHTML = opts;
    $('#pf-dest').innerHTML = opts;
    if ($('#pl-dest')) $('#pl-dest').innerHTML = opts;
  }
  function renderFilters() {
    const list = ['全部', '亲子', '老人友好', '海滨', '自然', '美食', '历史', '古城', '都市', '休闲'];
    $('#tagFilters').innerHTML = list.map((t) => `<button class="chip ${t === state.filter ? 'active' : ''}" data-filter="${esc(t)}">${esc(t)}</button>`).join('');
  }
  function filtered() {
    if (state.filter === '全部') return state.destinations;
    return state.destinations.filter((d) => (d.tags || []).includes(state.filter));
  }
  function renderGrid() {
    const grid = $('#destGrid');
    const items = filtered();
    if (!items.length) { grid.innerHTML = '<p style="text-align:center;color:var(--ink-soft)">没有符合条件的目的地</p>'; return; }
    grid.innerHTML = items.map((d) => `
      <article class="dest-card" data-id="${esc(d.id)}" role="button" tabindex="0" aria-label="查看 ${esc(d.name)} 详情">
        <div class="dest-cover" style="background-color:${esc(d.accent || '#0f766e')};background-image:linear-gradient(135deg,${esc(d.accent || '#0f766e')},${esc(d.accent || '#115e59')})">
          <div class="dest-emoji">${esc(d.emoji || '🏡')}</div>
          <div class="dest-badges">
            <span class="badge best">${esc((d.bestSeasons || []).join('·') + ' 最佳')}</span>
          </div>
        </div>
        <div class="dest-body">
          <div class="dest-name">${esc(d.name)} <span style="font-size:.85rem;color:var(--ink-soft);font-weight:600">${esc(d.enName || '')}</span></div>
          <p class="dest-tagline">${esc(d.tagline || '')}</p>
          <div class="dest-meta">
            <span>🏷️ ${esc((d.tags || []).slice(0, 3).join(' · '))}</span>
            <span class="dest-more">查看详情 →</span>
          </div>
        </div>
      </article>`).join('');
    // 用真实照片作为卡片封面（失败时显示渐变底色）
    items.forEach((d) => {
      const card = grid.querySelector(`[data-id="${d.id}"]`);
      const cover = card.querySelector('.dest-cover');
      if (d.cover) {
        const probe = new Image();
        probe.onload = () => setBg(cover, d.cover);
        probe.src = d.cover;
      }
    });
  }
  function setHero() {
    // 首屏背景：随机使用一个目的地封面（本地真实照片）
    const d = state.destinations[Math.floor(Math.random() * state.destinations.length)];
    if (d && d.cover) {
      const probe = new Image();
      probe.onload = () => setBg($('#heroBg'), d.cover);
      probe.src = d.cover;
    }
  }

  /* ---------------- 详情弹窗 ---------------- */
  async function openDetail(id) {
    const modal = $('#detailModal');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#modalBody').innerHTML = '<p style="padding:40px;text-align:center">加载中…</p>';
    try {
      const { destination: d } = await api('/api/destinations/' + encodeURIComponent(id));
      renderDetail(d);
    } catch (e) {
      $('#modalBody').innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">加载失败：${esc(e.message)}</p>`;
    }
  }
  function closeDetail() {
    window.speechSynthesis.cancel();
    $('#detailModal').hidden = true;
    document.body.style.overflow = '';
  }
  function renderDetail(d) {
    const body = $('#modalBody');
    const tags = (d.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join('');
    const gallery = (d.gallery || []).map((g, i) => `<img src="${esc(g)}" alt="${esc(d.name)} 风光 ${i + 1}" onerror="window.__jyhImgFallback(this,'${esc(d.emoji || '🏡')}','${esc(d.name)}','${esc(d.accent || '#0f766e')}')" />`).join('');
    body.innerHTML = `
      <div class="detail-hero" style="background-color:${esc(d.accent || '#0f766e')}">
        <div class="detail-hero-overlay"></div>
        <h2>${esc(d.emoji || '')} ${esc(d.name)} <small style="font-size:1rem;opacity:.85">${esc(d.enName || '')}</small></h2>
      </div>
      <div class="detail-body">
        <div class="detail-tags">${tags}</div>
        <div class="detail-meta-grid">
          <div class="meta-cell"><div class="k">所在省份</div><div class="v">${esc(d.province || '-')}</div></div>
          <div class="meta-cell"><div class="k">最佳季节</div><div class="v">${esc((d.bestSeasons || []).join('、') || '-')}</div></div>
          <div class="meta-cell"><div class="k">建议天数</div><div class="v">${esc(d.suggestDays || '-')}</div></div>
          <div class="meta-cell"><div class="k">气候特点</div><div class="v">${esc(d.climate || '-')}</div></div>
        </div>
        <div class="elderly-note">
          <strong>👴 适老提示：</strong>${esc(d.elderlyFriendly || '')}
          <button class="read-aloud" data-read="${esc(d.elderlyFriendly || '')}" type="button">🔊 朗读</button>
        </div>
        <p class="detail-desc">${esc(d.description || '')}
          <button class="read-aloud" data-read="${esc(d.description || '')}" type="button">🔊 朗读介绍</button>
        </p>
        <h3>✨ 特色亮点</h3>
        ${(d.highlights || []).map((h) => `
          <div class="highlight-card">
            <img src="${esc(h.image)}" alt="${esc(h.title)}" onerror="window.__jyhImgFallback(this,'${esc(d.emoji || '🏡')}','${esc(h.title)}','${esc(d.accent || '#0f766e')}')" />
            <div>
              <h4>${esc(h.title)}</h4>
              <p>${esc(h.text)}</p>
            </div>
          </div>`).join('')}
        <div class="detail-actions">
          <button class="btn btn-primary" type="button" data-open-pack="${esc(d.id)}">🎒 生成这份目的地的出行清单</button>
          <button class="btn btn-ghost" type="button" data-guide="${esc(d.id)}">🤖 AI 生成攻略</button>
        </div>
        <div class="guide-box" id="guideBox"></div>
        <h3 style="margin-top:22px">📷 更多照片</h3>
        <div class="gallery-row">${gallery || '<p class="form-hint">暂无更多照片</p>'}</div>
      </div>`;
    // 真实照片加载
    const hero = body.querySelector('.detail-hero');
    if (d.cover) {
      const probe = new Image();
      probe.onload = () => setBg(hero, d.cover);
      probe.src = d.cover;
    }
  }
  async function generateGuide(id) {
    const box = $('#guideBox');
    const d = state.destinations.find((x) => x.id === id);
    box.innerHTML = '<p class="form-hint">🤖 AI 正在为' + esc(d ? d.name : '') + '撰写攻略，请稍候…</p>';
    try {
      const data = await api('/api/ai-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId: id, ...state.ai })
      });
      renderGuide(box, data);
    } catch (e) {
      box.innerHTML = `<p class="form-hint" style="color:var(--danger)">攻略生成失败：${esc(e.message)}</p>`;
    }
  }
  function renderGuide(box, data) {
    const sections = (data.sections || []).map((s) => `
      <div class="guide-section">
        <h4>${esc(s.heading)}</h4>
        <p>${esc(s.content)}</p>
      </div>`).join('');
    const tips = (data.tips || []).map((t) => `<li>${esc(t)}</li>`).join('');
    box.innerHTML = `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <h3 style="color:var(--primary-dark)">${esc(data.title || '旅行攻略')}</h3>
          <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 生成 · ' + esc(data.model || '') : '📋 内置攻略'}</span>
        </div>
        ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已使用内置攻略：${esc(data.aiError)}</p>` : ''}
        <p style="color:var(--ink-soft);margin-bottom:14px">${esc(data.summary || '')}</p>
        ${sections}
        <div class="tips-box"><strong>💡 实用提醒</strong><ul>${tips}</ul></div>
        <button class="read-aloud" data-read="${esc(data.title + '。' + (data.summary || '') + (data.sections || []).map(s => s.heading + '，' + s.content).join('。'))}" type="button">🔊 朗读攻略</button>
      </div>`;
  }

  /* ---------------- 打包清单 ---------------- */
  function formValues(prefix) {
    return {
      destinationId: $(`#${prefix}-dest`).value,
      month: Number($(`#${prefix}-month`).value),
      durationDays: Number($(`#${prefix}-duration`).value),
      elderly: Number($(`#${prefix}-elderly`).value) || 0,
      adults: Number($(`#${prefix}-adults`).value) || 0,
      children: Number($(`#${prefix}-children`).value) || 0,
      interests: $$('#interestChips input:checked').map((i) => i.value)
    };
  }
  async function generatePacking(vals) {
    const empty = $('#resultEmpty');
    const bodyEl = $('#resultBody');
    empty.hidden = true;
    bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">🤖 正在生成打包清单，请稍候…</p>';
    try {
      const data = await api('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...vals, ...state.ai })
      });
      renderResult(bodyEl, data, vals);
    } catch (e) {
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">生成失败：${esc(e.message)}</p>`;
    }
  }
  function renderResult(el, data, vals) {
    const dest = state.destinations.find((d) => d.id === vals.destinationId) || {};
    const groups = {};
    (data.items || []).forEach((it) => {
      const c = it.category || '其他';
      (groups[c] = groups[c] || []).push(it);
    });
    const groupHtml = Object.entries(groups).map(([cat, items]) => `
      <div class="check-group">
        <h4>${esc(cat)}</h4>
        ${items.map((it) => `
          <label class="check-item" data-name="${esc(it.name)}">
            <input type="checkbox" class="ck" ${isChecked(vals, it.name) ? 'checked' : ''} />
            <span>
              <span class="item-name">${esc(it.name)}</span>
              <span class="item-reason">${esc(it.reason || '')}</span>
            </span>
            <span class="prio prio-${it.priority || 1}">${it.priority === 3 ? '必带' : it.priority === 2 ? '建议' : '可选'}</span>
          </label>`).join('')}
      </div>`).join('');
    const tips = (data.tips || []).map((t) => `<li>${esc(t)}</li>`).join('');
    el.innerHTML = `
      <div class="result-head">
        <h3>🎒 ${esc(dest.name || '')} · ${esc(data.monthLabel || '')}出行清单</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 生成 · ' + esc(data.model || '') : '📋 内置规则引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置清单：${esc(data.aiError)}</p>` : ''}
      <div class="weather-box">🌤️ ${esc(data.weatherAdvice || '')}</div>
      ${groupHtml}
      <div class="tips-box"><strong>💡 出行贴士</strong><ul>${tips}</ul></div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print>🖨️ 打印清单</button>
        <button class="btn btn-ghost read-aloud" type="button" data-read="${esc(dest.name + '出行清单。' + (data.items || []).map(i => i.name + '，' + (i.reason || '')).join('。') + '。' + (data.tips || []).join('。'))}">🔊 朗读清单</button>
      </div>`;
    // 勾选状态持久化
    $$('.ck', el).forEach((ck) => {
      ck.addEventListener('change', () => {
        const key = checkedKey(vals);
        let arr = JSON.parse(localStorage.getItem(key) || '[]');
        const name = ck.closest('.check-item').dataset.name;
        if (ck.checked) { if (!arr.includes(name)) arr.push(name); }
        else arr = arr.filter((n) => n !== name);
        localStorage.setItem(key, JSON.stringify(arr));
        ck.closest('.check-item').classList.toggle('done', ck.checked);
      });
      ck.closest('.check-item').classList.toggle('done', ck.checked);
    });
  }
  function checkedKey(vals) {
    return `jyh_ck_${vals.destinationId}_${vals.month}`;
  }
  function isChecked(vals, name) {
    try {
      const arr = JSON.parse(localStorage.getItem(checkedKey(vals)) || '[]');
      return arr.includes(name);
    } catch { return false; }
  }
  function updateAiHint() {
    const el = $('#aiModeHint');
    if (!el) return;
    if (state.serverKey) el.textContent = '🔒 服务端已内置 Key（仅服务器持有，浏览器不保存）· ' + (state.ai.model || '默认模型');
    else if (state.ai.apiKey) el.textContent = '🤖 当前使用浏览器本地 Key：' + (state.ai.model || '默认') + '（可点「内置到服务器」改为服务端保存）';
    else el.textContent = '📋 演示模式（内置规则引擎）。配置 DeepSeek Key 后启用大模型。';
  }

  /* ---------------- 平台热度 ---------------- */
  async function loadHot() {
    const meta = $('#hotMeta');
    const list = $('#hotList');
    try {
      const data = await api('/api/hot-data');
      meta.textContent = `更新于 ${new Date(data.collectedAt).toLocaleString('zh-CN')} · 数据源：${(data.sources || []).filter((s) => s.ok).map((s) => s.label).join('、') || '无可用数据源'}`;
      list.innerHTML = (data.items || []).map((it) => `
        <div class="hot-item">
          <div class="hot-rank">${it.rank}</div>
          <div class="hot-main">
            <div class="hot-name">${esc(it.name)}</div>
            <div class="hot-reason">${esc(it.reason || '')}</div>
          </div>
          <div class="hot-heat">
            <div class="bar"><i style="width:${Math.min(100, it.heat || 0)}%"></i></div>
            <span class="num">热度 ${it.heat || 0}</span>
          </div>
          <span class="hot-trend ${String(it.trend || '').startsWith('-') ? 'down' : 'up'}">${esc(it.trend || '')}</span>
          <span class="hot-src">${esc(it.source || '综合')}</span>
        </div>`).join('') || '<p style="color:var(--ink-soft)">暂无热度数据</p>';
    } catch (e) {
      meta.textContent = '热度数据加载失败';
      list.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
    }
  }

  /* ---------------- AI 设置 ---------------- */
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
    updateAiHint();
    updatePlanHints();
    closeAiModal();
    toast(state.ai.apiKey ? '🤖 AI 设置已保存，开始使用大模型' : '已切换为演示模式（内置规则引擎）');
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    $('#elderlyToggle').addEventListener('click', toggleElderly);
    $('#aiSettingsBtn').addEventListener('click', openAiModal);
    $('#aiModalClose').addEventListener('click', closeAiModal);
    $('#ai-save').addEventListener('click', saveAi);
    $('#modalClose').addEventListener('click', closeDetail);
    $('#detailModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetail(); });

    $('#tagFilters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      $$('.chip', $('#tagFilters')).forEach((c) => c.classList.toggle('active', c.dataset.filter === state.filter));
      renderGrid();
    });

    $('#destGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.dest-card');
      if (card) openDetail(card.dataset.id);
    });
    $('#destGrid').addEventListener('keydown', (e) => {
      const card = e.target.closest('.dest-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(card.dataset.id); }
    });

    // 详情弹窗内的事件（委托到 modalBody）
    $('#modalBody').addEventListener('click', async (e) => {
      const packBtn = e.target.closest('[data-open-pack]');
      if (packBtn) {
        closeDetail();
        $('#pf-dest').value = packBtn.dataset.openPack;
        $('#packing').scrollIntoView({ behavior: 'smooth' });
        generatePacking(formValues('pf'));
        return;
      }
      const guideBtn = e.target.closest('[data-guide]');
      if (guideBtn) { generateGuide(guideBtn.dataset.guide); return; }
      const readBtn = e.target.closest('[data-read]');
      if (readBtn) { speak(readBtn.dataset.read); return; }
    });

    // 快速规划器 & 完整表单
    $('#hf-submit').addEventListener('click', () => {
      const v = formValues('hf');
      $('#pf-dest').value = v.destinationId;
      $('#pf-month').value = String(v.month);
      $('#pf-duration').value = String(v.durationDays);
      $('#pf-elderly').value = v.elderly;
      $('#pf-adults').value = v.adults;
      $('#pf-children').value = v.children;
      $('#packing').scrollIntoView({ behavior: 'smooth' });
      generatePacking(formValues('pf'));
    });
    $('#pf-submit').addEventListener('click', () => generatePacking(formValues('pf')));

    // 打印 & 朗读（结果区委托）
    $('#resultBody').addEventListener('click', (e) => {
      const p = e.target.closest('[data-print]');
      if (p) { window.print(); return; }
      const r = e.target.closest('[data-read]');
      if (r) { speak(r.dataset.read); return; }
    });
  }

  /* ---------------- 启动 ---------------- */
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
        startApp();
        toast('🔓 口令验证成功，欢迎回来');
      } catch (e) {
        const err = $('#authError');
        if (err) err.hidden = false;
        $('#authPasscode').value = '';
        $('#authPasscode').focus();
      }
    };
    $('#authSubmit').addEventListener('click', submit);
    $('#authPasscode').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
  async function startApp() {
    try {
      const data = await api('/api/destinations');
      state.destinations = data.destinations || [];
      populateDestSelects();
      renderFilters();
      renderGrid();
      setHero();
    } catch (e) {
      toast('加载目的地失败：' + e.message);
    }
    loadHot();
    bindEvents();
    bindPlanEvents();
    bindServerKey();
    refreshAiStatus();
  }
  async function init() {
    applyElderly();
    fillMonths();
    updateAiHint();
    bindAuth();
    try {
      const st = await api('/api/auth/status');
      if (st.enabled && !st.authed) { showAuthGate(); return; }
    } catch (e) { /* 状态接口异常则放行 */ }
    startApp();
  }

  // 供内联 onerror 使用（图片兜底）
  window.__jyhImgFallback = imgFallback;

  /* ---------------- 行程规划（AI 主理人） ---------------- */
  const PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
    moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' }
  };
  let chatHistory = [];

  function chipValue(groupSel) {
    const el = $(`#planForm [${groupSel}] .chip.active`);
    return el ? el.dataset.value : '';
  }
  function chipValues(groupSel) {
    return $$(`#planForm [${groupSel}] .chip.active`).map((c) => c.dataset.value);
  }
  function planFormValues() {
    return {
      destinationId: $('#pl-dest').value,
      origin: $('#pl-origin').value.trim(),
      startDate: $('#pl-start').value,
      endDate: $('#pl-end').value,
      days: Number($('#pl-days').value) || 3,
      transport: chipValue('data-single="pl-transport"'),
      elderly: Number($('#pl-elderly').value) || 0,
      adults: Number($('#pl-adults').value) || 0,
      children: Number($('#pl-children').value) || 0,
      dietary: chipValues('data-multi="pl-dietary"'),
      budget: chipValue('data-single="pl-budget"') || '舒适型',
      pace: chipValue('data-single="pl-pace"') || '标准',
      accommodation: chipValue('data-single="pl-stay"') || '',
      interests: chipValues('data-multi="pl-interests"'),
      notes: $('#pl-notes').value.trim()
    };
  }
  function bindPlanEvents() {
    // 选项 chips
    $('#planForm').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const singleGroup = chip.closest('[data-single]');
      if (singleGroup) {
        $$('.chip', singleGroup).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        return;
      }
      const multiGroup = chip.closest('[data-multi]');
      if (!multiGroup) return;
      chip.classList.toggle('active');
      if (multiGroup.dataset.multi === 'pl-dietary') {
        if (chip.dataset.value === '无特别忌口' && chip.classList.contains('active')) {
          $$('.chip', multiGroup).forEach((c) => { if (c !== chip) c.classList.remove('active'); });
        } else if (chip.dataset.value !== '无特别忌口') {
          const noneChip = $$('.chip', multiGroup).find((c) => c.dataset.value === '无特别忌口');
          if (noneChip) noneChip.classList.remove('active');
        }
      }
    });

    // 去返日期 -> 自动计算天数
    const syncDays = () => {
      const s = $('#pl-start').value, e = $('#pl-end').value;
      if (s && e && new Date(e) >= new Date(s)) {
        const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
        const sel = $('#pl-days');
        if (![...sel.options].some((o) => o.value === String(days))) {
          const opt = document.createElement('option');
          opt.value = String(days);
          opt.textContent = `${days} 天`;
          sel.appendChild(opt);
        }
        sel.value = String(days);
      }
    };
    $('#pl-start').addEventListener('change', syncDays);
    $('#pl-end').addEventListener('change', syncDays);

    // 生成行程
    $('#pl-submit').addEventListener('click', generatePlan);

    // 结果区：打印 / 朗读
    $('#planBody').addEventListener('click', (e) => {
      if (e.target.closest('[data-print-plan]')) { window.print(); return; }
      const r = e.target.closest('[data-read]');
      if (r) { speak(r.dataset.read); return; }
    });

    // AI 主理人问答
    $('#chatSend').addEventListener('click', sendChat);
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    // 一键预设
    $('#providerPresets').addEventListener('click', (e) => {
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

    updatePlanHints();
  }

  function updatePlanHints() {
    const ph = $('#planAiHint');
    if (ph) ph.textContent = state.serverKey ? '🔒 AI 主理人已接入（服务端内置 Key，仅服务器持有）' : (state.ai.apiKey ? '🤖 AI 主理人已接入（浏览器本地 Key：' + (state.ai.model || '已配置') + '）' : '📋 演示模式：未配置 AI Key，将使用内置规划引擎（点右上角 ⚙️ AI 设置 接入 DeepSeek）');
    const ct = $('#chatModeTag');
    if (ct) ct.textContent = state.serverKey ? '🔒 AI 模式' : (state.ai.apiKey ? 'AI 模式 · ' + (state.ai.model || '') : '演示模式');
  }

  async function generatePlan() {
    const vals = planFormValues();
    const empty = $('#planEmpty');
    const bodyEl = $('#planBody');
    empty.hidden = true;
    bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">🤖 AI 主理人正在为你规划行程，请稍候…</p>';
    try {
      const data = await api('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...vals, ...state.ai })
      });
      renderPlan(bodyEl, data, vals);
    } catch (e) {
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">生成失败：${esc(e.message)}</p>`;
    }
  }

  function renderPlan(el, data, vals) {
    const dest = state.destinations.find((d) => d.id === vals.destinationId) || {};
    const dayHtml = (data.days || []).map((d) => `
      <div class="day-card">
        <div class="day-head">
          <div class="day-num">D${d.day}</div>
          <span class="day-title">${esc(d.title)}</span>
          ${d.dateLabel ? `<span class="day-date">${esc(d.dateLabel)}</span>` : ''}
        </div>
        ${(d.schedule || []).map((s) => `
          <div class="schedule-item">
            <div class="schedule-time">${esc(s.time)}</div>
            <div>
              <div class="schedule-activity">${esc(s.activity)}</div>
              ${s.detail ? `<div class="schedule-detail">${esc(s.detail)}</div>` : ''}
            </div>
          </div>`).join('')}
        ${(d.meals || []).length ? `<div class="meals-row">${d.meals.map((m) => `<span class="meal-pill"><b>${esc(m.type)}</b> ${esc(m.recommend)}${m.note ? ' · ' + esc(m.note) : ''}</span>`).join('')}</div>` : ''}
        <div class="day-meta">
          ${d.transport ? `<span>🚗 ${esc(d.transport)}</span>` : ''}
          ${d.accommodation ? `<span>🏨 ${esc(d.accommodation)}</span>` : ''}
          ${d.costPerPerson ? `<span>💰 人均约 ${esc(String(d.costPerPerson))}</span>` : ''}
        </div>
      </div>`).join('');
    const tp = data.transportPlan || {};
    const bg = data.budget || {};
    el.innerHTML = `
      <div class="result-head">
        <h3>🗺️ ${esc(data.title || '行程规划')}</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 主理人生成 · ' + esc(data.model || '') : '📋 内置规划引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置方案：${esc(data.aiError)}</p>` : ''}
      ${data.summary ? `<p style="color:var(--ink-soft);margin-bottom:14px">${esc(data.summary)}</p>` : ''}
      <div class="transport-box"><h4>🚄 交通安排</h4>
        ${tp.outbound ? `<p><b>去程：</b>${esc(tp.outbound)}</p>` : ''}
        ${tp.inbound ? `<p><b>返程：</b>${esc(tp.inbound)}</p>` : ''}
        ${tp.local ? `<p><b>当地：</b>${esc(tp.local)}</p>` : ''}
      </div>
      <div class="budget-box"><h4>💰 费用估算（人均）</h4>
        ${bg.transport ? `<p>🚄 ${esc(bg.transport)}</p>` : ''}
        ${bg.accommodation ? `<p>🏨 ${esc(bg.accommodation)}</p>` : ''}
        ${bg.meals ? `<p>🍜 ${esc(bg.meals)}</p>` : ''}
        ${bg.tickets ? `<p>🎫 ${esc(bg.tickets)}</p>` : ''}
        ${bg.totalPerPerson ? `<p class="total">合计：${esc(bg.totalPerPerson)}</p>` : ''}
        ${bg.note ? `<p style="font-size:.85rem">${esc(bg.note)}</p>` : ''}
      </div>
      ${(data.dietaryNotes || []).length ? `<div class="dietary-box"><h4>🥢 忌食与用餐提醒</h4><ul>${data.dietaryNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
      ${dayHtml}
      ${(data.tips || []).length ? `<div class="tips-box"><strong>💡 出行提醒</strong><ul>${data.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print-plan>🖨️ 打印行程</button>
        <button class="btn btn-ghost read-aloud" type="button" data-read="${esc(data.title + '。' + (data.summary || '') + (data.days || []).map((d) => '第' + d.day + '天，' + (d.schedule || []).map((s) => s.time + s.activity).join('，')).join('。'))}">🔊 朗读行程</button>
      </div>`;
  }

  /* ---------------- AI 主理人问答 ---------------- */
  function addChatMsg(role, text) {
    const body = $('#chatBody');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  async function sendChat() {
    const input = $('#chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    addChatMsg('user', msg);
    const typing = addChatMsg('ai', '正在思考…');
    typing.classList.add('chat-typing');
    try {
      const data = await api('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatHistory, ...state.ai })
      });
      chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: data.reply });
      typing.classList.remove('chat-typing');
      typing.textContent = data.reply;
    } catch (e) {
      typing.classList.remove('chat-typing');
      typing.textContent = '出错了：' + e.message;
    }
  }
  /* ---------------- 服务端内置 Key（隐私模式） ---------------- */
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
  async function refreshAiStatus() {
    try {
      const h = await api('/api/health');
      state.serverKey = !!h.hasServerKey;
    } catch (e) { /* 忽略网络小问题 */ }
    updateAiHint();
    updatePlanHints();
    updateAiModal();
  }
  function bindServerKey() {
    $('#aiStoreServer').addEventListener('click', async () => {
      const k = $('#ai-key').value.trim();
      if (!k) { toast('请先在上方输入 API Key'); return; }
      try {
        await api('/api/ai-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: k }) });
        localStorage.removeItem('jyh_ai');
        state.ai = {};
        state.serverKey = true;
        updateAiHint(); updatePlanHints(); updateAiModal();
        toast('🔒 Key 已内置到服务器（仅本机），浏览器中的 Key 已清除');
      } catch (e) { toast('保存失败：' + e.message); }
    });
    $('#aiClearServer').addEventListener('click', async () => {
      try {
        await api('/api/ai-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: '' }) });
        state.serverKey = false;
        updateAiHint(); updatePlanHints(); updateAiModal();
        toast('已清除服务端 Key');
      } catch (e) { toast('清除失败：' + e.message); }
    });
  }
  // 确保语音引擎可用
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};

  document.addEventListener('DOMContentLoaded', init);
})();