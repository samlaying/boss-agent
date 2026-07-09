// 后台配置读取层（runtimeConfig）：集中读取 STORAGE_KEYS 规范 key，
// 解析模型，迁移老 key。供 background/runtime.js 各 handler 使用。
import { STORAGE_KEYS, PRESET_MODELS, DEFAULT_MODEL_ID } from '../utils/constants.js';
import { storageGet, storageSet } from '../utils/storage.js';

// 纯函数：在 预置+自定义 模型集合中按 id 解析。
// 命中返回 { id, name, endpoint, model }；未命中/空 id 返回 null（调用方回退默认）。
function pickModelById(modelId, presetModels, customModels) {
    if (!modelId) return null;
    const presets = Array.isArray(presetModels) ? presetModels : [];
    const customs = Array.isArray(customModels) ? customModels : [];
    const merged = [...presets, ...customs];
    return merged.find((m) => m && m.id === modelId) || null;
}
