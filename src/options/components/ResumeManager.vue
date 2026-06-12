<template>
  <div class="resume-manager">
    <h2>📄 简历管理</h2>

    <!-- 上传区 -->
    <div class="upload-section">
      <div class="upload-actions">
        <label class="upload-btn">
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            hidden
            @change="handleFileUpload"
          >
          📎 上传简历
        </label>
        <span class="divider">或</span>
        <button
          class="paste-btn"
          @click="showPaste = !showPaste"
        >
          {{ showPaste ? '收起' : '📋 粘贴文本' }}
        </button>
      </div>

      <!-- 粘贴区 -->
      <textarea
        v-if="showPaste"
        v-model="rawText"
        class="raw-textarea"
        rows="6"
        placeholder="粘贴简历原文..."
        @input="onRawTextChange"
      />

      <!-- 文件名提示 -->
      <div
        v-if="fileName"
        class="file-info"
      >
        📄 {{ fileName }}
        <button
          class="clear-btn"
          @click="clearFile"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- AI 提取 -->
    <div class="extract-section">
      <button
        class="extract-btn"
        :disabled="!rawText || extracting"
        @click="extractResume"
      >
        {{ extracting ? '⏳ 提取中...' : '🤖 AI 提取精简' }}
      </button>
      <span
        v-if="extractError"
        class="error"
      >{{ extractError }}</span>
    </div>

    <!-- 精简简历编辑区 -->
    <div class="clean-section">
      <label>精简简历（可编辑）</label>
      <textarea
        v-model="cleanResume"
        class="clean-textarea"
        rows="12"
        placeholder="上传 PDF/Word 或粘贴文本后，点击「AI 提取精简」..."
        @input="onCleanChange"
      />
      <div class="footer">
        <span class="char-count">已输入 {{ cleanResume.length }} 字符</span>
        <span
          v-if="saved"
          class="save-toast"
        >✅ 已保存</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { extractTextFromFile } from '../../utils/pdf-extract.js';
import { storageGet, storageSet } from '../../utils/storage.js';
import { STORAGE_KEYS, MESSAGE_TYPES } from '../../utils/constants.js';
import { sendToBackground } from '../../utils/message.js';

const rawText = ref('');
const cleanResume = ref('');
const fileName = ref('');
const showPaste = ref(false);
const extracting = ref(false);
const extractError = ref('');
const saved = ref(false);
let saveTimer = null;

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.RESUME_PDF_RAW,
    STORAGE_KEYS.RESUME_CLEAN,
    STORAGE_KEYS.RESUME,
  ]);
  rawText.value = data[STORAGE_KEYS.RESUME_PDF_RAW] || '';
  cleanResume.value = data[STORAGE_KEYS.RESUME_CLEAN] || data[STORAGE_KEYS.RESUME] || '';
});

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  fileName.value = file.name;
  extractError.value = '';

  try {
    rawText.value = await extractTextFromFile(file);
    await storageSet({ [STORAGE_KEYS.RESUME_PDF_RAW]: rawText.value });
  } catch (err) {
    extractError.value = '文件解析失败: ' + err.message;
  }
}

function clearFile() {
  fileName.value = '';
  rawText.value = '';
  storageSet({ [STORAGE_KEYS.RESUME_PDF_RAW]: '' });
}

function onRawTextChange() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storageSet({ [STORAGE_KEYS.RESUME_PDF_RAW]: rawText.value });
  }, 500);
}

async function extractResume() {
  if (!rawText.value) return;
  extracting.value = true;
  extractError.value = '';

  try {
    const res = await sendToBackground({
      type: MESSAGE_TYPES.EXTRACT_RESUME,
      payload: { resumeRaw: rawText.value },
    });

    if (res.error) {
      extractError.value = res.error;
    } else {
      cleanResume.value = res.resumeClean;
      await storageSet({
        [STORAGE_KEYS.RESUME_CLEAN]: res.resumeClean,
        [STORAGE_KEYS.RESUME]: res.resumeClean, // 同步到主 resume key
      });
    }
  } catch (err) {
    extractError.value = '请求失败: ' + err.message;
  } finally {
    extracting.value = false;
  }
}

function onCleanChange() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await storageSet({
      [STORAGE_KEYS.RESUME_CLEAN]: cleanResume.value,
      [STORAGE_KEYS.RESUME]: cleanResume.value,
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  }, 500);
}
</script>

<style scoped>
.resume-manager { margin-bottom: 32px; }
h2 { font-size: 18px; margin-bottom: 16px; color: #333; }
.upload-section { margin-bottom: 16px; }
.upload-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.upload-btn {
  padding: 8px 16px; background: #e3f2fd; color: #1976d2;
  border-radius: 6px; cursor: pointer; font-size: 14px;
}
.upload-btn:hover { background: #bbdefb; }
.divider { color: #999; font-size: 13px; }
.paste-btn {
  padding: 8px 16px; background: #f5f5f5; border: 1px solid #ddd;
  border-radius: 6px; cursor: pointer; font-size: 14px;
}
.raw-textarea {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 13px; resize: vertical;
}
.file-info {
  margin-top: 8px; padding: 6px 10px; background: #f9f9f9;
  border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 8px;
}
.clear-btn { background: none; border: none; cursor: pointer; color: #999; }
.extract-section { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.extract-btn {
  padding: 8px 20px; background: #4caf50; color: white;
  border: none; border-radius: 6px; cursor: pointer; font-size: 14px;
}
.extract-btn:disabled { background: #ccc; cursor: not-allowed; }
.error { color: #e53935; font-size: 13px; }
.clean-section label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
.clean-textarea {
  width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 13px; resize: vertical; line-height: 1.6;
}
.footer { display: flex; justify-content: space-between; margin-top: 6px; }
.char-count { font-size: 12px; color: #999; }
.save-toast { font-size: 13px; color: #4caf50; }
</style>
