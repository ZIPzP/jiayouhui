(() => {
  'use strict';
  /* 中英文案包（方案 B：主题/布局不变，只换文字）
     - 原文以中文为准，字典按「中文原文 -> English」精确匹配
     - 切换语言时自动遍历文本节点与属性，切回中文用缓存的原文还原
     - 新增动态内容由 MutationObserver 自动翻译，无需给每个元素打标记 */
  const LANG_KEY = 'jyh_lang';
  const DICT = {
  "家游汇": "Family Trip Hub",
  "🏡 家游汇": "🏡 Family Trip Hub",
  "家游汇 · 家庭旅游推荐与攻略": "Family Trip Hub · Family Travel Guides",
  "首页": "Home",
  "🏠 首页": "🏠 Home",
  "目的地": "Destinations",
  "🗺️ 目的地": "🗺️ Destinations",
  "行程规划": "Trip Planner",
  "🐱 行程规划": "🐱 Trip Planner",
  "出行清单": "Packing List",
  "🎒 出行清单": "🎒 Packing List",
  "平台热度": "Trending",
  "🔥 平台热度": "🔥 Trending",
  "🎲 抽取": "🎲 Lucky Draw",
  "⚙️ 设置": "⚙️ Settings",
  "长辈模式": "Senior Mode",
  "长辈模式（已开启）": "Senior Mode (on)",
  "🐱 AI 设置": "🐱 AI Settings",
  "📱 手机预览": "📱 Mobile Preview",
  "📖 关于": "📖 About",
  "开始规划": "Start Planning",
  "菜单": "Menu",
  "打开菜单": "Open menu",
  "备案图标": "Filing icon",
  "关闭": "Close",
  "回到顶部": "Back to top",
  "减少动态": "Reduce motion",
  "🏡 家游汇 · 让每一次家庭旅行都充满美好回忆": "🏡 Family Trip Hub · Make every family journey a good memory",
  "🏡 家游汇 · 家庭旅游推荐与攻略选择 — 仅供学习研究与技术交流，严禁商业用途；请遵守中国法律法规及 12306 官方相关规定，合理合规使用": "🏡 Family Trip Hub · Family travel recommendations and guides — for learning, research and technical exchange only; commercial use is strictly prohibited. Please comply with Chinese laws and 12306 official regulations.",
  "AI 驱动的家庭旅行助手": "AI-powered family travel assistant",
  "带上爸妈和孩子": "Bring your parents and kids",
  "一起去看世界": "to see the world together",
  "聚合平台热门数据 · AI 按出行时段生成打包清单与详细行程 · 长辈模式全程守护": "Popular-trip data · AI builds your packing list and detailed itinerary by travel time · Senior Mode included",
  "✈️ 快速生成我的出行清单": "✈️ Quick packing list",
  "出行月份": "Travel month",
  "天数": "Days",
  "2 天": "2 days",
  "3 天": "3 days",
  "4 天": "4 days",
  "5 天": "5 days",
  "7 天": "7 days",
  "👴 老人": "👴 Seniors",
  "🧑 成人": "🧑 Adults",
  "🧒 儿童": "🧒 Children",
  "生成清单": "Generate list",
  "AI 智能行程规划": "AI itinerary planning",
  "聚合平台热门数据，AI 按出行时段生成打包清单与详细行程。长辈模式全程守护，让每一次家庭旅行都安心无忧。": "Popular-trip data, AI-generated packing lists and detailed day-by-day itineraries by travel time. Senior Mode watches over the whole journey.",
  "免费开始规划": "Start planning free",
  "查看目的地": "Browse destinations",
  "已帮助": "Helped",
  "家庭规划完美旅程": "families plan perfect trips",
  "AI 生成逐日详细行程": "AI writes every day in detail",
  "按时段智能推荐用品": "Smart packing by travel time",
  "全程贴心守护": "Care for the whole journey",
  "精选家庭目的地": "Featured family destinations",
  "点卡片查看详情；想去的城市不在列表？去「行程规划」自定义即可": "Tap a card for details. City not listed? Add it yourself in the Trip Planner.",
  "查看全部目的地 →": "View all destinations →",
  "🐱 去规划行程": "🐱 Plan a trip",
  "从这里开始": "Get started",
  "选日期、天数、交通、忌食、预算，AI 生成逐日详细行程": "Pick dates, days, transport, dietary needs and budget — AI writes the day-by-day plan",
  "按出行时段与同行人，AI 推荐该带的旅行用品": "AI suggests what to pack based on travel time and companions",
  "看看最近大家都在去哪些热门目的地": "See which destinations are trending right now",
  "🐱 AI 大模型设置": "🐱 AI Model Settings",
  "推荐 DeepSeek：点「🚀 DeepSeek」一键填入接口与模型，再粘贴你的 API Key。Key 仅保存在本地。": "Recommended: DeepSeek. Click 🚀 DeepSeek to fill in the endpoint and model, then paste your API Key. Your key is stored locally only.",
  "通义千问": "Qwen",
  "🔑 邀请码（解锁服务端 AI，用我的 Key）": "🔑 Invite code (unlock the server-side AI key)",
  "输入邀请码": "Enter invite code",
  "🔓 解锁服务端 AI": "🔓 Unlock server AI",
  "退出解锁（改用自带 Key）": "Leave unlocked mode (use my own key)",
  "接口地址 Base URL": "Base URL",
  "模型": "Model",
  "保存设置": "Save settings",
  "📱 手机预览 · 390px": "📱 Mobile preview · 390px",
  "✕ 关闭": "✕ Close",
  "👴 长辈模式已开启：字体放大、对比增强、支持语音朗读": "👴 Senior Mode on: larger text, higher contrast, voice reading",
  "已退出长辈模式": "Senior Mode off",
  "当前浏览器不支持语音朗读": "This browser does not support voice reading",
  "✅ 图片已保存": "✅ Image saved",
  "当前浏览器暂不支持截图，请用「打印 / 存为 PDF」": "Screenshots aren’t supported in this browser — use Print / Save as PDF",
  "保存图片失败，请用「打印 / 存为 PDF」": "Couldn’t save the image — use Print / Save as PDF",
  "✅ 已导出 1 张拼图（三列并排，放大后左右滑动看）": "✅ Exported as one image (3 columns side by side — zoom in and swipe)",
  "导出失败，请用「打印 / 存为 PDF」": "Export failed — use Print / Save as PDF",
  "✅ Word 已导出，可用 Word / WPS 打开": "✅ Word file exported — open it in Word or WPS",
  "家游汇.png": "FamilyTripHub.png"
};
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/;
  let lang = 'zh';
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) { /* 忽略 */ }
  const textCache = new WeakMap();  // textNode -> 原文
  const attrCache = new WeakMap();  // element -> { attr: 原文 }
  const titleCache = { zh: null };

  const hit = (s) => {
    const k = String(s).trim();
    return k && Object.prototype.hasOwnProperty.call(DICT, k) ? DICT[k] : null;
  };

  function trText(node) {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    if (!textCache.has(node)) textCache.set(node, raw);
    const orig = textCache.get(node);
    const en = hit(orig);
    if (!en) return;
    const lead = (orig.match(/^\s*/) || [''])[0];
    const tail = (orig.match(/\s*$/) || [''])[0];
    const next = lang === 'en' ? lead + en + tail : orig;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function trAttrs(el) {
    if (!el.hasAttribute) return;
    let map = attrCache.get(el);
    if (!map) { map = {}; attrCache.set(el, map); }
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (map[a] === undefined) map[a] = el.getAttribute(a);
      const orig = map[a];
      const en = hit(orig);
      if (!en) continue;
      const next = lang === 'en' ? en : orig;
      if (el.getAttribute(a) !== next) el.setAttribute(a, next);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) {
      if (SKIP_TAGS.test(root.tagName)) return;
      trAttrs(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) return SKIP_TAGS.test(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) trText(n); else trAttrs(n);
    }
  }

  function applyTitle() {
    if (titleCache.zh === null) titleCache.zh = document.title;
    const en = hit(titleCache.zh);
    if (!en) return;
    document.title = lang === 'en' ? en : titleCache.zh;
  }

  function updateSwitch() {
    const btn = document.getElementById('langSwitch');
    if (!btn) return;
    btn.textContent = lang === 'en' ? '🌏 中文' : '🌏 English';
    btn.title = lang === 'en' ? 'Switch to Chinese' : '切换到英文';
    btn.setAttribute('aria-label', btn.title);
  }

  function mountSwitch() {
    const actions = document.querySelector('.nav-actions');
    if (!actions || document.getElementById('langSwitch')) return;
    const btn = document.createElement('button');
    btn.id = 'langSwitch';
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-lang';
    btn.addEventListener('click', () => setLang(lang === 'en' ? 'zh' : 'en'));
    actions.insertBefore(btn, actions.firstChild);
    updateSwitch();
  }

  function setLang(next) {
    const target = next === 'en' ? 'en' : 'zh';
    if (target === lang) { updateSwitch(); return; }
    lang = target;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* 忽略 */ }
    // 重新加载：i18n.js 在 common.js 之前执行，能保证「先翻译、再逐字拆字」，
    // 同时页面里由 JS 动态生成的中文内容（结果卡片/提示等）也会一起换成新语言
    location.reload();
  }

  function boot() {
    document.documentElement.classList.toggle('lang-en', lang === 'en');
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
    mountSwitch();
    if (lang === 'en') { walk(document.body); applyTitle(); updateSwitch(); }
    if ('MutationObserver' in window) {
      let pend = false;
      const mo = new MutationObserver((muts) => {
        if (lang !== 'en' || pend) return;
        pend = true;
        requestAnimationFrame(() => {
          pend = false;
          for (const m of muts) for (const n of m.addedNodes) walk(n);
        });
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.i18n = {
    get lang() { return lang; },
    setLang,
    apply: () => walk(document.body),
    /** JS 里需要中文->英文时用它：t('首页') */
    t: (s) => (lang === 'en' && hit(s)) || s
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
