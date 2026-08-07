'use strict';
/**
 * 从 images.unsplash.com CDN 下载真实匹配照片（并发 + 断点续传），
 * 每完成一个目的地即写回 data/destinations.json。
 * 用法：node tools/download-images.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAP_FILE = path.join(ROOT, 'tools', 'unsplash-map.json');
const DATA_FILE = path.join(ROOT, 'data', 'destinations.json');
const IMG_DIR = path.join(ROOT, 'public', 'images');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const CONCURRENCY = 8;

const WIDTHS = { cover: 1600, gallery: 1200, highlight: 800 };

function resizeUrl(src, w) {
  let u = String(src || '');
  if (!u) return u;
  u = u.replace(/([?&])w=\d+/i, `$1w=${w}`);
  u = u.replace(/([?&])q=\d+/i, '$1q=80');
  if (!u.includes('?')) u += '?fm=jpg&q=80&w=' + w + '&auto=format&fit=crop';
  return u;
}

async function download(url, filePath) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const resp = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 5000) throw new Error(`文件过小(${buf.length}B)`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buf);
    return buf.length;
  } finally {
    clearTimeout(timer);
  }
}

function exists(file) {
  try { return fs.statSync(file).size > 5000; } catch { return false; }
}

/** 安全写 JSON：遇锁重试 */
function writeJsonSafe(file, obj) {
  for (let i = 0; i < 6; i++) {
    try {
      fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
      return;
    } catch (e) {
      if (i === 5) throw e;
      const wait = new Promise((r) => setTimeout(r, 800 + i * 500));
      return wait.then(() => writeJsonSafe(file, obj));
    }
  }
}

async function main() {
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const credits = [];
  const report = [];
  let total = 0;

  // 并行下载器
  async function runPool(tasks) {
    let i = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, async () => {
      while (i < tasks.length) {
        const t = tasks[i++];
        try { await t.fn(); } catch (e) { console.log(`  [${t.label}] ${e.message}`); }
      }
    });
    await Promise.all(workers);
  }

  for (const dest of data.destinations) {
    const m = map[dest.id];
    if (!m) { report.push(`${dest.name}: 无映射，跳过`); continue; }
    const dir = path.join(IMG_DIR, dest.id);
    fs.mkdirSync(dir, { recursive: true });

    const plan = [];
    const push = (item, name, width, role) => {
      if (!item || !item.src) return;
      const file = path.join(dir, name);
      if (exists(file)) { plan.push({ file, role, done: true }); return; }
      plan.push({
        file, role, done: false,
        fn: async () => {
          const url = resizeUrl(item.src, width);
          const size = await download(url, file);
          credits.push({ name: dest.name, role, alt: item.alt || '', url: item.src.split('?')[0] });
          total++;
          process.stdout.write(`  ${dest.name} ${name} (${(size / 1024).toFixed(0)}KB)\n`);
        }
      });
    };

    push(m.cover, 'cover.jpg', WIDTHS.cover, '封面');
    m.gallery.forEach((g, i) => push(g, `gallery-${i + 1}.jpg`, WIDTHS.gallery, `画廊${i + 1}`));
    m.highlights.forEach((h, i) => push(h, `hl-${i + 1}.jpg`, WIDTHS.highlight, `亮点${i + 1}`));

    const newPlan = plan.filter((p) => !p.done);
    await runPool(newPlan);

    // 写回该目的地（已存在则直接用本地路径）
    if (exists(path.join(dir, 'cover.jpg'))) dest.cover = `/images/${dest.id}/cover.jpg`;
    const gList = [];
    for (let i = 0; i < 4; i++) { if (exists(path.join(dir, `gallery-${i + 1}.jpg`))) gList.push(`/images/${dest.id}/gallery-${i + 1}.jpg`); }
    if (gList.length) dest.gallery = gList;
    let hlCount = 0;
    for (let i = 0; i < dest.highlights.length && i < m.highlights.length; i++) {
      const f = path.join(dir, `hl-${i + 1}.jpg`);
      if (exists(f)) { dest.highlights[i].image = `/images/${dest.id}/hl-${i + 1}.jpg`; hlCount++; }
    }

    writeJsonSafe(DATA_FILE, data); // 增量保存（带重试）
    report.push(`${dest.name}: cover=${dest.cover.startsWith('/images/') ? 'OK' : 'FAIL'} gallery=${gList.length} highlights=${hlCount}`);
  }

  const lines = [
    '# 图片来源', '',
    '页面图片来自 Unsplash（https://unsplash.com）免费商用授权照片，按 Unsplash License 使用，无需署名。以下为方便追溯保留的原图地址：', ''
  ];
  for (const c of credits) {
    lines.push(`- **${c.name}（${c.role}）**：${c.alt || '（无描述）'} — ${c.url}`);
  }
  fs.writeFileSync(path.join(IMG_DIR, 'CREDITS.md'), lines.join('\n'), 'utf8');

  console.log('==== 下载报告 ====');
  report.forEach((r) => console.log(r));
  console.log(`本次新下载 ${total} 张（复用已存在 ${credits.length - total} 张）`);
}

main().catch((e) => { console.error('执行失败:', e); process.exit(1); });