'use strict';

const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, '..', 'config.json');
const CFG_LOCAL = path.join(__dirname, '..', 'config.local.json');
const CITY_PINYIN = readJson(path.join(__dirname, '..', 'data', 'city-pinyin.json')) || {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();

const domainsZh = [
  'mct.gov.cn',
  'cctn.cn',
  'ctnews.com.cn',
  'ccmg.cn',
  'chinadaily.com.cn',
  'cntraveler.com',
  'lonelyplanet.com',
  'afar.com',
  'travelandleisure.com',
  'nationalgeographic.com',
  'timeout.com',
  'theculturetrip.com',
  'travelchinaguide.com'
];
const domainsEn = domainsZh.filter((domain) => !['mct.gov.cn', 'cctn.cn', 'ctnews.com.cn', 'ccmg.cn'].includes(domain));

const sourceNames = {
  'mct.gov.cn': '文化和旅游部',
  'cctn.cn': '中国文旅网',
  'ctnews.com.cn': '中国旅游新闻网',
  'ccmg.cn': '文旅中国',
  'chinadaily.com.cn': 'China Daily',
  'cntraveler.com': 'Condé Nast Traveler',
  'lonelyplanet.com': 'Lonely Planet',
  'afar.com': 'AFAR',
  'travelandleisure.com': 'Travel + Leisure',
  'nationalgeographic.com': 'National Geographic',
  'timeout.com': 'Time Out',
  'theculturetrip.com': 'Culture Trip',
  'travelchinaguide.com': 'TravelChinaGuide'
};
const globalAliases = {
  '冰岛': 'Iceland',
  '新西兰': 'New Zealand',
  '澳大利亚': 'Australia',
  '日本': 'Japan',
  '韩国': 'South Korea',
  '泰国': 'Thailand',
  '新加坡': 'Singapore',
  '法国': 'France',
  '意大利': 'Italy',
  '西班牙': 'Spain',
  '英国': 'United Kingdom',
  '美国': 'United States',
  '加拿大': 'Canada',
  '瑞士': 'Switzerland',
  '埃及': 'Egypt',
  '土耳其': 'Türkiye',
  '马尔代夫': 'Maldives',
  '巴黎': 'Paris',
  '伦敦': 'London',
  '纽约': 'New York',
  '东京': 'Tokyo',
  '京都': 'Kyoto',
  '大阪': 'Osaka',
  '首尔': 'Seoul',
  '曼谷': 'Bangkok'
};

/** 读取配置文件（复用 ai 模块的缓存实现） */
function readJson(file) {
  return require('./ai').readConfigFile(file);
}

/** 读取 Tavily 配置（Key、结果条数、超时） */
function settings() {
  const base = (readJson(CFG) || {}).travelSearch || {};
  const local = (readJson(CFG_LOCAL) || {}).travelSearch || {};
  const cfg = { ...base, ...local };
  return {
    apiKey: String(process.env.TAVILY_API_KEY || cfg.apiKey || '').trim(),
    maxResults: Math.min(Math.max(Number(cfg.maxResults) || 8, 1), 10),
    timeoutMs: Math.min(Math.max(Number(cfg.timeoutMs) || 15000, 5000), 30000)
  };
}

/** 是否配置了 Tavily Key（未配置则前端不显示全网搜索入口） */
function isEnabled() {
  return Boolean(settings().apiKey);
}

/** 生成检索别名（城市拼音与常见别称），提升召回 */
function queryAliases(query) {
  const aliases = [];
  Object.keys(globalAliases).forEach((name) => {
    if (query.includes(name)) aliases.push(globalAliases[name]);
  });
  Object.keys(CITY_PINYIN).forEach((name) => {
    if (query.includes(name)) aliases.push(CITY_PINYIN[name]);
  });
  return [...new Set(aliases)].slice(0, 4);
}

/** 判断搜索结果是否与查询相关（避免文旅之外的噪音） */
function isRelevant(item, query, aliases) {
  const haystack = (item.title + ' ' + item.summary).toLocaleLowerCase();
  return [query, ...aliases]
    .map((term) => String(term || '').trim().toLocaleLowerCase())
    .filter((term) => term.length > 1)
    .some((term) => haystack.includes(term));
}

/** 保存或清除 Tavily Key（写入 config.local.json 并把权限收紧到 600） */
function saveApiKey(rawKey) {
  const local = readJson(CFG_LOCAL) || {};
  const travel = { ...(local.travelSearch || {}) };
  const key = String(rawKey || '').trim();
  if (key) travel.apiKey = key;
  else delete travel.apiKey;
  local.travelSearch = travel;
  fs.writeFileSync(CFG_LOCAL, JSON.stringify(local, null, 2) + '\n', 'utf8');
  try { fs.chmodSync(CFG_LOCAL, 0o600); } catch { /* 权限收紧失败可忽略 */ }
  try { require('./ai').invalidateConfig(); } catch { /* 缓存失效失败不影响写入 */ }
}

/** 去掉 HTML 标签并截断，得到可展示的纯文本摘要 */
function textOnly(value, limit = 240) {
  const text = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text;
}

/** 判断来源域名是否在可信文旅站点白名单内 */
function allowedHost(hostname, lang) {
  const host = String(hostname || '').toLowerCase();
  const domains = lang === 'en' ? domainsEn : domainsZh;
  return domains.some((domain) => host === domain || host.endsWith('.' + domain));
}

/** 把域名映射成站点显示名 */
function sourceFor(hostname) {
  const host = String(hostname || '').toLowerCase();
  const domain = Object.keys(sourceNames).find((item) => host === item || host.endsWith('.' + item));
  return domain ? sourceNames[domain] : host.replace(/^www\./, '');
}

/** 过滤明显的栏目页/首页，只保留文章类链接 */
function isArticleUrl(parsed) {
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  if (host === 'kids.nationalgeographic.com') return false;
  if (host.startsWith('shop.') || pathname.includes('/collections/')) return false;
  if (/\.pdf$/.test(pathname) || pathname.includes('/paper/att/')) return false;
  return !/\/(?:profile|author|authors|account|login|signin|privacy|terms|search|newsletter|subscribe|tag)(?:\/|$)/.test(pathname);
}

/** 把上游结果规范化成前端需要的字段 */
function normalizeResult(result, lang) {
  let parsed;
  try { parsed = new URL(String(result.url || '')); } catch { return null; }
  if (!/^https?:$/.test(parsed.protocol) || !allowedHost(parsed.hostname, lang) || !isArticleUrl(parsed)) return null;
  const summary = textOnly(result.content);
  if (!result.title || !summary) return null;
  const source = sourceFor(parsed.hostname);
  return {
    category: lang === 'en' ? 'Web result' : '全网补充',
    categoryEn: 'Web result',
    title: String(result.title).trim(),
    titleEn: String(result.title).trim(),
    summary,
    summaryEn: summary,
    source,
    sourceEn: source,
    publishedAt: result.published_date ? String(result.published_date).slice(0, 10) : '',
    url: parsed.toString(),
    web: true
  };
}

/** 调用 Tavily 搜索并只保留可信文旅域名，过滤无关结果 */
async function searchWeb(rawQuery, lang = 'zh') {
  const query = String(rawQuery || '').trim().slice(0, 80);
  if (!query) throw Object.assign(new Error('请输入搜索关键词'), { statusCode: 400 });
  const cfg = settings();
  if (!cfg.apiKey) return { enabled: false, cached: false, results: [] };

  const normalizedLang = lang === 'en' ? 'en' : 'zh';
  const cacheKey = normalizedLang + '|' + query.toLocaleLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { enabled: true, cached: true, results: cached.results };
  }

  const aliases = queryAliases(query);
  const queryText = normalizedLang === 'en'
    ? [query, ...aliases, 'travel'].join(' ')
    : (aliases.length ? [aliases[0], query, 'travel'].join(' ') : `${query} 旅游`);
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: cfg.apiKey,
      query: queryText,
      topic: 'general',
      search_depth: 'basic',
      max_results: cfg.maxResults,
      include_answer: false,
      include_raw_content: false,
      include_domains: normalizedLang === 'en' ? domainsEn : domainsZh
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw Object.assign(new Error('Tavily search failed: ' + response.status + ' ' + detail.slice(0, 180)), { statusCode: 502 });
  }

  const data = await response.json();
  const seen = new Set();
  const seenTitles = new Set();
  const results = (Array.isArray(data.results) ? data.results : [])
    .map((item) => normalizeResult(item, normalizedLang))
    .filter((item) => {
      if (!item || seen.has(item.url) || !isRelevant(item, query, aliases)) return false;
      const titleKey = item.title.toLocaleLowerCase().replace(/^\[pdf\]\s*/i, '').replace(/\s+/g, '');
      if (seenTitles.has(titleKey)) return false;
      seen.add(item.url);
      seenTitles.add(titleKey);
      return true;
    })
    .slice(0, 6);
  cache.set(cacheKey, { at: Date.now(), results });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, cache.size - 200);
    oldest.forEach(([key]) => cache.delete(key));
  }
  return { enabled: true, cached: false, results };
}

module.exports = { isEnabled, saveApiKey, searchWeb };
