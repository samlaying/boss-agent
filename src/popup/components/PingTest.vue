<template>
  <div class="ping-section">
    <button class="btn-primary" @click="doPing" :disabled="loading">
      {{ loading ? '发送中...' : '📡 测试连接' }}
    </button>
    <div v-if="result" :class="['result-box', result.success ? 'success' : 'error']">
      {{ result.message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { sendToBackground } from '../../utils/message.js';
import { MESSAGE_TYPES } from '../../utils/constants.js';

const loading = ref(false);
const result = ref(null);

async function doPing() {
  loading.value = true;
  result.value = null;
  try {
    const res = await sendToBackground({ type: MESSAGE_TYPES.PING });
    result.value = { success: true, message: '✅ 连接正常: ' + JSON.stringify(res) };
  } catch (e) {
    result.value = { success: false, message: '❌ ' + e.message };
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.ping-section { padding: 16px; }
.btn-primary { width: 100%; padding: 10px; background: linear-gradient(135deg, #00bebd, #00897b); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
.btn-primary:disabled { opacity: 0.6; }
.result-box { margin-top: 12px; padding: 10px; border-radius: 6px; font-size: 12px; }
.success { background: #e8f5e9; color: #2e7d32; }
.error { background: #ffebee; color: #c62828; }
</style>
