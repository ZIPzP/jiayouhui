'use strict';
/** 12306 真实车次/票价查询（免费，无需 Key）。车次/时刻基本固定，可缓存；票价为 12306 实时官方价。
 * 依赖：大陆服务器可访问 kyfw.12306.cn；需先访问 init 页建立会话 cookie。
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const STATION_URL = 'https://kyfw.12306.cn/otn/resources/js/framework/station_name.js';
const INIT_URL = 'https://kyfw.12306.cn/otn/leftTicket/init';
const QUERY_URL = 'https://kyfw.12306.cn/otn/leftTicket/query';
const PRICE_URL = 'https://kyfw.12306.cn/otn/leftTicketPrice/queryAllPublicPrice';
// 12306 票价字段 → 中文席别（queryAllPublicPrice 返回，原值单位：分）
const PRICE_FIELDS = [
  ['ze_price', '二等座'],
  ['zy_price', '一等座'],
  ['swz_price', '商务座'],
  ['tdz_price', '特等座'],
  ['wz_price', '无座'],
  ['yz_price', '硬座'],
  ['yw_price', '硬卧'],
  ['rw_price', '软卧'],
  ['gr_price', '高级软卧'],
  ['dw_price', '动卧']
];

let stationMap = null;
let cookie = '';
let cookieAt = 0;

async function loadStations() {
  if (stationMap) return stationMap;
  const r = await fetch(STATION_URL, { headers: { 'User-Agent': UA } });
  const text = await r.text();
  const map = {};
  const start = text.indexOf("='");
  const body = start >= 0 ? text.slice(start + 2) : text;
  for (const part of body.split('@')) {
    const f = part.split('|');
    if (f.length >= 3 && f[1] && f[2]) map[f[1]] = f[2];
  }
  stationMap = map;
  return map;
}
function norm(name) { return String(name || '').replace(/[省市]$/, ''); }
async function sessionCookie() {
  // 会话 cookie 约 20 分钟内有效，过期重建
  if (cookie && Date.now() - cookieAt < 20 * 60 * 1000) return cookie;
  const r = await fetch(INIT_URL, { headers: { 'User-Agent': UA } });
  const setc = (r.headers.get('set-cookie') || '').split(',').map((s) => s.split(';')[0].trim()).filter(Boolean);
  cookie = setc.join('; ');
  cookieAt = Date.now();
  return cookie;
}
/** 查询某天 出发→到达 的真实车次（最多返回前 n 趟） */
async function queryTrains(fromCity, toCity, date, n = 8) {
  try {
    const map = await loadStations();
    const from = map[norm(fromCity)];
    const to = map[norm(toCity)];
    if (!from || !to) return { ok: false, error: '车站代码缺失：' + norm(fromCity) + '→' + norm(toCity) };
    const ck = await sessionCookie();
    const url = QUERY_URL + '?leftTicketDTO.train_date=' + date +
      '&leftTicketDTO.from_station=' + from + '&leftTicketDTO.to_station=' + to + '&purpose_codes=ADULT';
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': INIT_URL, 'Cookie': ck } });
    const text = await r.text();
    const j = JSON.parse(text);
    if (!j.data || !Array.isArray(j.data.result)) return { ok: false, error: '12306 无返回数据' };
    const trains = j.data.result.slice(0, n).map((line) => {
      const t = line.split('|');
      return {
        no: t[3] || '',
        from: t[6] || '',
        to: t[7] || '',
        fromTime: t[8] || '',
        toTime: t[9] || '',
        duration: t[10] || '',
        biz: t[32] || '',   // 商务座
        first: t[30] || '', // 一等座
        second: t[31] || '' // 二等座
      };
    }).filter((x) => x.no);
    return { ok: true, trains };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
/** 12306 票价原值（单位：分，如 "00545"）→ 元字符串（"54.5"），无法解析返回空串 */
function fmtPrice(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return '';
  const i = s.replace(/^0+/, '');
  if (!i) return '';
  return i.length === 1 ? '0.' + i : i.slice(0, -1) + '.' + i.slice(-1);
}
/** 查询某天 出发→到达 的 12306 官方实时票价（一次返回全部车次） */
async function queryPrices(fromCity, toCity, date) {
  try {
    const map = await loadStations();
    const from = map[norm(fromCity)];
    const to = map[norm(toCity)];
    if (!from || !to) return { ok: false, error: '车站代码缺失：' + norm(fromCity) + '→' + norm(toCity) };
    const ck = await sessionCookie();
    const url = PRICE_URL + '?leftTicketDTO.train_date=' + date +
      '&leftTicketDTO.from_station=' + from + '&leftTicketDTO.to_station=' + to + '&purpose_codes=ADULT';
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': INIT_URL, 'Cookie': ck } });
    const j = JSON.parse(await r.text());
    if (!j.data || !Array.isArray(j.data)) return { ok: false, error: '12306 票价无返回数据' };
    const trains = j.data.map((item) => {
      const d = (item && item.queryLeftNewDTO) || {};
      const prices = {};
      for (const [key, label] of PRICE_FIELDS) {
        const v = fmtPrice(d[key]);
        if (v) prices[label] = v;
      }
      return {
        no: d.station_train_code || '',
        from: d.from_station_name || '',
        to: d.to_station_name || '',
        fromTime: d.start_time || '',
        toTime: d.arrive_time || '',
        duration: d.lishi || '',
        prices
      };
    }).filter((x) => x.no);
    return { ok: true, trains };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}
/** 查询某天 出发→到达 的真实车次并附上官方实时票价（按车次号合并） */
async function queryTrainsWithPrices(fromCity, toCity, date, n = 8) {
  const [base, price] = await Promise.all([
    queryTrains(fromCity, toCity, date, n),
    queryPrices(fromCity, toCity, date)
  ]);
  if (!base.ok) return base;
  const priceMap = {};
  if (price.ok) for (const p of price.trains) priceMap[p.no] = p.prices || {};
  const trains = base.trains.map((t) => ({ ...t, prices: priceMap[t.no] || {} }));
  return { ok: true, trains };
}

module.exports = { queryTrains, queryPrices, queryTrainsWithPrices, loadStations, norm };