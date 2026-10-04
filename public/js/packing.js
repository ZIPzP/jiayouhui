(() => {
  'use strict';
  let linkedPlan = null;
  const PLAN_KEY = 'jyh_last_plan';
  window.pageInit = async function () {
    fillMonths();
    bindEvents();
    linkedPlan = loadLinkedPlan();
    if (linkedPlan) applyPlanDefaults(linkedPlan);
    renderPlanContext();
    // 从首页快捷规划跳转过来时，自动带入选择并生成
    const quick = sessionStorage.getItem('jyh_quick');
    if (quick) {
      sessionStorage.removeItem('jyh_quick');
      try {
        const v = JSON.parse(quick);
        if (v.destinationId === 'custom' && v.customDest && v.customDest.name) {
          document.getElementById('pf-dest').value = v.customDest.name;
        } else if (v.destinationId) {
          const d = app.state.destinations.find((x) => x.id === v.destinationId);
          if (d) document.getElementById('pf-dest').value = d.name;
        }
        if (v.month) document.getElementById('pf-month').value = String(v.month);
        if (v.durationDays) {
          // 旧数据可能是任意天数，映射到三档之一
          const d = Number(v.durationDays) || 4;
          document.getElementById('pf-duration').value = d <= 2 ? '2' : (d <= 5 ? '4' : '7');
        }
        if (v.elderly !== undefined) document.getElementById('pf-elderly').value = v.elderly;
        if (v.adults !== undefined) document.getElementById('pf-adults').value = v.adults;
        if (v.children !== undefined) document.getElementById('pf-children').value = v.children;
        renderPlanContext();
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
  function loadLinkedPlan() {
    const pick = (s) => { try { return JSON.parse(s || 'null'); } catch (e) { return null; } };
    const a = pick(localStorage.getItem(PLAN_KEY));
    const b = pick(sessionStorage.getItem(PLAN_KEY));
    const p = a && b ? ((a.ts || 0) >= (b.ts || 0) ? a : b) : (a || b);
    if (!p || !p.vals || !p.result || !Array.isArray(p.result.days)) return null;
    return p;
  }
  function resolveCityName(raw) {
    const city = app.resolveCity ? app.resolveCity(raw) : null;
    return app.normCity(city ? city.name : raw);
  }
  function linkedDest(p) {
    if (!p || !p.vals) return '';
    const hit = app.state.destinations.find((d) => d.id === p.vals.destinationId);
    if (hit) return hit.name;
    return resolveCityName((p.vals.customDest && p.vals.customDest.name) || p.vals.destinationName || '');
  }
  function linkedDays(p) {
    return Number(p && p.vals && p.vals.days) || ((p && p.result && p.result.days) || []).length || 0;
  }
  function durationValue(days) { return Number(days) <= 2 ? '2' : (Number(days) <= 5 ? '4' : '7'); }
  function monthFromDate(v) { const m = /^(\d{4})-(\d{2})/.exec(String(v || '')); return m ? Number(m[2]) : 0; }
  function applyPlanDefaults(p) {
    const destName = linkedDest(p);
    if (destName) document.getElementById('pf-dest').value = destName;
    const m = monthFromDate(p && p.vals && p.vals.startDate);
    if (m) document.getElementById('pf-month').value = String(m);
    const days = linkedDays(p);
    if (days) document.getElementById('pf-duration').value = durationValue(days);
    if (p.vals.elderly !== undefined) document.getElementById('pf-elderly').value = p.vals.elderly;
    if (p.vals.adults !== undefined) document.getElementById('pf-adults').value = p.vals.adults;
    if (p.vals.children !== undefined) document.getElementById('pf-children').value = p.vals.children;
    const interests = Array.isArray(p.vals.interests) ? p.vals.interests : [];
    [...document.querySelectorAll('#interestChips input')].forEach((cb) => { cb.checked = interests.includes(cb.value); });
  }
  function renderPlanContext() {
    const box = document.getElementById('planContext');
    const text = document.getElementById('planContextText');
    if (!box || !text) return;
    if (!linkedPlan) { box.hidden = true; return; }
    const planDest = app.normCity(linkedDest(linkedPlan));
    const chosenDest = app.normCity((document.getElementById('pf-dest').value || '').trim());
    if (planDest && chosenDest && planDest !== chosenDest) { box.hidden = true; return; }
    const en = !!(window.i18n && window.i18n.lang === 'en');
    const tr = (v) => (en && window.i18n && window.i18n.t ? window.i18n.t(v) : v);
    const transport = (linkedPlan.vals && linkedPlan.vals.transport) || '';
    const transportIcon = { '飞机': '✈️ ', '高铁': '🚄 ', '自驾': '🚗 ', '未定': '❓ ' };
    const transportText = transport ? tr(transportIcon[transport] ? transportIcon[transport] + transport : transport).replace(/^\S+\s/, '') : '';
    const days = linkedDays(linkedPlan);
    const info = [tr(linkedDest(linkedPlan)), days ? (en ? days + ' days' : days + ' 天') : '', transportText].filter(Boolean).join(' · ');
    text.textContent = en ? 'Linked itinerary: ' + info : '已关联行程规划：' + info;
    box.hidden = false;
  }
  function destinationNameFromVals(vals) {
    const hit = app.state.destinations.find((d) => d.id === vals.destinationId);
    return hit ? hit.name : resolveCityName((vals.customDest && vals.customDest.name) || '');
  }
  function buildTripContext(vals) {
    if (!linkedPlan || !linkedPlan.result || !Array.isArray(linkedPlan.result.days)) return null;
    const planDest = linkedDest(linkedPlan);
    const chosenDest = destinationNameFromVals(vals);
    if (planDest && chosenDest && app.normCity(planDest) !== app.normCity(chosenDest)) return null;
    const r = linkedPlan.result;
    return {
      title: r.title || '',
      summary: r.summary || '',
      notes: (linkedPlan.vals && linkedPlan.vals.notes) || '',
      transportPlan: [r.transportPlan && r.transportPlan.outbound, r.transportPlan && r.transportPlan.inbound, r.transportPlan && r.transportPlan.local].filter(Boolean).join('；'),
      dietaryNotes: (r.dietaryNotes || []).join('；'),
      tips: (r.tips || []).join('；'),
      days: r.days.map((d) => ({
        day: d.day,
        title: d.title || '',
        schedule: (d.schedule || []).map((x) => [x.time, x.activity, x.detail].filter(Boolean).join(' ')).join('；'),
        meals: (d.meals || []).map((x) => [x.type, x.recommend, x.note].filter(Boolean).join(' ')).join('；'),
        transport: d.transport || '',
        accommodation: d.accommodation || ''
      }))
    };
  }
  function withPlanContext(vals) {
    const ctx = buildTripContext(vals);
    return ctx ? Object.assign({}, vals, { tripContext: ctx }) : vals;
  }
  function formValues() {
    const raw = document.getElementById('pf-dest').value.trim();
    const cityHit0 = app.resolveCity ? app.resolveCity(raw) : null;
    const name = app.normCity(cityHit0 ? cityHit0.name : raw);
    const base = {
      month: Number(document.getElementById('pf-month').value),
      durationDays: Number(document.getElementById('pf-duration').value),
      durationLabel: (() => { const sel = document.getElementById('pf-duration'); return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : ''; })(),
      elderly: Number(document.getElementById('pf-elderly').value) || 0,
      adults: Number(document.getElementById('pf-adults').value) || 0,
      children: Number(document.getElementById('pf-children').value) || 0,
      interests: [...document.querySelectorAll('#interestChips input:checked')].map((i) => i.value),
      mode: document.getElementById('pf-mode').value || '简略',
      notes: document.getElementById('pf-notes').value.trim()
    };
    const hit = app.state.destinations.find((d) => app.normCity(d.name) === name);
    if (hit) return withPlanContext(Object.assign({}, base, { destinationId: hit.id }));
    return withPlanContext(Object.assign({}, base, { destinationId: 'custom', customDest: { name: raw, note: '' } }));
  }
  function bindEvents() {
    // 城市自动补全（支持中文名与拼音/英文）
    if (app.cityAutocomplete) app.cityAutocomplete('pf-dest', 'pfDestSug', 'pfDestErr', '目的地');
    document.getElementById('pf-dest').addEventListener('input', renderPlanContext);
    document.getElementById('pf-submit').addEventListener('click', () => generatePacking(formValues()));
    const body = document.getElementById('resultBody');
    body.addEventListener('click', (e) => {
      if (e.target.closest('[data-print]')) { window.print(); return; }
      if (e.target.closest('[data-save-img]')) { app.saveAsImage('resultBody', '家游汇-出行清单.png'); return; }
      if (e.target.closest('[data-save-parts]')) { app.saveAsImageParts('resultBody', '家游汇-出行清单.png', 3); return; }
      if (e.target.closest('[data-save-word]')) { app.saveAsWord('resultBody', '家游汇-出行清单'); return; }
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
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>正在后台生成打包清单…<br/>你可以放心切到别的页面，回来会自动恢复</p>';
    try {
      const st = await app.api('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app.aiPayload(vals))
      });
      localStorage.setItem('jyh_last_pack', JSON.stringify({ jobId: st.jobId, vals, result: null, ts: Date.now() }));
      app.pollJob(st.jobId, {
        onDone: (result) => { renderResult(bodyEl, result, vals); savePack(vals, result); },
        onError: (msg) => { bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">${(window.i18n && window.i18n.lang === 'en') ? 'Generation failed: ' : '生成失败：'}${app.esc(msg)}</p>`; }
      });
    } catch (e) {
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">${(window.i18n && window.i18n.lang === 'en') ? 'Generation failed: ' : '生成失败：'}${app.esc(e.message)}</p>`;
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
        bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>上次的生成任务还在后台跑，正在恢复…</p>';
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
    const uiEn = !!(window.i18n && window.i18n.lang === 'en');
    const dest = app.state.destinations.find((d) => d.id === vals.destinationId) || {};
    const destName = dest.name || (vals.customDest && vals.customDest.name) || '';
    const groups = {};
    (data.items || []).forEach((it) => { const c = it.category || '其他'; (groups[c] = groups[c] || []).push(it); });
    const groupHtml = Object.entries(groups).map(([cat, items], gi) => `
      <div class="check-group" style="animation-delay:${(0.05 + gi * 0.1).toFixed(2)}s">
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
    <h3>\u{1F392} ${app.esc(uiEn ? (window.i18n ? window.i18n.t(destName) : destName) : destName)} · ${app.esc(data.monthLabel || '')}${uiEn ? 'packing list' : '出行清单'}${vals.mode === '超详细' ? (uiEn ? ' · \u{1F9F3}Detailed' : ' · \u{1F9F3}超详细') : ''}</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🐱 AI 生成 · ' + app.esc(data.model || '') : '📋 内置规则引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置清单：${app.esc(data.aiError)}</p>` : ''}
      ${vals.tripContext ? `<p class="form-hint">📋 ${uiEn ? 'Based on your itinerary plan' : '本清单已结合行程规划生成'}</p>` : ''}
      <div class="weather-box">🌤️ ${app.esc(data.weatherAdvice || '')}</div>
      ${groupHtml}
      <div class="tips-box"><strong>💡 出行贴士</strong><ul>${tips}</ul></div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print>🖨️ 打印 / 存为 PDF</button>
        <button class="btn btn-ghost" type="button" data-save-img>📷 保存为图片</button>
        <button class="btn btn-ghost" type="button" data-save-parts>✂️ 三等分拼图</button>
        <button class="btn btn-ghost" type="button" data-save-word>📝 导出 Word</button>
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
