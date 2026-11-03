'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('服务端行程任务完成真实工具调用闭环', async (t) => {
  const upstreamRequests = [];
  const upstream = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      upstreamRequests.push(body);
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"reasoning_content":"分析一"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"reasoning_content":"分析二"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"基于检索依据的测试回答"}}]}\n\n');
        res.end('data: [DONE]\n\n');
        return;
      }
      const hasToolResult = (body.messages || []).some((message) => message.role === 'tool');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (!hasToolResult) {
        res.end(JSON.stringify({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'tool-search-1',
                type: 'function',
                function: {
                  name: 'search_travel_knowledge',
                  arguments: JSON.stringify({ query: '北京 老人 亲子 故宫' })
                }
              }]
            }
          }]
        }));
        return;
      }
      res.end(JSON.stringify({
        choices: [{
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: JSON.stringify({
              title: '北京 2天家庭行程',
              summary: '结合本地适老与亲子依据生成的测试行程。',
              days: [{
                day: 1,
                dateLabel: '12月1日 周二',
                title: '故宫慢游',
                schedule: [{ time: '上午', activity: '故宫', detail: '预留午休，减少步行' }],
                meals: [],
                transport: '地铁',
                accommodation: '市区酒店',
                costPerPerson: '约 500 元'
              }],
              transportPlan: { outbound: '飞机', inbound: '飞机', local: '地铁' },
              budget: { totalPerPerson: '约 1500 元' },
              dietaryNotes: [],
              tips: ['提前预约']
            })
          }
        }]
      }));
    });
  });
  const upstreamPort = await listen(upstream);
  const appPort = 6200 + Math.floor(Math.random() * 700);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(appPort),
      HOST: '127.0.0.1',
      AI_ALLOW_PRIVATE_BASE_URL: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => {
    if (!child.killed) child.kill('SIGTERM');
    upstream.close();
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('服务启动超时: ' + output)), 15000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('已启动')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', (chunk) => { output += chunk; });
  });

  const base = `http://127.0.0.1:${appPort}`;
  const submitted = await fetch(base + '/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      destinationId: 'beijing',
      origin: '上海',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      days: 2,
      transport: '飞机',
      adults: 2,
      elderly: 1,
      children: 1,
      notes: '老人少走路，孩子需要午休',
      apiKey: 'test-key',
      baseUrl: `http://127.0.0.1:${upstreamPort}`,
      model: 'deepseek-flash',
      lang: 'zh'
    })
  });
  assert.equal(submitted.status, 200);
  const { jobId } = await submitted.json();
  let job;
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    job = await (await fetch(base + '/api/job?id=' + jobId)).json();
    if (job.status !== 'running') break;
  }
  assert.equal(job.status, 'done', job.error || '');
  assert.equal(job.result.provider, 'ai', job.result.aiError || JSON.stringify(upstreamRequests.map((item) => item.messages && item.messages.map((message) => message.role))));
  assert.equal(job.result.toolTrace[0].name, 'search_travel_knowledge');
  assert.ok(job.result.toolTrace[0].ok);
  assert.ok(job.result.citations.length >= 1);
  assert.equal(upstreamRequests.length, 2);
  assert.ok(upstreamRequests[0].tools.some((tool) => tool.function.name === 'get_transport_options'));
  assert.ok(upstreamRequests[1].messages.some((message) => message.role === 'tool'));

  const streamed = await fetch(base + '/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: '为什么第 1 天这样安排？',
      history: [],
      tripContext: { destinationId: 'beijing', destinationName: '北京', elderly: 1, children: 1 },
      apiKey: 'test-key',
      baseUrl: `http://127.0.0.1:${upstreamPort}`,
      model: 'deepseek-flash',
      lang: 'zh'
    })
  });
  assert.equal(streamed.status, 200);
  const streamText = await streamed.text();
  assert.match(streamText, /基于检索依据的测试回答/);
  assert.equal((streamText.match(/\"phase\":\"reasoning\"/g) || []).length, 1, '推理阶段事件不应重复刷屏');
});
