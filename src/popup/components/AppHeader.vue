<template>
  <header class="app-header">
    <div class="header-row">
      <span class="dot" />
      <h3 class="title">
        ✨ 微光
      </h3>
      <span class="badge">PRO</span>
      <span
        v-if="showSettings"
        class="settings-btn"
        title="重新配置"
        @click="$emit('open-settings')"
      >⚙️</span>
    </div>
    <p class="subtitle">
      一款带夜视功能的职场翻译机
    </p>
  </header>
</template>

<script setup>
defineProps({
  showSettings: { type: Boolean, default: false },
});
defineEmits(['open-settings']);
</script>

<style scoped>
.app-header {
  padding: 8px 16px 4px;
  border-bottom: 1px solid rgba(0, 190, 189, 0.15);
}
.header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  background: var(--wg-primary);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--wg-primary);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(0, 190, 189, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(0, 190, 189, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 190, 189, 0); }
}
.title {
  color: #333;
  font-family: 'Times New Roman', serif;
  font-size: 18px;
  margin: 0;
}
.badge {
  background: var(--wg-primary-light);
  color: var(--wg-primary);
  border: 1px solid var(--wg-primary-border);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
}
.settings-btn {
  margin-left: auto;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.settings-btn:hover {
  opacity: 1;
}
.subtitle {
  font-size: 11px;
  color: #90a4ae;
  margin: 4px 0 0;
  font-style: italic;
}
</style>
