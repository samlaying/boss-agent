import { createApp } from 'vue';
import OptionsApp from './OptionsApp.vue';
import { initStore } from '../popup/store.js';

async function mount() {
  await initStore();
  createApp(OptionsApp).mount('#app');
}
mount();
