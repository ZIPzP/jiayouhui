(() => {
  'use strict';
  let linkedPlan = null;
  const PLAN_KEYS = ['jyh_last_plan_v2', 'jyh_last_plan'];
  const previewMode = new URLSearchParams(location.search).get('demo') === '1';
  const packStorageKey = previewMode ? 'jyh_last_pack_demo' : 'jyh_last_pack';
  window.pageInit = async function () {
    fillMonths();
    bindEvents();
    bindPackingImagePreview();
    linkedPlan = previewMode ? demoPlan() : loadLinkedPlan();
    if (linkedPlan) applyPlanDefaults(linkedPlan);
    renderPlanContext();
    if (linkedPlan) {
      document.body.classList.add('packing-linked-plan');
      renderPackingTrip();
    }
    schedulePackingStickyBounds();
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
      const restored = restorePack();
      if (!restored && linkedPlan) generatePacking(formValues());
    }
  };

  function demoPlan() {
    return {
      ts: Date.now(),
      vals: {
        destinationId: 'hangzhou',
        destinationName: '杭州',
        startDate: '2026-11-14',
        endDate: '2026-11-16',
        days: 3,
        transport: '高铁',
        travelTime: '上午',
        elderly: 2,
        adults: 2,
        children: 1,
        interests: ['自然风光', '美食'],
        pace: '轻松慢游',
        notes: '带老人和孩子，节奏轻松一些'
      },
      result: {
        title: '杭州家庭三日行',
        days: [
          { day: 1, title: '抵达杭州', schedule: [{ time: '上午', activity: '抵达杭州', detail: '酒店寄存行李' }] },
          { day: 2, title: '西湖慢游', schedule: [{ time: '上午', activity: '西湖', detail: '老人和孩子轻松步行' }] },
          { day: 3, title: '返程', schedule: [{ time: '下午', activity: '返程', detail: '提前到站' }] }
        ]
      }
    };
  }

  function fillMonths() {
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const now = new Date().getMonth() + 1;
    const sel = document.getElementById('pf-month');
    sel.innerHTML = labels.map((m, i) => `<option value="${i + 1}" ${i + 1 === now ? 'selected' : ''}>${m}</option>`).join('');
  }
  function loadLinkedPlan() {
    const pick = (s) => { try { return JSON.parse(s || 'null'); } catch (e) { return null; } };
    const candidates = [];
    PLAN_KEYS.forEach((key) => {
      const local = pick(localStorage.getItem(key));
      const session = pick(sessionStorage.getItem(key));
      if (local) candidates.push(local);
      if (session) candidates.push(session);
    });
    const p = candidates.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))[0];
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
  function renderPackingTrip() {
    const rail = document.getElementById('packingTripRail');
    const cover = document.getElementById('packingTripCover');
    const image = document.getElementById('packingTripImage');
    const title = document.getElementById('packingTripTitle');
    const dates = document.getElementById('packingTripDates');
    const travelers = document.getElementById('packingTripTravelers');
    const pace = document.getElementById('packingTripPace');
    const transport = document.getElementById('packingTripTransport');
    if (!rail || !cover || !image || !title || !dates || !travelers || !pace || !transport || !linkedPlan) return;
    const vals = formValues();
    const planVals = (linkedPlan && linkedPlan.vals) || {};
    const destination = app.state.destinations.find((item) => item.id === vals.destinationId);
    const destName = destination ? destination.name : resolveCityName((vals.customDest && vals.customDest.name) || '');
    const month = Number(vals.month) || 0;
    const days = Number(vals.durationDays) || 0;
    const people = Number(vals.elderly || 0) + Number(vals.adults || 0) + Number(vals.children || 0);
    const en = !!(window.i18n && window.i18n.lang === 'en');
    const tr = (value) => (en && window.i18n && window.i18n.t ? window.i18n.t(value) : value);
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    image.src = destination && destination.id ? `/images/${destination.id}/cover.jpg` : '/images/hero-home.jpg';
    image.alt = en ? `${destName} travel photo` : `${destName}旅行图片`;
    image.onerror = () => { rail.hidden = true; };
    title.textContent = destName;
    dates.textContent = [month ? (en ? monthsEn[month - 1] : month + ' 月') : '', days ? (en ? days + ' days' : days + ' 天') : ''].filter(Boolean).join(' · ');
    travelers.textContent = people ? (en ? people + ' people' : people + ' 人') : '—';
    pace.textContent = planVals.pace ? tr(planVals.pace) : '—';
    transport.textContent = planVals.transport ? tr(planVals.transport) : '—';
    rail.hidden = false;
  }

  function bindPackingImagePreview() {
    const cover = document.getElementById('packingTripCover');
    const lightbox = document.getElementById('packingImageLightbox');
    const preview = document.getElementById('packingImagePreview');
    const caption = document.getElementById('packingImageCaption');
    const close = document.getElementById('packingImageClose');
    const image = document.getElementById('packingTripImage');
    const title = document.getElementById('packingTripTitle');
    const dates = document.getElementById('packingTripDates');
    if (!cover || !lightbox || !preview || !caption || !close || !image || !title || !dates) return;

    let lastFocus = null;
    function closePreview() {
      lightbox.hidden = true;
      lightbox.classList.add('closing');
      document.body.style.overflow = '';
      preview.removeAttribute('src');
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }
    function openPreview() {
      if (!image.src || !image.complete || !image.naturalWidth) return;
      lastFocus = document.activeElement;
      preview.src = image.currentSrc || image.src;
      preview.alt = image.alt || title.textContent || '旅行图片';
      caption.textContent = [title.textContent, dates.textContent].filter(Boolean).join(' · ');
      lightbox.classList.remove('closing');
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
      close.focus();
    }

    cover.addEventListener('click', openPreview);
    close.addEventListener('click', closePreview);
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closePreview();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !lightbox.hidden) closePreview();
    });
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
    const selectedDuration = Number(document.getElementById('pf-duration').value);
    const planDuration = linkedPlan ? linkedDays(linkedPlan) : 0;
    const base = {
      month: Number(document.getElementById('pf-month').value),
      durationDays: planDuration && durationValue(planDuration) === String(selectedDuration) ? planDuration : selectedDuration,
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
    document.getElementById('pf-dest').addEventListener('input', () => {
      const err = document.getElementById('pfDestErr');
      if (err) err.hidden = true;
      renderPlanContext();
    });
    document.getElementById('pf-submit').addEventListener('click', () => generatePacking(formValues()));
    window.addEventListener('resize', schedulePackingStickyBounds);
    const form = document.querySelector('.packing-layout > .form-card');
    if (form && 'ResizeObserver' in window) {
      new ResizeObserver(schedulePackingStickyBounds).observe(form);
    }
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
    localStorage.setItem(packStorageKey, JSON.stringify({ vals, result, lang: (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh', ts: Date.now() }));
  }
  let packingStickyFrame = 0;
  function schedulePackingStickyBounds() {
    if (packingStickyFrame) return;
    packingStickyFrame = requestAnimationFrame(() => {
      packingStickyFrame = 0;
      syncPackingStickyBounds();
    });
  }
  function syncPackingStickyBounds() {
    const form = document.querySelector('.packing-layout > .form-card');
    const result = document.querySelector('.packing-layout > .result-card');
    if (!form || !result) return;
    if (window.matchMedia('(max-width: 900px)').matches || document.body.classList.contains('packing-linked-plan')) {
      form.style.maxHeight = '';
      result.style.height = '';
      result.style.maxHeight = '';
      return;
    }
    form.style.maxHeight = '';
    const height = Math.ceil(form.getBoundingClientRect().height) + 'px';
    result.style.height = height;
    result.style.maxHeight = height;
  }
  async function generatePacking(vals) {
    const empty = document.getElementById('resultEmpty');
    const bodyEl = document.getElementById('resultBody');
    const rawDest = (document.getElementById('pf-dest').value || '').trim();
    if (!rawDest) {
      const err = document.getElementById('pfDestErr');
      if (err) {
        err.textContent = (window.i18n && window.i18n.lang === 'en') ? 'Please enter a destination first.' : '请先填写目的地。';
        err.hidden = false;
      }
      const input = document.getElementById('pf-dest');
      if (input) input.focus();
      return;
    }
    if (linkedPlan) {
      document.body.classList.add('packing-linked-plan');
      renderPackingTrip();
    }
    empty.hidden = true;
    bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>正在后台生成打包清单…<br/>你可以放心切到别的页面，回来会自动恢复</p>';
    try {
      const st = await app.api('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app.aiPayload(vals))
      });
      localStorage.setItem(packStorageKey, JSON.stringify({ jobId: st.jobId, vals, result: null, lang: (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh', ts: Date.now() }));
      app.pollJob(st.jobId, {
        onDone: (result) => { renderResult(bodyEl, result, vals); savePack(vals, result); },
        onError: (msg) => {
          bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">${(window.i18n && window.i18n.lang === 'en') ? 'Generation failed: ' : '生成失败：'}${app.esc(msg)}</p>`;
        }
      });
    } catch (e) {
      bodyEl.innerHTML = `<p style="padding:40px;text-align:center;color:var(--danger)">${(window.i18n && window.i18n.lang === 'en') ? 'Generation failed: ' : '生成失败：'}${app.esc(e.message)}</p>`;
    }
  }
  function restorePack() {
    const bodyEl = document.getElementById('resultBody');
    const empty = document.getElementById('resultEmpty');
    if (!bodyEl) return false;
    try {
      const p = JSON.parse(localStorage.getItem(packStorageKey) || 'null');
      if (!p || !packMatchesLinkedPlan(p)) return false;
      if (p.result) {
        empty.hidden = true; bodyEl.hidden = false;
        renderResult(bodyEl, p.result, p.vals);
        showPackLangMismatch(p);
        return true;
      }
      if (p.jobId) {
        empty.hidden = true; bodyEl.hidden = false;
        bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>上次的生成任务还在后台跑，正在恢复…</p>';
        app.pollJob(p.jobId, {
          onDone: (result) => { renderResult(bodyEl, result, p.vals); savePack(p.vals, result); },
          onError: () => {
            bodyEl.innerHTML = '<p style="padding:40px;text-align:center;color:var(--ink-soft)">上次任务已结束或过期，请重新生成。</p>';
          }
        });
        return true;
      }
    } catch (e) { /* 忽略 */ }
    return false;
  }
  function packMatchesLinkedPlan(pack) {
    if (!linkedPlan || !pack || !pack.vals) return true;
    const current = formValues();
    const saved = pack.vals;
    if (Number(pack.ts || 0) && Number(linkedPlan.ts || 0) && Number(pack.ts) < Number(linkedPlan.ts)) return false;
    return saved.destinationId === current.destinationId
      && Number(saved.month) === Number(current.month)
      && Number(saved.durationDays) === Number(current.durationDays)
      && Number(saved.elderly || 0) === Number(current.elderly || 0)
      && Number(saved.adults || 0) === Number(current.adults || 0)
      && Number(saved.children || 0) === Number(current.children || 0);
  }
  /* 旧清单是在另一种语言下生成的：提示用户，并允许一键用当前语言重生成 */
  function showPackLangMismatch(p) {
    const bodyEl = document.getElementById('resultBody');
    if (!bodyEl || !p || !p.result) return;
    const current = (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh';
    const saved = p.lang || '';
    const hasChinese = /[\u4e00-\u9fff]/.test(bodyEl.innerText || '');
    const mismatch = (saved && saved !== current) || (current === 'en' && hasChinese);
    if (!mismatch) return;
    const notice = document.createElement('div');
    notice.className = 'ai-feedback';
    notice.style.marginBottom = '12px';
    notice.innerHTML = current === 'en'
      ? 'This packing list was generated in Chinese. <button type="button" class="btn btn-primary" data-regen-pack style="margin-left:8px">Regenerate in English</button>'
      : '此清单是用英文生成的。 <button type="button" class="btn btn-primary" data-regen-pack style="margin-left:8px">用中文重新生成</button>';
    const btn = notice.querySelector('[data-regen-pack]');
    if (btn) btn.addEventListener('click', () => { notice.remove(); generatePacking(p.vals || formValues()); });
    bodyEl.prepend(notice);
  }
  function checkedKey(vals) { return `jyh_ck_${previewMode ? 'demo_' : ''}${vals.destinationId}_${vals.month}`; }
  function isChecked(vals, name) {
    try { return JSON.parse(localStorage.getItem(checkedKey(vals)) || '[]').includes(name); } catch { return false; }
  }
  function renderResult(el, data, vals) {
    const uiEn = !!(window.i18n && window.i18n.lang === 'en');
    const tx = (zh, en) => (uiEn ? en : zh);
    const dest = app.state.destinations.find((d) => d.id === vals.destinationId) || {};
    const destName = dest.name || (vals.customDest && vals.customDest.name) || '';
    const items = Array.isArray(data.items) ? data.items : [];
    const groups = new Map();
    items.forEach((it, index) => {
      const category = it.category || tx('其他', 'Other');
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({ it, index });
    });
    const groupEntries = [...groups.entries()];
    const priorityItems = items
      .map((it, index) => ({ it, index }))
      .filter(({ it }) => Number(it.priority || 1) >= 2)
      .sort((a, b) => Number(b.it.priority || 1) - Number(a.it.priority || 1))
      .slice(0, 4);
    const packedCount = items.filter((it) => isChecked(vals, it.name)).length;
    const pendingCount = items.length - packedCount;
    const categoryProgressHtml = groupEntries.map(([cat, rows], gi) => {
      const done = rows.filter(({ it }) => isChecked(vals, it.name)).length;
      const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
      return `
        <div class="packing-category-line">
          <div class="packing-category-copy">
            <b>${app.esc(cat)}</b>
            <span data-category-count="${gi}">${done} / ${rows.length}</span>
          </div>
          <div class="packing-category-track" aria-hidden="true">
            <span data-category-track="${gi}" style="width:${pct}%"></span>
          </div>
        </div>`;
    }).join('');
    const groupHtml = groupEntries.map(([cat, rows], gi) => {
      const done = rows.filter(({ it }) => isChecked(vals, it.name)).length;
      return `
      <div class="check-group" data-check-group="${gi}">
        <h4><span>${app.esc(cat)}</span><span class="group-progress" data-group-progress="${gi}">${done} / ${rows.length}</span></h4>
        ${rows.map(({ it, index }) => `
          <label class="check-item" data-name="${app.esc(it.name)}" data-item-index="${index}">
            <input type="checkbox" class="ck" ${isChecked(vals, it.name) ? 'checked' : ''} />
            <span><span class="item-name">${app.esc(it.name)}</span><span class="item-reason">${app.esc(it.reason || '')}</span></span>
            <span class="prio prio-${it.priority || 1}">${it.priority === 3 ? tx('必带', 'Essential') : it.priority === 2 ? tx('建议', 'Suggested') : tx('可选', 'Optional')}</span>
          </label>`).join('')}
      </div>`;
    }).join('');
    const priorityHtml = priorityItems.length ? priorityItems.map(({ it, index }) => {
      const checked = isChecked(vals, it.name);
      return `
        <button class="packing-priority-item ${checked ? 'done' : ''}" type="button" data-priority-index="${index}" aria-pressed="${checked}">
          <span class="packing-priority-copy">
            <strong>${app.esc(it.name)}</strong>
            <span>${app.esc(it.category || tx('其他', 'Other'))}</span>
          </span>
          <span class="packing-priority-action">${checked ? tx('已收好', 'Packed') : tx('收好', 'Pack')}</span>
        </button>`;
    }).join('') : `<p class="packing-priority-note">${tx('当前清单没有额外的优先项。', 'This list has no extra priority items.')}</p>`;
    const tips = (data.tips || []).map((t) => `<li>${app.esc(t)}</li>`).join('');
    const provider = data.provider === 'ai'
      ? tx('AI 生成', 'AI generated') + (data.model ? ' · ' + app.esc(data.model) : '')
      : tx('内置规则引擎', 'Built-in rules engine');
    const travelers = Number(vals.elderly || 0) + Number(vals.adults || 0) + Number(vals.children || 0);
    const duration = Number(vals.durationDays) || 0;
    const meta = [
      travelers ? tx(travelers + ' 人同行', travelers + ' travelers') : '',
      duration ? tx(duration + ' 天', duration + ' days') : '',
      data.weatherAdvice,
      vals.tripContext ? tx('已结合行程规划', 'Based on your itinerary') : ''
    ].filter(Boolean).join(' · ');
    el.innerHTML = `
      <div class="packing-result-head">
        <div>
          <h3>${app.esc(uiEn ? (window.i18n ? window.i18n.t(destName) : destName) : destName)} · ${app.esc(data.monthLabel || '')}${tx('出行清单', ' packing list')}${vals.mode === '超详细' ? tx(' · 超详细', ' · Detailed') : ''}</h3>
          <p class="packing-result-meta">${app.esc(meta)}</p>
        </div>
        <span class="provider-tag">${provider}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">${uiEn ? 'AI failed — using the built-in packing list: ' : 'AI 调用失败，已自动使用内置清单：'}${app.esc(data.aiError)}</p>` : ''}
      <div class="packing-dashboard">
        <section class="packing-progress-card" aria-label="${tx('行前打包进度', 'Packing progress')}">
          <div class="packing-section-head">
            <h4>${tx('行前打包进度', 'Packing progress')}</h4>
            <span data-pack-pending>${pendingCount ? tx('还有 ' + pendingCount + ' 件没收好', pendingCount + ' items left') : tx('全部收好', 'All packed')}</span>
          </div>
          <div class="packing-progress-score"><strong data-pack-done>${packedCount}</strong><span>/ <span data-pack-total>${items.length}</span> ${tx('件', 'items')}</span></div>
          <div class="packing-progress-track" role="progressbar" aria-label="${tx('打包完成度', 'Packing completion')}" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${packedCount}"><span data-pack-meter></span></div>
          <p class="packing-progress-copy" data-pack-copy>${tx('已经收好 ' + packedCount + ' 件，还有 ' + pendingCount + ' 件待确认。', packedCount + ' packed, ' + pendingCount + ' left to check.')}</p>
          <div class="packing-category-progress">${categoryProgressHtml}</div>
        </section>
        <aside class="packing-priority-card" aria-label="${tx('优先带好', 'Priority items')}">
          <div class="packing-section-head">
            <h4>${tx('优先带好', 'Priority items')}</h4>
            <span>${priorityItems.length} ${tx('项', 'items')}</span>
          </div>
          <p class="packing-priority-note">${tx('先把必带和家庭特殊需求收好。', 'Pack essential and family-specific items first.')}</p>
          ${priorityHtml}
        </aside>
      </div>
      <section class="packing-list-panel">
        <div class="packing-list-head">
          <h4>${tx('家庭打包清单', 'Family packing list')}</h4>
          <span>${items.length} ${tx('件物品', 'items')}</span>
        </div>
        ${groupHtml}
      </section>
      <div class="packing-notes">
        <div class="tips-box"><strong>${tx('出行贴士', 'Travel tips')}</strong><ul>${tips}</ul></div>
        <div class="result-actions">
          <button class="btn btn-primary" type="button" data-print>${tx('打印 / 存为 PDF', 'Print / Save as PDF')}</button>
          <button class="btn btn-ghost" type="button" data-save-img>${tx('保存为图片', 'Save as image')}</button>
          <button class="btn btn-ghost" type="button" data-save-parts>${tx('三等分拼图', 'Split into three')}</button>
          <button class="btn btn-ghost" type="button" data-save-word>${tx('导出 Word', 'Export Word')}</button>
          <button class="btn btn-ghost read-aloud" type="button" data-read="${app.esc(destName + '出行清单。' + items.map(i => i.name + '，' + (i.reason || '')).join('。') + '。' + (data.tips || []).join('。'))}">${tx('朗读清单', 'Read aloud')}</button>
        </div>
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
        updatePackingProgress(el, uiEn);
      });
      ck.closest('.check-item').classList.toggle('done', ck.checked);
    });
    [...el.querySelectorAll('[data-priority-index]')].forEach((button) => {
      button.addEventListener('click', () => {
        const item = el.querySelector(`.check-item[data-item-index="${button.dataset.priorityIndex}"]`);
        const ck = item && item.querySelector('.ck');
        if (!ck) return;
        ck.checked = !ck.checked;
        ck.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    updatePackingProgress(el, uiEn);
  }

  function updatePackingProgress(el, uiEn) {
    const checks = [...el.querySelectorAll('.check-item')];
    if (!checks.length) return;
    const done = checks.filter((item) => item.querySelector('.ck').checked).length;
    const total = checks.length;
    const pending = total - done;
    const pct = Math.round((done / total) * 100);
    const doneEl = el.querySelector('[data-pack-done]');
    const totalEl = el.querySelector('[data-pack-total]');
    const meter = el.querySelector('[data-pack-meter]');
    const pendingEl = el.querySelector('[data-pack-pending]');
    const copyEl = el.querySelector('[data-pack-copy]');
    const railPendingEl = document.getElementById('packingRailPending');
    if (doneEl) doneEl.textContent = String(done);
    if (totalEl) totalEl.textContent = String(total);
    if (meter) meter.style.width = pct + '%';
    if (pendingEl) pendingEl.textContent = pending
      ? (uiEn ? pending + ' items left' : '还有 ' + pending + ' 件没收好')
      : (uiEn ? 'All packed' : '全部收好');
    if (copyEl) copyEl.textContent = uiEn
      ? `${done} packed, ${pending} left to check.`
      : `已经收好 ${done} 件，还有 ${pending} 件待确认。`;
    if (railPendingEl) railPendingEl.textContent = String(pending);
    el.querySelectorAll('[data-check-group]').forEach((group) => {
      const groupChecks = [...group.querySelectorAll('.check-item')];
      const groupDone = groupChecks.filter((item) => item.querySelector('.ck').checked).length;
      const gi = group.dataset.checkGroup;
      const groupProgress = group.querySelector(`[data-group-progress="${gi}"]`);
      const categoryCount = el.querySelector(`[data-category-count="${gi}"]`);
      const categoryTrack = el.querySelector(`[data-category-track="${gi}"]`);
      if (groupProgress) groupProgress.textContent = `${groupDone} / ${groupChecks.length}`;
      if (categoryCount) categoryCount.textContent = `${groupDone} / ${groupChecks.length}`;
      if (categoryTrack) categoryTrack.style.width = `${groupChecks.length ? Math.round((groupDone / groupChecks.length) * 100) : 0}%`;
    });
    el.querySelectorAll('[data-priority-index]').forEach((button) => {
      const item = el.querySelector(`.check-item[data-item-index="${button.dataset.priorityIndex}"]`);
      const checked = !!(item && item.querySelector('.ck').checked);
      button.classList.toggle('done', checked);
      button.setAttribute('aria-pressed', String(checked));
      const action = button.querySelector('.packing-priority-action');
      if (action) action.textContent = checked ? (uiEn ? 'Packed' : '已收好') : (uiEn ? 'Pack' : '收好');
    });
    schedulePackingStickyBounds();
  }
})();
