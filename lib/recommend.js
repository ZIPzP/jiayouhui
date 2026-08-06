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
  const { destination, month, durationDays } = params;
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

  items.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const weatherAdvice = {
    '春': `${destination.name}春季气候温和但早晚温差较大，建议“洋葱式”叠穿，随身带伞应对春雨。`,
    '夏': `${destination.name}夏季炎热${destination.tags.includes('海滨') ? '且紫外线强' : ''}，注意防晒补水，尽量避开正午暴晒。`,
    '秋': `${destination.name}秋季天高气爽，但早晚渐凉，带件薄外套即可。`,
    '冬': `${destination.name}冬季${String(destination.climate).includes('暖') ? '温暖避寒，备薄外套' : '寒冷干燥，务必做好保暖'}。`
  }[season] || `${destination.name}出行前请查询当地天气预报。`;

  const tips = [
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
  const { destination, month, durationDays, elderly, adults, children, interests } = params;
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
- 目的地出行备注：${destination.packingNote}
请重点覆盖：季节物品、老人常用药与适老装备、儿童用品、目的地特色（如海滨防水/高原防高反）。物品总数量建议 18-28 项。`;
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