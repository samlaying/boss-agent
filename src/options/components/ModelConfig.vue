<template>
  <div class="model-config">
    <h2>🤖 模型配置</h2>

    <!-- 话术模型 -->
    <div class="model-group">
      <label>话术模型</label>
      <select
        v-model="greetingModel"
        @change="save"
      >
        <option
          v-for="m in allModels"
          :key="m.id"
          :value="m.id"
        >
          {{ m.name }}
        </option>
      </select>
    </div>

    <!-- 分析模型（仅开启分析时显示） -->
    <div
      v-if="enableAnalysis"
      class="model-group"
    >
      <label>分析模型</label>
      <select
        v-model="analysisModel"
        @change="save"
      >
        <option
          v-for="m in allModels"
          :key="m.id"
          :value="m.id"
        >
          {{ m.name }}
        </option>
      </select>
    </div>

    <!-- 自定义模型管理 -->
    <div class="custom-section">
      <button
        class="manage-btn"
        @click="showModal = true"
      >
        ⚙️ 管理自定义模型 ({{ customModels.length }})
      </button>
    </div>

    <!-- 自定义模型弹窗 -->
    <CustomModelModal
      v-if="showModal"
      :models="customModels"
      @close="showModal = false"
      @save="onCustomModelsSave"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet, storageSet } from '../../utils/storage.js';
import { STORAGE_KEYS, PRESET_MODELS } from '../../utils/constants.js';
import CustomModelModal from './CustomModelModal.vue';

const greetingModel = ref('deepseek-v4-flash');
const analysisModel = ref('deepseek-v4-flash');
const enableAnalysis = ref(false);
const customModels = ref([]);
const showModal = ref(false);

const allModels = computed(() => [
  ...PRESET_MODELS,
  ...customModels.value.map(m => ({ id: m.id, name: m.name })),
]);

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.GREETING_MODEL,
    STORAGE_KEYS.ANALYSIS_MODEL,
    STORAGE_KEYS.ENABLE_ANALYSIS,
    STORAGE_KEYS.CUSTOM_MODELS,
  ]);
  greetingModel.value = data[STORAGE_KEYS.GREETING_MODEL] || 'deepseek-v4-flash';
  analysisModel.value = data[STORAGE_KEYS.ANALYSIS_MODEL] || 'deepseek-v4-flash';
  enableAnalysis.value = data[STORAGE_KEYS.ENABLE_ANALYSIS] || false;
  customModels.value = data[STORAGE_KEYS.CUSTOM_MODELS] || [];
});

async function save() {
  await storageSet({
    [STORAGE_KEYS.GREETING_MODEL]: greetingModel.value,
    [STORAGE_KEYS.ANALYSIS_MODEL]: analysisModel.value,
  });
}

async function onCustomModelsSave(models) {
  customModels.value = models;
  await storageSet({ [STORAGE_KEYS.CUSTOM_MODELS]: models });
  showModal.value = false;
}
</script>

<style scoped>
.model-config { margin-bottom: 32px; }
h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
.model-group { margin-bottom: 16px; }
.model-group label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
select {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 14px; background: white;
}
.custom-section { margin-top: 16px; }
.manage-btn {
  padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd;
  border-radius: 6px; cursor: pointer; font-size: 14px;
}
.manage-btn:hover { background: #eee; }
</style>
