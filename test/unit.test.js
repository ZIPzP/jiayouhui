'use strict';
/**
 * 单元测试（node:test，零依赖）：`node --test test/`
 * 覆盖：安全工具函数、AI 返回解析、规则引擎边界、城市归一。
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const ai = require('../lib/ai');
const planner = require('../lib/planner');
const train = require('../lib/train');
const recommend = require('../lib/recommend');

const DEST = require('../data/destinations.json').destinations[0];

/* ---------- 内网地址判定（SSRF 防护） ---------- */
test('isPrivateHost 识别 IPv4 私有段', () => {
  ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.5', '169.254.1.1', '0.0.0.0']
    .forEach((h) => assert.equal(ai.isPrivateHost(h), true, h));
});

test('isPrivateHost 识别 IPv6 与 IPv4-mapped 形式', () => {
  ['::1', 'fd00::1', 'fe80::1'].forEach((h) => assert.equal(ai.isPrivateHost(h), true, h));
  // 审计实测漏网的两例：映射地址必须等价于对应 IPv4
  assert.equal(ai.isPrivateHost('::ffff:127.0.0.1'), true);
  assert.equal(ai.isPrivateHost('::ffff:7f00:1'), true);
  assert.equal(ai.mappedIPv4('::ffff:7f00:1'), '127.0.0.1');
});

test('isPrivateHost 不误伤公网域名', () => {
  ['api.deepseek.com', 'example.com', '8.8.8.8'].forEach((h) => assert.equal(ai.isPrivateHost(h), false, h));
});

test('assertPublicHost 拒绝解析到内网的主机名', async () => {
  // localtest.me 公网解析到 127.0.0.1，仅靠字面量判断挡不住
  await assert.rejects(() => ai.assertPublicHost('localtest.me'));
  await assert.rejects(() => ai.assertPublicHost('127.0.0.1'));
  await assert.rejects(() => ai.assertPublicHost('::ffff:127.0.0.1'));
});

/* ---------- AI 返回解析 ---------- */
test('extractJson 容忍 Markdown 围栏与前后废话', () => {
  assert.deepEqual(ai.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(ai.extractJson('好的，结果如下：{"a":1,"b":[2]} 以上'), { a: 1, b: [2] });
  assert.equal(ai.extractJson('完全不是 JSON'), null);
  assert.equal(ai.extractJson(''), null);
});

/* ---------- 规则引擎边界 ---------- */
test('rulePlan 天数钳制在 1-14 天', () => {
  const base = { destination: DEST, dietary: [], interests: [], month: 5, pace: '标准', budget: '舒适型' };
  assert.equal(planner.rulePlan({ ...base, days: 99 }, 'zh').days.length, 14);
  assert.equal(planner.rulePlan({ ...base, days: 0 }, 'zh').days.length, 3); // 非法值回落默认 3 天
});

test('rulePlan 中英文都能产出完整结构', () => {
  const base = { destination: DEST, days: 3, dietary: ['不吃辣'], interests: ['自然风光'], month: 5, pace: '标准', budget: '舒适型' };
  const zh = planner.rulePlan(base, 'zh');
  const en = planner.rulePlan(base, 'en');
  for (const plan of [zh, en]) {
    assert.ok(Array.isArray(plan.days) && plan.days.length === 3);
    plan.days.forEach((d) => {
      assert.ok(d.schedule && d.schedule.length, '每天要有日程');
      assert.ok(Array.isArray(d.meals));
    });
    assert.ok(plan.title);
  }
  assert.match(zh.title, /[\u4e00-\u9fa5]/);
  assert.doesNotMatch(en.title, /[\u4e00-\u9fa5]/);
});

test('customDestination 生成可用目的地的骨架', () => {
  const d = planner.customDestination('苏州', '想逛园林');
  assert.ok(d && d.id === 'custom');
  assert.equal(d.name, '苏州');
  assert.ok(Array.isArray(d.highlights));
});

/* ---------- 城市归一 ---------- */
test('cityEn 输出英文城市名', () => {
  assert.equal(planner.cityEn('西安'), "Xi'an");
  assert.ok(typeof planner.cityEn('杭州') === 'string');
});

test('train.norm 去掉省市后缀', () => {
  assert.equal(train.norm('北京市'), '北京');
  assert.equal(train.norm('浙江省'), '浙江');
  assert.equal(train.norm('上海'), '上海');
});

/* ---------- 清单 ---------- */
test('seasonFromMonth 覆盖十二个月', () => {
  for (let m = 1; m <= 12; m++) {
    assert.ok(typeof recommend.seasonFromMonth(m) === 'string');
  }
});

/* ---------- 数据完整性 ---------- */
test('目的地数据字段完整', () => {
  const list = require('../data/destinations.json').destinations;
  assert.ok(list.length >= 40, '目的地数量应不少于 40');
  for (const d of list) {
    assert.ok(d.id && d.name, '每个目的地必须有 id 与 name');
    assert.ok(typeof d.lat === 'number' && typeof d.lon === 'number', d.id + ' 缺少坐标');
    assert.ok(Array.isArray(d.highlights) && d.highlights.length, d.id + ' 缺少亮点');
  }
});

test('城市库与拼音表规模合理', () => {
  const cities = require('../data/cities.json').cities;
  const pinyin = require('../data/city-pinyin.json');
  assert.ok(cities.length > 300);
  assert.ok(Object.keys(pinyin).length > 300);
  assert.ok(cities.some((c) => c.name === '北京'));
});

/* ---------- 配置文件 ---------- */
test('config.json 可解析且访问门禁与产品一致（关闭）', () => {
  const cfg = require('../config.json');
  assert.equal(typeof cfg.port, 'number');
  assert.equal(cfg.access.enabled, false, '访问口令门禁已按产品需求关闭，配置不应再写 true');
});

test('图片资源路径都指向 public/images 下的实际文件', () => {
  const fs = require('fs');
  const list = require('../data/destinations.json').destinations;
  const missing = [];
  for (const d of list) {
    [d.cover].concat(d.gallery || []).concat((d.highlights || []).map((h) => h.image)).forEach((u) => {
      if (!u || !u.startsWith('/images/')) return;
      const p = path.join(__dirname, '..', 'public', u);
      if (!fs.existsSync(p)) missing.push(u);
    });
  }
  assert.deepEqual(missing.slice(0, 5), [], '存在缺失的图片文件');
});
