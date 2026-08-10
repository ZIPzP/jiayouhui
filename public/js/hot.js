(() => {
  'use strict';
  window.pageInit = async function () {
    const meta = document.getElementById('hotMeta');
    const list = document.getElementById('hotList');
    try {
      const data = await app.api('/api/hot-data');
      // 城市名 → 目的地 id 映射（能匹配到库里才可点击查看详情）
      const byName = new Map((app.state.destinations || []).map((d) => [d.name, d.id]));
      if (meta) meta.textContent = `${data.monthLabel || (new Date().getMonth() + 1) + '月'}热门榜 · 更新于 ${new Date(data.collectedAt).toLocaleString('zh-CN')} · 数据源：${(data.sources || []).filter((s) => s.ok).map((s) => s.label).join('、') || '无可用数据源'}`;
      if (list) {
        list.innerHTML = (data.items || []).map((it) => {
          const did = byName.get(it.name);
          return `
        <div class="hot-item${did ? ' clickable' : ''}"${did ? ` data-id="${app.esc(did)}" role="button" tabindex="0" aria-label="查看 ${app.esc(it.name)} 详情"` : ''}>
          <div class="hot-rank">${app.esc(it.rank)}</div>
          <div class="hot-main">
            <div class="hot-name">${app.esc(it.name)}</div>
            <div class="hot-reason">${app.esc(it.reason || '')}</div>
          </div>
          <div class="hot-heat">
            <div class="bar"><i style="width:${Math.min(100, it.heat || 0)}%"></i></div>
            <span class="num">本月热度 ${it.heat || 0}</span>
          </div>
          <span class="hot-trend ${String(it.trend || '').startsWith('-') ? 'down' : 'up'}">${app.esc(it.trend || '')}</span>
          <span class="hot-src">${app.esc(it.source || '综合')}</span>
        </div>`;
        }).join('') || '<p style="color:var(--ink-soft)">暂无热度数据</p>';
        list.addEventListener('click', (e) => {
          const item = e.target.closest('.hot-item[data-id]');
          if (item && window.openDestDetail) window.openDestDetail(item.dataset.id);
        });
        list.addEventListener('keydown', (e) => {
          const item = e.target.closest('.hot-item[data-id]');
          if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openDestDetail(item.dataset.id); }
        });
      }
    } catch (e) {
      if (meta) meta.textContent = '热度数据加载失败';
      if (list) list.innerHTML = `<p style="color:var(--danger)">${app.esc(e.message)}</p>`;
    }
  };
})();