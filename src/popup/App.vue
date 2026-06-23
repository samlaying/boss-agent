<template>
  <div class="wizard-container">
    <AppHeader
      :show-settings="isDashboard"
      @open-settings="startWizard"
    />

    <!-- Progress Bar (wizard mode only) -->
    <WizardProgress
      v-if="!isDashboard"
      :current="stepIndex"
      :total="stepTotal"
    />

    <div class="wizard-body">
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
        @next="goNext"
        @prev="goPrev"
      />
      <StepConfig
        v-else-if="currentStep === 'config'"
        :has-ai="hasAiFeatures"
        @next="handleComplete"
        @prev="goPrev"
      />

      <!-- Complete / Dashboard -->
      <StepComplete
        v-else-if="currentStep === 'complete' || isDashboard"
        :dashboard="isDashboard"
        @reconfigure="startWizard"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { storageGet, storageSet } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

import AppHeader from './components/AppHeader.vue';
import WizardProgress from './components/WizardProgress.vue';
import StepApiKey from './components/steps/StepApiKey.vue';
import StepResume from './components/steps/StepResume.vue';
import StepFeatures from './components/steps/StepFeatures.vue';
import StepConfig from './components/steps/StepConfig.vue';
import StepComplete from './components/steps/StepComplete.vue';

const currentStep = ref('features');
const isDashboard = ref(false);
const hasAiFeatures = ref(false);

// Without AI: features → resume → config → complete
// With AI:    features → apikey → resume → config → complete
const stepsWithAi = ['features', 'apikey', 'resume', 'config', 'complete'];
const stepsWithoutAi = ['features', 'resume', 'config', 'complete'];

const stepList = computed(() => hasAiFeatures.value ? stepsWithAi : stepsWithoutAi);
const stepIndex = computed(() => stepList.value.indexOf(currentStep.value) + 1);
const stepTotal = computed(() => stepList.value.length);

onMounted(async () => {
  const data = await storageGet([
    STORAGE_KEYS.SETUP_COMPLETED,
    STORAGE_KEYS.GREETING_COUNT,
  ]);
  if (data[STORAGE_KEYS.SETUP_COMPLETED]) {
    isDashboard.value = true;
    currentStep.value = 'complete';
  }
  hasAiFeatures.value = (data[STORAGE_KEYS.GREETING_COUNT] || 0) > 0;
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
  currentStep.value = 'complete';
}
</script>
