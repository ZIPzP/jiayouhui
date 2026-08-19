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
  let apiKey, keySource;
  if (serverKey) { apiKey = serverKey; keySource = 'server'; }
  else if (overrides.apiKey) { apiKey = overrides.apiKey; keySource = 'browser'; }
  else { apiKey = ''; keySource = 'none'; }
  const baseUrl = (overrides.baseUrl || process.env.AI_BASE_URL || cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const model = overrides.model || process.env.AI_MODEL || cfg.model || 'deepseek-chat';
  return {
    apiKey, keySource, baseUrl, model,
    temperature: overrides.temperature ?? cfg.temperature ?? 0.7
  };
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

module.exports = { loadConfig, getSettings, hasServerKey, saveServerKey, chat, extractJson };