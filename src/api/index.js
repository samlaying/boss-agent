const DEFAULT_TIMEOUT = 30000;

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
