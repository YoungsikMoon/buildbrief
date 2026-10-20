// The preference guard is tested without a browser or any analytics network requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/analytics-preferences.js'), 'utf8');
const key = 'buildbrief-analytics-excluded';
const projectKey = 'buildbrief-projects';
const project = '{"projects":[{"answers":{"project_name":"KEEP_PRIVATE"}}]}';
function run(options = {}) {
  const stored = options.stored || new Map([[projectKey, project]]);
  const location = new URL(options.url || 'https://buildbrief.moon0sik.cloud/');
  const state = { unrelated: 'PRESERVE_STATE' }, calls = [], metas = [];
  const document = {
    documentElement: { dataset: {} },
    head: { appendChild(element) { assert.equal(element.httpEquiv, 'Content-Security-Policy'); assert.equal(element.content, "script-src 'self'; connect-src 'none'"); metas.push(element); } },
    createElement(tag) { assert.equal(tag, 'meta'); return {}; }
  };
  const history = { state, replaceState(next, title, url) { assert.equal(next, state); assert.equal(title, ''); calls.push(url); location.href = url; } };
  const storage = {
    getItem(name) { if (options.failRead) throw new Error('Storage read blocked'); return stored.has(name) ? stored.get(name) : null; },
    setItem(name, value) { if (options.failSet) throw new Error('Storage write blocked'); stored.set(name, value); },
    removeItem(name) { if (options.failRemove) throw new Error('Storage deletion blocked'); stored.delete(name); }
  };
  vm.runInNewContext(source, { URL, location, history, navigator: { webdriver: options.webdriver === true }, document, localStorage: storage });
  assert.equal(stored.get(projectKey), project, 'The guard must not change project data');
  return { stored, location, state, calls, metas, excluded: document.documentElement.dataset.analyticsExcluded };
}
function expectExcluded(result) {
  assert.equal(result.excluded, 'true');
  assert.equal(result.metas.length, 1);
}
function expectIncluded(result) {
  assert.equal(result.excluded, 'false');
  assert.equal(result.metas.length, 0);
}
expectIncluded(run());
const off = run({ url: 'https://buildbrief.moon0sik.cloud/?source=profile&analytics=off&name=%ED%95%9C%EA%B8%80#guide' });
expectExcluded(off);
assert.equal(off.stored.get(key), '1');
assert.equal(off.location.searchParams.get('source'), 'profile');
assert.equal(off.location.searchParams.get('name'), '한글');
assert.equal(off.location.hash, '#guide');
assert.equal(off.location.searchParams.has('analytics'), false);
assert.equal(off.calls.length, 1);
expectExcluded(run({ stored: off.stored }));
const rawQuery = run({ url: 'https://buildbrief.moon0sik.cloud/?keep=a%20b&analy%74ics=off&keep=c+d#guide' });
expectExcluded(rawQuery);
assert.deepEqual(rawQuery.location.searchParams.getAll('keep'), ['a b', 'c d']);
assert.equal(rawQuery.location.hash, '#guide');
assert.equal(rawQuery.location.searchParams.has('analytics'), false);
const on = run({ stored: off.stored, url: 'https://buildbrief.moon0sik.cloud/?analytics=on#guide' });
expectIncluded(on);
assert.equal(on.stored.has(key), false);
assert.equal(on.location.href, 'https://buildbrief.moon0sik.cloud/#guide');
expectIncluded(run({ stored: on.stored }));
for (const query of ['analytics=no', 'analytics=', 'analytics=OFF', 'analytics=off&analytics=on', 'analytics=off&analytics=off']) {
  const original = 'https://buildbrief.moon0sik.cloud/?' + query + '&keep=a%20b#guide';
  const invalid = run({ url: original });
  expectIncluded(invalid);
  assert.equal(invalid.calls.length, 0);
  assert.equal(invalid.location.href, original);
  assert.equal(invalid.stored.has(key), false);
}
const retained = new Map([[projectKey, project], [key, '1']]);
expectExcluded(run({ stored: retained, url: 'https://buildbrief.moon0sik.cloud/?analytics=invalid' }));
expectIncluded(run({ stored: new Map([[projectKey, project], [key, 'false']]) }));
expectExcluded(run({ failRead: true }));
expectExcluded(run({ failSet: true, url: 'https://buildbrief.moon0sik.cloud/?analytics=off' }));
expectExcluded(run({ stored: retained, failRemove: true, url: 'https://buildbrief.moon0sik.cloud/?analytics=on' }));
expectExcluded(run({ failRead: true, url: 'https://buildbrief.moon0sik.cloud/?analytics=on' }));
const automated = run({ stored: retained, webdriver: true, url: 'https://buildbrief.moon0sik.cloud/?analytics=on' });
expectExcluded(automated);
assert.equal(automated.stored.has(key), false, 'Manual inclusion cannot enable automated traffic');
for (const hostname of ['localhost:3000', '127.0.0.1:3000', 'feat-guided-deep-interview.buildbrief-9ey.pages.dev', 'example.com', 'buildbrief.moon0sik.cloud.example.com']) {
  expectExcluded(run({ url: 'https://' + hostname + '/?analytics=on' }));
}
console.log('Analytics preferences check passed: opt-out/in, reload, strict query values, URL/state, storage failure, automation, preview hosts, and project preservation.');
