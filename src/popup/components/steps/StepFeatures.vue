<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        ⚙️
      </div>
      <h2>选择你的投递助手功能</h2>
      <p class="step-desc">
        请选择你需要的 AI 辅助功能（可多选）：
      </p>
    </div>

    <!-- Greeting Generation -->
    <div
      class="feature-card"
      :class="{ active: enableGreeting }"
    >
      <div class="feature-card-header">
        <div class="feature-card-title">
          <span>🤖</span> 智能打招呼用语生成
        </div>
        <label class="wg-toggle">
          <input
            v-model="enableGreeting"
            type="checkbox"
          >
          <span class="wg-toggle-track" />
        </label>
      </div>
      <div class="feature-card-desc">
        根据岗位 JD 自动生成个性化打招呼用语，提高 HR 回复率。
      </div>
      <div
        v-if="enableGreeting"
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
            {{ n }}条
          </label>
        </div>
      </div>
    </div>

    <!-- Job Analysis -->
    <div
      class="feature-card"
      :class="{ active: enableAnalysis }"
    >
      <div class="feature-card-header">
        <div class="feature-card-title">
          <span>🔍</span> 岗位匹配度分析
        </div>
        <label class="wg-toggle">
          <input
            v-model="enableAnalysis"
            type="checkbox"
          >
          <span class="wg-toggle-track" />
        </label>
      </div>
      <div class="feature-card-desc">
        分析简历与岗位的匹配程度，给出优化建议。
      </div>
    </div>

    <!-- Poster -->
    <div
      class="feature-card"
      :class="{ active: enablePoster }"
    >
      <div class="feature-card-header">
        <div class="feature-card-title">
          <span>🖼️</span> 生成简历投递海报
        </div>
        <label class="wg-toggle">
          <input
            v-model="enablePoster"
            type="checkbox"
          >
          <span class="wg-toggle-track" />
        </label>
      </div>
      <div class="feature-card-desc">
        为本次投递生成可视化简历海报，适合发送给 HR 或分享到社交平台。
      </div>
    </div>

    <!-- Block Rules -->
    <div
      class="feature-card"
      :class="{ active: blockRules.length > 0 }"
    >
      <div class="feature-card-header">
        <div class="feature-card-title">
          <span>🚫</span> 屏蔽不感兴趣的岗位类型
        </div>
      </div>
      <div
        v-if="blockRules.length > 0"
        class="feature-card-desc"
      >
        已设置 {{ blockRules.length }} 个屏蔽规则：{{ blockRules.join('、') }}
      </div>
      <div
        v-else
        class="feature-card-desc"
      >
        未设置屏蔽规则，点击下方添加
      </div>
      <div class="feature-card-options">
        <div class="tag-container">
          <span
            v-for="(rule, idx) in blockRules"
            :key="idx"
            class="tag"
          >
            {{ rule }}
            <span
              class="tag-remove"
              @click="removeRule(idx)"
            >×</span>
          </span>
        </div>
        <div class="tag-input-row">
          <input
            v-model="newRule"
            placeholder="输入关键词，如：外包、销售"
            @keyup.enter="addRule"
          >
          <button
            class="tag-add-btn"
            @click="addRule"
          >
            添加
          </button>
        </div>
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
        保存并继续
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

const emit = defineEmits(['next', 'prev']);

const enableGreeting = ref(true);
const greetingCount = ref(3);
const enableAnalysis = ref(true);
const enablePoster = ref(false);
const blockRules = ref([]);
const newRule = ref('');

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.ENABLE_ANALYSIS,
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.ENABLE_POSTER,
    STORAGE_KEYS.BLOCK_RULES,
  ]);
  enableAnalysis.value = data[STORAGE_KEYS.ENABLE_ANALYSIS] !== false;
  greetingCount.value = data[STORAGE_KEYS.GREETING_COUNT] || 3;
  enablePoster.value = data[STORAGE_KEYS.ENABLE_POSTER] || false;
  blockRules.value = data[STORAGE_KEYS.BLOCK_RULES] || [];
});

function addRule() {
  const rule = newRule.value.trim();
  if (rule && !blockRules.value.includes(rule)) {
    blockRules.value.push(rule);
    newRule.value = '';
    save();
  }
}

function removeRule(idx) {
  blockRules.value.splice(idx, 1);
  save();
}

async function save() {
  await storageSet({
    [STORAGE_KEYS.ENABLE_ANALYSIS]: enableAnalysis.value,
    [STORAGE_KEYS.GREETING_COUNT]: greetingCount.value,
    [STORAGE_KEYS.ENABLE_POSTER]: enablePoster.value,
    [STORAGE_KEYS.BLOCK_RULES]: blockRules.value,
  });
}

async function handleNext() {
  await save();
  emit('next');
}
</script>
