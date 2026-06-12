import { storageGet, storageSet } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

let state = { apiKey: '', resume: '', settings: {} };
const listeners = new Set();

export function getState() { return { ...state }; }

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() { listeners.forEach(fn => fn(state)); }

export async function initStore() {
  const data = await storageGet([STORAGE_KEYS.API_KEY, STORAGE_KEYS.RESUME, STORAGE_KEYS.SETTINGS]);
  state = { ...state, ...data };
  notify();
}

export async function updateState(partial) {
  Object.assign(state, partial);
  await storageSet(partial);
  notify();
}
