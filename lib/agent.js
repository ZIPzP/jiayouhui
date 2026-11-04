'use strict';
// @ts-check
/**
 * 最小工具调用循环：模型选择白名单工具，服务端校验参数并执行，再把结果回填给模型。
 * 设最大轮次和工具数量上限，避免模型在异常情况下无限规划。
 */
const ai = require('./ai');

/** 把模型返回的工具参数安全解析为普通对象；非法 JSON 返回 null。 */
function safeArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const value = JSON.parse(String(raw));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return null;
  }
}

async function runToolLoop(options) {
  const {
    settings,
    messages,
    tools,
    executeTool,
    maxRounds = 4,
    maxCalls = 6,
    totalTimeoutMs = 170000,
    onEvent = () => {}
  } = options;
  if (typeof executeTool !== 'function') throw new Error('Tool executor is required');
  const allowed = new Set((tools || []).map((tool) => tool.function && tool.function.name).filter(Boolean));
  const conversation = messages.map((message) => ({ ...message }));
  const trace = [];
  let toolCalls = 0;
  const deadline = Date.now() + Math.max(1000, Number(totalTimeoutMs) || 170000);

  for (let round = 0; round < maxRounds; round++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('AI 工具循环超时');
    onEvent({ type: 'model', round: round + 1 });
    const result = await ai.chatRaw(settings, conversation, {
      // Tool Calls 与 JSON Output 的组合并非所有兼容网关都支持；工具轮次先只开启 tools，
      // 最终结果若无法解析，再由调用方用 JSON 模式修复。
      jsonMode: false,
      tools,
      toolChoice: 'auto',
      thinking: 'disabled',
      temperature: 0.25,
      timeoutMs: remaining
    });
    const calls = Array.isArray(result.message.tool_calls) ? result.message.tool_calls : [];
    if (!calls.length) {
      return {
        content: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
        trace,
        messages: conversation
      };
    }

    toolCalls += calls.length;
    if (toolCalls > maxCalls) throw new Error('工具调用次数超过安全上限');
    conversation.push({
      role: 'assistant',
      content: result.message.content || null,
      tool_calls: calls
    });

    for (const call of calls) {
      const name = call && call.function && call.function.name;
      // 只执行声明过的白名单工具，模型不能借 tool_calls 访问任意函数。
      if (!allowed.has(name)) throw new Error('模型请求了未授权工具：' + String(name || 'unknown'));
      // 参数必须在执行前通过 JSON 对象校验，防止字符串或畸形结构进入下游。
      if (!safeArgs(call && call.function && call.function.arguments)) throw new Error('工具参数不是合法 JSON：' + name);
    }
    const executed = await Promise.all(calls.map(async (call) => {
      const name = call.function.name;
      const args = safeArgs(call.function.arguments);
      const started = Date.now();
      onEvent({ type: 'tool', name, status: 'running', args });
      let resultData;
      let ok = true;
      try {
        resultData = await executeTool(name, args);
      } catch (error) {
        // 单个工具失败只回填错误，不中断同一轮中已经成功的事实查询。
        ok = false;
        resultData = { error: String((error && error.message) || error) };
      }
      return { call, name, args, resultData, ok, durationMs: Date.now() - started };
    }));
    for (const item of executed) {
      const { call, name, args, resultData, ok, durationMs } = item;
      trace.push({
        name,
        ok,
        durationMs,
        args,
        summary: resultData && resultData.summary ? String(resultData.summary) : (ok ? '工具执行完成' : resultData.error)
      });
      onEvent({ type: 'tool', name, status: ok ? 'done' : 'error', durationMs, summary: trace[trace.length - 1].summary });
      const payload = JSON.stringify(resultData);
      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        // 工具结果回填设上限，避免异常上游把提示词撑爆并增加费用。
        content: payload.length > 16000 ? payload.slice(0, 16000) + '…[truncated]' : payload
      });
    }
  }
  throw new Error('AI 工具调用轮次超过上限');
}

module.exports = { runToolLoop, safeArgs };
