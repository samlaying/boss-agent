// 后台配置读取层（runtimeConfig）：集中读取 STORAGE_KEYS 规范 key、解析模型。
// 供 background/runtime.js 各 handler 使用。
import { STORAGE_KEYS, PRESET_MODELS, DEFAULT_MODEL_ID } from '../utils/constants.js';
import { storageGet } from '../utils/storage.js';

// 纯函数：在 预置+自定义 模型集合中按 id 解析。
// 命中返回 { id, name, endpoint, model }；未命中/空 id 返回 null（调用方回退默认）。
function pickModelById(modelId, presetModels, customModels) {
    if (!modelId) return null;
    const presets = Array.isArray(presetModels) ? presetModels : [];
    const customs = Array.isArray(customModels) ? customModels : [];
    const merged = [...presets, ...customs];
    return merged.find((m) => m && m.id === modelId) || null;
}

// 异步读取：分析用 system prompt（来自配置中心的 analysisPrompt），空返回 null（调用方回退默认）。
export async function getAnalysisSystemPrompt() {
    const d = await storageGet([STORAGE_KEYS.ANALYSIS_PROMPT]);
    return d && d[STORAGE_KEYS.ANALYSIS_PROMPT] ? d[STORAGE_KEYS.ANALYSIS_PROMPT] : null;
}

// 异步读取：话术用 system prompt（来自配置中心的 greetingPrompt），空返回 null。
export async function getGreetingSystemPrompt() {
    const d = await storageGet([STORAGE_KEYS.GREETING_PROMPT]);
    return d && d[STORAGE_KEYS.GREETING_PROMPT] ? d[STORAGE_KEYS.GREETING_PROMPT] : null;
}

// 解析当前应使用的模型。role: 'analysis' | 'greeting'。未配置/未命中返回 null（调用方回退默认）。
export async function resolveModel(role) {
    const key = role === 'analysis' ? STORAGE_KEYS.ANALYSIS_MODEL : STORAGE_KEYS.GREETING_MODEL;
    const d = await storageGet([key, STORAGE_KEYS.CUSTOM_MODELS]);
    const id = (d && d[key]) || DEFAULT_MODEL_ID;
    return pickModelById(id, PRESET_MODELS, (d && d[STORAGE_KEYS.CUSTOM_MODELS]) || []);
}
