// background.js - 终极修复版 (异步通信 + 安全JSON解析 + 超时重试 + 能量模式)

console.log("🚀 微光·求职搭子: Background Service Started");

// 腾讯云 Serverless 代理地址 (请替换为实际部署地址)
const SERVERLESS_URL = "https://1254102186-4c0oxqya5x.ap-guangzhou.tencentscf.com";

// 默认系统提示词 (用于职位分析)
const DEFAULT_SYSTEM_PROMPT = `你是一名【站在我（求职者）这边的资深职业顾问】。
你的核心任务是**为我（求职者）争取最大的利益**。
在分析职位时，请务必从**“我”的视角**出发，判断这个职位是否值得我投递，并挖掘我如何用现有的能力去胜任它。

<analysis_framework>
【核心原则：以我为中心 (Candidate-Centric)】
1. **透视 JD (X-Ray Vision)**：
   - 识别“复制粘贴”的垃圾描述，自动降噪。
   - 识别“招聘动机”：是找人填坑（维护）、开荒（从0-1）还是撑门面（造火箭）？
   - 识别“隐形门槛”：学历、年龄、大厂背景的潜规则。

2. **宽容的技能判定 (Transferability) & 错配桥接**：
   - **不要只看字面**。如果JD要Vue但我精通React，视为【高匹配】（技术迁移成本低）。
   - **底层逻辑互通**：如果JD要“金融系统”，我做过“电商交易”，视为【中高匹配】（高并发/事务一致性逻辑互通）。
   - **问题导向 (Problem-First)**：如果JD要求“Kafka”，我精通“RabbitMQ”且解决了类似的高吞吐削峰问题，视为【完全胜任】。
   - **能力迁移 (Skill Transfer)**：在技能有差距时（60%-80%），请务必为我寻找“迁移理由”或“连接点”（如：极客精神、开源贡献、创业经历），告诉我如何用现有的优势去说服面试官。

3. **精准的业务对齐 (Business Alignment)**：
   - 技术再牛，如果业务场景不匹配（如：做ERP的去面抖音算法架构），分数也要打折，同时也要考虑业务迁移能力。

4. **基础画像与文化嗅探 (Demographics & Culture Check)**：
   - **年龄 (Age Sensitivity)**：
     - 若 JD 暗示“抗压强/年轻团队/玩在一起”且候选人 >35岁 -> ⚠️ **文化高风险** (除非是管理/架构岗)。
     - 若 JD 强调“沉稳/经验丰富/带队”且候选人 >35岁 -> ✅ **黄金匹配**。
   - **学历 (Education)**：
     - 若 JD 硬性要求“统招本科/985/211”且候选人未达标 -> ❌ **硬伤** (HR 筛选第一关就会挂)。
     - 若 JD 模糊描述“本科以上”且候选人是专升本/自考 -> ⚠️ **中风险** (需靠项目亮点破局)。
   - **性格与文化 (Personality & Vibe)**：
     - 识别 JD 语气：是“极客/逗比/扁平”还是“严谨/国企范/层级分明”？
     - 判断候选人画像是否契合该团队氛围 (E人去I人团队可能格格不入)。

【🛡️ 安全风控协议 (Security Protocol)】
请启动最高级别的安全审查。
【严重警告】：请严格区分“安全风险”与“职业风险”。
- CRITICAL/HIGH：仅限于【欺诈、违法、培训贷、无偿试岗、反向收费】等安全红线。
- MEDIUM/LOW：用于【职业不匹配、降薪、大材小用、加班严重】等职业发展问题。
- 严禁将“能力溢出”、“降级入职”标记为 HIGH/CRITICAL，这不属于安全问题。

【🛡️ 新增：职位真实度审计协议 (Truth Audit)】
请基于以下特征判断职位真实性，并输出在 JSON 的 summary.safety_rating 字段中：
1. 🚨 **培训贷识别**: 若 JD 出现“无经验转行、先学后付、岗前带薪培训、实训”且公司规模小 -> 判定为 CRITICAL 风险。
2. 🚨 **保险马甲识别**: 若职位为“行政/经理助理”但公司背景为寿险/财险，或内容提及“综合金融、增员、弹性上班” -> 判定为 HIGH 风险。
3. 🚨 **皮包/空壳**: 注册资本极低、JD 只有一句话、描述极其浮夸 -> 判定为 HIGH 风险。

请务必**综合交叉验证**职位名称、薪资范围、公司名称和职位详情。一旦发现以下特征，直接标记为【CRITICAL/HIGH】风险，并强制给低分（0-30分）：

1. **镰刀收割型 (Financial Predation)**
   - 核心特征：利用求职者急于赚钱的心理，通过合同陷阱反向收费。
   - 🚨 **培训贷**: 敏感词[实训、岗前集训、助学金、先学后付、边工作边还款]。逻辑矛盾[零门槛+超高薪+需要“学习”]。 -> CRITICAL
   - 🚨 **付费入职**: 敏感词[服装费、建档费、保密金、指定医院体检、内推费]。逻辑矛盾[入职前资金流出]。 -> CRITICAL
   - 🚨 **刷单/博彩**: 敏感词[手机兼职、日结、打字员、境外高薪(迪拜/柬埔寨)、BC、棋牌游戏]。逻辑矛盾[极低技能+极高回报]。 -> CRITICAL

2. **挂羊头卖狗肉型 (Bait & Switch)**
   - 核心特征：职位名称是 A（体面），实际工作是 B（销售/苦力）。
   - 🚨 **保险销售**: 敏感词[储备干部、经理助理、售后服务、综合金融、无责任底薪、团队裂变、增员]。逻辑矛盾[管理岗Title+不限学历/经验+强调团队建设]。 -> HIGH
   - 🚨 **虚假管培**: 敏感词[轮岗、管培生(非校招季)、涉及地推/陌拜]。逻辑矛盾[管培生+社招+销售性质描述]。 -> MEDIUM
   - 🚨 **伪装国企/外企**: 敏感词[纯外企、驻办事处、筹备组、15薪、朝九晚五]。逻辑矛盾[高薪+内容空泛+无技能要求]。 -> HIGH
   - 🚨 **皮包公司**: 敏感词[商贸、经营部、个体、工作室、网络科技(无产品)]。逻辑矛盾[小微企业招高管]。 -> HIGH

3. **智力白嫖型 (IP Theft)**
   - 核心特征：利用面试骗取方案。
   - 🚨 **骗方案**: 敏感词[试岗3天(无薪)、全案策划、竞品分析报告、代码测试(>4小时)]。逻辑矛盾[测试题目=公司当前真实业务]。 -> HIGH

4. **血汗工厂型 (Burnout Factory)**
   - 核心特征：薪资看起来正常，但时薪极低，精神压榨。
   - 🚨 **精神PUA**: 敏感词[抗压能力强、拥抱变化、狼性文化、结果导向、不提倡按部就班]。背后含义[996常态、无加班费]。 -> MEDIUM
   - 🚨 **福利陷阱**: 敏感词[弹性工作、扁平化管理、提供晚餐/打车报销]。背后含义[下班不弹、一人干三人的活]。 -> MEDIUM

【⚔️ 进攻策略生成法则 (Offensive Strategy)】
不要只做防守！请挖掘候选人的 2-3 个核心优势（如：大厂背景、全栈能力、项目闭环），生成“高光时刻”话术。
- **核心逻辑**：[我的优势] + [你的痛点] = [完美解法]。
- **话术要求**：主动出击，引导面试官进入我的“舒适区”。
- **⛔ 禁区 (Forbidden)**：严禁将“薪资高/福利好”作为策略依据！薪资是公司的资源，不是我的能力。不要说“展示您在薪资方面的积累”这种胡话。策略必须聚焦于【能力、经验、资源、认知】。

【🔥 面试攻略生成法则 (Interview Strategy Guidelines)】
严禁输出“缺乏xx经验”这种正确的废话。你必须作为候选人的【军师】，为每一个劣势找到【反击/化解的话术】。
**重要禁忌**：
- 严禁将“薪资高/福利好”识别为“短板”或“需要化解的问题”。
- 如果 JD 薪资远超预期，这属于“机会”，不要在【面试攻略】中作为“劣势”处理。
- 生成策略时，强制剔除“薪资/福利”类因素。只谈能力、经验、资源。

请针对检测出的 3 个最大短板，按以下格式生成策略：
1. **针对 [缺失技术/短板]**：
   - 💀 痛点认领：大方承认不熟练（真诚）。
   - 🌉 迁移策略：引用简历中 [某具体强项]，证明底层逻辑相通。
   - 💬 建议金句：“虽然我未在生产环境使用过 X，但我精通 Y，两者的 [核心机制] 是一致的。我曾用 Y 解决了 Z 问题，这证明我有能力快速掌握 X 并解决同类问题。”
2. **针对 [行业不匹配]**：
   - 🔄 价值重构：将原行业的 [特质，如严谨/高并发/流程化] 转化为新行业急需的 [稀缺品质]。
   - 💬 建议金句：“互联网追求速度，但您提到现在业务遇到瓶颈。我 5 年 [传统行业] 经验积累的 [SOP建设/高可用] 能力，正能帮团队补齐‘从快到稳’的短板。”

【🗣️ 开场话术生成法则 (Opening Script Rules)】
必须针对该职位生成 **3 种不同风格** 的开场白 (opening_scripts)，分别对应：
1. 🛡️ 稳健防守型：适合 HR，礼貌、专业、强调匹配度。
2. ⚔️ 痛点狙击型：适合业务主管，直接抛出解决方案，展示野心。
3. 🔥 真诚破冰型：适合跨行或错配，用真诚和学习力打动对方。
**必须严格输出 3 个对象。**
**字数限制**：每条开场白严格控制在 80 字以内；不要出现“你好HR/Hello HR/Dear Manager”等客套开头，直接输出正文。

【🧬 职场基因解码 (Personality Profiling)】
请基于候选人的工作经历和项目描述，进行心理学侧写，推导其内在特质。
**严禁输出“无信息”**。如果没有显性信息，请根据其“在什么岗位呆了多久”来反推。

【🎭 岗位反向侧写 (Job Persona)】
请忽略 JD 里的套话，描绘出 Hiring Manager 脑子里那个‘最想要的人’的具体形象。
回答三个直击灵魂的问题：
1. **灵魂一问：HR 梦中情人的“显性标签”**
   - 不要虚的“沟通良好”，要“一眼定生死”的特征 (如: #大厂背景 #未婚单身 #全栈万金油)。
2. **灵魂二问：这个坑的“最大痛点”是什么？**
   - 为什么会招人？了解“痛苦来源” (如: 前任跑路/屎山代码/老板没想清楚)。
3. **灵魂三问：这个团队的“潜规则”**
   - 嗅探 JD 的行文风格，判断其团队文化偏向 (如: 狼性/草莽/养老)。

【🔭 未来进化推演 (Future Evolution Simulation)】
请完全忽略当前的技能匹配度（那是过去式）。
请基于【AI 时代的技术趋势】和【JD 的业务本质】，推演这份工作在 **未来 3-5 年** 的价值。

1. **AI_Relation (AI 关系)**:
   - 该岗位易被 AI 替代（Fuel），还是能利用 AI 增效（Centaur），还是 AI 无法触达的非标博弈（Chaos Lord）？
   
2. **Entropy_Value (熵值/混乱红利)**:
   - 分析 JD 的模糊程度和业务复杂度。告诉候选人：**如何利用 AI 工具，把眼前的“混乱”变成未来的“资产”？**

3. **Identity_Prediction (终局身份)**:
   - 给候选人画一个饼（真实的饼）。在这个岗位苟住 2 年，他会进化成什么样的新物种？

4. **Contrast_Check (逻辑补丁/差异化警示)**:
   - **必须对比** 'candidate_persona' (个人画像, 如: 填坑专家/操盘手) 和 'job_nature' (岗位本质, 如: 机械执行/流水线)。
   - **触发条件**: 当 个人能力 >= Expert (专家/操盘手) 且 岗位性质 == Fuel (燃料/机械执行) 时。
   - **输出逻辑**: 必须明确指出这种错配的后果。
   - **话术模板**: “警惕！尽管你是 [填坑专家/操盘手]，但该岗位的 [机械属性/低容错] 将限制你的发挥，导致你退化为 [燃料]，恐陷入无效内卷。”

【💡 核心摘要生成指南 (Summary Generation)】
- **Gaps (硬伤/风险)**: 提炼 1-2 个最致命的短板。Label 必须包含图标：
  - ⛔ = 硬伤 (如: 学历/年限不达标)
  - ⚠️ = 风险 (如: 行业跨度大/薪资不匹配)
  - 例如: "⛔ 薪资偏低", "⚠️ 行业偏差"
- **Hooks (亮点/机会)**: 提炼 1-2 个最吸引人的卖点。Label 必须包含图标：
  - ✅ = 经验对口 (如: 核心技能匹配)
  - 🚀 = 能力溢出 (如: 降维打击/带队经验)
  - 例如: "✅ 经验对口", "🚀 能力溢出"
- **Redemption (挽尊/微光)**: 如果分数 < 60 但核心能力匹配，必须生成此字段。告诉用户：“虽然分数低，但因为 [核心强项]，值得一试”。

【输出 JSON 格式要求 (严禁 Markdown)】：
{
  "summary": {
    "score": 0-100,
    "one_line_comment": "一句话核心评价 (如: 核心能力匹配，但薪资略低)",
    "match_level": "S/A/B/C/D",
    "match_status": "逻辑状态(如：赛道错位 / 跨界入局 / 精准命中)",
    "safety_rating": {
       "level": "SAFE / SUSPICIOUS / DANGER",
       "label": "职位真实度结论 (如: 疑似保险代理 / 正常诚招)",
       "warning": "具体的防骗建议，特别是对毕业生的提醒"
    },
    "dimensions": {
        "skills": { "score": 0-100, "label": "S/A/B/C/D", "comment": "微观点评 (如: 核心技术栈完全覆盖)" },
        "experience": { "score": 0-100, "label": "S/A/B/C/D", "comment": "微观点评 (如: 行业背景高度契合)" },
        "salary": { "score": 0-100, "label": "S/A/B/C/D", "comment": "微观点评 (如: 薪资上限低于您当前的底薪)" },
        "macro": { "score": 0-100, "label": "S/A/B/C/D", "comment": "微观点评 (如: 行业处于成熟期，晋升天花板可见)" }
    },
    "gaps": [
      { "label": "硬伤标签 (如: 薪资偏低)", "desc": "简短描述 (如: JD上限低于预期)" }
    ],
    "hooks": [
      { "label": "亮点标签 (如: 经验对口)", "desc": "简短描述 (如: 核心交付管理高度一致)" }
    ],
    "redemption": {
      "has_conflict": true/false,
      "tag": "微光标签 (如: 核心能力 S 级)",
      "rationale": "解释为什么分数低但值得一试"
    }
  },
  "future_scope": {
      "ai_niche": {
        "type": "Fuel/Centaur/Chaos Lord",
        "desc": "如: '半人马模式。核心是决策而非执行，适合接入 Agent 工作流。'"
      },
      "chaos_dividend": "如: '流程极度缺失，正是利用 AI 重构 SOP 并确立话语权的最佳时机。'",
      "endgame_identity": "如: '从 [执行专员] 进化为 [业务流操盘手]。'",
      "contrast_warning": "如: '警惕！尽管你是[填坑专家]，但该岗位的[机械属性]将限制你的发挥...' (仅在 Fuel 且 个人能力强时输出，否则为空字符串)"
  },
  "hiring_motive": {
    "type": "填坑/开荒/造火箭/未知",
    "confidence": "High/Medium/Low",
    "analysis": "简短分析"
  },
  "jd_quality": {
    "score": 0-100,
    "is_copy_paste": true/false,
    "noise_tags": ["废话标签"]
  },
  "radar_values": {
    "hard_skills": 0-100,
    "business_fit": 0-100,
    "stability": 0-100,
    "potential": 0-100,
    "cost_performance": 0-100
  },
  "risk_assessment": {
    "level": "SAFE/MEDIUM/HIGH/CRITICAL",
    "risk_score": 0-100,
    "risk_labels": ["风险点"],
    "analysis": "风控结论"
  },
  "detailed_analysis": {
    "pros": ["优势1", "优势2"],
    "cons": ["劣势1", "劣势2"]
  },
  "personality_insight": {
    "archetype": "请用一个名词定义他 (如: 填坑专家 / 破局者 / 守夜人)",
    "drive": "推测他的核心驱动力 (如: 对完美的执着 / 对解决问题的痴迷)",
    "keywords": ["关键词1", "关键词2"]
  },
  "job_insight": {
    "avatar": "他们在找谁 (如: 又能干活又不贵的救火队长)",
    "keywords": ["#显性标签1", "#显性标签2"],
    "pain_point": "这个坑的最大痛点 (如: 历史代码无法维护)",
    "culture_smell": "团队气味 (如: 狼性/草莽)",
    "hidden_keys": ["通关密码1", "通关密码2"]
  },
  "resume_logic": {
    "timeline_gap": { "has_gap": false, "desc": "无空窗期" },
    "age_edu_match": { "status": "high/medium/low", "age_analysis": "年龄分析", "edu_analysis": "学历分析" },
    "culture_fit": { "score": 0-100, "vibe_check": "文化契合度分析" },
    "job_hopping": { "frequency": "low/medium/high", "desc": "跳槽频率" },
    "verdict": "一句话侦探结论"
  },
  "transferability": {
    "analysis": ["能力迁移点1: 虽然..., 但是...", "能力迁移点2: ..."],
    "onboarding_difficulty": "High/Medium/Low"
  },
  "swot_analysis": {
    "strengths": ["S1"],
    "weaknesses": ["W1"],
    "opportunities": ["O1"],
    "threats": ["T1"]
  },
  "life_fit_analysis": {
    "work_life_balance": { "status": "high/medium/low", "desc": "简述" },
    "financial_security": { "status": "high/medium/low", "desc": "简述" },
    "verdict": "一句话判词"
  },
  "interview_guide": {
    "strategies": [
      {
        "weakness": "短板/痛点 (如: 前端技术栈缺失)",
        "strategy": "策略 (如: 打“底层通透”牌)",
        "script": "话术 (如: 虽然我没用过X，但我精通Y...)"
      }
    ],
    "opening_scripts": [
        {
            "style": "🛡️ 稳健防守型 (The Professional)",
            "content": "张总您好，...",
            "rationale": "适用 HR / 大厂流程。强调：[匹配度 + 稳定性 + 随时到岗]。"
        },
        {
            "style": "⚔️ 痛点狙击型 (The Sniper)",
            "content": "张总您好，...",
            "rationale": "适用业务负责人 / 急招。强调：[我能解决你的麻烦 + 我有现成方案]。"
        },
        {
            "style": "🔥 真诚破冰型 (The Storyteller)",
            "content": "张总您好，虽然...",
            "rationale": "适用跨行 / 岗位匹配度低。强调：[学习力 + 性价比 + 长期主义]。"
        }
    ]
  },
  "future_scope": {
    "ai_niche": {
      "type": "Fuel/Centaur/Chaos Lord",
      "desc": "如: '半人马模式。核心是决策而非执行，适合接入 Agent 工作流。'"
    },
    "chaos_dividend": "如: '流程极度缺失，正是利用 AI 重构 SOP 并确立话语权的最佳时机。'",
    "endgame_identity": "如: '从 [执行专员] 进化为 [业务流操盘手]。'",
    "contrast_warning": "如: '警惕！尽管你是[填坑专家]，但该岗位的[机械属性]将限制你的发挥...'"
  }
}`;

// 用于生成整体配置的Prompt
const CONFIG_GEN_PROMPT = `
你是一名【首席人才官 (CHO) 级别的简历架构师】。
你的任务是深度解析候选人的简历，提取关键信息，以便生成一套专属的 AI 招聘助手配置。
同时，你也是候选人的【军师】，在生成面试攻略时，必须采用“机甲操作指南”风格，为每一个劣势找到【反击/化解的话术】。
严禁输出“缺乏xx经验”这种正确的废话。
针对检测出的 3 个最大短板，按以下逻辑生成策略：
1. **针对 [缺失技术/短板]**：
   - 💀 痛点认领：大方承认不熟练（真诚）。
   - 🌉 迁移策略：引用简历中 [某具体强项]，证明底层逻辑相通。
   - 💬 建议金句：“虽然我未在生产环境使用过 X，但我精通 Y，两者的 [核心机制] 是一致的...”
2. **针对 [行业不匹配]**：
   - 🔄 价值重构：将原行业的 [特质] 转化为新行业急需的 [稀缺品质]。
   - 💬 建议金句：“互联网追求速度，但您提到现在业务遇到瓶颈。我 5 年 [传统行业] 经验积累的 [SOP建设] 能力，正能帮团队补齐短板。”

请阅读下方的【用户简历】，并以严格的 JSON 格式输出以下字段（不要输出 Markdown，不要包含注释）：

【用户简历】：
"""{{RESUME_INPUT}}"""

【输出 JSON 格式要求】：
{
  "resume_analysis": {
    "core_archetype": "一句话定义用户画像 (例如：'擅长高并发治理的实战型架构师')",
    "years_audit": "工作年限",
    "hard_strengths": ["硬技能1", "硬技能2"],
    "soft_strengths": ["软实力1", "软实力2"]
  },
  "candidate_persona": "我是：{{一句话总结，包含年限、核心领域、差异化优势}}。",
  "skill_transfer_logic": [
    "1. **核心栈**：{{列出最强栈}} -> 必须命中。",
    "2. **可迁移栈**：{{列出迁移逻辑，如 React->Vue}}。",
    "3. **通用底层**：{{列出底层能力}} -> 核心加分项。"
  ],
  "jd_match_logic": [
    "1. **判断招聘动机**：",
    "   - *填坑/救火* -> 匹配我的 {{稳定性/排查能力}}。",
    "   - *开荒/新建* -> 匹配我的 {{全栈/领队能力}}。",
    "2. **一票否决线**：",
    "   - 薪资上限 < {{最低期望}} -> 降薪风险。",
    "   - 学历要求 > {{学历}} -> 扣分。"
  ],
  "system_prompt": "你是一名【资深招聘专家】。请基于以下求职者画像进行职位分析：\\n\\n【求职者画像】\\n{{candidate_persona}}\\n\\n【技能迁移逻辑】\\n{{skill_transfer_logic}}\\n\\n【JD匹配策略】\\n{{jd_match_logic}}\\n\\n请严格基于以上信息，对用户提供的 JD 进行深度剖析，输出匹配评分(0-100)、核心优势、潜在风险及3-5个面试押题，并给出相应的面试对策。\\n\\n【⛔ 策略禁区】\\n严禁将“薪资高/福利好”作为策略依据！薪资是公司的资源，不是我的能力。策略必须聚焦于【能力、经验、资源】如何配得上这份高薪。\\n\\n【🔭 逻辑补丁：差异化警示】\\n在生成 future_scope 时，必须对比 candidate_persona (个人) 和 job_nature (岗位)。\\n如果 个人是“专家/操盘手”，而 岗位是“燃料/执行”，必须输出 contrast_warning，明确指出“大材小用/入职即贬值”的风险。",
  "chat_system_prompt": "你代表求职者。你的核心卖点是：{{卖点}}。遇到技术型面试官，强调：{{技术词}}。遇到HR，强调：{{稳定性}}。风格：自信、专业。",
  "keyword_arsenal": {
    "核心匹配": ["词1", "词2"],
    "高亮加分": ["词1", "词2"],
    "避坑关键词": ["词1", "词2"]
  }
}
`;

// 默认系统提示词 (用于打招呼生成)
const DEFAULT_CHAT_SYSTEM_PROMPT = `你代表求职者。你的风格：自信、专业、简洁。请基于岗位要求生成一段自然得体的打招呼话术。`;

// ===============================================
// 🛡️ 隐私脱敏工具函数
// ===============================================
function maskPII(text) {
    if (!text) return "";
    text = text.replace(/(^|[^0-9])(1[3-9]\d{2})[- ]?(\d{4})[- ]?(\d{4})([^0-9]|$)/g, '$1$2****$4$5');
    text = text.replace(/([a-zA-Z0-9._%+-]{1,3})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***$2');
    text = text.replace(/(姓名|Name)([:：\s]+)([\u4e00-\u9fa5]{1})[\u4e00-\u9fa5]{1,3}/gi, '$1$2$3**');
    return text;
}

// ===============================================
// 🛠️ 工具函数：带超时和重试的 Fetch
// ===============================================
async function fetchWithRetry(url, options, retries = 3, timeout = 300000) { // 默认超时改为 300s (5分钟) 以匹配云函数
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        // 支持外部传入的 signal (用于用户手动停止)
        if (options.signal) {
            if (options.signal.aborted) {
                controller.abort();
            } else {
                options.signal.addEventListener('abort', () => controller.abort());
            }
        }

        const config = { ...options, signal: controller.signal };

        try {
            console.log(`📡 API Request Attempt ${i + 1}/${retries}... (Timeout: ${timeout/1000}s)`);
            const response = await fetch(url, config);
            clearTimeout(id);
            
            if (!response.ok && response.status >= 500 && i < retries - 1) {
                console.warn(`⚠️ API 5xx Error (${response.status}), retrying...`);
                await new Promise(r => setTimeout(r, 1000 * (i + 1))); 
                continue;
            }
            return response;
        } catch (error) {
            clearTimeout(id);
            const isLastAttempt = i === retries - 1;
            console.warn(`⚠️ Fetch Error (Attempt ${i + 1}):`, error.message);
            
            // 如果是用户手动取消，直接抛出，不重试
            if (options.signal && options.signal.aborted) {
                 throw error;
            }

            if (isLastAttempt) {
                if (error.name === 'AbortError') {
                    throw new Error(`请求超时(>${timeout/1000}s)，DeepSeek响应过慢或云函数超时`);
                }
                throw error;
            }
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

// ===============================================
// 🔑 核心业务逻辑
// ===============================================

// 生成 UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 处理 Key 核销的逻辑 (提取为单独函数)
async function handleRedeemDailyKey(key, sendResponse) {
    try {
        const userInput = key ? key.trim() : "";
        console.log(`[StrictRedeem] 处理输入: "${userInput}"`);

        if (!userInput) {
            sendResponse({ success: false, error: "无效的暗号" });
            return;
        }

        // === 智能识别流程 ===
        // 严格模式：所有 Key 获取必须走公众号 (Coze) 流程
        // 插件端只负责核销 (redeem)，不负责领票 (get_daily_key)

        // 1. 格式校验 (GM-MMDD-XXXXXX 或 PARTNER-MMDD-XXXXXX)
        // 允许前缀为 GM 或 PARTNER，中间是4位数字(MMDD)，后面是6位字符
        const validFormat = /^(GM|PARTNER)-\d{4}-[A-Z0-9]{6}$/;

        if (!validFormat.test(userInput)) {
            console.warn(`[StrictRedeem] 拦截无效格式输入: ${userInput}`);
            
            let errorMsg = "格式错误。";
            // 针对常见错误输入的友好提示
            if (userInput === "1" || userInput.includes("加油") || userInput.includes("暗号")) {
                        errorMsg = "请前往公众号【旷野里的猫-AI】\n回复 '1' 获取今日暗号\n(格式如 GM-0520-XXXXXX)";
                    } else if (userInput.toUpperCase().startsWith("VTOKEN")) {
                        errorMsg = "请前往公众号发送此兑换码\n激活您的同行者权益并获取暗号\n(格式如 PARTNER-XXXXXX)";
                    } else {
                         errorMsg = "无效暗号。请检查格式 (GM-MMDD-XXXXXX)\n或前往公众号【旷野里的猫-AI】获取";
                    }
            
            sendResponse({ success: false, error: errorMsg });
            return;
        }
        
        // 2. 执行核销 (redeem_daily_key)
        // 只有格式正确的 Key 才会发起网络请求
        console.log(`🔥 [StrictRedeem] 格式校验通过，开始核销: ${userInput}`);
        
        const redeemRes = await fetchWithRetry(SERVERLESS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "redeem_daily_key",
                key: userInput
            })
        });

        const redeemData = await redeemRes.json();

        if (redeemData.success) {
            // 核销成功，增加本地能量
            const addedEnergy = redeemData.added_energy || 30;
            const { energyCount = 0 } = await chrome.storage.local.get("energyCount");
            const newEnergy = energyCount + addedEnergy;

            // 存储最新的 Key 以便后续请求带上
            await chrome.storage.local.set({ energyCount: newEnergy, userKey: userInput });
            
            // 组合提示信息
            let finalMsg = `✅ 充能成功！能量 +${addedEnergy}`;
            sendResponse({ success: true, newEnergy: newEnergy, addedEnergy: addedEnergy, message: finalMsg });
        } else {
            sendResponse({ success: false, error: redeemData.error || "核销失败" });
        }

    } catch (error) {
        console.error("❌ 处理流程异常:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// === 请求控制器 (用于停止分析) ===
const activeRequests = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // === 停止分析接口 ===
    if (request.action === "stop_analysis") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId && activeRequests.has(tabId)) {
            console.log(`🛑 [Background] 收到停止信号，中止 Tab ${tabId} 的请求`);
            activeRequests.get(tabId).abort();
            activeRequests.delete(tabId);
        }
        return;
    }

    // === 职位分析接口 ===
    if (request.action === "call_deepseek") {
        console.log("🎯 收到职位分析请求...");
        const { jobText, hrName, bossTitle } = request;

        // 并行获取所有配置
        chrome.storage.local.get(['apiKey', 'systemPrompt', 'resume', 'computeMode', 'energyCount', 'clientId', 'userKey'], async (data) => {
            try {
                // 0. 初始化 Client ID
                let clientId = data.clientId;
                if (!clientId) {
                    clientId = generateUUID();
                    chrome.storage.local.set({ clientId });
                }

                // 1. 确定计算模式 (默认 energy)
                const computeMode = data.computeMode || 'energy';
                
                // 2. 模式分支
                if (computeMode === 'custom_key') {
                    // === 模式 A: 自有 Key 直连 ===
                    if (!data.apiKey) {
                        sendResponse({ success: false, error: "请先在插件配置中输入 DeepSeek API Key" });
                        return;
                    }
                    await handleDirectCall(data.apiKey, data.systemPrompt, data.resume, jobText, hrName, bossTitle, sendResponse, sender.tab.id);
                } else {
                    // 检查能量 (分析职位，扣 1 点)
                    const energy = data.energyCount !== undefined ? data.energyCount : 3;
                    if (energy < 1) {
                        sendResponse({ success: false, error: "ENERGY_EXHAUSTED" });
                        return;
                    }
                    await handleServerlessCall(clientId, data.systemPrompt, data.resume, jobText, hrName, bossTitle, sendResponse, sender.tab.id, data.userKey);
                }

            } catch (error) {
                console.error("❌ 处理流程异常:", error);
                sendResponse({ success: false, error: error.message });
            }
        });

        return true; // 保持消息通道开启
    }

    // === 打招呼生成接口 ===
    if (request.action === "generate_greeting") {
        console.log("💬 收到打招呼生成请求...");
        const { jobText, hrName, bossTitle } = request;

        chrome.storage.local.get(['apiKey', 'chatSystemPrompt', 'resume', 'computeMode', 'energyCount', 'clientId', 'userKey'], async (data) => {
            try {
                let clientId = data.clientId;
                if (!clientId) {
                    clientId = generateUUID();
                    chrome.storage.local.set({ clientId });
                }

                const computeMode = data.computeMode || 'energy';

                if (computeMode === 'custom_key') {
                    if (!data.apiKey) {
                        sendResponse({ success: false, error: "请先在插件配置中输入 DeepSeek API Key" });
                        return;
                    }
                    await handleDirectGreetingCall(
                        data.apiKey,
                        data.chatSystemPrompt,
                        data.resume,
                        jobText,
                        hrName,
                        bossTitle,
                        sendResponse,
                        sender.tab ? sender.tab.id : null
                    );
                } else {
                    const energy = data.energyCount !== undefined ? data.energyCount : 3;
                    if (energy < 1) {
                        sendResponse({ success: false, error: "ENERGY_EXHAUSTED" });
                        return;
                    }
                    await handleServerlessGreetingCall(
                        clientId,
                        data.chatSystemPrompt,
                        data.resume,
                        jobText,
                        hrName,
                        bossTitle,
                        sendResponse,
                        sender.tab ? sender.tab.id : null,
                        data.userKey
                    );
                }
            } catch (error) {
                console.error("❌ 处理流程异常:", error);
                sendResponse({ success: false, error: error.message });
            }
        });

        return true;
    }

    if (request.action === "open_chat_tab") {
        const url = request.url;
        if (!url) {
            sendResponse({ success: false, error: "Missing url" });
            return;
        }
        chrome.tabs.create({ url }, () => {
            const err = chrome.runtime.lastError;
            if (err) {
                sendResponse({ success: false, error: err.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;
    }

    if (request.action === "close_tab") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (!tabId) {
            sendResponse({ success: false, error: "Missing tab id" });
            return;
        }
        chrome.tabs.get(tabId, (tab) => {
            const getErr = chrome.runtime.lastError;
            if (getErr || !tab) {
                sendResponse({ success: false, error: getErr ? getErr.message : "Tab not found" });
                return;
            }
            const url = tab.url || "";
            const isChatTab = url.includes("/web/geek/chat") || url.includes("/chat");
            const isJobDetailTab = url.includes("/job_detail/");
            if (!isChatTab && !isJobDetailTab) {
                sendResponse({ success: false, error: "not_chat" });
                return;
            }
            chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
                const lastTab = !tabs || tabs.length <= 1;
                if (lastTab) {
                    sendResponse({ success: false, error: "last_tab" });
                    return;
                }
                chrome.tabs.remove(tabId, () => {
                    const err = chrome.runtime.lastError;
                    if (err) {
                        sendResponse({ success: false, error: err.message });
                    } else {
                        sendResponse({ success: true });
                    }
                });
            });
        });
        return true;
    }

    // === 生成配置接口 ===
    if (request.action === "generate_config") {
        const { resume } = request;
        chrome.storage.local.get(['apiKey', 'computeMode', 'clientId', 'energyCount', 'userKey'], async (data) => {
            
            const computeMode = data.computeMode || 'energy';
            
            // 模式 A: 自有 Key
            if (computeMode === 'custom_key') {
                if (!data.apiKey) {
                    sendResponse({ success: false, error: "请先输入 API Key" });
                    return;
                }
                await handleDirectConfigGen(data.apiKey, resume, sendResponse);
            } 
            // 模式 B: 能量模式
            else {
                // 检查能量 (生成配置比较贵，但统一为 1 点)
                const energy = data.energyCount !== undefined ? data.energyCount : 3;
                if (energy < 1) {
                    sendResponse({ success: false, error: "ENERGY_EXHAUSTED" });
                    return;
                }
                
                // 初始化 Client ID
                let clientId = data.clientId;
                if (!clientId) {
                    clientId = generateUUID();
                    chrome.storage.local.set({ clientId });
                }

                await handleServerlessConfigGen(clientId, resume, sendResponse, data.userKey);
            }
        });
        return true;
    }

    // 监听核销请求
    if (request.action === "redeem_daily_key") {
        console.log("[Background] Received redeem request:", request);
        // 直接调用处理函数
        handleRedeemDailyKey(request.key, sendResponse);
        return true; // 保持消息通道开启
    }

    // === 脚本注入服务 (解决 CSP 问题) ===
    if (request.action === "inject_main_world_scripts") {
        console.log("💉 收到脚本注入请求，Tab ID:", sender.tab.id);
        
        // 1. 先读取配置
        chrome.storage.local.get(['enableLabMode'], (res) => {
            const isLabMode = res.enableLabMode === true;
            
            // 2. 先注入配置标志 (Main World)
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: (mode) => {
                    if (mode) {
                        localStorage.setItem('BOSS_HELPER_LAB_MODE', 'true');
                    } else {
                        localStorage.removeItem('BOSS_HELPER_LAB_MODE');
                    }
                },
                args: [isLabMode],
                world: 'MAIN'
            }).then(() => {
                // 3. 再注入核心脚本 (Main World)
                return chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    files: ['spa_monitor.js', 'injected_probe.js'],
                    world: 'MAIN'
                });
            }).then(() => {
                console.log("✅ Main World Scripts Injected Successfully (LabMode: " + isLabMode + ")");
                sendResponse({ success: true });
            }).catch(err => {
                console.error("❌ Script Injection Failed:", err);
                sendResponse({ success: false, error: err.message });
            });
        });
        
        return true; // 保持异步通道
    }
});

// === 辅助函数：获取 ClientID ===
async function getClientId() {
    return new Promise(resolve => {
        chrome.storage.local.get(['clientId'], (data) => {
            if (data.clientId) {
                resolve(data.clientId);
            } else {
                const newId = generateUUID();
                chrome.storage.local.set({ clientId: newId });
                resolve(newId);
            }
        });
    });
}

// === 处理直连生成配置 ===
async function handleDirectConfigGen(apiKey, resume, sendResponse) {
    try {
        // 1. 替换 Prompt 中的变量
        const prompt = CONFIG_GEN_PROMPT.replace("{{RESUME_INPUT}}", resume);
        
        // 2. 调用 API
        const payload = {
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 1.1,
            response_format: { type: "json_object" }
        };

        const response = await fetchWithRetry("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.error) throw new Error(result.error.message);

        let content = result.choices[0].message.content;
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResult = JSON.parse(content);

        sendResponse({ success: true, data: jsonResult });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

// === 处理 Serverless 生成配置 ===
async function handleServerlessConfigGen(clientId, resume, sendResponse, userKey) {
    // 检查 URL 配置
    if (SERVERLESS_URL.includes("service-xxxx")) {
        sendResponse({ success: false, error: "Serverless 后端未部署，请先配置 background.js 中的 URL" });
        return;
    }

    try {
        // 1. 在前端统一生成 Prompt (包含脱敏)
        const maskedResume = maskPII(resume);
        const prompt = CONFIG_GEN_PROMPT.replace("{{RESUME_INPUT}}", maskedResume);

        // 2. 发送完整 Prompt 给云函数 (云函数只做透传)
        const response = await fetchWithRetry(SERVERLESS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "generate_config",
                clientId,
                prompt, // 直接发送组装好的 Prompt
                key: userKey
            })
        });
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        // 扣除本地能量 (修正为 1 点)
        chrome.storage.local.get(['energyCount'], (res) => {
            const current = res.energyCount || 0;
            chrome.storage.local.set({ energyCount: Math.max(0, current - 1) });
        });

        sendResponse({ success: true, data: result.data });
    } catch (e) {
        sendResponse({ success: false, error: e.message });
    }
}

// === 辅助函数：构建分析 Prompt ===
function constructAnalyzeUserPrompt(resume, jobText, hrName, bossTitle) {
    return `
【求职者简历】：
"""${resume || "（未提供简历，请基于通用标准分析）"}"""

【目标职位】：
招聘者：${hrName} (${bossTitle})
职位详情：
"""${jobText}"""

(请务必以 JSON 格式输出)
`.trim();
}

// === 辅助函数：构建打招呼 Prompt ===
function constructGreetingUserPrompt(resume, jobText, hrName, bossTitle) {
    return `
【求职者简历】：
"""${resume || "（未提供简历，请基于通用背景生成）"}"""

【目标职位】：
招聘者：${hrName} (${bossTitle})
职位详情：
"""${jobText}"""

请生成 1 段简洁自然的打招呼话术（1-3 句），只输出文本，不要 JSON，不要解释。
`.trim();
}

// === 处理直连调用 ===
async function handleDirectCall(apiKey, systemPrompt, resume, jobText, hrName, bossTitle, sendResponse, tabId) {
    // 准备 System Prompt
    let sysPrompt = prepareSystemPrompt(systemPrompt);

    const userPrompt = constructAnalyzeUserPrompt(resume, jobText, hrName, bossTitle);

    const payload = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 1.3,
        response_format: { type: "json_object" }
    };

    // 创建 AbortController
    const controller = new AbortController();
    if (tabId) {
        activeRequests.set(tabId, controller);
    }

    try {
        const response = await fetchWithRetry("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal // 绑定信号
        });

        const result = await response.json();
        
        if (result.error) {
            throw new Error(`DeepSeek API Error: ${result.error.message}`);
        }

        let content = result.choices[0].message.content;
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonResult = JSON.parse(content);
        
        sendResponse({ success: true, data: jsonResult });

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("🛑 Request Aborted by User (Direct Mode)");
            sendResponse({ success: false, error: "用户已取消" });
        } else {
            console.error("DeepSeek API Call Failed:", error);
            sendResponse({ success: false, error: error.message });
        }
    } finally {
        // 清理控制器
        if (tabId && activeRequests.has(tabId)) {
            activeRequests.delete(tabId);
        }
    }
}

// === 处理 Serverless 调用 ===
async function handleServerlessCall(clientId, systemPrompt, resume, jobText, hrName, bossTitle, sendResponse, tabId, userKey) {
    // 准备 System Prompt
    let sysPrompt = prepareSystemPrompt(systemPrompt);
    
    // 检查 URL 是否已配置
    if (!SERVERLESS_URL || SERVERLESS_URL.includes("service-xxxx")) {
        console.warn("⚠️ Serverless URL 未配置");
        sendResponse({ success: false, error: "Serverless URL 未配置，请修改 background.js 并刷新插件" });
        return;
    }

    // 创建 AbortController
    const controller = new AbortController();
    if (tabId) {
        activeRequests.set(tabId, controller);
    }

    try {
        // 在前端构建 Prompt，并进行脱敏
        const maskedResume = maskPII(resume);
        const userPrompt = constructAnalyzeUserPrompt(maskedResume, jobText, hrName, bossTitle);

        console.log("📡 Sending request to Serverless:", SERVERLESS_URL);
        const response = await fetchWithRetry(SERVERLESS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "call_deepseek",
                clientId,
                sysPrompt,
                userPrompt,
                key: userKey
            }),
            signal: controller.signal // 绑定信号
        });

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || "Serverless Error");
        }
        
        // 扣除本地能量 (修正为 1 点)
        chrome.storage.local.get(['energyCount'], (res) => {
            const current = res.energyCount || 0;
            // 修正：分析一次只扣 1 点，与文档一致
            chrome.storage.local.set({ energyCount: Math.max(0, current - 1) });
        });

        sendResponse({ success: true, data: result.data });
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log("🛑 Request Aborted by User");
            sendResponse({ success: false, error: "用户已取消" });
        } else {
            console.error("❌ Serverless Call Failed:", e);
            const errorMsg = e.message || "未知错误";
            // 如果是已知的业务错误，不加前缀，保持整洁
            // 使用正则匹配更稳健
            if (/Free limit/i.test(errorMsg) || /Invalid Key/i.test(errorMsg) || /Rate limit/i.test(errorMsg)) {
                sendResponse({ success: false, error: errorMsg });
            } else {
                sendResponse({ success: false, error: "后端连接失败: " + errorMsg });
            }
        }
    } finally {
        // 清理控制器
        if (tabId && activeRequests.has(tabId)) {
            activeRequests.delete(tabId);
        }
    }
}

// === 处理直连打招呼调用 ===
async function handleDirectGreetingCall(apiKey, chatSystemPrompt, resume, jobText, hrName, bossTitle, sendResponse, tabId) {
    const sysPrompt = prepareChatSystemPrompt(chatSystemPrompt);
    const userPrompt = constructGreetingUserPrompt(resume, jobText, hrName, bossTitle);

    const payload = {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 1.1
    };

    const controller = new AbortController();
    if (tabId) {
        activeRequests.set(tabId, controller);
    }

    try {
        const response = await fetchWithRetry("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(`DeepSeek API Error: ${result.error.message}`);
        }

        let content = result.choices[0].message.content || "";
        content = content.replace(/```/g, '').trim();
        sendResponse({ success: true, data: content });
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("🛑 Greeting Request Aborted by User (Direct Mode)");
            sendResponse({ success: false, error: "用户已取消" });
        } else {
            console.error("DeepSeek Greeting Call Failed:", error);
            sendResponse({ success: false, error: error.message });
        }
    } finally {
        if (tabId && activeRequests.has(tabId)) {
            activeRequests.delete(tabId);
        }
    }
}

// === 处理 Serverless 打招呼调用 ===
async function handleServerlessGreetingCall(clientId, chatSystemPrompt, resume, jobText, hrName, bossTitle, sendResponse, tabId, userKey) {
    const sysPrompt = prepareChatSystemPrompt(chatSystemPrompt);

    if (!SERVERLESS_URL || SERVERLESS_URL.includes("service-xxxx")) {
        console.warn("⚠️ Serverless URL 未配置");
        sendResponse({ success: false, error: "Serverless URL 未配置，请修改 background.js 并刷新插件" });
        return;
    }

    const controller = new AbortController();
    if (tabId) {
        activeRequests.set(tabId, controller);
    }

    try {
        const maskedResume = maskPII(resume);
        const userPrompt = constructGreetingUserPrompt(maskedResume, jobText, hrName, bossTitle);

        const response = await fetchWithRetry(SERVERLESS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "generate_greeting",
                clientId,
                sysPrompt,
                userPrompt,
                key: userKey
            }),
            signal: controller.signal
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Serverless Error");
        }

        chrome.storage.local.get(['energyCount'], (res) => {
            const current = res.energyCount || 0;
            chrome.storage.local.set({ energyCount: Math.max(0, current - 1) });
        });

        sendResponse({ success: true, data: result.data });
    } catch (e) {
        if (e.name === 'AbortError') {
            console.log("🛑 Greeting Request Aborted by User");
            sendResponse({ success: false, error: "用户已取消" });
        } else {
            console.error("❌ Serverless Greeting Call Failed:", e);
            const errorMsg = e.message || "未知错误";
            if (/Free limit/i.test(errorMsg) || /Invalid Key/i.test(errorMsg) || /Rate limit/i.test(errorMsg)) {
                sendResponse({ success: false, error: errorMsg });
            } else {
                sendResponse({ success: false, error: "后端连接失败: " + errorMsg });
            }
        }
    } finally {
        if (tabId && activeRequests.has(tabId)) {
            activeRequests.delete(tabId);
        }
    }
}

// === 辅助函数：准备 Prompt ===
function prepareSystemPrompt(userSystemPrompt) {
    // 如果用户自定义了 Prompt，用用户的；否则用默认的。
    // 这里不再做复杂的自动注入，因为默认 Prompt 已经是最新的了。
    // 只有当用户用了旧版 Prompt 时才需要注入。
    
    let sysPrompt = userSystemPrompt || DEFAULT_SYSTEM_PROMPT;
    
    // 简单检查是否包含新的 JSON 结构字段 (新增对 opening_scripts 的检查)
    if ((!sysPrompt.includes("opening_scripts") || !sysPrompt.includes("resume_logic")) && userSystemPrompt) {
        // 如果用户自定义了旧版 Prompt，强制追加新版 JSON 格式要求
        sysPrompt += `\n\n【重要修正：输出格式必须符合最新标准】\n${DEFAULT_SYSTEM_PROMPT.split("【输出 JSON 格式要求 (严禁 Markdown)】：")[1]}`;
    }
    
    return sysPrompt;
}

function prepareChatSystemPrompt(chatSystemPrompt) {
    return chatSystemPrompt || DEFAULT_CHAT_SYSTEM_PROMPT;
}
