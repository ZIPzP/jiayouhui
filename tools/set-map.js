'use strict';
/**
 * 命令行工具：保存高德地图 Web端 JS API Key 与安全密钥到 config.local.json
 *
 * 用法：
 *   node tools/set-map.js 高德JSKey 高德安全密钥
 *   node tools/set-map.js --clear
 */
const ai = require('../lib/ai');
const key = (process.argv[2] || '').trim();
const securityCode = (process.argv[3] || '').trim();

if (!key) {
  console.log('用法:');
  console.log('  node tools/set-map.js 高德JSKey 高德安全密钥');
  console.log('  node tools/set-map.js --clear');
  process.exit(0);
}
if (key === '--clear') {
  ai.saveMapConfig('', '');
  console.log('已清除高德地图配置。');
  process.exit(0);
}
if (!securityCode) {
  console.log('缺少高德安全密钥。用法: node tools/set-map.js 高德JSKey 高德安全密钥');
  process.exit(1);
}
ai.saveMapConfig(key, securityCode);
console.log('✅ 高德地图配置已写入 config.local.json（不会提交到 git）。');
console.log('   请重启服务：sudo pm2 restart jiayouhui');
