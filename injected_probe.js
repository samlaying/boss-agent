(function() {
    try {
        // === 安全开关检查 ===
        // 只有当 localStorage 中明确标记开启时才执行 Hook
        const isLabMode = localStorage.getItem('BOSS_HELPER_LAB_MODE') === 'true';
        
        if (!isLabMode) {
            // console.log("🕵️ [BossProbe] 实验室模式未开启，仅执行被动扫描。");
        } else {
            // console.warn("⚠️ [BossProbe] 实验室模式已开启！正在注入深度拦截器...");
        }

        // console.log("🕵️ [BossProbe] 启动隐形数据探测 (v3 - 深度拦截版)...");
        
        // 发送数据的防抖函数
        let lastSalary = null;
        function reportSalary(salary, source) {
            if (salary && salary !== lastSalary) {
                // console.log(`🕵️ [BossProbe] 发现薪资 (${source}):`, salary);
                window.postMessage({ type: 'BOSS_PLUGIN_SALARY_PROBE', salary: salary }, '*');
                lastSalary = salary;
            }
        }

        // --- 1. 静态全变量扫描 (Static Global Scan) - 安全，始终执行 ---
        function checkGlobalVars() {
            // 常见的 Boss 直聘全局变量
            const targets = [
                window.__INITIAL_STATE__,
                window.zpData,
                window._PAGE,
                window.PAGE_CONFIG
            ];

            for (const data of targets) {
                if (!data) continue;
                try {
                    // 深度优先搜索 salaryDesc
                    const findSalary = (obj, depth = 0) => {
                        if (!obj || depth > 3) return null;
                        
                        // Direct matches
                        if (obj.salaryDesc) return obj.salaryDesc;
                        if (obj.salary60) return obj.salary60; 

                        // Min/Max reconstruction (e.g. 15000, 25000 -> 15-25K)
                        if (obj.lowSalary && obj.highSalary) {
                             return `${Math.floor(obj.lowSalary/1000)}-${Math.floor(obj.highSalary/1000)}K`;
                        }

                        if (obj.jobInfo) {
                            if (obj.jobInfo.salaryDesc) return obj.jobInfo.salaryDesc;
                            if (obj.jobInfo.salary60) return obj.jobInfo.salary60;
                        }
                        
                        // 常见结构
                        if (obj.jobDetail && obj.jobDetail.salaryDesc) return obj.jobDetail.salaryDesc;
                        if (obj.bossInfo && obj.bossInfo.salaryDesc) return obj.bossInfo.salaryDesc;
                        return null;
                    };
                    
                    const res = findSalary(data);
                    if (res) {
                        reportSalary(res, "GlobalVar");
                        return true;
                    }
                } catch(e) {}
            }
            return false;
        }

        // --- 2. 脚本标签内容扫描 (Script Tag Parsing) ---
        // 应对数据不在 window 变量，而在 <script> 标签内的情况
        function checkScriptTags() {
            const scripts = document.querySelectorAll('script');
            for (let script of scripts) {
                // 检查 id 或内容特征
                if (script.id === '__INITIAL_STATE__' || script.innerText.includes('"salaryDesc"')) {
                    try {
                        const content = script.innerText;
                        // 尝试正则提取，比 JSON.parse 更容错
                        const match = content.match(/"(?:salaryDesc|salary60)"\s*:\s*"([^"]+)"/);
                        if (match && match[1]) {
                            reportSalary(match[1], "ScriptTag");
                            return true;
                        }
                    } catch(e) {}
                }
            }
            return false;
        }

        // --- 3. 网络请求拦截 (Network Interception) ---
        // 应对 SPA 动态加载 - ⚠️ 高风险操作，仅在实验室模式下启用
        function installInterceptors() {
            if (!isLabMode) return;

            // 3.1 拦截 XMLHttpRequest
            const originalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;
                
                xhr.addEventListener('load', function() {
                    try {
                        if (this.responseText && (this.responseText.includes('salaryDesc') || this.responseText.includes('salary60'))) {
                            const match = this.responseText.match(/"(?:salaryDesc|salary60)"\s*:\s*"([^"]+)"/);
                            if (match && match[1]) {
                                reportSalary(match[1], "XHR");
                            }
                        }
                    } catch(e) {}
                });
                return xhr;
            };
            // 恢复原型链 (尽量保持兼容)
            Object.assign(window.XMLHttpRequest, originalXHR);

            // 3.2 拦截 Fetch (如果是 fetch 请求)
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                let response;
                try {
                    response = await originalFetch.apply(this, args);
                } catch (e) {
                    // 如果原始请求失败，直接抛出，不要吞掉错误
                    throw e;
                }
                
                try {
                    const clone = response.clone();
                    clone.text().then(text => {
                        if (text.includes('salaryDesc') || text.includes('salary60')) {
                            const match = text.match(/"(?:salaryDesc|salary60)"\s*:\s*"([^"]+)"/);
                            if (match && match[1]) {
                                reportSalary(match[1], "Fetch");
                            }
                        }
                    }).catch(() => {});
                } catch(e) {}
                return response;
            };
        }

        // --- 4. React/Vue 深度探测 (保留作为补充) ---
        function checkFrameworks() {
            // Vue
            const vueRoots = document.querySelectorAll('.job-banner, .job-header, #main');
            for (let el of vueRoots) {
                if (el.__vue__) {
                    if (el.__vue__.jobInfo?.salaryDesc) {
                        reportSalary(el.__vue__.jobInfo.salaryDesc, "Vue");
                        return true;
                    }
                }
            }
        }

        // === 执行逻辑 ===
        
        // 立即执行一次
        if (!checkGlobalVars() && !checkScriptTags()) {
            checkFrameworks();
        }

        // 安装拦截器 (针对后续点击或加载)
        try {
            installInterceptors();
        } catch(e) { console.error("Interceptor error", e); }

        // 轮询检查 (应对延迟加载)
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            if (checkGlobalVars() || checkScriptTags() || checkFrameworks()) {
                // Found, but keep monitoring network
            }
            if (attempts > 10) clearInterval(timer); // 10秒后停止轮询
        }, 1000);

    } catch(e) {
        console.error("Probe Fatal Error", e);
    }
})();