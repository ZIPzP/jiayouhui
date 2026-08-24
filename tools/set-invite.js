'use strict';
/**
 * 服务端 AI 邀请码设置工具：写入 config.local.json 的 ai.inviteCode（不入 git）
 * 用法：
 *   node tools/set-invite.js 你的邀请码    # 设置/启用（只有输入此码的用户才能用服务端 AI Key）
 *   node tools/set-invite.js --clear       # 清除（关闭邀请码，服务端 AI 将不可用，用户需自带 Key）
 */
const fs = require('fs');
const path = require('path');
const CFG_LOCAL = path.join(__dirname, '..', 'config.local.json');
function readLocal() { try { return JSON.parse(fs.readFileSync(CFG_LOCAL, 'utf8')); } catch { return {}; } }
function writeLocal(obj) {
  if (!Object.keys(obj).length) { try { fs.unlinkSync(CFG_LOCAL); } catch {} return; }
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(obj, null, 2), 'utf8');
  try { fs.chmodSync(CFG_LOCAL, 0o600); } catch {}
}
const arg = (process.argv[2] || '').trim();
if (!arg) {
  console.log('用法:');
  console.log('  node tools/set-invite.js 你的邀请码   设置/启用服务端 AI 邀请码');
  console.log('  node tools/set-invite.js --clear    清除邀请码（服务端 AI 关闭）');
  process.exit(0);
}
const local = readLocal();
const ai = { ...(local.ai || {}) };
if (arg === '--clear') { delete ai.inviteCode; }
else { ai.inviteCode = arg; }
if (Object.keys(ai).length) local.ai = ai; else delete local.ai;
writeLocal(local);
console.log(arg === '--clear' ? '已清除邀请码（服务端 AI 关闭，用户需自带 Key）' : '✅ 服务端 AI 邀请码已设置（写入 config.local.json，不入 git）。');
