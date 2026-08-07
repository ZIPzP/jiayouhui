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
  const srcs = plan.show.fuzhou_cover; // 福州城市图
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dest = data.destinations.find(x => x.id === 'fuzhou');
  const jobs = [ ['hl-2.jpg', srcs[1]], ['hl-3.jpg', srcs[2]] ];
  for (const [file, src] of jobs) {
    const buf = await tryDownload(resizeUrl(src, 1000));
    if (buf) {
      fs.writeFileSync(path.join(IMG, 'fuzhou', file), buf);
      const i = parseInt(file.match(/\d+/)[0], 10) - 1;
      dest.highlights[i].image = `/images/fuzhou/${file}`;
      console.log('applied fuzhou/' + file);
    }
  }
  writeJsonSafe(DATA, data);
})();