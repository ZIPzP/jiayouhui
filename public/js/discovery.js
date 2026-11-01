(() => {
  'use strict';

  const SELECTED_KEY = 'jyh_discovery_lab_cities_v1';
  const FEEDBACK_KEY = 'jyh_discovery_lab_feedback_v1';
  const DRAW_KEY = 'jyh_draw_history';
  const VIEW_KEY = 'jyh_view_history_v1';
  const FAVORITE_KEY = 'jyh_favorites_v1';
  const POSTER_KEY = 'jyh_poster_history_v1';
  const state = {
    destinations: [],
    hot: [],
    featured: [],
    selected: [],
    mode: 'random',
    current: null
  };
  const uiEn = () => !!(window.i18n && window.i18n.lang === 'en');
  const tr = (s) => (uiEn() && window.i18n ? window.i18n.t(s) : s);

  window.pageInit = async function () {
    if (window.matchMedia('(max-width: 900px)').matches) {
      location.replace('/draw-mobile.html' + location.search + location.hash);
      return;
    }
    state.destinations = Array.isArray(app.state.destinations) ? app.state.destinations : [];
    state.selected = loadSelected();
    bindEvents();
    renderCityOptions();
    renderCityChips();
    renderFeaturedCities();
    renderMeta();
    renderFeedback();
    const initialMode = new URLSearchParams(location.search).get('mode');
    if (initialMode === 'limited') setMode('limited');
    await loadHot();
  };

  function bindEvents() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
    document.getElementById('discCityAdd').addEventListener('click', addCity);
    document.getElementById('discCityInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCity();
      }
    });
    document.getElementById('discDrawBtn').addEventListener('click', drawDestination);
    document.getElementById('discResultClose').addEventListener('click', closeResult);
    document.getElementById('discResultModal').addEventListener('click', (e) => {
      if (e.target.id === 'discResultModal') closeResult();
    });
    document.getElementById('discFeedbackForm').addEventListener('submit', submitFeedback);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeResult();
    });
  }

  function setMode(mode) {
    state.mode = mode === 'limited' ? 'limited' : 'random';
    document.querySelectorAll('[data-mode]').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === state.mode));
    document.getElementById('discFeaturedPanel').hidden = state.mode === 'limited';
    document.getElementById('discLimitPanel').hidden = state.mode !== 'limited';
    renderMeta();
  }

  function renderCityOptions() {
    document.getElementById('discCityOptions').innerHTML = state.destinations
      .map((d) => `<option value="${app.esc(d.name)}"></option>`).join('');
  }

  function renderFeaturedCities() {
    const box = document.getElementById('discFeaturedCities');
    if (!box) return;
    const names = [];
    state.hot.forEach((item) => {
      if (state.destinations.some((d) => d.name === item.name) && !names.includes(item.name)) names.push(item.name);
    });
    if (!names.length) {
      state.destinations.slice(0, 8).forEach((d) => {
        if (d.name && !names.includes(d.name)) names.push(d.name);
      });
    }
    state.featured = names.slice(0, 8);
    box.innerHTML = state.featured.map((name) => {
      const d = state.destinations.find((x) => x.name === name) || {};
      return `<span class="disc-featured-chip">${app.esc(d.emoji || '📍')} ${app.esc(tr(name))}</span>`;
    }).join('');
  }

  function normalizeCityName(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const hit = state.destinations.find((d) => d.name === text || d.enName === text);
    if (hit) return hit.name;
    const city = app.resolveCity ? app.resolveCity(text) : null;
    return city ? city.name : text;
  }

  function addCity() {
    const input = document.getElementById('discCityInput');
    const name = normalizeCityName(input.value);
    if (!name) {
      app.toast('请先输入城市名称');
      return;
    }
    if (name.length > 20) {
      app.toast('城市名称过长');
      return;
    }
    if (state.selected.includes(name)) {
      app.toast('这个城市已经在候选列表里');
      input.value = '';
      return;
    }
    if (state.selected.length >= 12) {
      app.toast('最多添加 12 个候选城市');
      return;
    }
    state.selected.push(name);
    input.value = '';
    saveSelected();
    renderCityChips();
    renderMeta();
  }

  function removeCity(name) {
    state.selected = state.selected.filter((x) => x !== name);
    saveSelected();
    renderCityChips();
    renderMeta();
  }

  function loadSelected() {
    try {
      const arr = JSON.parse(localStorage.getItem(SELECTED_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, 12) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSelected() {
    try { localStorage.setItem(SELECTED_KEY, JSON.stringify(state.selected)); } catch (e) { /* ignore */ }
  }

  function recordHistory(key, item, dedupe = false) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const items = Array.isArray(arr) ? arr : [];
      const keyName = String(item.id || item.name || '');
      const next = dedupe ? items.filter((x) => String(x.id || x.name || '') !== keyName) : items;
      next.unshift(item);
      localStorage.setItem(key, JSON.stringify(next.slice(0, 30)));
    } catch (e) { /* ignore */ }
  }

  function renderCityChips() {
    const box = document.getElementById('discCityChips');
    if (!state.selected.length) {
      box.innerHTML = '<span class="disc-field-note">还没有候选城市，请先添加。</span>';
      return;
    }
    box.innerHTML = state.selected.map((name) =>
      `<span class="disc-city-chip">📍 ${app.esc(tr(name))}<button type="button" data-remove-city="${app.esc(name)}" aria-label="${uiEn() ? 'Remove ' : '移除 '}${app.esc(name)}">×</button></span>`
    ).join('');
    box.querySelectorAll('[data-remove-city]').forEach((btn) => {
      btn.addEventListener('click', () => removeCity(btn.dataset.removeCity));
    });
  }

  function renderMeta() {
    const el = document.getElementById('discDrawMeta');
    const count = state.mode === 'limited' ? state.selected.length : state.featured.length;
    el.textContent = state.mode === 'limited'
      ? (uiEn() ? `Scoped draw · ${count} candidate cities` : `范围随机 · 当前候选 ${count} 个城市`)
      : (uiEn() ? `Featured draw · ${count} featured cities` : `精选随机 · 当前精选 ${count} 个城市`);
  }

  function cityFromName(name) {
    const hit = state.destinations.find((d) => d.name === name);
    if (hit) return hit;
    const palette = ['#0f766e', '#c2410c', '#1d4ed8', '#7c3aed', '#b91c1c'];
    const accent = palette[Math.abs(name.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % palette.length];
    return {
      id: 'custom:' + name,
      name,
      enName: name,
      province: '自定义目的地',
      emoji: '📍',
      accent,
      tagline: '这是你加入的候选城市，先抽中它，再一起决定怎么玩。',
      tags: ['自定义城市', '待探索'],
      bestSeasons: [],
      suggestDays: '',
      foods: [],
      custom: true
    };
  }

  async function drawDestination() {
    const pool = state.mode === 'limited'
      ? state.selected.map(cityFromName)
      : state.featured.map(cityFromName);
    if (!pool.length) {
      app.toast(state.mode === 'limited' ? '请先添加至少一个候选城市' : '目的地数据仍在加载');
      return;
    }
    const btn = document.getElementById('discDrawBtn');
    const emoji = document.getElementById('discEmoji');
    const name = document.getElementById('discName');
    const sub = document.getElementById('discSub');
    let i = 0;
    const total = 16;
    btn.disabled = true;
    btn.textContent = '抽取中…';
    const tick = () => {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      emoji.textContent = candidate.emoji || '📍';
      emoji.classList.add('rolling');
      name.textContent = tr(candidate.name);
      sub.textContent = state.mode === 'limited'
        ? (uiEn() ? 'Choosing from your scoped cities…' : '正在候选城市中挑选…')
        : (uiEn() ? 'Searching for travel inspiration…' : '正在翻找旅行灵感…');
      i += 1;
      if (i < total) {
        setTimeout(tick, 55 + Math.pow(i / total, 2) * 150);
        return;
      }
      const picked = candidate;
      emoji.classList.remove('rolling');
      emoji.textContent = '🎉';
      name.textContent = tr(picked.name);
      sub.textContent = picked.custom
        ? (uiEn() ? 'A custom destination ready to explore' : '自定义目的地，等待你一起发现')
        : tr(picked.tagline || '下一站就是这里');
      btn.disabled = false;
      btn.textContent = '🎲 再抽一次';
      state.current = picked;
      recordHistory(DRAW_KEY, {
        id: picked.custom ? '' : picked.id,
        name: picked.name,
        emoji: picked.emoji || '📍',
        accent: picked.accent || '#0f766e',
        ts: Date.now()
      });
      document.getElementById('discFbDestination').value = picked.name;
      showResult(picked);
    };
    tick();
  }

  function showResult(d) {
    state.current = d;
    const body = document.getElementById('discResultBody');
    const en = uiEn();
    const tags = (d.tags || []).slice(0, 5).map((tag) => `<span class="disc-result-tag">${app.esc(tr(tag))}</span>`).join('');
    const suggestedDays = String(d.suggestDays || '').replace(/(\d+)\s*-\s*(\d+)\s*天/, '$1–$2 days').replace(/(\d+)\s*天/, '$1 days');
    const meta = [tr(d.province), d.suggestDays ? (en ? 'Suggested ' : '建议 ') + suggestedDays : '', (d.bestSeasons || []).length ? (en ? 'Best ' : '最佳 ') + d.bestSeasons.map((x) => tr(x)).join('/') : '']
      .filter(Boolean).join(' · ');
    body.innerHTML = `
      <div class="disc-result-hero" id="discResultHero">
        <h3>${app.esc(d.emoji || '📍')} ${app.esc(tr(d.name))}</h3>
        <p>${app.esc(meta)}</p>
      </div>
      <div class="disc-result-content">
        <p>${app.esc(tr(d.tagline || ''))}</p>
        ${tags ? `<div class="disc-result-tags">${tags}</div>` : ''}
        <div class="disc-result-actions">
          <button class="btn btn-primary" id="discPosterBtn" type="button">${en ? '✨ Create travel poster' : '✨ 生成旅行海报'}</button>
          <button class="btn btn-ghost disc-fav-btn${isFavorite(d) ? ' active' : ''}" id="discFavoriteBtn" type="button">${isFavorite(d) ? (en ? '★ Saved' : '★ 已收藏') : (en ? '☆ Save destination' : '☆ 收藏目的地')}</button>
          ${!d.custom && d.id ? `<button class="btn btn-ghost" id="discDetailBtn" type="button">${en ? '📖 View destination details' : '📖 查看目的地详情'}</button>` : `<span class="disc-result-tag">${en ? 'Custom city · no built-in details yet' : '自定义城市 · 暂无内置详情'}</span>`}
          <button class="btn btn-ghost" id="discModalAgain" type="button">${en ? '🎲 Draw again' : '🎲 再抽一次'}</button>
        </div>
        <div class="disc-poster-box" id="discPosterBox" hidden>
          <img id="discPosterImg" alt="${app.esc(en ? tr(d.name) + ' travel poster' : d.name + '旅行海报')}" />
          <div class="disc-poster-actions">
          <a class="btn btn-primary" id="discPosterDownload" download="家游汇-${app.esc(d.name)}-旅行海报.png" href="#">${en ? 'Download poster' : '下载高清海报'}</a>
          </div>
          <p class="disc-poster-note">当前为真实照片杂志排版；AI 纸感插画将在后续版本接入。</p>
        </div>
      </div>`;
    const hero = document.getElementById('discResultHero');
    if (hero) {
      if (d.cover) app.setBg(hero, d.cover);
      else hero.style.background = `linear-gradient(135deg, ${d.accent || '#0f766e'}, #173d37)`;
    }
    document.getElementById('discPosterBtn').addEventListener('click', () => generatePoster(d));
    document.getElementById('discFavoriteBtn').addEventListener('click', toggleFavorite);
    document.getElementById('discModalAgain').addEventListener('click', () => { closeResult(); drawDestination(); });
    const detail = document.getElementById('discDetailBtn');
    if (detail) detail.addEventListener('click', () => { closeResult(); window.openDestDetail(d.id); });
    document.getElementById('discResultModal').hidden = false;
    document.body.style.overflow = 'hidden';
    recordHistory(VIEW_KEY, {
      id: d.custom ? '' : d.id,
      name: d.name,
      emoji: d.emoji || '📍',
      ts: Date.now()
    }, true);
  }

  function favoriteKey(d) {
    return String((d && (d.id || d.name)) || '');
  }

  function isFavorite(d) {
    try {
      const arr = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
      const key = favoriteKey(d);
      return Array.isArray(arr) && arr.some((x) => String(x.id || x.name || '') === key);
    } catch (e) {
      return false;
    }
  }

  function toggleFavorite() {
    const d = state.current;
    if (!d) return;
    try {
      const arr = JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
      const items = Array.isArray(arr) ? arr : [];
      const key = favoriteKey(d);
      const exists = items.some((x) => String(x.id || x.name || '') === key);
      const next = exists
        ? items.filter((x) => String(x.id || x.name || '') !== key)
        : [{ id: d.custom ? '' : d.id, name: d.name, emoji: d.emoji || '📍', accent: d.accent || '#0f766e', ts: Date.now() }].concat(items);
      localStorage.setItem(FAVORITE_KEY, JSON.stringify(next.slice(0, 50)));
      const btn = document.getElementById('discFavoriteBtn');
      if (btn) {
        btn.textContent = exists ? '☆ 收藏目的地' : '★ 已收藏';
        btn.classList.toggle('active', !exists);
      }
      app.toast(exists ? '已取消收藏' : '已收藏到我的旅行');
    } catch (e) { /* ignore */ }
  }

  function closeResult() {
    const modal = document.getElementById('discResultModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function loadHot() {
    const list = document.getElementById('discHotList');
    const meta = document.getElementById('discHotMeta');
    try {
      const data = await app.api('/api/hot-data');
      state.hot = (data.items || []).slice(0, 8);
      renderFeaturedCities();
      const monthEn = new Date(data.collectedAt || Date.now()).toLocaleString('en-US', { month: 'long' });
      meta.textContent = uiEn()
        ? `${monthEn} family travel heat · click for details`
        : `${data.monthLabel || ((new Date().getMonth() + 1) + '月')}家庭旅行热度 · 点击查看攻略`;
      list.innerHTML = state.hot.map((item, index) => {
        const hit = state.destinations.find((d) => d.name === item.name);
        return `<div class="disc-hot-row" data-hot-id="${hit ? app.esc(hit.id) : ''}">
          <span class="disc-hot-rank">${String(index + 1).padStart(2, '0')}</span>
          <div class="disc-hot-main"><b>${app.esc(tr(item.name))}</b><small>${app.esc(tr(item.reason || ''))}</small></div>
          <span class="disc-heat">${Number(item.heat || 0)}</span>
        </div>`;
      }).join('');
      list.querySelectorAll('[data-hot-id]').forEach((row) => {
        if (!row.dataset.hotId) return;
        row.addEventListener('click', () => {
          const d = state.destinations.find((x) => x.id === row.dataset.hotId);
          if (d) recordHistory(VIEW_KEY, { id: d.id, name: d.name, emoji: d.emoji || '📍', ts: Date.now() }, true);
          window.openDestDetail(row.dataset.hotId);
        });
      });
    } catch (e) {
      if (meta) meta.textContent = '热度数据暂时不可用';
      if (list) list.innerHTML = '<p class="disc-field-note">稍后再试，抽取功能不受影响。</p>';
    }
  }

  function loadFeedback() {
    try {
      const arr = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) { /* ignore */ }
    return uiEn()
      ? [
          { nickname: 'Xiaoman family', destination: '杭州', type: '去过推荐', rating: 5, text: 'West Lake is stroller-friendly, and the boat ride is easy for seniors.', ts: Date.now() - 86400000 },
          { nickname: 'A-You', destination: '长沙', type: '想去', rating: 5, text: 'I want to take my parents to Orange Isle and find a non-spicy Hunan meal.', ts: Date.now() - 3600000 }
        ]
      : [
          { nickname: '小满一家', destination: '杭州', type: '去过推荐', rating: 5, text: '西湖边推婴儿车很方便，坐游船老人也不累。', ts: Date.now() - 86400000 },
          { nickname: '阿柚', destination: '长沙', type: '想去', rating: 5, text: '想带爸妈去橘子洲，顺便吃一顿不辣的湘菜。', ts: Date.now() - 3600000 }
        ];
  }

  function renderFeedback() {
    const items = loadFeedback();
    const list = document.getElementById('discFeedbackList');
    document.getElementById('discFbCount').textContent = uiEn() ? items.length + ' items' : items.length + ' 条';
    list.innerHTML = items.slice(0, 8).map((item) => `
      <article class="disc-feedback-item">
        <div class="disc-feedback-avatar">🧳</div>
        <div>
          <b>${app.esc(item.nickname || '匿名旅人')}</b>
          <small>${app.esc(tr(item.destination))} · ${'★'.repeat(Number(item.rating) || 0)}</small>
          <span class="disc-feedback-tag">${app.esc(tr(item.type || '反馈'))}</span>
          <p>${app.esc(item.text)}</p>
        </div>
      </article>`).join('');
  }

  function submitFeedback(e) {
    e.preventDefault();
    const destination = document.getElementById('discFbDestination').value.trim();
    const nickname = document.getElementById('discFbNickname').value.trim();
    const type = document.getElementById('discFbType').value;
    const rating = Number(document.getElementById('discFbRating').value);
    const text = document.getElementById('discFbText').value.trim();
    if (!destination || text.length < 4) {
      app.toast('请填写目的地和至少 4 个字的留言');
      return;
    }
    const items = loadFeedback();
    items.unshift({ destination, nickname, type, rating, text, ts: Date.now() });
    try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(items.slice(0, 30))); } catch (err) { /* ignore */ }
    document.getElementById('discFbText').value = '';
    renderFeedback();
    app.toast('旅行反馈已保存在当前浏览器');
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = String(text || '').split('');
    let line = '';
    let lines = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lines * lineHeight);
        line = chars[i];
        lines += 1;
        if (lines >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, y + lines * lineHeight);
  }

  async function generatePoster(d) {
    const btn = document.getElementById('discPosterBtn');
    const box = document.getElementById('discPosterBox');
    const imgEl = document.getElementById('discPosterImg');
    btn.disabled = true;
    btn.textContent = uiEn() ? 'Creating poster…' : '正在制作海报…';
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    const accent = d.accent || '#0f766e';
    ctx.fillStyle = '#f1ebdd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(70,55,35,${Math.random() * 0.035})`;
      ctx.fillRect(Math.random() * 1080, Math.random() * 1800, 1.2, 1.2);
    }
    const photo = await loadImage(d.cover);
    const px = 78, py = 78, pw = 924, ph = 900;
    if (photo) {
      const scale = Math.max(pw / photo.width, ph / photo.height);
      const sw = pw / scale;
      const sh = ph / scale;
      ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, px, py, pw, ph);
      const grad = ctx.createLinearGradient(0, py + ph * .55, 0, py + ph);
      grad.addColorStop(0, 'rgba(15,23,42,0)');
      grad.addColorStop(1, 'rgba(15,23,42,.52)');
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, pw, ph);
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.arc(px + 690, py + 210, 210, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = accent;
    ctx.fillRect(78, 978, 924, 10);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(162, 1022, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.font = '900 80px "Microsoft YaHei", sans-serif';
    ctx.fillText((d.emoji || '📍'), 116, 1048);
    ctx.fillStyle = '#213b35';
    ctx.font = '900 92px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(tr(d.name), 78, 1210);
    ctx.fillStyle = accent;
    ctx.font = '700 30px Georgia, serif';
    ctx.fillText(String(d.enName || d.province || 'FAMILY JOURNEY').toUpperCase(), 82, 1260);
    ctx.fillStyle = '#5d6f68';
    ctx.font = '32px "Microsoft YaHei", sans-serif';
    wrapText(ctx, d.tagline || '把这一站，留给全家一起抵达。', 82, 1340, 880, 48, 3);
    ctx.strokeStyle = 'rgba(33,59,53,.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(82, 1510);
    ctx.lineTo(998, 1510);
    ctx.stroke();
    ctx.fillStyle = '#33443f';
    ctx.font = '700 25px "Microsoft YaHei", sans-serif';
    const meta = [d.province || '', d.suggestDays ? '建议 ' + d.suggestDays : '', (d.bestSeasons || []).length ? '最佳 ' + d.bestSeasons.join('/') : ''].filter(Boolean).join('  ·  ');
    ctx.fillText(meta || 'FAMILY TRAVEL NOTE', 82, 1565);
    ctx.fillStyle = accent;
    ctx.font = '800 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('家游汇  JIAYOUHUI', 82, 1690);
    ctx.fillStyle = '#7b8882';
    ctx.font = '18px Georgia, serif';
    ctx.fillText('TRAVEL DISCOVERY POSTER · TEST EDITION', 82, 1728);
    const src = canvas.toDataURL('image/png');
    imgEl.src = src;
    document.getElementById('discPosterDownload').href = src;
    box.hidden = false;
    btn.disabled = false;
    btn.textContent = uiEn() ? '✨ Regenerate poster' : '✨ 重新生成海报';
    recordHistory(POSTER_KEY, {
      id: d.custom ? '' : d.id,
      name: d.name,
      emoji: d.emoji || '📍',
      ts: Date.now()
    });
    app.toast('旅行海报已在本地生成');
  }
})();
