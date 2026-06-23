<template>
  <div class="step-content">
    <!-- Wizard Complete Mode -->
    <template v-if="!dashboard">
      <div class="step-header">
        <div class="complete-badge">
          ✓
        </div>
        <h2>配置完成！Boss Agent已就绪</h2>
        <p class="step-desc">
          你的 AI 求职助手已配置完成，接下来开始使用吧。
        </p>
      </div>
    </template>

    <!-- Dashboard Mode (returning user) -->
    <template v-else>
      <div
        class="step-header"
        style="margin-bottom: 12px;"
      >
        <div class="step-icon">
          ✨
        </div>
        <h2>Boss Agent已就绪</h2>
      </div>
    </template>

    <!-- Status Cards (expandable) -->
    <div class="dashboard-status">
      <!-- AI Engine (only when AI is enabled) -->
      <div
        v-if="enableGreeting"
        class="status-card"
        :class="{ expanded: expandedItems.has('engine') }"
      >
        <div
          class="status-row clickable"
          @click="toggleItem('engine')"
        >
          <span :class="apiKey ? 'check' : 'warn'">
            {{ apiKey ? '✓' : '⚠' }}
          </span>
          <span class="status-label">{{ apiKey ? 'AI 引擎已连接' : 'AI 引擎未配置' }}</span>
          <span class="status-arrow">{{ expandedItems.has('engine') ? '▾' : '▸' }}</span>
        </div>
        <div
          v-if="expandedItems.has('engine')"
          class="status-body"
        >
          <div class="form-group">
            <label>DeepSeek API Key</label>
            <div class="input-wrap">
              <input
                v-model="apiKey"
                type="password"
                placeholder="sk-..."
              >
              <span
                v-if="apiKey"
                class="input-status"
                :class="apiKeyValid ? 'valid' : 'invalid'"
              >
                {{ apiKeyValid ? '✓' : '✗' }}
              </span>
            </div>
            <div class="input-hint">
              没有 Key？<a
                href="https://platform.deepseek.com"
                target="_blank"
              >点击这里获取 →</a>
            </div>
          </div>
          <button
            class="btn-save-inline"
            @click.stop="saveApiKey"
          >
            保存
          </button>
        </div>
      </div>

      <!-- Resume -->
      <div
        class="status-card"
        :class="{ expanded: expandedItems.has('resume') }"
      >
        <div
          class="status-row clickable"
          @click="toggleItem('resume')"
        >
          <span :class="hasResume ? 'check' : 'warn'">
            {{ hasResume ? '✓' : '⚠' }}
          </span>
          <span class="status-label">{{ hasResume ? '简历已配置' : '简历未配置' }}</span>
          <span class="status-arrow">{{ expandedItem === 'resume' ? '▾' : '▸' }}</span>
        </div>
        <div
          v-if="expandedItems.has('resume')"
          class="status-body"
        >
          <div class="form-group">
            <label>简历内容</label>
            <textarea
              v-model="resumeText"
              class="wg-textarea"
              rows="6"
              placeholder="粘贴你的简历文本..."
            />
            <div class="char-count">
              {{ resumeText.length }} 字
            </div>
          </div>
          <button
            class="btn-save-inline"
            @click.stop="saveResume"
          >
            保存
          </button>
        </div>
      </div>

      <!-- Features -->
      <div
        class="status-card"
        :class="{ expanded: expandedItems.has('features') }"
      >
        <div
          class="status-row clickable"
          @click="toggleItem('features')"
        >
          <span class="check">✓</span>
          <span class="status-label">功能已启用 ({{ enabledFeatures }})</span>
          <span class="status-arrow">{{ expandedItem === 'features' ? '▾' : '▸' }}</span>
        </div>
        <div
          v-if="expandedItems.has('features')"
          class="status-body"
        >
          <!-- 基础：自动打招呼 + 自定义用语 -->
          <div class="feature-card-inline active">
            <div class="feature-card-header">
              <div class="feature-card-title">
                <span>💬</span> 自动打招呼
              </div>
              <span class="feature-tag">基础</span>
            </div>
            <div
              v-if="customGreeting"
              class="feature-greeting-preview"
            >
              {{ customGreeting }}
            </div>
            <div
              v-else
              class="feature-card-desc"
            >
              未配置自定义打招呼用语
            </div>
          </div>

          <!-- AI 生成打招呼用语 -->
          <div class="feature-card-inline">
            <div class="feature-card-header">
              <div class="feature-card-title">
                <span>🤖</span> AI 生成打招呼用语
              </div>
              <label class="wg-toggle">
                <input
                  v-model="enableGreeting"
                  type="checkbox"
                >
                <span class="wg-toggle-track" />
              </label>
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
                  每次生成 {{ n }} 条
                </label>
              </div>
            </div>
          </div>

          <button
            class="btn-save-inline"
            @click.stop="saveFeatures"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <button
        class="quick-btn"
        @click="openZhipin"
      >
        🌐 打开招聘网站
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

defineProps({
  dashboard: { type: Boolean, default: false },
});

const hasResume = ref(false);
const enableGreeting = ref(true);
const greetingCount = ref(3);
const customGreeting = ref('');
const expandedItems = ref(new Set());
const apiKey = ref('');
const resumeText = ref('');

const apiKeyValid = computed(() => apiKey.value.trim().length >= 8);

// 开启 AI 时默认选中 1 条
watch(enableGreeting, (val) => {
  if (val && greetingCount.value === 0) {
    greetingCount.value = 1;
  }
});

const enabledFeatures = computed(() => {
  const features = ['自动打招呼'];
  if (enableGreeting.value) features.push('AI生成用语');
  return features.join('、');
});

function toggleItem(name) {
  if (expandedItems.value.has(name)) {
    expandedItems.value.delete(name);
  } else {
    expandedItems.value.add(name);
  }
}

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.RESUME,
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.CUSTOM_GREETING,
  ]);
  apiKey.value = data[STORAGE_KEYS.API_KEY] || '';
  resumeText.value = data[STORAGE_KEYS.RESUME] || '';
  customGreeting.value = data[STORAGE_KEYS.CUSTOM_GREETING] || '';
  hasResume.value = !!(data[STORAGE_KEYS.RESUME] && data[STORAGE_KEYS.RESUME].length > 50);
  const gc = data[STORAGE_KEYS.GREETING_COUNT];
  greetingCount.value = gc != null ? gc : 1;
  enableGreeting.value = gc != null ? gc > 0 : false;
  // 默认展开功能卡片
  expandedItems.value.add('features');
});

async function saveApiKey() {
  await storageSet({ [STORAGE_KEYS.API_KEY]: apiKey.value.trim() });
}

async function saveResume() {
  await storageSet({ [STORAGE_KEYS.RESUME]: resumeText.value });
  hasResume.value = !!(resumeText.value && resumeText.value.length > 50);
}

async function saveFeatures() {
  await storageSet({
    [STORAGE_KEYS.GREETING_COUNT]: enableGreeting.value ? greetingCount.value : 0,
  });
}

function openZhipin() {
  chrome.tabs.create({ url: 'https://www.zhipin.com/web/geek/job-recommend' });
}
</script>
