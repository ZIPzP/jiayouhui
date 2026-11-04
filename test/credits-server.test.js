'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CREDIT_FILE = path.join(ROOT, 'tmp', 'credits-server-test.json');
const INVITE = 'credits-integration-invite';
process.env.AI_CREDIT_FILE = CREDIT_FILE;
const credits = require('../lib/credits');

let child;
let base;

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

test.before(async () => {
  try { fs.unlinkSync(CREDIT_FILE); } catch { /* ignore */ }
  const port = await reservePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      AI_API_KEY: 'test-key',
      AI_INVITE_CODE: INVITE,
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      AI_CREDIT_FILE: CREDIT_FILE,
      BILLING_WEBHOOK_SECRET: 'billing-test-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`server timeout: ${output}`)), 20000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('已启动')) { clearTimeout(timer); resolve(); }
    });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('exit', (code) => {
      if (code !== null) { clearTimeout(timer); reject(new Error(`server exited: ${output}`)); }
    });
  });
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
  try { fs.unlinkSync(CREDIT_FILE); } catch { /* ignore */ }
  delete process.env.AI_CREDIT_FILE;
});

test('服务端额度状态与耗尽拦截', async () => {
  const clientId = 'client_credits_integration';
  const invite = await fetch(base + '/api/ai/invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: INVITE, clientId })
  });
  assert.equal(invite.status, 200);
  const { aiToken } = await invite.json();
  assert.ok(aiToken);

  const statusResponse = await fetch(base + '/api/ai/status', {
    headers: { 'x-ai-token': aiToken, 'x-client-id': clientId }
  });
  const status = await statusResponse.json();
  assert.equal(status.unlocked, true);
  assert.equal(status.usage.credits, 15);

  for (let i = 0; i < 5; i++) assert.equal(credits.consume(clientId, 'plan').ok, true);
  const blocked = await fetch(base + '/api/chat/stream', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Why is day two arranged this way?',
      aiToken,
      clientId,
      lang: 'en'
    })
  });
  assert.equal(blocked.status, 402);
  const body = await blocked.json();
  assert.equal(body.code, 'AI_CREDITS_EXHAUSTED');
  assert.equal(body.usage.credits, 0);

  const order = {
    accountId: clientId,
    credits: 30,
    orderId: 'order-credits-integration-1'
  };
  const raw = JSON.stringify(order);
  const signature = crypto.createHmac('sha256', 'billing-test-secret').update(raw).digest('hex');
  const topup = await fetch(base + '/api/billing/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-billing-signature': signature },
    body: raw
  });
  assert.equal(topup.status, 200);
  const topupBody = await topup.json();
  assert.equal(topupBody.status.credits, 30);

  const usage = await fetch(base + '/api/ai/usage', {
    headers: { 'x-ai-token': aiToken, 'x-client-id': clientId }
  });
  assert.equal((await usage.json()).credits, 30);
});
