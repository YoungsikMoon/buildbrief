(() => {
  'use strict';
  const Q = window.BriefQuestions,
    A = window.BriefAnswers,
    R = window.BriefReport,
    P = window.BriefProjects,
    S = window.BriefStorage,
    V = window.BriefViews,
    T = window.BriefPlanningTemplate,
    D = window.BriefDesigner;
  const { steps, featureTypes, uiElements } = Q;
  const $ = (selector) => document.querySelector(selector);
  const esc = V.escapeHtml;
  const questions = new Map([...A.allQuestions, ...Q.retiredQuestions].map((q) => [q.id, q]));
  const storage = S.load();
  let answers, drafts, notes, recommendations, planningTemplate, promptDrafts, currentStep;
  let designerState = {},
    draggedElement = null;
  let toastTimer,
    formScrollY = 0;
  activateProject();
  function activateProject() {
    const p = storage.workspace.projects.find((p) => p.id === storage.workspace.activeId);
    ({
      answers,
      drafts,
      notes,
      recommendations = [],
      planningTemplate = null,
      promptDrafts = {}
    } = p);
    currentStep = p.step;
    designerState = {};
  }
  function markStarted() {
    storage.workspace.projects.find((p) => p.id === storage.workspace.activeId).started = true;
  }
  function collectWorkspace() {
    return {
      ...storage.workspace,
      projects: storage.workspace.projects.map((p) =>
        p.id === storage.workspace.activeId
          ? {
              ...p,
              answers,
              drafts,
              notes,
              recommendations,
              planningTemplate,
              promptDrafts,
              step: currentStep,
              topic: ''
            }
          : p
      )
    };
  }
  function status(message) {
    $('#save-status').textContent = $('#storage-help-status').textContent = message;
    $('#storage-help-warning').hidden = storage.storageWorking && !storage.externalChange;
    $('#storage-original').hidden = !storage.loadFailed || storage.originalStorage === null;
    $('#save-help-button').dataset.attention = String(
      !storage.storageWorking || storage.externalChange
    );
    $('#save-indicator').textContent =
      !storage.storageWorking || storage.externalChange ? '!' : '✓';
    $('#save-help-button').setAttribute('aria-label', message + ' · 저장 안내 열기');
  }
  function save(next = collectWorkspace(), recover = false) {
    const saved = S.save(storage, next, recover);
    status(S.status(storage));
    return saved;
  }
  function commitProjects(next, recover = false) {
    if (!save(next, recover)) {
      const message =
        '저장하지 못해 프로젝트를 바꾸지 않았어요. 현재 답변을 백업한 뒤 저장 안내를 확인해 주세요.';
      for (const id of ['projects-error', 'project-name-error', 'delete-project-error'])
        $('#' + id).textContent = message;
      toast(message);
      return false;
    }
    activateProject();
    renderStep(currentStep, true);
    return true;
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => {
      $('#toast').hidden = true;
    }, 5000);
  }
  function picker() {
    $('#project-select').innerHTML = collectWorkspace()
      .projects.map((p) => /* HTML */ `<option value="${p.id}">${esc(P.projectTitle(p))}</option>`)
      .join('');
    $('#project-select').value = storage.workspace.activeId;
  }
  function updateProgress() {
    const p = A.progress(answers);
    $('#progress-percent').textContent = `${p.percent}%`;
    $('#answer-progress').value = p.percent;
    $('#progress-caption').textContent = `질문 ${p.total}개 중 ${p.answered}개 작성`;
    $('#mobile-progress').textContent = `작성 ${p.percent}% · ${p.answered}/${p.total}`;
    document.querySelectorAll('#step-nav .step-link').forEach((button, i) => {
      const count = p.steps[i];
      const optional =
        !count.total && steps[i].groups.some((g) => g.questions.some((q) => q.optional));
      button.querySelector('.step-count').textContent = optional
        ? '선택'
        : `${count.answered}/${count.total}`;
      button.setAttribute(
        'aria-label',
        `${steps[i].short || steps[i].title}, ${optional ? '선택 작성' : `질문 ${count.total}개 중 ${count.answered}개 작성`}`
      );
    });
    picker();
  }
  const rowsOf = (id) => (Array.isArray(answers[id]) ? answers[id] : []);
  function ensureCommonScreen() {
    const rows = rowsOf('screens');
    if (!rows.some((s) => s.isCommon) && rows.length < A.MAX_ROWS)
      answers.screens = [{ id: P.newId(), isCommon: true, name: '', elements: [] }, ...rows];
  }
  function showDesigner(panel, element, screenId) {
    const selected = D.selection(answers, designerState);
    designerState = {
      ...designerState,
      screenId: screenId || selected.screen.id,
      element: element === undefined ? selected.element : element,
      panel,
      panelCollapsed: screenId && element === '' ? designerState.panelCollapsed : false
    };
    renderStep(currentStep);
    const target =
      screenId && element === '' ? $('.designer-stage-heading h3') : $('#inspector-title');
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
    if (window.matchMedia('(max-width: 800px)').matches)
      (screenId && element === ''
        ? $('.designer-stage')
        : $('#designer-inspector-body')
      )?.scrollIntoView({ block: 'start' });
  }
  function placeElement(screen, key, target) {
    const common = rowsOf('screens').find((s) => s.isCommon);
    const items = A.layoutItems(screen, common);
    const current = A.elementPlacement(screen, key);
    const parent = target.startsWith('parent:') ? target.slice(7) : '';
    let region = target.startsWith('region:') ? target.slice(7) : current.region;
    if (parent) {
      if (!A.canNest(items, key, parent)) return false;
      let ancestor = items.find((item) => item.key === parent);
      while (ancestor?.parent) ancestor = items.find((item) => item.key === ancestor.parent);
      region = ancestor?.region || region;
    }
    if (!Q.layoutRegions.some((r) => r.id === region)) return false;
    const positions = A.canvasLayout(items);
    const siblings = items.filter(
      (item) => item.key !== key && item.parent === parent && (parent || item.region === region)
    );
    const bottom = Math.max(
      0,
      ...siblings.map((item) => {
        const block = [...document.querySelectorAll('.canvas-block')].find(
          (block) => block.dataset.blockKey === item.key
        );
        return (
          positions.get(item.key).y +
          (block?.offsetHeight || A.elementSize(item.owner, item.key).height) +
          16
        );
      })
    );
    screen.placements ||= {};
    const previous = screen.placements[key];
    screen.placements[key] = {
      region,
      width: current.width,
      position: { x: 0, y: Math.min(A.MAX_CANVAS_Y, bottom) },
      ...(current.height !== undefined ? { height: current.height } : {}),
      ...(parent ? { parent } : {})
    };
    try {
      // Check inherited and hidden relationships with the same validation used by backups.
      A.normalizeAnswers({ screens: rowsOf('screens') });
    } catch {
      if (previous) screen.placements[key] = previous;
      else delete screen.placements[key];
      return false;
    }
    return true;
  }
  function detachChildren(screen, key) {
    const placement = A.elementPlacement(screen, key);
    for (const row of screen.isCommon ? rowsOf('screens') : [screen])
      for (const [childKey, child] of Object.entries(row.placements || {}))
        if (
          child.parent === key &&
          (!placement.parent || !placeElement(row, childKey, 'parent:' + placement.parent))
        )
          placeElement(row, childKey, 'region:' + placement.region);
  }
  function canvasPositions(screen) {
    const positions = new Map();
    for (const block of document.querySelectorAll('.canvas-block')) {
      const owner = block.querySelector(':scope > .canvas-block-heading > [data-canvas-owner]');
      if (owner?.dataset.canvasOwner === screen.id)
        positions.set(block.dataset.blockKey, {
          x: Number(block.dataset.x),
          y: Math.min(A.MAX_CANVAS_Y, Number(block.dataset.y))
        });
    }
    return positions;
  }
  function keepCanvasPositions(screen, positions) {
    screen.placements ||= {};
    for (const [key, position] of positions) {
      screen.placements[key] = { ...A.elementPlacement(screen, key), position };
      delete screen.placements[key].grid;
    }
  }
  function moveCanvasElement(key, target, position = null) {
    const { screen } = D.selection(answers, designerState);
    const order = A.elementKeys(screen);
    const positions = canvasPositions(screen);
    if (!order.includes(key) || !placeElement(screen, key, target)) return;
    positions.delete(key);
    keepCanvasPositions(screen, positions);
    if (position) screen.placements[key].position = position;
    designerState.element = key;
    designerState.panel = 'element';
    changed(true);
  }
  function toggleExpandedDesigner() {
    designerState.expanded = !designerState.expanded;
    setNavigation(false);
    renderStep(currentStep);
    $('[data-expand-designer]')?.focus({ preventScroll: true });
  }
  function flowTarget(screen, scope = '') {
    if (!screen) return null;
    if (!scope) return screen;
    if (scope.startsWith('custom:'))
      return screen.customElements?.find((el) => el.id === scope.slice(7));
    if (!uiElements.some((el) => el.id === scope)) return null;
    screen.elementContents ||= {};
    return (screen.elementContents[scope] ||= { items: [], featureIds: [] });
  }
  function connectFeature(screen, scope, id) {
    const plan = scope ? flowTarget(screen, scope) : null;
    if (scope && !plan) return false;
    if (
      [screen, ...(plan ? [plan] : [])].some(
        (target) =>
          (target.featureIds || []).length >= A.MAX_ROWS && !target.featureIds.includes(id)
      )
    ) {
      toast(`한곳에 최대 ${A.MAX_ROWS}개 기능을 연결할 수 있어요.`);
      return false;
    }
    if (plan) {
      const hasAction = (plan.flow || []).some((action) => action.featureId === id);
      if (!hasAction && (plan.flow || []).length >= A.MAX_ROWS) {
        toast(`한 요소에 최대 ${A.MAX_ROWS}개 동작을 기록할 수 있어요.`);
        return false;
      }
      plan.featureIds = [...new Set([...(plan.featureIds || []), id])];
      if (!hasAction)
        (plan.flow ||= []).push({
          id: P.newId(),
          featureId: id,
          event: '',
          result: '',
          nextScreenId: ''
        });
    }
    screen.featureIds = [...new Set([...(screen.featureIds || []), id])];
    return true;
  }
  function focusFeature(screenIndex, scope, id) {
    const screen = rowsOf('screens')[Number(screenIndex)];
    if (
      screen &&
      (designerState.panel !== 'settings' ||
        designerState.element !== (scope || '') ||
        designerState.screenId !== screen.id)
    ) {
      designerState = {
        screenId: screen.id,
        element: scope || '',
        panel: scope ? 'element' : 'screen'
      };
      renderStep(currentStep);
    }
    const card = document.getElementById(`feature-${screenIndex}${scope ? '-' + scope : ''}-${id}`);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    card.querySelector('input,textarea,select')?.focus({ preventScroll: true });
  }
  function renderNavigation(guide = false) {
    $('#guide-button').classList.toggle('active', guide);
    if (guide) $('#guide-button').setAttribute('aria-current', 'page');
    else $('#guide-button').removeAttribute('aria-current');
    $('#step-nav').innerHTML = steps
      .map(
        (s, i) =>
          /* HTML */ `<button
            type="button"
            class="step-link ${!guide && i === currentStep ? 'active' : ''}"
            data-step="${i}"
            ${!guide && i === currentStep ? 'aria-current="step"' : ''}
            ><span class="step-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span
            ><span class="step-title">${esc(s.short || s.title)}</span
            ><span class="step-count" aria-hidden="true"></span
          ></button>`
      )
      .join('');
    updateProgress();
  }
  function showGuide(focus = true) {
    designerState.expanded = false;
    document.body.classList.remove('designing', 'designer-expanded');
    $('#guide-view').hidden = false;
    $('#form-view').hidden = true;
    $('#report-view').hidden = true;
    renderNavigation(true);
    setNavigation(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) $('#guide-title').focus({ preventScroll: true });
  }
  function renderStep(index, navigate = false) {
    const states = new Map(
      [...document.querySelectorAll('#question-groups details[id]')].map((el) => [el.id, el.open])
    );
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    const step = steps[currentStep];
    document.body.classList.toggle('designing', step.id === 'screens');
    if (step.id !== 'screens') designerState.expanded = false;
    document.body.classList.toggle('designer-expanded', Boolean(designerState.expanded));
    if (step.id === 'screens') ensureCommonScreen();
    $('#guide-view').hidden = true;
    $('#form-view').hidden = false;
    $('#report-view').hidden = true;
    $('#page-title').textContent = step.title;
    $('#page-description').textContent = step.description;
    $('#step-badge').textContent = `${currentStep + 1} / ${steps.length}`;
    renderNavigation();
    const groups = A.activeGroups(step, answers, notes);
    $('#question-groups').innerHTML = groups
      .map(
        (g) =>
          /* HTML */ `<section class="question-group"
            >${groups.length > 1 && g.title
              ? /* HTML */ `<div class="group-heading"
                  ><h2>${esc(g.title)}</h2>${g.description
                    ? /* HTML */ `<p>${esc(g.description)}</p>`
                    : ''}</div
                >`
              : ''}<div class="group-body"
              >${g.questions
                .map((q) => V.question(q, answers, notes, recommendations, designerState))
                .join('')}</div
            ></section
          >`
      )
      .join('');
    D.applySizes();
    D.applyVisibility(designerState, D.selection(answers, designerState).screen.id);
    for (const [id, open] of states) {
      const el = document.getElementById(id);
      if (el) el.open = open;
    }
    $('#previous-button').disabled = currentStep === 0;
    const nextLabel = currentStep === steps.length - 1 ? '기획 초안 보기' : '다음 단계';
    $('#next-button-label').textContent = nextLabel;
    $('#next-button').setAttribute(
      'aria-label',
      `${nextLabel} · 현재 ${steps.length}단계 중 ${currentStep + 1}단계`
    );
    if (navigate) {
      markStarted();
      save();
      setNavigation(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#page-title').tabIndex = -1;
      $('#page-title').focus({ preventScroll: true });
    }
  }
  function setNavigation(open) {
    $('#sidebar').dataset.open = String(open);
    $('#toggle-navigation').setAttribute('aria-expanded', String(open));
  }
  function changed(rerender = false) {
    markStarted();
    save();
    if (rerender) renderStep(currentStep);
    else updateProgress();
  }
  function showHelp(title, guide, elementId = '') {
    $('#help-title').textContent = title;
    $('#help-content').innerHTML =
      V.elementExample(elementId, true) +
      '<dl>' +
      [
        ['meaning', '무엇인가요?'],
        ['fit', '언제 잘 맞나요?'],
        ['avoid', '어떤 점을 주의하나요?']
      ]
        .filter(([key]) => guide?.[key])
        .map(
          ([key, label]) =>
            /* HTML */ `<div class="help-fact"><dt>${label}</dt><dd>${esc(guide[key])}</dd></div>`
        )
        .join('') +
      '</dl>';
    const detail = uiElements.find((el) => el.id === elementId)?.detail;
    if (detail)
      $('#help-content').innerHTML +=
        '<h3>' +
        esc(detail.label) +
        '</h3><div class="reference-features">' +
        detail.options
          .filter((o) => o.id)
          .map(
            (o) =>
              '<button type="button" class="reference-feature" data-element-help="' +
              elementId +
              '" data-element-choice="' +
              o.id +
              '">' +
              esc(o.label) +
              '</button>'
          )
          .join('') +
        '</div>';
    if (!$('#option-help-dialog').open) $('#option-help-dialog').showModal();
    $('#option-help-dialog').scrollTop = 0;
  }
  function renderReport() {
    designerState.expanded = false;
    document.body.classList.remove('designing', 'designer-expanded');
    if (!$('#form-view').hidden) formScrollY = window.scrollY;
    $('#guide-view').hidden = true;
    $('#form-view').hidden = true;
    $('#report-view').hidden = false;
    renderNavigation();
    setNavigation(false);
    $('#report-view').innerHTML = V.report(answers, notes, recommendations);
    window.scrollTo({ top: 0, behavior: 'instant' });
    $('#report-title').focus({ preventScroll: true });
  }
  function updatePrompt(refreshText = true) {
    if (refreshText)
      $('#prompt-preview-text').value = R.report(
        answers,
        true,
        notes,
        recommendations,
        planningTemplate,
        promptDrafts
      );
    $('#planning-template-status').textContent = V.planningTemplateStatus(planningTemplate);
    const edited = Object.hasOwn(promptDrafts, planningTemplate?.enabled ? 'advanced' : 'basic');
    $('#reset-prompt').hidden =
      !edited &&
      !(
        planningTemplate?.enabled &&
        (planningTemplate.text !== T.text || planningTemplate.version !== T.version)
      );
    $('#copy-prompt').disabled = !$('#prompt-preview-text').value.trim();
    $('#prompt-copy-status').textContent = save()
      ? edited
        ? '수정본 저장됨 · 답변 변경은 복원하기로 반영해요.'
        : '바로 수정할 수 있어요. 변경 내용은 이 브라우저에 저장돼요.'
      : '저장하지 못했어요. 프롬프트를 복사하거나 프로젝트를 백업해 주세요.';
  }
  function jumpToQuestion(questionId) {
    const stepIndex = steps.findIndex((step) =>
      step.groups.some((group) => group.questions.some((question) => question.id === questionId))
    );
    if (stepIndex < 0) return;
    renderStep(stepIndex);
    setNavigation(false);
    requestAnimationFrame(() => {
      const field = document.getElementById('field-' + questionId);
      field?.scrollIntoView({ block: 'start', behavior: 'instant' });
      field?.querySelector('legend')?.focus({ preventScroll: true });
    });
  }
  function download(text, extension, suffix, title = P.projectTitle({ answers })) {
    const filename = `${title}-${suffix}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
    const url = URL.createObjectURL(
      new Blob([text], {
        type:
          extension === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.' + extension;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function backupProject(id = storage.workspace.activeId) {
    const p = collectWorkspace().projects.find((p) => p.id === id);
    if (!p) return;
    download(
      JSON.stringify(
        { format: 'buildbrief-idea', version: 1, exportedAt: new Date().toISOString(), ...p },
        null,
        2
      ),
      'json',
      '백업',
      P.projectTitle(p)
    );
    toast('백업 파일 다운로드를 시작했어요. 파일을 보관하면 다른 브라우저에서도 불러올 수 있어요.');
  }
  function renderProjects() {
    $('#project-list').innerHTML = collectWorkspace()
      .projects.map(
        (p) =>
          /* HTML */ `<section class="project-item"
            ><div
              ><strong>${esc(P.projectTitle(p))}</strong
              ><p
                >${p.id === storage.workspace.activeId ? '현재 작성 중 · ' : ''}${esc(
                  new Date(p.updatedAt).toLocaleString('ko-KR')
                )}</p
              ></div
            ><div class="inline-actions"
              ><button type="button" class="button secondary small" data-project-open="${p.id}"
                >열기</button
              ><button type="button" class="text-button" data-project-rename="${p.id}"
                >이름 변경</button
              ><button type="button" class="text-button" data-project-backup="${p.id}">백업</button
              ><button type="button" class="text-button danger-text" data-project-delete="${p.id}"
                >삭제</button
              ></div
            ></section
          >`
      )
      .join('');
  }
  function nameProject(id = '') {
    const p = storage.workspace.projects.find((p) => p.id === id);
    if (id && !p) return;
    $('#project-name-dialog').dataset.project = id;
    $('#project-name-title').textContent = id ? '프로젝트 이름 변경' : '새 프로젝트 만들기';
    $('#project-name-description').textContent =
      '프로젝트마다 답변을 따로 보관해요. 이름은 나중에 바꿀 수 있어요.';
    $('#project-name-form button[type="submit"]').textContent = id
      ? '이름 변경'
      : '프로젝트 만들기';
    $('#project-name').value = p?.answers.project_name || '';
    $('#project-name-error').textContent = '';
    $('#project-name-dialog').showModal();
    $('#project-name').focus();
  }
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.id === 'prompt-preview-text') {
      const mode = planningTemplate?.enabled ? 'advanced' : 'basic';
      if (el.value === R.report(answers, true, notes, recommendations, planningTemplate))
        delete promptDrafts[mode];
      else promptDrafts[mode] = el.value;
      updatePrompt(false);
      return;
    }
    if (el.matches('[data-role-search]')) {
      const picker = el.closest('.role-picker');
      const query = el.value.trim().toLocaleLowerCase();
      let count = 0;
      picker.querySelectorAll('[data-role-option]').forEach((option) => {
        option.hidden = !option.textContent.toLocaleLowerCase().includes(query);
        if (!option.hidden) count++;
      });
      const result = picker.querySelector('.role-results');
      result.hidden = !query && count > 0;
      result.textContent = count ? `검색 결과 ${count}개` : '검색 결과가 없어요.';
      return;
    }
    if (el.matches('textarea[data-note]') && questions.has(el.dataset.note)) {
      if (el.value) notes[el.dataset.note] = el.value;
      else delete notes[el.dataset.note];
      save();
      return;
    }
    if (el.dataset.q && el.matches('input:not([type="checkbox"]):not([type="radio"]),textarea'))
      edit(el);
  });
  document.addEventListener('focusout', (event) => {
    const picker = event.target.closest('.role-picker[open]');
    if (picker && event.relatedTarget && !picker.contains(event.relatedTarget)) picker.open = false;
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.id === 'planning-template-enabled') {
      planningTemplate = {
        ...(planningTemplate || { version: T.version, text: T.text }),
        enabled: el.checked
      };
      updatePrompt();
      return;
    }
    if (el.matches('[data-all-levels],[data-level-key]')) {
      const { screen } = D.selection(answers, designerState);
      const checks = [...document.querySelectorAll('[data-level-key]')];
      if (el.matches('[data-all-levels]')) for (const check of checks) check.checked = el.checked;
      designerState.hiddenElements ||= {};
      designerState.hiddenElements[screen.id] = checks
        .filter((check) => !check.checked)
        .map((check) => check.dataset.levelKey);
      D.applyVisibility(designerState, screen.id);
      return;
    }
    if (el.matches('[data-reference-category]')) {
      designerState.referenceCategory = el.value;
      document.querySelectorAll('[data-reference-group]').forEach((group) => {
        group.hidden = group.dataset.referenceGroup !== el.value;
      });
      return;
    }
    if (el.matches('[data-feature-choice]')) {
      const picker = el.closest('.feature-picker');
      const type = featureTypes.find((f) => 'type:' + f.id === el.value);
      const existing = rowsOf('features').find((f) => 'link:' + f.id === el.value);
      picker.querySelector('[data-add-chosen-feature]').disabled = !type && !existing;
      picker.querySelector('.feature-choice-info').hidden = !type && !existing;
      picker.querySelector('[data-feature-description]').textContent =
        type?.description ||
        (existing ? '이 기능을 연결해요. 이름과 설명은 다른 곳에도 함께 반영돼요.' : '');
      const help = picker.querySelector('[data-feature-help]');
      help.hidden = !type;
      help.dataset.featureHelp = type?.id || '';
      help.setAttribute('aria-label', (type?.label || '기능') + ' 설명');
      return;
    }
    if (el.matches('select[data-assign-feature]')) {
      const screen = rowsOf('screens')[Number(el.dataset.screen)];
      if (el.value && screen && connectFeature(screen, el.value, el.dataset.assignFeature)) {
        changed(true);
        focusFeature(el.dataset.screen, el.value, el.dataset.assignFeature);
      }
      return;
    }
    if (
      el.matches('input[data-recommend]') &&
      questions.get(el.dataset.recommend)?.allowRecommend
    ) {
      const id = el.dataset.recommend;
      recommendations = el.checked
        ? [...new Set([...recommendations, id])]
        : recommendations.filter((value) => value !== id);
      save();
      return;
    }
    if (el.dataset.q && el.matches('select,input[type="checkbox"],input[type="radio"]')) edit(el);
  });
  function edit(el) {
    const { q: qid, row, field, element, custom, property, item, flowScope, flowRow } = el.dataset;
    const object = row === undefined ? answers : rowsOf(qid)[Number(row)];
    if (!object) return;
    const key = field || qid;
    if (qid === 'screens' && ['flow', 'recommendFlow'].includes(field)) {
      const plan = flowTarget(object, flowScope);
      if (!plan) return;
      if (field === 'recommendFlow') plan.recommendFlow = el.checked;
      else {
        const action = plan.flow?.[Number(flowRow)];
        if (
          !action ||
          ![
            'event',
            'featureId',
            'nextScreenId',
            'result',
            'exceptions',
            'recommendExceptions'
          ].includes(property)
        )
          return;
        action[property] = el.type === 'checkbox' ? el.checked : el.value;
        if (property === 'featureId' && el.value)
          object.featureIds = [...new Set([...(object.featureIds || []), el.value])];
      }
    } else if (field === 'elementContents') {
      if (property !== 'name' || !uiElements.some((item) => item.id === element)) return;
      object.elementContents ||= {};
      const plan = (object.elementContents[element] ||= {});
      plan.name = el.value;
    } else if (qid === 'features' && field === 'recommendPermission') {
      object.recommendPermission = el.checked;
    } else if (field === 'customElements') {
      const item = object.customElements?.[Number(custom)];
      if (!item || !['name', 'purpose'].includes(property)) return;
      item[property] = el.value;
    } else if (element) {
      object.elementNotes ||= {};
      object.elementNotes[element] = el.value;
    } else if (qid === 'screens' && ['recommendLayout', 'useCommonLayout'].includes(field)) {
      object[field] = el.checked;
    } else if (el.type === 'checkbox') {
      let values = Array.isArray(object[key]) ? [...object[key]] : [];
      values = el.checked
        ? [...new Set([...values, el.value])]
        : values.filter((v) => v !== el.value);
      if (el.checked && A.EXCLUSIVE.includes(el.value)) values = [el.value];
      else if (el.checked) values = values.filter((v) => !A.EXCLUSIVE.includes(v));
      object[key] = values;
    } else object[key] = el.value;
    if (qid === 'screens' && field === 'roleIds') {
      el.closest('.role-picker').querySelector('[data-role-summary]').textContent =
        V.roleSelectionLabel(object.roleIds, rowsOf('roles'));
    }
    if (field === 'name') {
      const selector =
        qid === 'features'
          ? `[data-feature-title="${row}"]`
          : qid === 'screens'
            ? `[data-screen-title="${row}"]`
            : '';
      if (selector)
        document.querySelectorAll(selector).forEach((title) => {
          title.textContent =
            qid === 'features' ? el.value || '새 기능' : A.screenLabel(rowsOf('screens'), object);
        });
      if (qid === 'features')
        document
          .querySelectorAll(`[data-remove="features"][data-index="${row}"]`)
          .forEach((button) =>
            button.setAttribute('aria-label', `${el.value || '새 기능'} 기능 삭제`)
          );
    }
    if (qid === 'features') {
      document.querySelectorAll('[data-q="features"]').forEach((control) => {
        if (control !== el && control.dataset.row === row && control.dataset.field === field) {
          if (control.type === 'checkbox') {
            control.checked = el.checked;
          } else control.value = el.value;
        }
      });
    }
    const rerender =
      (row === undefined && el.matches('select,input[type="checkbox"],input[type="radio"]')) ||
      field === 'elements' ||
      field === 'elementOptions' ||
      field === 'useCommonLayout' ||
      (field === 'flow' && property === 'featureId') ||
      (field === 'elementContents' && ['type', 'featureIds'].includes(property));
    changed(rerender);
    if (!rerender && qid === 'screens') {
      const current = D.selection(answers, designerState);
      if (field === 'name')
        for (const row of rowsOf('screens')) {
          const name = A.screenLabel(rowsOf('screens'), row);
          const tab = document.querySelector('[data-designer-screen="' + row.id + '"]');
          if (tab && !row.isCommon) {
            tab.textContent = name;
            tab.parentElement
              .querySelector('.screen-tab-close')
              ?.setAttribute('aria-label', name + ' 삭제');
          }
          if (current.screen.id === row.id) {
            document
              .querySelector('.canvas-paper')
              .setAttribute('aria-label', name + ' 구성 미리보기');
          }
        }
      document.querySelectorAll('[data-canvas-element]').forEach((block) => {
        if (block.dataset.canvasOwner !== object.id) return;
        const scope = block.dataset.canvasElement;
        if (!block.closest('.canvas-block').classList.contains('inherited')) {
          const name = D.elementName(object, scope);
          block.querySelector('.canvas-block-title').textContent = name;
          const menuName = [...document.querySelectorAll('[data-level-name]')].find(
            (node) => node.dataset.levelName === scope
          );
          if (menuName) menuName.textContent = name;
          block.setAttribute('aria-label', name + ' 선택');
          block
            .closest('.canvas-block')
            .querySelector(':scope > .canvas-block-heading > .canvas-add-child')
            ?.setAttribute('aria-label', name + ' 안에 요소 추가');
          block
            .closest('.canvas-block')
            .querySelector(':scope > [data-resize-element]')
            ?.setAttribute('aria-label', name + ' 크기 조절');
        }
      });
      D.applySizes();
    }
    if (rerender)
      [...document.querySelectorAll('[data-q]')]
        .find(
          (c) =>
            c.dataset.q === qid &&
            c.dataset.row === row &&
            c.dataset.field === field &&
            c.dataset.element === element &&
            c.dataset.item === item &&
            c.dataset.property === property &&
            c.dataset.flowScope === flowScope &&
            c.dataset.flowRow === flowRow &&
            c.value === el.value
        )
        ?.focus({ preventScroll: true });
  }
  $('#question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (currentStep === steps.length - 1) renderReport();
    else renderStep(currentStep + 1, true);
  });
  $('#project-select').addEventListener('change', (event) => {
    commitProjects({ ...collectWorkspace(), activeId: event.target.value });
    picker();
  });
  $('#project-name-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#project-name').value.trim();
    if (!name) return;
    const id = $('#project-name-dialog').dataset.project;
    let next = collectWorkspace();
    if (id)
      next = {
        ...next,
        projects: next.projects.map((p) =>
          p.id === id
            ? {
                ...p,
                answers: { ...p.answers, project_name: name },
                updatedAt: new Date().toISOString()
              }
            : p
        )
      };
    else {
      const p = P.createProject({ answers: { project_name: name } });
      next = { ...next, activeId: p.id, projects: [...next.projects, p] };
    }
    if (!commitProjects(next)) return;
    $('#project-name-dialog').close();
    if (id) renderProjects();
    else $('#projects-dialog').close();
    toast(id ? '이름을 변경했어요.' : '새 프로젝트를 만들었어요.');
  });
  let resizing = null;
  function showElementSize(handle, size) {
    const block = handle.closest('.canvas-block');
    block.dataset.width = size.width;
    block.dataset.height = size.height;
    D.applySizes(block);
  }
  function saveElementSize(screen, key, size, positions = canvasPositions(screen)) {
    keepCanvasPositions(screen, positions);
    screen.placements ||= {};
    screen.placements[key] = { ...A.elementPlacement(screen, key), ...size };
    const position = screen.placements[key].position;
    if (position) position.x = Math.min(position.x, 100 - size.width);
    for (const block of document.querySelectorAll('.canvas-block')) {
      if (block.dataset.blockKey === key) {
        block.dataset.width = size.width;
        block.dataset.height = size.height;
        if (position) block.dataset.x = position.x;
      }
    }
    D.applySizes();
    changed();
  }
  function finishResize(commit) {
    if (!resizing) return;
    const state = resizing;
    resizing = null;
    if (state.handle.hasPointerCapture(state.pointer))
      state.handle.releasePointerCapture(state.pointer);
    if (
      commit &&
      state.moved &&
      rowsOf('screens').includes(state.screen) &&
      state.handle.isConnected
    )
      saveElementSize(state.screen, state.key, state.size, state.positions);
    else if (state.handle.isConnected) showElementSize(state.handle, state.before);
  }
  document.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-resize-element]');
    if (!handle || event.button !== 0 || resizing) return;
    const screen = rowsOf('screens').find((row) => row.id === handle.dataset.resizeOwner);
    const key = handle.dataset.resizeElement;
    if (!screen || !A.elementKeys(screen).includes(key)) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    const block = handle.closest('.canvas-block'),
      parent = block.parentElement;
    const style = getComputedStyle(parent);
    const parentWidth =
      parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const before = A.elementSize(screen, key);
    resizing = {
      handle,
      screen,
      key,
      before,
      positions: canvasPositions(screen),
      size: { ...before },
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      parentWidth: Math.max(1, parentWidth),
      height: block.getBoundingClientRect().height,
      moved: false
    };
    handle.setPointerCapture(event.pointerId);
  });
  document.addEventListener('pointermove', (event) => {
    if (!resizing || event.pointerId !== resizing.pointer) return;
    const dx = event.clientX - resizing.x,
      dy = event.clientY - resizing.y;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !resizing.moved) return;
    resizing.moved = true;
    resizing.size = {
      width:
        Math.abs(dx) < 3
          ? resizing.before.width
          : Number(
              Math.max(
                1,
                Math.min(100, 6400 / resizing.parentWidth),
                Math.min(
                  100 - resizing.positions.get(resizing.key).x,
                  ((Math.round(((resizing.before.width / 100) * resizing.parentWidth + dx) / 8) *
                    8) /
                    resizing.parentWidth) *
                    100
                )
              ).toFixed(4)
            ),
      height:
        Math.abs(dy) < 3
          ? resizing.before.height
          : Math.max(
              A.MIN_ELEMENT_HEIGHT,
              Math.min(Number.MAX_SAFE_INTEGER, Math.round((resizing.height + dy) / 8) * 8)
            )
    };
    showElementSize(resizing.handle, resizing.size);
  });
  document.addEventListener('pointerup', (event) => {
    if (resizing?.pointer === event.pointerId) finishResize(true);
  });
  document.addEventListener('pointercancel', (event) => {
    if (resizing?.pointer === event.pointerId) finishResize(false);
  });
  document.addEventListener('lostpointercapture', (event) => {
    if (resizing?.pointer === event.pointerId) finishResize(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resizing) {
      event.preventDefault();
      finishResize(false);
      return;
    }
    const filter = document.querySelector('.level-filter[open]');
    if (event.key === 'Escape' && filter && !document.querySelector('dialog[open]')) {
      event.preventDefault();
      filter.open = false;
      filter.querySelector('summary').focus({ preventScroll: true });
      return;
    }
    if (
      event.key === 'Escape' &&
      designerState.expanded &&
      !document.querySelector('dialog[open]') &&
      !draggedElement
    ) {
      event.preventDefault();
      toggleExpandedDesigner();
      return;
    }
    const tab = event.target.closest('[data-designer-panel]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...tab.parentElement.querySelectorAll('[data-designer-panel]')];
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (tabs.indexOf(tab) + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) %
              tabs.length;
      tabs[index].click();
      return;
    }
    const handle = event.target.closest('[data-resize-element]');
    if (!handle || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const screen = rowsOf('screens').find((row) => row.id === handle.dataset.resizeOwner),
      key = handle.dataset.resizeElement;
    if (!screen || !A.elementKeys(screen).includes(key)) return;
    event.preventDefault();
    const size = A.elementSize(screen, key);
    const parentWidth = handle.closest('.canvas-block').parentElement.clientWidth;
    const x = Number(handle.closest('.canvas-block').dataset.x);
    if (['ArrowLeft', 'ArrowRight'].includes(event.key))
      size.width = Number(
        Math.max(
          1,
          Math.min(100, 6400 / parentWidth),
          Math.min(
            100 - x,
            size.width + (event.key === 'ArrowLeft' ? -800 / parentWidth : 800 / parentWidth)
          )
        ).toFixed(4)
      );
    size.height = Math.max(
      A.MIN_ELEMENT_HEIGHT,
      Math.min(
        Number.MAX_SAFE_INTEGER,
        size.height + (event.key === 'ArrowUp' ? -8 : event.key === 'ArrowDown' ? 8 : 0)
      )
    );
    showElementSize(handle, size);
    saveElementSize(screen, key, size);
    toast(`너비 ${Math.round(size.width)}%, 최소 높이 ${size.height}px`);
  });
  document.addEventListener('dragstart', (event) => {
    const block = event.target.closest('[data-canvas-element][draggable="true"]');
    if (!block) return;
    const rect = block.closest('.canvas-block').getBoundingClientRect();
    draggedElement = {
      screenId: block.dataset.canvasOwner,
      key: block.dataset.canvasElement,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedElement.key);
  });
  function clearDropPreview() {
    document.querySelectorAll('.drop-active').forEach((el) => el.classList.remove('drop-active'));
    document.querySelectorAll('.canvas-drop-preview').forEach((el) => el.remove());
  }
  function gridDrop(event, zone) {
    const grid = zone.matches('.canvas-grid') ? zone : null;
    if (!grid || !draggedElement) return null;
    const { screen } = D.selection(answers, designerState);
    const rect = grid.getBoundingClientRect();
    const width = A.elementSize(screen, draggedElement.key).width;
    const items = A.layoutItems(
      screen,
      rowsOf('screens').find((s) => s.isCommon)
    );
    const parent = zone.dataset.dropParent || '';
    if (parent && !A.canNest(items, draggedElement.key, parent)) return null;
    return {
      x: Number(
        Math.max(
          0,
          Math.min(
            100 - width,
            ((Math.round((event.clientX - rect.left - draggedElement.offsetX) / 8) * 8) /
              rect.width) *
              100
          )
        ).toFixed(4)
      ),
      y: Math.max(
        0,
        Math.min(
          A.MAX_CANVAS_Y,
          Math.round((event.clientY - rect.top - draggedElement.offsetY) / 8) * 8
        )
      )
    };
  }
  document.addEventListener('dragover', (event) => {
    const zone = event.target.closest('[data-drop-parent], [data-drop-region]');
    if (
      !zone ||
      !draggedElement ||
      draggedElement.screenId !== D.selection(answers, designerState).screen.id
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearDropPreview();
    zone.classList.add('drop-active');
    const position = gridDrop(event, zone);
    if (position) {
      const { screen } = D.selection(answers, designerState);
      const preview = document.createElement('div');
      preview.className = 'canvas-drop-preview';
      preview.setAttribute('aria-hidden', 'true');
      const size = A.elementSize(screen, draggedElement.key);
      preview.style.left = position.x + '%';
      preview.style.top = position.y + 'px';
      preview.style.width = size.width + '%';
      preview.style.height = size.height + 'px';
      zone.append(preview);
    }
  });
  document.addEventListener('drop', (event) => {
    const zone = event.target.closest('[data-drop-parent], [data-drop-region]');
    if (
      !zone ||
      !draggedElement ||
      draggedElement.screenId !== D.selection(answers, designerState).screen.id
    )
      return;
    event.preventDefault();
    moveCanvasElement(
      draggedElement.key,
      zone.dataset.dropParent
        ? 'parent:' + zone.dataset.dropParent
        : 'region:' + zone.dataset.dropRegion,
      gridDrop(event, zone)
    );
    draggedElement = null;
    clearDropPreview();
  });
  document.addEventListener('dragend', () => {
    draggedElement = null;
    clearDropPreview();
  });
  document.addEventListener('click', async (event) => {
    document.querySelectorAll('.role-picker[open], .level-filter[open]').forEach((picker) => {
      if (!picker.contains(event.target)) picker.open = false;
    });
    const b = event.target.closest('button');
    const reportJump = event.target.closest('a[data-report-jump]');
    if (reportJump) {
      event.preventDefault();
      return jumpToQuestion(reportJump.dataset.reportJump);
    }
    if (!b) return;
    const d = { ...b.dataset };
    if (d.expandDesigner !== undefined) return toggleExpandedDesigner();
    if (d.gridMove || d.gridWidth) {
      const { screen, element } = D.selection(answers, designerState);
      if (!element) return;
      if (d.gridWidth) {
        saveElementSize(screen, element, {
          ...A.elementSize(screen, element),
          width: Number(d.gridWidth)
        });
        renderStep(currentStep);
      } else {
        const items = A.layoutItems(
          screen,
          rowsOf('screens').find((s) => s.isCommon)
        );
        const current = items.find((item) => item.key === element);
        const position = canvasPositions(screen).get(element);
        const block = [...document.querySelectorAll('.canvas-block')].find(
          (block) => block.dataset.blockKey === element
        );
        const stepX = 800 / block.parentElement.clientWidth;
        const x = Number(
          Math.max(
            0,
            Math.min(
              100 - A.elementSize(screen, element).width,
              position.x + (d.gridMove === 'left' ? -stepX : d.gridMove === 'right' ? stepX : 0)
            )
          ).toFixed(4)
        );
        const y = Math.max(
          0,
          Math.min(
            A.MAX_CANVAS_Y,
            position.y + (d.gridMove === 'up' ? -8 : d.gridMove === 'down' ? 8 : 0)
          )
        );
        moveCanvasElement(
          element,
          current.parent ? 'parent:' + current.parent : 'region:' + current.region,
          { x, y }
        );
      }
      document
        .querySelector(
          d.gridMove ? `[data-grid-move="${d.gridMove}"]` : `[data-grid-width="${d.gridWidth}"]`
        )
        ?.focus({ preventScroll: true });
      return;
    }
    if (d.designerPanel !== undefined) {
      if (!['screen', 'element', 'reference'].includes(d.designerPanel)) return;
      showDesigner(d.designerPanel);
      document
        .querySelector('[data-designer-panel="' + d.designerPanel + '"]')
        ?.focus({ preventScroll: true });
      return;
    }
    if (d.toggleInspector !== undefined) {
      designerState.panelCollapsed = !designerState.panelCollapsed;
      renderStep(currentStep);
      $('[data-toggle-inspector]')?.focus({ preventScroll: true });
      return;
    }
    if (d.addChosenFeature !== undefined) {
      const value = b.closest('.feature-picker').querySelector('[data-feature-choice]').value;
      if (value.startsWith('link:')) {
        const id = value.slice(5),
          screen = rowsOf('screens')[Number(d.screen)];
        if (
          !screen ||
          !rowsOf('features').some((f) => f.id === id) ||
          !connectFeature(screen, d.flowScope, id)
        )
          return;
        changed(true);
        focusFeature(d.screen, d.flowScope, id);
        return;
      }
      const type = featureTypes.find((f) => 'type:' + f.id === value);
      if (!type) return;
      d.feature = type.id;
    }
    if (d.designerScreen !== undefined) return showDesigner('screen', '', d.designerScreen);
    if (d.createCommon !== undefined) {
      if (rowsOf('screens').length >= A.MAX_ROWS)
        return toast('공통 화면을 추가하려면 사용하지 않는 화면 하나를 먼저 삭제해 주세요.');
      ensureCommonScreen();
      changed(true);
      return;
    }

    if (d.canvasElement) return showDesigner('element', d.canvasElement, d.canvasOwner);
    if (d.levelHelp !== undefined)
      return showHelp('요소 레벨', {
        meaning:
          '레벨 숫자가 높을수록 앞에 표시돼요. 요소를 선택하거나 같은 구역 안에서 위치를 옮겨도 겹침 순서는 바뀌지 않아요.',
        fit: '↑로 레벨을 높이고 ↓로 낮춰요. 요소 보기에서 전체를 끄고 필요한 레벨만 켜면 가려진 요소를 편집하기 쉬워요. 보기 선택은 화면마다 따로 유지되고 초안·백업에는 영향을 주지 않아요.',
        avoid:
          '같은 구역·같은 부모 안에서 순서를 바꿔요. 안에 넣은 요소는 부모 묶음 안에서 겹쳐져요. 공통 요소는 기본 공통 화면에서 조절하세요.'
      });
    if (d.levelMove) {
      const { screen, element } = D.selection(answers, designerState),
        order = A.elementKeys(screen);
      const items = A.layoutItems(
        screen,
        rowsOf('screens').find((s) => s.isCommon)
      );
      const current = items.find((item) => item.key === element);
      if (!current) return;
      const siblings = items
        .filter(
          (item) =>
            !item.inherited &&
            item.parent === current.parent &&
            (current.parent || item.region === current.region)
        )
        .map((item) => item.key);
      const neighbor = siblings[siblings.indexOf(element) + Number(d.levelMove)];
      const from = order.indexOf(element),
        to = order.indexOf(neighbor);
      if (from < 0 || to < 0) return;
      [order[from], order[to]] = [order[to], order[from]];
      keepCanvasPositions(screen, canvasPositions(screen));
      screen.layoutOrder = order;
      if (designerState.hiddenElements?.[screen.id])
        designerState.hiddenElements[screen.id] = designerState.hiddenElements[screen.id].filter(
          (key) => key !== element
        );
      changed(true);
      (
        document.querySelector(`[data-level-move="${d.levelMove}"]:not(:disabled)`) ||
        document.querySelector('[data-level-move]:not(:disabled)')
      )?.focus({ preventScroll: true });
      return;
    }
    if (d.designerRemoveElement !== undefined) {
      const { screen, element } = D.selection(answers, designerState);
      if (!element) return;
      if (element.startsWith('custom:')) {
        if (!window.confirm('이 요소와 작성한 내용을 삭제할까요?')) return;
        keepCanvasPositions(screen, canvasPositions(screen));
        detachChildren(screen, element);
        screen.customElements = screen.customElements.filter((el) => el.id !== element.slice(7));
        screen.layoutOrder = (screen.layoutOrder || []).filter((key) => key !== element);
        if (screen.placements) delete screen.placements[element];
      } else {
        keepCanvasPositions(screen, canvasPositions(screen));
        screen.elements = screen.elements.filter((id) => id !== element);
      }
      designerState.element = '';
      designerState.panel = 'element';
      changed(true);
      $('#inspector-title')?.focus({ preventScroll: true });
      return;
    }
    if (d.editRoles !== undefined) {
      renderStep(
        steps.findIndex((s) => s.id === 'users'),
        true
      );
      document.getElementById('field-roles')?.scrollIntoView({ block: 'start' });
      document.querySelector('[data-role-preset]')?.focus({ preventScroll: true });
      return;
    }
    if (d.step !== undefined) return renderStep(Number(d.step), true);
    if (d.help) {
      const q = questions.get(d.help),
        option = A.choiceOptions(q, answers[q.id])[Number(d.option)];
      return showHelp(option, window.BriefGuides.get(q, option));
    }
    if (d.featureHelp) {
      const f = featureTypes.find((f) => f.id === d.featureHelp);
      return showHelp(f.label, window.BriefGuides.get('features', f.id));
    }
    if (d.elementHelp) {
      const el = uiElements.find((e) => e.id === d.elementHelp);
      const guide = d.elementChoice
        ? el?.detail?.options.find((o) => o.id === d.elementChoice)
        : el;
      if (guide) showHelp(guide.label, guide, d.elementChoice ? '' : el.id);
      return;
    }
    if (d.unlinkFeature) {
      const screen = rowsOf('screens')[Number(d.screen)];
      if (!screen) return;
      if (d.flowScope) {
        const plan = flowTarget(screen, d.flowScope);
        if (!plan) return;
        plan.featureIds = (plan.featureIds || []).filter((id) => id !== d.unlinkFeature);
        for (const action of plan.flow || [])
          if (action.featureId === d.unlinkFeature) action.featureId = '';
        changed(true);
        toast('요소에서 연결을 해제했어요. 작성한 동작은 남겨 두었어요.');
        return;
      }
      screen.featureIds = (screen.featureIds || []).filter((id) => id !== d.unlinkFeature);
      for (const plan of [
        ...Object.values(screen.elementContents || {}),
        ...(screen.customElements || [])
      ])
        plan.featureIds = (plan.featureIds || []).filter((id) => id !== d.unlinkFeature);
      for (const plan of [
        screen,
        ...Object.values(screen.elementContents || {}),
        ...(screen.customElements || [])
      ])
        for (const action of plan.flow || [])
          if (action.featureId === d.unlinkFeature) action.featureId = '';
      changed(true);
      toast('이 화면에서 연결을 해제했어요. 기능 내용은 그대로 남아 있어요.');
      return;
    }
    if (d.flowAdd !== undefined || d.flowRemove !== undefined || d.flowMove !== undefined) {
      const screen = rowsOf('screens')[Number(d.screen)];
      const plan = flowTarget(screen, d.flowScope);
      if (!plan) return;
      const rows = (plan.flow ||= []);
      let focusId = '';
      if (d.flowAdd !== undefined) {
        if (rows.length >= A.MAX_ROWS)
          return toast(`한곳에 최대 ${A.MAX_ROWS}개 동작을 기록할 수 있어요.`);
        const action = {
          id: P.newId(),
          event: '',
          featureId: d.flowFeature || '',
          nextScreenId: '',
          result: ''
        };
        rows.push(action);
        focusId = action.id;
      } else if (d.flowRemove !== undefined) {
        if (!rows[Number(d.flowRemove)] || !window.confirm('이 동작과 작성한 내용을 삭제할까요?'))
          return;
        rows.splice(Number(d.flowRemove), 1);
      } else {
        const from = Number(d.flowMove);
        const indices = rows
          .map((action, index) => ({ action, index }))
          .filter(({ action }) =>
            d.flowFeature
              ? action.featureId === d.flowFeature
              : !action.featureId || !rowsOf('features').some((f) => f.id === action.featureId)
          )
          .map(({ index }) => index);
        const to = indices[indices.indexOf(from) + Number(d.direction)];
        if (!rows[from] || !rows[to]) return;
        [rows[from], rows[to]] = [rows[to], rows[from]];
        focusId = rows[to].id;
      }
      changed(true);
      const panel = document.getElementById(
        `flow-${screen.id}-${d.flowScope || ''}${d.flowFeature ? '-' + d.flowFeature : ''}`
      );
      if (!panel) {
        document
          .querySelector(
            `[data-feature-choice][data-screen="${d.screen}"][data-flow-scope="${d.flowScope}"]`
          )
          ?.focus({ preventScroll: true });
        return;
      }
      if (panel.tagName === 'DETAILS') panel.open = true;
      const target = focusId
        ? document
            .getElementById(`flow-row-${screen.id}-${d.flowScope || ''}-${focusId}`)
            ?.querySelector('input')
        : panel.querySelector('[data-flow-add]');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
      return;
    }
    if (d.addElement !== undefined) {
      const screen = rowsOf('screens')[Number(d.screen)];
      if (!screen) return;
      screen.customElements ||= [];
      if (screen.customElements.length >= A.MAX_ROWS)
        return toast('한 화면에 추가할 수 있는 요소 수를 초과했어요.');
      const item = { id: P.newId(), name: A.nextName(screen.customElements, '요소'), purpose: '' };
      const selected = D.selection(answers, designerState).element;
      const placement = selected ? A.elementPlacement(screen, selected) : { region: 'main' };
      const positions = canvasPositions(screen);
      screen.customElements.push(item);
      if (
        !placeElement(
          screen,
          'custom:' + item.id,
          d.target ||
            (placement.parent ? 'parent:' + placement.parent : 'region:' + placement.region)
        )
      ) {
        screen.customElements.pop();
        return toast('추가할 위치를 다시 선택해 주세요.');
      }
      keepCanvasPositions(screen, positions);
      const created = screen.placements['custom:' + item.id];
      const canvas = [...document.querySelectorAll('.canvas-grid')].find((grid) =>
        created.parent
          ? grid.dataset.dropParent === created.parent
          : grid.dataset.dropRegion === created.region
      );
      if (canvas?.clientWidth)
        created.width = Number(Math.max(1, Math.min(100, 24000 / canvas.clientWidth)).toFixed(4));
      designerState = {
        ...designerState,
        screenId: screen.id,
        element: 'custom:' + item.id,
        panel: 'element',
        panelCollapsed: false
      };
      changed(true);
      const nameInput = $('#designer-inspector-body')?.querySelector('[data-property="name"]');
      nameInput?.focus({ preventScroll: true });
      nameInput?.select();
      if (window.matchMedia('(max-width:800px)').matches)
        $('#designer-inspector-body')?.scrollIntoView({ block: 'start' });
      return;
    }
    if (d.feature || d.add || d.rolePreset !== undefined) {
      const qid = d.rolePreset !== undefined ? 'roles' : d.feature ? 'features' : d.add,
        rows = rowsOf(qid);
      if (rows.length >= A.MAX_ROWS)
        return toast(`한 목록에는 최대 ${A.MAX_ROWS}개까지 추가할 수 있어요.`);
      let row = { id: P.newId() };
      if (qid === 'roles') {
        const name = d.rolePreset === undefined ? '' : Q.rolePresets[Number(d.rolePreset)];
        if (name === undefined || (name && rows.some((r) => r.role.trim() === name))) return;
        row = { ...row, role: name, actions: '', data: '' };
      }
      if (qid === 'features')
        row = {
          ...row,
          category: d.feature || 'custom',
          name:
            d.feature === 'custom' ? '' : featureTypes.find((f) => f.id === d.feature)?.label || '',
          actor: '',
          outcome: '',
          priority: '',
          notes: ''
        };
      if (qid === 'screens')
        row = {
          ...row,
          name: A.nextName(
            rows.filter((row) => !row.isCommon),
            '새 화면 '
          ),
          purpose: '',
          roles: '',
          featureIds: [],
          elements: [],
          elementNotes: {},
          elementOptions: {},
          customElements: [],
          content: '',
          empty: '',
          error: '',
          mobile: ''
        };
      const screen =
        qid === 'features' && d.screen !== undefined && d.screen !== ''
          ? rowsOf('screens')[Number(d.screen)]
          : null;
      if (screen && !connectFeature(screen, d.flowScope, row.id)) return;
      answers[qid] = [...rows, row];
      if (qid === 'screens')
        designerState = {
          ...designerState,
          screenId: row.id,
          element: '',
          panel: 'screen',
          panelCollapsed: false
        };
      changed(true);
      if (screen) {
        focusFeature(d.screen, d.flowScope, row.id);
        return;
      }
      const card = document.getElementById(
        qid === 'features'
          ? `feature-${screen ? d.screen : 'shared'}-${row.id}`
          : qid === 'screens'
            ? 'designer-inspector-body'
            : `row-${qid}-${rows.length}`
      );
      card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      card?.querySelector('input,textarea,select')?.focus({ preventScroll: true });
      if (qid === 'screens') card?.querySelector('[data-field="name"]')?.select();
      return;
    }
    if (d.remove) {
      const rows = rowsOf(d.remove),
        index = Number(d.index);
      if (d.remove === 'screens' && rows[index]?.isCommon) return;
      const message =
        d.remove === 'roles'
          ? '이 역할을 삭제할까요? 이 역할을 선택한 화면은 다시 확인해야 해요.'
          : d.remove === 'features'
            ? '이 기능을 삭제할까요? 모든 화면·요소의 연결에 영향을 줘요. 한 곳에서만 빼려면 연결 해제를 사용하세요.'
            : d.remove === 'screens'
              ? `‘${A.screenLabel(rows, rows[index] || {})}’ 화면과 요소 설정을 삭제할까요? 연결했던 기능은 남겨 두어요.`
              : '이 항목을 삭제할까요? 작성한 내용도 함께 삭제돼요.';
      if (rows[index] && window.confirm(message)) {
        let returnTo =
          d.remove === 'features'
            ? '[id="' +
              (b.closest('.element-functions')?.querySelector('[data-feature-choice]')?.id ||
                'feature-choice-shared') +
              '"]'
            : `[data-add="${d.remove}"]`;
        if (d.remove === 'screens') {
          const selected = D.selection(answers, designerState).screen;
          const next =
            selected.id === rows[index].id ? rows[index + 1] || rows[index - 1] : selected;
          if (selected.id === rows[index].id)
            designerState = {
              ...designerState,
              screenId: next?.id || '',
              element: '',
              panel: 'screen'
            };
          if (next) returnTo = `[data-designer-screen="${next.id}"]`;
        }
        answers[d.remove] = rows.filter((_, i) => i !== index);
        changed(true);
        document.querySelector(returnTo)?.focus({ preventScroll: true });
      }
      return;
    }
    if (d.clear) {
      delete answers[d.clear];
      return changed(true);
    }
    if (d.projectOpen) {
      if (commitProjects({ ...collectWorkspace(), activeId: d.projectOpen }))
        $('#projects-dialog').close();
      return;
    }
    if (d.projectRename) return nameProject(d.projectRename);
    if (d.projectBackup) return backupProject(d.projectBackup);
    if (d.projectDelete) {
      $('#delete-project-dialog').dataset.project = d.projectDelete;
      $('#delete-project-name').textContent = P.projectTitle(
        storage.workspace.projects.find((p) => p.id === d.projectDelete)
      );
      $('#delete-project-error').textContent = '';
      return $('#delete-project-dialog').showModal();
    }
    switch (b.id) {
      case 'show-prompt':
        $('#prompt-dialog').innerHTML = V.prompt(
          answers,
          notes,
          recommendations,
          planningTemplate,
          promptDrafts
        );
        updatePrompt(false);
        $('#prompt-dialog').showModal();
        $('#prompt-title').focus({ preventScroll: true });
        return;
      case 'close-prompt':
        return $('#prompt-dialog').close();
      case 'prompt-mode-help': {
        const panel = $('#prompt-mode-comparison');
        panel.hidden = !panel.hidden;
        b.setAttribute('aria-expanded', String(!panel.hidden));
        return;
      }
      case 'reset-prompt':
        if (
          !window.confirm(
            '이 모드의 수정 내용을 지우고 현재 답변과 원래 템플릿으로 복원할까요? 다른 모드의 수정 내용과 질문 답변은 유지돼요.'
          )
        )
          return;
        delete promptDrafts[planningTemplate?.enabled ? 'advanced' : 'basic'];
        if (planningTemplate?.enabled)
          planningTemplate = { enabled: true, version: T.version, text: T.text };
        updatePrompt();
        $('#prompt-preview-text').focus();
        return;
      case 'guide-button':
        return showGuide();
      case 'start-planning':
        return renderStep(0, true);
      case 'previous-button':
        return renderStep(currentStep - 1, true);
      case 'report-button':
      case 'mobile-report-button':
        return renderReport();
      case 'back-to-form':
        markStarted();
        save();
        $('#form-view').hidden = false;
        $('#report-view').hidden = true;
        setNavigation(false);
        $('#page-title').tabIndex = -1;
        $('#page-title').focus({ preventScroll: true });
        window.scrollTo({ top: formScrollY, behavior: 'instant' });
        return;
      case 'toggle-navigation':
        return setNavigation($('#sidebar').dataset.open !== 'true');
      case 'save-help-button':
        return $('#storage-help-dialog').showModal();
      case 'close-storage-help':
        return $('#storage-help-dialog').close();
      case 'close-option-help':
        return $('#option-help-dialog').close();
      case 'manage-projects':
        $('#projects-error').textContent = '';
        renderProjects();
        return $('#projects-dialog').showModal();
      case 'close-projects':
        return $('#projects-dialog').close();
      case 'add-project':
      case 'create-project':
        return nameProject();
      case 'cancel-project-name':
        return $('#project-name-dialog').close();
      case 'cancel-delete-project':
        return $('#delete-project-dialog').close();
      case 'confirm-delete-project': {
        const id = $('#delete-project-dialog').dataset.project,
          next = collectWorkspace();
        next.projects = next.projects.filter((p) => p.id !== id);
        if (!next.projects.length) next.projects.push(P.createProject());
        if (next.activeId === id) next.activeId = next.projects[0].id;
        if (commitProjects(next)) {
          $('#delete-project-dialog').close();
          renderProjects();
        }
        return;
      }
      case 'export-all-projects':
        return download(
          JSON.stringify(
            {
              format: 'buildbrief-ideas',
              ...collectWorkspace(),
              exportedAt: new Date().toISOString()
            },
            null,
            2
          ),
          'json',
          '전체백업',
          'buildbrief'
        );
      case 'export-answers':
      case 'storage-backup':
        return backupProject();
      case 'storage-original':
        if (storage.originalStorage !== null)
          download(storage.originalStorage, 'json', '복구용원본');
        return;
      case 'import-answers':
        return $('#import-file').click();
      case 'download-report':
        return download(R.report(answers, false, notes, recommendations), 'md', '기획초안');
      case 'copy-prompt': {
        if (b.disabled) return;
        const text = $('#prompt-preview-text').value;
        try {
          await navigator.clipboard.writeText(text);
          $('#prompt-copy-status').textContent = '복사했어요. 원하는 AI 대화에 붙여 넣으세요.';
        } catch {
          download(text, 'md', 'AI기획요청');
          $('#prompt-copy-status').textContent =
            '복사가 허용되지 않아 프롬프트를 파일로 내려받았어요.';
        }
        return;
      }
    }
  });
  $('#import-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error('16MB 이하의 백업 파일을 선택해 주세요.');
      const incoming = P.importBackup(JSON.parse(await file.text()));
      if (
        storage.loadFailed &&
        !window.confirm(
          '읽지 못한 저장 원본을 백업으로 복구할까요? 먼저 저장 안내에서 원본과 새로 입력한 내용을 각각 백업해 주세요.'
        )
      )
        return;
      if (
        commitProjects(
          {
            ...incoming,
            projects: [
              ...(storage.loadFailed ? [] : collectWorkspace().projects),
              ...incoming.projects
            ]
          },
          storage.loadFailed
        )
      )
        toast(`백업에서 프로젝트 ${incoming.projects.length}개를 추가했어요.`);
    } catch (error) {
      toast(error instanceof SyntaxError ? '올바른 JSON 백업 파일이 아니에요.' : error.message);
    } finally {
      event.target.value = '';
    }
  });
  $('.brand').addEventListener('click', (event) => {
    event.preventDefault();
    showGuide();
  });
  $('#guide-details-link').addEventListener('click', () => {
    $('#guide-walkthrough').open = true;
  });
  const exampleTrack = $('#guide-examples');
  const examples = [...exampleTrack.children];
  let exampleIndex = 0;
  function showExample(index) {
    const target = examples[Math.max(0, Math.min(examples.length - 1, index))];
    const track = exampleTrack.getBoundingClientRect();
    const card = target.getBoundingClientRect();
    exampleTrack.scrollTo({
      left: exampleTrack.scrollLeft + card.left + card.width / 2 - track.left - track.width / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
  }
  exampleTrack.addEventListener(
    'scroll',
    () => {
      const track = exampleTrack.getBoundingClientRect();
      const distances = examples.map((example) => {
        const card = example.getBoundingClientRect();
        return Math.abs(card.left + card.width / 2 - track.left - track.width / 2);
      });
      const index = distances.indexOf(Math.min(...distances));
      if (index === exampleIndex) return;
      exampleIndex = index;
      examples.forEach((example, i) => example.classList.toggle('is-current', i === index));
      $('#guide-example-previous').disabled = index === 0;
      $('#guide-example-next').disabled = index === examples.length - 1;
      $('#guide-example-status').textContent = `${index + 1} / ${examples.length}`;
    },
    { passive: true }
  );
  $('#guide-example-previous').addEventListener('click', () => showExample(exampleIndex - 1));
  $('#guide-example-next').addEventListener('click', () => showExample(exampleIndex + 1));
  exampleTrack.addEventListener('keydown', (event) => {
    const index = {
      ArrowLeft: exampleIndex - 1,
      ArrowRight: exampleIndex + 1,
      Home: 0,
      End: examples.length - 1
    }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    showExample(index);
  });
  exampleTrack.addEventListener('click', (event) => {
    const index = examples.indexOf(event.target.closest('.guide-example'));
    if (index !== -1 && index !== exampleIndex) showExample(index);
  });
  document.addEventListener('keydown', (event) => {
    const picker = event.target.closest('.role-picker[open]');
    if (event.key === 'Escape' && picker) {
      event.preventDefault();
      picker.open = false;
      picker.querySelector('summary').focus();
      return;
    }
    if (event.key === 'Escape' && $('#sidebar').dataset.open === 'true') {
      setNavigation(false);
      $('#toggle-navigation').focus();
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === P.KEY || event.key === null) {
      storage.externalChange = true;
      status('다른 탭 변경 · 백업 후 새로고침');
      toast('자동 저장을 멈췄어요. 이 탭의 답변을 백업한 뒤 새로고침해 주세요.');
    }
  });
  window.addEventListener('resize', () => D.applySizes());
  for (const [selector, property] of [
    ['.topbar', '--topbar-height'],
    ['.mobile-navigation', '--mobile-nav-height'],
    ['.mobile-report', '--actionbar-height']
  ]) {
    const bar = $(selector);
    new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        property,
        `${Math.ceil(bar.getBoundingClientRect().height)}px`
      )
    ).observe(bar);
  }
  const firstVisit = !storage.loadFailed && storage.storedRaw === null;
  if (firstVisit) save();
  else if (!storage.loadFailed) status('이 브라우저에 저장됨');
  renderStep(currentStep);
  showGuide(false);
  if (storage.loadFailed) {
    status('저장 읽기 실패 · 원본 보존 중');
    toast('기존 저장 내용을 읽지 못했어요. 저장 안내에서 원본을 백업할 수 있어요.');
  }
})();
