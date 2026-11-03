'use strict';
// @ts-check
/**
 * 轻量旅行知识检索：把目的地与打包规则切成可引用的片段，使用字符 bigram BM25。
 * 目标是可解释的本地召回，不引入向量库或运行时依赖。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let chunkCache = null;
let indexCache = null;

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8'));
  } catch {
    return fallback;
  }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function addChunk(list, chunk) {
  const text = clean(chunk.text);
  if (!text) return;
  list.push({
    id: chunk.id,
    title: clean(chunk.title),
    text,
    type: chunk.type || 'knowledge',
    destinationId: chunk.destinationId || '',
    destinationName: chunk.destinationName || '',
    url: chunk.url || '/destinations.html',
    source: chunk.source || '家游汇本地旅行知识库'
  });
}

function buildChunks() {
  const list = [];
  const destinations = readJson('destinations.json', { destinations: [] }).destinations || [];

  for (const dest of destinations) {
    const baseUrl = '/destinations.html?id=' + encodeURIComponent(dest.id);
    const common = {
      destinationId: dest.id,
      destinationName: dest.name,
      url: baseUrl,
      source: '家游汇目的地档案'
    };
    addChunk(list, {
      ...common,
      id: `dest:${dest.id}:profile`,
      title: `${dest.name} · 家庭旅行概览`,
      type: 'destination',
      text: [
        dest.tagline, dest.description,
        (dest.tags || []).length ? '适合标签：' + dest.tags.join('、') : '',
        dest.bestSeasons && dest.bestSeasons.length ? '最佳季节：' + dest.bestSeasons.join('、') : '',
        dest.suggestDays ? '建议游玩：' + dest.suggestDays : '',
        dest.climate ? '气候：' + dest.climate : ''
      ].filter(Boolean).join('；')
    });
    addChunk(list, {
      ...common,
      id: `dest:${dest.id}:elderly`,
      title: `${dest.name} · 适老与家庭便利`,
      type: 'accessibility',
      text: [dest.elderlyFriendly, dest.packingNote ? '携带提示：' + dest.packingNote : ''].filter(Boolean).join('；')
    });

    (dest.highlights || []).forEach((item, index) => {
      addChunk(list, {
        ...common,
        id: `dest:${dest.id}:highlight:${index}`,
        title: `${dest.name} · ${item.title || '景点亮点'}`,
        type: 'highlight',
        text: [item.title, item.text, '适合家庭同行', dest.climate].filter(Boolean).join('；')
      });
    });
    (dest.foods || []).forEach((food, index) => {
      addChunk(list, {
        ...common,
        id: `dest:${dest.id}:food:${index}`,
        title: `${dest.name} · ${food.name || '当地美食'}`,
        type: 'food',
        text: [food.name, food.desc, food.spicy ? '辣度：' + food.spicy : '', (food.tags || []).join('、')].filter(Boolean).join('；')
      });
    });
  }

  const packing = readJson('packing-db.json', {});
  const ruleSource = { source: '家游汇打包规则库', url: '/packing.html' };
  for (const [season, items] of Object.entries(packing.seasons || {})) {
    addChunk(list, {
      ...ruleSource,
      id: `packing:season:${season}`,
      title: `${season}季家庭出行装备`,
      type: 'packing',
      text: (items || []).map((x) => `${x.name}：${x.reason}`).join('；')
    });
  }
  for (const [traveler, items] of Object.entries(packing.travelers || {})) {
    const label = { elderly: '老人', adult: '成人', child: '儿童' }[traveler] || traveler;
    addChunk(list, {
      ...ruleSource,
      id: `packing:traveler:${traveler}`,
      title: `${label}出行准备`,
      type: 'packing',
      text: (items || []).map((x) => `${x.name}：${x.reason}`).join('；')
    });
  }
  for (const [kind, items] of Object.entries(packing.destination || {})) {
    addChunk(list, {
      ...ruleSource,
      id: `packing:destination:${kind}`,
      title: `${kind}目的地装备`,
      type: 'packing',
      text: (items || []).map((x) => `${x.name}：${x.reason}`).join('；')
    });
  }
  return list;
}

function terms(text) {
  const value = String(text || '').toLowerCase().normalize('NFKC');
  const out = [];
  const words = value.match(/[a-z0-9]{2,}/g) || [];
  out.push(...words);
  const cjkRuns = value.match(/[\u3400-\u9fff]+/g) || [];
  for (const run of cjkRuns) {
    for (let i = 0; i < run.length; i++) {
      out.push(run[i]);
      if (i + 1 < run.length) out.push(run.slice(i, i + 2));
    }
  }
  return out;
}

function getIndex() {
  if (indexCache) return indexCache;
  if (!chunkCache) chunkCache = buildChunks();
  const docs = chunkCache.map((chunk) => {
    const tf = new Map();
    for (const term of terms(chunk.title + ' ' + chunk.text)) tf.set(term, (tf.get(term) || 0) + 1);
    return { chunk, tf, len: [...tf.values()].reduce((a, b) => a + b, 0) };
  });
  const df = new Map();
  for (const doc of docs) for (const term of doc.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
  const avgLen = docs.reduce((sum, doc) => sum + doc.len, 0) / Math.max(1, docs.length);
  indexCache = { docs, df, avgLen };
  return indexCache;
}

function retrieve(query, options = {}) {
  const { docs, df, avgLen } = getIndex();
  const destinationId = clean(options.destinationId);
  const limit = Math.max(1, Math.min(12, Number(options.limit) || 6));
  const queryTerms = terms(clean(query));
  if (!queryTerms.length) return [];
  const qSet = [...new Set(queryTerms)];
  const n = docs.length;
  const k1 = 1.5;
  const b = 0.75;
  const scored = [];

  for (const doc of docs) {
    if (destinationId && doc.chunk.destinationId && doc.chunk.destinationId !== destinationId) continue;
    let score = 0;
    for (const term of qSet) {
      const freq = doc.tf.get(term) || 0;
      if (!freq) continue;
      const idf = Math.log(1 + (n - (df.get(term) || 0) + 0.5) / ((df.get(term) || 0) + 0.5));
      score += idf * (freq * (k1 + 1)) / (freq + k1 * (1 - b + b * doc.len / Math.max(1, avgLen)));
    }
    if (doc.chunk.destinationId === destinationId && destinationId) score *= 1.08;
    if (score > 0) scored.push({ ...doc.chunk, score: Number(score.toFixed(4)) });
  }
  scored.sort((a, b2) => b2.score - a.score);
  return scored.slice(0, limit);
}

function promptBlock(citations) {
  if (!citations || !citations.length) return '';
  return '\n\n【检索到的本地知识依据】\n' + citations.map((item, index) => (
    `[${index + 1}] ${item.title}（${item.source}）：${item.text}`
  )).join('\n') + '\n请优先采用上述依据；不要虚构未提供的事实。';
}

function publicCitations(citations) {
  return (citations || []).map((item, index) => ({
    index: index + 1,
    docId: item.id,
    title: item.title,
    snippet: item.text.length > 150 ? item.text.slice(0, 147) + '…' : item.text,
    type: item.type,
    url: item.url,
    source: item.source,
    score: item.score
  }));
}

module.exports = { buildChunks, retrieve, promptBlock, publicCitations, terms };
