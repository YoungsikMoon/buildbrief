// Run: node scripts/build.cjs --test. No network, delays, or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveVersion, stampVersion } = require('./build.cjs');
const sha = char => char.repeat(40);
const tag = (version, commit) => `${commit}\trefs/tags/${version}`;
const head = sha('a');
const production = { CF_PAGES: '1', CF_PAGES_BRANCH: 'main', CF_PAGES_COMMIT_SHA: head };

module.exports = (async () => {
  const matching = `${tag('260922.13', head)}\n${tag('260922.99', sha('b'))}`;
  assert.equal(await resolveVersion({ env: production, head, readTags: () => matching }), '260922.13', 'Choose the exact commit, not the latest tag');
  const annotated = `${tag('260922.14', sha('c'))}\n${tag('260922.14', head)}^{}`;
  assert.equal(await resolveVersion({ env: production, head, readTags: () => annotated }), '260922.14');
  await assert.rejects(resolveVersion({ env: { ...production, CF_PAGES_COMMIT_SHA: sha('b') }, head, readTags: () => assert.fail('No remote read for a mismatched commit') }), /differs/);
  await assert.rejects(resolveVersion({ env: { ...production, CF_PAGES_COMMIT_SHA: undefined }, head }), /required/);
  await assert.rejects(resolveVersion({ env: production, head: 'short' }), /full/);
  await assert.rejects(resolveVersion({ env: production, head, readTags: () => `${matching}\n${tag('260922.14', head)}` }), /multiple/);

  let clock = 0, reads = 0;
  const waits = [];
  const sleep = async ms => { waits.push(ms); clock += ms; };
  assert.equal(await resolveVersion({ env: production, head, now: () => clock, sleep,
    readTags: () => ++reads < 3 ? tag('260922.99', sha('b')) : tag('260922.14', head) }), '260922.14');
  assert.deepEqual(waits, [10000, 10000]);
  clock = 0; reads = 0; waits.length = 0;
  await assert.rejects(resolveVersion({ env: production, head, now: () => clock, sleep,
    readTags: () => { reads++; return tag('260922.99', sha('b')); } }), /within 5 minutes/);
  assert.equal(clock, 300000);
  assert.equal(reads, 31);
  assert(waits.every(ms => ms === 10000));
  clock = 0;
  await assert.rejects(resolveVersion({ env: production, head, now: () => clock, sleep,
    readTags: () => { throw new Error('Remote unavailable'); } }), /Remote unavailable/);
  assert.equal(clock, 300000);
  for (const env of [{}, { CF_PAGES: '0', CF_PAGES_COMMIT_SHA: sha('b') }]) {
    assert.equal(await resolveVersion({ env, readTags: () => assert.fail('Local builds must not read remote tags'), sleep: () => assert.fail('Local builds must not wait') }), null);
    assert.equal(await resolveVersion({ env, head, readTags: () => assert.fail('Even tagged local checkouts remain development builds') }), null);
  }
  for (const env of [{ ...production, CF_PAGES_BRANCH: 'preview' }]) {
    assert.equal(await resolveVersion({ env, head, readTags: () => '', sleep: () => assert.fail('Development builds must not wait') }), null);
    assert.equal(await resolveVersion({ env, head, readTags: () => { throw new Error('Offline'); } }), null);
    assert.equal(await resolveVersion({ env, head, readTags: () => matching }), '260922.13');
  }

  const slot = '<!-- app-version --><span class="app-version" id="app-version">개발 버전</span><!-- /app-version -->';
  const html = `<header>${slot}</header><script src="app.js?v=unchanged"></script>`;
  const stamped = stampVersion(html, '260922.14');
  assert(stamped.includes('>v260922.14</a>'));
  assert(stamped.includes('href="https://github.com/YoungsikMoon/buildbrief/releases/tag/260922.14"'));
  assert(stamped.includes('aria-label="앱 버전 260922.14 · 변경 내역 (새 탭)"'));
  assert(stamped.includes('target="_blank" rel="noopener noreferrer"'));
  assert(stamped.endsWith('</header><script src="app.js?v=unchanged"></script>'));
  assert.equal(stampVersion(stamped, '260922.14'), stamped);
  assert.equal(stampVersion(stamped, null), html);
  const actualHtml = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  const actualStamped = stampVersion(actualHtml, '260922.14');
  assert(actualStamped.includes('>v260922.14</a>'));
  assert.equal(stampVersion(actualStamped, null), stampVersion(actualHtml, null));
  for (const invalid of ['260922.00', 'v260922.14', '260922.100', '<script>']) assert.throws(() => stampVersion(html, invalid), /Invalid/);
  for (const invalid of ['', `${slot}${slot}`, '<!-- /app-version --><!-- app-version -->', slot.replace('id="app-version"', 'id="other"')]) assert.throws(() => stampVersion(invalid, '260922.14'));
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8');
  assert(workflow.includes('node scripts/build.cjs --test'));
  console.log('Build checks passed: exact commit, annotated tags, bounded production wait/failure, offline local development, preview fallback, and safe HTML stamping.');
})();
