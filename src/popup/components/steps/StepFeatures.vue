<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        ✨
      </div>
      <h2>选择你的沟通方式</h2>
      <p class="step-desc">
        自动打招呼和岗位简报都会开启，你只需要选择话术如何生成。
      </p>
    </div>

    <div class="core-benefits">
      <div>
        <span>💬</span>
        <strong>自动打招呼</strong>
        <small>用你的方式，自然开启沟通</small>
      </div>
      <div>
        <span>📋</span>
        <strong>岗位简报</strong>
        <small>快速读懂要求、优势与风险</small>
      </div>
    </div>

    <div class="mode-grid">
      <button
        class="mode-card"
        :class="{ selected: selectedMode === 'standard' }"
        @click="selectedMode = 'standard'"
      >
        <span class="mode-radio" />
        <span class="mode-copy">
          <strong>标准模式</strong>
          <b>使用固定话术，开箱即用。</b>
          <small>我们会根据你的简历准备一条专属开场白，你可以继续修改。</small>
        </span>
      </button>

      <button
        class="mode-card"
        :class="{ selected: selectedMode === 'ai' }"
        @click="selectedMode = 'ai'"
      >
        <span class="mode-radio" />
        <span class="mode-copy">
          <span class="mode-title">
            <strong>AI 个性化模式</strong>
            <em>推荐</em>
          </span>
          <b>结合简历和每个岗位，逐岗生成专属话术。</b>
          <small>需要连接 DeepSeek，适合希望沟通更有针对性的用户。</small>
        </span>
      </button>
    </div>

    <p class="mode-note">
      使用方式可随时在完整设置中调整。
    </p>

    <div class="step-nav">
      <button
        class="btn-next"
        @click="handleNext"
      >
        继续
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

const emit = defineEmits(['next']);
const selectedMode = ref('standard');

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.COMPUTE_MODE,
    STORAGE_KEYS.GREETING_COUNT,
  ]);
  if (data[STORAGE_KEYS.COMPUTE_MODE] === 'custom_key'
      || Number(data[STORAGE_KEYS.GREETING_COUNT] || 0) > 0) {
    selectedMode.value = 'ai';
  }
});

async function handleNext() {
  const hasAi = selectedMode.value === 'ai';
  await storageSet({
    [STORAGE_KEYS.COMPUTE_MODE]: hasAi ? 'custom_key' : 'energy',
    [STORAGE_KEYS.GREETING_COUNT]: hasAi ? 3 : 0,
  });
  emit('next', hasAi);
}
</script>

<style scoped>
.core-benefits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.core-benefits div {
  display: grid;
  grid-template-columns: 24px 1fr;
  padding: 10px;
  background: #fff;
  border: 1px solid var(--wg-border);
  border-radius: 10px;
}

.core-benefits span {
  grid-row: 1 / 3;
  font-size: 17px;
}

.core-benefits strong {
  color: var(--wg-text);
  font-size: 11px;
}

.core-benefits small {
  color: var(--wg-text-light);
  font-size: 9px;
}

.mode-grid {
  display: grid;
  gap: 9px;
}

.mode-card {
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 13px;
  color: inherit;
  text-align: left;
  background: #fff;
  border: 1.5px solid var(--wg-border);
  border-radius: 12px;
  cursor: pointer;
}

.mode-card.selected {
  background: rgba(0, 190, 189, .05);
  border-color: var(--wg-primary);
  box-shadow: 0 0 0 3px var(--wg-primary-light);
}

.mode-radio {
  width: 15px;
  height: 15px;
  margin-top: 2px;
  border: 2px solid #c8d1d4;
  border-radius: 50%;
  flex: 0 0 auto;
}

.selected .mode-radio {
  border: 4px solid var(--wg-primary);
}

.mode-copy,
.mode-copy b,
.mode-copy small {
  display: block;
}

.mode-copy {
  flex: 1;
}

.mode-copy strong {
  font-size: 13px;
}

.mode-copy b {
  margin-top: 5px;
  color: var(--wg-text-sec);
  font-size: 11px;
  font-weight: 600;
}

.mode-copy small {
  margin-top: 3px;
  color: var(--wg-text-light);
  font-size: 10px;
  line-height: 1.5;
}

.mode-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mode-title em {
  padding: 2px 7px;
  color: var(--wg-primary-dark);
  background: var(--wg-primary-light);
  border-radius: 10px;
  font-size: 9px;
  font-style: normal;
}

.mode-note {
  margin: 10px 0 0;
  color: var(--wg-text-light);
  font-size: 9px;
  text-align: center;
}
</style>
