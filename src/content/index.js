import { sendToBackground } from '../utils/message.js';
import { MESSAGE_TYPES } from '../utils/constants.js';
import { startObserver } from './observer.js';
import { initInjector } from './injector.js';

console.log('🚀 Content script loaded');

sendToBackground({ type: MESSAGE_TYPES.CONTENT_READY })
  .then(r => console.log('Background acknowledged:', r))
  .catch(e => console.warn('Notification failed:', e));

startObserver();
initInjector();
