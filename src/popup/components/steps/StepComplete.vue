<template>
  <div class="step-content">
    <!-- Wizard Complete Mode -->
    <template v-if="!dashboard">
      <div class="step-header">
        <div class="complete-badge">
          ✓
        </div>
        <h2>配置完成！微光已就绪</h2>
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
        <h2>微光已就绪</h2>
      </div>

      <div class="dashboard-status">
        <div class="status-row">
          <span class="check">✓</span> AI 引擎已连接
        </div>
        <div class="status-row">
          <span :class="hasResume ? 'check' : 'warn'">
            {{ hasResume ? '✓' : '⚠' }}
          </span>
          {{ hasResume ? '简历已配置' : '简历未配置' }}
        </div>
        <div class="status-row">
          <span class="check">✓</span> 功能已启用 ({{ enabledFeatures }})
        </div>
      </div>
    </template>

    <!-- Usage Instructions -->
    <div class="usage-steps">
      <div class="usage-step">
        <span class="usage-step-num">1</span>
        <span>打开 Boss 直聘 / 猎聘等招聘网站</span>
      </div>
      <div class="usage-step">
        <span class="usage-step-num">2</span>
        <span>找到感兴趣的岗位，点击微光插件图标</span>
      </div>
      <div class="usage-step">
        <span class="usage-step-num">3</span>
        <span>选择「生成打招呼用语」或「分析匹配」</span>
      </div>
      <div class="usage-step">
        <span class="usage-step-num">4</span>
        <span>一键投递，微光会自动帮你优化话术</span>
      </div>
    </div>

    <div class="quick-actions">
      <button
        class="quick-btn"
        @click="openZhipin"
      >
        🌐 打开招聘网站
      </button>
      <button
        class="quick-btn"
        @click="$emit('reconfigure')"
      >
        ⚙️ 重新配置
      </button>
    </div>

    <div style="text-align: center; margin-top: 16px; font-size: 11px; color: var(--wg-text-light);">
      ⚠️ 如需修改配置，随时点击「重新配置」
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

defineProps({
  dashboard: { type: Boolean, default: false },
});

const emit = defineEmits(['reconfigure']);

const hasResume = ref(false);
const enableGreeting = ref(true);
const enableAnalysis = ref(true);

const enabledFeatures = computed(() => {
  const features = [];
  if (enableGreeting.value) features.push('打招呼');
  if (enableAnalysis.value) features.push('匹配分析');
  return features.join('、');
});

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.RESUME,
    STORAGE_KEYS.ENABLE_ANALYSIS,
  ]);
  hasResume.value = !!(data[STORAGE_KEYS.RESUME] && data[STORAGE_KEYS.RESUME].length > 50);
  enableAnalysis.value = data[STORAGE_KEYS.ENABLE_ANALYSIS] !== false;
});

function openZhipin() {
  chrome.tabs.create({ url: 'https://www.zhipin.com/web/geek/job-recommend' });
}
</script>
