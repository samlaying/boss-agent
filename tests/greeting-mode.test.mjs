import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 从 runtime.js 源码里按函数名提取完整的 `function name(...){...}` 定义（平衡括号）。
function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found in runtime.js`);
  let i = source.indexOf('{', start);
  if (i === -1) throw new Error(`function ${name} has no body`);
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} body is unbalanced`);
}

function loadIsAiGreetingMode() {
  const source = read('src/content/runtime.js');
  const code = extractFunction(source, 'isAiGreetingMode');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', `${code}\nmodule.exports = { isAiGreetingMode };`);
  factory(module);
  return module.exports.isAiGreetingMode;
}

test('standard mode (fixed greeting) is NOT AI mode', () => {
  // 回归：自动沟通循环无条件调 generate_greeting，导致标准模式也触发 serverless
  // 的 Unknown Action 报错。标准模式必须被识别为"非 AI"，从而跳过 AI 请求。
  const isAi = loadIsAiGreetingMode();

  // 引导页标准模式持久化：COMPUTE_MODE='energy', GREETING_COUNT=0
  assert.equal(isAi('energy', 0), false, 'energy + 0 → standard');
  assert.equal(isAi('energy', undefined), false);
  assert.equal(isAi(undefined, undefined), false, '未配置默认按标准模式');
  assert.equal(isAi('energy', '0'), false, '字符串 "0" 也不是 AI 模式');
});

test('AI mode is custom_key or explicit positive greeting count', () => {
  // 与引导页 StepFeatures 的判断式对称：custom_key 或 greetingCount>0 即 AI 模式。
  const isAi = loadIsAiGreetingMode();

  // 引导页 AI 模式持久化：COMPUTE_MODE='custom_key', GREETING_COUNT=3
  assert.equal(isAi('custom_key', 3), true);
  assert.equal(isAi('custom_key', 0), true, 'custom_key 自身即 AI 模式');
  assert.equal(isAi('energy', 3), true, '显式条数 > 0 即 AI 模式');
});

test('side-panel AI toggle ON forces AI mode even in standard config', () => {
  // 侧边栏"AI自动打招呼"开关 ON 时，即便引导页是标准模式（energy + greetingCount=0），
  // 也必须走 AI 逐岗生成——否则开关形同虚设（按钮显示 ON 却不调 AI）。
  const isAi = loadIsAiGreetingMode();

  // 开关 ON：任意 computeMode/greetingCount 组合都应为 AI 模式
  assert.equal(isAi('energy', 0, true), true, '开关 ON + 标准模式 → AI');
  assert.equal(isAi('energy', undefined, true), true);
  assert.equal(isAi(undefined, undefined, true), true, '未配置 + 开关 ON → AI');

  // 开关 OFF / 未定义：维持原有判断（custom_key 或 greetingCount>0）
  assert.equal(isAi('energy', 0, false), false, '开关 OFF + 标准模式 → 非 AI');
  assert.equal(isAi('energy', 0, undefined), false, '开关未定义等同 OFF');
  assert.equal(isAi('custom_key', 0, false), true, '开关 OFF + custom_key 仍为 AI');
});
