(() => {
  'use strict';
  const state = { filter: '全部', destId: null };
  window.pageInit = async function () {
    renderFilters();
    renderGrid();
    bindEvents();
    // 支持 ?id=xxx 直达详情
    const q = new URLSearchParams(location.search).get('id');
    if (q) openDetail(q);
  };

  function renderFilters() {
    const box = document.getElementById('tagFilters');
    if (!box) return;
    const list = ['全部', '亲子', '老人友好', '海滨', '自然', '美食', '历史', '古城', '都市', '休闲'];
    box.innerHTML = list.map((t) => `<button class="chip ${t === state.filter ? 'active' : ''}" data-filter="${app.esc(t)}">${app.esc(t)}</button>`).join('');
    box.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      [...box.querySelectorAll('.chip')].forEach((c) => c.classList.toggle('active', c.dataset.filter === state.filter));
      renderGrid();
    });
  }
  function filtered() {
    if (state.filter === '全部') return app.state.destinations;
    return app.state.destinations.filter((d) => (d.tags || []).includes(state.filter));
  }
  function renderGrid() {
    const grid = document.getElementById('destGrid');
    if (!grid) return;
    const items = filtered();
    if (!items.length) { grid.innerHTML = '<p style="text-align:center;color:var(--ink-soft)">没有符合条件的目的地</p>'; return; }
    grid.innerHTML = items.map((d) => `
      <article class="dest-card" data-id="${app.esc(d.id)}" role="button" tabindex="0" aria-label="查看 ${app.esc(d.name)} 详情">
        <div class="dest-cover" style="background-color:${app.esc(d.accent || '#0f766e')}">
          <div class="dest-emoji">${app.esc(d.emoji || '🏡')}</div>
          <div class="dest-badges"><span class="badge best">${app.esc((d.bestSeasons || []).join('·') + ' 最佳')}</span></div>
        </div>
        <div class="dest-body">
          <div class="dest-name">${app.esc(d.name)}</div>
          <p class="dest-tagline">${app.esc(d.tagline || '')}</p>
          <div class="dest-meta"><span>${app.esc((d.tags || []).slice(0, 3).join(' · '))}</span><span class="dest-more">查看详情 →</span></div>
        </div>
      </article>`).join('');
    items.forEach((d) => {
      const card = grid.querySelector(`[data-id="${d.id}"]`);
      const cover = card && card.querySelector('.dest-cover');
      if (cover && d.cover) { const probe = new Image(); probe.onload = () => app.setBg(cover, d.cover); probe.src = d.cover; }
    });
  }
  function bindEvents() {
    const grid = document.getElementById('destGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.dest-card');
      if (card) openDetail(card.dataset.id);
    });
    grid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.dest-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(card.dataset.id); }
    });
    const close = document.getElementById('modalClose');
    if (close) close.addEventListener('click', closeDetail);
    const modal = document.getElementById('detailModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetail(); });
    const body = document.getElementById('modalBody');
    if (body) body.addEventListener('click', async (e) => {
      const guideBtn = e.target.closest('[data-guide]');
      if (guideBtn) { generateGuide(guideBtn.dataset.guide); return; }
      const readBtn = e.target.closest('[data-read]');
      if (readBtn) { app.speak(readBtn.dataset.read); return; }
      const planBtn = e.target.closest('[data-open-pack]');
      if (planBtn) {
        closeDetail();
        sessionStorage.setItem('jyh_quick', JSON.stringify({ destinationId: planBtn.dataset.openPack }));
        location.href = '/packing.html';
      }
    });
  }

  async function openDetail(id) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;
    state.destId = id;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const body = document.getElementById('modalBody');
    body.innerHTML = '<p style="padding:40px;text-align:center">加载中…</p>';
    try {
      const { destination: d } = await app.api('/api/destinations/' + encodeURIComponent(id));
      renderDetail(d);
    } catch (e) {
      body.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">加载失败：${app.esc(e.message)}</p>`;
    }
  }
  function closeDetail() {
    window.speechSynthesis.cancel();
    const modal = document.getElementById('detailModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }
  function renderDetail(d) {
    const body = document.getElementById('modalBody');
    const tags = (d.tags || []).map((t) => `<span class="badge">${app.esc(t)}</span>`).join('');
    const gallery = (d.gallery || []).map((g, i) => `<img src="${app.esc(g)}" alt="${app.esc(d.name)} 风光 ${i + 1}" onerror="window.__jyhImgFallback(this,'${app.esc(d.emoji || '🏡')}','${app.esc(d.name)}','${app.esc(d.accent || '#0f766e')}')" />`).join('');
    body.innerHTML = `
      <div class="detail-hero" style="background-color:${app.esc(d.accent || '#0f766e')}">
        <div class="detail-hero-overlay"></div>
        <h2>${app.esc(d.emoji || '')} ${app.esc(d.name)} <small style="font-size:1rem;opacity:.85">${app.esc(d.enName || '')}</small></h2>
      </div>
      <div class="detail-body">
        <div class="detail-tags">${tags}</div>
        <div class="detail-meta-grid">
          <div class="meta-cell"><div class="k">所在省份</div><div class="v">${app.esc(d.province || '-')}</div></div>
          <div class="meta-cell"><div class="k">最佳季节</div><div class="v">${app.esc((d.bestSeasons || []).join('、') || '-')}</div></div>
          <div class="meta-cell"><div class="k">建议天数</div><div class="v">${app.esc(d.suggestDays || '-')}</div></div>
          <div class="meta-cell"><div class="k">气候特点</div><div class="v">${app.esc(d.climate || '-')}</div></div>
        </div>
        <div class="elderly-note">
          <strong>👴 适老提示：</strong>${app.esc(d.elderlyFriendly || '')}
          <button class="read-aloud" data-read="${app.esc(d.elderlyFriendly || '')}" type="button">🔊 朗读</button>
        </div>
        <p class="detail-desc">${app.esc(d.description || '')}
          <button class="read-aloud" data-read="${app.esc(d.description || '')}" type="button">🔊 朗读介绍</button>
        </p>
        <h3>✨ 特色亮点</h3>
        ${(d.highlights || []).map((h) => `
          <div class="highlight-card">
            <img src="${app.esc(h.image)}" alt="${app.esc(h.title)}" onerror="window.__jyhImgFallback(this,'${app.esc(d.emoji || '🏡')}','${app.esc(h.title)}','${app.esc(d.accent || '#0f766e')}')" />
            <div><h4>${app.esc(h.title)}</h4><p>${app.esc(h.text)}</p></div>
          </div>`).join('')}
        <div class="detail-actions">
          <button class="btn btn-primary" type="button" data-open-pack="${app.esc(d.id)}">🎒 生成这份目的地的出行清单</button>
          <button class="btn btn-ghost" type="button" data-guide="${app.esc(d.id)}">🤖 AI 生成攻略</button>
        </div>
        <div class="guide-box" id="guideBox"></div>
        <h3 style="margin-top:22px">📷 更多照片</h3>
        <div class="gallery-row">${gallery || '<p class="form-hint">暂无更多照片</p>'}</div>
      </div>`;
    const hero = body.querySelector('.detail-hero');
    if (d.cover) { const probe = new Image(); probe.onload = () => app.setBg(hero, d.cover); probe.src = d.cover; }
  }

  async function generateGuide(id) {
    const box = document.getElementById('guideBox');
    const d = app.state.destinations.find((x) => x.id === id);
    if (!box) return;
    box.innerHTML = '<p class="form-hint">🤖 AI 正在为' + app.esc(d ? d.name : '') + '撰写攻略，请稍候…</p>';
    try {
      const data = await app.api('/api/ai-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId: id, ...app.state.ai })
      });
      renderGuide(box, data);
    } catch (e) {
      box.innerHTML = `<p class="form-hint" style="color:var(--danger)">攻略生成失败：${app.esc(e.message)}</p>`;
    }
  }
  function renderGuide(box, data) {
    const sections = (data.sections || []).map((s) => `
      <div class="guide-section"><h4>${app.esc(s.heading)}</h4><p>${app.esc(s.content)}</p></div>`).join('');
    const tips = (data.tips || []).map((t) => `<li>${app.esc(t)}</li>`).join('');
    box.innerHTML = `
      <div class="card" style="padding:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
          <h3 style="color:var(--primary-dark)">${app.esc(data.title || '旅行攻略')}</h3>
          <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 生成 · ' + app.esc(data.model || '') : '📋 内置攻略'}</span>
        </div>
        ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已使用内置攻略：${app.esc(data.aiError)}</p>` : ''}
        <p style="color:var(--ink-soft);margin-bottom:14px">${app.esc(data.summary || '')}</p>
        ${sections}
        <div class="tips-box"><strong>💡 实用提醒</strong><ul>${tips}</ul></div>
        <button class="read-aloud" data-read="${app.esc(data.title + '。' + (data.summary || '') + (data.sections || []).map(s => s.heading + '，' + s.content).join('。'))}" type="button">🔊 朗读攻略</button>
      </div>`;
  }
})();