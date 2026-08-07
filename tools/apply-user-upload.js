'use strict';
/** 自动识别「待上传图片」里的用户照片：文件夹=城市，文件名=景点/封面/画廊 */
const fs = require('fs');
const path = require('path');
const ROOT = 'D:\\家庭旅游篇';
const SRC = path.join(ROOT, '待上传图片');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');

function writeJsonSafe(file, obj) {
  for (let i = 0; i < 6; i++) {
    try { fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); return; }
    catch (e) { if (i === 5) throw e; }
    const wait = new Promise((r) => setTimeout(r, 800));
    return wait.then(() => writeJsonSafe(file, obj));
  }
}
function norm(s) { return String(s || '').replace(/[·.·•]/g, '').replace(/\s+/g, '').toLowerCase(); }

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dests = data.destinations;
  const applied = [];
  const unmatched = [];
  const items = [];
  (function walk(dir, cityHint) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, ent.name === '更多图片' ? cityHint : ent.name);
      else if (/\.(jpe?g|png|webp)$/i.test(ent.name)) items.push({ city: cityHint, file: ent.name, full, inMore: path.basename(dir) === '更多图片' });
    }
  })(SRC, null);

  for (const it of items) {
    let dest = dests.find(d => d.name === it.city || d.id === it.city);
    if (!dest) dest = dests.find(d => it.city && (d.name.includes(it.city) || it.city.includes(d.name)));
    if (!dest) { unmatched.push(it.full.replace(SRC, '')); continue; }
    const base = path.basename(it.file, path.extname(it.file));
    let slot = null;
    if (it.inMore) {
      const siblings = fs.readdirSync(path.dirname(it.full)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
      const idx = siblings.indexOf(it.file);
      if (idx >= 0 && idx < 4) slot = 'gallery-' + (idx + 1);
    } else if (/封面|背景/.test(base)) {
      slot = 'cover';
    } else {
      const nb = norm(base);
      for (let i = 0; i < (dest.highlights || []).length; i++) {
        const t = norm(dest.highlights[i].title);
        if (t && (t.includes(nb) || nb.includes(t))) { slot = 'hl-' + (i + 1); break; }
      }
    }
    if (!slot) { unmatched.push(it.full.replace(SRC, '')); continue; }
    const ext = path.extname(it.file).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg') { unmatched.push(it.full.replace(SRC, '') + ' (需jpg)'); continue; }
    const dir = path.join(IMG, dest.id);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, slot + '.jpg');
    fs.copyFileSync(it.full, target);
    const rel = `/images/${dest.id}/${slot}.jpg`;
    if (slot === 'cover') dest.cover = rel;
    else if (slot.startsWith('gallery-')) { const i = parseInt(slot.match(/\d+/)[0], 10) - 1; dest.gallery[i] = rel; }
    else if (slot.startsWith('hl-')) { const i = parseInt(slot.match(/\d+/)[0], 10) - 1; if (dest.highlights[i]) dest.highlights[i].image = rel; }
    applied.push(`${dest.name} ${slot}  <- ${it.full.replace(SRC, '')}`);
  }
  writeJsonSafe(DATA, data);
  console.log('=== 已替换 ===');
  applied.forEach(a => console.log('  ' + a));
  console.log('=== 未能识别 ===');
  if (unmatched.length) unmatched.forEach(u => console.log('  ' + u)); else console.log('  （无）');
  console.log('替换总数: ' + applied.length);
})();