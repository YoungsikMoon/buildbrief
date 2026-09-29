(() => {
  'use strict';
  const Q = window.BriefQuestions,
    A = window.BriefAnswers,
    R = window.BriefReport,
    P = window.BriefProjects,
    S = window.BriefStorage,
    V = window.BriefViews,
    D = window.BriefDesigner;
  const { steps, featureTypes, uiElements } = Q;
  const $ = (selector) => document.querySelector(selector);
  const esc = V.escapeHtml;
  const questions = new Map(A.allQuestions.map((q) => [q.id, q]));
  const storage = S.load();
  let answers, drafts, notes, recommendations, currentStep;
  let designerState = {},
    draggedElement = null;
  let toastTimer,
    formScrollY = 0;
  activateProject();
  function activateProject() {
    const p = storage.workspace.projects.find((p) => p.id === storage.workspace.activeId);
    ({ answers, drafts, notes, recommendations = [] } = p);
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
          ? { ...p, answers, drafts, notes, recommendations, step: currentStep, topic: '' }
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
      screenId: screenId || selected.screen.id,
      element: element === undefined ? selected.element : element,
      panel
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
  function moveCanvasElement(key, region, before = '') {
    const { screen } = D.selection(answers, designerState);
    const order = A.elementKeys(screen);
    if (before === key || !order.includes(key) || !Q.layoutRegions.some((r) => r.id === region))
      return;
    const next = order.filter((id) => id !== key);
    next.splice(before && next.includes(before) ? next.indexOf(before) : next.length, 0, key);
    screen.layoutOrder = next;
    screen.placements ||= {};
    screen.placements[key] = { ...A.elementPlacement(screen, key), region };
    changed(true);
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
      designerState = { screenId: screen.id, element: scope || '', panel: 'settings' };
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
    document.body.classList.remove('designing');
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
    if (step.id === 'screens') ensureCommonScreen();
    $('#guide-view').hidden = true;
    $('#form-view').hidden = false;
    $('#report-view').hidden = true;
    $('#page-title').textContent = step.title;
    $('#page-description').textContent = step.description;
    $('#step-badge').textContent = `${currentStep + 1} / ${steps.length}`;
    $('#start-note').hidden = currentStep !== 0;
    renderNavigation();
    $('#question-groups').innerHTML = A.activeGroups(step, answers, notes)
      .map(
        (g, groupIndex) =>
          /* HTML */ `${step.id === 'screens' && !g.questions.some((q) => q.id === 'screens')
              ? '<details class="designer-related" id="designer-topic-' +
                groupIndex +
                '"><summary>' +
                esc(g.title || '추가 기획') +
                '</summary>'
              : ''}<section class="question-group"
              >${g.title
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
            >${step.id === 'screens' && !g.questions.some((q) => q.id === 'screens')
              ? '</details>'
              : ''}`
      )
      .join('');
    for (const [id, open] of states) {
      const el = document.getElementById(id);
      if (el) el.open = open;
    }
    $('#previous-button').disabled = currentStep === 0;
    $('#next-button').textContent =
      currentStep === steps.length - 1 ? '기획 초안 보기 →' : '다음 단계 →';
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
    $('#option-help-dialog').showModal();
    $('#option-help-dialog').scrollTop = 0;
  }
  function renderReport() {
    document.body.classList.remove('designing');
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
    if (el.dataset.designerPlacement) {
      const { screen, element } = D.selection(answers, designerState);
      const key = el.dataset.designerPlacement;
      if (
        !element ||
        !(key === 'region'
          ? Q.layoutRegions.some((r) => r.id === el.value)
          : key === 'width' && ['full', 'half'].includes(el.value))
      )
        return;
      screen.placements ||= {};
      screen.placements[element] = { ...A.elementPlacement(screen, element), [key]: el.value };
      changed(true);
      document.querySelector(`[data-designer-placement="${key}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (el.matches('select[data-link-feature]')) {
      const screen = rowsOf('screens')[Number(el.dataset.screen)];
      if (screen && rowsOf('features').some((f) => f.id === el.value)) {
        if (!connectFeature(screen, el.dataset.flowScope, el.value)) return;
        changed(true);
        focusFeature(el.dataset.screen, el.dataset.flowScope, el.value);
      }
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
      if (!Q.elementContentTypes.includes(element)) return;
      object.elementContents ||= {};
      const plan = (object.elementContents[element] ||= { items: [], featureIds: [] });
      const target = item === undefined ? plan : plan.items[Number(item)];
      if (!target) return;
      if (property === 'featureIds') {
        const values = plan.featureIds || [];
        plan.featureIds = el.checked
          ? [...new Set([...values, el.value])]
          : values.filter((id) => id !== el.value);
        if (el.checked) object.featureIds = [...new Set([...(object.featureIds || []), el.value])];
      } else target[property] = el.type === 'checkbox' ? el.checked : el.value;
    } else if (qid === 'features' && field === 'recommendPermission') {
      object.recommendPermission = el.checked;
    } else if (field === 'customElements') {
      const item = object.customElements?.[Number(custom)];
      if (!item || !['name', 'purpose'].includes(property)) return;
      item[property] = el.value;
    } else if (field === 'elementOptions') {
      const detail = uiElements.find((item) => item.id === element)?.detail;
      if (!detail) return;
      object.elementOptions ||= {};
      const values = object.elementOptions[element] || [];
      object.elementOptions[element] = detail.multiple
        ? el.checked
          ? [...new Set([...values, el.value])]
          : values.filter((v) => v !== el.value)
        : el.value
          ? [el.value]
          : [];
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
          title.textContent = el.value || (qid === 'features' ? '새 기능' : '새 화면');
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
      const tab = document.querySelector(`[data-designer-screen="${object.id}"]`);
      if (tab && !object.isCommon && field === 'name') {
        tab.textContent = object.name || '새 화면';
        tab.parentElement
          .querySelector('.screen-tab-close')
          ?.setAttribute('aria-label', `${object.name || '새 화면'} 삭제`);
      }
      if (current.screen.id === object.id && field === 'name')
        document.querySelector('.canvas-chrome span:last-child').textContent =
          object.name || '새 화면';
      document.querySelectorAll('[data-canvas-element]').forEach((block) => {
        if (block.dataset.canvasOwner !== object.id) return;
        const scope = block.dataset.canvasElement;
        block.querySelector('.wire-preview').innerHTML = D.preview(object, scope);
        if (!block.classList.contains('inherited'))
          block.querySelector('.canvas-block-title').textContent = D.elementName(object, scope);
      });
      if (current.element && field === 'customElements' && property === 'name')
        $('#inspector-title').textContent = D.elementName(object, current.element);
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
  document.addEventListener('dragstart', (event) => {
    const block = event.target.closest('[data-canvas-element][draggable="true"]');
    if (!block) return;
    draggedElement = { screenId: block.dataset.canvasOwner, key: block.dataset.canvasElement };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedElement.key);
  });
  document.addEventListener('dragover', (event) => {
    const zone = event.target.closest('[data-drop-region]');
    if (
      !zone ||
      !draggedElement ||
      draggedElement.screenId !== D.selection(answers, designerState).screen.id
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drop-active').forEach((el) => el.classList.remove('drop-active'));
    zone.classList.add('drop-active');
  });
  document.addEventListener('drop', (event) => {
    const zone = event.target.closest('[data-drop-region]');
    if (
      !zone ||
      !draggedElement ||
      draggedElement.screenId !== D.selection(answers, designerState).screen.id
    )
      return;
    event.preventDefault();
    const before = event.target.closest('[data-canvas-element]');
    moveCanvasElement(
      draggedElement.key,
      zone.dataset.dropRegion,
      before?.dataset.canvasOwner === draggedElement.screenId ? before.dataset.canvasElement : ''
    );
    draggedElement = null;
  });
  document.addEventListener('dragend', () => {
    draggedElement = null;
    document.querySelectorAll('.drop-active').forEach((el) => el.classList.remove('drop-active'));
  });
  document.addEventListener('click', async (event) => {
    document.querySelectorAll('.role-picker[open]').forEach((picker) => {
      if (!picker.contains(event.target)) picker.open = false;
    });
    const b = event.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.designerScreen !== undefined) return showDesigner('elements', '', d.designerScreen);
    if (d.createCommon !== undefined) {
      if (rowsOf('screens').length >= A.MAX_ROWS)
        return toast('공통 화면을 추가하려면 사용하지 않는 화면 하나를 먼저 삭제해 주세요.');
      ensureCommonScreen();
      changed(true);
      return;
    }
    if (d.designerPanel) return showDesigner(d.designerPanel);
    if (d.designerSettings !== undefined) return showDesigner('settings', '');
    if (d.canvasElement) return showDesigner('settings', d.canvasElement, d.canvasOwner);
    if (d.insertElement) {
      const { screen } = D.selection(answers, designerState);
      const common = rowsOf('screens').find((s) => s.isCommon);
      if (!screen.id || !uiElements.some((el) => el.id === d.insertElement)) return;
      if (
        !screen.isCommon &&
        screen.useCommonLayout !== false &&
        !(screen.elements || []).includes(d.insertElement) &&
        common?.elements?.includes(d.insertElement)
      )
        return showDesigner('settings', d.insertElement, common.id);
      screen.elements = [...new Set([...(screen.elements || []), d.insertElement])];
      designerState = { screenId: screen.id, element: d.insertElement, panel: 'settings' };
      changed(true);
      $('#inspector-title')?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 800px)').matches)
        $('#designer-inspector-body')?.scrollIntoView({ block: 'start' });
      return;
    }
    if (d.designerMove) {
      const { screen, element } = D.selection(answers, designerState),
        order = A.elementKeys(screen);
      const from = order.indexOf(element),
        to = from + Number(d.designerMove);
      if (from < 0 || to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      screen.layoutOrder = order;
      changed(true);
      (
        document.querySelector(`[data-designer-move="${d.designerMove}"]:not(:disabled)`) ||
        document.querySelector('[data-designer-move]:not(:disabled)')
      )?.focus({ preventScroll: true });
      return;
    }
    if (d.designerRemoveElement !== undefined) {
      const { screen, element } = D.selection(answers, designerState);
      if (!element) return;
      if (element.startsWith('custom:')) {
        if (!window.confirm('이 요소와 작성한 내용을 삭제할까요?')) return;
        screen.customElements = screen.customElements.filter((el) => el.id !== element.slice(7));
        screen.layoutOrder = (screen.layoutOrder || []).filter((key) => key !== element);
        if (screen.placements) delete screen.placements[element];
      } else screen.elements = screen.elements.filter((id) => id !== element);
      designerState.element = '';
      designerState.panel = 'elements';
      changed(true);
      $('#inspector-title')?.focus({ preventScroll: true });
      return;
    }
    if (d.featureCatalogTarget) {
      const panel = document.getElementById(d.featureCatalogTarget);
      panel.hidden = !panel.hidden;
      b.setAttribute('aria-expanded', String(!panel.hidden));
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
            `[data-feature-catalog-target="feature-catalog-${d.screen}-${d.flowScope}"]`
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
    if (
      d.contentAdd !== undefined ||
      d.contentRemove !== undefined ||
      d.contentMove !== undefined
    ) {
      const screen = rowsOf('screens')[Number(d.screen)];
      if (!screen || !Q.elementContentTypes.includes(d.element) || d.element === 'button') return;
      screen.elementContents ||= {};
      const plan = (screen.elementContents[d.element] ||= { items: [], featureIds: [] });
      const items = (plan.items ||= []);
      let focusId = '';
      if (d.contentAdd !== undefined) {
        if (items.length >= A.MAX_ROWS)
          return toast(`요소마다 최대 ${A.MAX_ROWS}개 항목을 기록할 수 있어요.`);
        const item = { id: P.newId(), name: '', notes: '' };
        items.push(item);
        focusId = item.id;
      } else if (d.contentRemove !== undefined) {
        if (
          !items[Number(d.contentRemove)] ||
          !window.confirm('이 항목과 작성한 내용을 삭제할까요?')
        )
          return;
        items.splice(Number(d.contentRemove), 1);
      } else {
        const from = Number(d.contentMove),
          to = from + Number(d.direction);
        if (!items[from] || !items[to]) return;
        [items[from], items[to]] = [items[to], items[from]];
        focusId = items[to].id;
      }
      changed(true);
      const target = focusId
        ? document
            .getElementById(`content-${screen.id}-${d.element}-${focusId}`)
            ?.querySelector('input')
        : document.querySelector(
            `[data-content-add][data-screen="${d.screen}"][data-element="${d.element}"]`
          );
      target?.focus({ preventScroll: true });
      if (focusId) target?.scrollIntoView({ block: 'center' });
      return;
    }
    if (d.addElement !== undefined || d.removeElement !== undefined) {
      const index = Number(d.screen),
        screen = rowsOf('screens')[index];
      if (!screen) return;
      screen.customElements ||= [];
      if (d.addElement !== undefined) {
        if (screen.customElements.length >= A.MAX_ROWS)
          return toast(`직접 추가하는 요소는 화면마다 최대 ${A.MAX_ROWS}개까지 기록할 수 있어요.`);
        const item = { id: P.newId(), name: '', purpose: '' };
        screen.customElements.push(item);
        designerState = { screenId: screen.id, element: 'custom:' + item.id, panel: 'settings' };
        changed(true);
        $('#designer-inspector-body')
          ?.querySelector('[data-property="name"]')
          ?.focus({ preventScroll: true });
      } else if (
        screen.customElements[Number(d.removeElement)] &&
        window.confirm('이 요소를 삭제할까요? 이름과 용도도 함께 삭제돼요.')
      ) {
        const key = 'custom:' + screen.customElements[Number(d.removeElement)].id;
        screen.customElements.splice(Number(d.removeElement), 1);
        screen.layoutOrder = (screen.layoutOrder || []).filter((id) => id !== key);
        if (screen.placements) delete screen.placements[key];
        changed(true);
        document
          .querySelector(`[data-add-element][data-screen="${index}"]`)
          ?.focus({ preventScroll: true });
      }
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
          name: '',
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
      if (qid === 'screens') designerState = { screenId: row.id, element: '', panel: 'settings' };
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
              ? `‘${rows[index]?.name || '새 화면'}’ 화면과 요소 설정을 삭제할까요? 연결했던 기능은 남겨 두어요.`
              : '이 항목을 삭제할까요? 작성한 내용도 함께 삭제돼요.';
      if (rows[index] && window.confirm(message)) {
        let returnTo =
          d.remove === 'features'
            ? `[data-feature-catalog-target="${b.closest('.element-functions')?.querySelector('[data-feature-catalog-target]')?.dataset.featureCatalogTarget || 'feature-catalog-shared'}"]`
            : `[data-add="${d.remove}"]`;
        if (d.remove === 'screens') {
          const selected = D.selection(answers, designerState).screen;
          const next =
            selected.id === rows[index].id ? rows[index + 1] || rows[index - 1] : selected;
          if (selected.id === rows[index].id)
            designerState = { screenId: next?.id || '', element: '', panel: 'elements' };
          if (next) returnTo = `[data-designer-screen="${next.id}"]`;
        }
        answers[d.remove] = rows.filter((_, i) => i !== index);
        changed(true);
        document.querySelector(returnTo)?.focus({ preventScroll: true });
      }
      return;
    }
    if (d.clearElement) {
      const screen = rowsOf('screens')[Number(d.screen)];
      if (!screen || !uiElements.some((el) => el.id === d.clearElement)) return;
      screen.elementOptions ||= {};
      screen.elementOptions[d.clearElement] = [];
      changed(true);
      document
        .querySelector(
          `[data-row="${d.screen}"][data-field="elementOptions"][data-element="${d.clearElement}"]`
        )
        ?.focus({ preventScroll: true });
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
      case 'copy-prompt':
        try {
          await navigator.clipboard.writeText(R.report(answers, true, notes, recommendations));
          toast('기획 초안과 AI에게 전달할 요청을 복사했어요.');
        } catch {
          download(R.report(answers, true, notes, recommendations), 'md', 'AI기획요청');
          toast('복사가 허용되지 않아 파일로 내려받았어요.');
        }
        return;
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
