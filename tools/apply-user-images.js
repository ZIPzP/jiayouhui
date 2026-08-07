'use strict';
/** 自动应用「待上传图片」文件夹里的用户照片到对应城市/槽位 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '待上传图片');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const IMG = path.join(ROOT, 'public', 'images');

const SLOT_KEYWORDS = {
  '封面': 'cover',
  '亮点1': 'hl-1', '亮点一': 'hl-1',
  '亮点2': 'hl-2', '亮点二': 'hl-2',
  '亮点3': 'hl-3', '亮点三': 'hl-3',
  '画廊1': 'gallery-1', '画廊一': 'gallery-1',
  '画廊2': 'gallery-2', '画廊二': 'gallery-2',
  '画廊3': 'gallery-3', '画廊三': 'gallery-3',
  '画廊4': 'gallery-4', '画廊四': 'gallery-4'
};

function writeJsonSafe(file, obj) {
  for (let i = 0; i < 6; i++) {
    try { fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); return; }
    catch (e) { if (i === 5) throw e; }
    const wait = new Promise((r) => setTimeout(r, 800));
    return wait.then(() => writeJsonSafe(file, obj));
  }
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const dests = data.destinations;
  const applied = [];
  const skipped = [];
  const files = fs.readdirSync(SRC).filter(f => /\.(jpe?g|png|webp)$/i.test(f) && !f.startsWith('说明'));
  for (const f of files) {
    const base = path.basename(f, path.extname(f));
    // 去掉常见后缀
    const cleaned = base.replace(/[（(]?[0-9]+张?[）)]?$/, '').trim();
    // 用亮点名/城市名匹配
    let match = null;
    // 优先：城市+槽位（-分割）
    const dash = base.split(/[-—–_]/);
    if (dash.length >= 2) {
      const cityName = dash[0].trim();
      const rest = dash.slice(1).join('-');
      let slot = null;
      for (const [k, v] of Object.entries(SLOT_KEYWORDS)) { if (rest.includes(k)) { slot = v; break; } }
      const city = dests.find(d => d.name === cityName || d.id === cityName);
      if (city && slot) match = { city, slot, f };
      else if (city && !slot) match = { city, slot: 'cover', f };
    }
    if (!match) {
      // 城市名（或亮点名→默认封面）
      const city = dests.find(d => base.includes(d.name)) || dests.find(d => d.name === cleaned);
      if (city) match = { city, slot: 'cover', f };
    }
    if (!match) { skipped.push(f); continue; }
    const dir = path.join(IMG, match.city.id);
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, match.slot + '.jpg');
    fs.copyFileSync(path.join(SRC, f), target);
    const rel = `/images/${match.city.id}/${match.slot}.jpg`;
    if (match.slot === 'cover') match.city.cover = rel;
    else if (match.slot.startsWith('gallery-')) { const i = parseInt(match.slot.match(/\d+/)[0], 10) - 1; match.city.gallery[i] = rel; }
    else if (match.slot.startsWith('hl-')) { const i = parseInt(match.slot.match(/\d+/)[0], 10) - 1; match.city.highlights[i].image = rel; }
    applied.push(`${match.city.name} ${match.slot}  <- ${f}`);
  }
  writeJsonSafe(DATA, data);
  console.log('已替换:');
  applied.forEach(a => console.log('  ' + a));
  if (skipped.length) { console.log('未能识别（请改名或告诉我映射）:'); skipped.forEach(s => console.log('  ' + s)); }
})();