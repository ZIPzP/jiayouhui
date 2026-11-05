'use strict';

/**
 * 轻量静态安全检查：覆盖仓库敏感文件、硬编码密钥、字体二进制、
 * 前端资源引用和已退役测试接口。动态接口安全由 test/server.test.js 覆盖。
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const ignoredDirs = new Set(['.git', 'node_modules', 'tmp', 'logs']);
const fontExt = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);
const failures = [];

/** 判断文件是否被 .gitignore 忽略，避免把本地敏感文件误报为泄漏 */
function ignoredByGit(rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], {
    cwd: ROOT,
    stdio: 'ignore'
  }).status === 0;
}

/** 递归遍历项目文件，供安全扫描逐项检查 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const relative = (file) => path.relative(ROOT, file).replace(/\\/g, '/');

for (const file of files) {
  const rel = relative(file);
  const name = path.basename(file);
  if ((['config.local.json', '.env'].includes(name) || /\.(pem|key|p12|pfx)$/i.test(name)) && !ignoredByGit(rel)) {
    failures.push(`敏感文件：${rel}`);
  }
  if (fontExt.has(path.extname(file).toLowerCase())) {
    failures.push(`未审计字体二进制：${rel}`);
  }
}

const textFiles = files.filter((file) =>
  /\.(?:js|json|html|md|sh|conf)$/i.test(file) &&
  !/\.min\.js$/i.test(file) &&
  !relative(file).startsWith('data/') &&
  !ignoredByGit(relative(file))
);
const privateKeyMarker = ['BEGIN', 'OPENSSH PRIVATE KEY'].join(' ');
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(privateKeyMarker) || /\bsk-[A-Za-z0-9_-]{32,}\b/.test(text)) {
    failures.push(`疑似硬编码密钥：${relative(file)}`);
  }
  if (/^public\/js\/.+\.js$/i.test(relative(file)) && !/\.min\.js$/i.test(file) && /\beval\s*\(|\bnew Function\s*\(/.test(text)) {
    failures.push(`禁止的动态代码执行：${relative(file)}`);
  }
}

const htmlFiles = files.filter((file) => /public[\\/].+\.html$/i.test(file));
const jsFiles = files.filter((file) => /public[\\/]js[\\/].+\.js$/i.test(file));
const referencedJs = new Set();
for (const html of htmlFiles) {
  const source = fs.readFileSync(html, 'utf8');
  for (const match of source.matchAll(/<script[^>]+src=["']\/js\/([^?"']+)/gi)) {
    referencedJs.add(match[1]);
  }
}
for (const file of jsFiles) {
  const rel = path.relative(path.join(ROOT, 'public', 'js'), file).replace(/\\/g, '/');
  if (!referencedJs.has(rel)) failures.push(`未引用前端脚本：public/js/${rel}`);
}

const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
for (const retired of ["pathname === '/api/chat'", "pathname === '/api/rag/search'"]) {
  if (server.includes(retired)) failures.push(`退役接口仍存在：${retired}`);
}

const result = {
  scannedFiles: files.length,
  frontendScripts: jsFiles.length,
  referencedScripts: referencedJs.size,
  bundledFonts: files.filter((file) => fontExt.has(path.extname(file).toLowerCase())).length,
  failures
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
