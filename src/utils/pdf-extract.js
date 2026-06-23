import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 设置 worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

/**
 * 从 PDF 文件中提取文本
 * @param {File} file - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    if (pageText.trim()) {
      textParts.push(pageText);
    }
  }

  return textParts.join('\n').trim();
}

/**
 * 从 Word (.docx / .doc) 文件中提取文本
 * mammoth 支持 .docx，部分 .doc 也能解析
 * @param {File} file - Word 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextFromWord(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();
  if (!text) {
    throw new Error('文件内容为空，可能是格式不兼容');
  }
  return text;
}

/**
 * 从文件中提取文本（自动识别格式）
 * @param {File} file - 文件对象（PDF / .docx / .doc）
 * @returns {Promise<string>} 提取的文本内容
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return extractTextFromPdf(file);
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    try {
      return await extractTextFromWord(file);
    } catch (err) {
      if (name.endsWith('.doc')) {
        throw new Error('.doc 格式解析失败，请用 Word 另存为 .docx 或 PDF 后重试', { cause: err });
      }
      throw err;
    }
  }

  throw new Error('不支持的文件格式，请上传 PDF 或 Word 文件');
}
