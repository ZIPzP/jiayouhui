'use strict';
/** 应用「英语重检索+去重」的亮点图（覆盖 hl-*.jpg） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const MAP = path.join(ROOT, 'tools', 'highlights-redo.json');
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
  const rmap = JSON.parse(fs.readFileSync(MAP, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const tasks = [];
  let ok = 0;
  for (const dest of data.destinations) {
    const picks = rmap[dest.id];
    if (!picks) continue;
    (dest.highlights || []).forEach((h, i) => {
      const src = picks[i];
      if (!src) return;
      const file = path.join(IMG, dest.id, `hl-${i + 1}.jpg`);
      tasks.push({
        label: dest.name + ' hl-' + (i + 1),
        fn: async () => {
          const url = resizeUrl(src, 1000);
          await download(url, file);
          dest.highlights[i].image = `/images/${dest.id}/hl-${i + 1}.jpg`;
          ok++;
          process.stdout.write(`  ${dest.name} hl-${i + 1} ok\n`);
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
  console.log('完成：替换亮点 ' + ok + ' 张');
})();