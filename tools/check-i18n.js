'use strict';
/**
 * 英文版覆盖自检：扫描 HTML 静态文案与前端 JS 字面量，找出没有英文翻译的中文。
 * 用法：node tools/check-i18n.js
 * 说明：赣ICP 备案号属于法定编号，故意保留中文，不计入未覆盖。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const dictSrc = fs.readFileSync(path.join(PUBLIC, 'js', 'i18n.js'), 'utf8');
const DICT = JSON.parse(dictSrc.match(/const DICT = (\{[\s\S]*?\n\});/)[1]);
// 运行时前端还会从服务端拉取这两张数据翻译表并合并进字典，这里一并计入
for (const f of ['dest-i18n.json', 'packing-i18n.json']) {
  try { Object.assign(DICT, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'))); } catch (e) { /* 忽略 */ }
}
const PATTERNS = (dictSrc.match(/const PATTERNS = \[([\s\S]*?)\n  \];/) || [, ''])[1];
const patternList = PATTERNS ? eval('[' + PATTERNS + ']').filter((it) => Array.isArray(it) && it[0] instanceof RegExp) : [];
const hasCN = (s) => /[\u4e00-\u9fa5]/.test(s);
const IGNORE = /赣ICP|^🌏 中文$/;

function covered(raw) {
  const k = String(raw).trim();
  if (!k || !hasCN(k) || IGNORE.test(k)) return true;
  if (DICT[k]) return true;
  const m = k.match(/^([^\p{L}\p{N}]+)(.+)$/u);
  if (m && DICT[m[2]]) return true;
  if (k.includes(' · ') && k.split(' · ').every((x) => DICT[x.trim()])) return true;
  if (k.includes('、') && k.split('、').length > 1 && k.split('、').every((x) => DICT[x.trim()])) return true;
  return patternList.some(([re]) => re.test(k));
}

let bad = 0;
let jsReview = 0;
console.log('=== HTML 静态文案 ===');
for (const f of fs.readdirSync(PUBLIC).filter((x) => x.endsWith('.html')).sort()) {
  const c = fs.readFileSync(path.join(PUBLIC, f), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = (c.match(/>([^<>]+)</g) || []).map((x) => x.slice(1, -1).trim()).filter(hasCN);
  const attrs = (c.match(/(?:placeholder|title|aria-label|alt)="[^"]*"/g) || []).map((x) => x.replace(/^[a-z-]+="/, '').replace(/"$/, '').trim()).filter(hasCN);
  const miss = [...new Set(texts.concat(attrs))].filter((s) => !covered(s));
  bad += miss.length;
  console.log((miss.length ? '⚠️  ' : '✅  ') + f.padEnd(20) + (miss.length ? '未覆盖 ' + miss.length + ': ' + miss.join(' | ') : 'OK'));
}

console.log('\n=== 前端 JS 字面量（可能含模板片段，需人工判断）===');
for (const f of fs.readdirSync(path.join(PUBLIC, 'js')).filter((x) => x.endsWith('.js') && !x.includes('min') && x !== 'i18n.js').sort()) {
  const c = fs.readFileSync(path.join(PUBLIC, 'js', f), 'utf8');
  const lits = c.match(/'[^'\n]*[\u4e00-\u9fa5][^'\n]*'|"[^"\n]*[\u4e00-\u9fa5][^"\n]*"|`[^`]*[\u4e00-\u9fa5][^`]*`/g) || [];
  const uniq = [...new Set(lits.map((x) => x.slice(1, -1)))];
  // 过滤掉模板片段/HTML/正则等噪声，只留可能出现在界面上的纯文案
  // 过滤掉模板片段/HTML/正则等噪声，只留可能出现在界面上的纯文案
  const NOISE = ['${', '<', '>', '=>', 'classList', 'querySelector', 'getElementById', 'toDataURL', '.test(', 'match(', 'localStorage', 'dataset', 'addEventListener', 'innerHTML'];
  const isNoise = (s) => !s.trim() || NOISE.some((t) => s.includes(t)) || /^[\s;)}]+$/.test(s);
  const miss = uniq.filter((s) => !covered(s) && !isNoise(s));
  if (miss.length) { jsReview += miss.length; console.log('⚠️  ' + f + '（' + miss.length + ' 条）'); miss.slice(0, 10).forEach((s) => console.log('     · ' + s.replace(/\s+/g, ' ').slice(0, 90))); }
  else console.log('✅  ' + f);
}

console.log('\n' + (bad === 0 ? '🎉 HTML 静态文案：全部覆盖（仅备案号保留中文）' : '❌ HTML 静态文案：' + bad + ' 条未覆盖，请补充字典'));
if (jsReview) console.log('ℹ️  JS 字面量：' + jsReview + ' 条待人工确认（多为中文分支/拼接片段，非实际漏网）');
process.exit(bad === 0 ? 0 : 1);
