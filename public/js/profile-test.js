(() => {
  const trips = [
    {
      id: 'chengdu',
      city: '成都',
      title: '成都 · 轻量亲子三日',
      titleEn: 'Chengdu · Family-friendly 3-day plan',
      date: '2026-11-14',
      days: 3,
      members: 5,
      budget: 6000,
      spent: 4200,
      savedHours: 9,
      revisions: 4,
      status: 'upcoming',
      note: '已避开连续长距离步行',
      noteEn: 'Long walking stretches removed',
      image: '/images/chengdu/cover.jpg'
    },
    {
      id: 'hangzhou',
      city: '杭州',
      title: '杭州 · 三代同行',
      titleEn: 'Hangzhou · Three generations',
      date: '2026-10-02',
      days: 3,
      members: 5,
      budget: 5000,
      spent: 4100,
      savedHours: 7.5,
      revisions: 2,
      status: 'completed',
      note: '第三天下午已改为休息',
      noteEn: 'Day 3 afternoon set aside for rest',
      image: '/images/hangzhou/cover.jpg'
    },
    {
      id: 'qingdao',
      city: '青岛',
      title: '青岛 · 海边慢行',
      titleEn: 'Qingdao · Slow seaside days',
      date: '2026-08-09',
      days: 4,
      members: 5,
      budget: 6500,
      spent: 5900,
      savedHours: 9,
      revisions: 3,
      status: 'completed',
      note: '餐厅均提前标注少辣',
      noteEn: 'Restaurants pre-marked for low spice',
      image: '/images/qingdao/cover.jpg'
    },
    {
      id: 'suzhou',
      city: '苏州',
      title: '苏州 · 园林短线',
      titleEn: 'Suzhou · Compact garden route',
      date: '2026-05-01',
      days: 2,
      members: 4,
      budget: 3500,
      spent: 2800,
      savedHours: 5.5,
      revisions: 2,
      status: 'completed',
      note: '路线减少一次折返',
      noteEn: 'Removed one backtrack',
      image: '/images/suzhou/cover.jpg'
    },
    {
      id: 'xiamen',
      city: '厦门',
      title: '厦门 · 寒假五日',
      titleEn: 'Xiamen · Five-day winter break',
      date: '2026-02-12',
      days: 5,
      members: 5,
      budget: 8000,
      spent: 6900,
      savedHours: 12,
      revisions: 1,
      status: 'completed',
      note: '按天气调整了两天户外安排',
      noteEn: 'Two outdoor days adjusted for weather',
      image: '/images/xiamen/cover.jpg'
    }
  ];

  const sum = (key) => trips.reduce((total, trip) => total + trip[key], 0);
  const completed = trips.filter((trip) => trip.status === 'completed').length;
  const upcoming = trips.filter((trip) => trip.status === 'upcoming').length;
  const savedHours = sum('savedHours');
  const plannedDays = sum('days');
  const aiRevisions = sum('revisions');
  const budgetRemaining = trips.reduce((total, trip) => total + trip.budget - trip.spent, 0);

  console.assert(savedHours === 43, '保存时长合计应为 43 小时');
  console.assert(plannedDays === 17, '规划天数合计应为 17 天');
  console.assert(aiRevisions === 12, 'AI 修改次数合计应为 12 次');
  console.assert(completed === 4 && upcoming === 1, '行程状态数量不一致');
  console.assert(budgetRemaining === 5100, '预算余量合计应为 5,100 元');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isEn = () => !!(window.i18n && window.i18n.lang === 'en');
  const tx = (zh, en) => (isEn() ? en : zh);
  const tr = (value) => (isEn() && window.i18n && window.i18n.t ? window.i18n.t(value) : value);
  const locale = isEn() ? 'en-US' : 'zh-CN';
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function renderSummary() {
    setText('completedTrips', completed);
    setText('plannedDays', plannedDays);
    setText('aiRevisions', aiRevisions);
    setText('budgetRemaining', money.format(budgetRemaining));
    setText('savedHours', savedHours);
    setText('tripCountText', tx(
      `共 ${trips.length} 次计划，其中 ${upcoming} 次待出发。`,
      `${trips.length} plans in total, with ${upcoming} upcoming.`
    ));
  }

  function renderSavings() {
    const box = $('#savingBars');
    if (!box) return;
    const max = Math.max(...trips.map((trip) => trip.savedHours));
    const rows = [...trips].sort((a, b) => b.savedHours - a.savedHours);
    box.innerHTML = rows.map((trip) => `
      <li class="saving-row">
        <span class="saving-city">${esc(tr(trip.city))}</span>
        <span class="saving-track" aria-hidden="true">
          <span class="saving-fill" style="width:${Math.round((trip.savedHours / max) * 100)}%"></span>
        </span>
        <span class="saving-value">${trip.savedHours} ${tx('小时', 'h')}</span>
      </li>
    `).join('');
  }

  function renderTrips(filter = 'all') {
    const box = $('#tripList');
    if (!box) return;
    const visible = trips.filter((trip) => filter === 'all' || trip.status === filter);
    if (!visible.length) {
      box.innerHTML = `<p class="trip-empty">${tx('这个筛选下还没有旅行记录。', 'No trips match this filter.')}</p>`;
      return;
    }
    box.innerHTML = visible.map((trip) => {
      const date = new Date(`${trip.date}T12:00:00`);
      const statusText = trip.status === 'upcoming' ? tx('待出发', 'Upcoming') : tx('已完成', 'Completed');
      const moneyLabel = trip.status === 'upcoming'
        ? tx(
          `预估 ¥${money.format(trip.spent)} · 预算 ¥${money.format(trip.budget)}`,
          `Est. CNY ${money.format(trip.spent)} · Budget CNY ${money.format(trip.budget)}`
        )
        : tx(
          `实际 ¥${money.format(trip.spent)} · 预算 ¥${money.format(trip.budget)}`,
          `Spent CNY ${money.format(trip.spent)} · Budget CNY ${money.format(trip.budget)}`
        );
      return `
        <article class="trip-row" data-status="${trip.status}">
          <img class="trip-thumb" src="${trip.image}" alt="${esc(isEn() ? `${tr(trip.city)} destination photo` : `${trip.city}目的地照片`)}" loading="lazy" />
          <div class="trip-copy">
            <div class="trip-title">
              <h3>${esc(isEn() ? trip.titleEn : trip.title)}</h3>
              <span class="trip-status ${trip.status}">${statusText}</span>
            </div>
            <p>${dateFmt.format(date)} · ${trip.days} ${tx('天', 'days')} · ${trip.members} ${tx('人', 'people')} · ${esc(isEn() ? trip.noteEn : trip.note)}</p>
          </div>
          <div class="trip-money">
            <strong>¥${money.format(trip.spent)}</strong>
            <span>${moneyLabel}</span>
          </div>
          <div class="trip-ai">
            <strong>${trip.savedHours} ${tx('小时', 'hours')}</strong>
            <span>${tx('AI 修改', 'AI revisions')} ${trip.revisions} ${tx('次', 'times')}</span>
          </div>
          <a class="trip-action" href="/plan.html">${trip.status === 'upcoming' ? tx('继续调整', 'Keep adjusting') : tx('再做一版', 'Plan it again')}</a>
        </article>
      `;
    }).join('');
  }

  function bindTripFilters() {
    $$('.trip-filter').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.trip-filter').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        renderTrips(button.dataset.filter || 'all');
      });
    });
  }

  let toastTimer = null;
  function toast(message) {
    const node = $('#profileToast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { node.hidden = true; }, 3000);
  }

  function bindBilling() {
    const dialog = $('#billingDialog');
    const close = $('#billingClose');
    const confirm = $('#billingConfirm');
    const notice = $('#billingNotice');
    if (!dialog) return;

    function openTab(tab) {
      $$('[data-billing-tab]').forEach((button) => {
        button.setAttribute('aria-selected', String(button.dataset.billingTab === tab));
      });
      const membership = $('#membershipPanel');
      const credits = $('#creditsPanel');
      if (membership) membership.hidden = tab !== 'membership';
      if (credits) credits.hidden = tab !== 'credits';
      const activePanel = tab === 'credits' ? credits : membership;
      activePanel?.querySelector('input')?.focus();
    }

    function openDialog(tab = 'membership') {
      openTab(tab);
      if (notice) notice.textContent = tx('尚未记录选择。', 'No choice recorded yet.');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    $$('[data-open-billing]').forEach((button) => {
      button.addEventListener('click', () => openDialog(button.dataset.openTab || 'membership'));
    });
    $$('[data-billing-tab]').forEach((button) => {
      button.addEventListener('click', () => openTab(button.dataset.billingTab));
    });
    close?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    confirm?.addEventListener('click', () => {
      const activePanel = $('.billing-panel:not([hidden])', dialog);
      const selected = activePanel ? $('input[type="radio"]:checked', activePanel) : null;
      if (!selected) {
        if (notice) notice.textContent = tx('请先选择一个方案。', 'Choose a plan first.');
        return;
      }
      const intent = { plan: selected.value, recordedAt: new Date().toISOString() };
      try { localStorage.setItem('jyh_profile_billing_intent', JSON.stringify(intent)); } catch (_) {}
      const option = selected.closest('.plan-option');
      const planName = option?.querySelector('.plan-copy strong')?.textContent || selected.value;
      const planPrice = option?.querySelector('.plan-price')?.textContent.replace(/\s+/g, ' ').trim() || '';
      if (notice) notice.textContent = tx(
        `已记录：${planName}，${planPrice}。测试页不会发起支付。`,
        `Saved: ${planName}, ${planPrice}. This demo does not take payment.`
      );
      toast(tx('选择已保存在本机，未发起支付', 'Choice saved locally. No payment taken.'));
      window.setTimeout(() => dialog.close(), 650);
    });
  }

  renderSummary();
  renderSavings();
  renderTrips();
  bindTripFilters();
  bindBilling();
})();
