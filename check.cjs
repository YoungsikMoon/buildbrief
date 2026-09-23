// Run: node check.cjs — static planning-data checks, no framework or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Q = require('./dist/questions.js');
const R = require('./dist/report.js');
const P = require('./dist/projects.js');
const G = require('./dist/guides.js');
const clone = value => JSON.parse(JSON.stringify(value));
const question = id => R.allQuestions.find(q => q.id === id);
const typeQuestion = type => R.allQuestions.find(q => q.type === type);
const activeIds = answers => R.activeQuestions(answers).map(q => q.id);
const feature = (id = 'feature-1', category = 'booking', priority = '첫 버전에 필요') => ({ id, category, name: `예약하기 ${id}`, actor: '손님', outcome: '원하는 시간을 예약하고 결과를 확인한다', priority, notes: '' });
const screen = (id, elements) => ({ id, name: '예약 관리', purpose: '신청 내용을 빠르게 확인', roles: '운영 직원', featureIds: ['feature-1'], elements, elementNotes: Object.fromEntries(elements.map(item => [item, `${item}의 화면 용도`])), content: '예약 목록', empty: '예약이 없다고 안내', error: '다시 시도', mobile: '작은 화면에서는 상세 화면으로 이동' });
let passed = 0;
function test(name, run) {
  try { run(); passed++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}

test('Static deployment protections remain intact', () => {
  const deployment = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(deployment.pages_build_output_dir, './dist');
  assert(!deployment.main);
  const headers = fs.readFileSync('dist/_headers', 'utf8');
  for (const rule of ["script-src 'self'", "connect-src 'none'", "object-src 'none'", "frame-ancestors 'none'", 'X-Content-Type-Options: nosniff']) assert(headers.includes(rule));
  assert(!/script-src[^;\n]*(?:unsafe-inline|unsafe-eval)/.test(headers));
});

test('The page references the exact current assets', () => {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  for (const file of ['app.js', 'questions.js', 'report.js', 'projects.js', 'guides.js', 'styles.css']) {
    const source = fs.readFileSync(`dist/${file}`, 'utf8').replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
    assert(html.includes(`${file}?v=${hash}`), `Stale asset reference: ${file}`);
  }
});

test('Ten coherent stages use unique questions, feature types, and UI elements', () => {
  assert.equal(Q.steps.length, 10);
  for (const items of [Q.steps, R.allQuestions, Q.featureTypes, Q.uiElements]) assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert(!/MSA|Docker|Kafka|PostgreSQL|TypeScript|Spring Boot/.test(JSON.stringify(Q.steps)));
  const walk = condition => {
    if (!condition) return;
    if (condition.id) assert(question(condition.id), `Unknown condition question: ${condition.id}`);
    if (condition.category) assert(Q.featureTypes.some(item => item.id === condition.category));
    for (const item of [...(condition.any || []), ...(condition.all || []), ...(condition.not ? [condition.not] : [])]) walk(item);
  };
  for (const step of Q.steps) for (const group of step.groups) { walk(group.when); group.questions.forEach(q => walk(q.when)); }
});

test('Conditions evaluate actual feature categories and nested choices', () => {
  const answers = { features: [feature()], login: ['카카오', 'Google'], need: '일부' };
  assert(R.matches({ id: 'features', category: 'booking' }, answers));
  assert(!R.matches({ id: 'features', category: 'payments' }, answers));
  assert(!R.matches({ id: 'features', category: 'booking' }, { features: R.UNKNOWN }));
  assert(R.matches({ all: [{ id: 'need', value: '일부' }, { id: 'login', includes: '카카오' }, { id: 'login', in: ['네이버', 'Google'] }, { not: { id: 'features', category: 'payments' } }] }, answers));
  assert(R.matches({ any: [{ id: 'need', value: '전체' }, { id: 'need', value: '일부' }] }, answers));
});

test('Every selected feature category activates its own real followups', () => {
  const expected = { booking: ['booking_rules'], payments: ['payment_offer', 'payment_timing', 'payment_cancel'], ai: ['ai_help', 'ai_review'], location: ['location_use', 'device_needs'], device: ['device_needs'], files: ['file_rules', 'device_needs'], collaboration: ['collaboration_rules'], workflow: ['workflow_rules'], notifications: ['notification_rules'] };
  const followups = [...new Set(Object.values(expected).flat())];
  for (const [category, visible] of Object.entries(expected)) {
    const active = activeIds({ features: [feature('feature-1', category)] });
    for (const id of followups) assert.equal(active.includes(id), visible.includes(id), `${category}: ${id}`);
  }
  assert(!activeIds({ features: [feature('read', 'browse')] }).some(id => followups.includes(id)));
  assert(!activeIds({ features: [feature('map', 'location')], location_use: ['정해진 장소를 지도에서 보기'] }).includes('permission_alternative'));
  assert(activeIds({ features: [feature('map', 'location')], location_use: ['내 현재 위치 주변 찾기'] }).includes('permission_alternative'));
  assert(!activeIds({ features: [], device_needs: ['카메라로 촬영'], location_use: ['내 위치를 다른 사람에게 공유'] }).includes('permission_alternative'), 'Inactive device choices must not activate a stale followup');
  assert(activeIds({ features: [feature('map', 'location')], location_use: ['다른 용도'] }).includes('location_other'));
  assert(activeIds({ features: [feature('device', 'device')], device_needs: ['다른 기능'] }).includes('device_other'));
  assert(!activeIds({ features: [], device_needs: ['다른 기능'], location_use: ['다른 용도'] }).some(id => ['location_other', 'device_other'].includes(id)));
});

test('Inactive answers remain in backup but leave the current document', () => {
  const q = R.allQuestions.find(q => q.type === 'textarea' && q.when?.category);
  assert(q);
  const original = { features: [feature('feature-1', q.when.category)], [q.id]: '선택한 기능만의 고유 규칙 내용' };
  assert(R.report(original).includes('선택한 기능만의 고유 규칙 내용'));
  const hidden = R.normalizeAnswers({ ...original, features: [] });
  assert.equal(hidden[q.id], original[q.id]);
  assert(!R.report(hidden).includes(original[q.id]));
});

test('Unknown stays unknown and is not a generated requirement', () => {
  assert.equal(R.UNKNOWN, '아직 미정');
  const q = typeQuestion('single');
  assert.equal(R.choiceOptions(q).filter(item => item === R.UNKNOWN).length, 1);
  assert.equal(R.normalizeAnswers({ [q.id]: R.UNKNOWN })[q.id], R.UNKNOWN);
  assert(R.report({ project_name: R.UNKNOWN }).includes('확인해 볼 질문'));
  assert(!R.report({}).includes('React'));
});

test('Guides explain known choices without inventing advice for unknown items', () => {
  assert(G.get('features', 'booking')?.meaning);
  assert(G.get('screens', 'fab')?.meaning);
  assert(G.get('login_methods', '이메일 인증 링크·번호')?.meaning);
  assert.equal(G.get('devices', R.UNKNOWN), null);
  assert.equal(G.get('features', '없는유형'), null);
});

test('Exclusive absence choices cannot coexist with positive choices', () => {
  for (const [id, values] of [['current_methods', ['특별한 방법 없음', '전화']], ['signup_fields', ['추가 정보 없음', '이메일']], ['device_needs', ['기기 기능이 필요하지 않음', '카메라로 촬영']]]) {
    assert.throws(() => R.normalizeAnswers({ [id]: values }));
    assert.deepEqual(R.normalizeAnswers({ [id]: [values[0]] })[id], [values[0]]);
  }
});

test('Own credentials and several social login methods coexist', () => {
  const q = R.allQuestions.find(q => q.type === 'multi' && q.options?.includes('카카오') && q.options.includes('Google'));
  assert(q);
  const methods = [q.options.find(item => /비밀번호/.test(item)), '카카오', '네이버', 'Google'];
  assert(methods[0]);
  assert.deepEqual(R.normalizeAnswers({ [q.id]: methods })[q.id], methods);
  assert.throws(() => R.normalizeAnswers({ [q.id]: [...methods, R.UNKNOWN] }));
  const answers = { features: [feature()], login_need: '일부 기능에서만 로그인', login_features: ['feature-1'], login_methods: methods, password_recovery: '이메일로 다시 설정' };
  assert(activeIds(answers).includes('password_recovery'));
  assert(R.report(answers).includes('이메일로 다시 설정'));
  assert(R.report(answers).includes('예약하기 feature-1'));
  assert(!activeIds({ ...answers, login_methods: ['카카오'] }).includes('password_recovery'));
  const noLogin = R.normalizeAnswers({ ...answers, login_need: '로그인 없이 사용' });
  assert.equal(noLogin.password_recovery, '이메일로 다시 설정');
  assert(!R.report(noLogin).includes('이메일로 다시 설정'));
  const other = { login_need: '일부 기능에서만 로그인', login_methods: ['다른 방법'], signup_fields: ['다른 정보'] };
  assert(activeIds(other).includes('login_other'));
  assert(activeIds(other).includes('signup_other'));
  assert(!activeIds({ ...other, login_need: '로그인 없이 사용' }).some(id => ['login_other', 'signup_other'].includes(id)));
});

test('Generic user and role rows retain their distinct fields', () => {
  const q = typeQuestion('rows');
  const row = { id: 'person-1', ...Object.fromEntries(q.fields.map(f => [f.id, f.type === 'multi' ? [f.options[0]] : f.type === 'single' ? f.options[0] : `${f.label} 내용`])) };
  const a = R.normalizeAnswers({ [q.id]: [row] });
  assert.deepEqual(a[q.id][0], row);
  assert(R.report(a).includes(q.fields[0].label));
});

test('Multiple features from the same category retain stable identities', () => {
  const a = R.normalizeAnswers({ features: [feature(), feature('feature-2')] });
  assert.equal(a.features.length, 2);
  assert.notEqual(a.features[0].id, a.features[1].id);
  assert(R.report(a).includes('[F01]'));
  assert(R.report(a).includes('[F02]'));
});

test('Screens combine navigation, actions, tables, and side panels per role', () => {
  const elements = ['appbar', 'sidebar', 'fab', 'table', 'rightpanel'];
  assert(elements.every(id => Q.uiElements.some(item => item.id === id)));
  const answers = R.normalizeAnswers({ features: [feature()], screens: [screen('screen-1', elements), { ...screen('screen-2', [elements[0]]), roles: '손님' }] });
  assert.deepEqual(answers.screens[0].elements, elements);
  assert.equal(answers.screens[1].elements.length, 1);
  const output = R.report(answers);
  for (const id of elements) assert(output.includes(answers.screens[0].elementNotes[id]));
  assert(output.includes('운영 직원')); assert(output.includes('손님')); assert(output.includes('예약하기 feature-1'));
});

test('Flow preserves sequence, linked names, and manually described actions', () => {
  const q = typeQuestion('flow');
  const a = R.normalizeAnswers({ features: [feature()], [q.id]: [{ id: 'flow-1', featureId: '', note: '처음 방문해 안내 읽기' }, { id: 'flow-2', featureId: 'feature-1', note: '시간을 선택한다' }] });
  const output = R.report(a);
  assert(output.indexOf('처음 방문해 안내 읽기') < output.indexOf('시간을 선택한다'));
  assert(output.includes('2번째 행동'));
  assert(output.includes('예약하기 feature-1'));
});

test('Removed feature links are preserved and surfaced for review', () => {
  const a = R.normalizeAnswers({ screens: [screen('screen-1', [])] });
  assert.deepEqual(a.screens[0].featureIds, ['feature-1']);
  assert(R.report(a).includes('연결할 기능 확인 필요'));
});

test('Reports use readable local numbers and omit untouched sections and optional blanks', () => {
  const id = '43f9cd98-5be6-4a28-9348-9fc22c7f2da0';
  const answers = { project_name: '작은 기획', features: [{ ...feature(id), name: '예약', notes: '' }], screens: [{ ...screen('screen-internal-id', []), featureIds: [id], empty: '', error: '', mobile: '' }] };
  const before = clone(answers), output = R.report(answers);
  assert(output.includes('[F01]')); assert(output.includes('[S01]'));
  assert(!output.includes(id)); assert(!output.includes('screen-internal-id'));
  const body = output.split('## 확인해 볼 질문')[0];
  assert(!body.includes('세부 규칙·메모'));
  assert(!body.includes('자료가 없을 때'));
  assert(!body.includes('실패했을 때'));
  assert(!body.includes('휴대폰에서의 사용'));
  assert(!body.includes(question('problem').label));
  assert(output.includes(question('problem').label));
  assert.deepEqual(answers, before, 'Display numbering must not replace persistent IDs');
});

test('First-release scope comes from the original feature cards', () => {
  const a = { features: [feature(), feature('later', 'search', '나중에'), feature('unsure', 'custom', R.UNKNOWN)] };
  const output = R.report(a);
  assert(output.includes('첫 버전에 필요한 기능'));
  assert(output.includes('나중에 만들 기능'));
  assert(output.includes('시기 미정인 기능'));
  assert(output.includes('예약하기 later'));
  assert(output.includes('예약하기 unsure'));
});

test('One reference row per URL keeps notes and admits only safe links', () => {
  const q = typeQuestion('references');
  const a = R.normalizeAnswers({ [q.id]: [{ id: 'ref-1', url: 'https://example.com/a?x=1', note: '검색 화면 참고' }, { id: 'ref-2', url: 'http://example.org', note: '' }] });
  const output = R.report(a);
  assert(output.includes('<https://example.com/a?x=1>'));
  assert(output.includes('<http://example.org/>'));
  assert(output.includes('검색 화면 참고'));
  assert(output.includes('열람·분석한 것은 아닙니다'));
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'https://', '//example.com', 'https://example.com https://another.example']) assert.equal(R.safeUrl(url), '');
});

test('Unfinished and unsafe URL text survives autosave without becoming a link', () => {
  const q = typeQuestion('references');
  for (const url of ['https://', 'javascript:alert(1)', '주소를 나중에 적기']) {
    const a = R.normalizeAnswers({ [q.id]: [{ id: 'ref-1', url, note: '' }] });
    assert.equal(a[q.id][0].url, url);
    const output = R.report(a);
    assert(output.includes('URL 확인 필요'));
    assert(!output.includes(`<${url}>`));
  }
});

test('Progress counts touched stages, not answered questions or completion', () => {
  assert.deepEqual(R.progress({}), { started: 0, total: 10 });
  const first = Q.steps[0].groups.flatMap(g => g.questions).filter(q => ['text', 'textarea'].includes(q.type));
  const a = Object.fromEntries(first.map(q => [q.id, R.UNKNOWN]));
  assert.equal(R.progress(a).started, 1);
  assert.equal(R.isAnswered('  '), false);
  assert.equal(R.isAnswered([]), false);
  assert.equal(R.isAnswered({ id: 'empty', category: 'booking' }), false);
});

test('Malformed known answer types fail without changing the source', () => {
  const q = typeQuestion('single');
  const invalid = [{ project_name: 42 }, { features: {} }, { features: [null] }, { screens: [{ id: 'screen-1', featureIds: 'wrong' }] }, { [q.id]: '없는 선택지' }, { references: [{ id: 'ref-1', url: {} }] }];
  for (const input of invalid) {
    const before = clone(input);
    assert.throws(() => R.normalizeAnswers(input));
    assert.deepEqual(input, before);
  }
});

test('Question and field whitelists block prototype pollution and obsolete schemas', () => {
  for (const input of [JSON.parse('{"__proto__":{"polluted":true}}'), { backend_framework: 'FastAPI' }, { unknown_question: '답' }]) assert.throws(() => R.normalizeAnswers(input));
  const a = R.normalizeAnswers({ features: [{ ...feature(), unrecognized: 'not copied' }] });
  assert(!Object.hasOwn(a.features[0], 'unrecognized'));
  assert.equal({}.polluted, undefined);
});

test('Limits and duplicate identities reject an import instead of truncating it', () => {
  assert.throws(() => R.normalizeAnswers({ project_name: 'x'.repeat(R.MAX_TEXT + 1) }));
  assert.equal(R.normalizeAnswers({ project_name: 'x'.repeat(200) }).project_name.length, 200);
  assert.throws(() => R.normalizeAnswers({ project_name: 'x'.repeat(201) }));
  assert.equal(R.normalizeAnswers({ summary: 'x'.repeat(6000) }).summary.length, 6000);
  assert.throws(() => R.normalizeAnswers({ summary: 'x'.repeat(6001) }));
  assert.throws(() => R.normalizeAnswers({ references: [{ id: 'ref-1', url: 'x'.repeat(2001) }] }));
  assert.throws(() => R.normalizeAnswers({ features: Array.from({ length: R.MAX_ROWS + 1 }, (_, i) => feature(`feature-${i}`)) }));
  assert.throws(() => R.normalizeAnswers({ features: [feature(), feature()] }));
  assert.throws(() => R.normalizeAnswers({ features: [{ ...feature(), id: '<script>' }] }));
  assert.throws(() => R.normalizeAnswers({ screens: [{ ...screen('screen-1', []), elements: ['unknown-component'] }] }));
});

test('Normalization is idempotent, detached, and preserves drafts and notes', () => {
  const input = { answers: { features: [feature()] }, drafts: { project_name: '작성 중 이름' }, notes: { features: '내가 남긴 설명' } };
  const normalized = R.normalizeProject(input);
  assert.deepEqual(R.normalizeProject(normalized), normalized);
  normalized.answers.features[0].name = '변경';
  assert.equal(input.answers.features[0].name, '예약하기 feature-1');
  assert.throws(() => R.normalizeProject({ answers: {}, drafts: [], notes: {} }));
  assert.throws(() => R.normalizeNotes({ features: {} }));
});

test('Answer reasons survive project imports and conditional visibility without becoming answers', () => {
  const notes = { summary: '대상을 먼저 만나 보고 정하려고 함', scope: '첫 범위를 아직 결정하지 못한 이유', booking_rules: '동일 시간 중복 신청을 막고 싶은 이유' };
  const first = P.createProject({ notes }), second = P.createProject();
  const backup = JSON.parse(JSON.stringify({ format: 'buildbrief-ideas', version: 1, activeId: first.id, projects: [first, second] }));
  const imported = P.importBackup(backup);
  assert.deepEqual(imported.projects[0].notes, notes);
  assert.deepEqual(imported.projects[1].notes, {});
  assert.deepEqual(imported.projects[0].answers, {});
  const notesOnly = R.report(imported.projects[0].answers, false, imported.projects[0].notes);
  assert(notesOnly.includes('이렇게 답한 이유·추가 메모'));
  assert(notesOnly.includes(notes.summary));
  assert(notesOnly.includes(notes.scope), 'Scope notes must appear even before features are added');
  assert(!notesOnly.includes(notes.booking_rules));
  const withBooking = { features: [feature()] };
  const progress = R.progress(withBooking);
  assert(R.report(withBooking, true, notes).includes(notes.booking_rules));
  assert(!R.report({ features: [] }, false, notes).includes(notes.booking_rules));
  assert(R.report(withBooking, false, notes).includes(notes.booking_rules), 'Reactivating a question restores its reason');
  assert.deepEqual(R.progress(withBooking), progress);
  assert.deepEqual(R.progress(imported.projects[0].answers), { started: 0, total: 10 });
  assert.deepEqual(imported.projects[0].notes, notes, 'Hiding a question must not erase its reason');
});

test('Recommendation requests round-trip separately while old projects default to no requests', () => {
  const answers = { login_need: '일부 기능에서만 로그인', login_methods: ['이메일·비밀번호', '카카오'] };
  const notes = { login_methods: '기존 고객의 선호를 함께 확인하고 싶음' };
  const first = P.createProject({ answers, notes, recommendations: ['login_methods', 'screens'] });
  const second = P.createProject();
  const old = clone(first); delete old.recommendations;
  const oldInput = { version: 1, activeId: old.id, projects: [old] };
  assert.deepEqual(P.normalizeWorkspace(oldInput).projects[0].recommendations, []);
  assert.deepEqual(P.importBackup({ format: 'buildbrief-idea', version: 1, ...old }).projects[0].recommendations, []);
  assert(!Object.hasOwn(old, 'recommendations'));
  for (const backup of [{ format: 'buildbrief-idea', version: 1, ...first }, { format: 'buildbrief-ideas', version: 1, activeId: first.id, projects: [first, second] }]) {
    const imported = P.importBackup(JSON.parse(JSON.stringify(backup)));
    assert.deepEqual(imported.projects[0].recommendations, ['login_methods', 'screens']);
    assert.deepEqual(imported.projects[0].answers, answers);
    assert.deepEqual(imported.projects[0].notes, notes);
    if (imported.projects[1]) assert.deepEqual(imported.projects[1].recommendations, []);
    imported.projects[0].recommendations.push('scope');
    assert.deepEqual(first.recommendations, ['login_methods', 'screens']);
    assert.deepEqual(second.recommendations, []);
  }
  for (const recommendations of [null, {}, 'screens', [42], ['missing-question'], ['project_name'], ['screens', 'screens'], Array(R.allQuestions.length + 1).fill('screens')]) {
    const input = { format: 'buildbrief-idea', version: 1, ...clone(first), recommendations };
    const before = clone(input);
    assert.throws(() => P.importBackup(input));
    assert.deepEqual(input, before);
  }
});

test('Only active recommendation requests are exported without clearing answers or counting as progress', () => {
  const recommendations = ['login_methods', 'screens'];
  const answers = { login_need: '일부 기능에서만 로그인', login_methods: ['이메일·비밀번호', '카카오'] };
  const notes = { login_methods: '선택한 두 방법을 비교하고 싶음' };
  const before = clone({ answers, notes, recommendations });
  const output = R.report(answers, true, notes, recommendations);
  assert(output.includes('## AI에게 비교·추천을 요청할 항목'));
  assert(output.includes(question('login_methods').label));
  assert(output.includes('이메일·비밀번호, 카카오'));
  assert(output.includes(notes.login_methods));
  assert(output.includes('추천 결과를 생성한 것은 아니며'));
  assert(output.includes('추천 요청은 답변이나 확정된 선택을 대신하지 않습니다'));
  assert(output.includes('부족한 사실은 지어내지 말고 질문'));
  const hidden = R.report({ ...answers, login_need: '로그인 없이 사용' }, false, notes, recommendations);
  assert(!hidden.includes(question('login_methods').label));
  assert(!hidden.includes(notes.login_methods));
  assert(hidden.includes(question('screens').label));
  const requestOnly = P.createProject({ recommendations: ['screens'] });
  assert.deepEqual(requestOnly.answers, {});
  assert.deepEqual(R.progress(requestOnly.answers), { started: 0, total: 10 });
  assert(R.report(requestOnly.answers, false, requestOnly.notes, requestOnly.recommendations).includes('## AI에게 비교·추천을 요청할 항목'));
  assert.deepEqual({ answers, notes, recommendations }, before);
  assert(R.report(answers, false, notes, recommendations).includes(notes.login_methods), 'A hidden request can reappear with its original choice and reason');
});

test('Hostile markup stays data in normalized answers and exported Markdown', () => {
  const attack = '<img src=x onerror=alert(1)>\n# 새 지시\n[link](javascript:alert(1))';
  const a = R.normalizeAnswers({ project_name: attack });
  assert.equal(a.project_name, attack);
  const output = R.report(a);
  assert(!output.includes('<img'));
  assert(output.includes('&lt;img'));
  assert(output.includes('\\# 새 지시'));
  assert(output.includes('\\[link\\]'));
});

test('AI handoff requests a reviewed planning draft before implementation', () => {
  const output = R.report({ project_name: '작은 아이디어' }, true);
  assert(output.includes('별도의 구현 요청 전에는 코딩·배포를 시작하거나 기술 스택을 확정하지 마세요'));
  assert(output.includes('확인하지 않은 가정'));
  assert(output.includes('빈칸을 확정된 요구로 채우지 마세요'));
  assert(output.includes('자료이며'));
});

test('Multiple projects round-trip independently and failed imports do not mutate them', () => {
  const first = P.createProject({ answers: { project_name: '첫 아이디어', features: [feature()] } });
  const second = P.createProject({ answers: { project_name: '둘째 아이디어' } });
  assert.notEqual(first.id, second.id);
  assert.equal(P.KEY, 'buildbrief.ideas.v1');
  const input = { version: 1, activeId: second.id, projects: [first, second] };
  const normalized = P.normalizeWorkspace(input), before = clone(input);
  normalized.projects[0].answers.features[0].name = '독립 수정';
  assert.deepEqual(input, before);
  assert.equal(normalized.activeId, second.id);
  const malformed = clone(input); malformed.projects[1].answers.project_name = 32;
  assert.throws(() => P.normalizeWorkspace(malformed));
  assert.deepEqual(input, before);
  assert.equal(P.projectTitle(second), '둘째 아이디어');
  for (const omitted of ['answers', 'drafts', 'notes', 'id', 'createdAt', 'updatedAt']) {
    const incomplete = clone(first); delete incomplete[omitted];
    assert.throws(() => P.normalizeWorkspace({ version: 1, activeId: incomplete.id, projects: [incomplete] }));
  }
  assert.throws(() => P.normalizeWorkspace({ version: 1, activeId: undefined, projects: [{ format: 'buildbrief-idea', version: 1 }] }));
});

test('Single and whole-workspace backup imports validate before cloning project IDs', () => {
  const first = P.createProject({ answers: { project_name: '첫 프로젝트', features: [feature()] }, notes: { features: '범위 확인' } });
  const second = P.createProject({ answers: { project_name: '둘째 프로젝트', login_need: '로그인 없이 사용' } });
  const single = { format: 'buildbrief-idea', version: 1, ...first };
  const all = { format: 'buildbrief-ideas', version: 1, activeId: second.id, projects: [first, second] };
  for (const backup of [single, all]) {
    const before = clone(backup), imported = P.importBackup(backup);
    assert.deepEqual(backup, before);
    const source = backup.projects || [backup];
    assert.equal(imported.projects.length, source.length);
    imported.projects.forEach((project, index) => {
      assert.notEqual(project.id, source[index].id);
      assert.deepEqual(project.answers, source[index].answers);
      assert.equal(project.createdAt, source[index].createdAt);
      assert.deepEqual(project.notes, source[index].notes);
    });
    const activeIndex = backup.projects ? source.findIndex(p => p.id === backup.activeId) : 0;
    assert.equal(imported.activeId, imported.projects[activeIndex].id);
    imported.projects[0].answers.project_name = '가져온 사본 수정';
    assert.deepEqual(backup, before);
  }
  for (const omitted of ['answers', 'drafts', 'notes', 'id', 'createdAt', 'updatedAt']) {
    const bad = clone(single); delete bad[omitted];
    assert.throws(() => P.importBackup(bad));
  }
  for (const bad of [{ format: 'buildbrief-idea', version: 1 }, { ...single, answers: [] }, { ...single, version: 2 }, { ...single, format: 'buildbrief-project' }, null, { ...all, projects: [] }]) assert.throws(() => P.importBackup(bad));
  const conflict = clone(single); conflict.answers.current_methods = ['특별한 방법 없음', '전화'];
  const before = clone(conflict);
  assert.throws(() => P.importBackup(conflict));
  assert.deepEqual(conflict, before);
});

console.log(`Idea planner checks passed: ${passed} checks covering conditional questions, feature/screen links, login, safe export, import boundaries, and project isolation.`);
