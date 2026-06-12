// popup.js - 终极修复版 (前端交互与错误处理)

// 预设 DeepSeek API Key
const DEFAULT_API_KEY = 'sk-8af6f056aabf4e69aedffdd483b5c8b5';

// 预设简历模板（林承列）
const DEFAULT_RESUME = `个人简历

基本信息
*   姓名：林承列
*   年龄：21岁
*   电话号码：15396631779
*   联系邮箱：15396631779@163.com

教育背景
2023.9-2027.06        天津师范大学        经济学

精通A/B测试全流程：掌握假设提出、指标定义、样本量估算、流量分割及效果复盘的方法论。能识别和规避辛普森悖论等常见统计陷阱。能够通过数据分析发现增长点，将业务问题转化为可执行的A/B测试。

实习经历

2025.08-至今        一起科技教育有限公司        AI PM 实习生
1.  个性化习题讲解视频的AI语音克隆：通过对Minimax等多种方案进行成本效益的量化评估，确立了以 Whisper+LLM+Minimax 为核心的技术栈。在测试中，针对音画不同步、音色失真等问题，使用 claude 辅助研发动态调节语速等方案。
2.  AI个性化学情报告agent搭建：为解决三方模型TPM限流及输出不稳定的瓶颈，核心LLM从Claude到国产Qwen/Doubao的迁移选型，通过API调用测试，量化对比了各模型的生成效果与调用成本，最终以更优成本保障了10万份学情报告的稳定交付。
3.  AI视觉批改产品迭代：通过对466例复杂样本进行量化评估（精确率79.4%），精准定位了低召回率（74.8%）为核心瓶颈。随即设计并推动了包含Prompt优化、协同教研侧规范录题流程的一揽子解决方案，有效提升了模型在复杂场景下的识别成功率。
4.  看板搭建：主导搭建了DataEase 数据看板，协同数据与业务方，澄清并统一了续报率、续报率等核心指标的业务口径与计算逻辑。独立完成了两个核心业务看板的配置，为业务决策提供了实时的数据支持。

2024.12-2025.03        Zhao-index赵指数基金公司        数据分析实习生
1.  量化策略自动化监控体系搭建：为解决策略评估滞后、风险敞口不明的业务痛点，主导搭建了从数据处理到看板呈现的端到端监控体系。通过开发Python自动化脚本将数据准备效率提升50%。
2.  搭建监控看板：基于处理后的数据，构建了包含关键风险与收益指标（如夏普比率）的监控体系。

项目经历

2025.03-2025.05        第十一届全国大学生统计建模大赛        天津赛区三等奖
1.  增长洞察：为提升共享充电宝的使用频次与用户留存，主导了数据驱动的选址优化项目。通过Python 爬取并分析超1000条用户反馈，精准定位了"高峰期网点供不应求"是导致用户流失的关键环节。
2.  方案设计：利用高德地图API获取全市充电宝POI数据，结合用户需求热力图，通过机器学习模型（LSTM,随机森林,CNN）量化预测了20个最优投放点位，旨在提升网点的订单转化率和用户满意度。

2024.08-2024.12        "优益C杯"第三届蒙牛校园营销创新大赛        全国TOP20
1.  用户增长策略：针对年轻用户新增乏力、留存低的痛点，主导设计了一套蒙牛益生菌音频覆盖拉新、促活、留存的全链路用户增长方案。
2.  策划UGC价值共创活动，激励用户分享内容，提升用户活跃度与参与感，扩大新用户触达，提出引入AI聊天助手的概念，通过高频互动与情感陪伴，增强用户粘性，提升长期留存。通过追踪活动前后用户购买频率、社媒讨论量等指标，量化评估各运营策略对增长的实际贡献。

技能与技术
*   AI：AIGC技术落地, agent 搭建, Prompt工程, 机器学习, rag技术, API调用。
*   PM：用户洞察, 需求分析, 数据分析, 用户增长策略, A/B测试, 全流程项目管理, 跨团队协作, 产品方案设计。
*   SQL：掌握窗口函数、多表连接查询、聚合函数等，熟悉 MySQL数据库查询与管理。`;

document.addEventListener('DOMContentLoaded', () => {
    // 加载已保存的数据
    loadSettings();
    
    // 绑定字符数统计
    document.getElementById('resume').addEventListener('input', (e) => {
        document.getElementById('resumeCharCount').innerText = e.target.value.length;
        saveSettings(); // 实时保存输入
    });
    document.getElementById('apiKey').addEventListener('input', saveSettings);
    document.getElementById('scanPauseSeconds').addEventListener('change', saveSettings);
    document.getElementById('scanPauseSeconds').addEventListener('input', saveSettings);
    document.getElementById('autoPauseThreshold').addEventListener('change', saveSettings);
    document.getElementById('autoPauseThreshold').addEventListener('input', saveSettings);
    document.getElementById('historyRetentionDays').addEventListener('change', saveSettings);
    document.getElementById('historyRetentionDays').addEventListener('input', saveSettings);
    document.getElementById('maxHistoryRecords').addEventListener('change', saveSettings);
    document.getElementById('maxHistoryRecords').addEventListener('input', saveSettings);

    // 监听计算模式切换
    document.getElementById('computeMode').addEventListener('change', (e) => {
        toggleComputeModeUI(e.target.value);
        saveSettings();
    });

    // 监听充能按钮
    document.getElementById('rechargeBtn').addEventListener('click', (e) => {
        e.preventDefault();
        // 打开作者弹窗引导关注
        const modal = document.getElementById('localAuthorModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    });

    // 绑定魔法按钮事件
    document.getElementById('aiGenerateBtn').addEventListener('click', handleAIGenerate);

    // 绑定模态框按钮
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalApplyBtn').addEventListener('click', applyAIConfig);

    // 绑定保存按钮 (增加对高级配置的实时保存)
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    // 监听普通 checkbox
    document.getElementById('filterActiveHr').addEventListener('change', saveSettings); 
    
    // 监听实验室模式
    document.getElementById('enableLabMode').addEventListener('change', (e) => {
        if (e.target.checked) {
            const confirmed = confirm("⚠️ 【高风险警告】\n\n开启「实验室模式」将允许插件拦截底层网络请求，以挖掘隐藏的薪资和职位数据。\n\n这可能被目标平台视为异常行为，并增加账号被风控或封禁的风险。\n\n您是否确认开启？(后果自负)");
            if (!confirmed) {
                e.target.checked = false;
                return;
            }
        }
        saveSettings();
    });

    // 监听复制提示词按钮
    document.getElementById('copyPromptBtn').addEventListener('click', () => {
        const promptText = "请将提供的文档内容100% 完全复刻提取,转化为markdown 格式，输出结果需可直接复制粘贴使用，无需额外内容";
        navigator.clipboard.writeText(promptText).then(() => {
            const btn = document.getElementById('copyPromptBtn');
            const originalText = btn.innerText;
            btn.innerText = "✅ 已复制";
            setTimeout(() => {
                btn.innerText = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = promptText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            const btn = document.getElementById('copyPromptBtn');
            const originalText = btn.innerText;
            btn.innerText = "✅ 已复制";
            setTimeout(() => {
                btn.innerText = originalText;
            }, 2000);
        });
    });

    // 监听免责声明点击
    document.getElementById('viewDisclaimer').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('DISCLAIMER.md') }); // Chrome 无法直接预览 MD，改为弹窗或新标签页显示
        // 实际上 Chrome 无法直接渲染 MD 文件，更好的做法是把 MD 内容放在一个 html 里，或者 alert 提示。
        // 这里简化处理，直接打开
        alert("请查看插件目录下的 DISCLAIMER.md 文件，或访问 GitHub 仓库查看。");
    });

    // 监听"找作者免费领"点击
    document.getElementById('openAuthorModal').addEventListener('click', (e) => {
        e.preventDefault();
        const modal = document.getElementById('localAuthorModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    });

    // 监听本地作者弹窗关闭
    document.getElementById('closeLocalAuthorModal').addEventListener('click', () => {
        const modal = document.getElementById('localAuthorModal');
        if (modal) {
            modal.style.display = 'none';
        }
    });

    // 1. 获取所有需要的 DOM 元素 (新版逻辑)
    const setupBtn = document.getElementById('setupBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const energyStationBtn = document.getElementById('energyStationBtn');
    // 兼容旧版ID 'redeemKeyBtn' 或新版 'confirmKeyBtn'
    const confirmKeyBtn = document.getElementById('confirmKeyBtn') || document.getElementById('redeemKeyBtn');
    const secretKeyInput = document.getElementById('secretKeyInput') || document.getElementById('redeemKeyInput');
    const energyCountDisplay = document.getElementById('energyCount');
    const setupModal = document.getElementById('setupModal');
    // localAuthorModal 已在外部可能被引用
    const localAuthorModal = document.getElementById('localAuthorModal');

    // 3. 绑定“连接信号塔”按钮点击事件
    if (confirmKeyBtn) {
        confirmKeyBtn.addEventListener('click', () => {
            console.log('[Popup] Verify button clicked');
            const rawInput = secretKeyInput ? secretKeyInput.value.trim() : "";
            
            if (!rawInput) {
                alert("请输入暗号！");
                return;
            }
            
            // 自动转大写
            const key = rawInput.toUpperCase();

            // === 前端格式校验 ===
            const validFormat = /^(GM|PARTNER)-\d{4}-[A-Z0-9]{6}$/;
            if (!validFormat.test(key)) {
                let errorMsg = "格式错误。";
                if (key === "1" || key.includes("加油") || key.includes("暗号")) {
                    errorMsg = "请前往公众号【旷野里的猫-AI】\n回复 '1' 获取今日暗号\n(格式如 GM-0520-XXXXXX)";
                } else if (key.toUpperCase().startsWith("VTOKEN")) {
                    errorMsg = "请前往公众号发送此兑换码\n激活您的同行者权益并获取暗号\n(格式如 PARTNER-XXXXXX)";
                } else {
                     errorMsg = "无效暗号。请检查格式 (GM-MMDD-XXXXXX)\n或前往公众号【旷野里的猫-AI】获取";
                }
                alert(errorMsg);
                return;
            }

            // UI 反馈
            confirmKeyBtn.disabled = true;
            confirmKeyBtn.innerText = "正在接通信号塔...";

            // 发送消息给 background.js
            chrome.runtime.sendMessage({
                action: "redeem_daily_key",
                key: key
            }, (res) => {
                // 恢复按钮状态
                confirmKeyBtn.disabled = false;
                confirmKeyBtn.innerText = "🔌 接通信号塔";

                if (chrome.runtime.lastError) {
                    console.error('[Popup] Runtime error:', chrome.runtime.lastError);
                    alert("通信失败: " + chrome.runtime.lastError.message);
                    return;
                }

                // 处理业务结果
                if (res && res.success) {
                    const added = res.addedEnergy || 30;
                    // 优先使用后端返回的完整消息，否则使用默认消息
                    const msg = res.message || `✅ 连接成功！\n⚡ 能量 +${added}\n当前总能量: ${res.newEnergy}`;
                    alert(msg);
                    
                    if (energyCountDisplay) energyCountDisplay.innerText = res.newEnergy;
                    if (localAuthorModal) localAuthorModal.style.display = 'none';
                    if (secretKeyInput) secretKeyInput.value = "";
                } else {
                    alert(`❌ 连接失败: ${res ? res.error : "未知错误"}`);
                }
            });
        });
    }

    // 打开设置弹窗
    if (setupBtn && setupModal) {
        setupBtn.addEventListener('click', () => {
            setupModal.style.display = 'block';
        });
    }

    // 打开能量弹窗 (兼容 energyStationBtn)
    if (energyStationBtn && localAuthorModal) {
        energyStationBtn.addEventListener('click', () => {
            localAuthorModal.style.display = 'block';
        });
    }

    // 关闭弹窗 (点击外部) - 补充 setupModal 关闭
    window.addEventListener('click', (event) => {
        if (setupModal && event.target == setupModal) {
            setupModal.style.display = "none";
        }
    });

    // 分析按钮逻辑
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab.url.includes("zhipin.com/job/")) {
                chrome.storage.local.get(['energyCount'], (res) => {
                    const currentEnergy = res.energyCount || 0;
                    if (currentEnergy < 1) {
                        alert("能量不足（需 1 点），请点击右上角⚡补充能量！");
                        if (localAuthorModal) localAuthorModal.style.display = 'block';
                        return;
                    }
                    
                    // 能量扣除移至 background.js 统一处理
                    // const newEnergy = currentEnergy - 1;
                    // chrome.storage.local.set({ energyCount: newEnergy });
                    // if (energyCountDisplay) energyCountDisplay.innerText = newEnergy;

                    chrome.tabs.sendMessage(tab.id, { action: "analyze_job" });
                });
            } else {
                alert("请在 Boss直聘 职位详情页使用！");
            }
        });
    }

    // 绑定模态框关闭 (作者)
    const authorModal = document.getElementById('localAuthorModal');
    if (authorModal) {
        authorModal.addEventListener('click', (e) => {
            if (e.target === authorModal) {
                authorModal.style.display = 'none';
            }
        });
    }

    document.querySelectorAll('.advanced-details textarea').forEach(el => {
        el.addEventListener('change', saveSettings);
        el.addEventListener('input', saveSettings);
    });
});

// 全局变量暂存生成的配置
let tempGeneratedConfig = null;

// ================= 加载与保存逻辑 =================

// 切换 UI 显示
function toggleComputeModeUI(mode) {
    const energyPanel = document.getElementById('energyPanel');
    const apiKeyPanel = document.getElementById('apiKeyPanel');
    const apiKeyTip = document.getElementById('apiKeyTip');
    
    if (mode === 'custom_key') {
        energyPanel.style.display = 'none';
        apiKeyPanel.style.display = 'block';
        if (apiKeyTip) apiKeyTip.style.display = 'block';
    } else {
        energyPanel.style.display = 'block';
        apiKeyPanel.style.display = 'none';
        if (apiKeyTip) apiKeyTip.style.display = 'none';
        // 模拟读取能量 (后续对接 Serverless)
        updateEnergyDisplay();
    }
}

// 更新能量显示 (Mock)
function updateEnergyDisplay() {
    chrome.storage.local.get(['energyCount'], (result) => {
        const count = result.energyCount !== undefined ? result.energyCount : 3;
        const el = document.getElementById('energyCount');
        if (el) el.innerText = count;
    });
}

function saveSettings() {
    // 验证并修正输入值
    const validate = (id, min, max, defaultVal) => {
        const el = document.getElementById(id);
        let val = parseInt(el.value);
        if (isNaN(val)) val = defaultVal;
        if (val < min) val = min;
        if (val > max) val = max;
        el.value = val;
        return val;
    };

    // 获取 API Key，如果为空则使用预设值
    let apiKeyValue = document.getElementById('apiKey').value;
    if (!apiKeyValue || apiKeyValue.trim() === '') {
        apiKeyValue = DEFAULT_API_KEY;
        document.getElementById('apiKey').value = DEFAULT_API_KEY;
    }

    const settings = {
        apiKey: apiKeyValue,
        resume: document.getElementById('resume').value,
        // autoSubmit: document.getElementById('autoSubmit').checked, // Removed
        filterActiveHr: document.getElementById('filterActiveHr').checked,
        enableLabMode: document.getElementById('enableLabMode').checked, // 新增
        computeMode: document.getElementById('computeMode').value, // 新增
        // filterKeywords: document.getElementById('filterKeywords').value, // Legacy
        filterTitleKeywords: document.getElementById('filterTitleKeywords').value,
        filterContentKeywords: document.getElementById('filterContentKeywords').value,
        systemPrompt: document.getElementById('systemPrompt').value,
        chatSystemPrompt: document.getElementById('chatSystemPrompt').value,
        keywordArsenal: document.getElementById('keywordArsenal').value, // JSON字符串
        scanPauseSeconds: validate('scanPauseSeconds', 0, 60, 5),
        autoPauseThreshold: validate('autoPauseThreshold', 0, 100, 80),
        historyRetentionDays: validate('historyRetentionDays', 7, 90, 15),
        maxHistoryRecords: validate('maxHistoryRecords', 100, 5000, 1000)
    };
    chrome.storage.local.set(settings);
    showStatus('配置已保存!', '#4CAF50');
}

function loadSettings() {
    chrome.storage.local.get(
        ['apiKey', 'resume', 'filterActiveHr', 'enableLabMode', 'computeMode', 'energyCount', 'filterKeywords', 'filterTitleKeywords', 'filterContentKeywords', 'systemPrompt', 'chatSystemPrompt', 'keywordArsenal', 'scanPauseSeconds', 'autoPauseThreshold', 'historyRetentionDays', 'maxHistoryRecords'], 
        (res) => {
            // API Key：如果没有，使用预设值
            if (res.apiKey) {
                document.getElementById('apiKey').value = res.apiKey;
            } else {
                document.getElementById('apiKey').value = DEFAULT_API_KEY;
                chrome.storage.local.set({ apiKey: DEFAULT_API_KEY });
            }

            if (res.resume) {
                document.getElementById('resume').value = res.resume;
                document.getElementById('resumeCharCount').innerText = res.resume.length;
            } else {
                // 如果没有简历，使用预设简历（林承列）
                document.getElementById('resume').value = DEFAULT_RESUME;
                document.getElementById('resumeCharCount').innerText = DEFAULT_RESUME.length;
                // 自动保存到 storage
                chrome.storage.local.set({ resume: DEFAULT_RESUME });
            }
            // if (res.autoSubmit !== undefined) document.getElementById('autoSubmit').checked = res.autoSubmit; // Removed
            if (res.filterActiveHr !== undefined) document.getElementById('filterActiveHr').checked = res.filterActiveHr;
            if (res.enableLabMode !== undefined) document.getElementById('enableLabMode').checked = res.enableLabMode; // 新增
            
            // 处理计算模式
            const mode = res.computeMode || 'energy';
            document.getElementById('computeMode').value = mode;
            toggleComputeModeUI(mode);
            
            // 初始化能量 (如果不存在，说明是新用户，给5点新手礼包)
            if (res.energyCount === undefined) {
                chrome.storage.local.set({ energyCount: 5 });
                const el = document.getElementById('energyCount');
                if (el) el.innerText = 5;
            } else {
                 const el = document.getElementById('energyCount');
                 if (el) el.innerText = res.energyCount;
            }

            // 迁移逻辑：如果新字段为空但旧字段有值，优先使用旧字段
            if (res.filterTitleKeywords) {
                document.getElementById('filterTitleKeywords').value = res.filterTitleKeywords;
            } else if (res.filterKeywords) {
                document.getElementById('filterTitleKeywords').value = res.filterKeywords;
            }

            if (res.filterContentKeywords) {
                document.getElementById('filterContentKeywords').value = res.filterContentKeywords;
            }

            if (res.systemPrompt) document.getElementById('systemPrompt').value = res.systemPrompt;
            if (res.chatSystemPrompt) document.getElementById('chatSystemPrompt').value = res.chatSystemPrompt;
            if (res.keywordArsenal) {
                document.getElementById('keywordArsenal').value = res.keywordArsenal;
                renderKeywordTags(parseJSONSafe(res.keywordArsenal)); // 加载时渲染标签
            }
            document.getElementById('scanPauseSeconds').value = res.scanPauseSeconds !== undefined ? res.scanPauseSeconds : 5;
            document.getElementById('autoPauseThreshold').value = res.autoPauseThreshold !== undefined ? res.autoPauseThreshold : 80;
            document.getElementById('historyRetentionDays').value = res.historyRetentionDays !== undefined ? res.historyRetentionDays : 15;
            document.getElementById('maxHistoryRecords').value = res.maxHistoryRecords !== undefined ? res.maxHistoryRecords : 1000;
        }
    );
}


// ================= AI 生成核心逻辑 =================
async function handleAIGenerate() {
    console.log("🎯 开始执行一键生成功能...");

    const apiKey = document.getElementById('apiKey').value;
    const resume = document.getElementById('resume').value;

    console.log("📋 检查输入参数:");
    console.log("- API Key 长度:", apiKey ? apiKey.length : 0);
    console.log("- 简历长度:", resume.length);

    if (document.getElementById('computeMode').value === 'custom_key') {
        if (!apiKey || resume.length < 100) {
            console.error("❌ 输入参数不满足条件");
            setModalStatus("请先输入有效的 Key 和至少100字的简历！", true);
            return;
        }
    } else {
        if (resume.length < 100) {
            console.error("❌ 输入参数不满足条件");
            setModalStatus("请先输入至少100字的简历！", true);
            return;
        }
    }

    // 1. 启动模态框
    tempGeneratedConfig = null;
    console.log("📱 显示模态框...");
    setModalStatus("🚀 任务生成中，请不要关闭该页面。显示应用成功后可以关闭", false);
    
    // 隐藏取消按钮，修改确认按钮为关闭
    document.getElementById('modalCancelBtn').style.display = 'none';
    const applyBtn = document.getElementById('modalApplyBtn');
    applyBtn.innerText = "任务运行中 (可关闭)";
    applyBtn.onclick = closeModal; // 绑定为关闭

    try {
        console.log("📤 发送后台任务请求...");
        // 发送请求，不需要 await 长时间结果，background 会立即返回 status: "processing_in_background"
        chrome.runtime.sendMessage({
            action: "generate_config",
            apiKey: apiKey,
            resume: resume
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Runtime Error:", chrome.runtime.lastError);
                setModalStatus(`❌ 启动失败: ${chrome.runtime.lastError.message}`, true);
                return;
            }

            if (response && response.success) {
                console.log("✅ 生成成功");
                
                // 1. 保存到全局变量
                tempGeneratedConfig = response.data;
                
                // 2. 立即应用配置 (不关闭窗口)
                applyAIConfig(false);
                
                // 3. 更新 UI
                setModalStatus("✅ AI配置生成成功！已自动应用。", false);
                const applyBtn = document.getElementById('modalApplyBtn');
                applyBtn.innerText = "完成 (关闭)";
                applyBtn.onclick = closeModal;
                
                // 4. 渲染预览
                renderPreview(tempGeneratedConfig);
            } else {
                setModalStatus(`❌ 生成失败: ${response ? response.error : '未知错误'}`, true);
            }
        });

    } catch (error) {
        // 5. 失败，显示错误信息
        console.error("❌ AI配置启动失败:", error);
        setModalStatus(`❌ 启动失败：${error.message}`, true);
    }
}

// 监听后台任务状态变化 (如果在生成过程中用户一直开着窗口)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lastGenerationStatus) {
        const status = changes.lastGenerationStatus.newValue;
        if (!status) return;

        // 检查是否是最近 10 秒内的状态 (避免加载旧状态)
        if (Date.now() - status.timestamp > 10000) return;

        if (status.success) {
            setModalStatus("✅ AI配置生成成功！已自动应用。", false);
            const applyBtn = document.getElementById('modalApplyBtn');
            applyBtn.innerText = "完成 (关闭)";
            
            // 尝试加载预览
            chrome.storage.local.get(['tempGeneratedConfig'], (res) => {
                if (res.tempGeneratedConfig) {
                    tempGeneratedConfig = res.tempGeneratedConfig;
                    renderPreview(tempGeneratedConfig);
                }
            });
        } else {
            setModalStatus(`❌ 生成失败：${status.error}`, true);
        }
    }
});


// ================= 模态框与渲染逻辑 =================
function setModalStatus(msg, isError) {
    const modal = document.getElementById('aiConfigModal');
    const statusText = document.getElementById('configStatusText');
    
    statusText.innerText = msg;
    statusText.style.color = isError ? 'var(--error-color)' : 'var(--text-primary)';

    // document.getElementById('configLoader').style.display = isError ? 'none' : 'block';
    
    // 如果是错误或成功，显示确认/取消按钮
    document.getElementById('modalButtons').style.display = (isError || msg.includes('已生成')) ? 'flex' : 'none';
    
    if (msg.includes('已生成')) {
        document.getElementById('modalButtons').style.display = 'flex';
        document.getElementById('modalApplyBtn').style.display = 'block';
    } else if (isError) {
         document.getElementById('modalButtons').style.display = 'flex';
         document.getElementById('modalApplyBtn').style.display = 'none';
    } else {
        document.getElementById('modalButtons').style.display = 'none';
        document.getElementById('modalApplyBtn').style.display = 'block';
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('aiConfigModal').style.display = 'none';
}

function renderPreview(config) {
    const previewArea = document.getElementById('configPreview');
    const analysis = config.resume_analysis || {};
    
    // 渲染主预览区
    previewArea.innerHTML = `
        <div class="preview-item">
            <div class="preview-title">🎯 AI识别核心人设</div>
            <div style="font-size: var(--font-md); color: #00bebd; font-weight: bold;">${analysis.core_role || '未识别'}</div>
            <div class="tip">(${analysis.work_years || '未知'}年经验)</div>
        </div>
        <div class="preview-item">
            <div class="preview-title">🔥 核心卖点提炼</div>
            <ul>
                ${(analysis.pros || []).map(p => `<li>${p}</li>`).join('')}
            </ul>
        </div>
        <div class="preview-item">
            <div class="preview-title">🤖 核心 System Prompt (已生成)</div>
            <div class="tip">${config.system_prompt ? config.system_prompt.substring(0, 80) + '...' : '无'}</div>
        </div>
         <div class="tip" style="margin-top: 15px;">
            ✅ 配置已自动填充到“高级配置”区，您可以直接关闭窗口。
        </div>
    `;

    // 渲染关键词标签区
    renderKeywordTags(config.keyword_arsenal);
}

// 渲染关键词标签
function renderKeywordTags(arsenal) {
    const container = document.getElementById('keywordTagsContainer');
    container.innerHTML = '';
    
    if (!arsenal) return;

    Object.keys(arsenal).forEach(key => {
        const words = arsenal[key];
        if (!Array.isArray(words)) return;

        words.forEach(word => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            
            // 样式区分：避坑关键词用红色
            if (key.includes('避坑') || key.includes('排除')) {
                tag.style.background = 'var(--error-color)';
                tag.style.color = 'var(--text-white)';
            } else if (key.includes('高亮')) {
                tag.style.background = '#42a5f5'; // 蓝色
                tag.style.color = 'var(--text-white)';
            } else {
                tag.style.background = '#00bebd'; // 主色调
                tag.style.color = 'var(--text-white)';
            }

            tag.innerText = word;
            tag.title = `${key}：点击复制`;
            
            // 点击复制
            tag.onclick = () => {
                const originalBg = tag.style.background;
                const originalColor = tag.style.color;

                navigator.clipboard.writeText(word)
                    .then(() => {
                        tag.style.background = '#66bb6a'; // 绿色反馈
                        tag.style.color = '#fff';
                        setTimeout(() => { 
                            tag.style.background = originalBg; 
                            tag.style.color = originalColor; 
                        }, 500);
                    })
                    .catch(err => {
                        console.error('Clipboard API failed:', err);
                        // 降级处理：使用 execCommand
                        const textarea = document.createElement('textarea');
                        textarea.value = word;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                            document.execCommand('copy');
                            tag.style.background = '#66bb6a';
                            tag.style.color = '#fff';
                            setTimeout(() => { 
                                tag.style.background = originalBg; 
                                tag.style.color = originalColor; 
                            }, 500);
                        } catch (err2) {
                            console.error('Fallback copy failed:', err2);
                            tag.style.background = 'var(--error-color)';
                            setTimeout(() => { 
                                tag.style.background = originalBg; 
                                tag.style.color = originalColor; 
                            }, 500);
                        }
                        document.body.removeChild(textarea);
                    });
            };
            container.appendChild(tag);
        });
    });
}

function applyAIConfig(closeAfter = true) {
    if (!tempGeneratedConfig) {
        showStatus('应用失败：无有效配置', 'var(--error-color)');
        closeModal();
        return;
    }

    // 如果是通过点击事件调用的，强制 closeAfter 为 true
    if (closeAfter && typeof closeAfter === 'object') {
        closeAfter = true;
    }

    // 1. 构建 System Prompt (合并关键词武库，解决"未合并"问题)
    let finalSystemPrompt = tempGeneratedConfig.system_prompt || '';
    
    // 如果有关键词武库，将其追加到 System Prompt 末尾，作为补充参考
    if (tempGeneratedConfig.keyword_arsenal) {
        const arsenal = tempGeneratedConfig.keyword_arsenal;
        let arsenalText = "\n\n【🚀 关键词武库 (Keyword Arsenal)】";
        
        if (arsenal["核心匹配"] && arsenal["核心匹配"].length > 0) {
            arsenalText += `\n* 核心匹配词：${arsenal["核心匹配"].join(', ')}`;
        }
        if (arsenal["避坑关键词"] && arsenal["避坑关键词"].length > 0) {
            arsenalText += `\n* 避坑关键词：${arsenal["避坑关键词"].join(', ')}`;
        }
        
        finalSystemPrompt += arsenalText;
    }

    // 填充到 Textarea
    document.getElementById('systemPrompt').value = finalSystemPrompt;
    document.getElementById('chatSystemPrompt').value = tempGeneratedConfig.chat_system_prompt || '';
    
    // 关键词库需要 JSON.stringify 后再保存 (虽然已合并到 Prompt，但保留此字段以备后用)
    document.getElementById('keywordArsenal').value = JSON.stringify(tempGeneratedConfig.keyword_arsenal, null, 2);

    // 自动保存并关闭
    saveSettings();
    
    if (closeAfter) {
        showStatus('✅ AI配置已成功应用并保存!', '#4CAF50');
        closeModal();
    }
}

function parseJSONSafe(str) {
    try { 
        if (typeof str !== 'string' || !str) return null;
        return JSON.parse(str); 
    } catch (e) { 
        console.error("安全JSON解析失败:", e);
        return null; 
    }
}

function showStatus(msg, color) {
    const el = document.getElementById('status');
    el.innerText = msg;
    el.style.color = color;
    setTimeout(() => { el.innerText = ''; el.style.color = 'var(--text-primary)'; }, 3000);
}
