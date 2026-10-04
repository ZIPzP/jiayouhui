'use strict';
/**
 * 旧入口口令工具已停用。
 * 当前产品不再显示进入网页密码；服务端 AI 使用 tools/set-invite.js 的邀请码保护。
 */
console.log('入口口令门禁已按产品需求关闭，set-passcode.js 已停用。');
console.log('如需保护服务端 AI，请使用: node tools/set-invite.js 你的邀请码');
console.log('如需重新启用入口口令，请先修改 lib/auth.js 的 accessConfig()，不要只改配置文件。');
process.exit(1);
