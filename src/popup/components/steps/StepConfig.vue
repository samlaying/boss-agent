<template>
  <div class="step-content">
    <template v-if="!hasAi">
      <div class="step-header">
        <div class="step-icon">
          💌
        </div>
        <h2>{{ isGenerating ? '正在为你准备专属开场白' : '为你准备好了' }}</h2>
        <p class="step-desc">
          {{ isGenerating ? loadingMessage : '这段话术会用于自动打招呼，你可以把它改得更像自己。' }}
        </p>
      </div>

      <div
        v-if="isGenerating"
        class="greeting-loading"
      >
        <span class="loading-orbit" />
        <div class="loading-line">
          <span />
        </div>
      </div>

      <div
        v-else
        class="greeting-result"
      >
        <label for="custom-greeting">你的专属开场白</label>
        <textarea
          id="custom-greeting"
          v-model="customGreeting"
          class="wg-textarea"
          rows="5"
        />
        <p
          v-if="generationError"
          class="generation-note"
        >
          已为你准备基础版本，你可以直接修改后使用。
        </p>
      </div>
    </template>

    <template v-else>
      <div class="step-header">
        <div class="step-icon">
          🤖
        </div>
        <h2>已开启逐岗生成</h2>
        <p class="step-desc">
          查看岗位时，我们会结合当前 JD 和你的简历，动态生成更有针对性的开场白。
        </p>
      </div>

      <div class="candidate-panel">
        <strong>每个岗位生成几条候选话术？</strong>
        <div class="candidate-options">
          <label
            v-for="option in candidateOptions"
            :key="option.value"
            :class="{ selected: greetingCount === option.value }"
          >
            <input
              v-model="greetingCount"
              type="radio"
              name="greeting-count"
              :value="option.value"
            >
            <b>{{ option.value }} 条</b>
            <small>{{ option.label }}</small>
          </label>
        </div>
        <p>实际沟通时只发送其中一条。</p>
      </div>
    </template>

    <div class="step-nav">
      <button
        class="btn-prev"
        :disabled="isGenerating"
        @click="$emit('prev')"
      >
        上一步
      </button>
      <button
        class="btn-next"
        :disabled="isGenerating || (!hasAi && !customGreeting.trim())"
        @click="handleNext"
      >
        {{ hasAi ? '完成配置，开始使用' : '保存我的专属话术' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

const props = defineProps({
  hasAi: { type: Boolean, default: false },
});
const emit = defineEmits(['next', 'prev']);

const customGreeting = ref('');
const greetingCount = ref(3);
const isGenerating = ref(false);
const loadingMessage = ref('正在读取简历内容…');
const generationError = ref('');

const candidateOptions = [
  { value: 1, label: '最快' },
  { value: 3, label: '平衡速度与选择' },
  { value: 5, label: '更多表达方式' },
];

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.CUSTOM_GREETING,
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.RESUME,
  ]);
  customGreeting.value = data[STORAGE_KEYS.CUSTOM_GREETING] || '';
  greetingCount.value = Number(data[STORAGE_KEYS.GREETING_COUNT] || 3);

  if (!props.hasAi && !customGreeting.value.trim()) {
    await generateGreeting(data[STORAGE_KEYS.RESUME] || '');
  }
});

async function generateGreeting(resume) {
  isGenerating.value = true;
  generationError.value = '';
  const messages = [
    '正在读取简历内容…',
    '正在提炼适合介绍的经历…',
    '正在调整表达和语气…',
  ];
  let messageIndex = 0;
  const timer = setInterval(() => {
    messageIndex = Math.min(messageIndex + 1, messages.length - 1);
    loadingMessage.value = messages[messageIndex];
  }, 700);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generate_onboarding_greeting',
      resume,
    });
    if (!response?.success || !response.data) {
      throw new Error(response?.error || '生成失败');
    }
    customGreeting.value = String(response.data).trim();
  } catch (error) {
    generationError.value = error.message;
    customGreeting.value = '您好，我对贵公司的岗位很感兴趣。我的过往经历与岗位方向有不少契合之处，希望有机会进一步交流。';
  } finally {
    clearInterval(timer);
    isGenerating.value = false;
  }
}

async function handleNext() {
  await storageSet({
    [STORAGE_KEYS.CUSTOM_GREETING]: props.hasAi ? '' : customGreeting.value.trim(),
    [STORAGE_KEYS.GREETING_COUNT]: props.hasAi ? greetingCount.value : 0,
  });
  emit('next');
}
</script>

<style scoped>
.greeting-loading {
  display: grid;
  min-height: 150px;
  place-content: center;
  justify-items: center;
  gap: 18px;
  background: linear-gradient(145deg, #fff, #f2fbfb);
  border: 1px solid var(--wg-primary-border);
  border-radius: 14px;
}

.loading-line {
  width: 180px;
  height: 4px;
  overflow: hidden;
  background: var(--wg-primary-light);
  border-radius: 4px;
}

.loading-line span {
  display: block;
  width: 45%;
  height: 100%;
  background: var(--wg-primary);
  border-radius: inherit;
  animation: loadingSlide 1.2s ease-in-out infinite;
}

@keyframes loadingSlide {
  from { transform: translateX(-100%); }
  to { transform: translateX(320%); }
}

.greeting-result {
  padding: 14px;
  background: #fff;
  border: 1px solid var(--wg-primary-border);
  border-radius: 12px;
}

.greeting-result label {
  display: block;
  margin-bottom: 8px;
  color: var(--wg-text);
  font-size: 12px;
  font-weight: 700;
}

.generation-note {
  margin: 7px 0 0;
  color: var(--wg-text-light);
  font-size: 9px;
}

.candidate-panel {
  padding: 14px;
  background: #fff;
  border: 1px solid var(--wg-border);
  border-radius: 12px;
}

.candidate-panel > strong {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
}

.candidate-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.candidate-options label {
  padding: 10px 6px;
  text-align: center;
  border: 1px solid var(--wg-border);
  border-radius: 9px;
  cursor: pointer;
}

.candidate-options label.selected {
  color: var(--wg-primary-dark);
  background: var(--wg-primary-light);
  border-color: var(--wg-primary);
}

.candidate-options input {
  display: none;
}

.candidate-options b,
.candidate-options small {
  display: block;
}

.candidate-options b {
  font-size: 12px;
}

.candidate-options small {
  margin-top: 3px;
  color: var(--wg-text-light);
  font-size: 8px;
}

.candidate-panel > p {
  margin: 9px 0 0;
  color: var(--wg-text-light);
  font-size: 9px;
  text-align: center;
}
</style>
