(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const A = root.BriefAnswers || require('./answers.js');
  const R = root.BriefReport || require('./report.js');
  const P = root.BriefProjects || require('./projects.js');
  const G = root.BriefGuides || require('./guides.js');
  const { featureTypes, uiElements, uiElementGroups } = Q;
  const { priorities } = A;
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
        >${options
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
  function rowReason(value, attributes, id) {
    return `<details class="answer-note" id="reason-${id}" ${value?.trim() ? 'open' : ''}><summary>선택 이유·메모 <span>(선택)</span></summary>${input('이 항목에 남길 이유·메모', value, attributes, { type: 'textarea' })}</details>`;
  }
  function request(label, value, attributes) {
    return `<div class="recommendation-request"><label><input type="checkbox" ${attributes} ${value ? 'checked' : ''}><span>${esc(label)} · AI 추천 요청에 추가</span></label><p class="field-help" ${value ? '' : 'hidden'}>직접 적은 내용은 유지해요. 기획 초안의 요청문을 복사해 외부 AI에 전달하세요.</p></div>`;
  }
  function idSelect(label, value, rows, attributes, fallback = '연결하지 않고 직접 설명') {
    const id = 'link-' + P.newId();
    return `<div class="input-field"><label for="${id}">${esc(label)}</label><select id="${id}" ${attributes}><option value="">${esc(fallback)}</option>${value && !rows.some((r) => r.id === value) ? `<option value="${esc(value)}" selected>삭제된 연결 · 다시 선택해 주세요</option>` : ''}${rows.map((r) => `<option value="${esc(r.id)}" ${r.id === value ? 'selected' : ''}>${esc(r.name || '이름 미정')}</option>`).join('')}</select></div>`;
  }
  function featureCatalog(screen = '') {
    return `<details class="optional-details" id="feature-catalog-${screen || 'shared'}"><summary>기능 후보에서 고르기</summary><div class="catalog">${featureTypes
      .filter((f) => f.id !== 'custom')
      .map(
        (f) =>
          `<div class="catalog-entry"><button type="button" class="catalog-item" data-feature="${f.id}" data-screen="${screen}"><strong>${esc(f.label)} <span aria-hidden="true">＋</span></strong><span>${esc(f.description)}</span></button><button type="button" class="option-help" data-feature-help="${f.id}" aria-label="${esc(f.label)} 설명">?</button></div>`
      )
      .join('')}</div></details>`;
  }
  function permissionFields(row, i) {
    return `${input('누가 사용할 수 있나요?', row.actor, attrs('features', i, 'actor'), { help: '누구나, 로그인한 회원, 담당자처럼 적어요. 아직 모르겠다면 비워 두세요.' })}${input('어느 자료까지 다룰 수 있나요?', row.permission, attrs('features', i, 'permission'), { type: 'textarea', help: '예: 회원은 자신의 예약만 취소하고, 담당자는 맡은 지점의 예약을 관리해요.' })}${request('이 기능의 사용자와 이용 범위', row.recommendPermission, attrs('features', i, 'recommendPermission'))}`;
  }
  function featureCard(row, i, answers, context = 'shared') {
    const linked = rowsOf(answers, 'screens').filter((s) => (s.featureIds || []).includes(row.id));
    return `<details class="feature-card" id="feature-${context}-${row.id}" open><summary>${esc(row.name || '새 기능')}</summary><div class="feature-card-body">${linked.length > 1 ? `<p class="field-help">${linked.map((s) => esc(s.name || '이름 없는 화면')).join(' · ')}에서 함께 쓰는 기능이에요. 수정하면 연결된 곳에 함께 반영돼요.</p>` : ''}${input('기능 이름', row.name, attrs('features', i, 'name'))}${input('어떤 일을 하고, 어떤 결과를 얻나요?', row.outcome, attrs('features', i, 'outcome'), { type: 'textarea' })}<details class="optional-details" id="permission-${context}-${row.id}" ${row.actor || row.permission || row.recommendPermission ? 'open' : ''}><summary>사용하는 사람과 이용 범위</summary>${permissionFields(row, i)}</details>${row.savedInfo ? input('이전에 작성한 저장 정보', row.savedInfo, attrs('features', i, 'savedInfo'), { type: 'textarea' }) : ''}<details class="optional-details" id="feature-extra-${context}-${row.id}"><summary>규칙·우선순위 (선택)</summary>${input('규칙·예외', row.notes, attrs('features', i, 'notes'), { type: 'textarea' })}${input('언제 필요한가요?', row.priority, attrs('features', i, 'priority'), { type: 'single', options: priorities })}</details>${rowReason(row.reason, attrs('features', i, 'reason'), `feature-${context}-${row.id}`)}<div class="inline-actions">${context !== 'shared' ? `<button type="button" class="text-button" data-unlink-feature="${esc(row.id)}" data-screen="${context}">이 화면에서 연결 해제</button>` : ''}<button type="button" class="text-button danger-text" data-remove="features" data-index="${i}">기능 삭제</button></div></div></details>`;
  }
  function featureEditor(answers) {
    const screens = rowsOf(answers, 'screens');
    const features = rowsOf(answers, 'features');
    const linked = new Set(screens.flatMap((s) => s.featureIds || []));
    return `${features.some((f) => linked.has(f.id)) ? '<p class="field-help">화면에 연결한 기능은 위의 각 화면에서 수정해요.</p>' : ''}${features.map((f, i) => (linked.has(f.id) ? '' : featureCard(f, i, answers))).join('')}${addButton('features', '기능 직접 추가')}${featureCatalog()}`;
  }
  function screenFeatures(row, i, answers) {
    const features = rowsOf(answers, 'features');
    const ids = row.featureIds || [];
    return `<section class="screen-functions"><h4>이 화면에서 할 수 있는 일</h4><p class="field-help">버튼을 눌러 할 일이나 자료를 찾고 바꾸는 기능을 추가해요. 다른 화면의 기능을 함께 쓸 수도 있어요.</p>${features.map((f, index) => (ids.includes(f.id) ? featureCard(f, index, answers, String(i)) : '')).join('')}${ids.some((id) => !features.some((f) => f.id === id)) ? '<p class="field-help">삭제된 기능 연결이 있어요. 기획 초안에서 확인할 수 있어요.</p>' : ''}<button type="button" class="button secondary" data-feature="custom" data-screen="${i}">+ 이 화면에 기능 추가</button>${
      features.some((f) => !ids.includes(f.id))
        ? idSelect(
            '기존 기능 연결',
            '',
            features.filter((f) => !ids.includes(f.id)),
            `data-link-feature data-screen="${i}"`,
            '함께 사용할 기능 선택'
          )
        : ''
    }${featureCatalog(String(i))}</section>`;
  }
  function permissionsEditor(answers) {
    const screens = rowsOf(answers, 'screens');
    return rowsOf(answers, 'features')
      .map(
        (f, i) =>
          `<details class="feature-card" id="permissions-${f.id}"><summary>${esc(f.name || '이름 없는 기능')} · ${esc(f.actor || '사용자 미정')}</summary><div class="feature-card-body"><p class="field-help">${esc(
            screens
              .filter((s) => (s.featureIds || []).includes(f.id))
              .map((s) => s.name || '이름 없는 화면')
              .join(' · ') || '화면 밖의 기능 또는 화면 미정'
          )}</p>${permissionFields(f, i)}</div></details>`
      )
      .join('');
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
  function flowEditor(q, answers) {
    const features = rowsOf(answers, 'features');
    return (
      (rowsOf(answers, q.id)
        .map(
          (row, i, rows) =>
            /* HTML */ `<section class="editor-card" id="row-${q.id}-${i}"
              ><div class="card-top"
                ><h3>${i + 1}번째 행동</h3
                ><div class="inline-actions"
                  ><button
                    type="button"
                    class="text-button"
                    data-move="${i}"
                    data-direction="-1"
                    ${i === 0 ? 'disabled' : ''}
                    aria-label="${i + 1}번째 행동 위로"
                    >↑ 위로</button
                  ><button
                    type="button"
                    class="text-button"
                    data-move="${i}"
                    data-direction="1"
                    ${i === rows.length - 1 ? 'disabled' : ''}
                    aria-label="${i + 1}번째 행동 아래로"
                    >↓ 아래로</button
                  ><button
                    type="button"
                    class="text-button danger-text"
                    data-remove="${q.id}"
                    data-index="${i}"
                    >삭제</button
                  ></div
                ></div
              >${idSelect(
                '이때 사용하는 화면 (선택)',
                row.screenId,
                rowsOf(answers, 'screens'),
                attrs(q.id, i, 'screenId')
              )}<div class="input-field"
                ><label for="flow-feature-${i}">앞에서 정한 기능 연결 (선택)</label
                ><select id="flow-feature-${i}" ${attrs(q.id, i, 'featureId')}
                  ><option value="">기능을 연결하지 않고 직접 설명</option
                  >${row.featureId && !features.some((f) => f.id === row.featureId)
                    ? /* HTML */ `<option value="${esc(row.featureId)}" selected
                        >삭제된 기능 · 다시 선택해 주세요</option
                      >`
                    : ''}${features
                    .map(
                      (f) =>
                        /* HTML */ `<option
                          value="${f.id}"
                          ${f.id === row.featureId ? 'selected' : ''}
                          >${esc(f.name || '이름 없는 기능')}</option
                        >`
                    )
                    .join('')}</select
                ></div
              >${input('이때 사용자는 무엇을 하나요?', row.note, attrs(q.id, i, 'note'), {
                placeholder: '예: 처음 방문해서 원하는 항목을 찾아요'
              })}</section
            >`
        )
        .join('') ||
        empty(
          '가장 대표적인 이용 과정 하나부터 정리하세요. 모든 기능의 흐름을 작성할 필요는 없어요.'
        )) + addButton(q.id, '다음 행동 추가')
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

  function elementDetail(el, row, i) {
    if (!el.detail) return '';
    const selected = row.elementOptions?.[el.id] || [];
    if (el.id === 'form' && !selected.length) return '';
    const options = el.detail.multiple
      ? el.detail.options
      : [...el.detail.options, { id: '', label: '아직 정하지 않음' }];
    return /* HTML */ `<fieldset class="sub-field element-detail"
      ><legend>${esc(el.id === 'form' ? '이전에 선택한 입력 방식' : el.detail.label)}</legend
      ><div class="choices"
        >${options
          .map(
            (option) =>
              /* HTML */ `<div class="choice-row"
                ><label class="choice"
                  ><input
                    type="${el.detail.multiple ? 'checkbox' : 'radio'}"
                    name="element-${row.id}-${el.id}"
                    ${attrs('screens', i, 'elementOptions')}
                    data-element="${el.id}"
                    value="${option.id}"
                    ${(option.id ? selected.includes(option.id) : !selected.length)
                      ? 'checked'
                      : ''}
                  /><span>${esc(option.label)}</span></label
                >${option.id
                  ? /* HTML */ `<button
                      type="button"
                      class="option-help"
                      data-element-help="${el.id}"
                      data-element-choice="${option.id}"
                      aria-label="${esc(option.label)} 설명"
                      >?</button
                    >`
                  : ''}</div
              >`
          )
          .join('')}</div
      ></fieldset
    >`;
  }
  function elementContent(el, row, i, answers) {
    if (!Q.elementContentTypes.includes(el.id)) return '';
    const plan = row.elementContents?.[el.id] || {};
    const label = el.id === 'form' ? '입력 항목' : el.id === 'table' ? '표의 열' : '표시할 정보';
    const attributes = attrs('screens', i, 'elementContents') + ` data-element="${el.id}"`;
    const itemInput = (item, j, key, title, options) =>
      input(title, item[key], attributes + ` data-item="${j}" data-property="${key}"`, options);
    const features = rowsOf(answers, 'features');
    return `${el.id !== 'button' ? `<p class="field-help">위에 문장으로 설명하거나 아래에 ${label}을 하나씩 추가하세요. 두 곳을 모두 채울 필요는 없어요.</p>${(plan.items || []).map((item, j) => `<section class="content-item" id="content-${row.id}-${el.id}-${item.id}"><div class="card-top"><h5>${label} ${j + 1}</h5><div class="inline-actions"><button type="button" class="text-button" data-content-move="${j}" data-direction="-1" data-screen="${i}" data-element="${el.id}" aria-label="${label} ${j + 1} 위로" ${j === 0 ? 'disabled' : ''}>↑</button><button type="button" class="text-button" data-content-move="${j}" data-direction="1" data-screen="${i}" data-element="${el.id}" aria-label="${label} ${j + 1} 아래로" ${j === plan.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="text-button danger-text" data-content-remove="${j}" data-screen="${i}" data-element="${el.id}">삭제</button></div></div>${itemInput(item, j, 'name', el.id === 'form' ? '항목 이름' : el.id === 'table' ? '열 이름' : '정보 이름')}${el.id === 'form' ? `<div class="field-grid">${itemInput(item, j, 'type', '입력 방식', { type: 'single', options: Q.formInputTypes })}${itemInput(item, j, 'required', '꼭 입력해야 하나요?', { type: 'single', options: ['필수', '선택'] })}</div>${['하나 선택', '여러 개 선택'].includes(item.type) || item.options ? itemInput(item, j, 'options', '선택지 (한 줄에 하나씩)', { type: 'textarea' }) : ''}${itemInput(item, j, 'notes', '설명·제한 (선택)', { help: '예: 인원은 1~6명, 파일은 사진만. 모르면 비워 두세요.' })}` : itemInput(item, j, 'notes', '어떤 내용을 보여 주나요?', { help: '예: 예약 날짜, 처리 상태. 표시 방법이나 정렬이 필요하면 함께 적어요.' })}</section>`).join('')}<button type="button" class="button secondary" data-content-add data-screen="${i}" data-element="${el.id}">+ ${label} 추가</button>` : ''}${request(el.id === 'form' ? '이 폼의 항목과 필수 여부' : el.id === 'table' ? '이 표의 열과 행동' : el.id === 'button' ? '이 버튼의 동작' : '이 요소에 보여 줄 정보', plan.recommend, attributes + ' data-property="recommend"')}${features.length ? `<fieldset class="sub-field"><legend>${el.id === 'form' ? '제출할 때 실행할 기능' : el.id === 'button' ? '누르면 실행할 기능' : '여기서 사용할 기능'} (선택)</legend><div class="choices compact">${features.map((f) => `<label class="choice"><input type="checkbox" ${attributes} data-property="featureIds" value="${esc(f.id)}" ${(plan.featureIds || []).includes(f.id) ? 'checked' : ''}><span>${esc(f.name || '이름 없는 기능')}</span></label>`).join('')}</div></fieldset>` : '<p class="field-help">아래에서 기능을 추가하면 이 요소와 연결할 수 있어요.</p>'}${(plan.featureIds || []).some((id) => !features.some((f) => f.id === id)) ? '<p class="field-help">삭제된 기능 연결이 있어요. 초안에서 확인해 주세요.</p>' : ''}${rowReason(plan.reason, attributes + ' data-property="reason"', `element-${row.id}-${el.id}`)}`;
  }
  function screenEditor(q, answers) {
    const features = rowsOf(answers, 'features');
    return (
      (rowsOf(answers, q.id)
        .map(
          (row, i) =>
            /* HTML */ `<section class="editor-card screen-card" id="row-${q.id}-${i}"
              >${rowHeader(row.name || '새 화면', q.id, i)}<div class="field-grid"
                >${input('화면 이름', row.name, attrs(q.id, i, 'name'), {
                  placeholder: '예: 홈, 검색 결과, 내 기록'
                })}${input('이 화면을 사용하는 사람', row.roles, attrs(q.id, i, 'roles'), {
                  placeholder: '예: 누구나, 로그인한 회원, 운영자'
                })}</div
              >${input(
                '이 화면에서 무엇을 할 수 있어야 하나요?',
                row.purpose,
                attrs(q.id, i, 'purpose'),
                { placeholder: '사용자가 이 화면에 들어오는 목적' }
              )}<div class="recommendation-request screen-recommendation"
                ><label
                  ><input
                    type="checkbox"
                    ${attrs(q.id, i, 'recommendLayout')}
                    ${row.recommendLayout ? 'checked' : ''}
                    aria-describedby="screen-recommendation-scope-${row.id} screen-recommendation-hint-${row.id}"
                  /><span>이 화면의 구성을 AI에 추천 요청</span></label
                ><p class="field-help" id="screen-recommendation-scope-${row.id}"
                  >추천 범위: ${esc(Q.screenRecommendationScope)}</p
                ><p
                  class="field-help"
                  id="screen-recommendation-hint-${row.id}"
                  ${row.recommendLayout ? '' : 'hidden'}
                  >직접 정한 내용은 유지하고 나머지를 제안해 달라고 요청해요. 기획 초안에서 ‘AI와
                  기획 다듬기 · 복사’ 후 외부 AI에 전달하세요.</p
                ></div
              >${screenFeatures(row, i, answers)}<details
                class="element-picker"
                id="elements-${row.id}"
                open
                ><summary
                  >화면에 넣을 요소 고르기
                  <span>${(row.elements || []).length}개 선택</span></summary
                ><p class="field-help"
                  >역할별로 필요한 요소만 골라 보세요. 주황색 테두리가 해당 요소이며, 이미지를
                  누르면 크게 볼 수 있어요.</p
                >${uiElementGroups
                  .map(
                    (group) =>
                      /* HTML */ `<details
                        class="element-group"
                        id="elements-${row.id}-${group.id}"
                        ${uiElements.some(
                          (el) => el.group === group.id && (row.elements || []).includes(el.id)
                        )
                          ? 'open'
                          : ''}
                        ><summary
                          >${esc(group.label)}<span class="element-group-description"
                            >${esc(group.description)}</span
                          ></summary
                        >
                        <div class="element-grid"
                          >${uiElements
                            .filter((el) => el.group === group.id)
                            .map(
                              (el) =>
                                /* HTML */ `<div
                                  class="element-option ${(row.elements || []).includes(el.id)
                                    ? 'selected'
                                    : ''}"
                                  ><button
                                    type="button"
                                    class="element-preview"
                                    data-element-help="${el.id}"
                                    aria-label="${esc(el.label)} 예시 크게 보기"
                                    >${elementExample(el.id)}</button
                                  >
                                  <div class="element-choice"
                                    ><label
                                      ><span
                                        ><input
                                          type="checkbox"
                                          ${attrs(q.id, i, 'elements')}
                                          value="${el.id}"
                                          ${(row.elements || []).includes(el.id) ? 'checked' : ''}
                                        />${esc(el.label)}</span
                                      ></label
                                    ><button
                                      type="button"
                                      class="option-help"
                                      data-element-help="${el.id}"
                                      aria-label="${esc(el.label)} 설명"
                                      >?</button
                                    ></div
                                  ></div
                                >`
                            )
                            .join('')}</div
                        ></details
                      >`
                  )
                  .join('')}</details
              >${(row.elements || [])
                .map((id) => {
                  const el = uiElements.find((e) => e.id === id);
                  return el
                    ? /* HTML */ `<section
                        class="element-settings"
                        aria-label="${esc(el.label)}의 용도와 세부 선택"
                        ><h4>${esc(el.label)}</h4>${input(
                          el.prompt || el.label + '에 무엇을 넣나요?',
                          row.elementNotes?.[id],
                          attrs(q.id, i, 'elementNotes') + ` data-element="${id}"`,
                          { type: 'textarea' }
                        )}${elementContent(el, row, i, answers)}${elementDetail(
                          el,
                          row,
                          i
                        )}</section
                      >`
                    : '';
                })
                .join('')}${(row.customElements || [])
                .map(
                  (item, j) =>
                    /* HTML */ `<section
                      class="element-settings"
                      id="custom-element-${row.id}-${item.id}"
                      ><div class="card-top"
                        ><h4>직접 추가한 요소</h4
                        ><button
                          type="button"
                          class="text-button danger-text"
                          data-screen="${i}"
                          data-remove-element="${j}"
                          aria-label="${esc(item.name || '직접 추가한 요소')} 삭제"
                          >삭제</button
                        ></div
                      >
                      ${input(
                        '요소 이름',
                        item.name,
                        attrs(q.id, i, 'customElements') +
                          ` data-custom="${j}" data-property="name"`
                      )}
                      ${input(
                        '이 화면에서 어떤 용도로 쓰나요?',
                        item.purpose,
                        attrs(q.id, i, 'customElements') +
                          ` data-custom="${j}" data-property="purpose"`,
                        { type: 'textarea' }
                      )}
                    </section>`
                )
                .join('')}<button
                type="button"
                class="button secondary custom-element-add"
                data-add-element
                data-screen="${i}"
                >+ 목록에 없는 요소 직접 추가</button
              >
              ${input('추가로 보여 줄 내용·정보 (선택)', row.content, attrs(q.id, i, 'content'), {
                type: 'textarea',
                placeholder: '예: 제목, 사진, 날짜, 가격, 처리 상태'
              })}<details id="states-${row.id}" class="optional-details"
                ><summary>빈 화면·오류·작은 화면에서의 모습 (선택)</summary
                ><p class="field-help"
                  >처음 자료가 없거나 문제가 생겼을 때 무엇을 보여 줄지 생각해 보세요.</p
                >${input('자료가 아직 없을 때', row.empty, attrs(q.id, i, 'empty'), {
                  placeholder: '예: 안내 문구와 첫 자료 추가 버튼'
                })}${input('작업이 실패했을 때', row.error, attrs(q.id, i, 'error'), {
                  placeholder: '예: 입력 내용을 유지하고 다시 시도할 수 있게'
                })}${input('휴대폰의 작은 화면에서', row.mobile, attrs(q.id, i, 'mobile'), {
                  placeholder: '예: 표를 카드로 바꾸고 메뉴를 아래쪽에 배치'
                })}</details
              >${rowReason(row.reason, attrs(q.id, i, 'reason'), `screen-${row.id}`)}
            </section>`
        )
        .join('') ||
        empty(
          '처음 만나는 화면부터 추가하세요. 아직 화면이 떠오르지 않으면 나중에 돌아와도 괜찮아요.'
        )) + addButton(q.id, '화면 추가')
    );
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
    const selected = recommendations.includes(q.id);
    return /* HTML */ `<div class="recommendation-request"
      ><label
        ><input
          type="checkbox"
          data-recommend="${q.id}"
          ${selected ? 'checked' : ''}
          aria-describedby="recommendation-hint-${q.id}"
        /><span>${esc(q.recommendationLabel || 'AI에 추천 요청')}</span></label
      ><p id="recommendation-hint-${q.id}" class="field-help" ${selected ? '' : 'hidden'}
        >${q.recommendationScope
          ? `앞서 적은 사용자·기능·이용 과정을 바탕으로 ${esc(q.recommendationScope)}을 추천받아요. `
          : ''}기획
        초안에 요청을 담아요. ‘AI와 기획 다듬기 · 복사’로 복사해 AI에 전달하세요.</p
      ></div
    >`;
  }
  function renderQuestion(q, answers = {}, notes = {}, recommendations = []) {
    const value = answers[q.id];
    let control = '';
    if (q.type === 'features') control = featureEditor(answers);
    else if (q.type === 'screens') control = screenEditor(q, answers);
    else if (q.type === 'references') control = referenceEditor(q, answers);
    else if (q.type === 'flow') control = flowEditor(q, answers);
    else if (q.type === 'rows')
      control =
        (q.id === 'roles' ? permissionsEditor(answers) : '') +
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
          .join('') +
        addButton(q.id, (q.rowLabel || '항목') + ' 추가');
    else if (q.type === 'single' || q.type === 'multi') {
      const options =
        q.source === 'features'
          ? rowsOf(answers, 'features').map((f) => ({
              value: f.id,
              label: f.name || '이름 없는 기능'
            }))
          : A.choiceOptions(q).map((o) => ({ value: o, label: q.optionLabels?.[o] || o }));
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
        : ''}${q.type === 'screens'
        ? recommendationEditor(q, recommendations)
        : ''}${control}${q.type === 'screens'
        ? ''
        : recommendationEditor(q, recommendations)}${q.allowReason !== false ||
      A.isAnswered(notes[q.id])
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
      elementOpen = false;
    const closeElement = () => {
      const end = elementOpen ? '</section>' : '';
      elementOpen = false;
      return end;
    };
    const closeQuestion = () => {
      const end =
        closeElement() + (reasonOpen ? '</aside>' : '') + (questionOpen ? '</section>' : '');
      reasonOpen = questionOpen = false;
      return end;
    };
    const body =
      R.report(answers, false, notes, recommendations)
        .split('\n')
        .map((line) => {
          const heading = /^(#{1,6}) (.*)$/.exec(line);
          if (heading) {
            const depth = heading[1].length,
              level = Math.min(6, depth + 1);
            let prefix = depth <= 3 ? closeQuestion() : closeElement();
            if (depth === 6) {
              prefix += '<section class="report-element">';
              elementOpen = true;
            }
            if (depth === 3) {
              prefix += '<section class="report-question">';
              questionOpen = true;
            }
            if (depth === 4 && heading[2] === '선택 이유·추가 메모') {
              prefix += '<aside class="report-rationale">';
              reasonOpen = true;
            }
            return `${prefix}<h${level}>${readable(heading[2])}</h${level}>`;
          }
          if (/^\*\*.*\*\*$/.test(line))
            return /* HTML */ `<p class="report-label"
              ><strong>${readable(line.slice(2, -2))}</strong></p
            >`;
          if (line.startsWith('> '))
            return /* HTML */ `<p class="report-answer">${readable(line.slice(2))}</p>`;
          return line.trim()
            ? /* HTML */ `<p class="${/^[-*] /.test(line) ? 'report-item' : ''}"
                >${readable(line.replace(/^[-*] /, '• '))}</p
              >`
            : '';
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
  const api = { escapeHtml: esc, question: renderQuestion, report: renderReport, elementExample };
  root.BriefViews = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
