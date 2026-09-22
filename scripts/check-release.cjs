// Run: node scripts/release.cjs --test. No Git writes, network, credentials, or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { seoulDay, remoteTags, nextVersion, release } = require('./release.cjs');
const sha = digit => digit.repeat(40);
const day = new Date('2026-09-21T15:00:00Z');

assert.equal(seoulDay(new Date('2026-09-21T14:59:59Z')), '260921');
assert.equal(seoulDay(day), '260922');
assert.equal(seoulDay(new Date('2026-12-31T15:00:00Z')), '270101');
assert.equal(nextVersion(new Map(), sha('a'), day), '260922.01');
assert.equal(nextVersion(new Map([['260921.99', sha('b')]]), sha('a'), day), '260922.01');
assert.equal(nextVersion(new Map([['260922.09', sha('b')]]), sha('a'), day), '260922.10');
assert.equal(nextVersion(new Map([['260922.98', sha('b')]]), sha('a'), day), '260922.99');
assert.throws(() => nextVersion(new Map([['260922.99', sha('b')]]), sha('a'), day), /reached .99/);
assert.equal(nextVersion(new Map([['260921.02', sha('a')]]), sha('a'), day), '260921.02');
assert.throws(() => nextVersion(new Map([['260921.01', sha('a')], ['260922.01', sha('a')]]), sha('a'), day), /multiple/);
assert.deepEqual([...remoteTags(`${sha('b')}\trefs/tags/260921.01\n${sha('a')}\trefs/tags/260921.01^{}\n${sha('a')}\trefs/tags/v260922.01\n${sha('a')}\trefs/tags/260922.00`)], [['260921.01', sha('a')]]);

// Exercise the entire release orchestration against in-memory Git/GitHub command boundaries.
const tags = new Map(), releases = [], writes = [];
const env = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'example/buildbrief', GITHUB_SHA: sha('a') };
let failPublish = false;
function run(program, args, input) {
  if (program === 'git' && args[0] === 'rev-parse') return env.GITHUB_SHA;
  if (program === 'git' && args[0] === 'ls-remote') return [...tags].map(([tag, commit]) => `${commit}\trefs/tags/${tag}`).join('\n');
  if (program === 'gh' && args[0] === 'api' && args.includes('--paginate')) return releases.map(item => JSON.stringify(item)).join('\n');
  writes.push([program, ...args]);
  if (program === 'gh' && args.includes('POST')) {
    const tag = args.find(arg => arg.startsWith('ref=')).slice('ref=refs/tags/'.length);
    assert(!tags.has(tag), 'An existing tag must never be replaced');
    tags.set(tag, args.find(arg => arg.startsWith('sha=')).slice(4));
  } else if (program === 'gh' && args[0] === 'release' && args[1] === 'create') {
    if (failPublish) { failPublish = false; throw new Error('Simulated outage after tag reservation'); }
    assert(args.includes('--verify-tag'));
    assert(input.includes(env.GITHUB_SHA));
    releases.push({ tag_name: args[2], draft: false, html_url: `https://github.com/example/buildbrief/releases/tag/${args[2]}` });
  } else if (program === 'gh' && args[0] === 'release' && args[1] === 'edit') {
    releases.find(item => item.tag_name === args[2]).draft = false;
  } else assert.fail(`Unexpected command: ${program} ${args.join(' ')}`);
  return '';
}
const publish = (now = day) => release({ env, now, run });
assert.equal(publish().version, '260922.01');
assert.equal(tags.get('260922.01'), sha('a'));
const firstWrites = writes.length;
assert.equal(publish(new Date('2026-09-23T15:00:00Z')).reused, true);
assert.equal(writes.length, firstWrites, 'Reruns must not write or allocate another version');
env.GITHUB_SHA = sha('b');
assert.equal(publish().version, '260922.02');
env.GITHUB_SHA = sha('c');
failPublish = true;
assert.throws(() => publish(), /outage/);
assert.equal(tags.get('260922.03'), sha('c'));
assert.equal(publish(new Date('2026-09-22T15:00:00Z')).version, '260922.03');
assert.equal(tags.size, 3, 'A partial failure must resume the reserved version');
env.GITHUB_SHA = sha('d');
assert.equal(publish(new Date('2026-09-22T15:00:00Z')).version, '260923.01');
releases.at(-1).draft = true;
assert.equal(publish().version, '260923.01');
assert.equal(releases.at(-1).draft, false, 'A draft resumes without replacing the tag');
env.GITHUB_SHA = sha('e');
tags.set('260922.09', sha('9'));
assert.equal(publish().version, '260922.10');
env.GITHUB_SHA = sha('f');
assert.equal(publish(new Date('2026-09-21T14:59:59Z')).version, '260921.01');
env.GITHUB_SHA = sha('1');
tags.set('260922.99', sha('9'));
const beforeOverflow = writes.length;
assert.throws(() => publish(), /reached .99/);
assert.equal(writes.length, beforeOverflow, 'Overflow must fail before making any writes');
env.GITHUB_SHA = sha('e');
assert.equal(release({ env: { ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, now: day, run }).reused, true);
assert.throws(() => release({ env: { ...env, GITHUB_EVENT_NAME: 'pull_request' }, run }), /only for main/);
assert.throws(() => release({ env: { ...env, GITHUB_REF: 'refs/heads/feature' }, run }), /only for main/);
assert.throws(() => release({ env: { ...env, GITHUB_SHA: 'invalid' }, run }), /full commit/);

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8');
assert(workflow.includes('queue: max') && !workflow.includes('cancel-in-progress: true'));
assert(workflow.includes('pull_request:') && workflow.includes('contents: read') && workflow.includes('contents: write'));
assert(workflow.includes("github.ref == 'refs/heads/main'") && workflow.includes("github.event_name != 'pull_request'"));
assert(workflow.includes('node check.cjs') && workflow.includes('node scripts/release.cjs --test'));
console.log('Release checks passed: Seoul dates, .01-.99, reset, reruns, tag recovery, drafts, and main-only permissions.');
