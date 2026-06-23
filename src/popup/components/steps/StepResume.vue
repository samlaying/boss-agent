<template>
  <div class="step-content">
    <div class="step-header">
      <div class="step-icon">
        📄
      </div>
      <h2>上传你的简历</h2>
      <p class="step-desc">
        Boss Agent会根据简历内容为你生成针对性打招呼用语、分析岗位匹配度。
      </p>
    </div>

    <!-- Upload Actions -->
    <div class="upload-actions">
      <label class="upload-btn">
        <input
          type="file"
          accept=".pdf,.docx,.doc"
          hidden
          @change="handleFileUpload"
        >
        📎 上传文件
      </label>
      <span class="upload-divider">或</span>
      <button
        class="paste-btn"
        @click="showPaste = !showPaste"
      >
        {{ showPaste ? '收起' : '📋 粘贴文本' }}
      </button>
    </div>

    <!-- File Info -->
    <div
      v-if="fileName"
      class="file-info"
    >
      📄 {{ fileName }}
      <button
        class="file-clear"
        @click="clearFile"
      >
        ✕
      </button>
    </div>

    <!-- Paste Area -->
    <textarea
      v-if="showPaste"
      v-model="rawText"
      class="wg-textarea"
      rows="4"
      placeholder="粘贴简历原文..."
      @input="onRawTextChange"
    />

    <!-- Upload Error -->
    <div
      v-if="extractError"
      style="color: var(--wg-error); font-size: 12px; margin: 8px 0; padding: 8px 12px; background: #fff5f5; border-radius: 6px;"
    >
      {{ extractError }}
    </div>

    <!-- Clean Resume -->
    <div
      class="form-group"
      style="margin-top: 16px;"
    >
      <label>简历内容</label>
      <textarea
        v-model="cleanResume"
        class="wg-textarea"
        rows="5"
        placeholder="上传文件或粘贴文本后，简历将显示在这里..."
        @input="onCleanChange"
      />
      <div class="resume-footer">
        <span class="char-count">已输入 {{ cleanResume.length }} 字符</span>
        <span
          v-if="saved"
          class="save-toast"
        >✅ 已保存</span>
      </div>
    </div>

    <!-- Navigation -->
    <div class="step-nav">
      <button
        class="btn-prev"
        @click="$emit('prev')"
      >
        上一步
      </button>
      <button
        class="btn-next"
        :disabled="!cleanResume"
        @click="handleNext"
      >
        保存并继续
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { extractTextFromFile } from '../../../utils/pdf-extract.js';
import { storageGet, storageSet } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';

const emit = defineEmits(['next', 'prev']);

const rawText = ref('');
const cleanResume = ref('');
const fileName = ref('');
const showPaste = ref(false);
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
    // 始终用文件内容填充简历
    cleanResume.value = rawText.value;
    await saveClean();
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

function onCleanChange() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await saveClean();
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  }, 500);
}

async function saveClean() {
  await storageSet({
    [STORAGE_KEYS.RESUME_CLEAN]: cleanResume.value,
    [STORAGE_KEYS.RESUME]: cleanResume.value,
  });
}

async function handleNext() {
  await saveClean();
  emit('next');
}
</script>
