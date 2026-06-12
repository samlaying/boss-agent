<template>
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div class="modal">
      <div class="modal-header">
        <h3>自定义模型管理</h3>
        <button
          class="close-btn"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        <!-- 现有模型列表 -->
        <div
          v-if="models.length"
          class="model-list"
        >
          <div
            v-for="(m, i) in localModels"
            :key="m.id"
            class="model-item"
          >
            <div class="model-info">
              <strong>{{ m.name }}</strong>
              <span class="endpoint">{{ m.endpoint }}</span>
            </div>
            <button
              class="delete-btn"
              @click="removeModel(i)"
            >
              删除
            </button>
          </div>
        </div>
        <p
          v-else
          class="empty"
        >
          暂无自定义模型
        </p>

        <!-- 添加新模型 -->
        <div class="add-section">
          <h4>添加新模型</h4>
          <div class="form-group">
            <input
              v-model="newModel.name"
              placeholder="模型名称（如：小米 MiMo）"
            >
          </div>
          <div class="form-group">
            <input
              v-model="newModel.endpoint"
              placeholder="API Endpoint（如：https://api.example.com）"
            >
          </div>
          <div class="form-group">
            <input
              v-model="newModel.apiKey"
              type="password"
              placeholder="API Key"
            >
          </div>
          <div class="form-group">
            <input
              v-model="newModel.model"
              placeholder="模型 ID（如：mimo-chat）"
            >
          </div>
          <div class="form-actions">
            <button
              class="test-btn"
              :disabled="testing"
              @click="testConnection"
            >
              {{ testing ? '⏳ 测试中...' : '🔗 测试连接' }}
            </button>
            <button
              class="add-btn"
              :disabled="!canAdd"
              @click="addModel"
            >
              + 添加
            </button>
          </div>
          <p
            v-if="testResult"
            :class="['test-result', testResult.ok ? 'success' : 'fail']"
          >
            {{ testResult.message }}
          </p>
        </div>
      </div>

      <div class="modal-footer">
        <button
          class="cancel-btn"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          class="save-btn"
          @click="save"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({ models: { type: Array, default: () => [] } });
const emit = defineEmits(['close', 'save']);

const localModels = ref([...props.models]);
const newModel = ref({ name: '', endpoint: '', apiKey: '', model: '' });
const testing = ref(false);
const testResult = ref(null);

const canAdd = computed(() =>
  newModel.value.name && newModel.value.endpoint && newModel.value.apiKey && newModel.value.model
);

function addModel() {
  if (!canAdd.value) return;
  const id = 'custom_' + Date.now();
  localModels.value.push({ id, ...newModel.value });
  newModel.value = { name: '', endpoint: '', apiKey: '', model: '' };
  testResult.value = null;
}

function removeModel(index) {
  localModels.value.splice(index, 1);
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const response = await fetch(`${newModel.value.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newModel.value.apiKey}`,
      },
      body: JSON.stringify({
        model: newModel.value.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    });
    if (response.ok) {
      testResult.value = { ok: true, message: '✅ 连接成功' };
    } else {
      testResult.value = { ok: false, message: `❌ 连接失败: ${response.status}` };
    }
  } catch (err) {
    testResult.value = { ok: false, message: `❌ 网络错误: ${err.message}` };
  } finally {
    testing.value = false;
  }
}

function save() {
  emit('save', localModels.value);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center;
  justify-content: center; z-index: 1000;
}
.modal {
  background: white; border-radius: 12px; width: 500px; max-height: 80vh;
  display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #eee;
}
.modal-header h3 { margin: 0; font-size: 16px; }
.close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 12px 20px; border-top: 1px solid #eee;
  display: flex; justify-content: flex-end; gap: 8px;
}
.model-list { margin-bottom: 20px; }
.model-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px; background: #f9f9f9; border-radius: 6px; margin-bottom: 8px;
}
.model-info strong { display: block; font-size: 14px; }
.model-info .endpoint { font-size: 12px; color: #888; }
.delete-btn {
  padding: 4px 12px; background: #ffebee; color: #e53935;
  border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
}
.empty { color: #999; font-size: 13px; margin-bottom: 16px; }
.add-section h4 { font-size: 14px; margin-bottom: 12px; }
.form-group { margin-bottom: 10px; }
.form-group input {
  width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 13px;
}
.form-actions { display: flex; gap: 8px; margin-top: 12px; }
.test-btn, .add-btn {
  padding: 8px 16px; border: none; border-radius: 6px;
  cursor: pointer; font-size: 13px;
}
.test-btn { background: #e3f2fd; color: #1976d2; }
.test-btn:disabled { background: #f5f5f5; color: #999; }
.add-btn { background: #4caf50; color: white; }
.add-btn:disabled { background: #ccc; }
.test-result { margin-top: 8px; font-size: 13px; }
.test-result.success { color: #4caf50; }
.test-result.fail { color: #e53935; }
.cancel-btn {
  padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd;
  border-radius: 6px; cursor: pointer;
}
.save-btn {
  padding: 8px 16px; background: #1976d2; color: white;
  border: none; border-radius: 6px; cursor: pointer;
}
</style>
