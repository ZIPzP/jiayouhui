'use strict';
/**
 * 平台热门数据采集器
 *
 * 设计目标：从“合法、合规”的数据源聚合各平台旅游热门数据，而不是直接爬取用户内容。
 * - 内置数据源 local-trends：读取 data/trending.json（演示/基础数据）
 * - 通用 HTTP 数据源：在 config.json 的 collector.sources 中配置 url，返回
 *   { items: [ { name, heat, trend, reason } ] } 或同结构数组（例如官方开放接口、自建爬虫服务）
 *
 * 注意：直接抓取微博/小红书/抖音等平台用户页面通常违反其服务条款并涉及版权问题，
 * 建议优先使用官方开放平台接口（需申请授权）或与平台签约的数据服务。
 */
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('./ai');

async function collect(config) {
  const cfg = config || loadConfig();
  const collector = cfg.collector || {};
  const enabled = collector.enabled || ['local-trends'];
  const sources = collector.sources || {};
  const timeoutMs = collector.timeoutMs || 8000;
  const results = [];

  for (const key of enabled) {
    const src = sources[key];
    if (!src) continue;
    try {
      const items = await fetchSource(key, src, timeoutMs);
      results.push({ source: key, label: src.label || key, ok: true, count: items.length, items });
    } catch (e) {
      results.push({ source: key, label: src.label || key, ok: false, error: e.message, items: [] });
    }
  }
  return { collectedAt: new Date().toISOString(), results };
}

async function fetchSource(key, src, timeoutMs) {
  if (key === 'local-trends') {
    const filePath = path.join(process.cwd(), src.file || 'data/trending.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return (raw.items || []).map((it) => ({ ...it }));
  }
  if (src.url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const resp = await fetch(src.url, { signal: ctl.signal, headers: src.headers || {} });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data) ? data : data.items || [];
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

/** 合并多数据源并按热度排序（同名去重取最高热度） */
function merge(itemsBySource) {
  const map = new Map();
  for (const group of itemsBySource) {
    for (const it of group.items || []) {
      const name = it.name || it.city;
      if (!name) continue;
      const prev = map.get(name);
      const heat = Number(it.heat) || 0;
      if (!prev || heat > (Number(prev.heat) || 0)) {
        map.set(name, {
          name,
          heat,
          trend: it.trend || prev?.trend || '',
          reason: it.reason || prev?.reason || '',
          source: it.source || group.label || group.source,
          city: it.city || name
        });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.heat - a.heat)
    .map((it, i) => ({ ...it, rank: i + 1 }));
}

module.exports = { collect, merge };