import { API_TIMEOUT_DEFAULT } from '../utils/constants.js';

const DEFAULT_TIMEOUT = API_TIMEOUT_DEFAULT;

export async function apiRequest(url, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...fetchOptions.headers },
    });
    if (!response.ok) throw new Error('API error: ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
