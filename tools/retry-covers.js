'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'tools', 'batch2-fix.json');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');
const UA = 'Mozilla/5.0 Chrome/124.0';
function resizeUrl(src, w) {
  let u = String(src || '');
  u = u.replace(/([?&])w=\d+/i, `$1w=${w}`).replace(/([?&])q=\d+/i, '$1q=80');
  if (!u.includes('?')) u += '?fm=jpg&q=80&w=' + w + '&auto=format&fit=crop';
  return u;
}
async function tryDownload(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 5000) return null;
    return buf;
  } catch { return null; } finally { clearTimeout(t); }
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
  const jobs = [
    { city: 'fuzhou', file: 'cover.jpg', srcs: plan.show.fuzhou_cover },
    { city: 'yantai', file: 'cover.jpg', srcs: plan.show.yantai_cover }
  ];
  for (const j of jobs) {
    const dest = data.destinations.find(x => x.id === j.city);
    for (const src of j.srcs) {
      const buf = await tryDownload(resizeUrl(src, 1600));
      if (buf) {
        fs.writeFileSync(path.join(IMG, j.city, j.file), buf);
        dest.cover = `/images/${j.city}/${j.file}`;
        console.log('applied', j.city + '/' + j.file);
        break;
      }
    }
  }
  writeJsonSafe(DATA, data);
  console.log('done');
})();