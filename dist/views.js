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
  function featureEditor(answers) {
    return /* HTML */ `<div class="catalog"
        >${featureTypes
          .filter((f) => f.id !== 'custom')
          .map(
            (f) =>
              /* HTML */ `<div class="catalog-entry"
                ><button type="button" class="catalog-item" data-feature="${f.id}"
                  ><strong>${esc(f.label)} <span aria-hidden="true">＋</span></strong
                  ><span>${esc(f.description)}</span></button
                ><button
                  type="button"
                  class="option-help"
                  data-feature-help="${f.id}"
                  aria-label="${esc(f.label)} 설명"
                  >?</button
                ></div
              >`
          )
          .join('')}</div
      ><p class="field-help"
        >유형을 누르면 아래에 기능 카드가 생겨요. 같은 유형도 여러 번 추가할 수 있어요.</p
      ><div class="editor-list"
        >${rowsOf(answers, 'features')
          .map(
            (row, i) =>
              /* HTML */ `<section class="editor-card" id="row-features-${i}"
                >${rowHeader(row.name || '새 기능', 'features', i)}<div class="field-grid"
                  >${input('기능 이름', row.name, attrs('features', i, 'name'), {
                    placeholder: '사용자가 할 수 있는 일을 이름 붙여 주세요'
                  })}${input('사용하는 사람', row.actor, attrs('features', i, 'actor'), {
                    placeholder: '예: 방문자, 회원, 담당자'
                  })}</div
                >${input(
                  '어떤 일을 하고, 어떤 결과를 얻나요?',
                  row.outcome,
                  attrs('features', i, 'outcome'),
                  {
                    type: 'textarea',
                    placeholder: '사용자가 하는 행동과 확인할 결과를 적어 주세요.'
                  }
                )}${row.savedInfo
                  ? /* HTML */ `<details class="optional-details" id="saved-${row.id}" open
                      ><summary>이전에 작성한 저장 정보</summary>${input(
                        '이 기능을 사용한 뒤 어떤 정보가 남아야 하나요?',
                        row.savedInfo,
                        attrs('features', i, 'savedInfo'),
                        {
                          type: 'textarea',
                          help: '예: 예약 날짜와 확정 상태, 작성한 글, 주문 내역. 남길 정보가 없다면 비워 두세요. 실제 개인정보는 적지 마세요.'
                        }
                      )}</details
                    >`
                  : ''}<div class="field-grid"
                  >${input('언제 필요한가요?', row.priority, attrs('features', i, 'priority'), {
                    type: 'single',
                    options: priorities
                  })}${input(
                    '이 기능의 규칙·추가 메모 (선택)',
                    row.notes,
                    attrs('features', i, 'notes'),
                    { placeholder: '제한, 예외, 아직 정하지 못한 점' }
                  )}</div
                ></section
              >`
          )
          .join('')}</div
      >${addButton('features', '목록에 없는 기능 직접 추가')}`;
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
              ><div class="input-field"
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
    const options = el.detail.multiple
      ? el.detail.options
      : [...el.detail.options, { id: '', label: '아직 정하지 않음' }];
    return /* HTML */ `<fieldset class="sub-field element-detail"
      ><legend>${esc(el.detail.label)}</legend
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
              )}<fieldset class="sub-field"
                ><legend>이 화면에서 제공할 기능</legend>${features.length
                  ? /* HTML */ `<div class="choices compact"
                      >${features
                        .map(
                          (f) =>
                            /* HTML */ `<label class="choice"
                              ><input
                                type="checkbox"
                                ${attrs(q.id, i, 'featureIds')}
                                value="${f.id}"
                                ${(row.featureIds || []).includes(f.id) ? 'checked' : ''}
                              /><span>${esc(f.name || '이름 없는 기능')}</span></label
                            >`
                        )
                        .join('')}</div
                    >`
                  : '<p class="field-help">‘필요한 기능’에서 추가하면 이곳에서 연결할 수 있어요.</p>'}${(
                  row.featureIds || []
                ).some((id) => !features.some((f) => f.id === id))
                  ? '<p class="field-help">삭제된 기능 연결이 있어요. 기획 초안에서 확인할 수 있어요.</p>'
                  : ''}</fieldset
              ><div class="recommendation-request screen-recommendation"
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
              ><details class="element-picker" id="elements-${row.id}" open
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
                          attrs(q.id, i, 'elementNotes') + ` data-element="${id}"`
                        )}${elementDetail(el, row, i)}</section
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
              ${input('보여 줄 내용·정보', row.content, attrs(q.id, i, 'content'), {
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
              ></section
            >`
        )
        .join('') ||
        empty(
          '처음 만나는 화면부터 추가하세요. 아직 화면이 떠오르지 않으면 나중에 돌아와도 괜찮아요.'
        )) + addButton(q.id, '화면 추가')
    );
  }
  function scopeEditor(answers) {
    return (
      rowsOf(answers, 'features')
        .map(
          (f, i) =>
            /* HTML */ `<div class="scope-row"
              ><div
                ><strong>${esc(f.name || '이름 없는 기능')}</strong
                ><p>${esc(f.outcome || '제공할 결과를 아직 적지 않았어요.')}</p></div
              >${input('출시 범위', f.priority, attrs('features', i, 'priority'), {
                type: 'single',
                options: priorities
              })}</div
            >`
        )
        .join('') || empty('‘필요한 기능’에서 추가하면 이곳에 모여요.')
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
    else if (q.type === 'scope') control = scopeEditor(answers);
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
        : empty('‘필요한 기능’에서 추가한 뒤 이곳에서 선택할 수 있어요.');
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
        : recommendationEditor(q, recommendations)}${reasonEditor(q, notes)}</fieldset
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
      reasonOpen = false;
    const closeQuestion = () => {
      const end = (reasonOpen ? '</aside>' : '') + (questionOpen ? '</section>' : '');
      reasonOpen = questionOpen = false;
      return end;
    };
    const body =
      R.report(answers, false, notes, recommendations)
        .split('\n')
        .map((line) => {
          const heading = /^(#{1,5}) (.*)$/.exec(line);
          if (heading) {
            const depth = heading[1].length,
              level = depth + 1;
            let prefix = depth <= 3 ? closeQuestion() : '';
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
