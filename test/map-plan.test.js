const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareMapDays } = require('../public/js/plan-map');
const { rulePlan } = require('../lib/planner');
const destinations = require('../data/destinations.json');

test('每日行程至少生成两个可连线地图锚点', () => {
  const data = {
    days: [
      {
        day: 1,
        title: '抵达与西湖',
        schedule: [
          { time: '上午', activity: '西湖十景' },
          { time: '下午', activity: '灵隐寺' }
        ]
      },
      {
        day: 2,
        title: '龙井茶园',
        schedule: [{ time: '上午', activity: '龙井茶园' }],
        meals: [{ type: '晚餐', recommend: '龙井虾仁' }]
      },
      {
        day: 3,
        title: '返程',
        schedule: [{ time: '下午', activity: '返程' }]
      }
    ]
  };
  const days = prepareMapDays(
    data,
    { destinationName: '杭州', transport: '高铁' },
    { name: '杭州', lon: 120.155, lat: 30.274 }
  );

  assert.equal(days.length, 3);
  days.forEach((day) => {
    assert.ok(day.stops.length >= 2, `第 ${day.day} 天缺少可连线锚点`);
  });
  assert.ok(days[1].stops.some((stop) => stop.free), '单景点日应补充市区自由活动锚点');
  assert.ok(
    days[2].stops.some((stop) => stop.type === '交通' && /站|机场/.test(stop.keyword)),
    '返程日应补充车站或机场锚点'
  );
});

test('杭州三天规则行程的每一天都可连线', () => {
  const hangzhou = destinations.destinations.find((item) => item.id === 'hangzhou');
  assert.ok(hangzhou, '缺少杭州目的地数据');
  const params = {
    destination: hangzhou,
    origin: '上海',
    returnDest: '',
    startDate: '2026-11-10',
    days: 3,
    transport: '高铁',
    travelTime: '上午',
    elderly: 1,
    adults: 2,
    children: 1,
    dietary: ['不吃辣'],
    budget: '舒适型',
    pace: '轻松慢游',
    accommodation: '酒店',
    interests: ['自然风光'],
    notes: '老人腿脚不便，每天少走路；孩子需要午休。'
  };
  const data = rulePlan(params, 'zh');
  const days = prepareMapDays(data, params, hangzhou);

  assert.equal(days.length, 3);
  days.forEach((day) => {
    const drawable = day.stops.filter((stop) => stop.type !== '餐饮' || stop.foodSpecific);
    assert.ok(drawable.length >= 2, `杭州第 ${day.day} 天仍缺少可连线锚点`);
  });
  assert.ok(days[2].stops.some((stop) => stop.type === '交通'), '杭州返程日应先到车站');
});
