(function() {
    // 防止重复注入
    if (window.hasBossSpaMonitor) return;
    window.hasBossSpaMonitor = true;

    console.log("💉 [BossMonitor] SPA History Hooks Injected (Main World)");

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.postMessage({ type: 'BOSS_SPA_NAV', action: 'pushState' }, '*');
    };

    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        window.postMessage({ type: 'BOSS_SPA_NAV', action: 'replaceState' }, '*');
    };
    
    window.addEventListener('popstate', () => {
        window.postMessage({ type: 'BOSS_SPA_NAV', action: 'popstate' }, '*');
    });
})();