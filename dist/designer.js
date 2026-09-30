(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const A = root.BriefAnswers || require('./answers.js');
  const esc = (value) => (root.BriefViews || require('./views.js')).escapeHtml(value);
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
      panel: ['screen', 'element', 'reference'].includes(state.panel)
        ? state.panel
        : element
          ? 'element'
          : 'screen'
    };
  }
  const elementName = (screen, key) => A.elementLabel(screen, key);
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
    const scope = container.ownerDocument || container;
    for (const block of scope.querySelectorAll('.canvas-block[data-width]')) {
      block.style.width = block.dataset.width + '%';
      block.style.left = block.dataset.x + '%';
      block.style.top = block.dataset.y + 'px';
      block.style.zIndex = block.dataset.level;
      block.style.setProperty('--block-height', block.dataset.height + 'px');
    }
    for (const grid of [...scope.querySelectorAll('.canvas-grid')].reverse()) {
      const blocks = [...grid.querySelectorAll(':scope > .canvas-block')];
      grid.style.minHeight =
        Math.max(32, ...blocks.map((block) => Number(block.dataset.y) + block.offsetHeight + 16)) +
        'px';
    }
  }
  function applyVisibility(state, screenId) {
    const hidden = state.hiddenElements?.[screenId] || [];
    const boxes = [...document.querySelectorAll('.canvas-block')];
    for (const block of boxes)
      block.classList.toggle('level-hidden', hidden.includes(block.dataset.blockKey));
    const checks = [...document.querySelectorAll('[data-level-key]')];
    for (const check of checks) check.checked = !hidden.includes(check.dataset.levelKey);
    const visible = checks.filter((check) => check.checked).length;
    const all = document.querySelector('[data-all-levels]');
    if (all) {
      all.checked = visible === checks.length;
      all.indeterminate = visible > 0 && visible < checks.length;
    }
    const count = document.querySelector('[data-visible-level-count]');
    if (count)
      count.textContent = visible === checks.length ? '전체' : `${visible}/${checks.length}`;
  }
  function render(answers, state, inspector, reason, recommendation = '') {
    const { screen, index, element, panel } = selection(answers, state);
    const screens = Array.isArray(answers.screens) ? answers.screens : [];
    const label = (row) => A.screenLabel(screens, row);
    const tabs = [
      ['screen', '화면'],
      ['element', '요소'],
      ['reference', '참고']
    ];
    const content =
      panel === 'reference'
        ? references(state.referenceCategory)
        : (panel === 'element'
            ? `<button type="button" class="button secondary inspector-add" data-add-element data-screen="${index}">+ 요소 추가</button>`
            : '') + inspector;
    const common = screens.find((s) => s.isCommon);
    const blocks = A.layoutItems(screen, common);
    const positions = A.canvasLayout(blocks);
    const levels = A.elementLevels(blocks);
    const gridHtml = (items, target, path = []) => {
      return `<div class="canvas-grid${target.startsWith('parent:') ? ' canvas-children' : ''}" ${target.startsWith('parent:') ? `data-drop-parent="${esc(target.slice(7))}"` : `data-drop-region="${target.slice(7)}"`}>${items.map((item) => blockHtml(item, path)).join('')}</div>`;
    };
    const blockHtml = (item, path = []) => {
      if (path.includes(item.key)) return '';
      const { owner, key, inherited } = item;
      const size = A.elementSize(owner, key);
      const position = positions.get(key);
      const children = blocks.filter((child) => child.parent === key);
      return `<div class="canvas-block${inherited ? ' inherited' : ''}${!inherited && key === element ? ' selected' : ''}" data-block-key="${esc(key)}" data-level="${levels.get(key)}" data-width="${size.width}" data-height="${size.height}" data-x="${position.x}" data-y="${position.y}">
        <div class="canvas-block-heading"><button type="button" class="canvas-block-select" data-canvas-element="${esc(key)}" data-canvas-owner="${owner.id}" ${inherited ? '' : 'draggable="true"'} aria-pressed="${!inherited && key === element}" aria-label="${esc(elementName(owner, key))}${inherited ? ' · 공통 화면에서 수정' : ' 선택'}"><span class="canvas-block-title">${esc(elementName(owner, key))}${inherited ? '<small>공통</small>' : ''}</span></button>${A.canContain(key) ? `<button type="button" class="canvas-add-child" data-add-element data-screen="${index}" data-target="parent:${esc(key)}" data-drop-parent="${esc(key)}" aria-label="${esc(elementName(owner, key))} 안에 요소 추가" title="이 요소 안에 추가">+</button>` : ''}</div>
        ${A.canContain(key) ? gridHtml(children, 'parent:' + key, [...path, key]) : ''}
        <span class="canvas-level">${levels.get(key)}레벨</span>
        ${inherited ? '' : `<button type="button" class="canvas-resize" data-resize-element="${esc(key)}" data-resize-owner="${owner.id}" aria-label="${esc(elementName(owner, key))} 크기 조절" title="끌어서 크기 조절 · 방향키로도 조절할 수 있어요"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20 20 8M14 20l6-6"/></svg></button>`}
      </div>`;
    };
    return `<div class="screen-designer" id="screen-designer">
      <div class="designer-toolbar"><nav class="designer-screens" aria-label="기획할 화면">${common ? `<button type="button" class="screen-tab common-tab" data-designer-screen="${common.id}" aria-pressed="${screen.id === common.id}"><span>▣</span> 기본 공통 화면</button>` : '<button type="button" class="screen-tab common-tab" data-create-common>▣ 기본 공통 화면</button>'}${screens
        .filter((s) => !s.isCommon)
        .map(
          (s) =>
            `<div class="screen-tab-item"><button type="button" class="screen-tab" data-designer-screen="${s.id}" aria-pressed="${screen.id === s.id}">${esc(label(s))}</button><button type="button" class="screen-tab-close" data-remove="screens" data-index="${screens.indexOf(s)}" aria-label="${esc(label(s))} 삭제" title="화면 삭제">×</button></div>`
        )
        .join(
          ''
        )}<button type="button" class="screen-tab add-screen" data-add="screens">+ 새 화면</button></nav>${recommendation}<button type="button" class="button secondary small" data-expand-designer aria-pressed="${Boolean(state.expanded)}" aria-controls="screen-designer">${state.expanded ? '↙ 작게 보기' : '⛶ 크게 보기'}</button></div>
      <div class="designer-workspace${state.panelCollapsed ? ' inspector-collapsed' : ''}"><section class="designer-stage" aria-label="화면 배치">
        <div class="designer-stage-heading"><div class="designer-stage-title"><h3 data-screen-title="${index}">${esc(label(screen))}</h3><p class="designer-hint">${screen.isCommon ? '여기서 만든 틀을 새 화면에 함께 사용해요.' : common && screen.useCommonLayout !== false ? '공통 요소는 옅게 표시돼요. 선택하면 공통 화면에서 수정해요.' : '이 화면만의 요소를 배치해요.'}</p></div></div>
        <div class="canvas-paper" aria-label="${esc(label(screen))} 구성 미리보기"><div class="canvas-chrome"><span aria-hidden="true">● ● ●</span><details class="level-filter"><summary aria-label="요소 보기"><span>요소 보기</span><small data-visible-level-count>전체</small></summary><fieldset class="level-menu"><legend class="visually-hidden">표시할 요소 레벨</legend><label class="level-all"><input type="checkbox" data-all-levels checked ${blocks.length ? '' : 'disabled'}>전체</label>${
          blocks.length
            ? [...blocks]
                .sort((a, b) => levels.get(b.key) - levels.get(a.key))
                .map(
                  (item) =>
                    `<label><input type="checkbox" data-level-key="${esc(item.key)}" checked><span><strong>${levels.get(item.key)}레벨</strong> <span data-level-name="${esc(item.key)}">${esc(elementName(item.owner, item.key))}</span>${item.inherited ? ' · 공통' : ''}</span></label>`
                )
                .join('')
            : '<p class="field-help">추가한 요소가 없어요.</p>'
        }</fieldset></details></div><div class="canvas-layout">
        ${Q.layoutRegions
          .map(
            (region) =>
              `<section class="canvas-region region-${region.id}" data-drop-region="${region.id}" aria-label="${region.label} 영역"><div class="canvas-region-heading"><span class="canvas-region-name">${region.label}</span><button type="button" class="canvas-add" data-add-element data-screen="${index}" data-target="region:${region.id}" aria-label="${region.label}: 요소 추가" title="이 구역에 추가">+</button></div>${region.hint ? `<span class="canvas-region-hint">${esc(region.hint)}</span>` : ''}${gridHtml(
                blocks.filter((item) => !item.parent && item.region === region.id),
                'region:' + region.id
              )}</section>`
          )
          .join('')}
        </div></div><p class="designer-hint">이름을 끌어 원하는 곳에 놓고, 모서리로 크기를 조절해요. 점에 가볍게 맞춰지고 다른 요소는 그대로 있어요.</p>${reason}
      </section><div class="designer-panel${state.panelCollapsed ? ' panel-collapsed' : ''}">${state.panelCollapsed ? '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="false" aria-label="설정 패널 펼치기" title="설정 패널 펼치기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>' : ''}<aside class="designer-inspector" id="designer-inspector" ${state.panelCollapsed ? 'hidden' : ''} aria-label="요소 설정과 참고 자료">
        <div class="inspector-heading">${state.panelCollapsed ? '' : '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="true" aria-label="설정 패널 접기" title="설정 패널 접기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>'}<div class="inspector-tabs" role="tablist" aria-label="화면 편집 설정">${tabs.map(([id, text]) => `<button type="button" role="tab" id="inspector-tab-${id}" data-designer-panel="${id}" aria-selected="${panel === id}" aria-controls="inspector-panel-${id}" tabindex="${panel === id ? 0 : -1}">${text}</button>`).join('')}</div></div>
        <div class="inspector-body" id="designer-inspector-body">${tabs.map(([id, text]) => `<section role="tabpanel" id="inspector-panel-${id}" aria-labelledby="inspector-tab-${id}" ${panel === id ? '' : 'hidden'}>${panel === id ? `<h4 class="visually-hidden" tabindex="-1" id="inspector-title">${text}</h4>${content}` : ''}</section>`).join('')}</div>
      </aside></div></div></div>`;
  }
  const api = { selection, elementName, references, applySizes, applyVisibility, render };
  root.BriefDesigner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
