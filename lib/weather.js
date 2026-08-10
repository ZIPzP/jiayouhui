'use strict';
/** 15 天天气预报：Open-Meteo（免费无 Key），服务端缓存 1 小时 */
const cache = new Map();
const TTL = 60 * 60 * 1000;

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

async function getForecast(dest) {
  const now = Date.now();
  const c = cache.get(dest.id);
  if (c && now - c.at < TTL) return c.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${dest.lat}&longitude=${dest.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=16`;
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
  const data = { name: dest.name, updatedAt: new Date().toISOString(), days };
  cache.set(dest.id, { at: now, data });
  return data;
}

module.exports = { getForecast };