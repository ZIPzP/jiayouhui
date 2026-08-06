'use strict';
/**
 * 命令行工具：把 DeepSeek API Key「内置」到服务器（写入 config.local.json，已被 .gitignore 排除，不会提交到 git）
 *
 * 用法：
 *   node tools/set-key.js sk-你的key    # 保存服务端 Key
 *   node tools/set-key.js --clear       # 清除服务端 Key
 */
const ai = require('../lib/ai');
const arg = (process.argv[2] || '').trim();

if (!arg) {
  console.log('用法:');
  console.log('  node tools/set-key.js sk-你的key   保存服务端 Key（仅本机，不入 git）');
  console.log('  node tools/set-key.js --clear      清除服务端 Key');
  process.exit(0);
}
if (arg === '--clear') {
  ai.saveServerKey('');
  console.log('已清除服务端 Key。');
} else {
  ai.saveServerKey(arg);
  console.log('✅ 已写入 config.local.json（该文件已被 .gitignore 排除，不会提交到 git）。');
  console.log('   现在刷新页面即可使用，浏览器中不再保存 Key。');
}