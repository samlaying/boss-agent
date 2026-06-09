// content.js - V20.1 (右侧数据源唯一真理版)
// console.log("🚀 Glimmer Vision: V20.1 Single Source of Truth");

// === 开启调试日志 ===
console.log("🚀 [BossHelper] Content Script Loaded v" + chrome.runtime.getManifest().version);
// console.log = function() {}; // 恢复日志
// console.info = function() {};
// console.debug = function() {};

const WEIGUANG_VARIANT = globalThis.__WEIGUANG_VARIANT__ || {
    mode: "intern",
    label: "实习生版",
    features: {
        autoApply: true,
        internshipHardFilter: true
    }
};
console.log(`🧩 [BossHelper] Variant: ${WEIGUANG_VARIANT.label || WEIGUANG_VARIANT.mode || "unknown"}`);

function isVariantFeatureEnabled(featureName) {
    return WEIGUANG_VARIANT.features && WEIGUANG_VARIANT.features[featureName] === true;
}

function isAutoApplyEnabled() {
    return isVariantFeatureEnabled("autoApply");
}

function isInternshipHardFilterEnabled() {
    return isVariantFeatureEnabled("internshipHardFilter");
}

let isScanning = false;
let currentJobIndex = -1;
let jobCards = [];
let isAutoApplying = false;
let autoApplyIndex = -1;
let autoApplyCards = [];
let autoApplyController = null;
let autoApplyLastActivityAt = 0;
let autoApplyRefreshCount = 0;
let autoApplyLoadAttempts = 0;
let autoApplyLogWriteQueue = Promise.resolve();
let autoApplyRemoteLogQueue = Promise.resolve();

const AUTO_APPLY_MAX_REFRESH_ATTEMPTS = 3;
const AUTO_APPLY_BLOCKED_TITLE_KEYWORDS = [
    "开发",
    "后端",
    "前端",
    "全栈",
    "客户端",
    "Android",
    "iOS",
    "测试开发",
    "研发工程师",
    "软件工程师",
    "Java工程师",
    "Java开发",
    "PHP",
    "Go开发",
    "Golang",
    "Node.js"
];
const AUTO_APPLY_LOG_KEY = "autoApplyActionLog";
const AUTO_APPLY_LOG_MAX = 1000;
const AUTO_APPLY_REMOTE_LOG_CONFIG_KEY = "autoApplyRemoteLogConfig";
const AUTO_APPLY_REMOTE_LOG_QUEUE_KEY = "autoApplyRemoteLogQueue";
const AUTO_APPLY_REMOTE_LOG_QUEUE_MAX = 50;
const SALARY_PATTERN = /(\d+(?:\.\d+)?\s*(?:[-~—－–至]\s*\d+(?:\.\d+)?)?\s*(?:[kKＫｋ]|万|元\s*[\/／]?\s*[天日]|元\/[天日])(?:\s*·\s*\d+\s*薪)?)|(面议)/i;
const SALARY_SELECTORS = [
    '.salary',
    '.salary-text',
    '.job-salary',
    '.job-limit .salary',
    '.job-detail-info .salary',
    '.job-primary-detail .salary',
    '.name-box .salary',
    '.job-banner .salary',
    '.job-header .salary',
    '[class*="salary"]',
    '[class*="wage"]',
    '[class*="pay"]'
];

// 全局变量：隐形数据缓存
let rawSalaryData = null;
// 全局变量：当前点击的职位 ID (用于列表页弹窗分析时的兜底)
let currentActiveJobId = null;

// 全局变量：命中高分即停阈值（可配置），默认 80 分
let pauseThreshold = 80;
chrome.storage.local.get(['autoPauseThreshold'], (res) => {
    const t = Number(res && res.autoPauseThreshold);
    if (Number.isFinite(t)) {
        pauseThreshold = Math.max(0, Math.min(100, Math.floor(t)));
    }
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.autoPauseThreshold) {
        const t = Number(changes.autoPauseThreshold.newValue);
        pauseThreshold = Number.isFinite(t) ? Math.max(0, Math.min(100, Math.floor(t))) : 80;
    }
});

// === 消息监听：接收页面隐形数据 ===
window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'BOSS_PLUGIN_SALARY_PROBE') {
        if (event.data.salary) {
            rawSalaryData = event.data.salary;
            // console.log("🔓 [GlimmerDecoder] 成功捕获隐形薪资:", rawSalaryData);
        }
    }
});

// === 消息监听：来自 Popup 的指令 ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_author_modal") {
        const authorModal = document.getElementById('author-modal');
        if (authorModal) {
            authorModal.style.display = 'flex';
            sendResponse({success: true});
        } else {
            // 如果还没初始化，尝试手动触发一下
            initWrapper();
            setTimeout(() => {
                const retryModal = document.getElementById('author-modal');
                if (retryModal) {
                    retryModal.style.display = 'flex';
                    sendResponse({success: true});
                } else {
                    sendResponse({success: false, error: "Modal not found"});
                }
            }, 500);
            return true; // 异步响应
        }
    }
});

// === 0. 启动守护 & 脚本注入 ===

// 1. 传统轮询监听 (兜底方案，确保历史记录不丢失)
let lastUrl = window.location.href;
setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log("🔗 [BossMonitor] URL Change Detected (Polling):", currentUrl);
        // URL 变化，强制触发历史记录检查
        if (typeof debounceCheckHistory === 'function') {
            debounceCheckHistory();
        } else {
            // Fallback if not defined yet (though it should be hoisted)
            setTimeout(() => { if(typeof checkAutoLoadHistory === 'function') checkAutoLoadHistory(); }, 500);
        }
    }
}, 1000);

// 2. Request Background to inject Main World scripts (Bypassing CSP)
// 包括：spa_monitor.js (历史记录路由监听) 和 injected_probe.js (隐形数据嗅探)
chrome.runtime.sendMessage({ action: "inject_main_world_scripts" }, (response) => {
    if (chrome.runtime.lastError) {
        console.warn("⚠️ [BossDebug] Failed to request script injection:", chrome.runtime.lastError);
    } else {
        console.log("🚀 [BossDebug] Main World Scripts Injection Requested:", response);
    }
});

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'BOSS_SPA_NAV') {
        console.log("♻️ [BossDebug] Location Changed (SPA via MainWorld):", event.data.action);
        setTimeout(checkAutoLoadHistory, 500);
    }
});

// MutationObserver 监听详情页内容变化 (针对 URL 不变但内容变的场景)
const detailObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        // 简单防抖：如果检测到大量节点变化，触发检查
        if (mutation.addedNodes.length > 0) {
            // 检查是否有关键特征节点出现
            const hasDetailHeader = document.querySelector('.job-banner') || document.querySelector('.job-header');
            if (hasDetailHeader) {
                console.log("👀 [BossDebug] DOM Mutation Detected in Detail Area");
                // 使用防抖函数避免频繁触发
                debounceCheckHistory();
                break;
            }
        }
    }
});

let checkTimer = null;
function debounceCheckHistory() {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
        console.log("🔍 [BossDebug] Executing History Check...");
        checkAutoLoadHistory();
    }, 800);
}

// 启动观察
function startDetailObserver() {
    const target = document.querySelector('.main-content') || document.body;
    if (target) {
        detailObserver.observe(target, { childList: true, subtree: true });
        console.log("👀 [BossDebug] Detail Observer Started");
    }
}

setInterval(() => {
    // 确保历史记录管理器初始化
    if (typeof HistoryManager !== 'undefined' && !HistoryManager.isLoaded) {
        HistoryManager.init();
    }

    if (!document.getElementById('boss-copilot-ball')) initBall();
    if (!document.getElementById('boss-copilot-panel')) initWrapper();
    // 实时刷新列表状态
    applyHistoryToCards();
}, 1000);

// 延迟启动观察者
setTimeout(startDetailObserver, 2000);

// === 新增：自动应用历史状态到列表卡片 ===
function applyHistoryToCards() {
    if (!HistoryManager || !HistoryManager.isLoaded) return;
    
    // 查找所有卡片
    const cards = document.querySelectorAll('.job-card-wrapper, .job-card-box');
    
    for (const card of cards) {
        // 性能优化：如果已经标记过，就跳过
        if (card.dataset.historyChecked === "true") continue;
        
        // 尝试获取 ID
        let link = card.querySelector('.job-card-left');
        if (!link) {
            // 降级查找
            const as = card.querySelectorAll('a');
            for(const a of as) {
                if(a.href && a.href.includes('job_detail')) {
                    link = a;
                    break;
                }
            }
        }
        
        const jobId = link ? getJobId(link.href) : null;
        if (!jobId) continue;
        
        const history = HistoryManager.get(jobId);
        if (history) {
            // 应用视觉状态
            if (history.st === 3) { // Ignored (3)
                 card.classList.add('boss-inactive'); 
                 card.setAttribute('data-reason', '🚫 已忽略');
            } else if (history.st === 2) { // Greeted (2)
                 card.classList.add('boss-good');
            } else if (history.st === 1) { // Analyzed (1)
                if ((history.s || 0) >= pauseThreshold) card.classList.add('boss-good');
                 else card.classList.add('boss-bad');
            }
            // 标记已处理
            card.dataset.historyChecked = "true";
        }
    }
}

// 启动时检查是否有待发送的话术（针对页面跳转场景）
checkPendingGreeting();

// ================= 1. UI 初始化 =================
function initBall() {
    if(document.getElementById('boss-copilot-ball')) return;
    const ball = document.createElement('div');
    ball.id = 'boss-copilot-ball';
    ball.innerText = '🌌'; // 使用星系图标
    ball.title = '微光';
    ball.style.cssText = `position:fixed;top:150px;right:0;width:40px;height:40px;background:#263238;color:#fff;border-radius:20px 0 0 20px;z-index:99999;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:-2px 2px 8px rgba(0,0,0,0.2);`;
    ball.onclick = () => {
        document.getElementById('boss-copilot-panel').style.display = 'flex';
        ball.style.right = '-50px';
    };
    document.body.appendChild(ball);
}

// ================= 晨曦寄语 (Healing Quotes) =================
const HealingQuotes = [
    "🌿 允许自己暂停，花开也需要时间。",
    "📄 简历只是纸，你才是那个鲜活的故事。",
    "💎 你的价值，不由一份工作定义。",
    "🌙 生活除了眼前的面试，还有晚风和月亮。",
    "✨ 星光不问赶路人，时光不负有心人。",
    "🛣️ 好事总会多磨，最好的都在路上。",
    "👣 没有白走的路，每一步都算数。",
    "⛰️ 关关难过关关过，前路漫漫亦灿灿。",
    "🧱 日拱一卒，功不唐捐。",
    "🌱 你不是没有成长，而是在扎根。",
    "🌈 生活明朗，万物可爱，人间值得，未来可期。",
    "🧭 不要因为走得太远，而忘记为什么出发。",
    "💃 每一个不曾起舞的日子，都是对生命的辜负。",
    "💪 这种时刻，你更要相信自己。",
    "🔥 焦虑是因为你对自己有要求，这本身就是一种上进。",
    "🌊 别慌，月亮也正在大海某处迷茫。",
    "🐢 慢慢来，比较快。",
    "🌊 保持热爱，奔赴山海。",
    "📖 凡是过往，皆为序章。",
    "❤️ 热爱可抵岁月漫长。",
    "🌌 与其互为人间，不如自成宇宙。",
    "🦋 你若盛开，蝴蝶自来。",
    "🐎 乾坤未定，你我皆是黑马。",
    "☀️ 追光的人，终会光芒万丈。",
    "☔ 既然选择了远方，便只顾风雨兼程。",
    "⛵ 愿你历尽千帆，归来仍是少年。",
    "🏔️ 心中有丘壑，眉目作山河。",
    "🍵 且将新火试新茶，诗酒趁年华。",
    "📚 粗缯大布裹生涯，腹有诗书气自华。",
    "☁️ 行到水穷处，坐看云起时。",
    "🌊 长风破浪会有时，直挂云帆济沧海。",
    "🤝 莫愁前路无知己，天下谁人不识君。",
    "💰 天生我材必有用，千金散尽还复来。",
    "🏡 山重水复疑无路，柳暗花明又一村。",
    "🌲 沉舟侧畔千帆过，病树前头万木春。",
    "👁️ 不畏浮云遮望眼，自缘身在最高层。",
    "🦶 纸上得来终觉浅，绝知此事要躬行。",
    "🔥 试玉要烧三日满，辨材须待七年期。",
    "🏆 千淘万漉虽辛苦，吹尽狂沙始到金。",
    "🦅 大鹏一日同风起，扶摇直上九万里。",
    "🔍 路漫漫其修远兮，吾将上下而求索。",
    "❤️ 亦余心之所善兮，虽九死其犹未悔。",
    "☁️ 穷且益坚，不坠青云之志。",
    "👴 老当益壮，宁移白首之心？",
    "🌟 在这个世界上，你就是独一无二的限量版。",
    "🧘 不用刻意去讨好谁，做好你自己。",
    "🪜 每一次失败，都是通往成功的阶梯。",
    "🎁 相信美好的事情即将发生。",
    "⏳ 给自己一点时间，你会找到答案的。",
    "🗣️ 别让别人的声音，淹没了你内心的声音。",
    "🔋 你的潜力远比你想象的要大。",
    "👣 勇敢地迈出第一步，剩下的路会好走很多。",
    "📈 每天进步一点点，坚持带来大改变。",
    "🤟 不管发生什么，都要爱自己。",
    "🔮 只有你自己能定义你的未来。",
    "☔ 生活不是等待风暴过去，而是学会在雨中跳舞。",
    "🏔️ 当你感到艰难的时候，就是在走上坡路。",
    "☀️ 今天的努力，是为了明天更好的自己。",
    "⚡ 不要小看自己，你体内蕴藏着无限的能量。",
    "🎁 把每一次挫折都当成一次成长的机会。",
    "😊 无论遇到什么困难，都要保持微笑。",
    "👀 你的努力，终将被看见。",
    "🌻 心若向阳，无谓悲伤。",
    "🕯️ 做一个温暖的人，温暖自己，也温暖别人。",
    "🌅 每一天都是新的开始，请深呼吸。",
    "🎁 不要着急，最好的总会在最不经意的时候出现。",
    "💖 你值得拥有这世间所有美好的一切。",
    "🕯️ 与其抱怨黑暗，不如点亮蜡烛。",
    "💪 只有经历过地狱般的磨练，才能练出创造天堂的力量。",
    "🌍 世界很大，风景很美，机会很多。",
    "🏃 不要在该奋斗的年纪选择安逸。",
    "🙏 将来的你，一定会感谢现在拼命的自己。",
    "🏞️ 不论终点在哪里，请享受沿途的风景。",
    "👏 哪怕没有人为你鼓掌，也要优雅地谢幕。",
    "🔦 你所经历的苦难，终将照亮你前行的路。",
    "✨ 愿你眼中有光，心中有爱。",
    "🍵 不论顺境逆境，保持一颗平常心。",
    "🛡️ 做一个内心强大的人，不被外界轻易打扰。",
    "🤐 每一个优秀的人，都有一段沉默的时光。",
    "🎉 既然活着，就要活出精彩。",
    "🦋 哪怕遍体鳞伤，也要活得漂亮。",
    "🎬 人生没有彩排，每一天都是现场直播。",
    "✊ 把握现在，就是创造未来。",
    "🦁 相信自己，你比你想象的更强大。",
    "❓ 不要轻易放弃，因为你不知道下一刻会发生什么。",
    "🎤 只要心中有梦，哪里都是舞台。",
    "🛡️ 用微笑去面对生活中的每一场挑战。",
    "🍀 保持积极乐观的心态，好运自然会来。",
    "🎆 你就是你，不一样的烟火。",
    "✨ 愿你的生活常温暖，日子总是温柔又闪光。",
    "🙏 所求皆如愿，所行化坦途。",
    "🌊 知足且上进，温柔而坚定。",
    "🍀 所有的运气，都是实力的积累。",
    "⏰ 在自己的时区里，一切都准时。",
    "🏃 生活原本沉闷，但跑起来就有风。",
    "💡 万物皆有裂痕，那是光照进来的地方。",
    "🙏 但行好事，莫问前程。",
    "🦶 心之所向，素履以往。"
];

function getRandomQuote() {
    return HealingQuotes[Math.floor(Math.random() * HealingQuotes.length)];
}

function initWrapper() {
    if(document.getElementById('boss-copilot-panel')) return;
    
    const css = document.createElement('style');
    css.innerHTML = `
        .boss-scanning{border:2px solid #00bebd!important;background:#e0f7fa!important}
        .boss-good{background:#f6ffed!important}
        .boss-bad{opacity:0.6;filter:grayscale(1)}
        .boss-inactive{opacity:0.4;filter:grayscale(1);background:#f5f5f5!important;cursor:pointer;}
        .boss-inactive::after{
            content:attr(data-reason);
            position:absolute;
            top:50%;
            left:50%;
            transform:translate(-50%,-50%);
            font-weight:bold;
            color:#fff;                  /* 白色文字 */
            background:rgba(0,0,0,0.7);  /* 深色半透明背景 */
            border:none;                 /* 去掉边框 */
            padding:6px 12px;            /* 增加内边距 */
            border-radius:20px;          /* 圆角更圆润 */
            font-size:14px;              /* 字号加大 */
            white-space:nowrap;
            z-index:10;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); /* 增加投影 */
            backdrop-filter: blur(2px);  /* 增加毛玻璃效果 */
        }

        /* 拖拽和调整大小样式 */
        .boss-toast {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 2147483652;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }
        .boss-toast.show {
            opacity: 1;
        }

        .panel-dragging {
            opacity: 0.9;
            box-shadow: 0 15px 50px rgba(0,0,0,0.3);
        }

        .panel-resizing {
            user-select: none;
        }

        /* 调整大小手柄 */
        .resize-handle {
            position: absolute;
            width: 12px;
            height: 12px;
            background: #00bebd;
            border-radius: 2px;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 2147483648;
        }

        .resize-handle:hover {
            opacity: 0.8;
        }

        .resize-handle.active {
            opacity: 1;
            background: #009688;
        }

        .resize-handle.nw {
            top: -6px;
            left: -6px;
            cursor: nw-resize;
        }

        .resize-handle.ne {
            top: -6px;
            right: -6px;
            cursor: ne-resize;
        }

        .resize-handle.sw {
            bottom: -6px;
            left: -6px;
            cursor: sw-resize;
        }

        .resize-handle.se {
            bottom: -6px;
            right: -6px;
            cursor: se-resize;
        }

        .resize-handle.n {
            top: -6px;
            left: 50%;
            transform: translateX(-50%);
            cursor: n-resize;
        }

        .resize-handle.s {
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            cursor: s-resize;
        }

        .resize-handle.w {
            left: -6px;
            top: 50%;
            transform: translateY(-50%);
            cursor: w-resize;
        }

        .resize-handle.e {
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            cursor: e-resize;
        }

        #capture-overlay{position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.08);backdrop-filter:blur(1px);z-index:2147483650;cursor:crosshair}
        #capture-select{position:absolute;border:2px dashed #00bebd;background:rgba(0,190,189,0.12);box-shadow:0 0 0 1px rgba(0,190,189,0.2) inset}
        #capture-actions{position:absolute;display:flex;gap:6px}
        #capture-actions button{padding:6px 10px;border:none;border-radius:6px;font-size:12px;cursor:pointer}
        #cap-confirm{background:#00c853;color:#fff}
        #cap-cancel{background:#fff;color:#333;border:1px solid #e0e0e0}

        /* AI 分析动画 */
        @keyframes boss-pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        @keyframes boss-spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes boss-spin-reverse {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(-360deg); }
        }

        @keyframes boss-scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }

        /* Hacker Terminal Style */
        .hacker-terminal {
            width: 100%;
            height: 100%;
            background-color: #0c0c0c;
            color: #00ff00;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            padding: 10px;
            box-sizing: border-box;
            overflow: hidden;
            position: relative;
            border: 1px solid #333;
            box-shadow: inset 0 0 20px rgba(0, 255, 0, 0.1);
            display: flex;
            flex-direction: column;
        }

        .hacker-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
            margin-bottom: 5px;
            color: #666;
            font-size: 10px;
            text-transform: uppercase;
        }

        .hacker-body {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
        }

        .hacker-line {
            margin: 0 0 4px 0;
            line-height: 1.4;
            white-space: nowrap;
            opacity: 0.9;
            text-shadow: 0 0 2px rgba(0, 255, 0, 0.5);
        }

        .hacker-cursor {
            display: inline-block;
            width: 8px;
            height: 14px;
            background: #00ff00;
            animation: blink 1s step-end infinite;
            vertical-align: middle;
        }

        @keyframes blink { 50% { opacity: 0; } }


    `;
    document.head.appendChild(css);

    const panel = document.createElement('div');
    panel.id = "boss-copilot-panel";
    // 使用具体像素值而不是百分比，避免单位冲突
    const initialHeight = Math.min(window.innerHeight * 0.85, 800);
    panel.style.cssText = `position:fixed; left:calc(100vw - 400px); top:85px; z-index:2147483647; display:flex; flex-direction:column; width:380px; height:${initialHeight}px; min-width:300px; min-height:200px; max-width:90vw; max-height:90vh; background:#f4f6f9; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.2); overflow:visible; border:1px solid rgba(0,0,0,0.1); resize:none;`;

    panel.innerHTML = `


      <!-- 调整大小手柄 -->
      <div class="resize-handle nw"></div>
      <div class="resize-handle ne"></div>
      <div class="resize-handle sw"></div>
      <div class="resize-handle se"></div>
      <div class="resize-handle n"></div>
      <div class="resize-handle s"></div>
      <div class="resize-handle w"></div>
      <div class="resize-handle e"></div>

      <!-- 面板标题栏 -->
      <div class="panel-header" style="background:linear-gradient(135deg, var(--primary-color), var(--primary-dark)); padding:12px 15px; border-bottom:1px solid rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center; cursor:move; user-select:none; border-radius:12px 12px 0 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <span style="font-weight:800; color:#fff; font-size:14px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">✨ 微光</span>
          <div class="panel-controls" style="display:flex; align-items:center; gap:8px;">
              <span id="scan-status-tag" style="background:rgba(255,255,255,0.2); color:#fff; font-size:10px; padding:2px 8px; border-radius:10px; backdrop-filter:blur(4px);">Standby</span>
              <button id="btn-reset" class="icon-btn" title="重置位置">↺</button>
              <button id="btn-clear-history" class="icon-btn" title="清空历史">🗑️</button>
              <button id="btn-minimize" class="icon-btn" title="最小化">➖</button>
          </div>
      </div>
      
      <div class="panel-body" style="padding:15px; flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:var(--bg-primary);">

          <!-- 上部：雷达与身份 -->
          <div class="section-radar" style="background:#fff; padding:12px; border-radius:var(--radius-md); box-shadow:var(--shadow-sm); border:1px solid var(--border-light);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <div style="font-size:10px; color:var(--text-secondary); font-weight:bold;">📡 正在扫描 (CURRENT)</div>
                  <div id="radar-status" style="font-size:10px; color:var(--text-light);">系统就绪</div>
              </div>
              
              <!-- 身份信息区 -->
              <div id="radar-content" style="font-size:13px; font-weight:600; color:var(--text-primary); margin-bottom:8px; min-height:18px;">请点击左侧职位...</div>
              
              <!-- 雷达图可视区 -->
              <div id="radar-chart-visual" style="width:100%; height:180px; display:none; justify-content:center; align-items:center; margin-top:5px;">
                  <!-- SVG 将被注入这里 -->
              </div>
          </div>

          <!-- 底部：链接作者 (Removed) -->

      </div>
      
      <!-- 底部按钮区 -->
      <div class="panel-footer" style="padding:15px; background:#fff; border-top:1px solid var(--border-light); border-radius:0 0 12px 12px;">
          <div style="display:flex; gap:10px;">
              <button id="btn-auto-loop" style="flex:1; padding:8px; background:#fff; color:#00796b; border:1px solid #b2dfdb; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">🔁 自动沟通循环</button>
              <button id="btn-stop-auto-loop" style="flex:1; padding:8px; background:#fff; color:#e53935; border:1px solid #ffcdd2; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">🛑 停止自动循环</button>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
              <button id="btn-export-auto-log" style="flex:1; padding:8px; background:#f8fcfc; color:#006064; border:1px solid #b2ebf2; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">📤 明细日志</button>
              <button id="btn-export-auto-brief" style="flex:1; padding:8px; background:#f8fcfc; color:#006064; border:1px solid #b2ebf2; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">🧾 岗位简报</button>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
              <button id="btn-config-remote-log" style="flex:1; padding:8px; background:#fff; color:#37474f; border:1px solid #cfd8dc; border-radius:var(--radius-md); font-weight:bold; cursor:pointer; font-size:12px; transition:all 0.2s;">☁️ 云端日志</button>
          </div>
      </div>

      <!-- 链接作者弹窗 (Local Author Modal) - Aligned with Config Page -->
      <div id="localAuthorModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: center;">
        <div class="modal-content" style="text-align: center; position: relative; padding: 25px 20px; max-width: 320px; background: #fff; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
            <div id="closeLocalAuthorModal" style="position: absolute; top: 12px; right: 15px; cursor: pointer; font-size: 24px; color: #ccc;">&times;</div>
            
            <!-- 标题 -->
            <h4 style="margin: 0 0 15px 0; color: #333; font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">
                📡 旷野信号塔
            </h4>
            
            <!-- 新增：呼唤语 -->
            <div style="font-size: 10px; color: #90a4ae; margin-bottom: 10px; font-style: italic;">
                “ 致 每一位在寒冬中赶路的战友 ”
            </div>

            <!-- 二维码 -->
            <div style="margin: 0 auto 12px auto; width: 150px; height: 150px; border: 4px solid #f5f5f5; border-radius: 12px; padding: 5px;">
                <img src="${chrome.runtime.getURL('images/author_qr.jpg')}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;" alt="QR Code">
            </div>
            
            <!-- 核心情感文案 -->
            <div style="margin-bottom: 18px; position: relative; display: inline-block;"> 
                 <p style=" 
                     font-size: 13px; 
                     color: #546e7a; 
                     margin: 0; 
                     font-weight: 600; 
                     letter-spacing: 1px; 
                     position: relative; 
                     z-index: 2; 
                 "> 
                     " 微光。" 
                 </p> 
                 <div style=" 
                     position: absolute; 
                     bottom: 2px; 
                     left: 0; 
                     width: 100%; 
                     height: 6px; 
                     background: rgba(255, 235, 59, 0.4); 
                     z-index: 1; 
                     border-radius: 4px; 
                 "></div> 
             </div>
            
            <!-- 引导区 -->
            <div style="
                background: #f8fcfc;
                border: 1px solid #e0f2f1;
                border-radius: 8px;
                padding: 12px 15px;
                margin-bottom: 20px;
                text-align: left;
                box-shadow: inset 0 0 10px rgba(0, 190, 189, 0.05);
            ">
                <div style="display:flex; align-items:center; margin-bottom: 6px; font-size: 13px; color: #333;">
                    <span style="font-size:14px; margin-right:6px;">1️⃣</span>
                    关注公号：<strong style="color: #00838f; margin-left:4px;">旷野里的猫-AI</strong>
                </div>
                <div style="display:flex; align-items:center; font-size: 13px; color: #333;">
                    <span style="font-size:14px; margin-right:6px;">2️⃣</span>
                    后台回复：<strong style="color: #e65100; background:#fff3e0; padding:0 4px; border-radius:4px; margin-left:4px;">能量</strong>
                </div>
                
                <div style="
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px dashed #cfd8dc;
                    font-size: 10px;
                    color: #90a4ae;
                    display: flex;
                    align-items: center;
                ">
                    <span style="margin-right: 4px;">ℹ️</span>
                    每日限量补给，留给急需的战友
                </div>
            </div>

            <!-- 输入区 -->
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="redeemKeyInput" placeholder="粘贴今日暗号..." style="
                    flex: 1;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 13px;
                    outline: none;
                    transition: border 0.3s;
                ">
                <button id="redeemKeyBtn" style="
                    padding: 0 15px;
                    background: linear-gradient(135deg, #00bebd 0%, #00897b 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 13px;
                    white-space: nowrap;
                    box-shadow: 0 4px 12px rgba(0, 190, 189, 0.3);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                ">
                    🔌 接通信号
                </button>
            </div>
            
            <div id="redeemStatus" style="font-size: 11px; height: 16px; text-align: left; padding-left: 4px;"></div>
        </div>
      </div>

    `;
    document.body.appendChild(panel);
    setupDragAndResize(); // Initialize drag and resize functionality

    // === Initialize Local Author Modal Events ===
    setTimeout(() => {
        const localModal = document.getElementById('localAuthorModal');
        const closeLocalModal = document.getElementById('closeLocalAuthorModal');
        const redeemBtn = document.getElementById('redeemKeyBtn');
        const redeemInput = document.getElementById('redeemKeyInput');
        const redeemStatus = document.getElementById('redeemStatus');

        if (closeLocalModal && localModal) {
            closeLocalModal.onclick = () => {
                localModal.style.display = 'none';
            };
            // Click outside to close
            localModal.onclick = (e) => {
                if (e.target === localModal) {
                    localModal.style.display = 'none';
                }
            };
        }

        if (redeemBtn && redeemInput && redeemStatus) {
            redeemBtn.onclick = () => {
                const key = redeemInput.value.trim().toUpperCase();
                if (!key) {
                    redeemStatus.innerText = "请输入暗号";
                    return;
                }
                // Simple validation (format check)
                const validFormat = /^(GM|PARTNER)-\d{4}-[A-Z0-9]{6}$/;
                if (!validFormat.test(key)) {
                    if (key === "1" || key.includes("加油")) {
                         redeemStatus.innerText = "请回复 '1' 获取今日暗号";
                    } else {
                         redeemStatus.innerText = "格式错误 (GM-MMDD-XXXXXX)";
                    }
                    return;
                }
                
                // UI Feedback
                redeemBtn.disabled = true;
                redeemBtn.innerText = "正在接通...";

                // Send message to background to redeem key
                chrome.runtime.sendMessage({
                    action: "redeem_daily_key",
                    key: key
                }, (res) => {
                    redeemBtn.disabled = false;
                    redeemBtn.innerText = "🔌 接通信号塔";

                    if (chrome.runtime.lastError) {
                        redeemStatus.style.color = '#ff5252';
                        redeemStatus.innerText = "通信失败: " + chrome.runtime.lastError.message;
                        return;
                    }

                    if (res && res.success) {
                        redeemStatus.style.color = '#00bebd';
                        redeemStatus.innerText = `连接成功！能量 +${res.addedEnergy || 30}`;
                        
                        // Update UI if possible (optional, as page refresh might be needed for some parts)
                        setTimeout(() => {
                            if(localModal) localModal.style.display = 'none';
                            redeemInput.value = '';
                            redeemStatus.innerText = '';
                        }, 2000);
                    } else {
                        redeemStatus.style.color = '#ff5252';
                        redeemStatus.innerText = res.error || "激活失败";
                    }
                });
            };
        }
    }, 500);


    // === Initialize Daily Spark ===
    const sparkText = document.getElementById('daily-spark-text');
    const sparkContainer = document.getElementById('daily-spark-container');
    if(sparkText && sparkContainer) {
        sparkText.innerText = getRandomQuote();
        sparkContainer.onclick = () => {
            sparkText.style.opacity = '0';
            setTimeout(() => {
                sparkText.innerText = getRandomQuote();
                sparkText.style.opacity = '1';
            }, 200);
        };
    }

    // === Initialize Author Connect Modal - Removed ===
    /* 
    const authorEntry = document.getElementById('author-connect-entry');
    const authorModal = document.getElementById('author-modal');
    ... (Logic removed) ...
    */


    try {
        bindEvents();
    } catch (e) {
        console.error("[BossError] bindEvents failed:", e);
    }

    // === Event Delegation for Dynamic Content (Tabs & Buttons) ===
    panel.addEventListener('click', async (e) => {
        // 1. Script Tabs Switching
        const tab = e.target.closest('.opener-tab');
        if (tab) {
            const container = tab.closest('.smart-opener-card');
            if (!container) return;
            
            // Get index from data-idx or by child index
            const allTabs = Array.from(container.querySelectorAll('.opener-tab'));
            const idx = allTabs.indexOf(tab);
            if (idx === -1) return;

            // Switch Tabs UI
            allTabs.forEach((t, i) => {
                if (i === idx) {
                    t.classList.add('active');
                    t.style.color = '#00bebd';
                    t.style.borderBottom = '2px solid #00bebd';
                    t.style.background = 'rgba(0,190,189,0.05)';
                } else {
                    t.classList.remove('active');
                    t.style.color = '#666';
                    t.style.borderBottom = 'none';
                    t.style.background = 'transparent';
                }
            });

            // Switch Content
            container.querySelectorAll('.opener-content-item').forEach((c, i) => {
                c.style.display = i === idx ? 'block' : 'none';
            });
            return;
        }

        // 2. Copy Button
        const copyBtn = e.target.closest('.btn-copy-script');
        if (copyBtn) {
            const wrapper = copyBtn.closest('.opener-content-item');
            const contentDiv = wrapper ? wrapper.querySelector('div') : null; // First div is content
            if (contentDiv) {
                const text = contentDiv.innerText;
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('✅ 已复制到剪贴板');
                } catch (err) {
                    console.error('Copy failed', err);
                    // Fallback
                    const input = document.createElement('textarea');
                    input.value = text;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    showToast('✅ 已复制 (Fallback)');
                }
            }
            return;
        }

        // 3. Send Button
        const sendBtn = e.target.closest('.btn-send-script');
        if (sendBtn) {
             const wrapper = sendBtn.closest('.opener-content-item');
             const contentDiv = wrapper ? wrapper.querySelector('div') : null;
             if (contentDiv) {
                 const text = contentDiv.innerText;
                 autoGreet(text); // Pass text directly
             }
             return;
        }
    });
    
    // 手动点击监听：先给用户一个反馈
    document.body.addEventListener('click', async (e) => {
        // console.log("🖱️ [BossDebug] Clicked:", e.target); // 调试用，过于频繁可关闭

        // 扩充选择器以适应不同版本的 Boss 页面结构
        let card = e.target.closest('.job-card-wrapper') || 
                   e.target.closest('.job-card-box') || 
                   e.target.closest('.job-primary') ||
                   e.target.closest('li.job-card-body');

        if (card) {
            console.log("🖱️ [BossClick] 捕获职位卡片点击", card);
            
            let title = card.querySelector('.job-name')?.innerText.split('\n')[0] || 
                        card.querySelector('.job-title')?.innerText || 
                        "职位加载中...";
            
            // 此时只更新标题，避免公司/HR抓错
            updateRadarUI(title, "...", "...", "");
            
            // === 新增：状态重置 ===
            // 1. 重置状态文字
            const statusEl = document.getElementById('radar-status');
            if(statusEl) {
                statusEl.innerText = "⏳ 待分析";
                statusEl.style.color = "#999";
            }
            
            // 2. 隐藏旧的报告 (仅在非批量扫描模式下隐藏，批量扫描时为了阅读体验保留上一份报告)
            const reportContent = document.getElementById('report-content');
            if(reportContent && !isScanning) reportContent.style.display = 'none';

            // 3. 重置分析按钮
            const btn = document.getElementById('btn-analyze');
            if (btn) {
                btn.innerText = "⚡ 深度剖析";
                btn.disabled = false;
                btn.style.opacity = "1";
            }

            // 4. 隐藏一键开聊
            const btnGreet = document.getElementById('btn-auto-greet');
            if(btnGreet) btnGreet.style.display = 'none';
            
            // 5. 隐藏忽略按钮
            const btnIgnore = document.getElementById('btn-ignore');
            if(btnIgnore) btnIgnore.style.display = 'none';

            // 6. 隐藏雷达图
            const visual = document.getElementById('radar-chart-visual');
            if(visual) visual.style.display = 'none';

            // 7. 清空隐形薪资缓存 (避免上一职位的缓存污染当前职位)
            rawSalaryData = null;

            // === 8. 自动检查历史记录并预加载 (Auto-Load History) ===
            // 用户点击职位卡片后，如果有历史记录，应立即展示，无需再次点击“深度剖析”
            
            // 尝试获取链接和 Job ID
            let link = card.querySelector('.job-card-left');
            if (!link) {
                // 宽泛查找：任何包含 job_detail 的链接
                link = card.querySelector('a[href*="job_detail"]');
            }
            // 如果还没找到，尝试找卡片内任意 a 标签
            if (!link) {
                link = card.querySelector('a.job-card-body-link') || card.querySelector('a');
            }
            
            // 如果点击的是链接本身，直接使用
            if (!link && e.target.tagName === 'A') {
                link = e.target;
            }
            
            const href = link ? link.href : null;
            const clickedJobId = getJobId(href);
            
            console.log(`🖱️ [BossClick] 提取信息:`, {
                title, 
                href, 
                id: clickedJobId
            });

            if (clickedJobId) {
                // 更新全局活跃 ID
                currentActiveJobId = clickedJobId;

                // 确保 HistoryManager 已初始化
                if (typeof HistoryManager !== 'undefined') {
                    if (!HistoryManager.isLoaded) await HistoryManager.init();

                    const history = HistoryManager.get(clickedJobId);
                    if (history) {
                        console.log(`💰 [BossClick] 命中历史索引: ${clickedJobId}, st=${history.st}`);
                        // 尝试获取详情
                        const detail = await HistoryManager.getDetail(clickedJobId);
                        if (detail && detail.aiData) {
                             console.log("📂 [BossClick] 成功加载历史报告");
                             
                             // 更新 UI
                             if(statusEl) {
                                 statusEl.innerText = "✅ 已恢复历史报告";
                                 statusEl.style.color = "#00c853";
                             }
                             
                             // 填充数据
                             const jobData = detail.jobData;
                             updateRadarUI(jobData.detailTitle, jobData.company, jobData.hr, jobData.active, jobData.hrTitle);
                             updateReportIdentityUI(jobData);
                             renderFullReport(jobData, detail.aiData);
                             
                             // 显示相关按钮
                             if(btnGreet) btnGreet.style.display = 'inline-block';
                             if(btnIgnore) btnIgnore.style.display = 'inline-block';
                             if(visual) visual.style.display = 'block'; // 恢复雷达图
                             if(reportContent) reportContent.style.display = 'block'; // 显示报告
                             
                             // 恢复“深度剖析”按钮状态
                             if (btn) {
                                 btn.innerText = "⚡ 重新分析";
                             }
                        } else {
                            console.warn("⚠️ [BossClick] 命中索引但缺失详情数据，执行自愈清理...");
                            // 自愈：清理无效索引
                            HistoryManager.cache.delete(clickedJobId);
                            HistoryManager.save();
                            
                            // UI 反馈
                            if(statusEl) {
                                statusEl.innerText = "⚠️ 历史数据缺失，请重新分析";
                                statusEl.style.color = "#ff9800";
                            }
                            if (btn) {
                                btn.innerText = "⚡ 立即分析";
                            }
                        }
                    } else {
                        console.log("⚪ [BossClick] 该职位无历史记录");
                    }
                }
            }
        }
    });

    // 初始化拖拽和调整大小功能
    setupDragAndResize();
    restorePanelState(); // 恢复上次位置
    // restoreLastAnalysis(); // [已废弃] 现在的逻辑由 HistoryManager 接管，且页面加载时会自动触发 checkAutoLoadHistory
    checkAutoLoadHistory(); // 初始化时自动检查当前页面的 Job ID

    // === 页面恢复监听已移至全局 ===
}

// === 新增：页面加载/路由变化时自动检查历史 ===
async function checkAutoLoadHistory() {
    // 确保 HistoryManager 已加载
    if (!HistoryManager.isLoaded) await HistoryManager.init();

    const currentJobId = getJobId(window.location.href);
    if (!currentJobId) return;

    console.log(`🔄 [AutoLoad] 检查当前页面 Job ID: ${currentJobId}`);
    
    const history = HistoryManager.get(currentJobId);
    if (history) {
        // [Fix] 只要命中历史记录索引，首先强制隐藏分析动画
        // 这解决了从列表页(批量巡检状态)跳转到详情页时，可能残留"AI正在分析"动画的问题
        // 无论后续详情加载是否成功，都不应显示"正在分析"的中间状态
        hideAnalyzingOverlay(false);

        const detail = await HistoryManager.getDetail(currentJobId);
        if (detail && detail.aiData) {
             console.log("📂 [AutoLoad] 页面初始化/刷新，自动加载历史报告");
             
             // 确保 UI 容器存在
             if (!document.getElementById('boss-copilot-panel')) initWrapper();

             const jobData = detail.jobData;
             updateRadarUI(jobData.detailTitle, jobData.company, jobData.hr, jobData.active, jobData.hrTitle);
             updateReportIdentityUI(jobData);
             renderFullReport(jobData, detail.aiData);
             
             const statusEl = document.getElementById('radar-status');
             if(statusEl) {
                 statusEl.innerText = "✅ 已恢复历史报告";
                 statusEl.style.color = "#00c853";
             }
             
             const btnGreet = document.getElementById('btn-auto-greet');
             const btnIgnore = document.getElementById('btn-ignore');
             const reportContent = document.getElementById('report-content');
             const btn = document.getElementById('boss-analyze-btn');

             if(btnGreet) btnGreet.style.display = 'inline-block';
             if(btnIgnore) btnIgnore.style.display = 'inline-block';
             if(reportContent) reportContent.style.display = 'block';
             
             if (btn) {
                 btn.innerText = "⚡ 重新分析";
             }
        } else {
             console.warn("⚠️ [AutoLoad] 命中索引但缺失详情数据，执行自愈清理...");
             HistoryManager.cache.delete(currentJobId);
             HistoryManager.save();
        }
    }
}

// ================= 2. UI 更新函数 (统一标准) =================

function generateIdentityHtml(title, company, hr, activeTime, hrTitle = "") {
    let activeTag = "";
    if (activeTime && activeTime !== "状态未知") {
        let color = "#999";
        if (activeTime.includes("刚刚") || activeTime.includes("今日")) color = "#00c853";
        else if (activeTime.includes("3日") || activeTime.includes("本周")) color = "#ff9800";
        activeTag = `<span style="font-size:10px; color:${color}; border:1px solid ${color}; padding:0 3px; border-radius:3px; margin-left:5px; font-weight:normal;">${activeTime}</span>`;
    }
    
    let titleTag = "";
    if (hrTitle) {
        // 根据头衔不同给予不同颜色暗示
        let bg = "#f0f0f0";
        let fg = "#666";
        if (hrTitle.includes("总监") || hrTitle.includes("CTO") || hrTitle.includes("经理")) {
            bg = "#e3f2fd"; fg = "#1976d2"; // 蓝色系 - 技术大佬
        } else if (hrTitle.includes("创始人") || hrTitle.includes("CEO")) {
            bg = "#f3e5f5"; fg = "#7b1fa2"; // 紫色系 - 老板
        } else if (hrTitle.includes("HR") || hrTitle.includes("人事") || hrTitle.includes("招聘")) {
            bg = "#fff3e0"; fg = "#ef6c00"; // 橙色系 - HR
        }
        titleTag = `<span style="font-size:10px; color:${fg}; background:${bg}; padding:0 4px; border-radius:3px; margin-left:4px;">${hrTitle}</span>`;
    }

    return `
        <span style="font-weight:bold; color:#333;">${title}</span>
        <span style="color:#e0e0e0; margin:0 4px;">|</span>
        <span style="color:#333;">${company}</span>
        <span style="color:#e0e0e0; margin:0 4px;">|</span>
        <span style="color:#999; font-weight:normal;">${hr}</span>
        ${titleTag}
        ${activeTag}
    `;
}

// 统一更新雷达
function updateRadarUI(title, company, hr, activeTime, hrTitle = "") {
    const html = generateIdentityHtml(title, company, hr, activeTime, hrTitle); 
    const radar = document.getElementById('radar-content');
    if(radar) radar.innerHTML = html;
}

// 统一更新报告身份
function updateReportIdentityUI(data) {
    const html = generateIdentityHtml(data.detailTitle, data.company, data.hr, data.active, data.hrTitle);
    const identity = document.getElementById('ui-report-identity');
    if(identity) identity.innerHTML = html;
}

function cleanSalaryText(value) {
    return decodeBossObfuscatedDigits(normalizeAutoApplyText(value))
        .replace(/[\u00a0]/g, " ")
        .replace(/\s+/g, "");
}

function decodeBossObfuscatedDigits(value) {
    return String(value || "").replace(/[\uE031-\uE03A]/g, (char) => {
        return String(char.codePointAt(0) - 0xE031);
    });
}

function extractSalaryValue(text) {
    const clean = cleanSalaryText(text);
    if (!clean) return "";
    const match = clean.match(SALARY_PATTERN);
    return match ? match[0] : "";
}

function describeElement(el) {
    if (!el) return "";
    const tag = (el.tagName || "").toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const classText = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
    return `${tag}${id}${classText ? "." + classText : ""}`;
}

function collectSalaryCandidates(root = document, options = {}) {
    const { excludeList = false, source = "detail" } = options;
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (el, selector) => {
        if (!el || seen.has(el)) return;
        seen.add(el);
        if (excludeList && (el.closest('.job-card-wrapper') || el.closest('.job-card-box') || el.closest('.job-list-box'))) return;
        const text = normalizeAutoApplyText(el.innerText || el.textContent || "");
        const value = extractSalaryValue(text);
        if (!value) return;
        const decodedText = decodeBossObfuscatedDigits(text);
        candidates.push({
            value,
            source,
            probe: `${selector} => ${describeElement(el)} => ${decodedText.slice(0, 80)}`
        });
    };

    SALARY_SELECTORS.forEach(selector => {
        try {
            const nodes = root.querySelectorAll ? root.querySelectorAll(selector) : [];
            nodes.forEach(el => pushCandidate(el, selector));
        } catch (e) {}
    });

    const rootText = normalizeAutoApplyText(root.innerText || root.textContent || "");
    const rootValue = extractSalaryValue(rootText);
    if (rootValue) {
        const decodedRootText = decodeBossObfuscatedDigits(rootText);
        candidates.push({
            value: rootValue,
            source: `${source}_text`,
            probe: `${describeElement(root)} text => ${decodedRootText.slice(0, 120)}`
        });
    }

    return candidates;
}

function findSalaryNearTitle(title, options = {}) {
    const target = normalizeAutoApplyText(title);
    if (!target || target === "职位") return null;
    const { root = document, source = "near_title", maxAncestors = 6 } = options;
    const nodes = Array.from(root.querySelectorAll ? root.querySelectorAll('h1, h2, h3, a, span, div, p') : []);
    const titleNodes = nodes.filter(el => {
        const text = normalizeAutoApplyText(el.innerText || el.textContent || "");
        if (!text) return false;
        return text === target || text.includes(target) || target.includes(text);
    }).slice(0, 20);

    for (const titleEl of titleNodes) {
        let cursor = titleEl;
        for (let depth = 0; cursor && depth <= maxAncestors; depth++) {
            const text = normalizeAutoApplyText(cursor.innerText || cursor.textContent || "");
            const value = extractSalaryValue(text);
            if (value) {
                const decodedText = decodeBossObfuscatedDigits(text);
                return {
                    value,
                    source,
                    probe: `${source}: ${describeElement(titleEl)} -> parent${depth} ${describeElement(cursor)} => ${decodedText.slice(0, 160)}`
                };
            }
            cursor = cursor.parentElement;
        }
    }

    return null;
}

function getSalaryFromCard(card, title = "") {
    if (!card) return null;
    const direct = collectSalaryCandidates(card, { source: "list_card" })[0];
    if (direct) return direct;

    let cursor = card.parentElement;
    for (let depth = 1; cursor && depth <= 5; depth++) {
        const candidate = collectSalaryCandidates(cursor, { source: `list_card_parent_${depth}` })[0];
        if (candidate) return candidate;
        cursor = cursor.parentElement;
    }

    return findSalaryNearTitle(title, { root: card.closest('.job-card-wrapper, .job-card-box') || card, source: "list_title_nearby", maxAncestors: 5 });
}

function applySalaryFallback(data, card) {
    if (!data) return data;
    const detailCandidate = collectSalaryCandidates(document, { excludeList: true, source: "detail_probe" })[0];
    const detailTitleCandidate = findSalaryNearTitle(data.detailTitle, { root: document, source: "detail_title_nearby", maxAncestors: 7 });
    const cardCandidate = getSalaryFromCard(card, data.detailTitle);
    const candidate = data.salary
        ? { value: data.salary, source: data.salarySource || "detail", probe: data.salaryProbe || "" }
        : (detailCandidate || detailTitleCandidate || cardCandidate);

    if (candidate && candidate.value && !data.salary) {
        data.salary = candidate.value;
        data.text = `${data.text || ""}\n【薪资兜底】：${candidate.value}`;
    }
    if (candidate && candidate.value) {
        data.salarySource = candidate.source;
        data.salaryProbe = candidate.probe;
    } else if (!data.salaryProbe) {
        const cardText = decodeBossObfuscatedDigits(normalizeAutoApplyText(card && (card.innerText || card.textContent || "")));
        const parentText = decodeBossObfuscatedDigits(normalizeAutoApplyText(card && card.parentElement && (card.parentElement.innerText || card.parentElement.textContent || "")));
        const titleProbe = findSalaryNearTitle(data.detailTitle, { root: document, source: "no_match_title_probe", maxAncestors: 3 });
        data.salaryProbe = titleProbe && titleProbe.probe
            ? `no_value_but_title_probe => ${titleProbe.probe}`
            : (cardText ? `no_match_card_text => ${cardText.slice(0, 160)}` : (parentText ? `no_match_parent_text => ${parentText.slice(0, 160)}` : "no_salary_candidate"));
    }
    return data;
}

function cleanJobDescriptionText(value) {
    const text = decodeBossObfuscatedDigits(normalizeAutoApplyText(value));
    return text
        .replace(/^职位描述\s*/i, "")
        .replace(/微信扫码分享\s*举报\s*/g, "")
        .replace(/收藏\s*立即沟通\s*/g, "")
        .trim();
}

function isLikelyJobDescription(text) {
    const clean = cleanJobDescriptionText(text);
    if (clean.length < 20) return false;
    return /职责|任职要求|职位要求|工作职责|工作内容|岗位职责|职位名称|要求|负责|协助|参与/.test(clean);
}

function collectDescriptionCandidates(root = document, options = {}) {
    const { excludeList = true, source = "description_selector" } = options;
    const selectors = [
        '.job-detail-body',
        '.job-sec-text',
        '.text-container',
        '.job-detail-section',
        '.job-sec',
        '.job-description',
        '[class*="job-detail"]',
        '[class*="description"]'
    ];
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (el, selector) => {
        if (!el || seen.has(el)) return;
        seen.add(el);
        if (excludeList && (el.closest('.job-card-wrapper') || el.closest('.job-card-box') || el.closest('.job-list-box'))) return;
        const raw = el.innerText || el.textContent || "";
        if (!isLikelyJobDescription(raw)) return;
        const text = cleanJobDescriptionText(raw);
        candidates.push({
            value: text,
            source,
            probe: `${selector} => ${describeElement(el)} => ${text.slice(0, 160)}`
        });
    };

    selectors.forEach(selector => {
        try {
            const nodes = root.querySelectorAll ? root.querySelectorAll(selector) : [];
            nodes.forEach(el => pushCandidate(el, selector));
        } catch (e) {}
    });

    return candidates.sort((a, b) => {
        const aScore = Math.min(a.value.length, 1600);
        const bScore = Math.min(b.value.length, 1600);
        return bScore - aScore;
    });
}

function findDescriptionNearHeading(root = document) {
    const nodes = Array.from(root.querySelectorAll ? root.querySelectorAll('h1, h2, h3, h4, div, span, p') : []);
    const headingNodes = nodes.filter(el => {
        const text = normalizeAutoApplyText(el.innerText || el.textContent || "");
        return text === "职位描述" || text === "岗位描述" || text === "工作描述";
    }).slice(0, 20);

    for (const heading of headingNodes) {
        let cursor = heading;
        for (let depth = 0; cursor && depth <= 7; depth++) {
            const raw = cursor.innerText || cursor.textContent || "";
            if (isLikelyJobDescription(raw)) {
                const text = cleanJobDescriptionText(raw);
                return {
                    value: text,
                    source: "description_heading_nearby",
                    probe: `${describeElement(heading)} -> parent${depth} ${describeElement(cursor)} => ${text.slice(0, 160)}`
                };
            }
            cursor = cursor.parentElement;
        }

        let sibling = heading.nextElementSibling;
        let combined = "";
        let hops = 0;
        while (sibling && hops < 8) {
            combined += "\n" + (sibling.innerText || sibling.textContent || "");
            if (isLikelyJobDescription(combined)) {
                const text = cleanJobDescriptionText(combined);
                return {
                    value: text,
                    source: "description_heading_siblings",
                    probe: `${describeElement(heading)} siblings => ${text.slice(0, 160)}`
                };
            }
            sibling = sibling.nextElementSibling;
            hops++;
        }
    }

    return null;
}

function getJobDescriptionData() {
    const selectorCandidate = collectDescriptionCandidates(document, { excludeList: true, source: "description_selector" })[0];
    const headingCandidate = findDescriptionNearHeading(document);
    const candidate = selectorCandidate || headingCandidate;
    if (candidate && candidate.value) {
        return {
            description: candidate.value,
            descriptionSource: candidate.source,
            descriptionProbe: candidate.probe
        };
    }

    return {
        description: "",
        descriptionSource: "",
        descriptionProbe: "no_description_candidate"
    };
}


// ================= 3. 数据抓取 (唯一真理：右侧详情页) =================

function getDetailData() {
    // DOM查找器
    const findInDetail = (selectors) => {
        for(let s of selectors) {
            const els = document.querySelectorAll(s);
            for (let el of els) {
                // 关键过滤：排除左侧列表区域
                if (el.closest('.job-card-wrapper') || el.closest('.job-card-box') || el.closest('.job-list-box')) continue;
                if (el.innerText.trim()) return el.innerText.trim();
            }
        }
        return "";
    };

    // 1. 正文
    const descData = getJobDescriptionData();
    const text = descData.description || findInDetail(['.job-detail-body', '.job-sec-text', '.text-container']);
    
    // 2. 标题 (各种结构兼容)
    let detailTitle = findInDetail([
        '.job-detail-info .job-name', // V7优先
        'h1', 
        '.job-banner .name', 
        '.name-box .name', 
        '.job-header .name',
        '.job-name' // 增加通用选择器
    ]).split('\n')[0];

    // 2.5 薪资信息 (新增：确保AI能获取薪资进行评估)
    // 优化策略：优先在 Header 区域查找，避免全局搜索命中筛选栏或无关元素
    let salary = "";
    let salarySource = "";
    let salaryProbe = "";
    const headerEl = document.querySelector('.job-banner') || 
                     document.querySelector('.job-header') || 
                     document.querySelector('.name-box');

    if (headerEl) {
        // 在 Header 内部精确查找
        const headerSalary = collectSalaryCandidates(headerEl, { source: "detail_header" })[0];
        if (headerSalary) {
            salary = headerSalary.value;
            salarySource = headerSalary.source;
            salaryProbe = headerSalary.probe;
        }
    }

    // 如果 Header 里没找到，再尝试通用搜索 (带校验)
    if (!salary) {
        const detailSalary = collectSalaryCandidates(document, { excludeList: true, source: "detail_selector" })[0];
        if (detailSalary) {
            salary = detailSalary.value;
            salarySource = detailSalary.source;
            salaryProbe = detailSalary.probe;
        } else {
            salary = extractSalaryValue(findInDetail(['.salary', '.salary-text', '.job-salary']));
        }
    }

    // 校验：薪资必须包含数字，否则可能是“薪资面议”或误命中筛选栏
    if (salary && !/\d/.test(salary) && !salary.includes('面议')) {
        console.log("⚠️ [BossDebug] 抓取到无效薪资文本 (可能误命中):", salary);
        salary = ""; // 置空，触发后续兜底
        salarySource = "";
        salaryProbe = "";
    }

     // === 尝试使用隐形探测数据 (High Priority) ===
     if (rawSalaryData) {
         console.log("🔓 [BossDecoder] 使用隐形通道薪资:", rawSalaryData);
         salary = rawSalaryData;
         salarySource = "hidden_probe";
         salaryProbe = "BOSS_PLUGIN_SALARY_PROBE";
     }
     
     console.log("🔍 [BossDebug] 初始获取薪资文本:", salary);

     // === 薪资解码 (Font Obfuscation Decoder) ===
     // Boss直聘有时会使用自定义字体混淆数字 (例如 -K)
     // 这里我们尝试通过 DOM 样式还原，或者直接利用浏览器已渲染的文本 (innerText 通常是乱码，但 getComputedStyle 可能暴露线索，或者直接 OCR，但 OCR 太重)
     // 降级策略：如果发现乱码 (包含私有区字符 E000-F8FF)，则尝试从页面元数据或 JSON-LD 中提取
     
     const isObfuscated = (str) => !str || /[\uE000-\uF8FF]/.test(str); // 修改：空字符串也视为需要解码
     
     if (isObfuscated(salary)) {
         console.log("⚠️ [BossDebug] 薪资为空或包含乱码，启动解码策略...");
         // 策略 A: 尝试从页面 JSON-LD 结构化数据中提取 (最准)
         const scriptLD = document.querySelector('script[type="application/ld+json"]');
         if (scriptLD) {
             try {
                 const ld = JSON.parse(scriptLD.innerText);
                 // 结构通常是: { "@type": "JobPosting", "baseSalary": { "minValue": ..., "maxValue": ..., "currency": "CNY" } }
                 if (ld.baseSalary) {
                     const min = ld.baseSalary.minValue;
                     const max = ld.baseSalary.maxValue;
                     const unit = ld.baseSalary.unitText || "K"; // 假设是 K，实际可能是 MONTH
                     if (min && max) {
                         // Boss 的 unitText 可能是 "MONTH"，值可能是 20000
                         // 我们需要转回 20-35K 的格式
                         let minK = min, maxK = max;
                         if (min > 1000) minK = Math.round(min / 1000);
                         if (max > 1000) maxK = Math.round(max / 1000);
                         salary = `${minK}-${maxK}K`;
                         salarySource = "json_ld";
                         salaryProbe = "script[type=application/ld+json].baseSalary";
                         console.log("🔓 [BossDecoder] 从 JSON-LD 解码薪资:", salary);
                     }
                 }
             } catch(e) { console.error("JSON-LD parse error", e); }
         }
         
         // 策略 B: 如果 JSON-LD 失败，尝试从页面 Meta 标签提取
         // <meta name="description" content="...薪资：20-35K...">
         if (!salary || isObfuscated(salary)) {
             const metaDesc = document.querySelector('meta[name="description"]');
             if (metaDesc) {
                 const desc = metaDesc.content;
                 // 增强正则：支持 K/k/万/元/天, 支持 English, 允许冒号后有空格
                 const match = desc.match(/(?:薪资|Salary|待遇)[：:]\s*(\d+(?:[-~]\d+)?[kK万元](?:·\d+薪|\/[天日])?)/i);
                 if (match) {
                     salary = match[1];
                     salarySource = "meta_description";
                     salaryProbe = `meta[name=description] => ${desc.slice(0, 120)}`;
                     console.log("🔓 [BossDecoder] 从 Meta 标签解码薪资:", salary);
                 }
             }
         }

         // 策略 C: 尝试从 Title 标签提取
         // <title>运维工程师招聘_北京运维工程师招聘_20-35K - Boss直聘</title>
         if (!salary || isObfuscated(salary)) {
             const pageTitle = document.title;
             // 增强正则
             const match = pageTitle.match(/(\d+(?:[-~]\d+)?[kK万元](?:·\d+薪)?)/i);
             if (match) {
                 salary = match[1];
                 salarySource = "document_title";
                 salaryProbe = `title => ${pageTitle.slice(0, 120)}`;
                 console.log("🔓 [BossDecoder] 从 Title 解码薪资:", salary);
             }
         }
     }
     
     if (!salary) {
          // 尝试从标题区域查找 (有时候薪资和标题在一起)
         const headerText = findInDetail(['.job-banner', '.job-header', '.name-box']);
         // 终极暴力正则：支持 20-30K, 20-30k, 1.5-2万, 200元/天
         const match = headerText.match(/(\d+(?:[-~]\d+)?[kK万元](?:·\d+薪)?)|(\d+元\/天)/i);
         if (match) {
             salary = match[0];
             salarySource = "detail_header_text";
             salaryProbe = `headerText => ${headerText.slice(0, 120)}`;
         }
    }

    // 3. 结构化信息 (公司、HR)
    let hrName = "", companyName = "", activeTime = "", companyTags = "", jobTags = "", hrTitle = "";

    const bossInfoContainer = document.querySelector('.job-boss-info');
    if (bossInfoContainer) {
        // HR 名字 & 活跃度 & 头衔
        const nameEl = bossInfoContainer.querySelector('.name');
        if (nameEl) {
            const activeEl = nameEl.querySelector('.boss-active-time');
            if (activeEl) {
                activeTime = activeEl.innerText.trim();
                hrName = nameEl.innerText.replace(activeTime, '').trim(); // 剔除"刚刚活跃"
            } else {
                 // 兜底
                 const fullText = nameEl.innerText;
                 if (fullText.includes('在线')) activeTime = '在线';
                 else if (fullText.includes('刚刚活跃')) activeTime = '刚刚活跃';
                 else if (fullText.includes('今日活跃')) activeTime = '今日活跃';
                 
                 if (activeTime) hrName = fullText.replace(activeTime, '').trim();
                 else hrName = fullText.trim();
            }
        }
        
        // HR 头衔 (例如: 招聘专员 / CTO / 技术总监)
        const titleEl = bossInfoContainer.querySelector('.boss-title');
        if (titleEl) hrTitle = titleEl.innerText.trim();
        
        // 公司 & HR职位 (旧逻辑兼容)
        const attrEl = bossInfoContainer.querySelector('.boss-info-attr');
        if (attrEl && !companyName) {
            const attrText = attrEl.innerText; // "xx公司 · HR"
            companyName = attrText.includes('·') ? attrText.split('·')[0].trim() : attrText.trim();
        }
    }
    
    // 公司信息 (规模、融资阶段)
    const companyContainer = document.querySelector('.job-sec-company');
    if (companyContainer) {
        const nameEl = companyContainer.querySelector('.name');
        if (nameEl) companyName = nameEl.innerText.trim();
        
        // 抓取融资阶段和规模 (例如: D轮 | 1000-9999人)
        // Boss 详情页右侧通常有 p 标签或 .res-time 标签
        const tags = Array.from(companyContainer.querySelectorAll('p, .text-desc, .res-time'))
            .map(el => el.innerText.trim())
            .filter(t => t && t !== companyName); // 过滤掉公司名本身
        companyTags = tags.join(' | ');
    } else {
        // 尝试从顶部Banner抓取
        const bannerCompany = document.querySelector('.company-info');
        if (bannerCompany) {
             const nameEl = bannerCompany.querySelector('.name') || bannerCompany.querySelector('a[href*="gongsi"]');
             if (nameEl) companyName = nameEl.innerText.trim();
             
             const tags = Array.from(bannerCompany.querySelectorAll('p'))
                .map(el => el.innerText.trim())
                .filter(t => t && !t.includes(companyName));
             companyTags = tags.join(' | ');
        }
    }
    
    // 职位标签 (福利、关键词)
    const jobTagsContainer = document.querySelector('.job-tags');
    if (jobTagsContainer) {
        jobTags = Array.from(jobTagsContainer.querySelectorAll('span'))
            .map(s => s.innerText.trim())
            .join(', ');
    }

    // 兜底补救
    if (!hrName) hrName = findInDetail(['.boss-info .name']).replace(/招聘者|人事.*/g,'');
    if (!companyName) companyName = findInDetail(['.company-name', '.job-sec-company .name']);
    if (!detailTitle) detailTitle = "职位读取中"; // 占位符

    // 4. 组装更丰富的 Job Text (Context-Aware)
    // 我们不仅仅发送职位描述，还发送这些元数据，以便 Prompt 进行“猎头式”推理
    const fullJobText = `
【职位分析元数据】
- 职位名称：${detailTitle}
- 薪资范围：${salary || "面议"}
- 发布人：${hrName} (${hrTitle || "未知头衔"}) [${activeTime}]
- 公司背景：${companyName} [${companyTags}]
- 福利标签：${jobTags}

【职位描述正文 (可能是复制粘贴的，请甄别)】：
${text}
    `;

    return { 
        text: fullJobText, // 替换原始文本
        detailTitle, 
        salary, 
        salarySource,
        salaryProbe,
        company: companyName || "公司", 
        hr: hrName || "HR", 
        active: activeTime || "",
        hrTitle,
        companyTags,
        jobTags,
        description: text,
        descriptionSource: descData.descriptionSource || "",
        descriptionProbe: descData.descriptionProbe || "",
        rawDesc: text // 保留原始描述备用
    };
}

// 等待右侧加载同步
async function waitForSync(targetTitle, targetCompany) {
    let retries = 0;
    while(retries < 25) { 
        const d = getDetailData();
        // 核心：用右侧抓到的标题，去匹配左侧目标标题
        // 兼容模糊匹配：Boss有时候左侧写"Java"，右侧写"高级Java工程师"
        let titleMatch = d.text && d.detailTitle && (d.detailTitle.includes(targetTitle) || targetTitle.includes(d.detailTitle));
        
        // 增强：如果提供了公司名，也进行匹配 (防止同职位名不同公司的数据串扰)
        if (titleMatch && targetCompany && d.company) {
             // 简单的包含关系检查
             if (!d.company.includes(targetCompany) && !targetCompany.includes(d.company)) {
                 titleMatch = false;
                 // console.log(`🔄 [Sync] 标题匹配但公司不匹配: 列表[${targetCompany}] vs 详情[${d.company}]`);
             }
        }

        if (titleMatch) {
            return d; 
        }
        await new Promise(r => setTimeout(r, 200));
        retries++;
    }
    return getDetailData(); 
}


// ================= 4. 业务逻辑 (Logic) =================

// 全局变量：控制分析状态
let currentAnalysisController = null;

// === 辅助：手动触发数据探测 ===
function injectDataProbe() {
    console.log("💉 [BossDebug] Requesting Data Probe Injection (Manual Trigger)...");
    chrome.runtime.sendMessage({ action: "inject_main_world_scripts" }, (response) => {
        if (chrome.runtime.lastError) {
             console.warn("⚠️ [BossDebug] Manual Injection failed:", chrome.runtime.lastError);
        } else {
             console.log("✅ [BossDebug] Manual Injection requested:", response);
        }
    });
}

// === 场景 A：手动分析 ===
async function manualAnalyze(arg) {
    const forceRefresh = arg === true; // Only true if explicitly passed true
    console.log(`⚡ [BossDebug] Manual Analyze Clicked (Force: ${forceRefresh})`);
    showToast("⚡ 正在启动分析引擎...", 2000);
    const btn = document.getElementById('btn-analyze');
    
    // === 1. 如果正在分析，点击则为“停止” ===
    if (currentAnalysisController) {
        console.log("🛑 用户手动停止分析");
        currentAnalysisController.abort(); // 发送中止信号
        currentAnalysisController = null;
        
        // 发送后端停止信号
        chrome.runtime.sendMessage({ action: "stop_analysis" });
        
        // 恢复 UI
        btn.innerText = "⚡ 重新分析"; // 既然停止了，下次就是重新分析
        btn.style.background = ""; // 恢复默认背景
        btn.style.zIndex = ""; 
        btn.disabled = false;
        
        hideAnalyzingOverlay(true, "用户已取消");
        
        // 恢复状态文字
        const statusEl = document.getElementById('radar-status');
        if(statusEl) {
            statusEl.innerText = "⚠️ 已取消";
            statusEl.style.color = "#ff9800";
        }
        return;
    }

    // === 2. 开始分析 ===
    // 初始化控制器
    currentAnalysisController = new AbortController();
    const signal = currentAnalysisController.signal;

    // === 注入数据探测 (如果尚未获取) ===
    // 如果已有 rawSalaryData (通常在点击卡片时自动获取)，则无需重置
    if (!rawSalaryData) {
        console.log("🔍 [BossDebug] 尚未获取到隐形薪资，尝试主动注入探测...");
        injectDataProbe();
        
        // 智能等待：轮询直到获取到薪资或超时 (Max 1s)
        let probeRetries = 0;
        while (!rawSalaryData && probeRetries < 10) {
            await new Promise(r => setTimeout(r, 100));
            probeRetries++;
        }
        console.log(`⏱️ [BossDebug] 薪资探测耗时: ${probeRetries * 100}ms, 结果: ${rawSalaryData || "未获取"}`);
    } else {
        console.log("⚡ [BossDebug] 命中隐形薪资缓存，直接使用:", rawSalaryData);
    }

    const originalText = btn.innerText;
    
    // UI 变更：显示“停止”按钮
    btn.innerText = "⏹ 停止分析";
    btn.style.background = "#ff5252"; // 红色警示
    btn.style.zIndex = ""; // 不需要特殊层级了
    btn.disabled = false; // 保持可点击，以便取消
    
    // 立即显示加载动画
    console.log("⚡ [BossDebug] Triggering showAnalyzingOverlay...");
    showAnalyzingOverlay();

    try {
        // 手动时，右侧已经是加载好的，直接取
        const data = getDetailData();
        if(!data.text) { 
            alert('请先点击一个职位'); 
            throw new Error("No job selected");
        }

        // === 插入：历史记录检查 ===
        let jobId = getJobId(window.location.href);
        // Fallback to clicked card ID if URL is not updated (e.g. List Page popup)
        if (!jobId && currentActiveJobId) {
            jobId = currentActiveJobId;
            console.log(`ℹ️ [BossDebug] Using clicked Job ID: ${jobId}`);
        }

        const history = HistoryManager.get(jobId);
        
        // 只有当不是“重新分析”且非强制刷新时，才使用缓存
        // [FIX] 只要有历史详情就应该加载，不应受限于 st=1 (因为 st=2 可能是分析后投递的)
        if (!forceRefresh && history && !originalText.includes("重新")) {
             console.log("💰 [BossDebug] 检查缓存索引:", jobId);
             
             // 模拟加载延迟，给用户一点反应时间
             await new Promise((r, j) => {
                 const id = setTimeout(r, 500);
                 signal.addEventListener('abort', () => { clearTimeout(id); j(new Error("Aborted")); });
             });
             
             // 尝试恢复详细报告 (新版: 从独立Key获取)
             let detail = await HistoryManager.getDetail(jobId);
             
             // 兼容旧版：如果找不到详情，尝试从 lastAnalysisData 找一次 (仅过渡期)
             if (!detail) {
                 const oldCache = await new Promise(r => chrome.storage.local.get(['lastAnalysisData'], r));
                 if (oldCache.lastAnalysisData && oldCache.lastAnalysisData.jobId === jobId) {
                      detail = {
                          jobData: oldCache.lastAnalysisData.jobData,
                          aiData: oldCache.lastAnalysisData.aiData
                      };
                 }
             }

             if (detail && detail.aiData) {
                 console.log("📂 [BossDebug] 命中详细缓存");
                 
                 // [Fix] 停止并隐藏分析动画
                 hideAnalyzingOverlay(false);

                 updateRadarUI(data.detailTitle, data.company, data.hr, data.active, data.hrTitle);
                 updateReportIdentityUI(data);
                 renderFullReport(detail.jobData || data, detail.aiData);
                 
                 const statusEl = document.getElementById('radar-status');
                 if(statusEl) {
                     statusEl.innerText = `✅ 分析完成 (本地缓存)`;
                     statusEl.style.color = "#00c853";
                 }

                 document.getElementById('btn-auto-greet').style.display = 'inline-block';
                 document.getElementById('btn-ignore').style.display = 'inline-block';
                 
                 // 成功恢复缓存，重置按钮
                 currentAnalysisController = null;
                 btn.innerText = "⚡ 重新分析";
                 btn.style.background = ""; 
                 btn.style.zIndex = "";
                 
                 // === 绑定强制刷新事件 ===
                 btn.onclick = () => manualAnalyze(true);
                 
                 return;
             } else {
                 console.log("⚠️ [BossDebug] 命中索引但未找到详情，回退到重新分析");
             }
        }
        
        // 如果没有命中缓存，或者缓存数据不匹配，继续走 API 分析
        if (signal.aborted) throw new Error("Aborted");

        updateRadarUI(data.detailTitle, data.company, data.hr, data.active);
        updateReportIdentityUI(data); 
        
        // 传递 signal 给 doAnalyze (需要在 doAnalyze 中支持)
        const result = await doAnalyze(data, signal, forceRefresh);
        
        if (signal.aborted) throw new Error("Aborted");

        // 分析成功后，写入历史
        if (result && jobId) {
            let score = result.summary ? result.summary.score : result.score;
            const verdict = result.summary ? result.summary.match_level : result.verdict;
            
            // === 修正：写入历史前也应用风险一票否决 (与 scanNext 保持一致) ===
            if (result.risk_assessment) {
                 const riskLevel = result.risk_assessment.level || "SAFE";
                 if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
                     score = 0;
                 } else if (riskLevel === "MEDIUM") {
                     score = Math.floor(score * 0.8);
                 }
            }
            
            // 使用 saveAnalysis 保存详情
            HistoryManager.saveAnalysis(jobId, data, result);
        }
        
        // document.getElementById('btn-auto-greet').style.display = 'inline-block';
        document.getElementById('btn-ignore').style.display = 'inline-block';

        // 正常结束，重置按钮
        currentAnalysisController = null;
        btn.innerText = "⚡ 重新分析";
        btn.style.background = "";
        btn.style.zIndex = "";
        
        // === 绑定强制刷新事件 ===
        btn.onclick = () => manualAnalyze(true);
        
        return;

    } catch(e) {
        if (e.message === "Aborted" || (currentAnalysisController && currentAnalysisController.signal.aborted)) {
            console.log("⚠️ 分析流程被中断");
            // UI 已在 abort 触发时重置，这里无需多做
        } else {
            console.error(e);
            // 发生错误时也要重置
            currentAnalysisController = null;
            if(btn.innerText.includes("停止")) {
                btn.innerText = "⚡ 重新分析"; // 失败后通常需要重试
            }
            btn.style.background = "";
            btn.style.zIndex = "";
            btn.disabled = false;
        }
    }
}

// === AI 分析动效 (Quantum Bridge Version - Pro Design) ===
function showAnalyzingOverlay() {
    const visualContainer = document.getElementById('radar-chart-visual');
    if (!visualContainer) {
        console.error("❌ [BossDebug] radar-chart-visual NOT FOUND");
        alert("错误：分析面板组件丢失，请刷新页面重试。");
        return;
    }
    
    // 强制显示父级 (如果被隐藏)
    const sectionRadar = visualContainer.closest('.section-radar');
    if (sectionRadar) {
        sectionRadar.style.display = 'block';
    }

    console.log("⚡ [BossDebug] Showing Analyzing Overlay");
    visualContainer.style.display = 'block'; 
    visualContainer.style.background = 'transparent';
    visualContainer.style.height = '300px';
    
    // Inject Professional Design HTML & CSS
    visualContainer.innerHTML = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@300;600&display=swap');

            .quantum-container {
                position: relative;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at center, #1a1f35 0%, #050a14 100%);
                border-radius: 12px;
                overflow: visible;
                font-family: 'Inter', sans-serif;
                display: flex;
                flex-direction: column;
                color: #fff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1);
            }

            /* Animated Background Grid */
            .grid-bg {
                position: absolute;
                top: 0; left: 0; width: 200%; height: 200%;
                background-image: 
                    linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px);
                background-size: 20px 20px;
                transform: perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px);
                animation: grid-flow 20s linear infinite;
                z-index: 0;
            }
            @keyframes grid-flow {
                0% { transform: perspective(500px) rotateX(60deg) translateY(0) translateZ(-200px); }
                100% { transform: perspective(500px) rotateX(60deg) translateY(20px) translateZ(-200px); }
            }

            /* Main Layout */
            .vis-layout {
                position: relative;
                z-index: 10;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 15px 20px;
                height: 62%;
            }

            /* Nodes (Left & Right) */
            .node {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                width: 60px;
                opacity: 0;
                animation: fade-in 0.5s ease-out forwards;
            }
            .node-left { animation-delay: 0.2s; }
            .node-right { animation-delay: 0.4s; }

            .node-icon {
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(0, 243, 255, 0.3);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 700;
                color: #00f3ff;
                box-shadow: 0 0 15px rgba(0, 243, 255, 0.1);
                position: relative;
            }
            .node-icon::after {
                content: '';
                position: absolute;
                inset: -2px;
                border-radius: 10px;
                border: 1px solid transparent;
                background: linear-gradient(45deg, #00f3ff, transparent) border-box;
                -webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                opacity: 0.5;
            }
            
            .node-label {
                font-size: 9px;
                color: rgba(255,255,255,0.6);
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* Central Core - Organic Brain */
            .core-wrapper {
                position: relative;
                width: 100px;
                height: 100px;
                display: flex;
                align-items: center;
                justify-content: center;
                filter: drop-shadow(0 0 15px rgba(112, 0, 255, 0.4));
            }
            .halo-canvas {
                position: absolute;
                top: -10%;
                left: -10%;
                width: 120%;
                height: 120%;
                z-index: 0;
                pointer-events: none;
                filter: drop-shadow(0 0 20px rgba(0, 195, 255, 0.35));
            }
            
            .brain-fluid {
                position: absolute;
                width: 100%; height: 100%;
                background: linear-gradient(45deg, rgba(112, 0, 255, 0.6), rgba(0, 243, 255, 0.6));
                border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
                animation: fluid-morph 6s ease-in-out infinite;
                mix-blend-mode: screen;
                opacity: 0.8;
            }
            .brain-fluid:nth-child(2) {
                width: 90%; height: 90%;
                background: linear-gradient(135deg, rgba(0, 243, 255, 0.8), rgba(112, 0, 255, 0.2));
                animation: fluid-morph 8s ease-in-out infinite reverse;
                filter: blur(5px);
            }
            .brain-fluid:nth-child(3) {
                width: 80%; height: 80%;
                background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 60%);
                animation: synapse-flash 3s infinite;
                mix-blend-mode: overlay;
            }

            @keyframes fluid-morph {
                0%, 100% { border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; transform: rotate(0deg); }
                33% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; transform: rotate(120deg); }
                66% { border-radius: 30% 70% 70% 30% / 50% 60% 30% 60%; transform: rotate(240deg); }
            }
            @keyframes synapse-flash {
                0%, 100% { opacity: 0.2; transform: scale(0.8); }
                50% { opacity: 0.8; transform: scale(1.1); }
            }

            /* Analyzing Text Pulse */
            .analyzing-label {
                position: absolute;
                bottom: -25px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                color: #00f3ff;
                letter-spacing: 2px;
                animation: text-blink 1.5s infinite;
                white-space: nowrap;
            }
            @keyframes text-blink { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; text-shadow: 0 0 10px #00f3ff; } }

            /* Connecting Lines */
            .bridge-line {
                position: absolute;
                top: 50%;
                height: 2px;
                background: rgba(255,255,255,0.05);
                width: 35px;
                overflow: hidden;
            }
            .bridge-left { left: 65px; }
            .bridge-right { right: 65px; }
            
            .data-packet {
                position: absolute;
                top: 0; left: 0;
                width: 15px; height: 100%;
                background: linear-gradient(90deg, transparent, #00f3ff, transparent);
                animation: data-flow 1.5s infinite;
            }
            .bridge-right .data-packet { animation-direction: reverse; }
            
            @keyframes data-flow {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
            }

            /* Terminal Log */
            .terminal-box {
                height: 80px;
                overflow: auto;
                background: rgba(0,0,0,0.3);
                border-top: 1px solid rgba(255,255,255,0.1);
                padding: 8px 15px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 10px;
                color: rgba(255,255,255,0.6);
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                backdrop-filter: blur(5px);
            }
            
            .term-line {
                margin-bottom: 4px;
                display: flex;
                align-items: center;
                gap: 6px;
                opacity: 0;
                animation: slide-up 0.3s forwards;
            }
            .term-badge {
                padding: 1px 4px;
                border-radius: 2px;
                font-size: 8px;
                font-weight: 700;
                background: rgba(255,255,255,0.1);
            }
            .badge-sys { color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.3); }
            .badge-ai { color: #d946ef; border: 1px solid rgba(217, 70, 239, 0.3); }
            .badge-res { color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
            
            @keyframes slide-up {
                from { opacity: 0; transform: translateY(5px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .status-bar {
                position: absolute;
                top: 10px;
                width: 100%;
                text-align: center;
                font-size: 9px;
                color: rgba(0, 243, 255, 0.7);
                letter-spacing: 2px;
                text-transform: uppercase;
                animation: blink 2s infinite;
            }
            @keyframes blink { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
            
            .process-panel {
                position: relative;
                z-index: 12;
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: minmax(110px, 1fr);
                gap: 8px;
                padding: 10px 12px;
                margin: 0 12px 8px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                backdrop-filter: blur(6px);
                overflow-x: auto;
                overflow-y: hidden;
            }
            .process-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 8px;
                border-radius: 6px;
                background: rgba(0,0,0,0.15);
                border: 1px solid rgba(255,255,255,0.08);
                color: rgba(255,255,255,0.7);
                font-size: 10px;
                letter-spacing: 0.5px;
                min-width: 120px;
            }
            .process-item .p-text { white-space: nowrap; }
            .process-item .p-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(0, 243, 255, 0.5);
                box-shadow: 0 0 8px rgba(0, 243, 255, 0.6);
            }
            .process-item.active {
                color: #00f3ff;
                border-color: rgba(0, 243, 255, 0.5);
                box-shadow: inset 0 0 12px rgba(0, 243, 255, 0.12);
            }
            .process-item.active .p-dot {
                animation: pulse-dot 1.2s infinite;
                background: #00f3ff;
            }
            @keyframes pulse-dot {
                0%, 100% { transform: scale(1); box-shadow: 0 0 8px rgba(0, 243, 255, 0.6); }
                50% { transform: scale(1.35); box-shadow: 0 0 18px rgba(0, 243, 255, 1); }
            }
            .process-item.done {
                color: #22c55e;
                border-color: rgba(34, 197, 94, 0.5);
                background: rgba(34, 197, 94, 0.08);
            }
            .process-item.done .p-dot {
                background: #22c55e;
                box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
            }

        </style>
        
        <div class="quantum-container">
            <div class="grid-bg"></div>
            <div class="status-bar">神经引擎已激活</div>

            <div class="vis-layout">
                <!-- Left Node -->
                <div class="node node-left">
                    <div class="node-icon">职位</div>
                    <div class="node-label">职位模型</div>
                </div>

                <!-- Bridge Left -->
                <div class="bridge-line bridge-left">
                    <div class="data-packet" style="animation-delay: 0s;"></div>
                    <div class="data-packet" style="animation-delay: 0.7s;"></div>
                </div>

                <!-- Core -->
                <div class="core-wrapper">
                    <canvas class="halo-canvas" id="haloCanvas"></canvas>
                    <div class="brain-fluid"></div>
                    <div class="brain-fluid"></div>
                    <div class="brain-fluid"></div>
                    <div class="analyzing-label">AI 正在分析</div>
                </div>

                <!-- Bridge Right -->
                <div class="bridge-line bridge-right">
                    <div class="data-packet" style="animation-delay: 0.3s;"></div>
                    <div class="data-packet" style="animation-delay: 1.0s;"></div>
                </div>

                <!-- Right Node -->
                <div class="node node-right">
                    <div class="node-icon">简历</div>
                    <div class="node-label">候选画像</div>
                </div>
            </div>

            <div class="process-panel" id="processPanel">
                <div class="process-item" data-step="0"><span class="p-dot"></span><span class="p-text">正在构建人才画像</span></div>
                <div class="process-item" data-step="1"><span class="p-dot"></span><span class="p-text">优势识别</span></div>
                <div class="process-item" data-step="2"><span class="p-dot"></span><span class="p-text">风险评估</span></div>
                <div class="process-item" data-step="3"><span class="p-dot"></span><span class="p-text">岗位价值分析</span></div>
                <div class="process-item" data-step="4"><span class="p-dot"></span><span class="p-text">SWOT 战略分析</span></div>
                <div class="process-item" data-step="5"><span class="p-dot"></span><span class="p-text">面试策略生成</span></div>
                <div class="process-item" data-step="6"><span class="p-dot"></span><span class="p-text">匹配度计算</span></div>
                <div class="process-item" data-step="7"><span class="p-dot"></span><span class="p-text">报告生成</span></div>
            </div>

            <!-- Terminal -->
            <div class="terminal-box" id="q-terminal">
                <!-- Logs go here -->
            </div>
        </div>
    `;

    // Logic
    const termEl = document.getElementById('q-terminal');
    
    const logs = [
        { type: 'sys', msg: '初始化神经桥...' },
        { type: 'sys', msg: '连接 职位 ↔ 简历 节点...' },
        { type: 'ai', msg: '提取语义特征...' },
        { type: 'ai', msg: '向量化技能集合...' },
        { type: 'ai', msg: '优势识别模块运行中...' },
        { type: 'ai', msg: '风险评估引擎校准...' },
        { type: 'ai', msg: '岗位价值分析构建...' },
        { type: 'ai', msg: 'SWOT 战略分析矩阵生成...' },
        { type: 'ai', msg: '面试策略生成中...' },
        { type: 'ai', msg: '匹配度加权计算...' },
        { type: 'ai', msg: '计算最终权重...' },
        { type: 'sys', msg: '生成报告...' }
    ];
    let logIndex = 0;

    const haloCanvas = visualContainer.querySelector('#haloCanvas');
    const coreWrapper = visualContainer.querySelector('.core-wrapper');
    let haloPulse = 0;
    let haloRafId = 0;
    if (haloCanvas && coreWrapper) {
        const ctx = haloCanvas.getContext('2d');
        const resize = () => {
            const w = haloCanvas.offsetWidth;
            const h = haloCanvas.offsetHeight;
            haloCanvas.width = w;
            haloCanvas.height = h;
        };
        resize();
        const count = 64;
        const particles = [];
        const baseR = Math.min(haloCanvas.width, haloCanvas.height) * 0.35;
        for (let i = 0; i < count; i++) {
            particles.push({
                a: (i / count) * Math.PI * 2,
                r: baseR + (Math.random() * 6 - 3),
                s: 0.012 + Math.random() * 0.015
            });
        }
        const draw = () => {
            const w = haloCanvas.width;
            const h = haloCanvas.height;
            const cx = w / 2;
            const cy = h / 2;
            haloPulse *= 0.92;
            ctx.clearRect(0, 0, w, h);
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) / 2);
            grd.addColorStop(0, `rgba(0,195,255,${0.10 + haloPulse * 0.15})`);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, w, h);
            ctx.lineWidth = 0.6;
            ctx.strokeStyle = `rgba(0,195,255,${0.25 + haloPulse * 0.25})`;
            for (let i = 0; i < count; i++) {
                const p = particles[i];
                p.a += p.s;
                const x = cx + Math.cos(p.a) * p.r;
                const y = cy + Math.sin(p.a) * p.r;
                ctx.beginPath();
                ctx.arc(x, y, 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(217,70,239,${0.6 + Math.sin(p.a * 2) * 0.2})`;
                ctx.fill();
                const j = (i + 1) % count;
                const pj = particles[j];
                const x2 = cx + Math.cos(pj.a) * pj.r;
                const y2 = cy + Math.sin(pj.a) * pj.r;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            haloRafId = requestAnimationFrame(draw);
        };
        haloRafId = requestAnimationFrame(draw);
        visualContainer.dataset.rafId = haloRafId;
    }
    const haloBurst = () => {
        haloPulse = Math.min(1, haloPulse + 0.6);
    };

    const processSteps = [
        '正在构建人才画像',
        '优势识别',
        '风险评估',
        '岗位价值分析',
        'SWOT 战略分析',
        '面试策略生成',
        '匹配度计算',
        '报告生成'
    ];
    let processIndex = 0;
    const processPanel = document.getElementById('processPanel');
    const stepEls = processPanel ? Array.from(processPanel.querySelectorAll('.process-item')) : [];
    const markActive = (i) => {
        stepEls.forEach((el, idx) => {
            el.classList.remove('active','done');
            if (idx < i) el.classList.add('done');
            if (idx === i) el.classList.add('active');
        });
        const statusBarEl = visualContainer.querySelector('.status-bar');
        if (statusBarEl) {
            statusBarEl.innerText = (i >= processSteps.length - 1) ? '正在生成报告...' : '神经引擎已激活';
        }
        const lastStepEl = stepEls[processSteps.length - 1];
        if (lastStepEl) {
            const txt = lastStepEl.querySelector('.p-text');
            if (txt) txt.textContent = (i >= processSteps.length - 1) ? '报告生成…' : '报告生成';
        }
    };
    markActive(0);
    const scrollToStep = (i) => {
        if (!processPanel || !stepEls[i]) return;
        const target = stepEls[i];
        const left = target.offsetLeft - 8;
        processPanel.scrollTo({ left, behavior: 'smooth' });
    };
    const nextDelay = () => 2000 + Math.floor(Math.random() * 1000);
    const advance = () => {
        if (processIndex < processSteps.length - 1) {
            processIndex++;
            markActive(processIndex);
            scrollToStep(processIndex);
            haloBurst();
            const tid = setTimeout(advance, nextDelay());
            visualContainer.dataset.processTimerId = String(tid);
        } else {
            markActive(processSteps.length - 1);
            scrollToStep(processSteps.length - 1);
        }
    };
    const firstTid = setTimeout(advance, nextDelay());
    visualContainer.dataset.processTimerId = String(firstTid);

    const interval = setInterval(() => {
        if (logIndex < logs.length && Math.random() > 0.7) {
            const log = logs[logIndex];
            const badgeText = { sys: '系统', ai: 'AI', res: '结果', warn: '警告' };
            const div = document.createElement('div');
            div.className = 'term-line';
            div.innerHTML = `<span class="term-badge badge-${log.type}">${badgeText[log.type] || log.type.toUpperCase()}</span> <span>${log.msg}</span>`;
            
            if(termEl) {
                termEl.appendChild(div);
                if (termEl.children.length > 3) termEl.removeChild(termEl.firstChild);
            }
            logIndex++;
            haloBurst();
        }
    }, 100);

    visualContainer.dataset.intervalId = interval;
}

function hideAnalyzingOverlay(isError = false, errorMessage = "") {
    const visualContainer = document.getElementById('radar-chart-visual');
    if (visualContainer) {
        if (visualContainer.dataset.intervalId) {
            clearInterval(Number(visualContainer.dataset.intervalId));
        }
        if (visualContainer.dataset.rafId) {
            cancelAnimationFrame(Number(visualContainer.dataset.rafId));
        }
        if (visualContainer.dataset.processId) {
            clearInterval(Number(visualContainer.dataset.processId));
        }
        if (visualContainer.dataset.processTimerId) {
            clearTimeout(Number(visualContainer.dataset.processTimerId));
        }
        
        // 如果是错误状态，显示错误图标，而不是卡在进度条
        if (isError) {
            visualContainer.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    <div style="font-size: 32px; margin-bottom: 10px;">❌</div>
                    <div style="font-size: 12px; color: #ff5252; word-break: break-all; padding: 0 10px;">${errorMessage || "分析中断"}</div>
                </div>
            `;
            // 3秒后隐藏
            setTimeout(() => {
                visualContainer.style.display = 'none';
            }, 3000);
        } else {
            // 成功状态：直接隐藏 (让位于 renderFullReport 的内容)
            visualContainer.style.display = 'none';
        }
    }
}

// === 能量耗尽卡片 ===
function renderEnergyExhaustedCard() {
    const visualContainer = document.getElementById('radar-chart-visual');
    if (!visualContainer) return;
    
    // === 1. 内置温情语录库 ===
    const restQuotes = [
        "“ 枪管热了，该歇歇了。明天再战。”",
        "“ 别刷了，天大的事，睡醒了再说。”",
        "“ 今天的能量用完了，但你的人生没有。”",
        "“ 关掉网页，去吃顿好的。你的胃比面试官更爱你。”",
        "“ 没什么工作值得你透支健康。去睡。”",
        "“ 暂停不是放弃，是为了走更远的路。”",
        "“ 你已经做得很好了，放过今天的自己吧。”",
        "“ 听一句劝：留得青山在，不怕没柴烧。”",
        "“ 这个世界不会因为你休息一晚就崩塌。晚安。”",
        "“ 所有的焦虑，都是因为你想在一个晚上解决一辈子的问题。”",
        "“ 去楼下吹吹风，今晚的月色很美，别浪费。”",
        "“ 电量耗尽是提醒你：你是人，不是永动机。”",
        "“ 合上电脑。你的家人在等你吃饭。”",
        "“ 梦里什么都有，去睡个好觉。”",
        "“ 把烦恼留给明天，把被窝留给现在的自己。”",
        "“ 只有照顾好自己，才有力气去照顾未来。”",
        "“ 别拿别人的尺子量自己，休息是为了更好地校准。”",
        "“ 这一页翻不过去没关系，我们先折个角，睡了。”",
        "“ 无论结果如何，这束微光，永远陪着你。”",
        "“ 好了，听话。下线。”"
    ];

    // 随机抽取一句
    const randomQuote = restQuotes[Math.floor(Math.random() * restQuotes.length)];

    visualContainer.style.display = 'block';
    // 柔和的渐变背景
    visualContainer.style.background = 'linear-gradient(to bottom, #fff, #f8fbfd)';
    visualContainer.style.height = '300px'; 
    visualContainer.innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#333; animation: fadeIn 0.8s ease;">
            
            <!-- 氛围装饰：月亮 (淡入) -->
            <div style="position:absolute; top:20px; right:30px; font-size:40px; opacity:0.1; transform: rotate(-15deg);">🌙</div>

            <!-- 核心图标：热茶 -->
            <div style="font-size: 56px; margin-bottom: 15px; animation: float 6s ease-in-out infinite;">☕</div>
            
            <!-- 标题：温和的提示 -->
            <h3 style="margin: 0 0 15px 0; font-weight: 600; font-size: 16px; color: #546e7a;">
                今日行程暂告一段落
            </h3>
            
            <!-- 语录卡片 -->
            <div style="
                background: #fff;
                border: 1px solid rgba(0,0,0,0.03);
                border-radius: 12px;
                padding: 20px 25px;
                margin-bottom: 25px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
                width: 80%;
                max-width: 280px;
                position: relative;
            ">
                <!-- 装饰引号 -->
                <div style="font-size: 14px; color: #546e7a; line-height: 1.6; font-style: italic; font-family: 'Georgia', serif;">
                    ${randomQuote}
                </div>
            </div>

            <!-- 补给按钮 (弱化焦虑，强调选择) -->
            <button id="btn-refill-energy-card" style="
                background: linear-gradient(135deg, #81d4fa 0%, #29b6f6 100%);
                color: #fff;
                border: none;
                padding: 10px 24px;
                border-radius: 25px;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                box-shadow: 0 4px 12px rgba(41, 182, 246, 0.3);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            ">
                <span>🔌</span> 我还想再看几个 (去补给)
            </button>
        </div>
        <style>
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-6px); }
                100% { transform: translateY(0px); }
            }
        </style>
    `;
    
    // 绑定点击事件，触发弹窗
    setTimeout(() => {
        const btn = document.getElementById('btn-refill-energy-card');
        if (btn) {
            btn.onclick = () => {
                const authorModal = document.getElementById('localAuthorModal');
                if (authorModal) {
                    authorModal.style.display = 'flex';
                    const closeBtn = document.getElementById('closeLocalAuthorModal');
                    if (closeBtn) {
                        closeBtn.onclick = () => { authorModal.style.display = 'none'; };
                    }
                } else {
                    alert("请点击插件图标查看详情");
                }
            };
            
            // 悬停效果
            btn.onmouseenter = () => { 
                btn.style.transform = 'translateY(-2px)'; 
                btn.style.boxShadow = '0 6px 16px rgba(41, 182, 246, 0.4)';
                btn.style.background = 'linear-gradient(135deg, #4fc3f7 0%, #03a9f4 100%)';
            };
            btn.onmouseleave = () => { 
                btn.style.transform = 'translateY(0)'; 
                btn.style.boxShadow = '0 4px 12px rgba(41, 182, 246, 0.3)';
                btn.style.background = 'linear-gradient(135deg, #81d4fa 0%, #29b6f6 100%)';
            };
        }
    }, 100);
}

// === 核心 AI 请求 ===
async function doAnalyze(data, signal = null, forceRefresh = false) {
    try {
        // 如果已经取消，立即返回
        if (signal && signal.aborted) throw new Error("Aborted");

        showAnalyzingOverlay();
        
        document.getElementById('radar-status').innerText = "🤖 AI 运算中...";
        document.getElementById('radar-status').style.color = "#ff9800";
        
        // 增加对 AbortSignal 的检查
        if (signal && signal.aborted) throw new Error("Aborted");

        const res = await chrome.runtime.sendMessage({
            action: "call_deepseek",
            // 明确添加薪资字段，防止因截断或解析问题导致丢失
            jobText: `${data.text.substring(0, 2900)}\n【薪资信息】：${data.salary || "面议"}`, 
            hrName: data.hr,
            bossTitle: data.hrTitle
        });
        
        // 收到结果后，再次检查是否被取消
        if (signal && signal.aborted) throw new Error("Aborted");

        if (res && res.success) {
            hideAnalyzingOverlay(false);
            renderFullReport(data, res.data); // 渲染
            document.getElementById('radar-status').innerText = "✅ 完成";
            document.getElementById('radar-status').style.color = "#00c853";
            return res.data;
        } else {
            const msg = (res && res.error) ? res.error : "未知错误";
            // 只有未取消时才显示错误
            if (!signal || !signal.aborted) {
                // 宽松匹配：只要包含关键字，无论是否有前缀，都显示温情卡片
                if (msg === "ENERGY_EXHAUSTED" || 
                    msg.includes("Free limit") || 
                    msg.includes("Please redeem") || 
                    msg.includes("Invalid Key") || 
                    msg.includes("Rate limit")) {
                    renderEnergyExhaustedCard(); // 显示能量耗尽卡片
                    document.getElementById('radar-status').innerText = "⚡ 能量耗尽";
                    document.getElementById('radar-status').style.color = "#FF8C00";
                } else {
                    hideAnalyzingOverlay(true, msg);
                    document.getElementById('radar-status').innerText = "❌ 失败";
                    document.getElementById('radar-status').style.color = "red";
                }
            }
            return null;
        }
    } catch (e) { 
        // 如果是取消，静默抛出，由调用方处理
        if (e.message === "Aborted" || (signal && signal.aborted)) {
            // 清理 UI (如果还没被调用方清理)
             // 通常 manualAnalyze 会处理，但为了保险：
             // hideAnalyzingOverlay(true, "用户已取消"); // manualAnalyze 已经处理了这个
             throw new Error("Aborted");
        }

        console.error("Analyze Error:", e);
        
        let errorMsg = "❌ 异常";
        let detailedMsg = e.message || "未知异常";

        // 专门处理插件更新导致的连接断开
        if (e.message && e.message.includes("Extension context invalidated")) {
             errorMsg = "❌ 请刷新页面";
             detailedMsg = "插件已更新，请刷新页面";
        } else if (e.message) {
             errorMsg = "❌ " + e.message.substring(0, 8) + "..";
        }
        
        hideAnalyzingOverlay(true, detailedMsg);
        
        document.getElementById('radar-status').innerText = errorMsg;
        document.getElementById('radar-status').style.color = "red";
        document.getElementById('radar-status').title = detailedMsg; // 鼠标悬停看详情
        
        return null; 
    }
}

// === 生成打招呼话术 (不做匹配分析) ===
async function generateGreetingFromJob(data, signal = null) {
    if (signal && signal.aborted) throw new Error("Aborted");

    const res = await chrome.runtime.sendMessage({
        action: "generate_greeting",
        jobText: `${data.text.substring(0, 2900)}\n【薪资信息】：${data.salary || "面议"}`,
        hrName: data.hr,
        bossTitle: data.hrTitle
    });

    if (signal && signal.aborted) throw new Error("Aborted");

    if (res && res.success && res.data) {
        return String(res.data).trim();
    }

    const msg = (res && res.error) ? res.error : "未知错误";
    if (msg === "ENERGY_EXHAUSTED" || msg.includes("Free limit") || msg.includes("Please redeem") || msg.includes("Invalid Key") || msg.includes("Rate limit")) {
        renderEnergyExhaustedCard();
        showToast("⚡ 能量耗尽", 3000);
    } else {
        showToast("生成话术失败: " + msg, 3000);
    }
    return "";
}

// === 场景 B：批量扫描 ===
function toggleScan() {
    if (isAutoApplying) {
        alert("请先停止自动沟通循环，再启动批量巡检");
        return;
    }
    isScanning = !isScanning;
    const btn = document.getElementById('btn-scan');
    const statusTag = document.getElementById('scan-status-tag');
    
    if(isScanning) {
        btn.innerHTML = "🔴 停止"; btn.style.borderColor = "red"; btn.style.color = "red";
        statusTag.style.display = "inline-block";
        statusTag.innerText = `Running (Pause >= ${pauseThreshold})`;
        console.log(`🚀 [BossScan] 开始批量扫描 (暂停阈值: ${pauseThreshold})`);
        jobCards = Array.from(document.querySelectorAll('.job-card-wrapper, .job-card-box'));
        if(jobCards.length===0) { alert('列表为空'); toggleScan(); return; }
        currentJobIndex = -1;
        scanNext();
    } else {
        btn.innerHTML = "🚀 批量巡检(慎用)"; btn.style.borderColor = "#e65100"; btn.style.color = "#e65100";
        statusTag.innerText = "Standby";
        statusTag.style.display = "none";
        isScanning = false;
    }
}

async function scanNext() {
    if(!isScanning) return;

    currentJobIndex++;
    
    // === 自动翻页/滚动逻辑 ===
    if(currentJobIndex >= jobCards.length) { 
        console.log("📄 本页扫描结束，尝试滚动加载...");
        
        // 1. 尝试触发滚动 (Boss直聘是无限滚动)
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
        
        // 2. 等待加载
        await new Promise(r => setTimeout(r, 2000));
        
        // 3. 重新获取列表
        const newCards = Array.from(document.querySelectorAll('.job-card-wrapper, .job-card-box'));
        
        if (newCards.length > jobCards.length) {
            console.log(`✅ 加载新数据: ${jobCards.length} -> ${newCards.length}`);
            jobCards = newCards; // 更新列表
            // currentJobIndex 保持不变，继续往下扫
            scanNext(); 
        } else {
            console.log("⚠️ 无法加载更多，停止扫描");
            toggleScan(); 
            // 移除 alert，改为安静停止
            // alert("本页结束"); 
            
            // 提示一下状态
            const statusTag = document.getElementById('scan-status-tag');
            if(statusTag) statusTag.innerText = "End of list";
        }
        return; 
    }

    const card = jobCards[currentJobIndex];
    let targetTitle = card.querySelector('.job-name')?.innerText?.split('\n')[0] || "职位";
    let targetCompany = card.querySelector('.company-name')?.innerText?.trim() || "";
    
    // 1. 点击动作
    card.scrollIntoView({behavior:'smooth', block:'center'});
    
    // === 插入：智能去重 (Smart Skip) ===
    // 尝试从卡片链接中预取 Job ID
    // 优化：优先找 .job-card-left，如果没有，遍历所有 a 标签找含 job_detail 的
    let link = card.querySelector('.job-card-left');
    if (!link) {
        const as = card.querySelectorAll('a');
        for(const a of as) {
            if(a.href && a.href.includes('job_detail')) {
                link = a;
                break;
            }
        }
    }
    
    // === 强制会话去重 (Session Dedupe) ===
    // 无论 ID 提取是否成功，只要本轮扫描里这个 DOM 元素已经标记过了，就跳过
    if (card.dataset.scanned === "true") {
         console.log(`🚫 [BossDebug] 跳过本轮已扫: ${targetTitle}`);
         scanNext(); return;
    }
    
    const preJobId = link ? getJobId(link.href) : null;
    
    // UI 反馈调试信息，让用户看到正在检查什么 ID
    document.getElementById('radar-status').innerText = `🔍 查重: ${preJobId ? preJobId.substring(0,8)+'...' : '未知ID'}`;
    
    if (preJobId) {
        const history = HistoryManager.get(preJobId);
        if (history) {
            // 策略：只要历史记录里有，无论是已投递(2)还是已分析(1)，都跳过
            // 避免重复消耗 token 和时间
            console.log(`🚫 [BossDebug] 跳过历史记录(st=${history.st}, s=${history.s}): ${targetTitle}`);
            
            // 视觉标记
            card.classList.add('boss-inactive');
            card.setAttribute('data-reason', '👀 已读');
            if ((history.s || 0) >= pauseThreshold) card.classList.add('boss-good');
            if (history.s < 60 && history.st === 1) card.classList.add('boss-bad');
            
            card.style.opacity = "0.5";
            
            // 随机停留 7-12 秒
            const delay = 7000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, delay));
            scanNext();
            return;
        }
    }

    card.click();
    
    // 2. 占位：雷达先显示一个"正在加载"状态，防止显示上一条的错误数据
    updateRadarUI(targetTitle, "加载中...", "...", ""); 
    
    jobCards.forEach(c => c.classList.remove('boss-scanning'));
    card.classList.add('boss-scanning');

    // 3. 等待数据同步 (Wait Sync)
    const newData = applySalaryFallback(await waitForSync(targetTitle, targetCompany), card);
    
    // 4. 🔥 同步完成：立刻用精准数据更新雷达 (修正雷达信息)
    updateRadarUI(newData.detailTitle, newData.company, newData.hr, newData.active, newData.hrTitle);

    const internshipFilter = getInternshipHardSkipReason(newData);
    if (internshipFilter.skip) {
        card.classList.remove('boss-scanning');
        card.classList.add('boss-inactive');
        card.setAttribute('data-reason', internshipFilter.reason);
        card.style.opacity = "0.5";

        const delay = 5000 + Math.random() * 5000;
        await new Promise(r => setTimeout(r, delay));
        scanNext();
        return;
    }
    
    // === 插入：HR 活跃度过滤 (Hard Filter) ===
    // 默认开启，但需要从配置读取
    let shouldFilter = true;
    let filterTitleKeywords = "";
    let filterContentKeywords = "";
    try {
        const config = await new Promise(r => chrome.storage.local.get(['filterActiveHr', 'filterKeywords', 'filterTitleKeywords', 'filterContentKeywords'], r));
        shouldFilter = config.filterActiveHr !== false; // 默认为 true
        // 兼容逻辑：优先使用新字段，没有则回退到旧字段
        filterTitleKeywords = config.filterTitleKeywords || config.filterKeywords || "";
        filterContentKeywords = config.filterContentKeywords || "";
    } catch(e) {}

    // 2. HR 活跃度过滤
    // 如果 HR 活跃度太低（如：半年前、月活跃），直接跳过 AI 分析
    if (shouldFilter && isInactiveHR(newData.active)) {
        // console.log(`💤 跳过不活跃职位: ${targetTitle} (${newData.active})`);
        card.classList.remove('boss-scanning');
        card.classList.add('boss-inactive');
        
        // 显示具体抓到的状态，方便排查
        const reason = newData.active ? `💤 不活跃(${newData.active})` : `💤 状态未知`;
        card.setAttribute('data-reason', reason);
        
        // 随机停留 5-10 秒，模拟人类操作 (原为1-3秒)
        const delay = 5000 + Math.random() * 5000;
        await new Promise(r => setTimeout(r, delay));
        scanNext();
        return;
    }

    // 2. 🚫 关键词过滤 (Keyword Filter) - 分离版
    
    // 2.1 职位名称/公司名过滤
    if (filterTitleKeywords) {
        const keywords = filterTitleKeywords.split('\n').filter(k => k.trim());
        const titleText = (newData.detailTitle + " " + newData.company).toLowerCase();
        
        const hitKw = keywords.find(k => titleText.includes(k.toLowerCase().trim()));
        if (hitKw) {
            // console.log(`🚫 命中标题过滤: ${hitKw} -> ${targetTitle}`);
            card.classList.remove('boss-scanning');
            card.classList.add('boss-inactive');
            card.setAttribute('data-reason', `🚫 标题: ${hitKw}`);
            
            // 随机停留 5-10 秒 (原为1-3秒)
            const delay = 5000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, delay));
            scanNext();
            return;
        }
    }

    // 2.2 职位详情内容过滤
    if (filterContentKeywords) {
        const keywords = filterContentKeywords.split('\n').filter(k => k.trim());
        const contentText = (newData.text || "").toLowerCase(); // 确保有内容
        
        const hitKw = keywords.find(k => contentText.includes(k.toLowerCase().trim()));
        if (hitKw) {
            // console.log(`🚫 命中内容过滤: ${hitKw} -> ${targetTitle}`);
            card.classList.remove('boss-scanning');
            card.classList.add('boss-inactive');
            card.setAttribute('data-reason', `🚫 内容: ${hitKw}`);
            
            // 随机停留 5-10 秒 (原为1-3秒)
            const delay = 5000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, delay));
            scanNext();
            return;
        }
    }

    // 5. 分析 (注意：此时 Report 还是旧的)
    // 6. 分析完成 -> 刷新 Report
    
    // === 插入：二次查重 (Double Check) ===
    // 之前只检查了列表页链接，现在我们进入了详情页，URL 是最准的
    let currentJobId = getJobId(window.location.href);
    
    // 修正：如果详情页 URL 还没更新（Split View 延迟），则回退使用列表页点击时的 ID
    if (!currentJobId && preJobId) {
        console.log("⚠️ [BossDebug] URL未更新，使用预取ID:", preJobId);
        currentJobId = preJobId;
    }

    // 如果之前列表页没获取到 ID，这里再补一次查重
    if (currentJobId && !document.getElementById('radar-status').innerText.includes('历史')) {
         const h = HistoryManager.get(currentJobId);
         
         // 1. 检查已投递
         if (h && h.st === 2) { 
             console.log(`🚫 [BossDebug] 二次查重：已投递`);
             scanNext(); return;
         }
         
         // 2. 检查已分析 (新增补漏)
         if (h && h.st === 1) {
            console.log(`🚫 [BossDebug] 二次查重：已分析(s=${h.s})`);
            // 既然已经点进来了，就顺便标一下状态
            card.classList.add((h.s||0)>=pauseThreshold ? 'boss-good' : 'boss-bad');
             
             // 如果需要显示分数，可以在这里伪造一个报告，但为了效率直接跳过
             // updateRadarUI(...); 
             
             scanNext(); return;
         }
    }

        const result = await doAnalyze(newData);
    
        card.classList.remove('boss-scanning');
        card.dataset.scanned = "true"; // 标记为本轮已扫
        let score = result ? (result.summary ? result.summary.score : result.score) : 0;
        const verdict = result ? (result.summary ? result.summary.match_level : result.verdict) : "";

        // === 插入：风险一票否决逻辑 (与 renderFullReport 保持一致) ===
        if (result && result.risk_assessment) {
            const riskLevel = result.risk_assessment.level || "SAFE";
            if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
                score = 0;
                // console.log("🛡️ [BossScan] 检测到高危风险，强制归零");
            } else if (riskLevel === "MEDIUM") {
                score = Math.floor(score * 0.8); // 中风险扣分 20%
            }
        }

        if (result) card.classList.add((score||0)>=pauseThreshold ? 'boss-good' : 'boss-bad');
        
        // 写入历史
        if (result && currentJobId) {
            // [Fix] 使用 saveAnalysis 保存完整详情，防止"命中索引无详情"的问题
            HistoryManager.saveAnalysis(currentJobId, newData, result);
        }

    // === 核心逻辑变更：高分即停 (Hit & Pause) ===
    if (result && (score || 0) >= pauseThreshold) {
        // 停止扫描 (仅当正在运行扫描时才停止，避免用户手动停止后被意外重启)
        if (isScanning) {
            console.log(`🎯 [BossScan] 命中高分岗位 (${score} >= ${pauseThreshold})，自动暂停...`);
            toggleScan();
        }
        
        // 视觉强调
        card.scrollIntoView({behavior:'smooth', block:'center'});
        card.style.border = "2px solid #00c853";
        // 显示操作按钮
        const btnGreet = document.getElementById('btn-auto-greet');
        const btnIgnore = document.getElementById('btn-ignore');
        if(btnGreet) btnGreet.style.display = 'inline-block';
        if(btnIgnore) btnIgnore.style.display = 'inline-block';
        
        // 提示用户
        const statusEl = document.getElementById('radar-status');
        if(statusEl) {
            statusEl.innerText = `🎯 发现优质岗位(${score}分)！已自动暂停`;
            statusEl.style.color = "#00c853";
        }
        return; // 退出循环
    }

    // === 模拟人类操作延迟（反扒核心）===
    // 强制 10-20秒 随机延迟，不再依赖配置
    const minDelay = 10000;
    const maxDelay = 20000;
    const totalDelay = minDelay + Math.random() * (maxDelay - minDelay);
    
    // UI 倒计时反馈
    const statusTag = document.getElementById('scan-status-tag');
    let timeLeft = Math.floor(totalDelay / 1000);
    
    const timer = setInterval(() => {
        if (!isScanning) clearInterval(timer);
        if (timeLeft > 0) {
            statusTag.innerText = `Wait ${timeLeft}s`;
            timeLeft--;
        } else {
            statusTag.innerText = "Scanning...";
            clearInterval(timer);
        }
    }, 1000);

    await new Promise(r => setTimeout(r, totalDelay));
    scanNext();
}

function toLocalTimeString(ts = Date.now()) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildAutoApplyLogMeta(data = {}, extra = {}) {
    return {
        jobId: extra.jobId || data.jobId || "",
        title: normalizeAutoApplyText(data.detailTitle || data.title || extra.title || ""),
        company: normalizeAutoApplyText(data.company || extra.company || ""),
        salary: normalizeAutoApplyText(data.salary || extra.salary || ""),
        salarySource: normalizeAutoApplyText(data.salarySource || extra.salarySource || ""),
        salaryProbe: normalizeAutoApplyText(data.salaryProbe || extra.salaryProbe || ""),
        description: cleanJobDescriptionText(data.description || data.rawDesc || extra.description || ""),
        descriptionSource: normalizeAutoApplyText(data.descriptionSource || extra.descriptionSource || ""),
        descriptionProbe: normalizeAutoApplyText(data.descriptionProbe || extra.descriptionProbe || ""),
        hr: normalizeAutoApplyText(data.hr || extra.hr || ""),
        hrTitle: normalizeAutoApplyText(data.hrTitle || extra.hrTitle || ""),
        active: normalizeAutoApplyText(data.active || extra.active || ""),
        reason: normalizeAutoApplyText(extra.reason || ""),
        detailUrl: extra.detailUrl || data.detailUrl || "",
        source: extra.source || ""
    };
}

async function getAutoApplyRemoteLogConfig() {
    const res = await new Promise(r => chrome.storage.local.get([AUTO_APPLY_REMOTE_LOG_CONFIG_KEY], r));
    const config = res[AUTO_APPLY_REMOTE_LOG_CONFIG_KEY] || {};
    return {
        enabled: Boolean(config.enabled),
        endpoint: normalizeAutoApplyText(config.endpoint || ""),
        token: String(config.token || "")
    };
}

async function setAutoApplyRemoteQueue(items) {
    const queue = Array.isArray(items) ? items.slice(-AUTO_APPLY_REMOTE_LOG_QUEUE_MAX) : [];
    if (!queue.length) {
        await chrome.storage.local.remove([AUTO_APPLY_REMOTE_LOG_QUEUE_KEY]);
        return;
    }
    await chrome.storage.local.set({ [AUTO_APPLY_REMOTE_LOG_QUEUE_KEY]: queue });
}

async function postAutoApplyRemoteLog(entry, config) {
    const resp = await chrome.runtime.sendMessage({
        action: "upload_auto_apply_log",
        endpoint: config.endpoint,
        token: config.token,
        payload: {
            type: "boss_auto_apply_log",
            extension: "glimmer",
            version: chrome.runtime.getManifest().version,
            sentAt: toLocalTimeString(),
            entry
        }
    });

    if (!resp || !resp.success) {
        throw new Error(resp && resp.error ? resp.error : "remote upload failed");
    }
}

function queueAutoApplyRemoteLog(entry) {
    autoApplyRemoteLogQueue = autoApplyRemoteLogQueue
        .catch(() => {})
        .then(async () => {
            let failedBatch = [];
            try {
                const config = await getAutoApplyRemoteLogConfig();
                if (!config.enabled || !config.endpoint) return;

                const res = await new Promise(r => chrome.storage.local.get([AUTO_APPLY_REMOTE_LOG_QUEUE_KEY], r));
                const pending = Array.isArray(res[AUTO_APPLY_REMOTE_LOG_QUEUE_KEY]) ? res[AUTO_APPLY_REMOTE_LOG_QUEUE_KEY] : [];
                const batch = entry ? [...pending, entry] : pending;
                if (!batch.length) return;

                let unsent = [];
                for (let i = 0; i < batch.length; i++) {
                    try {
                        await postAutoApplyRemoteLog(batch[i], config);
                    } catch (err) {
                        unsent = batch.slice(i);
                        failedBatch = unsent;
                        throw err;
                    }
                }

                await setAutoApplyRemoteQueue(unsent);
                console.log(`[BossAutoApplyRemoteLog] 已上传 ${batch.length} 条日志`);
            } catch (e) {
                if (failedBatch.length) {
                    await setAutoApplyRemoteQueue(failedBatch);
                } else if (entry) {
                    const res = await new Promise(r => chrome.storage.local.get([AUTO_APPLY_REMOTE_LOG_QUEUE_KEY], r));
                    const pending = Array.isArray(res[AUTO_APPLY_REMOTE_LOG_QUEUE_KEY]) ? res[AUTO_APPLY_REMOTE_LOG_QUEUE_KEY] : [];
                    const exists = pending.some(item => item && item.ts === entry.ts && item.action === entry.action);
                    await setAutoApplyRemoteQueue(exists ? pending : [...pending, entry]);
                }
                console.warn("⚠️ [BossAutoApplyRemoteLog] 上传失败，已留待补发:", e);
            }
        });

    return autoApplyRemoteLogQueue;
}

async function appendAutoApplyLog(action, data = {}, extra = {}) {
    const ts = Date.now();
    const entry = {
        ts,
        time: toLocalTimeString(ts),
        action,
        ...buildAutoApplyLogMeta(data, extra)
    };

    autoApplyLogWriteQueue = autoApplyLogWriteQueue
        .catch(() => {})
        .then(async () => {
            try {
                const res = await new Promise(r => chrome.storage.local.get([AUTO_APPLY_LOG_KEY], r));
                const list = Array.isArray(res[AUTO_APPLY_LOG_KEY]) ? res[AUTO_APPLY_LOG_KEY] : [];
                list.push(entry);
                const trimmed = list.slice(-AUTO_APPLY_LOG_MAX);
                await chrome.storage.local.set({ [AUTO_APPLY_LOG_KEY]: trimmed });
                console.log(`[BossAutoApplyLog] ${entry.time} ${action}: ${entry.title} | ${entry.company} | ${entry.salary || "薪资未知"} | ${entry.reason}`);
            } catch (e) {
                console.warn("⚠️ [BossAutoApplyLog] 写入失败:", e);
            }
        });

    await autoApplyLogWriteQueue;

    queueAutoApplyRemoteLog(entry);

    return entry;
}

function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function buildAutoApplyBriefRows(logs) {
    return logs
        .filter(item => item && item.action === "checked")
        .sort((a, b) => (a.ts || 0) - (b.ts || 0))
        .map(item => ({
            time: item.time || "",
            company: item.company || "",
            action: item.action || "",
            title: item.title || "",
            salary: item.salary || "",
            description: item.description || "",
            hr: item.hr || "",
            hrTitle: item.hrTitle || "",
            active: item.active || "",
            reason: item.reason || "",
            jobId: item.jobId || "",
            detailUrl: item.detailUrl || "",
            source: item.source || ""
        }));
}

function buildAutoApplyLogCsv(logs) {
    const headers = [
        "time",
        "action",
        "title",
        "salary",
        "salarySource",
        "salaryProbe",
        "description",
        "descriptionSource",
        "descriptionProbe",
        "company",
        "hr",
        "hrTitle",
        "active",
        "reason",
        "jobId",
        "detailUrl",
        "source"
    ];
    const rows = logs.map(item => headers.map(key => csvEscape(item[key])).join(","));
    return [headers.join(","), ...rows].join("\n");
}

function buildAutoApplyBriefCsv(logs) {
    const headers = [
        "time",
        "company",
        "action",
        "title",
        "salary",
        "description",
        "hr",
        "hrTitle",
        "active",
        "reason",
        "jobId",
        "detailUrl",
        "source"
    ];
    const rows = buildAutoApplyBriefRows(logs).map(item => headers.map(key => csvEscape(item[key])).join(","));
    return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(csv, filename) {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function getExportTimestamp() {
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
}

async function getAutoApplyLogsForExport() {
    await autoApplyLogWriteQueue.catch(() => {});
    const res = await new Promise(r => chrome.storage.local.get([AUTO_APPLY_LOG_KEY], r));
    return Array.isArray(res[AUTO_APPLY_LOG_KEY]) ? res[AUTO_APPLY_LOG_KEY] : [];
}

async function exportAutoApplyLog() {
    try {
        const logs = await getAutoApplyLogsForExport();
        if (!logs.length) {
            showToast("暂无自动沟通日志可导出");
            return;
        }

        const csv = buildAutoApplyLogCsv(logs);
        downloadCsv(csv, `boss-auto-apply-log-${getExportTimestamp()}.csv`);
        showToast(`已导出 ${logs.length} 条明细日志`);
    } catch (e) {
        console.error("❌ [BossAutoApplyLog] 导出失败:", e);
        showToast("导出日志失败");
    }
}

async function exportAutoApplyBrief() {
    try {
        const logs = await getAutoApplyLogsForExport();
        if (!logs.length) {
            showToast("暂无岗位简报可导出");
            return;
        }

        const briefRows = buildAutoApplyBriefRows(logs);
        const csv = buildAutoApplyBriefCsv(logs);
        downloadCsv(csv, `boss-auto-apply-brief-${getExportTimestamp()}.csv`);
        showToast(`已导出 ${briefRows.length} 条扫描简报 (${logs.length} 条事件)`);
    } catch (e) {
        console.error("❌ [BossAutoApplyBrief] 导出失败:", e);
        showToast("导出简报失败");
    }
}

async function configureAutoApplyRemoteLog() {
    try {
        const current = await getAutoApplyRemoteLogConfig();
        const endpoint = prompt(
            "填写云端日志上传 URL。\n例如: http://你的服务器IP:17321/log\n留空并确认 = 关闭云端上传。",
            current.endpoint || ""
        );
        if (endpoint === null) return;

        const cleanEndpoint = endpoint.trim();
        if (!cleanEndpoint) {
            await chrome.storage.local.set({
                [AUTO_APPLY_REMOTE_LOG_CONFIG_KEY]: {
                    enabled: false,
                    endpoint: "",
                    token: ""
                }
            });
            showToast("已关闭云端日志上传");
            return;
        }

        const token = prompt(
            "填写上传 token。\n需要和服务器 BOSS_LOG_TOKEN 一致；留空表示不使用 token。",
            current.token || ""
        );
        if (token === null) return;

        const enabled = confirm(`是否启用云端日志上传？\n\n${cleanEndpoint}`);
        await chrome.storage.local.set({
            [AUTO_APPLY_REMOTE_LOG_CONFIG_KEY]: {
                enabled,
                endpoint: cleanEndpoint,
                token
            }
        });

        if (enabled) {
            queueAutoApplyRemoteLog(null);
            showToast("已启用云端日志上传，正在补发队列");
        } else {
            showToast("已保存云端日志配置，但未启用");
        }
    } catch (e) {
        console.error("❌ [BossAutoApplyRemoteLog] 配置失败:", e);
        showToast("云端日志配置失败");
    }
}

async function clearAutoApplyLog() {
    await chrome.storage.local.remove([AUTO_APPLY_LOG_KEY]);
    showToast("自动沟通日志已清空");
}

// === 场景 C：自动沟通循环 ===
function collectAutoApplyCards() {
    return Array.from(document.querySelectorAll('.job-card-wrapper, .job-card-box'));
}

function getAutoApplyIdleSeconds() {
    if (!autoApplyLastActivityAt) return 0;
    return Math.max(0, Math.floor((Date.now() - autoApplyLastActivityAt) / 1000));
}

function updateAutoApplyStatus(text) {
    const statusTag = document.getElementById('scan-status-tag');
    if (statusTag) {
        statusTag.style.display = "inline-block";
        statusTag.innerText = text;
    }
}

function markAutoApplyActivity(reason) {
    autoApplyLastActivityAt = Date.now();
    autoApplyLoadAttempts = 0;
    if (reason) console.log(`✅ [BossAutoApply] ${reason}`);
}

function getJobListScroller() {
    const selectors = [
        '.job-list-box',
        '.job-list-container',
        '.search-job-result',
        '.job-list',
        '.list-wrap',
        '.job-box'
    ];
    const candidates = selectors
        .map(selector => document.querySelector(selector))
        .filter(Boolean);

    candidates.push(document.scrollingElement || document.documentElement);

    return candidates.find(el => {
        if (!el) return false;
        return el.scrollHeight > el.clientHeight + 80;
    }) || document.scrollingElement || document.documentElement;
}

function scrollAutoApplyListTo(scroller, top) {
    if (!scroller) return;
    try {
        scroller.scrollTo({ top, behavior: 'smooth' });
    } catch (e) {
        scroller.scrollTop = top;
    }

    if (scroller !== document.scrollingElement && scroller !== document.documentElement && scroller !== document.body) {
        window.scrollTo({ top, behavior: 'smooth' });
    }
}

async function waitForAutoApply(ms) {
    return await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(true), ms);
        const signal = autoApplyController && autoApplyController.signal;
        if (!signal) return;

        const onAbort = () => {
            clearTimeout(timer);
            resolve(false);
        };
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        setTimeout(() => signal.removeEventListener('abort', onAbort), ms + 50);
    });
}

async function loadMoreAutoApplyCards() {
    autoApplyLoadAttempts++;
    const beforeCount = autoApplyCards.length;
    const idleSeconds = getAutoApplyIdleSeconds();
    updateAutoApplyStatus(`Loading · idle ${idleSeconds}s`);

    const scroller = getJobListScroller();
    scrollAutoApplyListTo(scroller, scroller.scrollHeight);
    if (await waitForAutoApply(2600) === false) return autoApplyCards;

    let newCards = collectAutoApplyCards();
    if (newCards.length > beforeCount) {
        markAutoApplyActivity(`加载新岗位 ${beforeCount} -> ${newCards.length}`);
        return newCards;
    }

    if (autoApplyRefreshCount < AUTO_APPLY_MAX_REFRESH_ATTEMPTS) {
        autoApplyRefreshCount++;
        updateAutoApplyStatus(`Refresh ${autoApplyRefreshCount}/${AUTO_APPLY_MAX_REFRESH_ATTEMPTS} · idle ${idleSeconds}s`);
        console.log(`🔄 [BossAutoApply] ${idleSeconds}s 无新岗位，轻刷新列表 (${autoApplyRefreshCount}/${AUTO_APPLY_MAX_REFRESH_ATTEMPTS})`);

        scrollAutoApplyListTo(scroller, Math.max(0, scroller.scrollTop - Math.floor(scroller.clientHeight * 0.8)));
        if (await waitForAutoApply(1200) === false) return newCards;
        scrollAutoApplyListTo(scroller, scroller.scrollHeight);
        if (await waitForAutoApply(3800) === false) return newCards;

        newCards = collectAutoApplyCards();
        if (newCards.length > beforeCount) {
            markAutoApplyActivity(`刷新后加载新岗位 ${beforeCount} -> ${newCards.length}`);
        }
    }

    return newCards;
}

function stopAutoApplyLoop(finalStatusText = "") {
    const wasRunning = isAutoApplying;
    isAutoApplying = false;
    if (autoApplyController) {
        autoApplyController.abort();
        autoApplyController = null;
    }
    const btn = document.getElementById('btn-auto-loop');
    if (btn) {
        btn.innerText = "🔁 自动沟通循环";
        btn.style.borderColor = "#00a0a0";
        btn.style.color = "#00796b";
        btn.disabled = false;
    }
    const statusTag = document.getElementById('scan-status-tag');
    if (statusTag) {
        statusTag.innerText = finalStatusText || "Standby";
        statusTag.style.display = finalStatusText ? "inline-block" : "none";
    }
    if (wasRunning) {
        appendAutoApplyLog("loop_stopped", {}, {
            reason: finalStatusText || "manual stop",
            source: "auto_loop"
        });
    }
}

function toggleAutoApplyLoop() {
    if (!isAutoApplyEnabled()) {
        showToast("社招版未启用自动沟通循环");
        return;
    }
    if (isScanning) {
        alert("请先停止批量巡检，再启动自动沟通循环");
        return;
    }
    if (isAutoApplying) {
        stopAutoApplyLoop();
        return;
    }
    isAutoApplying = true;
    autoApplyController = new AbortController();
    autoApplyCards = collectAutoApplyCards();
    if (autoApplyCards.length === 0) {
        alert("列表为空");
        stopAutoApplyLoop();
        return;
    }
    autoApplyLastActivityAt = Date.now();
    autoApplyRefreshCount = 0;
    autoApplyLoadAttempts = 0;

    const btn = document.getElementById('btn-auto-loop');
    if (btn) {
        btn.innerText = "🛑 停止自动沟通";
        btn.style.borderColor = "#e53935";
        btn.style.color = "#e53935";
    }
    const statusTag = document.getElementById('scan-status-tag');
    if (statusTag) {
        statusTag.style.display = "inline-block";
        statusTag.innerText = `Auto Apply (${autoApplyCards.length})`;
    }
    appendAutoApplyLog("loop_started", {}, {
        reason: `cards=${autoApplyCards.length}`,
        source: "auto_loop"
    });

    autoApplyIndex = -1;
    autoApplyNext();
}

function getPreJobIdFromCard(card) {
    let link = card.querySelector('.job-card-left');
    if (!link) {
        const as = card.querySelectorAll('a');
        for (const a of as) {
            if (a.href && a.href.includes('job_detail')) {
                link = a;
                break;
            }
        }
    }
    return link ? getJobId(link.href) : null;
}

function getDetailLinkFromCard(card) {
    let link = card.querySelector('.job-card-left');
    if (!link) {
        const as = card.querySelectorAll('a');
        for (const a of as) {
            if (a.href && a.href.includes('job_detail')) {
                link = a;
                break;
            }
        }
    }
    return link ? link.href : null;
}

function normalizeAutoApplyText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function getSalaryLines(data) {
    const lines = [];
    if (data && data.salary) lines.push(normalizeAutoApplyText(data.salary));

    const text = String((data && data.text) || "");
    text.split('\n').forEach(line => {
        if (/薪资|Salary|待遇/i.test(line)) {
            lines.push(normalizeAutoApplyText(line));
        }
    });

    return lines.filter(Boolean);
}

function hasMonthlyKSalary(data) {
    const salaryLines = getSalaryLines(data);
    return salaryLines.some(line => /\d+(?:\.\d+)?\s*(?:[-~—至]\s*\d+(?:\.\d+)?\s*)?[kKＫｋ](?:\b|\/|·|薪|月|$)/.test(line));
}

function getInternshipHardSkipReason(data) {
    if (!isInternshipHardFilterEnabled()) {
        return { skip: false, reason: "" };
    }

    const titleText = normalizeAutoApplyText([
        data && data.detailTitle,
        data && data.company
    ].filter(Boolean).join(" "));

    const titleHit = AUTO_APPLY_BLOCKED_TITLE_KEYWORDS.find(keyword => {
        const normalizedKeyword = String(keyword).toLowerCase();
        return titleText.toLowerCase().includes(normalizedKeyword);
    });
    if (titleHit) {
        return { skip: true, reason: `🚫 实习过滤: ${titleHit}` };
    }

    if (hasMonthlyKSalary(data)) {
        return { skip: true, reason: "🚫 实习过滤: K薪资" };
    }

    return { skip: false, reason: "" };
}

async function shouldSkipByFilters(data) {
    const internshipFilter = getInternshipHardSkipReason(data);
    if (internshipFilter.skip) return internshipFilter;

    let shouldFilter = true;
    let filterTitleKeywords = "";
    let filterContentKeywords = "";
    try {
        const config = await new Promise(r => chrome.storage.local.get(['filterActiveHr', 'filterKeywords', 'filterTitleKeywords', 'filterContentKeywords'], r));
        shouldFilter = config.filterActiveHr !== false;
        filterTitleKeywords = config.filterTitleKeywords || config.filterKeywords || "";
        filterContentKeywords = config.filterContentKeywords || "";
    } catch (e) {}

    if (shouldFilter && isInactiveHR(data.active)) {
        const reason = data.active ? `💤 不活跃(${data.active})` : `💤 状态未知`;
        return { skip: true, reason };
    }

    if (filterTitleKeywords) {
        const keywords = filterTitleKeywords.split('\n').filter(k => k.trim());
        const titleText = (data.detailTitle + " " + data.company).toLowerCase();
        const hitKw = keywords.find(k => titleText.includes(k.toLowerCase().trim()));
        if (hitKw) return { skip: true, reason: `🚫 标题: ${hitKw}` };
    }

    if (filterContentKeywords) {
        const keywords = filterContentKeywords.split('\n').filter(k => k.trim());
        const contentText = (data.text || "").toLowerCase();
        const hitKw = keywords.find(k => contentText.includes(k.toLowerCase().trim()));
        if (hitKw) return { skip: true, reason: `🚫 内容: ${hitKw}` };
    }

    return { skip: false, reason: "" };
}

function closeChatDialog() {
    const selectors = [
        '.dialog-close',
        '.chat-close',
        '.btn-close',
        '.icon-close',
        '.close',
        '.dialog-header .close',
        '.chat-header .close',
        'button[aria-label="关闭"]',
        'span[aria-label="关闭"]',
        'i[aria-label="关闭"]'
    ];
    const candidates = Array.from(document.querySelectorAll(selectors.join(',')));
    for (const el of candidates) {
        if (el && el.offsetParent !== null) {
            el.click();
            return true;
        }
    }

    const textCandidates = Array.from(document.querySelectorAll('button, a, span, i, div[role="button"]'));
    for (const el of textCandidates) {
        if (!el || el.offsetParent === null) continue;
        const text = (el.innerText || "").trim();
        if (text === "关闭" || text === "返回" || text === "收起" || text === "退出") {
            el.click();
            return true;
        }
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
    return false;
}

function hasJobList() {
    return !!document.querySelector('.job-card-wrapper, .job-card-box');
}

async function tryReturnToList() {
    if (hasJobList()) return true;

    closeChatDialog();
    await new Promise(r => setTimeout(r, 800));
    if (hasJobList()) return true;

    const url = window.location.href;
    if (url.includes('/web/geek/chat') || url.includes('/chat')) {
        history.back();
        await new Promise(r => setTimeout(r, 1500));
    }

    return hasJobList();
}

async function withTimeout(promise, ms, label) {
    let timer;
    try {
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(`Timeout: ${label || 'operation'}`);
                err.code = 'TIMEOUT';
                reject(err);
            }, ms);
        });
        const value = await Promise.race([promise, timeoutPromise]);
        return { ok: true, value };
    } catch (error) {
        return { ok: false, error };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function randomHumanPause(minMs, maxMs, label) {
    const min = Math.max(0, Number(minMs) || 0);
    const max = Math.max(min, Number(maxMs) || min);
    const duration = min + Math.floor(Math.random() * (max - min + 1));
    if (label) console.log(`⏳ [BossAutoApply] ${label}，随机停顿 ${Math.round(duration / 1000)}s`);

    return await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(true), duration);
        const signal = autoApplyController && autoApplyController.signal;
        if (!signal) return;

        const onAbort = () => {
            clearTimeout(timer);
            resolve(false);
        };
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        setTimeout(() => signal.removeEventListener('abort', onAbort), duration + 50);
    });
}

async function autoApplyNext() {
    if (!isAutoApplying) return;
    if (autoApplyController && autoApplyController.signal.aborted) return;

    autoApplyIndex++;

    if (autoApplyIndex >= autoApplyCards.length) {
        console.log(`📄 自动沟通：本页结束，尝试滚动加载... idle=${getAutoApplyIdleSeconds()}s`);
        const newCards = await loadMoreAutoApplyCards();
        if (newCards.length > autoApplyCards.length) {
            console.log(`✅ 自动沟通：加载新数据 ${autoApplyCards.length} -> ${newCards.length}`);
            autoApplyCards = newCards;
            autoApplyIndex--;
            return autoApplyNext();
        }
        if (autoApplyRefreshCount < AUTO_APPLY_MAX_REFRESH_ATTEMPTS) {
            updateAutoApplyStatus(`Idle ${getAutoApplyIdleSeconds()}s · wait refresh`);
            if (await randomHumanPause(12000, 22000, "等待新岗位刷新") === false) return;
            autoApplyIndex--;
            return autoApplyNext();
        }
        console.log(`⚠️ 自动沟通：无更多岗位或刷新无变化，停止。idle=${getAutoApplyIdleSeconds()}s`);
        stopAutoApplyLoop(`End · idle ${getAutoApplyIdleSeconds()}s`);
        return;
    }

    const card = autoApplyCards[autoApplyIndex];
    if (!card || !card.isConnected) return autoApplyNext();
    if (card.dataset.autoApplied === "true") return autoApplyNext();

    const targetTitle = card.querySelector('.job-name')?.innerText?.split('\n')[0] || "职位";
    const targetCompany = card.querySelector('.company-name')?.innerText?.trim() || "";
    const preJobId = getPreJobIdFromCard(card);
    const detailUrl = getDetailLinkFromCard(card);

    if (preJobId) {
        const history = HistoryManager.get(preJobId);
        if (history && (history.st === 2 || history.st === 3)) {
            const cardSalary = getSalaryFromCard(card, targetTitle);
            card.classList.add('boss-inactive');
            card.setAttribute('data-reason', history.st === 2 ? '✅ 已沟通' : '🚫 已忽略');
            card.style.opacity = "0.5";
            markAutoApplyActivity(`跳过历史岗位: ${targetTitle}`);
            appendAutoApplyLog("skipped_history", {}, {
                jobId: preJobId,
                title: targetTitle,
                company: targetCompany,
                salary: cardSalary && cardSalary.value,
                salarySource: cardSalary && cardSalary.source,
                salaryProbe: cardSalary && cardSalary.probe,
                reason: history.st === 2 ? "已沟通" : "已忽略",
                detailUrl,
                source: "auto_loop"
            });
            if (await waitForAutoApply(1200) === false) return;
            return autoApplyNext();
        }
    }

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (await randomHumanPause(4000, 9000, "点开职位前") === false) return;
    card.click();
    updateRadarUI(targetTitle, "加载中...", "...", "");

    autoApplyCards.forEach(c => c.classList.remove('boss-scanning'));
    card.classList.add('boss-scanning');

    const newData = applySalaryFallback(await waitForSync(targetTitle, targetCompany), card);
    updateRadarUI(newData.detailTitle, newData.company, newData.hr, newData.active, newData.hrTitle);
    appendAutoApplyLog("checked", newData, {
        jobId: preJobId,
        detailUrl,
        reason: `index=${autoApplyIndex + 1}/${autoApplyCards.length}`,
        source: "auto_loop"
    });

    const filterRes = await shouldSkipByFilters(newData);
    if (filterRes.skip) {
        card.classList.remove('boss-scanning');
        card.classList.add('boss-inactive');
        card.setAttribute('data-reason', filterRes.reason);
        card.style.opacity = "0.5";
        markAutoApplyActivity(`过滤跳过: ${filterRes.reason} ${targetTitle}`);
        appendAutoApplyLog("skipped_filter", newData, {
            jobId: preJobId,
            reason: filterRes.reason,
            detailUrl,
            source: "auto_loop"
        });
        if (await waitForAutoApply(1500) === false) return;
        return autoApplyNext();
    }

    let currentJobId = getJobId(window.location.href);
    if (!currentJobId && preJobId) currentJobId = preJobId;
    if (currentJobId) {
        const h = HistoryManager.get(currentJobId);
        if (h && (h.st === 2 || h.st === 3)) {
            card.classList.remove('boss-scanning');
            card.classList.add('boss-inactive');
            card.setAttribute('data-reason', h.st === 2 ? '✅ 已沟通' : '🚫 已忽略');
            markAutoApplyActivity(`二次查重跳过: ${targetTitle}`);
            appendAutoApplyLog("skipped_history_after_open", newData, {
                jobId: currentJobId,
                reason: h.st === 2 ? "已沟通" : "已忽略",
                detailUrl,
                source: "auto_loop"
            });
            if (await waitForAutoApply(1200) === false) return;
            return autoApplyNext();
        }
    }

    let greetingText = "";
    try {
        greetingText = await generateGreetingFromJob(newData, autoApplyController.signal);
    } catch (e) {
        if (!isAutoApplying || (e && e.message === "Aborted")) {
            return;
        }
        console.error("❌ [BossAutoApply] 话术生成失败:", e);
        appendAutoApplyLog("greeting_failed", newData, {
            jobId: currentJobId,
            reason: e && e.message ? e.message : "话术生成失败",
            detailUrl,
            source: "auto_loop"
        });
    }

    if (!greetingText) {
        greetingText = "您好，我对该岗位很感兴趣，期待进一步沟通。";
    }

    if (await randomHumanPause(8000, 18000, "发送招呼前") === false) return;
    const sendResult = await withTimeout(
        autoGreet(greetingText, { openInNewTab: true, detailUrl, jobId: currentJobId, jobData: newData }),
        12000,
        "auto_greet"
    );
    if (!sendResult.ok) {
        console.warn("⏱️ [BossAutoApply] 发送超时，跳过该岗位");
        if (currentJobId) {
            HistoryManager.add(currentJobId, 3, 0, "发送超时");
        }
        card.setAttribute('data-reason', '⏱️ 发送超时');
        markAutoApplyActivity(`发送超时: ${targetTitle}`);
        appendAutoApplyLog("timeout", newData, {
            jobId: currentJobId,
            reason: "auto_greet timeout",
            detailUrl,
            source: "auto_loop"
        });
    } else if (sendResult.value === "pending") {
        card.setAttribute('data-reason', '💬 已打开新沟通页');
        markAutoApplyActivity(`已打开沟通页: ${targetTitle}`);
        appendAutoApplyLog("pending_opened", newData, {
            jobId: currentJobId,
            reason: "已打开新沟通页，等待自动填充发送",
            detailUrl,
            source: "auto_loop"
        });
    } else if (sendResult.value && currentJobId) {
        HistoryManager.markGreeted(currentJobId);
        markAutoApplyActivity(`已沟通: ${targetTitle}`);
        appendAutoApplyLog("sent", newData, {
            jobId: currentJobId,
            reason: "当前页发送成功",
            detailUrl,
            source: "auto_loop"
        });
    } else {
        if (currentJobId) {
            HistoryManager.add(currentJobId, 3, 0, "发送失败");
        }
        card.setAttribute('data-reason', '⚠️ 发送失败');
        markAutoApplyActivity(`发送失败: ${targetTitle}`);
        appendAutoApplyLog("failed", newData, {
            jobId: currentJobId,
            reason: "发送失败或未找到输入框",
            detailUrl,
            source: "auto_loop"
        });
    }

    if (await waitForAutoApply(800) === false) return;
    await tryReturnToList();

    card.classList.remove('boss-scanning');
    card.dataset.autoApplied = "true";
    card.classList.add('boss-inactive');
    card.style.opacity = "0.5";

    if (await randomHumanPause(20000, 40000, "处理下一个岗位前") === false) return;
    autoApplyNext();
}

// 辅助函数：判断 HR 是否不活跃
function isInactiveHR(activeText) {
    if (!activeText) return true; // 没写活跃度，默认不活跃
    if (activeText.includes("在线")) return false; // 🔥 修复：在线是最活跃的
    if (activeText.includes("刚刚")) return false;
    if (activeText.includes("今日")) return false;
    if (activeText.includes("3日")) return false; // 3日内活跃还算可以
    if (activeText.includes("本周")) return false; // 本周也还行
    
    // 其他情况：2周、半年前、月活跃、2月前... 统统杀掉
    return true; 
}

// ================= 5. 渲染引擎 =================

function drawRadarChart(data, isCompact = false, themeColor = '#00bebd') {
    if (!data) return '';
    // 如果是紧凑模式（左右分栏），缩小尺寸
    const w = isCompact ? 160 : 280; 
    const h = isCompact ? 160 : 200; 
    const cx = w/2, cy = h/2;
    const r = isCompact ? 50 : 60; // 缩小半径以防溢出
    
    let keys = [
        {k:'skills', l:'技能'},
        {k:'experience', l:'经验'},
        {k:'soft_power', l:'软实力'},
        {k:'culture_fit', l:'文化'},
        {k:'growth', l:'潜力'},
        {k:'salary_value', l:'薪资'}
    ];

    // 自动适配新版五维模型
    if (data.hard_skills !== undefined) {
        keys = [
            {k:'hard_skills', l:'硬技能'},
            {k:'business_fit', l:'业务'},
            {k:'stability', l:'稳定性'},
            {k:'potential', l:'潜力'},
            {k:'cost_performance', l:'性价比'}
        ];
    }
    
    const getPoint = (value, index, total, radius) => {
        const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
        const dist = (value / 100) * radius;
        return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist];
    };

    // Helper to convert hex to rgb for opacity
    const hexToRgb = (hex) => {
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return [(c>>16)&255, (c>>8)&255, c&255].join(',');
        }
        return '0, 190, 189'; // default
    }
    const rgb = hexToRgb(themeColor);

    let circles = "";
    // 背景网格 (20%, 40%, 60%, 80%, 100%)
    [20, 40, 60, 80, 100].forEach(p => {
        let pts = [];
        for(let i=0; i<keys.length; i++) {
            pts.push(getPoint(p, i, keys.length, r).join(','));
        }
        // 80分基准线特殊处理
        if (p === 80) {
             circles += `<polygon points="${pts.join(' ')}" fill="none" stroke="#b0bec5" stroke-width="1" stroke-dasharray="3,3" />`;
        } else {
             circles += `<polygon points="${pts.join(' ')}" fill="none" stroke="#e0f2f1" stroke-width="1" stroke-dasharray="${p===100?'0':'2,2'}" />`;
        }
    });
    
    // 数据多边形
    let dataPts = [];
    keys.forEach((item, i) => {
        let val = parseInt(data[item.k] || 0);
        dataPts.push(getPoint(val, i, keys.length, r).join(','));
    });
    
    // 渐变填充定义
    const defs = `
      <defs>
        <linearGradient id="gradTheme_${isCompact?'c':'f'}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(${rgb}, 0.5);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(${rgb}, 0.1);stop-opacity:1" />
        </linearGradient>
      </defs>
    `;
    
    const poly = `<polygon points="${dataPts.join(' ')}" fill="url(#gradTheme_${isCompact?'c':'f'})" stroke="${themeColor}" stroke-width="2" />`;
    
    // 轴线
    let axes = "";
    keys.forEach((item, i) => {
        const [ex, ey] = getPoint(100, i, keys.length, r);
        axes += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#e0f2f1" stroke-width="1" />`;
    });

    // 标签与数据点
    let labels = "";
    let dots = "";
    keys.forEach((item, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        // 标签位置稍微外移
        const lx = cx + Math.cos(angle) * (r + (isCompact ? 15 : 25));
        const ly = cy + Math.sin(angle) * (r + (isCompact ? 15 : 25));
        
        // 标签对齐优化
        let anchor = 'middle';
        if (Math.abs(lx - cx) > 10) anchor = lx > cx ? 'start' : 'end';
        
        // 数值显示
        const val = parseInt(data[item.k] || 0);
        
        // 动态颜色：高分高亮
        const isHigh = val >= 80;
        const labelColor = isHigh ? themeColor : '#78909c';
        const labelWeight = isHigh ? 'bold' : 'normal';
        
        // 紧凑模式下字体变小
        const fontSize = isCompact ? 10 : 11;
        const showValue = !isCompact; 

        labels += `
            <text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${fontSize}" fill="${labelColor}" font-weight="${labelWeight}">${item.l}</text>
            ${showValue ? `<text x="${lx}" y="${ly+12}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="${themeColor}" font-weight="bold">${val}</text>` : ''}
        `;
        
        const [px, py] = getPoint(val, i, keys.length, r);
        dots += `<circle cx="${px}" cy="${py}" r="${isCompact?2:3}" fill="#fff" stroke="${themeColor}" stroke-width="2"/>`;
    });
    
    return `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="overflow:visible;">
        ${defs}
        ${circles}
        ${axes}
        ${poly}
        ${dots}
        ${labels}
    </svg>`;
}

// ================= 辅助函数：绑定 Smart Opener 事件 =================
function bindSmartOpenerEvents() {
    // 1. Tab 切换逻辑
    const tabs = document.querySelectorAll('.opener-tab');
    tabs.forEach((tab, index) => {
        // 防止重复绑定
        if (tab.dataset.bound) return;
        tab.dataset.bound = "true";

        tab.addEventListener('click', function() {
            // 找到对应的 card 容器
            const card = this.closest('.smart-opener-card');
            if (!card) return;

            // 确定当前点击的是第几个 Tab (相对于该卡片)
            const allTabs = Array.from(card.querySelectorAll('.opener-tab'));
            const myIndex = allTabs.indexOf(this);

            // 切换 Tab 样式
            allTabs.forEach(t => {
                t.classList.remove('active');
                t.style.color = '#666';
                t.style.borderBottom = 'none';
                t.style.background = 'transparent';
            });
            this.classList.add('active');
            this.style.color = '#00bebd';
            this.style.borderBottom = '2px solid #00bebd';
            this.style.background = 'rgba(0,190,189,0.05)';

            // 切换内容显示
            const contents = card.querySelectorAll('.opener-content-item');
            contents.forEach((c, idx) => {
                c.style.display = (idx === myIndex) ? 'block' : 'none';
            });
        });
    });

    // 2. 复制按钮逻辑
    const copyBtns = document.querySelectorAll('.btn-copy-script');
    copyBtns.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = "true";

        btn.addEventListener('click', function() {
            const contentItem = this.closest('.opener-content-item');
            const textDiv = contentItem.querySelector('div:first-child'); // 第一个 div 是内容
            const text = textDiv.innerText;
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.innerHTML;
                this.innerHTML = '✅ 已复制';
                setTimeout(() => {
                    this.innerHTML = originalText;
                }, 2000);
            });
        });
    });

    // 3. 一键发送逻辑
    const sendBtns = document.querySelectorAll('.btn-send-script');
    sendBtns.forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = "true";

        btn.addEventListener('click', function() {
            const contentItem = this.closest('.opener-content-item');
            const textDiv = contentItem.querySelector('div:first-child');
            const text = textDiv.innerText;
            
            // 查找输入框
            const chatInput = document.querySelector(
                'textarea.chat-input, textarea[placeholder*="打招呼"], #chat-input, .dialog-container textarea, .chat-conversation textarea, div[contenteditable="true"], .chat-message-input'
            );
            
            if (chatInput) {
                // 模拟输入
                if (chatInput.tagName === 'DIV' || chatInput.contentEditable === "true") {
                    chatInput.focus();
                    chatInput.click();
                    document.execCommand('insertText', false, text);
                } else {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                    nativeInputValueSetter.call(chatInput, text);
                    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                chatInput.focus();
                
                // 尝试发送
                setTimeout(() => {
                    const sendBtn = document.querySelector('.btn-send, .submit-btn, .btn-sure, button[type="submit"], .chat-op .btn-send');
                    if (sendBtn) {
                        sendBtn.click();
                        showToast("🚀 已发送");
                    } else {
                        showToast("已填入，请手动点击发送");
                    }
                }, 500);
            } else {
                navigator.clipboard.writeText(text);
                showToast("已复制，请去聊天窗口粘贴");
            }
        });
    });
}

// ================= 辅助函数：绑定简历匹配打招呼事件 =================
function bindLlmPolishEvents(jobData) {
    const polishBtn = document.getElementById('btn-llm-polish');
    const saveConfigBtn = document.getElementById('btn-save-llm-config');
    const statusDiv = document.getElementById('llm-status');
    const resumeInput = document.getElementById('llm-resume-input');
    const currentModelEl = document.getElementById('llm-current-model');

    if (!polishBtn) return;

    // 默认配置 (小米 mimo，写死)
    const DEFAULT_ENDPOINT = 'https://token-plan-cn.xiaomimimo.com/v1';
    const DEFAULT_MODEL = 'mimo-v2.5-pro';
    const DEFAULT_KEY = 'tp-czq97wj2vol05hpfipuico337yuvk7tbo8ikslu5yh8vjnlb';

    // 加载配置和简历草稿
    chrome.storage.local.get(['greetingLlmConfig', 'llmResumeDraft'], (data) => {
        const config = data.greetingLlmConfig || {};
        const endpoint = config.endpoint || DEFAULT_ENDPOINT;
        const model = config.model || DEFAULT_MODEL;
        const apiKey = config.apiKey || DEFAULT_KEY;

        document.getElementById('llm-endpoint').value = endpoint;
        document.getElementById('llm-model-name').value = model;
        document.getElementById('llm-api-key').value = apiKey;

        if (currentModelEl) {
            currentModelEl.innerText = `模型: ${model}`;
        }

        if (data.llmResumeDraft && resumeInput) {
            resumeInput.value = data.llmResumeDraft;
        }
    });

    // 保存配置
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
            const endpoint = document.getElementById('llm-endpoint').value.trim();
            const model = document.getElementById('llm-model-name').value.trim();
            const apiKey = document.getElementById('llm-api-key').value.trim();

            chrome.storage.local.set({
                greetingLlmConfig: { endpoint, model, apiKey }
            });
            if (currentModelEl) {
                currentModelEl.innerText = `模型: ${model}`;
            }
            showToast("模型配置已保存");
        });
    }

    // 自动保存简历草稿
    if (resumeInput) {
        resumeInput.addEventListener('input', () => {
            chrome.storage.local.set({ llmResumeDraft: resumeInput.value });
        });
    }

    // 匹配生成按钮 - 提取简历核心 + 匹配 JD → 自动填入打招呼输入框
    polishBtn.addEventListener('click', async () => {
        const resume = resumeInput ? resumeInput.value.trim() : '';
        if (!resume) {
            showToast("请先粘贴你的简历");
            return;
        }

        const currentJobData = jobData || (window.lastGlimmerData ? window.lastGlimmerData.jobData : null);
        if (!currentJobData) {
            showToast("未获取到岗位信息，请先点击职位卡片");
            return;
        }

        polishBtn.disabled = true;
        polishBtn.innerText = "⏳ 生成中...";
        statusDiv.innerText = "AI 正在提取简历核心并匹配 JD...";
        statusDiv.style.color = "#7c4dff";

        try {
            const jobText = currentJobData.text || currentJobData.description || '';
            const hrName = currentJobData.hr || '招聘者';
            const bossTitle = currentJobData.hrTitle || '';

            const res = await chrome.runtime.sendMessage({
                action: "generate_greeting_llm",
                jobText: jobText.substring(0, 2900),
                hrName: hrName,
                bossTitle: bossTitle,
                resume: resume
            });

            if (res && res.success && res.data) {
                const greetingText = res.data;
                // 自动填入打招呼输入框
                const chatInput = document.getElementById('ai-chat-input');
                if (chatInput) {
                    chatInput.value = greetingText;
                    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                    statusDiv.innerText = "已填入打招呼输入框，可直接发送";
                    statusDiv.style.color = "#00c853";
                } else {
                    statusDiv.innerText = "生成完成（未找到打招呼输入框）";
                    statusDiv.style.color = "#ff9800";
                }
            } else {
                const msg = (res && res.error) ? res.error : "未知错误";
                statusDiv.innerText = "生成失败: " + msg;
                statusDiv.style.color = "#f44336";
            }
        } catch (e) {
            statusDiv.innerText = "请求异常: " + e.message;
            statusDiv.style.color = "#f44336";
        } finally {
            polishBtn.disabled = false;
            polishBtn.innerText = "🎯 匹配生成";
        }
    });
}

function renderFullReport(jobData, aiData) {
    // Cache the latest analysis for one-click greeting
    window.lastGlimmerData = { jobData, aiData };
    const autoApplyBtn = document.getElementById('btn-auto-apply');
    if (autoApplyBtn) {
        if (!isAutoApplyEnabled()) {
            autoApplyBtn.style.display = 'none';
            autoApplyBtn.title = "社招版未启用一键招呼";
        } else {
            const score = (aiData && aiData.summary && typeof aiData.summary.score === 'number')
                ? aiData.summary.score
                : (aiData ? aiData.score : 0);
            const hardFilter = getInternshipHardSkipReason(jobData);
            autoApplyBtn.style.display = 'inline-block';
            if (hardFilter.skip) {
                autoApplyBtn.style.background = '#999';
                autoApplyBtn.title = hardFilter.reason;
            } else if (score < 70) {
                autoApplyBtn.style.background = '#999';
                autoApplyBtn.title = `分数 (${score}) 低于 70，需确认`;
            } else {
                autoApplyBtn.style.background = 'linear-gradient(90deg, #00bebd, #00a0a0)';
                autoApplyBtn.title = '';
            }
        }
    }
    document.getElementById('report-content').style.display = 'block';

    // 1. 刷新身份条 (使用精准 jobData)
    updateReportIdentityUI(jobData);

    // === 2. 刷新 AI 内容 (兼容新旧版本数据结构) ===
    const getVal = (path, def) => {
        // 尝试从新结构获取 (path 比如 "summary.score")
        let val = path.split('.').reduce((o, k) => (o || {})[k], aiData);
        if (val !== undefined) return val;
        
        // 尝试旧结构直接获取 (fallback)
        const lastKey = path.split('.').pop(); // "score"
        if (aiData[lastKey] !== undefined) return aiData[lastKey];
        
        return def;
    };

    // 获取风险评估数据
    const risk = aiData.risk_assessment || { level: "SAFE", risk_score: 0, analysis: "未检测到明显风险" };
    
    // === 关键逻辑：风险一票否决 (Fail-safe Downgrade) ===
    let score = getVal('summary.score', 0);
    let riskLevel = risk.level || "SAFE";
    
    // [Safety Net] 如果是职业发展类关键词，强制降级为 MEDIUM，防止误杀
    // 只有当不包含诈骗关键词时才降级
    const riskAnalysis = (risk.analysis || "").toLowerCase() + (JSON.stringify(risk.risk_labels || [])).toLowerCase();
    const careerRiskKeywords = ["不匹配", "浪费", "降级", "大材小用", "overqualified", "mismatch", "薪资"];
    const scamKeywords = ["培训贷", "收费", "刷单", "博彩", "赌", "scam", "fraud", "违法", "骗"];
    
    if ((riskLevel === "CRITICAL" || riskLevel === "HIGH") && careerRiskKeywords.some(kw => riskAnalysis.includes(kw))) {
        if (!scamKeywords.some(kw => riskAnalysis.includes(kw))) {
            console.log("🛡️ [EagleEye] 检测到由于职业不匹配导致的误判 High Risk，自动降级为 Medium");
            riskLevel = "MEDIUM";
        }
    }

    // 如果是高危，强制归零
    if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
        score = 0;
        console.log("🛡️ [EagleEye] 检测到高危风险，强制将分数归零");
    } else if (riskLevel === "MEDIUM") {
        score = Math.floor(score * 0.8); // 中风险扣分 20%
    }

    // === 新增：渲染雷达图 + 战术卡片 (Tactical Dashboard) ===
    const radarData = getVal('radar_values', getVal('radar_chart', null));
    const motive = getVal('hiring_motive', null);
    const connectionBridge = getVal('connection_bridge', null); 
    const transferability = getVal('transferability', null); 
    const jdQuality = getVal('jd_quality', null);
    
    // [Fix] 构建 HTML 字符串而非修改外部 DOM，避免 ID 重复和状态污染
    let radarHtml = '';
    const externalRadar = document.getElementById('radar-chart-visual');
    if (externalRadar) externalRadar.style.display = 'none'; // 确保外部雷达隐藏

    if (radarData) {
        // 1. 情绪定调
        let themeColor = '#00bebd'; 
        let bgFade = '#e0f7fa'; // 默认淡青
        
        if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
            themeColor = '#d32f2f'; bgFade = '#ffebee'; // 红/淡红
        } else if (riskLevel === 'MEDIUM') {
            themeColor = '#f57c00'; bgFade = '#fff3e0'; // 橙/淡橙
        } else if (score >= 85) {
            themeColor = '#2e7d32'; bgFade = '#e8f5e9'; // 绿/淡绿
        } else if (score < 60) {
            themeColor = '#ff5722'; bgFade = '#fbe9e7'; // 橘红
        }

        // 2. 左侧：绘制变色雷达
        const radarSvg = drawRadarChart(radarData, true, themeColor);

        // 3. 右侧：未来罗盘 (Future Compass)
        const future = getVal('future_scope', {
            ai_niche: { type: "Centaur", desc: "人机共生，决策大于执行" },
            chaos_dividend: "利用当前业务的非标准化，建立属于你的行业壁垒",
            endgame_identity: "智能时代的新型项目操盘手"
        });

        // 定义样式逻辑
        let nicheIcon = "🤝";
        let nicheTitle = "人机共生 (Centaur)";
        let bgGradient = "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)"; // 紫色系
        let accentColor = "#7b1fa2";
        let cardTextColor = "#37474f"; // 默认深色字
        let cardTitleColor = "#455a64"; // 默认标题色

        const nicheType = future.ai_niche ? future.ai_niche.type : "Centaur";

        // [Fix] 样式优先级修正：高危风险强制使用深色主题 (Dark Theme Override)
        if (nicheType.includes("Fuel") || riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
            nicheIcon = "⛽";
            nicheTitle = "硅基燃料 (High Risk)";
            
            // 如果是由于风控触发的高危，显示更明确的标题
            if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
                nicheIcon = "⛔";
                nicheTitle = "高危风险 (Critical Risk)";
            }

            // [Fix] 深空主题：深蓝灰渐变
            bgGradient = "linear-gradient(135deg, #263238 0%, #37474f 100%)"; 
            accentColor = "#cfd8dc"; // 浅灰作为强调色
            cardTextColor = "#eceff1"; // 浅色文字
            cardTitleColor = "#b0bec5"; // 浅色标题
        } else if (nicheType.includes("Chaos")) {
            nicheIcon = "👑";
            nicheTitle = "混乱领主 (Dominator)";
            bgGradient = "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)"; // 绿色
            accentColor = "#2e7d32";
        }

        // 4.1 定义幽灵标题逻辑 (Dynamic Ghost Title)
        let ghostTitle = "岗位风险偏离";
        let ghostIcon = "⚠️";
        let ghostColor = "#e57373"; // 默认淡红 (Risk)

        if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
            ghostTitle = "高危风险阻断";
            ghostIcon = "⛔";
            ghostColor = "#ef5350"; 
        } else if (score >= 85) {
            ghostTitle = "S级完美匹配";
            ghostIcon = "🚀";
            ghostColor = "#81c784"; // 淡绿
        } else if (score >= 60) {
            ghostTitle = "能力/需求适配";
            ghostIcon = "⚖️";
            ghostColor = "#90a4ae"; // 淡蓝灰
        }

        // [New] 构建关联点评警告 HTML (Contrast Warning)
        let warningHtml = '';
        if (nicheType.includes("Fuel") && future.contrast_warning) {
            warningHtml = `
            <div style="
                margin: 4px 12px;
                padding: 6px 8px;
                background: rgba(255, 87, 34, 0.08);
                border: 1px solid rgba(255, 87, 34, 0.2);
                border-radius: 4px;
                display: flex;
                align-items: flex-start;
            ">
                <span style="font-size: 12px; margin-right: 6px; line-height: 1.2;">⚠️</span>
                <div style="flex: 1;">
                    <div style="font-size: 9px; font-weight: 700; color: #d84315; margin-bottom: 2px;">
                        关联点评 (Mismatch Warning)
                    </div>
                    <div style="font-size: 9px; color: #bf360c; line-height: 1.3;">
                        ${future.contrast_warning}
                    </div>
                </div>
            </div>
            `;
        }

        // 4. 组装 HTML (包装在一个容器中)
        radarHtml = `
            <div style="display:flex; flex-direction:row; justify-content:space-between; align-items:stretch; min-height:160px; margin-bottom:15px;">
                <!-- 左侧雷达 (带幽灵标题) -->
                <div style="flex: 0 0 200px; display:flex; justify-content:center; align-items:center; position: relative; padding-top: 16px;">
                    <!-- 幽灵标题/角落标签 -->
                    <div style="
                        position: absolute; 
                        top: 0px; 
                        left: 0px; 
                        font-size: 10px; 
                        color: ${ghostColor}; 
                        font-weight: 700; 
                        display: flex; 
                        align-items: center; 
                        opacity: 0.9;
                        pointer-events: none;
                        z-index: 10;
                    ">
                        <span style="margin-right: 3px; font-size: 11px;">${ghostIcon}</span>
                        <span style="letter-spacing: 0.5px;">${ghostTitle}</span>
                    </div>
                    ${radarSvg}
                </div>

                <!-- 右侧：未来罗盘卡 -->
                <div style="
                    flex: 1;
                    margin-left: 12px;
                    background: ${bgGradient};
                    border-left: 4px solid ${accentColor};
                    border-radius: 4px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    position: relative; /* 为了定位彩蛋 */
                    overflow: visible; /* 允许Tooltip溢出 */
                ">
                    <!-- 🔥 新增：顶部标题栏 + 彩蛋 -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px 4px 12px;
                        border-bottom: 1px dashed rgba(0,0,0,0.05);
                        margin-bottom: 4px;
                    ">
                        <div style="font-size: 10px; font-weight: 800; color: ${cardTitleColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                            🔮 未来罗盘 (Future Compass)
                        </div>
                        
                        <!-- 彩蛋：猫咪 -->
                        <div class="soul-tooltip-container" style="cursor: help; opacity: 0.6; transition: opacity 0.2s;">
                            <span style="font-size: 14px;">🐱</span>
                            
                            <!-- 悬停显示的寄语 (纯CSS实现Tooltip) -->
                            <div class="soul-tooltip-text">
                                "莫愁前路无知己。<br>
                                微光，送给旷野里的你。<br>
                                <div style='text-align:right; margin-top:4px; font-size:9px; opacity:0.8;'>一个待业半年的大龄青年 敬上</div>"
                            </div>
                        </div>
                    </div>

                    <!-- 1. AI 生态位 -->
                    <div style="padding: 0 12px 4px 12px;">
                        <div style="font-size: 11px; font-weight: 800; color: ${accentColor}; margin-bottom: 3px; display: flex; align-items: center;">
                            <span style="font-size: 14px; margin-right: 6px;">${nicheIcon}</span>
                            ${nicheTitle}
                        </div>
                        <div style="font-size: 10px; color: ${cardTextColor}; line-height: 1.3;">
                            ${future.ai_niche ? future.ai_niche.desc : "暂无数据"}
                        </div>
                    </div>

                    ${warningHtml}

                    <!-- 2. 混乱红利 -->
                    <div style="padding: 4px 12px; margin-top: 2px;">
                        <div style="font-size: 10px; font-weight: 700; color: ${accentColor}; margin-bottom: 2px;">
                            ⚡ 混乱红利 (Chaos Dividend)
                        </div>
                        <div style="font-size: 10px; color: ${cardTextColor}; line-height: 1.3;">
                            "${future.chaos_dividend || '暂无数据'}"
                        </div>
                    </div>

                    <!-- 3. 终局预言 (Highlight Logic) -->
                    <div style="background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 0 0 4px 4px; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; align-items: baseline;">
                            <span style="font-size: 12px; margin-right: 4px;">🔮</span>
                            <span style="font-size: 9px; color: ${accentColor}; font-weight: bold; margin-right: 4px;">3年后的你：</span>
                        </div>
                        <div style="font-size: 10px; color: ${cardTextColor}; font-weight: 700; line-height: 1.3;">
                            ${(future.endgame_identity || '暂无数据')
                                .replace(/退化/g, '<span style="color:#ff1744; font-size:1.1em; font-weight:900; text-shadow:0 0 5px rgba(255,23,68,0.4);">📉 退化</span>')
                                .replace(/贬值/g, '<span style="color:#ff5252; font-weight:800;">贬值</span>')
                                .replace(/行政/g, '<span style="border-bottom:1px dashed #cfd8dc;">行政</span>')}
                        </div>
                    </div>
                </div>

                <!-- 注入彩蛋的 CSS 样式 (只注入一次) -->
                <style>
                    .soul-tooltip-container:hover { opacity: 1 !important; }
                    .soul-tooltip-text {
                        visibility: hidden;
                        width: 200px;
                        background-color: #37474f;
                        color: #fff;
                        text-align: left;
                        border-radius: 6px;
                        padding: 8px 10px;
                        position: absolute;
                        z-index: 9999;
                        top: 30px; 
                        right: 0;
                        font-size: 10px;
                        line-height: 1.5;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                        opacity: 0;
                        transition: opacity 0.3s;
                        pointer-events: none;
                    }
                    .soul-tooltip-container:hover .soul-tooltip-text {
                        visibility: visible;
                        opacity: 1;
                    }
                </style>
            </div>
        `;
    }

    const reason = getVal('summary.one_line_comment', getVal('reason', ""));
    const keyComments = getVal('summary.key_comments', null); // 新增：关键结论数组
    const matchLevel = getVal('summary.match_level', "B"); // 默认B
    
    const ring = document.getElementById('score-container');
    const label = document.getElementById('res-verdict');
    const sEl = document.getElementById('res-score');
    
    let color = '#f44336'; let text = "不符";
    // 调整评分文案逻辑
    if (score === 0 && (riskLevel === "CRITICAL" || riskLevel === "HIGH")) {
        text = "高危";
        color = '#d32f2f'; // 深红
    } else {
        if(score>=60) { color='#ff9800'; text="尚可"; }
        if(score>=80) { color='#00c853'; text="推荐"; }
    }
    
    // [Fix] 安全更新旧版分数环 (如果存在)
    if (sEl) {
        sEl.innerText = score;
        sEl.style.color = color;
    }
    if (ring) ring.style.borderColor = color;
    if (label) {
        label.style.background = color;
        label.innerText = text;
    }

    // === 5. 渲染 REPORT 分割线 (The Horizon Line) ===
    const dividerHtml = `
    <div id="deep-dive-divider" style="
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 20px 0 15px 0;
        width: 100%;
        position: relative;
        z-index: 1;
    ">
        <div style="flex: 1; height: 1px; background: linear-gradient(to right, transparent, #cfd8dc, #90a4ae);"></div>
        <div style="
            font-size: 11px;
            font-weight: 800;
            color: #546e7a;
            padding: 0 12px;
            letter-spacing: 2px;
            text-transform: uppercase;
            font-family: 'Courier New', Courier, monospace;
            white-space: nowrap;
            opacity: 0.9;
        ">
            DEEP DIVE · 深度透视
        </div>
        <div style="flex: 1; height: 1px; background: linear-gradient(to left, transparent, #cfd8dc, #90a4ae);"></div>
    </div>
    `;


    // 组装最终 HTML
    const container = document.getElementById('report-content');
    if(container) {
        // [Fix] 保留核心区域：身份条、分数栏、对话框
        const identityEl = document.getElementById('ui-report-identity');
        let scoreSection = document.getElementById('report-score-section');
        const chatSection = document.getElementById('report-chat-section');
        
        // [Fix] 显式检测并获取 radarHtml
        const safeRadarHtml = (typeof radarHtml !== 'undefined') ? radarHtml : '';
        
        // [Fix] 这里的 scoreSection 可能会丢失 (如果上次 render 失败)，如果丢失则重新生成
        let scoreSectionHtml = '';
        if (scoreSection) {
            scoreSectionHtml = scoreSection.outerHTML;
        } else {
            // Fallback Generation: 重建分数栏结构 (Card Style)
            scoreSectionHtml = `
                  <div id="report-score-section" style="background:#fff; border:1px solid var(--border-light); border-radius:var(--radius-md); padding:15px; margin-bottom:15px; box-shadow:var(--shadow-sm); position:relative; overflow:hidden;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px dashed rgba(0,0,0,0.05);">
                           <div style="font-size:12px; color:var(--text-secondary); font-weight:800; display:flex; align-items:center; gap:6px;">
                               <span>🎯</span> 核心匹配度 (MATCH SCORE)
                           </div>
                           <div id="res-verdict" style="font-size:11px; padding:3px 10px; border-radius:12px; color:#fff; font-weight:bold; background:${color};">${text}</div>
                      </div>

                      <div style="display:flex; align-items:stretch;">
                          <div style="flex:0 0 200px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px dashed rgba(0,0,0,0.05); padding-right:15px; margin-right:15px;">
                               <div id="score-container" style="width:110px; height:110px; border-radius:50%; border:5px solid ${color}; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#fff; box-shadow:0 6px 15px rgba(0,0,0,0.08); position:relative; cursor:help; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" title="此分数由 AI 基于职位描述（JD）关键词匹配度自动生成，仅供初筛参考。&#10;实际匹配情况请结合 HR 沟通与面试体验判断。">
                                   <div id="res-score" style="font-size:42px; font-weight:800; line-height:1; color:${color}; letter-spacing:-2px;">${score}</div>
                                   <div style="font-size:10px; color:#90a4ae; margin-top:4px; font-weight:500;">AI 预测</div>
                               </div>
                          </div>

                          <div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:8px;">
                               <div id="res-reason" style="font-size:13px; color:var(--text-secondary); line-height:1.6; font-weight:500; text-align:justify;">${reason}</div>
                               
                               <div id="summary-gap-container" style="display:none; margin-top:8px;">
                                   <div style="font-size:11px; color:#ef5350; font-weight:800; margin-bottom:4px; display:flex; align-items:center;">
                                       <span style="margin-right:6px;">💔</span> 风险警示 (Risk)
                                   </div>
                                   <div id="summary-gaps-list" style="display:flex; flex-direction:column; gap:5px;"></div>
                               </div>
                               
                               <div id="summary-hook-container" style="display:none; margin-top:8px;">
                                   <div style="font-size:11px; color:#26a69a; font-weight:800; margin-bottom:4px; display:flex; align-items:center;">
                                       <span style="margin-right:6px;">❤️</span> 核心亮点 (Hook)
                                   </div>
                                   <div id="summary-hooks-list" style="display:flex; flex-direction:column; gap:5px;"></div>
                               </div>
                               
                               <div id="redemption-text" style="display:none; font-size:11px; color:#7e57c2; background:#f3e5f5; padding:8px 12px; border-radius:6px; border-left:3px solid #ab47bc; margin-top:6px; line-height:1.5;"></div>
                          </div>
                      </div>
                  </div>
            `;
        }

        container.innerHTML = `
            ${identityEl ? identityEl.outerHTML : ''}
            ${scoreSectionHtml}
            ${safeRadarHtml}
            ${dividerHtml}
            <!-- 预留给后续 extraHtml 填充的容器 (Pain Box) -->
            <div id="pain-box" style="margin-top: 10px;"></div>
            ${chatSection ? chatSection.outerHTML : ''}
        `;

        // === 填充 Core Audit Desk Content ===
        // 此处逻辑需在 DOM 插入后执行，因为要操作 getElementById
        setTimeout(() => {
            const scoreEl = document.getElementById('res-score');
            const statusBadge = document.getElementById('match-status-badge');
            const conflictList = document.getElementById('audit-conflict-list');
            const truthBox = document.getElementById('truth-audit-box');
            const redemptionBadge = document.getElementById('redemption-badge');

            // 1. Sync Engine (Left)
            const isFatal = score < 40; // [New] 极低分熔断标志

            if (scoreEl) {
                scoreEl.innerText = score;
                // Color Logic
                let scoreColor = '#cfd8dc'; // default
                let ringBg = '#fff'; // default ring background

                if (score >= 80) scoreColor = '#2e7d32'; // Green
                else if (score >= 60) scoreColor = '#ff9800'; // Orange
                else if (score >= 40) scoreColor = '#d32f2f'; // Red (Modified: 30->40)
                else {
                    // Dead Job / Waste Order (<40)
                    scoreColor = '#37474f'; // Dark Gray / Blackish
                    ringBg = '#f5f5f5'; // Gray Background for Circle
                }
                
                scoreEl.style.color = scoreColor;
                
                // Update Container Background (Dead Job Visual)
                const scoreContainer = document.getElementById('score-container');
                if (scoreContainer) {
                    scoreContainer.style.background = ringBg;
                    scoreContainer.style.borderColor = scoreColor; // Update border color to match
                }
                
                // Pulse Animation Color
                const pulse = document.getElementById('sync-pulse');
                if(pulse) pulse.style.background = scoreColor + '20'; // 12% opacity

                // [Fix] 极低分图标注入 (U-turn)
                if (isFatal && scoreContainer) {
                    const scoreLabel = scoreContainer.querySelector('div:last-child'); // "AI 预测"
                    if (scoreLabel) {
                        scoreLabel.innerHTML = '⛔ 劝退';
                        scoreLabel.style.color = '#d32f2f';
                        scoreLabel.style.fontWeight = 'bold';
                    }
                }
            }
            
            // === 1. 左侧标签逻辑修正 (Label Priority Override) ===
            if (statusBadge) {
                // Default fallback
                let mStatus = getVal('summary.match_status', 'AI 分析中...');
                
                // Priority Logic
                if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
                     mStatus = "⛔ 诱饵陷阱";
                     statusBadge.style.background = '#eceff1'; 
                     statusBadge.style.color = '#37474f'; // Dark Gray
                     statusBadge.style.fontWeight = '800';
                } else if (score < 50) {
                     mStatus = "📉 匹配度低";
                     statusBadge.style.background = '#ffebee'; 
                     statusBadge.style.color = '#c62828'; // Red
                } else if (score >= 50 && score < 65) {
                     mStatus = "🔄 跨界磨合";
                     statusBadge.style.background = '#fff3e0'; 
                     statusBadge.style.color = '#ef6c00'; // Orange
                } else {
                     // Score >= 65: Use original status or safe fallback
                     if (mStatus === 'AI 分析中...') mStatus = "🆗 潜力入局";
                     
                     // Original Color Logic for Safe/High Score
                     if (mStatus.includes('精准') || mStatus.includes('契合')) {
                        statusBadge.style.background = '#e8f5e9'; statusBadge.style.color = '#2e7d32';
                     } else if (mStatus.includes('错位') || mStatus.includes('跨界')) {
                        statusBadge.style.background = '#fff3e0'; statusBadge.style.color = '#e65100';
                     } else if (mStatus.includes('降维') || mStatus.includes('碾压')) {
                        statusBadge.style.background = '#e3f2fd'; statusBadge.style.color = '#1565c0';
                     } else {
                        statusBadge.style.background = '#eceff1'; statusBadge.style.color = '#546e7a';
                     }
                }
                
                statusBadge.innerText = mStatus;
            }

            // 3. Truth Scanner (Right) - Structure "Header + Content"
            let isFraud = false; // Shared state for Salary Meltdown

            if (truthBox) {
                const safety = getVal('summary.safety_rating', { level: 'SAFE', label: '真实有效' });
                const level = safety.level || 'SAFE';
                const label = safety.label || '真实有效';
                
                // Define Style
                let sStyle = { border: '#c8e6c9', bg: '#f1f8e9', text: '#2e7d32', icon: '🛡️', warning: '企业资质合规，无明显风险' };
                
                // Fraud Flag for Salary Meltdown
                isFraud = level === 'HIGH' || level === 'DANGER' || level === 'CRITICAL';

                if (level === 'DANGER' || level === 'CRITICAL') {
                    sStyle = { border: '#ffcdd2', bg: '#ffebee', text: '#c62828', icon: '🚨', warning: '触发高危风控规则，建议立即停止' };
                    if (label.includes('培训') || label.includes('贷款')) sStyle.icon = '💸'; 
                    if (label.includes('保险') || label.includes('马甲')) sStyle.icon = '🎭';
                    if (label.includes('皮包') || label.includes('空壳')) sStyle.icon = '🏚️';
                    if (label.includes('刷单') || label.includes('博彩')) sStyle.icon = '🎲';
                } else if (level === 'SUSPICIOUS' || level === 'HIGH') {
                    sStyle = { border: '#ffe0b2', bg: '#fff3e0', text: '#ef6c00', icon: '⚠️', warning: '存在风险特征，建议谨慎甄别' };
                    if (label.includes('外包') || label.includes('驻场')) sStyle.icon = '📦';
                }
                
                // Title Simplification
                let displayTitle = '疑似虚假招聘'; // Default for Danger
                if (level === 'SAFE') {
                     displayTitle = '职位真实有效';
                     sStyle.icon = '🛡️';
                }
                else if (level === 'SUSPICIOUS' || level === 'HIGH') {
                     displayTitle = '存在隐藏风险';
                } else {
                     displayTitle = '疑似虚假招聘'; // Critical/Danger
                     sStyle.icon = '🚨';
                }
                
                // Specific Icon Override based on Label
                if (label.includes('培训') || label.includes('贷款')) sStyle.icon = '💸'; 
                if (label.includes('保险') || label.includes('马甲')) sStyle.icon = '🎭';
                if (label.includes('皮包') || label.includes('空壳')) sStyle.icon = '🏚️';
                if (label.includes('刷单') || label.includes('博彩')) sStyle.icon = '🎲';
                if (label.includes('外包') || label.includes('驻场')) sStyle.icon = '📦';
                
                // Use explicit rationale/warning if available, otherwise default
                let warningText = safety.warning || sStyle.warning;
                
                // Bold Keywords in Warning Text
                const riskKeywords = ['培训贷', '大小周', '外包', '驻场', '套路', '流水线', '刷单', '博彩', '无底薪', '收费'];
                riskKeywords.forEach(kw => {
                    warningText = warningText.replace(new RegExp(kw, 'g'), `<span style="font-weight:800; text-decoration:underline;">${kw}</span>`);
                });

                // === 3. 右侧卡片 HTML 重构 (Fixed Header + Dynamic Conclusion) ===
                const cardHtml = `
                    <div style="background:${sStyle.bg}; border:1px solid ${sStyle.border}; border-radius:6px; height:100%; padding:8px; display:flex; flex-direction:column; justify-content:space-between;">
                        
                        <!-- 顶部小抬头 ：固定显示 --> 
                        <div style="display:flex; align-items:center; gap:4px; border-bottom:1px solid ${sStyle.border}40; padding-bottom:4px; margin-bottom:4px;"> 
                            <span style="font-size:12px;">👁️</span> 
                            <span style="font-size:10px; font-weight:bold; color:${sStyle.text}; opacity:0.8;">真相扫描 (TRUTH SCAN)</span> 
                        </div> 
                
                        <!-- 中间大标题 ：显示具体的 safety.label --> 
                        <div style="text-align:center; margin-bottom:4px; flex:1; display:flex; flex-direction:column; justify-content:center;"> 
                            <div style="font-size:24px; margin-bottom:2px;">${sStyle.icon}</div> 
                            <div style="font-size:12px; font-weight:900; color:${sStyle.text}; line-height:1.2;">${label}</div> 
                        </div> 
                
                        <!-- 底部小字补充 --> 
                        <div style="font-size:9px; color:${sStyle.text}; opacity:0.9; text-align:center; line-height:1.5;"> 
                            ${warningText} 
                        </div> 
                    </div> 
                `;
                
                truthBox.innerHTML = cardHtml;
                
                // Add click event to show details if risky
                if (level !== 'SAFE') {
                    truthBox.onclick = () => {
                        alert(`🛡️ 安全审计报告\n\n风险等级：${level}\n风险标签：${label}\n\n建议：${safety.warning || sStyle.warning}`);
                    };
                    truthBox.style.cursor = 'pointer';
                } else {
                    truthBox.onclick = null;
                    truthBox.style.cursor = 'default';
                }
            }

            // 2. Conflict Audit (Center) - Capsule Energy Bar
            if (conflictList) {
                // [Fix] 极低分熔断模式 (Fatal Mode)
                if (isFatal) {
                    conflictList.innerHTML = `
                    <div style="
                        background: #fff;
                        border: 2px solid #d32f2f;
                        border-top: 6px solid #d32f2f;
                        border-radius: 8px;
                        padding: 10px;
                        height: 100%;
                        display: flex; flex-direction: column; justify-content: center; align-items: center;
                        box-shadow: 0 4px 10px rgba(211, 47, 47, 0.1);
                        box-sizing: border-box;
                    ">
                        <div style="font-size: 24px; margin-bottom: 6px;">⛔</div>
                        <div style="font-size: 14px; font-weight: 800; color: #d32f2f; margin-bottom: 6px;">
                            严重错配 (Mismatch)
                        </div>
                        <div style="font-size: 10px; color: #37474f; text-align: center; line-height: 1.4; padding: 0 4px;">
                            "建议：这不是你需要补短板的时候。<br>
                            这纯粹是<b>投错了方向</b>。<br>
                            <span style="color:#d32f2f; font-weight:700;">你的核心能力在这里不仅无用，反而会因为大材小用而极速贬值。</span>"
                        </div>
                    </div>
                    `;
                } else {
                    const dims = getVal('summary.dimensions', null);
                    conflictList.innerHTML = ''; 

                    // Always show title
                    const titleHtml = `
                        <div style="font-size:10px; color:#90a4ae; font-weight:bold; margin-bottom:8px; text-transform:uppercase;">
                            🛠️ 冲突审计 (Conflict Audit)
                        </div>`;

                    if (dims) {
                        const dimensions = [
                            { label: '技能', data: dims.skills },
                            { label: '经验', data: dims.experience },
                            { label: '薪资', data: dims.salary }
                        ];

                        const rowsHtml = dimensions.map(d => {
                            const dData = d.data || {};
                            let scoreStr = dData.label || '-'; // S/A/B/C/D
                            const val = dData.score || 0;
                            
                            // Dynamic Color Logic (S/A/B/C/D)
                            let color = '#b0bec5'; 
                            if (val >= 90) color = '#4caf50'; // S (Green)
                            else if (val >= 75) color = '#8bc34a'; // A (Light Green)
                            else if (val >= 60) color = '#ffb74d'; // B (Orange)
                            else if (val >= 40) color = '#ff7043'; // C (Deep Orange)
                            else color = '#ff5252'; // D (Red)

                            // Width logic (Minimum 15% for visibility)
                            let width = Math.max(15, val) + '%';
                            
                            // === 2. 薪资条逻辑修正 (Salary Meltdown/Downgrade) ===
                            let barStyle = `background:${color};`;
                            
                            if (d.label === '薪资' || d.label === 'salary') {
                                if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
                                    // 熔断模式：诈骗/高危
                                    color = '#bdbdbd'; // Gray
                                    scoreStr = '⚠️';   // Warning Icon
                                    width = '100%';    // Full width but disabled
                                    // Striped pattern for fake salary
                                    barStyle = `
                                        background: repeating-linear-gradient(
                                            45deg,
                                            #e0e0e0,
                                            #e0e0e0 5px,
                                            #f5f5f5 5px,
                                            #f5f5f5 10px
                                        );
                                    `;
                                } else if (riskLevel === 'MEDIUM') {
                                    // 降级模式：疑似刷KPI
                                    color = '#ff9800'; // Orange
                                    scoreStr = '❓';   // Question Mark
                                    barStyle = `background:${color};`;
                                }
                            }

                            return `
                                <div style="display:flex; align-items:center; margin-bottom:6px; height:16px;" ${isFraud && d.label==='薪资' ? 'title="🚨 虚假高薪诱饵 (Fake Salary Bait)"' : ''}>
                                    <!-- 标签 -->
                                    <div style="width:30px; font-size:11px; color:#546e7a; font-weight:bold;">${d.label}</div>
                                    
                                    <!-- 进度条槽 -->
                                    <div style="flex:1; height:10px; background:#f5f5f5; border-radius:5px; margin:0 8px; overflow:hidden;"> 
                                        <!-- 进度条实体 --> 
                                        <div style="height:100%; width:${width}; border-radius:5px; ${barStyle}"></div> 
                                    </div> 
                                    
                                    <!-- 分数徽章 -->
                                    <div style="width:16px; text-align:right; font-size:11px; font-weight:900; color:${color}; font-family:monospace;"> 
                                        ${scoreStr} 
                                    </div> 
                                </div>
                            `;
                        }).join('');
                        
                        conflictList.innerHTML = titleHtml + rowsHtml;
                    } else {
                        conflictList.innerHTML = titleHtml + `<div style="font-size:10px; color:#999; text-align:center;">暂无维度数据</div>`;
                    }
                }
            }
            
            // 4. Redemption Badge (Removed)
            if (redemptionBadge) {
                 redemptionBadge.style.display = 'none';
            }
        }, 0);
    }
    
    // 问候语/话术
    const greeting = getVal('interview_guide.opening_script', getVal('greeting', ""));
    // 新增：话术逻辑 (Rationale)
    const scriptRationale = getVal('interview_guide.script_rationale', null);

    const chatInput = document.getElementById('ai-chat-input');
    if (chatInput) {
        chatInput.value = greeting;
        // 如果有话术逻辑，显示在输入框上方
        const inputContainer = chatInput.parentElement; // 假设结构
        
        // 移除旧的 rationale (如果有)
        const oldRat = document.getElementById('script-rationale-tip');
        if(oldRat) oldRat.remove();

        if (scriptRationale) {
            const ratDiv = document.createElement('div');
            ratDiv.id = 'script-rationale-tip';
            ratDiv.style.cssText = `
                font-size: 11px;
                color: #e6a23c;
                background: #fdf6ec;
                padding: 6px 8px;
                border-radius: 4px;
                margin-bottom: 6px;
                border-left: 3px solid #e6a23c;
                line-height: 1.4;
            `;
            ratDiv.innerHTML = `<span style="font-weight:bold;">💡 话术策略：</span>${scriptRationale}`;
            
            // 插入到输入框之前
            chatInput.parentNode.insertBefore(ratDiv, chatInput);
        }
    }
    
    // (Legacy tag-based rendering removed in favor of McKinsey Cards)
    // Hide the static container for pros/cons
    const oldListPros = document.getElementById('list-pros');
    if (oldListPros && oldListPros.parentElement && oldListPros.parentElement.parentElement) {
        oldListPros.parentElement.parentElement.style.display = 'none';
    }
    
    // 痛点与押题
    const pains = getVal('interview_guide.pain_points', getVal('pain_points', "无"));
    const strategies = getVal('interview_guide.strategies', []);
    // const focus = getVal('interview_guide.prediction', getVal('interview_focus', "无")); // 移除押题
    
    // 爱好与性格 (新增展示)
    const hobbyInsight = getVal('detailed_analysis.hobbies_insight', null);
    const personalityTag = getVal('detailed_analysis.personality_tag', null);

    // SWOT & 生活匹配 (新增展示)
    const swot = getVal('swot_analysis', null);
    const lifeFit = getVal('life_fit_analysis', null);

    // === 麦肯锡风格排版 (McKinsey Style Layout) ===
    let extraHtml = `<div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">`;

    // 定义通用卡片渲染函数 (McKinsey Style Card)
    const renderCard = (title, icon, content, colorTheme) => {
        return `
        <div style="background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); margin-bottom:12px; border:1px solid ${colorTheme}40;">
            <div style="background:linear-gradient(to right, ${colorTheme}15, #fff); padding:8px 12px; border-bottom:1px solid ${colorTheme}20; display:flex; align-items:center;">
                <span style="font-size:14px; margin-right:6px;">${icon}</span>
                <span style="font-size:11px; font-weight:700; color:${colorTheme}; letter-spacing:0.5px; text-transform:uppercase;">${title}</span>
            </div>
            <div style="padding:12px;">
                ${content}
            </div>
        </div>`;
    };

    // === 新增：核心优势与风险 (Core Strengths & Risks) - 优先展示 ===
    // [Fix] 增加数据获取的鲁棒性，尝试从 multiple paths 获取
    const pros = getVal('detailed_analysis.pros', getVal('pros', getVal('swot_analysis.strengths', [])));
    // 劣势可能在 detailed_analysis.cons, cons, 或者 swot_analysis.weaknesses 中
    const cons = getVal('detailed_analysis.cons', getVal('cons', getVal('swot_analysis.weaknesses', [])));

    console.log("📊 [BossDebug] Pros:", pros);
    console.log("📊 [BossDebug] Cons:", cons);

    if ((pros && pros.length > 0) || (cons && cons.length > 0)) {
        let cardsHtml = '';
        
        if (pros && pros.length > 0) {
            const prosContent = pros.map(p => `<div style="margin-bottom:6px; display:flex; align-items:start; line-height:1.4;"><span style="color:#00c853; margin-right:6px; font-weight:bold; font-size:12px;">✅</span><span style="color:#303133; font-size:11px;">${p}</span></div>`).join('');
            cardsHtml += `
                <div style="flex:1; margin-right:5px;">
                    ${renderCard('Core Strengths (核心优势)', '💎', prosContent, '#00c853')}
                </div>
            `;
        }

        if (cons && cons.length > 0) {
            const consContent = cons.map(p => `<div style="margin-bottom:6px; display:flex; align-items:start; line-height:1.4;"><span style="color:#f44336; margin-right:6px; font-weight:bold; font-size:12px;">❌</span><span style="color:#303133; font-size:11px;">${p}</span></div>`).join('');
            cardsHtml += `
                <div style="flex:1; margin-left:5px;">
                    ${renderCard('Potential Risks (潜在风险)', '💣', consContent, '#f44336')}
                </div>
            `;
        }

        extraHtml += `<div style="display:flex; flex-direction:row; justify-content:space-between; align-items:stretch;">${cardsHtml}</div>`;
    }

    // === 新增：职场基因解码 (Career DNA) & 岗位隐形画像 (Job Persona) - 双子星布局 ===
    const personality = getVal('personality_insight', null);
    const jobInsight = getVal('job_insight', null);
    
    if (personality || jobInsight) {
        let leftCardHtml = '';
        let rightCardHtml = '';
        
        // 1. 左侧：职场基因 (Career DNA)
        if (personality) {
            let dnaContent = '';
            
            // 1.1 职业原型 (Archetype)
            if (personality.archetype) {
                dnaContent += `
                    <div style="margin-bottom: 12px;">
                        <div style="display:flex; align-items:center; margin-bottom: 8px;">
                            <span style="font-size:16px; margin-right:6px;">🧘</span>
                            <span style="font-size:12px; font-weight:800; color:#37474f;">你是谁？</span>
                        </div>
                        <div style="margin-left: 26px; margin-bottom: 8px;">
                            <div style="display:flex; align-items:center; margin-bottom: 4px;">
                                <span style="font-size:14px; margin-right:6px;">🎭</span>
                                <span style="font-size:12px; font-weight:800; color:#3f51b5;">原型：${personality.archetype}</span>
                            </div>
                            ${personality.keywords && personality.keywords.length > 0 ? 
                                `<div style="display:flex; flex-wrap:wrap; gap:4px;">
                                    ${personality.keywords.map(k => `<span style="font-size:10px; color:#3949ab; background:#e8eaf6; padding:2px 6px; border-radius:10px;">${k}</span>`).join('')}
                                </div>` : ''
                            }
                        </div>
                    </div>
                `;
            }
            
            // 1.2 隐藏驱动力 (Hidden Drive)
            if (personality.drive) {
                dnaContent += `
                    <div>
                        <div style="display:flex; align-items:center; margin-bottom: 4px;">
                            <span style="font-size:16px; margin-right:6px;">🔋</span>
                            <span style="font-size:12px; font-weight:800; color:#00796b;">源动力：${personality.drive}</span>
                        </div>
                        <div style="margin-left: 26px; font-size:11px; color:#555; line-height:1.4; font-style:italic;">
                            “通过分析你的职业轨迹，AI 认为你具备这种稀缺的内在驱动力。”
                        </div>
                    </div>
                `;
            }

            if (dnaContent) {
                leftCardHtml = renderCard('Career DNA (职场基因)', '🧬', dnaContent, '#673ab7');
            }
        }

        // 2. 右侧：岗位画像 (Job Persona)
        if (jobInsight) {
            let jobContent = '';
            
            // 2.1 显性画像 (Avatar)
            if (jobInsight.avatar) {
                 jobContent += `
                    <div style="margin-bottom: 12px;">
                        <div style="display:flex; align-items:center; margin-bottom: 4px;">
                            <span style="font-size:16px; margin-right:6px;">👤</span>
                            <span style="font-size:12px; font-weight:800; color:#37474f;">他们在找谁？</span>
                        </div>
                        <div style="margin-left: 26px; font-size:11px; font-weight:bold; color:#263238; margin-bottom:4px;">
                            “${jobInsight.avatar}”
                        </div>
                        ${jobInsight.keywords && jobInsight.keywords.length > 0 ? 
                            `<div style="margin-left: 26px; display:flex; flex-wrap:wrap; gap:4px;">
                                ${jobInsight.keywords.map(k => `<span style="font-size:10px; color:#455a64; background:#eceff1; padding:2px 6px; border-radius:4px; border:1px solid #cfd8dc;">${k}</span>`).join('')}
                            </div>` : ''
                        }
                    </div>
                `;
            }

            // 2.2 痛点与气味 (Pain & Smell)
            if (jobInsight.pain_point || jobInsight.culture_smell) {
                jobContent += `<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">`;
                if (jobInsight.pain_point) {
                    jobContent += `
                        <div style="background:#fff3e0; padding:8px 10px; border-radius:4px; border-left:3px solid #ff9800; display:flex; align-items:start;">
                            <div style="margin-right:8px; font-size:14px; margin-top:1px;">🩸</div>
                            <div>
                                <div style="font-size:11px; font-weight:bold; color:#e65100; margin-bottom:2px;">最大痛点</div>
                                <div style="font-size:11px; color:#ef6c00; line-height:1.4;">${jobInsight.pain_point}</div>
                            </div>
                        </div>
                    `;
                }
                if (jobInsight.culture_smell) {
                    jobContent += `
                        <div style="background:#eceff1; padding:8px 10px; border-radius:4px; border-left:3px solid #607d8b; display:flex; align-items:start;">
                            <div style="margin-right:8px; font-size:14px; margin-top:1px;">🌬️</div>
                            <div>
                                <div style="font-size:11px; font-weight:bold; color:#455a64; margin-bottom:2px;">团队气味</div>
                                <div style="font-size:11px; color:#546e7a; line-height:1.4;">${jobInsight.culture_smell}</div>
                            </div>
                        </div>
                    `;
                }
                jobContent += `</div>`;
            }

            // 2.3 通关密码 (Hidden Keys)
            if (jobInsight.hidden_keys && jobInsight.hidden_keys.length > 0) {
                 jobContent += `
                    <div>
                        <div style="display:flex; align-items:center; margin-bottom: 6px;">
                            <span style="font-size:16px; margin-right:6px;">🔑</span>
                            <span style="font-size:12px; font-weight:800; color:#37474f;">通关密码 (Hidden Key)</span>
                        </div>
                         <div style="margin-left: 26px; background:#f5f5f5; border-radius:4px; padding:8px; border:1px dashed #bdbdbd;">
                            ${jobInsight.hidden_keys.map(k => `<div style="font-size:11px; color:#333; margin-bottom:4px; display:flex; align-items:start; line-height:1.4;"><span style="color:#00c853; margin-right:6px; font-weight:bold;">></span><span style="font-family:monospace; color:#424242;">${k}</span></div>`).join('')}
                        </div>
                    </div>
                `;
            }

            if (jobContent) {
                rightCardHtml = renderCard('Job Persona (隐形画像)', '🕵️', jobContent, '#607d8b');
            }
        }

        // 3. 组装 (垂直堆叠)
        if (leftCardHtml) {
            extraHtml += leftCardHtml;
        }
        if (rightCardHtml) {
            extraHtml += rightCardHtml;
        }
    }

    // 0. 猎头洞察卡片 (Hunter Insight) - 结构化展示
    let innerHtml = '';
    if (motive || connectionBridge || transferability || (keyComments && keyComments.length > 0)) {
        let motiveIcon = "🕵️";
        let motiveColor = "#607d8b";
        // 默认颜色基于动机
        if (motive) {
            if (motive.type && motive.type.includes("填坑")) { motiveIcon = "🕳️"; motiveColor = "#795548"; }
            if (motive.type && motive.type.includes("开荒")) { motiveIcon = "🌱"; motiveColor = "#4caf50"; }
            if (motive.type && motive.type.includes("造火箭")) { motiveIcon = "🚀"; motiveColor = "#e91e63"; }
        }

        // let innerHtml = ''; // Moved outside

        // Part 1: JD DNA (动机与质量)
        if (motive) {
            innerHtml += `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-weight:700; color:#333; font-size:12px; display:flex; align-items:center;">
                        <span style="font-size:16px; margin-right:4px;">${motiveIcon}</span> ${motive.type}
                    </span>
                    <span style="font-size:10px; color:#666; background:#f0f0f0; padding:2px 6px; border-radius:4px;">置信度: ${motive.confidence || 'M'}</span>
                </div>
                <div style="font-size:11px; color:#444; line-height:1.5; margin-bottom:6px;">${motive.analysis}</div>
                ${ jdQuality ? `
                <div style="display:flex; justify-content:flex-end; align-items:center; font-size:10px;">
                    <span style="color:#999; margin-right:4px;">真实度评分:</span>
                    <span style="font-weight:bold; color:${jdQuality.score<60?'#f44336':'#00c853'};">${jdQuality.score}</span>
                </div>
                ` : '' }
            </div>`;
        }

        // Part 2: 核心研判 (Key Comments)
        if (keyComments && keyComments.length > 0) {
            innerHtml += `
            <div style="margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 10px;">
                <div style="font-size:10px; font-weight:700; color:#90a4ae; margin-bottom:6px; letter-spacing:0.5px;">📋 核心研判 (VERDICT)</div>
                ${keyComments.map(c => {
                    const icon = c.includes('✅') ? '✅' : (c.includes('⚠️') ? '⚠️' : (c.includes('❌') ? '❌' : '🔹'));
                    const text = c.replace(/^[✅⚠️❌]/, '').trim();
                    return `<div style="font-size:11px; color:#333; margin-bottom:4px; display:flex; align-items:start; line-height:1.4;">
                        <span style="margin-right:6px; font-size:10px; margin-top:1px;">${icon}</span>
                        <span style="flex:1;">${text}</span>
                    </div>`;
                }).join('')}
            </div>`;
        }

        // Part 3: 错配连接器 (The Bridge) - 高亮展示
        try {
            const bridgeData = transferability || connectionBridge;
            if (bridgeData && typeof bridgeData === 'object') {
                // Normalize data
                const bridgeType = transferability ? "潜力分析" : (bridgeData.type || "能力迁移");
                let bridgeContent = (transferability ? bridgeData.analysis : bridgeData.bridge_point) || "暂无详细分析";
                
                // 处理数组类型的分析内容 (结构化展示)
                let bridgeContentHtml = '';
                if (Array.isArray(bridgeContent)) {
                    bridgeContentHtml = `<div style="display:flex; flex-direction:column; gap:6px;">
                        ${bridgeContent.map(item => `
                            <div style="display:flex; align-items:start; line-height:1.4;">
                                <span style="color:#ab47bc; margin-right:6px; font-weight:bold; font-size:12px; margin-top:1px;">⚡</span>
                                <span style="color:#333;">${item}</span>
                            </div>
                        `).join('')}
                    </div>`;
                } else {
                    // 兼容旧数据 (String)
                    bridgeContentHtml = bridgeContent;
                }

                const difficulty = (transferability ? bridgeData.onboarding_difficulty : bridgeData.learning_cost) || "未知";

                innerHtml += `
                <div>
                    <div style="font-size:10px; font-weight:700; color:#7e57c2; margin-bottom:6px; letter-spacing:0.5px; display:flex; align-items:center;">
                        <span style="margin-right:4px;">🌉</span> 我的能力迁移 (SKILL TRANSFER)
                    </div>
                    <div style="background:#f3e5f5; padding:10px; border-radius:6px; border-left:3px solid #ab47bc; position:relative;">
                        ${ bridgeType ? `<div style="font-size:11px; color:#6a1b9a; font-weight:700; margin-bottom:4px;">${bridgeType}</div>` : '' }
                        <div style="font-size:11px; color:#333; line-height:1.5; margin-bottom:6px;">${bridgeContentHtml}</div>
                        <div style="display:flex; justify-content:flex-end;">
                            <span style="font-size:10px; color:#8e24aa; background:rgba(255,255,255,0.5); padding:2px 6px; border-radius:4px;">
                                我的上手难度: <b>${difficulty}</b>
                            </span>
                        </div>
                    </div>
                </div>`;
            }
        } catch (e) {
            console.error("渲染迁移能力模块失败:", e);
        }

        extraHtml += renderCard('Job Value Analysis (岗位价值分析)', '🦅', innerHtml, motiveColor);
    }





    // 2. SWOT 矩阵卡片 (Strategy)
    if (swot) {
        // 辅助函数：处理列表项，如果是数组则 join，如果是字符串则直接显示
        const fmtList = (list) => Array.isArray(list) ? list.map(i=>`• ${i}`).join('<br>') : (list || '-');
        
        extraHtml += `
        <div style="background:#fff; border-radius:6px; padding:10px; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:1px solid #e1e4e8;">
            <div style="font-size:10px; color:#909399; margin-bottom:6px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">SWOT Analysis (战略分析)</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                <!-- Strengths -->
                <div style="background:#f0f9eb; padding:6px; border-radius:4px; border-left:2px solid #67c23a;">
                    <div style="color:#67c23a; font-weight:bold; font-size:10px; margin-bottom:2px;">S (优势)</div>
                    <div style="font-size:10px; color:#606266; line-height:1.3;">${fmtList(swot.strengths)}</div>
                </div>
                <!-- Weaknesses -->
                <div style="background:#fef0f0; padding:6px; border-radius:4px; border-left:2px solid #f56c6c;">
                    <div style="color:#f56c6c; font-weight:bold; font-size:10px; margin-bottom:2px;">W (劣势)</div>
                    <div style="font-size:10px; color:#606266; line-height:1.3;">${fmtList(swot.weaknesses)}</div>
                </div>
                <!-- Opportunities -->
                <div style="background:#ecf5ff; padding:6px; border-radius:4px; border-left:2px solid #409eff;">
                    <div style="color:#409eff; font-weight:bold; font-size:10px; margin-bottom:2px;">O (机会)</div>
                    <div style="font-size:10px; color:#606266; line-height:1.3;">${fmtList(swot.opportunities)}</div>
                </div>
                <!-- Threats -->
                <div style="background:#fdf6ec; padding:6px; border-radius:4px; border-left:2px solid #e6a23c;">
                    <div style="color:#e6a23c; font-weight:bold; font-size:10px; margin-bottom:2px;">T (威胁)</div>
                    <div style="font-size:10px; color:#606266; line-height:1.3;">${fmtList(swot.threats)}</div>
                </div>
            </div>
        </div>`;
    }

    // 3. 生活适配卡片 (Feasibility)
    if (lifeFit) {
        // 辅助函数：渲染分段式红绿灯
        const renderLifeItem = (label, icon, item) => {
            let status = 'medium';
            let desc = '';
            
            if (typeof item === 'string') {
                desc = item;
                const badKw = ['差', '低', '风险', '难', '远', '压力', '996', '单休'];
                const goodKw = ['好', '高', '优', '稳', '双休', '近', '覆盖'];
                if (badKw.some(k => item.includes(k))) status = 'low';
                else if (goodKw.some(k => item.includes(k))) status = 'high';
            } else {
                status = item.status || 'medium';
                desc = item.desc || '';
            }

            const getStyle = (type) => {
                const isActive = status === type;
                let bg, color, border;
                if (type === 'low') { 
                    bg = isActive ? '#ffebee' : '#f5f5f5'; color = isActive ? '#c62828' : '#bdbdbd'; border = isActive ? '#ef9a9a' : 'transparent';
                } else if (type === 'medium') { 
                    bg = isActive ? '#fff3e0' : '#f5f5f5'; color = isActive ? '#ef6c00' : '#bdbdbd'; border = isActive ? '#ffcc80' : 'transparent';
                } else { 
                    bg = isActive ? '#e8f5e9' : '#f5f5f5'; color = isActive ? '#2e7d32' : '#bdbdbd'; border = isActive ? '#a5d6a7' : 'transparent';
                }
                return `background:${bg}; color:${color}; border:1px solid ${border}; opacity:${isActive?'1':'0.5'}; font-weight:${isActive?'bold':'normal'};`;
            };

            return `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:14px;">${icon}</span>
                        <span style="font-size:12px; color:#303133; font-weight:600;">${label}</span>
                    </div>
                </div>
                <div style="font-size:11px; color:#606266; margin-bottom:6px; line-height:1.4; text-align:left;">${desc}</div>
                <div style="display:flex; gap:4px; height:20px;">
                    <div style="flex:1; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; ${getStyle('low')}">⚠️ 风险</div>
                    <div style="flex:1; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; ${getStyle('medium')}">⚖️ 平衡</div>
                    <div style="flex:1; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; ${getStyle('high')}">✅ 舒适</div>
                </div>
            </div>`;
        };

        let content = '';
        content += renderLifeItem('生活平衡', '⚖️', lifeFit.work_life_balance);
        content += renderLifeItem('财务安全', '💰', lifeFit.financial_security);
        
        if (lifeFit.verdict) {
            content += `
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #ebeef5; font-size:11px; color:#303133; display:flex; gap:4px; align-items:flex-start;">
                <span style="font-weight:bold; min-width:40px; color:#00796b;">💡 判词:</span>
                <span style="line-height:1.4;">${lifeFit.verdict}</span>
            </div>`;
        }
        
        extraHtml += renderCard('Life Fit (生存仪表盘)', '🧘', content, '#009688');
    }

    // 4. 简历逻辑侦查卡片 (Resume Logic Check) - 新增
    const logicCheck = getVal('resume_logic', null);
    if (logicCheck) {
        const renderCheckItem = (label, isOk, desc) => {
            const icon = isOk ? '✅' : '⚠️';
            const color = isOk ? '#67c23a' : '#e6a23c';
            return `
            <div style="margin-bottom:8px; font-size:11px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <div style="color:#606266; font-weight:600;">${label}</div>
                    <div style="color:${color}; font-weight:bold;">${icon} ${isOk ? 'OK' : 'Risk'}</div>
                </div>
                <div style="color:#303133; text-align:left; line-height:1.4;">${desc}</div>
            </div>`;
        };
        
        const hopFreq = logicCheck.job_hopping ? logicCheck.job_hopping.frequency : 'low';
        const hopOk = hopFreq === 'low' || hopFreq === 'medium';

        let content = '';
        content += renderCheckItem('时间线连续性', !logicCheck.timeline_gap?.has_gap, logicCheck.timeline_gap?.desc || '无空窗');
        content += renderCheckItem('年龄/学历匹配', logicCheck.age_edu_match?.is_normal, logicCheck.age_edu_match?.desc || '正常');
        content += renderCheckItem('跳槽稳定性', hopOk, logicCheck.job_hopping?.desc || '稳定');
        
        if (logicCheck.verdict) {
            content += `
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed #ebeef5; font-size:11px; color:#303133; background:#f3e5f5; padding:8px; border-radius:4px;">
                <span style="font-weight:bold; color:#6a1b9a;">🕵️‍♂️ 侦探结论：</span>${logicCheck.verdict}
            </div>`;
        }

        extraHtml += renderCard('Logic Check (简历侦探)', '🕵️', content, '#673ab7');
    }

    // 5. 深度侧写 (Deep Dive: Personality & Hobbies) - 移至最后
    if (hobbyInsight || personalityTag) {
        extraHtml += `
        <div style="background:#fff; border-radius:6px; padding:10px; box-shadow:0 1px 2px rgba(0,0,0,0.05); border:1px solid #e1e4e8; margin-top:10px;">
            <div style="font-size:10px; color:#909399; margin-bottom:6px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">Personality (侧写)</div>
            
            ${hobbyInsight ? `
            <div style="margin-bottom:6px; display:flex; align-items:baseline;">
                <span style="color:#009688; font-weight:bold; font-size:12px; min-width:65px;">🧩 爱好：</span>
                <span style="color:#303133; font-size:12px; line-height:1.5;">${hobbyInsight}</span>
            </div>` : ''}
            
            ${personalityTag ? `
            <div style="display:flex; align-items:baseline;">
                <span style="color:#673ab7; font-weight:bold; font-size:12px; min-width:65px;">🎭 性格：</span>
                <span style="color:#303133; font-size:12px; line-height:1.5;">${personalityTag}</span>
            </div>` : ''}
        </div>`;
    }

    // === 6. 面试实战锦囊 (Interview Tactics: Strengths & Weaknesses) - 包含进攻与防守 ===
    let strengths = getVal('interview_guide.strengths_strategies', []);
    // [Fix] 修复字段名不匹配问题 (Prompt 中定义的是 strategies，代码曾用 weakness_defense)
    let weaknesses = getVal('interview_guide.weakness_defense', getVal('interview_guide.strategies', []));

    // Fallback: 如果新版数据不存在，尝试从 Pros 或 SWOT Strengths 中构建降级策略
    if (!strengths || strengths.length === 0) {
        // 尝试获取 Pros
        const rawPros = getVal('detailed_analysis.pros', []);
        const swotS = getVal('swot_analysis.strengths', []);
        const combined = [...(rawPros || []), ...(swotS || [])];
        
        if (combined && combined.length > 0) {
            // 去重并取前3个
            const uniquePros = [...new Set(combined)].slice(0, 3);
            strengths = uniquePros.map(pro => ({
                strength: pro,
                strategy: "核心竞争力展示 (自动提取)",
                script: "（请结合简历中的具体项目案例，向面试官展示您在 " + pro + " 方面的深厚积累，强调该能力如何解决团队当前的问题。）"
            }));
        }
    }

    // [Fix] Weaknesses Fallback: 如果 Strategies 也不存在，尝试从 Cons 或 SWOT Weaknesses 中构建
    if (!weaknesses || weaknesses.length === 0) {
        const rawCons = getVal('detailed_analysis.cons', []);
        const swotW = getVal('swot_analysis.weaknesses', []);
        const combinedW = [...(rawCons || []), ...(swotW || [])];
        
        if (combinedW && combinedW.length > 0) {
            const uniqueCons = [...new Set(combinedW)].slice(0, 3);
            weaknesses = uniqueCons.map(w => ({
                weakness: w,
                strategy: "真诚转化 (自动生成)",
                script: "虽然我在 " + w + " 方面经验较少，但我具备快速学习能力，且我的核心优势可以弥补这一不足。"
            }));
        }
    }

    if ((strengths && strengths.length > 0) || (weaknesses && weaknesses.length > 0)) {
        let interviewContent = '';

        // 6.1 乘胜追击 (Strengths)
        if (strengths && strengths.length > 0) {
             interviewContent += `
            <div style="margin-bottom: 8px;">
                <div style="font-size:11px; font-weight:bold; color:#2e7d32; margin-bottom:4px; background:#e8f5e9; padding:4px 8px; border-radius:4px; display:inline-block;">
                    🚀 乘胜追击 (发挥长处)
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                    ${strengths.map(s => `
                        <div style="background:#fff; border:1px solid #c8e6c9; border-radius:4px; padding:6px;">
                            <div style="font-size:11px; font-weight:bold; color:#1b5e20;">${s.strength}</div>
                            <div style="font-size:10px; color:#388e3c; margin:2px 0;">Strategy: ${s.strategy}</div>
                            <div style="font-size:10px; color:#555; background:#f1f8e9; padding:4px; border-radius:2px; font-style:italic;">"${s.script}"</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // 6.2 逆风翻盘 (Weaknesses)
        if (weaknesses && weaknesses.length > 0) {
             interviewContent += `
            <div style="margin-top: 8px;">
                <div style="font-size:11px; font-weight:bold; color:#c62828; margin-bottom:4px; background:#ffebee; padding:4px 8px; border-radius:4px; display:inline-block;">
                    🛡️ 逆风翻盘 (防御短板)
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                    ${weaknesses.map(w => `
                        <div style="background:#fff; border:1px solid #ffcdd2; border-radius:4px; padding:6px;">
                            <div style="font-size:11px; font-weight:bold; color:#b71c1c;">${w.weakness}</div>
                            <div style="font-size:10px; color:#d32f2f; margin:2px 0;">Strategy: ${w.strategy}</div>
                            <div style="font-size:10px; color:#555; background:#fff8f8; padding:4px; border-radius:2px; font-style:italic;">"${w.script}"</div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

         extraHtml += renderCard('Interview Tactics (面试锦囊)', '⚔️', interviewContent, '#2e7d32');
    }

    // === 7. 智能开场话术 (Smart Opening Scripts) - 放在最后 ===
    const scripts = getVal('interview_guide.opening_scripts', []) || [];
    
    // 兼容旧数据: 如果没有 array，但有 single greeting string
    if (scripts.length === 0 && greeting && greeting.length > 5) {
        scripts.push({
            style: "🛡️ 稳健防守型",
            content: greeting,
            rationale: scriptRationale || "基于简历与JD匹配度的智能生成"
        });
    }

    // [FIX] 强制补齐 3 个 Tab (稳健/进攻/破冰)，解决 AI 偶尔只返回 2 个的问题
    if (scripts.length > 0 && scripts.length < 3) {
        const templates = [
            {
                keywords: ['稳健', '防守', 'Professional'],
                fallback: {
                    style: "🛡️ 稳健防守型",
                    content: "您好，我对贵司该岗位非常感兴趣。我有相关的项目经验，熟悉核心技术栈，能快速上手业务。期待能有机会与您进一步交流。",
                    rationale: "标准开场，强调匹配度与稳定性 (系统自动补全)"
                }
            },
            {
                keywords: ['痛点', '进攻', '狙击', 'Sniper'],
                fallback: {
                    style: "⚔️ 痛点狙击型",
                    content: "您好，仔细阅读了JD，发现贵司目前可能正面临业务扩张带来的挑战。我曾在类似场景下负责过核心模块的攻坚，希望能为您分担压力。",
                    rationale: "直接切入业务痛点，展示解决问题的能力 (系统自动补全)"
                }
            },
            {
                keywords: ['真诚', '破冰', 'Storyteller'],
                fallback: {
                    style: "🔥 真诚破冰型",
                    content: "您好，虽然我的履历可能不是最完美的100%匹配，但我对这个领域充满热情，并且有很强的快速学习能力。希望能给一个展示潜力的机会。",
                    rationale: "以真诚和潜力打动对方 (系统自动补全)"
                }
            }
        ];

        // 缺哪个补哪个
        templates.forEach(tpl => {
            if (scripts.length >= 3) return;
            const exists = scripts.some(s => tpl.keywords.some(k => s.style.includes(k)));
            if (!exists) {
                scripts.push(tpl.fallback);
            }
        });
    }

    if (scripts && scripts.length > 0) {
        // 构建 Tab 和 Content 的 ID
        const tabContainerId = 'opener-tabs-' + Math.random().toString(36).substr(2, 9);
        const contentContainerId = 'opener-content-' + Math.random().toString(36).substr(2, 9);
        
        let tabsHtml = '';
        let contentsHtml = '';
        
        scripts.forEach((script, idx) => {
            const isActive = idx === 0;
            const safeContent = script.content.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const safeRationale = (script.rationale || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            // 简化 Tab 标题
            let shortTitle = script.style;
            if (shortTitle.includes('稳健')) shortTitle = '🛡️ 稳健';
            else if (shortTitle.includes('痛点') || shortTitle.includes('进攻') || shortTitle.includes('狙击')) shortTitle = '⚔️ 进攻';
            else if (shortTitle.includes('真诚') || shortTitle.includes('破冰')) shortTitle = '🔥 破冰';
            else if (shortTitle.length > 6) shortTitle = shortTitle.substring(0, 6) + '..';

            tabsHtml += `
                <div class="opener-tab ${isActive ? 'active' : ''}" 
                     style="flex:1; text-align:center; padding:8px 4px; cursor:pointer; font-size:11px; font-weight:bold; transition:all 0.2s; 
                            ${isActive ? 'color:#00bebd; border-bottom:2px solid #00bebd; background:rgba(0,190,189,0.05);' : 'color:#666;'}">
                    ${shortTitle}
                </div>
            `;
            
            contentsHtml += `
                <div class="opener-content-item" style="display:${isActive ? 'block' : 'none'}; animation: fadeIn 0.3s;">
                    <div style="font-size:12px; line-height:1.6; color:#333; margin-bottom:12px; white-space: pre-wrap; background:#fff; padding:8px; border:1px solid #f0f0f0; border-radius:4px;">${script.content}</div>
                    
                    ${script.rationale ? `
                    <div style="background:#e0f7fa; padding:8px; border-radius:4px; font-size:11px; color:#006064; display:flex; gap:6px; margin-bottom:10px; align-items:start;">
                        <span style="font-size:12px;">💡</span>
                        <span style="line-height:1.4;"><b>逻辑：</b>${script.rationale}</span>
                    </div>` : ''}
                    
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="btn-copy-script" style="padding:4px 10px; border:1px solid #ddd; background:#fff; border-radius:4px; font-size:10px; cursor:pointer; color:#666;">
                            📋 复制
                        </button>
                        <button class="btn-send-script" style="padding:4px 12px; border:none; background:#00bebd; border-radius:4px; font-size:10px; cursor:pointer; color:#fff; font-weight:bold; box-shadow:0 2px 4px rgba(0,190,189,0.3);">
                            🚀 一键发送
                        </button>
                    </div>
                </div>
            `;
        });
        
        const cardHtml = `
            <div class="smart-opener-card" style="background:#fff;">
                <!-- 顶部 Tab -->
                <div style="display:flex; border-bottom:1px solid #eee; margin-bottom:12px;">
                    ${tabsHtml}
                </div>
                <!-- 内容区 -->
                <div>
                    ${contentsHtml}
                </div>
            </div>
        `;
        
        extraHtml += renderCard('Smart Opener (开场三板斧)', '🗝️', cardHtml, '#009688');
    }

    // === 8. AI 润色打招呼 (LLM Polish) ===
    const llmPolishHtml = `
        <div style="margin-bottom:8px;">
            <div style="font-size:11px; color:#546e7a; margin-bottom:6px; font-weight:600;">📝 粘贴简历，AI 提取核心优势并匹配 JD</div>
            <textarea id="llm-resume-input" placeholder="粘贴你的完整简历，AI 会自动提取与该岗位匹配的核心优势，生成精准打招呼话术..."
                style="width:100%; height:100px; padding:8px; border:1px solid #e0e0e0; border-radius:6px; font-size:11px; resize:vertical; box-sizing:border-box; font-family:inherit; line-height:1.5;"></textarea>
        </div>
        <details style="margin-bottom:8px;">
            <summary style="font-size:10px; color:#90a4ae; cursor:pointer; user-select:none;">⚙️ 切换模型（默认小米 mimo）</summary>
            <div style="padding:8px; background:#f5f5f5; border-radius:6px; margin-top:6px;">
                <div style="margin-bottom:6px;">
                    <input id="llm-endpoint" placeholder="API 地址" style="width:100%; padding:5px 8px; border:1px solid #e0e0e0; border-radius:4px; font-size:10px; box-sizing:border-box;" />
                </div>
                <div style="display:flex; gap:6px; margin-bottom:6px;">
                    <input id="llm-model-name" placeholder="模型名" style="flex:1; padding:5px 8px; border:1px solid #e0e0e0; border-radius:4px; font-size:10px; box-sizing:border-box;" />
                    <input id="llm-api-key" type="password" placeholder="API Key" style="flex:1; padding:5px 8px; border:1px solid #e0e0e0; border-radius:4px; font-size:10px; box-sizing:border-box;" />
                </div>
                <button id="btn-save-llm-config" style="padding:4px 10px; background:#00bebd; color:#fff; border:none; border-radius:4px; font-size:10px; cursor:pointer;">保存配置</button>
            </div>
        </details>
        <div style="display:flex; gap:8px; align-items:center;">
            <div style="flex:1; font-size:10px; color:#999;" id="llm-current-model">模型: mimo-v2.5-pro</div>
            <button id="btn-llm-polish" style="padding:6px 14px; background:linear-gradient(135deg,#7c4dff,#651fff); color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 8px rgba(124,77,255,0.3); transition:all 0.2s; white-space:nowrap;">
                🎯 匹配生成
            </button>
        </div>
        <div id="llm-status" style="font-size:10px; color:#999; min-height:14px; margin-top:4px;"></div>
    `;
    extraHtml += renderCard('简历匹配打招呼', '🎯', llmPolishHtml, '#7c4dff');

    extraHtml += `</div>`;

    // 替换 pain-box 内容
    const painBox = document.getElementById('pain-box');
    if (painBox) {
        // 重置容器样式，以适应麦肯锡风格卡片
        painBox.style.background = 'transparent';
        painBox.style.border = 'none';
        painBox.style.padding = '0';
        painBox.style.color = 'inherit'; // 重置文字颜色
        painBox.innerHTML = extraHtml;
        
        // 绑定事件 (Smart Opener)
        bindSmartOpenerEvents();

        // 绑定事件 (LLM Polish)
        bindLlmPolishEvents(jobData);
    }
    
    // === 新增：页面底部的免责声明 ===
    // 检查是否已经存在 footer，避免重复添加
    let existingFooter = document.getElementById('report-footer-disclaimer');
    if (!existingFooter) {
        existingFooter = document.createElement('div');
        existingFooter.id = 'report-footer-disclaimer';
        existingFooter.style.cssText = `
            text-align: center;
            color: #999;
            font-size: 10px;
            padding: 10px;
            border-top: 1px dashed #eee;
            margin-top: 15px;
            background: #fdfdfd;
        `;
        existingFooter.innerText = "* 本报告由 AI 大模型自动生成，仅供参考，不构成任何求职或投资建议";
        // 添加到 report-content 的最底部
        const reportContent = document.getElementById('report-content');
        if (reportContent) reportContent.appendChild(existingFooter);
    }

    // === 新增：弱化版信号塔 (System Footer) ===
    // 检查是否已经存在，避免重复
    let existingAuthorEntry = document.getElementById('author-connect-entry');
    if (existingAuthorEntry) existingAuthorEntry.remove();

    /* 新的弱化版信号塔 HTML (Restored to Low-key Style) */
    const authorHtml = `
        <div id="author-connect-entry" style="
            text-align: center;
            margin-top: 15px;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 10px;
            border-top: 1px dashed rgba(0,0,0,0.05);
        ">
            <a href="#" id="link-author-modal" style="
                font-size: 11px;
                color: #90a4ae;
                text-decoration: none;
                border-bottom: 1px dashed #cfd8dc;
                padding-bottom: 2px;
                transition: all 0.2s;
            " 
            onmouseover="this.style.color='#00bebd'; this.style.borderColor='#00bebd';"
            onmouseout="this.style.color='#90a4ae'; this.style.borderColor='#cfd8dc';"
            >
                📡 连接信号塔 (获取能量)
            </a>
        </div>
    `;
    
    // 插入到 report-content 的最底部 (在 Disclaimer 之后)
    const reportContent = document.getElementById('report-content');
    if (reportContent) {
        reportContent.insertAdjacentHTML('beforeend', authorHtml);
        
        // 绑定点击事件
        setTimeout(() => {
             const link = document.getElementById('link-author-modal');
             if(link) {
                 link.onclick = (e) => {
                     e.preventDefault();
                     const modal = document.getElementById('localAuthorModal');
                     if(modal) {
                         modal.style.display = 'flex';
                     } else {
                         alert("请点击插件图标连接信号塔");
                     }
                 };
             }
        }, 500);
    }
    
    // 移除 focus-box (隐藏)
    const focusBox = document.getElementById('focus-box');
    if (focusBox) focusBox.style.display = 'none';

    // === 新增：保存当前分析数据，防止页面跳转丢失 ===
    const storageData = {
        lastAnalysisData: {
            jobData: jobData,
            aiData: aiData,
            // 关键：把 jobId 也存进去，方便 markAsIgnore 使用
            jobId: getJobId(window.location.href) || (jobData.link ? getJobId(jobData.link) : null),
            timestamp: Date.now()
        }
    };
    chrome.storage.local.set(storageData, () => {
        console.log("💾 [BossDebug] 分析数据已保存，Job:", jobData.detailTitle);
    });

    // autoCaptureReport(); // 禁用自动截图，避免生成不必要的图片
}

// 恢复上次分析的数据（针对页面跳转场景）
function restoreLastAnalysis() {
    chrome.storage.local.get(['lastAnalysisData', 'pendingGreeting'], (result) => {
        const data = result.lastAnalysisData;
        const hasPending = !!result.pendingGreeting; // 是否处于自动沟通流程中

        if (!data) {
            console.log("⚠️ [BossDebug] 没有找到上次分析的数据");
            return;
        }

        // 检查过期时间 (改为24小时，避免数据过快丢失)
        if (Date.now() - data.timestamp > 86400000) {
            console.log("⏰ [BossDebug] 上次分析数据已过期 (>24h)");
            chrome.storage.local.remove('lastAnalysisData');
            return;
        }

        // === 关键修正：检查是否是当前职位的分析数据 ===
        const currentJobId = getJobId(window.location.href);
        
        // 1. 如果有 pendingGreeting，说明是跳转到了聊天页，此时不做严格的 ID 校验，直接恢复，
        //    因为聊天页可能没有 JobID，或者 ID 格式不同。
        // 2. 如果是普通详情页，则必须校验 ID
        if (!hasPending) {
            // 如果我们能获取到当前ID，且与缓存ID不一致，则坚决不恢复
            if (currentJobId && data.jobId && currentJobId !== data.jobId) {
                 console.log(`🚫 [BossDebug] 缓存不匹配，跳过恢复 (Current: ${currentJobId}, Cached: ${data.jobId})`);
                 return;
            }
            
            // 只有在详情页才尝试恢复 (通过 URL 判断)
            // === 修正：允许在列表页恢复上次的分析面板，防止用户误刷新丢失数据
            if (!window.location.href.includes('job_detail')) {
                 console.log("⚠️ [BossDebug] 非详情页，但尝试恢复上次分析数据");
                 // return; // 不再拦截
            }
        } else {
             console.log("🚀 [BossDebug] 检测到自动沟通流程，强制恢复面板数据");
        }

        console.log("♻️ [BossDebug] 正在恢复上次分析数据...", data.jobData.detailTitle);
        
        // 1. 恢复雷达图
        if (data.jobData) {
            updateRadarUI(
                data.jobData.detailTitle, 
                data.jobData.company, 
                data.jobData.hr, 
                data.jobData.active,
                data.jobData.hrTitle
            );
        }

        // 2. 恢复报告内容
        if (data.jobData && data.aiData) {
            renderFullReport(data.jobData, data.aiData);
            
            // 恢复状态显示
            const score = data.aiData.score || 0;
            const statusEl = document.getElementById('radar-status');
            if(statusEl) {
                statusEl.innerText = score >= 80 ? "🎯 发现优质岗位！" : "✅ 分析完成(已恢复)";
                statusEl.style.color = score >= 80 ? "#00c853" : "#006064";
            }
            
            // 始终显示一键开聊按钮
            const btnGreet = document.getElementById('btn-auto-greet');
            if(btnGreet) btnGreet.style.display = 'inline-block';
            
            // 始终显示忽略按钮
            const btnIgnore = document.getElementById('btn-ignore');
            if(btnIgnore) btnIgnore.style.display = 'inline-block';

            // 提示用户 (静默恢复，不再弹窗打扰)
            // showToast("已恢复上次分析记录");
        }
    });
}

// ================= 7. 历史记录管理 (HistoryManager) =================
const HistoryManager = {
    cache: new Map(),
    isLoaded: false,
    MAX_SIZE: 3000, // 默认扩容到 3000
    EXPIRE_TIME: 30 * 24 * 60 * 60 * 1000, // 默认30天

    async init() {
        if (this.isLoaded) return;
        try {
            // 同时读取配置和历史记录
            const res = await new Promise(r => chrome.storage.local.get(['jobHistory', 'historyRetentionDays', 'maxHistoryRecords'], r));
            
            // 1. 更新配置
            if (res.historyRetentionDays) {
                const days = parseInt(res.historyRetentionDays);
                if (!isNaN(days) && days >= 7 && days <= 60) {
                    this.EXPIRE_TIME = days * 24 * 60 * 60 * 1000;
                }
            }
            
            if (res.maxHistoryRecords) {
                const max = parseInt(res.maxHistoryRecords);
                if (!isNaN(max) && max >= 100 && max <= 5000) {
                    this.MAX_SIZE = max;
                }
            }

            console.log(`⚙️ [History] 配置加载: 保留${this.EXPIRE_TIME / (24*3600*1000)}天, 最大${this.MAX_SIZE}条`);

            if (res.jobHistory) {
                // 将对象转回 Map
                this.cache = new Map(Object.entries(res.jobHistory));
                // 清理过期数据
                this.cleanExpired();
            }
            this.isLoaded = true;
            console.log(`📚 [History] 加载完成，共 ${this.cache.size} 条记录`);
        } catch (e) {
            console.error("History Init Error:", e);
        }
    },

    safeStorageSet(payload) {
        if (!chrome.runtime || !chrome.runtime.id) return;
        try {
            chrome.storage.local.set(payload);
        } catch (e) {
            console.warn("⚠️ [History] storage.set failed:", e.message || e);
        }
    },

    save() {
        // 转换为对象存储
        const obj = Object.fromEntries(this.cache);
        this.safeStorageSet({ 'jobHistory': obj });
    },

    cleanExpired() {
        const now = Date.now();
        let changed = false;
        const keysToDelete = []; // 需要从 storage 中删除的详情 Key

        for (const [id, record] of this.cache) {
            if (now - record.t > this.EXPIRE_TIME) {
                this.cache.delete(id);
                keysToDelete.push(`job_cache_${id}`);
                changed = true;
            }
        }
        
        // LRU 淘汰 (如果超过 MAX_SIZE)
        if (this.cache.size > this.MAX_SIZE) {
            // Map 的迭代顺序就是插入顺序（如果是重新赋值会变到最后，但这里简单处理）
            // 我们需要根据 timestamp 排序来删除最旧的
            const sorted = Array.from(this.cache.entries()).sort((a, b) => a[1].t - b[1].t);
            const toDelete = sorted.slice(0, this.cache.size - this.MAX_SIZE);
            toDelete.forEach(([id]) => {
                this.cache.delete(id);
                keysToDelete.push(`job_cache_${id}`);
            });
            changed = true;
        }

        if (changed) {
            this.save();
            // 批量清理详情缓存
            if (keysToDelete.length > 0) {
                chrome.storage.local.remove(keysToDelete, () => {
                    console.log(`🧹 [History] 清理了 ${keysToDelete.length} 条过期详情缓存`);
                });
            }
        }
    },

    // 获取记录 (Index)
    get(jobId) {
        return this.cache.get(jobId);
    },

    // 获取完整详情 (Async)
    async getDetail(jobId) {
        if (!jobId) return null;
        // 先检查索引是否存在
        if (!this.cache.has(jobId)) return null;

        const key = `job_cache_${jobId}`;
        const res = await new Promise(r => chrome.storage.local.get([key], r));
        return res[key] || null;
    },

    // 添加记录 (保存 Index 和 Detail)
    saveAnalysis(jobId, jobData, aiData) {
        if (!jobId) return;
        
        // 1. 更新 Index
        // 兼容 DeepSeek 的嵌套结构 (aiData.summary.score)
        const score = aiData.summary ? aiData.summary.score : (aiData.score || 0);
        const verdict = aiData.summary ? aiData.summary.match_level : (aiData.verdict || "");
        
        this.cache.set(jobId, {
            t: Date.now(),
            st: 1, // 1:analyzed
            s: score,
            v: verdict
        });
        this.save();

        // 2. 保存 Detail (使用 unlimitedStorage)
        const key = `job_cache_${jobId}`;
        const detailData = {
            jobId,
            jobData,      // 原始 Job Data
            snapshot: {   // Schema 要求的 Snapshot
                title: jobData.detailTitle,
                salary: jobData.salary
            },
            aiData,       // DeepSeek 结果
            data: aiData, // Schema 要求的 data 字段 (alias)
            timestamp: Date.now(),
            updateTime: Date.now(), // Schema 要求
            version: "1.0" // Schema 要求
        };
        chrome.storage.local.set({ [key]: detailData }, () => {
             console.log(`💾 [History] 详情已缓存: ${key} (${Math.round(JSON.stringify(detailData).length/1024)}KB)`);
        });
    },

    // 添加记录 (旧版兼容)
    add(jobId, status, score, verdict) {
        if (!jobId) return;
        this.cache.set(jobId, {
            t: Date.now(),
            st: status, // 1:analyzed, 2:greeted, 3:ignored
            s: score || 0,
            v: verdict || ""
        });
        this.save();
    },

    // 标记为已投递
    markGreeted(jobId) {
        const record = this.cache.get(jobId);
        if (record) {
            record.st = 2; // greeted
            record.t = Date.now(); // 更新时间
            this.cache.set(jobId, record);
        } else {
            this.add(jobId, 2, 0, "已投递");
        }
        this.save();
    },

    clearAll() {
        // 需要清理所有相关的详情 key
        // 这比较麻烦，因为我们没有维护 key 列表。
        // 但可以通过遍历 jobHistory 的 id 来清理。
        const keysToDelete = Array.from(this.cache.keys()).map(id => `job_cache_${id}`);
        // 同时也清理旧版的
        const oldKeysToDelete = Array.from(this.cache.keys()).map(id => `analysis_cache_${id}`);
        
        keysToDelete.push(...oldKeysToDelete);
        keysToDelete.push('jobHistory');
        
        chrome.storage.local.remove(keysToDelete, () => {
            console.log("🗑️ [History] 历史记录及详情已清空");
        });
        
        this.cache.clear();
    }
};

// 监听配置变化动态更新
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.historyRetentionDays) {
            const days = parseInt(changes.historyRetentionDays.newValue);
            if (!isNaN(days) && days >= 7 && days <= 30) {
                HistoryManager.EXPIRE_TIME = days * 24 * 60 * 60 * 1000;
                // console.log(`⚙️ [History] Retention updated: ${days} days`);
                HistoryManager.cleanExpired();
            }
        }
        if (changes.maxHistoryRecords) {
            const max = parseInt(changes.maxHistoryRecords.newValue);
            if (!isNaN(max) && max >= 100 && max <= 2000) {
                HistoryManager.MAX_SIZE = max;
                // console.log(`⚙️ [History] Max records updated: ${max}`);
                HistoryManager.cleanExpired();
            }
        }
    }
});

// 辅助函数：提取 Job ID
function getJobId(urlOrStr) {
    const targetUrl = urlOrStr || window.location.href;
    if (!targetUrl) return null;
    
    // 0. 优先尝试从 Canonical Link 提取 (仅针对当前页面，且最准确)
    // 防止 URL 带有各种参数干扰 (e.g. securityId, ka, lid)
    if (targetUrl.includes(window.location.pathname) || targetUrl === window.location.href) {
         try {
             const canonical = document.querySelector('link[rel="canonical"]');
             if (canonical && canonical.href && canonical.href.includes('job_detail')) {
                 const match = canonical.href.match(/job_detail\/([^/?#]+)/);
                 if (match && match[1]) return match[1].replace('.html', '');
             }
         } catch(e) {}
    }

    try {
        // 1. 尝试从 URL 对象解析
        const urlObj = new URL(targetUrl, window.location.origin);
        
        // A. 优先尝试路径提取：/job_detail/8404390317e800641XJ-2d-5FlVR.html
        const path = urlObj.pathname;
        const match = path.match(/job_detail\/([^/?#]+)/);
        if (match && match[1]) {
            return match[1].replace('.html', '');
        }

        // B. 尝试从 Query 参数提取：?jobId=8404390317e800641XJ-2d-5FlVR
        const queryId = urlObj.searchParams.get('jobId');
        if (queryId) return queryId;

    } catch(e) {
        // 忽略解析错误，进入降级
    }
    
    // 2. 降级：字符串正则暴力匹配 (应对非标准 URL)
    // 匹配 /job_detail/xxx
    const matchPath = targetUrl.match(/job_detail\/([^/?#]+)/);
    if (matchPath && matchPath[1]) {
         return matchPath[1].replace('.html', '');
    }

    // 匹配 jobId=xxx
    const matchQuery = targetUrl.match(/[?&]jobId=([^&]+)/);
    if (matchQuery && matchQuery[1]) {
        return matchQuery[1];
    }
    
    return null;
}

// 确保初始化
HistoryManager.init();

function bindEvents() {
    const p = document.getElementById('boss-copilot-panel');
    
    // 安全绑定辅助函数
    const safeBind = (id, handler, options = {}) => {
        const el = document.getElementById(id);
        if (el) {
            el.onclick = handler;
        } else if (!options.optional) {
            console.warn(`[BossDebug] Warning: Element #${id} not found during event binding.`);
        }
    };

    if (!isAutoApplyEnabled()) {
        ['btn-auto-loop', 'btn-stop-auto-loop', 'btn-export-auto-log', 'btn-export-auto-brief', 'btn-config-remote-log'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    if (p) {
        safeBind('btn-minimize', () => { 
            p.style.display='none'; 
            const ball = document.getElementById('boss-copilot-ball');
            if(ball) ball.style.right='0'; 
        });
    }

    safeBind('btn-reset', resetPanelPosition);
    safeBind('btn-clear-history', () => {
        if(confirm('确定要清空所有历史记录吗？\n这将清除所有已分析和已投递的记忆。')) {
            HistoryManager.clearAll();
            showToast("历史记录已清空");
        }
    });

    safeBind('btn-analyze', manualAnalyze, { optional: true });
    safeBind('btn-scan', function() {
        if (isScanning) {
            toggleScan();
            return;
        }
        if (confirm("⚠️ 【高风险操作警告】\n\n批量巡检功能会模拟人类行为连续浏览职位。\n\n尽管我们已加入随机延迟，但高频操作仍可能触发平台风控（包括但不限于：验证码拦截、账号临时限制、封号）。\n\n建议：\n1. 仅在必要时使用\n2. 控制操作节奏\n3. 配合“不活跃HR过滤”使用\n\n是否继续？")) {
            toggleScan();
        }
    }, { optional: true });
    safeBind('btn-auto-loop', function() {
        if (!isAutoApplyEnabled()) {
            showToast("社招版未启用自动沟通循环");
            return;
        }
        if (isAutoApplying) {
            toggleAutoApplyLoop();
            return;
        }
        if (confirm("⚠️ 【自动沟通循环提醒】\n\n该功能会自动滚动、分析并发送招呼语。\n\n请确保：\n1. 已登录 Boss 直聘\n2. 当前在职位列表页\n3. 已理解可能触发平台风控\n\n是否继续？")) {
            toggleAutoApplyLoop();
        }
    });
    safeBind('btn-stop-auto-loop', function() {
        if (!isAutoApplying) {
            showToast("当前未在自动沟通循环中");
            return;
        }
        stopAutoApplyLoop();
        showToast("已停止自动沟通循环");
    });
    safeBind('btn-export-auto-log', exportAutoApplyLog);
    safeBind('btn-export-auto-brief', exportAutoApplyBrief);
    safeBind('btn-config-remote-log', configureAutoApplyRemoteLog);

    safeBind('btn-ignore', markAsIgnore, { optional: true });

    safeBind('btn-auto-apply', async () => {
        const btn = document.getElementById('btn-auto-apply');
        if (!isAutoApplyEnabled()) {
            alert("社招版未启用一键招呼。");
            return;
        }
        if (!window.lastGlimmerData) {
            alert("请先点击【深度剖析】，生成策略后再使用一键招呼。");
            return;
        }

        const { jobData, aiData } = window.lastGlimmerData;
        const originalText = btn.innerText;
        const score = (aiData && aiData.summary && typeof aiData.summary.score === 'number')
            ? aiData.summary.score
            : (aiData ? aiData.score : 0);
        const hardFilter = getInternshipHardSkipReason(jobData);
        if (hardFilter.skip) {
            appendAutoApplyLog("manual_blocked", jobData, {
                jobId: getJobId(window.location.href),
                reason: hardFilter.reason,
                detailUrl: window.location.href,
                source: "manual_button"
            });
            alert(`该岗位已被实习生硬过滤拦截：${hardFilter.reason}`);
            return;
        }

        if (score < 70) {
            if (!confirm(`当前岗位匹配度仅 ${score} 分，确定要发送招呼吗？`)) {
                return;
            }
        }

        try {
            btn.innerText = "发送中...";
            btn.disabled = true;

            const scripts = (aiData && aiData.interview_guide && aiData.interview_guide.opening_scripts) || [];
            const bestScript = scripts.find(s => s && s.style === 'Direct') || scripts[0];
            const greetingText = bestScript && bestScript.content
                ? bestScript.content
                : "您好，我对该岗位很感兴趣，期待进一步沟通。";

            await autoGreet(greetingText, {
                jobId: getJobId(window.location.href),
                jobData,
                detailUrl: window.location.href
            });

            btn.innerText = "✅ 已发送";
        } catch (error) {
            console.error("Auto apply failed:", error);
            btn.innerText = "❌ 失败";
            alert("发送失败，请检查是否已登录或聊天窗口是否被拦截。");
        } finally {
            setTimeout(() => {
                if (btn.innerText !== "✅ 已发送") {
                    btn.innerText = originalText;
                }
                btn.disabled = false;
            }, 2000);
        }
    }, { optional: true });
    
    // btn-auto-greet 已移除
    // safeBind('ai-chat-input', function() { this.select(); document.execCommand('copy'); });
    
    safeBind('btn-capture', startCaptureSelection, { optional: true });
}

async function startCaptureSelection() {
    // 使用 html2canvas 进行长截图
    const reportEl = document.getElementById('report-content');
    const radarEl = document.querySelector('.section-radar'); // 获取雷达图区域
    
    if (!reportEl || reportEl.style.display === 'none') {
        showToast('请先生成报告再截图');
        return;
    }

    const btn = document.getElementById('btn-capture');
    const originalText = btn.innerText;
    btn.innerText = '生成长图中...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
        if (typeof html2canvas === 'undefined') {
            throw new Error("html2canvas library not loaded, please reload the page");
        }

        // 调试：检查元素是否存在
        if (!radarEl) {
            console.warn("📸 [BossCapture] 警告：未找到 .section-radar 元素");
            // 尝试更广泛的查找
            // radarEl = document.querySelector('div[style*="border-radius:var(--radius-md)"]'); 
        } else {
             console.log("📸 [BossCapture] 找到雷达区域:", radarEl);
        }

        // === 0. 预先处理 SVG 数据 (关键修复：SVG -> Image -> Canvas -> PNG) ===
        // 直接使用 SVG Data URI 在 html2canvas 中经常渲染失败
        // 我们需要先把它栅格化为 PNG
        let radarPngUrl = null;
        try {
            const originalSvg = document.querySelector('#radar-chart-visual svg');
            if (originalSvg) {
                // 1. 序列化 SVG
                const serializer = new XMLSerializer();
                let source = serializer.serializeToString(originalSvg);
                if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                const encoded = encodeURIComponent(source);
                const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;

                // 2. 绘制到 Canvas 转换为 PNG
                const tempImg = new Image();
                tempImg.src = svgDataUrl;
                await new Promise((resolve, reject) => {
                    tempImg.onload = resolve;
                    tempImg.onerror = reject;
                });

                const tempCanvas = document.createElement('canvas');
                // 使用原始 SVG 的尺寸或默认尺寸
                const svgW = originalSvg.clientWidth || 300;
                const svgH = originalSvg.clientHeight || 200;
                // 提高分辨率以保证清晰度
                tempCanvas.width = svgW * 2;
                tempCanvas.height = svgH * 2;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0, tempCanvas.width, tempCanvas.height);
                
                radarPngUrl = tempCanvas.toDataURL('image/png');
                console.log("📸 [BossCapture] 已将 SVG 栅格化为 PNG");
                
            } else {
                // Fallback for Canvas
                const originalCanvas = document.querySelector('#radar-chart-visual canvas');
                if (originalCanvas) {
                    radarPngUrl = originalCanvas.toDataURL('image/png');
                    console.log("📸 [BossCapture] 已捕获 Canvas 数据");
                }
            }
        } catch(e) {
            console.error("📸 [BossCapture] SVG/Canvas 预处理失败:", e);
        }

        // === 1. 构建截图容器 ===
        // 我们需要把雷达图(section-radar)和报告内容(report-content)拼在一起
        const wrapper = document.createElement('div');
        // 关键修复：位置跟随滚动条，且层级最高，确保可见
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        wrapper.style.cssText = `
            position: absolute;
            top: ${scrollTop}px;
            left: 0;
            width: 450px; /* 适当加宽 */
            background: #fff;
            z-index: 2147483647; /* 最高层级 */
            padding: 20px;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            box-sizing: border-box;
        `;
        
        // 克隆雷达图
        let clonedRadar = null;
        if (radarEl) {
            clonedRadar = radarEl.cloneNode(true);
            clonedRadar.style.display = 'block'; // 强制显示
            clonedRadar.style.marginBottom = '15px';
            clonedRadar.style.boxShadow = 'none'; 
            clonedRadar.style.border = '1px solid #eee';
            clonedRadar.style.background = '#fff';
            wrapper.appendChild(clonedRadar);
        } else {
            // 如果没找到雷达图，手动构建一个提示 (或尝试仅仅放入图片)
            if (radarPngUrl) {
                const fallbackDiv = document.createElement('div');
                fallbackDiv.id = 'radar-chart-visual';
                fallbackDiv.style.height = '180px';
                fallbackDiv.style.marginBottom = '15px';
                fallbackDiv.style.border = '1px solid #eee';
                wrapper.appendChild(fallbackDiv);
                console.log("📸 [BossCapture] 使用 Fallback 容器装载雷达图");
            }
        }

        // 克隆报告内容
        const clonedReport = reportEl.cloneNode(true);
        clonedReport.style.display = 'block'; // 确保显示
        clonedReport.style.boxShadow = 'none';
        clonedReport.style.border = '1px solid #eee';
        clonedReport.style.marginTop = '0';
        clonedReport.style.background = '#fff';
        wrapper.appendChild(clonedReport);

        // 预处理 Textarea
        const textareas = wrapper.querySelectorAll('textarea');
        textareas.forEach(t => {
            t.style.height = (t.scrollHeight + 10) + 'px'; 
            t.style.overflow = 'hidden';
            t.style.border = '1px solid #eee';
            t.style.resize = 'none';
            t.style.background = '#f9f9f9';
            t.style.color = '#333';
        });

        // 插入免责声明
        const footer = document.createElement('div');
        footer.style.cssText = `
            text-align: center;
            color: #999;
            font-size: 10px;
            padding: 10px;
            border-top: 1px dashed #eee;
            margin-top: 10px;
            background: #fdfdfd;
        `;
        footer.innerText = "* 本报告由 AI 大模型自动生成，仅供参考，不构成任何求职或投资建议";
        wrapper.appendChild(footer);

        // 插入到 body
        document.body.appendChild(wrapper);

        // === 2. 注入图片化的雷达图 ===
        if (radarPngUrl) {
            // 在 wrapper 里找 id="radar-chart-visual"
            let clonedSvgContainer = wrapper.querySelector('#radar-chart-visual');
            
            // 如果 wrapper 里的结构变了（比如 radarEl clone 不包含 id），尝试找 .section-radar 的子元素
            if (!clonedSvgContainer && clonedRadar) {
                 clonedSvgContainer = clonedRadar.querySelector('#radar-chart-visual') || clonedRadar;
            }

            if (clonedSvgContainer) {
                // 确保容器可见
                clonedSvgContainer.style.display = 'flex';
                
                const img = new Image();
                img.src = radarPngUrl;
                // 限制最大宽度，防止撑破
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%'; 
                img.style.objectFit = 'contain';
                img.style.display = 'block';

                // 🔥 关键修复：不要清空整个容器 (innerHTML='')，因为可能包含右侧的安全卡片
                // 而是精确定位到 SVG 并替换它
                const svgInClone = clonedSvgContainer.querySelector('svg');
                if (svgInClone) {
                    svgInClone.parentNode.replaceChild(img, svgInClone);
                    console.log("📸 [BossCapture] SVG已精准替换为PNG (保留安全卡片)");
                } else {
                    // 如果没找到 SVG，可能是结构问题。
                    // 尝试插入到第一个子元素 (左侧雷达区)
                    if (clonedSvgContainer.children.length > 0) {
                        const leftWrapper = clonedSvgContainer.firstElementChild;
                        if(leftWrapper) {
                            leftWrapper.innerHTML = ''; // 清空左侧
                            leftWrapper.appendChild(img);
                        }
                    } else {
                        // 如果真没子元素，那只能清空插入了
                        clonedSvgContainer.innerHTML = '';
                        clonedSvgContainer.appendChild(img);
                    }
                }
            } else {
                console.warn("📸 [BossCapture] 克隆体中未找到容器注入图片");
            }
        }

        // 给一点时间让浏览器重排
        await new Promise(r => setTimeout(r, 500));

        // === 3. 生成截图 ===
        // 临时隐藏滚动条
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const canvas = await html2canvas(wrapper, {
            useCORS: true, 
            scale: 2, 
            logging: false,
            backgroundColor: '#ffffff',
            // 强制指定宽高，避免裁剪
            width: wrapper.offsetWidth,
            height: wrapper.offsetHeight,
            // x: 0, // 移除 x, y 以避免白屏
            // y: window.scrollY 
        });

        // 恢复滚动条
        document.body.style.overflow = originalOverflow;

        // 移除克隆元素
        document.body.removeChild(wrapper);

        // === 4. 转为 Blob 并复制 ===
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Blob生成失败");

        // 尝试复制到剪贴板
        let clipboardSuccess = false;
        try {
            // 聚焦窗口
            window.focus();
            
            // 必须在用户交互上下文中，或者文档聚焦
            // 我们尝试使用 Clipboard API
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            clipboardSuccess = true;
            console.log("📸 [BossCapture] 截图已复制到剪贴板");
            
            showToast("✅ 截图已复制，Ctrl+V 粘贴");
            
        } catch (err) {
            console.error("📸 [BossCapture] 复制到剪贴板失败:", err);
            // 失败不阻断，继续下载
        }

        // 如果剪贴板失败，或者为了保险，总是下载(或者可以改为只在失败时下载?)
        // 用户反馈"便于直接粘贴"，说明他们更想要剪贴板。
        // 如果复制成功了，就不下载了，免得文件多了烦人。
        if (!clipboardSuccess) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BossReport_${new Date().getTime()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showToast("📋 复制失败，已自动下载图片");
        }

    } catch (e) {
        console.error("📸 [BossCapture] 截图异常:", e);
        showToast('截图失败: ' + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

async function captureAndDownload(rect) {
    try {
        console.log("📸 [BossCapture] 发送 capture_tab 消息, rect:", rect);
        const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'capture_tab' }, r));
        
        if (!res) {
            console.error("📸 [BossCapture] Background 未响应");
            return false;
        }
        if (!res.success) {
            console.error("📸 [BossCapture] Background 报错:", res.error);
            return false;
        }

        const dpr = window.devicePixelRatio || 1;
        console.log("📸 [BossCapture] 收到截图数据, DPR:", dpr, "DataUrl长度:", res.dataUrl ? res.dataUrl.length : 0);
        
        const img = new Image();
        img.src = res.dataUrl;
        await new Promise((resolve, reject) => { 
            img.onload = resolve; 
            img.onerror = () => reject(new Error("Image load failed"));
        });
        
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(rect.w * dpr);
        canvas.height = Math.floor(rect.h * dpr);
        const ctx = canvas.getContext('2d');
        
        // 调试：检查坐标是否越界
        if (rect.x < 0 || rect.y < 0) {
            console.warn("📸 [BossCapture] 警告：截图区域包含负坐标，可能被裁剪", rect);
        }

        ctx.drawImage(
            img,
            Math.floor(rect.x * dpr),
            Math.floor(rect.y * dpr),
            Math.floor(rect.w * dpr),
            Math.floor(rect.h * dpr),
            0, 0,
            Math.floor(rect.w * dpr),
            Math.floor(rect.h * dpr)
        );
        
        const out = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const ts = new Date();
        const pad = (n)=>(''+n).padStart(2,'0');
        const fname = `boss-report-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.png`;
        a.href = out;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        console.log("📸 [BossCapture] 下载触发成功");
        return true;
    } catch(e) {
        console.error("📸 [BossCapture] 处理截图异常:", e);
        return false;
    }
}

async function autoCaptureReport() {
    // 自动截图也应该调用 startCaptureSelection，因为它已经封装了完美的处理逻辑
    // 之前的 captureAndDownload 是旧逻辑，可能不支持新雷达图
    console.log("📸 [BossCapture] 自动截图触发...");
    await startCaptureSelection();
}


// 6. 自动投递逻辑
async function markAsIgnore() {
    // 优先尝试从 URL 获取
    let jobId = getJobId(window.location.href);
    
    // 如果 URL 还没变 (分屏模式常见问题)，尝试从已扫描的卡片里找
    if (!jobId) {
        // 找到当前高亮的卡片
        const currentCard = document.querySelector('.job-card-wrapper.boss-scanning, .job-card-box.boss-scanning');
        if (currentCard) {
            const link = currentCard.querySelector('a[href*="job_detail"]');
            if (link) jobId = getJobId(link.href);
        }
    }
    
    // 还没找到？尝试从 "立即沟通" 按钮的链接找 (Boss有时候会在按钮上绑数据)
    // 或者尝试从 URL 参数找 (如果 getJobId 漏了)
    if (!jobId) {
        const urlParams = new URLSearchParams(window.location.search);
        jobId = urlParams.get('jobId');
    }

    // 最后手段：从 lastAnalysisData 缓存里找 (分析时存进去的)
    let fallbackData = null;
    if (!jobId) {
        try {
            const cache = await new Promise(r => chrome.storage.local.get(['lastAnalysisData'], r));
            if (cache.lastAnalysisData) {
                if (cache.lastAnalysisData.jobId) {
                    console.log("⚠️ [BossDebug] URL无ID，从缓存恢复ID:", cache.lastAnalysisData.jobId);
                    jobId = cache.lastAnalysisData.jobId;
                }
                fallbackData = cache.lastAnalysisData.jobData;
            }
        } catch(e) {}
    }

    // Step 5: 绝境逢生 - 生成伪造ID (基于职位信息)
    if (!jobId) {
        // 如果缓存里有数据，用缓存的
        let title, company, hr;
        if (fallbackData) {
            title = fallbackData.detailTitle;
            company = fallbackData.company;
            hr = fallbackData.hr;
        } else {
            // 否则现场抓取
            const currentData = getDetailData();
            title = currentData.detailTitle;
            company = currentData.company;
            hr = currentData.hr;
        }
        
        if (title && company && title !== "职位读取中") {
            const uniqueStr = `${title}|${company}|${hr}`;
            jobId = "pseudo_" + generateHashCode(uniqueStr);
            console.log("⚠️ [BossDebug] 无法获取真ID，生成伪ID:", jobId, uniqueStr);
            showToast("⚠️ 使用伪ID标记 (可能不准确)", 2000);
        }
    }

    if (!jobId) {
        console.error("❌ [BossDebug] 无法获取 Job ID，当前 URL:", window.location.href);
        showToast("⚠️ 未获取到职位ID，请刷新页面重试");
        return;
    }
    
    // 1. 写入历史记录 (状态3=忽略，分数0=下次显示为Bad)
    HistoryManager.add(jobId, 3, 0, "用户忽略");
    console.log("🚫 [BossDebug] 用户手动忽略:", jobId);
    
    // 2. 更新UI反馈
    const statusEl = document.getElementById('radar-status');
    if(statusEl) {
        statusEl.innerText = "🚫 已忽略";
        statusEl.style.color = "#999";
    }
    
    // 3. 隐藏操作按钮
    document.getElementById('btn-auto-greet').style.display = 'none';
    document.getElementById('btn-ignore').style.display = 'none';
    
    // 4. 更新左侧列表状态
    const cards = document.querySelectorAll('.job-card-wrapper, .job-card-box');
    for (let c of cards) {
        // 尝试匹配：要么匹配 scanned 标记，要么匹配链接
        let link = c.querySelector('a[href*="job_detail"]');
        if (c.dataset.scanned === "true" || (link && link.href.includes(jobId))) {
             c.classList.remove('boss-good');
             c.classList.add('boss-bad'); // 变灰
             c.style.opacity = '0.5';
             
             // 如果正在扫描模式，自动跳下一个
             if (isScanning && c.classList.contains('boss-scanning')) {
                 scanNext();
             }
             break;
        }
    }
    
    showToast("已标记为不感兴趣");
}

// ================= 6. 自动投递逻辑 =================
async function autoGreet(greetingText, options = {}) {
    // 兼容旧按钮（如果存在）
    const btn = document.getElementById('btn-auto-greet');
    if (btn) {
        btn.innerText = "🚀 正在操作...";
        btn.disabled = true;
    }

    try {
        const { openInNewTab, detailUrl, jobId, jobData } = options;
        let sendSuccess = false;
        // 优先使用传入的话术，否则尝试读取输入框
        let greeting = greetingText;
        if (!greeting) {
             const input = document.getElementById('ai-chat-input');
             if (input) greeting = input.value;
        }
        const currentJobId = jobId || getJobId(window.location.href);

        if (!greeting) {
            showToast("⚠️ 没有生成有效的话术");
            appendAutoApplyLog("failed", jobData || {}, {
                jobId: currentJobId,
                reason: "没有生成有效的话术",
                detailUrl,
                source: "auto_greet"
            });
            if (btn) {
                btn.innerText = "💬 一键开聊";
                btn.disabled = false;
            }
            return false;
        }

        // 0. 先保存话术到本地存储
        const pendingJobMeta = buildAutoApplyLogMeta(jobData || {}, {
            jobId: currentJobId,
            detailUrl,
            source: openInNewTab ? "pending_new_tab" : "current_page"
        });
        await chrome.storage.local.set({ 
            'pendingGreeting': greeting,
            'pendingGreetingTime': Date.now(),
            'pendingJobId': currentJobId,
            'pendingJobMeta': pendingJobMeta
        });
        console.log("💾 [BossDebug] 话术已保存:", greeting.substring(0, 10) + "...");
        
        // 同时也写入剪贴板作为兜底
        navigator.clipboard.writeText(greeting).catch(e => console.error("Clipboard failed", e));

        // 1. 如果要求新开沟通页，优先用详情链接新开
        if (openInNewTab && detailUrl) {
            let absoluteDetail = detailUrl;
            try {
                absoluteDetail = new URL(detailUrl, window.location.origin).toString();
            } catch (e) {}

            if (!chrome.runtime || !chrome.runtime.id) {
                throw new Error("Extension context invalidated");
            }

            const openRes = await chrome.runtime.sendMessage({ action: "open_chat_tab", url: absoluteDetail });
            if (openRes && openRes.success) {
                showToast("已打开新沟通页，话术将自动填充", 3000);
                if (btn) { btn.innerText = "💬 一键开聊"; btn.disabled = false; }
                return "pending";
            }

            const win = window.open(absoluteDetail, '_blank');
            if (win) {
                showToast("已打开新沟通页，话术将自动填充", 3000);
                if (btn) { btn.innerText = "💬 一键开聊"; btn.disabled = false; }
                return "pending";
            }
            console.warn("⚠️ [BossDebug] 新沟通页打开失败，回退当前页模式");
        }

        // 2. 寻找“立即沟通”按钮 (增强版查找逻辑)
        // 策略：先找特定Class，如果找不到，再进行宽泛文本匹配
        let validBtn = null;
        
        // 优先级 1: 常见的特定按钮 Class
        const specificSelectors = [
            '.btn-startchat', 
            '.btn-container .btn-sure', 
            '.op-btn-chat', 
            '.btn-greet',
            '.group-chat-btn', 
            '.boss-chat-btn',
            '.btn-start-chat'
        ];
        
        const specificBtns = Array.from(document.querySelectorAll(specificSelectors.join(',')));
        validBtn = specificBtns.find(b => b.offsetParent !== null && (b.innerText.includes('沟通') || b.innerText.includes('打招呼')));

        // 优先级 2: 宽泛文本匹配 (针对 DOM 变动)
        if (!validBtn) {
            const allCandidates = Array.from(document.querySelectorAll('a, button, div[role="button"], span'));
            validBtn = allCandidates.find(b => {
                if (b.offsetParent === null) return false; // 必须可见
                const text = b.innerText.trim();
                return text === '立即沟通' || text === '继续沟通' || text === '立即打招呼';
            });
        }
        
        if (!validBtn) {
            console.error("❌ [BossDebug] 未找到“立即沟通”按钮");
            showToast('未找到“立即沟通”按钮，请确认您在职位详情页');
            appendAutoApplyLog("failed", jobData || {}, {
                jobId: currentJobId,
                reason: "未找到立即沟通按钮",
                detailUrl,
                source: "auto_greet"
            });
            if (btn) {
                btn.innerText = "💬 一键开聊";
                btn.disabled = false;
            }
            return false;
        }

        console.log("👆 [BossDebug] 点击立即沟通按钮:", validBtn);
        // 尝试多种点击方式，确保触发 (旧版/无链接按钮)
        try {
            validBtn.click();
        } catch(e) { console.error("Standard click failed", e); }
        const eventOptions = { bubbles: true, cancelable: true, view: window };
        validBtn.dispatchEvent(new MouseEvent('mousedown', eventOptions));
        validBtn.dispatchEvent(new MouseEvent('mouseup', eventOptions));

        showToast("正在打开沟通窗口...", 2000);

        // 2. 智能等待输入框 (原地弹窗模式)
        // 如果页面跳转，则由 checkPendingGreeting 接管
        let chatInput = null;
        let retries = 0;
        
        while (retries < 25) { // 5秒
            chatInput = document.querySelector('textarea.chat-input, textarea[placeholder*="打招呼"], #chat-input, .dialog-container textarea, div[contenteditable="true"]');
            if (chatInput && chatInput.offsetParent !== null) break;
            await new Promise(r => setTimeout(r, 200));
            retries++;
        }

        if (!chatInput) {
            console.log("⚠️ [BossDebug] 当前页面未找到输入框，可能是跳转了页面");
            showToast("如页面跳转，话术将自动填充", 4000);
            appendAutoApplyLog("failed", jobData || {}, {
                jobId: currentJobId,
                reason: "当前页未找到聊天输入框",
                detailUrl,
                source: "auto_greet"
            });
            // 恢复按钮状态，因为如果跳转了，这个页面可能就不存在了，或者保留在后台
            setTimeout(() => {
                if(btn) { btn.innerText = "💬 一键开聊"; btn.disabled = false; }
            }, 3000);
            return false;
        }

        // 3. 填入话术 (弹窗模式)
        console.log("✍️ [BossDebug] 弹窗模式：正在填入话术...");
        
        if (chatInput.tagName === 'DIV' || chatInput.contentEditable === "true") {
            chatInput.focus();
            document.execCommand('insertText', false, greeting);
        } else {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            nativeInputValueSetter.call(chatInput, greeting);
            chatInput.dispatchEvent(new Event('input', { bubbles: true }));
            chatInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        chatInput.focus();
        showToast("话术已自动填入");

        // 4. 自动发送
        await new Promise(r => setTimeout(r, 800));
        
        const sendBtn = document.querySelector('.send-message, .btn-send, .submit-btn, .btn-sure, button[type="submit"], .dialog-footer .btn-sure');
        if (sendBtn && (sendBtn.innerText.includes('发送') || sendBtn.innerText.includes('确'))) {
            if (sendBtn.classList.contains('disable')) {
                sendBtn.classList.remove('disable');
                sendBtn.classList.remove('disabled');
            }
            sendBtn.click();
            console.log("🚀 [BossDebug] 话术已自动提交");
            showToast("✅ 已发送");
            if (btn) btn.innerText = "✅ 已发送";
            sendSuccess = true;
            
            // 标记为已投递
            const currentJobId = getJobId(window.location.href);
            if (currentJobId) {
                HistoryManager.markGreeted(currentJobId);
                console.log("💾 [BossDebug] 历史记录已更新: 已投递");
            }
            appendAutoApplyLog("sent", jobData || {}, {
                jobId: currentJobId,
                reason: "当前页发送成功",
                detailUrl,
                source: "auto_greet"
            });
            
            // 清除存储
            chrome.storage.local.remove(['pendingGreeting', 'pendingGreetingTime', 'pendingJobId', 'pendingJobMeta']);
        } else {
             showToast("⚠️ 未找到发送按钮，请手动点击");
             if (btn) btn.innerText = "✅ 已填入";
             appendAutoApplyLog("failed", jobData || {}, {
                 jobId: currentJobId,
                 reason: "已填入但未找到发送按钮",
                 detailUrl,
                 source: "auto_greet"
             });
        }
        
        setTimeout(() => { 
            if(btn) { btn.innerText = "💬 一键开聊"; btn.disabled = false; }
        }, 3000);

        return sendSuccess;
    } catch (e) {
        console.error("❌ [BossDebug] Auto Greet Error:", e);
        showToast("自动操作异常，请手动粘贴");
        appendAutoApplyLog("failed", options.jobData || {}, {
            jobId: options.jobId || getJobId(window.location.href),
            reason: e && e.message ? e.message : "自动操作异常",
            detailUrl: options.detailUrl,
            source: "auto_greet"
        });
        if(btn) { btn.innerText = "💬 一键开聊"; btn.disabled = false; }
        return false;
    }
}

// 检查是否有待发送的话术（跨页面/刷新）
function tryOpenChatPanel() {
    const selectors = [
        '.btn-startchat',
        '.btn-container .btn-sure',
        '.op-btn-chat',
        '.btn-greet',
        '.group-chat-btn',
        '.boss-chat-btn',
        '.btn-start-chat'
    ];
    const btns = Array.from(document.querySelectorAll(selectors.join(',')));
    const btn = btns.find(b => b.offsetParent !== null && (b.innerText.includes('沟通') || b.innerText.includes('打招呼')));
    if (btn) {
        btn.click();
        return true;
    }
    return false;
}

async function checkPendingGreeting() {
    try {
        const data = await new Promise(r => chrome.storage.local.get(['pendingGreeting', 'pendingGreetingTime', 'pendingJobId', 'pendingJobMeta'], r));
        if (!data.pendingGreeting) return;

        console.log("📥 [BossDebug] 检测到待发送话术...");

        // 检查过期 (60秒)
        if (Date.now() - (data.pendingGreetingTime || 0) > 60000) {
            console.log("⏰ [BossDebug] 话术已过期");
            appendAutoApplyLog("pending_expired", data.pendingJobMeta || {}, {
                jobId: data.pendingJobId,
                reason: "pending greeting expired",
                source: "pending_recovery"
            });
            chrome.storage.local.remove(['pendingGreeting', 'pendingGreetingTime', 'pendingJobId', 'pendingJobMeta']);
            return;
        }

        console.log("🔍 [BossDebug] 正在寻找聊天输入框...");
        showToast("正在恢复之前的沟通话术...", 3000);

        // 尝试先打开聊天面板（新开详情页时需要）
        tryOpenChatPanel();

        // 寻找输入框 (给予更长时间，因为新页面加载慢)
        let chatInput = null;
        let retries = 0;
        
        while (retries < 100) { // 20秒
            chatInput = document.querySelector(
                'textarea.chat-input, ' +
                'textarea[placeholder*="打招呼"], ' +
                '#chat-input, ' +
                '.dialog-container textarea, ' +
                '.chat-conversation textarea, ' +
                'div[contenteditable="true"], ' +
                '.chat-message-input'
            );
            if (!chatInput && retries === 20) {
                tryOpenChatPanel();
            }
            if (chatInput && chatInput.offsetParent !== null) {
                console.log("✅ [BossDebug] 找到输入框:", chatInput);
                break;
            }
            await new Promise(r => setTimeout(r, 200));
            retries++;
        }

        if (chatInput) {
            const greeting = data.pendingGreeting;
            
            // 填入
            if (chatInput.tagName === 'DIV' || chatInput.contentEditable === "true") {
                chatInput.focus();
                // 模拟点击以激活
                chatInput.click();
                await new Promise(r => setTimeout(r, 100));
                // 使用 execCommand 插入文本，这通常比 innerHTML 更能触发框架事件
                document.execCommand('insertText', false, greeting);
            } else {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                nativeInputValueSetter.call(chatInput, greeting);
                chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                chatInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            chatInput.focus();
            console.log("✍️ [BossDebug] [自动恢复] 话术已填入");
            showToast("话术已自动填入");

            await new Promise(r => setTimeout(r, 1000));
            
            // 尝试发送（增强：轮询 + 文案匹配 + 回车兜底）
            const sendStart = Date.now();
            let sendBtn = null;
            while (Date.now() - sendStart < 5000) {
                sendBtn = document.querySelector('.send-message, .btn-send, .submit-btn, .btn-sure, button[type="submit"], .dialog-footer .btn-sure, .chat-op .btn-send, .chat-message-send');
                if (!sendBtn) {
                    const candidates = Array.from(document.querySelectorAll('button, div[role="button"], span'));
                    sendBtn = candidates.find(b => {
                        if (!b || b.offsetParent === null) return false;
                        const text = (b.innerText || "").trim();
                        return text === "发送" || text === "立即沟通" || text === "继续沟通" || text === "确认";
                    });
                }
                if (sendBtn && (sendBtn.innerText.includes('发送') || sendBtn.innerText.includes('确') || sendBtn.innerText.includes('沟通'))) {
                    break;
                }
                sendBtn = null;
                await new Promise(r => setTimeout(r, 300));
            }

            if (!sendBtn) {
                // 回车兜底（部分页面只有回车发送）
                if (chatInput && (chatInput.tagName === 'TEXTAREA' || chatInput.contentEditable === "true")) {
                    chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    chatInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                    await new Promise(r => setTimeout(r, 800));
                }
            } else {
                if (sendBtn.classList.contains('disable')) {
                    sendBtn.classList.remove('disable');
                    sendBtn.classList.remove('disabled');
                }
                sendBtn.click();
            }

            if (sendBtn) {
                console.log("🚀 [BossDebug] [自动恢复] 话术已提交");
                showToast("✅ 已发送");
                
                // === 关键新增：更新历史记录状态 ===
                if (data.pendingJobId) {
                    HistoryManager.markGreeted(data.pendingJobId);
                    console.log("💾 [BossDebug] [自动恢复] 历史记录已更新: 已投递 ID:", data.pendingJobId);
                }
                appendAutoApplyLog("sent", data.pendingJobMeta || {}, {
                    jobId: data.pendingJobId,
                    reason: "新沟通页自动恢复发送成功",
                    source: "pending_recovery"
                });

                chrome.storage.local.remove(['pendingGreeting', 'pendingGreetingTime', 'pendingJobId', 'pendingJobMeta']);
                closeChatDialog();
            } else {
                console.log("⚠️ [BossDebug] [自动恢复] 未找到发送按钮，自动跳过");
                showToast("⚠️ 未找到发送按钮，已跳过");
                appendAutoApplyLog("failed", data.pendingJobMeta || {}, {
                    jobId: data.pendingJobId,
                    reason: "新沟通页未找到发送按钮",
                    source: "pending_recovery"
                });
                chrome.storage.local.remove(['pendingGreeting', 'pendingGreetingTime', 'pendingJobId', 'pendingJobMeta']);
                closeChatDialog();
            }
        } else {
            console.log("❌ [BossDebug] 超时未找到输入框");
            // 不清除，可能还在加载或者用户切换了页面
        }
    } catch (e) {
        console.error("❌ [BossDebug] Check Pending Greeting Error:", e);
    }
}

// ================= 拖拽和调整大小功能 =================
function setupDragAndResize() {
    const panel = document.getElementById('boss-copilot-panel');
    const header = panel.querySelector('.panel-header');
    const resizeHandles = panel.querySelectorAll('.resize-handle');
    const controls = panel.querySelector('.panel-controls');

    // 阻止按钮点击事件冒泡到拖拽逻辑
    if (controls) {
        controls.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // 拖拽变量
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panelStartX = 0;
    let panelStartY = 0;

    // 调整大小变量
    let isResizing = false;
    let resizeHandle = null;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let panelStartWidth = 0;
    let panelStartHeight = 0;
    let panelStartLeft = 0;
    let panelStartTop = 0;

    // 最小和最大尺寸
    const MIN_WIDTH = 300;
    const MIN_HEIGHT = 200;
    const MAX_WIDTH = window.innerWidth * 0.9;
    const MAX_HEIGHT = window.innerHeight * 0.9;

    // 1. 拖拽功能
    header.addEventListener('mousedown', startDrag);

    function startDrag(e) {
        // 如果点击的是按钮，不触发拖拽
        if (e.target.tagName === 'BUTTON' || e.target.closest('.panel-controls')) return;
        
        if (isResizing) return; // 如果正在调整大小，不启动拖拽

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        const rect = panel.getBoundingClientRect();
        panelStartX = rect.left;
        panelStartY = rect.top;

        panel.classList.add('panel-dragging');
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);

        e.preventDefault();
    }

    function doDrag(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        let newLeft = panelStartX + deltaX;
        let newTop = panelStartY + deltaY;

        // 边界检查
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));

        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
    }

    function stopDrag() {
        if (!isDragging) return;

        isDragging = false;
        panel.classList.remove('panel-dragging');
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);

        // 保存位置
        savePanelState();
    }

    // 2. 调整大小功能
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });

    function startResize(e) {
        isResizing = true;
        resizeHandle = e.target;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;

        const rect = panel.getBoundingClientRect();
        panelStartWidth = rect.width;
        panelStartHeight = rect.height;
        panelStartLeft = rect.left;
        panelStartTop = rect.top;

        resizeHandle.classList.add('active');
        panel.classList.add('panel-resizing');
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        e.preventDefault();
        e.stopPropagation();
    }

    function doResize(e) {
        if (!isResizing) return;

        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;

        let newWidth = panelStartWidth;
        let newHeight = panelStartHeight;
        let newLeft = panelStartLeft;
        let newTop = panelStartTop;

        const handleClass = resizeHandle.className;

        // 调试日志
        console.log('调整大小 - 手柄类:', handleClass);
        console.log('调整大小 - 包含e?', handleClass.includes('e'));
        console.log('调整大小 - 包含se?', handleClass.includes('se'));
        console.log('调整大小 - 包含ne?', handleClass.includes('ne'));
        console.log('调整大小 - 初始尺寸:', panelStartWidth, 'x', panelStartHeight);
        console.log('调整大小 - 偏移量:', deltaX, deltaY);

        // 根据手柄位置调整不同的边
        // 四角手柄：同时调整两个方向
        if (handleClass.includes('se')) { // 右下角：右+下
            newWidth = Math.max(MIN_WIDTH, Math.min(panelStartWidth + deltaX, MAX_WIDTH));
            newHeight = Math.max(MIN_HEIGHT, Math.min(panelStartHeight + deltaY, MAX_HEIGHT));
        }
        if (handleClass.includes('sw')) { // 左下角：左+下
            const widthChange = Math.max(MIN_WIDTH - panelStartWidth, Math.min(deltaX, MAX_WIDTH - panelStartWidth));
            newWidth = panelStartWidth - widthChange;
            newLeft = panelStartLeft + widthChange;
            newHeight = Math.max(MIN_HEIGHT, Math.min(panelStartHeight + deltaY, MAX_HEIGHT));
        }
        if (handleClass.includes('ne')) { // 右上角：右+上
            newWidth = Math.max(MIN_WIDTH, Math.min(panelStartWidth + deltaX, MAX_WIDTH));
            // 上边调整：高度减少，顶部下移（deltaY为正）或高度增加，顶部上移（deltaY为负）
            const heightChange = Math.max(MIN_HEIGHT - panelStartHeight, Math.min(deltaY, MAX_HEIGHT - panelStartHeight));
            newHeight = panelStartHeight - heightChange;
            newTop = panelStartTop + heightChange;
        }
        if (handleClass.includes('nw')) { // 左上角：左+上
            const widthChange = Math.max(MIN_WIDTH - panelStartWidth, Math.min(deltaX, MAX_WIDTH - panelStartWidth));
            newWidth = panelStartWidth - widthChange;
            newLeft = panelStartLeft + widthChange;
            const heightChange = Math.max(MIN_HEIGHT - panelStartHeight, Math.min(deltaY, MAX_HEIGHT - panelStartHeight));
            newHeight = panelStartHeight - heightChange;
            newTop = panelStartTop + heightChange;
        }
        // 四边手柄：只调整一个方向
        if (handleClass.includes('e') && !handleClass.includes('se') && !handleClass.includes('ne')) { // 右边
            newWidth = Math.max(MIN_WIDTH, Math.min(panelStartWidth + deltaX, MAX_WIDTH));
        }
        if (handleClass.includes('w') && !handleClass.includes('sw') && !handleClass.includes('nw')) { // 左边
            const widthChange = Math.max(MIN_WIDTH - panelStartWidth, Math.min(deltaX, MAX_WIDTH - panelStartWidth));
            newWidth = panelStartWidth - widthChange;
            newLeft = panelStartLeft + widthChange;
        }
        if (handleClass.includes('s') && !handleClass.includes('se') && !handleClass.includes('sw')) { // 下边
            newHeight = Math.max(MIN_HEIGHT, Math.min(panelStartHeight + deltaY, MAX_HEIGHT));
        }
        if (handleClass.includes('n') && !handleClass.includes('ne') && !handleClass.includes('nw')) { // 上边
            const heightChange = Math.max(MIN_HEIGHT - panelStartHeight, Math.min(deltaY, MAX_HEIGHT - panelStartHeight));
            newHeight = panelStartHeight - heightChange;
            newTop = panelStartTop + heightChange;
        }

        // 边界检查：确保面板在窗口内
        // 1. 顶部不能小于0
        newTop = Math.max(0, newTop);

        // 2. 左侧不能小于0
        newLeft = Math.max(0, newLeft);
        
        // 3. 应用变更
        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
        
        // 强制重绘
        // panel.offsetHeight; 
    }

    function stopResize() {
        if (!isResizing) return;

        isResizing = false;
        resizeHandle.classList.remove('active');
        panel.classList.remove('panel-resizing');
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);

        // 保存位置和尺寸
        savePanelState();
    }
}

// 保存面板状态到本地存储
function savePanelState() {
    const panel = document.getElementById('boss-copilot-panel');
    const state = {
        left: panel.style.left,
        top: panel.style.top,
        width: panel.style.width,
        height: panel.style.height
    };
    chrome.storage.local.set({ 'panelState': state });
}

// 恢复面板状态
function restorePanelState() {
    chrome.storage.local.get(['panelState'], (res) => {
        if (res.panelState) {
            const panel = document.getElementById('boss-copilot-panel');
            if (res.panelState.left) panel.style.left = res.panelState.left;
            if (res.panelState.top) panel.style.top = res.panelState.top;
            if (res.panelState.width) panel.style.width = res.panelState.width;
            if (res.panelState.height) panel.style.height = res.panelState.height;
        }
    });
}

function resetPanelPosition() {
    const panel = document.getElementById('boss-copilot-panel');
    panel.style.left = 'calc(100vw - 400px)';
    panel.style.top = '85px';
    panel.style.width = '380px';
    panel.style.height = '600px';
    savePanelState();
}

function showToast(msg, duration = 3000) {
    let toast = document.getElementById('boss-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'boss-toast';
        toast.className = 'boss-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function generateHashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
}
