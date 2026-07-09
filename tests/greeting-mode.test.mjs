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

// === greetingCount 应真正驱动 generate_greeting 生成 N 条候选 ===
// 回归：generate_greeting 的两个 handler 签名没收 greetingCount，user prompt 又硬编码"生成 1 段"，
// 导致用户在引导页选 1/3/5 条完全失效。下面覆盖 prompt 构造 + content 端候选选取。

function loadFn(file, name) {
  const source = read(file);
  const code = extractFunction(source, name);
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', `${code}\nmodule.exports = { ${name} };`);
  factory(module);
  return module.exports[name];
}

test('greeting user prompt: count=1 keeps single-段 wording (backward compatible)', () => {
  const build = loadFn('src/background/runtime.js', 'constructGreetingUserPrompt');
  const p = build('我的简历', '岗位详情', 'HR', '经理', 1);
  assert.ok(p.includes('生成 1 段'), 'count=1 仍为"生成 1 段"');
  assert.ok(!p.includes('|||'), 'count=1 不应含分隔符');
  assert.ok(p.includes('我的简历'), '简历内容要带入');
});

test('greeting user prompt: count>1 asks for N 条 + ||| separator, clamped to [1,5]', () => {
  const build = loadFn('src/background/runtime.js', 'constructGreetingUserPrompt');

  const p3 = build('简历', 'JD', 'HR', '经理', 3);
  assert.ok(p3.includes('3 条'), 'count=3 应要求"3 条"');
  assert.ok(p3.includes('|||'), 'count=3 应含 ||| 分隔符');

  const p5 = build('简历', 'JD', 'HR', '经理', 5);
  assert.ok(p5.includes('5 条') && p5.includes('|||'));

  const pHuge = build('简历', 'JD', 'HR', '经理', 99);
  assert.ok(pHuge.includes('5 条') && !pHuge.includes('99'), 'count=99 应 clamp 到 5');
});

test('greeting user prompt: 未传 count 走单段（与旧调用方兼容）', () => {
  const build = loadFn('src/background/runtime.js', 'constructGreetingUserPrompt');
  assert.ok(build('r', 'j', 'h', 't').includes('生成 1 段'));
  assert.ok(build('r', 'j', 'h', 't', undefined).includes('生成 1 段'));
});

test('prepareChatSystemPrompt: count>1 时追加 N 条指令，与 user prompt 一致', () => {
  // 避免与 DEFAULT_CHAT_SYSTEM_PROMPT 的"生成一段"矛盾：count>1 时 system 也要配合要求多条。
  const prep = loadFn('src/background/runtime.js', 'prepareChatSystemPrompt');
  // count=1 / 未传：原样返回 base，不注入
  assert.equal(prep('我的风格', 1), '我的风格');
  assert.equal(prep('我的风格', undefined), '我的风格');
  // count=3：保留原 base 并追加多条指令
  const sys3 = prep('我的风格', 3);
  assert.ok(sys3.startsWith('我的风格'), '保留原 system prompt');
  assert.ok(sys3.includes('3 条') && sys3.includes('|||'), '注入"3 条"+分隔符');
  // clamp 到 5
  assert.ok(prep('我的风格', 99).includes('5 条'));
});

test('pickGreetingCandidate: 单条原样返回', () => {
  const pick = loadFn('src/content/runtime.js', 'pickGreetingCandidate');
  assert.equal(pick('您好，我对岗位很感兴趣。'), '您好，我对岗位很感兴趣。');
});

test('pickGreetingCandidate: 多条返回候选之一', () => {
  const pick = loadFn('src/content/runtime.js', 'pickGreetingCandidate');
  const candidates = ['话术A', '话术B', '话术C'];
  // 多次抽样，确认每次都落在候选集合内
  for (let i = 0; i < 10; i++) {
    const picked = pick(candidates.join(' ||| '));
    assert.ok(candidates.includes(picked), `${picked} 应为候选之一`);
  }
});

test('pickGreetingCandidate: 去除 markdown 包裹 + 空串安全', () => {
  const pick = loadFn('src/content/runtime.js', 'pickGreetingCandidate');
  // serverless 路径未去 ```，content 端需兜底
  assert.equal(pick('```\n您好\n```'), '您好');
  // 带语言标识的代码块：残留 "json"/"text" 会污染发给 HR 的话术，必须一并去除
  assert.equal(pick('```json\n您好\n```'), '您好');
  assert.equal(pick('```text\n您好\n```'), '您好');
  assert.equal(pick('   '), '');
  assert.equal(pick(''), '');
});

// === 跨标签页停止同步：后台打开的沟通页不得在用户停止后继续自动发送 ===
// 回归：在投递列表页点"停止"只重置了本页内存态(isAutoApplying)，后台由 openInNewTab
// 打开的沟通页仍在跑 checkPendingGreeting 并 click 发送。需要用 storage 时间戳做跨页停止门控。
test('isStoppedAfterPending: 停止发生在 pending 创建之后 → 应中止发送', () => {
  const stoppedAfter = loadFn('src/content/runtime.js', 'isStoppedAfterPending');
  // pending 创建于 T=100，用户在 T=200 点停止 → 必须中止
  assert.equal(stoppedAfter(200, 100), true, '停止晚于 pending 创建 → true');
  // 恰好相等视为未在其后（停止必须严格晚于创建才说明 pending 是"停止前残留"）
  assert.equal(stoppedAfter(100, 100), false, '同时刻 → false');
});

test('isStoppedAfterPending: 停止发生在 pending 创建之前 → 正常发送', () => {
  const stoppedAfter = loadFn('src/content/runtime.js', 'isStoppedAfterPending');
  // 停止 T=100，之后循环重新启动并在 T=200 写入新 pending → 该 pending 应被放行
  assert.equal(stoppedAfter(100, 200), false, '停止早于 pending 创建 → false');
});

test('isStoppedAfterPending: 缺失任一时间戳 → 不中止（容错，避免误杀）', () => {
  const stoppedAfter = loadFn('src/content/runtime.js', 'isStoppedAfterPending');
  assert.equal(stoppedAfter(undefined, 100), false, '无停止时间戳 → false');
  assert.equal(stoppedAfter(100, undefined), false, '无 pending 时间戳 → false');
  assert.equal(stoppedAfter(null, null), false);
  assert.equal(stoppedAfter(0, 0), false);
});
