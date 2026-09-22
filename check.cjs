// Run: node check.cjs — no test framework or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const deployment = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
assert.equal(deployment.assets.directory, './dist', 'Only public static assets may be deployed');
assert(!deployment.main, 'This deployment must not invoke a server-side Worker');
const responseHeaders = fs.readFileSync('dist/_headers', 'utf8');
for (const rule of ["script-src 'self'", "connect-src 'none'", "object-src 'none'", "frame-ancestors 'none'", 'X-Content-Type-Options: nosniff']) assert(responseHeaders.includes(rule), `Missing response protection: ${rule}`);
assert(!/script-src[^;\n]*(?:unsafe-inline|unsafe-eval)/.test(responseHeaders));
const { steps, featureFields, testBasisOptions, testFlowFields } = require('./dist/questions.js');
const R = require('./dist/report.js');
const G = require('./dist/guides.js');
const ids = R.allQuestions.map(q => q.id);
assert.equal(new Set(ids).size, ids.length, 'Question IDs must be unique');
for (const step of steps) for (const group of step.groups) {
  for (const id of [group.when, ...group.questions.map(q => q.when)].flatMap(R.conditionIds)) assert(ids.includes(id), `Unknown dependency: ${id}`);
}
const answers = {
  project_name: '테스트 프로젝트', summary: '시설을 예약하는 웹 서비스', core_features: '예약 신청과 취소',
  features: ['파일·이미지 첨부', '공개 페이지·공유', 'AI 기능'], file_storage: '서버 디스크', hosting: 'Vercel',
  backend_mode: '직접 백엔드 개발', backend_language: 'Python', backend_framework: 'Spring Boot',
  file_visibility: '모두 공개', visibility: ['비공개'], ai_usecase: '숨겨질 AI 답변', cache: R.UNKNOWN
};
assert.equal(R.missingRequired(answers).length, 0);
assert(R.issues(answers).some(i => i.id === 'backend_language'));
assert(R.issues(answers).some(i => i.id === 'file_storage'));
assert(R.issues(answers).some(i => i.id === 'file_visibility'));
assert(R.report(answers, true).includes('숨겨질 AI 답변'));
const hidden = { ...answers, features: [] };
assert(!R.report(hidden).includes('숨겨질 AI 답변'), 'Hidden stale answers must not leak into report');
assert(!R.issues(hidden).some(i => i.id === 'file_storage'), 'Hidden stale answers must not trigger conflicts');
assert(R.stats(answers).total > R.stats(hidden).total);
assert.equal(R.stats(answers).delegated, 1);
assert.equal(R.isAnswered('기타: '), false);
assert.equal(R.isAnswered(['기타: ']), false);
assert.equal(R.isAnswered(['기타: Rust']), true);
assert.equal(R.missingRequired({ project_name: '  ' }).length, 3);
const normalized = R.normalizeAnswers(JSON.parse('{"__proto__":{"polluted":true},"project_name":"<script>alert(1)</script>","features":["AI 기능","AI에게 추천받기"],"hosting":"invalid","summary":23}'));
assert.equal({}.polluted, undefined);
assert.equal(normalized.hosting, undefined);
assert.equal(normalized.summary, undefined);
assert.deepEqual(normalized.features, [R.UNKNOWN]);
assert.equal(normalized.project_name, '<script>alert(1)</script>', 'Values stay data; UI must escape them');
assert.throws(() => R.normalizeAnswers([]));
const safeReport = R.report({ ...answers, summary: 'hello\n# injected heading' });
assert(safeReport.includes('> hello\n> # injected heading'), 'Multiline answers remain quoted data');

// Exercise the branches that previously hid necessary questions.
const shown = (id, a) => R.activeQuestions(a).some(q => q.id === id);
const login = { features: ['회원가입·로그인'], login_methods: ['이메일 매직 링크'] };
assert(shown('email_provider', login), 'Auth email does not depend on selecting notifications');
assert(shown('email_provider', { ...login, login_methods: ['이메일·비밀번호'], account_features: ['비밀번호 재설정'] }));
assert(!shown('email_provider', { ...login, features: [] }), 'Hidden login answers cannot activate email');
assert(shown('integration_readiness', { ...login, login_methods: ['이메일·비밀번호'], auth_implementation: '외부 인증 서비스' }));
assert(shown('integration_readiness', { backend_mode: 'BaaS·관리형 백엔드' }));
assert(!shown('integration_readiness', { features: [], auth_implementation: '외부 인증 서비스', file_storage: '관리형 백엔드 스토리지' }));
assert(!shown('signup_missing', { ...login, login_methods: ['Google'], signup_required: ['추가 정보 없음'] }));
assert(shown('signup_missing', { ...login, login_methods: ['Google'], signup_required: ['이메일'] }));
assert(shown('realtime_protocol', { realtime_needs: ['공동 편집'] }));
assert(shown('realtime_protocol', { features: ['글·콘텐츠 작성'], edit_conflict: '실시간 공동 편집' }));
assert(!shown('realtime_protocol', { features: [], edit_conflict: '실시간 공동 편집' }));
assert(shown('async_jobs', {}), 'Choose background work before choosing its technology');
assert(shown('account_linking', { ...login, login_methods: ['카카오', '네이버'] }));
assert(!shown('account_linking', { ...login, login_methods: [R.UNKNOWN] }));
assert(!shown('account_unlinking', { ...login, account_linking: '기존 계정 확인 후 사용자가 연결' }), 'Inactive account-linking answer cannot activate unlinking');
assert(shown('payment_grace', { features: ['결제·구독'], payment_model: '정기 구독', renewal_failure: '유예 기간 후 중단' }));
assert(!shown('payment_grace', { features: ['결제·구독'], payment_model: '단건 결제', renewal_failure: '유예 기간 후 중단' }));
for (const project_type of ['모바일 앱', 'PC 프로그램']) {
  const native = { project_type, frontend_framework: 'React + Vite', mobile_stack: 'Flutter', app_permissions: ['필요 없음'] };
  assert(shown('app_distribution', native));
  assert(!shown('frontend_framework', native));
  assert(!shown('permission_denial', native));
  assert(!R.report(native).includes('React + Vite'));
  assert(shown('frontend_framework', { ...native, app_web_ui: '웹 화면을 함께 사용' }));
  assert(R.report({ ...native, project_type: '웹사이트' }).includes('React + Vite'), 'Changing back restores stored web answers');
}
assert(!shown('frontend_framework', { project_type: 'API·백엔드 서비스', app_web_ui: '웹 화면을 함께 사용' }));
assert(!shown('related_deletion', { data_scope: '저장 없이 사용' }));

// Repeatable feature cards survive JSON backups; incomplete first-release work remains visible.
const feature = Object.fromEntries(featureFields.map(f => [f.id, f.options ? f.options[0] : `내용 ${f.id}`]));
const draft = { ...answers, feature_specs: [feature, {}, { name: '다음 버전 기능', priority: '추후 개발' }] };
const restored = R.normalizeAnswers(JSON.parse(JSON.stringify(draft)));
assert.deepEqual(restored.feature_specs, draft.feature_specs);
assert(R.readiness(restored).before.some(i => i.id === 'feature_specs' && i.reason.includes('기능 2')));
assert(!R.readiness({ feature_specs: [feature, { priority: '추후 개발' }] }).before.some(i => i.id === 'feature_specs'));
assert(R.readiness({ feature_specs: [{ priority: '추후 개발' }] }).before.some(i => i.id === 'feature_specs'));
assert(R.readiness({ feature_specs: [] }).before.some(i => i.id === 'feature_specs'));
assert(R.readiness({ delivery_level: R.UNKNOWN, cache: R.UNKNOWN }).before.some(i => i.id === 'delivery_level'));
assert(R.readiness({ delivery_level: R.UNKNOWN, cache: R.UNKNOWN }).during.some(i => i.id === 'cache'));
assert(!R.readiness({ features: [R.SKIP] }).before.some(i => i.id === 'features'));
for (const id of ['pricing', 'refunds', 'visibility', 'file_visibility', 'personal_data', 'deletion', 'deployment_permission']) assert(R.readiness({ features: ['결제·구독', '공개 페이지·공유', '파일·이미지 첨부'] }).before.some(i => i.id === id), `${id} is a decision before implementation`);
assert(R.report({}).includes('개발 전 확인'), 'Incomplete drafts still produce a report');
const featureReport = R.report(restored, true);
assert(featureReport.includes(feature.acceptance));
assert(featureReport.includes('다음 버전 기능'));
assert(!featureReport.includes('[object Object]'));
for (const item of R.readiness(restored).before) assert(featureReport.includes(`${item.label} — ${item.reason}`));
assert.deepEqual(R.normalizeAnswers({ feature_specs: [null, [], 'bad', { name: '정상', unknown: 'drop', priority: 'invalid', failure: 'x'.repeat(6001) }] }).feature_specs, [{ name: '정상' }]);
assert.throws(() => R.normalizeAnswers({ feature_specs: Array(R.MAX_FEATURES + 1).fill({}) }));
assert.deepEqual(R.normalizeAnswers({ app_permissions: ['필요 없음', '카메라'] }).app_permissions, ['필요 없음']);
assert.deepEqual(R.normalizeAnswers({ signup_required: ['이메일', '추가 정보 없음'] }).signup_required, ['추가 정보 없음']);

// Skip is a question-specific decision; legacy backups remain recoverable but not silently accepted.
const byId = new Map(R.allQuestions.map(q => [q.id, q]));
for (const id of ['project_type', 'frontend_language', 'architecture', 'docker', 'login_methods', 'payment_model', 'deployment_permission']) assert(!R.choiceOptions(byId.get(id)).includes(R.SKIP), id);
for (const id of ['features', 'navigation', 'pagination', 'file_processing', 'search_quality', 'sharing', 'ai_requirements']) assert(R.choiceOptions(byId.get(id)).includes(R.SKIP), id);
const oldSkipped = R.normalizeAnswers({ architecture: R.SKIP, features: [R.SKIP], summary: R.SKIP });
assert.equal(oldSkipped.architecture, R.SKIP, 'Keep old answers for review');
assert.equal(R.stats(oldSkipped).recheck, 1);
assert.equal(R.stats(oldSkipped).answered, 2, 'Valid skips and free text are still answers');
assert(R.readiness(oldSkipped).before.some(i => i.id === 'architecture' && i.reason.includes('다시 선택')));
assert(!R.readiness(oldSkipped).before.some(i => i.id === 'features'));
assert(R.report(oldSkipped).includes('재선택 필요, 확정하지 않음'));
assert.equal(R.stats({ ...oldSkipped, architecture: '모놀리식' }).recheck, 0);
assert(!R.needsReselection(byId.get('extra_notes'), R.SKIP), 'Free text is not a removed choice');

// Licensing is independent of payment; changing branches retains drafts but excludes stale decisions.
const licensing = { code_release: '일부만 오픈소스로 공개', code_license: 'AGPL 3.0', license_scope: '공개 모듈만 3.0 버전 적용', service_delivery: ['고객 환경에 프로그램 설치'], customer_license: '영구 이용권', license_terms: '구입 버전 이용, 업데이트 1년', license_unit: '기기 수', license_limits: '2대, 초과 등록 차단', offline_license: '오프라인 인증 파일·키', license_inventory: '일부 확인함', license_review: '배포 전 사용 목록 확인' };
for (const id of ['code_release', 'customer_license', 'service_delivery', 'dependency_policy', 'license_inventory']) assert(shown(id, { features: [] }), `${id} must not depend on payment`);
for (const id of ['code_license', 'license_scope', 'license_terms', 'license_limits', 'offline_license', 'license_review']) assert(shown(id, licensing), id);
const licenseReport = R.report(licensing, true);
for (const id of ['code_license', 'license_scope', 'license_terms', 'license_limits', 'offline_license', 'license_review']) assert(licenseReport.includes(licensing[id]), id);
const migratedLicensing = R.normalizeAnswers(JSON.parse(JSON.stringify(licensing)));
assert.equal(migratedLicensing.license_terms.legacy, licensing.license_terms);
assert.equal(migratedLicensing.license_limits.legacy, licensing.license_limits);
assert.deepEqual(R.normalizeAnswers(JSON.parse(JSON.stringify(migratedLicensing))), migratedLicensing);
const privateFree = { ...licensing, code_release: '자체 코드 비공개', service_delivery: ['운영하는 웹·앱 서비스 이용'], customer_license: '무료 이용', license_unit: '별도 수량 제한 없음', license_inventory: '사용 목록과 조건을 정리함' };
for (const id of ['code_license', 'license_scope', 'license_limits', 'offline_license', 'license_review']) assert(!shown(id, privateFree), id);
for (const value of ['AGPL 3.0', licensing.license_scope, licensing.license_limits, licensing.offline_license, licensing.license_review]) assert(!R.report(privateFree).includes(value), `Hide stale license choice: ${value}`);
assert(shown('license_scope', { code_release: '코드 열람만 허용·재사용 제한' }));
assert(!shown('code_license', { code_release: '코드 열람만 허용·재사용 제한' }));
assert(!shown('code_license', { code_release: R.UNKNOWN }));
assert(shown('license_terms', privateFree), 'Free hosted services also need duration and support decisions');
assert(shown('license_terms', { service_delivery: ['고객 환경에 프로그램 설치'], customer_license: '무료 이용' }), 'Free installations still need offline and support rules');
assert(R.readiness({ code_release: R.UNKNOWN }).before.some(i => i.id === 'code_release'));
for (const state of ['아직 확인하지 않음', '일부 확인함']) assert(R.readiness({ license_inventory: state }).before.some(i => i.id === 'license_inventory'));
assert(!R.readiness(privateFree).before.some(i => i.id === 'license_inventory'));
assert(R.issues({ code_release: '자체 코드 비공개', dependency_policy: '소스 제공 의무가 있는 라이선스도 검토' }).some(i => i.id === 'dependency_policy'));
assert(!R.issues({ code_release: '자체 코드 비공개', dependency_policy: '조건이 단순한 라이선스 우선' }).some(i => i.id === 'dependency_policy'));
assert(licenseReport.includes('기존 저작권·라이선스 고지를 보존'));
for (const id of ['code_release', 'code_license', 'customer_license', 'license_inventory']) assert(!R.choiceOptions(byId.get(id)).includes(R.SKIP), id);

const guidedQuestions = [...R.allQuestions.filter(q => q.options.length), { id: 'feature_priority', options: featureFields.find(f => f.id === 'priority').options }, { id: 'test_basis', options: testBasisOptions }];
for (const step of steps) for (const group of step.groups) {
  assert(G.learning[group.title], `Learning guidance missing: ${group.title}`);
  for (const field of ['why', 'criteria', 'impact']) assert(G.learning[group.title][field].length > 30);
}
const previous = R.normalizeAnswers({ project_type: '사내 도구', customer_license: '무료 이용', draft_recovery: '민감한 내용이라 기기 저장 금지', sessions: '토큰 + 보안 쿠키', data_portability: ['JSON', 'CSV', 'PDF'], hosting: 'AWS', dependency_policy: '상용 라이선스 구매도 가능', release: '직접 승인 후 배포' });
assert.equal(previous.audience_scope, '내부 구성원');
assert.equal(previous.customer_pricing, '무료');
assert.deepEqual(previous.hosting, ['AWS']);
for (const value of ['JSON', 'CSV', 'PDF']) assert(previous.data_portability[0].includes(value));
assert(!JSON.stringify(previous.auth_state_validation).includes('JWT'), 'An old token choice does not identify its format');
assert.deepEqual(R.normalizeAnswers(JSON.parse(JSON.stringify(previous))), previous);
assert(R.needsReselection(byId.get('project_type'), previous.project_type));
assert(R.needsReselection(byId.get('data_portability'), previous.data_portability));
const customNative = { project_type: '기타: Android 앱', custom_platforms: ['모바일 앱'] };
assert(shown('native_platforms', customNative));
assert(!shown('frontend_framework', customNative));
const notes = R.normalizeNotes({ summary: '상황과 이유', entities: '숨긴이유', unknown: '무시' });
assert.equal(notes.unknown, undefined);
const notedReport = R.report({ summary: '정상', data_scope: '저장 없이 사용' }, false, notes);
assert(notedReport.includes('상황과 이유'));
assert(!notedReport.includes('숨긴이유'));
const replicas = { database: 'PostgreSQL', db_hosting: '관리형 DB', db_redundancy: '복제 DB 1개' };
for (const id of ['db_replication_ack', 'db_failover', 'db_replica_reads', 'db_replication_lag']) {
  assert(shown(id, replicas));
  assert(!shown(id, { ...replicas, database: 'DB 없이 사용' }));
  assert(!shown(id, { ...replicas, db_redundancy: '복제 DB 없이 운영' }));
}
const authentication = { features: ['회원가입·로그인'], login_methods: ['이메일·비밀번호'], auth_state_validation: ['서명된 JWT 검증'], auth_client_credential_store: ['HttpOnly·Secure 쿠키'], password_custodian: '서비스에서 비밀번호 해시 관리' };
for (const id of ['auth_jwt_verification_keys', 'auth_cookie_policy', 'password_hash_algorithm']) {
  assert(shown(id, authentication));
  assert(!shown(id, { ...authentication, features: [] }));
}
for (const id of ['encryption_implementation', 'encryption_decrypt_authority', 'encryption_key_store', 'encryption_key_rotation', 'encryption_key_recovery']) {
  assert(shown(id, { encryption_targets: ['기타: 외부 인증서'] }));
  assert(!shown(id, { encryption_targets: ['필요 없음'] }));
  assert(!shown(id, { encryption_targets: ['DB의 민감 항목'], data_scope: '저장 없이 사용' }));
}
for (const q of guidedQuestions) for (const option of R.choiceOptions(q)) {
  const guide = G.get(q, option);
  assert(guide, `${q.id}/${option} must have help`);
  for (const field of ['meaning', 'pros', 'cons', 'fit']) assert(typeof guide[field] === 'string' && guide[field].trim().length > 5, `${q.id}/${option}/${field}`);
  if (guide.source) assert(/^https:\/\//.test(guide.source));
}
assert.equal(G.get(byId.get('architecture'), R.SKIP), undefined);
assert(G.get(byId.get('features'), R.SKIP).meaning.includes('목록'));

for (const asset of ['styles.css', 'questions.js', 'report.js', 'guides.js', 'app.js']) assert(fs.existsSync(`dist/${asset}`));
const html = fs.readFileSync('dist/index.html', 'utf8');
assert(html.includes('lang="ko"'));
assert(!html.includes('OPENAI_API_KEY'));
assert(html.indexOf('guides.js') < html.indexOf('app.js'));
assert(html.includes('aria-labelledby="help-title"'));
console.log(`PASS: ${steps.length} steps, ${ids.length} questions; option help coverage, skip policy and legacy migration, condition branches, feature backups, reports and assets.`);

// Exercise actual UI handlers with a small DOM stub (no browser or dependencies).
{
// Read-only regression checks. Usage: node buildbrief-v5-regression.cjs [checkout]
// VM checks execute app.js event handlers with a minimal DOM; they are not browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = __dirname;
const Q = require(path.join(root, 'dist/questions.js'));
const R = require(path.join(root, 'dist/report.js'));
const G = require(path.join(root, 'dist/guides.js'));
const source = fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8');
const shown = (id, answers) => R.activeQuestions(answers).some(q => q.id === id);
let passed = 0, failed = 0;
const pending = [];
function test(name, run) {
  try {
    const result = run();
    if (result && typeof result.then === 'function') {
      pending.push(result.then(() => { passed++; }, error => { failed++; console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`); }));
    } else { passed++; }
  }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`); }
}
function ui(answers = {}, savedDraft, options = {}) {
  const nodes = new Map(), events = {}, timers = [], downloads = [];
  let saved = JSON.stringify(savedDraft || { version: 1, step: 8, details: true, answers });
  const doc = {
    activeElement: null,
    querySelector: node,
    querySelectorAll: () => [],
    createElement: tag => node(`created-${tag}`),
    getElementById(id) {
      if (!node('#question-groups').innerHTML.includes(`id="${id}"`)) return null;
      return node(`#${id}`);
    },
    addEventListener(type, handler) { events[type] = handler; }
  };
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      id: selector.startsWith('#') ? selector.slice(1) : '',
      innerHTML: '', textContent: '', value: '', hidden: false,
      style: {}, dataset: {}, handlers: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      querySelector() { return null; },
      setAttribute() {}, removeAttribute() {},
      showModal() { this.open = true; }, close() { this.open = false; }, click() {},
      focus() { doc.activeElement = this; },
      setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
      scrollIntoView() {}, closest() { return null; }
    });
    return nodes.get(selector);
  }
  const ctx = {
    document: doc,
    window: { BriefQuestions: Q, BriefReport: R, BriefGuides: G, addEventListener() {}, confirm: () => options.confirm !== false, scrollTo() {} },
    localStorage: { getItem: () => saved, setItem(key, value) { saved = value; } },
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: { createObjectURL(blob) { downloads.push(blob.text); return 'blob:vm-test'; }, revokeObjectURL() {} },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {}, console
  };
  const instrumented = source.replace(/  renderStep\(currentStep\);\r?\n(?=  if \(!storageWorking\))/, '  globalThis.__audit = { get: () => answers, set: setAnswer, render: renderQuestions };\n');
  assert.notEqual(instrumented, source, 'VM hook must match app startup');
  vm.runInNewContext(instrumented, ctx, { filename: path.join(root, 'dist/app.js') });
  ctx.__audit.render();
  return {
    get: ctx.__audit.get,
    render: ctx.__audit.render,
    basis(index) { node('#question-form').handlers.change({ target: { dataset: { testBasis: String(index) } } }); },
    flow(index, field, value, isComposing = false) {
      const target = node(`#test-flow-${index}-${field}`);
      target.dataset = { testFlow: String(index), testField: field };
      target.value = value; target.selectionStart = target.selectionEnd = value.length; target.focus();
      node('#question-form').handlers.input({ target, isComposing });
    },
    legacy(value) {
      const target = node('#test-legacy');
      target.dataset = { testLegacy: 'true' }; target.value = value; target.focus();
      node('#question-form').handlers.input({ target });
    },
    feature(index, field, value) {
      node('#question-form').handlers.input({ target: { dataset: { featureIndex: String(index), featureField: field }, value } });
    },
    worksheet(id, row, part, value) {
      node('#question-form').handlers.input({ target: { dataset: { worksheet: id, row: String(row), part }, value } });
    },
    textOf: selector => node(selector).textContent,
    set: ctx.__audit.set,
    stored: () => JSON.parse(saved),
    markup: () => node('#question-groups').innerHTML,
    reportMarkup: () => node('#report-view').innerHTML,
    helpMarkup: () => node('#help-content').innerHTML,
    browseHelp(index) { node('#help-option').handlers.change({ target: { value: String(index) } }); },
    compareHelp(index) { node('#help-compare').handlers.change({ target: { value: String(index) } }); },
    exportBackup() {
      events.click({ target: { closest: () => ({ id: 'export-answers', dataset: {} }) } });
      return JSON.parse(downloads.at(-1));
    },
    async importBackup(backup) {
      const text = JSON.stringify(backup);
      await node('#import-file').handlers.change({ target: { files: [{ size: text.length, text: async () => text }], value: 'backup.json' } });
    },
    choose(id, value, checked = true) {
      node('#question-form').handlers.change({ target: { dataset: { question: id }, value, checked } });
    },
    note(id, value) {
      node('#question-form').handlers.input({ target: { dataset: { note: id }, value } });
    },
    click(button) { events.click({ target: { closest: () => ({ dataset: {}, ...button }) } }); },
    active: () => doc.activeElement,
    focusTargets(id) {
      const field = node(`#field-${id}`), hidden = node('#closed-guide-link'), input = node(`#input-${id}`);
      field.querySelector = selector => selector.includes('button') ? hidden : input;
    },
    clickUnknown(id) { events.click({ target: { closest: () => ({ dataset: { unknown: id } }) } }); },
    custom(id, value, isComposing = false) {
      const target = node(`#custom-${id}`);
      target.dataset = { custom: id };
      target.value = value;
      target.selectionStart = target.selectionEnd = value.length;
      target.focus();
      node('#question-form').handlers.input({ target, isComposing });
      // Flush bounded deferred rendering if the UI chooses to debounce changes.
      for (let count = 0; timers.length && count < 100; count++) timers.shift()();
    },
    compositionEnd(id) {
      node('#question-form').handlers.compositionend({ target: node(`#custom-${id}`) });
    }
  };
}

test('free text survives recommendation round-trip', () => {
  const text = '예약 신청 → 운영자 승인\n두 번째 줄도 보존';
  const app = ui({ main_journey: text });
  app.clickUnknown('main_journey');
  assert(R.isUnknown(app.get().main_journey), 'recommendation must remain unresolved');
  app.clickUnknown('main_journey');
  assert.equal(app.get().main_journey, text, 'original text must be restored');
});
test('recommended text survives save and reload before restoration', () => {
  const text = '새 세션에서도 복원할 원문';
  const app = ui({ main_journey: text });
  app.clickUnknown('main_journey');
  const stored = app.stored();
  assert(JSON.stringify(stored).includes(text), 'saved draft must retain original text');
  const reloaded = ui({}, stored);
  reloaded.clickUnknown('main_journey');
  assert.equal(reloaded.get().main_journey, text, 'reload must not lose the preserved text');
});
test('empty recommendation returns to empty without inventing an answer', () => {
  const app = ui();
  app.clickUnknown('main_journey');
  app.clickUnknown('main_journey');
  assert(!R.isAnswered(app.get().main_journey));
});
test('custom login input immediately renders account-linking follow-up', () => {
  const app = ui({ features: ['회원가입·로그인'], login_methods: ['Google', '기타: '] });
  assert(!app.markup().includes('id="field-account_linking"'));
  app.custom('login_methods', 'Apple');
  assert(shown('account_linking', app.get()), 'model must activate account linking');
  assert(app.markup().includes('id="field-account_linking"'), 'rendered form must agree with model');
});
test('erasing custom login immediately hides account-linking follow-up', () => {
  const app = ui({ features: ['회원가입·로그인'], login_methods: ['Google', '기타: Apple'] });
  assert(app.markup().includes('id="field-account_linking"'));
  app.custom('login_methods', '');
  assert(!shown('account_linking', app.get()));
  assert(!app.markup().includes('id="field-account_linking"'), 'stale follow-up must disappear');
});

test('no DB hides DB tools, hosting and migration from report', () => {
  const a = R.normalizeAnswers({ data_scope: '저장 없이 사용', database: 'DB 없이 사용', orm: 'Prisma', db_hosting: '관리형 DB', migration: '마이그레이션 도구로 이력 관리' });
  for (const id of ['orm', 'db_hosting', 'migration']) {
    assert(!shown(id, a), `${id} should not apply without DB`);
    assert(!R.report(a).includes(a[id]), `${id} stale answer must be excluded`);
  }
  assert.equal(a.orm, 'Prisma', 'hidden draft must remain recoverable');
  assert(shown('orm', { ...a, data_scope: '같은 계정의 여러 기기에서 사용', database: 'PostgreSQL' }));
});
test('no persistence hides old DB answers even when an old DB choice is retained', () => {
  const a = { data_scope: '저장 없이 사용', database: 'PostgreSQL', orm: 'Prisma', db_hosting: '관리형 DB' };
  for (const id of ['orm', 'db_hosting']) assert(!shown(id, a), `${id} must honor no persistence`);
  assert(!R.report(a).includes('Prisma'));
});
test('no persistence omits data-recovery questions but retains service recovery time', () => {
  const a = { data_scope: '저장 없이 사용', rpo: '이전 데이터 손실 조건', restore_check: '이전 DB 복구 시험', rto: '서비스는 1시간 안에 복구' };
  for (const id of ['rpo', 'restore_check']) {
    assert(!shown(id, a), `${id} is data-specific`);
    assert(!R.report(a).includes(a[id]));
  }
  assert(shown('rto', a));
  assert(R.report(a).includes(a.rto));
});
test('no own server excludes stale app-split/runtime decisions', () => {
  const a = { backend_mode: '서버 없는 정적 사이트', app_split: '별도 앱·별도 배포', backend_versions: 'JDK 테스트 고유 문자열' };
  for (const id of ['app_split', 'backend_versions']) {
    assert(!shown(id, a), `${id} must not apply without own server`);
    assert(!R.report(a).includes(a[id]), `${id} stale answer must not reach AI`);
  }
});
test('no own server and no external API exclude API-specific decisions', () => {
  const a = { backend_mode: '서버 없는 정적 사이트', external_api_usage: '호출하지 않음', features: [R.SKIP], api_style: 'REST', api_docs: 'OpenAPI·Swagger', api_errors: '이전 API 오류 지침' };
  for (const id of ['api_style', 'api_docs', 'api_errors']) {
    assert(!shown(id, a), `${id} must not apply without API`);
    assert(!R.report(a).includes(a[id]), `${id} stale answer must be excluded`);
  }
});
test('browser-local persistence does not lose storage/deletion decisions', () => {
  const a = { backend_mode: '서버 없는 정적 사이트', data_scope: '이 기기에서만 저장', database: 'DB 없이 사용', deletion: '휴지통 보관 후 삭제', entities: '기기 내 작업 목록' };
  for (const id of ['entities', 'deletion']) assert(shown(id, a), `${id} still applies to browser storage`);
  assert(R.report(a).includes(a.deletion));
});
test('static frontend calling an external API retains its API contract', () => {
  const a = { backend_mode: '서버 없는 정적 사이트', api_style: '외부 제공 API만 사용', features: ['외부 서비스 연동'], external_services: '날씨 조회 API' };
  assert(shown('api_style', a), 'external API still needs an API decision');
  assert(shown('external_services', a));
  assert(R.report(a).includes(a.external_services));
});
test('explicit external API use keeps API questions without the feature checkbox', () => {
  const a = { backend_mode: '서버 없는 정적 사이트', external_api_usage: '외부 API 호출', features: [R.SKIP], api_style: '외부 제공 API만 사용' };
  assert(shown('api_style', a));
  assert(R.report(a).includes(a.api_style));
});
test('custom login retains its setup and missing-information questions', () => {
  const a = { features: ['회원가입·로그인'], login_methods: ['기타: Apple 로그인'], signup_required: ['이메일'], auth_implementation: '인증 라이브러리' };
  assert(shown('signup_missing', a));
  assert(shown('integration_readiness', a));
});
test('custom license unit retains quantity and limit rules', () => {
  const a = { license_unit: '기타: CPU 코어 수', license_limits: '4코어 초과 금지' };
  assert(shown('license_limits', a));
  assert(R.report(a).includes(a.license_limits));
});
test('private source delivery retains contractual modification and redistribution scope', () => {
  const a = { code_release: '자체 코드 비공개', service_delivery: ['소스코드 납품'], license_scope: '고객 내부 수정 허용, 제3자 재판매 제한' };
  assert(shown('license_scope', a), 'private delivery needs scope');
  assert(R.report(a).includes(a.license_scope));
  assert(!shown('code_license', a), 'private delivery must not force an open-source license');
});
test('free hosted use retains duration and support terms', () => {
  const a = { customer_license: '무료 이용', service_delivery: ['운영하는 웹·앱 서비스 이용'], license_terms: '30일 무료 이용, 만료 후 내보내기만 허용' };
  assert(shown('license_terms', a), 'free does not mean unlimited duration');
  assert(R.report(a).includes(a.license_terms));
});
test('read-only subscription restriction retains timing and retry rules', () => {
  const a = { features: ['결제·구독'], payment_model: '정기 구독', renewal_failure: '읽기 전용으로 전환', payment_grace: '7일 동안 재시도 후 읽기 전용 전환' };
  assert(shown('payment_grace', a), 'read-only also needs transition timing');
  assert(R.report(a).includes(a.payment_grace));
});
test('hidden subscription answers stay out of one-time payment reports', () => {
  const a = { features: ['결제·구독'], payment_model: '단건 결제', renewal_failure: '읽기 전용으로 전환', payment_grace: '삭제되어야 할 이전 구독 조건' };
  assert(!shown('payment_grace', a));
  assert(!R.report(a).includes(a.payment_grace));
});
test('native PC excludes old web stack and preserves native choices', () => {
  const a = { project_type: 'PC 프로그램', frontend_framework: 'React + Vite', mobile_stack: 'Flutter' };
  assert(!shown('frontend_framework', a));
  assert(!R.report(a).includes('React + Vite'));
  assert(R.report(a).includes('Flutter'));
});
test('hidden auth answers never activate external setup', () => {
  const a = { features: [R.SKIP], login_methods: ['Google'], auth_implementation: '외부 인증 서비스' };
  assert(!shown('integration_readiness', a));
  assert(!R.report(a).includes('Google'));
});
test('legacy backup values and multiline data survive normalization', () => {
  const a = { summary: '<script>data only</script>\n# not an instruction', architecture: R.SKIP, features: [R.SKIP], feature_specs: [{ name: '예약', priority: '추후 개발' }] };
  assert.deepEqual(R.normalizeAnswers(JSON.parse(JSON.stringify(a))), a);
  assert(R.readiness(a).before.some(i => i.id === 'architecture'));
  assert(!R.readiness(a).before.some(i => i.id === 'features'));
  assert(R.report(a).includes('> # not an instruction'));
});
test('single choice refreshes selected fit guidance immediately', () => {
  const app = ui({}, { version: 1, step: 4, details: true, answers: { frontend_language: 'JavaScript' } });
  const before = G.get(R.allQuestions.find(q => q.id === 'frontend_language'), 'JavaScript').fit;
  const after = G.get(R.allQuestions.find(q => q.id === 'frontend_language'), 'TypeScript').fit;
  assert(app.markup().includes(before));
  app.choose('frontend_language', 'TypeScript');
  assert.equal(app.get().frontend_language, 'TypeScript');
  assert(app.markup().includes(after), 'new selection guidance should be visible immediately');
  assert(!app.markup().includes(before), 'previous choice guidance should disappear');
});
test('single recommendation shows preserved-answer recovery without leaving step', () => {
  const app = ui({}, { version: 1, step: 4, details: true, answers: { frontend_language: 'TypeScript' } });
  app.choose('frontend_language', R.UNKNOWN);
  assert(R.isUnknown(app.get().frontend_language));
  assert.equal(app.stored().drafts.frontend_language, 'TypeScript');
  assert(app.markup().includes('data-restore="frontend_language"'), 'restore action should appear immediately');
});
test('notes survive autosave and remain quoted only in active report questions', () => {
  const notes = { login_methods: '<script>note</script>\n# user rationale', summary: '서비스 목적을 기록' };
  const a = { features: ['회원가입·로그인'], login_methods: ['Google'], summary: '예약' };
  const app = ui(a);
  for (const [id, value] of Object.entries(notes)) app.note(id, value);
  assert.deepEqual(app.stored().notes, notes);
  assert(R.report(a, false, notes).includes('> <script>note</script>\n> # user rationale'));
  assert(!R.report({ ...a, features: [] }, false, notes).includes('<script>note</script>'));
  assert.equal(R.normalizeNotes(JSON.parse(JSON.stringify(notes))).summary, notes.summary);
});
test('feature cards survive recommendation and add-card restoration', () => {
  const rows = [{ name: '예약 신청', actor: '회원', priority: '첫 출시에 필수', failure: '안내 문구' }];
  const app = ui({ feature_specs: rows });
  app.clickUnknown('feature_specs');
  assert(R.isUnknown(app.get().feature_specs));
  app.click({ id: 'add-feature' });
  assert.equal(app.get().feature_specs[0].name, rows[0].name);
  assert.equal(app.get().feature_specs[0].failure, rows[0].failure);
  assert.equal(app.get().feature_specs.length, 2);
});
test('feature card recommendation round-trip preserves every typed field', () => {
  const rows = [{ name: '예약 신청', actor: '회원', input: '날짜', action: '신청', result: '접수', failure: '충돌 안내', priority: '첫 출시에 필수', acceptance: '목록 반영' }, { name: '후속 기능', priority: '추후 개발' }];
  const app = ui({ feature_specs: rows });
  const expected = JSON.stringify(app.get().feature_specs);
  app.clickUnknown('feature_specs');
  app.clickUnknown('feature_specs');
  assert.equal(JSON.stringify(app.get().feature_specs), expected);
});
test('export and import preserve original drafts, notes and feature cards', async () => {
  const rows = [{ name: '예약 신청', actor: '회원', priority: '첫 출시에 필수', failure: '안내' }];
  const app = ui({ main_journey: '신청 → 확인\n다음 줄', feature_specs: rows, features: ['회원가입·로그인'], login_methods: ['기타: Apple'] });
  app.note('main_journey', '사용자 기록\n# 원문');
  app.note('login_methods', '기존 계정 이용');
  app.clickUnknown('main_journey');
  app.clickUnknown('feature_specs');
  const backup = app.exportBackup();
  assert.equal(backup.format, 'buildbrief');
  assert.equal(backup.version, 1);
  const restored = ui({ summary: '교체할 기존 답변' });
  await restored.importBackup(backup);
  const exportedAgain = restored.exportBackup();
  for (const key of ['answers', 'drafts', 'notes']) assert.deepEqual(exportedAgain[key], backup[key], `${key} must round-trip`);
  restored.clickUnknown('main_journey');
  assert.equal(restored.get().main_journey, '신청 → 확인\n다음 줄');
  restored.clickUnknown('feature_specs');
  assert.equal(restored.get().feature_specs[0].name, rows[0].name);
});
test('reset clears answers, recommendation drafts and reasons from storage and export', () => {
  const app = ui({ main_journey: '삭제할 원문', summary: '삭제할 서비스' });
  app.note('summary', '삭제할 이유');
  app.clickUnknown('main_journey');
  app.click({ id: 'confirm-reset' });
  for (const key of ['answers', 'drafts', 'notes']) {
    assert.deepEqual(app.stored()[key], {}, `${key} must be cleared in storage`);
    assert.deepEqual(app.exportBackup()[key], {}, `${key} must be cleared in backup`);
  }
});
test('option explanation opens without changing any answers', () => {
  const app = ui({}, { version: 1, step: 4, details: true, answers: { frontend_language: 'TypeScript' } });
  const before = JSON.stringify(app.get());
  app.click({ dataset: { helpQuestion: 'frontend_language', helpIndex: '0' } });
  assert.equal(JSON.stringify(app.get()), before);
  assert(app.helpMarkup().includes('어떤 방식인가요?'));
  assert(app.helpMarkup().includes('이럴 때 검토하세요'));
});
test('all empty steps and report render with real guides loaded', () => {
  const app = ui();
  for (let step = 0; step < Q.steps.length; step++) {
    app.click({ dataset: { step: String(step) } });
    assert(app.markup().length > 0, `step ${step} must render`);
  }
  app.click({ id: 'report-button' });
  assert(app.reportMarkup().includes('개발 전에 확인할 결정이 있어요'));
  assert(app.reportMarkup().includes('id="panel-prompt"'));
  assert.equal(Object.keys(app.get()).length, 0, 'rendering must not invent answers');
});
test('custom input waits for composition end and restores caret after branch rendering', () => {
  const app = ui({ features: ['회원가입·로그인'], login_methods: ['Google', '기타: '] });
  const before = app.markup();
  app.custom('login_methods', '애플', true);
  assert.equal(app.markup(), before, 'composing input must not replace the active DOM');
  app.compositionEnd('login_methods');
  assert(app.markup().includes('id="field-account_linking"'));
  assert.equal(app.active().id, 'custom-login_methods');
  assert.equal(app.active().selectionStart, 2);
});
test('legacy custom answer also avoids DOM replacement during composition', () => {
  const previous = '[이전 선택] 이전 방식';
  const app = ui({ features: ['회원가입·로그인'], auth_state_validation: [`기타: ${previous}`] });
  const before = app.markup();
  app.custom('auth_state_validation', `${previous} 수정`, true);
  assert.equal(app.markup(), before, 'legacy re-selection must not override composition protection');
  app.compositionEnd('auth_state_validation');
  assert(app.markup().includes(`${previous} 수정`));
});
test('legacy single values become multi selections without content loss', () => {
  for (const id of ['app_updates', 'hosting', 'backup', 'dependency_policy']) {
    const q = R.allQuestions.find(q => q.id === id);
    assert.equal(q.type, 'multi');
    const normalized = R.normalizeAnswers({ [id]: q.options[0] });
    assert.deepEqual(normalized[id], [q.options[0]]);
  }
});
{
const qualityUI = (answers = {}, savedDraft, options) => ui(answers, savedDraft || { version: 1, step: 12, details: true, answers }, options);
const [NONE, FLOWS] = Q.testBasisOptions;
const critical = R.allQuestions.find(q => q.id === 'critical_tests');
const feature = name => Object.fromEntries(Q.featureFields.map(f => [f.id, f.id === 'name' ? name : f.id === 'priority' ? '첫 출시에 필수' : `${name}_${f.id}`]));
const flow = name => Object.fromEntries(Q.testFlowFields.map(f => [f.id, f.id === 'name' ? name : `${name}_${f.id}`]));
const plan = (...flows) => ({ basis: FLOWS, flows });
const review = a => [...R.readiness(a).before, ...R.readiness(a).during].find(i => i.id === 'critical_tests');
const json = value => JSON.stringify(value);
const clickAdd = app => app.click({ id: 'add-test-flow' });

test('legacy multiline text is preserved exactly and migration is idempotent', () => {
  const text = '  기존 주문 확인\n# 작성자 메모\r\n<script>원문</script>  ';
  const once = R.normalizeAnswers({ critical_tests: text });
  assert.equal(once.critical_tests.legacy, text);
  assert.deepEqual(once.critical_tests.flows, []);
  assert.deepEqual(R.normalizeAnswers(once), once);
  assert(R.report(once).includes('> # 작성자 메모'));
  assert(R.report(once, true).includes('원문'));
});
test('unknown old answer stays unknown and empty old text stays empty', () => {
  assert.equal(R.normalizeAnswers({ critical_tests: R.UNKNOWN }).critical_tests, R.UNKNOWN);
  const blank = R.normalizeAnswers({ critical_tests: '' });
  assert.equal(blank.critical_tests.legacy, '');
  assert(!R.isAnswered(blank.critical_tests));
  assert(review(blank));
});
test('legacy text remains editable without read-only conversion', () => {
  const app = qualityUI({ critical_tests: '기존 검증 원문' });
  assert(app.markup().includes('data-test-legacy="true"'));
  assert(!/id="test-legacy"[^>]*readonly/.test(app.markup()));
  app.legacy('수정한 검증 요구\n둘째 줄');
  assert.equal(app.get().critical_tests.legacy, '수정한 검증 요구\n둘째 줄');
  assert.equal(app.stored().answers.critical_tests.legacy, '수정한 검증 요구\n둘째 줄');
  app.basis(0);
  assert.equal(app.get().critical_tests.legacy, '수정한 검증 요구\n둘째 줄');
});
test('empty test plan renders before any feature specification exists', () => {
  const app = qualityUI();
  assert(app.markup().includes('연결할 첫 출시 기능 명세가 없어요'));
  app.basis(1);
  clickAdd(app);
  for (const field of Q.testFlowFields) app.flow(0, field.id, `직접 작성_${field.id}`);
  assert.equal(app.get().critical_tests.flows.length, 1);
  assert(!review(app.get()), 'complete manual flow is allowed without source features');
});
test('add and edit cards save every field and focus the new name input', () => {
  const app = qualityUI({ feature_specs: [feature('원본 기능')] });
  app.basis(1);
  clickAdd(app);
  assert.equal(app.active().id, 'test-flow-0-name');
  const row = flow('주문 및 취소');
  for (const [key, value] of Object.entries(row)) app.flow(0, key, value);
  assert.equal(json(app.get().critical_tests.flows[0]), json(row));
  assert.equal(app.textOf('#test-flow-title-0'), row.name);
  assert.equal(json(app.stored().answers.critical_tests.flows[0]), json(row));
  clickAdd(app);
  assert.equal(app.get().critical_tests.flows.length, 2);
  assert.equal(app.active().id, 'test-flow-1-name');
  assert.equal(json(app.get().critical_tests.flows[0]), json(row));
});
test('empty and partial cards persist and remain unresolved', () => {
  const app = qualityUI();
  app.basis(1);
  assert(review(app.get()).reason.includes('작성하지 않았'));
  clickAdd(app);
  assert.equal(json(app.stored().answers.critical_tests.flows), '[{}]');
  assert(review(app.get()).reason.includes('일부 작성'));
  app.flow(0, 'steps', '첫 단계만 작성');
  const restored = qualityUI({}, app.stored());
  assert.equal(restored.get().critical_tests.flows[0].steps, '첫 단계만 작성');
  assert(review(restored.get()).reason.includes('흐름 1'));
});
test('composing Korean in a card does not replace the active form', () => {
  const app = qualityUI({ critical_tests: plan({}) });
  const before = app.markup();
  app.flow(0, 'steps', '한글 조합', true);
  assert.equal(app.markup(), before);
  assert.equal(app.get().critical_tests.flows[0].steps, '한글 조합');
  assert.equal(app.active().id, 'test-flow-0-steps');
});
test('deleting one populated card preserves its neighbors and legacy text', () => {
  const rows = [flow('첫 흐름'), flow('지울 흐름'), flow('마지막 흐름')];
  const app = qualityUI({ critical_tests: { ...plan(...rows), legacy: '이전 내용' } });
  app.click({ dataset: { removeTestFlow: '1' } });
  assert.equal(json(app.get().critical_tests.flows), json([rows[0], rows[2]]));
  assert.equal(app.get().critical_tests.legacy, '이전 내용');
  assert.equal(app.active().id, 'add-test-flow');
});
test('canceling deletion preserves a populated card', () => {
  const rows = [flow('보존할 흐름')];
  const app = qualityUI({ critical_tests: plan(...rows) }, undefined, { confirm: false });
  app.click({ dataset: { removeTestFlow: '0' } });
  assert.equal(json(app.get().critical_tests.flows), json(rows));
});
test('none to flows round-trip preserves hidden cards but excludes them from reports', () => {
  const row = flow('숨겨질고유흐름');
  const app = qualityUI({ critical_tests: plan(row), feature_specs: [feature('원본 기능')] });
  app.basis(0);
  assert.equal(app.get().critical_tests.basis, NONE);
  assert.equal(json(app.get().critical_tests.flows[0]), json(row));
  assert(!R.testPlanText(app.get()).includes(row.name));
  assert(!R.report(app.get()).includes(row.expected));
  assert(!app.markup().includes('data-test-field="steps"'));
  const restored = qualityUI({}, app.stored());
  restored.basis(1);
  assert.equal(json(restored.get().critical_tests.flows[0]), json(row));
  assert(restored.markup().includes(row.expected));
});
test('recommendation round-trip restores full plan and preserved legacy text', () => {
  const app = qualityUI({ critical_tests: { ...plan(flow('저장 흐름')), legacy: '원문\n보존' } });
  const before = json(app.get().critical_tests);
  app.clickUnknown('critical_tests');
  assert(R.isUnknown(app.get().critical_tests));
  assert(!R.testPlanText(app.get()).includes('저장 흐름'));
  const restored = qualityUI({}, app.stored());
  restored.clickUnknown('critical_tests');
  assert.equal(json(restored.get().critical_tests), before);
});
test('old text in recommendation drafts migrates and restores without loss', () => {
  const old = '추천 전 문자열\n두 번째 줄';
  const app = qualityUI({}, { version: 1, step: 12, details: true, answers: { critical_tests: R.UNKNOWN }, drafts: { critical_tests: old } });
  app.clickUnknown('critical_tests');
  assert.equal(app.get().critical_tests.legacy, old);
  assert(app.markup().includes('추천 전 문자열'));
});
test('export/import round-trip preserves none-basis hidden flows, notes and recommendation drafts', async () => {
  const value = { basis: NONE, flows: [flow('보관중흐름')], legacy: '보존할 원문\n줄바꿈' };
  const app = qualityUI({ critical_tests: value, feature_specs: [feature('출시 기능')] });
  app.note('critical_tests', '수동 흐름은 다음 판단까지 보관');
  app.clickUnknown('critical_tests');
  const first = app.exportBackup();
  const next = qualityUI({ summary: '바뀔 답변' });
  await next.importBackup(first);
  const second = next.exportBackup();
  for (const key of ['answers', 'drafts', 'notes']) assert.deepEqual(second[key], first[key]);
  next.clickUnknown('critical_tests');
  assert.equal(next.get().critical_tests.basis, NONE);
  next.basis(1);
  assert.equal(next.get().critical_tests.flows[0].name, '보관중흐름');
});
test('derived coverage updates from renames and priority changes without mutating manual flows', () => {
  const f = feature('변경 전');
  const app = qualityUI({ feature_specs: [f], critical_tests: plan(flow('유지할 연결 흐름')) });
  const manual = json(app.get().critical_tests);
  app.feature(0, 'name', '변경 후');
  app.render();
  assert(app.markup().includes('변경 후'));
  assert(!app.markup().includes('변경 전</summary>'));
  assert.equal(R.testCoverage(app.get()).features[0].row.name, '변경 후');
  app.feature(0, 'priority', '추후 개발');
  app.render();
  assert.equal(R.testCoverage(app.get()).features.length, 0);
  assert.equal(R.testCoverage(app.get()).excluded, 1);
  assert(!R.testPlanText(app.get()).includes('변경 후'));
  app.feature(0, 'priority', '첫 출시에서 선택');
  assert.equal(R.testCoverage(app.get()).features.length, 1);
  assert.equal(json(app.get().critical_tests), manual);
});
test('derived feature removal and reordering never leave stale copied test data', () => {
  const a = { feature_specs: [feature('A기능'), feature('B기능')], critical_tests: plan(flow('수동 흐름')) };
  const reordered = { ...a, feature_specs: [...a.feature_specs].reverse() };
  assert.equal(R.testCoverage(reordered).features[0].row.name, 'B기능');
  const removed = { ...a, feature_specs: [a.feature_specs[1]] };
  assert(!R.testPlanText(removed).includes('A기능'));
  assert(R.testPlanText(removed).includes('B기능'));
  assert.equal(json(removed.critical_tests), json(a.critical_tests));
});
test('unset feature priority remains visible as unresolved instead of silently excluded', () => {
  const source = { ...feature('범위 미정 기능') };
  delete source.priority;
  const a = { feature_specs: [source], critical_tests: { basis: NONE, flows: [] } };
  assert.equal(R.testCoverage(a).features.length, 1);
  assert(R.testPlanText(a).includes('출시 범위 미정'));
  assert(R.readiness(a).before.some(i => i.id === 'feature_specs'));
});
test('actor is displayed without inventing role-based permission and existing rules are reused', () => {
  const a = { feature_specs: [{ ...feature('권한 기능'), actor: '회원' }], critical_tests: { basis: NONE, flows: [] } };
  const text = R.testPlanText(a);
  assert(text.includes('대상 사용자만으로 권한을 추론하지 마세요'));
  assert(!text.includes('회원만 허용'));
  for (const id of ['access_rules', 'role_matrix', 'authorization_tests']) {
    const q = R.allQuestions.find(q => q.id === id);
    assert(text.includes(`${q.label}: 미정`));
  }
  const defined = R.testPlanText({ ...a, access_rules: '본인 주문만 조회', role_matrix: '운영자 승인만 허용', authorization_tests: '다른 조직 거절 확인' });
  for (const value of ['본인 주문만 조회', '운영자 승인만 허용', '다른 조직 거절 확인']) assert(defined.includes(value));
});
test('readiness distinguishes unset, delegated, absent sources and complete cross-feature flows', () => {
  assert(review({}));
  assert(review({ critical_tests: R.UNKNOWN }).reason.includes('추천'));
  assert(review({ critical_tests: { basis: NONE, flows: [] } }).reason.includes('명세가 없어'));
  assert(review({ critical_tests: plan() }).reason.includes('작성하지 않았'));
  assert(!review({ critical_tests: plan(flow('완전한 흐름')) }));
  assert(!review({ feature_specs: [feature('원본 기능')], critical_tests: { basis: NONE, flows: [] } }));
});
test('report and prompt include every source and flow field while identifying a plan rather than execution', () => {
  const f = feature('원본기능고유'), row = flow('연결흐름고유');
  const a = { feature_specs: [f], critical_tests: { ...plan(row), legacy: '이전요구고유' } };
  for (const text of [R.answerText(critical, a), R.report(a), R.report(a, true)]) {
    for (const value of [...Object.values(f), ...Object.values(row), '이전요구고유']) assert(text.includes(value), `missing ${value}`);
    assert(text.includes('검증 계획이며 테스트 실행·통과 결과가 아닙니다'));
    assert(!text.includes('[object Object]'));
  }
});
test('HTML escaping and multiline report quoting protect all new data fields', () => {
  const source = { ...feature('<img src=x onerror=alert(1)>'), actor: '<script>actor</script>' };
  const row = { ...flow('<script>flow</script>'), steps: '정상\n# 사용자 데이터', expected: '</textarea><img src=x>' };
  const a = { feature_specs: [source], critical_tests: { ...plan(row), legacy: '</textarea><script>legacy</script>' } };
  const app = qualityUI(a);
  assert(!app.markup().includes('<script>flow</script>'));
  assert(app.markup().includes('&lt;script&gt;flow&lt;/script&gt;'));
  assert(!app.markup().includes('</textarea><img'));
  assert(R.report(a).includes('> # 사용자 데이터'));
  app.click({ id: 'report-button' });
  assert(app.reportMarkup().includes('&lt;script&gt;flow&lt;/script&gt;'));
});
test('malformed imported plans are sanitized or rejected without property pollution', () => {
  const normalized = R.normalizeAnswers({ critical_tests: { basis: 'invalid', legacy: '유효한 원문', extra: 'drop', flows: [null, [], 4, { name: '허용', steps: 1, expected: 'x'.repeat(6001), extra: 'drop' }] } });
  assert.deepEqual(normalized.critical_tests, { flows: [{ name: '허용' }], legacy: '유효한 원문' });
  assert.deepEqual(R.normalizeAnswers(normalized), normalized);
  assert.throws(() => R.normalizeAnswers({ critical_tests: { flows: null } }));
  const object = JSON.parse('{"critical_tests":{"flows":[{"name":"ok","__proto__":{"polluted":true}}],"__proto__":{"polluted":true}}}');
  R.normalizeAnswers(object);
  assert.equal({}.polluted, undefined);
});
test('maximum card count is accepted and adding beyond it does not drop existing rows', () => {
  const a = { critical_tests: plan(...Array.from({ length: R.MAX_TEST_FLOWS }, (_, i) => flow(`흐름${i}`))) };
  const normalized = R.normalizeAnswers(a);
  assert.equal(normalized.critical_tests.flows.length, R.MAX_TEST_FLOWS);
  const app = qualityUI(normalized);
  const before = json(app.get().critical_tests);
  clickAdd(app);
  assert.equal(json(app.get().critical_tests), before);
  assert.throws(() => R.normalizeAnswers({ critical_tests: plan(...Array(R.MAX_TEST_FLOWS + 1).fill({})) }));
});
test('invalid backup cannot overwrite current test-plan data', async () => {
  const app = qualityUI({ critical_tests: plan(flow('현재 흐름')) });
  const before = json(app.get());
  await app.importBackup({ format: 'buildbrief', version: 1, answers: { critical_tests: { flows: 'invalid' } } });
  assert.equal(json(app.get()), before);
});
test('basis help changes no answer and both new choices have explanations', () => {
  const app = qualityUI({ critical_tests: plan(flow('도움말 유지')) });
  const before = json(app.get());
  for (let i = 0; i < Q.testBasisOptions.length; i++) {
    app.click({ dataset: { helpQuestion: 'test_basis', helpIndex: String(i) } });
    assert(app.helpMarkup().includes('어떤 방식인가요?'));
    assert.equal(json(app.get()), before);
  }
});
test('reset removes test plan, legacy text, preserved drafts and notes', () => {
  const app = qualityUI({ critical_tests: { ...plan(flow('삭제할 흐름')), legacy: '삭제할 원문' } });
  app.note('critical_tests', '삭제할 이유');
  app.clickUnknown('critical_tests');
  app.click({ id: 'confirm-reset' });
  for (const key of ['answers', 'drafts', 'notes']) assert.deepEqual(app.exportBackup()[key], {});
});

// END TEST-PLAN CASES

}

test('every decision and every offered option has complete educational guidance', () => {
  const ids = new Set(R.allQuestions.map(q => q.id));
  for (const question of R.allQuestions) {
    const guide = G.questions[question.id];
    assert(guide, question.id);
    for (const field of ['why', 'criteria', 'impact']) assert(guide[field]?.length > 15, `${question.id}/${field}`);
    assert(Array.isArray(guide.related) && guide.related.length <= 3, question.id);
    for (const id of guide.related) assert(ids.has(id) && id !== question.id, `${question.id}/${id}`);
    if (['text', 'textarea'].includes(question.type)) assert(guide.prompts?.length >= 3, `${question.id}/writing prompts`);
  }
  for (const question of [...R.allQuestions.filter(q => q.options.length), { id: 'feature_priority', options: Q.featureFields.find(f => f.id === 'priority').options }, { id: 'test_basis', options: Q.testBasisOptions }]) {
    for (const option of R.choiceOptions(question)) {
      for (const field of ['meaning', 'pros', 'cons', 'fit', 'impact']) {
        assert(G.get(question, option)?.[field]?.length > 5, `${question.id}/${option}/${field}`);
      }
    }
  }
});
test('comparing and browsing explains both options without changing answers or notes', () => {
  const app = ui({}, { version: 1, step: 4, details: true, answers: { frontend_language: 'TypeScript' }, notes: { frontend_language: '팀에서 사용해 본 언어라 선택' } });
  const before = JSON.stringify({ answers: app.get(), notes: app.stored().notes });
  app.click({ dataset: { helpQuestion: 'frontend_language', helpIndex: '0' } });
  app.compareHelp(1);
  assert(app.helpMarkup().includes('option-comparison'));
  for (const key of ['meaning', 'example', 'pros', 'cons', 'fit', 'impact']) {
    assert(app.helpMarkup().includes(G.get({ id: 'frontend_language' }, 'JavaScript')[key]));
    assert(app.helpMarkup().includes(G.get({ id: 'frontend_language' }, 'TypeScript')[key]));
  }
  app.browseHelp(1);
  assert(!app.helpMarkup().includes('option-comparison'));
  app.compareHelp(-1);
  assert(!app.helpMarkup().includes('undefined'));
  assert.equal(JSON.stringify({ answers: app.get(), notes: app.stored().notes }), before);
});
test('each question shows its own reason, writing scaffold and related decisions', () => {
  const app = ui({}, { version: 1, step: 0, details: true, answers: {} });
  assert(app.markup().includes(G.facts.project_name.meaning));
  assert(app.markup().includes((G.facts.summary || G.questions.summary).criteria));
  assert(app.markup().includes((G.facts.summary?.example || G.questions.summary.prompts[0])));
  assert(app.markup().includes('data-detail="reason-summary"'));
  app.click({ dataset: { step: '4' } });
  app.choose('frontend_language', 'JavaScript');
  assert(app.markup().includes(G.get({ id: 'frontend_language' }, 'JavaScript').fit));
  assert(app.markup().includes(G.get({ id: 'frontend_language' }, 'JavaScript').impact));
});
test('converted free-text decisions retain full old text, drafts and notes through backups', async () => {
  for (const q of R.allQuestions.filter(q => q.legacyFreeText)) {
    for (const text of [' 이전에 적은 세부 조건\n두 번째 줄 ', '가'.repeat(6000)]) {
      const app = ui({}, { version: 1, step: 8, details: true, answers: { [q.id]: text }, notes: { [q.id]: '선택 이유' } });
      const expected = `기타: ${text}`;
      assert([app.get()[q.id]].flat().includes(expected), q.id);
      const backup = app.exportBackup();
      await app.importBackup(backup);
      const restored = app.exportBackup();
      for (const key of ['answers', 'drafts', 'notes']) assert.deepEqual(restored[key], backup[key]);
      assert(R.normalizeAnswers({ [q.id]: R.UNKNOWN })[q.id].includes(R.UNKNOWN));
      const report = R.report({ ...app.get(), project_type: '웹 + 모바일 앱', notification_channels: ['이메일'], features: R.allQuestions.find(q => q.id === 'features').options }, false, app.stored().notes);
      for (const line of text.split('\n')) assert(report.includes(line.trim()), q.id);
    }
  }
});


test('jump and restore focus answer controls rather than closed learning links', () => {
  const app = ui({}, { version: 1, step: 0, details: true, answers: { summary: '보관할 내용' } });
  app.focusTargets('summary');
  app.click({ dataset: { jump: 'summary' } });
  assert.equal(app.active().id, 'input-summary');
  app.clickUnknown('summary');
  app.click({ dataset: { restore: 'summary' } });
  assert.equal(app.active().id, 'input-summary');
});
test('new tool choices honor exclusivity and explain framework conflicts', () => {
  const app = ui({}, { version: 1, step: 4, answers: { frontend_framework: 'React + Vite' } });
  app.choose('ui_library', 'MUI·React');
  app.choose('ui_library', '추가 UI 도구 없이 직접 제작');
  assert.equal(JSON.stringify(app.get().ui_library), JSON.stringify(['추가 UI 도구 없이 직접 제작']));
  app.choose('ui_library', 'Vuetify·Vue');
  assert.equal(JSON.stringify(app.get().ui_library), JSON.stringify(['Vuetify·Vue']));
  assert(R.issues(app.get()).some(x => x.id === 'ui_library'));
  assert(!R.issues({ ...app.get(), frontend_framework: 'Vue + Vite' }).some(x => x.id === 'ui_library'));
  assert(R.issues({ project_type: 'PC 프로그램', mobile_stack: ['Electron'], app_web_ui: '네이티브 화면만 사용' }).some(x => x.id === 'app_web_ui'));
  const restored = R.normalizeAnswers({ delivery_level: '실제 저장·로그인까지' });
  assert.equal(restored.delivery_level, '실제 핵심 기능까지');
  assert.equal(restored.features, undefined, 'Delivery level must not invent a login requirement');
});


test('question conditions never depend on a later question', () => {
  const order = new Map(R.allQuestions.map((q,i) => [q.id,i]));
  for (const step of Q.steps) for (const group of step.groups) for (const q of group.questions)
    for (const parent of [group.when,q.when].flatMap(R.conditionIds)) assert(order.get(parent) < order.get(q.id), `${parent} before ${q.id}`);
});
test('ordered advanced sections retain prerequisite order in the DOM', () => {
  const app = ui({}, {version:1,step:0,answers:{},details:false});
  for(let i=0;i<Q.steps.length;i++){
    app.click({dataset:{step:String(i)}});
    const expected=R.activeGroups(Q.steps[i],{}).flatMap(g=>g.questions).map(q=>q.id);
    const actual=[...app.markup().matchAll(/<fieldset class="question" id="field-([^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(actual,expected);
    assert(!/<p class="question-help" id="[^"]+">\s*<\/p>/.test(app.markup()));
  }
});
test('worksheets preserve every legacy answer and unknown roundtrip through backups', async () => {
  for(const q of R.allQuestions.filter(q=>q.type==='worksheet')){
    const text=' 원문\n'+ '가'.repeat(5995);
    const app=ui({}, {version:1,step:0,answers:{[q.id]:text},notes:{[q.id]:'이유'}});
    assert.equal(app.get()[q.id].legacy,text,q.id);
    app.clickUnknown(q.id);
    const backup=app.exportBackup();
    await app.importBackup(backup);
    assert.deepEqual(app.exportBackup().drafts,backup.drafts);
    app.clickUnknown(q.id);
    assert.equal(app.get()[q.id].legacy,text,q.id);
    assert.equal(app.stored().notes[q.id],'이유');
  }
});
test('worksheet edits, add/remove and reload retain rows and partial status', () => {
  const app=ui({}, {version:1,step:2,answers:{},details:true});
  app.worksheet('role_matrix',0,'role','<script>운영자</script>');
  app.click({dataset:{addWorksheet:'role_matrix'}});
  app.worksheet('role_matrix',1,'role','일반 회원');
  assert.equal(app.get().role_matrix.rows.length,2);
  assert(app.markup().includes('&lt;script&gt;운영자&lt;/script&gt;'));
  const reloaded=ui({},app.stored());
  assert.equal(reloaded.get().role_matrix.rows[1].role,'일반 회원');
  assert([...R.readiness(reloaded.get()).before,...R.readiness(reloaded.get()).during].some(x=>x.id==='role_matrix' && x.reason.includes('일부 작성')));
  reloaded.click({dataset:{removeWorksheet:'role_matrix',row:'1'}});
  assert.equal(reloaded.get().role_matrix.rows.length,1);
});
test('worksheet explicit unknown fields stay on the clarification list', () => {
  const q=R.allQuestions.find(q=>q.id==='role_matrix');
  for(const value of ['미정',R.UNKNOWN]){
    const a=R.normalizeAnswers({role_matrix:{rows:[Object.fromEntries(q.fields.map(f=>[f.id,value]))]}});
    assert([...R.readiness(a).before,...R.readiness(a).during].some(x=>x.id===q.id));
  }
});
test('worksheet imports reject excessive rows and drop unknown fields', () => {
  assert.throws(()=>R.normalizeAnswers({role_matrix:{rows:Array(R.MAX_WORKSHEET_ROWS+1).fill({})}}));
  const a=R.normalizeAnswers(JSON.parse('{"role_matrix":{"worksheet":"project_name","rows":[null,[],{"role":"관리자","__proto__":{"polluted":true},"random":"제외"}]}}'));
  assert.deepEqual(a.role_matrix,{worksheet:'role_matrix',rows:[{role:'관리자'}]});
  assert.equal({}.polluted,undefined);
});
test('report suppresses empty sections while retaining pending decisions and note-only answers', () => {
  const app=ui();app.click({id:'report-button'});
  assert(!app.reportMarkup().includes('class="report-section"'));
  assert(app.reportMarkup().includes('개발 전 확인'));
  assert(!R.report({}).includes('### 프로젝트 소개'));
  const groups=Q.steps.flatMap(s=>R.reportGroups(s,{}, {summary:'다음 주 확인'}));
  assert.equal(groups.flatMap(g=>g.questions).length,1);
  assert.equal(groups[0].questions[0].id,'summary');
});
test('optional help rows are omitted from single and comparison views', () => {
  const a=G.entries.frontend_language.JavaScript,b=G.entries.frontend_language.TypeScript;
  try {
    G.entries.frontend_language.JavaScript={meaning:a.meaning,pros:a.pros};
    G.entries.frontend_language.TypeScript={meaning:b.meaning,pros:b.pros};
    const app=ui();app.click({dataset:{helpQuestion:'frontend_language',helpIndex:'0'}});
    assert(!app.helpMarkup().includes('감수할 점'));assert(!app.helpMarkup().includes('guide-burden'));
    app.compareHelp(1);assert(!app.helpMarkup().includes('운영하면서 맡을 일'));assert(!app.helpMarkup().includes('설명 미제공'));
  } finally {G.entries.frontend_language.JavaScript=a;G.entries.frontend_language.TypeScript=b;}
});
test('factual choice help uses estimation criteria instead of artificial tradeoffs', () => {
  const q=R.allQuestions.find(q=>G.facts[q.id] && q.options.length);
  const app=ui();app.click({dataset:{helpQuestion:q.id,helpIndex:'0'}});
  assert(app.helpMarkup().includes(G.facts[q.id].criteria));
  assert(!app.helpMarkup().includes('감수할 점'));
  assert(!app.helpMarkup().includes('운영하면서 맡을 일'));
});
test('corrected service branches include custom tools and narrow email requirements', () => {
  assert(!shown('email_provider',{features:['알림'],notification_channels:['SMS']}));
  assert(shown('hosting_mapping',{hosting:['Vercel']}));
  assert(shown('cache_operation',{cache:'기타: 사내 캐시'}));
  assert(shown('message_reliability',{messaging:'기타: 사내 큐'}));
  assert(shown('service_boundaries',{architecture:'모듈형 모놀리식'}));
  assert(shown('license_transfer',{customer_license:'서비스 제공 기간 동안'}));
});

test('technical alternatives explain when to reconsider them', () => {
  for (const id of ['frontend_language','frontend_framework','backend_language','database','architecture','docker','messaging'])
    for (const option of R.allQuestions.find(q=>q.id===id).options)
      assert(G.entries[id][option].avoid?.length > 15, id+'/'+option);
});

Promise.all(pending).then(() => {
  console.log(`RESULT ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
});

}
