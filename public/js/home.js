(() => {
  'use strict';
  window.pageInit = async function () {
    fillMonths();
    setHero();
    initHeroSlide();
    renderFeatured();
    renderTicker();
    bindQuick();
  };

  /* ============================================================
     动效：Hero 入场 / 数字滚动 / 滚动 reveal（零依赖，渐进增强）
     —— 立即执行，不等目的地数据，保证首屏动效不被网络拖慢
     ============================================================ */
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isElderly = () => document.documentElement.classList.contains('elderly');

  /* Hero 元素依次入场：移动端 .hero 与桌面端 .hero-desktop 两套都挂类，
     各断点只渲染可见的一套（display:none 元素动画不播放），互不干扰 */
  function initHeroMotion() {
    if (reduceMotion() || isElderly()) return; // 降级：内容直出
    const groups = [
      '.hero-eyebrow, .hd-badge',
      '.hero-title, .hd-title',
      '.hero-sub, .hd-sub',
      '.quick-planner, .hd-cta',
      '.hd-trust, .hd-carousel'
    ];
    groups.forEach((sel, i) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (i) el.dataset.delay = String(i);
        el.classList.add('anim');
        el.addEventListener('animationend', () => el.classList.remove('anim'), { once: true });
        // 兜底：后台标签页可能不派发 animationend，到点强制摘除，恢复静态态
        setTimeout(() => el.classList.remove('anim'), 1200 + i * 80);
      });
    });
  }

  /* 数字滚动：easeOutQuart 400ms，rAF 驱动，只改 textContent（无布局、无重排） */
  function animateCount(el) {
    const target = Number(el.dataset.count || 0);
    const suffix = el.dataset.suffix || '';
    const dur = 400;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const step = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(target * ease(t)).toLocaleString('zh-CN') + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function initCount() {
    const el = document.querySelector('.hd-count');
    if (!el) return;
    if (reduceMotion() || isElderly()) {
      // 降级：直接显示终值（HTML 本来就写着终值，此处仅保险）
      el.textContent = Number(el.dataset.count || 0).toLocaleString('zh-CN') + (el.dataset.suffix || '');
      return;
    }
    setTimeout(() => animateCount(el), 360); // 等 .hd-trust 入场就位后再滚动
  }

  /* 滚动 reveal：进入视口淡入上移，每列错峰 90ms；播完摘除类，恢复 hover 常态 */
  function bindReveal(els) {
    if (!els.length || reduceMotion() || isElderly()) return;
    if (!('IntersectionObserver' in window)) { return; } // 老浏览器：保持直出
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const col = Number(el.dataset.ri || 0) % 3;
        el.style.animationDelay = col * 90 + 'ms';
        el.classList.add('reveal-in');
        const done = () => { el.classList.remove('reveal', 'reveal-in'); el.style.animationDelay = ''; };
        el.addEventListener('animationend', done, { once: true });
        setTimeout(done, 1600); // 兜底摘除
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el, i) => {
      el.dataset.ri = String(i);
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // 首屏动效：不等目的地数据立即触发
  initHeroMotion();
  initCount();
  bindReveal([...document.querySelectorAll('.ft-item, .entry-card')]);
  /* 电脑端 Hero 风景轮播：43城几百张照片随机，5秒一换，双图层交叉淡入淡出（提前预载，切换更顺滑） */
  /* 电脑端 Hero 风景轮播：先出兜底图，再后台加载全部几百张照片补充，5秒一换、随机开头 */
  /* 热门目的地滚动字幕（循环无缝） */
  function renderTicker() {
    const track = document.getElementById('tickerTrack');
    if (!track) return;
    const names = (app.state.destinations || []).filter((d) => d.name).map((d) => '<span class="ticker-item">' + (d.emoji || '🏡') + ' ' + d.name + '</span>');
    if (!names.length) return;
    track.innerHTML = names.concat(names).join('');
  }

  async function initHeroSlide() {
    const imgs = [document.getElementById('heroSlide'), document.getElementById('heroSlide2')];
    if (!imgs[0] || !imgs[1]) return;
    if (window.innerWidth <= 900) return;
    const seen = new Set();
    // 内置兜底风景图（保证首图确定存在、立即可用）
    const fallback = ['/images/beihai/cover.jpg', '/images/shanghai/cover.jpg', '/images/sanya/cover.jpg', '/images/hangzhou/cover.jpg', '/images/guilin/cover.jpg', '/images/lijiang/cover.jpg'];
    const urls = [];
    fallback.forEach((u) => { if (!seen.has(u)) { seen.add(u); urls.push(u); } });
    // 兜底组随机：首图每次不同且确定可用
    for (let i = urls.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = urls[i]; urls[i] = urls[j]; urls[j] = t; }
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
    // 后台加载全部几百张照片（封面/画廊/亮点，去重），补充进轮播
    try {
      const d = await app.api('/api/images');
      const extra = (d.images || []).filter((u) => u && !seen.has(u));
      for (let i = extra.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = extra[i]; extra[i] = extra[j]; extra[j] = t; }
      extra.forEach((u) => { seen.add(u); urls.push(u); });
    } catch (e) { /* 接口失败就只用兜底+封面 */ }
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
    // 动态渲染完成后绑定滚动入场（首页精选网格）
    bindReveal([...grid.querySelectorAll('.dest-card')]);
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
