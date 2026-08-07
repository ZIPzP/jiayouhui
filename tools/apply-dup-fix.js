'use strict';
/** 应用去重替换：把重复的图片文件换成该城市图库中未使用过的照片 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MAP = path.join(ROOT, 'tools', (process.argv[2] || 'dup-fix.json'));
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
  const fix = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const tasks = [];
  let ok = 0;
  for (const [key, src] of Object.entries(fix)) {
    const idx = key.indexOf('/');
    const city = key.slice(0, idx);
    const file = key.slice(idx + 1);
    const dest = data.destinations.find(x => x.id === city);
    if (!dest) continue;
    const filePath = path.join(IMG, city, file);
    tasks.push({
      label: key,
      fn: async () => {
        const w = file.startsWith('gallery-') ? 1200 : (file.startsWith('hl-') ? 1000 : 1600);
        await download(resizeUrl(src, w), filePath);
        const rel = `/images/${city}/${file}`;
        if (file === 'cover.jpg') dest.cover = rel;
        else if (file.startsWith('gallery-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; dest.gallery[i] = rel; }
        else if (file.startsWith('hl-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; if (dest.highlights[i]) dest.highlights[i].image = rel; }
        ok++;
        process.stdout.write(`  ${key} ok\n`);
      }
    });
  }
  let idx2 = 0;
  const workers = Array.from({ length: Math.min(CONC, tasks.length) }, async () => {
    while (idx2 < tasks.length) {
      const t = tasks[idx2++];
      try { await t.fn(); } catch (e) { console.log(`  [${t.label}] ${e.message}`); }
    }
  });
  await Promise.all(workers);
  writeJsonSafe(DATA, data);
  console.log('完成：去重替换 ' + ok + ' 张');
})();