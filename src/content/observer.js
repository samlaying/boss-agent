export function startObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        document.dispatchEvent(new CustomEvent('boss-agent:dom-updated', {
          detail: { mutations }
        }));
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  console.log('📡 DOM observer started');
}
