(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isEn = () => !!(window.i18n && window.i18n.lang === 'en');
  const tx = (zh, en) => (isEn() ? en : zh);
  const tr = (value) => (isEn() && window.i18n && window.i18n.t ? window.i18n.t(value) : value);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const locale = isEn() ? 'en-US' : 'zh-CN';
  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  let currentFilter = 'all';

  const trips = () => window.app && app.loadTripHistory ? app.loadTripHistory() : [];
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  function renderSummary() {
    const rows = trips();
    const completed = rows.filter((trip) => trip.status === 'completed').length;
    const upcoming = rows.filter((trip) => trip.status === 'upcoming').length;
    const days = rows.reduce((total, trip) => total + Number(trip.days || 0), 0);
    const tools = rows.reduce((total, trip) => total + Number(trip.toolCalls || 0), 0);
    const destinations = new Set(rows.map((trip) => trip.destination).filter(Boolean)).size;
    setText('completedTrips', completed);
    setText('plannedDays', days);
    setText('aiRevisions', tools);
    setText('destinationCount', destinations);
    setText('tripTotal', rows.length);
    setText('tripCountText', rows.length
      ? tx(`共 ${rows.length} 次真实规划，其中 ${upcoming} 次待出发。`, `${rows.length} saved plans, ${upcoming} upcoming.`)
      : tx('尚无已保存行程。完成一次规划后会自动出现在这里。', 'No saved plans yet. A completed itinerary will appear here.'));

    $$('.trip-filter[data-filter]').forEach((button) => {
      const key = button.dataset.filter;
      const count = key === 'all' ? rows.length : rows.filter((trip) => trip.status === key).length;
      const label = key === 'all' ? tx('全部', 'All') : key === 'upcoming' ? tx('待出发', 'Upcoming') : tx('已完成', 'Completed');
      button.textContent = `${label} ${count}`;
      button.dataset.count = String(count);
    });
    const clear = $('#clearTripHistory');
    if (clear) clear.hidden = rows.length === 0;
  }

  function renderSavings() {
    const box = $('#savingBars');
    if (!box) return;
    const rows = trips();
    if (!rows.length) {
      box.innerHTML = `<li class="saving-row"><span class="saving-city">${tx('暂无记录', 'No records yet')}</span><span class="saving-track"><span class="saving-fill" style="width:0"></span></span><span class="saving-value">0</span></li>`;
      return;
    }
    const max = Math.max(1, ...rows.map((trip) => Number(trip.days || 0)));
    box.innerHTML = rows.slice(0, 6).map((trip) => `
      <li class="saving-row">
        <span class="saving-city">${esc(tr(trip.destination || '—'))}</span>
        <span class="saving-track" aria-hidden="true">
          <span class="saving-fill" style="width:${Math.round((Number(trip.days || 0) / max) * 100)}%"></span>
        </span>
        <span class="saving-value">${trip.days} ${tx('天', 'days')}</span>
      </li>`).join('');
  }

  function renderLatestPreferences() {
    const latest = trips()[0];
    setText('latestMemberCount', latest ? tx(`${latest.travelers || '—'} 人同行`, `${latest.travelers || '—'} travellers`) : tx('尚无记录', 'No records yet'));
    setText('prefPace', latest ? tx('按最近一次行程保存', 'Saved with latest itinerary') : tx('尚无记录', 'No records yet'));
    setText('prefTravelers', latest ? tx(`${latest.travelers || '—'} 人`, `${latest.travelers || '—'} people`) : tx('尚无记录', 'No records yet'));
    setText('prefDietary', latest && latest.dietary && latest.dietary.length ? latest.dietary.join('、') : tx('未记录', 'Not recorded'));
    setText('prefSources', latest ? tx(`${latest.citations} 条依据 · ${latest.toolCalls} 次工具`, `${latest.citations} sources · ${latest.toolCalls} tool calls`) : tx('尚无记录', 'No records yet'));
    setText('prefDestination', latest ? latest.destination : tx('尚无记录', 'No records yet'));
    const insight = $('#profileInsight p');
    if (insight) {
      insight.textContent = latest
        ? tx(`最近一次是「${latest.title}」，共 ${latest.days} 天，保存 ${latest.citations} 条依据、${latest.toolCalls} 次工具调用。`, `Latest: ${latest.title}, ${latest.days} days, ${latest.citations} sources and ${latest.toolCalls} tool calls.`)
        : tx('完成第一次行程后，这里会根据真实记录显示规划天数、工具调用和来源数量。', 'After your first completed itinerary, real planning, tool and source counts will appear here.');
    }
  }

  function renderTrips() {
    const box = $('#tripList');
    if (!box) return;
    const visible = trips().filter((trip) => currentFilter === 'all' || trip.status === currentFilter);
    if (!visible.length) {
      box.innerHTML = `<div class="trip-empty"><p>${tx('这个筛选下没有真实旅行记录。', 'No saved trips match this filter.')}</p><a class="profile-btn profile-btn-primary" href="/plan.html">${tx('开始规划', 'Plan a trip')}</a></div>`;
      return;
    }
    box.innerHTML = visible.map((trip) => {
      const start = /^\d{4}-\d{2}-\d{2}$/.test(trip.startDate || '') ? dateFmt.format(new Date(trip.startDate + 'T12:00:00')) : '—';
      const statusText = trip.status === 'upcoming' ? tx('待出发', 'Upcoming') : tx('已完成', 'Completed');
      const summary = trip.citations || trip.toolCalls
        ? tx(`${trip.citations} 条依据 · ${trip.toolCalls} 次工具调用`, `${trip.citations} sources · ${trip.toolCalls} tool calls`)
        : tx('基础规则规划', 'Rule-based plan');
      return `
        <article class="trip-row" data-status="${trip.status}">
          <div class="trip-thumb trip-thumb-text" aria-hidden="true">${esc((trip.destination || '旅').slice(0, 1))}</div>
          <div class="trip-copy">
            <div class="trip-title"><h3>${esc(trip.title)}</h3><span class="trip-status ${trip.status}">${statusText}</span></div>
            <p>${esc(start)} · ${trip.days} ${tx('天', 'days')} · ${trip.travelers} ${tx('人', 'people')} · ${esc(summary)}</p>
          </div>
          <div class="trip-money"><strong>${esc(trip.budget || '—')}</strong><span>${tx('人均预算', 'Budget / person')}</span></div>
          <div class="trip-ai"><strong>${trip.provider === 'ai' ? 'DeepSeek' : tx('规则引擎', 'Rules')}</strong><span>${tx('规划来源', 'Plan source')}</span></div>
          <a class="trip-action" href="/plan.html">${tx('再做一版', 'Plan again')}</a>
        </article>`;
    }).join('');
  }

  function renderAll() {
    renderSummary();
    renderSavings();
    renderLatestPreferences();
    renderTrips();
  }

  function bindTripFilters() {
    $$('.trip-filter[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        currentFilter = button.dataset.filter || 'all';
        $$('.trip-filter[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        renderTrips();
      });
    });
    $('#clearTripHistory')?.addEventListener('click', () => {
      if (!window.confirm(tx('只清除当前浏览器中的行程档案，确定继续吗？', 'Delete saved trip history from this browser?'))) return;
      window.app.clearTripHistory();
      currentFilter = 'all';
      renderAll();
    });
  }

  function toast(message) {
    const node = $('#profileToast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(node._timer);
    node._timer = setTimeout(() => { node.hidden = true; }, 3000);
  }

  function bindBilling() {
    const dialog = $('#billingDialog');
    const confirm = $('#billingConfirm');
    const notice = $('#billingNotice');
    if (!dialog) return;
    const openTab = (tab) => {
      $$('[data-billing-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.billingTab === tab)));
      $('#membershipPanel').hidden = tab !== 'membership';
      $('#creditsPanel').hidden = tab !== 'credits';
      (tab === 'credits' ? $('#creditsPanel') : $('#membershipPanel'))?.querySelector('input')?.focus();
    };
    const openDialog = (tab = 'membership') => {
      openTab(tab);
      if (notice) notice.textContent = tx('支付接口尚未接入，本页只记录购买意向，不会产生扣款。', 'Payment is not connected. This page only records intent and takes no payment.');
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    };
    $$('[data-open-billing]').forEach((button) => button.addEventListener('click', () => openDialog(button.dataset.openTab || 'membership')));
    $$('[data-billing-tab]').forEach((button) => button.addEventListener('click', () => openTab(button.dataset.billingTab)));
    $('#billingClose')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    confirm?.addEventListener('click', () => {
      const activePanel = $('.billing-panel:not([hidden])', dialog);
      const selected = activePanel ? $('input[type="radio"]:checked', activePanel) : null;
      if (!selected) {
        if (notice) notice.textContent = tx('请先选择一个方案。', 'Choose a plan first.');
        return;
      }
      const intent = { plan: selected.value, recordedAt: new Date().toISOString() };
      try { localStorage.setItem('jyh_profile_billing_intent', JSON.stringify(intent)); } catch { /* ignore */ }
      if (notice) notice.textContent = tx('已记录购买意向；接入支付回调后才能真实增加额度。', 'Purchase intent saved. Credits will only be added after a verified payment callback.');
      toast(tx('已记录购买意向，未发起支付', 'Intent saved. No payment taken.'));
    });
  }

  async function refreshUsage() {
    const label = $('#aiCreditStatus');
    if (!label) return;
    const token = window.app?.state?.ai?.aiToken || '';
    if (!token) {
      label.textContent = tx('登录解锁后可查看 AI 额度。', 'Unlock AI access to view your balance.');
      return;
    }
    try {
      const usage = await window.app.api('/api/ai/usage', {
        headers: {
          'x-ai-token': token,
          'x-client-id': window.app.state.clientId
        }
      });
      label.textContent = usage.credits > 0
        ? tx(`当前剩余 ${usage.credits} 点 AI 额度。`, `${usage.credits} AI credits remaining.`)
        : tx('AI 额度已用完，请充值后再使用。', 'AI credits exhausted. Please top up to continue.');
    } catch {
      label.textContent = tx('当前未解锁服务端 AI。', 'Server AI is not unlocked.');
    }
  }

  bindTripFilters();
  bindBilling();
  renderAll();
  refreshUsage();
})();
