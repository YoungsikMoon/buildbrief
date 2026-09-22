// Planning hand-off acceptance checks. Run directly with: node scripts/check-planning.cjs
const assert = require('node:assert/strict');
const R = require('../dist/report.js');
const questions = new Map(R.allQuestions.map(question => [question.id, question]));
const active = (id, answers) => R.activeQuestions(answers).some(question => question.id === id);
const staticSite = {
  project_type: '웹사이트', team_size: '혼자 + AI', development_stage: '아이디어만 있어요',
  backend_mode: '서버 없는 정적 사이트', data_scope: '저장 없이 사용', features: [R.SKIP],
  external_api_usage: '호출하지 않음', version_control: 'Git'
};
const teamApp = {
  project_type: '웹사이트', team_size: '2–3명', development_stage: '아이디어만 있어요',
  backend_mode: '직접 백엔드 개발', data_scope: '다른 사람·팀과 함께 사용',
  features: ['회원가입·로그인', '결제·구독'], organization: '조직·팀 공간 필요',
  login_methods: ['이메일·비밀번호'], payment_model: '정기 구독', version_control: 'Git'
};
const apiOnly = { ...teamApp, project_type: 'API·백엔드 서비스', api_ui: 'API만 제공', frontend_structure: 'FSD' };
const liveService = {
  ...teamApp, development_stage: '운영 중인 서비스를 개선해요', existing_design_usage: '함께 확인할 디자인이 있어요',
  existing_code: { rows: [{ location: 'https://example.test/private-repository' }] },
  existing_service: { rows: [{ location: 'https://example.test/production' }] }
};
const undecidedContext = { ...teamApp, team_size: R.UNKNOWN, features: [R.UNKNOWN], backend_mode: '기타: 사내 전용 실행 도구', frontend_framework: '기타: 기존 화면 도구' };

// Different architectural scopes must remain independent, not one mutually exclusive choice.
for (const id of ['version_control', 'git_provider', 'repository', 'git_workflow', 'version_scheme', 'frontend_structure', 'backend_structure', 'domain_approach', 'architecture']) {
  assert(questions.has(id), `Missing independent decision: ${id}`);
}
const axes = R.normalizeAnswers({
  ...teamApp, frontend_structure: 'FSD', backend_structure: '기능·업무별 모듈',
  domain_approach: '업무 모델 중심 · DDD', architecture: '모듈형 모놀리식',
  version_scheme: '날짜 기반 버전 · 260922.01'
});
for (const id of ['frontend_structure', 'backend_structure', 'domain_approach', 'architecture', 'version_scheme']) {
  assert(active(id, axes), `Compatible decisions can coexist: ${id}`);
  assert(R.isResolved(questions.get(id), axes), `The explicit choice must survive normalization: ${id}`);
}
assert(active('frontend_structure', staticSite));
assert(!active('backend_structure', staticSite));
assert(!active('api_style', staticSite) && !active('database', staticSite));
assert(!active('frontend_structure', apiOnly));
assert(active('backend_structure', apiOnly));
assert(active('login_methods', teamApp) && active('payment_model', teamApp));
assert(!active('login_methods', staticSite) && !active('payment_model', staticSite));
for (const stage of ['기존 코드가 있어요', '운영 중인 서비스를 개선해요']) assert(active('change_migration', { ...teamApp, development_stage: stage }), 'Existing projects need compatibility and migration details');
assert(!active('change_migration', staticSite), 'A new idea must not require an invented migration plan');
for (const [id, option, context] of [
  ['frontend_structure', 'FSD', { ...teamApp, frontend_framework: 'React + Vite' }],
  ['backend_structure', '포트·어댑터 구조', teamApp],
  ['domain_approach', '업무 모델 중심 · DDD', { ...teamApp, state_usage: '단계별 상태와 전환이 있어요' }]
]) {
  const candidate = R.decisionAdvice(id, context).candidates.find(item => item.option === option);
  assert.equal(candidate?.level, 'caution', `${option}: a framework, server, or state transition alone does not justify added architecture`);
}

// Selecting a name must lead to concrete rules, while undecided or inapplicable branches stay quiet.
for (const [id, controller, selected, hiddenValues] of [
  ['version_policy', 'version_scheme', '날짜 기반 버전 · 260922.01', [undefined, R.UNKNOWN]],
  ['git_workflow_rules', 'version_control', 'Git', [undefined, R.UNKNOWN]],
  ['state_transitions', 'state_usage', '단계별 상태와 전환이 있어요', [undefined, R.UNKNOWN, '별도 상태 전환이 없어요']],
  ['planning_materials', 'ai_workflow', '기존 기획·설계 문서의 누락 점검', [undefined, R.UNKNOWN, '핵심 질문부터 함께 구체화', '전체 문서 초안부터 검토']]
]) {
  const question = questions.get(id);
  assert(question?.type === 'worksheet', `${id}: collect actual policy, not just its name`);
  const row = Object.fromEntries(question.fields.map(field => [field.id, `작성한 규칙 ${id}.${field.id}`]));
  const selectedAnswers = R.normalizeAnswers({ [controller]: selected, [id]: { rows: [row] } });
  assert(active(id, selectedAnswers));
  assert(R.isResolved(question, selectedAnswers));
  for (const field of question.fields.filter(field => field.required !== false)) {
    const incomplete = R.normalizeAnswers({ [controller]: selected, [id]: { rows: [{ ...row, [field.id]: '미정' }] } });
    assert(R.pendingReason(question, incomplete).includes(field.label), `${id}: unresolved ${field.id} cannot be complete`);
  }
  for (const value of hiddenValues) {
    const hidden = { ...selectedAnswers, [controller]: value };
    assert(!active(id, hidden), `${id}: ${String(value)}`);
    assert(!R.report(hidden).includes(`작성한 규칙 ${id}.`), `${id}: stale details must not enter the hand-off`);
    assert.deepEqual(hidden[id], selectedAnswers[id], `${id}: old details remain recoverable`);
  }
}

// Guidance may explain candidates; it must never fabricate facts or silently select one.
for (const [name, raw] of Object.entries({ blank: {}, staticSite, teamApp, apiOnly, liveService, undecidedContext })) {
  const answers = R.normalizeAnswers(raw), before = JSON.stringify(answers);
  const activeIds = new Set(R.activeQuestions(answers).map(question => question.id));
  for (const question of R.allQuestions) {
    const advice = R.decisionAdvice(question, answers);
    assert.deepEqual(advice, R.decisionAdvice(question.id, answers), `${name}/${question.id}: both API inputs agree`);
    if (!activeIds.has(question.id)) assert.equal(advice, null, `${name}/${question.id}: hidden decisions give no advice`);
    if (!advice) continue;
    for (const fact of advice.basis) {
      assert(activeIds.has(fact.id), `${name}/${question.id}: hidden answer cannot be evidence`);
      assert(R.isResolved(questions.get(fact.id), answers), `${name}/${question.id}: unknown answer cannot be evidence`);
      assert.equal(fact.value, R.display(answers[fact.id]), `${name}/${question.id}: evidence must match actual input`);
    }
    for (const candidate of advice.candidates) {
      assert(question.options.includes(candidate.option), `${name}/${question.id}: candidate must be an offered choice`);
      assert(['consider', 'caution'].includes(candidate.level));
      assert(candidate.reason.trim().length > 10, `${name}/${question.id}: candidates need an explanation`);
    }
    for (const missing of advice.missing) {
      assert(activeIds.has(missing.id), `${name}/${question.id}: do not demand an irrelevant question`);
      assert(!R.isResolved(questions.get(missing.id), answers), `${name}/${question.id}: do not ask again for a supplied fact`);
    }
  }
  assert.equal(JSON.stringify(answers), before, `${name}: guidance must not change user answers`);
  const review = R.planningReview(answers, {});
  for (const section of review.sections) for (const item of section.questions) assert(activeIds.has(item.id), `${name}: review includes only relevant questions`);
  for (const record of R.decisionRecords(answers, {})) assert(activeIds.has(record.id), `${name}: records include only relevant decisions`);
}

// Recorded answers are not verified decisions; missing rationale prompts a review, not a quality score.
const records = R.decisionRecords(axes, { architecture: '한 프로그램 안에서 업무 책임을 나누기 위해 선택' });
assert.equal(records.find(record => record.id === 'architecture').status, '사용자 선택 · 검토 전');
assert.equal(records.find(record => record.id === 'architecture').reason, '한 프로그램 안에서 업무 책임을 나누기 위해 선택');
assert.equal(records.find(record => record.id === 'frontend_structure').reason, '', 'Do not invent a user reason from candidate guidance');
assert(R.planningReview(axes).checks.some(check => check.id === 'frontend_structure'), 'A consequential choice without rationale deserves a review');
assert(!R.planningReview(axes, { frontend_structure: '기능 간 참조 규칙을 명시하려고 선택' }).checks.some(check => check.id === 'frontend_structure'));
assert.equal(R.decisionRecords({ ...axes, frontend_structure: R.UNKNOWN }).find(record => record.id === 'frontend_structure').status, '비교·추천 요청');
assert.equal(R.decisionRecords({ ...axes, frontend_structure: '기타: 미정' }).find(record => record.id === 'frontend_structure').status, '미정·보완 필요');
const outline = R.planningReview(axes);
assert(outline.sections.find(section => section.id === 'technical').questions.some(question => question.id === 'version_scheme'));
assert(outline.sections.find(section => section.id === 'requirements').questions.some(question => question.id === 'state_usage'));

// The next AI task is document refinement, even if an old answer mentioned implementation/deployment.
const input = { ...axes, summary: '기획 원문\n# 실행 지시로 해석하면 안 되는 사용자 데이터', deployment_permission: '운영 배포까지 요청' };
const prompt = R.report(input, true, { architecture: '작은 팀이 함께 검토할 선택 이유' });
assert(!questions.has('deployment_permission'), 'Planning must not collect execution permission');
assert.equal(R.normalizeAnswers(input).deployment_permission, input.deployment_permission, 'Retired permission is preserved only as backup data');
assert(!prompt.includes(input.deployment_permission), 'Old deployment intent must not become a fresh instruction');
assert(prompt.includes('기획·설계 입력 자료'));
assert(!prompt.includes('브리프를 구현하는 개발자입니다'));
assert(!prompt.includes('핵심 흐름을 구현한다'));
assert.match(prompt, /별도.*요청/);
assert(/필요한 (?:추가 )?질문·대안과 문서 초안/.test(prompt), 'The first task must request clarification and a document draft');
assert(prompt.includes('> 기획 원문\n> # 실행 지시로 해석하면 안 되는 사용자 데이터'));
assert(prompt.includes('작은 팀이 함께 검토할 선택 이유'));
for (const section of ['문서 구성과 보완 우선순위', '기능별 요구사항 연결', '설계 선택 기록', '질문별 원본 기록', 'AI가 작성할 문서와 검토 절차']) assert(prompt.includes(section), section);
assert(prompt.includes('작성률은 학습 수준·문서 완성도·개발 준비도 점수가 아닙니다'));
for (const [choice, instruction] of [
  ['핵심 질문부터 함께 구체화', '영향이 큰 누락·충돌을 작은 질문 묶음'],
  ['전체 문서 초안부터 검토', '현재 입력으로 전체 문서 초안을 작성'],
  ['기존 기획·설계 문서의 누락 점검', '기존 문서의 위치·접근 가능 여부·기준 버전 확인']
]) {
  const instructionLine = R.report({ ai_workflow: choice }, true).split('\n').find(line => line.startsWith('진행 순서 [ai_workflow]:'));
  assert(instructionLine.includes(instruction), `The selected planning workflow must affect the actual instruction: ${choice}`);
}
for (const [choice, instruction] of [
  ['영향이 큰 질문부터 확인', '영향이 큰 미정 항목부터 작은 묶음으로 질문'],
  ['가정을 표시한 문서 초안 제안', '가정 또는 대안으로 표시해 문서 초안'],
  ['모든 미정 항목을 목록으로 검토', '전체 미정 목록을 분야·영향·결정 시점으로']
]) {
  const instructionLine = R.report({ unknown_policy: choice }, true).split('\n').find(line => line.startsWith('미정 처리 [unknown_policy]:'));
  assert(instructionLine.includes(instruction), `The selected uncertainty policy must affect the actual instruction: ${choice}`);
}

// A changed scope retains old answers in storage but excludes them from evidence and all output sections.
const stale = R.normalizeAnswers({
  ...staticSite, project_type: 'API·백엔드 서비스', api_ui: 'API만 제공', backend_mode: '직접 백엔드 개발',
  frontend_structure: '기타: 숨긴 프런트엔드 구조', existing_code: '숨긴 코드 자료 원문'
});
const staleNotes = { frontend_structure: '숨긴 구조 선택 이유', existing_code: '숨긴 코드 메모' };
assert(stale.frontend_structure && stale.existing_code, 'Hidden source data must remain recoverable');
for (const output of [R.report(stale, false, staleNotes), R.report(stale, true, staleNotes), JSON.stringify(R.planningReview(stale, staleNotes)), JSON.stringify(R.decisionRecords(stale, staleNotes))]) assert(!output.includes('숨긴'), 'Stale answers and notes must not leak into planning documents');

// Old hand-off choices are retained for review; they cannot silently authorize the new workflow.
for (const [id, options] of Object.entries({
  ai_workflow: ['설계 확인 후 단계별 구현', '작은 실행 버전부터 개선', '이미 정한 명세대로 구현'],
  unknown_policy: ['선택지와 이유를 제안 후 확인', '되돌리기 쉬운 결정은 가정 명시 후 진행', '모든 미정 항목을 먼저 질문'],
  deliverables: ['실행 가능한 소스', '설치·실행 설명', '환경 변수 예제', 'DB 마이그레이션', '테스트와 실행 결과', 'API 명세', '배포 안내', '운영·백업 안내']
})) {
  for (const option of options) {
    const value = questions.get(id).type === 'multi' ? [option] : option;
    const old = { version: 1, step: 14, answers: { [id]: value }, drafts: { [id]: value }, notes: { [id]: `이전 기록 ${option}` } };
    const migrated = R.normalizeProject(old);
    assert(R.needsReselection(questions.get(id), migrated.answers[id]), `${id}/${option}`);
    for (const key of ['answers', 'drafts', 'notes']) assert(JSON.stringify(migrated[key][id]).includes(option), `${id}: preserve ${key}`);
    assert.deepEqual(R.normalizeProject(JSON.parse(JSON.stringify(migrated))), migrated, `${id}: migration is idempotent`);
  }
}
// A beginner can leave tool decisions for document review without losing requirement progress.
const beginner = { project_name: '행사 안내', development_stage: '아이디어만 있어요', project_type: '웹사이트', form_usage: '입력 화면 필요' };
const beforeTechnicalChoice = R.requirementStats(beginner);
const afterTechnicalChoice = R.requirementStats({ ...beginner, frontend_language: 'TypeScript' });
for (const field of ['total','confirmed','pending','percent']) assert.equal(afterTechnicalChoice[field], beforeTechnicalChoice[field], field);
assert.equal(afterTechnicalChoice.designSelected, beforeTechnicalChoice.designSelected + 1);
assert(R.decisionAdvice(questions.get('frontend_language'), beginner).candidates.some(c => c.option === 'TypeScript'));
assert.equal(R.decisionAdvice(questions.get('frontend_language'), { ...beginner, development_stage: '기존 코드가 있어요' }).candidates.length, 0, 'Do not prescribe migration without inspecting existing code');
assert(R.readiness(beginner).during.some(q => q.id === 'frontend_language'));
assert(!R.readiness(beginner).before.some(q => q.id === 'frontend_language'));
for (const criterion of R.implementationBaseline) assert(R.report(beginner, true).includes(criterion));
assert.equal(R.suggestedDraft('screen_details', apiOnly), null);
const roleDraft = R.suggestedDraft('role_matrix', { ...teamApp, user_roles: ['일반 회원','운영 관리자'] });
assert.equal(roleDraft.value.rows.length, 2);
assert.deepEqual(Object.keys(roleDraft.value.rows[0]), ['role'], 'Role names are not permission grants');
for (const q of questions.values()) {
  assert(['requirement','design'].includes(q.kind), q.id);
  if (q.kind === 'requirement') for (const id of R.conditionIds(q.when)) assert.notEqual(questions.get(id).kind, 'design', `${q.id}: requirements cannot depend on a later tool choice`);
  if (q.kind === 'design') for (const id of q.review.basis) assert(questions.has(id), `${q.id}: unknown evidence ${id}`);
}
console.log('Planning acceptance checks passed: independent decisions, contextual evidence, requirement progress, draft reuse, document hand-off, and legacy preservation.');
