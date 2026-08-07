(() => {
  'use strict';
  window.pageInit = async function () {
    fillMonths();
    const opts = app.state.destinations.map((d) => `<option value="${app.esc(d.id)}">${app.esc(d.name)}（${app.esc(d.province)}）</option>`).join('');
    document.getElementById('pf-dest').innerHTML = opts + '<option value="__custom__">✍️ 自定义目的地（自己输入城市）</option>';
    document.getElementById('pf-dest').addEventListener('change', () => {
      const show = document.getElementById('pf-dest').value === '__custom__';
      document.getElementById('pf-custom').hidden = !show;
      if (show) document.getElementById('pf-custom').focus();
    });
    bindEvents();
    // 从首页快捷规划跳转过来时，自动带入选择并生成
    const quick = sessionStorage.getItem('jyh_quick');
    if (quick) {
      sessionStorage.removeItem('jyh_quick');
      try {
        const v = JSON.parse(quick);
        if (v.destinationId === 'custom' && v.customDest && v.customDest.name) {
          document.getElementById('pf-dest').value = '__custom__';
          document.getElementById('pf-custom').hidden = false;
          document.getElementById('pf-custom').value = v.customDest.name;
        } else if (v.destinationId) {
          document.getElementById('pf-dest').value = v.destinationId;
        }
        if (v.month) document.getElementById('pf-month').value = String(v.month);
        if (v.durationDays) document.getElementById('pf-duration').value = String(v.durationDays);
        if (v.elderly !== undefined) document.getElementById('pf-elderly').value = v.elderly;
        if (v.adults !== undefined) document.getElementById('pf-adults').value = v.adults;
        if (v.children !== undefined) document.getElementById('pf-children').value = v.children;
        generatePacking(formValues());
      } catch (e) { /* 忽略 */ }
    } else {
      restorePack();
    }
  };

  function fillMonths() {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date().getMonth() + 1;
    const sel = document.getElementById('pf-month');
    sel.innerHTML = labels.map((m, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${m}</option>`).join('');
  }
  function formValues() {
    const dest = document.getElementById('pf-dest').value;
    const base = {
      month: Number(document.getElementById('pf-month').value),
      durationDays: Number(document.getElementById('pf-duration').value),
      elderly: Number(document.getElementById('pf-elderly').value) || 0,
      adults: Number(document.getElementById('pf-adults').value) || 0,
      children: Number(document.getElementById('pf-children').value) || 0,
      interests: [...document.querySelectorAll('#interestChips input:checked')].map((i) => i.value)
    };
    if (dest === '__custom__') {
      return Object.assign({}, base, { destinationId: 'custom', customDest: { name: document.getElementById('pf-custom').value.trim(), note: '' } });
    }
    return Object.assign({}, base, { destinationId: dest });
  }
  function bindEvents() {
    document.getElementById('pf-submit').addEventListener('click', () => generatePacking(formValues()));
    const body = document.getElementById('resultBody');
    body.addEventListener('click', (e) => {
      if (e.target.closest('[data-print]')) { window.print(); return; }
      const r = e.target.closest('[data-read]');
      if (r) { app.speak(r.dataset.read); return; }
    });
  }

  function savePack(vals, result) {
    localStorage.setItem('jyh_last_pack', JSON.stringify({ vals, result, ts: Date.now() }));
  }
  async function generatePacking(vals) {
    const empty = document.getElementById('resultEmpty');
    const bodyEl = document.getElementById('resultBody');
    empty.hidden = true;
    bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">⏳ 正在后台生成打包清单…<br/>你可以放心切到别的页面，回来会自动恢复</p>';
    try {
      const st = await app.api('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, vals, app.state.ai))
      });
      localStorage.setItem('jyh_last_pack', JSON.stringify({ jobId: st.jobId, vals, result: null, ts: Date.now() }));
      app.pollJob(st.jobId, {
        onDone: (result) => { renderResult(bodyEl, result, vals); savePack(vals, result); },
        onError: (msg) => { bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">生成失败：${app.esc(msg)}</p>`; }
      });
    } catch (e) {
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">生成失败：${app.esc(e.message)}</p>`;
    }
  }
  function restorePack() {
    const bodyEl = document.getElementById('resultBody');
    const empty = document.getElementById('resultEmpty');
    if (!bodyEl) return;
    try {
      const p = JSON.parse(localStorage.getItem('jyh_last_pack') || 'null');
      if (!p) return;
      if (p.result) {
        empty.hidden = true; bodyEl.hidden = false;
        renderResult(bodyEl, p.result, p.vals);
        return;
      }
      if (p.jobId) {
        empty.hidden = true; bodyEl.hidden = false;
        bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">⏳ 上次的生成任务还在后台跑，正在恢复…</p>';
        app.pollJob(p.jobId, {
          onDone: (result) => { renderResult(bodyEl, result, p.vals); savePack(p.vals, result); },
          onError: () => { bodyEl.innerHTML = '<p style="padding:40px;text-align:center;color:var(--ink-soft)">上次任务已结束或过期，请重新生成。</p>'; }
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  function checkedKey(vals) { return `jyh_ck_${vals.destinationId}_${vals.month}`; }
  function isChecked(vals, name) {
    try { return JSON.parse(localStorage.getItem(checkedKey(vals)) || '[]').includes(name); } catch { return false; }
  }
  function renderResult(el, data, vals) {
    const dest = app.state.destinations.find((d) => d.id === vals.destinationId) || {};
    const destName = dest.name || (vals.customDest && vals.customDest.name) || '';
    const groups = {};
    (data.items || []).forEach((it) => { const c = it.category || '其他'; (groups[c] = groups[c] || []).push(it); });
    const groupHtml = Object.entries(groups).map(([cat, items]) => `
      <div class="check-group">
        <h4>${app.esc(cat)}</h4>
        ${items.map((it) => `
          <label class="check-item" data-name="${app.esc(it.name)}">
            <input type="checkbox" class="ck" ${isChecked(vals, it.name) ? 'checked' : ''} />
            <span><span class="item-name">${app.esc(it.name)}</span><span class="item-reason">${app.esc(it.reason || '')}</span></span>
            <span class="prio prio-${it.priority || 1}">${it.priority === 3 ? '必带' : it.priority === 2 ? '建议' : '可选'}</span>
          </label>`).join('')}
      </div>`).join('');
    const tips = (data.tips || []).map((t) => `<li>${app.esc(t)}</li>`).join('');
    el.innerHTML = `
      <div class="result-head">
        <h3>🎒 ${app.esc(destName)} · ${app.esc(data.monthLabel || '')}出行清单</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 生成 · ' + app.esc(data.model || '') : '📋 内置规则引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置清单：${app.esc(data.aiError)}</p>` : ''}
      <div class="weather-box">🌤️ ${app.esc(data.weatherAdvice || '')}</div>
      ${groupHtml}
      <div class="tips-box"><strong>💡 出行贴士</strong><ul>${tips}</ul></div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print>🖨️ 打印清单</button>
        <button class="btn btn-ghost read-aloud" type="button" data-read="${app.esc(destName + '出行清单。' + (data.items || []).map(i => i.name + '，' + (i.reason || '')).join('。') + '。' + (data.tips || []).join('。'))}">🔊 朗读清单</button>
      </div>`;
    [...el.querySelectorAll('.ck')].forEach((ck) => {
      ck.addEventListener('change', () => {
        const key = checkedKey(vals);
        let arr = JSON.parse(localStorage.getItem(key) || '[]');
        const name = ck.closest('.check-item').dataset.name;
        if (ck.checked) { if (!arr.includes(name)) arr.push(name); }
        else arr = arr.filter((n) => n !== name);
        localStorage.setItem(key, JSON.stringify(arr));
        ck.closest('.check-item').classList.toggle('done', ck.checked);
      });
      ck.closest('.check-item').classList.toggle('done', ck.checked);
    });
  }
})();