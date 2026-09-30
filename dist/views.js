(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const A = root.BriefAnswers || require('./answers.js');
  const R = root.BriefReport || require('./report.js');
  const P = root.BriefProjects || require('./projects.js');
  const G = root.BriefGuides || require('./guides.js');
  const { featureTypes, uiElements } = Q;
  const { priorities } = A;
  const D = root.BriefDesigner || require('./designer.js');
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const rowsOf = (answers, id) => (Array.isArray(answers[id]) ? answers[id] : []);
  const attrs = (qid, row, field) =>
    `data-q="${esc(qid)}"${row === undefined ? '' : ` data-row="${row}"`}${field ? ` data-field="${esc(field)}"` : ''}`;
  function input(
    label,
    value,
    attributes,
    { type = 'text', placeholder = '', options = [], help = '' } = {}
  ) {
    if (type === 'url') help = `${A.HTTP_URL_HELP}${help ? ' ' + help : ''}`;
    const id = 'input-' + P.newId();
    let control;
    if (type === 'single')
      control = /* HTML */ `<select id="${id}" ${attributes}
        ><option value="">선택해 주세요</option
        >${A.choiceOptions({ options }, value)
          .map((o) => /* HTML */ `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`)
          .join('')}</select
      >`;
    else if (type === 'multi')
      control = /* HTML */ `<div class="choices compact"
        >${options
          .map(
            (o) =>
              /* HTML */ `<label class="choice"
                ><input
                  type="checkbox"
                  ${attributes}
                  value="${esc(o)}"
                  ${Array.isArray(value) && value.includes(o) ? 'checked' : ''}
                /><span>${esc(o)}</span></label
              >`
          )
          .join('')}</div
      >`;
    else
      control =
        type === 'textarea'
          ? /* HTML */ `<textarea
              id="${id}"
              ${attributes}
              rows="3"
              maxlength="${A.MAX_TEXT}"
              placeholder="${esc(placeholder)}"
            >
${esc(value)}</textarea
            >`
          : /* HTML */ `<input
              id="${id}"
              ${attributes}
              type="${type}"
              maxlength="${type === 'url' ? 2000 : A.MAX_TEXT}"
              value="${esc(value)}"
              placeholder="${esc(placeholder)}"
              autocomplete="off"
            />`;
    return /* HTML */ `<div class="input-field"
      ><label ${type === 'multi' ? '' : `for="${id}"`}>${esc(label)}</label>${help
        ? /* HTML */ `<p class="field-help">${esc(help)}</p>`
        : ''}${control}</div
    >`;
  }
  const rowHeader = (title, qid, i) =>
    /* HTML */ `<div class="card-top"
      ><h3>${esc(title)}</h3
      ><button type="button" class="text-button danger-text" data-remove="${qid}" data-index="${i}"
        >삭제</button
      ></div
    >`;
  const addButton = (id, label) =>
    /* HTML */ `<button type="button" class="button secondary" data-add="${id}"
      >+ ${esc(label)}</button
    >`;
  const empty = (message) => /* HTML */ `<p class="empty-note">${esc(message)}</p>`;
  function rowReason(value, attributes, id, label = '선택 이유·메모') {
    return `<details class="answer-note" id="reason-${id}" ${value?.trim() ? 'open' : ''}><summary>${esc(label)} <span>(선택)</span></summary>${input('이 항목에 남길 이유·메모', value, attributes, { type: 'textarea' })}</details>`;
  }
  function request(label, value, attributes) {
    return `<div class="recommendation-request"><label><input type="checkbox" ${attributes} ${value ? 'checked' : ''}><span>${esc(label)} AI 추천 요청</span></label></div>`;
  }
  function idSelect(label, value, rows, attributes, fallback = '연결하지 않고 직접 설명') {
    const id = 'link-' + P.newId();
    return `<div class="input-field"><label for="${id}">${esc(label)}</label><select id="${id}" ${attributes}><option value="">${esc(fallback)}</option>${value && !rows.some((r) => r.id === value) ? `<option value="${esc(value)}" selected>삭제된 연결 · 다시 선택해 주세요</option>` : ''}${rows.map((r) => `<option value="${esc(r.id)}" ${r.id === value ? 'selected' : ''}>${esc(r.name || '이름 미정')}</option>`).join('')}</select></div>`;
  }
  function featureCatalog(answers, screen = '', scope = '', selected = []) {
    const key = (screen === '' ? 'shared' : screen) + (scope ? '-' + scope : '');
    const target = 'data-screen="' + esc(screen) + '" data-flow-scope="' + esc(scope) + '"';
    const existing = rowsOf(answers, 'features').filter((f) => !selected.includes(f.id));
    return (
      '<div class="feature-picker"><label for="feature-choice-' +
      key +
      '">기능 후보에서 선택</label><select id="feature-choice-' +
      key +
      '" data-feature-choice ' +
      target +
      '><option value="">기능 선택</option><optgroup label="기능 후보">' +
      featureTypes
        .filter((f) => f.id !== 'custom')
        .map((f) => '<option value="type:' + f.id + '">' + esc(f.label) + '</option>')
        .join('') +
      '</optgroup>' +
      (screen !== '' && existing.length
        ? '<optgroup label="만들어 둔 기능 연결">' +
          existing
            .map(
              (f) =>
                '<option value="link:' + f.id + '">' + esc(f.name || '이름 없는 기능') + '</option>'
            )
            .join('') +
          '</optgroup>'
        : '') +
      '</select><div class="feature-choice-info" hidden><p class="field-help" data-feature-description></p><button type="button" class="option-help" data-feature-help hidden aria-label="선택한 기능 설명">?</button></div><div class="feature-add-actions"><button type="button" class="button secondary" data-add-chosen-feature ' +
      target +
      ' disabled>+ 선택한 기능 추가</button><button type="button" class="button secondary" data-feature="custom" ' +
      target +
      '>+ 직접 추가</button></div></div>'
    );
  }
  function permissionFields(row, i) {
    return `${input('누가 사용할 수 있나요?', row.actor, attrs('features', i, 'actor'), { help: '누구나, 로그인한 회원, 담당자처럼 적어요. 아직 모르겠다면 비워 두세요.' })}${input('어느 자료까지 다룰 수 있나요?', row.permission, attrs('features', i, 'permission'), { type: 'textarea', help: '예: 회원은 자신의 예약만 취소하고, 담당자는 맡은 지점의 예약을 관리해요.' })}${request('이 기능의 사용자와 이용 범위', row.recommendPermission, attrs('features', i, 'recommendPermission'))}`;
  }
  function featureCard(row, i, answers, context = 'shared', scope = '') {
    const screens = rowsOf(answers, 'screens');
    const linked = screens.filter((s) => (s.featureIds || []).includes(row.id));
    const shared =
      linked.length > 1 ||
      screens.some(
        (s) =>
          [...Object.values(s.elementContents || {}), ...(s.customElements || [])].filter((plan) =>
            A.linkedFeatureIds(plan).includes(row.id)
          ).length > 1
      );
    const screen = context === 'shared' ? null : screens[Number(context)];
    const key = context + (scope ? '-' + scope : '');
    const plan = !screen
      ? null
      : scope.startsWith('custom:')
        ? screen.customElements?.find((el) => el.id === scope.slice(7))
        : scope
          ? screen.elementContents?.[scope]
          : screen;
    const places = screen
      ? [
          ...(screen.elements || []).map((id) => ({
            id,
            name: uiElements.find((el) => el.id === id)?.label || id
          })),
          ...(screen.customElements || []).map((el) => ({
            id: 'custom:' + el.id,
            name: el.name || '직접 추가한 요소'
          }))
        ]
      : [];
    return (
      '<section class="feature-card"><button type="button" class="text-button danger-text feature-delete" data-remove="features" data-index="' +
      i +
      '" aria-label="' +
      esc(row.name || '새 기능') +
      ' 기능 삭제">기능 삭제</button><details id="feature-' +
      key +
      '-' +
      row.id +
      '" open><summary><span data-feature-title="' +
      i +
      '">' +
      esc(row.name || '새 기능') +
      '</span></summary><div class="feature-card-body">' +
      (shared ? '<p class="field-help">기능 이름·설명은 연결된 곳에 함께 반영돼요.</p>' : '') +
      input('기능 이름', row.name, attrs('features', i, 'name')) +
      (scope
        ? ''
        : input('어떤 일을 하나요?', row.outcome, attrs('features', i, 'outcome'), {
            type: 'textarea'
          })) +
      (!scope && places.length
        ? idSelect(
            '이 기능을 넣을 요소',
            '',
            places,
            'data-assign-feature="' + row.id + '" data-screen="' + context + '"',
            '요소 선택'
          )
        : '') +
      (plan ? screenFlow(plan, screen, Number(context), answers, scope, row.id) : '') +
      '<details class="optional-details" id="feature-extra-' +
      key +
      '-' +
      row.id +
      '"><summary>기능 설명·규칙·메모</summary>' +
      (scope
        ? input('기능 설명', row.outcome, attrs('features', i, 'outcome'), { type: 'textarea' })
        : '') +
      input('공통 규칙', row.notes, attrs('features', i, 'notes'), { type: 'textarea' }) +
      input('언제 필요한가요?', row.priority, attrs('features', i, 'priority'), {
        type: 'single',
        options: priorities
      }) +
      (row.actor || row.permission || row.recommendPermission || context === 'shared'
        ? permissionFields(row, i)
        : '') +
      (row.savedInfo
        ? input('이전에 작성한 저장 정보', row.savedInfo, attrs('features', i, 'savedInfo'), {
            type: 'textarea'
          })
        : '') +
      rowReason(row.reason, attrs('features', i, 'reason'), 'feature-' + key + '-' + row.id) +
      '</details>' +
      (screen
        ? '<button type="button" class="text-button feature-unlink" data-unlink-feature="' +
          row.id +
          '" data-screen="' +
          context +
          '" data-flow-scope="' +
          esc(scope) +
          '">' +
          (scope ? '이 요소에서 연결 해제' : '이 화면에서 연결 해제') +
          '</button>'
        : '') +
      '</div></details></section>'
    );
  }
  function featureEditor(answers) {
    const linked = new Set(rowsOf(answers, 'screens').flatMap((s) => s.featureIds || []));
    return (
      featureCatalog(answers) +
      rowsOf(answers, 'features')
        .map((f, i) => (linked.has(f.id) ? '' : featureCard(f, i, answers)))
        .join('')
    );
  }
  function screenFeatures(row, i, answers) {
    const used = new Set(
      [...Object.values(row.elementContents || {}), ...(row.customElements || [])].flatMap(
        A.linkedFeatureIds
      )
    );
    const ids = A.linkedFeatureIds(row).filter(
      (id) => !used.has(id) || (row.flow || []).some((action) => action.featureId === id)
    );
    if (!ids.length) return '';
    return (
      '<details class="screen-section screen-functions" id="screen-features-' +
      row.id +
      '" open><summary>기존 화면 기능 · ' +
      ids.length +
      '개</summary>' +
      rowsOf(answers, 'features')
        .map((f, index) => (ids.includes(f.id) ? featureCard(f, index, answers, String(i)) : ''))
        .join('') +
      (ids.some((id) => !rowsOf(answers, 'features').some((f) => f.id === id))
        ? '<p class="field-help">삭제된 기능 연결은 기획 초안에서 확인해 주세요.</p>'
        : '') +
      '</details>'
    );
  }
  function rolesEditor(answers) {
    const roles = rowsOf(answers, 'roles');
    return /* HTML */ `<div class="inline-actions"
        >${Q.rolePresets
          .map(
            (name, i) =>
              /* HTML */ `<button
                type="button"
                class="button secondary"
                data-role-preset="${i}"
                ${roles.some((r) => (r.role || '').trim() === name) ? 'disabled' : ''}
                >+ ${esc(name)}</button
              >`
          )
          .join('')}${addButton('roles', '직접 추가')}</div
      ><div class="editor-list"
        >${roles
          .map(
            (role, i) =>
              /* HTML */ `<section class="editor-card" id="row-roles-${i}"
                >${rowHeader(role.role || '새 역할', 'roles', i)}${input(
                  '역할 이름',
                  role.role,
                  attrs('roles', i, 'role')
                )}${role.actions || role.data
                  ? `<details class="optional-details" id="legacy-role-${role.id}"><summary>이전에 작성한 역할 설명</summary>${input('할 수 있는 행동', role.actions, attrs('roles', i, 'actions'))}${input('볼 수 있는 자료', role.data, attrs('roles', i, 'data'))}</details>`
                  : ''}</section
              >`
          )
          .join('')}</div
      >`;
  }
  function roleSelectionLabel(ids = [], roles = []) {
    const names = ids.map((id) => {
      const role = roles.find((role) => role.id === id);
      return role ? role.role || '이름 없는 역할' : '삭제된 역할';
    });
    return names.length
      ? names.slice(0, 2).join(' · ') + (names.length > 2 ? ' 외 ' + (names.length - 2) + '개' : '')
      : '역할 선택';
  }
  function screenRoles(row, i, answers) {
    const roles = rowsOf(answers, 'roles');
    const selected = row.roleIds || [];
    const choices = [
      ...roles,
      ...selected
        .filter((id) => !roles.some((role) => role.id === id))
        .map((id) => ({ id, role: '삭제된 역할 · 선택을 해제해 주세요.' }))
    ];
    return /* HTML */ `<fieldset class="sub-field screen-roles"
      ><legend id="roles-label-${row.id}">이 화면을 사용할 역할</legend>
      <details class="role-picker" id="roles-${row.id}"
        ><summary aria-labelledby="roles-label-${row.id} roles-value-${row.id}"
          ><span id="roles-value-${row.id}" data-role-summary
            >${esc(roleSelectionLabel(selected, roles))}</span
          ></summary
        >
        <div class="role-panel"
          ><input
            type="search"
            aria-label="역할 검색"
            id="roles-search-${row.id}"
            data-role-search
            placeholder="역할 이름 검색"
            autocomplete="off"
            maxlength="${A.MAX_TEXT}"
          />
          <div class="role-options"
            >${choices
              .map(
                (role) =>
                  `<label class="choice" data-role-option><input type="checkbox" ${attrs('screens', i, 'roleIds')} value="${esc(role.id)}" ${selected.includes(role.id) ? 'checked' : ''}><span>${esc(role.role || '이름 없는 역할')}</span></label>`
              )
              .join('')}</div
          >
          <p class="field-help role-results" role="status" ${choices.length ? 'hidden' : ''}
            >사용자·환경에서 역할을 추가해 주세요.</p
          >
          <button type="button" class="text-button" data-edit-roles>역할 목록 관리 →</button>
        </div> </details
      >${row.roles
        ? `<details class="optional-details" id="legacy-screen-roles-${row.id}"><summary>이전에 적은 이용 대상</summary>${input('이 화면을 사용하는 사람', row.roles, attrs('screens', i, 'roles'))}</details>`
        : ''}</fieldset
    >`;
  }
  function screenFlow(plan, screen, i, answers, scope = '', featureId = '') {
    const attributes = attrs('screens', i, 'flow') + ' data-flow-scope="' + esc(scope) + '"';
    const target =
      'data-screen="' +
      i +
      '" data-flow-scope="' +
      esc(scope) +
      '" data-flow-feature="' +
      esc(featureId) +
      '"';
    const destinations = [
      { id: '@stay', name: '현재 화면 유지' },
      { id: '@back', name: '이전 화면으로 돌아가기' },
      ...rowsOf(answers, 'screens').filter((s) => !s.isCommon)
    ];
    const rows = (plan.flow || [])
      .map((action, index) => ({ action, index }))
      .filter(({ action }) =>
        featureId
          ? action.featureId === featureId
          : !action.featureId || !rowsOf(answers, 'features').some((f) => f.id === action.featureId)
      );
    if (scope && !featureId && !rows.length) return '';
    const id = 'flow-' + screen.id + '-' + esc(scope) + (featureId ? '-' + featureId : '');
    const content =
      rows
        .map(({ action: row, index: j }, position) => {
          const field = (key) =>
            attributes + ' data-flow-row="' + j + '" data-property="' + key + '"';
          return (
            '<section class="content-item action-item" id="flow-row-' +
            screen.id +
            '-' +
            esc(scope) +
            '-' +
            row.id +
            '"><div class="card-top"><h6>동작' +
            (rows.length > 1 ? ' ' + (position + 1) : '') +
            '</h6><div class="inline-actions">' +
            (rows.length > 1
              ? '<button type="button" class="text-button" ' +
                target +
                ' data-flow-move="' +
                j +
                '" data-direction="-1" aria-label="동작 ' +
                (position + 1) +
                ' 위로" ' +
                (position === 0 ? 'disabled' : '') +
                '>↑</button><button type="button" class="text-button" ' +
                target +
                ' data-flow-move="' +
                j +
                '" data-direction="1" aria-label="동작 ' +
                (position + 1) +
                ' 아래로" ' +
                (position === rows.length - 1 ? 'disabled' : '') +
                '>↓</button>'
              : '') +
            '<button type="button" class="text-button danger-text" ' +
            target +
            ' data-flow-remove="' +
            j +
            '">삭제</button></div></div>' +
            input('언제 실행하나요?', row.event, field('event')) +
            input('어떻게 동작하나요?', row.result, field('result'), { type: 'textarea' }) +
            idSelect(
              '동작 후 화면',
              row.nextScreenId,
              destinations,
              field('nextScreenId'),
              '이동 여부 선택'
            ) +
            (row.featureId && !featureId
              ? idSelect(
                  '연결된 기능 확인',
                  row.featureId,
                  rowsOf(answers, 'features'),
                  field('featureId'),
                  '기능 연결 해제'
                )
              : '') +
            '<details class="optional-details" id="exceptions-' +
            screen.id +
            '-' +
            esc(scope) +
            '-' +
            row.id +
            '" ' +
            (row.exceptions || row.recommendExceptions ? 'open' : '') +
            '><summary>오류·예외 대응</summary>' +
            request('오류·예외 대응', row.recommendExceptions, field('recommendExceptions')) +
            input('오류나 예외 상황에서 어떻게 하나요?', row.exceptions, field('exceptions'), {
              type: 'textarea'
            }) +
            '</details></section>'
          );
        })
        .join('') +
      '<button type="button" class="button secondary" ' +
      target +
      ' data-flow-add>+ 동작 추가</button>' +
      (!featureId && !scope
        ? request(
            '화면 전체 동작',
            plan.recommendFlow,
            attrs('screens', i, 'recommendFlow') + ' data-flow-scope="' + esc(scope) + '"'
          )
        : '');
    return featureId
      ? '<div class="feature-flow" id="' + id + '">' + content + '</div>'
      : '<details class="optional-details local-flow" id="' +
          id +
          '" ' +
          (rows.length || plan.recommendFlow ? 'open' : '') +
          '><summary>' +
          '기존 동작 기록' +
          '</summary>' +
          content +
          '</details>';
  }
  function referenceEditor(q, answers) {
    return (
      (rowsOf(answers, q.id)
        .map(
          (row, i) =>
            /* HTML */ `<section class="editor-card" id="row-${q.id}-${i}"
              >${rowHeader('참고 자료 ' + (i + 1), q.id, i)}${input(
                '사이트 또는 자료 URL',
                row.url,
                attrs(q.id, i, 'url'),
                {
                  type: 'url',
                  placeholder: 'https://example.com',
                  help: '링크의 내용은 자동으로 읽어 오지 않아요.'
                }
              )}${input('어떤 부분을 참고하나요? (선택)', row.note, attrs(q.id, i, 'note'), {
                placeholder: '예: 첫 화면의 구성, 검색 방식, 색상'
              })}</section
            >`
        )
        .join('') || empty('참고하고 싶은 사이트나 디자인 자료가 있다면 하나씩 추가하세요.')) +
      addButton(q.id, '참고 URL 추가')
    );
  }
  function elementExample(id, expanded = false) {
    const el = uiElements.find((item) => item.id === id);
    if (!el) return '';
    const src = `element-examples/${el.id}.webp`;
    const picture = /* HTML */ `<img
      src="${src}"
      width="1200"
      height="800"
      alt="${expanded ? esc(el.example) : ''}"
      loading="${expanded ? 'eager' : 'lazy'}"
      decoding="async"
    />`;
    return expanded
      ? /* HTML */ `<figure class="element-example"
          >${picture}<figcaption>
            주황색 테두리 안이 ${esc(el.label)} 예시예요. 이해를 돕기 위해 만든 가상 화면이에요.
            <a href="${src}" target="_blank" rel="noopener noreferrer">이미지 새 탭에서 보기 ↗</a>
          </figcaption></figure
        >`
      : picture;
  }

  function screenEditor(q, answers, state = {}, recommendations = []) {
    const { screen: row, index: i, element } = D.selection(answers, state);
    let inspector = '';
    if (i < 0) inspector = '<p class="field-help">기본 공통 화면부터 구성하세요.</p>';
    else if (element) {
      const items = A.layoutItems(
        row,
        rowsOf(answers, 'screens').find((s) => s.isCommon)
      );
      const current = items.find((item) => item.key === element);
      const siblings = items.filter(
        (item) =>
          !item.inherited &&
          item.parent === current.parent &&
          (current.parent || item.region === current.region)
      );
      const customIndex = (row.customElements || []).findIndex(
        (el) => 'custom:' + el.id === element
      );
      const custom = customIndex >= 0 ? row.customElements[customIndex] : null;
      const plan = row.elementContents?.[element] || {};
      const nameAttrs = custom
        ? attrs('screens', i, 'customElements') +
          ' data-custom="' +
          customIndex +
          '" data-property="name"'
        : attrs('screens', i, 'elementContents') +
          ' data-element="' +
          element +
          '" data-property="name"';
      const descriptionAttrs = custom
        ? attrs('screens', i, 'customElements') +
          ' data-custom="' +
          customIndex +
          '" data-property="purpose"'
        : attrs('screens', i, 'elementNotes') + ' data-element="' + element + '"';
      inspector =
        '<div class="natural-element-settings">' +
        input(
          '요소 이름',
          custom ? custom.name : plan.name === undefined ? A.elementLabel(row, element) : plan.name,
          nameAttrs
        ) +
        input(
          '어떤 용도로 쓰나요?',
          custom ? custom.purpose : row.elementNotes?.[element],
          descriptionAttrs,
          { type: 'textarea', help: '보여 줄 정보, 사용할 기능과 동작을 자유롭게 적어 주세요.' }
        ) +
        '<div class="placement-controls"><div class="grid-controls" role="group" aria-label="격자 배치"><span>위치</span><button type="button" class="button secondary small" data-grid-move="left" aria-label="왼쪽으로 이동">←</button><button type="button" class="button secondary small" data-grid-move="up" aria-label="위로 이동">↑</button><button type="button" class="button secondary small" data-grid-move="down" aria-label="아래로 이동">↓</button><button type="button" class="button secondary small" data-grid-move="right" aria-label="오른쪽으로 이동">→</button></div><div class="grid-controls" role="group" aria-label="요소 너비"><span>너비</span><button type="button" class="button secondary small" data-grid-width="50">절반</button><button type="button" class="button secondary small" data-grid-width="100">전체</button></div><div class="inline-actions"><button type="button" class="button secondary small" data-designer-move="-1" ' +
        (siblings[0]?.key === element ? 'disabled' : '') +
        '>앞으로</button><button type="button" class="button secondary small" data-designer-move="1" ' +
        (siblings.at(-1)?.key === element ? 'disabled' : '') +
        '>뒤로</button><button type="button" class="button secondary element-delete" data-designer-remove-element aria-label="요소 삭제" title="요소 삭제"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div></div></div>';
    } else {
      inspector =
        (row.isCommon ? '' : input('화면 이름', row.name, attrs('screens', i, 'name'))) +
        input(
          row.isCommon ? '공통 화면의 용도' : '화면의 목적',
          row.purpose,
          attrs('screens', i, 'purpose'),
          { type: 'textarea' }
        );
      if (!row.isCommon)
        inspector +=
          '<label class="common-layout-choice"><input type="checkbox" ' +
          attrs('screens', i, 'useCommonLayout') +
          ' ' +
          (row.useCommonLayout !== false ? 'checked' : '') +
          '>기본 공통 화면 사용</label>' +
          screenRoles(row, i, answers);
      inspector += request(
        '화면 구성',
        row.recommendLayout,
        attrs('screens', i, 'recommendLayout')
      );
      const legacy =
        ['content', 'empty', 'error', 'mobile'].some((key) => A.isAnswered(row[key])) ||
        A.isAnswered(row.flow) ||
        row.recommendFlow ||
        (row.flow || []).some((action) => action.recommendExceptions) ||
        (row.featureIds || []).some(
          (id) =>
            ![...Object.values(row.elementContents || {}), ...(row.customElements || [])].some(
              (plan) => A.linkedFeatureIds(plan).includes(id)
            )
        );
      if (legacy)
        inspector +=
          '<details class="optional-details"><summary>이전에 작성한 내용</summary>' +
          ['content', 'empty', 'error', 'mobile']
            .filter((key) => A.isAnswered(row[key]))
            .map((key) =>
              input(
                {
                  content: '추가 정보',
                  empty: '자료가 없을 때',
                  error: '작업이 실패했을 때',
                  mobile: '작은 화면에서'
                }[key],
                row[key],
                attrs('screens', i, key),
                { type: 'textarea' }
              )
            )
            .join('') +
          screenFeatures(row, i, answers) +
          ((row.flow || []).length || row.recommendFlow ? screenFlow(row, row, i, answers) : '') +
          '</details>';
      if (!row.isCommon)
        inspector +=
          '<button type="button" class="text-button danger-text designer-delete-screen" data-remove="screens" data-index="' +
          i +
          '">이 화면 삭제</button>';
    }
    const reason =
      i < 0
        ? ''
        : rowReason(
            row.reason,
            attrs('screens', i, 'reason'),
            'screen-' + row.id,
            row.isCommon ? '공통 화면의 선택 이유' : '이 화면의 선택 이유'
          );
    return D.render(answers, state, inspector, reason, recommendationEditor(q, recommendations));
  }
  function reasonEditor(q, notes) {
    const value = notes[q.id] || '';
    return /* HTML */ `<details
      class="answer-note"
      id="reason-${q.id}"
      ${value.trim() ? 'open' : ''}
      ><summary id="reason-label-${q.id}">답변·선택 이유 남기기 <span>(선택)</span></summary
      ><textarea
        id="reason-input-${q.id}"
        data-note="${q.id}"
        aria-labelledby="label-${q.id} reason-label-${q.id}"
        rows="3"
        maxlength="${A.MAX_TEXT}"
      >
${esc(value)}</textarea
      >
    </details>`;
  }
  function recommendationEditor(q, recommendations) {
    if (!q.allowRecommend) return '';
    return /* HTML */ `<div class="recommendation-request"
      ><label
        ><input
          type="checkbox"
          data-recommend="${q.id}"
          ${recommendations.includes(q.id) ? 'checked' : ''}
          ${q.recommendationScope ? 'aria-describedby="recommendation-scope-' + q.id + '"' : ''}
        /><span>${esc(q.recommendationLabel || 'AI에 추천 요청')}</span></label
      >${q.recommendationScope
        ? `<p id="recommendation-scope-${q.id}" class="field-help">추천 범위: ${esc(q.recommendationScope)}</p>`
        : ''}</div
    >`;
  }
  function renderQuestion(q, answers = {}, notes = {}, recommendations = [], designerState = {}) {
    const value = answers[q.id];
    let control = '';
    if (q.type === 'features') control = featureEditor(answers);
    else if (q.type === 'screens')
      control = screenEditor(q, answers, designerState, recommendations);
    else if (q.type === 'references') control = referenceEditor(q, answers);
    else if (q.type === 'roles') control = rolesEditor(answers);
    else if (q.type === 'rows')
      control =
        rowsOf(answers, q.id)
          .map(
            (row, i) =>
              /* HTML */ `<section class="editor-card" id="row-${q.id}-${i}"
                >${rowHeader((q.rowLabel || '항목') + ' ' + (i + 1), q.id, i)}<div
                  class="field-grid"
                  >${q.fields
                    .map((f) => input(f.label, row[f.id] ?? '', attrs(q.id, i, f.id), f))
                    .join('')}</div
                ></section
              >`
          )
          .join('') + addButton(q.id, (q.rowLabel || '항목') + ' 추가');
    else if (q.type === 'single' || q.type === 'multi') {
      const options =
        q.source === 'features'
          ? rowsOf(answers, 'features').map((f) => ({
              value: f.id,
              label: f.name || '이름 없는 기능'
            }))
          : A.choiceOptions(q, value).map((o) => ({ value: o, label: q.optionLabels?.[o] || o }));
      control = options.length
        ? /* HTML */ `<div class="choices"
            >${options
              .map((o, i) => {
                const guide = q.source ? null : G.get(q, o.value);
                return /* HTML */ `<div class="choice-row"
                  ><label class="choice"
                    ><input
                      type="${q.type === 'single' ? 'radio' : 'checkbox'}"
                      name="${q.id}"
                      ${attrs(q.id)}
                      value="${esc(o.value)}"
                      ${(
                        q.type === 'multi'
                          ? Array.isArray(value) && value.includes(o.value)
                          : value === o.value
                      )
                        ? 'checked'
                        : ''}
                    /><span>${esc(o.label)}</span></label
                  >${guide && o.value !== A.UNKNOWN
                    ? /* HTML */ `<button
                        type="button"
                        class="option-help"
                        data-help="${q.id}"
                        data-option="${i}"
                        aria-label="${esc(o.label)} 설명"
                        >?</button
                      >`
                    : ''}</div
                >`;
              })
              .join('')}</div
          >`
        : empty('‘화면·기능’에서 기능을 추가한 뒤 이곳에서 선택할 수 있어요.');
      if (value && (typeof value === 'string' || value.length))
        control += /* HTML */ `<button
          class="text-button clear-answer"
          type="button"
          data-clear="${q.id}"
          >선택 지우기</button
        >`;
    } else
      control =
        q.type === 'textarea'
          ? /* HTML */ `<textarea
              id="input-${q.id}"
              ${attrs(q.id)}
              aria-labelledby="label-${q.id}"
              ${q.help ? `aria-describedby="hint-${q.id}"` : ''}
              maxlength="${A.MAX_TEXT}"
              rows="4"
              placeholder="${esc(q.placeholder || '')}"
            >
${esc(value)}</textarea
            >`
          : /* HTML */ `<input
              id="input-${q.id}"
              ${attrs(q.id)}
              aria-labelledby="label-${q.id}"
              ${q.help ? `aria-describedby="hint-${q.id}"` : ''}
              type="text"
              maxlength="${q.id === 'project_name' ? 200 : A.MAX_TEXT}"
              value="${esc(value)}"
              placeholder="${esc(q.placeholder || '')}"
              autocomplete="off"
            />`;
    return /* HTML */ `<fieldset class="question" id="field-${q.id}"
      ><legend id="label-${q.id}">${esc(q.label)}</legend>${q.help
        ? /* HTML */ `<p class="question-help" id="hint-${q.id}">${esc(q.help)}</p>`
        : ''}${control}${q.type === 'screens'
        ? ''
        : recommendationEditor(q, recommendations)}${q.type !== 'screens' &&
      (q.allowReason !== false || A.isAnswered(notes[q.id]))
        ? reasonEditor(q, notes)
        : ''}</fieldset
    >`;
  }
  function renderReport(answers = {}, notes = {}, recommendations = []) {
    // Only our heading/list prefixes become HTML; all user text remains escaped.
    const readable = (value) =>
      esc(
        value
          .replace(/\\([\\`*_\[\]#|])/g, '$1')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
      );
    let questionOpen = false,
      reasonOpen = false,
      entryOpen = false,
      elementOpen = false,
      recordOpen = false,
      quoteOpen = false,
      questionId = '';
    const markdownLabel = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/[\\`*_\[\]#|]/g, '\\$&');
    const questionTargets = new Map();
    for (const q of A.activeQuestions(answers)) {
      const key = markdownLabel(q.label);
      questionTargets.set(key, [...(questionTargets.get(key) || []), q.id]);
    }
    const closeQuote = () => {
      const end = quoteOpen ? '</a></p>' : '';
      quoteOpen = false;
      return end;
    };
    const closeRecord = () => {
      const end = closeQuote() + (recordOpen ? '</section>' : '');
      recordOpen = false;
      return end;
    };
    const closeElement = () => {
      const end = closeRecord() + (elementOpen ? '</section>' : '');
      elementOpen = false;
      return end;
    };
    const closeEntry = () => {
      const end = closeElement() + (entryOpen ? '</section>' : '');
      entryOpen = false;
      return end;
    };
    const closeQuestion = () => {
      const end =
        closeEntry() + (reasonOpen ? '</aside>' : '') + (questionOpen ? '</section>' : '');
      reasonOpen = questionOpen = false;
      questionId = '';
      return end;
    };
    const body =
      R.report(answers, false, notes, recommendations)
        .split('\n')
        .map((line) => {
          if (line.startsWith('> ')) {
            const continued = quoteOpen;
            const prefix = continued ? '\n' : '<p class="report-answer">';
            quoteOpen = true;
            const link =
              questionId && !continued
                ? `<a class="report-jump-answer" data-report-jump="${esc(questionId)}" href="#field-${esc(questionId)}" aria-label="${readable(line.slice(2))} · 작성 화면으로 이동">`
                : '';
            return prefix + (quoteOpen ? link : '') + readable(line.slice(2));
          }
          const quoteEnd = closeQuote();
          if (line === '---') return quoteEnd + closeRecord();
          const heading = /^(#{1,6}) (.*)$/.exec(line);
          if (heading) {
            const depth = heading[1].length,
              level = Math.min(6, depth + 1);
            let prefix =
              quoteEnd +
              (depth <= 3 ? closeQuestion() : depth <= 5 ? closeEntry() : closeElement());
            if (depth === 5) {
              prefix += '<section class="report-entry">';
              entryOpen = true;
            }
            if (depth === 6) {
              prefix += '<section class="report-element">';
              elementOpen = true;
            }
            if (depth === 3) {
              prefix += '<section class="report-question">';
              questionOpen = true;
              questionId = questionTargets.get(heading[2])?.shift() || '';
            }
            if (depth === 4 && heading[2] === '선택 이유·추가 메모') {
              prefix += '<aside class="report-rationale">';
              reasonOpen = true;
            }
            const headingHtml = questionId
              ? `<a class="report-jump-question" data-report-jump="${esc(questionId)}" href="#field-${esc(questionId)}" aria-label="${readable(heading[2])} · 작성 화면으로 이동">${readable(heading[2])}</a>`
              : readable(heading[2]);
            return `${prefix}<h${level}>${headingHtml}</h${level}>`;
          }
          if (/^\*\*.*\*\*$/.test(line)) {
            const label = line.slice(2, -2);
            const action = /^(?:.* · )?동작 \d+$/.test(label);
            const item = /^(입력 항목|표의 열|표시할 정보) \d+$/.test(label);
            if (entryOpen && (action || item)) {
              const prefix = quoteEnd + closeRecord();
              recordOpen = true;
              return `${prefix}<section class="report-record ${action ? 'report-action' : 'report-input'}"><h6>${readable(label)}</h6>`;
            }
            return `${quoteEnd}<p class="report-label"><strong>${readable(label)}</strong></p>`;
          }
          return (
            quoteEnd +
            (line.trim()
              ? /* HTML */ `<p class="${/^[-*] /.test(line) ? 'report-item' : ''}"
                  >${readable(line.replace(/^[-*] /, '• '))}</p
                >`
              : '')
          );
        })
        .join('') + closeQuestion();
    return /* HTML */ `<div class="page-topline"><span>내 아이디어의 첫 문서</span></div
      ><div class="page-heading"
        ><h1 id="report-title" tabindex="-1">서비스 기획 초안</h1
        ><p>작성한 내용과 미정 사항을 모았어요. 빈칸은 확정된 요구사항으로 간주하지 않아요.</p></div
      ><div class="report-actions"
        ><button type="button" class="button secondary" id="back-to-form"
          >← 작성으로 돌아가기</button
        ><button type="button" class="button primary" id="copy-prompt"
          >AI와 기획 다듬기 · 복사</button
        ><button type="button" class="button secondary" id="download-report"
          >기획 초안 내려받기</button
        ></div
      ><p class="field-help"
        >복사한 내용을 원하는 AI 대화에 붙여 넣으세요. 자료를 검토하고 추가 질문을 거쳐 기획을
        보완하도록 안내해요. 이 사이트에서 AI가 자동 실행되지는 않아요.</p
      ><article class="report-document">${body}</article>`;
  }
  const api = {
    escapeHtml: esc,
    question: renderQuestion,
    report: renderReport,
    elementExample,
    roleSelectionLabel
  };
  root.BriefViews = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
