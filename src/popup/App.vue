<template>
  <div class="wizard-container">
    <AppHeader
      :show-settings="isDashboard"
      @open-settings="startWizard"
    />

    <!-- Progress Bar (wizard mode only) -->
    <WizardProgress
      v-if="!isDashboard"
      :current="currentStep"
      :total="4"
    />

    <div class="wizard-body">
      <!-- Wizard Steps -->
      <StepApiKey
        v-if="currentStep === 1"
        @next="goNext"
      />
      <StepResume
        v-else-if="currentStep === 2"
        @next="goNext"
        @prev="goPrev"
      />
      <StepFeatures
        v-else-if="currentStep === 3"
        @next="goNext"
        @prev="goPrev"
      />
      <StepAdvanced
        v-else-if="currentStep === 4"
        @next="handleComplete"
        @prev="goPrev"
      />

      <!-- Complete / Dashboard -->
      <StepComplete
        v-else-if="currentStep === 5 || isDashboard"
        :dashboard="isDashboard"
        @reconfigure="startWizard"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storageGet, storageSet } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

import AppHeader from './components/AppHeader.vue';
import WizardProgress from './components/WizardProgress.vue';
import StepApiKey from './components/steps/StepApiKey.vue';
import StepResume from './components/steps/StepResume.vue';
import StepFeatures from './components/steps/StepFeatures.vue';
import StepAdvanced from './components/steps/StepAdvanced.vue';
import StepComplete from './components/steps/StepComplete.vue';

const currentStep = ref(1);
const isDashboard = ref(false);

onMounted(async () => {
  const data = await storageGet([STORAGE_KEYS.SETUP_COMPLETED]);
  if (data[STORAGE_KEYS.SETUP_COMPLETED]) {
    isDashboard.value = true;
    currentStep.value = 5;
  }
});

function goNext() {
  currentStep.value++;
}

function goPrev() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function startWizard() {
  isDashboard.value = false;
  currentStep.value = 1;
}

async function handleComplete() {
  await storageSet({ [STORAGE_KEYS.SETUP_COMPLETED]: true });
  isDashboard.value = true;
  currentStep.value = 5;
}
</script>
