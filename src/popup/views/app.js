import { getState, subscribe } from '../store.js';
import { sendToBackground } from '../../utils/message.js';
import { MESSAGE_TYPES } from '../../utils/constants.js';

export function renderApp() {
  const app = document.getElementById('app');
  function render() {
    app.innerHTML = `
      <div class="popup-container">
        <header class="popup-header">
          <h2>✨ Boss Agent</h2>
          <span class="version-badge">PRO</span>
        </header>
        <section class="popup-body">
          <button id="pingBtn" class="btn-primary">📡 测试连接</button>
          <div id="status" class="status-box"></div>
        </section>
      </div>
    `;
    document.getElementById('pingBtn')?.addEventListener('click', async () => {
      const status = document.getElementById('status');
      status.textContent = '发送中...';
      try {
        const res = await sendToBackground({ type: MESSAGE_TYPES.PING });
        status.textContent = '✅ 连接正常: ' + JSON.stringify(res);
      } catch (e) {
        status.textContent = '❌ ' + e.message;
      }
    });
  }
  render();
  subscribe(render);
}
