'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'tools', 'mq-fix.json');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');
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
  const src = plan.show.xian_muslim[1]; // 候选2
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dest = data.destinations.find(x => x.id === 'xian');
  await download(resizeUrl(src, 1000), path.join(IMG, 'xian', 'hl-3.jpg'));
  dest.highlights[2].image = '/images/xian/hl-3.jpg';
  writeJsonSafe(DATA, data);
  console.log('applied 回民街 候选2');
})();