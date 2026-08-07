'use strict';
/** 自动识别「待上传图片」照片 v2：支持更多照片/根目录编号图/文件名前缀城市 */
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
      if (ent.isDirectory()) walk(full, /更多/.test(ent.name) ? cityHint : ent.name);
      else if (/\.(jpe?g|png|webp)$/i.test(ent.name)) items.push({ city: cityHint, file: ent.name, full, inMore: /更多/.test(path.basename(dir)) });
    }
  })(SRC, null);

  // 按城市分组（用于根目录编号图→画廊）
  const byCity = {};
  for (const it of items) { (byCity[it.city || ''] = byCity[it.city || ''] || []).push(it); }

  for (const it of items) {
    let dest = dests.find(d => d.name === it.city || d.id === it.city);
    if (!dest && it.city) dest = dests.find(d => d.name.includes(it.city) || it.city.includes(d.name));
    // 根目录文件：文件名前缀=城市（如 苏州封面.jpg）
    if (!dest && !it.city) {
      const b = it.file;
      dest = dests.find(d => b.startsWith(d.name) || b.startsWith(d.id));
    }
    if (!dest) { unmatched.push(it.full.replace(SRC, '')); continue; }

    const base = path.basename(it.file, path.extname(it.file));
    let slot = null;
    if (it.inMore) {
      const siblings = fs.readdirSync(path.dirname(it.full)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
      const idx = siblings.indexOf(it.file);
      if (idx >= 0 && idx < 4) slot = 'gallery-' + (idx + 1);
    } else if (/封面|背景/.test(base)) {
      slot = 'cover';
    } else if (/^更多/.test(base)) {
      // 文件名带"更多"(如 更多照片3.jpg) → 画廊
      const m = base.match(/(\d+)/);
      const idx = m ? parseInt(m[1], 10) - 1 : 0;
      if (idx >= 0 && idx < 4) slot = 'gallery-' + (idx + 1);
    } else {
      const nb = norm(base.replace(new RegExp('^' + norm(dest.name)), '')); // 去掉城市名前缀
      for (let i = 0; i < (dest.highlights || []).length; i++) {
        const t = norm(dest.highlights[i].title);
        if (t && (t.includes(nb) || nb.includes(t))) { slot = 'hl-' + (i + 1); break; }
      }
    }
    // 根目录编号图（如 万宁/1.jpg）→ 画廊
    if (!slot && !it.inMore && /^\d+$/.test(base)) {
      const siblings = (byCity[it.city] || []).filter(x => /^\d+\.(jpe?g|png|webp)$/i.test(x.file)).map(x => x.file).sort();
      const idx = siblings.indexOf(it.file);
      if (idx >= 0 && idx < 4) slot = 'gallery-' + (idx + 1);
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