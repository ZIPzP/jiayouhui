(() => {
  'use strict';
  window.pageInit = async function () {
    fillMonths();
    setHero();
    renderFeatured();
    bindQuick();
  };

  function fillMonths() {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date().getMonth() + 1;
    const sel = document.getElementById('hf-month');
    if (sel) sel.innerHTML = labels.map((m, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${m}</option>`).join('');
  }

  function setHero() {
    const ds = app.state.destinations;
    const d = ds[Math.floor(Math.random() * ds.length)];
    if (d && d.cover) {
      const probe = new Image();
      probe.onload = () => app.setBg(document.getElementById('heroBg'), d.cover);
      probe.src = d.cover;
    }
  }
  function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    grid.innerHTML = app.state.destinations.slice(0, 6).map((d) => `
      <a class="dest-card" href="/destinations.html?id=${app.esc(d.id)}">
        <div class="dest-cover" style="background-color:${app.esc(d.accent || '#0f766e')}">
          <div class="dest-emoji">${app.esc(d.emoji || '🏡')}</div>
          <div class="dest-badges"><span class="badge best">${app.esc((d.bestSeasons || []).join('·') + ' 最佳')}</span></div>
        </div>
        <div class="dest-body">
          <div class="dest-name">${app.esc(d.name)}</div>
          <p class="dest-tagline">${app.esc(d.tagline || '')}</p>
          <div class="dest-meta"><span>${app.esc((d.tags || []).slice(0, 3).join(' · '))}</span><span class="dest-more">查看详情 →</span></div>
        </div>
      </a>`).join('');
    app.state.destinations.slice(0, 6).forEach((d) => {
      const card = grid.querySelector(`a[href="/destinations.html?id=${d.id}"]`);
      const cover = card && card.querySelector('.dest-cover');
      if (cover && d.cover) { const probe = new Image(); probe.onload = () => app.setBg(cover, d.cover); probe.src = d.cover; }
    });
  }
  function bindQuick() {
    // 目的地：输入即提示 + 城市自查
    app.cityAutocomplete('hf-dest', 'hf-dest-sug', 'hf-dest-err', '目的地');
    const btn = document.getElementById('hf-submit');
    if (btn) btn.addEventListener('click', () => {
      const raw = document.getElementById('hf-dest').value.trim();
      const name = app.normCity(raw);
      const err = document.getElementById('hf-dest-err');
      if (!name) { if (err) { err.textContent = '请填写目的地城市'; err.hidden = false; } return; }
      if (!app.findCityInList(name)) { if (err) { err.textContent = '未找到「' + raw + '」，请从提示中选择'; err.hidden = false; } return; }
      if (err) err.hidden = true;
      const hit = app.state.destinations.find((d) => app.normCity(d.name) === name);
      const vals = {
        destinationId: hit ? hit.id : 'custom',
        month: document.getElementById('hf-month').value,
        durationDays: document.getElementById('hf-duration').value,
        elderly: document.getElementById('hf-elderly').value,
        adults: document.getElementById('hf-adults').value,
        children: document.getElementById('hf-children').value
      };
      if (!hit) vals.customDest = { name: raw, note: '' };
      sessionStorage.setItem('jyh_quick', JSON.stringify(vals));
      location.href = '/packing.html';
    });
  }
})();