(() => {
  const trips = [
    {
      id: 'chengdu',
      city: '成都',
      title: '成都 · 轻量亲子三日',
      date: '2026-11-14',
      days: 3,
      members: 5,
      budget: 6000,
      spent: 4200,
      savedHours: 9,
      revisions: 4,
      status: 'upcoming',
      note: '已避开连续长距离步行',
      image: '/images/chengdu/cover.jpg'
    },
    {
      id: 'hangzhou',
      city: '杭州',
      title: '杭州 · 三代同行',
      date: '2026-10-02',
      days: 3,
      members: 5,
      budget: 5000,
      spent: 4100,
      savedHours: 7.5,
      revisions: 2,
      status: 'completed',
      note: '第三天下午已改为休息',
      image: '/images/hangzhou/cover.jpg'
    },
    {
      id: 'qingdao',
      city: '青岛',
      title: '青岛 · 海边慢行',
      date: '2026-08-09',
      days: 4,
      members: 5,
      budget: 6500,
      spent: 5900,
      savedHours: 9,
      revisions: 3,
      status: 'completed',
      note: '餐厅均提前标注少辣',
      image: '/images/qingdao/cover.jpg'
    },
    {
      id: 'suzhou',
      city: '苏州',
      title: '苏州 · 园林短线',
      date: '2026-05-01',
      days: 2,
      members: 4,
      budget: 3500,
      spent: 2800,
      savedHours: 5.5,
      revisions: 2,
      status: 'completed',
      note: '路线减少一次折返',
      image: '/images/suzhou/cover.jpg'
    },
    {
      id: 'xiamen',
      city: '厦门',
      title: '厦门 · 寒假五日',
      date: '2026-02-12',
      days: 5,
      members: 5,
      budget: 8000,
      spent: 6900,
      savedHours: 12,
      revisions: 1,
      status: 'completed',
      note: '按天气调整了两天户外安排',
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
  const money = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
    setText('tripCountText', `共 ${trips.length} 次计划，其中 ${upcoming} 次待出发。`);
  }

  function renderSavings() {
    const box = $('#savingBars');
    if (!box) return;
    const max = Math.max(...trips.map((trip) => trip.savedHours));
    const rows = [...trips].sort((a, b) => b.savedHours - a.savedHours);
    box.innerHTML = rows.map((trip) => `
      <li class="saving-row">
        <span class="saving-city">${esc(trip.city)}</span>
        <span class="saving-track" aria-hidden="true">
          <span class="saving-fill" style="width:${Math.round((trip.savedHours / max) * 100)}%"></span>
        </span>
        <span class="saving-value">${trip.savedHours} 小时</span>
      </li>
    `).join('');
  }

  function renderTrips(filter = 'all') {
    const box = $('#tripList');
    if (!box) return;
    const visible = trips.filter((trip) => filter === 'all' || trip.status === filter);
    if (!visible.length) {
      box.innerHTML = '<p class="trip-empty">这个筛选下还没有旅行记录。</p>';
      return;
    }
    box.innerHTML = visible.map((trip) => {
      const date = new Date(`${trip.date}T12:00:00`);
      const statusText = trip.status === 'upcoming' ? '待出发' : '已完成';
      const moneyLabel = trip.status === 'upcoming'
        ? `预估 ¥${money.format(trip.spent)} · 预算 ¥${money.format(trip.budget)}`
        : `实际 ¥${money.format(trip.spent)} · 预算 ¥${money.format(trip.budget)}`;
      return `
        <article class="trip-row" data-status="${trip.status}">
          <img class="trip-thumb" src="${trip.image}" alt="${esc(trip.city)}目的地照片" loading="lazy" />
          <div class="trip-copy">
            <div class="trip-title">
              <h3>${esc(trip.title)}</h3>
              <span class="trip-status ${trip.status}">${statusText}</span>
            </div>
            <p>${dateFmt.format(date)} · ${trip.days} 天 · ${trip.members} 人 · ${esc(trip.note)}</p>
          </div>
          <div class="trip-money">
            <strong>¥${money.format(trip.spent)}</strong>
            <span>${moneyLabel}</span>
          </div>
          <div class="trip-ai">
            <strong>${trip.savedHours} 小时</strong>
            <span>AI 修改 ${trip.revisions} 次</span>
          </div>
          <a class="trip-action" href="/plan.html">${trip.status === 'upcoming' ? '继续调整' : '再做一版'}</a>
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
      if (notice) notice.textContent = '尚未记录选择。';
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
      const selected = $('input[name="billingPlan"]:checked', dialog);
      if (!selected) {
        if (notice) notice.textContent = '请先选择一个方案。';
        return;
      }
      const intent = { plan: selected.value, recordedAt: new Date().toISOString() };
      try { localStorage.setItem('jyh_profile_billing_intent', JSON.stringify(intent)); } catch (_) {}
      if (notice) notice.textContent = `已记录：${selected.value}。测试页不会发起支付。`;
      toast('选择已保存在本机，未发起支付');
      window.setTimeout(() => dialog.close(), 650);
    });
  }

  renderSummary();
  renderSavings();
  renderTrips();
  bindTripFilters();
  bindBilling();
})();
