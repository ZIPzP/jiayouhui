(() => {
  'use strict';
  let chatHistory = [];
  let renderedPlan = null;
  let planWeatherTimer = null;
  let planWeatherToken = 0;
  const planWeatherCache = new Map();
  let desktopData = null;
  let desktopVals = null;
  let desktopCtx = null;
  let desktopSortables = [];
  let desktopBound = false;
  let dpwInfoTab = 'transport';
  let dpwWeatherCache = null;
  let desktopHighlights = [];
  let desktopHighlightsToken = 0;
  let chatMode = 'modify';
  let revisionBusy = false;
  let revisionToken = 0;
  const planUndoStack = [];
  window.pageInit = async function () {
    bindEvents();
    restoreDraft();
    initDateFields();
    refreshPlanWeather();
    migrateLastPlan();
    renderHistory();
    bindHistory();
    restorePlan();
  };

  function chipValue(groupSel) { const el = document.querySelector(`#planForm [${groupSel}] .chip.active`); return el ? el.dataset.value : ''; }
  function chipValues(groupSel) { return [...document.querySelectorAll(`#planForm [${groupSel}] .chip.active`)].map((c) => c.dataset.value); }
  function planFormValues() {
    const base = {
      destinationName: document.getElementById('pl-dest').value.trim(),
      origin: document.getElementById('pl-origin').value.trim(),
      returnDest: document.getElementById('pl-return').value.trim(),
      startDate: document.getElementById('pl-start').value,
      endDate: document.getElementById('pl-end').value,
      days: Number(document.getElementById('pl-days').value) || 3,
      transport: chipValue('data-single="pl-transport"'),
      travelTime: chipValue('data-single="pl-time"') || '上午',
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
    const cityHit = app.resolveCity ? app.resolveCity(destRaw) : null;
    const destName = app.normCity(cityHit ? cityHit.name : destRaw);
    // 输入的城市正好是库内目的地 → 用它的数据（天气/坐标）；否则走自定义
    const hit = app.state.destinations.find((d) => app.normCity(d.name) === destName);
    if (hit) return Object.assign({}, base, { destinationId: hit.id });
    return Object.assign({}, base, { destinationId: 'custom', customDest: { name: cityHit ? cityHit.name : destRaw, note: document.getElementById('pl-notes').value.trim() } });
  }

  // 原生 date 输入框的占位文案跟随浏览器语言，英文站点仍可能显示「年/月/日」。
  // 保留原生日期选择器，用透明输入 + 自定义显示层统一成 YYYY-MM-DD / 年/月/日。
  function initDateFields() {
    ['pl-start', 'pl-end'].forEach((id) => {
      const input = document.getElementById(id);
      if (!input || input.dataset.dateReady === '1') return;
      input.dataset.dateReady = '1';
      const field = input.closest('.date-field');
      const display = field && field.querySelector('.date-display');
      if (!field || !display) return;
      const en = !!(window.i18n && window.i18n.lang === 'en');
      display.placeholder = en ? 'YYYY-MM-DD' : '年/月/日';
      const sync = () => {
        const english = !!(window.i18n && window.i18n.lang === 'en');
        display.value = input.value
          ? (english ? input.value : input.value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1年$2月$3日'))
          : '';
      };
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
      input.addEventListener('click', () => {
        if (typeof input.showPicker === 'function') {
          try { input.showPicker(); } catch (e) { /* 已打开或浏览器限制时忽略 */ }
        }
      });
      sync();
    });
  }

  function schedulePlanWeather() {
    clearTimeout(planWeatherTimer);
    planWeatherTimer = setTimeout(refreshPlanWeather, 350);
  }

  // 根据用户选择的去返日期，展示目的地在这段时间内的天气预报
  async function refreshPlanWeather() {
    const box = document.getElementById('planDateWeather');
    const body = document.getElementById('planWeatherBody');
    const note = document.getElementById('planDateWeatherNote');
    const title = document.getElementById('planDateWeatherTitle');
    if (!box || !body || !note) return;
    const en = uiEnNow();
    const start = document.getElementById('pl-start').value;
    const end = document.getElementById('pl-end').value;
    const destRaw = document.getElementById('pl-dest').value.trim();
    if (!start || !end || !destRaw || new Date(end) < new Date(start)) {
      box.hidden = true;
      return;
    }
    const cityHit = app.resolveCity ? app.resolveCity(destRaw) : null;
    const destName = app.normCity(cityHit ? cityHit.name : destRaw);
    const dest = (app.state.destinations || []).find((d) => app.normCity(d.name) === destName);
    box.hidden = false;
    if (title) title.textContent = en ? '🌤️ Weather for your dates' : '🌤️ 所选日期天气';
    if (!dest || !dest.id) {
      body.innerHTML = '';
      note.textContent = en ? 'Weather is available for built-in destinations only.' : '自定义目的地暂不支持天气预报。';
      return;
    }
    body.innerHTML = `<p class="form-hint">${en ? 'Loading weather…' : '正在获取天气…'}</p>`;
    note.textContent = '';
    const token = ++planWeatherToken;
    try {
      let data = planWeatherCache.get(dest.id);
      if (!data) {
        data = await app.api('/api/weather?id=' + encodeURIComponent(dest.id));
        planWeatherCache.set(dest.id, data);
      }
      if (token !== planWeatherToken) return;
      const days = (data.days || []).filter((x) => x.date >= start && x.date <= end);
      if (!days.length) {
        body.innerHTML = '';
        note.textContent = en
          ? 'No forecast covers these dates yet (forecasts cover the next 15 days).'
          : '所选日期暂时没有预报（仅支持未来 15 天）。';
        return;
      }
      body.innerHTML = `<div class="wf-scroll">${days.map((x) => `
        <div class="wf-day">
          <div class="wf-week">${app.esc(x.weekday)}</div>
          <div class="wf-date">${app.esc(x.date.slice(5))}</div>
          <div class="wf-icon">${x.icon}</div>
          <div class="wf-label">${app.esc(x.label)}</div>
          <div class="wf-temp">${x.tmin}° ~ ${x.tmax}°</div>
        </div>`).join('')}</div>`;
      const selectedDays = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
      note.textContent = days.length < selectedDays
        ? (en ? `Showing ${days.length} of ${selectedDays} days — the rest are beyond the 15-day forecast.` : `已显示 ${days.length}/${selectedDays} 天，其余日期超出 15 天预报范围。`)
        : (en ? 'Based on the latest 15-day forecast.' : '基于最新 15 天预报。');
    } catch (e) {
      if (token !== planWeatherToken) return;
      body.innerHTML = '';
      note.textContent = en ? 'Weather is temporarily unavailable.' : '天气暂时获取失败，请稍后再试。';
    }
  }

  function bindEvents() {
    // 选项 chips
    // 城市自动补全（支持中文名与拼音/英文，如 pingxiang、Beijing）
    if (app.cityAutocomplete) {
      app.cityAutocomplete('pl-dest', 'plDestSug', 'plDestErr', '目的地');
      app.cityAutocomplete('pl-origin', 'plOriginSug', 'plOriginErr', '出发城市');
      app.cityAutocomplete('pl-return', 'plReturnSug', 'plReturnErr', '返回目的地');
    }
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
    document.getElementById('pl-start').addEventListener('change', schedulePlanWeather);
    document.getElementById('pl-end').addEventListener('change', schedulePlanWeather);
    const destInput = document.getElementById('pl-dest');
    if (destInput) {
      destInput.addEventListener('input', schedulePlanWeather);
      destInput.addEventListener('change', schedulePlanWeather);
    }
    // 生成
    document.getElementById('pl-submit').addEventListener('click', generatePlan);
    const visionBtn = document.getElementById('pl-vision-btn');
    const visionFile = document.getElementById('pl-vision-file');
    if (visionBtn && visionFile) {
      visionBtn.addEventListener('click', () => visionFile.click());
      visionFile.addEventListener('change', () => {
        const file = visionFile.files && visionFile.files[0];
        visionFile.value = '';
        if (file) recognizeGuideImage(file);
      });
    }
    // 结果区 打印/朗读
    document.getElementById('planBody').addEventListener('click', (e) => {
      if (e.target.closest('[data-open-workspace]')) {
        if (renderedPlan) renderPlan(document.getElementById('planBody'), renderedPlan.data, renderedPlan.vals);
        return;
      }
      if (e.target.closest('[data-print-plan]')) { window.print(); return; }
      if (e.target.closest('[data-save-img]')) { app.saveAsImage('planBody', '家游汇-行程规划.png'); return; }
      if (e.target.closest('[data-save-parts]')) { app.saveAsImageParts('planBody', '家游汇-行程规划.png', 3); return; }
      if (e.target.closest('[data-save-word]')) { app.saveAsWord('planBody', '家游汇-行程规划'); return; }
      if (e.target.closest('[data-build-map]')) { if (window.planMap && renderedPlan) window.planMap.build(renderedPlan.data, renderedPlan.vals); return; }
      if (e.target.closest('[data-close-map]')) { const shell = document.getElementById('planMapShell'); if (shell) shell.hidden = true; return; }
      const r = e.target.closest('[data-read]');
      if (r) { app.speak(r.dataset.read); return; }
    });
    // 问答
    document.getElementById('chatSend').addEventListener('click', sendChat);
    document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
    document.querySelectorAll('[data-chat-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setChatMode(btn.dataset.chatMode));
    });
    setChatMode(chatMode);
    const planForm = document.getElementById('planForm');
    if (planForm) { planForm.addEventListener('input', scheduleDraftSave); planForm.addEventListener('change', scheduleDraftSave); }
  }

  function planVisionStatus(text, isError) {
    const node = document.getElementById('pl-vision-status');
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? '#b91c1c' : 'var(--primary-dark)';
  }

  async function compressGuideImage(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(uiEnNow() ? 'Choose a JPEG, PNG or WebP image' : '请选择 JPEG、PNG 或 WebP 图片');
    if (file.size > 12 * 1024 * 1024) throw new Error(uiEnNow() ? 'The original image must be under 12 MB' : '原图不能超过 12 MB');
    const image = await new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(uiEnNow() ? 'The image could not be read' : '图片读取失败')); };
      img.src = objectUrl;
    });
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = '';
    for (const mime of ['image/webp', 'image/jpeg']) {
      for (const quality of [0.88, 0.78, 0.68, 0.58, 0.48]) {
        dataUrl = canvas.toDataURL(mime, quality);
        if (!dataUrl.startsWith('data:' + mime)) continue;
        if (Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4) <= 460 * 1024) break;
      }
      if (dataUrl && Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 3 / 4) <= 460 * 1024) break;
    }
    if (!dataUrl || dataUrl.length > 680000) throw new Error(uiEnNow() ? 'The image is still too large after compression' : '图片压缩后仍然过大');
    return dataUrl;
  }

  function setChipSelection(selector, values) {
    const wanted = new Set(values || []);
    if (!wanted.size) return;
    document.querySelectorAll(`#planForm [${selector}] .chip`).forEach((chip) => {
      chip.classList.toggle('active', wanted.has(chip.dataset.value));
    });
  }

  function mapDietary(values) {
    const map = [
      [/不.*辣|少辣|忌辣/, '不吃辣'],
      [/素|plant/i, '素食'],
      [/清真|halal/i, '清真'],
      [/海鲜|seafood/i, '海鲜过敏'],
      [/坚果|花生|nut/i, '花生坚果过敏'],
      [/乳糖|奶|milk|lactose/i, '乳糖不耐']
    ];
    return map.filter(([pattern]) => (values || []).some((item) => pattern.test(String(item)))).map(([, value]) => value);
  }

  function mapInterests(values) {
    const map = [
      [/自然|山|湖|风景|nature/i, '自然风光'],
      [/历史|人文|history|heritage/i, '历史人文'],
      [/美食|food/i, '美食'],
      [/博物馆|museum/i, '博物馆'],
      [/海|沙滩|海滨|beach/i, '海滨玩水'],
      [/古城|老街|古镇|old town/i, '古城老街'],
      [/夜景|night/i, '夜景'],
      [/亲子|乐园|children|kids/i, '亲子乐园']
    ];
    return map.filter(([pattern]) => (values || []).some((item) => pattern.test(String(item)))).map(([, value]) => value);
  }

  function applyVisionFields(fields) {
    const fill = (id, value) => {
      if (value === undefined || value === null || value === '') return false;
      document.getElementById(id).value = value;
      return true;
    };
    let count = 0;
    count += fill('pl-dest', fields.destination) ? 1 : 0;
    count += fill('pl-origin', fields.origin) ? 1 : 0;
    count += fill('pl-start', fields.startDate) ? 1 : 0;
    count += fill('pl-end', fields.endDate) ? 1 : 0;
    count += fill('pl-elderly', fields.elderly) ? 1 : 0;
    count += fill('pl-adults', fields.adults) ? 1 : 0;
    count += fill('pl-children', fields.children) ? 1 : 0;
    const dietary = mapDietary(fields.dietary);
    const interests = mapInterests(fields.interests);
    if (dietary.length) { setChipSelection('data-multi="pl-dietary"', dietary); count++; }
    if (interests.length) { setChipSelection('data-multi="pl-interests"', interests); count++; }
    if (fields.notes) {
      const notes = document.getElementById('pl-notes');
      const prefix = uiEnNow() ? 'Imported from screenshot: ' : '截图识别补充：';
      notes.value = [notes.value.trim(), prefix + fields.notes].filter(Boolean).join('\n');
      count++;
    }
    document.getElementById('pl-start').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('pl-end').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('planForm').dispatchEvent(new Event('input', { bubbles: true }));
    return count;
  }

  async function recognizeGuideImage(file) {
    const btn = document.getElementById('pl-vision-btn');
    const preview = document.getElementById('pl-vision-preview');
    if (btn) btn.disabled = true;
    try {
      planVisionStatus(uiEnNow() ? 'Compressing image…' : '正在压缩图片…');
      const image = await compressGuideImage(file);
      if (preview) {
        preview.src = image;
        preview.hidden = false;
      }
      planVisionStatus(uiEnNow() ? 'Reading guide screenshot…' : '正在识别攻略截图…');
      const result = await app.api('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app.aiPayload({ image }))
      });
      const count = applyVisionFields(result.fields || {});
      const warnings = (result.fields && result.fields.warnings) || [];
      planVisionStatus(
        (uiEnNow() ? `Filled ${count} fields — please review. ` : `已预填 ${count} 项，请核对。`) + warnings.join(' ')
      );
      app.toast(uiEnNow() ? 'Screenshot fields added — review before generating' : '截图信息已预填，请核对后生成');
    } catch (error) {
      planVisionStatus(error.message || (uiEnNow() ? 'Recognition failed' : '识别失败'), true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- 表单草稿自动保存（切页不丢） ---------- */
  const DRAFT_KEY = 'jyh_plan_draft';
  let draftTimer = null;
  function collectDraft() {
    const chips = (sel) => [...document.querySelectorAll(`#planForm [${sel}] .chip.active`)].map((c) => c.dataset.value);
    return {
      dest: document.getElementById('pl-dest').value,
      origin: document.getElementById('pl-origin').value,
      returnDest: document.getElementById('pl-return') ? document.getElementById('pl-return').value : '',
      start: document.getElementById('pl-start').value,
      end: document.getElementById('pl-end').value,
      days: document.getElementById('pl-days').value,
      transport: chips('data-single="pl-transport"')[0] || '',
      travelTime: chips('data-single="pl-time"')[0] || '',
      elderly: document.getElementById('pl-elderly').value,
      adults: document.getElementById('pl-adults').value,
      children: document.getElementById('pl-children').value,
      dietary: chips('data-multi="pl-dietary"'),
      budget: chips('data-single="pl-budget"')[0] || '',
      pace: chips('data-single="pl-pace"')[0] || '',
      accommodation: chips('data-single="pl-stay"')[0] || '',
      interests: chips('data-multi="pl-interests"'),
      notes: document.getElementById('pl-notes').value
    };
  }
  function scheduleDraftSave() {
    try { renderChangeHint(); } catch (e) { /* 忽略 */ }
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft())); } catch (e) {} }, 300);
  }
  function restoreFormData(d) {
    if (!d) return;
    document.getElementById('pl-dest').value = d.dest || '';
    document.getElementById('pl-origin').value = d.origin || '';
    if (document.getElementById('pl-return')) document.getElementById('pl-return').value = d.returnDest || '';
    document.getElementById('pl-start').value = d.start || '';
    document.getElementById('pl-end').value = d.end || '';
    if (d.days) document.getElementById('pl-days').value = d.days;
    document.getElementById('pl-elderly').value = d.elderly || 2;
    document.getElementById('pl-adults').value = d.adults || 2;
    document.getElementById('pl-children').value = d.children || 1;
    document.getElementById('pl-notes').value = d.notes || '';
    const setChips = (sel, arr) => { [...document.querySelectorAll(`#planForm [${sel}] .chip`)].forEach((c) => c.classList.toggle('active', (arr || []).includes(c.dataset.value))); };
    if (d.transport) setChips('data-single="pl-transport"', [d.transport]);
    if (d.travelTime) setChips('data-single="pl-time"', [d.travelTime]);
    if (d.dietary && d.dietary.length) setChips('data-multi="pl-dietary"', d.dietary);
    if (d.budget) setChips('data-single="pl-budget"', [d.budget]);
    if (d.pace) setChips('data-single="pl-pace"', [d.pace]);
    if (d.accommodation) setChips('data-single="pl-stay"', [d.accommodation]);
    if (d.interests && d.interests.length) setChips('data-multi="pl-interests"', d.interests);
  }
  function restoreDraft() {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d) restoreFormData(d); } catch (e) { /* 忽略 */ }
  }
  /* ---------- 历史生成记录（小内存，仅存问题概要） ---------- */
  const HIST_KEY = 'jyh_plan_history_v2';
  const HIST_MAX = 20;
  function loadHistory() { try { const a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveHistory(arr) { try { localStorage.setItem(HIST_KEY, JSON.stringify(arr.slice(0, HIST_MAX))); } catch (e) {} }
  function saveHistoryEntry(d) {
    const entry = { ts: Date.now(), ...d };
    const signature = [d.dest || '', d.origin || '', d.start || '', d.end || ''].join('|');
    const arr = loadHistory().filter((item) => [item.dest || '', item.origin || '', item.start || '', item.end || ''].join('|') !== signature);
    arr.unshift(entry);
    saveHistory(arr);
  }
  function histLabel(d) {
    const en = !!(window.i18n && window.i18n.lang === 'en');
    const tr = (s) => (en && window.i18n ? window.i18n.t(s) : s);
    const dt = d.ts ? new Date(d.ts) : null;
    const when = dt ? (dt.getMonth() + 1) + '-' + dt.getDate() + ' ' + ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2) : '';
    const dest = tr(d.dest || (en ? 'Destination' : '目的地'));
    const from = tr(d.origin || (en ? 'Unknown' : '未知'));
    const days = d.days || '?';
    const ret = d.returnDest ? (en ? ' · via ' + tr(d.returnDest) : '·返' + d.returnDest) : '';
    const note = d.notes ? (' · ' + d.notes) : '';
    return (when ? when + ' ' : '') + from + ' → ' + dest + ' ' + days + (en ? ' days' : '天') + ret + note;
  }
  /* 把历史功能上线前的最后一条生成补进历史（一次性迁移） */
  function migrateLastPlan() {
    try {
      const p = loadLast();
      if (!p || !p.result || !p.vals) return;
      const v = p.vals;
      const dest = v.destinationId === 'custom' ? (v.customDest && v.customDest.name) || '' : ((app.state.destinations.find((x) => x.id === v.destinationId) || {}).name || '');
      const d = {
        ts: p.ts || Date.now(),
        dest: dest || '',
        origin: v.origin || '',
        returnDest: v.returnDest || '',
        start: v.startDate || '',
        end: v.endDate || '',
        days: String(v.days || ''),
        transport: v.transport || '',
        travelTime: v.travelTime || '',
        notes: v.notes || ''
      };
      if (d.dest || d.origin) saveHistory([d]);
    } catch (e) { /* 忽略 */ }
  }

  function renderHistory() {
    const box = document.getElementById('planHistory');
    const list = document.getElementById('planHistoryList');
    if (!box || !list) return;
    const arr = loadHistory();
    box.hidden = !arr.length;
    const cnt = document.getElementById('plHistCount');
    if (cnt) cnt.textContent = arr.length ? String(arr.length) : '';
    const clr = document.getElementById('plHistClear');
    if (clr) clr.hidden = !arr.length;
    list.innerHTML = arr.map((d, i) => `
      <div class="hist-item" data-i="${i}" role="button" tabindex="0" title="点击恢复此前的填写">
        <span class="hist-text">${app.esc(histLabel(d))}</span>
        <button class="hist-del" data-del="${i}" type="button" aria-label="删除">✕</button>
      </div>`).join('') || '';
  }
  function bindHistory() {
    const tg = document.getElementById('plHistToggle');
    if (tg) tg.addEventListener('click', () => {
      const body = document.getElementById('planHistoryList');
      if (!body) return;
      const willOpen = body.hidden;
      body.hidden = !willOpen;
      tg.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    const clear = document.getElementById('plHistClear');
    if (clear) clear.addEventListener('click', () => { saveHistory([]); renderHistory(); });
    const list = document.getElementById('planHistoryList');
    if (list) list.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        const arr = loadHistory();
        arr.splice(Number(del.dataset.del), 1);
        saveHistory(arr);
        renderHistory();
        return;
      }
      const item = e.target.closest('.hist-item[data-i]');
      if (item) {
        const d = loadHistory()[Number(item.dataset.i)];
        if (d) { restoreFormData(d); app.toast('已恢复该次填写，可重新生成'); }
      }
    });
  }


  const LAST_KEY = 'jyh_last_plan_v2';
  /* 保存「上次生成」：localStorage 持久（关掉浏览器也还在）+ sessionStorage 兼容旧数据 */
  function saveLast(data) {
    const payload = JSON.stringify(Object.assign({ ts: Date.now() }, data));
    try { localStorage.setItem(LAST_KEY, payload); } catch (e) { /* 忽略 */ }
    try { sessionStorage.setItem(LAST_KEY, payload); } catch (e) { /* 忽略 */ }
  }
  function clearLast() {
    try { localStorage.removeItem(LAST_KEY); } catch (e) { /* 忽略 */ }
    try { sessionStorage.removeItem(LAST_KEY); } catch (e) { /* 忽略 */ }
  }
  /* 读取「上次生成」：两个存储都看，取时间较新的那条
     （修复：以前写入用 sessionStorage、读取用 localStorage，导致刷新后显示很久以前的旧方案） */
  function loadLast() {
    const pick = (s) => { try { return JSON.parse(s || 'null'); } catch (e) { return null; } };
    const a = pick(localStorage.getItem(LAST_KEY));
    const b = pick(sessionStorage.getItem(LAST_KEY));
    if (a && b) return (a.ts || 0) >= (b.ts || 0) ? a : b;
    return a || b;
  }
  function savePlan(vals, result) {
    saveLast({ vals, result, lang: (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh' });
    app.recordTrip(vals, result);
  }
  /* ---------- 增量修改：检测用户改了哪里 ---------- */
  const CHANGE_LABELS = {
    destinationName: { zh: '目的地', en: 'Destination' },
    origin: { zh: '出发城市', en: 'Departure city' },
    returnDest: { zh: '返回目的地', en: 'Return' },
    startDate: { zh: '去程日期', en: 'Departure date' },
    endDate: { zh: '返程日期', en: 'Return date' },
    days: { zh: '天数', en: 'Days' },
    transport: { zh: '交通方式', en: 'Transport' },
    travelTime: { zh: '出行时段', en: 'Time of day' },
    elderly: { zh: '老人', en: 'Seniors' },
    adults: { zh: '成人', en: 'Adults' },
    children: { zh: '儿童', en: 'Children' },
    dietary: { zh: '忌口', en: 'Dietary' },
    budget: { zh: '预算', en: 'Budget' },
    pace: { zh: '节奏', en: 'Pace' },
    accommodation: { zh: '住宿', en: 'Stay' },
    interests: { zh: '兴趣', en: 'Interests' },
    notes: { zh: '其他需求', en: 'Notes' }
  };
  const uiEnNow = () => !!(window.i18n && window.i18n.lang === 'en');
  const fmtVal = (v) => (Array.isArray(v) ? (v.length ? v.join('、') : '—') : (v === '' || v == null ? '—' : String(v)));
  function lastPlanRecord() {
    return loadLast();
  }
  function diffVals(prev, next) {
    if (!prev || !next) return [];
    const out = [];
    Object.keys(CHANGE_LABELS).forEach((k) => {
      const a = fmtVal(prev[k]); const b = fmtVal(next[k]);
      if (String(a) !== String(b)) out.push({ field: k, from: a, to: b });
    });
    return out;
  }
  /* 目的地/出发地变了 → 整套重生成；否则只改受影响部分 */
  function patchDecision(vals, changes) {
    const rec = lastPlanRecord();
    if (!rec || !rec.result || !rec.vals) return null;
    const regen = changes.some((c) => c.field === "destinationName" || c.field === "origin");
    return { enabled: !regen, changes, prevVals: rec.vals, prevResult: rec.result };
  }
  function renderChangeHint() {
    const el = document.getElementById('planChangeHint');
    if (!el) return;
    const en = uiEnNow();
    let dec = null;
    try { const v = planFormValues(); dec = patchDecision(v, diffVals((lastPlanRecord() || {}).vals, v)); } catch (e) { dec = null; }
    if (!dec) { el.hidden = true; el.textContent = ""; return; }
    const names = dec.changes.map((c) => { const L = CHANGE_LABELS[c.field]; return (en ? L.en : L.zh) + ': ' + c.from + ' → ' + c.to; }).join(en ? '; ' : '；');
    const mode = dec.enabled
      ? (en ? 'only the affected parts will be updated (the rest is kept)' : '将只修改相关部分（其余保留）')
      : (en ? 'the destination changed, so the whole plan will be regenerated' : '目的地已变更，将重新规划整套行程');
    el.textContent = '🔄 ' + (en ? 'Since last generation — ' : '相比上次生成：') + (names || (en ? 'no changes' : '没有改动')) + ' → ' + mode;
    el.hidden = false;
  }

  async function generatePlan() {
    const empty = document.getElementById('planEmpty');
    const bodyEl = document.getElementById('planBody');
    // 硬性必填：城市 + 日期（缺失就在输出框提示，不调 AI）
    const problems = [];
    const uiEn = !!(window.i18n && window.i18n.lang === 'en');
    if (!document.getElementById('pl-origin').value.trim()) problems.push(uiEn ? 'departure city missing' : '出发城市没填写');
    if (!document.getElementById('pl-dest').value.trim()) problems.push(uiEn ? 'destination missing' : '目的地城市没填写');
    if (!document.getElementById('pl-start').value) problems.push(uiEn ? 'departure date missing' : '去程日期没选择');
    if (!document.getElementById('pl-end').value) problems.push(uiEn ? 'return date missing' : '返程日期没选择');
    if (problems.length) {
      document.body.classList.add('plan-has-result');
      empty.hidden = true; bodyEl.hidden = false;
      bodyEl.innerHTML = uiEn
        ? `<div class="ai-feedback">🐱 AI planner: ${problems.map((x) => '“' + x + '”').join(', ')} — please fill these in and generate again.</div>`
        : `<div class="ai-feedback">🐱 AI 主理人：${problems.map((x) => '「' + x + '」').join('、')}，请补全后再生成。</div>`;
      return;
    }
    // 出发与目的地不能同城（否则行程无参考价值，不调 AI）
    const originRaw2 = document.getElementById('pl-origin').value.trim();
    const destRaw2 = document.getElementById('pl-dest').value.trim();
    if (originRaw2 && destRaw2 && app.normCity(originRaw2) === app.normCity(destRaw2)) {
      document.body.classList.add('plan-has-result');
      empty.hidden = true; bodyEl.hidden = false;
      bodyEl.innerHTML = uiEn
        ? `<div class="ai-feedback">🐱 AI planner: your departure city and destination are both “${app.esc(destRaw2)}” — please choose a different destination.</div>`
        : `<div class="ai-feedback">🐱 AI 主理人：出发城市和目的地是同一个城市「${app.esc(destRaw2)}」，行程没有参考价值，请换个目的地。</div>`;
      return;
    }
    revisionToken += 1;
    setRevisionBusy(false);
    planUndoStack.length = 0;
    document.querySelectorAll('.chat-revision-preview').forEach((el) => el.remove());
    const vals = planFormValues();
    document.body.classList.add('plan-has-result');
    empty.hidden = true; bodyEl.hidden = false;
    bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>AI 主理人正在后台生成行程…<br/>你可以放心切到别的页面/标签页，回来会自动恢复显示结果</p>';
    try {
      const changes = diffVals((lastPlanRecord() || {}).vals, vals);
      const dec = patchDecision(vals, changes);
      const enNow = uiEnNow();
      const patch = dec ? { enabled: dec.enabled, changes: dec.changes.map((x) => Object.assign({}, x, { label: (CHANGE_LABELS[x.field] || {})[enNow ? 'en' : 'zh'] || x.field })), previous: dec.enabled ? { vals: dec.prevVals, result: dec.prevResult } : null } : null;
      clearLast();
      const st = await app.api('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(app.aiPayload(Object.assign({}, vals, { patch }))) });
      saveLast({ jobId: st.jobId, vals, result: null, lang: (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh' });
      app.pollJob(st.jobId, {
        onProgress: (progress) => {
          if (!progress) return;
          const message = progress.summary || progress.message || '';
          const name = progress.name ? ({ search_travel_knowledge: '检索本地知识', get_transport_options: '查询 12306', get_weather_forecast: '查询天气' }[progress.name] || progress.name) : '';
          bodyEl.innerHTML = `<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>${uiEn ? 'AI planner is working…' : 'AI 主理人正在工作…'}<br/><span class="agent-progress">${app.esc(name || message || '正在生成行程')}${name && message ? ' · ' + app.esc(message) : ''}</span></p>`;
        },
        onDone: (result) => {
          renderPlan(bodyEl, result, vals);
          savePlan(vals, result);
          saveHistoryEntry(collectDraft());
          renderHistory();
          revealPlanResult();
        },
        onError: (msg) => {
          clearLast();
          bodyEl.innerHTML = `<div class="ai-feedback">${uiEn ? '🐱 AI planner: ' : '🐱 AI 主理人：'}${app.esc(msg)}</div>`;
        }
      });
    } catch (e) {
      // 校验类错误（400）直接显示在输出框（含 AI 猜城市）
      const msg = (e && e.message) || '生成失败';
      bodyEl.innerHTML = `<div class="ai-feedback">${uiEn ? '🐱 AI planner: ' : '🐱 AI 主理人：'}${app.esc(msg)}</div>`;
    }
  }
  function restorePlan() {
    const bodyEl = document.getElementById('planBody');
    const empty = document.getElementById('planEmpty');
    if (!bodyEl) return;
    try {
      const p = loadLast();
      if (!p) return;
      if (p.result) {
        app.recordTrip(p.vals, p.result);
        empty.hidden = true; bodyEl.hidden = false;
        document.body.classList.remove('plan-workspace-mode');
        const workspace = document.getElementById('desktopPlanWorkspace');
        if (workspace) workspace.hidden = true;
        renderRestoredPlan(bodyEl, p.result, p.vals);
        showLangMismatch(p);
        return;
      }
      if (p.jobId) {
        const age = Date.now() - Number(p.ts || 0);
        if (!p.ts || age > 5 * 60 * 1000) {
          clearLast();
          app.toast(uiEnNow() ? 'Expired unfinished task cleared' : '上次未完成的生成已过期，已清理');
          return;
        }
        empty.hidden = true; bodyEl.hidden = false;
        bodyEl.innerHTML = '<p style="padding:60px;text-align:center;color:var(--ink-soft)"><span class="spinner"></span>上次的生成任务还在后台跑，正在恢复…</p>';
        app.pollJob(p.jobId, {
          onDone: (result) => {
            renderPlan(bodyEl, result, p.vals);
            savePlan(p.vals, result);
            saveHistoryEntry(collectDraft());
            renderHistory();
            revealPlanResult();
          },
          onError: () => {
            clearLast();
            bodyEl.innerHTML = '<p style="padding:40px;text-align:center;color:var(--ink-soft)">上次任务已结束或过期，已清理，请重新生成</p>';
          }
        });
      }
    } catch (e) { /* 忽略 */ }
  }
  function renderRestoredPlan(el, data, vals) {
    const days = Array.isArray(data.days) ? data.days.length : 0;
    const travelers = Number(vals.elderly || 0) + Number(vals.adults || 0) + Number(vals.children || 0);
    const budget = data.budget && data.budget.totalPerPerson ? data.budget.totalPerPerson : '';
    renderedPlan = { data, vals };
    document.body.classList.add('plan-has-result');
    el.innerHTML = `
      <div class="result-head">
        <h3>🗺️ ${app.esc(data.title || '上次行程规划')}</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🐱 AI 主理人生成' : '📋 最近一次规划'}</span>
      </div>
      ${data.summary ? `<p style="color:var(--ink-soft);margin-bottom:14px">${app.esc(data.summary)}</p>` : ''}
      <div class="restored-plan-summary">
        <span><b>${days}</b> 天行程</span>
        <span><b>${travelers || '—'}</b> 人同行</span>
        <span><b>${budget || '—'}</b> 人均预算</span>
      </div>
      <p class="form-hint">上次生成的行程已恢复。需要查看地图和逐日安排时再进入工作台。</p>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-open-workspace>进入地图工作台</button>
        <button class="btn btn-ghost" type="button" data-print-plan>打印 / 存为 PDF</button>
      </div>`;
  }
  /* 旧行程是在另一种语言下生成的：提示用户，并允许一键用当前语言重生成 */
  function showLangMismatch(p) {
    const bodyEl = document.getElementById('planBody');
    if (!bodyEl || !p || !p.result) return;
    const current = (window.i18n && window.i18n.lang === 'en') ? 'en' : 'zh';
    const saved = p.lang || '';
    const workspace = document.getElementById('desktopPlanWorkspace');
    const visibleHost = workspace && !workspace.hidden ? workspace : bodyEl;
    const hasChinese = /[\u4e00-\u9fff]/.test(visibleHost.innerText || '');
    const mismatch = (saved && saved !== current) || (current === 'en' && hasChinese);
    if (!mismatch) return;
    const notice = document.createElement('div');
    notice.className = 'ai-feedback';
    notice.style.marginBottom = '12px';
    notice.innerHTML = current === 'en'
      ? 'This itinerary was generated in Chinese. <button type="button" class="btn btn-primary" data-regen-lang style="margin-left:8px">Regenerate in English</button>'
      : '此行程是用英文生成的。 <button type="button" class="btn btn-primary" data-regen-lang style="margin-left:8px">用中文重新生成</button>';
    const btn = notice.querySelector('[data-regen-lang]');
    if (btn) btn.addEventListener('click', () => { notice.remove(); generatePlan(); });
    visibleHost.prepend(notice);
  }
  /* 手机上表单很长，生成完成后直接滚到结果，避免用户以为没生成 */
  function revealPlanResult() {
    if (window.innerWidth > 900) return;
    const el = document.getElementById('planResult');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function currentPlanData() {
    if (renderedPlan && renderedPlan.data && Array.isArray(renderedPlan.data.days)) return renderedPlan.data;
    const last = loadLast();
    return last && last.result && Array.isArray(last.result.days) ? last.result : null;
  }
  function compactCurrentPlan(plan) {
    if (!plan || !Array.isArray(plan.days)) return null;
    return {
      title: plan.title,
      summary: plan.summary,
      transportPlan: plan.transportPlan,
      budget: plan.budget,
      dietaryNotes: plan.dietaryNotes,
      tips: plan.tips,
      realTrains: plan.realTrains,
      days: plan.days.map((d) => ({
        day: d.day,
        dateLabel: d.dateLabel,
        title: d.title,
        schedule: d.schedule,
        meals: d.meals,
        transport: d.transport,
        accommodation: d.accommodation,
        costPerPerson: d.costPerPerson
      }))
    };
  }
  /* 问答上下文：把上方表单的行程信息 + 最近生成的方案一起送给 AI */
  function buildTripContext() {
    try {
      const v = planFormValues();
      let last = null;
      try { last = JSON.parse(sessionStorage.getItem(LAST_KEY) || localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { /* 忽略 */ }
      const plan = currentPlanData() || (last && last.result) || null;
      return {
        destinationId: v.destinationId,
        destinationName: document.getElementById('pl-dest').value.trim(),
        origin: v.origin, returnDest: v.returnDest,
        startDate: v.startDate, endDate: v.endDate, days: v.days,
        transport: v.transport, travelTime: v.travelTime,
        elderly: v.elderly, adults: v.adults, children: v.children,
        dietary: v.dietary, budget: v.budget, pace: v.pace,
        accommodation: v.accommodation, interests: v.interests, notes: v.notes,
        planTitle: (plan && plan.title) || '',
        currentPlan: compactCurrentPlan(plan)
      };
    } catch (e) { return null; }
  }

  // 旧缓存/AI 输出都再兜底去重一次：同一景点跨天只保留第一次
  function dedupePlanData(data) {
    if (!data || !Array.isArray(data.days)) return data;
    const en = !!(window.i18n && window.i18n.lang === 'en');
    const norm = (s) => String(s || '')
      .replace(/^(上午|中午|下午|晚上|清晨|早上)[：:\s]*/, '')
      .replace(/[（(][^）)]*[）)]/g, '')
      .replace(/[\s·・\-—_，,。；;:：\/]/g, '')
      .replace(/(博物院|博物馆|风景区|景区|旅游区|公园|广场|古城|古镇|老街|步行街)$/g, '')
      .toLowerCase();
    const place = (raw) => {
      let t = String(raw || '').trim();
      t = t.replace(/^(上午|中午|下午|晚上|清晨|早上)[：:\s]*/, '');
      t = t.replace(/^(morning|midday|afternoon|evening)[:\s-]*/i, '');
      t = t.replace(/^(前往|游览|参观|打卡|体验|漫步|慢逛)[：:\s]*/, '');
      t = t.replace(/^(visit|explore|walk|stroll|tour|discover|enjoy)\s+/i, '');
      if (!t) return '';
      if (/^(早餐|午餐|晚餐|用餐|抵达|返回|返程|入住|退房|自由活动|休息|出发|前往酒店|回酒店|市区漫步|周边漫步|城市慢游|夜景|美食街|购物|乘车|高铁|飞机|自驾|办理入住|行程结束)/.test(t)) return '';
      if (/^(breakfast|lunch|dinner|arrive|return|check in|check out|free time|rest|depart|head back|travel home|pack)/i.test(t)) return '';
      return t;
    };
    const seen = [];
    data.days.forEach((day) => {
      (day.schedule || []).forEach((item) => {
        const at = place(item.activity);
        if (!at) return;
        const key = norm(at);
        if (!key) return;
        if (seen.some((x) => x === key || (x.length >= 2 && key.length >= 2 && (x.includes(key) || key.includes(x))))) {
          item.activity = en ? 'Free time / neighbourhood stroll' : '自由活动 / 周边漫步';
          item.detail = en ? 'No repeat visits — time left for rest and a relaxed stroll.' : '为避免重复景点，留出自由活动与休息时间。';
        } else {
          seen.push(key);
        }
      });
    });
    return data;
  }

  /* ---------- 电脑端：地图工作台 ---------- */
  function renderDesktopWorkspace(data, vals, ctx) {
    desktopData = data;
    desktopVals = vals;
    desktopCtx = ctx || {};
    dpwWeatherCache = null;
    desktopHighlights = [];
    desktopHighlightsToken += 1;
    const shell = document.getElementById('desktopPlanWorkspace');
    if (!shell) return;
    document.body.classList.add('plan-workspace-mode');
    const bodyEl = document.getElementById('planBody');
    if (bodyEl) bodyEl.hidden = true;
    const topbar = document.getElementById('dpwTopbar');
    if (topbar) {
      topbar.innerHTML = `
        <div><h2>${app.esc(data.title || '行程规划')}</h2><p>${app.esc(data.summary || '')}</p></div>
        <span class="dpw-spacer"></span>
        <button class="btn btn-ghost" type="button" data-dpw-back>← 返回修改</button>
        <button class="btn btn-ghost" type="button" data-dpw-word>导出 Word</button>
        <button class="btn btn-ghost" type="button" data-dpw-image>保存图片</button>`;
    }
    const mapHost = document.getElementById('dpwMapHost');
    if (mapHost) {
      mapHost.innerHTML = `<div class="plan-map-shell dpw-map-shell" id="planMapShell">
        <div class="dpw-map-head"><b>🗺️ 行程地图</b><span id="planMapStatus" class="plan-map-status"></span></div>
        <div id="planMap" class="dpw-map-canvas"></div>
        <div id="planMapStops" hidden></div>
      </div>`;
    }
    renderDesktopItinerary();
    renderDesktopInfo(dpwInfoTab);
    shell.hidden = false;
    bindDesktopWorkspace();
    const token = desktopHighlightsToken;
    loadDesktopHighlights(vals.destinationId, token);
    setTimeout(() => {
      if (window.planMap && desktopData) {
        Promise.resolve(window.planMap.build(desktopData, desktopVals));
      }
    }, 80);
  }

  function loadDesktopHighlights(destinationId, token) {
    if (!destinationId || destinationId === 'custom') { renderDesktopItinerary(); return; }
    app.api('/api/destinations/' + encodeURIComponent(destinationId)).then((data) => {
      if (token !== desktopHighlightsToken || !desktopData) return;
      const base = (data.destination && data.destination.highlights) || [];
      desktopHighlights = base.slice(0, 10);
      renderDesktopItinerary();
    }).catch(() => { renderDesktopItinerary(); });
  }

  function renderDesktopItinerary() {
    const box = document.getElementById('dpwItinerary');
    if (!box || !desktopData) return;
    const colors = ['#0f766e', '#f97316', '#2563eb', '#9333ea', '#dc2626'];
    const dayHtml = (desktopData.days || []).map((d, di) => {
      const color = colors[di % colors.length];
      const stops = (d.schedule || []).map((s, si) => `
        <div class="dpw-stop" data-dpw-stop data-day-index="${di}" data-schedule-index="${si}" data-activity="${app.esc(s.activity)}">
          <span class="dpw-drag" title="拖动排序">⠿</span>
          <div><b>${app.esc(s.activity)}</b><small>${app.esc(s.time || '')}${s.detail ? ' · ' + app.esc(s.detail) : ''}${s.source === 'manual' ? ' · 手动加入' : ''}</small></div>
          <button class="dpw-stop-del" type="button" data-dpw-del data-day-index="${di}" data-schedule-index="${si}" title="移除">×</button>
        </div>`).join('');
      return `<div class="dpw-day" style="--c:${color}">
        <div class="dpw-day-head"><span class="dpw-dot"></span>D${d.day} · ${app.esc(d.title || '')}</div>
        <div class="dpw-day-body" data-day-index="${di}">${stops || '<p class="dpw-empty">暂无安排</p>'}</div>
      </div>`;
    }).join('');
    const dayOptions = (desktopData.days || []).map((_, i) => `<option value="${i}">Day ${i + 1}</option>`).join('');
    const pool = `<div class="dpw-pool">
      <div class="dpw-pool-head"><h4>✨ 当前城市精选</h4><select id="dpwAddDay">${dayOptions}</select></div>
      <p class="dpw-pool-note">这里只是备选，不会自动加入行程；选择 Day 后点击“加入行程”才会写入。</p>
      ${desktopHighlights.length ? desktopHighlights.map((h, i) => `<div class="dpw-pool-row"><span>${app.esc(h.title || '')}</span><button type="button" data-dpw-add data-hl-index="${i}">加入行程</button></div>`).join('') : '<p class="dpw-empty">当前城市暂无内置精选景点，可继续查看上方 AI 行程。</p>'}
    </div>`;
    box.innerHTML = dayHtml + pool;
    initDesktopSortables();
  }

  function initDesktopSortables() {
    desktopSortables.forEach((s) => { try { s.destroy(); } catch (e) { /* ignore */ } });
    desktopSortables = [];
    if (!window.Sortable) return;
    document.querySelectorAll('#dpwItinerary .dpw-day-body').forEach((el) => {
      desktopSortables.push(new Sortable(el, {
        group: 'dpw-stops',
        handle: '.dpw-drag',
        draggable: '.dpw-stop',
        animation: 150,
        onEnd: (evt) => {
          const from = Number(evt.from.dataset.dayIndex);
          const to = Number(evt.to.dataset.dayIndex);
          if (!Number.isInteger(from) || !Number.isInteger(to) || !desktopData) return;
          const item = desktopData.days[from].schedule.splice(evt.oldIndex, 1)[0];
          if (!item) return;
          desktopData.days[to].schedule.splice(evt.newIndex, 0, item);
          savePlan(desktopVals, desktopData);
          renderDesktopItinerary();
          if (window.planMap) window.planMap.build(desktopData, desktopVals);
        }
      }));
    });
  }

  function renderDesktopInfo(tab = dpwInfoTab) {
    dpwInfoTab = tab;
    const box = document.getElementById('dpwInfo');
    if (!box || !desktopData) return;
    const tabs = `<div class="dpw-tabs">
      ${[['transport', '交通'], ['hotel', '酒店'], ['budget', '预算'], ['weather', '天气'], ['tips', '建议'], ['sources', '依据']].map(([k, l]) => `<button type="button" data-dpw-tab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}
    </div>`;
    let body = '';
    let needWeather = false;
    if (tab === 'transport') {
      const rtHtml = (desktopCtx && desktopCtx.rtHtml) || '';
      const tp = (desktopCtx && desktopCtx.tp) || {};
      const tpHtml = tp.outbound || tp.inbound || tp.local ? `<div class="transport-box"><h4>🚄 交通安排</h4>${tp.outbound ? `<p><b>去程：</b>${app.esc(tp.outbound)}</p>` : ''}${tp.inbound ? `<p><b>返程：</b>${app.esc(tp.inbound)}</p>` : ''}${tp.local ? `<p><b>当地：</b>${app.esc(tp.local)}</p>` : ''}</div>` : '';
      body = (rtHtml || '<p class="dpw-empty">暂无 12306 实时车次数据。</p>') + tpHtml;
    } else if (tab === 'budget') {
      const b = desktopData.budget || {};
      body = `<div class="budget-box"><h4>💰 费用估算（人均）</h4>${b.transport ? `<p>🚄 ${app.esc(b.transport)}</p>` : ''}${b.accommodation ? `<p>🏨 ${app.esc(b.accommodation)}</p>` : ''}${b.meals ? `<p>🍜 ${app.esc(b.meals)}</p>` : ''}${b.tickets ? `<p>🎫 ${app.esc(b.tickets)}</p>` : ''}${b.totalPerPerson ? `<p class="total">合计：${app.esc(b.totalPerPerson)}</p>` : ''}${b.note ? `<p style="font-size:.85rem">${app.esc(b.note)}</p>` : ''}</div>`;
    } else if (tab === 'weather') {
      body = '<p class="dpw-empty">正在获取天气…</p>';
      needWeather = true;
    } else if (tab === 'tips') {
      const d = desktopData.dietaryNotes || [];
      const t = desktopData.tips || [];
      body = `${d.length ? `<div class="dietary-box"><h4>🥢 忌食与用餐提醒</h4><ul>${d.map((n) => `<li>${app.esc(n)}</li>`).join('')}</ul></div>` : ''}${t.length ? `<div class="tips-box"><strong>💡 出行提醒</strong><ul>${t.map((n) => `<li>${app.esc(n)}</li>`).join('')}</ul></div>` : '<p class="dpw-empty">暂无额外建议。</p>'}`;
    } else if (tab === 'hotel') {
      body = `<p class="dpw-empty">只搜索当前城市的酒店；选中后定位到地图。</p><div class="dpw-hotel-search"><input id="dpwHotelSearch" placeholder="输入酒店名，如 王府井 / 国贸" /><button type="button" id="dpwHotelSearchBtn">搜索</button></div><div id="dpwHotelResults"><p class="dpw-empty">输入关键词搜索，或直接搜“酒店”。</p></div>`;
    } else if (tab === 'sources') {
      const citations = desktopData.citations || [];
      const trace = desktopData.toolTrace || [];
      const traceHtml = trace.length
        ? `<div class="agent-trace"><h4>🧰 Agent 工具轨迹</h4><ol>${trace.map((item) => `<li><b>${app.esc(item.name)}</b><span>${app.esc(item.summary || (item.ok ? '已完成' : '失败'))}</span><small>${Number(item.durationMs || 0)} ms${item.source === 'system-fallback' ? ' · 系统兜底' : ''}</small></li>`).join('')}</ol></div>`
        : '';
      body = citations.length
        ? traceHtml + `<div class="source-box"><h4>🔎 本行程采用的依据</h4><p class="source-note">由本地知识库检索生成，点击可查看对应目的地或规则页。</p><ol class="source-list">${citations.map((item) => `<li><a href="${app.esc(item.url)}" target="_blank" rel="noopener"><b>${app.esc(item.title)}</b></a><span>${app.esc(item.snippet)}</span><small>${app.esc(item.source)} · 匹配度 ${Number(item.score || 0).toFixed(2)}</small></li>`).join('')}</ol></div>`
        : traceHtml + '<p class="dpw-empty">本次生成未命中本地知识片段。</p>';
    }
    box.innerHTML = tabs + `<div id="dpwInfoBody">${body}</div>`;
    if (needWeather) loadDesktopWeather();
    if (tab === 'hotel') {
      const input = document.getElementById('dpwHotelSearch');
      const btn = document.getElementById('dpwHotelSearchBtn');
      const run = () => searchDesktopHotels(input ? input.value.trim() : '');
      if (btn) btn.onclick = run;
      if (input) input.onkeydown = (e) => { if (e.key === 'Enter') run(); };
    }
  }

  function loadDesktopWeather() {
    const body = document.getElementById('dpwInfoBody');
    if (!body || !desktopVals) return;
    const dest = app.state.destinations.find((d) => d.id === desktopVals.destinationId);
    if (!dest || !dest.id) { body.innerHTML = '<p class="dpw-empty">当前目的地暂无天气数据。</p>'; return; }
    const finish = (data) => {
      if (dpwInfoTab !== 'weather') return;
      let days = data.days || [];
      if (desktopVals.startDate && desktopVals.endDate) days = days.filter((d) => d.date >= desktopVals.startDate && d.date <= desktopVals.endDate);
      days = days.slice(0, 6);
      body.innerHTML = days.length ? days.map((d) => `<div class="dpw-weather-row"><span>${app.esc(d.date.slice(5))} ${app.esc(d.weekday)}</span><span>${d.icon} ${app.esc(d.label)}</span><b>${d.tmin}°~${d.tmax}°</b></div>`).join('') : '<p class="dpw-empty">所选日期暂无预报。</p>';
    };
    if (dpwWeatherCache) { finish(dpwWeatherCache); return; }
    app.api('/api/weather?id=' + encodeURIComponent(dest.id)).then((data) => { dpwWeatherCache = data; finish(data); }).catch(() => {
      if (dpwInfoTab === 'weather') body.innerHTML = '<p class="dpw-empty">天气暂时获取失败。</p>';
    });
  }

  function searchDesktopHotels(keyword) {
    const box = document.getElementById('dpwHotelResults');
    if (!box || !desktopVals) return;
    const dest = app.state.destinations.find((d) => d.id === desktopVals.destinationId);
    if (!dest || !dest.name) { box.innerHTML = '<p class="dpw-empty">当前目的地不支持酒店搜索。</p>'; return; }
    if (!window.AMap) { box.innerHTML = '<p class="dpw-empty">高德地图尚未加载，请稍后再试。</p>'; return; }
    box.innerHTML = '<p class="dpw-empty">正在搜索当前城市酒店…</p>';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      box.innerHTML = '<p class="dpw-empty">酒店搜索超时，请稍后再试。</p>';
    }, 5000);
    AMap.plugin(['AMap.PlaceSearch'], () => {
      try {
        const search = new AMap.PlaceSearch({ city: dest.name, citylimit: true, type: '100000', pageSize: 10, extensions: 'all' });
        search.search(keyword || '酒店', (status, result) => {
          clearTimeout(timer);
          if (done) return;
          done = true;
          if (status !== 'complete') { box.innerHTML = '<p class="dpw-empty">酒店搜索暂不可用，请稍后再试。</p>'; return; }
          const pois = (result.poiList && result.poiList.pois) || [];
          const hotels = pois.map((p) => {
            const loc = p.location || {};
            const lng = Number(typeof loc.getLng === 'function' ? loc.getLng() : loc.lng);
            const lat = Number(typeof loc.getLat === 'function' ? loc.getLat() : loc.lat);
            return { name: p.name || '酒店', address: p.address || p.cityname || '', lng, lat };
          }).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
          box.innerHTML = hotels.length ? hotels.map((h) => `<div class="dpw-hotel-row"><b>${app.esc(h.name)}</b><small>${app.esc(h.address)}</small><button type="button" data-dpw-hotel data-lng="${h.lng}" data-lat="${h.lat}" data-name="${encodeURIComponent(h.name)}">定位到地图</button></div>`).join('') : '<p class="dpw-empty">没有找到当前城市的酒店。</p>';
        });
      } catch (e) {
        clearTimeout(timer);
        done = true;
        box.innerHTML = '<p class="dpw-empty">酒店搜索失败，请稍后再试。</p>';
      }
    });
  }

  function backToForm() {
    document.body.classList.remove('plan-workspace-mode');
    const ws = document.getElementById('desktopPlanWorkspace');
    if (ws) ws.hidden = true;
    const body = document.getElementById('planBody');
    if (body) {
      body.hidden = false;
      body.innerHTML = '<div class="result-empty"><p>行程已生成，修改后可重新打开地图工作台。</p><button class="btn btn-primary" type="button" data-open-workspace>打开地图工作台</button></div>';
      // 不再单独绑定 click：#planBody 上已有 [data-open-workspace] 的事件委托，
      // 两处同时绑会让一次点击执行两遍（工作台重建两次、地图 build 两次）。
    }
    const layout = document.querySelector('.plan-layout');
    if (layout) layout.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindDesktopWorkspace() {
    if (desktopBound) return;
    const ws = document.getElementById('desktopPlanWorkspace');
    if (!ws) return;
    desktopBound = true;
    ws.addEventListener('click', (e) => {
      if (e.target.closest('[data-dpw-back]')) { backToForm(); return; }
      if (e.target.closest('[data-dpw-word]')) { app.saveAsWord('dpwItinerary', '家游汇-行程规划'); return; }
      if (e.target.closest('[data-dpw-image]')) { app.saveAsImage('dpwItinerary', '家游汇-行程规划.png'); return; }
      const del = e.target.closest('[data-dpw-del]');
      if (del) {
        const di = Number(del.dataset.dayIndex);
        const si = Number(del.dataset.scheduleIndex);
        if (desktopData && desktopData.days[di] && desktopData.days[di].schedule) {
          desktopData.days[di].schedule.splice(si, 1);
          savePlan(desktopVals, desktopData);
          renderDesktopItinerary();
          if (window.planMap) window.planMap.build(desktopData, desktopVals);
        }
        return;
      }
      const stop = e.target.closest('[data-dpw-stop]');
      if (stop && !e.target.closest('button')) {
        document.querySelectorAll('#dpwItinerary .dpw-stop').forEach((el) => el.classList.toggle('active', el === stop));
        if (window.planMap && window.planMap.focusStop) {
          window.planMap.focusStop(Number(stop.dataset.dayIndex) + 1, stop.dataset.activity || '');
        }
        return;
      }
      const add = e.target.closest('[data-dpw-add]');
      if (add) {
        const h = desktopHighlights[Number(add.dataset.hlIndex)];
        const to = Number(document.getElementById('dpwAddDay').value) || 0;
        if (!h || !h.title || (desktopData.days[to].schedule || []).some((s) => String(s.activity || '').trim() === h.title)) return;
        desktopData.days[to].schedule.push({ time: '上午', activity: h.title, detail: h.text || '', source: 'manual' });
        savePlan(desktopVals, desktopData);
        renderDesktopItinerary();
        if (window.planMap) window.planMap.build(desktopData, desktopVals);
        return;
      }
      const tab = e.target.closest('[data-dpw-tab]');
      if (tab) { renderDesktopInfo(tab.dataset.dpwTab); return; }
      const hotel = e.target.closest('[data-dpw-hotel]');
      if (hotel) {
        const lng = Number(hotel.dataset.lng);
        const lat = Number(hotel.dataset.lat);
        const name = decodeURIComponent(hotel.dataset.name || '');
        if (window.planMap && window.planMap.focusHotel) window.planMap.focusHotel(lng, lat, name);
      }
    });
  }

  function renderPlan(el, data, vals) {
    data = dedupePlanData(data);
    renderedPlan = { data, vals };
    document.body.classList.add('plan-has-result');
    const dayHtml = (data.days || []).map((d, i) => `
      <div class="day-card" style="animation-delay:${(0.05 + i * 0.12).toFixed(2)}s">
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
    const rt = data.realTrains || {};
    const rtDisp = rt.display || {};
    const timeFb = rtDisp.timeFallbackNote ? `<p class="rt-fallback">⚠️ ${app.esc(rtDisp.timeFallbackNote)}</p>` : '';
    // 车次行：英文界面用英文座位名与时长格式
    const seatEn = { '二等座': '2nd class', '一等座': '1st class', '商务座': 'Business', '硬座': 'Hard seat', '硬卧': 'Hard sleeper', '软卧': 'Soft sleeper', '无座': 'Standing' };
    const uiEn = () => !!(window.i18n && window.i18n.lang === 'en');
    const durTxt = (d) => {
      const m = String(d || '').split(':');
      return m.length === 2 ? (Number(m[0]) + 'h ' + Number(m[1]) + 'm') : String(d || '');
    };
    const rtRow = (tr) => {
      const p = tr.prices || {};
      const en = uiEn();
      const pStr = ['二等座', '一等座', '商务座', '硬座', '硬卧', '软卧', '无座'].filter((k) => p[k])
        .map((k) => (en ? (seatEn[k] || k) + ' ¥' + p[k] : k + '¥' + p[k])).join(en ? ' · ' : ' ');
      const seats = [['二等座', tr.second], ['一等座', tr.first]].filter((x) => x[1] && x[1] !== '无')
        .map((x) => (en
          ? (seatEn[x[0]] || x[0]) + (x[1] === '有' ? ': available' : ': ' + x[1] + ' left')
          : (x[1] === '有' ? x[0] + '有票' : x[0] + '余' + x[1]))).join(' · ');
      const dur = en ? durTxt(tr.duration) : ('历时' + app.esc(tr.duration));
      return `<li><b>${app.esc(tr.no)}</b> ${app.esc(tr.fromTime)}–${app.esc(tr.toTime)} ${dur}${seats ? ' · ' + app.esc(seats) : ''}${pStr ? '<div class="rt-price">' + app.esc(pStr) + '</div>' : ''}</li>`;
    };
    const rtSection = (label, trains, note) => {
      const list = (trains && trains.length) ? `<ul class="rt-list">${trains.slice(0, 6).map(rtRow).join('')}</ul>` : '';
      const noteHtml = note ? `<p class="rt-note">${app.esc(note)}</p>` : '';
      return (list || noteHtml) ? `<p class="rt-label"><b>${app.esc(label)}</b></p>${list}${noteHtml}` : '';
    };
    const rtOut = rtSection(rtDisp.outboundLabel || '去程', rt.outbound, rtDisp.outboundNote);
    const rtIn = rtSection(rtDisp.inboundLabel || '返程', rt.inbound, rtDisp.inboundNote);
    const rtHtml = (rtOut || rtIn) ? `
      <div class="transport-box"><h4>🚄 12306 实时车次与票价</h4>
        ${timeFb}
        ${rtOut}
        ${rtIn}
        <p class="rt-foot">数据来自 12306 实时官方查询，请以 12306 实际为准</p>
      </div>` : '';
    if (window.innerWidth > 900) {
      renderDesktopWorkspace(data, vals, { rtHtml, bg, tp, rt });
      return;
    }
    const mapHost = document.getElementById('dpwMapHost');
    if (mapHost) mapHost.innerHTML = '';
    document.body.classList.remove('plan-workspace-mode');
    el.innerHTML = `
      <div class="result-head">
        <h3>🗺️ ${app.esc(data.title || '行程规划')}</h3>
        <span class="provider-tag">${data.provider === 'ai' ? '🐱 AI 主理人生成 · ' + app.esc(data.model || '') : '📋 内置规划引擎'}</span>
      </div>
      ${data.aiError ? `<p class="form-hint" style="color:var(--danger)">AI 调用失败，已自动使用内置方案：${app.esc(data.aiError)}</p>` : ''}
      ${data.summary ? `<p style="color:var(--ink-soft);margin-bottom:14px">${app.esc(data.summary)}</p>` : ''}
      <div class="plan-map-cta" id="planMapCta">
        <div>
          <strong>🗺️ ${uiEn() ? 'Map plan' : '地图规划'}</strong>
          <span>${uiEn() ? 'Confirm the text itinerary, then generate a day-by-day map route.' : '确认文字行程后，生成逐日地点与路线地图。'}</span>
        </div>
        <button class="btn btn-primary" type="button" data-build-map>${uiEn() ? 'Generate map' : '生成地图规划'}</button>
      </div>
      <div class="plan-map-shell" id="planMapShell" hidden>
        <div class="plan-map-toolbar">
          <strong>🗺️ ${uiEn() ? 'Map plan' : '地图规划'}</strong>
          <span id="planMapStatus" class="plan-map-status"></span>
          <button class="btn btn-ghost" type="button" data-close-map>${uiEn() ? 'Hide map' : '收起地图'}</button>
        </div>
        <div class="plan-map-body">
          <div id="planMap" class="plan-map-canvas"></div>
          <div id="planMapStops" class="plan-map-stops"></div>
        </div>
        <p class="plan-map-foot">${uiEn() ? 'Route order is indicative; use AMap navigation for actual travel.' : '路线为地点顺序示意，实际交通请以高德导航为准。'}</p>
      </div>
      ${rtHtml}
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
      ${(data.toolTrace || []).length ? `<div class="agent-trace"><h4>🧰 AI 工具轨迹</h4><ol>${data.toolTrace.map((item) => `<li><b>${app.esc(item.name)}</b><span>${app.esc(item.summary || (item.ok ? '已完成' : '失败'))}</span><small>${Number(item.durationMs || 0)} ms</small></li>`).join('')}</ol></div>` : ''}
      ${(data.citations || []).length ? `<div class="source-box"><h4>🔎 依据来源</h4><p class="source-note">以下内容经本地知识库检索后加入 AI 上下文。</p><ol class="source-list">${data.citations.map((item) => `<li><a href="${app.esc(item.url)}" target="_blank" rel="noopener"><b>${app.esc(item.title)}</b></a><span>${app.esc(item.snippet)}</span><small>${app.esc(item.source)}</small></li>`).join('')}</ol></div>` : ''}
      <div class="result-actions">
        <button class="btn btn-primary" type="button" data-print-plan>🖨️ 打印 / 存为 PDF</button>
        <button class="btn btn-ghost" type="button" data-save-img>📷 保存为图片</button>
        <button class="btn btn-ghost" type="button" data-save-parts>✂️ 三等分拼图</button>
        <button class="btn btn-ghost" type="button" data-save-word>📝 导出 Word</button>
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

  function isDesktopChat() {
    return window.innerWidth > 900;
  }

  function setChatMode(mode) {
    chatMode = mode === 'explain' ? 'explain' : 'modify';
    document.querySelectorAll('[data-chat-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.chatMode === chatMode);
    });
    const tag = document.getElementById('chatModeTag');
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    if (!isDesktopChat()) {
      if (tag) tag.textContent = uiEnNow() ? 'Q&A' : '问答';
      if (input) input.placeholder = uiEnNow() ? 'Ask a question and press Enter…' : '输入你的问题，回车发送…';
      if (send) send.textContent = uiEnNow() ? 'Send' : '发送';
      return;
    }
    if (tag) tag.textContent = chatMode === 'modify' ? (uiEnNow() ? 'Modify trip' : '修改行程') : (uiEnNow() ? 'Explain plan' : '解释规划');
    if (input) input.placeholder = chatMode === 'modify'
      ? (uiEnNow() ? 'e.g. Replace Day 2 afternoon with an indoor attraction…' : '例如：把第 2 天下午换成室内景点…')
      : (uiEnNow() ? 'e.g. Why is Day 2 arranged this way?' : '例如：为什么第 2 天这样安排？');
    if (send) send.textContent = chatMode === 'modify' ? (uiEnNow() ? 'Preview change' : '预览修改') : (uiEnNow() ? 'Ask' : '询问');
  }

  function setRevisionBusy(value) {
    revisionBusy = !!value;
    const send = document.getElementById('chatSend');
    if (send) send.disabled = revisionBusy;
    document.querySelectorAll('[data-chat-mode]').forEach((btn) => { btn.disabled = revisionBusy; });
  }

  async function sendExplainChat(msg, typing) {
    try {
      const responseHeaders = {
        'Content-Type': 'application/json',
        'x-lang': (window.i18n && window.i18n.lang) || 'zh'
      };
      try {
        const token = localStorage.getItem('jyh_token');
        if (token) responseHeaders.Authorization = 'Bearer ' + token;
      } catch (e) { /* ignore */ }
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: responseHeaders,
        body: JSON.stringify(app.aiPayload({ message: msg, history: chatHistory, tripContext: buildTripContext() }))
      });
      if (!response.ok) {
        let detail = '';
        try { detail = (await response.json()).error || ''; } catch (e) { /* ignore */ }
        throw new Error(detail || ('HTTP ' + response.status));
      }
      const creditHeader = response.headers.get('X-AI-Credits');
      if (creditHeader != null && Number.isFinite(Number(creditHeader))) {
        app.state.aiUsage = Object.assign({}, app.state.aiUsage || {}, { credits: Number(creditHeader) });
        app.updateAiHints();
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let firstDelta = true;
      let citations = [];
      const handleBlock = (block) => {
        let event = 'message';
        const dataLines = [];
        block.split('\n').forEach((line) => {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        });
        if (!dataLines.length) return;
        let data;
        try { data = JSON.parse(dataLines.join('\n')); } catch { return; }
        if (event === 'stage') {
          if (firstDelta) {
            typing.classList.remove('chat-typing');
            typing.innerHTML = `<span class="chat-stage">${app.esc(data.label || '正在处理')}${data.detail ? ' · ' + app.esc(data.detail) : ''}</span>`;
          }
        } else if (event === 'delta') {
          if (firstDelta) {
            firstDelta = false;
            typing.classList.remove('chat-typing');
            typing.textContent = '';
          }
          full += data.text || '';
          typing.textContent = full;
          const body = document.getElementById('chatBody');
          if (body) body.scrollTop = body.scrollHeight;
        } else if (event === 'done') {
          citations = Array.isArray(data.citations) ? data.citations : [];
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let split;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          handleBlock(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
      }
      if (buffer.trim()) handleBlock(buffer);
      if (!full) throw new Error(uiEnNow() ? 'The AI returned an empty answer' : 'AI 未返回有效内容');
      typing.classList.remove('chat-typing');
      typing.textContent = full;
      renderChatCitations(typing, citations);
      chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: full });
    } catch (e) {
      typing.classList.remove('chat-typing');
      typing.textContent = (uiEnNow() ? 'Error: ' : '出错了：') + e.message;
    }
  }

  function renderChatCitations(node, citations) {
    if (!node || !Array.isArray(citations) || !citations.length) return;
    const box = document.createElement('div');
    box.className = 'chat-citations';
    box.innerHTML = `<b>${uiEnNow() ? 'Sources' : '本次回答依据'}</b>`;
    citations.slice(0, 5).forEach((item, index) => {
      const link = document.createElement('a');
      link.href = item.url || '/destinations.html';
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = `${index + 1}. ${item.title}`;
      box.appendChild(link);
    });
    node.appendChild(box);
  }

  async function sendPlanRevision(msg, typing) {
    const plan = currentPlanData();
    if (!plan) {
      typing.classList.remove('chat-typing');
      typing.textContent = uiEnNow() ? 'Generate a full itinerary before changing it.' : '请先生成完整行程，再修改其中的某一天。';
      return;
    }
    if (!/(?:第|Day\s*)[0-9一二三四五六七八九十两]+\s*天?/i.test(msg)) {
      typing.classList.remove('chat-typing');
      typing.textContent = uiEnNow() ? 'Please specify the day and time, for example “Day 2 afternoon”.' : '请说明要修改第几天和时段，例如“第 2 天下午”。';
      return;
    }
    const vals = renderedPlan && renderedPlan.vals ? renderedPlan.vals : planFormValues();
    const token = ++revisionToken;
    setRevisionBusy(true);
    document.querySelectorAll('.chat-revision-preview').forEach((el) => el.remove());
    try {
      const job = await app.api('/api/plan/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(app.aiPayload({
          message: msg,
          currentPlan: compactCurrentPlan(plan),
          tripContext: buildTripContext()
        }))
      });
      await app.pollJob(job.jobId, {
        onDone: (result) => {
          if (token !== revisionToken) return;
          setRevisionBusy(false);
          typing.classList.remove('chat-typing');
          typing.textContent = result.reply || (uiEnNow() ? 'The revision could not be applied.' : '本次修改未应用。');
          if (result.changed && result.plan && result.beforeDay && result.afterDay) {
            showRevisionPreview(result, vals, typing);
          }
        },
        onError: (message) => {
          if (token !== revisionToken) return;
          setRevisionBusy(false);
          typing.classList.remove('chat-typing');
          typing.textContent = (uiEnNow() ? 'Revision failed: ' : '修改失败：') + message;
        }
      });
    } catch (e) {
      if (token !== revisionToken) return;
      setRevisionBusy(false);
      typing.classList.remove('chat-typing');
      typing.textContent = (uiEnNow() ? 'Revision failed: ' : '修改失败：') + e.message;
    }
  }

  function dayScheduleLines(day) {
    return (day && Array.isArray(day.schedule) ? day.schedule : [])
      .map((s) => `${s.time || ''}：${s.activity || ''}${s.detail ? '（' + s.detail + '）' : ''}`);
  }

  function showRevisionPreview(result, vals, typing) {
    const preview = document.createElement('div');
    preview.className = 'chat-revision-preview';
    const before = dayScheduleLines(result.beforeDay);
    const after = dayScheduleLines(result.afterDay);
    preview.innerHTML = `
      <b>${uiEnNow() ? 'Revision preview' : '修改预览'} · ${uiEnNow() ? 'Day ' : '第 '}${result.targetDay}${uiEnNow() ? '' : ' 天'}</b>
      <p>${uiEnNow() ? 'Nothing changes until you click Apply.' : '当前还没有修改原行程，点击“应用修改”后才会同步更新。'}</p>
      <div class="chat-revision-diff">
        <div class="chat-revision-side"><strong>${uiEnNow() ? 'Before' : '原安排'}</strong><ul>${before.map((x) => `<li>${app.esc(x)}</li>`).join('')}</ul></div>
        <div class="chat-revision-side"><strong>${uiEnNow() ? 'After' : '新安排'}</strong><ul>${after.map((x) => `<li>${app.esc(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="chat-revision-actions">
        <button class="btn btn-primary" type="button" data-apply-revision>${uiEnNow() ? 'Apply change' : '应用修改'}</button>
        <button class="btn btn-ghost" type="button" data-cancel-revision>${uiEnNow() ? 'Cancel' : '取消'}</button>
      </div>`;
    typing.insertAdjacentElement('afterend', preview);
    const chatBody = document.getElementById('chatBody');
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
    preview.querySelector('[data-cancel-revision]').addEventListener('click', () => preview.remove());
    preview.querySelector('[data-apply-revision]').addEventListener('click', () => {
      const current = currentPlanData();
      if (current) {
        planUndoStack.push({ plan: JSON.parse(JSON.stringify(current)), vals: { ...vals } });
        if (planUndoStack.length > 5) planUndoStack.shift();
      }
      const bodyEl = document.getElementById('planBody');
      renderPlan(bodyEl, result.plan, vals);
      savePlan(vals, result.plan);
      preview.remove();
      const done = addChatMsg('ai', uiEnNow()
        ? 'The itinerary, left-side schedule, and map have been updated.'
        : '修改已应用，行程、左侧日程和地图已同步更新。');
      const actions = document.createElement('div');
      actions.className = 'chat-message-action';
      actions.innerHTML = `<button class="btn btn-ghost" type="button">${uiEnNow() ? 'Undo last change' : '撤销上次修改'}</button>`;
      actions.querySelector('button').addEventListener('click', () => undoLastPlanChange());
      done.appendChild(actions);
      document.getElementById('chatBody').scrollTop = document.getElementById('chatBody').scrollHeight;
      app.toast(uiEnNow() ? 'Itinerary synced' : '行程、左侧日程和地图已同步');
    });
  }

  function undoLastPlanChange() {
    const last = planUndoStack.pop();
    if (!last) return;
    const bodyEl = document.getElementById('planBody');
    renderPlan(bodyEl, last.plan, last.vals);
    savePlan(last.vals, last.plan);
    addChatMsg('ai', uiEnNow() ? 'The previous itinerary has been restored.' : '已恢复上一版行程，日程和地图也已同步。');
    app.toast(uiEnNow() ? 'Previous itinerary restored' : '已撤销上一次修改');
  }

  async function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg || revisionBusy) return;
    input.value = '';
    addChatMsg('user', msg);
    const typing = addChatMsg('ai', uiEnNow() ? 'Working…' : '正在处理…');
    typing.classList.add('chat-typing');
    if (isDesktopChat() && chatMode === 'modify') {
      await sendPlanRevision(msg, typing);
    } else {
      await sendExplainChat(msg, typing);
    }
  }
})();
