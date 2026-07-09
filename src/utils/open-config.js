// 共享“打开配置中心”入口。
// popup/options（扩展页）环境有 chrome.runtime.openOptionsPage → 直接打开；
// content script 无该方法 → 委托 background 的 open_options action 打开。
export function openConfigCenter() {
  return new Promise((resolve) => {
    const fallback = () => {
      try {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, () => resolve(true));
      } catch {
        resolve(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.openOptionsPage === 'function') {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime.lastError) fallback();
        else resolve(true);
      });
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // content script 环境：委托后台
      try {
        chrome.runtime.sendMessage({ action: 'open_options' }, () => resolve(true));
      } catch {
        resolve(false);
      }
    } else {
      resolve(false);
    }
  });
}
