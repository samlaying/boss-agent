export function storageGet(keys) {
  return new Promise((resolve) => { chrome.storage.local.get(keys, resolve); });
}

export function storageSet(items) {
  return new Promise((resolve) => { chrome.storage.local.set(items, resolve); });
}

export function storageRemove(keys) {
  return new Promise((resolve) => { chrome.storage.local.remove(keys, resolve); });
}

export function storageClear() {
  return new Promise((resolve) => { chrome.storage.local.clear(resolve); });
}
