import { createApp } from 'vue';
import App from './App.vue';
import { initStore } from './store.js';
import './index.css';

async function mount() {
  await initStore();
  createApp(App).mount('#app');
}
mount();
