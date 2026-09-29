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
    return {
      screen,
      index,
      element: A.elementKeys(screen).includes(state.element) ? state.element : ''
    };
  }
  const elementName = (screen, key) => A.elementLabel(screen, key);
  function preview(screen, key) {
    const description = key.startsWith('custom:')
      ? screen.customElements?.find((el) => el.id === key.slice(7))?.purpose
      : screen.elementNotes?.[key];
    return `<span class="canvas-description">${esc(description || '')}</span>`;
  }
  function references(category = Q.uiElementGroups[0].id) {
    const V = root.BriefViews || require('./views.js');
    if (!Q.uiElementGroups.some((group) => group.id === category) && category !== 'features')
      category = Q.uiElementGroups[0].id;
    return (
      '<div class="reference-picker"><label for="reference-category">참고할 분류</label><select id="reference-category" data-reference-category aria-controls="reference-results"><optgroup label="화면 요소">' +
      Q.uiElementGroups
        .map(
          (group) =>
            `<option value="${group.id}" ${category === group.id ? 'selected' : ''}>${esc(group.label)}</option>`
        )
        .join('') +
      `</optgroup><optgroup label="기능"><option value="features" ${category === 'features' ? 'selected' : ''}>기능 살펴보기</option></optgroup></select></div><div id="reference-results">` +
      Q.uiElementGroups
        .map(
          (group) =>
            `<div class="reference-category insert-elements" data-reference-group="${group.id}" ${category === group.id ? '' : 'hidden'}>${Q.uiElements
              .filter((el) => el.group === group.id)
              .map(
                (el) =>
                  `<div class="insert-element"><button type="button" data-element-help="${el.id}" aria-label="${esc(el.label)} 예시와 설명">${V.elementExample(el.id)}<span>${esc(el.label)}</span></button></div>`
              )
              .join('')}</div>`
        )
        .join('') +
      `<div class="reference-category reference-features" data-reference-group="features" ${category === 'features' ? '' : 'hidden'}>` +
      Q.featureTypes
        .filter((f) => f.id !== 'custom')
        .map(
          (f) =>
            `<button type="button" class="reference-feature" data-feature-help="${f.id}" aria-label="${esc(f.label)} 설명">${esc(f.label)}</button>`
        )
        .join('') +
      '</div></div>'
    );
  }
  function applySizes(container = document) {
    for (const block of container.matches?.('.canvas-block[data-width]')
      ? [container]
      : container.querySelectorAll('.canvas-block[data-width]')) {
      block.style.setProperty('--block-ratio', String(Number(block.dataset.width) / 100));
      block.style.setProperty('--block-height', block.dataset.height + 'px');
    }
  }
  function render(answers, state, inspector, reason) {
    const { screen, index, element } = selection(answers, state);
    const screens = Array.isArray(answers.screens) ? answers.screens : [];
    const common = screens.find((s) => s.isCommon);
    const blocks = A.layoutItems(screen, common);
    const blockHtml = (item, path = []) => {
      if (path.includes(item.key)) return '';
      const { owner, key, inherited } = item;
      const size = A.elementSize(owner, key);
      const children = blocks.filter((child) => child.parent === key);
      return `<div class="canvas-block${inherited ? ' inherited' : ''}${!inherited && key === element ? ' selected' : ''}" data-block-key="${esc(key)}" data-width="${size.width}" data-height="${size.height}">
        <button type="button" class="canvas-block-select" data-canvas-element="${esc(key)}" data-canvas-owner="${owner.id}" ${inherited ? '' : 'draggable="true"'} aria-pressed="${!inherited && key === element}" aria-label="${esc(elementName(owner, key))}${inherited ? ' · 공통 화면에서 수정' : ' 선택'}"><span class="canvas-block-title">${esc(elementName(owner, key))}${inherited ? '<small>공통</small>' : ''}</span><span class="wire-preview" aria-hidden="true">${preview(owner, key)}</span></button>
        ${A.canContain(key) ? `<div class="canvas-children" data-drop-parent="${esc(key)}">${children.map((child) => blockHtml(child, [...path, key])).join('')}<button type="button" class="canvas-add" data-add-element data-screen="${index}" data-target="parent:${esc(key)}" aria-label="${esc(elementName(owner, key))} 안에 요소 추가">+ 안에 추가</button></div>` : ''}
        ${inherited ? '' : `<button type="button" class="canvas-resize" data-resize-element="${esc(key)}" data-resize-owner="${owner.id}" aria-label="${esc(elementName(owner, key))} 크기 조절" title="끌어서 크기 조절 · 방향키로도 조절할 수 있어요"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20 20 8M14 20l6-6"/></svg></button>`}
      </div>`;
    };
    return `<div class="screen-designer" id="screen-designer">
      <nav class="designer-screens" aria-label="기획할 화면">${common ? `<button type="button" class="screen-tab common-tab" data-designer-screen="${common.id}" aria-pressed="${screen.id === common.id}"><span>▣</span> 기본 공통 화면</button>` : '<button type="button" class="screen-tab common-tab" data-create-common>▣ 기본 공통 화면</button>'}${screens
        .filter((s) => !s.isCommon)
        .map(
          (s) =>
            `<div class="screen-tab-item"><button type="button" class="screen-tab" data-designer-screen="${s.id}" aria-pressed="${screen.id === s.id}">${esc(label(s))}</button><button type="button" class="screen-tab-close" data-remove="screens" data-index="${screens.indexOf(s)}" aria-label="${esc(label(s))} 삭제" title="화면 삭제">×</button></div>`
        )
        .join(
          ''
        )}<button type="button" class="screen-tab add-screen" data-add="screens">+ 새 화면</button></nav>
      <div class="designer-toolbar"><span>구역에 요소를 추가하고, 이름과 동작을 적어 보세요.</span><button type="button" class="button secondary small" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="${!state.panelCollapsed}">${state.panelCollapsed ? '설정 열기' : '설정 접기'}</button></div>
      <div class="designer-workspace${state.panelCollapsed ? ' inspector-collapsed' : ''}"><section class="designer-stage" aria-label="화면 배치">
        <div class="designer-stage-heading"><div><span class="designer-eyebrow">${screen.isCommon ? '서비스 공통 레이아웃' : '화면 구성'}</span><h3 data-screen-title="${index}">${esc(label(screen))}</h3></div><button type="button" class="button secondary small" data-designer-settings>화면 설정</button></div>
        <p class="designer-hint">${screen.isCommon ? '여기서 만든 틀을 새 화면에 함께 사용해요.' : common && screen.useCommonLayout !== false ? '공통 요소는 옅게 표시돼요. 선택하면 공통 화면에서 수정해요.' : '이 화면만의 요소를 배치해요.'}</p>
        <div class="canvas-paper" aria-label="${esc(label(screen))} 구성 미리보기"><div class="canvas-chrome"><span>● ● ●</span><span>${esc(label(screen))}</span></div><div class="canvas-layout">
        ${Q.layoutRegions
          .map(
            (region) =>
              `<section class="canvas-region region-${region.id}" data-drop-region="${region.id}" aria-label="${region.label} 영역"><span class="canvas-region-name">${region.label}${region.hint ? '<br>' + esc(region.hint) : ''}</span>${blocks
                .filter((item) => !item.parent && item.region === region.id)
                .map((item) => blockHtml(item))
                .join(
                  ''
                )}<button type="button" class="canvas-add" data-add-element data-screen="${index}" data-target="region:${region.id}" aria-label="${region.label}: 요소 추가">+ 추가</button></section>`
          )
          .join('')}
        </div></div><p class="designer-hint">박스 모서리로 크기를 조절해요. ?에서 요소와 기능 예시를 볼 수 있어요.</p>${reason}
      </section><aside class="designer-inspector" id="designer-inspector" ${state.panelCollapsed ? 'hidden' : ''} aria-label="요소 설정과 참고 자료">
        <div class="inspector-heading"><h4 tabindex="-1" id="inspector-title">${state.referenceOpen ? '참고 자료' : '설정'}</h4>${state.referenceOpen ? '<button type="button" class="button secondary small" data-close-reference>← 설정으로</button>' : '<button type="button" class="option-help" data-open-reference aria-label="요소·기능 참고 자료 보기" title="요소·기능 참고 자료">?</button>'}</div>
        <div class="inspector-body" id="designer-inspector-body">${state.referenceOpen ? references(state.referenceCategory) : `<button type="button" class="button secondary inspector-add" data-add-element data-screen="${index}">+ 요소 추가</button>${inspector}`}</div>
      </aside></div></div>`;
  }
  const api = { selection, elementName, preview, references, applySizes, render };
  root.BriefDesigner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
