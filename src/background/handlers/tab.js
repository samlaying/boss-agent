export function getTabInfo(sender) {
  return { tabId: sender.tab?.id, url: sender.tab?.url };
}

export function contentReady(sender) {
  console.log('Content script ready on tab:', sender.tab?.id);
  return { acknowledged: true };
}
