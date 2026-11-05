'use strict';
/**
 * 请求来源判定工具
 *
 * 历史背景：项目早期有「访问口令门禁」功能（/api/auth 登录换取令牌），
 * 后按产品需求关闭——线上是公开演示站，评审与访客需直接访问，不再要求口令。
 * 相关的前后端代码已全部移除，这里只保留部署侧仍需要的 isLoopback。
 */

/**
 * 判断请求是否来自本机（用于「仅本机可见」的部署信息，如 /api/health 的 Key 状态）。
 * 注意：经 nginx 转发时 remoteAddress 同样是 127.0.0.1，因此调用方还需结合代理头判断内外网。
 *
 * @param {import('http').IncomingMessage} req - Node 原始请求对象
 * @returns {boolean} 本机直连返回 true
 */
function isLoopback(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

module.exports = { isLoopback };
