'use strict';
/**
 * 家游汇 · 家庭旅游推荐与攻略选择
 * 零依赖 Node.js 服务器：静态页面 + REST API
 *
 * 启动：node server.js   （默认 http://localhost:3000）
 */
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
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
const travelSearch = require('./lib/travel-search');

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
const WEB_SEARCH = { windowMs: 10 * 60 * 1000, max: 20 };    // 免费全网搜索：每 IP 每 10 分钟 20 次
const LOGIN = { windowMs: 60000, max: 5, lockMs: 60000 };     // 登录失败：每 IP 每分钟 5 次后锁 1 分钟
const INVITE = { windowMs: 60000, max: 5, lockMs: 5 * 60000 }; // 邀请码失败：每 IP 每分钟 5 次后锁 5 分钟
const CHEAP = { windowMs: 60000, max: 120 };                  // 只读接口：每 IP 每分钟 120 次
const OUTBOUND = { windowMs: 60000, max: 12 };                // 需要出网的接口（天气）：每 IP 每分钟 12 次
const JOB_TTL = 5 * 60 * 1000;                                // 任务结果保留 5 分钟
const MAX_JOBS = 20;                                          // 最大并发任务数
const MAX_PATCH_CHARS = 60000;                                // 局部修改补丁上限（防提示词膨胀）
const MAX_PLAN_CHARS = 120000;                                // 修正行程原文上限
const MAX_HISTORY = 20;                                       // 问答携带的历史条数
const MAX_TRAINS = 60;                                        // 12306 每次最多拉取车次数
const MAX_TRAIN_DISPLAY = 12;                                 // 返回给前端的车次数（前端最多展示 6 条）
const HOT_DATA_TTL = 5 * 60 * 1000;                           // 平台热度数据缓存 5 分钟
let hotDataCache = null;
const hits = new Map();                                       // ip -> { n, reset }
const searchHits = new Map();                                 // ip -> { n, reset }
const loginFails = new Map();                                 // ip -> { n, reset, lockedUntil }
const cheapHits = new Map();                                  // ip -> { n, reset }（只读接口）
const outHits = new Map();                                    // ip -> { n, reset }（出网接口）
const inviteFails = new Map();                                // ip -> { n, reset, lockedUntil }（邀请码爆破防护）
// 仅信任来自本机 nginx 的代理头（remoteAddress 不可伪造）；直连请求一律忽略伪造头，防绕过限流/锁定
const TRUSTED_PROXY = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;                          // 代理头格式校验：防止任意字符串撑爆 Map 键空间
function clientIp(req) {
  const socketIp = String(req.socket.remoteAddress || '');
  if (TRUSTED_PROXY.has(socketIp)) {
    const real = String(req.headers['x-real-ip'] || '').trim();
    if (real && IP_RE.test(real)) return real.replace(/^::ffff:/, '');
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const list = String(xff).split(',').map((s) => s.trim()).filter((s) => IP_RE.test(s));
      if (list.length) return list[list.length - 1].replace(/^::ffff:/, '');
    }
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
function allowTravelSearch(req) {
  const ip = clientIp(req);
  const rec = bucket(searchHits, ip, WEB_SEARCH.windowMs);
  rec.n++;
  searchHits.set(ip, rec);
  return rec.n <= WEB_SEARCH.max;
}
function loginAllowed(req) {
  const rec = bucket(loginFails, clientIp(req), LOGIN.windowMs);
  const allowed = !(rec.lockedUntil && Date.now() < rec.lockedUntil);
  return { rec, allowed };
}
/** 通用限流：返回 true 表示放行 */
function allowBy(map, req, { windowMs, max }) {
  const ip = clientIp(req);
  const rec = bucket(map, ip, windowMs);
  rec.n++;
  map.set(ip, rec);
  return rec.n <= max;
}
const allowCheap = (req) => allowBy(cheapHits, req, CHEAP);
const allowOutbound = (req) => allowBy(outHits, req, OUTBOUND);
// 定期清理限流/登录记录，防止 Map 无限增长
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  for (const [k, v] of searchHits) if (now > v.reset) searchHits.delete(k);
  for (const [k, v] of loginFails) if (now > v.reset && now > (v.lockedUntil || 0)) loginFails.delete(k);
  for (const [k, v] of cheapHits) if (now > v.reset) cheapHits.delete(k);
  for (const [k, v] of outHits) if (now > v.reset) outHits.delete(k);
  for (const [k, v] of inviteFails) if (now > v.reset && now > (v.lockedUntil || 0)) inviteFails.delete(k);
}, 5 * 60 * 1000).unref();

/* ---------- 响应安全头 ---------- */
// 仅地图页放行高德插件的动态执行；其他页面继续使用严格 CSP
const MAP_CSP = "default-src 'self'; img-src 'self' data: blob: https://*.amap.com https://*.autonavi.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://webapi.amap.com https://*.amap.com; worker-src 'self' blob: data:; connect-src 'self' https://webapi.amap.com https://*.amap.com https://*.autonavi.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https://*.amap.com https://*.autonavi.com; style-src 'self' 'unsafe-inline'; script-src 'self' https://webapi.amap.com https://*.amap.com; connect-src 'self' https://webapi.amap.com https://*.amap.com https://*.autonavi.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
};
const GZIP_MIN_BYTES = 512;                                   // 响应小于此值不压缩（压缩反而更大）
function sendJson(res, status, obj) {
  // 防二次写：连接已被 destroy 或响应已结束时再写会抛 error 事件并拖垮进程
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(obj);
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC_HEADERS);
  const accept = (res.req && res.req.headers && res.req.headers['accept-encoding']) || '';
  if (body.length > GZIP_MIN_BYTES && /gzip/i.test(accept)) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(status, headers);
    return res.end(zlib.gzipSync(body));
  }
  res.writeHead(status, headers);
  res.end(body);
}

/** 后台任务：AI 生成在服务器后台继续，客户端可随时轮询结果 */
const jobs = new Map();
/** 队列容量不足：单独类型，便于返回 503 而不是 500 */
class CapacityError extends Error {}
/** 只统计「正在生成」的任务；已完成待过期的任务不占用并发名额 */
function runningJobs() {
  let n = 0;
  for (const j of jobs.values()) if (j.status === 'running') n++;
  return n;
}
function runJob(fn, owner) {
  if (runningJobs() >= MAX_JOBS) throw new CapacityError('busy');
  // 任务 id 用密码学随机：避免被枚举后取走他人行程结果
  const id = 'j' + crypto.randomUUID().replace(/-/g, '');
  jobs.set(id, { status: 'running', createdAt: Date.now(), owner: owner || '' });
  const expire = () => { jobs.delete(id); };
  Promise.resolve()
    .then(fn)
    .then((result) => { const j = jobs.get(id); if (j) { j.status = 'done'; j.result = result; setTimeout(expire, JOB_TTL).unref(); } })
    .catch((e) => { const j = jobs.get(id); if (j) { j.status = 'error'; j.error = String((e && e.message) || e); setTimeout(expire, JOB_TTL).unref(); } });
  // 兜底：卡死的 running 任务也按时清理
  setTimeout(() => { const j = jobs.get(id); if (j && j.status === 'running') jobs.delete(id); }, JOB_TTL * 4).unref();
  return id;
}
/** 统一的「提交后台任务」响应：队列已满时明确返回 503，不落成 500 服务器错误 */
function startJob(res, lang, fn, req) {
  let jobId;
  try { jobId = runJob(fn, req ? clientIp(req) : ''); }
  catch (e) {
    if (e instanceof CapacityError) return sendJson(res, 503, { error: MSG(lang).busy });
    throw e;
  }
  return sendJson(res, 200, { jobId, status: 'running' });
}
const MAX_BODY_BYTES = 512 * 1024;                            // 请求体上限（字节，含中文多字节）
/** 读取请求体：按字节限长、预检 Content-Length、处理 aborted，避免慢速上传与半截数据 */
function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) { reject(Object.assign(new Error('请求体过大'), { statusCode: 413 })); return req.destroy(); }
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (e) => { if (done) return; done = true; reject(e); req.destroy(); };
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) return fail(Object.assign(new Error('请求体过大'), { statusCode: 413 }));
      chunks.push(c);
    });
    req.on('aborted', () => fail(new Error('请求已中断')));
    req.on('error', fail);
    req.on('end', () => { if (done) return; done = true; resolve(Buffer.concat(chunks).toString('utf8')); });
  });
}

const config = ai.loadConfig();
const destinations = (readJson(path.join(ROOT, 'data', 'destinations.json')) || { destinations: [] }).destinations || [];
// 中国城市名单（输入提示/城市自查用）
const cities = (readJson(path.join(ROOT, 'data', 'cities.json')) || { cities: [] }).cities || [];
/* 接口错误文案（中英双语）：英文站点不返回中文 */
const API_MSG = {
  zh: {
    badJson: 'JSON 格式错误',
    rateLimited: '请求过于频繁，请稍后再试',
    needDest: '请选择目的地，或选择「自定义目的地」并填写城市名',
    needDestId: '请选择目的地 destinationId',
    needOrigin: '请填写出发城市后再生成行程',
    originNotFound: (x, g) => '未找到出发城市「' + x + '」' + (g ? '，你是不是想输入「' + g + '」？' : '') + ' 请修改后重新生成',
    destNotFound: (x, g) => '未找到该城市「' + x + '」' + (g ? '，你是不是想输入「' + g + '」？' : '') + ' 请修改后重新生成',
    cityPick: (x) => '未找到该城市「' + x + '」，请从提示中选择正确的城市名',
    sameCity: (x) => '出发城市和目的地是同一个城市「' + x + '」，行程没有参考价值，请换个目的地',
    returnNotFound: (x) => '未找到返回目的地「' + x + '」，请从提示中选择正确的城市名',
    returnSame: '返回目的地不能和目的地相同',
    needStart: '请选择去程日期',
    needEnd: '请选择返程日期',
    endBeforeStart: '返程日期不能早于去程日期',
    needQuestion: '请输入问题',
    busy: '当前排队的生成任务较多，请稍后再试',
    tooLarge: '提交内容过大，请精简后重试',
    badPath: '请求路径不合法',
    jobGone: '任务不存在或已过期',
    destGone: '未找到该目的地',
    passcodeWrong: '口令错误',
    inviteWrong: '邀请码错误',
    tooManyTries: '尝试过于频繁，请 1 分钟后再试',
    noCoord: '目的地不存在或缺少坐标',
    weatherFailed: (m) => '天气获取失败：' + m,
    apiGone: '接口不存在',
    serverError: '服务器内部错误'
  },
  en: {
    badJson: 'Invalid JSON',
    rateLimited: 'Too many requests — please try again shortly',
    needDest: 'Please choose a destination, or pick “custom destination” and enter a city',
    needDestId: 'Please provide a destinationId',
    needOrigin: 'Please enter your departure city before generating a plan',
    originNotFound: (x, g) => 'Departure city not found: “' + x + '”' + (g ? '. Did you mean “' + g + '”?' : '') + ' Please edit and try again.',
    destNotFound: (x, g) => 'City not found: “' + x + '”' + (g ? '. Did you mean “' + g + '”?' : '') + ' Please edit and try again.',
    cityPick: (x) => 'City not found: “' + x + '” — please pick one from the suggestions',
    sameCity: (x) => 'Your departure city and destination are both “' + x + '” — please choose a different destination',
    returnNotFound: (x) => 'Return destination not found: “' + x + '” — please pick one from the suggestions',
    returnSame: 'The return destination cannot be the same as the destination',
    needStart: 'Please choose a departure date',
    needEnd: 'Please choose a return date',
    endBeforeStart: 'The return date cannot be earlier than the departure date',
    needQuestion: 'Please enter a question',
    busy: 'Too many generation tasks queued — please try again shortly',
    tooLarge: 'The request payload is too large — please shorten it',
    badPath: 'Invalid request path',
    jobGone: 'This task no longer exists or has expired',
    destGone: 'Destination not found',
    passcodeWrong: 'Wrong passcode',
    inviteWrong: 'Wrong invite code',
    tooManyTries: 'Too many attempts — please try again in a minute',
    noCoord: 'Destination not found or missing coordinates',
    weatherFailed: (m) => 'Weather lookup failed: ' + m,
    apiGone: 'API not found',
    serverError: 'Server error'
  }
};
const MSG = (lang) => API_MSG[lang === 'en' ? 'en' : 'zh'];
/* 请求语言：优先 body.lang，其次 x-lang 头（解析请求体前也能用） */
const reqLang = (req) => { const h = String((req.headers && req.headers['x-lang']) || '').toLowerCase(); return h === 'en' ? 'en' : 'zh'; };
// 城市拼音别名（供英文/拼音输入匹配，构建时生成，无需运行时依赖）
const cityPinyin = readJson(path.join(ROOT, 'data', 'city-pinyin.json')) || {};
// 目的地数据英文映射（亮点/适老说明等）
const destI18n = readJson(path.join(ROOT, 'data', 'dest-i18n.json')) || {};
function guessCity(raw) {
  const n = String(raw || '').trim().replace(/[省市]$/, '');
  if (!n) return null;
  const all = (cities || []).map((c) => c.name);
  const hit = all.find((x) => x === n) || all.find((x) => x.includes(n)) || all.find((x) => n.includes(x));
  if (hit) return hit;
  // 拼音/英文输入：精确 → 前缀 → 包含（如 pingxiang / beijing / shangha）
  const k = cityKeyOf(n);
  if (/^[a-z]+$/.test(k)) {
    const py = all.filter((x) => cityPinyin[x]);
    const exactPy = py.find((x) => cityPinyin[x] === k);
    if (exactPy) return exactPy;
    const prefixPy = py.find((x) => cityPinyin[x].startsWith(k)) || py.find((x) => k.startsWith(cityPinyin[x]));
    if (prefixPy) return prefixPy;
    const partPy = py.find((x) => k.length >= 4 && cityPinyin[x].includes(k));
    if (partPy) return partPy;
    // 拼写容错：编辑距离最近且足够接近时给出建议（如 pingxing → 萍乡）
    const dist = (a, b) => {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      return dp[m][n];
    };
    let near = null, nearD = 99;
    for (const x of py) { const d = dist(k, cityPinyin[x]); if (d < nearD) { nearD = d; near = x; } }
    if (near && nearD <= 2 && k.length >= 5) return near;
  }
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
/* 城市键：忽略大小写与空格连字符，便于拼音/英文匹配 */
const cityKeyOf = (s) => String(s || '').trim().toLowerCase().replace(/[\s\-_\.]+/g, '');
function findCity(raw) {
  const n = String(raw || '').trim().replace(/[省市]$/, '');
  if (!n) return null;
  const k = cityKeyOf(n);
  return cities.find((c) => c.name === n)
    || cities.find((c) => cityKeyOf(c.name) === k)
    || cities.find((c) => cityPinyin[c.name] && cityPinyin[c.name] === k)
    || null;
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

/* ---------- 只读接口预计算 ----------
 * destinations / cities / images / dest-i18n 的响应在运行期不会变化（IMAGE_BASE 启动时确定），
 * 每次请求重新 map、去重、JSON.stringify、gzipSync 都是纯浪费，且这些工作全跑在事件循环上。
 * 这里在启动时算一次，并同时准备好 gzip 版本。
 */
const STATIC_JSON = (() => {
  const pack = (obj) => {
    const body = JSON.stringify(obj);
    return { body, gz: zlib.gzipSync(body) };
  };
  const list = applyImageBase(destinations.map(({ gallery, highlights, description, ...rest }) => ({
    ...rest,
    highlightCount: (highlights || []).length,
    galleryCount: (gallery || []).length
  })));
  const seen = new Set();
  const images = [];
  destinations.forEach((d) => {
    [d.cover].concat(d.gallery || []).concat((d.highlights || []).map((h) => h.image)).forEach((u) => {
      if (u && !seen.has(u)) { seen.add(u); images.push(u); }
    });
  });
  const cityList = cities.map((c) => (cityPinyin[c.name] ? Object.assign({}, c, { py: cityPinyin[c.name] }) : c));
  return {
    destinations: pack({ count: list.length, destinations: list }),
    images: pack({ count: images.length, images: applyImageBase(images) }),
    cities: pack({ count: cityList.length, cities: cityList }),
    destI18n: pack({ map: destI18n })
  };
})();

/** 输出预计算好的 JSON（body 与 gz 都已备好，不再现场压缩） */
function sendPacked(res, entry) {
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  const accept = (res.req && res.req.headers && res.req.headers['accept-encoding']) || '';
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding' }, SEC_HEADERS);
  if (/gzip/i.test(accept)) {
    headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    return res.end(entry.gz);
  }
  res.writeHead(200, headers);
  res.end(entry.body);
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
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const g = loginAllowed(req);
    if (!g.allowed) return sendJson(res, 429, { error: MSG(reqLang(req)).tooManyTries });
    if (auth.verifyPasscode(body.passcode)) {
      g.rec.n = 0; g.rec.lockedUntil = 0; loginFails.set(clientIp(req), g.rec);
      return sendJson(res, 200, { ok: true, token: auth.signToken() });
    }
    g.rec.n++;
    if (g.rec.n >= LOGIN.max) { g.rec.lockedUntil = Date.now() + LOGIN.lockMs; g.rec.n = 0; }
    loginFails.set(clientIp(req), g.rec);
    return sendJson(res, 401, { error: MSG(reqLang(req)).passcodeWrong });
  }

  // POST /api/ai/invite —— 邀请码解锁服务端 AI（换长期设备令牌；服务端 Key 永不下发）
  if (pathname === '/api/ai/invite' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    const L = MSG(reqLang(req));
    const ip = clientIp(req);
    const g = bucket(inviteFails, ip, INVITE.windowMs);
    // 邀请码等同额度凭证：失败次数超限即锁定，防在线爆破
    if (g.lockedUntil && Date.now() < g.lockedUntil) return sendJson(res, 429, { error: L.tooManyTries });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: L.badJson }); }
    const code = typeof (body && body.code) === 'string' ? body.code.trim() : '';
    if (!code || code.length > 64) return sendJson(res, 400, { error: L.inviteWrong });
    if (ai.verifyInvite(code)) {
      g.n = 0; g.lockedUntil = 0; inviteFails.set(ip, g);
      return sendJson(res, 200, { ok: true, aiToken: ai.signAiToken() });
    }
    g.n++;
    if (g.n >= INVITE.max) { g.lockedUntil = Date.now() + INVITE.lockMs; g.n = 0; }
    inviteFails.set(ip, g);
    return sendJson(res, 401, { error: L.inviteWrong });
  }
  // GET /api/ai/status —— 查询是否配置了邀请码、当前令牌是否有效
  if (pathname === '/api/ai/status' && req.method === 'GET') {
    return sendJson(res, 200, { hasInvite: ai.hasInvite(), unlocked: ai.verifyAiToken(String(req.headers['x-ai-token'] || '')) });
  }
  // GET /api/map/config —— 前端地图配置（高德 JS API Key / 安全密钥）
  if (pathname === '/api/map/config' && req.method === 'GET') {
    const mapCfg = ai.loadConfig().map || {};
    const key = process.env.AMAP_JS_KEY || mapCfg.amapJsKey || '';
    const securityCode = process.env.AMAP_SECURITY_CODE || mapCfg.amapSecurityCode || '';
    return sendJson(res, 200, { provider: 'amap', enabled: !!key, key, securityCode });
  }
    // GET /api/destinations —— 列表（不含超大字段）
  if (pathname === '/api/destinations' && req.method === 'GET') {
    return sendPacked(res, STATIC_JSON.destinations);
  }

  // GET /api/cities —— 中国城市名单（输入提示 / 城市自查）
  if (pathname === '/api/cities' && req.method === 'GET') {
    return sendPacked(res, STATIC_JSON.cities);
  }

  // GET /api/dest-i18n —— 目的地数据（亮点/适老说明等）英文映射，供前端 i18n 使用
  if (pathname === '/api/dest-i18n' && req.method === 'GET') {
    return sendPacked(res, STATIC_JSON.destI18n);
  }

  // GET /api/images —— 全部实景照片（封面/画廊/亮点，去重，供首页轮播使用）
  if (pathname === '/api/images' && req.method === 'GET') {
    return sendPacked(res, STATIC_JSON.images);
  }

  // GET /api/destinations/:id —— 详情
  const dm = pathname.match(/^\/api\/destinations\/([^/]+)$/);
  if (dm && req.method === 'GET') {
    const d = destinations.find((x) => x.id === decodeURIComponent(dm[1]));
    if (!d) return sendJson(res, 404, { error: MSG(reqLang(req)).destGone });
    return sendJson(res, 200, { destination: applyImageBase(d) });
  }

  // GET /api/hot-data —— 平台热门数据（只读且结果可短时缓存，避免每次请求都读盘解析）
  if (pathname === '/api/hot-data' && req.method === 'GET') {
    if (!allowCheap(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    const now = Date.now();
    if (!hotDataCache || now - hotDataCache.at > HOT_DATA_TTL) {
      const data = await collector.collect(config);
      const month = new Date().getMonth() + 1;
      const items = collector.monthlyRank(collector.merge(data.results), month);
      hotDataCache = { at: now, payload: { collectedAt: data.collectedAt, sources: data.results, month, monthLabel: month + '月', items } };
    }
    return sendJson(res, 200, hotDataCache.payload);
  }

  // GET /api/travel-search?q=xxx —— 本地无结果时使用 Tavily 免费额度补充全网文旅文章
  if (pathname === '/api/travel-search' && req.method === 'GET') {
    const q = url.parse(req.url, true).query;
    const keyword = String(q.q || '').trim();
    if (!keyword) return sendJson(res, 400, { enabled: travelSearch.isEnabled(), error: reqLang(req) === 'en' ? 'Please enter a search keyword' : '请输入搜索关键词' });
    if (!allowTravelSearch(req)) {
      return sendJson(res, 429, { enabled: travelSearch.isEnabled(), error: reqLang(req) === 'en' ? 'Too many web searches — please try again later' : '免费全网搜索次数过多，请稍后再试' });
    }
    try {
      const result = await travelSearch.searchWeb(keyword, reqLang(req));
      return sendJson(res, 200, result);
    } catch (e) {
      console.error('[Travel Search Error]', e);
      return sendJson(res, e.statusCode || 502, {
        enabled: true,
        results: [],
        error: reqLang(req) === 'en' ? 'Free web search is temporarily unavailable' : '免费全网搜索暂时不可用，请稍后再试'
      });
    }
  }

  // POST /api/recommend —— AI/规则 出行打包清单
  if (pathname === '/api/recommend' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const dest = destinations.find((d) => d.id === body.destinationId)
      || (body.destinationId === 'custom' && String((body.customDest || {}).name || '').trim()
          ? planner.customDestination(String((body.customDest || {}).name || '').trim(), String((body.customDest || {}).note || '').trim())
          : null);
    if (!dest) return sendJson(res, 400, { error: MSG(body.lang).needDest });
    if (body.destinationId === 'custom') {
      const customName = String((body.customDest || {}).name || '').trim();
      if (!findCity(customName)) return sendJson(res, 400, { error: MSG(body.lang).cityPick(customName) });
    }
    const params = {
      destination: dest,
      month: Number(body.month) || new Date().getMonth() + 1,
      durationDays: Number(body.durationDays) || 3,
      durationLabel: String(body.durationLabel || '').trim(),
      tripContext: body.tripContext && typeof body.tripContext === 'object' ? body.tripContext : null,
      elderly: Number(body.elderly) || 0,
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      interests: Array.isArray(body.interests) ? body.interests : [],
      mode: String(body.mode || '简略').trim(),
      notes: String(body.notes || '').trim(),
    };
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '', lang: body.lang === 'en' ? 'en' : 'zh' };
    return startJob(res, body.lang, () => rec.recommend(params, overrides), req);
  }

  // POST /api/ai-guide —— AI 生成目的地攻略
  if (pathname === '/api/ai-guide' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const dest = destinations.find((d) => d.id === body.destinationId);
    if (!dest) return sendJson(res, 400, { error: MSG(body.lang).needDestId });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '', lang: body.lang === 'en' ? 'en' : 'zh' };
    const result = await rec.aiGuide(dest, overrides);
    return sendJson(res, 200, result);
  }

  // POST /api/plan —— AI 主理人：生成逐日详细行程规划
  if (pathname === '/api/plan' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const customName = String((body.customDest || {}).name || '').trim();
    const dest = destinations.find((d) => d.id === body.destinationId)
      || (body.destinationId === 'custom' && customName
          ? planner.customDestination(customName, String((body.customDest || {}).note || '').trim())
          : null);
    if (!dest) return sendJson(res, 400, { error: MSG(body.lang).needDest });
    // 防浪费：出发城市必填；用户输入的城市须为中国真实城市
    const L = MSG(body.lang);
    // 参数上界：天数与人数都会被写进提示词，必须与规则引擎口径一致（规则引擎最多 14 天）
    const clampInt = (v, lo, hi, dflt) => {
      const n = Math.trunc(Number(v));
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
    };
    const origin = String(body.origin || '').trim();
    if (!origin) return sendJson(res, 400, { error: L.needOrigin });
    if (!findCity(origin)) {
      const g = guessCity(origin);
      return sendJson(res, 400, { error: L.originNotFound(origin, g) });
    }
    // 拼音/英文输入 → 规范成标准中文城市名（供 12306 查站与提示词使用）
    if (body.destinationId === 'custom') {
      const cc = findCity(customName);
      if (cc && dest && dest.id === 'custom') dest.name = cc.name;
    }
    if (body.destinationId === 'custom' && !findCity(customName)) {
      const g = guessCity(customName);
      return sendJson(res, 400, { error: L.destNotFound(customName, g) });
    }
    // 出发城市与目的地不能相同（否则行程无参考价值）
    const originCity = findCity(origin);
    const destRealName = body.destinationId === 'custom' ? customName : ((destinations.find((d) => d.id === body.destinationId) || {}).name || '');
    if (originCity && destRealName && String(originCity.name).replace(/[省市]$/, '') === String(destRealName).replace(/[省市]$/, '')) {
      return sendJson(res, 400, { error: L.sameCity(destRealName) });
    }
    const returnDest = String(body.returnDest || '').trim();
    if (returnDest) {
      if (!findCity(returnDest)) return sendJson(res, 400, { error: L.returnNotFound(returnDest) });
      if (String(findCity(returnDest).name).replace(/[省市]$/, '') === String(destRealName).replace(/[省市]$/, '')) {
        return sendJson(res, 400, { error: L.returnSame });
      }
    }
    // 必填项：去程/返程日期（减少 AI 猜测、节省 token）
    const startDate = String(body.startDate || '').trim();
    const endDate = String(body.endDate || '').trim();
    if (!startDate) return sendJson(res, 400, { error: L.needStart });
    if (!endDate) return sendJson(res, 400, { error: L.needEnd });
    if (endDate < startDate) return sendJson(res, 400, { error: L.endBeforeStart });
    const params = {
      destination: dest,
      origin: (findCity(origin) || {}).name || origin,
      returnDest: returnDest ? ((findCity(returnDest) || {}).name || returnDest) : '',
      startDate: body.startDate || '',
      endDate: body.endDate || '',
      days: clampInt(body.days, 1, 14, 3),
      transport: String(body.transport || '').trim(),
      travelTime: String(body.travelTime || '上午').trim(),
      elderly: clampInt(body.elderly, 0, 20, 0),
      adults: clampInt(body.adults, 1, 20, 2),
      children: clampInt(body.children, 0, 20, 0),
      dietary: Array.isArray(body.dietary) ? body.dietary.slice(0, 12) : [],
      budget: ['经济型', '舒适型', '豪华型'].includes(body.budget) ? body.budget : '舒适型',
      pace: ['轻松慢游', '标准', '紧凑'].includes(body.pace) ? body.pace : '标准',
      accommodation: String(body.accommodation || '').trim().slice(0, 40),
      interests: Array.isArray(body.interests) ? body.interests.slice(0, 12) : [],
      notes: String(body.notes || '').trim().slice(0, 500),
    };
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '', lang: body.lang === 'en' ? 'en' : 'zh' };
    // 防成本炸弹：局部修改补丁携带的原文不允许无限大（否则单次请求可推出几十万 token）
    if (body.patch && JSON.stringify(body.patch).length > MAX_PATCH_CHARS) {
      return sendJson(res, 413, { error: L.tooLarge });
    }
    return startJob(res, body.lang, async () => {
      // 高铁/火车：从 12306 拉取当天真实车次，供 AI 直接采用
      const tr = String(params.transport || '');
      if (['高铁', '火车', '未定', ''].includes(tr) && params.origin && params.destination) {
        const ret = params.returnDest || params.origin;
        // 并发出网：串行时去程+返程各含 12s 超时，最坏会叠成 24s 以上的空等
        const [od, id2] = await Promise.all([
          train.queryTrainsWithPrices(params.origin, params.destination.name, String(params.startDate || '').slice(0, 10), MAX_TRAINS),
          train.queryTrainsWithPrices(params.destination.name, ret, String(params.endDate || '').slice(0, 10), MAX_TRAINS)
        ]);
        const en = overrides.lang === 'en';
        const timeEn = (v) => ({ '上午': 'morning', '中午': 'midday', '下午': 'afternoon' }[v] || v);
        const rtNote = (res) => {
          if (!res || !res.ok) return en ? ('12306 lookup failed (' + ((res && res.error) || 'unknown') + ') — please confirm the actual trains on the official 12306 website') : ('12306 查询失败（' + ((res && res.error) || '未知') + '），请到 12306 官网确认实际车次');
          if (!res.trains || !res.trains.length) return en ? 'No direct trains — a transfer is needed (check connections on 12306)' : '暂无直达，需中转（可到 12306 查询中转方案）';
          if (res.refNote) return en ? 'Your date is beyond the 12306 sales window; the services above are recent reference trains (schedules are largely fixed) — confirm on 12306 for your travel date' : '出行日期超出预售期，以上为近期参考班次，车次基本每日固定，请以出行日 12306 实际为准';
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
        const timeNote = (r) => r.filtered ? (en ? ' (filtered to ' + timeEn(tt) + ' departures)' : '（已按「' + tt + '」时段筛选）') : '';
        params.realTrains = {
          outbound: ob.trains.slice(0, MAX_TRAIN_DISPLAY),
          inbound: ib.trains.slice(0, MAX_TRAIN_DISPLAY),
          display: {
            outboundLabel: (en ? 'Outbound (' : '去程（') + (en ? planner.cityEn(params.origin) : (params.origin || '')) + ' → ' + (en ? planner.cityEn(params.destination.name) : params.destination.name) + (en ? ')' : '）'),
            outboundNote: rtNote(od) + timeNote(ob),
            inboundLabel: (en ? 'Return' : '返程') + (en ? ' (' : '（') + (en ? planner.cityEn(params.destination.name) : params.destination.name) + ' → ' + (en ? planner.cityEn(ret) : ret) + (en ? ')' : '）'),
            inboundNote: rtNote(id2) + timeNote(ib),
            outboundFellBack: ob.fellBack,
            inboundFellBack: ib.fellBack,
            timeFallbackNote: (ob.fellBack || ib.fellBack) && tt !== '未定' ? (en ? 'No trains in the chosen ' + timeEn(tt) + ' window — morning services suggested instead' : '所选「' + tt + '」时段暂无车次，自动推荐上午车次') : ''
          }
        };
      }
      const result = await planner.buildPlan(params, overrides, body.patch || null);
      result.realTrains = params.realTrains;
      return result;
    }, req);
  }

  // POST /api/plan/revise —— AI 行程管家：预览式局部修改
  if (pathname === '/api/plan/revise' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const message = String(body.message || '').trim();
    if (!message) return sendJson(res, 400, { error: MSG(body.lang).needQuestion });
    if (message.length > 600) return sendJson(res, 400, { error: body.lang === 'en' ? 'Revision request is too long.' : '修改要求过长，请精简到 600 字以内。' });
    if (!body.currentPlan || !Array.isArray(body.currentPlan.days) || !body.currentPlan.days.length) {
      return sendJson(res, 400, { error: body.lang === 'en' ? 'Generate an itinerary before revising it.' : '请先生成完整行程，再修改其中的安排。' });
    }
    // 防成本炸弹：只接受体积合理的原行程
    if (JSON.stringify(body.currentPlan).length > MAX_PLAN_CHARS) {
      return sendJson(res, 413, { error: MSG(body.lang).tooLarge });
    }
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '', lang: body.lang === 'en' ? 'en' : 'zh' };
    return startJob(res, body.lang, () => planner.revisePlan(message, body.currentPlan, overrides, body.tripContext || null), req);
  }

  // POST /api/chat —— AI 主理人问答
  if (pathname === '/api/chat' && req.method === 'POST') {
    if (!allowAi(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: MSG(reqLang(req)).badJson }); }
    const message = String(body.message || '').trim();
    if (!message) return sendJson(res, 400, { error: MSG(body.lang).needQuestion });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model, aiToken: body.aiToken || '', lang: body.lang === 'en' ? 'en' : 'zh' };
    // 历史只取最近若干条，避免请求体被撑大
    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    const result = await planner.chatReply(message, history, overrides, body.tripContext || null);
    return sendJson(res, 200, result);
  }

  // GET /api/job?id=xxx —— 轮询后台任务结果（仅提交者本人可读）
  if (pathname === '/api/job' && req.method === 'GET') {
    if (!allowCheap(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    const q = url.parse(req.url, true).query;
    const job = jobs.get(String(q.id || ''));
    if (!job || (job.owner && job.owner !== clientIp(req))) return sendJson(res, 404, { error: MSG(reqLang(req)).jobGone });
    return sendJson(res, 200, { jobId: String(q.id || ''), status: job.status, result: job.result || null, error: job.error || null });
  }

  // GET /api/weather?id=xxx —— 目的地未来 15 天天气预报（出网接口，单独限流）
  if (pathname === '/api/weather' && req.method === 'GET') {
    if (!allowOutbound(req)) return sendJson(res, 429, { error: MSG(reqLang(req)).rateLimited });
    const q = url.parse(req.url, true).query;
    const dest = destinations.find((d) => d.id === String(q.id || ''));
    if (!dest || !dest.lat) return sendJson(res, 400, { error: MSG(reqLang(req)).noCoord });
    try {
      const data = await weather.getForecast(dest);
      return sendJson(res, 200, data);
    } catch (e) {
      // 细节只进日志，不把上游内部错误下发给浏览器
      console.error('[Weather Error]', dest.id, e);
      return sendJson(res, 502, { error: MSG(reqLang(req)).weatherFailed(reqLang(req) === 'en' ? 'please try again later' : '请稍后再试') });
    }
  }

  // GET /api/health —— 健康检查
  // 匿名外网访问只返回 ok；hasServerKey 属部署信息，仅「本机直连（无代理头）」或持有效令牌时返回。
  // 注意：经 nginx 转发的请求 remoteAddress 也是 127.0.0.1，所以必须用代理头区分内外网。
  if (pathname === '/api/health') {
    const proxied = Boolean(req.headers['x-real-ip'] || req.headers['x-forwarded-for']);
    const trusted = (!proxied && auth.isLoopback(req))
      || (auth.accessConfig().enabled && auth.verifyToken(auth.extractBearer(req)));
    return sendJson(res, 200, Object.assign({ ok: true, time: new Date().toISOString() }, trusted ? { hasServerKey: ai.hasServerKey() && ai.hasInvite() } : {}));
  }


  return sendJson(res, 404, { error: MSG(reqLang(req)).apiGone });
}

const gzipCache = new Map(); // 静态文件 gzip 缓存（按 mtime 失效）
function secHeaders(filePath) {
  return filePath && /(?:plan|plan-map-lab)\.html$/i.test(filePath) ? Object.assign({}, SEC_HEADERS, { 'Content-Security-Policy': MAP_CSP }) : SEC_HEADERS;
}

function serveStatic(req, res, pathname) {
  // 二次防线：NUL 字节会让 path/fs 抛同步异常（进程级崩溃），必须在进入文件系统前拦住
  if (pathname.includes('\0')) {
    res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC_HEADERS));
    return res.end('Bad Request');
  }
  let filePath;
  try {
    filePath = pathname === '/' ? path.join(PUBLIC, 'index.html') : path.normalize(path.join(PUBLIC, pathname));
  } catch {
    res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC_HEADERS));
    return res.end('Bad Request');
  }
  const relativePath = path.relative(PUBLIC, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC_HEADERS));
    return res.end('Forbidden');
  }
  res.on('error', () => { /* 客户端提前断开：忽略，避免 unhandled 'error' 拖垮进程 */ });
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC_HEADERS));
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const cacheCtrl = ext === '.html' ? 'public, max-age=30, stale-while-revalidate=120'
      : (ext === '.js' || ext === '.css' || ext === '.json' || ext === '.svg') ? 'public, max-age=31536000, immutable'
      : 'public, max-age=604800';
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const lastModified = st.mtime.toUTCString();
    const inm = String(req.headers['if-none-match'] || '').split(',').map((x) => x.trim());
    const ims = Date.parse(String(req.headers['if-modified-since'] || ''));
    const notModified = inm.includes(etag) || (Number.isFinite(ims) && Math.floor(st.mtimeMs / 1000) <= Math.floor(ims / 1000));
    const commonHeaders = { 'Cache-Control': cacheCtrl, 'ETag': etag, 'Last-Modified': lastModified, 'Vary': 'Accept-Encoding' };
    if (notModified) {
      res.writeHead(304, Object.assign(commonHeaders, secHeaders(filePath)));
      return res.end();
    }
    const accept = (req.headers['accept-encoding'] || '');
    const compressible = ['.html', '.css', '.js', '.json', '.svg', '.txt'].includes(ext);
    if (compressible && /gzip/i.test(accept)) {
      let gz = gzipCache.get(filePath);
      if (!gz || gz.mtime !== st.mtimeMs) {
        gz = { mtime: st.mtimeMs, data: zlib.gzipSync(fs.readFileSync(filePath)) };
        gzipCache.set(filePath, gz);
      }
      res.writeHead(200, Object.assign({ 'Content-Type': mime, 'Content-Encoding': 'gzip' }, commonHeaders, secHeaders(filePath)));
      return res.end(gz.data);
    }
    res.writeHead(200, Object.assign({ 'Content-Type': mime }, commonHeaders, secHeaders(filePath)));
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  // 整个请求处理包在 try 内：静态分支里 fs.stat 等同步调用抛错时不能让进程直接退出
  // （实测 GET /%00 会让 path.join + fs.stat 抛 ERR_INVALID_ARG_VALUE，曾导致整个服务崩溃）
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(url.parse(req.url).pathname || '/');
    } catch {
      return sendJson(res, 400, { error: MSG(reqLang(req)).badPath });
    }
    // 拒绝含 NUL 字节的路径：Node 的 path/fs 会直接抛异常，属无效请求
    if (pathname.includes('\0')) {
      return sendJson(res, 400, { error: MSG(reqLang(req)).badPath });
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
        if (!res.headersSent) sendJson(res, 500, { error: MSG(reqLang(req)).serverError });
      }
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (e) {
    // 兜底：任何未预料的异常都只影响当前请求，不拖垮进程
    console.error('[Request Error]', e);
    try {
      if (!res.headersSent) sendJson(res, 500, { error: MSG(reqLang(req)).serverError });
      else res.end();
    } catch { /* 响应已断开，忽略 */ }
  }
});

/* ---------- 进程级兜底与优雅关闭 ---------- */
// 单次请求的异常已在上面捕获；这里接住其余零散异常（如未处理的 Promise），避免 pm2 重启丢掉进行中的生成任务
process.on('uncaughtException', (e) => { console.error('[uncaughtException]', e); });
process.on('unhandledRejection', (e) => { console.error('[unhandledRejection]', e); });

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] 收到 ${signal}，停止接收新连接…`);
  server.close(() => { console.log('[shutdown] 已正常退出'); process.exit(0); });
  // 兜底：10 秒内仍有长连接未结束则强制退出
  setTimeout(() => { console.log('[shutdown] 超时，强制退出'); process.exit(0); }, 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const port = Number(process.env.PORT || config.port || 3000);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  const aiCfg = (config.ai || {});
  console.log('🏡 家游汇 · 家庭旅游推荐已启动');
  console.log(`   ➜ 打开: http://localhost:${port}`);
  console.log(`   ➜ AI: ${aiCfg.apiKey ? '已配置 (' + (aiCfg.model || '') + ')' : '未配置 Key → 使用内置规则引擎（页面右上角可填写）'}`);
  console.log(`   ➜ 数据源: ${((config.collector || {}).enabled || []).join(', ')}`);
});
