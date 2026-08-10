(() => {
  'use strict';
  const state = { filter: '全部', destId: null, visible: 12 };
  window.pageInit = async function () {
    renderFilters();
    renderGrid();
    bindEvents();
    // 支持 ?id=xxx 直达详情
    const q = new URLSearchParams(location.search).get('id');
    if (q && window.openDestDetail) window.openDestDetail(q);
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
  /* 封面懒加载：滚动到卡片附近才加载图片 */
  const coverLoader = (() => {
    let io = null;
    function load(cover) {
      const u = cover.dataset.cover;
      if (!u) return;
      const probe = new Image();
      probe.onload = () => app.setBg(cover, u);
      probe.src = u;
    }
    return {
      observe(cover, url) {
        cover.dataset.cover = url;
        if (!('IntersectionObserver' in window)) { load(cover); return; }
        if (!io) {
          io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
              if (en.isIntersecting) { load(en.target); io.unobserve(en.target); }
            });
          }, { rootMargin: '300px' });
        }
        io.observe(cover);
      }
    };
  })();
  function renderGrid() {
    const grid = document.getElementById('destGrid');
    if (!grid) return;
    const items = filtered();
    if (!items.length) { grid.innerHTML = '<p style="text-align:center;color:var(--ink-soft)">没有符合条件的目的地</p>'; return; }
    const shown = items.slice(0, state.visible);
    const wrap = document.getElementById('moreWrap');
    if (wrap) wrap.innerHTML = items.length > state.visible
      ? `<button id="moreBtn" class="btn btn-ghost" type="button">查看更多目的地（还有 ${items.length - state.visible} 个）</button>`
      : '';
    grid.innerHTML = shown.map((d) => `
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
    shown.forEach((d) => {
      const card = grid.querySelector(`[data-id="${d.id}"]`);
      const cover = card && card.querySelector('.dest-cover');
      if (cover && d.cover) coverLoader.observe(cover, d.cover);
    });
  }
  function bindEvents() {
    const grid = document.getElementById('destGrid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.dest-card');
      if (card && window.openDestDetail) window.openDestDetail(card.dataset.id);
    });
    grid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.dest-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openDestDetail(card.dataset.id); }
    });
    const wrap = document.getElementById('moreWrap');
    if (wrap) wrap.addEventListener('click', (e) => { if (e.target.closest('#moreBtn')) { state.visible += 12; renderGrid(); } });
  }
})();
