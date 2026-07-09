import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found`);
  let i = source.indexOf('{', start);
  if (i === -1) throw new Error(`function ${name} has no body`);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error('body unbalanced');
}

function loadFn(file, name) {
  const code = extractFunction(read(file), name);
  const module = { exports: {} };
  const factory = new Function('module', `${code}\nmodule.exports = { ${name} };`);
  factory(module);
  return module.exports[name];
}

const PRESETS = [
  { id: 'deepseek-v4-flash', name: 'Flash', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  { id: 'deepseek-v4-pro', name: 'Pro', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
];

test('pickModelById: 命中预置模型', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  const m = pick('deepseek-v4-pro', PRESETS, []);
  assert.equal(m && m.model, 'deepseek-v4-pro');
});

test('pickModelById: 命中自定义模型（与预置合并后查找）', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  const customs = [{ id: 'glm', name: 'GLM', endpoint: 'https://glm/api', model: 'glm-4' }];
  const m = pick('glm', PRESETS, customs);
  assert.equal(m && m.endpoint, 'https://glm/api');
});

test('pickModelById: id 为空或未命中 → null（由调用方回退默认）', () => {
  const pick = loadFn('src/background/config.js', 'pickModelById');
  assert.equal(pick('', PRESETS, []), null);
  assert.equal(pick('not-exist', PRESETS, []), null);
  assert.equal(pick(undefined, PRESETS, [{ id: 'x' }]), null);
});
