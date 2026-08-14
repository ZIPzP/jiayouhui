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

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
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
  const id = 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  jobs.set(id, { status: 'running', createdAt: Date.now() });
  Promise.resolve()
    .then(fn)
    .then((result) => { const j = jobs.get(id); if (j) { j.status = 'done'; j.result = result; } })
    .catch((e) => { const j = jobs.get(id); if (j) { j.status = 'error'; j.error = String((e && e.message) || e); } });
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
    if (auth.verifyPasscode(body.passcode)) {
      return sendJson(res, 200, { ok: true, token: auth.signToken() });
    }
    return sendJson(res, 401, { error: '口令错误' });
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
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model };
    const jobId = runJob(() => rec.recommend(params, overrides));
    return sendJson(res, 200, { jobId, status: 'running' });
  }

  // POST /api/ai-guide —— AI 生成目的地攻略
  if (pathname === '/api/ai-guide' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const dest = destinations.find((d) => d.id === body.destinationId);
    if (!dest) return sendJson(res, 400, { error: '请选择目的地 destinationId' });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model };
    const result = await rec.aiGuide(dest, overrides);
    return sendJson(res, 200, result);
  }

  // POST /api/plan —— AI 主理人：生成逐日详细行程规划
  if (pathname === '/api/plan' && req.method === 'POST') {
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
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model };
    const jobId = runJob(async () => {
      // 高铁/火车：从 12306 拉取当天真实车次，供 AI 直接采用
      const tr = String(params.transport || '');
      if (['高铁', '火车', '未定', ''].includes(tr) && params.origin && params.destination) {
        const ret = params.returnDest || params.origin;
        const od = await train.queryTrainsWithPrices(params.origin, params.destination.name, String(params.startDate || '').slice(0, 10));
        const id2 = await train.queryTrainsWithPrices(params.destination.name, ret, String(params.endDate || '').slice(0, 10));
        const rtNote = (res) => {
          if (!res || !res.ok) return '12306 查询失败（' + ((res && res.error) || '未知') + '），请到 12306 官网确认实际车次';
          if (!res.trains || !res.trains.length) return '暂无直达，需中转（可到 12306 查询中转方案）';
          if (res.refNote) return '出行日期超出预售期，以上为近期参考班次，车次基本每日固定，请以出行日 12306 实际为准';
          return '';
        };
        params.realTrains = {
          outbound: od.ok ? od.trains : [],
          inbound: id2.ok ? id2.trains : [],
          display: {
            outboundLabel: '去程（' + (params.origin || '') + ' → ' + params.destination.name + '）',
            outboundNote: rtNote(od),
            inboundLabel: '返程（' + params.destination.name + ' → ' + ret + '）',
            inboundNote: rtNote(id2)
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
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const message = String(body.message || '').trim();
    if (!message) return sendJson(res, 400, { error: '请输入问题' });
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model };
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
    const s = ai.getSettings({});
    return sendJson(res, 200, {
      ok: true,
      name: '家游汇',
      hasAiKey: ai.hasServerKey(),
      hasServerKey: ai.hasServerKey(),
      keySource: s.keySource,
      model: s.keySource !== 'none' ? s.model : '',
      time: new Date().toISOString()
    });
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
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheCtrl, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding' });
      return res.end(gz.data);
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheCtrl });
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
server.listen(port, () => {
  const aiCfg = (config.ai || {});
  console.log('🏡 家游汇 · 家庭旅游推荐已启动');
  console.log(`   ➜ 打开: http://localhost:${port}`);
  console.log(`   ➜ AI: ${aiCfg.apiKey ? '已配置 (' + (aiCfg.model || '') + ')' : '未配置 Key → 使用内置规则引擎（页面右上角可填写）'}`);
  console.log(`   ➜ 数据源: ${((config.collector || {}).enabled || []).join(', ')}`);
});
