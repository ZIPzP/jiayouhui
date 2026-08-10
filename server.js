'use strict';
/**
 * 家游汇 · 家庭旅游推荐与攻略选择
 * 零依赖 Node.js 服务器：静态页面 + REST API
 *
 * 启动：node server.js   （默认 http://localhost:3000）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const ai = require('./lib/ai');
const rec = require('./lib/recommend');
const planner = require('./lib/planner');
const auth = require('./lib/auth');
const weather = require('./lib/weather');
const collector = require('./lib/collector');

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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
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
    const list = destinations.map(({ gallery, highlights, description, ...rest }) => ({
      ...rest,
      highlightCount: (highlights || []).length,
      galleryCount: (gallery || []).length
    }));
    return sendJson(res, 200, { count: list.length, destinations: list });
  }

  // GET /api/destinations/:id —— 详情
  const dm = pathname.match(/^\/api\/destinations\/([^/]+)$/);
  if (dm && req.method === 'GET') {
    const d = destinations.find((x) => x.id === decodeURIComponent(dm[1]));
    if (!d) return sendJson(res, 404, { error: '未找到该目的地' });
    return sendJson(res, 200, { destination: d });
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
    const params = {
      destination: dest,
      month: Number(body.month) || new Date().getMonth() + 1,
      durationDays: Number(body.durationDays) || 3,
      elderly: Number(body.elderly) || 0,
      adults: Number(body.adults) || 2,
      children: Number(body.children) || 0,
      interests: Array.isArray(body.interests) ? body.interests : []
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
    const dest = destinations.find((d) => d.id === body.destinationId)
      || (body.destinationId === 'custom' && String((body.customDest || {}).name || '').trim()
          ? planner.customDestination(String((body.customDest || {}).name || '').trim(), String((body.customDest || {}).note || '').trim())
          : null);
    if (!dest) return sendJson(res, 400, { error: '请选择目的地，或选择「自定义目的地」并填写城市名' });
    const params = {
      destination: dest,
      origin: String(body.origin || '').trim(),
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
      notes: String(body.notes || '').trim()
    };
    const overrides = { apiKey: body.apiKey, baseUrl: body.baseUrl, model: body.model };
    const jobId = runJob(() => planner.buildPlan(params, overrides));
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

  // POST /api/access —— 设置/清除邀请码（访问口令），仅本机可操作
  if (pathname === '/api/access' && req.method === 'POST') {
    if (!auth.isLoopback(req)) return sendJson(res, 403, { error: '仅限本机设置' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const code = String(body.passcode || '').trim();
    auth.savePasscode(code);
    return sendJson(res, 200, { ok: true, enabled: Boolean(code) });
  }
  // POST /api/ai-key —— 保存/清除服务端内置 Key（仅本机可操作，写入 config.local.json，不入 git）
  if (pathname === '/api/ai-key' && req.method === 'POST') {
    if (!auth.isLoopback(req)) return sendJson(res, 403, { error: '仅限本机设置' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: 'JSON 格式错误' }); }
    const key = String(body.apiKey || '').trim();
    ai.saveServerKey(key);
    return sendJson(res, 200, { ok: true, keySource: key ? 'server' : 'none', hasServerKey: ai.hasServerKey() });
  }

  return sendJson(res, 404, { error: '接口不存在' });
}

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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
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
      if (gate.enabled && !['/api/auth', '/api/auth/status', '/api/health', '/api/access'].includes(pathname)) {
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