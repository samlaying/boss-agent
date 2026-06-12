<div align="center">

# 🔦 微光 Glimmer Vision

**Boss直聘 AI 职位分析助手 —— 别怕黑，这里有光。**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Version](https://img.shields.io/badge/version-3.0.14-orange)]()

把困难留给 AI，把尊严留给自己。

一款带夜视功能的职场翻译机，帮你看穿职位描述背后的真相。

</div>

---

## ✨ 核心功能

### 🎯 深度职位分析
- **AI 匹配打分**：将你的简历与 JD 深度比对，输出 0-100 匹配分数
- **风险识别**：自动识别骗局、保险销售伪装、培训贷等高风险岗位
- **面试攻略**：根据岗位要求生成针对性面试问题和准备策略
- **简历-JD 匹配**：AI 驱动的简历与职位描述双向匹配分析

### 🚀 列表巡航模式
- **自动扫描**：自动扫描职位列表页，批量分析所有岗位
- **颜色编码**：绿色边框 = 高匹配，灰色透明 = 低匹配，一目了然
- **智能暂停**：发现高匹配岗位时自动暂停（阈值可配置）

### 🔬 数据探测（实验室模式）
- **被动扫描**：DOM 解析 + 全局变量检查
- **主动探测**：网络请求拦截和 Hook 技术（需手动开启，有风险提示）
- **隐藏薪资检测**：从页面数据中提取被隐藏的薪资信息
- **字体混淆解码**：自动解码 Boss直聘字体混淆的薪资数字

### 📋 简历管理
- **文本粘贴**：直接粘贴简历文本
- **PDF 上传**：支持 PDF 简历自动提取
- **Word 上传**：支持 .docx 简历自动提取

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

## 🚀 快速开始

### 安装方式一：直接加载（开发者模式）

1. 克隆本仓库
   ```bash
   git clone https://github.com/samlaying/boss-agent.git
   cd boss-agent
   ```

2. 安装依赖并构建
   ```bash
   npm install
   npm run build
   ```

3. 打开 Chrome，进入 `chrome://extensions/`
4. 开启右上角 **「开发者模式」**
5. 点击 **「加载已解压的扩展程序」** → 选择项目根目录（包含 `manifest.json`）

### 安装方式二：使用构建产物

直接下载 [dist/](./dist/) 目录，在 `chrome://extensions/` 中加载即可。

---

## 🛠️ 开发指南

### 环境要求

- **Node.js** >= 18
- **Chrome** >= 110
- **npm** >= 9

### 常用命令

```bash
# 开发模式（监听文件变化，自动重新构建）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 自动修复代码风格
npm run lint:fix

# 格式化代码
npm run format

# 打包 zip
npm run zip
```

### 构建变体

```bash
npm run build:social    # 社招版
npm run build:intern    # 实习生版
npm run build:variants  # 构建所有变体
```

---

## 📁 项目结构

```
boss-agent/
├── manifest.json           # Chrome 扩展配置 (Manifest V3)
├── background.js           # Service Worker - API 通信 & 核心逻辑
├── content.js              # 内容脚本 - 注入 Boss直聘页面的主控制器
├── popup.html / popup.js   # 扩展弹窗界面 & 设置管理
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
    ├── popup/              # 弹窗界面 (Vue 3 + 组件)
    │   ├── components/     # 通用组件 (WizardProgress, PingTest...)
    │   ├── components/steps/  # 配置向导步骤组件
    │   └── views/          # 页面视图
    ├── options/            # 设置页面 (Vue 3)
    ├── utils/              # 共享工具库
    ├── api/                # API 接口层
    └── components/         # 共享组件
```

---

## 🏗️ 架构设计

### 数据流

```
用户操作 → Content Script → Service Worker → DeepSeek API
   ↑                                          ↓
   └─── UI 渲染 ←─── 结果返回 ←──────────────┘
```

### 消息通信架构

| 通信路径 | 方式 | 用途 |
|---------|------|------|
| popup → background | `chrome.runtime.sendMessage` | 设置保存/加载、API 配置 |
| popup → content | `chrome.tabs.sendMessage` | 直接触发职位分析 |
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

---

## ⚙️ 配置说明

### API 配置

支持两种方式使用 AI 分析功能：

1. **自带 Key**：在设置中填入你的 [DeepSeek API Key](https://platform.deepseek.com/)
2. **免费额度**：使用内置的「能量站」免费额度（有限制）

### 首次使用配置向导

首次打开弹窗会启动 4 步配置向导：

1. **API Key 配置** — 填入 DeepSeek API Key 或使用免费额度
2. **简历上传** — 粘贴文本 / 上传 PDF / 上传 Word
3. **功能选择** — 按需开启各项功能
4. **高级配置** — 扫描间隔、匹配阈值等参数微调

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
