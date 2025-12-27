# 版本更新记录

## v3.0.0 (2025-12-27) - 🎯 个性化定制版

### ✨ 新增功能
- **预设简历模板**: 内置林承列的完整简历，自动填充
- **预设 API Key**: 内置 DeepSeek API Key，开箱即用
- **只读简历**: 简历内容锁定，防止误修改

### 🔧 改进
- 简历输入框设为只读状态，灰色背景提示
- API Key 自动回填机制
- 新用户自动使用预设配置

### 🛠️ 技术细节
- 添加 `DEFAULT_RESUME` 常量 (popup.js:7-45)
- 添加 `DEFAULT_API_KEY` 常量 (popup.js:4)
- 优化 `loadSettings()` 自动填充逻辑 (popup.js:328-344)
- 优化 `saveSettings()` 空值保护 (popup.js:302-307)
- 添加只读样式 #resume[readonly] (style.css:531-536)

---

## v2.3 - 原始版本
- 基础职位分析功能
- 简历对比匹配
- 列表扫描模式
- AI 面试攻略生成
