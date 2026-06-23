import { createApp } from 'vue';
import App from '../popup/App.vue';
import { initStore } from '../popup/store.js';
import '../popup/index.css';

async function mount() {
  await initStore();
  createApp(App).mount('#app');
}

mount();
