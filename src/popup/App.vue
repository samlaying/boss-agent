<template>
  <div
    v-if="isLoading"
    class="popup-loading"
  >
    <span class="loading-orbit" />
    <p>正在读取你的配置…</p>
  </div>

  <div
    v-else
    class="wizard-container"
    :class="{ 'dashboard-container': isDashboard }"
  >
    <AppHeader
      :show-settings="isDashboard"
      @open-settings="openConfigCenter"
    />

    <DashboardView
      v-if="isDashboard"
      @reconfigure="startWizard"
    />

    <!-- Progress Bar (wizard mode only) -->
    <WizardProgress
      v-else
      :current="stepIndex"
      :total="stepTotal"
    />

    <div
      v-if="!isDashboard"
      class="wizard-body"
    >
      <!-- Wizard Steps -->
      <StepFeatures
        v-if="currentStep === 'features'"
        @next="onFeaturesNext"
      />
      <StepApiKey
        v-else-if="currentStep === 'apikey'"
        @next="goNext"
        @prev="goPrev"
      />
      <StepResume
        v-else-if="currentStep === 'resume'"
        :has-ai="hasAiFeatures"
        @next="goNext"
        @prev="goPrev"
      />
      <StepConfig
        v-else-if="currentStep === 'config'"
        :has-ai="hasAiFeatures"
        @next="handleComplete"
        @prev="goPrev"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet, storageSet } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { openConfigCenter } from '../utils/open-config.js';

import AppHeader from './components/AppHeader.vue';
import WizardProgress from './components/WizardProgress.vue';
import StepApiKey from './components/steps/StepApiKey.vue';
import StepResume from './components/steps/StepResume.vue';
import StepFeatures from './components/steps/StepFeatures.vue';
import StepConfig from './components/steps/StepConfig.vue';
import DashboardView from './views/DashboardView.vue';

const currentStep = ref('features');
const isDashboard = ref(false);
const isLoading = ref(true);
const hasAiFeatures = ref(false);

// Without AI: features → resume → config
// With AI:    features → apikey → resume → config
const stepsWithAi = ['features', 'apikey', 'resume', 'config'];
const stepsWithoutAi = ['features', 'resume', 'config'];

const stepList = computed(() => hasAiFeatures.value ? stepsWithAi : stepsWithoutAi);
const stepIndex = computed(() => stepList.value.indexOf(currentStep.value) + 1);
const stepTotal = computed(() => stepList.value.length);

onMounted(async () => {
  try {
    const data = await storageGet([
      STORAGE_KEYS.SETUP_COMPLETED,
      STORAGE_KEYS.GREETING_COUNT,
    ]);
    isDashboard.value = data[STORAGE_KEYS.SETUP_COMPLETED] === true;
    hasAiFeatures.value = (data[STORAGE_KEYS.GREETING_COUNT] || 0) > 0;
  } finally {
    isLoading.value = false;
  }
});

function onFeaturesNext(hasAi) {
  hasAiFeatures.value = hasAi;
  goNext();
}

function goNext() {
  const list = stepList.value;
  const idx = list.indexOf(currentStep.value);
  if (idx >= 0 && idx < list.length - 1) {
    currentStep.value = list[idx + 1];
  }
}

function goPrev() {
  const list = stepList.value;
  const idx = list.indexOf(currentStep.value);
  if (idx > 0) {
    currentStep.value = list[idx - 1];
  }
}

function startWizard() {
  isDashboard.value = false;
  currentStep.value = 'features';
}

async function handleComplete() {
  await storageSet({ [STORAGE_KEYS.SETUP_COMPLETED]: true });
  isDashboard.value = true;
}
</script>
