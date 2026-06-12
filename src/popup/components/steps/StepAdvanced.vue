<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        🧠
      </div>
      <h2>AI 模型与话术风格</h2>
      <p class="step-desc">
        选择 AI 模型并定制你的打招呼风格
      </p>
    </div>

    <!-- Model Selection -->
    <div class="section-label">
      🤖 选择 AI 模型
    </div>
    <div class="model-grid">
      <div
        v-for="m in allModels"
        :key="m.id"
        class="model-card"
        :class="{ selected: greetingModel === m.id }"
        @click="greetingModel = m.id"
      >
        <div class="model-card-name">
          {{ m.name }}
        </div>
        <div class="model-card-desc">
          {{ m.desc }}
        </div>
      </div>
    </div>

    <!-- Greeting Prompt -->
    <div class="prompt-section">
      <div class="section-label">
        💬 话术风格配置
      </div>
      <div class="var-chips">
        <span
          v-for="v in variables"
          :key="v"
          class="var-chip"
          @click="insertVar(v)"
        >
          {{ v }}
        </span>
      </div>
      <textarea
        v-model="greetingPrompt"
        class="wg-textarea"
        rows="4"
        placeholder="输入话术提示词模板..."
        @input="debouncedSave"
      />
      <div class="prompt-actions">
        <button
          class="prompt-action-btn"
          @click="resetToDefault"
        >
          恢复默认
        </button>
      </div>
    </div>

    <!-- Navigation -->
    <div class="step-nav">
      <button
        class="btn-prev"
        @click="$emit('prev')"
      >
        上一步
      </button>
      <button
        class="btn-next"
        @click="handleNext"
      >
        完成配置，开始使用
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS, PRESET_MODELS, DEFAULT_GREETING_PROMPT } from '../../../utils/constants.js';

const emit = defineEmits(['next', 'prev']);

const greetingModel = ref('deepseek-v4-flash');
const greetingPrompt = ref('');
const customModels = ref([]);

const variables = ['{{姓名}}', '{{岗位}}', '{{公司}}', '{{工作年限}}', '{{核心优势}}'];

const allModels = computed(() => {
  const presets = PRESET_MODELS.map(m => ({
    id: m.id,
    name: m.name.split('（')[0],
    desc: m.name.includes('快速') ? '⚡ 快速响应' : '🧠 深度思考',
  }));
  const customs = customModels.value.map(m => ({
    id: m.id,
    name: m.name,
    desc: '自定义',
  }));
  return [...presets, ...customs];
});

let saveTimer = null;

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.GREETING_MODEL,
    STORAGE_KEYS.GREETING_PROMPT,
    STORAGE_KEYS.CUSTOM_MODELS,
  ]);
  greetingModel.value = data[STORAGE_KEYS.GREETING_MODEL] || 'deepseek-v4-flash';
  greetingPrompt.value = data[STORAGE_KEYS.GREETING_PROMPT] || DEFAULT_GREETING_PROMPT;
  customModels.value = data[STORAGE_KEYS.CUSTOM_MODELS] || [];
});

function insertVar(v) {
  greetingPrompt.value += ' ' + v;
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 500);
}

async function save() {
  await storageSet({
    [STORAGE_KEYS.GREETING_MODEL]: greetingModel.value,
    [STORAGE_KEYS.GREETING_PROMPT]: greetingPrompt.value,
  });
}

function resetToDefault() {
  greetingPrompt.value = DEFAULT_GREETING_PROMPT;
  save();
}

async function handleNext() {
  await save();
  emit('next');
}
</script>
