<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        🔑
      </div>
      <h2>连接 DeepSeek</h2>
      <p class="step-desc">
        用于逐岗生成专属话术和更深入的岗位分析。
      </p>
    </div>

    <div class="form-group">
      <label>DeepSeek API Key</label>
      <div class="input-wrap">
        <input
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          @input="onInput"
        >
        <span
          v-if="apiKey"
          class="input-status"
          :class="isValid ? 'valid' : 'invalid'"
        >
          {{ isValid ? '✓' : '✗' }}
        </span>
      </div>
      <div class="input-hint">
        没有 Key？<a
          :href="DEEPSEEK_PLATFORM_URL"
          target="_blank"
        >点击这里获取 →</a>
      </div>
    </div>

    <div class="step-nav">
      <button
        class="btn-prev"
        @click="$emit('prev')"
      >
        上一步
      </button>
      <button
        class="btn-next"
        :disabled="!isValid"
        @click="handleNext"
      >
        验证并继续
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS, API_KEY_MIN_LENGTH, DEEPSEEK_PLATFORM_URL, DEBOUNCE_DELAY } from '../../../utils/constants.js';

const emit = defineEmits(['next', 'prev']);

const apiKey = ref('');

const isValid = computed(() => apiKey.value.trim().length >= API_KEY_MIN_LENGTH);

onMounted(async () => {
  const data = await storageGet([STORAGE_KEYS.API_KEY]);
  if (data[STORAGE_KEYS.API_KEY]) {
    apiKey.value = data[STORAGE_KEYS.API_KEY];
  }
});

let _timer = null;

function onInput() {
  clearTimeout(_timer);
  _timer = setTimeout(() => {
    storageSet({ [STORAGE_KEYS.API_KEY]: apiKey.value.trim() });
  }, DEBOUNCE_DELAY);
}

async function handleNext() {
  if (!isValid.value) return;
  await storageSet({ [STORAGE_KEYS.API_KEY]: apiKey.value.trim() });
  emit('next');
}
</script>
