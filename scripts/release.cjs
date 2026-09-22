// Git tags are the version ledger. Run only from the serialized main release job.
const { execFileSync } = require('node:child_process');

const VERSION = /^\d{6}\.(?:0[1-9]|[1-9]\d)$/;

function seoulDay(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}

function remoteTags(output) {
  const tags = new Map();
  for (const line of output.trim().split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{40}(?:[a-f0-9]{24})?)\s+refs\/tags\/(\d{6}\.\d{2})(\^\{\})?$/);
    if (match && VERSION.test(match[2]) && (!tags.has(match[2]) || match[3])) {
      tags.set(match[2], match[1]); // Prefer the commit behind an annotated tag.
    }
  }
  return tags;
}

function nextVersion(tags, commit, now) {
  const previous = [...tags].filter(([, sha]) => sha === commit).map(([tag]) => tag).sort();
  if (previous.length > 1) throw new Error('This commit has multiple release tags; resolve the ambiguity without moving tags.');
  if (previous.length) return previous[0]; // Reruns, even on another day, reuse the original tag.
  const day = seoulDay(now);
  const used = [...tags.keys()].filter(tag => tag.startsWith(`${day}.`)).map(tag => Number(tag.slice(-2)));
  const sequence = Math.max(0, ...used) + 1;
  if (sequence > 99) throw new Error(`${day} already reached .99; release a new commit on the next Seoul day.`);
  return `${day}.${String(sequence).padStart(2, '0')}`;
}

const command = (program, args, input) => execFileSync(program, args, {
  encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024
}).trim();

function release({ env = process.env, now = new Date(), run = command } = {}) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' ||
      !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) {
    throw new Error('Releases are allowed only for main pushes or main workflow_dispatch runs.');
  }
  const repo = env.GITHUB_REPOSITORY, commit = env.GITHUB_SHA;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(commit || '')) {
    throw new Error('A repository and full commit SHA are required.');
  }
  if (run('git', ['rev-parse', 'HEAD']) !== commit) throw new Error('Checked-out commit differs from GITHUB_SHA.');
  const tags = remoteTags(run('git', ['ls-remote', '--tags', 'origin']));
  const version = nextVersion(tags, commit, now);
  const listed = run('gh', ['api', `repos/${repo}/releases?per_page=100`, '--paginate',
    '--jq', '.[] | {tag_name, draft, html_url} | @json']);
  // Compact one JSON object per line avoids limits on the number of release pages.
  const releases = listed ? listed.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];
  const existing = releases.find(item => item.tag_name === version);
  if (existing && !tags.has(version)) throw new Error('Release exists without its expected tag; refusing to recreate it.');
  if (existing && !existing.draft) return { version, reused: true, url: existing.html_url };

  if (!tags.has(version)) {
    // The create-ref API is atomic and rejects an existing name. Never update/force a tag.
    run('gh', ['api', '--method', 'POST', `repos/${repo}/git/refs`,
      '-f', `ref=refs/tags/${version}`, '-f', `sha=${commit}`]);
  }
  if (existing) {
    run('gh', ['release', 'edit', version, '--repo', repo, '--draft=false']);
  } else {
    run('gh', ['release', 'create', version, '--repo', repo, '--verify-tag',
      '--target', commit, '--title', version, '--notes-file', '-'],
    `BuildBrief ${version}\n\nCommit: ${commit}\n\nSource ZIP and tar.gz archives are available below.\n`);
  }
  return { version, reused: false, url: `https://github.com/${repo}/releases/tag/${version}` };
}

module.exports = { seoulDay, remoteTags, nextVersion, release };

if (require.main === module) {
  try {
    if (process.argv[2] === '--test' && process.argv.length === 3) {
      require('./check-release.cjs');
    } else {
      if (process.argv.length > 2) throw new Error('Usage: node scripts/release.cjs [--test]');
      const result = release();
      console.log(`${result.reused ? 'Already released' : 'Released'} ${result.version}: ${result.url}`);
    }
  } catch (error) {
    console.error(error.stderr?.toString().trim() || error.message);
    process.exitCode = 1;
  }
}
