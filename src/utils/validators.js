export function isValidApiKey(key) {
  return typeof key === 'string' && key.startsWith('sk-') && key.length > 10;
}

export function isValidResume(text) {
  return typeof text === 'string' && text.trim().length >= 200;
}

export function isValidMessage(message) {
  return message && typeof message === 'object' && typeof message.type === 'string';
}
