// Run directly with node scripts/check-runtime.cjs; also included by check.cjs.
const assert = require('node:assert/strict');
const A = require('../dist/answers.js');
const P = require('../dist/projects.js');
const S = require('../dist/storage.js');
const V = require('../dist/views.js');
const question = (id) => A.allQuestions.find((item) => item.id === id);
let passed = 0;
function test(name, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw = null;
  const disk = {
    getItem: () => raw,
    setItem: (key, value) => {
      assert.equal(key, P.KEY);
      raw = value;
    }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: disk });
  try {
    run(disk);
    passed++;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('Saved answers, reasons, requests and legacy fields survive reload and project switching', () => {
  const state = S.load();
  const first = state.workspace.projects[0];
  first.answers = { project_name: '첫 아이디어', general_rules: '기존 규칙 보존' };
  first.notes = { general_rules: '기존 선택 이유' };
  first.drafts = { summary: '이전 입력 보존' };
  first.recommendations = ['screens'];
  first.step = 3;
  assert(S.save(state, state.workspace));
  const second = P.createProject({ answers: { project_name: '두 번째 아이디어' } });
  assert(
    S.save(state, {
      ...state.workspace,
      activeId: second.id,
      projects: [...state.workspace.projects, second]
    })
  );
  const restored = S.load();
  assert.equal(restored.workspace.activeId, second.id);
  const original = restored.workspace.projects[0];
  for (const key of ['answers', 'notes', 'drafts', 'recommendations', 'step', 'started'])
    assert.deepEqual(original[key], first[key]);
  assert.equal(S.status(restored), '이 브라우저에 저장됨');
});

test('Corrupt storage remains untouched until a validated recovery succeeds', (disk) => {
  const corrupt = '{"incomplete":';
  disk.setItem(P.KEY, corrupt);
  const state = S.load();
  assert(state.loadFailed);
  assert.equal(state.originalStorage, corrupt);
  assert.equal(S.save(state, state.workspace), false);
  assert.equal(disk.getItem(P.KEY), corrupt);
  const p = P.createProject({ answers: { project_name: '복구할 아이디어' } });
  const incoming = P.importBackup({ format: 'buildbrief-idea', version: 1, ...p });
  assert(S.save(state, incoming, true));
  assert.equal(state.loadFailed, false);
  assert.equal(state.originalStorage, null);
  assert.equal(S.load().workspace.projects[0].answers.project_name, '복구할 아이디어');
});

test('Unavailable or full storage never commits a project change', (disk) => {
  disk.getItem = () => {
    throw new Error('Storage access denied');
  };
  const blocked = S.load();
  assert(blocked.loadFailed);
  assert.equal(S.save(blocked, blocked.workspace), false);
  disk.getItem = () => null;
  const state = S.load();
  const previous = state.workspace;
  const p = P.createProject();
  disk.setItem = () => {
    throw new Error('Quota exceeded');
  };
  assert.equal(S.save(state, { version: 1, activeId: p.id, projects: [p] }), false);
  assert.equal(state.workspace, previous);
  assert.equal(state.storedRaw, null);
  assert.equal(state.storageWorking, false);
  assert.equal(S.status(state), '저장 불가 · 답변을 백업해 주세요');
});

test('Stale tabs and storage events cannot overwrite a newer snapshot or recovery source', (disk) => {
  const state = S.load();
  assert(S.save(state, state.workspace));
  const stale = S.load();
  state.workspace.projects[0].answers.project_name = '다른 탭에서 수정';
  assert(S.save(state, state.workspace));
  const current = disk.getItem(P.KEY);
  assert.equal(S.save(stale, stale.workspace), false);
  assert.equal(stale.externalChange, true);
  assert.equal(disk.getItem(P.KEY), current);
  const eventState = S.load();
  eventState.externalChange = true;
  assert.equal(S.save(eventState, eventState.workspace), false);
  assert.equal(disk.getItem(P.KEY), current);
  disk.setItem(P.KEY, '{broken');
  const broken = S.load();
  disk.setItem(P.KEY, current);
  assert.equal(S.save(broken, broken.workspace, true), false);
  assert.equal(disk.getItem(P.KEY), current);
});

test('Extracted views escape every question type, answer, choice reason and report', () => {
  const attack =
    '\"><img src=x onerror=alert(1)></textarea><script>alert(2)</script>\n### 다른 질문';
  const feature = {
    id: 'feature-1',
    category: 'custom',
    name: attack,
    actor: attack,
    outcome: attack,
    notes: attack,
    savedInfo: attack,
    priority: '아직 미정'
  };
  const screen = {
    id: 'screen-1',
    name: attack,
    roles: attack,
    purpose: attack,
    featureIds: ['feature-1'],
    elements: ['table'],
    elementNotes: { table: attack },
    content: attack,
    empty: attack,
    error: attack,
    mobile: attack
  };
  const answers = {
    project_name: attack,
    summary: attack,
    features: [feature],
    screens: [screen],
    references: [{ id: 'ref-1', url: attack, note: attack }],
    main_flow: [{ id: 'flow-1', featureId: 'feature-1', note: attack }],
    audience: [{ id: 'user-1', person: attack, goal: attack, context: attack }]
  };
  for (const q of A.allQuestions) {
    const html = V.question(q, answers, { [q.id]: attack }, q.allowRecommend ? [q.id] : []);
    assert(!/<(?:img|script)\b/i.test(html), q.id);
    assert(html.includes('&lt;img'), q.id);
    assert(html.includes('maxlength="6000"'), q.id);
  }
  const html = V.report(answers, { summary: attack, features: attack, screens: attack }, [
    'screens'
  ]);
  assert(!/<(?:img|script)\b/i.test(html));
  assert(!/<h[1-6][^>]*>다른 질문/.test(html));
  assert(html.includes('&lt;img'));
});

test('Report HTML keeps each reason inside its own question card', () => {
  const html = V.report(
    { project_name: '첫 문서', summary: '서비스 설명', problem: '해결할 문제' },
    { summary: '설명의 이유', problem: '문제의 이유' }
  );
  const cards = [...html.matchAll(/<section class="report-question">([\s\S]*?)<\/section>/g)].map(
    (match) => match[1]
  );
  assert.equal(cards.length, 3);
  for (const [id, reason] of [
    ['summary', '설명의 이유'],
    ['problem', '문제의 이유']
  ]) {
    const card = cards.find((item) => item.includes(question(id).label));
    assert(card?.includes(`<aside class="report-rationale">`));
    assert(card.includes(reason));
    for (const other of cards.filter((item) => item !== card)) assert(!other.includes(reason));
  }
});
console.log(
  `Runtime checks passed: ${passed} checks covering storage failures, conflicts, restoration and safe views.`
);
