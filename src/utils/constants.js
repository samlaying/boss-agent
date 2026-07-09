export const MESSAGE_TYPES = {
  PING: 'PING',
  PONG: 'PONG',
  GET_TAB_INFO: 'GET_TAB_INFO',
  STORAGE_GET: 'STORAGE_GET',
  STORAGE_SET: 'STORAGE_SET',
  STORAGE_REMOVE: 'STORAGE_REMOVE',
  ANALYZE_JOB: 'ANALYZE_JOB',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  OPEN_OPTIONS: 'OPEN_OPTIONS',
  CONTENT_READY: 'CONTENT_READY',
  TRIGGER_SCAN: 'TRIGGER_SCAN',
  SCAN_STATUS: 'SCAN_STATUS',
  EXTRACT_RESUME: 'EXTRACT_RESUME',
  ANALYZE_MATCH: 'ANALYZE_MATCH',
};

export const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  RESUME: 'resume',
  SETTINGS: 'settings',
  ENERGY: 'energy',
  HISTORY: 'analysisHistory',
  RESUME_PDF_RAW: 'resumePdfRaw',
  RESUME_CLEAN: 'resumeClean',
  GREETING_PROMPT: 'greetingPrompt',
  ENABLE_ANALYSIS: 'enableAnalysis',
  ANALYSIS_PROMPT: 'analysisPrompt',
  GREETING_MODEL: 'greetingModel',
  ANALYSIS_MODEL: 'analysisModel',
  CUSTOM_MODELS: 'customModels',
  SETUP_COMPLETED: 'setupCompleted',
  CONFIG_MIGRATED: 'configMigratedV1',
  GREETING_COUNT: 'greetingCount',
  COMPUTE_MODE: 'computeMode',
  CUSTOM_GREETING: 'customGreeting',
  ENABLE_POSTER: 'enablePoster',
  BLOCK_RULES: 'blockRules',
};

export const EVENTS = {
  DOM_UPDATED: 'boss-agent:dom-updated',
  JOB_FOUND: 'boss-agent:job-found',
};

// ── 预置模型 ──────────────────────────────────────────────
export const PRESET_MODELS = [
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash（快速）',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro（深度思考）',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro',
  },
];

/** 默认模型 ID，所有 fallback 统一引用此处 */
export const DEFAULT_MODEL_ID = PRESET_MODELS[0].id;

// ── UI 常量 ───────────────────────────────────────────────
/** 防抖延迟（毫秒） */
export const DEBOUNCE_DELAY = 500;
/** Toast 自动消失时长（毫秒） */
export const TOAST_DURATION = 2000;

// ── 校验阈值 ──────────────────────────────────────────────
/** API Key 最小长度 */
export const API_KEY_MIN_LENGTH = 8;
/** 简历存在性判断阈值（字符数） */
export const RESUME_EXISTS_THRESHOLD = 50;

// ── API 超时 ──────────────────────────────────────────────
/** 通用 API 超时（毫秒） */
export const API_TIMEOUT_DEFAULT = 30000;
/** AI 分析超时（毫秒） */
export const API_TIMEOUT_AI = 60000;
/** 测试连接 max_tokens */
export const TEST_CONNECTION_MAX_TOKENS = 5;

// ── 外部 URL ──────────────────────────────────────────────
export const DEEPSEEK_PLATFORM_URL = 'https://platform.deepseek.com';
export const ZHIPIN_JOB_URL = 'https://www.zhipin.com/web/geek/job-recommend';

// ── 系统提示词 ────────────────────────────────────────────
export const RESUME_EXTRACT_SYSTEM_PROMPT =
  '你是一个简历分析专家。请从用户提供的简历原文中提取关键信息，输出一份精简、结构化的简历。保留：姓名、联系方式、教育背景、实习/工作经历、项目经历、技能。删除冗余描述、重复信息、格式噪音。输出纯文本格式。';

export const ANALYSIS_SYSTEM_PROMPT =
  '你是一个专业的求职顾问。请分析简历与职位的匹配度，给出分数（0-100）和简要分析。';

// ── 默认提示词模板 ────────────────────────────────────────
export const DEFAULT_GREETING_PROMPT =
  '根据以下简历和职位信息，生成一段简洁、专业的打招呼语（50字以内）：\n\n简历：{{resume}}\n职位：{{jobTitle}}\n描述：{{jobDesc}}';

export const DEFAULT_ANALYSIS_PROMPT =
  '请分析以下简历与职位的匹配度，给出 0-100 分和简要理由：\n\n简历：{{resume}}\n职位：{{jobTitle}}\n描述：{{jobDesc}}';

// ── DOM 选择器（zhipin.com） ──────────────────────────────
export const SELECTORS = {
  JOB_CARD: '.job-card-wrapper',
  JOB_NAME: '.job-name',
  COMPANY_NAME: '.company-name',
  SALARY: '.salary',
  JOB_AREA: '.job-area',
};
