#!/usr/bin/env node
'use strict';
/**
 * 语法自检：遍历仓库里的 JS 文件做 `node --check` 等价校验（vm 编译，不执行）。
 * 用途：提交前/CI 里快速发现语法错误，零依赖。
 * 用法：node scripts/check-syntax.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'tmp', '.taste-skill', 'logs']);
const SKIP_FILE = /\.min\.js$/;

/** 递归收集需要做语法检查的 JS 文件（跳过依赖、构建产物与压缩文件） */
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (/\.js$/.test(name) && !SKIP_FILE.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT);
const errors = [];
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: file });
  } catch (e) {
    errors.push({ file: path.relative(ROOT, file), message: e.message });
  }
}

if (errors.length) {
  console.error(`❌ ${errors.length} 个文件存在语法错误：`);
  for (const e of errors) console.error(` - ${e.file}: ${e.message}`);
  process.exit(1);
}
console.log(`✅ ${files.length} 个 JS 文件语法检查通过`);
