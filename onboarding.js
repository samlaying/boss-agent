document.addEventListener('DOMContentLoaded', () => {
  const openBossBtn = document.getElementById('openBossBtn');
  if (!openBossBtn) return;

  openBossBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.zhipin.com/' });
  });
});
