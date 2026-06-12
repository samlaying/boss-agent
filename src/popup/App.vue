<template>
  <div class="popup-container">
    <AppHeader />
    <PingTest />
    <footer class="popup-footer">
      <span>别怕黑，这里有光。</span>
    </footer>
  </div>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue';
import PingTest from './components/PingTest.vue';
</script>

<style scoped>
.popup-container { width: 360px; min-height: 200px; font-family: -apple-system, sans-serif; }
.popup-footer { text-align: center; padding: 8px; font-size: 11px; color: #90a4ae; border-top: 1px solid #eee; }
</style>
