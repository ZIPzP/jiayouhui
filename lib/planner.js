'use strict';
/**
 * AI 行程规划引擎：根据「目的地 + 去返日期 + 天数 + 交通 + 忌食 + 预算 + 节奏 + 兴趣 + 其他需求」
 * 生成逐日详细行程（含费用估算、交通安排、忌食提醒）。
 * - 配置了 AI Key 时调用大模型（DeepSeek 等 OpenAI 兼容接口）
 * - 未配置或失败时自动降级为内置规则引擎
 */
const ai = require('./ai');
const path = require('path');
/* 城市英文名：目的地优先用数据里的 enName，其余用拼音首字母大写（少数城市特例） */
const CITY_PY = (() => { try { return require(path.join(__dirname, '..', 'data', 'city-pinyin.json')); } catch (e) { return {}; } })();
/* 目的地数据英文映射（亮点标题/描述、适老说明等）：data/dest-i18n.json */
const DEST_I18N = (() => { try { return require(path.join(__dirname, '..', 'data', 'dest-i18n.json')); } catch (e) { return {}; } })();
const trData = (s) => (DEST_I18N[String(s)] || s);
const CITY_EN_SPECIAL = { xian: "Xi'an", huhehaote: 'Hohhot', wulumuqi: 'Urumqi', lasa: 'Lhasa', shigatse: 'Shigatse', xianggelila: 'Shangri-La', jiuzhaigou: 'Jiuzhaigou', shangrila: 'Shangri-La' };
function cityEn(name) {
  const n = String(name || '').trim().replace(/[省市]$/, '');
  if (!n) return "";
  if (/^[A-Za-z\s'\-]+$/.test(n)) return n.charAt(0).toUpperCase() + n.slice(1);
  const py = CITY_PY[n];
  if (!py) return n;
  if (CITY_EN_SPECIAL[py]) return CITY_EN_SPECIAL[py];
  return py.charAt(0).toUpperCase() + py.slice(1);
}

/* ---------------- 自定义目的地 ---------------- */
/** 用户输入任意城市时构造的最小目的地对象（AI 可基于常识规划） */
function customDestination(name, note) {
  const n = String(name || '').trim();
  return {
    id: 'custom',
    name: n,
    enName: '',
    province: '',
    emoji: '📍',
    accent: '#0f766e',
    tagline: '',
    tags: [],
    bestSeasons: [],
    suggestDays: '',
    climate: '',
    cover: '',
    gallery: [],
    highlights: [],
    elderlyFriendly: '',
    packingNote: note ? `用户补充：${note}` : '',
    description: note || `${n} 定制行程`
  };
}
/* ---------------- 内置规则引擎 ---------------- */
const DIET_MAP = {
  '不吃辣': '选择清淡菜系（粤菜/淮扬菜/江浙菜），避开川湘菜，点菜时说明不放辣。',
  '素食': '优先选择素菜馆/寺院斋饭，或点当地时蔬与豆制品。',
  '清真': '选择清真认证餐厅，以牛羊肉和面食为主。',
  '海鲜过敏': '全程避开海鲜类菜品，点餐前务必说明海鲜过敏。',
  '花生坚果过敏': '避开含花生/坚果的甜品与酱料，点餐前说明。',
  '乳糖不耐': '避开牛奶、奶酪等乳制品，饮品选择豆浆/茶。',
  '无特别忌口': '可放心品尝当地特色美食。'
};
const BUDGET = {
  '经济型': { hotel: 120, meals: 100, tickets: 80, transport: 500, note: '经济连锁酒店 + 公共交通为主' },
  '舒适型': { hotel: 350, meals: 220, tickets: 180, transport: 1100, note: '舒适型酒店 + 打车/包车结合' },
  '豪华型': { hotel: 850, meals: 450, tickets: 320, transport: 2200, note: '高档酒店 + 专车/包车' }
};
const PACE_NOTE = {
  '轻松慢游': '节奏放缓，每天安排 2-3 个点，中午预留午休，适合老人孩子。',
  '标准': '经典打卡 + 适量休整，日均 3-4 个点。',
  '紧凑': '高效打卡，日均 4-5 个点，适合精力旺盛的年轻人。'
};

function daysBetween(start, end) {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  return Math.round((e - s) / 86400000) + 1;
}
const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function fmtDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  if (lang === 'en') return `${EN_MON[d.getMonth()]} ${d.getDate()} (${EN_WD[d.getDay()]})`;
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${w}`;
}

/* ---------------- 规则引擎双语文案（中文与既有输出保持一致） ---------------- */
const DIET_MAP_EN = {
  '不吃辣': 'Choose mild cuisines (Cantonese / Huaiyang / Jiangzhe); avoid Sichuan and Hunan dishes and ask for no chilli.',
  '素食': 'Look for vegetarian restaurants or temple vegetarian meals, or order local vegetables and tofu.',
  '清真': 'Choose halal-certified restaurants; beef, lamb and noodles are usually the safest options.',
  '海鲜过敏': 'Avoid all seafood dishes and always tell the restaurant about the seafood allergy.',
  '花生坚果过敏': 'Avoid desserts and sauces containing peanuts or nuts, and inform the restaurant.',
  '乳糖不耐': 'Avoid milk, cheese and other dairy; choose soy milk or tea instead.',
  '无特别忌口': 'Feel free to try the local specialities.'
};
const BUDGET_LABEL_EN = { '经济型': 'Budget', '舒适型': 'Comfort', '豪华型': 'Luxury' };
const BUDGET_NOTE_EN = {
  '经济型': 'Budget chain hotels + public transport',
  '舒适型': 'Comfort hotels + a mix of taxis and private cars',
  '豪华型': 'Upscale hotels + private car or chartered car'
};
const PACE_NOTE_EN = {
  '轻松慢游': 'Relaxed pace: 2–3 stops a day with a midday rest — good for seniors and children.',
  '标准': 'Classic highlights plus regular breaks: 3–4 stops a day.',
  '紧凑': 'Packed pace: 4–5 stops a day, best for energetic young travellers.'
};
const TIME_EN = { '上午': 'morning', '中午': 'midday', '下午': 'afternoon', '晚上': 'evening' };
const TRANSPORT_EN = { '飞机': 'flight', '高铁': 'high-speed rail', '自驾': 'self-driving', '大巴': 'coach' };
const INTEREST_EN = { '自然风光': 'nature', '美食': 'food', '历史人文': 'history & culture', '博物馆': 'museums', '海滨玩水': 'beaches', '古城老街': 'old towns', '夜景': 'night views', '亲子乐园': 'theme parks' };
const DIET_LABEL_EN = { '不吃辣': 'no chilli', '素食': 'vegetarian', '清真': 'halal', '海鲜过敏': 'seafood allergy', '花生坚果过敏': 'nut allergy', '乳糖不耐': 'lactose-free' };

function rulePlan(params, lang) {
  const en = lang === 'en';
  const { destination, origin, returnDest, startDate, endDate, days, transport, travelTime, elderly, adults, children, dietary, budget, pace, accommodation, interests, notes } = params;
  const n = Math.max(1, Math.min(14, Number(days) || 3));
  const b = BUDGET[budget] || BUDGET['舒适型'];
  const hls = destination.highlights || [];
  const dietArr = (dietary && dietary.length ? dietary : ['无特别忌口']);
  const dietMap = en ? DIET_MAP_EN : DIET_MAP;
  const dietaryNotes = dietArr.map((d) => dietMap[d] || (en ? `Dietary note: ${d}` : `已记录忌口：${d}，请用餐时注意。`));
  const HAINAN = ['三亚', '海口', '万宁', '文昌', '琼海', '儋州', '五指山', '东方'];
  const originNorm = String(origin || '').replace(/[省市]$/, '');
  const destNorm = String(destination.name || '').replace(/[省市]$/, '');
  const T = (k) => (en ? TIME_EN[k] : k) || k;
  const destLabel = en ? (destination.enName || cityEn(destination.name)) : destination.name;
  // 英文模式下，目的地亮点/适老说明走翻译表
  const hlT = (h) => (en ? trData(h.title) : h.title);
  const hlX = (h) => (en ? trData(h.text) : h.text);
  const originLabel = en ? cityEn(origin) : (origin || '');
  const returnLabel = en ? cityEn(returnDest) : (returnDest || '');
  const tp = (en ? TRANSPORT_EN : null);
  const transportLabel = tp ? (TRANSPORT_EN[transport] || transport || 'transport') : (transport || '交通工具');
  let transportNote;
  if (en) {
    transportNote = transport === '自驾' ? 'Self-driving: check the car beforehand, plan your highway route and allow time for traffic.'
      : transport === '高铁' ? 'High-speed rail: book on 12306 in advance, then use the subway or taxis in town.'
      : transport === '飞机' ? 'By air: arrive at the airport 2 hours early, then take the airport bus, subway or a taxi into town.'
      : 'Transport not decided yet — compare flights and high-speed rail from your departure city.';
    if (transport === '高铁' && HAINAN.includes(destNorm) && !HAINAN.includes(originNorm)) {
      transportNote = '⚠️ ' + destLabel + ' is on Hainan Island and mainland high-speed rail cannot reach it directly (the train crosses by ferry and takes much longer). Flying is recommended; the island ring railway links the cities.';
    }
    if (travelTime && travelTime !== '未定') transportNote += ' You prefer ' + T(travelTime) + ' departures, so prioritise ' + T(travelTime) + ' services.';
  } else {
    transportNote = transport === '自驾' ? '自驾出行，请提前检查车况、规划高速路线并预留堵车时间。'
      : transport === '高铁' ? '高铁出行，建议提前在 12306 购票，市区内地铁/打车接驳。'
      : transport === '飞机' ? '飞机出行，建议提前 2 小时到机场，抵达后机场大巴/地铁/打车进城。'
      : '交通方式未定，建议根据出发地提前对比机票与高铁票价。';
    if (transport === '高铁' && HAINAN.includes(destNorm) && !HAINAN.includes(originNorm)) {
      transportNote = '⚠️ ' + destNorm + '在海南岛，大陆高铁无法直达（火车需经粤海铁路轮渡、班次少耗时长），建议改选「飞机」更省时；岛内可乘环岛高铁。';
    }
    if (travelTime && travelTime !== '未定') transportNote += ' 用户偏好' + travelTime + '时段出行，请优先安排' + travelTime + '出发的班次。';
  }

  const daysPlan = [];
  const totalPeople = Math.max(1, (Number(elderly) || 0) + (Number(adults) || 2) + (Number(children) || 0));
  for (let i = 0; i < n; i++) {
    const dayNum = i + 1;
    const isLast = i === n - 1;
    const hl = hls[(i) % Math.max(1, hls.length)];
    const hl2 = hls[(i + 1) % Math.max(1, hls.length)];
    const title = isLast ? (en ? 'Heading home' : '返程')
      : (dayNum === 1 ? (en ? 'Arrival & first look' : '抵达·初体验') : (hl ? hlT(hl) : (en ? 'A day in the city' : '市区休闲')));
    const schedule = isLast ? [
      { time: T('上午'), activity: en ? 'Breakfast, pack and check out' : '享用早餐，整理行李退房', detail: en ? 'Check out after breakfast; the hotel can store your luggage.' : '酒店早餐后退房，行李可寄存前台。' },
      { time: T('中午'), activity: en ? 'Lunch nearby, then set off' : '就近午餐后出发', detail: en ? 'Reach the airport or rail station 2–3 hours before departure.' : '按返程班次提前 2-3 小时前往机场/高铁站。' },
      { time: T('下午'), activity: en ? 'Travel home' : '返程', detail: `${transportNote}` }
    ] : [
      { time: T('上午'), activity: dayNum === 1 ? (en ? 'Arrive and settle into the hotel' : '抵达目的地，前往酒店安顿') : (hl ? hlT(hl) : (en ? 'City sights' : '市区景点')), detail: dayNum === 1 ? (en ? `${transportNote} Check in and have lunch nearby.` : `${transportNote} 抵达后办理入住，附近午餐。`) : (hl ? hlX(hl) : (en ? 'Free time' : '自由活动')) },
      { time: T('下午'), activity: dayNum === 1 ? (hl2 ? hlT(hl2) : (en ? 'City stroll' : '市区漫步')) : (hl2 ? hlT(hl2) : (en ? 'At leisure' : '休闲')), detail: hl2 ? hlX(hl2) : '' },
      { time: T('晚上'), activity: dayNum === 1 ? (en ? 'Night views or the food street' : '市区夜景/美食街') : (en ? 'Local dinner and rest' : '特色晚餐 + 休息'), detail: en ? `${destLabel} nightlife and food — turn in early to be fresh tomorrow.` : `${destination.name}夜生活与美食，注意早点休息，为第二天养精蓄锐。` }
    ];
    const meals = [
      { type: en ? 'Breakfast' : '早餐', recommend: en ? 'Hotel breakfast / local snacks' : '酒店含早 / 当地小吃', note: dietArr.includes('不吃辣') ? (en ? 'Ask for mild dishes' : '选清淡口味') : '' },
      { type: en ? 'Lunch' : '午餐', recommend: en ? `${destLabel} local restaurant` : `${destination.name}特色餐厅`, note: dietArr.map((d) => dietMap[d] && d !== '无特别忌口' ? (en ? `(${DIET_LABEL_EN[d] || d})` : `（${d}）`) : '').filter(Boolean).join('') || (en ? 'Local home-style food' : '本地家常菜') },
      { type: en ? 'Dinner' : '晚餐', recommend: en ? 'Food street / recommended restaurant' : '美食街 / 推荐餐厅', note: dietArr.includes('海鲜过敏') ? (en ? 'Seafood avoided' : '已避开海鲜') : (en ? 'Try the signature dishes' : '可尝试招牌菜') }
    ];
    daysPlan.push({
      day: dayNum,
      dateLabel: startDate ? `${fmtDate(startDate, lang)}` + (n > 1 ? (en ? ` · day ${i + 1}` : ` +${i}天`) : '') : (en ? `Day ${dayNum}` : `第${dayNum}天`),
      title,
      schedule,
      meals,
      transport: dayNum === 1 ? transportNote : (isLast ? (en ? 'Return' : '返程') : (en ? 'Local transport (taxi / subway / private car)' : '市内交通（打车/地铁/包车）')),
      accommodation: accommodation || (en ? BUDGET_NOTE_EN[budget] : b.note) || b.note,
      costPerPerson: isLast ? Math.round(b.transport * 0.5) : Math.round(b.hotel + b.meals + b.tickets)
    });
  }
  const perDay = b.hotel + b.meals + b.tickets;
  const totalPerPerson = b.transport + perDay * n;
  const budgetNote = en ? (BUDGET_NOTE_EN[budget] || BUDGET_NOTE_EN['舒适型']) : b.note;
  const budgetEstimate = {
    transport: en ? `Round-trip transport (≈ ¥${b.transport} per person)` : `往返交通（人均约 ¥${b.transport}）`,
    accommodation: en ? `Accommodation ${n - 1} ${n - 1 === 1 ? 'night' : 'nights'} (≈ ¥${b.hotel * (n - 1)} per person)` : `住宿 ${n - 1} 晚（人均约 ¥${b.hotel * (n - 1)}）`,
    meals: en ? `Meals (≈ ¥${b.meals * n} per person)` : `餐饮（人均约 ¥${b.meals * n}）`,
    tickets: en ? `Tickets (≈ ¥${b.tickets * n} per person)` : `门票（人均约 ¥${b.tickets * n}）`,
    totalPerPerson: en ? `About ¥${totalPerPerson} (${totalPeople} travellers)` : `¥${totalPerPerson} 左右（${totalPeople} 人同行）`,
    note: en ? `Estimated at the "${BUDGET_LABEL_EN[budget] || 'Comfort'}" level; actual prices follow official fares. ${budgetNote}.` : `按「${budget || '舒适型'}」估算，实际以官方票价为准。${b.note}。`
  };
  const paceNote = en ? (PACE_NOTE_EN[pace] || PACE_NOTE_EN['标准']) : (PACE_NOTE[pace] || PACE_NOTE['标准']);
  const interestTxt = (interests && interests.length) ? (en ? ' Focus: ' + interests.map((x) => INTEREST_EN[x] || x).join(', ') + '.' : ' 侧重：' + interests.join('、') + '。') : '';
  return {
    provider: 'rule',
    title: en ? `${destLabel} · ${n}-day family itinerary${transport ? ' (' + transportLabel + ')' : ''}` : `${destination.name} ${n}天${(transport || '') ? '·' + transport : ''}家庭行程`,
    summary: en
      ? `${fmtDate(startDate, lang) || 'Dates to be decided'}, ${n} days ${n - 1} nights, departing from ${originLabel || 'your city'}. ${paceNote}${interestTxt}`
      : `${fmtDate(startDate) || '出行日期待定'}，${n} 天 ${n - 1} 晚，${origin || ''}出发。${PACE_NOTE[pace] || PACE_NOTE['标准']}${interestTxt}`,
    days: daysPlan,
    transportPlan: {
      outbound: en
        ? (transport === '自驾' ? `Drive from ${originLabel || 'your city'} to ${destLabel} — set off early to avoid the rush.` : `Take a ${transportLabel} from ${originLabel || 'your city'} to ${destLabel}; book in advance and allow time for check-in / boarding.`)
        : (transport === '自驾' ? `从${origin || '出发地'}自驾前往${destination.name}，建议早出发避开高峰。` : `从${origin || '出发地'}乘${transport || '交通工具'}前往${destination.name}，建议提前购票并预留值机/进站时间。`),
      inbound: en
        ? (returnDest ? `Return to ${returnLabel} on the last day; reach the airport or station 2–3 hours before departure.` : `Return to ${originLabel || 'your departure city'} on the last day; reach the airport or station 2–3 hours before departure.`)
        : (returnDest ? `返程前往${returnDest}，按最后一天班次安排，建议提前 2-3 小时抵达机场/车站。` : `返程返回出发地${origin || ''}，按最后一天班次安排，建议提前 2-3 小时抵达机场/车站。`),
      local: en
        ? `In ${destLabel}, combine the subway or bus with taxis; a chartered car between sights is easier with seniors and children.`
        : `${destination.name}市内建议地铁/公交+打车组合，景点间包车更省力（尤其带老人孩子）。`
    },
    budget: budgetEstimate,
    dietaryNotes,
    paceNote,
    tips: [
      (en ? (trData(destination.elderlyFriendly) || 'Balance activity with rest.') : (destination.elderlyFriendly || '注意劳逸结合。')),
      en ? 'Ticket and reservation policies change often (many sights are free but need booking) — confirm on the official channels before you go.' : '门票与预约政策可能随时调整（不少景区免费但需预约），出发前请到景区官方渠道（公众号/官网）确认最新规定。',
      en ? `Carry your ID and medicine; you will walk a lot in ${destLabel}, so wear comfortable shoes.` : `证件与药品随身带，${destination.name}景点多需步行，穿舒适鞋。`,
      notes ? (en ? `Your notes: ${notes}` : `其他需求：${notes}`) : (en ? 'Book tickets through official channels and travel outside peak times.' : '提前在官方渠道预约门票，错峰出行。')
    ],
    generatedAt: new Date().toISOString()
  };
}

/* ---------------- AI 大模型 ---------------- */
const SYSTEM_PROMPT = `你是一位资深家庭旅行规划师（AI 主理人），擅长为“老人+成人+孩子”的混合家庭设计可执行的详细行程。
你必须考虑：价格预算（分项估算）、往返交通安排、当地交通、忌口/饮食安全、游玩节奏、老人孩子的体力。
必须严格遵循用户填写的「其他需求」：用户明确说去程坐什么、返程坐什么、要去某地徒步几天、想看什么、忌什么，都要逐条落实到行程里，不得忽略或擅自更改。
交通安排优先遵循用户选择的交通方式：大中城市之间一般都有直飞或高铁，不要臆断「没有直达」；只有当该方式确实不存在（如大陆高铁无法直达海南岛）时才改为可行方式，并在 transportPlan 里说明原因。提示词中已提供 12306 真实车次与票价的，必须原样直接采用，严禁编造或修改；未提供的（如航班号、机票价格）一律提醒用户以 12306 / 航司官方实时查询为准，不要编造具体航班号、时刻或精确价格。
请始终用简体中文回答，语气亲切、建议具体。注意：交通班次与票价以提示词中提供的 12306 真实数据为准；未提供的给“参考建议”，并提醒以 12306/航司/官方渠道为准。`;

function buildPlanPrompt(params) {
  const { destination, origin, returnDest, realTrains, startDate, endDate, days, transport, travelTime, elderly, adults, children, dietary, budget, pace, accommodation, interests, notes } = params;
  // 12306 真实车次：拉到就要求 AI 直接采用；拉不到则提醒以官方为准
  const rt = realTrains || {};
  const fmtTrains = (ts) => (ts || []).slice(0, 6).map((t) => {
    const p = t.prices || {};
    const pStr = ['二等座', '一等座', '商务座'].filter((k) => p[k]).map((k) => `${k}¥${p[k]}`).join(' ');
    return `${t.no} ${t.fromTime}-${t.toTime} 历时${t.duration}${t.second ? ' 二等座有票' : ''}${t.first ? ' 一等座有票' : ''}${pStr ? ' ' + pStr : ''}`;
  }).join('；') || '暂无直达，需中转';
  const hasRt = (rt.outbound && rt.outbound.length) || (rt.inbound && rt.inbound.length);
  const realBlock = hasRt
    ? `- 【12306 真实车次与票价·必须直接采用，严禁编造】
  去程（${origin || ''}→${destination.name}）：${fmtTrains(rt.outbound)}
  返程（${destination.name}→${returnDest || origin || ''}）：${fmtTrains(rt.inbound)}
  以上车次、时刻与票价为 12306 实时官方数据：请从以上真实车次中挑选合适的填入 transportPlan 与逐日安排，车次号/时刻/票价原样直接采用（票价精确到元，可注明"以12306为准"），不要编造其它车次号/时刻/票价；若无直达车次，请明确提示需中转并给出大致中转建议。`
    : `- 交通：车次与票价请以12306/航司官方实时查询为准，不要编造具体车次号与票价。`;
  const fbInstr = (rt.display && (rt.display.outboundFellBack || rt.display.inboundFellBack))
    ? '\n（注意：用户所选出行时段暂无直达车次，已自动推荐上午车次，请优先从以上上午车次中选择，并在 transportPlan 注明"该时段暂无车次，已自动推荐上午"）'
    : '';
  return `请为以下家庭旅行生成一份“逐日详细行程规划”，输出 JSON（不要输出其他文字）：
{
  "title": "行程标题",
  "summary": "行程总览（含人数、出发地、天数、节奏、亮点）",
  "days": [
    {
      "day": 1,
      "dateLabel": "X月X日 周X",
      "title": "当天主题",
      "schedule": [ { "time": "上午/中午/下午/晚上", "activity": "做什么", "detail": "具体安排与说明" } ],
      "meals": [ { "type": "早餐/午餐/晚餐", "recommend": "推荐吃什么/去哪吃", "note": "针对忌口的提示" } ],
      "transport": "当天交通安排",
      "accommodation": "住宿建议（含区域/价位）",
      "costPerPerson": "当天人均花费估算"
    }
  ],
  "transportPlan": { "outbound": "去程交通安排（真实车次/方式/耗时；不要编造票价）", "inbound": "返程交通安排（同上）", "local": "当地交通建议" },
  "budget": { "transport": "", "accommodation": "", "meals": "", "tickets": "", "totalPerPerson": "", "note": "价格说明" },
  "dietaryNotes": [ "针对忌口的用餐提醒" ],
  "tips": [ "3-6 条实用提醒" ]
}

旅行信息：
- 目的地：${destination.name}（${destination.province}），气候：${destination.climate}，亮点：${destination.highlights.map(h => h.title).join('、')}
- 出发地：${origin || '未填写'}；交通方式：${transport || '未定'}（优先按所选方式安排：大中城市间一般有直飞/高铁，不要臆断没有；仅当该方式确实不存在（如海岛无大陆高铁）时才调整并说明）
- 交通出行时间偏好：${travelTime || '上午'}（去程与返程班次尽量安排在该时段出发：上午≈5-12点、中午≈12-14点、下午≈14点后；12306 车次已按该时段筛选）
- 返程目的地：${returnDest || ('返回出发地 ' + (origin || '未填写'))}（用户没填则默认返回出发城市；填了则返程按该城市安排交通与返程日）
- 去程日期：${fmtDate(startDate) || '未定'}；返程日期：${fmtDate(endDate) || '未定'}；行程：${days} 天
- 同行：老人 ${elderly || 0} 人、成人 ${adults || 0} 人、儿童 ${children || 0} 人
- 忌口/饮食：${(dietary && dietary.length) ? dietary.join('、') : '无特别忌口'}
- 预算档位：${budget || '舒适型'}；住宿偏好：${accommodation || '无特别要求'}
- 游玩节奏：${pace || '标准'}；兴趣偏好：${(interests && interests.length) ? interests.join('、') : '无'}
- 其他需求（用户明确写的要求，必须严格遵守并逐条落实到行程里）：${notes || '无'}
${realBlock}${fbInstr}
- 适老提示：${destination.elderlyFriendly}
- 特别注意：门票/预约/开放时间时效性强（不少景区免费但需预约），请在 tips 里提醒用户以景区官方最新公告为准，不要写死过时价格。
- 交通时效特别提示：涉及飞机时只写「建议城市→城市、大致飞行时长」，不要编造航班号（如MU123）、起飞时刻或精确机票价格；涉及火车时优先采用上面真实车次。所有票价一律提醒用户以12306/航司官方实时查询为准。
请务必：① 每天 3-5 段安排，含具体景点/餐厅建议；② 逐项给出人均费用估算并汇总；③ 交通给出参考班次时段与当地接驳；④ 忌口贯穿到每餐；⑤ 行程覆盖 ${days} 天。⑥ 用户「其他需求」里写的每一条要求，都要落实进对应天的安排（如老人腿脚不便→少走路/多打车、想看日出→安排观景点、要拍照→带设备提示），并在 summary 或 tips 中体现；如果其他需求为"无"则忽略。⑦ 返程按「返程目的地」安排——用户填了返程城市就返程到那里（去程与返程可能不同城），没填就返回出发城市；transportPlan.inbound 要写清返程去向。`;
}

async function buildPlan(params, aiOverrides) {
  const settings = ai.getSettings(aiOverrides);
  const fallback = rulePlan(params, (aiOverrides || {}).lang);
  if (!settings.apiKey) return fallback;
  try {
    const content = await ai.chat(settings, [
      { role: 'system', content: SYSTEM_PROMPT + ai.langDirective(aiOverrides) },
      { role: 'user', content: buildPlanPrompt(params) }
    ], { temperature: 0.7 });
    const parsed = ai.extractJson(content);
    if (!parsed || !Array.isArray(parsed.days)) return fallback;
    return { ...fallback, ...parsed, provider: 'ai', model: settings.model, generatedAt: new Date().toISOString() };
  } catch (e) {
    return { ...fallback, aiError: e.message };
  }
}

/* ---------------- AI 主理人问答 ---------------- */
const CHAT_SYSTEM = `你是「家游汇」网站的 AI 主理人，一个亲切专业的家庭旅行顾问。
你可以回答关于目的地推荐、行程安排、交通、美食、忌口、费用、打包行李等任何家庭旅行问题。
始终用简体中文，回答简洁实用（一般 3-8 句话），涉及票价班次等实时信息时提醒以官方渠道为准。`;

async function chatReply(message, history, aiOverrides) {
  const settings = ai.getSettings(aiOverrides);
  const messages = [
    { role: 'system', content: CHAT_SYSTEM + ai.langDirective(aiOverrides) },
    ...(history || []).slice(-8),
    { role: 'user', content: message }
  ];
  if (!settings.apiKey) {
    return { provider: 'rule', reply: '（当前为演示模式，未配置 AI Key）我是「家游汇」AI 主理人 🐱 配置 DeepSeek API Key 后，我可以帮你规划详细行程、推荐餐厅、估算费用、安排交通。你也可以直接使用页面上方的「行程规划」按钮式表单生成完整方案。' };
  }
  try {
    const content = await ai.chat(settings, messages, { jsonMode: false, temperature: 0.8 });
    return { provider: 'ai', reply: content.trim() };
  } catch (e) {
    return { provider: 'rule', reply: `（AI 调用失败，已降级）${e.message}` };
  }
}

module.exports = { buildPlan, chatReply, rulePlan, customDestination, cityEn };
