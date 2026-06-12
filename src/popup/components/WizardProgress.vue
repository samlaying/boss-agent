<template>
  <div class="wizard-progress">
    <div
      v-for="i in total"
      :key="i"
      class="progress-step"
    >
      <div
        class="progress-dot"
        :class="{
          active: i === current,
          done: i < current,
        }"
      >
        <span v-if="i < current">✓</span>
        <span v-else>{{ i }}</span>
      </div>
      <div
        v-if="i < total"
        class="progress-line"
        :class="{ done: i < current }"
      />
    </div>
  </div>
</template>

<script setup>
defineProps({
  current: { type: Number, required: true },
  total: { type: Number, default: 4 },
});
</script>

<style scoped>
.wizard-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px 4px;
  gap: 0;
}

.progress-step {
  display: flex;
  align-items: center;
}

.progress-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e8e8e8;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.3s;
  flex-shrink: 0;
}

.progress-dot.active {
  background: var(--wg-primary);
  color: #fff;
  box-shadow: 0 0 0 3px var(--wg-primary-light);
}

.progress-dot.done {
  background: var(--wg-success);
  color: #fff;
}

.progress-line {
  width: 40px;
  height: 2px;
  background: #e8e8e8;
  transition: background 0.3s;
}

.progress-line.done {
  background: var(--wg-success);
}
</style>
