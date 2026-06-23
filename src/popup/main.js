import './index.css';

document.getElementById('app').innerHTML = `
  <div class="popup-launcher">
    <header class="app-header">
      <div class="header-row">
        <span class="dot"></span>
        <h3 class="title">Boss Agent</h3>
        <span class="badge">PRO</span>
      </div>
      <p class="subtitle">AI 求职助手</p>
    </header>
    <button id="openOnboardingBtn" class="primary-btn" type="button">打开新手引导</button>
  </div>
`;

document.getElementById('openOnboardingBtn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});
