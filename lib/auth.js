'use strict';
/**
 * 访问口令认证（HMAC 签名令牌，无数据库依赖）
 * - 未启用口令时：所有接口放行（默认）
 * - 启用后：/api/auth 登录获取令牌，其余 /api/* 需带 Authorization: Bearer <token>
 * - 口令与密钥放在 config.local.json（已 .gitignore，不入 git）
 */
const crypto = require('crypto');
const { loadConfig } = require('./ai');

function accessConfig() {
  const a = (loadConfig().access || {});
  return {
    enabled: Boolean(a.enabled && a.passcode),
    passcode: String(a.passcode || ''),
    tokenTtlDays: Number(a.tokenTtlDays || 30)
  };
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyPasscode(input) {
  const a = accessConfig();
  if (!a.enabled) return true;
  if (!input) return false;
  return safeEqual(String(input).trim(), a.passcode);
}

function signToken() {
  const a = accessConfig();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + a.tokenTtlDays * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', String(a.passcode)).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  const a = accessConfig();
  if (!a.enabled) return true;
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expect = crypto.createHmac('sha256', String(a.passcode)).update(payload).digest('base64url');
  if (!safeEqual(sig, expect)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch { return false; }
}

function extractBearer(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

module.exports = { accessConfig, verifyPasscode, signToken, verifyToken, extractBearer };