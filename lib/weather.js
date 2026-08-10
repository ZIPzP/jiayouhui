'use strict';
/** 15 天天气预报
 * 主数据源：中国天气网 weather.com.cn（中国气象局数据，与手机天气基本一致）
 * 备用：Open-Meteo（国际模型）
 * 服务端缓存 1 小时
 */
const cache = new Map();
const TTL = 60 * 60 * 1000;
const CODES = (() => { try { return require('../data/weather-codes.json'); } catch (e) { return {}; } })();

const WMO = {
  0: ['晴', '☀️'], 1: ['晴间多云', '🌤️'], 2: ['多云', '⛅'], 3: ['阴', '☁️'],
  45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'],
  51: ['毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['毛毛雨', '🌦️'],
  56: ['冻毛毛雨', '🌧️'], 57: ['冻毛毛雨', '🌧️'],
  61: ['小雨', '🌧️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'],
  71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'],
  80: ['阵雨', '🌦️'], 81: ['阵雨', '🌦️'], 82: ['强阵雨', '⛈️'],
  85: ['阵雪', '🌨️'], 86: ['强阵雪', '❄️'],
  95: ['雷暴', '⛈️'], 96: ['雷暴冰雹', '⛈️'], 99: ['雷暴冰雹', '⛈️']
};
function wmo(code) { return WMO[code] || WMO[3]; }
function weekday(dateStr) {
  const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return w[new Date(dateStr + 'T00:00:00').getDay()];
}
/* 中国时区的"今天"（YYYY-MM-DD），避免服务器时区导致日期偏移 */
function chinaNow() { return new Date(Date.now() + 8 * 3600 * 1000); }
function chinaToday() { return chinaNow().toISOString().slice(0, 10); }
function iconFor(t) {
  if (!t) return '🌤️';
  if (t.indexOf('雷') >= 0) return '⛈️';
  if (t.indexOf('雪') >= 0) return '❄️';
  if (t.indexOf('雨') >= 0) return '🌧️';
  if (t.indexOf('阴') >= 0) return '☁️';
  if (t.indexOf('多云') >= 0) return '⛅';
  if (t.indexOf('晴') >= 0) return '☀️';
  if (t.indexOf('雾') >= 0) return '🌫️';
  return '🌤️';
}

/* 中国天气网：逐日预报（含未来 15 天） */
async function fetchChina(dest, code) {
  const now = chinaNow();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const today = chinaToday().replace(/-/g, '');
  const url = 'http://d1.weather.com.cn/calendar_new/' + yyyy + '/' + code + '_' + yyyy + mm + '.html';
  const r = await fetch(url, { headers: { Referer: 'http://www.weather.com.cn/', 'User-Agent': 'Mozilla/5.0 (jiayouhui)' } });
  if (!r.ok) throw new Error('天气接口 ' + r.status);
  const text = new TextDecoder('utf-8').decode(await r.arrayBuffer());
  const idx = text.indexOf('var fc40 = ');
  if (idx < 0) throw new Error('天气数据格式异常');
  const start = idx + 'var fc40 = '.length;
  const last = text.lastIndexOf(']');
  const arr = JSON.parse(text.slice(start, last + 1));
  const days = arr
    .filter((x) => String(x.date) >= today)
    .slice(0, 15)
    .map((x) => {
      const d = String(x.date);
      const dateStr = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
      return {
        date: dateStr,
        weekday: weekday(dateStr),
        label: x.w1 || '未知',
        icon: iconFor(x.w1),
        tmax: Math.round(Number(x.max) || Number(x.hmax) || 0),
        tmin: Math.round(Number(x.min) || Number(x.hmin) || 0)
      };
    });
  if (!days.length) throw new Error('暂无预报');
  return { name: dest.name, source: 'weather.com.cn', updatedAt: new Date().toISOString(), days };
}

/* Open-Meteo（备用） */
async function fetchOpenMeteo(dest) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + dest.lat + '&longitude=' + dest.lon +
    '&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=16';
  const r = await fetch(url, { headers: { 'User-Agent': 'jiayouhui/0.1' } });
  if (!r.ok) throw new Error('天气接口 ' + r.status);
  const j = await r.json();
  const days = (j.daily.time || []).slice(0, 15).map((t, i) => {
    const [label, icon] = wmo(j.daily.weathercode[i]);
    return {
      date: t,
      weekday: weekday(t),
      label,
      icon,
      tmax: Math.round(j.daily.temperature_2m_max[i]),
      tmin: Math.round(j.daily.temperature_2m_min[i])
    };
  });
  return { name: dest.name, source: 'open-meteo', updatedAt: new Date().toISOString(), days };
}

async function getForecast(dest) {
  const now = Date.now();
  const c = cache.get(dest.id);
  if (c && now - c.at < TTL) return c.data;
  const code = CODES[dest.id];
  try {
    const data = code ? await fetchChina(dest, code) : await fetchOpenMeteo(dest);
    cache.set(dest.id, { at: now, data });
    return data;
  } catch (e) {
    // 中国天气网失败时回退 Open-Meteo
    const data = await fetchOpenMeteo(dest);
    cache.set(dest.id, { at: now, data });
    return data;
  }
}

module.exports = { getForecast };