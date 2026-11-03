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
const dns = require('dns').promises;
const net = require('net');

const CFG = path.join(__dirname, '..', 'config.json');
const CFG_LOCAL = path.join(__dirname, '..', 'config.local.json');

/* 配置读盘缓存：loadConfig() 在请求链路上会被调用 5-10 次，每次都同步读 2 个文件很浪费。
 * 按 mtime + size 失效，因此手工改配置文件后无需重启即可生效。 */
const cfgCache = new Map();
function readJson(file) {
  let st;
  try { st = fs.statSync(file); } catch { cfgCache.delete(file); return null; }
  const hit = cfgCache.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.data;
  let data = null;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = null; }
  cfgCache.set(file, { mtime: st.mtimeMs, size: st.size, data });
  return data;
}
/** 写配置后主动失效缓存（同一毫秒内写入时 mtime 可能不变） */
function invalidateConfig() { cfgCache.delete(CFG); cfgCache.delete(CFG_LOCAL); }

function loadConfig() {
  const base = readJson(CFG) || {};
  const local = readJson(CFG_LOCAL) || {};
  return {
    ...base,
    ...local,
    ai: { ...(base.ai || {}), ...(local.ai || {}) },
    map: { ...(base.map || {}), ...(local.map || {}) },
    collector: { ...(base.collector || {}), ...(local.collector || {}) },
    travelSearch: { ...(base.travelSearch || {}), ...(local.travelSearch || {}) },
    access: { ...(base.access || {}), ...(local.access || {}) }
  };
}

/** 安全：限制浏览器传入的 AI baseUrl，避免把服务端当作内网探测跳板。 */
function isPrivateHost(host) {
  const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0') return true;
  // IPv4-mapped IPv6（::ffff:127.0.0.1 / ::ffff:7f00:1）等价于对应 IPv4 地址
  const mapped = mappedIPv4(h);
  if (mapped) return isPrivateHost(mapped);
  if (h.includes(':')) return h === '::1' || /^f[cd]/.test(h) || /^fe80:/.test(h);
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}
/** ::ffff:a.b.c.d 或 ::ffff:xxxx:yyyy → 点分 IPv4；非映射地址返回 '' */
function mappedIPv4(h) {
  const s = String(h || '').toLowerCase();
  const dotted = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = s.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return '';
  const hi = parseInt(hex[1], 16);
  const lo = parseInt(hex[2], 16);
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
}
/** 内网/保留网段黑名单（DNS 解析后校验，防御 DNS rebinding 与「解析到内网的域名」） */
let privateBlockList = null;
function blockList() {
  if (privateBlockList) return privateBlockList;
  const list = new net.BlockList();
  const v4 = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.168.0.0/16', '198.18.0.0/15', '224.0.0.0/4'];
  const v6 = ['::/128', '::1/128', 'fc00::/7', 'fe80::/10'];
  v4.forEach((c) => { const [a, p] = c.split('/'); list.addSubnet(a, Number(p), 'ipv4'); });
  v6.forEach((c) => { const [a, p] = c.split('/'); list.addSubnet(a, Number(p), 'ipv6'); });
  privateBlockList = list;
  return list;
}
/** 校验目标主机解析结果全部是公网地址；浏览器自定义接口在发请求前必须过这一关 */
async function assertPublicHost(hostname) {
  const h = String(hostname || '').replace(/^\[|\]$/g, '');
  if (!h) throw new Error('empty host');
  let addrs;
  if (net.isIP(h)) addrs = [{ address: h, family: net.isIPv6(h) ? 6 : 4 }];
  else addrs = await dns.lookup(h, { all: true, verbatim: true });
  if (!addrs || !addrs.length) throw new Error('host not resolvable');
  const list = blockList();
  for (const item of addrs) {
    let addr = String(item.address || '');
    let family = item.family;
    const mapped = mappedIPv4(addr);
    if (mapped) { addr = mapped; family = 4; }
    if (list.check(addr, family === 6 ? 'ipv6' : 'ipv4')) throw new Error('private address not allowed');
  }
}
function safeBrowserBaseUrl(raw, allowPrivate) {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (!allowPrivate && (u.protocol !== 'https:' || isPrivateHost(u.hostname))) return '';
    return u.toString().replace(/\/+$/, '');
  } catch { return ''; }
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
  // 用服务端 Key 时必须配套服务端的接口地址与模型：浏览器里可能残留别的服务商预设（如阿里云地址），
  // 否则会把服务端 Key 发到错误的服务商（DeepSeek Key 发到阿里云 → 401 invalid_api_key）
  const serverBaseUrl = (process.env.AI_BASE_URL || cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
  const serverModel = process.env.AI_MODEL || cfg.model || 'deepseek-chat';
  const allowPrivateBaseUrl = process.env.AI_ALLOW_PRIVATE_BASE_URL === '1' || cfg.allowPrivateBaseUrl === true;
  const browserBaseUrl = overrides.baseUrl ? safeBrowserBaseUrl(overrides.baseUrl, allowPrivateBaseUrl) : '';
  const baseUrl = keySource === 'server'
    ? serverBaseUrl
    : (overrides.baseUrl ? browserBaseUrl : (process.env.AI_BASE_URL || cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, ''));
  const model = keySource === 'server'
    ? serverModel
    : (overrides.model || process.env.AI_MODEL || cfg.model || 'deepseek-chat');
  return {
    apiKey, keySource, baseUrl, model,
    lang: overrides.lang === 'en' ? 'en' : 'zh',
    temperature: overrides.temperature ?? cfg.temperature ?? 0.7
  };
}

// 邀请码解锁默认有效期 365 天；可在 config 的 ai.tokenTtlDays 调整。
// 换邀请码会因 HMAC 密钥变化使全部旧令牌失效；改 ai.tokenVersion 可单独吊销全部令牌。
const AI_TOKEN_TTL_DAYS_DEFAULT = 365;
function aiTokenCfg() {
  const cfg = loadConfig().ai || {};
  const days = Number(cfg.tokenTtlDays);
  const version = Number(cfg.tokenVersion);
  return {
    ttlMs: (Number.isFinite(days) && days > 0 ? days : AI_TOKEN_TTL_DAYS_DEFAULT) * 86400000,
    version: Number.isFinite(version) ? version : 1
  };
}
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
  const cfg = aiTokenCfg();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + cfg.ttlMs, v: cfg.version })).toString('base64url');
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
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now() && Number(data.v || 1) === aiTokenCfg().version;
  } catch { return false; }
}
function hasServerKey() {
  return Boolean(process.env.AI_API_KEY || (loadConfig().ai || {}).apiKey);
}

/** 保存/清除服务端高德地图配置（写入 config.local.json，该文件不入 git） */
function saveMapConfig(amapJsKey, amapSecurityCode) {
  const existing = readJson(CFG_LOCAL) || {};
  const key = String(amapJsKey || '').trim();
  const code = String(amapSecurityCode || '').trim();
  if (!key && !code) delete existing.map;
  else existing.map = { provider: 'amap', amapJsKey: key, amapSecurityCode: code };
  if (!Object.keys(existing).length) {
    try { fs.unlinkSync(CFG_LOCAL); } catch { /* ignore */ }
    invalidateConfig();
    return;
  }
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(existing, null, 2), 'utf8');
  try { fs.chmodSync(CFG_LOCAL, 0o600); } catch { /* 权限收紧失败可忽略 */ }
  invalidateConfig();
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
    invalidateConfig();
    return;
  }
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(next, null, 2), 'utf8');
  try { fs.chmodSync(CFG_LOCAL, 0o600); } catch { /* 权限收紧失败可忽略 */ }
  invalidateConfig();
}

/** 调用 chat/completions，返回 assistant 的纯文本内容 */
async function chat(settings, messages, { temperature, jsonMode = true } = {}) {
  const en = settings.lang === 'en';
  if (!settings.baseUrl) throw new Error(en ? 'Invalid or disallowed AI API URL' : 'AI 接口地址无效或不被允许');
  // 浏览器自定义接口：发请求前解析主机名并校验解析结果，仅字面量判断挡不住「解析到内网的域名」
  if (settings.keySource !== 'server') {
    try {
      await assertPublicHost(new URL(settings.baseUrl).hostname);
    } catch {
      throw new Error(en
        ? 'The AI endpoint must resolve to a public host (private addresses are not allowed)'
        : 'AI 接口地址必须指向公网主机（不允许内网地址）');
    }
  }
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
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 120000))
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    // 401 多为「Key 与接口地址不是同一家服务商」，附上实际请求地址与 Key 来源，便于自查
    const host = (() => { try { return new URL(settings.baseUrl).host; } catch { return settings.baseUrl; } })();
    const hint = resp.status === 401
      ? (en
        ? ` (requested host: ${host} | key source: ${settings.keySource === 'server' ? 'server' : 'browser'}; make sure the key and base URL belong to the same provider)`
        : `（实际请求地址：${host}｜Key 来源：${settings.keySource === 'server' ? '服务端内置' : '浏览器设置'}；请到 AI 设置里核对 Key 与接口地址是否为同一服务商）`)
      : '';
    throw new Error(`${en ? 'AI API error' : 'AI 接口错误'} ${resp.status}: ${String(text).slice(0, 300)}${hint}`);
  }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** 英文站点：要求模型用英文输出内容（JSON 键名不变，只换内容语言） */
function langDirective(overrides) {
  return String((overrides || {}).lang || 'zh') === 'en'
    ? '\n\n【OUTPUT LANGUAGE / 输出语言】Write ALL text values in natural, friendly English suitable for international visitors travelling in China (keep every JSON key exactly as specified). Use English place names (e.g. "Beijing", "West Lake", "Terracotta Army") and write dates as "Feb 10 (Wed)". Do NOT output any Chinese characters.'
    : '';
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

module.exports = {
  loadConfig, getSettings, hasServerKey, saveServerKey, saveMapConfig, chat, extractJson, langDirective,
  getInviteCode, hasInvite, verifyInvite, signAiToken, verifyAiToken,
  // 配置读盘缓存：其它 lib 模块复用同一份实现，改配置后无需重启即可生效
  readConfigFile: readJson, invalidateConfig,
  // 安全工具函数：导出以便单元测试覆盖（内网地址判定 / DNS 解析校验）
  isPrivateHost, mappedIPv4, assertPublicHost
};
