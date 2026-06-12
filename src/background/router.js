import { MESSAGE_TYPES } from '../utils/constants.js';

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
      return handleStorageGet(message.payload);
    case MESSAGE_TYPES.STORAGE_SET:
      return handleStorageSet(message.payload);
    default:
      console.warn('Unknown message type:', message.type);
      return { error: 'Unknown type: ' + message.type };
  }
}

async function handleStorageGet(payload) {
  const { storageGet } = await import('../utils/storage.js');
  return storageGet(payload?.keys ?? null);
}

async function handleStorageSet(payload) {
  const { storageSet } = await import('../utils/storage.js');
  await storageSet(payload);
  return { success: true };
}
