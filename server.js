'use strict';
/**
 * 家游汇 · 家庭旅游推荐与攻略选择
 * 零依赖 Node.js 服务器：静态页面 + REST API
 *
 * 启动：node server.js   （默认 http://localhost:3000）
 */
const http = require('http');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const url = require('url');
const ai = require('./lib/ai');
const rec = require('./lib/recommend');
const planner = require('./lib/planner');
const auth = require('./lib/auth');
const weather = require('./lib/weather');
const collector = require('./lib/collector');
const train = require('./lib/train');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/* ---------- 安全防护：AI 限流 / 登录锁定 / 任务表清理 ---------- */
const RATE = { windowMs: 60000, max: 30 };                    // AI 接口：每 IP 每分钟 30 次
const LOGIN = { windowMs: 60000, max: 5, lockMs: 60000 };     // 登录失败：每 IP 每分钟 5 次后锁 1 分钟
const JOB_TTL = 5 * 60 * 1000;                                // 任务结果保留 5 分钟
const MAX_JOBS = 20;                                          // 最大并发任务数
const hits = new Map();                                       // ip -> { n, reset }
const loginFails = new Map();                                 // ip -> { n, reset, lockedUntil }
// 仅信任来自本机 nginx 的代理头（remoteAddress 不可伪造）；直连请求一律忽略伪造头，防绕过限流/锁定
const TRUSTED_PROXY = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
function clientIp(req) {
  const socketIp = String(req.socket.remoteAddress || '');
  if (TRUSTED_PROXY.has(socketIp)) {
    const real = req.headers['x-real-ip'];
    if (real) return String(real).trim();
    const xff = req.headers['x-forwarded-for'];
    if (xff) { const list = String(xff).split(',').map((s) => s.trim()).filter(Boolean); if (list.length) return list[list.length - 1]; }
  }
  return socketIp.replace(/^::ffff:/, '');
}
function bucket(map, key, windowMs) {
  const now = Date.now();
  const rec = map.get(key) || { n: 0, reset: now + windowMs };
  if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs; }
  return rec;
}
function allowAi(req) {
  const rec = bucket(hits, clientIp(req), RATE.windowMs);
  rec.n++; hits.set(clientIp(req), rec);
  return rec.n <= RATE.max;
}
function loginAllowed(req) {
  const rec = bucket(loginFails, clientIp(req), LOGIN.windowMs);
  const allowed = !(rec.lockedUntil && Date.now() < rec.lockedUntil);
  return { rec, allowed };
}
// 定期清理限流/登录记录，防止 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  for (const [k, v] of loginFails) if (now > v.reset && now > (v.lockedUntil || 0)) loginFails.delete(k);
}, 5 * 60 * 1000).unref();

/* ---------- 响应安全头 ---------- */
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC_HEADERS);
  const accept = (res.req && res.req.headers && res.req.headers['accept-encoding']) || '';
  if (body.length > 512 && /gzip/i.test(accept)) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    return res.end(zlib.gzipSync(body));
  }
  res.writeHead(status, headers);
  res.end(body);
}

/** 后台任务：AI 生成在服务器后台继续，客户端可随时轮询结果 */
const jobs = new Map();
function runJob(fn) {
  if (jobs.size >= MAX_JOBS) throw new Error('系统繁忙，请稍后再试');
  const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  jobs.set(id, { status: 'running', createdAt: Date.now() });
  const expire = () => { jobs.delete(id); };
  Promise.resolve()
    .then(fn)
    .then((result) => { const j = jobs.get(id); if (j) { j.status = 'done'; j.result = result; setTimeout(expire, JOB_TTL); } })
    .catch((e) => { const j = jobs.get(id); if (j) { j.status = 'error'; j.error = String((e && e.message) || e); setTimeout(expire, JOB_TTL); } });
  // 兜底：卡死的 running 任务也按时清理
  setTimeout(() => { const j = jobs.get(id); if (j && j.status === 'running') jobs.delete(id); }, JOB_TTL * 4).unref();
  return id;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('请求体过大')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const config = ai.loadConfig();
const destinations = (readJson(path.join(ROOT, 'data', 'destinations.json')) || { destinations: [] }).destinations || [];
// 中国城市名单（输入提示/城市自查用）
const cities = (readJson(path.join(ROOT, 'data', 'cities.json')) || { cities: [] }).cities || [];
function guessCity(raw) {
  const n = String(raw || '').trim().replace(/[省市]$/, '');
  if (!n) return null;
  const all = (cities || []).map((c) => c.name);
  const hit = all.find((x) => x === n) || all.find((x) => x.includes(n)) || all.find((x) => n.includes(x));
  if (hit) return hit;
  const score = (a, b) => {
    if (a === b) return 1;
    const sa = new Set(a), sb = new Set(b);
    let common = 0;
    for (const ch of sa) if (sb.has(ch)) common++;
    const charScore = common / Math.max(sa.size, sb.size, 1);
    const lenScore = 1 - Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1);
    return charScore * 0.7 + lenScore * 0.3;
  };
  let best = null, bestScore = -1;
  for (const x of all) {
    let s = score(n, x);
    if (x[0] === n[0]) s = Math.min(1, s + 0.25);
    if (s > bestScore) { bestScore = s; best = x; }
  }
  return bestScore >= 0.55 ? best : null;
}
function findCity(raw) {
  const n = String(raw || '').trim().replace(/[省市]$/, '');
  if (!n) return null;
  return cities.find((c) => c.name === n) || null;
}
// 对象存储(OSS/COS)支持：config.imageBase 为空时用本地 /images，设置后自动给所有图片路径加前缀（如 https://cdn.xxx.com）
const IMAGE_BASE = String((config && config.imageBase) || '').replace(/\/+$/, '');
function applyImageBase(node) {
  if (!IMAGE_BASE) return node;
  if (typeof node === 'string') return node.startsWith('/images/') ? IMAGE_BASE + node : node;
  if (Array.isArray(node)) return node.map(applyImageBase);
  if (node && typeof node === 'object') {
    const out = {};
    for (const k of Object.keys(node)) out[k] = applyImageBase(node[k]);
    return out;
  }
  return node;
}

async function handleApi(req, res, pathname) {
  // 访问口令：登录与状态
  if (pathname === '/api/auth/status' && req.method === 'GET') {
    const a = auth.accessConfig();
    const authed = !a.enabled || auth.verifyToken(auth.extractBearer(req));
    return sendJson(res, 200, { enabled: a.enabled, authed });
  }
  if (pathname === '/api/auth' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const g = loginAllowed(req);
    if (!g.allowed) return sendJson(res, 429, { error: '尝试过于频繁，请 1 分钟后再试' });
    if (auth.verifyPasscode(body.passcode)) {
      g.rec.n = 0; g.rec.lockedUntil = 0; loginFails.set(clientIp(req), g.rec);
      return sendJson(res, 200, { ok: true, token: auth.signToken() });
    }
    g.rec.n++;
    if (g.rec.n >= LOGIN.max) { g.rec.lockedUntil = Date.now() + LOGIN.lockMs; g.rec.n = 0; }
    loginFails.set(clientIp(req), g.rec);
    return sendJson(res, 401, { error: '口令错误' });
  }

  // POST /api/ai/invite —— 邀请码解锁服务端 AI（换短时效令牌；服务端 Key 永不下发）
  if (pathname === '/api/ai/invite' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    if (ai.verifyInvite(body && body.code)) {
      return sendJson(res, 200, { ok: true, aiToken: ai.signAiToken() });
    }
    return sendJson(res, 401, { error: '邀请码错误' });
  }
  // GET /api/ai/status —— 查询是否配置了邀请码、当前令牌是否有效
  if (pathname === '/api/ai/status' && req.method === 'GET') {
    return sendJson(res, 200, { hasInvite: ai.hasInvite(), unlocked: ai.verifyAiToken(String(req.headers['x-ai-token'] || '')) });
  }
    // GET /api/destinations —— 列表（不含超大字段）
  if (pathname === '/api/destinations' && req.method === 'GET') {
    const list = applyImageBase(destinations.map(({ gallery, highlights, description, ...rest }) => ({
      ...rest,
      highlightCount: (highlights || []).length,
      galleryCount: (gallery || []).length
    })));
    return sendJson(res, 200, { count: list.length, destinations: list });
  }

  // GET /api/cities —— 中国城市名单（输入提示 / 城市自查）
  if (pathname === '/api/cities' && req.method === 'GET') {
    return sendJson(res, 200, { count: cities.length, cities });
  }

  // GET /api/images —— 全部实景照片（封面/画廊/亮点，去重，供首页轮播使用）
  if (pathname === '/api/images' && req.method === 'GET') {
    const seen = new Set();
    const images = [];
    destinations.forEach((d) => {
      [d.cover].concat(d.gallery || []).concat((d.highlights || []).map((h) => h.image)).forEach((u) => {
        if (u && !seen.has(u)) { seen.add(u); images.push(u); }
      });
    });
    return sendJson(res, 200, { count: images.length, images });
  }

  // GET /api/destinations/:id —— 详情
  const dm = pathname.match(/^\/api\/destinations\/([^/]+)$/);
  if (dm && req.method === 'GET') {
    const d = destinations.find((x) => x.id === decodeURIComponent(dm[1]));
    if (!d) return sendJson(res, 404, { error: '未找到该目的地' });
    return sendJson(res, 200, { destination: applyImageBase(d) });
  }

  // GET /api/hot-data —— 平台热门数据
  if (pathname === '/api/hot-data' && req.method === 'GET') {
    const data = await collector.collect(config);
    const month = new Date().getMonth() + 1;
    const items = collector.monthlyRank(collector.merge(data.results), month);
    return sendJson(res, 200, { collectedAt: data.collectedAt, sources: data.results, month, monthLabel: month + '月', items });
  }

  // POST /api/recommend —— AI/规则 出行打包清单
  if (pathname === '/api/recommend' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const dest = destinations.find((d) => d.id === body.destinationId)
      || (body.destinationId === 'custom' && String((body.customDest || {}).name || '').trim()
          ? planner.customDestination(String((body.customDest || {}).name || '').trim(), String((body.customDest || {}).note || '').trim())
          : null);
    if (!dest) return sendJson(res, 400, { error: '请选择目的地，或选择「自定义目的地」并填写城市名' });
    if (body.destinationId === 'custom') {
      const customName = String((body.customDest || {}).name || '').trim();
      if (!findCity(customName)) return sendJson(res, 400, { error: '未找到该城市「' + customName + '」，请从提示中选择正确的城市名' });
    }
    const params = {
      destination: dest,
      month: Number(body.month) || new Date().getMonth() + 1,
      durationDays: Number(body.durationDays) || 3,
      elderly: Number(body.elderly) || 0,
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      interests: Array.isArray(body.interests) ? body.interests : [],
      mode: String(body.mode || '简略').trim(),
      notes: String(body.notes || '').trim(),
    };
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '' };
    const jobId = runJob(() => rec.recommend(params, overrides));
    return sendJson(res, 200, { jobId, status: 'running' });
  }

  // POST /api/ai-guide —— AI 生成目的地攻略
  if (pathname === '/api/ai-guide' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const dest = destinations.find((d) => d.id === body.destinationId);
    if (!dest) return sendJson(res, 400, { error: '请选择目的地 destinationId' });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '' };
    const result = await rec.aiGuide(dest, overrides);
    return sendJson(res, 200, result);
  }

  // POST /api/plan —— AI 主理人：生成逐日详细行程规划
  if (pathname === '/api/plan' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const customName = String((body.customDest || {}).name || '').trim();
    const dest = destinations.find((d) => d.id === body.destinationId)
      || (body.destinationId === 'custom' && customName
          ? planner.customDestination(customName, String((body.customDest || {}).note || '').trim())
          : null);
    if (!dest) return sendJson(res, 400, { error: '请选择目的地，或选择「自定义目的地」并填写城市名' });
    // 防浪费：出发城市必填；用户输入的城市须为中国真实城市
    const origin = String(body.origin || '').trim();
    if (!origin) return sendJson(res, 400, { error: '请填写出发城市后再生成行程' });
    if (!findCity(origin)) {
      const g = guessCity(origin);
      return sendJson(res, 400, { error: '未找到出发城市「' + origin + '」' + (g ? '，你是不是想输入「' + g + '」？' : '') + ' 请修改后重新生成' });
    }
    if (body.destinationId === 'custom' && !findCity(customName)) {
      const g = guessCity(customName);
      return sendJson(res, 400, { error: '未找到该城市「' + customName + '」' + (g ? '，你是不是想输入「' + g + '」？' : '') + ' 请修改后重新生成' });
    }
    // 出发城市与目的地不能相同（否则行程无参考价值）
    const originCity = findCity(origin);
    const destRealName = body.destinationId === 'custom' ? customName : ((destinations.find((d) => d.id === body.destinationId) || {}).name || '');
    if (originCity && destRealName && String(originCity.name).replace(/[省市]$/, '') === String(destRealName).replace(/[省市]$/, '')) {
      return sendJson(res, 400, { error: '出发城市和目的地是同一个城市「' + destRealName + '」，行程没有参考价值，请换个目的地' });
    }
    const returnDest = String(body.returnDest || '').trim();
    if (returnDest) {
      if (!findCity(returnDest)) return sendJson(res, 400, { error: '未找到返回目的地「' + returnDest + '」，请从提示中选择正确的城市名' });
      if (String(findCity(returnDest).name).replace(/[省市]$/, '') === String(destRealName).replace(/[省市]$/, '')) {
        return sendJson(res, 400, { error: '返回目的地不能和目的地相同' });
      }
    }
    // 必填项：去程/返程日期（减少 AI 猜测、节省 token）
    const startDate = String(body.startDate || '').trim();
    const endDate = String(body.endDate || '').trim();
    if (!startDate) return sendJson(res, 400, { error: '请选择去程日期' });
    if (!endDate) return sendJson(res, 400, { error: '请选择返程日期' });
    if (endDate < startDate) return sendJson(res, 400, { error: '返程日期不能早于去程日期' });
    const params = {
      destination: dest,
      origin,
      returnDest,
      startDate: body.startDate || '',
      endDate: body.endDate || '',
      days: Number(body.days) || 3,
      transport: String(body.transport || '').trim(),
      travelTime: String(body.travelTime || '上午').trim(),
      elderly: Number(body.elderly) || 0,
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      dietary: Array.isArray(body.dietary) ? body.dietary : [],
      budget: String(body.budget || '舒适型'),
      pace: String(body.pace || '标准'),
      accommodation: String(body.accommodation || '').trim(),
      interests: Array.isArray(body.interests) ? body.interests : [],
      notes: String(body.notes || '').trim(),
    };
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '' };
    const jobId = runJob(async () => {
      // 高铁/火车：从 12306 拉取当天真实车次，供 AI 直接采用
      const tr = String(params.transport || '');
      if (['高铁', '火车', '未定', ''].includes(tr) && params.origin && params.destination) {
        const ret = params.returnDest || params.origin;
        const od = await train.queryTrainsWithPrices(params.origin, params.destination.name, String(params.startDate || '').slice(0, 10), 100000);
        const id2 = await train.queryTrainsWithPrices(params.destination.name, ret, String(params.endDate || '').slice(0, 10), 100000);
        const rtNote = (res) => {
          if (!res || !res.ok) return '12306 查询失败（' + ((res && res.error) || '未知') + '），请到 12306 官网确认实际车次';
          if (!res.trains || !res.trains.length) return '暂无直达，需中转（可到 12306 查询中转方案）';
          if (res.refNote) return '出行日期超出预售期，以上为近期参考班次，车次基本每日固定，请以出行日 12306 实际为准';
          return '';
        };
        // 按用户选择的交通出行时间（上午/中午/下午）筛选车次；该时段无车次则自动推荐上午车次（上午也无则显示全部）
        const tt = params.travelTime || '上午';
        const hh = (x) => { const m = /^(\d{1,2}):/.exec(String(x.fromTime || '')); return m ? Number(m[1]) : -1; };
        const pickByTime = (arr) => {
          if (!Array.isArray(arr) || !arr.length) return { trains: [], filtered: false, fellBack: false, recMorning: false };
          if (tt === '未定' || !tt) return { trains: arr, filtered: false, fellBack: false, recMorning: false };
          const win = (h) => tt === '上午' ? (h >= 5 && h < 12) : tt === '中午' ? (h >= 12 && h < 14) : (h >= 14);
          const hit = arr.filter((x) => win(hh(x)));
          if (hit.length) return { trains: hit, filtered: true, fellBack: false, recMorning: false };
          const morn = arr.filter((x) => { const h = hh(x); return h >= 5 && h < 12; });
          return morn.length ? { trains: morn, filtered: false, fellBack: true, recMorning: true } : { trains: arr, filtered: false, fellBack: true, recMorning: false };
        };
        const ob = pickByTime(od.ok ? od.trains : []);
        const ib = pickByTime(id2.ok ? id2.trains : []);
        const timeNote = (r) => r.filtered ? '（已按「' + tt + '」时段筛选）' : '';
        params.realTrains = {
          outbound: ob.trains,
          inbound: ib.trains,
          display: {
            outboundLabel: '去程（' + (params.origin || '') + ' → ' + params.destination.name + '）',
            outboundNote: rtNote(od) + timeNote(ob),
            inboundLabel: '返程（' + params.destination.name + ' → ' + ret + '）',
            inboundNote: rtNote(id2) + timeNote(ib),
            outboundFellBack: ob.fellBack,
            inboundFellBack: ib.fellBack,
            timeFallbackNote: (ob.fellBack || ib.fellBack) && tt !== '未定' ? '所选「' + tt + '」时段暂无车次，自动推荐上午车次' : ''
          }
        };
      }
      const result = await planner.buildPlan(params, overrides);
      result.realTrains = params.realTrains;
      return result;
    });
    return sendJson(res, 200, { jobId, status: 'running' });
  }

  // POST /api/chat —— AI 主理人问答
  if (pathname === '/api/chat' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: '请求过于频繁，请稍后再试' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const message = String(body.message || '').trim();
    if (!message) return sendJson(res, 400, { error: '请输入问题' });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '' };
    const result = await planner.chatReply(message, Array.isArray(body.history) ? body.history : [], overrides);
    return sendJson(res, 200, result);
  }

  // GET /api/job?id=xxx —— 轮询后台任务结果
  if (pathname === '/api/job' && req.method === 'GET') {
    const q = url.parse(req.url, true).query;
    const job = jobs.get(String(q.id || ''));
    if (!job) return sendJson(res, 404, { error: '任务不存在或已过期' });
    return sendJson(res, 200, { jobId: String(q.id || ''), status: job.status, result: job.result || null, error: job.error || null });
  }

  // GET /api/weather?id=xxx —— 目的地未来 15 天天气预报
  if (pathname === '/api/weather' && req.method === 'GET') {
    const q = url.parse(req.url, true).query;
    const dest = destinations.find((d) => d.id === String(q.id || ''));
    if (!dest || !dest.lat) return sendJson(res, 400, { error: '目的地不存在或缺少坐标' });
    try {
      const data = await weather.getForecast(dest);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { error: '天气获取失败：' + String(e.message || e) });
    }
  }

  // GET /api/health —— 含 AI Key 来源状态（不返回 Key 本身）
  if (pathname === '/api/health') {
    const authed = !auth.accessConfig().enabled || auth.verifyToken(auth.extractBearer(req));
    return sendJson(res, 200, Object.assign({ ok: true, time: new Date().toISOString() }, authed ? { hasServerKey: ai.hasServerKey() && ai.hasInvite() } : {}));
  }


  return sendJson(res, 404, { error: '接口不存在' });
}

const gzipCache = new Map(); // 静态文件 gzip 缓存（按 mtime 失效）
function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? path.join(PUBLIC, 'index.html') : path.normalize(path.join(PUBLIC, pathname));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const cacheCtrl = ext === '.html' ? 'no-cache'
      : (ext === '.js' || ext === '.css' || ext === '.json' || ext === '.svg') ? 'public, max-age=31536000, immutable'
      : 'public, max-age=604800';
    const accept = (req.headers['accept-encoding'] || '');
    const compressible = ['.html', '.css', '.js', '.json', '.svg', '.txt'].includes(ext);
    if (compressible && /gzip/i.test(accept)) {
      let gz = gzipCache.get(filePath);
      if (!gz || gz.mtime !== st.mtimeMs) {
        gz = { mtime: st.mtimeMs, data: zlib.gzipSync(fs.readFileSync(filePath)) };
        gzipCache.set(filePath, gz);
      }
      res.writeHead(200, Object.assign({ 'Content-Type': mime, 'Cache-Control': cacheCtrl, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' }, SEC_HEADERS));
      return res.end(gz.data);
    }
    res.writeHead(200, Object.assign({ 'Content-Type': mime, 'Cache-Control': cacheCtrl }, SEC_HEADERS));
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname || '/');
  } catch {
    return sendJson(res, 400, { error: 'bad request' });
  }
  if (pathname.startsWith('/api/')) {
    try {
      // 访问口令门禁：启用时除登录/健康检查外，所有 /api/* 需带有效令牌
      const gate = auth.accessConfig();
      if (gate.enabled && !['/api/auth', '/api/auth/status', '/api/health'].includes(pathname)) {
        if (!auth.verifyToken(auth.extractBearer(req))) {
          return sendJson(res, 401, { error: 'unauthorized', needAuth: true });
        }
      }
      await handleApi(req, res, pathname);
    } catch (e) {
      console.error('[API Error]', e);
      sendJson(res, 500, { error: '服务器内部错误', detail: String((e && e.message) || e) });
    }
  } else {
    serveStatic(req, res, pathname);
  }
});

const port = Number(process.env.PORT || config.port || 3000);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  const aiCfg = (config.ai || {});
  console.log('🏡 家游汇 · 家庭旅游推荐已启动');
  console.log(`   ➜ 打开: http://localhost:${port}`);
  console.log(`   ➜ AI: ${aiCfg.apiKey ? '已配置 (' + (aiCfg.model || '') + ')' : '未配置 Key → 使用内置规则引擎（页面右上角可填写）'}`);
  console.log(`   ➜ 数据源: ${((config.collector || {}).enabled || []).join(', ')}`);
});
