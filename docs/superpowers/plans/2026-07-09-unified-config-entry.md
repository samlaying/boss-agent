# 统一配置入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让浮动面板与 popup 都能一键打开配置中心（`options.html`），向导仅首次运行、之后不再重放，并消除配置侧与后台的存储 key 分歧使"改了即生效"。

**Architecture:** 配置中心（`options.html`）作为唯一真相源；面板/popup 退化为入口。新增共享 `openConfigCenter()` 工具 + background `open_options` action 负责真正打开页面。新增 `src/background/config.js` 作为后台读取层（`runtimeConfig`），集中读取规范 key、解析模型、一次性迁移老 key；后台各 handler 改经它取值，移除硬编码模型与旧 key 直读。

**Tech Stack:** Chrome Extension MV3、原生 JS + Vue 3（popup/options）、webpack、`node --test`。

**Spec:** `docs/superpowers/specs/2026-07-09-unified-config-entry-design.md`

## Global Constraints

- 所有新增存储 key 必须走 `src/utils/constants.js` 的 `STORAGE_KEYS`，不得裸写字符串。
- 不重写大单体 `content/runtime.js`；不动 energy 体系、不动 lab mode、不新增配置项。
- 向导组件保留（首次仍用），仅改"设置"入口绑定，不删向导。
- 老用户旧 key 迁移只搬运不删除（可回滚）。
- 测试用 `node --test tests/*.test.mjs`；纯函数走 `tests/*.test.mjs` 里 `extractFunction` 沙箱模式（与 `greeting-mode.test.mjs` 一致）。
- 每个 Task 末尾提交一次，commit message 用 conventional commits 中文。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/utils/constants.js` | 集中 key/消息类型/模型预设 | Modify：加 `MESSAGE_TYPES.OPEN_OPTIONS`、`STORAGE_KEYS.CONFIG_MIGRATED` |
| `src/utils/open-config.js` | 共享"打开配置中心"入口（屏蔽环境差异） | Create |
| `src/background/runtime.js` | service worker 消息处理 + AI 调用 | Modify：加 `open_options` action；handler 改用 runtimeConfig |
| `src/background/config.js` | runtimeConfig 读取层 + 模型解析 + 迁移 | Create |
| `src/content/runtime.js` | 浮动面板 | Modify：加「⚙ 设置」按钮 + 只读摘要 |
| `src/popup/App.vue` | popup 根 | Modify：设置入口改 `openConfigCenter` |
| `src/popup/components/AppHeader.vue` | 头部齿轮 | Modify：title/语义改"设置" |
| `src/popup/views/DashboardView.vue` | 已配置视图 | Modify：移除"重新运行新手引导"按钮 |
| `tests/runtime-config.test.mjs` | config.js 纯函数测试 | Create |
| `tests/open-config.test.mjs` | open-config 纯函数测试 | Create |

---

### Task 1: 共享 `openConfigCenter()` + background `open_options` action

**Files:**
- Modify: `src/utils/constants.js`
- Create: `src/utils/open-config.js`
- Modify: `src/background/runtime.js`（在 `close_tab` action 块之后插入）

**Interfaces:**
- Produces: `openConfigCenter()`（`src/utils/open-config.js`，无参，返回 `Promise<boolean>`）；background `action: "open_options"`（返回 `{success:true}`）。Task 5、Task 6 消费 `openConfigCenter()`。

- [ ] **Step 1: constants.js 加消息类型**

在 `src/utils/constants.js` 的 `MESSAGE_TYPES` 对象内追加一行（放在 `SAVE_SETTINGS` 之后）：

```js
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
```

- [ ] **Step 2: 创建 `src/utils/open-config.js`**

```js
// 共享"打开配置中心"入口。
// popup/options（扩展页）环境有 chrome.runtime.openOptionsPage → 直接打开；
// content script 无该方法 → 委托 background 的 open_options action 打开。
export function openConfigCenter() {
  return new Promise((resolve) => {
    const fallback = () => {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, () => resolve(true));
      } catch {
        resolve(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime.lastError) fallback();
        else resolve(true);
      });
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // content script 环境：委托后台
      try {
        chrome.runtime.sendMessage({ action: 'open_options' }, () => resolve(true));
      } catch {
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}
```

- [ ] **Step 3: background runtime.js 加 `open_options` action**

在 `src/background/runtime.js` 的 `chrome.runtime.onMessage.addListener` 内，紧接 `close_tab` action 块（即 `if (request.action === "close_tab") { ... }` 整块结束之后、`generate_onboarding_greeting` 块之前）插入：

```js
    // === 打开配置中心 (options.html) ===
    // content script 无 openOptionsPage 权限，统一委托到这里打开。
    if (request.action === "open_options") {
        chrome.runtime.openOptionsPage(() => {
            if (chrome.runtime.lastError) {
                chrome.tabs.create({ url: chrome.runtime.getURL("options.html") }, () => {
                    sendResponse({ success: true });
                });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;
    }
```

- [ ] **Step 4: 验证编译与既有测试不回归**

Run: `npm test`
Expected: 全部通过（31+ 测试，数量随后续任务增长）。

Run: `npm run build:dev`
Expected: webpack 编译成功，无报错。

- [ ] **Step 5: Commit**

```bash
git add src/utils/constants.js src/utils/open-config.js src/background/runtime.js
git commit -m "feat: 新增统一配置入口 openConfigCenter + background open_options action"
```

---

### Task 2: runtimeConfig 模型解析纯函数（TDD）

**Files:**
- Create: `src/background/config.js`
- Create: `tests/runtime-config.test.mjs`

**Interfaces:**
- Produces: `pickModelById(modelId, presetModels, customModels)` → 返回 `{ id, name, endpoint, model }` 或 `null`。Task 3、Task 4 消费。

- [ ] **Step 1: 写失败测试**

创建 `tests/runtime-config.test.mjs`：

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found`);
  let i = source.indexOf('{', start);
  if (i === -1) throw new Error(`function ${name} has no body`);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error('body unbalanced');
}

function loadFn(file, name) {
  const code = extractFunction(read(file), name);
  const module = { exports: {} };
  const factory = new Function('module', `${code}\nmodule.exports = { ${name} };`);
  factory(module);
  return module.exports[name];
}

const PRESETS = [
  { id: 'deepseek-v4-flash', name: 'Flash', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  { id: 'deepseek-v4-pro', name: 'Pro', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
];

test('pickModelById: 命中预置模型', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  const m = pick('deepseek-v4-pro', PRESETS, []);
  assert.equal(m && m.model, 'deepseek-v4-pro');
});

test('pickModelById: 命中自定义模型（与预置合并后查找）', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  const customs = [{ id: 'glm', name: 'GLM', endpoint: 'https://glm/api', model: 'glm-4' }];
  const m = pick('glm', PRESETS, customs);
  assert.equal(m && m.endpoint, 'https://glm/api');
});

test('pickModelById: id 为空或未命中 → null（由调用方回退默认）', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  assert.equal(pick('', PRESETS, []), null);
  assert.equal(pick('not-exist', PRESETS, []), null);
  assert.equal(pick(undefined, PRESETS, [{ id: 'x' }]), null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/runtime-config.test.mjs`
Expected: FAIL — `function pickModelById not found in config.js`。

- [ ] **Step 3: 创建 `src/background/config.js`（先只放纯函数）**

```js
// 后台配置读取层（runtimeConfig）：集中读取 STORAGE_KEYS 规范 key，
// 解析模型，迁移老 key。供 background/runtime.js 各 handler 使用。
import { STORAGE_KEYS, PRESET_MODELS, DEFAULT_MODEL_ID } from '../utils/constants.js';
import { storageGet, storageSet } from '../utils/storage.js';

// 纯函数：在 预置+自定义 模型集合中按 id 解析。
// 命中返回 { id, name, endpoint, model }；未命中/空 id 返回 null（调用方回退默认）。
function pickModelById(modelId, presetModels, customModels) {
    if (!modelId) return null;
    const presets = Array.isArray(presetModels) ? presetModels : [];
    const customs = Array.isArray(customModels) ? customModels : [];
    const merged = [...presets, ...customs];
    return merged.find((m) => m && m.id === modelId) || null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/runtime-config.test.mjs`
Expected: 3 个测试全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/background/config.js tests/runtime-config.test.mjs
git commit -m "feat(config): 新增 runtimeConfig 模型解析纯函数 pickModelById"
```

---

### Task 3: runtimeConfig 异步读取 + 一次性迁移（TDD）

**Files:**
- Modify: `src/background/config.js`（追加异步读取层 + 迁移纯函数 + 迁移执行函数）
- Modify: `src/utils/constants.js`（加 `STORAGE_KEYS.CONFIG_MIGRATED`）
- Modify: `tests/runtime-config.test.mjs`（加迁移纯函数测试）

**Interfaces:**
- Produces:
  - `decideLegacyMigration(stored)` — 纯函数，入参 `{ analysisPrompt, greetingPrompt, systemPrompt, chatSystemPrompt, migrated }`，返回 `{ analysisPrompt?, greetingPrompt?, shouldMark }`（仅返回需要写入的字段；无变化返回空对象）。
  - `getAnalysisSystemPrompt()` → `Promise<string|null>`
  - `getGreetingSystemPrompt()` → `Promise<string|null>`
  - `resolveModel(role)`（role: `'analysis' | 'greeting'`）→ `Promise<{endpoint,model,name,id}|null>`
  - `migrateLegacyConfig()` → `Promise<void>`（幂等，读旧 key、按 decide 结果写新 key、置 `CONFIG_MIGRATED`）
- Task 4 消费前三个 getter；Task 7 消费 `migrateLegacyConfig`。

- [ ] **Step 1: constants.js 加迁移标记 key**

在 `src/utils/constants.js` 的 `STORAGE_KEYS` 内追加：

```js
  SETUP_COMPLETED: 'setupCompleted',
  CONFIG_MIGRATED: 'configMigratedV1',
```

- [ ] **Step 2: 写迁移纯函数失败测试**

在 `tests/runtime-config.test.mjs` 末尾追加：

```js
test('decideLegacyMigration: 新 key 空且旧 key 有值 → 搬运', () => {
  const decide = loadFn('src/background/config.js', 'decideLegacyMigration');
  const r = decide({
    analysisPrompt: '', greetingPrompt: '',
    systemPrompt: '旧分析', chatSystemPrompt: '旧话术', configMigratedV1: false,
  });
  assert.equal(r.analysisPrompt, '旧分析');
  assert.equal(r.greetingPrompt, '旧话术');
  assert.equal(r.shouldMark, true);
});

test('decideLegacyMigration: 新 key 已有值 → 不覆盖', () => {
  const decide = loadFn('src/background/config.js', 'decideLegacyMigration');
  const r = decide({
    analysisPrompt: '新分析', greetingPrompt: '新话术',
    systemPrompt: '旧分析', chatSystemPrompt: '旧话术', configMigratedV1: false,
  });
  assert.equal(r.analysisPrompt, undefined);
  assert.equal(r.greetingPrompt, undefined);
  assert.equal(r.shouldMark, true); // 仍标记完成，避免反复进入
});

test('decideLegacyMigration: 已迁移 → 全空、不动作', () => {
  const decide = loadFn('src/background/config.js', 'decideLegacyMigration');
  const r = decide({ analysisPrompt: '', greetingPrompt: '', systemPrompt: 'x', chatSystemPrompt: 'y', configMigratedV1: true });
  assert.deepEqual(r, {});
});
```

- [ ] **Step 3: 运行确认失败**

Run: `node --test tests/runtime-config.test.mjs`
Expected: 3 个新测试 FAIL（`decideLegacyMigration not found`），Task 2 的 3 个仍 PASS。

- [ ] **Step 4: 在 `src/background/config.js` 追加实现**

在文件末尾追加：

```js
// 迁移决策纯函数：老 key(systemPrompt/chatSystemPrompt) → 新 key(analysisPrompt/greetingPrompt)。
// 仅当新 key 为空且未迁移时搬运；已迁移则什么都不做。返回需要写入的字段。
// 注意：用字面量键（非 STORAGE_KEYS.*），因为单测用 extractFunction 沙箱隔离求值，
// 沙箱内 STORAGE_KEYS 不在作用域；字面量键与 migrateLegacyConfig 经 storageGet 返回的键一致。
function decideLegacyMigration(stored) {
    const migrated = stored && stored.configMigratedV1 === true;
    if (migrated) return {};
    const out = { shouldMark: true };
    if (!stored.analysisPrompt && stored.systemPrompt) {
        out.analysisPrompt = stored.systemPrompt;
    }
    if (!stored.greetingPrompt && stored.chatSystemPrompt) {
        out.greetingPrompt = stored.chatSystemPrompt;
    }
    return out;
}

// 异步读取：分析用 system prompt（来自配置中心的 analysisPrompt），空返回 null（调用方回退默认）。
export async function getAnalysisSystemPrompt() {
    const d = await storageGet([STORAGE_KEYS.ANALYSIS_PROMPT]);
    return d && d[STORAGE_KEYS.ANALYSIS_PROMPT] ? d[STORAGE_KEYS.ANALYSIS_PROMPT] : null;
}

// 异步读取：话术用 system prompt（来自配置中心的 greetingPrompt），空返回 null。
export async function getGreetingSystemPrompt() {
    const d = await storageGet([STORAGE_KEYS.GREETING_PROMPT]);
    return d && d[STORAGE_KEYS.GREETING_PROMPT] ? d[STORAGE_KEYS.GREETING_PROMPT] : null;
}

// 解析当前应使用的模型。role: 'analysis' | 'greeting'。未配置/未命中返回 null（调用方回退默认）。
export async function resolveModel(role) {
    const key = role === 'analysis' ? STORAGE_KEYS.ANALYSIS_MODEL : STORAGE_KEYS.GREETING_MODEL;
    const d = await storageGet([key, STORAGE_KEYS.CUSTOM_MODELS]);
    const id = (d && d[key]) || DEFAULT_MODEL_ID;
    return pickModelById(id, PRESET_MODELS, (d && d[STORAGE_KEYS.CUSTOM_MODELS]) || []);
}

// 一次性迁移（幂等）：启动时调用。读旧 key、按决策写新 key、置 CONFIG_MIGRATED。只搬运不删旧 key。
export async function migrateLegacyConfig() {
    const stored = await storageGet([
        STORAGE_KEYS.CONFIG_MIGRATED,
        STORAGE_KEYS.ANALYSIS_PROMPT,
        STORAGE_KEYS.GREETING_PROMPT,
        'systemPrompt',
        'chatSystemPrompt',
    ]);
    const decision = decideLegacyMigration(stored);
    if (Object.keys(decision).length === 0) return; // 已迁移
    const toWrite = {};
    if (decision[STORAGE_KEYS.ANALYSIS_PROMPT]) toWrite[STORAGE_KEYS.ANALYSIS_PROMPT] = decision[STORAGE_KEYS.ANALYSIS_PROMPT];
    if (decision[STORAGE_KEYS.GREETING_PROMPT]) toWrite[STORAGE_KEYS.GREETING_PROMPT] = decision[STORAGE_KEYS.GREETING_PROMPT];
    toWrite[STORAGE_KEYS.CONFIG_MIGRATED] = true;
    await storageSet(toWrite);
}
```

注意：`decideLegacyMigration` 与 `pickModelById` 故意不 `export`（仅供本文件 + 测试沙箱通过函数名提取）。

- [ ] **Step 5: 运行确认通过**

Run: `node --test tests/runtime-config.test.mjs`
Expected: 全部 PASS（Task 2 的 3 + Task 3 的 3 = 6）。

- [ ] **Step 6: Commit**

```bash
git add src/background/config.js src/utils/constants.js tests/runtime-config.test.mjs
git commit -m "feat(config): 新增 prompt 读取/模型解析/老 key 一次性迁移"
```

---

### Task 4: 后台 handler 接入 runtimeConfig（替换旧 key 与硬编码模型）

**Files:**
- Modify: `src/background/runtime.js`：`call_deepseek` 块、`generate_greeting` 块、`handleDirectCall`、`handleServerlessCall`、`handleDirectGreetingCall`、`handleServerlessGreetingCall`

**Interfaces:**
- Consumes: `getAnalysisSystemPrompt`、`getGreetingSystemPrompt`、`resolveModel`（来自 Task 3）。

- [ ] **Step 1: 顶部 import runtimeConfig**

在 `src/background/runtime.js` 顶部 `import { handleMessage } from "./router.js";` 下一行加：

```js
import { getAnalysisSystemPrompt, getGreetingSystemPrompt, resolveModel } from "./config.js";
```

- [ ] **Step 2: `call_deepseek` 块改用新 prompt**

定位 `if (request.action === "call_deepseek")` 块内的 `chrome.storage.local.get([...], async (data) => {...})`。

将其中的读取键数组里的 `'systemPrompt'` **删除**，并在 `try {` 之后、模式分支之前插入：

```js
                // systemPrompt 改读配置中心的 analysisPrompt（经 runtimeConfig，空则下方 prepareSystemPrompt 用默认）
                const dataSystemPrompt = await getAnalysisSystemPrompt();
```

然后把该块内两处传入的 `data.systemPrompt`：
- `await handleDirectCall(data.apiKey, data.systemPrompt, ...)` → `dataSystemPrompt`
- `await handleServerlessCall(clientId, data.systemPrompt, ...)` → `dataSystemPrompt`

（即把 `data.systemPrompt` 替换为 `dataSystemPrompt`。）

- [ ] **Step 3: `generate_greeting` 块改用新 prompt**

定位 `if (request.action === "generate_greeting")` 块内的 `chrome.storage.local.get(['apiKey', 'chatSystemPrompt', ...])`。

- 读取键数组里的 `'chatSystemPrompt'` **删除**。
- 在 `try {` 之后插入：

```js
                const dataChatPrompt = await getGreetingSystemPrompt();
```

- 两处 `data.chatSystemPrompt`（传入 `handleDirectGreetingCall` / `handleServerlessGreetingCall`）替换为 `dataChatPrompt`。

- [ ] **Step 4: 直连分析 `handleDirectCall` 用所选模型**

定位 `async function handleDirectCall(apiKey, systemPrompt, resume, jobText, hrName, bossTitle, sendResponse, tabId, greetingCount)` 内的 `const payload = { model: "deepseek-v4-flash", ... }`。

在该 `const payload` **之前**插入模型解析：

```js
    // 模型改用配置中心所选（analysis），未配置/未命中回退默认 deepseek-v4-flash
    const modelCfg = await resolveModel('analysis');
    const modelName = (modelCfg && modelCfg.model) || "deepseek-v4-flash";
```

并把 `model: "deepseek-v4-flash"` 改为 `model: modelName`。

- [ ] **Step 5: serverless 分析 `handleServerlessCall`**

该函数当前不直接发 model（透传给云函数），**无需改模型**，仅确认其用 `prepareSystemPrompt(systemPrompt, ...)`——systemPrompt 已由 Task 4 Step 2 改为来自 `analysisPrompt`。无需改动。验证其内无 `model:` 硬编码即可。

- [ ] **Step 6: 直连话术 `handleDirectGreetingCall` 用所选模型**

定位其 `const payload = { model: "deepseek-v4-flash", ... }`，同样在 payload 之前插入：

```js
    const modelCfg = await resolveModel('greeting');
    const modelName = (modelCfg && modelCfg.model) || "deepseek-v4-flash";
```

把 `model: "deepseek-v4-flash"` 改为 `model: modelName`。

- [ ] **Step 7: serverless 话术 `handleServerlessGreetingCall`**

与 Step 5 同理，透传云函数、不直接发 model，无需改模型。

- [ ] **Step 8: 验证编译 + 全量测试 + lint**

Run: `npm run build:dev`
Expected: 编译成功。

Run: `npm test`
Expected: 全部 PASS。

Run: `npx eslint src/background/runtime.js src/background/config.js`
Expected: 0 error（warning 可接受）。

- [ ] **Step 9: Commit**

```bash
git add src/background/runtime.js
git commit -m "feat(background): 分析/话术 handler 接入 runtimeConfig，移除硬编码模型与旧 prompt key"
```

---

### Task 5: 浮动面板「⚙ 设置」入口 + 只读摘要

**Files:**
- Modify: `src/content/runtime.js`：面板 HTML（`btn-auto-loop` 等按钮所在控制区）、新增渲染摘要函数、绑定按钮。

**Interfaces:**
- Consumes: `openConfigCenter()`（来自 Task 1）。

> 说明：content bundle（`content.bundle.js`）由 webpack 从 `src/content/index.js` 构建；`content/runtime.js` 若以模块形式被打包，可在顶部 `import { openConfigCenter } from '../utils/open-config.js'`。若该文件当前不使用 ESM import（纯全局脚本），则改为在按钮点击时 `chrome.runtime.sendMessage({ action: 'open_options' })` 直发后台（等价语义）。**实现时先确认 `src/content/index.js` 是否 import runtime.js 为模块**：
> Run: `cat src/content/index.js`
> - 若含 `import './runtime.js'` 或类似 → 用 `import { openConfigCenter } from '../utils/open-config.js'`。
> - 否则 → 按钮处理器内直接 `chrome.runtime.sendMessage({ action: 'open_options' })`，不引入 util。

- [ ] **Step 1: 确认 content 入口模块形态**

Run: `cat src/content/index.js`
据结果选择 Step 2 的接线方式（见上方说明）。

- [ ] **Step 2: 面板控制区加「⚙ 设置」按钮**

定位 `src/content/runtime.js` 中 `id="btn-auto-loop"` 按钮所在的 HTML 模板字符串（约 `initWrapper` 内的控制区），在该控制区内新增按钮：

```html
<button id="btn-open-options" style="flex:1; padding:8px; background:#fff; color:#00796b; border:1px solid #b2dfdb; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">⚙ 设置</button>
```

- [ ] **Step 3: 绑定按钮 → 打开配置中心**

在按钮事件绑定处（与 `btn-auto-loop`、`btn-stop-auto-loop` 同区，约 `bindEvents`/`safeBind` 区域，参考现有 `safeBind('btn-stop-auto-loop', ...)` 模式）新增：

```js
    safeBind('btn-open-options', function () {
        // 优先用共享 util；不可用时直发后台 action
        if (typeof openConfigCenter === 'function') {
            openConfigCenter();
        } else {
            chrome.runtime.sendMessage({ action: 'open_options' });
        }
    });
```

（若 Step 1 判定为非 ESM，删去 `openConfigCenter` 分支，只保留 `sendMessage`。）

- [ ] **Step 4: 面板头部只读摘要**

在 `src/content/runtime.js` 新增渲染函数（放在其他 UI 辅助函数附近）：

```js
// 只读配置摘要：模型 / 模式 / 能量。仅展示，编辑请去配置中心。
async function renderConfigSummary() {
    const el = document.getElementById('boss-config-summary');
    if (!el) return;
    try {
        const d = await new Promise((r) => chrome.storage.local.get(
            ['greetingModel', 'computeMode', 'energyCount'], r));
        const mode = d.computeMode === 'custom_key' ? '自有Key' : '能量';
        const energy = (d.computeMode === 'custom_key') ? '' : ` · 能量${d.energyCount ?? 0}`;
        const model = d.greetingModel || '默认';
        el.innerText = `模型: ${model} · 模式: ${mode}${energy}`;
    } catch (e) {
        el.innerText = '';
    }
}
```

在面板 HTML 头部（标题下方）加挂载点：

```html
<div id="boss-config-summary" style="font-size:11px;color:#90a4ae;padding:2px 12px 6px;"></div>
```

并在面板初始化/周期性刷新处调用一次 `renderConfigSummary()`（可挂在现有的 `setInterval(... applyHistoryToCards, 1000)` 同一节拍，或 `initWrapper` 末尾）。

- [ ] **Step 5: 验证编译 + 测试 + lint**

Run: `npm run build:dev` → 成功。
Run: `npm test` → 全 PASS。
Run: `npx eslint src/content/runtime.js` → 0 error。

- [ ] **Step 6: Commit**

```bash
git add src/content/runtime.js
git commit -m "feat(panel): 浮动面板新增设置入口与只读配置摘要"
```

---

### Task 6: popup 设置入口改开配置中心、移除"重新引导"

**Files:**
- Modify: `src/popup/App.vue`
- Modify: `src/popup/components/AppHeader.vue`
- Modify: `src/popup/views/DashboardView.vue`

**Interfaces:**
- Consumes: `openConfigCenter()`（来自 Task 1）。

- [ ] **Step 1: App.vue 设置入口改开配置中心**

`src/popup/App.vue` `<script setup>` 顶部加 import：

```js
import { openConfigCenter } from '../utils/open-config.js';
```

将模板中 `<AppHeader :show-settings="isDashboard" @open-settings="startWizard" />` 改为：

```js
    <AppHeader
      :show-settings="isDashboard"
      @open-settings="openConfigCenter"
    />
```

（`startWizard` 函数保留不删——首次未完成分支仍由 `isDashboard=false` 自然进入向导，不经设置入口。）

- [ ] **Step 2: AppHeader 齿轮语义改"设置"**

`src/popup/components/AppHeader.vue` 中将：

```html
      <span
        v-if="showSettings"
        class="settings-btn"
        title="重新配置"
        @click="$emit('open-settings')"
      >⚙️</span>
```

的 `title="重新配置"` 改为 `title="打开设置"`。

- [ ] **Step 3: DashboardView 移除"重新运行新手引导"按钮**

`src/popup/views/DashboardView.vue` 模板中，删除二级动作里的"重新运行新手引导"按钮：

```html
        <button @click="emit('reconfigure')">
          <span>↺</span>
          重新运行新手引导
        </button>
```

（保留同区的"打开完整设置"按钮——它已正确调用 `openOptions()`。）

为保持两列布局，把 `.secondary-actions` 由 `grid-template-columns: 1fr 1fr` 改为单列：

```css
.secondary-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 8px;
}
```

`<script setup>` 中 `defineEmits(['reconfigure'])` / `const emit = defineEmits(['reconfigure'])` 若不再有其他 emit 使用，可删除（删除前确认无其他引用；本步骤后无引用即可删）。

- [ ] **Step 4: 验证编译 + 测试 + lint**

Run: `npm run build:dev` → 成功。
Run: `npm test` → 全 PASS。
Run: `npx eslint src/popup/` → 0 error。

- [ ] **Step 5: Commit**

```bash
git add src/popup/App.vue src/popup/components/AppHeader.vue src/popup/views/DashboardView.vue
git commit -m "feat(popup): 设置入口改为打开配置中心，移除重新引导按钮"
```

---

### Task 7: 启动迁移 + 集成验收

**Files:**
- Modify: `src/background/runtime.js`（service worker 启动时调用 `migrateLegacyConfig`）

**Interfaces:**
- Consumes: `migrateLegacyConfig`（来自 Task 3）。

- [ ] **Step 1: 启动时执行一次性迁移**

`src/background/runtime.js` 顶部 import 补充：

```js
import { migrateLegacyConfig } from "./config.js";
```

在文件顶部 `console.log("🚀 Boss Agent: Background Service Started");` 之后插入：

```js
// 一次性迁移老用户配置（旧 systemPrompt/chatSystemPrompt → analysisPrompt/greetingPrompt）。幂等。
migrateLegacyConfig().catch((e) => console.warn('config migration failed:', e));
```

- [ ] **Step 2: 全量验证**

Run: `npm run build:dev` → 成功。
Run: `npm test` → 全 PASS（含 runtime-config、greeting-mode、其他）。
Run: `npx eslint src/` → 0 error。

- [ ] **Step 3: 手动验收清单（无法自动化的浏览器行为）**

在 `chrome://extensions/` 重新加载解包扩展，逐项确认：

- [ ] 未配置（清掉 `setupCompleted`）→ 打开 popup 自动进向导，走完不报错。
- [ ] 已配置 → popup Dashboard 头部齿轮点开 = 打开配置中心（新标签页 `options.html`），**不再重放向导**。
- [ ] Dashboard 不再有"重新运行新手引导"按钮；"打开完整设置"按钮正常开配置页。
- [ ] 在 Boss 直聘页，浮动面板有「⚙ 设置」按钮，点击打开配置中心；面板头部显示「模型: … · 模式: …」摘要。
- [ ] 在配置中心切换话术模型 → 保存 → 触发一次打招呼 → 网络请求用的是新模型（DevTools Network 验证 `model` 字段）。
- [ ] 在配置中心改分析提示词 → 触发分析 → 生效。
- [ ] 老用户 profile（手动在 storage 写入 `systemPrompt`/`chatSystemPrompt`、清空 `analysisPrompt`/`greetingPrompt`/`configMigratedV1`）→ 重载扩展 → `analysisPrompt`/`greetingPrompt` 被填充，`configMigratedV1=true`；再次重载不重复写。

- [ ] **Step 4: Commit**

```bash
git add src/background/runtime.js
git commit -m "feat(background): service worker 启动时执行一次性配置迁移"
```

---

## Self-Review（已自检）

- **Spec 覆盖**：US-1 首次向导→向导保留 + Task 6 不破坏首次分支；US-2 日常改配置→Task 1/5/6 入口；US-3 状态可见→Task 5 摘要；US-4 改了生效→Task 2/3/4 key 对齐；US-5 老用户迁移→Task 3/7。全覆盖。
- **Placeholder**：Task 5 Step 1/3 含"据形态二选一"——已给出两种分支的完整代码，非占位；其余步骤均有完整代码与命令。
- **类型/命名一致**：`openConfigCenter`、`pickModelById`、`decideLegacyMigration`、`getAnalysisSystemPrompt`、`getGreetingSystemPrompt`、`resolveModel`、`migrateLegacyConfig`、`open_options` action、`CONFIG_MIGRATED` key 在各 Task 间命名一致。
- **与 spec 一处实现细化**：spec §4.2 说"popup 与 content 都发 OPEN_OPTIONS 给后台"；实现中 popup 走共享 `openConfigCenter()`（其内部优先 `openOptionsPage` 直调，等价且更直接），content 经后台 action。语义一致（都打开同一 `options.html`），仅减少 popup 的不必要跳转。
