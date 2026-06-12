import { onMessage } from '../utils/message.js';
import { handleMessage } from './router.js';

console.log('🚀 Background service worker loaded');
onMessage((message, sender) => handleMessage(message, sender));
