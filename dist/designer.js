(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const A = root.BriefAnswers || require('./answers.js');
  const esc = (value) => (root.BriefViews || require('./views.js')).escapeHtml(value);
  const label = (row) => (row.isCommon ? '기본 공통 화면' : row.name || '새 화면');
  function selection(answers, state = {}) {
    const screens = Array.isArray(answers.screens) ? answers.screens : [];
    let index = screens.findIndex((s) => s.id === state.screenId);
    if (index < 0) index = screens.findIndex((s) => s.isCommon);
    if (index < 0 && screens.length) index = 0;
    const screen = screens[index] || { id: '', isCommon: true, elements: [] };
    const element = A.elementKeys(screen).includes(state.element) ? state.element : '';
    return {
      screen,
      index,
      element,
      panel: ['elements', 'features', 'settings'].includes(state.panel) ? state.panel : 'elements'
    };
  }
  function elementName(screen, key) {
    return key.startsWith('custom:')
      ? screen.customElements?.find((el) => el.id === key.slice(7))?.name || '직접 추가한 요소'
      : Q.uiElements.find((el) => el.id === key)?.label || key;
  }
  function preview(screen, key) {
    const plan = key.startsWith('custom:')
      ? screen.customElements?.find((el) => el.id === key.slice(7))
      : screen.elementContents?.[key];
    const names = (plan?.items || []).slice(0, 4).map((item) => item.name || '항목');
    if (key === 'form')
      return `<div class="wire-form">${(names.length ? names : ['입력 항목', '입력 항목']).map((name) => `<span>${esc(name)}<i></i></span>`).join('')}<b>확인</b></div>`;
    if (key === 'table')
      return `<div class="wire-table"><div>${(names.length ? names : ['항목', '내용', '상태']).map((name) => `<b>${esc(name)}</b>`).join('')}</div><i></i><i></i></div>`;
    if (['appbar', 'tabs', 'bottomnav', 'breadcrumbs', 'footer'].includes(key))
      return '<div class="wire-nav"><b>●</b><i></i><i></i><i></i></div>';
    if (['sidebar', 'rightpanel', 'drawer'].includes(key))
      return '<div class="wire-menu"><i></i><i></i><i></i></div>';
    if (['button', 'fab', 'link'].includes(key))
      return '<div class="wire-action">' + (key === 'fab' ? '＋' : '실행 →') + '</div>';
    if (['cards', 'gallery', 'image', 'video'].includes(key))
      return '<div class="wire-cards"><i>▧</i><i>▧</i></div>';
    if (key === 'search') return '<div class="wire-search">⌕ <span>검색어</span></div>';
    if (key === 'calendar')
      return (
        '<div class="wire-calendar">' +
        Array.from({ length: 14 }, (_, i) => '<i>' + (i + 1) + '</i>').join('') +
        '</div>'
      );
    return '<div class="wire-menu"><i></i><i></i></div>';
  }
  function render(answers, state, inspector, reason) {
    // ponytail: one built-in block per kind; repeated instances need instance IDs across saved plans.
    const { screen, index, element, panel } = selection(answers, state);
    const screens = Array.isArray(answers.screens) ? answers.screens : [];
    const common = screens.find((s) => s.isCommon);
    const inherited =
      !screen.isCommon && screen.useCommonLayout !== false && common
        ? A.elementKeys(common)
            .filter((key) => !A.elementKeys(screen).includes(key))
            .map((key) => ({ owner: common, key, inherited: true }))
        : [];
    const blocks = [
      ...inherited,
      ...A.elementKeys(screen).map((key) => ({ owner: screen, key, inherited: false }))
    ];
    const palette = Q.uiElementGroups
      .map(
        (group) =>
          `<details class="insert-group" ${group.id === 'navigation' ? 'open' : ''}><summary>${esc(group.label)}</summary><div class="insert-elements">${Q.uiElements
            .filter((el) => el.group === group.id)
            .map((el) => {
              const own = (screen.elements || []).includes(el.id);
              const shared = inherited.some((item) => item.key === el.id);
              return `<div class="insert-element"><button type="button" data-insert-element="${el.id}" aria-label="${esc(el.label)} ${own ? '선택' : shared ? '공통 화면에서 수정' : '삽입'}">${(root.BriefViews || require('./views.js')).elementExample(el.id)}<span>${esc(el.label)}</span>${own || shared ? `<small>${own ? '배치됨' : '공통'}</small>` : ''}</button><button type="button" class="option-help" data-element-help="${el.id}" aria-label="${esc(el.label)} 설명">?</button></div>`;
            })
            .join('')}</div></details>`
      )
      .join('');
    return `<div class="screen-designer" id="screen-designer">
      <nav class="designer-screens" aria-label="기획할 화면">${common ? `<button type="button" class="screen-tab common-tab" data-designer-screen="${common.id}" aria-pressed="${screen.id === common.id}"><span>▣</span> 기본 공통 화면</button>` : '<button type="button" class="screen-tab common-tab" data-create-common>▣ 기본 공통 화면</button>'}${screens
        .filter((s) => !s.isCommon)
        .map(
          (s) =>
            `<button type="button" class="screen-tab" data-designer-screen="${s.id}" aria-pressed="${screen.id === s.id}">${esc(label(s))}</button>`
        )
        .join(
          ''
        )}<button type="button" class="screen-tab add-screen" data-add="screens">+ 새 화면</button></nav>
      <div class="designer-workspace"><section class="designer-stage" aria-label="화면 배치">
        <div class="designer-stage-heading"><div><span class="designer-eyebrow">${screen.isCommon ? '서비스 공통 레이아웃' : '화면 구성'}</span><h3 data-screen-title="${index}">${esc(label(screen))}</h3></div><button type="button" class="button secondary small" data-designer-settings>화면 설정</button></div>
        <p class="designer-hint">${screen.isCommon ? '여기서 만든 틀을 새 화면에 함께 사용해요.' : common && screen.useCommonLayout !== false ? '공통 요소는 옅게 표시돼요. 선택하면 공통 화면에서 수정해요.' : '이 화면만의 요소를 배치해요.'}</p>
        <div class="canvas-paper" aria-label="${esc(label(screen))} 구성 미리보기"><div class="canvas-chrome"><span>● ● ●</span><span>${esc(label(screen))}</span></div><div class="canvas-layout">
        ${Q.layoutRegions
          .map(
            (region) =>
              `<section class="canvas-region region-${region.id}" data-drop-region="${region.id}" aria-label="${region.label} 영역"><span class="canvas-region-name">${region.label}</span>${
                blocks
                  .filter((item) => A.elementPlacement(item.owner, item.key).region === region.id)
                  .map(({ owner, key, inherited }) => {
                    const placement = A.elementPlacement(owner, key);
                    return `<button type="button" class="canvas-block block-${placement.width === 'half' ? 'half' : 'full'}${inherited ? ' inherited' : ''}${!inherited && key === element ? ' selected' : ''}" data-canvas-element="${esc(key)}" data-canvas-owner="${owner.id}" ${inherited ? '' : 'draggable="true"'} aria-pressed="${!inherited && key === element}" aria-label="${esc(elementName(owner, key))}${inherited ? ' · 공통 화면에서 수정' : ' 선택'}"><span class="canvas-block-title">${esc(elementName(owner, key))}${inherited ? '<small>공통</small>' : ''}</span><span class="wire-preview" aria-hidden="true">${preview(owner, key)}</span></button>`;
                  })
                  .join('') || '<span class="canvas-empty">요소를 여기에 배치</span>'
              }</section>`
          )
          .join('')}
        </div></div>${!blocks.length ? '<p class="designer-empty-guide">오른쪽에서 요소를 클릭해 첫 화면을 구성하세요.</p>' : ''}${reason}
      </section><aside class="designer-inspector" aria-label="요소와 기능 편집"><div class="inspector-tabs" role="group" aria-label="편집 도구">${[
        ['elements', '요소'],
        ['features', '기능'],
        ['settings', '설정']
      ]
        .map(
          ([id, text]) =>
            `<button type="button" data-designer-panel="${id}" aria-pressed="${panel === id}">${text}</button>`
        )
        .join(
          ''
        )}</div><div class="inspector-body" id="designer-inspector-body"><h4 tabindex="-1" id="inspector-title">${esc(panel === 'elements' ? '요소 삽입' : panel === 'features' ? (element ? elementName(screen, element) + '의 기능' : '기능 삽입') : element ? elementName(screen, element) : label(screen))}</h4>${panel === 'elements' ? palette + `<button type="button" class="button secondary" data-add-element data-screen="${index}">+ 요소 직접 추가</button>` : inspector}</div></aside></div></div>`;
  }
  const api = { selection, elementName, preview, render };
  root.BriefDesigner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
