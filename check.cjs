// Run: node check.cjs — static planning-data checks, no framework or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Q = require('./dist/questions.js');
const A = require('./dist/answers.js');
const R = require('./dist/report.js');
const P = require('./dist/projects.js');
const G = require('./dist/guides.js');
const V = require('./dist/views.js');
const clone = value => JSON.parse(JSON.stringify(value));
const question = id => A.allQuestions.find(q => q.id === id);
const typeQuestion = type => A.allQuestions.find(q => q.type === type);
const activeIds = answers => A.activeQuestions(answers).map(q => q.id);
const feature = (id = 'feature-1', category = 'booking', priority = '첫 버전에 필요') => ({ id, category, name: `예약하기 ${id}`, actor: '손님', outcome: '원하는 시간을 예약하고 결과를 확인한다', priority, notes: '' });
const screen = (id, elements) => ({ id, name: '예약 관리', purpose: '신청 내용을 빠르게 확인', roles: '운영 직원', featureIds: ['feature-1'], elements, elementNotes: Object.fromEntries(elements.map(item => [item, `${item}의 화면 용도`])), content: '예약 목록', empty: '예약이 없다고 안내', error: '다시 시도', mobile: '작은 화면에서는 상세 화면으로 이동' });
let passed = 0;
function test(name, run) {
  try { run(); passed++; }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}

test('Start state survives refresh and backup without changing legacy projects', () => {
  const pending = P.createProject({started:false});
  const saved = {version:1,activeId:pending.id,projects:[pending]};
  assert.equal(P.normalizeWorkspace(JSON.parse(JSON.stringify(saved))).projects[0].started,false);
  assert.equal(P.importBackup({format:'buildbrief-ideas',...saved}).projects[0].started,false);
  pending.started = true; pending.step = 3;
  const restored = P.normalizeWorkspace(saved).projects[0];
  assert.equal(restored.started,true); assert.equal(restored.step,3);
  delete pending.started;
  assert.equal(P.normalizeWorkspace(saved).projects[0].started,true);
  assert.equal(P.createProject().started,true);
  pending.started = 'false';
  assert.throws(() => P.normalizeWorkspace(saved));
});

test('Static deployment protections remain intact', () => {
  const deployment = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(deployment.pages_build_output_dir, './dist');
  assert(!deployment.main);
  const headers = fs.readFileSync('dist/_headers', 'utf8');
  const policyLines = headers.split(/\r?\n/).filter(line => line.trim().startsWith('Content-Security-Policy:'));
  assert.equal(policyLines.length, 1);
  const directives = policyLines[0].split(':').slice(1).join(':').trim().split(/;\s*/).map(rule => { const [name, ...sources] = rule.split(/\s+/); return [name, sources.join(' ')]; });
  assert.equal(new Set(directives.map(([name]) => name)).size, directives.length, 'Duplicate directives can silently ignore a later restriction');
  assert.deepEqual(Object.fromEntries(directives), {
    'default-src': "'none'", 'script-src': "'self'", 'script-src-attr': "'none'",
    'style-src': "'self'", 'style-src-attr': "'none'", 'font-src': "'self'", 'img-src': "'self' data:",
    'connect-src': "'none'", 'object-src': "'none'", 'base-uri': "'none'", 'form-action': "'none'",
    'frame-src': "'none'", 'frame-ancestors': "'none'", 'worker-src': "'none'"
  }, 'Changing allowed resources requires a security review; substring checks miss added unsafe sources');
  for (const rule of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Referrer-Policy: no-referrer', 'Strict-Transport-Security: max-age=31536000', 'Permissions-Policy: camera=(), microphone=(), geolocation=()']) assert(headers.split(/\r?\n/).some(line => line.trim() === rule));
});

test('The public bundle contains only reviewed static files and local scripts', () => {
  assert.deepEqual(fs.readdirSync('dist').sort(), ['_headers','answers.js','app.js','element-examples','guides.js','idea-examples','index.html','projects.js','questions.js','report.js','storage.js','styles.css','views.js']);
  for (const file of fs.readdirSync('dist')) {
    const info = fs.lstatSync(`dist/${file}`);
    assert(['element-examples', 'idea-examples'].includes(file) ? info.isDirectory() : info.isFile(), 'Only reviewed regular files and the image directories may be published');
  }
  assert.deepEqual(fs.readdirSync('dist/element-examples').sort(), Q.uiElements.map(el => el.id + '.webp').sort());
  for (const el of Q.uiElements) {
    const file = `dist/element-examples/${el.id}.webp`;
    assert(fs.lstatSync(file).isFile(), 'Example assets cannot be symlinks or directories');
    const bytes = fs.readFileSync(file);
    assert(bytes.length > 0 && bytes.length <= 250000, 'Example image exceeds the reviewed size limit');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert(el.example?.trim(), 'Every example needs a text description');
  }
  assert(!fs.existsSync('functions'), 'A server request handler needs a separate security review');
  const html = fs.readFileSync('dist/index.html', 'utf8');
  const ideaImages = ['neighborhood-walk.webp', 'pantry-recipes.webp', 'pottery-booking.webp'];
  assert.deepEqual(fs.readdirSync('dist/idea-examples').sort(), ideaImages);
  for (const file of ideaImages) {
    assert(fs.lstatSync(`dist/idea-examples/${file}`).isFile());
    const bytes = fs.readFileSync(`dist/idea-examples/${file}`);
    assert(bytes.length > 0 && bytes.length <= 250000);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert(html.includes(`src="idea-examples/${file}"`));
  }
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.deepEqual(scripts.map(([, attributes]) => /src="([^?]+)\?/.exec(attributes)?.[1]), ['questions.js','answers.js','report.js','projects.js','guides.js','storage.js','views.js','app.js']);
  for (const [, attributes, body] of scripts) {
    assert.match(attributes, /^ src="(?:answers|app|guides|projects|questions|report|storage|views)\.js\?v=[a-f0-9]{12}" defer$/);
    assert.equal(body.trim(), '', 'No inline script');
  }
  for (const [tag] of html.matchAll(/<a\b[^>]*\btarget="_blank"[^>]*>/g)) assert(tag.includes('rel="noopener noreferrer"'));
  const runtime = fs.readdirSync('dist').filter(file => file.endsWith('.js')).map(file => fs.readFileSync(`dist/${file}`, 'utf8')).join('\n');
  assert(!/\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(|\bimport\s*\(|\bdocument\.write(?:ln)?\s*\(|\bset(?:Timeout|Interval)\s*\(\s*['"`]/.test(runtime), 'New network or string-execution code needs review; this is a limited regression guard, not a security scanner');
});

test('The page references the exact current assets', () => {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  for (const file of ['app.js', 'answers.js', 'questions.js', 'report.js', 'projects.js', 'guides.js', 'storage.js', 'views.js', 'styles.css']) {
    const source = fs.readFileSync(`dist/${file}`, 'utf8').replace(/\r\n/g, '\n');
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 12);
    assert(html.includes(`${file}?v=${hash}`), `Stale asset reference: ${file}`);
  }
});

test('Nine coherent stages use unique questions, feature types, and UI elements', () => {
  assert.equal(Q.steps.length, 9);
  for (const items of [Q.steps, A.allQuestions, Q.featureTypes, Q.uiElements]) assert.equal(new Set(items.map(item => item.id)).size, items.length);
  for (const element of Q.uiElements) {
    assert(Q.uiElementGroups.some(group => group.id === element.group));
    for (const item of [element, ...(element.detail?.options || [])])
      for (const key of ['label', 'meaning', 'fit', 'avoid']) assert(item[key]?.trim(), `${element.id}: ${key}`);
  }
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
  assert(A.matches({ id: 'features', category: 'booking' }, answers));
  assert(!A.matches({ id: 'features', category: 'payments' }, answers));
  assert(!A.matches({ id: 'features', category: 'booking' }, { features: A.UNKNOWN }));
  assert(A.matches({ all: [{ id: 'need', value: '일부' }, { id: 'login', includes: '카카오' }, { id: 'login', in: ['네이버', 'Google'] }, { not: { id: 'features', category: 'payments' } }] }, answers));
  assert(A.matches({ any: [{ id: 'need', value: '전체' }, { id: 'need', value: '일부' }] }, answers));
});

test('Every selected feature category activates its own real followups', () => {
  const expected = { booking: ['booking_confirmation','booking_history','booking_cancellation','booking_capacity'], payments: ['payment_offer','payment_timing','payment_refund','payment_failure'], ai: ['ai_help','ai_result_use','ai_retry'], location: ['location_use','device_needs'], device: ['device_needs'], files: ['file_kind','file_limit','device_needs'], collaboration: ['collaboration_join','collaboration_edit'], workflow: ['workflow_approval','workflow_tracking'], notifications: ['notification_event','notification_channel'] };
  const followups = [...new Set(Object.values(expected).flat())];
  for (const [category, visible] of Object.entries(expected)) {
    const active = activeIds({ features: [feature('feature-1', category)] });
    for (const id of followups) assert.equal(active.includes(id), visible.includes(id), `${category}: ${id}`);
  }
  assert(!activeIds({ features: [feature('read', 'browse')] }).some(id => followups.includes(id)));
  assert(!activeIds({ features: [feature('map', 'location')], location_use: ['정해진 장소를 지도에서 보기'] }).includes('permission_response'));
  assert(activeIds({ features: [feature('map', 'location')], location_use: ['내 현재 위치 주변 찾기'] }).includes('permission_response'));
  assert(!activeIds({ features: [], device_needs: ['카메라로 촬영'], location_use: ['내 위치를 다른 사람에게 공유'] }).includes('permission_response'), 'Inactive device choices must not activate a stale followup');
  assert(activeIds({ features: [feature('map', 'location')], location_use: ['다른 용도'] }).includes('location_other'));
  assert(activeIds({ features: [feature('device', 'device')], device_needs: ['다른 기능'] }).includes('device_other'));
  assert(!activeIds({ features: [], device_needs: ['다른 기능'], location_use: ['다른 용도'] }).some(id => ['location_other', 'device_other'].includes(id)));
});

test('Inactive answers remain in backup but leave the current document', () => {
  const q = A.allQuestions.find(q => q.type === 'textarea' && q.when?.category);
  assert(q);
  const original = { features: [feature('feature-1', q.when.category)], [q.id]: '선택한 기능만의 고유 규칙 내용' };
  assert(R.report(original).includes('선택한 기능만의 고유 규칙 내용'));
  const hidden = A.normalizeAnswers({ ...original, features: [] });
  assert.equal(hidden[q.id], original[q.id]);
  assert(!R.report(hidden).includes(original[q.id]));
});

test('Unknown stays unknown and is not a generated requirement', () => {
  assert.equal(A.UNKNOWN, '아직 미정');
  const q = typeQuestion('single');
  assert.equal(A.choiceOptions(q).filter(item => item === A.UNKNOWN).length, 1);
  assert.equal(A.normalizeAnswers({ [q.id]: A.UNKNOWN })[q.id], A.UNKNOWN);
  assert(R.report({ project_name: A.UNKNOWN }).includes('확인해 볼 질문'));
  assert(!R.report({}).includes('React'));
});

test('Guides explain known choices without inventing advice for unknown items', () => {
  assert(G.get('features', 'booking')?.meaning);
  assert(G.get('screens', 'fab')?.meaning);
  assert(G.get('login_methods', '이메일 인증 링크·번호')?.meaning);
  assert.equal(G.get('devices', A.UNKNOWN), null);
  assert.equal(G.get('features', '없는유형'), null);
});

test('Exclusive absence choices cannot coexist with positive choices', () => {
  for (const [id, values] of [['current_methods', ['특별한 방법 없음', '전화']], ['signup_fields', ['추가 정보 없음', '이메일']], ['device_needs', ['기기 기능이 필요하지 않음', '카메라로 촬영']]]) {
    assert.throws(() => A.normalizeAnswers({ [id]: values }));
    assert.deepEqual(A.normalizeAnswers({ [id]: [values[0]] })[id], [values[0]]);
  }
});

test('Own credentials and several social login methods coexist', () => {
  const q = A.allQuestions.find(q => q.type === 'multi' && q.options?.includes('카카오') && q.options.includes('Google'));
  assert(q);
  const methods = [q.options.find(item => /비밀번호/.test(item)), '카카오', '네이버', 'Google'];
  assert(methods[0]);
  assert.deepEqual(A.normalizeAnswers({ [q.id]: methods })[q.id], methods);
  assert.throws(() => A.normalizeAnswers({ [q.id]: [...methods, A.UNKNOWN] }));
  const answers = { features: [feature()], login_need: '일부 기능에서만 로그인', login_features: ['feature-1'], login_methods: methods, password_recovery: '이메일로 다시 설정' };
  assert(activeIds(answers).includes('password_recovery'));
  assert(R.report(answers).includes('이메일로 다시 설정'));
  assert(R.report(answers).includes('예약하기 feature-1'));
  assert(!activeIds({ ...answers, login_methods: ['카카오'] }).includes('password_recovery'));
  const noLogin = A.normalizeAnswers({ ...answers, login_need: '로그인 없이 사용' });
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
  const a = A.normalizeAnswers({ [q.id]: [row] });
  assert.deepEqual(a[q.id][0], row);
  assert(R.report(a).includes(q.fields[0].label));
});

test('Multiple features from the same category retain stable identities', () => {
  const a = A.normalizeAnswers({ features: [feature(), feature('feature-2')] });
  assert.equal(a.features.length, 2);
  assert.notEqual(a.features[0].id, a.features[1].id);
  assert(R.report(a).includes('[F01]'));
  assert(R.report(a).includes('[F02]'));
});

test('Screens combine navigation, actions, tables, and side panels per role', () => {
  const elements = ['appbar', 'sidebar', 'fab', 'table', 'rightpanel'];
  assert(elements.every(id => Q.uiElements.some(item => item.id === id)));
  const answers = A.normalizeAnswers({ features: [feature()], screens: [screen('screen-1', elements), { ...screen('screen-2', [elements[0]]), roles: '손님' }] });
  assert.deepEqual(answers.screens[0].elements, elements);
  assert.equal(answers.screens[1].elements.length, 1);
  const output = R.report(answers);
  for (const id of elements) assert(output.includes(answers.screens[0].elementNotes[id]));
  assert(output.includes('운영 직원')); assert(output.includes('손님')); assert(output.includes('예약하기 feature-1'));
});

test('Screen detail choices and custom elements survive backups without leaking between screens or hidden elements', () => {
  const first = { ...screen('screen-1', ['form', 'table', 'button']), elementOptions: { form: ['text', 'checkbox', 'datetime'], table: ['pages'] }, customElements: [{ id: 'custom-1', name: '좌석 배치도', purpose: '빈 좌석을 직접 고른다' }] };
  const answers = A.normalizeAnswers({ screens: [first, { ...screen('screen-2', ['table']), name: '찾아보기', elementOptions: { table: ['more'] } }] });
  const project = P.createProject({ answers, drafts: answers, notes: { screens: '좌석을 쉽게 고르기 위해' } });
  for (const backup of [{ format: 'buildbrief-idea', version: 1, ...project }, { format: 'buildbrief-ideas', version: 1, activeId: project.id, projects: [project] }]) {
    const restored = P.importBackup(clone(backup)).projects[0];
    assert.deepEqual(restored.answers, answers);
    assert.deepEqual(restored.drafts, answers);
    assert.deepEqual(restored.notes, project.notes);
  }
  for (const prompt of [false, true]) {
    const output = R.report(answers, prompt).split('##### 찾아보기');
    assert(output[0].includes('글 입력, 여러 개 선택, 날짜·시간 선택'));
    assert(output[0].includes('페이지 번호로 이동'));
    assert(output[0].includes('좌석 배치도') && output[0].includes('빈 좌석을 직접 고른다'));
    assert(!output[0].includes('더 보기 버튼'));
    assert(output[1].includes('더 보기 버튼') && !output[1].includes('좌석 배치도'));
  }
  answers.screens[0].elements = ['button'];
  const hidden = R.report(answers);
  assert(!hidden.includes('글 입력') && !hidden.includes('페이지 번호로 이동'));
  const form = V.question(question('screens'), answers);
  assert(!form.includes('data-element="form"'));
  answers.screens[0].elements.push('form');
  assert(R.report(answers).includes('글 입력, 여러 개 선택, 날짜·시간 선택'));
  assert(V.question(question('screens'), answers).includes('data-element="form"'));
  const legacy = A.normalizeAnswers({ screens: [screen('legacy-screen', ['fab', 'table'])] }).screens[0];
  assert.deepEqual(legacy.elementOptions, {});
  assert.deepEqual(legacy.customElements, []);
  assert.equal(legacy.elementNotes.table, 'table의 화면 용도');
  assert.equal(A.isAnswered({ id: 'blank', customElements: [{ id: 'empty', name: '', purpose: '' }] }), false);
});

test('Nested screen imports reject invalid choices and custom records without mutating the backup', () => {
  const custom = { id: 'custom-1', name: '구성 요소', purpose: '용도' };
  for (const changes of [
    { elementOptions: { form: ['unknown'] } }, { elementOptions: { form: ['text', 'text'] } },
    { elementOptions: { table: ['pages', 'more'] } }, { elementOptions: { table: 'pages' } },
    { elementOptions: { button: [] } }, { elementOptions: null },
    { elementOptions: JSON.parse('{"__proto__":[]}') },
    { customElements: {} }, { customElements: [null] }, { customElements: [custom, custom] },
    { customElements: [{ ...custom, id: '\"><script>' }] },
    { customElements: [{ ...custom, purpose: {} }] },
    { customElements: [{ ...custom, name: 'x'.repeat(A.MAX_TEXT + 1) }] },
    { customElements: Array.from({ length: A.MAX_ROWS + 1 }, (_, i) => ({ ...custom, id: 'custom-' + i })) }
  ]) {
    const input = { screens: [{ ...screen('screen-1', []), ...changes }] }, before = clone(input);
    assert.throws(() => A.normalizeAnswers(input));
    assert.deepEqual(input, before);
  }
  assert.equal({}.polluted, undefined);
});

test('Flow preserves sequence, linked names, and manually described actions', () => {
  const q = typeQuestion('flow');
  const a = A.normalizeAnswers({ features: [feature()], [q.id]: [{ id: 'flow-1', featureId: '', note: '처음 방문해 안내 읽기' }, { id: 'flow-2', featureId: 'feature-1', note: '시간을 선택한다' }] });
  const output = R.report(a);
  assert(output.indexOf('처음 방문해 안내 읽기') < output.indexOf('시간을 선택한다'));
  assert(output.includes('2번째 행동'));
  assert(output.includes('예약하기 feature-1'));
});

test('Removed feature links are preserved and surfaced for review', () => {
  const a = A.normalizeAnswers({ screens: [screen('screen-1', [])] });
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

test('Feature priorities stay with their original cards instead of a second review question', () => {
  const a = { features: [feature(), feature('later', 'search', '나중에'), feature('unsure', 'custom', A.UNKNOWN)] };
  const output = R.report(a);
  assert(output.includes('첫 버전에 필요'));
  assert(output.includes('나중에'));
  assert.equal((output.match(/\*\*첫 버전 우선순위\*\*/g) || []).length, 2);
  assert(!output.includes('시기 미정인 기능'));
  assert(!output.includes('기능별 첫 버전 우선순위'));
  assert(!output.includes('결과·우선순위 중 미정'));
  assert(output.includes('예약하기 later'));
  assert(output.includes('예약하기 unsure'));
});

test('Closing memo is optional while retired review answers survive reload, backups and safe reports', () => {
  const last = Q.steps.at(-1);
  assert.equal(last.title, '마무리 메모');
  assert.deepEqual(last.groups.flatMap(g => g.questions.map(q => q.id)), ['open_questions']);
  const q = question('open_questions');
  assert.equal(q.optional, true);
  assert(!q.allowRecommend);
  assert.equal((V.question(q).match(/<textarea/g) || []).length, 1);
  assert(!V.question(q).includes('답변·선택 이유 남기기'));
  assert(V.question(q, {}, { open_questions: '기존 이유 보존' }).includes('기존 이유 보존'));
  assert.deepEqual(A.progress({open_questions:'선택 메모'}), A.progress({}));
  assert(!R.report({}).includes(q.label), 'Blank optional memo must not become an unanswered question');
  assert(R.report({open_questions:'나중에 떠오른 아이디어'}).includes('나중에 떠오른 아이디어'));
  assert(R.report({},true).includes('초안을 먼저 정리한 뒤, 처음 만들 기능 범위와 아이디어의 쓸모를 간단히 확인할 방법을 제안'));

  const input = {
    answers: {open_questions:'남겨 둔 궁금증',scope:'',excluded_work:'예전에 정한 제외 범위 <script>alert(1)</script>',success_check:'예전 확인 방법'},
    drafts: {success_check:'추천 전에 적은 초안'},
    notes: {scope:'범위를 고른 이유',excluded_work:'제외한 이유',success_check:'확인하려던 이유',open_questions:'추가 메모 이유'},
    recommendations: ['scope','success_check'], step:8
  };
  const project = P.createProject(input);
  const workspace = P.normalizeWorkspace(JSON.parse(JSON.stringify({version:1,activeId:project.id,projects:[project]})));
  for (const backup of [{format:'buildbrief-idea',version:1,...workspace.projects[0]}, {format:'buildbrief-ideas',...workspace}]) {
    const restored = P.importBackup(backup).projects[0];
    for (const key of ['answers','drafts','notes','recommendations','step']) assert.deepEqual(restored[key], input[key]);
    assert.deepEqual(A.progress(restored.answers), A.progress({}));
    assert(!A.activeQuestions(restored.answers).some(q=>['scope','excluded_work','success_check'].includes(q.id)));
    for (const prompt of [false,true]) {
      const report = R.report(restored.answers,prompt,restored.notes,restored.recommendations);
      assert(report.includes('## 이전에 작성한 내용'));
      assert(report.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
      assert(report.includes('범위를 고른 이유'));
      assert(report.includes('예전 확인 방법'));
      const pending = report.split('## 확인해 볼 질문')[1];
      assert(!pending.includes(q.label));
      assert(!pending.includes('기능별 첫 버전 우선순위'));
      assert(!report.includes('## AI에게 비교·추천을 요청할 항목'));
    }
    assert(!V.report(restored.answers, restored.notes, restored.recommendations).includes('<script>'));
  }
  for (const invalid of [{scope:'임의의 값'}, {success_check:{}}, {excluded_work:'x'.repeat(A.MAX_TEXT+1)}]) assert.throws(()=>A.normalizeAnswers(invalid));
});

test('One reference row per URL keeps notes and normalizes HTTP links', () => {
  const q = typeQuestion('references');
  const a = A.normalizeAnswers({ [q.id]: [{ id: 'ref-1', url: 'https://example.com/a?x=1', note: '검색 화면 참고' }, { id: 'ref-2', url: 'http://example.org', note: '' }] });
  const output = R.report(a);
  assert(output.includes('<https://example.com/a?x=1>'));
  assert(output.includes('<http://example.org/>'));
  assert(output.includes('검색 화면 참고'));
  assert(output.includes('열람·분석한 것은 아닙니다'));
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', 'https://', '//example.com', 'https://example.com https://another.example']) assert.equal(A.normalizeHttpUrl(url), '');
});

test('HTTP reference normalization rejects credentials and ambiguous input without claiming SSRF protection', () => {
  for (const value of [null, {}, 42, 'https:///example.com', 'https://user:secret@example.com', 'https://trusted.example@other.example', 'https://user%40name@example.com', 'https://example.com\\@other.example', 'https://example.com\u0000', '\nhttps://example.com', 'https://exam\tple.com', 'https://example.com/\u007f', 'https://example.com/' + 'a'.repeat(2000)]) assert.equal(A.normalizeHttpUrl(value), '', String(value));
  for (const [value, expected] of [[' HTTPS://EXAMPLE.COM/a?x=1&y=2#part ', 'https://example.com/a?x=1&y=2#part'], ['https://example.com/자료', 'https://example.com/%EC%9E%90%EB%A3%8C'], ['http://localhost:4173', 'http://localhost:4173/'], ['http://127.0.0.1', 'http://127.0.0.1/'], ['http://[::1]', 'http://[::1]/'], ['http://169.254.169.254', 'http://169.254.169.254/']]) assert.equal(A.normalizeHttpUrl(value), expected);
});

test('Invalid reference URLs are omitted from both document exports but original drafts survive', () => {
  for (const url of ['https://user:secret@example.com', 'https://example.com\\@other.example', 'javascript:alert(1)', 'https://']) {
    const answers = A.normalizeAnswers({ references: [{id:'ref-1',url,note:'디자인 참고 메모'}], alternatives:[{id:'alt-1',url,name:'비교 서비스'}] });
    const project = P.createProject({answers});
    const restored = P.importBackup({format:'buildbrief-idea',version:1,...project}).projects[0];
    assert.equal(restored.answers.references[0].url, url);
    assert.equal(restored.answers.alternatives[0].url, url);
    for (const prompt of [false,true]) {
      const output = R.report(restored.answers,prompt);
      assert(output.includes('URL 확인 필요'));
      if (url !== 'https://') assert(!output.includes(url));
      assert(!output.includes('user:secret'));
      assert(output.includes('디자인 참고 메모'));
      assert(output.includes('비교 서비스'));
    }
  }
});

test('Unfinished and unsafe URL text survives autosave without becoming a link', () => {
  const q = typeQuestion('references');
  for (const url of ['https://', 'javascript:alert(1)', '주소를 나중에 적기']) {
    const a = A.normalizeAnswers({ [q.id]: [{ id: 'ref-1', url, note: '' }] });
    assert.equal(a[q.id][0].url, url);
    const output = R.report(a);
    assert(output.includes('URL 확인 필요'));
    assert(!output.includes(`<${url}>`));
  }
});

test('Question progress sums active stage counts and handles blank cards, priorities, unknowns, and hidden answers', () => {
  const empty = A.progress({});
  assert.equal(empty.answered, 0);
  assert.equal(empty.total, A.activeQuestions({}).filter(q => !q.optional).length);
  assert.equal(empty.percent, 0);
  assert.equal(empty.steps.length, Q.steps.length);
  const featureIndex = Q.steps.findIndex(step => step.id === 'features');
  const reviewIndex = Q.steps.findIndex(step => step.id === 'review');
  const blank = { features: [{ id: 'empty', category: 'custom', name: '', actor: '', outcome: '', notes: '', priority: A.UNKNOWN }], references: [{ id: 'ref-1', url: ' ', note: '' }], audience: [{ id: 'person-1', person: '', goal: '', context: '' }] };
  assert.equal(A.progress(blank).answered, 0, 'An added card and its automatic unknown priority are not an answer');
  assert.equal(A.progress({ features: A.UNKNOWN }).steps[featureIndex].answered, 1, 'An explicit unknown response is recorded');
  assert.equal(A.progress({ login_need: A.UNKNOWN }).answered, 1);
  assert.equal(A.progress({ features: [feature('feature-1', 'custom', A.UNKNOWN)] }).steps[reviewIndex].answered, 0);
  assert.equal(A.progress({ features: [feature('feature-1', 'custom', '나중에')] }).steps[reviewIndex].answered, 0);
  assert.equal(A.progress({ features: [feature(), feature('feature-2', 'custom', '')] }).steps[reviewIndex].total, 0, 'Optional closing memo is outside progress');
  const answers = { project_name: '예시', summary: A.UNKNOWN, features: [feature()], booking_rules: '정원 안에서 신청', references: [] };
  const counted = A.progress(answers);
  assert.equal(counted.answered, 4, 'Name, summary, features and booking rules are recorded once');
  assert.equal(counted.steps[0].answered, 2);
  assert.equal(counted.steps[featureIndex].answered, 2);
  assert.equal(counted.steps[reviewIndex].answered, 0);
  assert.equal(counted.answered, counted.steps.reduce((sum, step) => sum + step.answered, 0));
  assert.equal(counted.total, counted.steps.reduce((sum, step) => sum + step.total, 0));
  assert.equal(counted.percent, Math.round(counted.answered / counted.total * 100));
  const hidden = A.progress({ ...answers, features: [] });
  assert.equal(hidden.answered, 2);
  assert.equal(hidden.total, empty.total, 'Hidden booking rules leave the denominator as well as the numerator');
  const notesAndRequests = P.createProject({ notes: { summary: '추천받고 싶은 이유' }, recommendations: ['features', 'scope'] });
  assert.deepEqual(A.progress(notesAndRequests.answers), empty);
});

test('Malformed known answer types fail without changing the source', () => {
  const q = typeQuestion('single');
  const invalid = [{ project_name: 42 }, { features: {} }, { features: [null] }, { screens: [{ id: 'screen-1', featureIds: 'wrong' }] }, { [q.id]: '없는 선택지' }, { references: [{ id: 'ref-1', url: {} }] }];
  for (const input of invalid) {
    const before = clone(input);
    assert.throws(() => A.normalizeAnswers(input));
    assert.deepEqual(input, before);
  }
});

test('Question and field whitelists block prototype pollution and obsolete schemas', () => {
  for (const input of [JSON.parse('{"__proto__":{"polluted":true}}'), { backend_framework: 'FastAPI' }, { unknown_question: '답' }]) assert.throws(() => A.normalizeAnswers(input));
  const a = A.normalizeAnswers({ features: [{ ...feature(), unrecognized: 'not copied' }] });
  assert(!Object.hasOwn(a.features[0], 'unrecognized'));
  assert.equal({}.polluted, undefined);
});

test('Limits and duplicate identities reject an import instead of truncating it', () => {
  assert.throws(() => A.normalizeAnswers({ project_name: 'x'.repeat(A.MAX_TEXT + 1) }));
  assert.equal(A.normalizeAnswers({ project_name: 'x'.repeat(200) }).project_name.length, 200);
  assert.throws(() => A.normalizeAnswers({ project_name: 'x'.repeat(201) }));
  assert.equal(A.normalizeAnswers({ summary: 'x'.repeat(6000) }).summary.length, 6000);
  assert.throws(() => A.normalizeAnswers({ summary: 'x'.repeat(6001) }));
  assert.throws(() => A.normalizeAnswers({ references: [{ id: 'ref-1', url: 'x'.repeat(2001) }] }));
  assert.throws(() => A.normalizeAnswers({ features: Array.from({ length: A.MAX_ROWS + 1 }, (_, i) => feature(`feature-${i}`)) }));
  assert.throws(() => A.normalizeAnswers({ features: [feature(), feature()] }));
  assert.throws(() => A.normalizeAnswers({ features: [{ ...feature(), id: '<script>' }] }));
  assert.throws(() => A.normalizeAnswers({ screens: [{ ...screen('screen-1', []), elements: ['unknown-component'] }] }));
});

test('Normalization is idempotent, detached, and preserves drafts and notes', () => {
  const input = { answers: { features: [feature()] }, drafts: { project_name: '작성 중 이름' }, notes: { features: '내가 남긴 설명' } };
  const normalized = A.normalizeProject(input);
  assert.deepEqual(A.normalizeProject(normalized), normalized);
  normalized.answers.features[0].name = '변경';
  assert.equal(input.answers.features[0].name, '예약하기 feature-1');
  assert.throws(() => A.normalizeProject({ answers: {}, drafts: [], notes: {} }));
  assert.throws(() => A.normalizeNotes({ features: {} }));
});

test('Every exported question owns its answer and reason, including repeated cards and notes-only questions', () => {
  const answers = { problem: '문제 답변', current_methods: ['메신저'], features: [feature()], screens: [screen('screen-1', [])] };
  const notes = { problem: '문제의 이유\n### 가짜 질문\n<script>실행 금지</script>', current_methods: '메신저를 쓰는 이유', features: '기능 목록 전체의 이유', screens: '화면 목록 전체의 이유', summary: '답변 전에 남긴 이유' };
  for (const prompt of [false, true]) {
    const output = R.report(answers, prompt, notes);
    const blocks = output.split(/^### /m).slice(1).map(block => block.split(/(?=^#{1,2} )/m)[0]);
    const block = id => blocks.find(value => value.startsWith(question(id).label + '\n'));
    assert(block('problem').includes('#### 답변\n\n> 문제 답변'));
    assert(block('problem').includes('#### 선택 이유·추가 메모\n\n> 문제의 이유'));
    assert(!block('problem').includes(notes.current_methods));
    assert(block('current_methods').includes('#### 답변\n\n> 메신저'));
    assert(block('current_methods').includes(notes.current_methods));
    assert(!block('current_methods').includes('문제의 이유'));
    for (const id of ['features', 'screens']) {
      assert(/^##### /m.test(block(id)), 'Repeated cards stay under the answer heading');
      assert(block(id).includes('#### 선택 이유·추가 메모\n\n> ' + notes[id]), 'A whole-question reason must not belong to the last card');
    }
    assert(block('summary').includes('#### 답변\n\n> 미작성'));
    assert(block('summary').includes(notes.summary));
    assert(!/^### 가짜 질문/m.test(output));
    assert(output.includes('&lt;script&gt;실행 금지&lt;/script&gt;'));
  }
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
  assert(notesOnly.includes('#### 선택 이유·추가 메모'));
  assert(notesOnly.includes(notes.summary));
  assert(notesOnly.includes(notes.scope), 'Scope notes must appear even before features are added');
  assert(!notesOnly.includes(notes.booking_rules));
  const withBooking = { features: [feature()] };
  const progress = A.progress(withBooking);
  assert(R.report(withBooking, true, notes).includes(notes.booking_rules));
  assert(!R.report({ features: [] }, false, notes).includes(notes.booking_rules));
  assert(R.report(withBooking, false, notes).includes(notes.booking_rules), 'Reactivating a question restores its reason');
  assert.deepEqual(A.progress(withBooking), progress);
  assert.deepEqual(A.progress(imported.projects[0].answers), A.progress({}));
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
  for (const recommendations of [null, {}, 'screens', [42], ['missing-question'], ['project_name'], ['screens', 'screens'], Array(A.allQuestions.length + 1).fill('screens')]) {
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
  assert(hidden.includes('화면 목록 추천:'));
  const requestOnly = P.createProject({ recommendations: ['screens'] });
  assert.deepEqual(requestOnly.answers, {});
  assert.deepEqual(A.progress(requestOnly.answers), A.progress({}));
  assert(R.report(requestOnly.answers, false, requestOnly.notes, requestOnly.recommendations).includes('## AI에게 비교·추천을 요청할 항목'));
  assert.deepEqual({ answers, notes, recommendations }, before);
  assert(R.report(answers, false, notes, recommendations).includes(notes.login_methods), 'A hidden request can reappear with its original choice and reason');
});

test('Screen recommendations retain their scope, answers and identity through backup and export', () => {
  const original = { ...screen('screen-1', ['table']), name: '<검토>\n### 화면', recommendLayout: true, elementOptions: { table: ['pages'] } };
  const answers = A.normalizeAnswers({ screens: [original, { ...screen('screen-2', []), name: '직접 구성' }] });
  const before = clone(answers);
  const project = P.createProject({ answers, drafts: answers, notes: { screens: '두 화면을 구분' }, recommendations: ['screens'] });
  const second = P.createProject({ answers: { screens: [{ id: 'screen-1', name: '다른 프로젝트' }] } });
  for (const backup of [{ format: 'buildbrief-idea', version: 1, ...project }, { format: 'buildbrief-ideas', version: 1, activeId: project.id, projects: [project, second] }]) {
    const imported = P.importBackup(clone(backup));
    assert.deepEqual(imported.projects[0].answers, answers);
    assert.deepEqual(imported.projects[0].drafts, answers);
    assert.deepEqual(imported.projects[0].recommendations, ['screens']);
    if (imported.projects[1]) assert.equal(imported.projects[1].answers.screens[0].recommendLayout, false);
  }
  for (const value of [null, 1, 'true', [], {}]) {
    const invalid = { screens: [{ ...original, recommendLayout: value }] };
    const beforeInvalid = clone(invalid);
    assert.throws(() => A.normalizeAnswers(invalid));
    assert.deepEqual(invalid, beforeInvalid);
  }
  assert.equal(answers.screens[1].recommendLayout, false, 'Old screens do not opt into a request');
  const requestOnly = A.normalizeAnswers({ screens: [{ id: 'request-only', recommendLayout: true }] });
  assert.deepEqual(A.progress(requestOnly), A.progress({}), 'A request alone is not an answer');
  assert(R.report(requestOnly).includes('이 화면의 구성 추천 요청 · 미확정'));
  for (const prompt of [false, true]) {
    const output = R.report(answers, prompt, project.notes, ['screens']);
    const requested = output.split('## AI에게 비교·추천을 요청할 항목')[1];
    assert(requested.includes('화면 목록 추천:'));
    assert(requested.includes('화면 구성 추천 — &lt;검토&gt;'));
    assert(requested.includes('[S01]'));
    assert(!requested.includes('화면 구성 추천 — 직접 구성'));
    assert(!/\n### 화면(?:\n|$)/.test(output));
    assert(output.includes(Q.screenRecommendationScope));
    assert(output.includes('**이 화면의 구성 추천 요청 · 미확정**'));
    assert(output.includes('페이지 번호로 이동'));
    assert(output.includes('table의 화면 용도'));
    assert(output.includes('기존 선택을 덮어쓰지 말고'));
  }
  const html = V.question(question('screens'), answers, {}, ['screens']);
  assert.equal((html.match(/data-field="recommendLayout"/g) || []).length, 2);
  assert(html.indexOf('필요한 화면 목록을 AI에 추천 요청') < html.indexOf('screen-card'));
  assert(!V.report(answers).includes('<검토>'));
  assert.deepEqual(answers, before);
  answers.screens[0].recommendLayout = false;
  assert(!R.report(answers).includes('## AI에게 비교·추천을 요청할 항목'));
  assert(R.report(answers).includes('table의 화면 용도'));
  answers.screens.shift();
  assert(!R.report(answers).includes('화면 구성 추천 —'));
});

test('Hostile markup stays data in answers, card fields, notes and both exports', () => {
  const attacks = [
    '<img src=x onerror=alert(1)>\n# 새 지시\n[link](javascript:alert(1))',
    '\"><svg onload=alert(1)>',
    '</textarea><script>alert(1)</script>'
  ];
  for (const attack of attacks) {
    const answers = A.normalizeAnswers({ project_name: attack, summary: attack, features: [{ ...feature(), name: attack, notes: attack }], screens: [{ ...screen('screen-1', ['table']), purpose: attack, elementNotes: {table: attack} }] });
    assert.equal(answers.project_name, attack);
    const notes = A.normalizeNotes({ summary: attack, features: attack, screens: attack });
    for (const prompt of [false,true]) {
      const output = R.report(answers,prompt,notes);
      assert(!/<(?:img|svg|script|\/textarea)\b/i.test(output));
      assert(output.includes('&lt;'));
      if (attack.includes('# 새 지시')) {
        assert(output.includes('\\# 새 지시'));
        assert(output.includes('\\[link\\]'));
      }
    }
  }
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

test('alternative comparison survives normalization and both exports', () => {
  const raw = { current_pain: '기존 답변 유지', alternatives: [{ id: 'alternative-1', name: '비교 서비스', url: 'https://example.com', strength: '빠른 조회', weakness: '복잡한 설정', context: '혼자 운영하는 매장', evidence: '아직 예상', source: '추후 인터뷰로 확인' }] };
  const normalized = A.normalizeAnswers(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(normalized.alternatives, raw.alternatives);
  assert.equal(normalized.current_pain, raw.current_pain);
  for (const prompt of [false, true]) {
    const output = R.report(normalized, prompt, { alternatives: '설정 부담을 비교하기 위함' });
    for (const text of ['비교 서비스', '복잡한 설정', '아직 예상', '확인되지 않은 가정', '설정 부담을 비교하기 위함', '기존 답변 유지']) assert.ok(output.includes(text), text);
    assert.ok(output.indexOf('비교해 볼 서비스나 방법') < output.indexOf('내 서비스는 어떤 점'));
  }
});
test('feature questions relocate without losing old answers or notes', () => {
 const step = Q.steps.find(s => s.id === 'features');
 assert(!Q.steps.some(s => s.id === 'data'));
 assert.deepEqual(A.activeGroups(step, {}).flatMap(g => g.questions.map(q => q.id)), ['features']);
 const answers = { features: [{ ...feature(), savedInfo: '예약 날짜와 확정 상태' }], booking_rules: '하루 전까지 취소', data_items: [{id:'record-1', name:'예약 기록', purpose:'신청 확인', access:'본인', change:'담당자', deletion:'기간 미정'}], general_rules: '예전 메모' };
 const project = P.createProject({answers, notes:{data_items:'기존 이유'}});
 const restored = P.importBackup({format:'buildbrief-ideas', version:1, activeId:project.id, projects:[project]}).projects[0];
 assert.deepEqual(restored.answers, A.normalizeAnswers(answers));
 assert.equal(restored.notes.data_items, '기존 이유');
 for(const prompt of [false,true]) { const report = R.report(restored.answers,prompt,restored.notes); for(const value of ['예약 날짜와 확정 상태','하루 전까지 취소','예약 기록','예전 메모','기존 이유']) assert.ok(report.includes(value),value); }
 assert(A.activeGroups(step, {}, {general_rules:'메모만 보존'}).some(g=>g.questions.some(q=>q.id==='general_rules')));
 assert(R.report({},false,{general_rules:'메모만 보존'}).includes('메모만 보존'));
 assert(!A.activeGroups(step,{features:[feature('f2','browse')]}).some(g=>g.questions.some(q=>q.id==='booking_rules')));
});
test('situation choices reveal only their own custom answer and keep hidden text in backup', () => {
 const newChoices = A.allQuestions.filter(q => q.options?.includes('직접 입력'));
 assert(newChoices.length >= 15);
 for (const q of newChoices) {
   const custom = question(q.id + '_other'); assert(custom, q.id);
   const base = { features: Q.featureTypes.map((type,i) => feature('choice-'+i,type.id)), location_use:['내 위치를 다른 사람에게 공유'], device_needs:['카메라로 촬영'] };
   assert(!activeIds(base).includes(custom.id),q.id);
   const raw = {...base, [q.id]:'직접 입력', [custom.id]:'상황별로 다른 방식', booking_deadline:'이용 하루 전'};
   assert(activeIds(raw).includes(custom.id),q.id);
   const normalized = A.normalizeAnswers(raw);
   for (const prompt of [false,true]) { const output = R.report(normalized,prompt,{[q.id]:'이 선택의 이유'}); assert(output.includes('상황별로 다른 방식')); assert(output.includes('이 선택의 이유')); }
   const hidden = A.normalizeAnswers({...normalized,[q.id]:'아직 미정'});
   assert.equal(hidden[custom.id],'상황별로 다른 방식');
   assert(!R.report(hidden).includes('상황별로 다른 방식'));
   assert(!activeIds({...raw,features:[]}).includes(custom.id));
 }
 const base = {features:[feature()]};
 assert(!activeIds(base).includes('booking_deadline'));
 assert(activeIds({...base,booking_cancellation:'정해진 시점까지만 가능해요'}).includes('booking_deadline'));
 assert(!activeIds(base).includes('booking_rules'));
 assert(activeIds({...base,booking_rules:'기존 자유 입력'}).includes('booking_rules'));
 assert(!V.question(question('features'), base).includes('나중에 다시 확인할 정보 (선택)'));
});
require('./scripts/check-runtime.cjs');
console.log(`Idea planner checks passed: ${passed} checks covering conditional questions, feature/screen links, login, safe export, import boundaries, and project isolation.`);
