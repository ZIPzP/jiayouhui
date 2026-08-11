(() => {
  'use strict';
  window.pageInit = async function () {
    fillMonths();
    setHero();
    initHeroSlide();
    renderFeatured();
    bindQuick();
  };
  /* 电脑端 Hero 风景轮播：43城几百张照片随机，5秒一换，双图层交叉淡入淡出（提前预载，切换更顺滑） */
  function initHeroSlide() {
    const imgs = [document.getElementById('heroSlide'), document.getElementById('heroSlide2')];
    if (!imgs[0] || !imgs[1]) return;
    if (window.innerWidth <= 900) return;
    const seen = new Set();
    // 内置兜底风景图（保证首图确定存在、立即可用）
    const fallback = ['/images/beihai/cover.jpg', '/images/shanghai/cover.jpg', '/images/sanya/cover.jpg', '/images/hangzhou/cover.jpg', '/images/guilin/cover.jpg', '/images/lijiang/cover.jpg'];
    const urls = [];
    fallback.forEach((u) => { if (!seen.has(u)) { seen.add(u); urls.push(u); } });
    (app.state.destinations || []).forEach((d) => {
      const list = [d.cover].concat(d.gallery || []).concat((d.highlights || []).map((h) => h.image));
      list.forEach((u) => { if (u && !seen.has(u)) { seen.add(u); urls.push(u); } });
    });
    if (urls.length < 2) return;
    // 随机洗牌：兜底组（前6张确定可用）与其余风景图分别打乱，保证首图每次不同且立即可用
    const fbLen = Math.min(6, urls.length);
    for (let i = fbLen - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = urls[i]; urls[i] = urls[j]; urls[j] = t; }
    for (let i = urls.length - 1; i > fbLen; i--) { const j = fbLen + Math.floor(Math.random() * (i - fbLen + 1)); const t = urls[i]; urls[i] = urls[j]; urls[j] = t; }
    const cache = {};
    function preload(url) { if (!cache[url]) { const p = new Image(); p.src = url; cache[url] = p; } }
    let idx = 0, cur = 0;
    imgs[0].src = urls[0]; imgs[0].classList.add('active'); imgs[1].classList.remove('active');
    imgs[0].onerror = () => { idx = (idx + 1) % urls.length; imgs[0].src = urls[idx]; }; // 首图失败自动换下一张
    preload(urls[1]); preload(urls[2 % urls.length]);
    function swap() {
      idx = (idx + 1) % urls.length;
      const nextUrl = urls[idx];
      preload(urls[(idx + 1) % urls.length]); // 提前预载下一张
      const shown = imgs[cur], hidden = imgs[1 - cur];
      hidden.src = nextUrl;
      let done = false;
      const fade = () => { if (done) return; done = true; shown.classList.remove('active'); hidden.classList.add('active'); cur = 1 - cur; };
      if (hidden.complete && hidden.naturalWidth > 0) { fade(); }
      else {
        hidden.onload = fade;
        hidden.onerror = () => { idx = (idx + 1) % urls.length; swap(); }; // 加载失败就跳过
        setTimeout(fade, 1600); // 兜底：1.6s 内没加载也切换，避免卡住
      }
    }
    setInterval(swap, 5000);
  }

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
    const btn = document.getElementById('hf-submit');
    if (btn) btn.addEventListener('click', () => {
      const raw = document.getElementById('hf-dest').value.trim();
      const name = app.normCity(raw);
      if (!name) { app.toast('请先填写目的地城市'); return; }
      // 城市不拦：直接交给出行清单，没找到由 AI 在生成时提示
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
