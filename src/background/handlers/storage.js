import { storageGet, storageSet, storageRemove } from '../../utils/storage.js';

export async function get(payload) {
  return storageGet(payload?.keys ?? null);
}

export async function set(payload) {
  await storageSet(payload);
  return { success: true };
}

export async function remove(payload) {
  await storageRemove(payload?.keys);
  return { success: true };
}
