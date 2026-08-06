(() => {
  'use strict';
  window.pageInit = async function () {
    const meta = document.getElementById('hotMeta');
    const list = document.getElementById('hotList');
    try {
      const data = await app.api('/api/hot-data');
      if (meta) meta.textContent = `更新于 ${new Date(data.collectedAt).toLocaleString('zh-CN')} · 数据源：${(data.sources || []).filter((s) => s.ok).map((s) => s.label).join('、') || '无可用数据源'}`;
      if (list) list.innerHTML = (data.items || []).map((it) => `
        <div class="hot-item">
          <div class="hot-rank">${it.rank}</div>
          <div class="hot-main">
            <div class="hot-name">${app.esc(it.name)}</div>
            <div class="hot-reason">${app.esc(it.reason || '')}</div>
          </div>
          <div class="hot-heat">
            <div class="bar"><i style="width:${Math.min(100, it.heat || 0)}%"></i></div>
            <span class="num">热度 ${it.heat || 0}</span>
          </div>
          <span class="hot-trend ${String(it.trend || '').startsWith('-') ? 'down' : 'up'}">${app.esc(it.trend || '')}</span>
          <span class="hot-src">${app.esc(it.source || '综合')}</span>
        </div>`).join('') || '<p style="color:var(--ink-soft)">暂无热度数据</p>';
    } catch (e) {
      if (meta) meta.textContent = '热度数据加载失败';
      if (list) list.innerHTML = `<p style="color:var(--danger)">${app.esc(e.message)}</p>`;
    }
  };
})();