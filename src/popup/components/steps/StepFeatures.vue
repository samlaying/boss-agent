<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        ⚙️
      </div>
      <h2>选择你要启用的功能</h2>
      <p class="step-desc">
        Boss Agent 支持多种求职辅助模式，按需开启：
      </p>
    </div>

    <!-- 基础：自动打招呼 -->
    <div class="feature-card active">
      <div class="feature-card-header">
        <div class="feature-card-title">
          <span>💬</span> 自动打招呼
        </div>
        <span class="feature-tag">基础</span>
      </div>
      <div class="feature-card-desc">
        自动沟通循环，批量向 HR 发送打招呼语，支持自定义打招呼用语。
      </div>
    </div>

    <!-- 可选：AI 生成打招呼用语 -->
    <div
      class="feature-card"
      :class="{ active: enableAiGreeting }"
    >
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
      <div class="feature-card-desc">
        根据岗位 JD 自动生成个性化打招呼用语，提高 HR 回复率。需要配置 API Key。
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

    <!-- 屏蔽规则 -->
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
        class="btn-skip"
        @click="handleSkip"
      >
        跳过
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
import { ref, watch, onMounted } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

const emit = defineEmits(['next', 'prev']);

const enableAiGreeting = ref(false);
const greetingCount = ref(1);
const blockRules = ref([]);
const newRule = ref('');

// 开启 AI 时默认选中 1 条
watch(enableAiGreeting, (val) => {
  if (val && greetingCount.value === 0) {
    greetingCount.value = 1;
  }
});

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.BLOCK_RULES,
  ]);
  const saved = data[STORAGE_KEYS.GREETING_COUNT];
  greetingCount.value = saved != null ? saved : 1;
  enableAiGreeting.value = saved != null ? saved > 0 : false;
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
    [STORAGE_KEYS.GREETING_COUNT]: enableAiGreeting.value ? greetingCount.value : 0,
    [STORAGE_KEYS.BLOCK_RULES]: blockRules.value,
  });
}

async function handleNext() {
  await save();
  emit('next', enableAiGreeting.value);
}

async function handleSkip() {
  await save();
  emit('next', enableAiGreeting.value);
}
</script>
