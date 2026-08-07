'use strict';
/** 应用"已核实"照片：仅替换 verified-map 中有可核实来源的封面/画廊/亮点（其余保留现状，不空白） */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const VMAP = path.join(ROOT, 'tools', 'verified-map.json');
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
  const vmap = JSON.parse(fs.readFileSync(VMAP, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const tasks = [];
  let applied = { cover: 0, gallery: 0, hl: 0 };
  for (const dest of data.destinations) {
    const v = vmap[dest.id];
    if (!v) continue;
    const dir = path.join(IMG, dest.id);
    // 封面
    if (v.cover) {
      tasks.push({ label: dest.name + ' cover', fn: async () => { await download(resizeUrl(v.cover, 1600), path.join(dir, 'cover.jpg')); dest.cover = `/images/${dest.id}/cover.jpg`; applied.cover++; } });
    }
    // 画廊
    if (Array.isArray(v.gallery) && v.gallery.length) {
      const gs = v.gallery.slice(0, 4);
      for (let i = 0; i < gs.length; i++) {
        (function (src, idx) {
          tasks.push({ label: dest.name + ' gal-' + (idx + 1), fn: async () => { await download(resizeUrl(src, 1200), path.join(dir, `gallery-${idx + 1}.jpg`)); dest.gallery[idx] = `/images/${dest.id}/gallery-${idx + 1}.jpg`; applied.gallery++; } });
        })(gs[i], i);
      }
    }
    // 亮点
    if (Array.isArray(v.highlights)) {
      for (let i = 0; i < v.highlights.length; i++) {
        const src = v.highlights[i];
        if (!src) continue;
        (function (src, idx) {
          tasks.push({ label: dest.name + ' hl-' + (idx + 1), fn: async () => { await download(resizeUrl(src, 1000), path.join(dir, `hl-${idx + 1}.jpg`)); dest.highlights[idx].image = `/images/${dest.id}/hl-${idx + 1}.jpg`; applied.hl++; } });
        })(src, i);
      }
    }
  }
  let idx = 0;
  const workers = Array.from({ length: Math.min(CONC, tasks.length) }, async () => {
    while (idx < tasks.length) {
      const t = tasks[idx++];
      try { await t.fn(); process.stdout.write(`  ${t.label} ok\n`); } catch (e) { console.log(`  [${t.label}] ${e.message}`); }
    }
  });
  await Promise.all(workers);
  writeJsonSafe(DATA, data);
  console.log('完成：封面 ' + applied.cover + '，画廊 ' + applied.gallery + '，亮点 ' + applied.hl);
})();