// 可用变量列表（展示给用户）
export const AVAILABLE_VARIABLES = {
  resume: '精简后的简历',
  jobTitle: '职位名称',
  jobDesc: '职位描述',
  hrName: 'HR 姓名',
  companyName: '公司名称',
};

/**
 * 渲染提示词模板，替换 {{变量}} 占位符
 * @param {string} template - 包含 {{变量}} 的模板字符串
 * @param {Object} variables - 变量键值对
 * @returns {string} 渲染后的字符串
 */
export function renderPrompt(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}
