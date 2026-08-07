(() => {
  'use strict';
  window.pageInit = async function () {
    fillMonths();
    setHero();
    renderFeatured();
    fillDest();
    bindQuick();
  };

  function fillMonths() {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date().getMonth() + 1;
    const sel = document.getElementById('hf-month');
    if (sel) sel.innerHTML = labels.map((m, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${m}</option>`).join('');
  }
  function fillDest() {
    const opts = app.state.destinations.map((d) => `<option value="${app.esc(d.id)}">${app.esc(d.name)}（${app.esc(d.province)}）</option>`).join('');
    document.getElementById('hf-dest').innerHTML = opts + '<option value="__custom__">✍️ 自定义目的地（自己输入城市）</option>';
    document.getElementById('hf-dest').addEventListener('change', () => {
      const show = document.getElementById('hf-dest').value === '__custom__';
      document.getElementById('hf-custom').hidden = !show;
      if (show) document.getElementById('hf-custom').focus();
    });
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
    const btn = document.getElementById('hf-submit');
    if (btn) btn.addEventListener('click', () => {
      const dest = document.getElementById('hf-dest').value;
      const vals = {
        destinationId: dest === '__custom__' ? 'custom' : dest,
        month: document.getElementById('hf-month').value,
        durationDays: document.getElementById('hf-duration').value,
        elderly: document.getElementById('hf-elderly').value,
        adults: document.getElementById('hf-adults').value,
        children: document.getElementById('hf-children').value
      };
      if (dest === '__custom__') {
        vals.customDest = { name: document.getElementById('hf-custom').value.trim(), note: '' };
      }
      sessionStorage.setItem('jyh_quick', JSON.stringify(vals));
      location.href = '/packing.html';
    });
  }
})();