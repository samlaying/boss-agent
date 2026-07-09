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

// 迁移决策纯函数：老 key(systemPrompt/chatSystemPrompt) → 新 key(analysisPrompt/greetingPrompt)。
// 纯函数约定：入参为归一化对象 { analysisPrompt, greetingPrompt, systemPrompt, chatSystemPrompt, migrated }，
// 仅当新 key 为空且未迁移时搬运；已迁移则什么都不做。返回需要写入的字段（含 shouldMark 标记）。
// 注意：这里刻意用字面量 key（而非 STORAGE_KEYS.*），使其可在测试沙箱中独立 eval（沙箱内无 STORAGE_KEYS）。
function decideLegacyMigration(stored) {
    const migrated = !!(stored && stored.migrated === true);
    if (migrated) return {};
    const out = { shouldMark: true };
    if (!stored.analysisPrompt && stored.systemPrompt) {
        out.analysisPrompt = stored.systemPrompt;
    }
    if (!stored.greetingPrompt && stored.chatSystemPrompt) {
        out.greetingPrompt = stored.chatSystemPrompt;
    }
    return out;
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

// 一次性迁移（幂等）：启动时调用。读旧 key、按决策写新 key、置 CONFIG_MIGRATED。只搬运不删旧 key。
// 这里把原始存储（含 configMigratedV1 等真实 key）归一化为 decideLegacyMigration 约定的入参形状。
export async function migrateLegacyConfig() {
    const stored = await storageGet([
        STORAGE_KEYS.CONFIG_MIGRATED,
        STORAGE_KEYS.ANALYSIS_PROMPT,
        STORAGE_KEYS.GREETING_PROMPT,
        'systemPrompt',
        'chatSystemPrompt',
    ]);
    const decision = decideLegacyMigration({
        migrated: !!(stored && stored[STORAGE_KEYS.CONFIG_MIGRATED] === true),
        analysisPrompt: stored && stored[STORAGE_KEYS.ANALYSIS_PROMPT],
        greetingPrompt: stored && stored[STORAGE_KEYS.GREETING_PROMPT],
        systemPrompt: stored && stored.systemPrompt,
        chatSystemPrompt: stored && stored.chatSystemPrompt,
    });
    if (Object.keys(decision).length === 0) return; // 已迁移
    const toWrite = {};
    if (decision.analysisPrompt) toWrite[STORAGE_KEYS.ANALYSIS_PROMPT] = decision.analysisPrompt;
    if (decision.greetingPrompt) toWrite[STORAGE_KEYS.GREETING_PROMPT] = decision.greetingPrompt;
    toWrite[STORAGE_KEYS.CONFIG_MIGRATED] = true;
    await storageSet(toWrite);
}
