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
const rag = require('../lib/rag');
const agent = require('../lib/agent');

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

test('AI 邀请令牌绑定客户端且拒绝错误客户端', () => {
  const oldInvite = process.env.AI_INVITE_CODE;
  process.env.AI_INVITE_CODE = 'unit-test-invite';
  try {
    const clientId = 'client_1234567890abcd';
    const token = ai.signAiToken(clientId);
    assert.equal(ai.verifyAiToken(token, clientId), true);
    assert.equal(ai.verifyAiToken(token, 'client_abcdefghijkl'), false);
    assert.equal(ai.readAiToken(token).sub, clientId);
  } finally {
    if (oldInvite === undefined) delete process.env.AI_INVITE_CODE;
    else process.env.AI_INVITE_CODE = oldInvite;
  }
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

test('RAG 中文双字检索命中目的地家庭依据', () => {
  const chunks = rag.buildChunks();
  assert.ok(chunks.length >= 300, '本地知识库应覆盖目的地、景点、餐饮与打包规则');
  assert.ok(chunks.some((item) => item.type === 'accessibility'));
  assert.ok(chunks.some((item) => item.type === 'packing'));
  const citations = rag.retrieve('杭州 老人 少走路 不吃辣 茶园 午休', {
    destinationId: 'hangzhou',
    limit: 6
  });
  assert.ok(citations.length >= 3, '应召回多条依据');
  assert.ok(citations.every((item) => item.destinationId === '' || item.destinationId === 'hangzhou'));
  assert.ok(citations.some((item) => item.id.includes('hangzhou')));
  assert.ok(citations.some((item) => /老人|适老|午休|少走路/.test(item.text)));
});

test('RAG 引用字段可直接用于前端渲染', () => {
  const raw = rag.retrieve('北京 故宫 老人', { destinationId: 'beijing', limit: 2 });
  const citations = rag.publicCitations(raw);
  assert.equal(citations.length, raw.length);
  for (const item of citations) {
    assert.ok(item.docId && item.title && item.snippet && item.url);
    assert.equal(typeof item.score, 'number');
  }
});

test('Agent 工具循环执行白名单工具并回填结果', async (t) => {
  const originalChatRaw = ai.chatRaw;
  let call = 0;
  ai.chatRaw = async () => {
    call++;
    if (call === 1) {
      return {
        content: '',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'search_travel_knowledge', arguments: JSON.stringify({ query: '杭州 老人' }) }
          }]
        },
        finishReason: 'tool_calls'
      };
    }
    return {
      content: '{"title":"工具结果已使用"}',
      message: { role: 'assistant', content: '{"title":"工具结果已使用"}' },
      finishReason: 'stop'
    };
  };
  t.after(() => { ai.chatRaw = originalChatRaw; });
  const events = [];
  const result = await agent.runToolLoop({
    settings: { lang: 'zh' },
    messages: [{ role: 'user', content: '测试' }],
    tools: [{
      type: 'function',
      function: { name: 'search_travel_knowledge', parameters: { type: 'object', properties: {} } }
    }],
    executeTool: async () => ({ summary: '命中 3 条依据', citations: [1, 2, 3] }),
    onEvent: (event) => events.push(event)
  });
  assert.equal(call, 2);
  assert.match(result.content, /工具结果已使用/);
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].name, 'search_travel_knowledge');
  assert.ok(result.trace[0].ok);
  assert.ok(events.some((event) => event.type === 'tool' && event.status === 'done'));
});

test('Agent 拒绝模型调用未授权工具', async (t) => {
  const originalChatRaw = ai.chatRaw;
  ai.chatRaw = async () => ({
    content: '',
    message: {
      content: null,
      tool_calls: [{
        id: 'call-evil',
        type: 'function',
        function: { name: 'run_shell', arguments: '{"cmd":"whoami"}' }
      }]
    },
    finishReason: 'tool_calls'
  });
  t.after(() => { ai.chatRaw = originalChatRaw; });
  await assert.rejects(() => agent.runToolLoop({
    settings: { lang: 'zh' },
    messages: [{ role: 'user', content: '测试' }],
    tools: [{
      type: 'function',
      function: { name: 'search_travel_knowledge', parameters: { type: 'object', properties: {} } }
    }],
    executeTool: async () => ({ ok: true })
  }), /未授权工具/);
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
  assert.equal(cfg.ai.model, 'deepseek-flash', '默认模型需与当前 DeepSeek API 文档一致');
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
