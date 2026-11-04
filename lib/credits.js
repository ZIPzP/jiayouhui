'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./ai');

const DEFAULT_FILE = path.join(__dirname, '..', 'tmp', 'ai-credits.json');
const ACCOUNT_RE = /^[A-Za-z0-9_-]{16,80}$/;
const ORDER_RE = /^[A-Za-z0-9_.:-]{8,120}$/;

function settings() {
  const raw = (loadConfig().billing || {}).credits || {};
  const costs = raw.costs && typeof raw.costs === 'object' ? raw.costs : {};
  return {
    enabled: raw.enabled !== false,
    initialCredits: Math.max(0, Math.min(1000, Math.trunc(Number(raw.initialCredits) || 15))),
    lowBalanceThreshold: Math.max(0, Math.min(100, Math.trunc(Number(raw.lowBalanceThreshold) || 5))),
    costs: {
      plan: Math.max(1, Math.min(100, Math.trunc(Number(costs.plan) || 3))),
      revision: Math.max(1, Math.min(100, Math.trunc(Number(costs.revision) || 1))),
      chat: Math.max(1, Math.min(100, Math.trunc(Number(costs.chat) || 1))),
      vision: Math.max(1, Math.min(100, Math.trunc(Number(costs.vision) || 1))),
      packing: Math.max(1, Math.min(100, Math.trunc(Number(costs.packing) || 1))),
      guide: Math.max(1, Math.min(100, Math.trunc(Number(costs.guide) || 1)))
    }
  };
}

function ledgerFile() {
  return process.env.AI_CREDIT_FILE || DEFAULT_FILE;
}

function readLedger() {
  const file = ledgerFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !parsed.accounts || typeof parsed.accounts !== 'object') {
      throw new Error('invalid credit ledger');
    }
    return parsed;
  } catch (error) {
    if (error && error.code === 'ENOENT') return { version: 1, accounts: {} };
    throw error;
  }
}

function writeLedger(data) {
  const file = ledgerFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data), 'utf8');
  fs.renameSync(temp, file);
  try { fs.chmodSync(file, 0o600); } catch { /* Windows / restricted FS */ }
}

function accountKey(value) {
  const id = String(value || '').trim();
  if (!id) throw new Error('account id is required');
  if (ACCOUNT_RE.test(id)) return 'c_' + id;
  return 'h_' + crypto.createHash('sha256').update(id).digest('hex');
}

function accountRecord(data, accountId) {
  const cfg = settings();
  const key = accountKey(accountId);
  const existing = data.accounts[key];
  if (existing && Number.isFinite(existing.credits)) {
    if (!Array.isArray(existing.orders)) existing.orders = [];
    return { key, record: existing };
  }
  const record = {
    credits: cfg.initialCredits,
    spent: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    orders: []
  };
  data.accounts[key] = record;
  return { key, record };
}

function publicStatus(record) {
  const cfg = settings();
  const remaining = Math.max(0, Number(record.credits) || 0);
  return {
    enabled: cfg.enabled,
    credits: remaining,
    spent: Math.max(0, Number(record.spent) || 0),
    lowBalance: remaining <= cfg.lowBalanceThreshold,
    exhausted: remaining <= 0,
    lowBalanceThreshold: cfg.lowBalanceThreshold,
    costs: cfg.costs
  };
}

function getStatus(accountId) {
  const data = readLedger();
  const cfg = settings();
  if (!cfg.enabled) return { enabled: false, credits: null, spent: 0, lowBalance: false, exhausted: false, costs: cfg.costs };
  const { record } = accountRecord(data, accountId);
  writeLedger(data);
  return publicStatus(record);
}

function consume(accountId, action) {
  const cfg = settings();
  if (!cfg.enabled) return { ok: true, charged: false, status: { enabled: false, credits: null, costs: cfg.costs } };
  const cost = cfg.costs[action] || 1;
  const data = readLedger();
  const { record } = accountRecord(data, accountId);
  if (record.credits < cost) {
    return {
      ok: false,
      charged: false,
      required: cost,
      action,
      status: publicStatus(record)
    };
  }
  record.credits -= cost;
  record.spent += cost;
  record.updatedAt = Date.now();
  writeLedger(data);
  return { ok: true, charged: true, cost, action, status: publicStatus(record) };
}

function refund(accountId, action) {
  const cfg = settings();
  if (!cfg.enabled) return { ok: true, charged: false };
  const cost = cfg.costs[action] || 1;
  const data = readLedger();
  const { record } = accountRecord(data, accountId);
  record.credits += cost;
  record.spent = Math.max(0, record.spent - cost);
  record.updatedAt = Date.now();
  writeLedger(data);
  return { ok: true, refunded: cost, status: publicStatus(record) };
}

function topUp(accountId, amount, orderId) {
  const credits = Math.trunc(Number(amount));
  const order = String(orderId || '').trim();
  if (!Number.isFinite(credits) || credits < 1 || credits > 10000) throw new Error('invalid top-up amount');
  if (!ORDER_RE.test(order)) throw new Error('invalid order id');
  const data = readLedger();
  const { record } = accountRecord(data, accountId);
  if (record.orders.includes(order)) {
    return { ok: true, duplicate: true, status: publicStatus(record) };
  }
  record.credits += credits;
  record.orders.push(order);
  record.orders = record.orders.slice(-100);
  record.updatedAt = Date.now();
  writeLedger(data);
  return { ok: true, duplicate: false, added: credits, status: publicStatus(record) };
}

module.exports = { settings, getStatus, consume, refund, topUp };
