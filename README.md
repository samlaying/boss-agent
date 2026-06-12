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

## 🚀 安装和使用教程（新手必看）

> 从零开始，手把手教你安装和使用微光。跟着做就行！

---

### 第一步：下载插件

1. 点击本页面右上角的绿色 **「Code」** 按钮
2. 选择 **「Download ZIP」** 下载压缩包
3. 解压到你能找到的位置（比如桌面），记住这个文件夹的位置

---

### 第二步：开启 Chrome 开发者模式

1. 打开 Chrome 浏览器
2. 在地址栏输入 `chrome://extensions/` 然后回车
3. 你会看到扩展程序管理页面
4. 找到页面**右上角**的 **「开发者模式」** 开关，把它**打开**

---

### 第三步：导入插件

1. 还是在 `chrome://extensions/` 页面
2. 点击左上角的 **「加载已解压的扩展程序」** 按钮
3. 在弹出的文件选择窗口中，选择你**刚才解压的文件夹**（就是包含 `manifest.json` 的那个文件夹）
4. 点击 **「选择」**

> ✅ 导入成功后，你会看到扩展列表里出现了「微光」插件，右上角扩展图标栏也会出现微光的图标。

---

### 第四步：获取 DeepSeek API Key（免费）

微光的 AI 分析功能需要 DeepSeek 的 API Key，**新用户有免费额度**，够用很久。

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/) ，点击注册/登录
2. 登录后，进入 **[API Keys 管理页面](https://platform.deepseek.com/api_keys)**
3. 点击 **「创建 API Key」**
4. 复制生成的 Key（格式类似 `sk-xxxxxxxxxx`，**只显示一次，记得保存好**）

> 💡 不用担心费用，DeepSeek 的 API 价格非常便宜，日常使用几乎花不了几毛钱。

---

### 第五步：配置微光（首次使用向导）

1. 点击 Chrome 右上角的 **拼图图标** 🧩（扩展管理按钮）
2. 找到 **「微光」**，点击它打开弹窗
3. 首次使用会自动进入 **配置向导**，按顺序完成以下步骤：

#### ① 填入 API Key
- 将刚才复制的 DeepSeek API Key 粘贴到输入框中
- 点击下一步

#### ② 上传你的简历
三种方式任选其一：
- **粘贴文本**：直接把简历文字粘贴到文本框里
- **上传 PDF**：点击上传按钮，选择 PDF 格式的简历文件
- **上传 Word**：点击上传按钮，选择 .docx 格式的简历文件

> 💡 简历越详细，AI 分析的匹配度就越准确！

#### ③ 选择功能
- 根据需要勾选想要开启的功能，不知道选什么就全开

#### ④ 完成配置
- 点击完成，配置自动保存

---

### 第六步：开始使用！

#### 方式一：分析单个职位

1. 打开 [Boss直聘](https://www.zhipin.com/) ，登录你的账号
2. 浏览职位列表，**点击进入**任意一个你感兴趣的职位详情页
3. 你会看到页面上出现微光的 **悬浮按钮**（💡 灯泡图标）
4. 点击它，选择 **「深度剖析」**
5. 等待几秒，AI 会生成完整的分析报告，包括：
   - 📊 岗位匹配度评分（0-100 分）
   - ⚠️ 风险预警（是否为骗局/保险/培训贷）
   - 💡 面试建议和准备方向
   - ✅ 你的优势和不足

#### 方式二：批量扫描职位列表

1. 在 Boss直聘的**职位列表页**（不是详情页）
2. 点击微光悬浮按钮，选择 **「开启巡航模式」**
3. 微光会自动逐个扫描当前页面的所有职位
4. 扫描完成后：
   - 🟢 绿色边框的 = 高匹配，值得投
   - ⚪ 灰色半透明的 = 低匹配，可以跳过
5. 点击感兴趣的职位即可查看详细分析

---

### ❓ 常见问题

<details>
<summary><b>点击扩展图标没反应？</b></summary>

检查一下你当前是不是在 Boss直聘（zhipin.com）的页面上。微光只在 Boss直聘 页面才能使用。
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

点击扩展图标打开弹窗 → 直接修改对应内容 → 自动保存。
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
