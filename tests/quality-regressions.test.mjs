import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('production build contains the legacy feature-complete content and background logic', () => {
  execFileSync('npm', ['run', 'build'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'pipe',
  });

  const contentBundle = read('dist/content.bundle.js');
  const backgroundBundle = read('dist/background.bundle.js');

  assert.match(contentBundle, /BossHelper/);
  assert.ok(contentBundle.length > 50_000, 'content bundle is suspiciously small');
  assert.match(backgroundBundle, /call_deepseek/);
  assert.match(backgroundBundle, /CONTENT_READY/);
  assert.ok(backgroundBundle.length > 10_000, 'background bundle is suspiciously small');

  const dist = new URL('../dist/', import.meta.url);
  for (const prefix of ['popup.', 'options.']) {
    const bundle = readdirSync(dist).find(name => name.startsWith(prefix) && name.endsWith('.bundle.js'));
    assert.ok(bundle, `${prefix} bundle missing`);
    assert.ok(statSync(new URL(bundle, dist)).size < 250_000, `${prefix} entry should lazy-load document parsers`);
  }
});

test('document parsers are loaded only when the user uploads that file type', () => {
  const source = read('src/utils/pdf-extract.js');

  assert.doesNotMatch(source, /^import .* from ['"](?:pdfjs-dist|mammoth)['"]/m);
  assert.match(source, /import\(['"]pdfjs-dist['"]\)/);
  assert.match(source, /import\(['"]mammoth['"]\)/);
});

test('popup routes first-time users to onboarding and returning users to a dedicated dashboard', () => {
  const app = read('src/popup/App.vue');
  const html = read('src/popup/index.html');

  assert.match(app, /DashboardView/);
  assert.match(app, /v-if="isLoading"/);
  assert.match(app, /<DashboardView[\s\S]*v-if="isDashboard"/);
  assert.match(app, /STORAGE_KEYS\.SETUP_COMPLETED/);
  // Task 6: 齿轮设置入口打开配置中心，不再重放向导
  assert.match(app, /openConfigCenter/);
  assert.match(app, /@open-settings="openConfigCenter"/);
  assert.match(html, /class="boss-agent-popup"/);
  assert.ok(existsSync(new URL('../src/popup/views/DashboardView.vue', import.meta.url)));
});

test('returning dashboard provides status, primary action, and settings (wizard is first-run only)', () => {
  const dashboard = read('src/popup/views/DashboardView.vue');

  assert.match(dashboard, /配置状态/);
  assert.match(dashboard, /打开 Boss 直聘/);
  assert.match(dashboard, /打开完整设置/);
  // Task 6: 「重新运行新手引导」已移除，向导仅首次进入；设置走配置中心
  assert.doesNotMatch(dashboard, /重新运行新手引导/);
  assert.doesNotMatch(dashboard, /reconfigure/);
});

test('onboarding mode choice clearly separates fixed and per-job AI greetings', () => {
  const features = read('src/popup/components/steps/StepFeatures.vue');

  assert.match(features, /使用固定话术，开箱即用/);
  assert.match(features, /逐岗生成专属话术/);
  assert.match(features, /DeepSeek/);
  assert.match(features, /COMPUTE_MODE/);
  assert.match(features, /custom_key/);
});

test('standard onboarding generates an editable fixed greeting after resume upload', () => {
  const config = read('src/popup/components/steps/StepConfig.vue');
  const background = read('src/background/runtime.js');

  assert.match(config, /正在为你准备专属开场白/);
  assert.match(config, /generate_onboarding_greeting/);
  assert.match(config, /保存我的专属话术/);
  assert.match(background, /generate_onboarding_greeting/);
});

test('AI onboarding explains per-JD generation and configures candidate count', () => {
  const config = read('src/popup/components/steps/StepConfig.vue');

  assert.match(config, /结合当前 JD 和你的简历/);
  assert.match(config, /每个岗位生成几条候选话术/);
  assert.match(config, /实际沟通时只发送其中一条/);
  assert.match(config, /greetingCount\s*=\s*ref\(3\)/);
});

test('repository has one extension root and keeps generated runtime files out of the source root', () => {
  for (const file of [
    'manifest.json',
    'background.js',
    'content.js',
    'background.bundle.js',
    'content.bundle.js',
    'popup.bundle.js',
    'options.bundle.js',
    'popup.html',
    'options.html',
    'popup.css',
    'options.css',
    'pdf.worker.min.mjs',
  ]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), false, `${file} belongs in dist`);
  }

  assert.ok(existsSync(new URL('../public/manifest.json', import.meta.url)));
});

test('webpack has one source entry per Chrome execution context', () => {
  const source = read('webpack.config.js');

  assert.match(source, /background:\s*['"]\.\/src\/background\/index\.js['"]/);
  assert.match(source, /content:\s*['"]\.\/src\/content\/index\.js['"]/);
  assert.doesNotMatch(source, /to:\s*['"]\.\.\/manifest\.json['"]/);
});

test('manifest declares store icons and only permissions used by the extension', () => {
  const manifest = JSON.parse(read('public/manifest.json'));

  assert.deepEqual(Object.keys(manifest.icons).sort(), ['16', '32', '48', '128'].sort());
  assert.ok(!manifest.permissions.includes('notifications'));
  assert.ok(!manifest.permissions.includes('activeTab'));
});

test('background has one message listener and MV3-safe fetch timeout', () => {
  const indexSource = read('src/background/index.js');
  const runtimeSource = read('src/background/runtime.js');
  const listenerCount = (indexSource.match(/chrome\.runtime\.onMessage\.addListener/g) || []).length
    + (runtimeSource.match(/chrome\.runtime\.onMessage\.addListener/g) || []).length;

  assert.equal(listenerCount, 1);
  assert.match(indexSource, /import ['"]\.\/runtime\.js['"]/);
  assert.match(runtimeSource, /handleMessage/);
  assert.match(runtimeSource, /timeout\s*=\s*25000/);
});

test('new background router ignores legacy action messages instead of racing their response', () => {
  const source = read('src/background/router.js');

  assert.match(source, /if\s*\(!message\?\.type\)\s*return undefined/);
});

test('custom endpoints use optional host permissions instead of permanent all-url access', () => {
  const manifest = JSON.parse(read('public/manifest.json'));

  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
});

test('custom model credentials override the global DeepSeek API key', () => {
  const source = read('src/background/handlers/ai.js');

  assert.match(source, /const effectiveApiKey\s*=\s*modelConfig\.apiKey\s*\|\|\s*apiKey/);
  assert.match(source, /if\s*\(!effectiveApiKey\)/);
  assert.match(source, /apiKey:\s*effectiveApiKey/);
});

test('model-generated report values are escaped before innerHTML rendering', () => {
  const source = read('src/content/runtime.js');

  assert.match(source, /function escapeHtml/);
  assert.match(source, /escapeHtml\(scriptRationale\)/);
  assert.match(source, /escapeHtml\(reason\)/);
  assert.match(source, /escapeHtml\(warningText\)/);
});

test('remote log server is loopback-only by default and rejects unauthenticated public binding', () => {
  const source = read('server/auto_apply_log_server.js');

  assert.match(source, /BOSS_LOG_HOST\s*\|\|\s*["']127\.0\.0\.1["']/);
  assert.match(source, /if\s*\(\s*!isLoopbackHost\(HOST\)\s*&&\s*!TOKEN\s*\)/);
  assert.match(source, /server\.listen\(PORT,\s*HOST/);
});

test('variant builds package the same feature-complete bundles as the main build', () => {
  execFileSync('npm', ['run', 'build:social'], {
    cwd: new URL('..', import.meta.url),
    stdio: 'pipe',
  });

  const manifest = JSON.parse(read('dist/boss-agent-social/manifest.json'));
  const contentBundle = read('dist/boss-agent-social/content.bundle.js');
  assert.ok(manifest.content_scripts[0].js.includes('content.bundle.js'));
  assert.match(contentBundle, /BossHelper/);
});
