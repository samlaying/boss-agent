<template>
  <div class="options-container">
    <header class="header">
      <h1>✨ 微光 · 配置中心</h1>
      <p class="subtitle">
        简历管理 · 提示词配置 · 模型选择
      </p>
    </header>

    <!-- API Key -->
    <div class="section">
      <h2>🔑 API 配置</h2>
      <div class="setting-group">
        <label>DeepSeek API Key</label>
        <input
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          @input="saveApiKey"
        >
      </div>
    </div>

    <!-- 简历管理 -->
    <ResumeManager />

    <!-- 提示词配置 -->
    <PromptConfig />

    <!-- 模型配置 -->
    <ModelConfig />

    <footer class="footer">
      <p>微光 v3.0 · 你的 AI 求职助手</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getState, updateState } from '../popup/store.js';
import ResumeManager from './components/ResumeManager.vue';
import PromptConfig from './components/PromptConfig.vue';
import ModelConfig from './components/ModelConfig.vue';

const apiKey = ref('');
let saveTimer = null;

onMounted(() => {
  const state = getState();
  apiKey.value = state.apiKey || '';
});

function saveApiKey() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    updateState({ apiKey: apiKey.value });
  }, 500);
}
</script>

<style scoped>
.options-container {
  max-width: 720px; margin: 0 auto; font-family: -apple-system, 'Segoe UI', sans-serif;
  padding: 40px 24px; color: #333;
}
.header { text-align: center; margin-bottom: 40px; }
.header h1 { font-size: 24px; margin-bottom: 4px; }
.subtitle { color: #888; font-size: 14px; }
.section { margin-bottom: 32px; }
.section h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
.setting-group { margin-bottom: 16px; }
.setting-group label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
input {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 14px;
}
.footer { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 1px solid #eee; }
.footer p { color: #999; font-size: 13px; }
</style>
