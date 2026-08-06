'use strict';
/**
 * 真实地点图片抓取工具
 * 数据源：Wikimedia Commons 官方开放 API（免 Key、免费授权，需附 User-Agent）
 * 注意：大陆网络可能无法访问 Wikimedia（本环境实测不可达），推荐使用 tools/download-images.js（Unsplash 流程）。
 * 功能：按中文地名搜索真实照片 -> 下载到 public/images/<目的地>/ -> 更新 data/destinations.json
 *
 * 用法：node tools/fetch-images.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'destinations.json');
const IMG_DIR = path.join(ROOT, 'public', 'images');
const UA = 'JiayouhuiFamilyTravel/0.1 (personal travel demo; fetching freely-licensed images only)';

// 每个目的地的搜索词（按优先级：封面 / 画廊 / 亮点）
const SEARCH = {
  beijing:    { cover: ['八达岭长城'],  gallery: ['北京故宫', '天坛'],            highlights: ['北京故宫', '八达岭长城', '天坛'] },
  hangzhou:   { cover: ['杭州西湖'],    gallery: ['杭州 断桥', '杭州 龙井'],       highlights: ['杭州西湖', '龙井茶园', '灵隐寺'] },
  sanya:      { cover: ['三亚 亚龙湾'], gallery: ['三亚湾', '蜈支洲岛'],           highlights: ['三亚 亚龙湾', '蜈支洲岛', '三亚 南山寺'] },
  chengdu:    { cover: ['成都大熊猫繁育研究基地'], gallery: ['成都 人民公园', '成都 宽窄巷子'], highlights: ['成都大熊猫繁育研究基地', '成都 人民公园', '成都 宽窄巷子'] },
  guilin:     { cover: ['桂林 漓江'],   gallery: ['阳朔 遇龙河', '阳朔西街'],      highlights: ['桂林 漓江', '阳朔 遇龙河', '阳朔西街'] },
  xian:       { cover: ['秦始皇兵马俑'], gallery: ['西安城墙', '西安 回民街'],     highlights: ['秦始皇兵马俑', '西安城墙', '西安 回民街'] },
  zhangjiajie:{ cover: ['张家界'],      gallery: ['张家界 袁家界', '张家界 金鞭溪'], highlights: ['张家界 袁家界', '张家界 天子山', '张家界 金鞭溪'] },
  qingdao:    { cover: ['青岛 栈桥'],   gallery: ['青岛 八大关', '青岛啤酒博物馆'], highlights: ['青岛 栈桥', '青岛 八大关', '青岛啤酒博物馆'] },
  lijiang:    { cover: ['丽江古城'],    gallery: ['玉龙雪山', '丽江 拉市海'],      highlights: ['丽江古城', '玉龙雪山', '拉市海'] },
  shanghai:   { cover: ['上海外滩'],    gallery: ['上海博物馆', '上海豫园'],       highlights: ['上海外滩', '上海博物馆', '上海豫园'] },
  dali:       { cover: ['洱海'],        gallery: ['大理古城', '苍山 大理'],        highlights: ['洱海', '大理古城', '苍山 大理'] },
  chongqing:  { cover: ['重庆 洪崖洞'], gallery: ['重庆 长江索道', '重庆 磁器口'],  highlights: ['重庆 洪崖洞', '重庆 长江索道', '重庆 磁器口'] }
};

const BAD_WORDS = ['logo', 'map', 'flag', 'seal', 'icon', 'coat', 'diagram', 'locator', 'skyline vector', 'emblem', 'stamp', 'sign', 'plan'];

function extOk(title) {
  return /\.(jpe?g|png|webp)$/i.test(title);
}
function badTitle(title) {
  const t = title.toLowerCase();
  return BAD_WORDS.some((w) => t.includes(w));
}

/** 搜索 Commons，返回按质量排序的候选列表 */
async function searchCommons(query, width) {
  const api = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: String(width),
    format: 'json',
    origin: '*'
  });
  const resp = await fetch(`${api}?${params}`, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(`Commons API HTTP ${resp.status}`);
  const data = await resp.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const cands = [];
  for (const p of pages) {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || !extOk(p.title) || badTitle(p.title)) continue;
    const w = ii.width || 0;
    const h = ii.height || 0;
    if (w < 800 || h < 500) continue;
    const ratio = w / h;
    // 偏好横向、接近目标宽度、足够大的图
    let score = 0;
    if (ratio >= 1.1 && ratio <= 2.6) score += 30;
    if (w >= width) score += 20;
    score += Math.min(30, w / 100);
    if (/\.jpe?g$/i.test(p.title)) score += 10;
    cands.push({ title: p.title, url: ii.url, thumb: ii.thumburl || ii.url, width: w, height: h, score,
      artist: ii.extmetadata?.Artist?.value || '', license: ii.extmetadata?.LicenseShortName?.value || '',
      descUrl: ii.descriptionurl || '' });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands;
}

async function download(url, filePath) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const resp = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA } });
    if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buf);
    return buf.length;
  } finally {
    clearTimeout(timer);
  }
}

function pick(cands) {
  return cands[0] || null;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const credits = [];
  const report = [];

  for (const dest of data.destinations) {
    const cfg = SEARCH[dest.id];
    if (!cfg) { report.push(`${dest.name}: 无搜索配置，跳过`); continue; }
    const dir = path.join(IMG_DIR, dest.id);
    fs.mkdirSync(dir, { recursive: true });
    const got = { cover: null, gallery: [], highlights: [] };

    // 封面（宽度 1600）
    try {
      const c = pick(await searchCommons(cfg.cover[0], 1600));
      if (c) { got.cover = c; }
    } catch (e) { report.push(`${dest.name} 封面搜索失败: ${e.message}`); }

    // 画廊（宽度 1200）
    for (let i = 0; i < cfg.gallery.length && i < 3; i++) {
      try {
        const c = pick(await searchCommons(cfg.gallery[i], 1200));
        if (c) got.gallery.push(c);
      } catch (e) { report.push(`${dest.name} 画廊${i + 1}搜索失败: ${e.message}`); }
    }

    // 亮点（宽度 1000）
    for (let i = 0; i < dest.highlights.length && i < cfg.highlights.length; i++) {
      try {
        const c = pick(await searchCommons(cfg.highlights[i], 1000));
        if (c) got.highlights.push(c);
      } catch (e) { report.push(`${dest.name} 亮点${i + 1}搜索失败: ${e.message}`); }
    }

    // 下载并更新数据
    const saved = (c, name) => {
      if (!c) return null;
      const file = path.join(dir, name);
      const rel = `/images/${dest.id}/${name}`;
      return { c, file, rel };
    };
    const cover = saved(got.cover, 'cover.jpg');
    if (cover) {
      await download(cover.c.thumb, cover.file);
      dest.cover = cover.rel;
      credits.push({ name: dest.name, role: '封面', title: cover.c.title, artist: cover.c.artist, license: cover.c.license, url: cover.c.descUrl });
    }
    if (got.gallery.length) dest.gallery = [];
    for (let i = 0; i < got.gallery.length; i++) {
      const g = saved(got.gallery[i], `gallery-${i + 1}.jpg`);
      if (g) { await download(g.c.thumb, g.file); dest.gallery.push(g.rel); credits.push({ name: dest.name, role: `画廊${i + 1}`, title: g.c.title, artist: g.c.artist, license: g.c.license, url: g.c.descUrl }); }
    }
    for (let i = 0; i < dest.highlights.length && i < got.highlights.length; i++) {
      const h = saved(got.highlights[i], `hl-${i + 1}.jpg`);
      if (h) { await download(h.c.thumb, h.file); dest.highlights[i].image = h.rel; credits.push({ name: dest.name, role: `亮点${i + 1}`, title: h.c.title, artist: h.c.artist, license: h.c.license, url: h.c.descUrl }); }
    }
    report.push(`${dest.name}: 封面=${dest.cover ? 'OK' : '无'} 画廊=${dest.gallery.length} 亮点=${dest.highlights.filter(h => h.image && h.image.startsWith('/images/')).length}`);
  }

  // 写回 destinations.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  // 版权署名文件
  const lines = ['# 图片来源与授权说明', '', '以下图片来自 Wikimedia Commons（维基共享资源），均为自由授权作品，按各自许可证要求署名：', ''];
  for (const c of credits) {
    lines.push(`- **${c.name}（${c.role}）**：《${c.title}》 — 作者：${c.artist || '未知'} | 许可：${c.license || '未知'} | ${c.url}`);
  }
  fs.writeFileSync(path.join(IMG_DIR, 'CREDITS.md'), lines.join('\n'), 'utf8');

  console.log('==== 抓取报告 ====');
  report.forEach((r) => console.log(r));
  console.log(`共下载图片：${credits.length} 张；署名文件：public/images/CREDITS.md`);
}

main().catch((e) => { console.error('执行失败:', e); process.exit(1); });