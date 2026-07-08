import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 从 runtime.js 源码里按函数名提取完整的 `function name(...){...}` 定义（平衡括号）。
// 这三个函数体内部没有嵌在字符串/正则里的不平衡花括号，简单计数即可。
function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found in runtime.js`);
  let i = source.indexOf('{', start);
  if (i === -1) throw new Error(`function ${name} has no body`);
  let depth = 0;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} body is unbalanced`);
}

function loadBriefCsv() {
  const source = read('src/content/runtime.js');
  const code = [
    extractFunction(source, 'csvEscape'),
    extractFunction(source, 'buildAutoApplyBriefRows'),
    extractFunction(source, 'buildAutoApplyBriefCsv'),
  ].join('\n');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'module',
    `${code}\nmodule.exports = { buildAutoApplyBriefCsv, buildAutoApplyBriefRows, csvEscape };`,
  );
  factory(module);
  return module.exports;
}

test('brief CSV keeps Chinese headers but reads data via matching English keys', () => {
  // 回归：07dd59c 把表头改成中文后，buildAutoApplyBriefCsv 仍用中文表头当 key 去取
  // buildAutoApplyBriefRows 输出的英文 key 对象，导致每一列都是 undefined → CSV 数据全空。
  const { buildAutoApplyBriefCsv } = loadBriefCsv();

  const logs = [
    {
      action: 'checked',
      ts: 1783237015282,
      time: '2026-07-05 15:36:55',
      company: '牛客网',
      title: 'AI产品实习生',
      salary: '200-250元/天',
      hr: '杨亦行',
      hrTitle: '',
      active: '今日活跃',
      reason: 'index=24/30',
      jobId: 'd4d47e5b1d5518be03xy3NS7EVRW',
      detailUrl: 'https://www.zhipin.com/job_detail/d4d47e5b1d5518be03xy3NS7EVRW.html',
      source: 'auto_loop',
      description: '岗位职责',
    },
    { action: 'sent', ts: 2, time: '2026-07-05 15:37:00', company: '应被过滤', title: 'x' },
  ];

  const csv = buildAutoApplyBriefCsv(logs);
  const lines = csv.split('\n');

  // 表头保持中文（07dd59c 的产品意图）
  assert.equal(
    lines[0],
    '时间,公司,操作,岗位,薪资,描述,HR,职位,活跃,原因,岗位ID,详情链接,来源',
  );

  // 只为 checked 日志产出 1 行数据
  assert.equal(lines.length, 2, 'should emit one row per checked log');

  // 数据行必须含真实字段值（回归点：修复前此处全为空逗号）
  const dataRow = lines[1];
  assert.match(dataRow, /牛客网/, 'company column populated');
  assert.match(dataRow, /AI产品实习生/, 'title column populated');
  assert.match(dataRow, /200-250元\/天/, 'salary column populated');
  assert.match(dataRow, /杨亦行/, 'hr column populated');
  assert.match(dataRow, /今日活跃/, 'active column populated');
});
