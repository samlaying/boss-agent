<div align="center">

# 🔦 Boss Agent

**Boss直聘 自动打招呼 & AI 职位分析助手 —— 别怕黑，这里有光。**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Version](https://img.shields.io/badge/version-3.0.14-orange)]()

把困难留给 AI，把尊严留给自己。

自动打招呼、开场白你说了算，把重复沟通交给插件；再让这台带夜视的职场翻译机，帮你看穿职位描述背后的真相。

</div>

---

## ✨ 核心功能

### 💬 自动打招呼 ⭐ 核心
- **一键自动沟通**：在职位列表页开启，自动逐个发起沟通、批量投递，告别一个个手动点
- **可自定义打招呼用语**：开场白你说了算 —— 自己写、随时改，插件按你的话术自动填入并发送，不被千篇一律的模板淹没
- **🆕 AI 自动匹配打招呼**（应广大用户要求新增）：填好简历后，AI 会根据你的简历亮点 + 每个岗位的 JD，自动生成针对性、个性化的打招呼话术，越投越准
- **智能兜底**：AI 生成失败时自动回退到你的默认话术，不会卡住流程
- **自定义 LLM**：支持配置自己的 AI 模型来生成打招呼用语

### 🎯 深度职位分析
- **AI 匹配打分**：将你的简历与 JD 深度比对，输出 0-100 匹配分数
- **风险识别**：自动识别骗局、保险销售伪装、培训贷等高风险岗位
- **面试攻略**：根据岗位要求生成针对性面试问题和准备策略
- **简历-JD 匹配**：AI 驱动的简历与职位描述双向匹配分析

### 🚀 列表巡航模式
- **自动扫描**：自动扫描职位列表页，批量分析所有岗位
- **颜色编码**：绿色边框 = 高匹配，灰色透明 = 低匹配，一目了然
- **智能暂停**：发现高匹配岗位时自动暂停（阈值可配置）

### 📤 数据导出
- **明细日志**：导出自动沟通的完整日志 CSV（包含时间、公司、岗位、薪资、打招呼内容等全字段）
- **岗位简报**：按岗位聚合导出 CSV，一岗一行，快速浏览所有已投递岗位
- **分析报告截图**：深度剖析结果支持一键截图保存为 PNG

### 🔬 数据探测（实验室模式）
- **被动扫描**：DOM 解析 + 全局变量检查
- **主动探测**：网络请求拦截和 Hook 技术（需手动开启，有风险提示）
- **隐藏薪资检测**：从页面数据中提取被隐藏的薪资信息
- **字体混淆解码**：自动解码 Boss直聘字体混淆的薪资数字

### 🔐 隐私与安全
- **完全本地存储**：所有用户数据存储在浏览器本地
- **数据脱敏**：发送 API 前自动移除手机号、姓名等敏感信息
- **自带 API Key**：支持使用自己的 DeepSeek API Key

---

## 📸 功能预览

| 巡航扫描模式 | 深度分析面板 |
|:---:|:---:|
| 列表页批量扫描，颜色编码直观展示匹配度 | AI 驱动的职位深度剖析与风险预警 |
| 浮窗操控台 | 配置向导 |
| 悬浮操控台，一键启停 | 首次使用 4 步引导配置 |

---

## 🚀 安装使用

### 第一步：下载安装

1. 点击页面右上角绿色 **「Code」** → **「Download ZIP」**
2. 解压到桌面（或其他你能找到的位置）
3. 打开 Chrome，地址栏输入 `chrome://extensions/` 回车
4. 右上角打开 **「开发者模式」**
5. 点击 **「加载已解压的扩展程序」**，选择刚才解压的文件夹

> ✅ 看到扩展列表出现「Boss Agent」就成功了。

### 第二步：配置

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/)，注册并创建 API Key（新用户有免费额度）
2. 回到 Chrome，点击右上角拼图图标 🧩 → 找到 **「Boss Agent」** → 点击打开新手引导
3. 按提示填入 API Key、上传简历，完成配置

### 第三步：开始使用

打开 [Boss直聘](https://www.zhipin.com/)，页面右侧会出现 **Boss Agent 悬浮球** 🌌

**⭐ 自动打招呼（核心功能）：**

1. 点击悬浮球，打开 Boss Agent 面板
2. 面板底部点击 **「🔁 自动沟通循环」**
3. Boss Agent 自动逐个打开职位 → AI 根据你的简历生成打招呼话术 → 自动发送
4. 全程自动，去喝杯咖啡 ☕

> 💡 你也可以自己写打招呼话术，AI 生成失败时会自动用你的话术兜底。

**其他功能：**

- **深度剖析**：进入职位详情页 → 点悬浮球 → 选「深度剖析」→ AI 生成匹配分析
- **批量扫描**：在职位列表页 → 点悬浮球 → 选「巡航模式」→ 自动扫描所有职位
- **AI 打招呼**：进入聊天窗口 → 点「AI 生成打招呼」→ 话术自动填入输入框

---

### ❓ 常见问题

<details>
<summary><b>点击扩展图标没反应？</b></summary>

检查一下你当前是不是在 Boss直聘（zhipin.com）的页面上。Boss Agent只在 Boss直聘 页面才能使用。
</details>

<details>
<summary><b>提示 API Key 错误？</b></summary>

1. 确认你复制的是完整的 Key（以 `sk-` 开头）
2. 去DeepSeek 平台检查 Key 是否有效
3. 确认账户里有余额（新用户有免费额度）
</details>

<details>
<summary><b>分析很慢或没有结果？</b></summary>

可能是网络问题，请检查：
1. 网络连接是否正常
2. DeepSeek 服务是否可用
3. 刷新页面重试
</details>

<details>
<summary><b>如何修改简历或 API Key？</b></summary>

点击扩展图标打开新手引导页面，配置项会自动保存。
</details>

<details>
<summary><b>实验室模式是什么？能不能开？</b></summary>

实验室模式可以探测隐藏薪资等深层信息，但有一定**封号风险**。建议谨慎使用，如果只是分析职位匹配度，不需要开启。
</details>

---

## 🛠️ 开发者指南

<details>
<summary><b>点击展开开发者文档</b></summary>

### 环境要求

- **Node.js** >= 18
- **Chrome** >= 110
- **npm** >= 9

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/samlaying/boss-agent.git
cd boss-agent

# 安装依赖
npm install

# 生产构建
npm run build
```

构建产物在 `dist/` 目录，直接加载到 Chrome 即可。

### 常用命令

```bash
npm run dev              # 开发模式（监听文件变化）
npm run build            # 生产构建
npm run build:social     # 社招版
npm run build:intern     # 实习生版
npm run build:variants   # 构建所有变体
npm run lint             # 代码检查
npm run lint:fix         # 自动修复
npm run format           # 格式化
npm run zip              # 打包 zip
```

### 项目结构

```
boss-agent/
├── manifest.json           # Chrome 扩展配置 (Manifest V3)
├── background.js           # Service Worker - API 通信 & 核心逻辑
├── content.js              # 内容脚本 - 注入 Boss直聘页面的主控制器
├── onboarding.html / onboarding.js # 浏览器页新手引导
├── injected_probe.js       # Main World 脚本 - 深层数据提取 (Hook)
├── spa_monitor.js          # SPA 导航监控
├── html2canvas.min.js      # 截图功能库
├── style.css               # 注入页面的 UI 样式
├── server/                 # 云端日志服务端脚本
├── images/                 # 图片资源
├── scripts/                # 构建脚本
├── public/                 # 静态资源 (icons, locales)
└── src/                    # 源码目录 (Vue 3 组件化)
    ├── background/         # Service Worker 消息路由
    ├── content/            # 内容脚本模块
    ├── onboarding/         # 浏览器页新手引导入口
    ├── popup/              # 引导组件与共享状态
    ├── options/            # 设置页面 (Vue 3)
    ├── utils/              # 共享工具库
    ├── api/                # API 接口层
    └── components/         # 共享组件
```

### 架构设计

```
用户操作 → Content Script → Service Worker → DeepSeek API
   ↑                                          ↓
   └─── UI 渲染 ←─── 结果返回 ←──────────────┘
```

| 通信路径 | 方式 | 用途 |
|---------|------|------|
| onboarding → background | `chrome.runtime.sendMessage` | 设置保存/加载、API 配置 |
| content → background | `chrome.runtime.sendMessage` | API 调用、存储操作 |
| content ↔ injected | `window.postMessage` / CustomEvent | 深层数据提取请求/回调 |

### 技术栈

| 技术 | 用途 |
|------|------|
| Chrome Extension Manifest V3 | 扩展框架 |
| Vue 3 | Popup & Options 界面 |
| Webpack 5 | 构建打包 |
| DeepSeek API | AI 分析引擎 |
| PDF.js | PDF 简历解析 |
| Mammoth.js | Word 简历解析 |
| html2canvas | 页面截图 |

</details>

---

## ⚠️ 免责声明

- 本工具**非** Boss直聘官方产品，与看准网无任何关联
- 所有用户数据存储于浏览器本地，开发者无法访问
- **实验室模式**涉及网络请求拦截，可能导致账号被风控或封禁，请谨慎使用
- 仅限个人求职用途，禁止用于大规模数据抓取或商业用途
- 完整免责声明见 [DISCLAIMER.md](./DISCLAIMER.md)

---

## 📄 开源协议

MIT License — 详见 [LICENSE](./LICENSE)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加某功能'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

### Commit 规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `style:` 样式
- `refactor:` 重构
- `chore:` 构建/工具

---

<div align="center">

**把困难留给 AI，把尊严留给自己。** 🔦

</div>
