(() => {
  'use strict';
  const { steps, featureFields, testBasisOptions, testFlowFields } = window.BriefQuestions;
  const R = window.BriefReport;
  const P = window.BriefProjects;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let answers = {}, drafts = {}, notes = {}, currentStep = 0, currentTopic = '', reportTab = 'spec', isReport = false;
  let storageWorking = true, externalChange = false, loadFailed = false, originalStorage = null, toastTimer;
  const initialProject = P.createProject();
  let workspace = { version: 1, activeId: initialProject.id, projects: [initialProject] };
  let storedRaw = null, legacyAtLoad = null;
  try {
    storedRaw = originalStorage = localStorage.getItem(P.KEY);
    if (storedRaw !== null) workspace = P.normalizeWorkspace(JSON.parse(storedRaw));
    else {
      legacyAtLoad = originalStorage = localStorage.getItem(P.LEGACY_KEY);
      if (legacyAtLoad !== null) workspace = P.fromLegacy(JSON.parse(legacyAtLoad));
    }
  } catch { storageWorking = false; loadFailed = true; }
  activateProject();
  const conditionDependencies = new Set(steps.flatMap(s => s.groups.flatMap(g => [g.when, ...g.questions.map(q => q.when)].flatMap(R.conditionIds))));
  const byId = new Map(R.allQuestions.map(q => [q.id, q]));
  const priorityQuestion = { id: 'feature_priority', label: '이 기능은 언제 필요한가요?', options: featureFields.find(f => f.id === 'priority').options };
  const testBasisQuestion = { id: 'test_basis', label: '여러 기능을 잇는 별도 흐름이 필요한가요?', options: testBasisOptions };
  const helpButton = (id, index, label) => label === R.UNKNOWN ? '' : `<button type="button" class="option-help" data-help-question="${id}" data-help-index="${index}" aria-label="${escape(label)} 설명" aria-haspopup="dialog" aria-controls="option-help-dialog"><span aria-hidden="true">?</span></button>`;
  const guideFields = [['meaning', '어떤 방식인가요?'], ['example', '실제로는 이렇게 동작해요'], ['pros', '얻는 점'], ['cons', '감수할 점'], ['fit', '이럴 때 검토하세요'], ['avoid', '다른 방식을 검토할 때'], ['impact', '선택하면 이어서 할 일'], ['cost', '비용을 좌우하는 것'], ['effort', '구현할 때 준비할 것'], ['operations', '운영하면서 맡을 일']];
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const factsMarkup = (guide, fields) => fields.filter(([key], index) => hasText(guide[key]) && !fields.slice(0,index).some(([previous]) => guide[previous]?.trim() === guide[key].trim())).map(([key, label]) => `<div class="help-fact"><dt>${label}</dt><dd>${escape(guide[key])}</dd></div>`).join('');
  const guideSource = guide => guide.source && /^https:\/\//.test(guide.source) ? `<a class="help-source" href="${escape(guide.source)}" target="_blank" rel="noopener noreferrer">공식 설명 더 보기 ↗</a>` : '';
  function decisionAdviceMarkup(advice) {
    if (!advice) return '';
    return `${advice.basis.length ? `<section class="related-decisions"><h3>이 선택과 관련된 내 답변</h3><dl>${advice.basis.map(item => `<div class="help-fact"><dt><button type="button" class="text-button" data-jump="${item.id}">${escape(item.label)} →</button></dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl></section>` : ''}${advice.missing.length ? `<section class="related-decisions"><h3>먼저 정리하면 선택에 도움이 되는 질문</h3>${advice.missing.map(item => `<button type="button" class="text-button" data-jump="${item.id}">${escape(item.label)} →</button>`).join('')}</section>` : ''}<dl>${factsMarkup(advice, [['note','비교할 때 유의할 점'],['verify','선택 후 확인할 일']])}</dl>${advice.candidates.length ? '<p class="question-help">선택지의 ‘비교 후보’와 ‘조건 확인’은 작성한 답변을 바탕으로 한 안내예요. 자동으로 선택하거나 적합성을 검증한 결과는 아니에요.</p>' : ''}`;
  }
  function draftMarkup(question) {
    const draft = R.suggestedDraft(question.id, answers);
    if (!draft || R.isAnswered(answers[question.id])) return '';
    return `<div class="draft-proposal"><strong>이미 적은 내용으로 시작하기</strong><p>${escape(draft.explanation)}</p><details><summary>가져올 초안 확인</summary><pre>${escape(R.display(draft.value))}</pre></details><button type="button" class="button secondary" data-use-draft="${question.id}">${question.id === 'deliverables' ? '문서 후보 선택하기' : '이 초안을 가져와 보완하기'}</button><p class="question-help">가져온 뒤에는 별도로 편집해요. 원본 답변이 바뀌어도 작성한 초안을 자동으로 덮어쓰지 않아요.</p></div>`;
  }
  function showOptionHelp(id, index, open = true, compareIndex = -1) {
    const q = id === priorityQuestion.id ? priorityQuestion : id === testBasisQuestion.id ? testBasisQuestion : byId.get(id);
    if (!q) return;
    const options = [priorityQuestion.id, testBasisQuestion.id].includes(id) ? q.options : R.choiceOptions(q);
    const option = options[index];
    const guide = window.BriefGuides.get(q, option);
    if (!guide) return;
    const dialog = $('#option-help-dialog');
    $('#help-browse').hidden = false;
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
  function showQuestionGuide(id, groupTitle) {
    const question = byId.get(id), group = steps.flatMap(step => step.groups).find(group => group.title === groupTitle);
    if (!question && !group) return;
    const dialog = $('#option-help-dialog');
    dialog.classList.remove('comparing');
    $('#help-browse').hidden = true;
    $('#help-context').textContent = question ? '질문 도움말' : '주제 도움말';
    $('#help-title').textContent = question?.label || group.title;
    const learning = question ? window.BriefGuides.questions[id] : window.BriefGuides.learning[group.title];
    const fact = question && window.BriefGuides.facts?.[id];
    const guide = { ...learning, ...fact, meaning: fact?.meaning || learning.why };
    const active = new Set(R.activeQuestions(answers).map(q => q.id));
    const advice = question ? R.decisionAdvice(question, answers) : null;
    const related = (learning.related || []).filter(id => active.has(id) && ![...(advice?.basis || []), ...(advice?.missing || [])].some(item => item.id === id));
    $('#help-content').innerHTML = `<dl>${factsMarkup(guide, [['meaning','무엇을 정하나요?'],['why','왜 고민하나요?'],['criteria','무엇을 보고 판단하나요?'],['example','예를 들어'],['impact','다음 설계에 미치는 영향']])}</dl>${!fact && learning.prompts?.length ? `<div class="writing-guide"><h3>이 순서로 적어 보세요</h3><ol>${learning.prompts.map(text => '<li>' + escape(text) + '</li>').join('')}</ol></div>` : ''}${decisionAdviceMarkup(advice)}${related.length ? `<div class="related-decisions"><h3>함께 살펴볼 질문</h3>${related.map(id => `<button type="button" class="text-button" data-jump="${id}">${escape(byId.get(id).label)} →</button>`).join('')}</div>` : ''}`;
    dialog.showModal();
  }
  function updateSaveStatus(message) {
    $('#save-status').textContent = message;
    $('#storage-help-status').textContent = message;
    $('#storage-help-warning').hidden = storageWorking && !externalChange;
    $('#save-help-button').dataset.attention = String(!storageWorking || externalChange);
    $('#save-help-button').setAttribute('aria-label', `${message} · 저장 안내 열기`);
    $('#storage-help-dialog').dataset.attention = String(!storageWorking || externalChange);
    $('#storage-original').hidden = !loadFailed || originalStorage === null;
  }
  function collectWorkspace() {
    return { ...workspace, projects: workspace.projects.map(project => project.id === workspace.activeId
      ? { ...project, answers, drafts, notes, step: currentStep, topic: currentTopic }
      : project) };
  }
  function activateProject() {
    const project = workspace.projects.find(item => item.id === workspace.activeId);
    ({ answers, drafts, notes } = project);
    currentStep = project.step;
    currentTopic = project.topic || '';
    reportTab = 'spec';
  }
  function save(next = collectWorkspace(), recover = false) {
    if (loadFailed && !recover) {
      updateSaveStatus(originalStorage === null ? '저장 공간 확인 불가 · 자동 저장 중지' : '기존 답변 읽기 실패 · 원본 보존 중');
      return false;
    }
    try {
      // ponytail: 다른 탭 변경은 전체 저장을 잠근다. 동시 편집이 필요해지면 프로젝트별 병합을 도입한다.
      if (externalChange || localStorage.getItem(P.KEY) !== storedRaw ||
          (storedRaw === null && localStorage.getItem(P.LEGACY_KEY) !== legacyAtLoad)) {
        externalChange = true;
        updateSaveStatus('다른 탭 변경 감지 · 백업 후 새로고침');
        return false;
      }
      next = { ...next, projects: next.projects.map(project => project.id === workspace.activeId ? { ...project, updatedAt: new Date().toISOString() } : project) };
      const raw = JSON.stringify(next);
      localStorage.setItem(P.KEY, raw);
      workspace = next;
      storedRaw = raw;
      storageWorking = true;
      if (recover) { loadFailed = false; originalStorage = null; }
      updateSaveStatus('이 브라우저에 저장됨');
      return true;
    } catch {
      storageWorking = false;
      updateSaveStatus('저장 불가 · 답변을 백업해 주세요');
      return false;
    }
  }
  function commitProjects(next, recover = false) {
    if (!save(next, recover)) {
      const message = '저장하지 못해 프로젝트를 바꾸지 않았어요. 이 창을 닫고 저장 안내를 확인한 뒤 현재 답변을 백업해 주세요.';
      $('#project-name-error').textContent = message;
      $('#delete-project-error').textContent = message;
      $('#projects-error').textContent = message;
      toast(message);
      return false;
    }
    activateProject();
    renderStep(currentStep);
    window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }
  function updateProjectPicker() {
    $('#project-select').innerHTML = workspace.projects.map(project => `<option value="${project.id}">${escape(P.projectTitle(project))}</option>`).join('');
    $('#project-select').value = workspace.activeId;
  }
  function renderProjects() {
    $('#project-list').innerHTML = collectWorkspace().projects.map(project => {
      const stat = R.requirementStats(project.answers), active = project.id === workspace.activeId;
      return `<section class="project-item" ${active ? 'aria-current="true"' : ''}><div class="project-item-info"><strong>${escape(P.projectTitle(project))}</strong><p>${active ? '작성 중 · ' : ''}요구사항 ${stat.confirmed}/${stat.total}개 정리 (${stat.percent}%)</p><p>최근 저장 ${escape(new Date(project.updatedAt).toLocaleString('ko-KR'))}</p></div><div class="project-item-actions"><button type="button" class="button secondary small" data-project-open="${project.id}">${active ? '계속 작성' : '열기'}</button><button type="button" class="text-button" data-project-rename="${project.id}">이름 변경</button><button type="button" class="text-button" data-project-backup="${project.id}">백업</button><button type="button" class="text-button danger-text" data-project-delete="${project.id}">삭제</button></div></section>`;
    }).join('');
  }
  function openProjectName(id = '') {
    const project = workspace.projects.find(item => item.id === id);
    if (id && !project) return;
    $('#project-name-dialog').dataset.project = id;
    $('#project-name-error').textContent = '';
    $('#project-name-title').textContent = id ? '프로젝트 이름 변경' : '새 프로젝트 만들기';
    $('#project-name-description').textContent = id ? '질문지의 프로젝트 이름에도 함께 반영돼요. 답변과 메모는 그대로 유지돼요.' : '기존 프로젝트는 그대로 두고, 새 프로젝트를 추가해요. 이름은 나중에 바꿀 수 있어요.';
    $('#project-name-form button[type="submit"]').textContent = id ? '이름 변경' : '프로젝트 만들기';
    $('#project-name').value = project ? R.display(project.answers.project_name) : '';
    $('#project-name-dialog').showModal();
    $('#project-name').focus();
  }
  function openProject(id) {
    if (!workspace.projects.some(project => project.id === id)) return false;
    return commitProjects({ ...collectWorkspace(), activeId: id });
  }
  function backupProject(id = workspace.activeId) {
    const project = collectWorkspace().projects.find(item => item.id === id);
    if (!project) return;
    const { answers, drafts, notes, step, topic } = project;
    download(JSON.stringify({ format: 'buildbrief', version: 1, exportedAt: new Date().toISOString(), step, topic, answers, drafts, notes }, null, 2), 'json', '답변백업', P.projectTitle(project));
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
        const clear = field.querySelector('[data-clear]');
        if (clear) clear.hidden = !R.isAnswered(value);
      }
    }
  }
  function updateProgress() {
    const stat = R.requirementStats(answers);
    $('#progress-number').textContent = `${stat.percent}%`;
    $('#progress-bar').style.width = `${stat.percent}%`;
    const progressText = `요구사항 ${stat.total}개 중 ${stat.confirmed}개 정리`;
    $('#progress-caption').textContent = progressText;
    $('#progress-bar').setAttribute('aria-valuenow', String(stat.percent));
    $('#progress-bar').setAttribute('aria-valuetext', progressText);
    $('#progress-breakdown').innerHTML = [['정리한 요구사항', stat.confirmed], ['남은 요구사항', stat.pending], ['기술 검토 항목', stat.design], ['기술 선택 기록', stat.designSelected]].map(([label,count]) => `<div><dt>${label}</dt><dd>${count}개</dd></div>`).join('');
    $('#progress-scope').textContent = '작성률은 요구사항 정리 현황이에요. 기술명 선택은 별도로 검토하며, 선택하지 않아도 문서에 검토 항목으로 남아요. 추천 요청·초안·미정은 정리 완료로 세지 않아요.';
    $('#project-label').textContent = R.display(answers.project_name) || '새로운 아이디어';
    updateProjectPicker();
    $('#step-nav').innerHTML = steps.map((step, index) => {
      const qs = R.activeGroups(step, answers).flatMap(g => g.questions).filter(q => !q.supplemental);
      const done = qs.filter(q => R.isResolved(q, answers)).length;
      const complete = qs.length > 0 && done === qs.length;
      return `${index === 0 || steps[index - 1].phase !== step.phase ? `<p class="nav-phase">${escape(step.phase)}</p>` : ''}<button type="button" class="step-link ${!isReport && index === currentStep ? 'active' : ''} ${complete ? 'complete' : ''} ${qs.length ? '' : 'inactive-step'}" data-step="${index}" ${!isReport && index === currentStep ? 'aria-current="step"' : ''}><span class="step-index">${complete ? '✓' : step.icon}</span><span>${step.short}</span>${step.phase === '설계 검토' ? '' : `<span class="nav-count">${qs.length ? `${done}/${qs.length}` : '적용 확인'}</span>`}</button>`;
    }).join('');
    $('#mobile-progress').textContent = `요구사항 ${stat.confirmed}/${stat.total} 정리`;
    updateTopicNavigation();
  }
  function updateTopicNavigation() {
    const groups = R.activeGroups(steps[currentStep], answers), index = Math.max(0,groups.findIndex(group => group.title === currentTopic));
    const current = groups[index]?.questions.filter(q => !q.supplemental) || [];
    const requirements = current.filter(q => q.kind !== 'design');
    const done = requirements.filter(q => R.isResolved(q,answers)).length;
    $('#topic-position').textContent = groups.length ? `${index+1} / ${groups.length} 주제` : '관련 주제 없음';
    $('#step-summary').textContent = requirements.length ? `요구사항 ${done}/${requirements.length} 정리` : current.length ? '' : '선행 답변을 확인해 주세요';
    $('#previous-button').disabled = currentStep === 0 && index === 0;
    $('#previous-button').textContent = index > 0 ? '← 이전 주제' : '← 이전 단계';
    $('#next-button').textContent = index < groups.length-1 ? '다음 주제 →' : currentStep < steps.length-1 ? '다음 단계 →' : '리포트 보기 →';
  }
  function setNavigation(open) {
    $('#sidebar').dataset.open = String(open);
    $('#toggle-navigation').setAttribute('aria-expanded',String(open));
  }
  function moveTopic(direction) {
    const groups = R.activeGroups(steps[currentStep],answers), index = Math.max(0,groups.findIndex(group => group.title === currentTopic));
    if (groups[index+direction]) return renderStep(currentStep,true,groups[index+direction].title);
    const next = currentStep+direction;
    if (next >= 0 && next < steps.length) return renderStep(next,true,direction < 0 ? R.activeGroups(steps[next],answers).at(-1)?.title : '');
    if (direction > 0) { renderReport(); $('#report-title').setAttribute('tabindex','-1'); $('#report-title').focus({preventScroll:true}); }
  }
  function worksheetMarkup(question, value) {
    if (R.isUnknown(value)) return '<p class="question-help">이 항목은 AI와 함께 정할 내용으로 남겼어요.</p>';
    const plan = R.worksheetPlan(question, value), rows = plan.rows.length ? plan.rows : [{}];
    return `<div class="worksheet"><p class="worksheet-intro">${escape(question.worksheetIntro || '대상별로 나누어 적으세요. 모르는 칸은 미정으로 남겨도 돼요.')}</p>${rows.map((row,index) => `<section class="worksheet-row"><div class="worksheet-heading"><h3>${escape(question.rowLabel || '항목')} ${index + 1}</h3>${plan.rows.length > 1 ? `<button type="button" class="text-button" data-remove-worksheet="${question.id}" data-row="${index}">이 항목 지우기</button>` : ''}</div><div class="worksheet-fields">${question.fields.map(field => `<div><label for="worksheet-${question.id}-${index}-${field.id}">${escape(field.label)}${field.required === false ? ' (선택)' : ''}</label><textarea class="textarea-input" rows="2" id="worksheet-${question.id}-${index}-${field.id}" data-worksheet="${question.id}" data-row="${index}" data-part="${field.id}" maxlength="6000" placeholder="${escape(field.placeholder || '아직 정하지 못했다면 미정')}">${escape(row[field.id] || '')}</textarea></div>`).join('')}</div></section>`).join('')}${question.repeatable !== false ? `<button type="button" class="button secondary" data-add-worksheet="${question.id}" ${rows.length >= R.MAX_WORKSHEET_ROWS ? 'disabled' : ''}>+ ${escape(question.rowLabel || '항목')} 추가</button>` : ''}${Object.hasOwn(plan,'legacy') ? `<details class="worksheet-legacy" data-detail="legacy-${question.id}" open><summary>기존 자유 작성 내용</summary><p>이전 내용을 그대로 보관했어요. 위 작성표는 필요한 부분부터 보완하세요.</p><label for="worksheet-${question.id}-legacy">기존 답변</label><textarea class="textarea-input" rows="3" id="worksheet-${question.id}-legacy" data-worksheet="${question.id}" data-worksheet-legacy="true" maxlength="${question.maxLength || 6000}">${escape(plan.legacy)}</textarea></details>` : ''}</div>`;
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
      <div class="test-checks"><p>각 기능의 <strong>정상 결과·실패 처리·완료 조건</strong>을 확인하고, 사용자·역할과 접근 규칙에 맞는 <strong>허용·차단</strong>도 검증해요. 데이터가 바뀌는 기능은 중복 요청과 중간 실패 시 데이터가 어긋나지 않는지도 확인해요.</p><details data-detail="test-permissions"><summary>이미 적은 권한 기준 확인</summary>${['role_matrix','access_rules','authorization_tests'].map(id => `<p><strong>${escape(byId.get(id).label)}</strong><br>${escape(R.isAnswered(answers[id]) ? R.display(answers[id]) : byId.get(id).supplemental ? '추가로 적은 내용 없음 — 기본 권한표를 참고하세요.' : '미정 — 사용자 이름이나 역할만으로 권한을 추측하지 않아요.')}</p><button type="button" class="text-button" data-jump="${id}">이 기준 수정 →</button>`).join('')}</details></div>
      ${delegated ? '<p class="question-help">추가 흐름이 필요한지 AI와 정할 항목으로 남겼어요. 위 기능 명세의 검증 기준은 계속 참고할 수 있어요.</p>' : `<fieldset class="test-basis"><legend>여러 기능을 잇는 별도 흐름이 필요한가요?</legend><p class="question-help">예를 들어 ‘주문 생성 → 결제 → 취소’는 각 기능이 따로 성공해도 서로 연결했을 때 문제가 날 수 있어요. 이런 흐름만 추가하면 돼요.</p><div class="choices">${testBasisOptions.map((option,index) => `<div class="choice-shell"><label class="choice"><input id="test-basis-${index}" type="radio" name="test-basis" data-test-basis="${index}" ${plan.basis === option ? 'checked' : ''}><span>${escape(option)}</span></label>${helpButton('test_basis',index,option)}</div>`).join('')}</div></fieldset>
      ${plan.basis === testBasisOptions[1] ? `<div class="test-flows">${plan.flows.map((row,index) => `<details class="test-flow" data-detail="test-flow-${index}" ${testFlowFields.every(field => !row[field.id]) ? 'open' : ''}><summary id="test-flow-title-${index}">${escape(row.name || `연결 흐름 ${index + 1}`)}</summary><div class="test-flow-body">${testFlowFields.map(field => `<label for="test-flow-${index}-${field.id}">${escape(field.label)}</label><textarea id="test-flow-${index}-${field.id}" class="textarea-input" rows="2" maxlength="6000" data-test-flow="${index}" data-test-field="${field.id}" placeholder="${escape(field.placeholder)}">${escape(row[field.id] || '')}</textarea>`).join('')}<button type="button" class="text-button" data-remove-test-flow="${index}">이 흐름 삭제</button></div></details>`).join('')}<button type="button" class="button secondary" id="add-test-flow" ${plan.flows.length >= R.MAX_TEST_FLOWS ? 'disabled' : ''}>+ 연결 흐름 추가</button><p class="question-help">중요한 연결 흐름을 하나씩 추가하세요. ${plan.flows.length}개 작성 중 · 최대 ${R.MAX_TEST_FLOWS}개</p></div>` : plan.flows.length ? '<p class="question-help">이전에 작성한 연결 흐름은 보관하고 있어요. 현재 리포트에서는 제외하며, 추가 옵션을 다시 선택하면 복원돼요.</p>' : ''}
      ${Object.hasOwn(plan,'legacy') ? `<details class="test-legacy" data-detail="test-legacy" open><summary>이전에 작성한 검증 내용</summary><p class="question-help">기존 내용을 그대로 보관했어요. 필요하면 연결 흐름으로 나누거나 이곳에서 보완하세요. 리포트에도 함께 포함돼요.</p><label for="test-legacy">기존 검증 요구</label><textarea id="test-legacy" class="textarea-input" rows="3" maxlength="6000" data-test-legacy="true">${escape(plan.legacy)}</textarea></details>` : ''}`}
    </div>`;
  }
  function questionMarkup(question) {
    const { id, label, type, help, required } = question;
    const value = answers[id];
    const technical = question.kind === 'design';
    const delegated = R.isUnknown(value);
    const rawValue = Array.isArray(value) ? value : [value];
    const custom = rawValue.find(v => typeof v === 'string' && v.startsWith('기타:'));
    const helpId = `help-${id}`;
    const description = help || window.BriefGuides.facts?.[id]?.meaning || window.BriefGuides.questions?.[id]?.why || '';
    const advice = R.decisionAdvice(question, answers);
    let controls = '';
    if (type === 'worksheet') {
      controls = worksheetMarkup(question, value);
      if (value?.needsDetailReview) controls += `<div class="draft-review"><p>가져온 초안이에요. 내용과 빠진 칸을 확인해 주세요.</p><button type="button" class="button secondary" data-review-draft="${id}">초안 내용 검토 완료</button></div>`;
    } else if (type === 'testplan') {
      controls = testPlanMarkup(value);
    } else if (type === 'featurelist') {
      const rows = Array.isArray(value) ? value : [];
      controls = `<div class="feature-cards">${rows.map((row, index) => `<section class="feature-card"><div class="feature-card-top"><h3>기능 ${index + 1}</h3><button type="button" class="text-button" data-remove-feature="${index}">이 기능 지우기</button></div><div class="feature-fields">${[...featureFields.filter(f => ['name','actor','action','result','priority'].includes(f.id)), ...featureFields.filter(f => ['input','failure','acceptance'].includes(f.id))].map(field => {
        const stageStart = field.id === 'input' ? `<details class="feature-detail-stage" data-detail="feature-detail-${index}"><summary>입력·실패·완료 조건 이어서 정하기</summary><p class="question-help">정상 동작을 적었다면 입력할 내용과 실패했을 때의 안내, 완료 확인 방법을 보완해요.</p><div class="feature-fields">` : '';
        const stageEnd = field.id === 'acceptance' ? '</div></details>' : '';
        const inputId = `feature-${index}-${field.id}`;
        const attributes = `id="${inputId}" data-feature-index="${index}" data-feature-field="${field.id}"`;
        if (field.options) return `<fieldset class="feature-field wide feature-priority"><legend>${escape(field.label)}</legend><div class="choices">${field.options.map((option, i) => `<div class="choice-shell"><label class="choice"><input type="radio" id="${inputId}-${i}" name="feature-${index}-priority" data-feature-index="${index}" data-feature-field="priority" value="${escape(option)}" ${row.priority === option ? 'checked' : ''}><span>${escape(option)}</span></label>${helpButton('feature_priority', i, option)}</div>`).join('')}</div></fieldset>`;
        return `${stageStart}<div class="feature-field ${['name', 'actor'].includes(field.id) ? '' : 'wide'}"><label for="${inputId}">${escape(field.label)}</label><textarea class="textarea-input" ${attributes} rows="2" maxlength="6000" placeholder="${escape(field.placeholder)}">${escape(row[field.id] || '')}</textarea></div>${stageEnd}`;
      }).join('')}</div></section>`).join('')}</div>${delegated ? '<p class="question-help">기능 명세를 AI와 함께 정할 항목으로 남겼어요.</p>' : ''}<button type="button" class="button secondary" id="add-feature" ${rows.length >= R.MAX_FEATURES ? 'disabled' : ''}>+ 기능 추가</button><p class="question-help feature-limit">최대 ${R.MAX_FEATURES}개 · 일부만 작성해도 저장돼요. ‘추후 개발’은 이번 출시 범위에서 제외해요.</p>`;
    } else if (type === 'text' || type === 'textarea') {
      const attrs = `id="input-${id}" class="${type === 'text' ? 'text-input' : 'textarea-input'}" data-question="${id}" maxlength="${question.maxLength || 6000}" aria-describedby="${helpId}" ${required ? 'aria-required="true"' : ''} ${delegated ? 'disabled' : ''} placeholder="${escape(delegated ? 'AI에게 추천을 요청한 항목이에요' : question.placeholder || '답변을 적어 주세요') }"`;
      controls = type === 'text' ? `<input type="text" ${attrs} value="${escape(delegated ? '' : value || '')}">` : `<textarea ${attrs} rows="3">${escape(delegated ? '' : value || '')}</textarea>`;
    } else {
      const choices = R.choiceOptions(question);
      controls = `<div class="choices">${choices.map((item, index) => {
        const candidate = advice?.candidates.find(candidate => candidate.option === item);
        const meaning = technical && question.options.includes(item) ? (candidate?.reason || window.BriefGuides.get(question,item)?.meaning) : '';
        return `<div class="choice-shell${candidate ? ' suggested-choice' : ''}"><label class="choice ${item === R.UNKNOWN ? 'unknown-choice' : ''} ${item === '직접 입력' ? 'custom-choice' : ''}"><input type="${type === 'multi' ? 'checkbox' : 'radio'}" id="input-${id}-${index}" name="${id}" data-question="${id}" value="${escape(item)}" ${(item === '직접 입력' ? custom !== undefined : rawValue.includes(item)) ? 'checked' : ''} aria-describedby="${helpId}"><span class="choice-copy"><span>${escape(question.optionLabels?.[item] || item)}${candidate ? `<small class="candidate-label">${candidate.level === 'caution' ? '조건 확인' : '비교 후보'}</small>` : ''}</span>${meaning ? '<small class="choice-description">' + escape(meaning) + '</small>' : ''}</span></label>${helpButton(id, index, item)}</div>`;
      }).join('')}</div>`;
      const candidates = advice?.candidates.filter(item => item.level === 'consider') || [];
      if (candidates.length > 1) controls += `<button type="button" class="text-button compare-action" data-compare-question="${id}" data-compare-first="${choices.indexOf(candidates[0].option)}" data-compare-second="${choices.indexOf(candidates[1].option)}">두 후보 비교하기 →</button>`;
    }
    if (R.needsReselection(question, value)) controls = `<p class="legacy-answer">이전 답변을 보관했어요: ${escape(R.display(value))}. 질문의 기준이 바뀌었거나 현재 허용하지 않는 선택이에요. 확인 후 다시 선택해 주세요.</p>` + controls;
    if (custom !== undefined) {
      const attributes = `id="custom-${id}" class="${question.legacyFreeText ? 'textarea-input' : 'text-input'} custom-input" data-custom="${id}" maxlength="${question.legacyFreeText ? 6000 : 5996}" aria-label="${escape(label)} 직접 입력" placeholder="사용할 기술이나 원하는 방식을 적어 주세요"`;
      const text = escape(question.legacyFreeText && custom.startsWith('기타: ') ? custom.slice(4) : custom.slice(3).trimStart());
      controls += question.legacyFreeText ? `<textarea ${attributes} rows="3">${text}</textarea>` : `<input ${attributes} value="${text}">`;
    }
    if (delegated && drafts[id] !== undefined) controls += `<p class="draft-preserved">추천 요청 전 작성 내용을 보관하고 있어요. <button type="button" class="text-button" data-restore="${id}">이전 답변 복원</button></p>`;
    const factual = Boolean(window.BriefGuides.facts?.[id]);
    const noteMarkup = `<details class="question-note" data-detail="note-${id}"><summary>메모·선택 이유 <span>${notes[id] ? '기록 있음' : '선택'}</span></summary><label for="note-${id}">${factual ? '작성 근거와 확인할 내용' : '선택 이유와 추가 조건'}</label><textarea id="note-${id}" class="textarea-input" rows="2" maxlength="${question.noteMaxLength || question.maxLength || 6000}" data-note="${id}" placeholder="선택한 이유나 나중에 확인할 내용을 적어 주세요.">${escape(notes[id] || '')}</textarea></details>`;
    return `<fieldset class="question${technical ? ' design-question' : ''}" id="field-${id}" aria-labelledby="title-${id}"><legend><span class="question-title" id="title-${id}">${type === 'text' || type === 'textarea' ? `<label for="input-${id}">${escape(label)}</label>` : escape(label)}</span><button type="button" class="question-guide-button" data-question-guide="${id}" aria-label="${escape(label)} 질문 도움말" aria-haspopup="dialog" aria-controls="option-help-dialog">?</button></legend><p class="question-help" id="${helpId}">${escape(description)}</p>${draftMarkup(question)}${question.reuse?.length ? `<div data-reuse-question="${id}">${reusedAnswersMarkup(question)}</div>` : ''}${controls}<div class="question-actions">${noteMarkup}<div class="question-footer">${!required && (!question.supplemental || delegated) && ['text','textarea','featurelist','testplan','worksheet'].includes(type) ? `<button type="button" class="uncertain-button ${delegated ? 'selected' : ''}" id="unknown-${id}" data-unknown="${id}">${delegated ? '직접 작성으로 바꾸기' : 'AI에게 추천받기'}</button>` : ''}<button type="button" class="clear-answer" data-clear="${id}" ${R.isAnswered(value) ? '' : 'hidden'}>답변 지우기</button></div></div></fieldset>`;
  }
  function renderQuestions() {
    const openDetails = new Set([...document.querySelectorAll('[data-detail][open]')].map(el => el.dataset.detail));
    const groups = R.activeGroups(steps[currentStep], answers);
    if (!groups.some(group => group.title === currentTopic)) currentTopic = groups[0]?.title || '';
    $('#topic-select').innerHTML = groups.map((group,index) => `<option value="${escape(group.title)}">${String(index+1).padStart(2,'0')}. ${escape(group.title)}</option>`).join('');
    $('#topic-select').value = currentTopic;
    $('#topic-select').disabled = !groups.length;
    $('#question-groups').innerHTML = groups.length ? groups.map((group, index) => {
      const content = group.questions.map(questionMarkup).join('');
      return `<section class="question-group" data-topic="${escape(group.title)}" ${group.title === currentTopic ? '' : 'hidden'}><div class="group-heading"><div><h2>${escape(group.title)}</h2></div><button type="button" class="text-button group-guide-button" data-group-guide="${escape(group.title)}" aria-haspopup="dialog" aria-controls="option-help-dialog">주제 설명</button></div><div class="group-body">${content}</div></section>`;
    }).join('') : `<div class="empty-state"><h2>지금은 답할 질문이 없어요</h2><p>앞선 답변이 아직 없거나, 현재 선택에 해당하는 질문이 없어요. 아래 고려 사항에서 표시 조건을 확인해 주세요.</p><button type="button" class="button secondary" data-step="0">서비스 형태 확인</button> <button type="button" class="button secondary" data-step="2">기능 선택 확인</button></div>`;
    const inactive = R.inactiveQuestions(steps[currentStep], answers);
    if (inactive.length) $('#question-groups').innerHTML += `<details class="inactive-topics" data-detail="inactive-${currentStep}"><summary>현재 질문에 포함하지 않은 고려 사항 ${inactive.length}개</summary><p>아래 주제도 설계에서 고려하는 항목이에요. 현재 답변이 표시 조건을 충족하지 않아 접어 두었어요. 앞선 답변이 미정이라면 적용 여부도 미정이며, 이전 답변은 보관돼요.</p>${inactive.map(q => `<details><summary>${escape(q.label)}</summary><p>${escape(q.help || q.group)}</p><p class="question-help">판단에 사용한 답변: ${escape(R.conditionSummary(q.conditions, answers))}</p>${[...new Set(q.conditions.flatMap(R.conditionIds))].map(id => `<button type="button" class="text-button" data-jump="${id}">${escape(byId.get(id)?.label || id)} 확인 →</button>`).join(' ')}</details>`).join('')}</details>`;
    document.querySelectorAll('[data-detail]').forEach(el => { if (openDetails.has(el.dataset.detail)) el.open = true; });
    updateTopicNavigation();
  }
  function renderStep(index, focus = false, topic) {
    if (typeof topic === 'string') currentTopic = topic;
    else if (index !== currentStep) currentTopic = '';
    currentStep = Math.max(0, Math.min(index, steps.length - 1));
    isReport = false;
    const step = steps[currentStep];
    $('#form-view').hidden = false;
    $('#report-view').hidden = true;
    $('#breadcrumb').textContent = step.phase;
    $('#step-badge').textContent = `${step.icon} / ${steps.length}`;
    $('#page-title').textContent = step.title;
    $('#page-description').textContent = step.description;

    renderQuestions();
    updateProgress();
    if (focus) {
      setNavigation(false);
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
    for (let parent = control?.parentElement; parent && parent !== field; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    (control || field).focus({ preventScroll: true });
  }
  function jumpToQuestion(id) {
    const stepIndex = steps.findIndex(step => step.groups.some(group => group.questions.some(q => q.id === id)));
    if (stepIndex < 0) return;
    const topic = steps[stepIndex].groups.find(group => group.questions.some(q => q.id === id))?.title;
    $('#option-help-dialog').close();
    renderStep(stepIndex, true, topic);
    const field = document.getElementById(`field-${id}`);
    const details = field?.closest('details');
    if (details) details.open = true;
    field?.scrollIntoView({ block: 'center' });
    focusAnswer(field);
  }
  function reviewMarkup(review) {
    return `<section class="readiness-card" aria-labelledby="readiness-title"><div class="readiness-heading"><span class="eyebrow">OPEN QUESTIONS</span><h2 id="readiness-title">AI와 함께 구체화할 질문</h2><p>아직 모르는 답변이 있어도 시작할 수 있어요. 한꺼번에 모두 답하는 대신, 문서의 방향을 바꾸는 질문부터 확인하세요.</p></div>
      <details class="readiness-section"><summary>기획 방향을 먼저 확인 <strong>${review.before.length}</strong></summary><p>목표·범위·동작과 주요 설계를 정하는 질문이에요. AI는 아래 질문을 그대로 반복하기보다 이미 작성한 답변을 참고해 필요한 내용부터 물어야 해요.</p>${review.before.length ? `<ul>${review.before.map(item => `<li><button type="button" class="review-link" data-jump="${item.id}">${escape(item.label)} <span aria-hidden="true">↗</span></button><small>${escape(item.reason)}</small></li>`).join('')}</ul>` : '<p class="review-complete">지정된 핵심 항목에 답했어요. 답변의 충분성과 서로 모순되는 내용이 없는지 검토해 주세요.</p>'}</details>
      <details class="readiness-section"><summary>설계하면서 구체화 <strong>${review.during.length}</strong></summary><p>앞의 방향을 바탕으로 비교할 세부 결정이에요. 미룰 경우에는 필요한 정보와 다시 결정할 시점을 문서에 남겨요.</p><ul>${review.during.map(item => `<li><button type="button" class="review-link" data-jump="${item.id}">${escape(item.label)} <span aria-hidden="true">↗</span></button><small>${escape(item.reason)}</small></li>`).join('')}</ul></details></section>`;
  }
  function planningReviewMarkup() {
    const review = R.planningReview(answers, notes);
    return `<section class="planning-map" aria-labelledby="planning-map-title"><h2 id="planning-map-title">내 답변이 어떤 문서로 이어지나요?</h2><p>아래는 AI와 함께 완성할 문서의 구성과 연결된 답변이에요. 답변을 적었다고 설계 검토까지 끝난 것은 아니에요.</p><div class="planning-sections">${review.sections.map(section => `<details class="planning-section"><summary>${escape(section.title)}</summary><p>${escape(section.description)}</p>${section.questions.length ? `<ul>${section.questions.map(item => `<li><button type="button" class="text-button" data-jump="${item.id}">${escape(item.label)} →</button><span>${escape(item.status)}${item.reason ? ` · ${escape(item.reason)}` : ''}</span></li>`).join('')}</ul>` : '<p>현재 답변에 연결된 항목이 없어요. 적용 여부는 AI와 문서를 검토할 때 확인하세요.</p>'}</details>`).join('')}</div>${review.checks.length ? `<div class="planning-checks"><h3>먼저 보완하면 좋은 연결</h3><p>아래는 정해진 기준으로 찾은 확인 사항이에요. 이 목록에 없더라도 누락이나 모순이 있을 수 있어요.</p><ul>${review.checks.map(item => `<li><button type="button" class="text-button" data-jump="${item.id}">${escape(item.label)} →</button><p>${escape(item.reason)}</p></li>`).join('')}</ul></div>` : ''}</section>`;
  }
  function decisionRecordsMarkup() {
    const records = R.decisionRecords(answers, notes);
    if (!records.length) return '';
    return `<details class="decision-records report-section"><summary>주요 설계 선택과 판단 근거</summary><div class="report-section-body"><p>선택한 이름뿐 아니라 그 이유와 이어서 정할 내용을 함께 검토해요. 기록된 선택은 적합성이 검증된 결정과 구분해요.</p>${records.map(item => `<article class="decision-record"><h3><button type="button" class="text-button" data-jump="${item.id}">${escape(item.label)} →</button></h3><p class="decision-status">${escape(item.status)}</p><dl><div><dt>현재 기록</dt><dd>${escape(item.value || '미응답')}</dd></div><div><dt>선택 이유·추가 조건</dt><dd>${escape(item.reason || '아직 기록하지 않았어요. 비교한 대안과 선택 이유, 다시 검토할 조건을 AI와 확인하세요.')}</dd></div></dl>${item.followups.length ? `<div class="related-decisions"><strong>이어서 연결할 결정</strong>${item.followups.map(q => `<button type="button" class="text-button" data-jump="${q.id}">${escape(q.label)} →</button>`).join('')}</div>` : ''}</article>`).join('')}</div></details>`;
  }
  function decisionSummaryMarkup() {
    const items = R.decisionSummary(answers);
    return `<section class="decision-summary"><h2>현재 기록한 방향</h2><p>직접 적고 선택한 내용이에요. AI가 문서를 작성할 때 적합성과 서로 미치는 영향을 검토해야 해요.</p>${items.length ? `<dl>${items.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : '<p>아직 기록한 핵심 방향이 없어요. 알고 있는 내용부터 작성하거나 AI와 함께 구체화하세요.</p>'}</section>`;
  }
  function renderReport() {
    isReport = true;
    setNavigation(false);
    $('#form-view').hidden = true;
    $('#report-view').hidden = false;
    updateProgress();
    const stat = R.stats(answers), progress = R.requirementStats(answers), warnings = R.issues(answers), review = R.readiness(answers);
    const specification = steps.map(step => {
      const groups = R.reportGroups(step, answers, notes);
      if (!groups.length) return '';
      return `<details class="report-section"><summary>${step.icon}. ${escape(step.short)}</summary><div class="report-section-body">${groups.map(group => `<h3>${escape(group.title)}</h3><dl>${group.questions.map(q => `<div class="report-answer"><dt>${escape(q.label)}</dt><dd>${escape(R.needsReselection(q, answers[q.id]) ? `이전 답변: ${R.display(answers[q.id])} — 재선택 필요, 확정하지 않음` : R.answerText(q, answers))}</dd>${notes[q.id] ? `<dt>선택 이유·추가 설계 메모</dt><dd>${escape(notes[q.id])}</dd>` : ''}</div>`).join('')}</dl>`).join('')}</div></details>`;
    }).join('');
    $('#report-view').innerHTML = `
      <div class="report-kicker">YOUR PLANNING BRIEF <span>↗</span></div>
      <h1 id="report-title">내 아이디어를 기획·설계 문서로</h1>
      <p class="report-intro">답변과 선택 이유, 아직 정하지 못한 내용을 모았어요.<br>AI에게 전달하면 부족한 정보를 확인하고 기획·요구사항·설계 문서를 함께 다듬을 수 있어요.</p>
      <div class="summary-name">${escape(R.display(answers.project_name) || '이름 미정 프로젝트')}</div>
      <div class="report-stats"><div class="report-stat"><strong>${progress.confirmed}<small style="font-size:13px;font-weight:400;color:#6c7d98"> / ${progress.total}</small></strong><span>정리한 요구사항</span></div><div class="report-stat"><strong>${review.before.length}</strong><span>기획 방향 확인</span></div><div class="report-stat"><strong>${review.during.length}</strong><span>설계하며 구체화</span></div></div>
      <div class="report-actions"><button type="button" class="button primary" id="copy-prompt">AI 문서 작성 요청 복사 ↗</button><button type="button" class="button secondary" id="download-report">기획 자료 .md</button><button type="button" class="button secondary" id="download-prompt">AI 요청문 .md</button><button type="button" class="button secondary" id="print-report">인쇄 / PDF</button><button type="button" class="button secondary" id="back-to-form">계속 작성</button></div>
      <ol class="handoff-steps"><li><strong>자료 전달</strong><span>복사한 요청문과 실제 참고 파일을 AI 대화에 전달하세요.</span></li><li><strong>함께 검토</strong><span>추가 질문에 답하고 제안된 방식과 가정을 확인하세요.</span></li><li><strong>문서 구체화</strong><span>범위·동작·설계·검증 기준을 정리한 뒤 구현 여부를 별도로 결정하세요.</span></li></ol>
      ${warnings.length ? `<div class="warning-card"><h2>함께 확인할 답변 조합 ${warnings.length}건</h2>${warnings.map(w => `<div class="warning-item"><strong>${escape(w.title)}</strong>${escape(w.message)}<br><button class="text-button" data-jump="${w.id}">해당 답변 수정 →</button></div>`).join('')}</div>` : ''}
      ${decisionSummaryMarkup()}
      <details class="report-section implementation-baseline"><summary>선택과 관계없이 확인할 기본 구현 기준</summary><div class="report-section-body"><ul>${R.implementationBaseline.map(item => `<li>${escape(item)}</li>`).join('')}</ul><p>해당 기능에 적용할 기준이며 실제 구현·검증 결과는 별도로 확인해야 해요.</p></div></details>
      ${planningReviewMarkup()}
      ${decisionRecordsMarkup()}
      ${reviewMarkup(review)}
      <div class="pending-card"><p><strong>미응답 ${stat.pending}개 · 미정·보완 ${stat.unresolved}개 · AI 추천 요청 ${stat.delegated}개 · 이전 답변 재선택 ${stat.recheck}개</strong><br>위 확인 목록은 요구사항과 기술 검토를 함께 포함해요. 작성률은 요구사항 정리 비율이며 기술 선택 여부와 개발 준비도를 뜻하지 않아요. 미정·보완 항목과 추천 요청은 정리 완료로 세지 않아요. 선택 참고 정보는 작성률에서 제외하고, 빈칸은 확인 목록에 넣지 않아요. 일부만 작성한 기능 명세와 작성표는 위에서 안내해요.</p></div>
      <div class="report-tabs" role="tablist" aria-label="리포트 보기"><button class="report-tab" id="tab-spec" role="tab" aria-controls="panel-spec" data-tab="spec" aria-selected="${reportTab === 'spec'}" tabindex="${reportTab === 'spec' ? '0' : '-1'}">질문별 기록</button><button class="report-tab" id="tab-prompt" role="tab" aria-controls="panel-prompt" data-tab="prompt" aria-selected="${reportTab === 'prompt'}" tabindex="${reportTab === 'prompt' ? '0' : '-1'}">AI 문서 작성 요청</button></div>
      <div id="panel-spec" role="tabpanel" aria-labelledby="tab-spec" ${reportTab === 'spec' ? '' : 'hidden'}>${specification || '<p class="report-note">작성한 답변이 생기면 이곳에 명세를 정리해요. 아직 정하지 않은 항목은 위 확인 목록에 있어요.</p>'}</div>
      <div id="panel-prompt" role="tabpanel" aria-labelledby="tab-prompt" ${reportTab === 'prompt' ? '' : 'hidden'}><textarea readonly class="report-code" id="prompt-text" aria-label="AI에게 전달할 기획·설계 문서 작성 요청"></textarea></div>
      <p class="report-note">이 사이트는 답변을 정리하고 정해진 기준으로 비교를 안내해요. AI 모델을 호출하거나 답변의 정확성을 검증하지 않아요. 현재 조건에 해당하지 않는 이전 답변은 보관하되 리포트에서는 제외해요. 확정·제안·가정·미정을 구분한 문서는 전달받은 AI와 검토하며 완성하세요.</p>`;
    $('#prompt-text').value = R.report(answers, true, notes);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function download(content, extension, suffix, title = R.display(answers.project_name) || 'buildbrief') {
    const name = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 70);
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
    try { await navigator.clipboard.writeText(text); toast('답변을 포함한 기획·설계 문서 작성 요청을 복사했어요.'); }
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
      const indicator = target.closest?.('.question-note')?.querySelector('summary span');
      if (indicator) indicator.textContent = target.value.trim() ? '기록 있음' : '선택';
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
    moveTopic(1);
  });
  $('#topic-select').addEventListener('change', event => renderStep(currentStep,true,event.target.value));
  $('#project-select').addEventListener('change', event => {
    if (!openProject(event.target.value)) event.target.value = workspace.activeId;
  });
  $('#project-name-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#project-name').value.trim(), id = $('#project-name-dialog').dataset.project;
    if (!name || name.length > 6000) { $('#project-name-error').textContent = '프로젝트 이름을 1~6,000자로 적어 주세요.'; $('#project-name').focus(); return; }
    let next = collectWorkspace();
    if (id) {
      if (!next.projects.some(project => project.id === id)) return;
      next.projects = next.projects.map(project => project.id === id ? { ...project, answers: { ...project.answers, project_name: name }, updatedAt: new Date().toISOString() } : project);
    } else {
      const project = P.createProject({ answers: { project_name: name } });
      next = { ...next, activeId: project.id, projects: [...next.projects, project] };
    }
    if (!commitProjects(next)) return;
    $('#project-name-dialog').close();
    if (id) { renderProjects(); $('#close-projects').focus(); }
    else $('#projects-dialog').close();
    toast(id ? '프로젝트 이름을 바꿨어요.' : '기존 프로젝트를 보관하고 새 프로젝트를 만들었어요.');
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'save-help-button') return $('#storage-help-dialog').showModal();
    if (button.id === 'close-storage-help') return $('#storage-help-dialog').close();
    if (button.id === 'manage-projects') { $('#projects-error').textContent = ''; renderProjects(); return $('#projects-dialog').showModal(); }
    if (button.id === 'close-projects') return $('#projects-dialog').close();
    if (button.id === 'add-project' || button.id === 'create-project') return openProjectName();
    if (button.id === 'cancel-project-name') return $('#project-name-dialog').close();
    if (button.dataset.projectOpen) { if (openProject(button.dataset.projectOpen)) $('#projects-dialog').close(); return; }
    if (button.dataset.projectRename) return openProjectName(button.dataset.projectRename);
    if (button.dataset.projectBackup) return backupProject(button.dataset.projectBackup);
    if (button.dataset.projectDelete) {
      const project = workspace.projects.find(item => item.id === button.dataset.projectDelete);
      if (!project) return;
      $('#delete-project-dialog').dataset.project = project.id;
      $('#delete-project-error').textContent = '';
      $('#delete-project-name').textContent = P.projectTitle(project);
      return $('#delete-project-dialog').showModal();
    }
    if (button.id === 'cancel-delete-project') return $('#delete-project-dialog').close();
    if (button.id === 'confirm-delete-project') {
      const id = $('#delete-project-dialog').dataset.project, next = collectWorkspace();
      if (!next.projects.some(project => project.id === id)) return;
      next.projects = next.projects.filter(project => project.id !== id);
      if (!next.projects.length) next.projects.push(P.createProject());
      if (next.activeId === id) next.activeId = next.projects[0].id;
      if (!commitProjects(next)) return;
      $('#delete-project-dialog').close(); renderProjects(); $('#close-projects').focus();
      return toast('프로젝트를 삭제했어요.');
    }
    if (button.id === 'export-all-projects') return download(JSON.stringify({ format: 'buildbrief-projects', ...collectWorkspace(), exportedAt: new Date().toISOString() }, null, 2), 'json', '전체프로젝트백업', 'buildbrief');
    if (button.id === 'toggle-navigation') return setNavigation($('#sidebar').dataset.open !== 'true');
    if (button.dataset.questionGuide) return showQuestionGuide(button.dataset.questionGuide);
    if (button.dataset.groupGuide) return showQuestionGuide(null,button.dataset.groupGuide);
    if (button.dataset.compareQuestion) return showOptionHelp(button.dataset.compareQuestion, Number(button.dataset.compareFirst), true, Number(button.dataset.compareSecond));
    if (button.dataset.helpQuestion) return showOptionHelp(button.dataset.helpQuestion, Number(button.dataset.helpIndex));
    if (button.id === 'close-option-help') return $('#option-help-dialog').close();
    if (button.dataset.useDraft) {
      const id = button.dataset.useDraft, draft = R.suggestedDraft(id, answers);
      if (!draft || R.isAnswered(answers[id])) return;
      notes[id] = [notes[id], '초안 출처: ' + (byId.get(draft.source)?.label || '현재 답변에 맞춘 문서 구성') + ' · 원본이 바뀌면 이 초안도 다시 확인해 주세요.'].filter(Boolean).join('\n');
      setAnswer(id, draft.value, true);
      focusAnswer(document.getElementById('field-' + id));
      return;
    }
    if (button.dataset.reviewDraft) {
      const id = button.dataset.reviewDraft, value = answers[id];
      if (value && typeof value === 'object' && value.needsDetailReview) setAnswer(id, { ...value, needsDetailReview: false }, true);
      return;
    }
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
    if (button.id === 'previous-button') moveTopic(-1);
    if (button.id === 'back-to-form') renderStep(currentStep, true);
    if (button.id === 'copy-prompt') copyPrompt();
    if (button.id === 'download-report') download(R.report(answers, false, notes), 'md', '기획설계자료');
    if (button.id === 'download-prompt') download(R.report(answers, true, notes), 'md', 'AI프롬프트');
    if (button.id === 'print-report') {
      const spec = $('#panel-spec'), prompt = $('#panel-prompt');
      const opened = [...document.querySelectorAll('.report-section, .readiness-section, .planning-section')].map(el => [el, el.open]);
      spec.hidden = false; prompt.hidden = true;
      opened.forEach(([el]) => { el.open = true; });
      const restore = () => { opened.forEach(([el, open]) => { el.open = open; }); spec.hidden = reportTab !== 'spec'; prompt.hidden = reportTab !== 'prompt'; };
      window.addEventListener('afterprint', restore, { once: true });
      window.print();
    }
    if (button.id === 'export-answers' || button.id === 'storage-backup') backupProject();
    if (button.id === 'storage-original' && loadFailed && originalStorage !== null) download(originalStorage, 'json', '복구용저장원본');
    if (button.id === 'import-answers') $('#import-file').click();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('#sidebar').dataset.open === 'true') { setNavigation(false); $('#toggle-navigation').focus(); return; }
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
      let incoming;
      if (imported?.format === 'buildbrief' && imported.version === 1) {
        incoming = P.fromLegacy(imported);
        const project = incoming.projects[0];
        if (Object.keys(imported.answers).length && ![project.answers, project.drafts, project.notes].some(values => Object.keys(values).length)) throw new Error('사용할 수 있는 답변이 없는 백업 파일이에요.');
      } else if (imported?.format === 'buildbrief-projects') {
        incoming = P.normalizeWorkspace(imported);
        const ids = new Map(incoming.projects.map(project => [project.id, P.createProject().id]));
        incoming = { ...incoming, activeId: ids.get(incoming.activeId), projects: incoming.projects.map(project => ({ ...project, id: ids.get(project.id) })) };
      } else throw new Error('빌드브리프 프로젝트 백업 파일을 선택해 주세요.');
      if (loadFailed && !window.confirm('읽지 못한 기존 저장 원본을 이 백업으로 복구할까요? 먼저 저장 안내에서 원본과 새로 입력한 답변을 각각 내려받아 보관해 주세요.')) return;
      const next = { ...incoming, projects: [...(loadFailed ? [] : collectWorkspace().projects), ...incoming.projects] };
      if (!commitProjects(next, loadFailed)) return;
      toast(`백업에서 프로젝트 ${incoming.projects.length}개를 추가했어요.`);
    } catch (error) { toast(error instanceof SyntaxError ? 'JSON 형식이 올바르지 않아요. 백업 파일을 확인해 주세요.' : error.message); }
    finally { event.target.value = ''; }
  });
  window.addEventListener('storage', event => {
    if (event.key === P.KEY || event.key === P.LEGACY_KEY || event.key === null) {
      externalChange = true;
      updateSaveStatus('다른 탭 변경 감지 · 백업 후 새로고침');
      toast('다른 탭의 답변을 덮어쓰지 않도록 자동 저장을 멈췄어요. 이 탭의 답변을 백업한 뒤 새로고침해 주세요.');
    }
  });
  if (!loadFailed && storedRaw === null) save();
  renderStep(currentStep);
  if (!storageWorking) {
    if (loadFailed) {
      updateSaveStatus(originalStorage === null ? '저장 공간 확인 불가 · 자동 저장 중지' : '기존 답변 읽기 실패 · 원본 보존 중');
      toast(originalStorage === null ? '브라우저 저장 공간을 읽을 수 없어 자동 저장을 멈췄어요. 새로 입력한 답변은 백업해 주세요.' : '기존 답변을 읽지 못해 덮어쓰기를 막았어요. 저장 안내에서 원본을 내려받고, 새로 입력한 답변도 따로 백업해 주세요.');
    } else toast('브라우저에 저장하지 못했어요. 현재 답변은 백업할 수 있어요.');
  }
})();
