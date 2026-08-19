(() => {
  'use strict';
  const state = { currentId: null, idleTimer: null };

  window.pageInit = async function () {
    bindDraw();
    bindModal();
    fillStats();
    renderPool();
    renderRecent();
    startIdle();
  };

  /* ---------- 目的地池 / 统计 / 最近抽取 / 待机轮播 ---------- */
  function fillStats() {
    const el = document.getElementById('drawStats');
    if (!el) return;
    const total = (app.state.destinations || []).length;
    el.textContent = '共 ' + total + ' 个热门家庭目的地 · 每个都适合全家出行';
  }
  function renderPool() {
    const box = document.getElementById('drawPool');
    if (!box) return;
    box.innerHTML = (app.state.destinations || []).map((d) =>
      '<span class="dp-chip" style="--ac:' + app.esc(d.accent || '#0f766e') + '">' + (d.emoji || '🏡') + ' ' + app.esc(d.name) + '</span>').join('');
  }
  const HIST_KEY = 'jyh_draw_history';
  function loadDraws() { try { const a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveDraw(d) {
    const arr = loadDraws();
    arr.unshift({ id: d.id, name: d.name, emoji: d.emoji || '🏡', accent: d.accent || '#0f766e', ts: Date.now() });
    try { localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, 8))); } catch (e) {}
  }
  function renderRecent() {
    const box = document.getElementById('drawRecent');
    if (!box) return;
    const arr = loadDraws();
    if (!arr.length) { box.innerHTML = ''; return; }
    const when = (ts) => { const d = new Date(ts); return (d.getMonth() + 1) + '-' + d.getDate(); };
    box.innerHTML = '<p class="draw-recent-title">🕘 最近抽到</p>' + arr.map((x) =>
      '<span class="dp-chip" style="--ac:' + app.esc(x.accent) + '">' + app.esc(x.emoji) + ' ' + app.esc(x.name) + '<i>' + when(x.ts) + '</i></span>').join('');
  }
  function startIdle() {
    const screen = document.getElementById('drawScreen');
    const emojiEl = document.getElementById('drawEmoji');
    const nameEl = document.getElementById('drawName');
    if (!screen || !emojiEl || !nameEl) return;
    if (state.idleTimer) return;
    const pool = (app.state.destinations || []).filter((d) => d.name);
    if (!pool.length) return;
    state.idleTimer = setInterval(() => {
      const d = pool[Math.floor(Math.random() * pool.length)];
      emojiEl.textContent = d.emoji || '🏡';
      nameEl.textContent = d.name;
    }, 1300);
  }
  function stopIdle() {
    if (state.idleTimer) { clearInterval(state.idleTimer); state.idleTimer = null; }
  }
  /* 命中瞬间：一圈 emoji 粒子爆散（≤8 个，0.8s 后移除，只动 transform/opacity） */
  const PARTICLE_EMOJI = ['✨', '🎉', '🌟', '💫', '🎊', '⭐', '🌈', '🔥'];
  function burstParticles(screen, emojiEl) {
    if (!screen) return;
    const emoji = emojiEl || screen.querySelector('.draw-emoji');
    const sRect = screen.getBoundingClientRect();
    const eRect = emoji ? emoji.getBoundingClientRect() : null;
    const cx = eRect ? (eRect.left + eRect.width / 2 - sRect.left) : sRect.width / 2;
    const cy = eRect ? (eRect.top + eRect.height / 2 - sRect.top) : sRect.height * 0.42;
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('span');
      p.className = 'draw-particle';
      p.textContent = PARTICLE_EMOJI[i % PARTICLE_EMOJI.length];
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.6;
      const dist = 70 + Math.random() * 70;
      p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      screen.appendChild(p);
      setTimeout(() => { try { p.remove(); } catch (e) {} }, 850);
    }
  }

  function bindDraw() {
    const btn = document.getElementById('drawBtn');
    const screen = document.getElementById('drawScreen');
    if (!btn || !screen) return;
    const emojiEl = document.getElementById('drawEmoji');
    const nameEl = document.getElementById('drawName');
    let running = false;
    btn.addEventListener('click', () => {
      if (running) return;
      stopIdle();
      const pool = (app.state.destinations || []).filter((d) => d.cover && d.name);
      if (!pool.length) { app.toast('目的地数据加载中，请稍后再试'); return; }
      running = true;
      btn.disabled = true;
      btn.textContent = '🎲 抽取中…';
      // 抽奖滚动：先快后慢，最后命中
      let i = 0;
      const total = 18 + Math.floor(Math.random() * 8);
      const step = () => {
        i++;
        const d = pool[Math.floor(Math.random() * pool.length)];
        const prog = i / total;
        if (emojiEl) {
          emojiEl.textContent = d.emoji || '🏡';
          emojiEl.classList.add('rolling');
          // 越快越糊：早期快→模糊大，临近命中逐渐清晰
          emojiEl.style.filter = 'blur(' + (Math.max(0, 1 - prog) * 3).toFixed(1) + 'px)';
        }
        if (nameEl) nameEl.textContent = d.name;
        if (i < total) {
          setTimeout(step, 60 + Math.pow(prog, 2.2) * 240);
        } else {
          const picked = d;
          if (emojiEl) {
            emojiEl.classList.remove('rolling');
            emojiEl.style.filter = '';
            emojiEl.textContent = '🎉';
            emojiEl.classList.remove('hit-bounce'); void emojiEl.offsetWidth; emojiEl.classList.add('hit-bounce');
          }
          if (nameEl) nameEl.textContent = d.name + '！';
          burstParticles(screen, emojiEl);
          running = false;
          btn.disabled = false;
          btn.textContent = '🎲 再抽一次';
          showResult(picked);
          saveDraw(picked);
          renderRecent();
        }
      };
      step();
    });
  }

  function showResult(d) {
    const modal = document.getElementById('drawModal');
    const body = document.getElementById('drawResultBody');
    if (!modal || !body) return;
    const tags = (d.tags || []).slice(0, 4).map((t) => `<span class="badge" style="background:${app.esc(d.accent || '#0f766e')}22;color:${app.esc(d.accent || '#0f766e')}">${app.esc(t)}</span>`).join('');
    const foods = (d.foods || []).slice(0, 4).map((f) => app.esc(f.name || f)).join('、');
    const hls = (d.highlights || []).slice(0, 3);
    body.innerHTML = `
      <div class="draw-card">
        <div class="draw-card-cover" style="background-color:${app.esc(d.accent || '#0f766e')}">
          <div class="draw-card-emoji">${app.esc(d.emoji || '🏡')}</div>
          <div class="draw-card-name">${app.esc(d.name)}</div>
          <div class="draw-card-meta">${app.esc(d.province || '')} · 建议 ${app.esc(d.suggestDays || '')}${(d.bestSeasons || []).length ? ' · 最佳 ' + app.esc(d.bestSeasons.join('/')) : ''}</div>
        </div>
        <div class="draw-card-body">
          ${tags ? `<div class="draw-card-tags">${tags}</div>` : ''}
          <p class="draw-card-tagline">${app.esc(d.tagline || '')}</p>
          <p class="draw-card-desc">${app.esc(d.description || '')}</p>
          ${hls.length ? `<div class="draw-card-sec"><b>✨ 必去亮点</b><ul>${hls.map((h) => `<li>${app.esc(h.title)}${h.text ? '：' + app.esc(h.text) : ''}</li>`).join('')}</ul></div>` : ''}
          ${foods ? `<div class="draw-card-sec"><b>🍜 当地美食</b><p>${foods}</p></div>` : ''}
        </div>
      </div>`;
    const cover = body.querySelector('.draw-card-cover');
    if (cover && d.cover) {
      const probe = new Image();
      probe.onload = () => app.setBg(cover, d.cover);
      probe.src = d.cover;
    }
    state.currentId = d.id;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const closeBtn = document.getElementById('drawModalClose');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    const modal = document.getElementById('drawModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    startIdle();
  }

  function bindModal() {
    const modal = document.getElementById('drawModal');
    if (!modal) return;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    const closeBtn = document.getElementById('drawModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const again = document.getElementById('drawAgain');
    if (again) again.addEventListener('click', () => { closeModal(); const btn = document.getElementById('drawBtn'); if (btn) btn.click(); });
    const detail = document.getElementById('drawDetail');
    if (detail) detail.addEventListener('click', () => { closeModal(); if (state.currentId && window.openDestDetail) window.openDestDetail(state.currentId); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });
  }
})();