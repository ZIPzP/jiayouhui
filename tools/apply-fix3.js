'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'tools', 'fix3spots.json');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');
const SHOW = 'C:/Users/34968/.codex/visualizations/2026/08/06/019fd604-2234-7992-a816-1a2f472d16ea';
const UA = 'Mozilla/5.0 Chrome/124.0';

function resizeUrl(src, w) {
  let u = String(src || '');
  u = u.replace(/([?&])w=\d+/i, `$1w=${w}`).replace(/([?&])q=\d+/i, '$1q=80');
  if (!u.includes('?')) u += '?fm=jpg&q=80&w=' + w + '&auto=format&fit=crop';
  return u;
}
async function download(url, file) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 5000) throw new Error('too small');
    fs.writeFileSync(file, buf);
    return buf.length;
  } finally { clearTimeout(t); }
}
function writeJsonSafe(file, obj) {
  for (let i = 0; i < 6; i++) {
    try { fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); return; }
    catch (e) { if (i === 5) throw e; }
    const wait = new Promise((r) => setTimeout(r, 800));
    return wait.then(() => writeJsonSafe(file, obj));
  }
}

(async () => {
  const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  // 1) 应用替换（覆盖 hl 文件 + 更新数据）
  for (const [key, src] of Object.entries(plan.apply)) {
    const [city, file] = key.split('/');
    const dest = data.destinations.find(x => x.id === city);
    if (!dest) continue;
    const filePath = path.join(IMG, city, file);
    await download(resizeUrl(src, 1000), filePath);
    const i = parseInt(file.match(/\d+/)[0], 10) - 1;
    dest.highlights[i].image = `/images/${city}/${file}`;
    console.log('applied', key);
  }
  writeJsonSafe(DATA, data);
  // 2) 候选图保存到展示目录
  for (const [group, srcs] of Object.entries(plan.show)) {
    for (let i = 0; i < srcs.length; i++) {
      await download(resizeUrl(srcs[i], 900), path.join(SHOW, `${group}-候选${i + 1}.jpg`));
    }
    console.log('saved', group, srcs.length);
  }
  console.log('done');
})();