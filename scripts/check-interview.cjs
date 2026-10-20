// Adaptive interview stays optional, preserves old projects, and only adds reviewed plans.
const assert = require('node:assert/strict');
const Q = require('../dist/questions.js');
const A = require('../dist/answers.js');
const I = require('../dist/interview.js');
const P = require('../dist/projects.js');
const clone = value => JSON.parse(JSON.stringify(value));
const rows = values => Object.entries(values).map(([id, answer]) => ({ id, answer, reason: '' }));
const withAnswers = values => ({ deep_interview: rows(values) });
const base = withAnswers({ task: '토요일에 쓸 작업실 예약', workflow: 'request', success: '시간과 승인 결과를 확인해요.',
  information: '예약 날짜, 시작 시간\n작업실 이름', visibility: 'public', confirmation: 'approval', capacity: 'limited', cancellation: 'self',
  recovery: '입력은 남기고 신청 결과부터 확인해요.', scope: 'followup' });
base.deep_interview.find(row => row.id === 'confirmation').reason = '운영자가 장비 준비 여부를 먼저 확인해야 해요.';
assert.deepEqual(I.questions({}).map(question => question.id), ['task', 'workflow']);
assert.equal(I.preview({}).ready, false);
assert.throws(() => I.apply({}));
const requestIds = I.questions(base).map(question => question.id);
assert(requestIds.includes('confirmation') && requestIds.includes('cancellation'));
assert(!requestIds.includes('publication'));
const changed = clone(base); changed.deep_interview.find(row => row.id === 'workflow').answer = 'create';
const createIds = I.questions(changed).map(question => question.id);
assert(createIds.includes('publication') && !createIds.includes('confirmation'));
assert(!I.preview(changed).features.some(row => row.id === 'interview-review'));
assert(changed.deep_interview.some(row => row.id === 'confirmation' && row.answer === 'approval'));
assert.deepEqual(I.questions(withAnswers({ workflow: 'undecided', visibility: 'team', team_scope: 'edit' })).map(question => question.id), ['task', 'workflow']);
const oldBranch = clone(base);
oldBranch.deep_interview.push({ id: 'publication', answer: 'review', reason: 'HIDDEN_PUBLICATION_REASON_MUST_STAY_PRIVATE' });
const oldBranchPlan = I.preview(oldBranch);
assert(!JSON.stringify([...oldBranchPlan.features, ...oldBranchPlan.screens]).includes('HIDDEN_PUBLICATION_REASON_MUST_STAY_PRIVATE'));
assert(oldBranch.deep_interview.some(row => row.reason === 'HIDDEN_PUBLICATION_REASON_MUST_STAY_PRIVATE'));
const undecidedReason = clone(base);
undecidedReason.deep_interview.find(row => row.id === 'success').answer = 'undecided';
undecidedReason.deep_interview.find(row => row.id === 'success').reason = 'UNDECIDED_REASON_NOT_A_REQUIREMENT';
const undecidedReasonPlan = I.preview(undecidedReason);
assert(!JSON.stringify([...undecidedReasonPlan.features, ...undecidedReasonPlan.screens]).includes('UNDECIDED_REASON_NOT_A_REQUIREMENT'));
for (const decision of [{ confirmation: 'approval' }, { cancellation: 'operator' }]) {
  const blocked = { login_need: '로그인 필요', ...withAnswers({ task: '신청', workflow: 'request', visibility: 'personal', ...decision }) };
  const original = clone(blocked);
  assert.equal(I.preview(blocked).ready, false);
  assert(I.preview(blocked).warnings.some(message => message.includes('담당자') && message.includes('본인만')));
  assert.throws(() => I.apply(blocked));
  assert.deepEqual(blocked, original);
  blocked.deep_interview.find(row => row.id === 'visibility').answer = 'team';
  assert.equal(I.preview(blocked).ready, true);
}

const undecided = I.preview(withAnswers({ task: '신청', workflow: 'request', confirmation: 'undecided', visibility: 'undecided' }));
assert(undecided.ready && undecided.warnings.some(message => message.includes('미정')));
assert(!undecided.features.some(row => row.id === 'interview-review'));
assert(!I.preview(withAnswers({ task: 'undecided', workflow: 'request' })).ready);
const privateAnswers = { login_need: '로그인 없이 사용', ...withAnswers({ task: '내 메모 작성', workflow: 'create', visibility: 'personal' }) };
assert.equal(I.preview(privateAnswers).ready, false);
privateAnswers.deep_interview.push({ id: 'access_resolution', answer: 'login' });
assert.equal(I.preview(privateAnswers).ready, false);
assert.equal(I.preview(privateAnswers).settings.length, 0);
assert.throws(() => I.apply(privateAnswers));
delete privateAnswers.login_need;
assert.equal(I.preview(privateAnswers).ready, true);
assert.equal(I.apply(privateAnswers).login_need, '로그인 필요');
privateAnswers.login_need = '로그인 없이 사용';
privateAnswers.deep_interview.find(row => row.id === 'access_resolution').answer = 'link';
assert(I.preview(privateAnswers).features.some(row => row.id === 'interview-access-link'));
privateAnswers.deep_interview.push({ id: 'publication', answer: 'direct' });
assert.equal(I.preview(privateAnswers).ready, false);

const before = clone(base), applied = I.apply(base), plan = I.preview(base);
assert.deepEqual(base, before);
assert.equal(applied.features.length, 5);
assert.equal(applied.screens.length, 4);
assert.deepEqual(applied.screens[0].elementContents.form.items.map(row => row.name), ['예약 날짜', '시작 시간', '작업실 이름']);
assert(applied.screens[0].elementContents.form.items.every(row => row.required === '' && row.type === ''));
const noInformation = I.apply(withAnswers({ task: '신청', workflow: 'request' }));
assert.equal(noInformation.screens[0].elementContents.form.items.length, 0);
const duplicateInformation = I.apply(withAnswers({ task: '신청', workflow: 'request', information: '날짜, 날짜\n시간,,\n시간' }));
assert.deepEqual(duplicateInformation.screens[0].elementContents.form.items.map(row => row.name), ['날짜', '시간']);
const tooMuchInformation = withAnswers({ task: '신청', workflow: 'request', information: Array.from({ length: 13 }, (_, i) => `정보 ${i}`).join(',') });
assert.equal(I.preview(tooMuchInformation).ready, false);
assert.throws(() => I.apply(tooMuchInformation));

assert(applied.features.find(row => row.id === 'interview-review').reason.includes('장비 준비'));
assert.deepEqual(I.apply(applied), applied);
assert.equal(I.preview(applied).features.length, 0);
assert.equal(I.preview(applied).screens.length, 0);
assert.equal(I.preview(applied).warnings.length, 0);
const featureIds = new Set(applied.features.map(row => row.id));
const screenIds = new Set(applied.screens.map(row => row.id));
for (const screen of applied.screens) {
  assert(screen.elements.length > 0);
  for (const data of [screen, ...Object.values(screen.elementContents)]) {
    for (const id of data.featureIds) assert(featureIds.has(id));
    for (const action of data.flow) {
      assert(!action.featureId || featureIds.has(action.featureId));
      assert(!action.nextScreenId || ['@stay', '@back'].includes(action.nextScreenId) || screenIds.has(action.nextScreenId));
    }
  }
}
const manual = clone(applied);
manual.screens[0].purpose = '직접 보완한 설명';
manual.screens[0].placements.form.position.x = 5;
manual.features[0].outcome = '직접 바꾼 결과';
manual.deep_interview.find(row => row.id === 'workflow').answer = 'browse';
assert(I.preview(manual).warnings.some(message => message.includes('기존 내용이 달라요')));
assert(I.preview(manual).warnings.some(message => message.includes('이전 답변으로 추가한 내용')));
assert.deepEqual(I.apply(manual).screens, manual.screens);
assert.deepEqual(I.apply(manual).features, manual.features);

const duplicate = clone(base);
duplicate.features = [{ ...plan.features[0], id: 'manual-feature', name: '  토요일에   쓸 작업실 예약 ' }];
duplicate.screens = [{ ...plan.screens[1], id: 'manual-result', name: '신청 결과', purpose: '기존 결과' }];
const reused = I.apply(duplicate);
assert.equal(reused.features.filter(row => row.id === 'interview-main').length, 0);
assert(reused.screens.find(row => row.id === 'interview-screen-primary').featureIds.includes('manual-feature'));
assert.equal(reused.screens.find(row => row.id === 'interview-screen-primary').elementContents.button.flow[0].nextScreenId, 'manual-result');
assert.equal(reused.screens.find(row => row.id === 'manual-result').purpose, '기존 결과');
const capped = { ...base, screens: Array.from({ length: A.MAX_ROWS }, (_, index) => ({ id: 'manual-' + index, name: '기존 ' + index })) };
const cappedCopy = clone(capped);
assert.equal(I.preview(capped).ready, false);
assert.throws(() => I.apply(capped));
assert.deepEqual(capped, cappedCopy);
assert.equal(I.preview({ ...base, audience: A.UNKNOWN, roles: A.UNKNOWN, features: A.UNKNOWN, screens: A.UNKNOWN }).ready, true);
assert.equal(I.apply({ ...base, audience: A.UNKNOWN, roles: A.UNKNOWN }).audience, A.UNKNOWN);
const large = clone(base);
large.audience = [{ id: 'person', person: '가'.repeat(A.MAX_TEXT) }];
large.deep_interview.forEach(row => row.reason = '나'.repeat(A.MAX_TEXT));
assert.equal(I.apply(large).features[0].actor.length, A.MAX_TEXT);
assert(I.apply(large).features.every(row => row.reason.length <= A.MAX_TEXT));

for (const value of [
  [{ id: 'unknown', answer: 'x' }], [{ id: 'workflow', answer: 'not-a-choice' }],
  [{ id: 'task', answer: 1 }], [{ id: 'task', answer: '가'.repeat(301) }],
  [{ id: 'task', answer: 'x', reason: '가'.repeat(A.MAX_TEXT + 1) }],
  [{ id: 'task', answer: 'x', admin: true }], [{ id: 'task', answer: 'x' }, { id: 'task', answer: 'y' }],
  Array.from({ length: Q.interviewQuestions.length + 1 }, (_, index) => ({ id: 'id-' + index, answer: '' }))
]) assert.throws(() => A.normalizeAnswers({ deep_interview: value }));
const payload = '</textarea><script>alert(1)</script>';
assert.equal(A.normalizeAnswers(withAnswers({ task: payload })).deep_interview[0].answer, payload);
for (const value of [applied, { project_name: '이전 프로젝트', screens: [{ id: 'old', name: '기존 화면' }] }]) {
  const project = P.createProject({ answers: value, step: 4 });
  const restored = P.importBackup({ format: 'buildbrief-idea', version: 1, ...project }).projects[0];
  assert.deepEqual(restored.answers, A.normalizeAnswers(value));
  assert.equal(restored.step, 4);
}
assert.equal(A.progress(base).total, A.progress({}).total);
console.log('Adaptive interview checks passed');
