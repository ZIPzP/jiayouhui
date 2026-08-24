'use strict';
/**
 * AI 客户端：兼容 OpenAI Chat Completions 接口（DeepSeek / OpenAI / 通义 / Moonshot 等）
 *
 * Key 来源优先级（安全设计）：
 *   1. 环境变量 AI_API_KEY
 *   2. config.local.json 中的 ai.apiKey（服务端内置 Key，已 .gitignore，不入 git）
 *   3. config.json 中的 ai.apiKey
 *   4. 浏览器传入的 apiKey（仅在前三者都为空时使用，存于 localStorage）
 * 当服务端已内置 Key 时，浏览器 Key 会被忽略——确保 Key 只属于你、只在服务器上。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CFG = path.join(__dirname, '..', 'config.json');
const CFG_LOCAL = path.join(__dirname, '..', 'config.local.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function loadConfig() {
  const base = readJson(CFG) || {};
  const local = readJson(CFG_LOCAL) || {};
  return {
    ...base,
    ...local,
    ai: { ...(base.ai || {}), ...(local.ai || {}) },
    collector: { ...(base.collector || {}), ...(local.collector || {}) },
    access: { ...(base.access || {}), ...(local.access || {}) }
  };
}

function getSettings(overrides = {}) {
  const cfg = loadConfig().ai || {};
  const serverKey = process.env.AI_API_KEY || cfg.apiKey || '';
  // 安全：服务端 Key 仅在持有有效「邀请码解锁令牌」时可用；否则只能用浏览器自带 Key
  const canUseServer = serverKey && verifyAiToken(overrides.aiToken || '');
  let apiKey, keySource;
  if (canUseServer) { apiKey = serverKey; keySource = 'server'; }
  else if (overrides.apiKey) { apiKey = overrides.apiKey; keySource = 'browser'; }
  else { apiKey = ''; keySource = 'none'; }
  const baseUrl = (overrides.baseUrl || process.env.AI_BASE_URL || cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = overrides.model || process.env.AI_MODEL || cfg.model || 'deepseek-chat';
  return {
    apiKey, keySource, baseUrl, model,
    temperature: overrides.temperature ?? cfg.temperature ?? 0.7
  };
}

const AI_TOKEN_TTL = 24 * 3600 * 1000; // 邀请码解锁有效期 24h
/** 服务端邀请码（仅服务器持有：config.local.json 的 ai.inviteCode，不入 git） */
function getInviteCode() { return String((loadConfig().ai || {}).inviteCode || '').trim(); }
function hasInvite() { return !!getInviteCode(); }
function verifyInvite(input) {
  const code = getInviteCode();
  if (!code || !input) return false;
  const a = Buffer.from(String(input).trim());
  const b = Buffer.from(code);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function signAiToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + AI_TOKEN_TTL })).toString('base64url');
  const sig = crypto.createHmac('sha256', getInviteCode()).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyAiToken(token) {
  const code = getInviteCode();
  if (!code || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expect = crypto.createHmac('sha256', code).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return typeof data.exp === 'number' && data.exp > Date.now(); } catch { return false; }
}
function hasServerKey() {
  return Boolean(process.env.AI_API_KEY || (loadConfig().ai || {}).apiKey);
}

/** 保存/清除服务端内置 Key（写入 config.local.json，该文件已被 .gitignore 排除） */
function saveServerKey(apiKey) {
  const existing = readJson(CFG_LOCAL) || {};
  const ai = { ...(existing.ai || {}) };
  if (apiKey) ai.apiKey = String(apiKey).trim();
  else delete ai.apiKey;
  const next = { ...existing, ai };
  if (!Object.keys(ai).length) delete next.ai;
  if (!Object.keys(next).length) {
    try { fs.unlinkSync(CFG_LOCAL); } catch { /* ignore */ }
    return;
  }
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(next, null, 2), 'utf8');
  try { fs.chmodSync(CFG_LOCAL, 0o600); } catch { /* 权限收紧失败可忽略 */ }
}

/** 调用 chat/completions，返回 assistant 的纯文本内容 */
async function chat(settings, messages, { temperature, jsonMode = true } = {}) {
  const body = {
    model: settings.model,
    messages,
    temperature: temperature ?? settings.temperature ?? 0.7
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`AI 接口错误 ${resp.status}: ${String(text).slice(0, 300)}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** 从模型返回文本中稳健地提取 JSON */
function extractJson(text) {
  if (!text) return null;
  let candidate = String(text).trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidate = fence[1].trim();
  try { return JSON.parse(candidate); } catch { /* continue */ }
  try {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  } catch { /* continue */ }
  return null;
}

module.exports = { loadConfig, getSettings, hasServerKey, saveServerKey, chat, extractJson, getInviteCode, hasInvite, verifyInvite, signAiToken, verifyAiToken };