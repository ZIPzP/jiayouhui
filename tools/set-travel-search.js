'use strict';
/**
 * 命令行工具：保存 Tavily 免费搜索 Key 到 config.local.json
 *
 * 用法：
 *   node tools/set-travel-search.js tvly-你的Key
 *   node tools/set-travel-search.js --clear
 */
const travelSearch = require('../lib/travel-search');
const arg = (process.argv[2] || '').trim();

if (!arg) {
  console.log('用法:');
  console.log('  node tools/set-travel-search.js tvly-你的Key');
  console.log('  node tools/set-travel-search.js --clear');
  process.exit(0);
}

travelSearch.saveApiKey(arg === '--clear' ? '' : arg);
console.log(arg === '--clear'
  ? '已清除 Tavily 搜索 Key。'
  : '✅ Tavily 搜索 Key 已写入 config.local.json（不会提交到 git）。');
console.log('   请重启服务：sudo pm2 restart jiayouhui');
