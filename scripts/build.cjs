// Cloudflare Pages runs this after checkout. Only the HTML version slot is changed.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { remoteTags } = require('./release.cjs');

const ROOT = path.join(__dirname, '..');
const VERSION = /^\d{6}\.(?:0[1-9]|[1-9]\d)$/;
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const WAIT_MS = 5 * 60 * 1000;
const RETRY_MS = 10 * 1000;
const START = '<!-- app-version -->', END = '<!-- /app-version -->';
const command = (program, args, timeout = 30000) => execFileSync(program, args, {
  cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
  maxBuffer: 8 * 1024 * 1024
}).trim();

async function resolveVersion({ env = process.env, head, readTags = timeout => command('git', ['ls-remote', '--tags', 'origin'], timeout),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
  const pages = env.CF_PAGES === '1';
  if (!pages) return null;
  if (!SHA.test(head || '')) throw new Error('A full checked-out commit SHA is required.');
  if (!env.CF_PAGES_BRANCH || !env.CF_PAGES_COMMIT_SHA) throw new Error('Cloudflare Pages branch and commit SHA are required.');
  const commit = env.CF_PAGES_COMMIT_SHA;
  if (!SHA.test(commit) || commit !== head) throw new Error('Checked-out commit differs from CF_PAGES_COMMIT_SHA.');
  const production = env.CF_PAGES_BRANCH === 'main';
  const deadline = now() + WAIT_MS;
  let lastFailure = '';
  for (;;) {
    let output;
    try { output = await readTags(Math.max(1, Math.min(30000, deadline - now()))); }
    catch (error) { lastFailure = error.message; }
    if (output !== undefined) {
      const matches = [...remoteTags(output)].filter(([, sha]) => sha === commit).map(([tag]) => tag);
      if (matches.length > 1) throw new Error('This commit has multiple release tags; refusing to choose an ambiguous version.');
      if (matches.length === 1) return matches[0];
      lastFailure = 'No release tag points to this exact commit.';
    }
    if (!production) return null;
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error(`Production version was not available within 5 minutes. ${lastFailure}`);
    await sleep(Math.min(RETRY_MS, remaining));
  }
}

function stampVersion(html, version) {
  if (version !== null && !VERSION.test(version || '')) throw new Error('Invalid app release version.');
  if (html.split(START).length !== 2 || html.split(END).length !== 2 || html.indexOf(END) < html.indexOf(START)) {
    throw new Error('Exactly one ordered app-version marker pair is required.');
  }
  const start = html.indexOf(START) + START.length, end = html.indexOf(END);
  const existing = html.slice(start, end).trim();
  if (!/^<(?:span|a)\b[^>]*\bclass="app-version"[^>]*\bid="app-version"[^>]*>[\s\S]*<\/(?:span|a)>$/.test(existing)) {
    throw new Error('The app-version slot must retain its expected class and id.');
  }
  const badge = version
    ? `<a class="app-version" id="app-version" href="https://github.com/YoungsikMoon/buildbrief/releases/tag/${version}" aria-label="앱 버전 ${version} · 변경 내역 (새 탭)" target="_blank" rel="noopener noreferrer">v${version}</a>`
    : '<span class="app-version" id="app-version">개발 버전</span>';
  return html.slice(0, start) + badge + html.slice(end);
}

async function build() {
  for (const args of [['check.cjs'], ['scripts/release.cjs', '--test'], ['scripts/build.cjs', '--test']]) {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  }
  const head = process.env.CF_PAGES === '1' ? command('git', ['rev-parse', 'HEAD']) : null;
  const version = await resolveVersion({ head });
  const htmlPath = path.join(ROOT, 'dist/index.html');
  const html = stampVersion(fs.readFileSync(htmlPath, 'utf8'), version);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`App version: ${version ? `v${version}` : '개발 버전'}${head ? ` (${head})` : ''}`);
}

module.exports = { resolveVersion, stampVersion };

if (require.main === module) {
  (async () => {
    if (process.argv[2] === '--test' && process.argv.length === 3) await require('./check-build.cjs');
    else {
      if (process.argv.length > 2) throw new Error('Usage: node scripts/build.cjs [--test]');
      await build();
    }
  })().catch(error => {
    console.error(error.stderr?.toString().trim() || error.message);
    process.exitCode = 1;
  });
}
