'use strict';
/**
 * 出行推荐引擎：
 * - 配置了 AI Key 时，调用大模型根据“目的地 + 出行月份 + 时长 + 人群”生成个性化打包清单与攻略；
 * - 未配置或调用失败时，自动降级为内置规则引擎（packing-db.json），保证开箱即用。
 */
const fs = require('fs');
const path = require('path');
const ai = require('./ai');

const DATA_DIR = path.join(__dirname, '..', 'data');
let destCache = null;
let packCache = null;

function loadDestinations() {
  if (destCache) return destCache;
  destCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'destinations.json'), 'utf8')).destinations || [];
  return destCache;
}

function loadPackingDb() {
  if (packCache) return packCache;
  packCache = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'packing-db.json'), 'utf8'));
  return packCache;
}

/* 超详细·懒人配套：带了某物，就补上配套小物 */
const COMPANION = [
  { key: '防晒', extra: [ { category: '洗护防晒', name: '面部清洁乳/卸妆', reason: '涂了防晒/化了妆，晚上要彻底清洁', priority: 2 }, { category: '洗护防晒', name: '洗面奶', reason: '配合防晒霜日常清洁', priority: 2 } ] },
  { key: '湿巾', extra: [ { category: '出行装备', name: '小包纸巾', reason: '湿巾配纸巾，擦手擦嘴都方便', priority: 2 }, { category: '出行装备', name: '垃圾袋', reason: '收纳湿巾等随身垃圾', priority: 2 } ] },
  { key: '墨镜', extra: [ { category: '出行装备', name: '眼镜盒/眼镜布', reason: '墨镜收纳防刮', priority: 2 } ] },
  { key: '泳衣', extra: [ { category: '出行装备', name: '速干毛巾', reason: '游泳后擦干不感冒', priority: 2 }, { category: '出行装备', name: '防水袋', reason: '装湿泳衣/手机防水', priority: 2 } ] },
  { key: '驱蚊', extra: [ { category: '药品健康', name: '止痒膏/风油精', reason: '被咬后及时止痒', priority: 2 } ] },
  { key: '相机', extra: [ { category: '电子设备', name: '备用电池/存储卡', reason: '拍照不停电、不爆卡', priority: 2 } ] },
  { key: '充电', extra: [ { category: '电子设备', name: '多口充电头', reason: '一家人设备一起充', priority: 2 } ] },
  { key: '药', extra: [ { category: '药品健康', name: '小药盒', reason: '分装常用药，随身带一份', priority: 2 } ] },
  { key: '运动鞋', extra: [ { category: '药品健康', name: '创可贴/防磨脚贴', reason: '新鞋磨脚救急', priority: 2 } ] }
];
/* 超详细·懒人补充包 */
const DETAILED_EXTRA = [
  { category: '证件财务', name: '现金零钱', reason: '部分小摊只收现金', priority: 1 },
  { category: '洗护防晒', name: '便携洗漱包', reason: '牙膏牙刷毛巾梳子一包搞定', priority: 2 },
  { category: '洗护防晒', name: '棉签/指甲刀', reason: '小物救急', priority: 1 },
  { category: '电子设备', name: '数据线×2+移动电源', reason: '设备多，充电不排队', priority: 2 },
  { category: '电子设备', name: '耳机', reason: '路上解闷、不打扰别人', priority: 1 },
  { category: '出行装备', name: '密封袋', reason: '装湿毛巾/脏衣物/零食', priority: 2 },
  { category: '出行装备', name: '便携衣架', reason: '挂晾洗过的衣物', priority: 1 },
  { category: '出行装备', name: 'U型枕+眼罩', reason: '长途交通休息', priority: 1 },
  { category: '药品健康', name: '碘伏棉签', reason: '小磕碰即时处理', priority: 2 },
  { category: '药品健康', name: '晕车贴', reason: '老人孩子长途更安心', priority: 2 },
  { category: '药品健康', name: '肠胃药/退烧药', reason: '水土不服应急', priority: 3 },
  { category: '衣物鞋帽', name: '一次性内裤', reason: '懒人免洗', priority: 2 }
];

function seasonFromMonth(month) {
  const m = Number(month) || new Date().getMonth() + 1;
  if ([3, 4, 5].includes(m)) return '春';
  if ([6, 7, 8].includes(m)) return '夏';
  if ([9, 10, 11].includes(m)) return '秋';
  return '冬';
}

function monthName(month) {
  return `${Number(month) || new Date().getMonth() + 1}月`;
}

/** 规则引擎：合并通用 + 季节 + 人群 + 目的地特色 */
function buildRuleBased(params) {
  const { destination, month, durationDays, mode, notes } = params;
  const season = seasonFromMonth(month);
  const db = loadPackingDb();
  const seen = new Set();
  const items = [];
  const add = (it) => {
    if (!it || seen.has(it.name)) return;
    seen.add(it.name);
    items.push({ ...it });
  };

  (db.generic || []).forEach(add);
  (db.seasons[season] || []).forEach(add);
  if (Number(params.elderly) > 0) (db.travelers.elderly || []).forEach(add);
  if (Number(params.adults) > 0) (db.travelers.adult || []).forEach(add);
  if (Number(params.children) > 0) (db.travelers.child || []).forEach(add);

  const tagMap = { '海滨': '海滨', '高原': '高原', '山地': '山地', '古城': '古城', '都市': '都市', '探险': '山地' };
  (destination.tags || []).forEach((t) => {
    if (tagMap[t]) (db.destination[tagMap[t]] || []).forEach(add);
  });

  // 按当地气候特征补充物品（结合当月天气）
  const climate = String(destination.climate || '');
  const climateItems = [];
  if (/雨|梅雨|湿润/.test(climate)) climateItems.push({ category: '出行装备', name: '雨伞/雨衣', reason: '当地多雨，随身携带', priority: 2 });
  if (/紫外|高原|日照/.test(climate)) climateItems.push({ category: '洗护防晒', name: '高倍防晒霜/墨镜', reason: '当地紫外线强', priority: 3 });
  if (/温差/.test(climate)) climateItems.push({ category: '衣物鞋帽', name: '薄外套（洋葱式叠穿）', reason: '昼夜温差大', priority: 2 });
  if (/湿冷/.test(climate)) climateItems.push({ category: '衣物鞋帽', name: '防潮保暖衣物', reason: '当地湿冷', priority: 2 });
  if (/高原/.test(climate)) climateItems.push({ category: '药品健康', name: '红景天/氧气瓶', reason: '高原反应预防与应急', priority: 3 });
  climateItems.forEach(add);

  items.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // 超详细模式：懒人配套（带防晒补清洁乳、湿巾配纸巾…）+ 补充包
  if (String(mode) === '超详细') {
    const names = items.map((i) => i.name);
    COMPANION.forEach(({ key, extra }) => { if (names.some((n) => n.includes(key))) extra.forEach(add); });
    DETAILED_EXTRA.forEach(add);
    items.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  const m = Number(month) || new Date().getMonth() + 1;
  const seasonAdvice = {
    '春': '气温回升但昼夜温差大，多雨雾，建议“洋葱式”叠穿并随身带伞。',
    '夏': '炎热多雨，紫外线强，注意防晒、补水、防中暑，并备雨具应对午后雷阵雨。',
    '秋': '天高气爽但昼夜温差增大，早晚加薄外套，空气干燥注意保湿。',
    '冬': '寒冷（湿冷地区体感更冷），务必做好保暖，注意防寒防冻。'
  }[season] || '出行前请查询当地天气预报。';
  const weatherAdvice = `${m}月去${destination.name}：${seasonAdvice}${destination.climate ? '（当地气候：' + destination.climate + '）' : ''}`;

  const tips = [
    notes ? '✍️ 用户特别要求：' + notes : null,
    `建议游玩 ${destination.suggestDays}，行程放慢，每天留半天机动时间。`,
    '证件、药品分别放随身包与行李箱各一份，以防丢失。',
    destination.elderlyFriendly || '注意劳逸结合。',
    Number(durationDays) >= 5 ? '行程较长，中途安排一天轻松休整，避免连续奔波。' : null
  ].filter(Boolean);

  return {
    provider: 'rule',
    season,
    monthLabel: monthName(month),
    weatherAdvice,
    tips,
    items,
    generatedAt: new Date().toISOString()
  };
}

function ruleBasedGuide(destination) {
  return {
    provider: 'rule',
    title: `${destination.name} · 家庭旅行攻略`,
    summary: destination.description,
    sections: [
      { heading: '行程概览', content: `建议游玩 ${destination.suggestDays}。${destination.description}` },
      { heading: '必玩亮点', content: destination.highlights.map((h) => `· ${h.title}：${h.text}`).join('\n') },
      { heading: '带长辈的提示', content: destination.elderlyFriendly },
      { heading: '出行准备', content: destination.packingNote }
    ],
    tips: ['提前在官方渠道预约门票，热门景点建议错峰', '给老人和孩子备好身份证/户口本', '关注当地天气，及时调整行程'],
    generatedAt: new Date().toISOString()
  };
}

const SYSTEM_PROMPT = `你是一位资深的家庭旅行规划师，擅长为“老人+成人+孩子”的混合家庭设计旅行方案。
请始终用简体中文回答，语气亲切、建议具体、考虑安全与体力。`;

function buildRecommendPrompt(params) {
  const { destination, month, durationDays, elderly, adults, children, interests, mode, notes } = params;
  return `请为以下家庭旅行生成“出行打包清单”，输出 JSON（不要输出其他文字）：
{
  "season": "季节",
  "monthLabel": "X月",
  "weatherAdvice": "一句话当地该时段天气与穿衣建议",
  "items": [ { "category": "分类(证件财务/衣物鞋帽/药品健康/洗护防晒/电子设备/出行装备/其他)", "name": "物品名", "reason": "为什么带", "priority": 1-3 } ],
  "tips": [ "3-5 条出行小贴士" ]
}

旅行信息：
- 目的地：${destination.name}（${destination.province}），特点：${destination.tags.join('、')}
- 当地气候：${destination.climate}
- 出行月份：${monthName(month)}
- 出行天数：${durationDays} 天
- 同行人：老人 ${elderly} 人、成人 ${adults} 人、儿童 ${children} 人
- 兴趣偏好：${interests.length ? interests.join('、') : '无特别偏好'}
- 模式：${mode === '超详细' ? '超详细（懒人攻略）' : '简略（精选必备）'}
- 用户要求：${notes || '无'}
- 目的地出行备注：${destination.packingNote}
请重点覆盖：
① **当月天气分析**：结合 ${monthName(month)} 在该目的地的大致天气（当地气候：${destination.climate || '未知'}），决定衣物厚度、雨具、防晒、防寒/防潮等物品；
② 老人常用药与适老装备；
③ 儿童用品；
④ 目的地特色（如海滨防水/高原防高反）。
⑤ 若为「超详细」模式：做成懒人超细清单（35-50 项），并做配套补充——带防晒霜→补面部清洁乳/卸妆+洗面奶；带湿巾→补小包纸巾+垃圾袋；带墨镜→补眼镜盒；带泳衣→补速干毛巾+防水袋；带驱蚊→补止痒膏；带相机→补备用电池/存储卡……把容易漏的配套小物系统补全。
⑥ 用户要求（如有）务必纳入清单，并在对应物品的 reason 里说明。
物品总数量：简略 18-28 项；超详细 35-50 项。并在 weatherAdvice 里明确说明该月天气与穿衣建议。`;
}

function buildGuidePrompt(destination) {
  return `请为“${destination.name}”生成一份适合全家（含老人孩子）的旅行攻略，输出 JSON（不要输出其他文字）：
{
  "title": "攻略标题",
  "summary": "一句话总览",
  "sections": [ { "heading": "小节标题", "content": "该小节内容（可包含换行，2-4 句）" } ],
  "tips": [ "3-5 条实用提醒" ]
}

目的地资料：
- 简介：${destination.description}
- 亮点：${destination.highlights.map((h) => h.title + '：' + h.text).join('；')}
- 适老提示：${destination.elderlyFriendly}
- 出行准备：${destination.packingNote}
请包含：行程安排建议（${destination.suggestDays}）、适合老人孩子的玩法、美食推荐、注意事项。sections 建议 4-6 个小节。`;
}

async function recommend(params, aiOverrides) {
  const settings = ai.getSettings(aiOverrides);
  const fallback = buildRuleBased(params);
  if (!settings.apiKey) return fallback;
  try {
    const content = await ai.chat(
      settings,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildRecommendPrompt(params) }
      ],
      { temperature: 0.6 }
    );
    const parsed = ai.extractJson(content);
    if (!parsed || !Array.isArray(parsed.items)) return fallback;
    return {
      ...fallback,
      ...parsed,
      provider: 'ai',
      model: settings.model,
      generatedAt: new Date().toISOString()
    };
  } catch (e) {
    return { ...fallback, aiError: e.message };
  }
}

async function aiGuide(destination, aiOverrides) {
  const settings = ai.getSettings(aiOverrides);
  const fallback = ruleBasedGuide(destination);
  if (!settings.apiKey) return fallback;
  try {
    const content = await ai.chat(
      settings,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildGuidePrompt(destination) }
      ],
      { temperature: 0.7 }
    );
    const parsed = ai.extractJson(content);
    if (!parsed || !Array.isArray(parsed.sections)) return fallback;
    return { ...fallback, ...parsed, provider: 'ai', model: settings.model, generatedAt: new Date().toISOString() };
  } catch (e) {
    return { ...fallback, aiError: e.message };
  }
}

module.exports = { recommend, aiGuide, seasonFromMonth, loadDestinations };