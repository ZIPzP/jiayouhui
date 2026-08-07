'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PLAN = path.join(ROOT, 'tools', 'batch2-fix.json');
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
    return true;
  } catch (e) { return false; } finally { clearTimeout(t); }
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
  for (const [key, src] of Object.entries(plan)) {
    if (key === 'show') continue;
    const [city, file] = key.split('/');
    const dest = data.destinations.find(x => x.id === city);
    const ok = await download(resizeUrl(src, file === 'cover.jpg' ? 1600 : 1000), path.join(IMG, city, file));
    if (!ok) { console.log('skip', key); continue; }
    const rel = `/images/${city}/${file}`;
    if (file === 'cover.jpg') dest.cover = rel;
    else if (file.startsWith('gallery-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; dest.gallery[i] = rel; }
    else if (file.startsWith('hl-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; dest.highlights[i].image = rel; }
    console.log('applied', key);
  }
  writeJsonSafe(DATA, data);
  const groups = {
    "quanzhou_temple": plan.show.quanzhou_temple,
    "fuzhou_cover": plan.show.fuzhou_cover,
    "shantou_arcade": plan.show.shantou_arcade,
    "shantou_island": plan.show.shantou_island,
    "yantai_cover": plan.show.yantai_cover
  };
  for (const [g, srcs] of Object.entries(groups)) {
    for (let i = 0; i < srcs.length; i++) {
      await download(resizeUrl(srcs[i], 900), path.join(SHOW, `${g}-候选${i + 1}.jpg`));
    }
  }
  console.log('candidates saved');
})();