# 微光 (Glimmer Vision)

Boss直聘 AI 职位分析助手

## 快速开始

1. npm install
2. npm run build
3. chrome://extensions → 开发者模式 → 加载已解压 → 选择 dist/

## 开发

npm run dev          # 开发模式 (watch)
npm run build        # 生产构建
npm run lint         # 代码检查
npm run format       # 格式化

## 架构

src/
├── background/     # Service Worker (消息路由)
├── content/        # 内容脚本 (DOM操作)
├── popup/          # 弹窗 (Vue 3)
├── options/        # 设置页 (Vue 3)
├── utils/          # 共享工具
├── api/            # API层
└── components/     # 共享组件

## 构建变体

npm run build:social    # 社招版
npm run build:intern    # 实习生版

## 技术栈

Chrome Extension MV3 · Vue 3 · Webpack 5 · ESLint · Prettier
