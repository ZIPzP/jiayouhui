(() => {
  'use strict';

  const SELECTED_KEY = 'jyh_discovery_lab_cities_v1';
  const DRAW_KEY = 'jyh_draw_history';
  const VIEW_KEY = 'jyh_view_history_v1';
  const FAVORITE_KEY = 'jyh_favorites_v1';
  const POSTER_KEY = 'jyh_poster_history_v1';
  const state = {
    destinations: [],
    hot: [],
    featured: [],
    knowledge: [],
    knowledgeQuery: '',
    webKnowledge: [],
    webSearchMessage: '',
    selected: [],
    mode: 'random',
    current: null
  };
  const uiEn = () => !!(window.i18n && window.i18n.lang === 'en');
  const tr = (s) => (uiEn() && window.i18n ? window.i18n.t(s) : s);
  let knowledgeSearchSeq = 0;

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
    const initialMode = new URLSearchParams(location.search).get('mode');
    if (initialMode === 'limited') setMode('limited');
    await Promise.all([loadHot(), loadKnowledge()]);
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
    document.getElementById('discKnowledgeSearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      runKnowledgeSearch(document.getElementById('discKnowledgeSearch').value);
    });
    document.getElementById('discKnowledgeSearch').addEventListener('input', (e) => {
      knowledgeSearchSeq++;
      state.knowledgeQuery = e.target.value.trim();
      state.webKnowledge = [];
      state.webSearchMessage = '';
      renderKnowledge();
    });
    document.getElementById('discKnowledgeReset').addEventListener('click', () => setKnowledgeQuery(''));
    document.querySelectorAll('[data-search-tag]').forEach((btn) => {
      btn.addEventListener('click', () => runKnowledgeSearch(btn.dataset.searchTag));
    });
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
    state.destinations.forEach((d) => {
      if (d.name && !names.includes(d.name)) names.push(d.name);
    });
    state.featured = names;
    const count = document.getElementById('discFeaturedCount');
    if (count) {
      count.textContent = uiEn()
        ? `All ${names.length} featured cities participate`
        : `全部 ${names.length} 个精选城市均参与抽取`;
    }
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
      showResult(picked);
    };
    tick();
  }

  function showResult(d) {
    state.current = d;
    const body = document.getElementById('discResultBody');
    const en = uiEn();
    const tags = (d.tags || []).slice(0, 5).map((tag) => `<span class="disc-result-tag">${app.esc(tr(tag))}</span>`).join('');
    const suggestedDays = en
      ? String(d.suggestDays || '').replace(/(\d+)\s*-\s*(\d+)\s*天/, '$1–$2 days').replace(/(\d+)\s*天/, '$1 days')
      : String(d.suggestDays || '');
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

  async function loadKnowledge() {
    const list = document.getElementById('discKnowledgeList');
    if (!list) return;
    try {
      const response = await fetch('/data/discovery-knowledge.json?v=20261102c', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('knowledge request failed');
      const data = await response.json();
      state.knowledge = Array.isArray(data.items) ? data.items.slice(0, 18) : [];
      renderKnowledge();
    } catch (e) {
      list.innerHTML = `<p class="disc-knowledge-empty">${uiEn() ? 'Travel stories are temporarily unavailable.' : '文旅资讯暂时不可用，请稍后再试。'}</p>`;
      const status = document.getElementById('discKnowledgeStatus');
      if (status) status.textContent = uiEn() ? 'Travel stories are temporarily unavailable.' : '文旅热点暂时不可用，请稍后再试。';
    }
  }

  function renderKnowledge() {
    const list = document.getElementById('discKnowledgeList');
    if (!list) return;
    const en = uiEn();
    const query = state.knowledgeQuery.toLocaleLowerCase();
    const localItems = query
      ? state.knowledge.filter((item) => knowledgeSearchText(item).includes(query))
      : state.knowledge;
    const seen = new Set(localItems.map((item) => item.url));
    const items = localItems.concat(state.webKnowledge.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }));
    const status = document.getElementById('discKnowledgeStatus');
    if (status) {
      status.textContent = state.webSearchMessage || (query
        ? (en ? `${items.length} result${items.length === 1 ? '' : 's'} for “${state.knowledgeQuery}”` : `找到 ${items.length} 条与“${state.knowledgeQuery}”相关的文旅热点`)
        : (en ? `${items.length} public travel stories` : `已收录 ${items.length} 条公开文旅资讯`));
    }
    if (!state.knowledge.length) {
      list.innerHTML = `<p class="disc-knowledge-empty">${uiEn() ? 'No travel stories yet.' : '暂时还没有文旅资讯。'}</p>`;
      return;
    }
    if (!items.length) {
      list.innerHTML = `<p class="disc-knowledge-empty">${en ? 'No matching destinations or topics. Try another keyword.' : '没有找到匹配的目的地或主题，换个关键词试试。'}</p>`;
      return;
    }
    list.innerHTML = items.map((item) => {
      const dateText = item.publishedAt ? formatKnowledgeDate(item.publishedAt) : (en ? 'Live web' : '全网实时');
      return `
      <article class="disc-knowledge-item">
        <div class="disc-knowledge-meta">
          <span>${app.esc(en ? item.categoryEn : item.category)}</span>
          <time datetime="${app.esc(item.publishedAt || '')}">${dateText}</time>
        </div>
        <h3>${app.esc(en ? item.titleEn : item.title)}</h3>
        <p>${app.esc(en ? item.summaryEn : item.summary)}</p>
        <div class="disc-knowledge-footer">
          <small>${en ? 'Source: ' : '来源：'}${app.esc(en ? item.sourceEn : item.source)}</small>
          <a href="${app.esc(item.url)}" target="_blank" rel="noopener noreferrer">${en ? 'Read original ↗' : '阅读原文 ↗'}</a>
        </div>
      </article>`;
    }).join('');
  }

  function knowledgeSearchText(item) {
    return [
      item.category, item.categoryEn,
      item.title, item.titleEn,
      item.summary, item.summaryEn,
      item.source, item.sourceEn
    ].join(' ').toLocaleLowerCase();
  }

  function setKnowledgeQuery(value) {
    knowledgeSearchSeq++;
    state.knowledgeQuery = String(value || '').trim();
    state.webKnowledge = [];
    state.webSearchMessage = '';
    const input = document.getElementById('discKnowledgeSearch');
    if (input) input.value = state.knowledgeQuery;
    renderKnowledge();
  }

  async function runKnowledgeSearch(rawValue) {
    const query = String(rawValue || '').trim();
    setKnowledgeQuery(query);
    const seq = knowledgeSearchSeq;
    if (!query) return;
    const localCount = state.knowledge.filter((item) => knowledgeSearchText(item).includes(query.toLocaleLowerCase())).length;
    if (localCount >= 3) return;
    const status = document.getElementById('discKnowledgeStatus');
    if (status) status.textContent = uiEn() ? 'Searching free web results…' : '正在使用免费额度补充全网结果…';
    try {
      const data = await app.api('/api/travel-search?q=' + encodeURIComponent(query) + '&lang=' + (uiEn() ? 'en' : 'zh'));
      if (seq !== knowledgeSearchSeq || state.knowledgeQuery !== query) return;
      state.webKnowledge = Array.isArray(data.results) ? data.results : [];
      if (data.enabled === false) {
        state.webSearchMessage = uiEn()
          ? 'Free web search is not configured; local results only.'
          : '免费全网搜索尚未配置，当前仅显示本地结果。';
      }
      renderKnowledge();
    } catch (e) {
      if (seq !== knowledgeSearchSeq || state.knowledgeQuery !== query) return;
      state.webSearchMessage = uiEn()
        ? 'Free web search is temporarily unavailable; local results are still shown.'
        : '免费全网搜索暂时不可用，仍可查看本地结果。';
      renderKnowledge();
    }
  }

  function formatKnowledgeDate(value) {
    const [year, month, day] = String(value || '').split('-').map(Number);
    if (!year || !month || !day) return String(value || '');
    if (!uiEn()) return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[month - 1]} ${year}`;
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
