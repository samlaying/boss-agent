import './index.css';
import { initStore } from './store.js';
import { renderApp } from './views/app.js';

console.log('🚀 Popup loaded');
initStore().then(() => renderApp());
