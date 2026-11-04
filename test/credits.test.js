'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'tmp', 'credits-test.json');
process.env.AI_CREDIT_FILE = file;
const credits = require('../lib/credits');

test.before(() => {
  try { fs.unlinkSync(file); } catch { /* ignore */ }
});
test.after(() => {
  try { fs.unlinkSync(file); } catch { /* ignore */ }
  delete process.env.AI_CREDIT_FILE;
});

test('AI 额度按操作扣减，余额不足时拒绝并支持退款', () => {
  const accountId = 'client_test_1234567890';
  const initial = credits.getStatus(accountId);
  assert.equal(initial.credits, 12);

  const first = credits.consume(accountId, 'plan');
  assert.equal(first.ok, true);
  assert.equal(first.cost, 3);
  assert.equal(first.status.credits, 9);

  assert.equal(credits.refund(accountId, 'plan').status.credits, 12);
  for (let i = 0; i < 4; i++) assert.equal(credits.consume(accountId, 'plan').ok, true);
  const exhausted = credits.consume(accountId, 'chat');
  assert.equal(exhausted.ok, false);
  assert.equal(exhausted.status.credits, 0);
});

test('充值回调按订单号幂等入账', () => {
  const accountId = 'client_test_abcdefghij';
  const first = credits.topUp(accountId, 10, 'order-20261104-0001');
  assert.equal(first.added, 10);
  assert.equal(first.status.credits, 22);

  const duplicate = credits.topUp(accountId, 10, 'order-20261104-0001');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.status.credits, 22);
});
