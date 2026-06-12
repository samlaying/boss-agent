<template>
  <div class="prompt-config">
    <h2>💬 提示词配置</h2>

    <!-- 话术提示词 -->
    <div class="prompt-group">
      <label>话术提示词</label>
      <p class="hint">
        用于生成打招呼语。可用变量：<code>{{ resume }}</code>、<code>{{ jobTitle }}</code>、<code>{{ jobDesc }}</code>、<code>{{ hrName }}</code>、<code>{{ companyName }}</code>
      </p>
      <textarea
        v-model="greetingPrompt"
        rows="5"
        placeholder="输入话术提示词模板..."
        @input="save"
      />
    </div>

    <!-- 分析开关 -->
    <div class="prompt-group">
      <div class="toggle-row">
        <label>🔍 岗位匹配分析</label>
        <button
          class="toggle-btn"
          :class="{ active: enableAnalysis }"
          @click="toggleAnalysis"
        >
          {{ enableAnalysis ? '已开启' : '已关闭' }}
        </button>
      </div>
      <p class="hint">
        开启后，AI 会分析简历与岗位的匹配度
      </p>
    </div>

    <!-- 分析提示词（仅开启时显示） -->
    <div
      v-if="enableAnalysis"
      class="prompt-group"
    >
      <label>分析提示词</label>
      <p class="hint">
        可用变量同上
      </p>
      <textarea
        v-model="analysisPrompt"
        rows="5"
        placeholder="输入分析提示词模板..."
        @input="save"
      />
    </div>

    <span
      v-if="saved"
      class="save-toast"
    >✅ 已保存</span>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storageGet, storageSet } from '../../utils/storage.js';
import { STORAGE_KEYS, DEFAULT_GREETING_PROMPT, DEFAULT_ANALYSIS_PROMPT } from '../../utils/constants.js';

const greetingPrompt = ref('');
const analysisPrompt = ref('');
const enableAnalysis = ref(false);
const saved = ref(false);
let saveTimer = null;

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.GREETING_PROMPT,
    STORAGE_KEYS.ANALYSIS_PROMPT,
    STORAGE_KEYS.ENABLE_ANALYSIS,
  ]);
  greetingPrompt.value = data[STORAGE_KEYS.GREETING_PROMPT] || DEFAULT_GREETING_PROMPT;
  analysisPrompt.value = data[STORAGE_KEYS.ANALYSIS_PROMPT] || DEFAULT_ANALYSIS_PROMPT;
  enableAnalysis.value = data[STORAGE_KEYS.ENABLE_ANALYSIS] || false;
});

function toggleAnalysis() {
  enableAnalysis.value = !enableAnalysis.value;
  save();
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await storageSet({
      [STORAGE_KEYS.GREETING_PROMPT]: greetingPrompt.value,
      [STORAGE_KEYS.ANALYSIS_PROMPT]: analysisPrompt.value,
      [STORAGE_KEYS.ENABLE_ANALYSIS]: enableAnalysis.value,
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  }, 500);
}
</script>

<style scoped>
.prompt-config { margin-bottom: 32px; }
h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
.prompt-group { margin-bottom: 20px; }
.prompt-group label { display: block; font-weight: 600; margin-bottom: 4px; font-size: 14px; }
.hint { font-size: 12px; color: #888; margin-bottom: 8px; }
.hint code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
textarea {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 13px; resize: vertical; line-height: 1.6;
}
.toggle-row { display: flex; align-items: center; justify-content: space-between; }
.toggle-btn {
  padding: 6px 16px; border: 1px solid #ddd; border-radius: 20px;
  background: #f5f5f5; cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.toggle-btn.active { background: #4caf50; color: white; border-color: #4caf50; }
.save-toast { font-size: 13px; color: #4caf50; }
</style>
