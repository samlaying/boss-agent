import { storageGet } from '../../utils/storage.js';
import {
  STORAGE_KEYS,
  PRESET_MODELS,
  DEFAULT_MODEL_ID,
  API_TIMEOUT_AI,
  RESUME_EXTRACT_SYSTEM_PROMPT,
  ANALYSIS_SYSTEM_PROMPT,
  DEFAULT_ANALYSIS_PROMPT,
} from '../../utils/constants.js';

const API_TIMEOUT = API_TIMEOUT_AI;

/**
 * 获取模型配置（预置 + 自定义）
 */
async function resolveModel(modelId) {
  const preset = PRESET_MODELS.find((m) => m.id === modelId);
  if (preset) return preset;

  const { [STORAGE_KEYS.CUSTOM_MODELS]: customModels = [] } = await storageGet([
    STORAGE_KEYS.CUSTOM_MODELS,
  ]);
  const custom = customModels.find((m) => m.id === modelId);
  if (custom) return custom;

  // 默认用 deepseek-v4-flash
  return PRESET_MODELS[0];
}

/**
 * 调用 LLM API（带超时和日志）
 */
async function callLLM({ endpoint, apiKey, model, messages }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
  const url = `${endpoint}/chat/completions`;

  console.log('[AI] 调用:', url, '模型:', model);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI] API 错误:', response.status, errorText);
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log('[AI] 返回成功, 长度:', content.length);
    return content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`请求超时（${API_TIMEOUT / 1000}秒），请检查网络或换用更快的模型`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 提取简历 - 从原始文本中提取精简简历
 */
export async function extractResume(payload, _sender) {
  const { resumeRaw } = payload;
  console.log('[AI] extractResume 收到请求, 文本长度:', resumeRaw?.length);

  if (!resumeRaw) return { error: '缺少简历原文' };

  const { [STORAGE_KEYS.API_KEY]: apiKey } = await storageGet([STORAGE_KEYS.API_KEY]);
  console.log('[AI] API Key:', apiKey ? '已配置 (' + apiKey.slice(0, 8) + '...)' : '未配置');

  if (!apiKey) return { error: '请先在设置中配置 API Key' };

  const modelConfig = await resolveModel(DEFAULT_MODEL_ID);
  console.log('[AI] 使用模型:', modelConfig.model);

  const messages = [
    {
      role: 'system',
      content: RESUME_EXTRACT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `请提取以下简历的关键信息：\n\n${resumeRaw}`,
    },
  ];

  try {
    const result = await callLLM({
      endpoint: modelConfig.endpoint,
      apiKey: modelConfig.apiKey || apiKey,
      model: modelConfig.model,
      messages,
    });
    return { success: true, resumeClean: result };
  } catch (err) {
    console.error('[AI] extractResume 失败:', err);
    return { error: `AI 提取失败: ${err.message}` };
  }
}

/**
 * 分析匹配度 - 分析简历与岗位的匹配度
 */
export async function analyzeMatch(payload, _sender) {
  const { resume, jobTitle, jobDesc, hrName, companyName, promptTemplate } = payload;
  if (!resume || !jobTitle) return { error: '缺少简历或职位信息' };

  const { [STORAGE_KEYS.API_KEY]: apiKey, [STORAGE_KEYS.ANALYSIS_MODEL]: analysisModelId } =
    await storageGet([STORAGE_KEYS.API_KEY, STORAGE_KEYS.ANALYSIS_MODEL]);

  const modelConfig = await resolveModel(analysisModelId || DEFAULT_MODEL_ID);
  const effectiveApiKey = modelConfig.apiKey || apiKey;
  if (!effectiveApiKey) return { error: '请先在设置中配置 API Key' };

  let userPrompt = promptTemplate || DEFAULT_ANALYSIS_PROMPT;
  userPrompt = userPrompt
    .replace(/\{\{resume\}\}/g, resume)
    .replace(/\{\{jobTitle\}\}/g, jobTitle || '')
    .replace(/\{\{jobDesc\}\}/g, jobDesc || '')
    .replace(/\{\{hrName\}\}/g, hrName || '')
    .replace(/\{\{companyName\}\}/g, companyName || '');

  const messages = [
    {
      role: 'system',
      content: ANALYSIS_SYSTEM_PROMPT,
    },
    { role: 'user', content: userPrompt },
  ];

  try {
    const result = await callLLM({
      endpoint: modelConfig.endpoint,
      apiKey: effectiveApiKey,
      model: modelConfig.model,
      messages,
    });
    return { success: true, analysis: result };
  } catch (err) {
    console.error('[AI] analyzeMatch 失败:', err);
    return { error: `分析失败: ${err.message}` };
  }
}
