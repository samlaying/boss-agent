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
  GREETING_COUNT: 'greetingCount',
  ENABLE_POSTER: 'enablePoster',
  BLOCK_RULES: 'blockRules',
};

export const EVENTS = {
  DOM_UPDATED: 'boss-agent:dom-updated',
  JOB_FOUND: 'boss-agent:job-found',
};

// 预置模型列表
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

// 默认提示词模板
export const DEFAULT_GREETING_PROMPT =
  '根据以下简历和职位信息，生成一段简洁、专业的打招呼语（50字以内）：\n\n简历：{{resume}}\n职位：{{jobTitle}}\n描述：{{jobDesc}}';

export const DEFAULT_ANALYSIS_PROMPT =
  '请分析以下简历与职位的匹配度，给出 0-100 分和简要理由：\n\n简历：{{resume}}\n职位：{{jobTitle}}\n描述：{{jobDesc}}';
