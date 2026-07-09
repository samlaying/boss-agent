# 统一配置入口 · 产品设计 (Spec)

- 日期：2026-07-09
- 状态：已与用户确认决策，待评审
- 关联代码：`src/popup/`、`src/options/`、`src/content/runtime.js`、`src/background/runtime.js`、`src/utils/constants.js`

---

## 1. 背景与问题

配置/设置链路当前割裂，用户体感"抽象、不连贯、改了像没改"。查证后根因有三层：

1. **配置中心已存在但无人打开**：`options.html`（`OptionsApp.vue`）已含 API Key / 简历 / 提示词 / 模型配置（`ModelConfig.vue`），manifest 第 19 行 `"options_page": "options.html"` 已注册，可用 `chrome.runtime.openOptionsPage()` 直接打开。但浮动面板与 popup 都没有稳定入口把它打开。
2. **popup「设置」会重放向导**：`App.vue` 中 `AppHeader @open-settings` 与 `DashboardView @reconfigure` 均绑定 `startWizard()`，于是完成引导后点「设置」会从第 1 步重放整个向导——这就是"每次回到开头重新设置"。
3. **配置写的 key 与后台读的 key 不一致**（最伤信任）：配置中心写入 `STORAGE_KEYS` 规范 key，但 legacy 后台读的是另一套旧 key 或直接硬编码，导致"配了不生效"。

## 2. 目标 / 非目标

### 目标
- 面板与 popup 都提供「设置」入口，统一在新标签页打开配置中心（`options.html`）。
- popup「设置」不再重放向导；向导仅首次运行触发，严格一次性。
- 消除配置侧与后台的存储 key 分歧，配置中心所改即生效；老用户旧值一次性迁移。
- 面板提供只读状态摘要（模型 / 模式 / 能量）。

### 非目标（YAGNI）
- 不重写大单体 `content/runtime.js`，不动 energy 体系、不动 lab mode。
- 不新增配置项；不引入新框架。
- 不保留"重新引导"入口（向导严格一次性，想重置者手动清 `setupCompleted`）。

## 3. 用户故事（验收口径）

- **US-1 首次配置**：新装/未配置时打开 popup，自动进入向导，一步步配完（功能 → API Key → 简历 → 配置）；完成后不再出现向导。
- **US-2 日常改配置**：在招聘页浮动面板点「⚙ 设置」，或点扩展图标在 popup 点「打开配置中心」，都在新标签页打开配置页；改某一项、关掉即走，不被向导打扰。
- **US-3 状态可见**：浮动面板顶部一行只读摘要展示当前模型 / 模式 / 能量。
- **US-4 改了真生效**：在配置中心切换模型或改提示词，下一次分析/打招呼即按新配置执行。
- **US-5 老用户无感升级**：已配置的老用户升级后，原有配置经一次性迁移保留，不丢、不重跑向导。

## 4. 设计

### 4.1 架构理念
**配置中心（`options.html`）= 唯一真相源。** 面板与 popup 退化为「入口 + 只读摘要 / 启动器」，不各自存配置、不重放向导。

### 4.2 组件 A：统一入口 `openConfigCenter()`

- **唯一入口路径**：popup 与 content 都向 background 发送消息 action `OPEN_OPTIONS`；由 background 统一执行打开。这样两个调用方走同一段逻辑，不出现"popup 直调 / content 发消息"的两套实现。
- background 处理 `OPEN_OPTIONS`：优先 `chrome.runtime.openOptionsPage()`；失败兜底 `chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })`。
- 调用方各封装一个薄函数 `openConfigCenter()`（popup/content 各一份，或放共享 util），内部仅做"发 `OPEN_OPTIONS` 消息"，屏蔽环境差异。
- 参照现有 `open_chat_tab` action 的实现模式（`background/runtime.js` 中已有先例）。

### 4.3 组件 B：浮动面板入口（content/runtime.js）

- 在面板控制区新增「⚙ 设置」按钮，点击 → 发 `OPEN_OPTIONS` 消息。
- 面板头部新增一行**只读摘要**，从 storage 读取后渲染：
  - 模型：`greetingModel`（解析为可读名，查 `PRESET_MODELS ∪ customModels`）
  - 模式：`computeMode`（`custom_key` →「自有Key」/ 否则「能量」）
  - 能量：`energyCount`（仅能量模式显示）
- 摘要仅展示，不提供就地编辑（编辑一律跳配置中心）。

### 4.4 组件 C：popup 改造（src/popup/）

- **首次运行**（`SETUP_COMPLETED !== true`）：保持现有向导流程（`StepFeatures → StepApiKey? → StepResume → StepConfig`），完成时写 `SETUP_COMPLETED=true`。
- **完成之后**：popup 显示精简启动器（复用/简化 `DashboardView`）：
  - 主按钮「打开配置中心」→ `openConfigCenter()`。
  - 只读状态摘要（同面板）。
  - 可选快捷动作（如"去招聘页巡检"）。
- **关键修复**：将 `AppHeader @open-settings` 与 `DashboardView @reconfigure` 的绑定从 `startWizard()` 改为 `openConfigCenter()`。`startWizard` 仅由"首次未完成"分支触发，不再被设置入口调用。
- 不删除向导组件本身（首次仍用），但移除"设置→重放向导"的路径。

### 4.5 组件 D：key 对齐（治本）

#### 4.5.1 现状映射表（已核实写/读两侧）

| 配置中心写入 (STORAGE_KEYS) | 后台/内容实际读取 | 现状 | 处理 |
|---|---|---|---|
| `apiKey` | `apiKey` | ✅ 一致 | 不动 |
| `computeMode` | `computeMode` | ✅ 一致 | 不动 |
| `greetingCount` | `greetingCount` | ✅ 一致 | 不动 |
| `enableAutoGreeting` | `enableAutoGreeting` | ✅ 一致 | 不动 |
| `resume` | `resume` | ✅ 一致 | 不动 |
| `analysisPrompt` | `systemPrompt`（分析用） | ❌ 不一致 | 后台改读 `analysisPrompt` |
| `greetingPrompt` | `chatSystemPrompt`（话术用） | ❌ 不一致 | 后台改读 `greetingPrompt` |
| `greetingModel` / `analysisModel` / `customModels` | **硬编码 `deepseek-v4-flash`** | ❌ 选了不生效 | 后台按所选模型解析 endpoint/model/apiKey |
| `enableAnalysis` | 未被 legacy 读取 | ⚠️ 开关形同虚设 | 后台按开关决定是否提供分析（见 4.5.4） |
| `energyCount` / `clientId` / `userKey` | 同名（后台自管） | ✅ 后台自管 | 不动 |
| `greetingLlmConfig` | `generate_greeting_llm` 专用 | ⚠️ 独立子系统 | 见 4.5.3，合并或保留待定 |

#### 4.5.2 策略：后台改读规范 key + 集中读取层

- 在 background 新增 `runtimeConfig` 读取层（如 `src/background/config.js`），集中提供：
  - `getAnalysisSystemPrompt()` → 读 `analysisPrompt`，空则回退默认。
  - `getGreetingSystemPrompt()` → 读 `greetingPrompt`，空则回退默认。
  - `resolveModel(role)` → 依据 `greetingModel`/`analysisModel` + `customModels` + `PRESET_MODELS` 解析出 `{ endpoint, model, apiKey? }`；自有 key 缺失时回退默认模型。
- `handleDirectCall` / `handleServerlessCall` / `handleDirectGreetingCall` / `handleServerlessGreetingCall` 等改为经 `runtimeConfig` 取 prompt 与模型，移除硬编码 `deepseek-v4-flash` 与 `systemPrompt`/`chatSystemPrompt` 直读。

#### 4.5.3 关于 `greetingLlmConfig`（实现期决策点）

`generate_greeting_llm`（小米 mimo 润色）是独立子系统，默认值内置在 `background/runtime.js`。它与新的 `customModels` 体系并存。**实现期需决定**：合并（让话术润色也走 `customModels` 里的模型）或保留独立。倾向：本期内**保留独立**，仅确保 `generate_greeting`（主话术生成）走所选模型；`greetingLlmConfig` 标注为"高级润色"独立项，避免范围膨胀。

#### 4.5.4 `enableAnalysis` 开关

配置侧有"岗位匹配分析"开关，后台 `call_deepseek` 目前无视它始终可调。本期内：让面板/ popup 的分析入口在该开关关闭时禁用或提示；是否在后台硬拦截留作实现期小决策（倾向：仅在 UI 层尊重开关，后台保持容错）。

### 4.6 一次性迁移（老用户）

在 background service worker 启动时执行一次（带幂等标记 `configMigratedV1`）：

- 若 `analysisPrompt` 为空且旧 `systemPrompt` 有值 → 写入 `analysisPrompt`。
- 若 `greetingPrompt` 为空且旧 `chatSystemPrompt` 有值 → 写入 `greetingPrompt`。
- 模型相关：若无 `greetingModel`/`analysisModel`，置为 `DEFAULT_MODEL_ID`（不强行迁移旧 `greetingLlmConfig`）。
- 写入 `configMigratedV1=true`，之后不再执行。
- 迁移只搬运、不删除旧 key（避免回滚风险）。

## 5. 数据流（典型：改模型后下次分析）

1. 用户在配置中心改 `greetingModel` → `storageSet`（防抖）。
2. 下次触发分析/打招呼 → background handler 经 `runtimeConfig.resolveModel()` 读到新模型。
3. 用解析出的 `endpoint/model` 发请求 → 用户感知"改了真生效"。

## 6. 测试

- **单测（`tests/`）**：
  - `runtimeConfig` 读取 + 默认值回退（`getAnalysisSystemPrompt` / `resolveModel` 等）。
  - 一次性迁移函数：旧 key 存在→搬运；已迁移→不重复；空值不误覆盖。
  - 模型解析：preset / custom / 缺失回退。
- **回归**：保留并扩展现有 `greeting-mode.test.mjs`；确保 `isAiGreetingMode` 等不回归。
- **手测（无法自动化的浏览器行为）**：
  - 首次进向导、完成后不再出现；popup/面板「设置」均能开配置中心。
  - 改模型→下次分析生效；改提示词→生效。
  - 老用户 profile 升级后配置不丢。

## 7. 风险

| 风险 | 缓解 |
|---|---|
| key 改名后老用户配置丢失 | 一次性迁移（4.6），只搬运不删旧 key |
| 后台 handler 多、改读取易漏 | 统一经 `runtimeConfig` 层，集中测试 |
| content/popup 跨环境 `openOptionsPage` 差异 | 统一走 background `OPEN_OPTIONS` action |
| 向导组件误删导致首次流程断 | 不删向导组件，仅改"设置"绑定 |

## 8. 决策记录

- 范围：入口 + 导航 + key 对齐（治本）。
- 入口形态：新标签页打开配置中心（`openOptionsPage`）。
- 向导：首次保留、之后不重放；严格一次性，不留"重新引导"。
- key 对齐：后台改读 `STORAGE_KEYS` 规范 key + 集中 `runtimeConfig` 层 + 一次性迁移老值。

## 9. 待实现期细化（非阻塞）

- `greetingLlmConfig` 合并 vs 保留独立（倾向保留）。
- `enableAnalysis` 在后台是否硬拦截（倾向仅 UI 尊重）。
- popup 启动器是复用 `DashboardView` 还是新建轻量组件（倾向复用并裁剪）。
