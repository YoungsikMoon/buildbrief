(() => {
  'use strict';
  const Q = window.BriefQuestions,
    A = window.BriefAnswers,
    R = window.BriefReport,
    P = window.BriefProjects,
    S = window.BriefStorage,
    V = window.BriefViews;
  const { steps, featureTypes, uiElements } = Q;
  const $ = (selector) => document.querySelector(selector);
  const esc = V.escapeHtml;
  const questions = new Map(A.allQuestions.map((q) => [q.id, q]));
  const storage = S.load();
  let answers, drafts, notes, recommendations, currentStep;
  let toastTimer,
    formScrollY = 0;
  activateProject();
  function activateProject() {
    const p = storage.workspace.projects.find((p) => p.id === storage.workspace.activeId);
    ({ answers, drafts, notes, recommendations = [] } = p);
    currentStep = p.step;
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
      button.querySelector('.step-count').textContent = `${count.answered}/${count.total}`;
      button.setAttribute(
        'aria-label',
        `${steps[i].short || steps[i].title}, 질문 ${count.total}개 중 ${count.answered}개 작성`
      );
    });
    picker();
  }
  const rowsOf = (id) => (Array.isArray(answers[id]) ? answers[id] : []);
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
        (g) =>
          /* HTML */ `<section class="question-group"
            ><div class="group-heading"
              ><h2>${esc(g.title)}</h2>${g.description
                ? /* HTML */ `<p>${esc(g.description)}</p>`
                : ''}</div
            ><div class="group-body"
              >${g.questions
                .map((q) => V.question(q, answers, notes, recommendations))
                .join('')}</div
            ></section
          >`
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
    if (el.matches('textarea[data-note]') && questions.has(el.dataset.note)) {
      if (el.value) notes[el.dataset.note] = el.value;
      else delete notes[el.dataset.note];
      save();
      return;
    }
    if (el.dataset.q && el.matches('input:not([type="checkbox"]):not([type="radio"]),textarea'))
      edit(el);
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (
      el.matches('input[data-recommend]') &&
      questions.get(el.dataset.recommend)?.allowRecommend
    ) {
      const id = el.dataset.recommend;
      recommendations = el.checked
        ? [...new Set([...recommendations, id])]
        : recommendations.filter((value) => value !== id);
      document.getElementById('recommendation-hint-' + id).hidden = !el.checked;
      save();
      return;
    }
    if (el.dataset.q && el.matches('select,input[type="checkbox"],input[type="radio"]')) edit(el);
  });
  function edit(el) {
    const { q: qid, row, field, element, custom, property } = el.dataset;
    const object = row === undefined ? answers : rowsOf(qid)[Number(row)];
    if (!object) return;
    const key = field || qid;
    if (field === 'customElements') {
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
    } else if (qid === 'screens' && field === 'recommendLayout') {
      object.recommendLayout = el.checked;
      document.getElementById('screen-recommendation-hint-' + object.id).hidden = !el.checked;
    } else if (el.type === 'checkbox') {
      let values = Array.isArray(object[key]) ? [...object[key]] : [];
      values = el.checked
        ? [...new Set([...values, el.value])]
        : values.filter((v) => v !== el.value);
      if (el.checked && A.EXCLUSIVE.includes(el.value)) values = [el.value];
      else if (el.checked) values = values.filter((v) => !A.EXCLUSIVE.includes(v));
      object[key] = values;
    } else object[key] = el.value;
    const rerender =
      (row === undefined && el.matches('select,input[type="checkbox"],input[type="radio"]')) ||
      field === 'elements';
    changed(rerender);
    if (rerender)
      [...document.querySelectorAll('[data-q]')]
        .find(
          (c) =>
            c.dataset.q === qid &&
            c.dataset.row === row &&
            c.dataset.field === field &&
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
  document.addEventListener('click', async (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.step !== undefined) return renderStep(Number(d.step), true);
    if (d.help) {
      const q = questions.get(d.help),
        option = A.choiceOptions(q)[Number(d.option)];
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
        changed(true);
        const card = document.getElementById(`custom-element-${screen.id}-${item.id}`);
        card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        card?.querySelector('input')?.focus({ preventScroll: true });
      } else if (
        screen.customElements[Number(d.removeElement)] &&
        window.confirm('이 요소를 삭제할까요? 이름과 용도도 함께 삭제돼요.')
      ) {
        screen.customElements.splice(Number(d.removeElement), 1);
        changed(true);
        document
          .querySelector(`[data-add-element][data-screen="${index}"]`)
          ?.focus({ preventScroll: true });
      }
      return;
    }
    if (d.feature || d.add) {
      const qid = d.feature ? 'features' : d.add,
        rows = rowsOf(qid);
      if (rows.length >= A.MAX_ROWS)
        return toast(`한 목록에는 최대 ${A.MAX_ROWS}개까지 추가할 수 있어요.`);
      let row = { id: P.newId() };
      if (qid === 'features')
        row = {
          ...row,
          category: d.feature || 'custom',
          name: featureTypes.find((f) => f.id === d.feature)?.label || '',
          actor: '',
          outcome: '',
          priority: '아직 미정',
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
      answers[qid] = [...rows, row];
      changed(true);
      const card = document.getElementById(`row-${qid}-${rows.length}`);
      card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      card?.querySelector('input,textarea,select')?.focus({ preventScroll: true });
      return;
    }
    if (d.remove) {
      const rows = rowsOf(d.remove),
        index = Number(d.index);
      if (rows[index] && window.confirm('이 항목을 삭제할까요? 작성한 내용도 함께 삭제돼요.')) {
        answers[d.remove] = rows.filter((_, i) => i !== index);
        changed(true);
        document.querySelector(`[data-add="${d.remove}"]`)?.focus({ preventScroll: true });
      }
      return;
    }
    if (d.move !== undefined) {
      const rows = rowsOf('main_flow'),
        from = Number(d.move),
        to = from + Number(d.direction);
      if (to >= 0 && to < rows.length) {
        [rows[from], rows[to]] = [rows[to], rows[from]];
        changed(true);
        document
          .getElementById(`row-main_flow-${to}`)
          ?.querySelector('select')
          ?.focus({ preventScroll: true });
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
  document.addEventListener('keydown', (event) => {
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
