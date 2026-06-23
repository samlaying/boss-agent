import { onMessage } from '../utils/message.js';
import { handleMessage } from './router.js';

console.log('🚀 Background service worker loaded');

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});

onMessage((message, sender) => handleMessage(message, sender));
