'use strict';
/**
 * 接口冒烟测试：真实启动 server.js（随机端口），验证关键路径与健壮性。
 * 覆盖：健康检查、只读接口、畸形路径不崩进程、路径穿越、参数校验、后台任务流程。
 */
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 3000 + Math.floor(Math.random() * 2000) + 300;
const BASE = `http://127.0.0.1:${PORT}`;

let child;

function startServer() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    const timer = setTimeout(() => reject(new Error('服务启动超时: ' + out)), 20000);
    child.stdout.on('data', (c) => {
      out += c.toString();
      if (out.includes('已启动')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', (c) => { out += c.toString(); });
    child.on('exit', (code) => { if (code !== null) { clearTimeout(timer); reject(new Error('服务提前退出: ' + out)); } });
  });
}

test.before(startServer);
test.after(() => { if (child && !child.killed) child.kill('SIGTERM'); });

const alive = () => child && child.exitCode === null && !child.killed;

test('健康检查返回 ok，且不向外部访问者暴露部署信息', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);

  // 本机直连（无代理头）属于运维视角，允许返回 hasServerKey
  assert.ok('hasServerKey' in body, '本机直连应可看到 Key 配置状态');

  // 经 nginx 转发的请求会带 X-Real-IP，此时必须隐藏部署信息
  const viaProxy = await (await fetch(BASE + '/api/health', { headers: { 'x-real-ip': '203.0.113.9' } })).json();
  assert.equal('hasServerKey' in viaProxy, false, '外部访问不应暴露 hasServerKey');
});

test('只读接口可用且结构正确', async () => {
  const dest = await (await fetch(BASE + '/api/destinations')).json();
  assert.ok(dest.count >= 40);
  assert.ok(Array.isArray(dest.destinations));
  assert.equal('description' in dest.destinations[0], false, '列表不应携带超大字段');

  const cities = await (await fetch(BASE + '/api/cities')).json();
  assert.ok(cities.count > 300);

  const images = await (await fetch(BASE + '/api/images')).json();
  assert.ok(images.count > 100);

  const one = await fetch(BASE + '/api/destinations/' + dest.destinations[0].id);
  assert.equal(one.status, 200);
});

test('404 与路径穿越都被拦下', async () => {
  assert.equal((await fetch(BASE + '/api/nope')).status, 404);
  assert.equal((await fetch(BASE + '/../config.local.json')).status, 404);
  assert.equal((await fetch(BASE + '/%2e%2e/config.local.json')).status, 404);
});

test('畸形路径（%00）不会打挂进程', async () => {
  // 曾经的崩溃点：NUL 字节进入 fs.stat 抛同步异常，且静态分支不在 try 内
  await fetch(BASE + '/%00').catch(() => {});
  await fetch(BASE + '/%00/x.png').catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(alive(), '进程应在畸形请求后存活');
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.status, 200);
});

test('行程接口参数校验（缺出发城市 / 同日往返 / 非法天数）', async () => {
  const post = (body) => fetch(BASE + '/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  // 缺出发城市
  let r = await post({ destinationId: 'beijing', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(r.status, 400);

  // 出发城市与目的地相同
  r = await post({ destinationId: 'beijing', origin: '北京', startDate: '2026-12-01', endDate: '2026-12-03' });
  assert.equal(r.status, 400);

  // 返程早于去程
  r = await post({ destinationId: 'beijing', origin: '上海', startDate: '2026-12-05', endDate: '2026-12-03' });
  assert.equal(r.status, 400);

  // 超大补丁被拒绝
  r = await post({
    destinationId: 'beijing', origin: '上海', startDate: '2026-12-01', endDate: '2026-12-03',
    patch: { previous: { result: 'x'.repeat(70000) } }
  });
  assert.equal(r.status, 413);
});

test('后台任务：提交 → 轮询 → 拿到规则引擎行程', async () => {
  const r = await fetch(BASE + '/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destinationId: 'beijing', origin: '上海',
      startDate: '2026-12-01', endDate: '2026-12-03',
      days: 3, transport: '飞机', adults: 2, elderly: 1, children: 1,
      budget: '舒适型', pace: '标准', lang: 'zh'
    })
  });
  assert.equal(r.status, 200);
  const { jobId } = await r.json();
  assert.ok(jobId);

  let job;
  for (let i = 0; i < 60; i++) {
    await new Promise((s) => setTimeout(s, 500));
    job = await (await fetch(BASE + '/api/job?id=' + jobId)).json();
    if (job.status !== 'running') break;
  }
  assert.equal(job.status, 'done', '任务应完成: ' + (job.error || ''));
  assert.ok(Array.isArray(job.result.days) && job.result.days.length === 3);
  assert.ok(job.result.title);
});

test('不存在的任务返回 404', async () => {
  const r = await fetch(BASE + '/api/job?id=not-a-real-job');
  assert.equal(r.status, 404);
});

test('静态页面与安全响应头', async () => {
  const r = await fetch(BASE + '/');
  assert.equal(r.status, 200);
  assert.ok(r.headers.get('content-security-policy'), '缺少 CSP');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('strict-transport-security'));
  const html = await r.text();
  assert.ok(html.includes('家游汇'));
});
