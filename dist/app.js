(() => {
  'use strict';
  const { steps, featureFields, testBasisOptions, testFlowFields } = window.BriefQuestions;
  const R = window.BriefReport;
  const STORAGE_KEY = 'buildbrief.project.v1';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let answers = {}, drafts = {}, notes = {}, currentStep = 0, showDetails = false, reportTab = 'spec', isReport = false;
  let storageWorking = true, externalChange = false, toastTimer;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1) {
      answers = R.normalizeAnswers(saved.answers);
      drafts = R.normalizeAnswers(saved.drafts || {});
      notes = R.normalizeNotes(saved.notes);
      currentStep = Number.isInteger(saved.step) ? Math.min(Math.max(saved.step, 0), steps.length - 1) : 0;
      showDetails = saved.details === true;
    }
  } catch { storageWorking = false; }
  const conditionDependencies = new Set(steps.flatMap(s => s.groups.flatMap(g => [g.when, ...g.questions.map(q => q.when)].flatMap(R.conditionIds))));
  const byId = new Map(R.allQuestions.map(q => [q.id, q]));
  const priorityQuestion = { id: 'feature_priority', label: '이 기능은 언제 필요한가요?', options: featureFields.find(f => f.id === 'priority').options };
  const testBasisQuestion = { id: 'test_basis', label: '여러 기능을 잇는 별도 흐름이 필요한가요?', options: testBasisOptions };
  const answerIndicator = (q, value) => R.needsReselection(q, value) ? '다시 선택 필요' : R.isUnknown(value) ? '추천 요청' : R.isAnswered(value) ? '답변됨' : '';
  const helpButton = (id, index, label) => `<button type="button" class="option-help" data-help-question="${id}" data-help-index="${index}" aria-label="${escape(label)} 설명" aria-haspopup="dialog" aria-controls="option-help-dialog"><span aria-hidden="true">?</span></button>`;
  const guideFields = [['meaning', '어떤 방식인가요?'], ['example', '실제로는 이렇게 동작해요'], ['pros', '얻는 점'], ['cons', '감수할 점'], ['fit', '이럴 때 검토하세요'], ['avoid', '다른 방식을 검토할 때'], ['impact', '선택하면 이어서 할 일'], ['cost', '비용을 좌우하는 것'], ['effort', '구현할 때 준비할 것'], ['operations', '운영하면서 맡을 일']];
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const factsMarkup = (guide, fields) => fields.filter(([key]) => hasText(guide[key])).map(([key, label]) => `<div class="help-fact"><dt>${label}</dt><dd>${escape(guide[key])}</dd></div>`).join('');
  const guideSource = guide => guide.source && /^https:\/\//.test(guide.source) ? `<a class="help-source" href="${escape(guide.source)}" target="_blank" rel="noopener noreferrer">공식 설명 더 보기 ↗</a>` : '';
  function showOptionHelp(id, index, open = true, compareIndex = -1) {
    const q = id === priorityQuestion.id ? priorityQuestion : id === testBasisQuestion.id ? testBasisQuestion : byId.get(id);
    if (!q) return;
    const options = [priorityQuestion.id, testBasisQuestion.id].includes(id) ? q.options : R.choiceOptions(q);
    const option = options[index];
    const guide = window.BriefGuides.get(q, option);
    if (!guide) return;
    const dialog = $('#option-help-dialog');
    dialog.dataset.question = id;
    $('#help-context').textContent = q.label;
    $('#help-title').textContent = option;
    const comparison = compareIndex !== index ? window.BriefGuides.get(q, options[compareIndex]) : null;
    dialog.classList.toggle('comparing', !!comparison);
    const fact = q.options.includes(option) ? window.BriefGuides.facts?.[q.id] : null;
    const fields = fact ? [['meaning', '이 선택이 뜻하는 것']] : guideFields;
    const common = fact ? `<div class="fact-guidance"><dl>${factsMarkup(fact, [['meaning','무엇을 입력하나요?'],['criteria','이렇게 판단하세요'],['example','예를 들어'],['impact','다음에 연결할 내용']])}</dl></div>` : '';
    const burden = factsMarkup(guide, fields.filter(([key]) => ['cost','effort','operations'].includes(key)));
    $('#help-content').innerHTML = common + (comparison ? `<div class="comparison-scroll" tabindex="0" role="region" aria-label="두 선택지 비교표"><table class="option-comparison"><caption>공통으로 설명된 기준을 비교해요. 개별 설명에서 추가 내용을 볼 수 있어요.</caption><thead><tr><th scope="col">판단 기준</th><th scope="col">${escape(option)}</th><th scope="col">${escape(options[compareIndex])}</th></tr></thead><tbody>${fields.filter(([key]) => hasText(guide[key]) && hasText(comparison[key])).map(([key,label]) => `<tr><th scope="row">${label}</th><td>${escape(guide[key])}</td><td>${escape(comparison[key])}</td></tr>`).join('')}${guideSource(guide) && guideSource(comparison) ? `<tr><th scope="row">참고 자료</th><td>${guideSource(guide)}</td><td>${guideSource(comparison)}</td></tr>` : ''}</tbody></table></div>` : `<dl class="guide-main">${factsMarkup(guide, fields.filter(([key]) => !['cost','effort','operations'].includes(key)))}</dl>${burden ? `<details class="guide-burden"><summary>비용·구현·운영까지 살펴보기</summary><dl>${burden}</dl></details>` : ''}${guideSource(guide)}`);
    $('#help-option').innerHTML = options.map((item, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>${escape(item)}</option>`).join('');
    $('#help-option').value = String(index);
    $('#help-compare').innerHTML = '<option value="-1">비교할 선택지 고르기</option>' + options.map((item, i) => i === index ? '' : `<option value="${i}" ${comparison && i === compareIndex ? 'selected' : ''}>${escape(item)}</option>`).join('');
    $('#help-compare').value = comparison ? String(compareIndex) : '-1';
    if (open) dialog.showModal();
  }
  function questionLearning(question) {
    const learning = window.BriefGuides.questions?.[question.id];
    if (!learning) return '';
    const active = new Set(R.activeQuestions(answers).map(q => q.id));
    const fact = window.BriefGuides.facts?.[question.id];
    return `<div class="question-learning"><p class="question-why" id="why-${question.id}"><strong>${fact ? '작성 기준' : '왜 고민하나요?'}</strong> ${escape(fact?.meaning || learning.why)}</p><details class="decision-detail" data-detail="reason-${question.id}"><summary>${fact ? '작성 방법과 예시 보기' : '판단 기준과 다음 결정 알아보기'}</summary><dl>${factsMarkup(fact || learning, [['criteria','무엇을 보고 판단하나요?'],['example','예를 들어'],['impact','이 선택은 무엇에 영향을 주나요?']])}</dl>${learning.related?.some(id => active.has(id)) ? `<div class="related-decisions"><strong>함께 살펴볼 결정</strong>${learning.related.filter(id => active.has(id)).map(id => `<button type="button" class="text-button" data-jump="${id}">${escape(byId.get(id).label)} →</button>`).join('')}</div>` : ''}</details>${!fact && learning.prompts?.length && question.type !== 'worksheet' ? `<details class="decision-detail writing-guide" data-detail="write-${question.id}"><summary>막막할 때, 이 순서로 생각해 보세요</summary><ol>${learning.prompts.map(prompt => `<li>${escape(prompt)}</li>`).join('')}</ol><p>내 프로젝트에 맞는 내용부터 적으세요. 아직 모르는 조건은 미정이라고 남겨도 돼요.</p></details>` : ''}</div>`;
  }
  function updateSaveStatus(message) {
    $('#save-status').textContent = message;
    $('#storage-help-status').textContent = message;
    $('#storage-help-warning').hidden = storageWorking && !externalChange;
    $('#save-help-button').dataset.attention = String(!storageWorking || externalChange);
    $('#save-help-button').setAttribute('aria-label', `${message} · 저장 안내 열기`);
    $('#storage-help-dialog').dataset.attention = String(!storageWorking || externalChange);
  }
  function save() {
    if (externalChange) {
      updateSaveStatus('다른 탭 변경 감지 · 백업 후 새로고침');
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, step: currentStep, details: showDetails, answers, drafts, notes }));
      storageWorking = true;
      updateSaveStatus('이 브라우저에 저장됨');
    } catch {
      storageWorking = false;
      updateSaveStatus('저장 불가 · 답변을 백업해 주세요');
    }
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
  }
  function setAnswer(id, value, rerender = false, composing = false) {
    rerender = !composing && (rerender || R.needsReselection(byId.get(id), answers[id]));
    if (R.isUnknown(value) && !R.isUnknown(answers[id]) && answers[id] !== undefined) drafts[id] = JSON.parse(JSON.stringify(answers[id]));
    if (R.isAnswered(value) || (byId.get(id)?.type === 'featurelist' && Array.isArray(value)) || (['testplan','worksheet'].includes(byId.get(id)?.type) && value && typeof value === 'object') || (Array.isArray(value) ? value.some(v => typeof v === 'string' && v.startsWith('기타:')) : typeof value === 'string' && value.startsWith('기타:'))) answers[id] = value;
    else delete answers[id];
    save();
    updateProgress();
    if (!rerender) document.querySelectorAll('[data-reuse-question]').forEach(element => {
      const question = byId.get(element.dataset.reuseQuestion);
      if (!question?.reuse.includes(id)) return;
      const open = element.querySelector('details')?.open;
      element.innerHTML = reusedAnswersMarkup(question);
      if (open && element.querySelector('details')) element.querySelector('details').open = true;
    });
    if (rerender) {
      const focused = document.activeElement?.id;
      const selection = [document.activeElement?.selectionStart, document.activeElement?.selectionEnd];
      renderQuestions();
      if (focused) {
        const input = document.getElementById(focused);
        input?.focus({ preventScroll: true });
        if (typeof selection[0] === 'number') input?.setSelectionRange?.(...selection);
      }
    } else {
      const field = document.getElementById(`field-${id}`);
      if (field) {
        field.classList.remove('invalid');
        field.querySelector('.field-error')?.remove();
        const indicator = field.querySelector('.answer-indicator');
        if (indicator) indicator.textContent = answerIndicator(byId.get(id), value);
      }
    }
  }
  function updateProgress() {
    const stat = R.stats(answers);
    $('#progress-number').textContent = `${stat.percent}%`;
    $('#progress-bar').style.width = `${stat.percent}%`;
    $('#progress-caption').textContent = `전체 ${R.allQuestions.length}개 중 현재 관련 ${stat.total}개 · 선택·작성 ${stat.confirmed}개 · 추천 요청 ${stat.delegated}개 · 미응답 ${stat.pending}개`;
    $('#project-label').textContent = R.display(answers.project_name) || '새로운 아이디어';
    $('#step-nav').innerHTML = steps.map((step, index) => {
      const qs = R.activeGroups(step, answers).flatMap(g => g.questions);
      const done = qs.filter(q => R.isAnswered(answers[q.id]) && !R.needsReselection(q, answers[q.id])).length;
      const complete = qs.length > 0 && done === qs.length;
      return `<button type="button" class="step-link ${!isReport && index === currentStep ? 'active' : ''} ${complete ? 'complete' : ''} ${qs.length ? '' : 'inactive-step'}" data-step="${index}" ${!isReport && index === currentStep ? 'aria-current="step"' : ''}><span class="step-index">${complete ? '✓' : step.icon}</span><span>${step.short}</span><span class="nav-count">${qs.length ? `${done}/${qs.length}` : '적용 확인'}</span></button>`;
    }).join('');
    const current = R.activeGroups(steps[currentStep], answers).flatMap(g => g.questions);
    const done = current.filter(q => R.isAnswered(answers[q.id]) && !R.needsReselection(q, answers[q.id])).length;
    $('#step-summary').textContent = current.length ? `${done} / ${current.length}개 답변 · 나중에 수정할 수 있어요` : '선행 답변과 적용 여부를 확인해 주세요';
  }
  function worksheetMarkup(question, value) {
    if (R.isUnknown(value)) return '<p class="question-help">이 항목은 AI와 함께 정할 내용으로 남겼어요.</p>';
    const plan = R.worksheetPlan(question, value), rows = plan.rows.length ? plan.rows : [{}];
    return `<div class="worksheet"><p class="worksheet-intro">${escape(question.worksheetIntro || '대상별로 나누어 적으세요. 모르는 칸은 미정으로 남겨도 돼요.')}</p>${rows.map((row,index) => `<section class="worksheet-row"><div class="worksheet-heading"><h3>${escape(question.rowLabel || '항목')} ${index + 1}</h3>${plan.rows.length > 1 ? `<button type="button" class="text-button" data-remove-worksheet="${question.id}" data-row="${index}">이 항목 지우기</button>` : ''}</div><div class="worksheet-fields">${question.fields.map(field => `<div><label for="worksheet-${question.id}-${index}-${field.id}">${escape(field.label)}${field.required === false ? ' (선택)' : ''}</label><textarea class="textarea-input" rows="2" id="worksheet-${question.id}-${index}-${field.id}" data-worksheet="${question.id}" data-row="${index}" data-part="${field.id}" maxlength="6000" placeholder="${escape(field.placeholder || '아직 정하지 못했다면 미정')}">${escape(row[field.id] || '')}</textarea></div>`).join('')}</div></section>`).join('')}${question.repeatable !== false ? `<button type="button" class="button secondary" data-add-worksheet="${question.id}" ${rows.length >= R.MAX_WORKSHEET_ROWS ? 'disabled' : ''}>+ ${escape(question.rowLabel || '항목')} 추가</button>` : ''}${Object.hasOwn(plan,'legacy') ? `<details class="worksheet-legacy" data-detail="legacy-${question.id}" open><summary>기존 자유 작성 내용</summary><p>이전 내용을 그대로 보관했어요. 위 작성표는 필요한 부분부터 보완하세요.</p><label for="worksheet-${question.id}-legacy">기존 답변</label><textarea class="textarea-input" rows="3" id="worksheet-${question.id}-legacy" data-worksheet="${question.id}" data-worksheet-legacy="true" maxlength="6000">${escape(plan.legacy)}</textarea></details>` : ''}</div>`;
  }
  function reusedAnswersMarkup(question) {
    const ids = (question.reuse || []).filter(id => byId.has(id) && R.isAnswered(answers[id]) && R.activeQuestions(answers).some(q => q.id === id));
    if (!ids.length) return '';
    return `<details class="reused-answers" data-detail="reuse-${question.id}"><summary>연결된 답변 ${ids.length}개 참고하기</summary><p>같은 내용을 다시 적지 말고, 이 질문에서 추가할 규칙이나 예외를 보완하세요.</p>${ids.map(id => `<div><strong>${escape(byId.get(id).label)}</strong>${R.isAnswered(answers[id]) ? `<p>${escape(R.answerText(byId.get(id), answers))}</p>` : '<p class="unanswered">아직 작성하지 않았어요.</p>'}<button type="button" class="text-button" data-jump="${id}">이 기준 작성·수정 →</button></div>`).join('')}</details>`;
  }
  function currentTestPlan() {
    const plan = R.testPlan(R.isUnknown(answers.critical_tests) ? drafts.critical_tests : answers.critical_tests);
    return { ...plan, flows: [...plan.flows] };
  }
  function testPlanMarkup(value) {
    const coverage = R.testCoverage(answers), plan = R.testPlan(value), delegated = R.isUnknown(value);
    const fields = featureFields.filter(field => !['name', 'priority'].includes(field.id));
    return `<div class="test-plan">
      <div class="test-plan-intro"><strong>이미 작성한 기능에서 검증 기준을 가져왔어요</strong><p>아래는 검증할 내용이에요. 실제 테스트를 실행했거나 통과했다는 뜻은 아니에요.</p><button type="button" class="text-button" data-jump="feature_specs">기능 명세에서 수정 →</button></div>
      <details class="test-coverage" data-detail="test-coverage"><summary>기능별 검증 기준 ${coverage.features.length}개 <span>추후 개발 ${coverage.excluded}개 제외</span></summary>${coverage.features.length ? coverage.features.map(({row,index}) => `<details class="test-source" data-detail="test-source-${index}"><summary>${escape(row.name || `기능 ${index + 1} · 이름 미정`)} <span>${escape(row.priority || '출시 범위 미정')}</span></summary><dl>${fields.map(field => `<div><dt>${escape(field.label)}</dt><dd>${escape(R.isAnswered(row[field.id]) ? row[field.id] : '미정 — 기능 명세에서 보완')}</dd></div>`).join('')}</dl></details>`).join('') : '<p>연결할 첫 출시 기능 명세가 없어요. 앞 단계에 기능을 정리하면 이곳에 자동으로 연결돼요. 아래 연결 흐름은 먼저 작성할 수 있어요.</p>'}</details>
      <div class="test-checks"><p>각 기능의 <strong>정상 결과·실패 처리·완료 조건</strong>을 확인하고, 사용자·역할과 접근 규칙에 맞는 <strong>허용·차단</strong>도 검증해요. 데이터가 바뀌는 기능은 중복 요청과 중간 실패 시 데이터가 어긋나지 않는지도 확인해요.</p><details data-detail="test-permissions"><summary>이미 적은 권한 기준 확인</summary>${['access_rules','role_matrix','authorization_tests'].map(id => `<p><strong>${escape(byId.get(id).label)}</strong><br>${escape(R.isAnswered(answers[id]) ? R.display(answers[id]) : '미정 — 사용자 이름이나 역할만으로 권한을 추측하지 않아요.')}</p><button type="button" class="text-button" data-jump="${id}">이 기준 수정 →</button>`).join('')}</details></div>
      ${delegated ? '<p class="question-help">추가 흐름이 필요한지 AI와 정할 항목으로 남겼어요. 위 기능 명세의 검증 기준은 계속 참고할 수 있어요.</p>' : `<fieldset class="test-basis"><legend>여러 기능을 잇는 별도 흐름이 필요한가요?</legend><p class="question-help">예를 들어 ‘주문 생성 → 결제 → 취소’는 각 기능이 따로 성공해도 서로 연결했을 때 문제가 날 수 있어요. 이런 흐름만 추가하면 돼요.</p><div class="choices">${testBasisOptions.map((option,index) => `<div class="choice-shell"><label class="choice"><input id="test-basis-${index}" type="radio" name="test-basis" data-test-basis="${index}" ${plan.basis === option ? 'checked' : ''}><span>${escape(option)}</span></label>${helpButton('test_basis',index,option)}</div>`).join('')}</div></fieldset>
      ${plan.basis === testBasisOptions[1] ? `<div class="test-flows">${plan.flows.map((row,index) => `<details class="test-flow" data-detail="test-flow-${index}" ${testFlowFields.every(field => !row[field.id]) ? 'open' : ''}><summary id="test-flow-title-${index}">${escape(row.name || `연결 흐름 ${index + 1}`)}</summary><div class="test-flow-body">${testFlowFields.map(field => `<label for="test-flow-${index}-${field.id}">${escape(field.label)}</label><textarea id="test-flow-${index}-${field.id}" class="textarea-input" rows="2" maxlength="6000" data-test-flow="${index}" data-test-field="${field.id}" placeholder="${escape(field.placeholder)}">${escape(row[field.id] || '')}</textarea>`).join('')}<button type="button" class="text-button" data-remove-test-flow="${index}">이 흐름 삭제</button></div></details>`).join('')}<button type="button" class="button secondary" id="add-test-flow" ${plan.flows.length >= R.MAX_TEST_FLOWS ? 'disabled' : ''}>+ 연결 흐름 추가</button><p class="question-help">중요한 연결 흐름을 하나씩 추가하세요. ${plan.flows.length}개 작성 중 · 최대 ${R.MAX_TEST_FLOWS}개</p></div>` : plan.flows.length ? '<p class="question-help">이전에 작성한 연결 흐름은 보관하고 있어요. 현재 리포트에서는 제외하며, 추가 옵션을 다시 선택하면 복원돼요.</p>' : ''}
      ${Object.hasOwn(plan,'legacy') ? `<details class="test-legacy" data-detail="test-legacy" open><summary>이전에 작성한 검증 내용</summary><p class="question-help">기존 내용을 그대로 보관했어요. 필요하면 연결 흐름으로 나누거나 이곳에서 보완하세요. 리포트에도 함께 포함돼요.</p><label for="test-legacy">기존 검증 요구</label><textarea id="test-legacy" class="textarea-input" rows="3" maxlength="6000" data-test-legacy="true">${escape(plan.legacy)}</textarea></details>` : ''}`}
    </div>`;
  }
  function questionMarkup(question) {
    const { id, label, type, help, required } = question;
    const value = answers[id];
    const delegated = R.isUnknown(value);
    const rawValue = Array.isArray(value) ? value : [value];
    const custom = rawValue.find(v => typeof v === 'string' && v.startsWith('기타:'));
    const helpId = hasText(help) ? `help-${id}` : `why-${id}`;
    let controls = '';
    if (type === 'worksheet') {
      controls = worksheetMarkup(question, value);
    } else if (type === 'testplan') {
      controls = testPlanMarkup(value);
    } else if (type === 'featurelist') {
      const rows = Array.isArray(value) ? value : [];
      controls = `<div class="feature-cards">${rows.map((row, index) => `<section class="feature-card"><div class="feature-card-top"><h3>기능 ${index + 1}</h3><button type="button" class="text-button" data-remove-feature="${index}">이 기능 지우기</button></div><div class="feature-fields">${featureFields.map(field => {
        const inputId = `feature-${index}-${field.id}`;
        const attributes = `id="${inputId}" data-feature-index="${index}" data-feature-field="${field.id}"`;
        if (field.options) return `<fieldset class="feature-field wide feature-priority"><legend>${escape(field.label)}</legend><div class="choices">${field.options.map((option, i) => `<div class="choice-shell"><label class="choice"><input type="radio" id="${inputId}-${i}" name="feature-${index}-priority" data-feature-index="${index}" data-feature-field="priority" value="${escape(option)}" ${row.priority === option ? 'checked' : ''}><span>${escape(option)}</span></label>${helpButton('feature_priority', i, option)}</div>`).join('')}</div></fieldset>`;
        return `<div class="feature-field ${['name', 'actor'].includes(field.id) ? '' : 'wide'}"><label for="${inputId}">${escape(field.label)}</label><textarea class="textarea-input" ${attributes} rows="2" maxlength="6000" placeholder="${escape(field.placeholder)}">${escape(row[field.id] || '')}</textarea></div>`;
      }).join('')}</div></section>`).join('')}</div>${delegated ? '<p class="question-help">기능 명세를 AI와 함께 정할 항목으로 남겼어요.</p>' : ''}<button type="button" class="button secondary" id="add-feature" ${rows.length >= R.MAX_FEATURES ? 'disabled' : ''}>+ 기능 추가</button><p class="question-help feature-limit">최대 ${R.MAX_FEATURES}개 · 일부만 작성해도 저장돼요. ‘추후 개발’은 이번 출시 범위에서 제외해요.</p>`;
    } else if (type === 'text' || type === 'textarea') {
      const attrs = `id="input-${id}" class="${type === 'text' ? 'text-input' : 'textarea-input'}" data-question="${id}" maxlength="6000" aria-describedby="${helpId}" ${required ? 'aria-required="true"' : ''} ${delegated ? 'disabled' : ''} placeholder="${escape(delegated ? 'AI에게 추천을 요청한 항목이에요' : question.placeholder || '답변을 적어 주세요') }"`;
      controls = type === 'text' ? `<input type="text" ${attrs} value="${escape(delegated ? '' : value || '')}">` : `<textarea ${attrs} rows="3">${escape(delegated ? '' : value || '')}</textarea>`;
    } else {
      const choices = R.choiceOptions(question);
      controls = `<div class="choices">${choices.map((item, index) => `<div class="choice-shell"><label class="choice ${item === R.UNKNOWN ? 'unknown-choice' : ''} ${item === '직접 입력' ? 'custom-choice' : ''}"><input type="${type === 'multi' ? 'checkbox' : 'radio'}" id="input-${id}-${index}" name="${id}" data-question="${id}" value="${escape(item)}" ${(item === '직접 입력' ? custom !== undefined : rawValue.includes(item)) ? 'checked' : ''} aria-describedby="${helpId}"><span>${escape(item)}</span></label>${helpButton(id, index, item)}</div>`).join('')}</div>`;
    }
    if (R.needsReselection(question, value)) controls = `<p class="legacy-answer">이전 답변을 보관했어요: ${escape(R.display(value))}. 질문의 기준이 바뀌었거나 현재 허용하지 않는 선택이에요. 확인 후 다시 선택해 주세요.</p>` + controls;
    if (custom !== undefined) {
      const attributes = `id="custom-${id}" class="${question.legacyFreeText ? 'textarea-input' : 'text-input'} custom-input" data-custom="${id}" maxlength="${question.legacyFreeText ? 6000 : 5996}" aria-label="${escape(label)} 직접 입력" placeholder="사용할 기술이나 원하는 방식을 적어 주세요"`;
      const text = escape(question.legacyFreeText && custom.startsWith('기타: ') ? custom.slice(4) : custom.slice(3).trimStart());
      controls += question.legacyFreeText ? `<textarea ${attributes} rows="3">${text}</textarea>` : `<input ${attributes} value="${text}">`;
    }
    if (delegated && drafts[id] !== undefined) controls += `<p class="draft-preserved">추천 요청 전 작성 내용을 보관하고 있어요. <button type="button" class="text-button" data-restore="${id}">이전 답변 복원</button></p>`;
    const selectedGuides = ['single', 'multi'].includes(type) && !delegated && !window.BriefGuides.facts?.[id] ? rawValue.map(option => ({ option, guide: window.BriefGuides.get(question, option) })).filter(item => item.guide) : [];
    if (selectedGuides.length) controls += `<details class="decision-detail" data-detail="fit-${id}"><summary>내 선택의 적합성과 영향을 확인하세요</summary>${selectedGuides.map(({option, guide}) => `<h3>${escape(option)}</h3><dl>${factsMarkup(guide, [['fit','적합한 상황'],['avoid','다른 방식을 검토할 때'],['impact','이후 필요한 결정·작업']])}</dl>`).join('')}</details>`;
    const factual = Boolean(window.BriefGuides.facts?.[id]);
    if (!['architecture', 'architecture_reason'].includes(id) || notes[id]) controls += `<details class="decision-detail" data-detail="note-${id}" ${notes[id] ? 'open' : ''}><summary>${factual ? '작성 근거·확인할 내용 기록하기' : '선택 이유·다시 검토할 때 기록하기'} <span>(선택)</span></summary><label for="note-${id}">${factual ? '작성한 내용의 근거와 확인할 내용' : '내 상황에서 고른 이유와 변경을 검토할 조건'}</label><textarea id="note-${id}" class="textarea-input" rows="2" maxlength="6000" data-note="${id}" placeholder="${factual ? '예: 현재 확인한 값과 추정한 값을 구분하고, 다시 확인할 시점을 적어 주세요.' : '예: 혼자 운영하고 예산이 적어서 선택. 운영 담당자가 늘거나 이용량이 증가하면 다시 검토.'}">${escape(notes[id] || '')}</textarea><p class="question-help">답변을 바꿨다면 이유도 함께 확인해 주세요. 이 기록은 리포트에 포함돼요.</p></details>`;
    return `<fieldset class="question" id="field-${id}"><legend><span class="question-title">${type === 'text' || type === 'textarea' ? `<label for="input-${id}">${escape(label)}</label>` : escape(label)}${required ? '<span class="required-label">핵심</span>' : ''}${type === 'multi' ? '<span class="multi-label">복수 선택</span>' : ''}</span></legend>${hasText(help) ? `<p class="question-help" id="${helpId}">${escape(help)}</p>` : ''}${questionLearning(question)}${question.reuse?.length ? `<div data-reuse-question="${id}">${reusedAnswersMarkup(question)}</div>` : ''}${controls}<div class="question-footer"><span>${!required && ['text', 'textarea', 'featurelist', 'testplan','worksheet'].includes(type) ? `<button type="button" class="uncertain-button ${delegated ? 'selected' : ''}" id="unknown-${id}" data-unknown="${id}">${delegated ? '직접 작성으로 바꾸기' : '아직 몰라요 · AI에게 추천받기'}</button>${helpButton(id, 0, R.UNKNOWN)}` : `<button type="button" class="clear-answer" data-clear="${id}">답변 지우기</button>`}</span><span class="answer-indicator">${answerIndicator(question, value)}</span></div></fieldset>`;
  }
  function renderQuestions() {
    const expanded = new Set([...document.querySelectorAll('.advanced-details[open]')].map(el => el.dataset.group));
    const openDetails = new Set([...document.querySelectorAll('[data-detail][open]')].map(el => el.dataset.detail));
    const groups = R.activeGroups(steps[currentStep], answers);
    $('#question-groups').innerHTML = groups.length ? groups.map((group, index) => {
      const chunks = [];
      for (const question of group.questions) {
        if (question.advanced && chunks.at(-1)?.[0].advanced) chunks.at(-1).push(question);
        else chunks.push([question]);
      }
      const content = chunks.map(chunk => {
        if (!chunk[0].advanced) return questionMarkup(chunk[0]);
        const key = chunk[0].id;
        const done = chunk.filter(q => R.isAnswered(answers[q.id]) && !R.needsReselection(q, answers[q.id])).length;
        return `<details class="advanced-details" data-group="${key}" ${showDetails || expanded.has(key) ? 'open' : ''}><summary>더 꼼꼼하게 정하기 <span>${done} / ${chunk.length}개 답변</span></summary>${chunk.map(questionMarkup).join('')}</details>`;
      }).join('');
      const learning = window.BriefGuides.learning?.[group.title];
      return `<section class="question-group"><div class="group-heading"><span class="group-index">${String(index + 1).padStart(2, '0')}</span><div><h2>${escape(group.title)}</h2>${hasText(group.description) ? `<p>${escape(group.description)}</p>` : ''}</div></div><div class="group-body">${learning ? `<details class="learning-card" data-detail="learn-${escape(group.title)}"><summary>전문가는 무엇을 보고 결정할까요?</summary><dl>${[['why','왜 고민하나요?'],['criteria','무엇을 비교하나요?'],['impact','다음 결정에 어떤 영향을 주나요?']].map(([key,label]) => `<div><dt>${label}</dt><dd>${escape(learning[key])}</dd></div>`).join('')}</dl></details>` : ''}${content}</div></section>`;
    }).join('') : `<div class="empty-state"><h2>지금은 답할 질문이 없어요</h2><p>앞선 답변이 아직 없거나, 현재 선택에 해당하는 질문이 없어요. 아래 고려 사항에서 표시 조건을 확인해 주세요.</p><button type="button" class="button secondary" data-step="0">서비스 형태 확인</button> <button type="button" class="button secondary" data-step="2">기능 선택 확인</button></div>`;
    const inactive = R.inactiveQuestions(steps[currentStep], answers);
    if (inactive.length) $('#question-groups').innerHTML += `<details class="inactive-topics" data-detail="inactive-${currentStep}"><summary>현재 질문에 포함하지 않은 고려 사항 ${inactive.length}개</summary><p>아래 주제도 설계에서 고려하는 항목이에요. 현재 답변이 표시 조건을 충족하지 않아 접어 두었어요. 앞선 답변이 미정이라면 적용 여부도 미정이며, 이전 답변은 보관돼요.</p>${inactive.map(q => `<details><summary>${escape(q.label)}</summary><p>${escape(q.help || q.group)}</p><p class="question-help">판단에 사용한 답변: ${escape(R.conditionSummary(q.conditions, answers))}</p>${[...new Set(q.conditions.flatMap(R.conditionIds))].map(id => `<button type="button" class="text-button" data-jump="${id}">${escape(byId.get(id)?.label || id)} 확인 →</button>`).join(' ')}</details>`).join('')}</details>`;
    document.querySelectorAll('[data-detail]').forEach(el => { if (openDetails.has(el.dataset.detail)) el.open = true; });
  }
  function renderStep(index, focus = false) {
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    isReport = false;
    const step = steps[currentStep];
    $('#form-view').hidden = false;
    $('#report-view').hidden = true;
    $('#breadcrumb').innerHTML = `프로젝트 만들기 <span>/</span> <strong>${escape(step.short)}</strong>`;
    $('#step-badge').textContent = `STEP ${step.icon} / ${steps.length}`;
    $('#page-title').textContent = step.title;
    $('#page-description').textContent = step.description;
    $('#chapter-number').textContent = step.icon;
    $('#step-tip').textContent = step.tip;
    $('#detail-toggle').checked = showDetails;
    $('#previous-button').disabled = currentStep === 0;
    $('#next-button').textContent = currentStep === steps.length - 1 ? '제출하고 리포트 만들기 ↗' : '다음 단계 →';
    renderQuestions();
    updateProgress();
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#main').focus({ preventScroll: true });
      document.querySelector('.step-link.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      save();
    }
  }
  function focusAnswer(field) {
    if (!field) return;
    const control = field.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');
    if (!control) field.setAttribute('tabindex', '-1');
    (control || field).focus({ preventScroll: true });
  }
  function jumpToQuestion(id) {
    const stepIndex = steps.findIndex(step => step.groups.some(group => group.questions.some(q => q.id === id)));
    if (stepIndex < 0) return;
    renderStep(stepIndex, true);
    const field = document.getElementById(`field-${id}`);
    const details = field?.closest('details');
    if (details) details.open = true;
    field?.scrollIntoView({ block: 'center' });
    focusAnswer(field);
  }
  function reviewMarkup(review) {
    return `<section class="readiness-card" aria-labelledby="readiness-title"><div class="readiness-heading"><span class="eyebrow">BEFORE YOU BUILD</span><h2 id="readiness-title">개발 전 확인과 개발 중 결정을 나눴어요</h2><p>빈 답변을 임의로 결정하지 않아요. 미정이어도 리포트는 만들 수 있어요.</p></div>
      <details class="readiness-section" open><summary>개발 전 확인 <strong>${review.before.length}</strong></summary><p>서비스 동작과 데이터·권한에 영향을 주는 결정이에요. 해당 기능을 구현하기 전에 확인하세요.</p>${review.before.length ? `<ul>${review.before.map(item => `<li><button type="button" class="review-link" data-jump="${item.id}">${escape(item.label)} <span aria-hidden="true">↗</span></button><small>${escape(item.reason)}</small></li>`).join('')}</ul>` : '<p class="review-complete">지정된 핵심 항목에 답했어요. 답변의 충분성과 서로 모순되는 내용이 없는지 검토해 주세요.</p>'}</details>
      <details class="readiness-section"><summary>개발 중 결정 <strong>${review.during.length}</strong></summary><p>세부 기술과 설정은 정한 진행 방침에 따라 결정할 수 있어요. 비용·공개 범위·데이터에 영향이 커지면 먼저 확인하세요.</p><ul>${review.during.map(item => `<li><button type="button" class="review-link" data-jump="${item.id}">${escape(item.label)} <span aria-hidden="true">↗</span></button><small>${escape(item.reason)}</small></li>`).join('')}</ul></details></section>`;
  }
  function decisionSummaryMarkup() {
    const items = R.decisionSummary(answers);
    return `<section class="decision-summary"><h2>현재 선택한 방향</h2><p>핵심 결정만 먼저 모았어요. 상세 답변과 미정 사항은 아래에 그대로 담겨요.</p>${items.length ? `<dl>${items.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : '<p>아직 확정해 적은 핵심 결정이 없어요.</p>'}</section>`;
  }
  function renderReport() {
    isReport = true;
    $('#form-view').hidden = true;
    $('#report-view').hidden = false;
    updateProgress();
    const stat = R.stats(answers), warnings = R.issues(answers), review = R.readiness(answers);
    const specification = steps.map(step => {
      const groups = R.reportGroups(step, answers, notes);
      if (!groups.length) return '';
      return `<details class="report-section"><summary>${step.icon}. ${escape(step.short)}</summary><div class="report-section-body">${groups.map(group => `<h3>${escape(group.title)}</h3><dl>${group.questions.map(q => `<div class="report-answer"><dt>${escape(q.label)}</dt><dd>${escape(R.needsReselection(q, answers[q.id]) ? `이전 답변: ${R.display(answers[q.id])} — 재선택 필요, 확정하지 않음` : R.answerText(q, answers))}</dd>${notes[q.id] ? `<dt>선택 이유·재검토 조건</dt><dd>${escape(notes[q.id])}</dd>` : ''}</div>`).join('')}</dl>`).join('')}</div></details>`;
    }).join('');
    $('#report-view').innerHTML = `
      <div class="report-kicker">YOUR DEVELOPMENT BRIEF <span>↗</span></div>
      <h1 id="report-title">${review.before.length ? '개발 전에 확인할 결정이 있어요' : '개발 브리프를 검토해 주세요'}</h1>
      <p class="report-intro">답변을 바탕으로 정리한 문서예요. 미정인 선택은 그대로 남겼어요.<br>전체 명세와 확인할 항목을 AI에게 함께 전달할 수 있어요.</p>
      <div class="summary-name">${escape(R.display(answers.project_name) || '이름 미정 프로젝트')}</div>
      <div class="report-stats"><div class="report-stat"><strong>${stat.answered}<small style="font-size:13px;font-weight:400;color:#6c7d98"> / ${stat.total}</small></strong><span>답변 수 · 추천 요청 포함</span></div><div class="report-stat"><strong>${review.before.length}</strong><span>개발 전 확인</span></div><div class="report-stat"><strong>${review.during.length}</strong><span>개발 중 결정</span></div></div>
      <div class="report-actions"><button type="button" class="button primary" id="copy-prompt">AI 프롬프트 복사 ↗</button><button type="button" class="button secondary" id="download-report">명세서 .md</button><button type="button" class="button secondary" id="download-prompt">프롬프트 .md</button><button type="button" class="button secondary" id="print-report">인쇄 / PDF</button><button type="button" class="button secondary" id="back-to-form">계속 작성</button></div>
      ${warnings.length ? `<div class="warning-card"><h2>개발 전에 확인할 조합 ${warnings.length}건</h2>${warnings.map(w => `<div class="warning-item"><strong>${escape(w.title)}</strong>${escape(w.message)}<br><button class="text-button" data-jump="${w.id}">해당 답변 수정 →</button></div>`).join('')}</div>` : ''}
      ${decisionSummaryMarkup()}
      ${reviewMarkup(review)}
      <div class="pending-card"><p><strong>미응답 ${stat.pending}개 · AI 추천 요청 ${stat.delegated}개 · 이전 답변 재선택 ${stat.recheck}개</strong><br>작성률은 답변 수이며 개발 준비도 점수가 아니에요. 일부만 작성한 기능 명세와 작성표도 위 확인 목록에서 안내해요.</p></div>
      <div class="report-tabs" role="tablist" aria-label="리포트 보기"><button class="report-tab" id="tab-spec" role="tab" aria-controls="panel-spec" data-tab="spec" aria-selected="${reportTab === 'spec'}" tabindex="${reportTab === 'spec' ? '0' : '-1'}">개발 명세서</button><button class="report-tab" id="tab-prompt" role="tab" aria-controls="panel-prompt" data-tab="prompt" aria-selected="${reportTab === 'prompt'}" tabindex="${reportTab === 'prompt' ? '0' : '-1'}">AI 전달 프롬프트</button></div>
      <div id="panel-spec" role="tabpanel" aria-labelledby="tab-spec" ${reportTab === 'spec' ? '' : 'hidden'}>${specification || '<p class="report-note">작성한 답변이 생기면 이곳에 명세를 정리해요. 아직 정하지 않은 항목은 위 확인 목록에 있어요.</p>'}</div>
      <div id="panel-prompt" role="tabpanel" aria-labelledby="tab-prompt" ${reportTab === 'prompt' ? '' : 'hidden'}><textarea readonly class="report-code" id="prompt-text" aria-label="AI에게 전달할 전체 개발 프롬프트"></textarea></div>
      <p class="report-note">답변을 문서로 정리한 결과이며 AI 모델의 자동 분석은 아니에요. 현재 조건에 해당하지 않는 질문의 이전 답변은 보관하되 리포트에서는 제외해요. 개발 전 확인 목록은 중요한 결정의 점검표이며 전체 품질을 보증하지 않아요.</p>`;
    $('#prompt-text').value = R.report(answers, true, notes);
    $('#step-tip').textContent = '개발 전 확인을 먼저 살펴보세요. 정하지 못한 항목이 있어도 리포트를 내려받아 AI와 함께 결정할 수 있어요.';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function download(content, extension, suffix) {
    const name = (R.display(answers.project_name) || 'buildbrief').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 70);
    const blob = new Blob([content], { type: extension === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name}-${suffix}.${extension}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyPrompt() {
    const text = R.report(answers, true, notes);
    try { await navigator.clipboard.writeText(text); toast('전체 AI 개발 프롬프트를 복사했어요.'); }
    catch {
      reportTab = 'prompt';
      renderReport();
      $('#prompt-text').focus();
      $('#prompt-text').select();
      toast('자동 복사가 제한됐어요. 선택된 내용을 Ctrl+C 또는 길게 눌러 복사해 주세요.');
    }
  }
  $('#question-form').addEventListener('input', event => {
    const target = event.target;
    if (target.dataset.worksheet) {
      const id = target.dataset.worksheet, question = byId.get(id);
      if (question?.type !== 'worksheet') return;
      const old = R.worksheetPlan(question, answers[id]);
      const plan = { ...old, rows: [...old.rows] };
      if (target.dataset.worksheetLegacy) plan.legacy = target.value;
      else {
        const index = Number(target.dataset.row);
        if (!Number.isInteger(index) || index < 0 || index >= R.MAX_WORKSHEET_ROWS || !question.fields.some(f => f.id === target.dataset.part)) return;
        plan.rows[index] = { ...plan.rows[index], [target.dataset.part]: target.value };
      }
      setAnswer(id, plan);
    } else if (target.dataset.note) {
      if (target.value.trim()) notes[target.dataset.note] = target.value;
      else delete notes[target.dataset.note];
      save();
    } else if (target.dataset.testField || target.dataset.testLegacy) {
      const plan = currentTestPlan();
      if (target.dataset.testLegacy) plan.legacy = target.value;
      else {
        const index = Number(target.dataset.testFlow);
        if (!plan.flows[index] || !testFlowFields.some(field => field.id === target.dataset.testField)) return;
        plan.flows[index] = { ...plan.flows[index], [target.dataset.testField]: target.value };
        if (target.dataset.testField === 'name') {
          const title = document.getElementById(`test-flow-title-${index}`);
          if (title) title.textContent = target.value || `연결 흐름 ${index + 1}`;
        }
      }
      setAnswer('critical_tests', plan);
    } else if (target.dataset.featureField) {
      const index = Number(target.dataset.featureIndex);
      const rows = Array.isArray(answers.feature_specs) ? answers.feature_specs : [];
      if (rows[index] && featureFields.some(field => field.id === target.dataset.featureField)) {
        rows[index] = { ...rows[index], [target.dataset.featureField]: target.value };
        setAnswer('feature_specs', rows);
      }
    } else if (target.dataset.custom) {
      const id = target.dataset.custom;
      const custom = `기타: ${target.value}`;
      const value = byId.get(id).type === 'multi' ? [...(answers[id] || []).filter(v => !v.startsWith('기타:')), custom] : custom;
      setAnswer(id, value, conditionDependencies.has(id), event.isComposing);
    } else if (target.dataset.question && ['text', 'textarea'].includes(byId.get(target.dataset.question).type)) setAnswer(target.dataset.question, target.value);
  });
  $('#question-form').addEventListener('compositionend', event => {
    const id = event.target.dataset.custom;
    if (id) {
      const custom = `기타: ${event.target.value}`;
      const value = byId.get(id).type === 'multi' ? [...(answers[id] || []).filter(v => !v.startsWith('기타:')), custom] : custom;
      setAnswer(id, value, true);
    }
  });
  $('#question-form').addEventListener('change', event => {
    const target = event.target, id = target.dataset.question;
    if (target.dataset.testBasis !== undefined) {
      const basis = testBasisOptions[Number(target.dataset.testBasis)];
      if (basis) setAnswer('critical_tests', { ...currentTestPlan(), basis }, true);
      return;
    }
    if (!id) return;
    const q = byId.get(id);
    if (!['single', 'multi'].includes(q.type)) return;
    const raw = target.value;
    if (q.type === 'single') {
      setAnswer(id, raw === '직접 입력' ? '기타: ' : raw, true);
    } else {
      const exclusive = R.EXCLUSIVE;
      const old = Array.isArray(answers[id]) ? answers[id] : [];
      let value;
      if (target.checked && exclusive.includes(raw)) value = [raw];
      else if (target.checked) value = [...old.filter(v => !exclusive.includes(v)), raw === '직접 입력' ? '기타: ' : raw];
      else value = old.filter(v => raw === '직접 입력' ? !v.startsWith('기타:') : v !== raw);
      setAnswer(id, value, true);
    }
    if (raw === '직접 입력') document.getElementById(`custom-${id}`)?.focus();
  });
  $('#question-form').addEventListener('submit', event => {
    event.preventDefault();
    if (currentStep < steps.length - 1) return renderStep(currentStep + 1, true);
    renderReport(); $('#report-title').setAttribute('tabindex', '-1'); $('#report-title').focus({ preventScroll: true });
  });
  $('#detail-toggle').addEventListener('change', event => {
    showDetails = event.target.checked;
    document.querySelectorAll('.advanced-details').forEach(details => { details.open = showDetails; });
    save();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'save-help-button') return $('#storage-help-dialog').showModal();
    if (button.id === 'close-storage-help') return $('#storage-help-dialog').close();
    if (button.dataset.helpQuestion) return showOptionHelp(button.dataset.helpQuestion, Number(button.dataset.helpIndex));
    if (button.id === 'close-option-help') return $('#option-help-dialog').close();
    if (button.dataset.addWorksheet) {
      const id = button.dataset.addWorksheet, q = byId.get(id);
      if (q?.type !== 'worksheet' || q.repeatable === false) return;
      const plan = R.worksheetPlan(q, answers[id]), rows = plan.rows.length ? plan.rows : [{}];
      if (rows.length >= R.MAX_WORKSHEET_ROWS) return;
      setAnswer(id, { ...plan, rows: [...rows, {}] }, true);
      document.getElementById(`worksheet-${id}-${rows.length}-${q.fields[0].id}`)?.focus();
    }
    if (button.dataset.removeWorksheet) {
      const id = button.dataset.removeWorksheet, q = byId.get(id), index = Number(button.dataset.row);
      if (q?.type !== 'worksheet') return;
      const plan = R.worksheetPlan(q, answers[id]), row = plan.rows[index];
      if (row && (!Object.values(row).some(R.isAnswered) || window.confirm('이 작성표 항목을 지울까요?'))) {
        setAnswer(id, { ...plan, rows: plan.rows.filter((_, i) => i !== index) }, true);
        focusAnswer(document.getElementById(`field-${id}`));
      }
    }
    if (button.dataset.step !== undefined) renderStep(Number(button.dataset.step), true);
    if (button.dataset.jump) jumpToQuestion(button.dataset.jump);
    if (button.dataset.unknown) {
      const id = button.dataset.unknown;
      setAnswer(id, R.isUnknown(answers[id]) ? drafts[id] ?? '' : R.UNKNOWN, true);
    }
    if (button.dataset.restore) {
      const id = button.dataset.restore;
      if (drafts[id] !== undefined) {
        setAnswer(id, drafts[id], true);
        focusAnswer(document.getElementById(`field-${id}`));
      }
    }
    if (button.id === 'add-feature') {
      const rows = Array.isArray(answers.feature_specs) ? answers.feature_specs : Array.isArray(drafts.feature_specs) ? drafts.feature_specs : [];
      if (rows.length < R.MAX_FEATURES) { setAnswer('feature_specs', [...rows, {}], true); document.getElementById(`feature-${rows.length}-name`)?.focus(); }
    }
    if (button.id === 'add-test-flow') {
      const plan = currentTestPlan();
      if (plan.flows.length < R.MAX_TEST_FLOWS) {
        const index = plan.flows.length;
        setAnswer('critical_tests', { ...plan, basis: testBasisOptions[1], flows: [...plan.flows, {}] }, true);
        document.getElementById(`test-flow-${index}-name`)?.focus();
      }
    }
    if (button.dataset.removeTestFlow !== undefined) {
      const plan = currentTestPlan(), index = Number(button.dataset.removeTestFlow);
      if (plan.flows[index] && (!testFlowFields.some(field => R.isAnswered(plan.flows[index][field.id])) || window.confirm('이 연결 흐름을 삭제할까요?'))) {
        setAnswer('critical_tests', { ...plan, flows: plan.flows.filter((_,i) => i !== index) }, true);
        $('#add-test-flow')?.focus();
      }
    }
    if (button.dataset.removeFeature !== undefined) {
      const index = Number(button.dataset.removeFeature);
      const rows = answers.feature_specs;
      if (Array.isArray(rows) && rows[index] && (!R.isAnswered(rows[index]) || window.confirm('이 기능 명세를 지울까요?'))) {
        setAnswer('feature_specs', rows.filter((_, i) => i !== index), true);
        $('#add-feature')?.focus();
      }
    }
    if (button.dataset.clear) { delete drafts[button.dataset.clear]; setAnswer(button.dataset.clear, '', true); }
    if (button.dataset.tab) {
      reportTab = button.dataset.tab;
      document.querySelectorAll('.report-tab').forEach(tab => { const selected = tab.dataset.tab === reportTab; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
      $('#panel-spec').hidden = reportTab !== 'spec';
      $('#panel-prompt').hidden = reportTab !== 'prompt';
    }
    if (button.id === 'report-button') { renderReport(); $('#report-title').setAttribute('tabindex', '-1'); $('#report-title').focus({ preventScroll: true }); }
    if (button.id === 'previous-button') renderStep(currentStep - 1, true);
    if (button.id === 'back-to-form') renderStep(currentStep, true);
    if (button.id === 'copy-prompt') copyPrompt();
    if (button.id === 'download-report') download(R.report(answers, false, notes), 'md', '개발명세서');
    if (button.id === 'download-prompt') download(R.report(answers, true, notes), 'md', 'AI프롬프트');
    if (button.id === 'print-report') {
      const spec = $('#panel-spec'), prompt = $('#panel-prompt');
      const opened = [...document.querySelectorAll('.report-section, .readiness-section')].map(el => [el, el.open]);
      spec.hidden = false; prompt.hidden = true;
      opened.forEach(([el]) => { el.open = true; });
      const restore = () => { opened.forEach(([el, open]) => { el.open = open; }); spec.hidden = reportTab !== 'spec'; prompt.hidden = reportTab !== 'prompt'; };
      window.addEventListener('afterprint', restore, { once: true });
      window.print();
    }
    if (button.id === 'export-answers' || button.id === 'storage-backup') download(JSON.stringify({ format: 'buildbrief', version: 1, exportedAt: new Date().toISOString(), answers, drafts, notes }, null, 2), 'json', '답변백업');
    if (button.id === 'import-answers') $('#import-file').click();
    if (button.id === 'reset-button') $('#reset-dialog').showModal();
    if (button.id === 'cancel-reset') $('#reset-dialog').close();
    if (button.id === 'confirm-reset') {
      answers = {}; drafts = {}; notes = {}; currentStep = 0; showDetails = false; externalChange = false;
      save(); $('#reset-dialog').close(); renderStep(0, true); toast('새 프로젝트를 시작해요.');
    }
  });
  document.addEventListener('keydown', event => {
    if (!event.target.matches('.report-tab') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === 'Home' ? $('#tab-spec') : event.key === 'End' ? $('#tab-prompt') : event.target.id === 'tab-spec' ? $('#tab-prompt') : $('#tab-spec');
    tab.click(); tab.focus();
  });
  $('.brand').addEventListener('click', event => { event.preventDefault(); renderStep(0, true); });
  $('#help-option').addEventListener('change', event => showOptionHelp($('#option-help-dialog').dataset.question, Number(event.target.value), false));
  $('#help-compare').addEventListener('change', event => showOptionHelp($('#option-help-dialog').dataset.question, Number($('#help-option').value), false, Number(event.target.value)));
  $('#import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('백업 파일은 64MB 이하만 불러올 수 있어요.');
      const imported = JSON.parse(await file.text());
      if (imported.format !== 'buildbrief' || imported.version !== 1) throw new Error('빌드브리프 답변 백업 파일을 선택해 주세요.');
      const normalized = R.normalizeAnswers(imported.answers);
      const importedDrafts = R.normalizeAnswers(imported.drafts || {});
      const importedNotes = R.normalizeNotes(imported.notes);
      if (Object.keys(imported.answers).length && !Object.keys(normalized).length) throw new Error('사용할 수 있는 답변이 없는 백업 파일이에요.');
      if (Object.keys(answers).length && !window.confirm('현재 답변을 백업 파일의 내용으로 바꿀까요? 기존 답변은 덮어써져요.')) return;
      answers = normalized; drafts = importedDrafts; notes = importedNotes; currentStep = 0; externalChange = false;
      save(); renderStep(0, true); toast('백업에서 답변을 불러왔어요.');
    } catch (error) { toast(error instanceof SyntaxError ? 'JSON 형식이 올바르지 않아요. 백업 파일을 확인해 주세요.' : error.message); }
    finally { event.target.value = ''; }
  });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      externalChange = true;
      updateSaveStatus('다른 탭 변경 감지 · 백업 후 새로고침');
      toast('다른 탭의 답변을 덮어쓰지 않도록 자동 저장을 멈췄어요. 이 탭의 답변을 백업한 뒤 새로고침해 주세요.');
    }
  });
  renderStep(currentStep);
  if (!storageWorking) { updateSaveStatus('자동 저장을 확인할 수 없어요'); toast('자동 저장이 제한되었거나 저장된 답변을 읽지 못했어요. 답변 백업을 이용해 주세요.'); }
})();
