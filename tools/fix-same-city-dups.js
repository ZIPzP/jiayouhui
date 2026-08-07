'use strict';
/** 同城去重终极版：下载候选图后校验哈希，与同城其他图重复就换下一张，直到真正唯一 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'public', 'images');
const DATA = path.join(ROOT, 'data', 'destinations.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36';

function hashOf(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
function resizeUrl(src, w) {
  let u = String(src || '');
  u = u.replace(/([?&])w=\d+/i, `$1w=${w}`).replace(/([?&])q=\d+/i, '$1q=80');
  if (!u.includes('?')) u += '?fm=jpg&q=80&w=' + w + '&auto=format&fit=crop';
  return u;
}
async function tryDownload(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
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
    const wait = new Promise((r) => setTimeout(r, 800 + i * 500));
    return wait.then(() => writeJsonSafe(file, obj));
  }
}

(async () => {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const poolFile = path.join(ROOT, 'tools', 'pools-dump.json');
  const pools = JSON.parse(fs.readFileSync(poolFile, 'utf8')); // { city: [src,...] }

  let fixed = 0;
  for (const dest of data.destinations) {
    const city = dest.id;
    const dir = path.join(IMG, city);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(n => n.endsWith('.jpg'));
    // 同城分组
    const groups = new Map();
    for (const f of files) {
      const h = hashOf(path.join(dir, f));
      if (!groups.has(h)) groups.set(h, []);
      groups.get(h).push(f);
    }
    const cands = (pools[city] || []).filter((s, i, a) => a.indexOf(s) === i);
    for (const [h, flist] of groups) {
      if (flist.length < 2) continue;
      // 保留第一个，其余替换
      for (let k = 1; k < flist.length; k++) {
        const file = flist[k];
        const w = file.startsWith('gallery-') ? 1200 : (file.startsWith('hl-') ? 1000 : 1600);
        let done = false;
        for (const src of cands) {
          const buf = await tryDownload(resizeUrl(src, w));
          if (!buf) continue;
          const tmp = dir + '/.tmp';
          fs.writeFileSync(tmp, buf);
          const h2 = hashOf(tmp);
          // 与同城所有其他文件都不重复
          const others = files.filter(f2 => f2 !== file).map(f2 => path.join(dir, f2));
          const clash = others.some(o => fs.existsSync(o) && hashOf(o) === h2);
          if (!clash) {
            fs.writeFileSync(path.join(dir, file), buf);
            fs.unlinkSync(tmp);
            // 更新数据
            const rel = `/images/${city}/${file}`;
            if (file === 'cover.jpg') dest.cover = rel;
            else if (file.startsWith('gallery-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; dest.gallery[i] = rel; }
            else if (file.startsWith('hl-')) { const i = parseInt(file.match(/\d+/)[0], 10) - 1; if (dest.highlights[i]) dest.highlights[i].image = rel; }
            process.stdout.write(`  ${city}/${file} 已换唯一图\n`);
            fixed++;
            done = true;
            break;
          }
        }
        if (!done) console.log(`  ${city}/${file} 图池无唯一候选，保留`);
      }
    }
  }
  writeJsonSafe(DATA, data);
  console.log('完成：替换 ' + fixed + ' 张');
})();