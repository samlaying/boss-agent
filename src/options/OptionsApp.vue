<template>
  <div class="options-container">
    <h1>✨ 微光 - 设置</h1>
    <div class="setting-group">
      <label>DeepSeek API Key</label>
      <input type="password" v-model="apiKey" placeholder="sk-..." @input="save" />
    </div>
    <div class="setting-group">
      <label>简历内容</label>
      <textarea v-model="resume" rows="10" placeholder="粘贴简历..." @input="save"></textarea>
      <span class="char-count">已输入 {{ resume.length }} 字符</span>
    </div>
    <div v-if="saved" class="save-toast">✅ 已保存</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getState, updateState } from '../popup/store.js';

const apiKey = ref('');
const resume = ref('');
const saved = ref(false);
let saveTimer = null;

onMounted(() => {
  const state = getState();
  apiKey.value = state.apiKey || '';
  resume.value = state.resume || '';
});

async function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await updateState({ apiKey: apiKey.value, resume: resume.value });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  }, 500);
}
</script>

<style scoped>
.options-container { max-width: 600px; margin: 40px auto; font-family: -apple-system, sans-serif; padding: 0 20px; }
h1 { color: #333; margin-bottom: 24px; }
.setting-group { margin-bottom: 20px; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
.char-count { font-size: 12px; color: #999; }
.save-toast { position: fixed; bottom: 20px; right: 20px; background: #4caf50; color: white; padding: 10px 20px; border-radius: 6px; }
</style>
