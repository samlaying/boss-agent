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
};

export const STORAGE_KEYS = {
  API_KEY: 'apiKey',
  RESUME: 'resume',
  SETTINGS: 'settings',
  ENERGY: 'energy',
  HISTORY: 'analysisHistory',
};

export const EVENTS = {
  DOM_UPDATED: 'weiguang:dom-updated',
  JOB_FOUND: 'weiguang:job-found',
};
