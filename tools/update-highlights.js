'use strict';
/** 用景点英文名搜索到的真实照片更新每个城市的「亮点图片」（覆盖 hl-*.jpg） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MAP = path.join(ROOT, 'tools', 'spot-map.json');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';
const CONC = 6;

function resizeUrl(src, w) {
  let u = String(src || '');
  u = u.replace(/([?&])w=\d+/i, `$1w=${w}`).replace(/([?&])q=\d+/i, '$1q=80');
  if (!u.includes('?')) u += '?fm=jpg&q=80&w=' + w + '&auto=format&fit=crop';
  return u;
}
async function download(url, file) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
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
    const wait = new Promise((r) => setTimeout(r, 800 + i * 500));
    return wait.then(() => writeJsonSafe(file, obj));
  }
}

(async () => {
  const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const tasks = [];
  const credits = [];
  for (const dest of data.destinations) {
    const hls = map[dest.id] || [];
    if (!hls.length) continue;
    (dest.highlights || []).forEach((h, i) => {
      const src = hls[i];
      if (!src || !src.src) return;
      const file = path.join(IMG, dest.id, `hl-${i + 1}.jpg`);
      tasks.push({
        label: dest.name + ' hl-' + (i + 1),
        fn: async () => {
          const url = resizeUrl(src.src, 1000);
          const size = await download(url, file);
          dest.highlights[i].image = `/images/${dest.id}/hl-${i + 1}.jpg`;
          credits.push({ name: dest.name, title: (src.alt || '').slice(0, 60), url: src.src.split('?')[0] });
          process.stdout.write(`  ${dest.name} hl-${i + 1} (${(size / 1024).toFixed(0)}KB)\n`);
        }
      });
    });
  }
  let idx = 0;
  const workers = Array.from({ length: Math.min(CONC, tasks.length) }, async () => {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      try { await t.fn(); } catch (e) { console.log(`  [${t.label}] ${e.message}`); }
    }
  });
  await Promise.all(workers);
  writeJsonSafe(DATA, data);
  const lines = ['# 亮点图片（景点英文名搜索，Unsplash）', ''];
  for (const c of credits) lines.push(`- ${c.name}：${c.title} — ${c.url}`);
  fs.writeFileSync(path.join(IMG, 'CREDITS-HIGHLIGHTS.md'), lines.join('\n'), 'utf8');
  console.log('完成，更新亮点图片 ' + credits.length + ' 张');
})();