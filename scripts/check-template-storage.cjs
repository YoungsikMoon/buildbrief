// Run: node scripts/check-template-storage.cjs
const assert = require('node:assert/strict');
const P = require('../dist/projects.js');
const clone = (value) => JSON.parse(JSON.stringify(value));
const template = { enabled: true, version: ' v1 ', text: '  # 기획 요청\r\n본문  \n' };
const first = P.createProject({ planningTemplate: template });
const second = P.createProject({ planningTemplate: template });
const workspace = { version: 1, activeId: first.id, projects: [first, second] };

assert.deepEqual(first.planningTemplate, template);
first.planningTemplate.text = '첫 번째 프로젝트만 수정';
assert.deepEqual(second.planningTemplate, template);
assert.equal(template.text, '  # 기획 요청\r\n본문  \n');
const restored = P.normalizeWorkspace(clone(workspace));
assert.deepEqual(restored, workspace);
assert.notEqual(P.normalizeWorkspace(workspace).projects[1].planningTemplate, second.planningTemplate);
for (const backup of [
  { format: 'buildbrief-idea', version: 1, ...second },
  { format: 'buildbrief-ideas', ...workspace }
]) {
  const before = clone(backup);
  const imported = P.importBackup(clone(backup));
  const expected = backup.projects || [second];
  assert.deepEqual(imported.projects.map((p) => p.planningTemplate), expected.map((p) => p.planningTemplate));
  assert(imported.projects.every((p) => expected.every((old) => p.id !== old.id)));
  assert(imported.projects.some((p) => p.id === imported.activeId));
  assert.deepEqual(backup, before);
}

assert.equal(P.createProject().planningTemplate, null);
const legacy = { ...second };
delete legacy.planningTemplate;
assert.equal(P.normalizeWorkspace({ ...workspace, projects: [first, legacy] }).projects[1].planningTemplate, null);
assert.equal(P.importBackup({ format: 'buildbrief-idea', version: 1, ...legacy }).projects[0].planningTemplate, null);
for (const value of [null, { enabled: false, version: '', text: '' },
  { enabled: false, version: 'v'.repeat(40), text: 'x'.repeat(30000) },
  Object.assign(Object.create(null), template)
]) {
  const project = P.createProject({ planningTemplate: value });
  assert.deepEqual(project.planningTemplate, clone(value));
  assert.deepEqual(P.importBackup({ format: 'buildbrief-idea', version: 1, ...project }).projects[0].planningTemplate, clone(value));
}

for (const value of [
  undefined, [], new Date(), {}, Object.create(template),
  { ...template, enabled: 1 }, { ...template, version: 1 }, { ...template, text: 1 },
  { ...template, version: 'v'.repeat(41) }, { ...template, text: 'x'.repeat(30001) },
  { ...template, extra: '' }, { ...template, [Symbol('extra')]: '' },
  Object.defineProperty({ ...template }, 'hidden', { value: true }),
  ...['__proto__', 'constructor', 'prototype'].map((key) => JSON.parse(
    `{"enabled":true,"version":"v1","text":"","${key}":{}}`
  ))
]) {
  const project = { ...second, planningTemplate: value };
  assert.throws(() => P.normalizeWorkspace({ ...workspace, projects: [first, project] }), /템플릿/);
  assert.throws(() => P.importBackup({ format: 'buildbrief-idea', version: 1, ...project }), /템플릿/);
  if (value !== undefined) assert.throws(() => P.createProject({ planningTemplate: value }), /템플릿/);
}
console.log('Planning template storage checks passed: isolation, backups, legacy data and strict limits.');

const promptDrafts = { basic: '\n  기본 수정본  ', advanced: '</textarea><script>bad</script>' };
const edited = P.createProject({ promptDrafts });
assert.deepEqual(edited.promptDrafts, promptDrafts);
assert.notEqual(edited.promptDrafts, promptDrafts);
assert.deepEqual(P.createProject().promptDrafts, {});
const old = { ...edited }; delete old.promptDrafts;
for (const p of [edited, old]) {
  const w = { version: 1, activeId: p.id, projects: [p] };
  assert.deepEqual(P.normalizeWorkspace(clone(w)).projects[0].promptDrafts, p.promptDrafts || {});
  for (const backup of [{ format: 'buildbrief-idea', version: 1, ...p }, { format: 'buildbrief-ideas', ...w }])
    assert.deepEqual(P.importBackup(backup).projects[0].promptDrafts, p.promptDrafts || {});
}
for (const valid of [{}, { basic: '' }, { advanced: 'x'.repeat(P.MAX_PROMPT_LENGTH) }, Object.assign(Object.create(null), promptDrafts)])
  assert.deepEqual(P.createProject({ promptDrafts: valid }).promptDrafts, { ...valid });
for (const invalid of [null, [], new Date(), Object.create(promptDrafts), { basic: 1 }, { advanced: false },
  { basic: 'x'.repeat(P.MAX_PROMPT_LENGTH + 1) }, { other: '' }, { [Symbol('extra')]: '' },
  Object.defineProperty({}, 'hidden', { value: '' }),
  ...['__proto__', 'constructor', 'prototype'].map(key => JSON.parse(`{"${key}":"bad"}`))]) {
  const backup = { format: 'buildbrief-idea', version: 1, ...edited, promptDrafts: invalid };
  assert.throws(() => P.createProject({ promptDrafts: invalid }), /프롬프트/);
  assert.throws(() => P.importBackup(backup), /프롬프트/);
}
console.log('Editable prompts: separate modes, legacy backups, plain-text preservation and strict limits passed.');
