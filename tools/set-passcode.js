'use strict';
/**
 * 访问口令设置工具：把口令写入 config.local.json（已 .gitignore，不入 git）
 *
 * 用法：
 *   node tools/set-passcode.js 你的口令      # 启用访问口令
 *   node tools/set-passcode.js --clear       # 关闭访问口令
 */
const fs = require('fs');
const path = require('path');
const CFG_LOCAL = path.join(__dirname, '..', 'config.local.json');

function readLocal() { try { return JSON.parse(fs.readFileSync(CFG_LOCAL, 'utf8')); } catch { return {}; } }
function writeLocal(obj) {
  if (!Object.keys(obj).length) { try { fs.unlinkSync(CFG_LOCAL); } catch {} return; }
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(obj, null, 2), 'utf8');
}

const arg = (process.argv[2] || '').trim();
if (!arg) {
  console.log('用法:');
  console.log('  node tools/set-passcode.js 你的口令   启用访问口令（仅本机，不入 git）');
  console.log('  node tools/set-passcode.js --clear    关闭访问口令');
  process.exit(0);
}
const local = readLocal();
if (arg === '--clear') {
  const access = { ...(local.access || {}) };
  delete access.enabled; delete access.passcode;
  if (Object.keys(access).length) local.access = access; else delete local.access;
  writeLocal(local);
  console.log('已关闭访问口令。');
} else {
  local.access = { ...(local.access || {}), enabled: true, passcode: arg, tokenTtlDays: 30 };
  writeLocal(local);
  console.log('✅ 访问口令已启用（写入 config.local.json，不入 git）。');
  console.log('   现在访问网站会要求输入口令；请牢记该口令。');
}