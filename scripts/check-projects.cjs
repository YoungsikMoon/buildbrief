// Pure data checks: no browser storage, network, or file writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const P = require('../dist/projects.js');
const R = require('../dist/report.js');
const Q = require('../dist/questions.js');
const clone = value => JSON.parse(JSON.stringify(value));
const workspace = (...projects) => ({ version: 1, activeId: projects[0].id, projects });
let passed = 0;
function test(name, run) {
  try { run(); passed++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}

test('New projects have independent ids and answer buckets', () => {
  const first = P.createProject(), second = P.createProject();
  assert.notEqual(first.id, second.id);
  assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first.createdAt, first.updatedAt);
  assert.equal(new Date(first.createdAt).toISOString(), first.createdAt);
  assert.equal(first.step, 0);
  first.answers.project_name = '첫 아이디어';
  assert.deepEqual(second.answers, {});
  assert.deepEqual(second.drafts, {});
  assert.deepEqual(second.notes, {});
  assert.equal(P.KEY, 'buildbrief.projects.v1');
  assert.equal(P.LEGACY_KEY, 'buildbrief.project.v1');
});

test('Titles have one source and preserve the entered project name', () => {
  assert.equal(P.projectTitle(P.createProject()), '새로운 아이디어');
  assert.equal(P.projectTitle({ answers: { project_name: '  모임 일정  ' }, title: '다른 이름' }), '모임 일정');
  assert.equal(P.projectTitle({ answers: { project_name: ' ' } }), '새로운 아이디어');
});

test('Workspace round trips preserve independent current answers, drafts, notes and stages', () => {
  const first = P.createProject({ answers: { project_name: '일정', backend_mode: R.UNKNOWN, known_stack: '이전 경험' }, drafts: { backend_mode: '기기 안에서만 실행' }, notes: { project_name: '임시 이름' }, step: 8 });
  const second = P.createProject({ answers: { project_name: '안내', feature_specs: [{ name: '조회', priority: '첫 출시 필수', acceptance: '내용 표시' }] }, notes: { feature_specs: '상세 보완' }, step: 12 });
  const input = workspace(first, second);
  input.activeId = second.id;
  const before = clone(input), normalized = P.normalizeWorkspace(input);
  assert.deepEqual(input, before);
  assert.deepEqual(normalized, P.normalizeWorkspace(clone(normalized)));
  assert.deepEqual(normalized.projects, [first, second]);
  assert.equal(normalized.activeId, second.id);
  normalized.projects[0].answers.project_name = '변경';
  normalized.projects[1].answers.feature_specs[0].name = '수정한 카드';
  assert.equal(input.projects[0].answers.project_name, '일정');
  assert.equal(input.projects[1].answers.feature_specs[0].name, '조회');
});

test('Every project uses the existing idempotent legacy migration', () => {
  const legacy = { version: 1, step: 4, answers: { project_name: '기존', core_features: '신청', screens: '목록', backend_mode: R.UNKNOWN, known_stack: '원본 경험' }, drafts: { backend_mode: '기기 안에서만 실행', core_features: '추천 전 기능' }, notes: { core_features: '먼저 구현할 이유' } };
  const before = clone(legacy), converted = P.fromLegacy(legacy), project = converted.projects[0];
  assert.deepEqual(legacy, before);
  assert.deepEqual({ answers: project.answers, drafts: project.drafts, notes: project.notes }, R.normalizeProject(legacy));
  assert.equal(project.step, 4);
  assert.equal(converted.activeId, project.id);
  assert(project.notes.feature_specs.includes('신청'));
  assert(project.notes.feature_specs.includes('추천 전 기능'));
  assert(project.notes.feature_specs.includes('먼저 구현할 이유'));
  assert.equal(project.answers.backend_mode, R.UNKNOWN);
  assert.equal(project.answers.known_stack, '원본 경험');
  assert.deepEqual(P.normalizeWorkspace(converted), converted);
});

test('Old backups may omit drafts and notes; present malformed buckets fail', () => {
  const converted = P.fromLegacy({ version: 1, answers: { architecture_reason: '작은 구조 유지' } });
  assert.deepEqual(converted.projects[0].answers, {});
  assert(converted.projects[0].notes.architecture.includes('작은 구조 유지'));
  for (const invalid of [null, {}, { version: 2, answers: {} }, { version: 1 }, { version: 1, answers: [] }, { version: 1, answers: {}, notes: null }, { version: 1, answers: {}, drafts: [] }]) assert.throws(() => P.fromLegacy(invalid));
});

test('Stored stages are clamped exactly like the existing single-project app', () => {
  for (const [value, expected] of [[-3, 0], [900, Q.steps.length - 1], [3, 3], [1.5, 0], ['4', 0], [undefined, 0]]) {
    const project = P.createProject({ step: value });
    assert.equal(project.step, expected);
    project.step = value;
    assert.equal(P.normalizeWorkspace(workspace(project)).projects[0].step, expected);
  }
});

test('Malformed workspace headers, duplicate ids and missing active projects fail closed', () => {
  const project = P.createProject(), valid = workspace(project);
  for (const invalid of [null, [], {}, { ...valid, version: 2 }, { ...valid, version: '1' }, { ...valid, projects: [] }, { ...valid, projects: {} }, { ...valid, activeId: 'missing' }, { ...valid, activeId: null }, { ...valid, projects: [project, clone(project)] }]) assert.throws(() => P.normalizeWorkspace(invalid));
});

test('Every project requires its buckets, valid id and real ISO timestamps', () => {
  const valid = P.createProject();
  for (const key of ['answers', 'drafts', 'notes']) {
    for (const value of [undefined, null, [], '', 1]) assert.throws(() => P.normalizeWorkspace(workspace({ ...valid, [key]: value })));
    const missing = clone(valid); delete missing[key];
    assert.throws(() => P.normalizeWorkspace(workspace(missing)));
  }
  for (const value of ['', 'project-1', null, valid.id.toUpperCase()]) assert.throws(() => P.normalizeWorkspace(workspace({ ...valid, id: value })));
  for (const key of ['createdAt', 'updatedAt']) for (const value of [undefined, null, 0, '2026-09-22', '2026-02-30T00:00:00.000Z', '2026-09-22T00:00:00+09:00']) assert.throws(() => P.normalizeWorkspace(workspace({ ...valid, [key]: value })));
  assert.throws(() => P.normalizeWorkspace({ version: 1, activeId: valid.id, projects: [valid, null] }));
});

test('A failed legacy merge in any project rejects the entire workspace without mutating it', () => {
  const good = P.createProject({ answers: { project_name: '유지' } }), bad = P.createProject();
  bad.answers.references = 'r'.repeat(12990);
  bad.answers.design_reference = 'd'.repeat(6000);
  const input = workspace(good, bad), before = clone(input);
  assert.throws(() => P.normalizeWorkspace(input), /13,000/);
  assert.deepEqual(input, before);
});

test('Browser API also works when randomUUID is unavailable', () => {
  const window = { BriefReport: R, BriefQuestions: Q, crypto: { getRandomValues: values => crypto.webcrypto.getRandomValues(values) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/projects.js'), 'utf8'), { window });
  const project = window.BriefProjects.createProject({ answers: { project_name: '브라우저' } });
  assert.match(project.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(window.BriefProjects.projectTitle(project), '브라우저');
  assert.equal(window.BriefProjects.normalizeWorkspace(workspace(project)).activeId, project.id);
});

console.log(`Project checks passed: ${passed} (isolation, legacy migration, round trips, strict workspace validation, and browser UUID fallback).`);
