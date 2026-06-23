<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        ⚙️
      </div>
      <h2>配置打招呼用语</h2>
      <p class="step-desc">
        自定义你的打招呼风格，让每次沟通更有针对性。
      </p>
    </div>

    <!-- Custom Greeting Text (only when AI is NOT enabled) -->
    <div
      v-if="!hasAi"
      class="form-group"
    >
      <label>💬 自定义打招呼用语</label>
      <textarea
        v-model="customGreeting"
        class="wg-textarea"
        rows="3"
        placeholder="您好，我对贵公司的岗位很感兴趣，期待进一步沟通。"
        @input="debouncedSave"
      />
      <div class="input-hint">
        这是基础打招呼用语，不使用 AI 时会直接发送这段文字。
      </div>
    </div>

    <!-- AI Features (only when AI is enabled) -->
    <template v-if="hasAi">
      <div class="section-divider">
        <span>🤖 AI 功能</span>
      </div>

      <!-- AI Greeting Toggle -->
      <div class="feature-card-inline">
        <div class="feature-card-header">
          <div class="feature-card-title">
            <span>🤖</span> AI 生成打招呼用语
          </div>
          <label class="wg-toggle">
            <input
              v-model="enableAiGreeting"
              type="checkbox"
            >
            <span class="wg-toggle-track" />
          </label>
        </div>
        <div
          v-if="enableAiGreeting"
          class="feature-card-options"
        >
          <div class="radio-group">
            <label
              v-for="n in [1, 3, 5]"
              :key="n"
              class="radio-item"
            >
              <input
                v-model="greetingCount"
                type="radio"
                name="greetingCount"
                :value="n"
              >
              每次生成 {{ n }} 条
            </label>
          </div>
        </div>
      </div>

      <!-- Model Selection -->
      <div class="form-group">
        <label>🧠 AI 模型</label>
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
      </div>

      <!-- Greeting Prompt Template -->
      <div class="form-group">
        <label>📝 话术风格模板</label>
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
            @click="resetPromptToDefault"
          >
            恢复默认
          </button>
        </div>
      </div>
    </template>

    <!-- Navigation -->
    <div class="step-nav">
      <button
        class="btn-prev"
        @click="$emit('prev')"
      >
        上一步
      </button>
      <button
        class="btn-skip"
        @click="handleSkip"
      >
        跳过
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

defineProps({
  hasAi: { type: Boolean, default: false },
});

const emit = defineEmits(['next', 'prev']);

const customGreeting = ref('');
const enableAiGreeting = ref(false);
const greetingCount = ref(1);
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
    STORAGE_KEYS.CUSTOM_GREETING,
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.GREETING_MODEL,
    STORAGE_KEYS.GREETING_PROMPT,
    STORAGE_KEYS.CUSTOM_MODELS,
  ]);
  customGreeting.value = data[STORAGE_KEYS.CUSTOM_GREETING] || '';
  const gc = data[STORAGE_KEYS.GREETING_COUNT];
  greetingCount.value = gc != null ? gc : 1;
  enableAiGreeting.value = gc != null ? gc > 0 : false;
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
    [STORAGE_KEYS.CUSTOM_GREETING]: customGreeting.value,
    [STORAGE_KEYS.GREETING_COUNT]: enableAiGreeting.value ? greetingCount.value : 0,
    [STORAGE_KEYS.GREETING_MODEL]: greetingModel.value,
    [STORAGE_KEYS.GREETING_PROMPT]: greetingPrompt.value,
  });
}

function resetPromptToDefault() {
  greetingPrompt.value = DEFAULT_GREETING_PROMPT;
  save();
}

async function handleNext() {
  await save();
  emit('next');
}

async function handleSkip() {
  await save();
  emit('next');
}
</script>
