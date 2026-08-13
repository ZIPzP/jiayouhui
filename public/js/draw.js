(() => {
  'use strict';
  const state = { currentId: null };

  window.pageInit = async function () {
    bindDraw();
    bindModal();
  };

  function bindDraw() {
    const btn = document.getElementById('drawBtn');
    const screen = document.getElementById('drawScreen');
    if (!btn || !screen) return;
    const emojiEl = document.getElementById('drawEmoji');
    const nameEl = document.getElementById('drawName');
    let running = false;
    btn.addEventListener('click', () => {
      if (running) return;
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
        if (emojiEl) emojiEl.textContent = d.emoji || '🏡';
        if (nameEl) nameEl.textContent = d.name;
        if (i < total) {
          setTimeout(step, 60 + Math.pow(i / total, 2.2) * 240);
        } else {
          const picked = d;
          if (emojiEl) emojiEl.textContent = '🎉';
          if (nameEl) nameEl.textContent = d.name + '！';
          running = false;
          btn.disabled = false;
          btn.textContent = '🎲 再抽一次';
          showResult(picked);
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