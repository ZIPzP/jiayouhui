(() => {
  'use strict';
  let chatHistory = [];
  window.pageInit = async function () {
    // 加载中国城市名单（输入提示 / 城市自查）
    try { app.state.cities = (await app.api('/api/cities')).cities || []; } catch (e) { app.state.cities = []; }
    bindEvents();
    restorePlan();
  };

  /* ---------- 城市工具 ---------- */
  function normCity(s) { return String(s || '').trim().replace(/[省市]$/, ''); }
  function findCityInList(raw) {
    const n = normCity(raw);
    if (!n) return null;
    return (app.state.cities || []).find((c) => normCity(c.name) === n) || null;
  }
  function showErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; el.textContent = ''; }
  }
  /* 输入即提示：输一个字就弹出候选，点击补全 */
  function setupAutocomplete(inputId, sugId, errId, label) {
    const input = document.getElementById(inputId);
    const sug = document.getElementById(sugId);
    if (!input || !sug) return;
    let active = -1;
    function close() { sug.hidden = true; sug.innerHTML = ''; active = -1; }
    function render(v) {
      const list = (app.state.cities || []).filter((c) => c.name.startsWith(v)).slice(0, 8);
      const items = list.length ? list : (app.state.cities || []).filter((c) => c.name.includes(v)).slice(0, 8);
      if (!items.length) { sug.hidden = true; sug.innerHTML = ''; active = -1; return; }
      sug.innerHTML = items.map((c, i) => `<div class="ac-item${i === active ? ' active' : ''}" data-name="${app.esc(c.name)}"><span>${app.esc(c.name)}</span><small>${app.esc(c.province)}</small></div>`).join('');
      sug.hidden = false;
    }
    function highlight() { [...sug.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('active', i === active)); }
    input.addEventListener('input', () => {
      showErr(errId, '');
      const v = normCity(input.value);
      if (!v) { close(); return; }
      active = -1;
      render(v);
    });
    sug.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.ac-item');
      if (!item) return;
      e.preventDefault(); // 避免 input 失焦导致列表先关闭
      input.value = item.dataset.name;
      showErr(errId, '');
      close();
    });
    input.addEventListener('keydown', (e) => {
      const items = [...sug.querySelectorAll('.ac-item')];
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = items[active]; if (it) { input.value = it.dataset.name; showErr(errId, ''); } close(); }
      else if (e.key === 'Escape') close();
    });
    input.addEventListener('blur', () => setTimeout(() => {
      close();
      const v = normCity(input.value);
      if (!v) showErr(errId, '请填写' + label);
      else if (!findCityInList(v)) showErr(errId, '未找到「' + input.value.trim() + '」，请从提示中选择正确的城市名');
      else showErr(errId, '');
    }, 200));
  }
  /* 提交前校验（不通过就不调 AI，节省 token） */
  function validateForm() {
    const origin = normCity(document.getElementById('pl-origin').value);
    const destName = normCity(document.getElementById('pl-dest').value);
    let ok = true;
    if (!origin) { showErr('pl-origin-err', '请填写出发城市'); ok = false; }
    else if (!findCityInList(origin)) { showErr('pl-origin-err', '未找到出发城市「' + document.getElementById('pl-origin').value.trim() + '」，请从提示中选择正确的城市名'); ok = false; }
    else showErr('pl-origin-err', '');
    if (!destName) { showErr('pl-dest-err', '请填写目的地城市'); ok = false; }
    else if (!findCityInList(destName)) { showErr('pl-dest-err', '未找到该城市「' + document.getElementById('pl-dest').value.trim() + '」，请从提示中选择正确的城市名'); ok = false; }
    else showErr('pl-dest-err', '');
    return ok;
  }

  function chipValue(groupSel) { const el = document.querySelector(`#planForm [${groupSel}] .chip.active`); return el ? el.dataset.value : ''; }
  function chipValues(groupSel) { return [...document.querySelectorAll(`#planForm [${groupSel}] .chip.active`)].map((c) => c.dataset.value); }
  function planFormValues() {
    const base = {
      origin: document.getElementById('pl-origin').value.trim(),
      startDate: document.getElementById('pl-start').value,
      endDate: document.getElementById('pl-end').value,
      days: Number(document.getElementById('pl-days').value) || 3,
      transport: chipValue('data-single="pl-transport"'),
      elderly: Number(document.getElementById('pl-elderly').value) || 0,
      adults: Number(document.getElementById('pl-adults').value) || 0,
      children: Number(document.getElementById('pl-children').value) || 0,
      dietary: chipValues('data-multi="pl-dietary"'),
      budget: chipValue('data-single="pl-budget"') || '舒适型',
      pace: chipValue('data-single="pl-pace"') || '标准',
      accommodation: chipValue('data-single="pl-stay"') || '',
      interests: chipValues('data-multi="pl-interests"'),
      notes: document.getElementById('pl-notes').value.trim()
    };
    const destRaw = document.getElementById('pl-dest').value.trim();
    const destName = normCity(destRaw);
    // 输入的城市正好是库内目的地 → 用它的数据（天气/坐标）；否则走自定义
    const hit = app.state.destinations.find((d) => normCity(d.name) === destName);
    if (hit) return Object.assign({}, base, { destinationId: hit.id });
    return Object.assign({}, base, { destinationId: 'custom', customDest: { name: destRaw, note: document.getElementById('pl-custom-note').value.trim() } });
  }

  function bindEvents() {
    // 目的地 / 出发城市：输入即提示 + 城市自查
    setupAutocomplete('pl-dest', 'pl-dest-sug', 'pl-dest-err', '目的地城市');
    setupAutocomplete('pl-origin', 'pl-origin-sug', 'pl-origin-err', '出发城市');
    // 选项 chips
    document.getElementById('planForm').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const singleGroup = chip.closest('[data-single]');
      if (singleGroup) {
        [...singleGroup.querySelectorAll('.chip')].forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        return;
      }
      const multiGroup = chip.closest('[data-multi]');
      if (!multiGroup) return;
      chip.classList.toggle('active');
      if (multiGroup.dataset.multi === 'pl-dietary') {
        if (chip.dataset.value === '无特别忌口' && chip.classList.contains('active')) {
          [...multiGroup.querySelectorAll('.chip')].forEach((c) => { if (c !== chip) c.classList.remove('active'); });
        } else if (chip.dataset.value !== '无特别忌口') {
          const noneChip = [...multiGroup.querySelectorAll('.chip')].find((c) => c.dataset.value === '无特别忌口');
          if (noneChip) noneChip.classList.remove('active');
        }
      }
    });
    // 日期 -> 天数
    const syncDays = () => {
      const s = document.getElementById('pl-start').value, e = document.getElementById('pl-end').value;
      if (s && e && new Date(e) >= new Date(s)) {
        const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
        const sel = document.getElementById('pl-days');
        if (![...sel.options].some((o) => o.value === String(days))) {
          const opt = document.createElement('option'); opt.value = String(days); opt.textContent = days + ' 天'; sel.appendChild(opt);
        }
        sel.value = String(days);
      }
    };
    document.getElementById('pl-start').addEventListener('change', syncDays);
    document.getElementById('pl-end').addEventListener('change', syncDays);
    // 生成
    document.getElementById('pl-submit').addEventListener('click', generatePlan);
    // 结果区 打印/朗读
    document.getElementById('planBody').addEventListener('click', (e) => {
      if (e.target.closest('[data-print-plan]')) { window.print(); return; }
      const r = e.target.closest('[data-read]');
      if (r) { app.speak(r.dataset.read); return; }
    });
    // 问答
    document.getElementById('chatSend').addEventListener('click', sendChat);
    document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  }

  function savePlan(vals, result) {
    localStorage.setItem('jyh_last_plan', JSON.stringify({ vals, result, ts: Date.now() }));
  }
  async function generatePlan() {
    // 先校验，不通过就不调 AI（节省 token）
    if (!validateForm()) { app.toast('请先完善出发城市和目的地（红色提示处）'); return; }
    const vals = planFormValues();
    const empty = document.getElementById('planEmpty');
    const bodyEl = document.getElementById('planBody');
    empty.hidden = true; bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">⏳ AI 主理人正在后台生成行程…<br/>你可以放心切到别的页面/标签页，回来会自动恢复显示结果</p>';
    try {
      const st = await app.api('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, vals, app.state.ai)) });
      localStorage.setItem('jyh_last_plan', JSON.stringify({ jobId: st.jobId, vals, result: null, ts: Date.now() }));
      app.pollJob(st.jobId, {
        onDone: (result) => { renderPlan(bodyEl, result, vals); savePlan(vals, result); },
        onError: (msg) => { bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">生成失败：${app.esc(msg)}</p>`; }
      });
    } catch (e) {
      // 校验类错误（400）直接显示
      const msg = (e && e.message) || '生成失败';
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">${app.esc(msg)}</p>`;
    }
  }
  function restorePlan() {
    const bodyEl = document.getElementById('planBody');
    const empty = document.getElementById('planEmpty');
    if (!bodyEl) return;
    try {
      const p = JSON.parse(localStorage.getItem('jyh_last_plan') || 'null');
      if (!p) return;
      if (p.result) {
        empty.hidden = true; bodyEl.hidden = false;
        renderPlan(bodyEl, p.result, p.vals);
        return;
      }
      if (p.jobId) {
        empty.hidden = true; bodyEl.hidden = false;
        bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)">⏳ 上次的生成任务还在后台跑，正在恢复…</p>';
        app.pollJob(p.jobId, {
          onDone: (result) => { renderPlan(bodyEl, result, p.vals); savePlan(p.vals, result); },
          onError: () => { bodyEl.innerHTML = '<p style="padding:40px;text-align:center;color:var(--ink-soft)">上次任务已结束或过期，请重新生成。</p>'; }
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  function renderPlan(el, data, vals) {
    const dest = app.state.destinations.find((d) => d.id === vals.destinationId) || {};
    const dayHtml = (data.days || []).map((d) => `
      <div class="day-card">
        <div class="day-head">
          <div class="day-num">D${d.day}</div>
          <span class="day-title">${app.esc(d.title)}</span>
          ${d.dateLabel ? `<span class="day-date">${app.esc(d.dateLabel)}</span>` : ''}
        </div>
        ${(d.schedule || []).map((s) => `
          <div class="schedule-item">
            <div class="schedule-time">${app.esc(s.time)}</div>
            <div><div class="schedule-activity">${app.esc(s.activity)}</div>${s.detail ? `<div class="schedule-detail">${app.esc(s.detail)}</div>` : ''}</div>
          </div>`).join('')}
        ${(d.meals || []).length ? `<div class="meals-row">${d.meals.map((m) => `<span class="meal-pill"><b>${app.esc(m.type)}</b> ${app.esc(m.recommend)}${m.note ? ' · ' + app.esc(m.note) : ''}</span>`).join('')}</div>` : ''}
        <div class="day-meta">
          ${d.transport ? `<span>🚗 ${app.esc(d.transport)}</span>` : ''}
          ${d.accommodation ? `<span>🏨 ${app.esc(d.accommodation)}</span>` : ''}
          ${d.costPerPerson ? `<span>💰 人均约 ${app.esc(String(d.costPerPerson))}</span>` : ''}
        </div>
      </div>`).join('');
    const tp = data.transportPlan || {};
    const bg = data.budget || {};
    el.innerHTML = `
      <div class="result-head">
        <h3>🗺️ ${app.esc(data.title || '行程规划')}</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🤖 AI 主理人生成 · ' + app.esc(data.model || '') : '📋 内置规划引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置方案：${app.esc(data.aiError)}</p>` : ''}
      ${data.summary ? `<p style="color:var(--ink-soft);margin-bottom:14px">${app.esc(data.summary)}</p>` : ''}
      <div class="transport-box"><h4>🚄 交通安排</h4>
        ${tp.outbound ? `<p><b>去程：</b>${app.esc(tp.outbound)}</p>` : ''}
        ${tp.inbound ? `<p><b>返程：</b>${app.esc(tp.inbound)}</p>` : ''}
        ${tp.local ? `<p><b>当地：</b>${app.esc(tp.local)}</p>` : ''}
      </div>
      <div class="budget-box"><h4>💰 费用估算（人均）</h4>
        ${bg.transport ? `<p>🚄 ${app.esc(bg.transport)}</p>` : ''}
        ${bg.accommodation ? `<p>🏨 ${app.esc(bg.accommodation)}</p>` : ''}
        ${bg.meals ? `<p>🍜 ${app.esc(bg.meals)}</p>` : ''}
        ${bg.tickets ? `<p>🎫 ${app.esc(bg.tickets)}</p>` : ''}
        ${bg.totalPerPerson ? `<p class="total">合计：${app.esc(bg.totalPerPerson)}</p>` : ''}
        ${bg.note ? `<p style="font-size:.85rem">${app.esc(bg.note)}</p>` : ''}
      </div>
      ${(data.dietaryNotes || []).length ? `<div class="dietary-box"><h4>🥢 忌食与用餐提醒</h4><ul>${data.dietaryNotes.map((n) => `<li>${app.esc(n)}</li>`).join('')}</ul></div>` : ''}
      ${dayHtml}
      ${(data.tips || []).length ? `<div class="tips-box"><strong>💡 出行提醒</strong><ul>${data.tips.map((t) => `<li>${app.esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print-plan>🖨️ 打印行程</button>
        <button class="btn btn-ghost read-aloud" type="button" data-read="${app.esc(data.title + '。' + (data.summary || '') + (data.days || []).map((d) => '第' + d.day + '天，' + (d.schedule || []).map((s) => s.time + s.activity).join('，')).join('。'))}">🔊 朗读行程</button>
      </div>`;
  }

  function addChatMsg(role, text) {
    const body = document.getElementById('chatBody');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }
  async function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    addChatMsg('user', msg);
    const typing = addChatMsg('ai', '正在思考…');
    typing.classList.add('chat-typing');
    try {
      const data = await app.api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: chatHistory, ...app.state.ai }) });
      chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: data.reply });
      typing.classList.remove('chat-typing');
      typing.textContent = data.reply;
    } catch (e) {
      typing.classList.remove('chat-typing');
      typing.textContent = '出错了：' + e.message;
    }
  }
})();