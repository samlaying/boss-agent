import { MESSAGE_TYPES } from '../utils/constants.js';
import { storageGet, storageSet } from '../utils/storage.js';
import { extractResume, analyzeMatch } from './handlers/ai.js';

export function handleMessage(message, sender) {
  switch (message.type) {
    case MESSAGE_TYPES.PING:
      return { type: MESSAGE_TYPES.PONG, from: 'background' };
    case MESSAGE_TYPES.GET_TAB_INFO:
      return { tabId: sender.tab?.id, url: sender.tab?.url };
    case MESSAGE_TYPES.CONTENT_READY:
      console.log('Content ready on tab:', sender.tab?.id);
      return { acknowledged: true };
    case MESSAGE_TYPES.STORAGE_GET:
      return storageGet(message.payload?.keys ?? null);
    case MESSAGE_TYPES.STORAGE_SET:
      return storageSet(message.payload).then(() => ({ success: true }));
    case MESSAGE_TYPES.EXTRACT_RESUME:
      return extractResume(message.payload, sender);
    case MESSAGE_TYPES.ANALYZE_MATCH:
      return analyzeMatch(message.payload, sender);
    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown type: ' + message.type };
  }
}
