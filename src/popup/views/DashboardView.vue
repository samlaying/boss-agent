<template>
  <main class="dashboard-view">
    <section class="dashboard-hero">
      <div>
        <span class="eyebrow">今日求职搭子</span>
        <h1>准备好了，去找值得的机会。</h1>
        <p>配置已经保存。打开 Boss 直聘后，职位分析和打招呼能力会自动就位。</p>
      </div>
      <span class="hero-mark">✨</span>
    </section>

    <section class="status-section">
      <div class="section-heading">
        <h2>配置状态</h2>
        <span>{{ readyCount }}/3 已就绪</span>
      </div>
      <div class="status-grid">
        <article
          v-for="item in statusItems"
          :key="item.label"
          class="status-tile"
          :class="{ ready: item.ready }"
        >
          <span class="status-icon">{{ item.icon }}</span>
          <div>
            <strong>{{ item.label }}</strong>
            <small>{{ item.detail }}</small>
          </div>
          <span class="status-dot">{{ item.ready ? '✓' : '!' }}</span>
        </article>
      </div>
    </section>

    <section class="dashboard-actions">
      <button
        class="primary-action"
        @click="openZhipin"
      >
        <span>打开 Boss 直聘</span>
        <span aria-hidden="true">→</span>
      </button>
      <div class="secondary-actions">
        <button @click="openOptions">
          <span>⚙️</span>
          打开完整设置
        </button>
        <button @click="emit('reconfigure')">
          <span>↺</span>
          重新运行新手引导
        </button>
      </div>
    </section>

    <p class="dashboard-footnote">
      所有简历和配置都保存在你的浏览器本地。
    </p>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { storageGet } from '../../utils/storage.js';
import {
  API_KEY_MIN_LENGTH,
  RESUME_EXISTS_THRESHOLD,
  STORAGE_KEYS,
  ZHIPIN_JOB_URL,
} from '../../utils/constants.js';

const emit = defineEmits(['reconfigure']);

const apiKey = ref('');
const resume = ref('');
const greetingCount = ref(0);
const customGreeting = ref('');

const statusItems = computed(() => [
  {
    icon: '📄',
    label: '个人简历',
    ready: resume.value.trim().length >= RESUME_EXISTS_THRESHOLD,
    detail: resume.value.trim().length >= RESUME_EXISTS_THRESHOLD ? '已保存，可用于岗位匹配' : '尚未完善',
  },
  {
    icon: '🧠',
    label: 'AI 引擎',
    ready: greetingCount.value === 0 || apiKey.value.trim().length >= API_KEY_MIN_LENGTH,
    detail: greetingCount.value > 0 ? 'AI 话术已启用' : '当前使用自定义话术',
  },
  {
    icon: '💬',
    label: '沟通话术',
    ready: greetingCount.value > 0 || customGreeting.value.trim().length > 0,
    detail: greetingCount.value > 0 ? `每次生成 ${greetingCount.value} 条` : '使用固定打招呼语',
  },
]);

const readyCount = computed(() => statusItems.value.filter(item => item.ready).length);

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.API_KEY,
    STORAGE_KEYS.RESUME,
    STORAGE_KEYS.GREETING_COUNT,
    STORAGE_KEYS.CUSTOM_GREETING,
  ]);
  apiKey.value = data[STORAGE_KEYS.API_KEY] || '';
  resume.value = data[STORAGE_KEYS.RESUME] || '';
  greetingCount.value = Number(data[STORAGE_KEYS.GREETING_COUNT] || 0);
  customGreeting.value = data[STORAGE_KEYS.CUSTOM_GREETING] || '';
});

function openZhipin() {
  chrome.tabs.create({ url: ZHIPIN_JOB_URL });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}
</script>

<style scoped>
.dashboard-view {
  padding: 16px;
}

.dashboard-hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
  color: #fff;
  background:
    radial-gradient(circle at 85% 10%, rgba(255,255,255,.22), transparent 32%),
    linear-gradient(135deg, #102f36 0%, #006f72 55%, #00a7a5 100%);
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(0, 111, 114, .2);
}

.eyebrow {
  display: block;
  margin-bottom: 7px;
  color: rgba(255,255,255,.7);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
}

.dashboard-hero h1 {
  max-width: 260px;
  margin: 0 0 8px;
  font-size: 19px;
  line-height: 1.35;
}

.dashboard-hero p {
  max-width: 290px;
  margin: 0;
  color: rgba(255,255,255,.78);
  font-size: 11px;
  line-height: 1.6;
}

.hero-mark {
  font-size: 30px;
}

.status-section {
  margin-top: 18px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.section-heading h2 {
  margin: 0;
  color: var(--wg-text);
  font-size: 13px;
}

.section-heading span {
  color: var(--wg-text-light);
  font-size: 10px;
}

.status-grid {
  display: grid;
  gap: 8px;
}

.status-tile {
  display: grid;
  grid-template-columns: 30px 1fr 22px;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  background: #fff;
  border: 1px solid var(--wg-border);
  border-radius: 11px;
}

.status-tile.ready {
  border-color: rgba(0, 190, 189, .24);
}

.status-icon {
  font-size: 18px;
}

.status-tile strong,
.status-tile small {
  display: block;
}

.status-tile strong {
  color: var(--wg-text);
  font-size: 12px;
}

.status-tile small {
  margin-top: 2px;
  color: var(--wg-text-light);
  font-size: 10px;
}

.status-dot {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  color: #fff;
  background: #ffad42;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
}

.ready .status-dot {
  background: var(--wg-primary);
}

.dashboard-actions {
  margin-top: 16px;
}

.primary-action {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 13px 15px;
  color: #fff;
  background: var(--wg-primary-dark);
  border: 0;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.primary-action:hover {
  background: #007a79;
}

.secondary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.secondary-actions button {
  padding: 10px 8px;
  color: var(--wg-text-sec);
  background: #fff;
  border: 1px solid var(--wg-border);
  border-radius: 9px;
  font-size: 10px;
  cursor: pointer;
}

.secondary-actions button:hover {
  color: var(--wg-primary-dark);
  border-color: var(--wg-primary-border);
}

.dashboard-footnote {
  margin: 14px 0 2px;
  color: var(--wg-text-hint);
  font-size: 9px;
  text-align: center;
}
</style>
