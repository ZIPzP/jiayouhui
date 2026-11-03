'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const ai = require('../lib/ai');

function startMock() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      requests.push(body);
      if (body.stream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}\n\n');
        // 故意把 UTF-8 中文字符拆到两个网络块，验证流式解码不会产生替换字符。
        const contentFrame = Buffer.from('data: {"choices":[{"delta":{"content":"杭州"}}]}\n\n');
        const splitAt = contentFrame.indexOf(Buffer.from('杭')) + 1;
        res.write(contentFrame.subarray(0, splitAt));
        setImmediate(() => {
          res.write(contentFrame.subarray(splitAt));
          res.write('data: {"choices":[{"delta":{"content":"适老建议"}}]}\n\n');
          res.end('data: [DONE]\n\n');
        });
        return;
      }
      if (body.tools) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'tool-1',
                type: 'function',
                function: { name: 'search_travel_knowledge', arguments: '{"query":"杭州"}' }
              }]
            }
          }]
        }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"ok":true}' } }],
        usage: { total_tokens: 10 }
      }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, requests }));
  });
}

test('AI 客户端发送 DeepSeek 当前参数并解析工具调用', async (t) => {
  const mock = await startMock();
  t.after(() => mock.server.close());
  const address = mock.server.address();
  const settings = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiKey: 'test-key',
    keySource: 'server',
    model: 'deepseek-flash',
    lang: 'zh',
    temperature: 0.7
  };
  const result = await ai.chatRaw(settings, [{ role: 'user', content: '杭州' }], {
    jsonMode: true,
    tools: [{ type: 'function', function: { name: 'search_travel_knowledge', parameters: { type: 'object' } } }],
    thinking: 'disabled'
  });
  assert.equal(result.finishReason, 'tool_calls');
  assert.equal(result.message.tool_calls[0].function.name, 'search_travel_knowledge');
  const body = mock.requests[0];
  assert.equal(body.model, 'deepseek-flash');
  assert.equal(body.thinking, undefined, '第三方兼容地址不应收到 DeepSeek 专属字段');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.max_tokens, 8000);
});

test('DeepSeek 专属参数只按官方主机判断，不按模型名猜测', () => {
  assert.equal(ai.isDeepSeek({ baseUrl: 'https://api.deepseek.com/v1' }), true);
  assert.equal(ai.isDeepSeek({ baseUrl: 'https://openrouter.ai/api/v1', model: 'deepseek-flash' }), false);
});

test('AI 客户端解析 SSE 思考与逐字内容', async (t) => {
  const mock = await startMock();
  t.after(() => mock.server.close());
  const address = mock.server.address();
  const settings = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    apiKey: 'test-key',
    keySource: 'server',
    model: 'deepseek-flash',
    lang: 'zh'
  };
  const deltas = [];
  const reasoning = [];
  const result = await ai.chatStream(settings, [{ role: 'user', content: '杭州' }], {
    onDelta: (text) => deltas.push(text),
    onReasoning: (text) => reasoning.push(text)
  });
  assert.equal(result.content, '杭州适老建议');
  assert.deepEqual(deltas, ['杭州', '适老建议']);
  assert.deepEqual(reasoning, ['先分析']);
  assert.equal(mock.requests[0].stream, true);
});
