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
    const world = scope.querySelector('.canvas-world');
    if (world) world.style.width = world.dataset.canvasWidth + 'px';
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
        Math.max(Number(grid.dataset.canvasHeight) || 32, ...blocks.map((block) => Number(block.dataset.y) + block.offsetHeight + 16)) +
        'px';
    }
    applyCamera();
    drawMinimap();
  }
  function applyVisibility(state, screenId) {
    const hidden = state.hiddenLevels?.[screenId] || [];
    const boxes = [...document.querySelectorAll('.canvas-block')];
    for (const block of boxes)
      block.classList.toggle('level-hidden', hidden.includes(Number(block.dataset.level)));
    const checks = [...document.querySelectorAll('[data-view-level]')];
    for (const check of checks) check.checked = !hidden.includes(Number(check.dataset.viewLevel));
    const visible = checks.filter((check) => check.checked).length;
    const all = document.querySelector('[data-all-levels]');
    if (all) {
      all.checked = visible === checks.length;
      all.indeterminate = visible > 0 && visible < checks.length;
    }
    const count = document.querySelector('[data-visible-level-count]');
    if (count)
      count.textContent = visible === checks.length ? '전체' : `${visible}/${checks.length}`;
    drawMinimap();
  }
  let observer;
  function captureView(state) {
    const viewport = document.querySelector('.canvas-viewport'), world = document.querySelector('.canvas-world');
    if (!viewport || !world) return;
    state.views ||= {};
    state.views[world.dataset.screen] = {
      zoom: world.dataset.zoom === 'fit' ? 'fit' : Number(world.dataset.zoom),
      x: viewport.scrollLeft / Number(world.dataset.scale || 1),
      y: viewport.scrollTop / Number(world.dataset.scale || 1)
    };
    drawViewFrame();
  }
  function applyCamera() {
    const viewport = document.querySelector('.canvas-viewport'), world = document.querySelector('.canvas-world');
    if (!viewport || !world) return;
    const scale = world.dataset.zoom === 'fit'
      ? Math.min(1, (viewport.clientWidth - 2) / world.offsetWidth, (viewport.clientHeight - 2) / world.offsetHeight)
      : Number(world.dataset.zoom);
    world.dataset.scale = scale;
    world.style.transform = `scale(${scale})`;
    const space = world.parentElement;
    space.style.width = world.offsetWidth * scale + 'px';
    space.style.height = world.offsetHeight * scale + 'px';
    const size = document.querySelector('[data-canvas-size-label]');
    if (size) size.textContent = `${world.offsetWidth} × ${world.offsetHeight}`;
    drawViewFrame();
  }
  function mountViewport(state) {
    observer?.disconnect();
    const viewport = document.querySelector('.canvas-viewport'), world = document.querySelector('.canvas-world');
    if (!viewport || !world) return;
    const view = state.views?.[world.dataset.screen];
    viewport.scrollLeft = (view?.x || 0) * Number(world.dataset.scale || 1);
    viewport.scrollTop = (view?.y || 0) * Number(world.dataset.scale || 1);
    observer = new ResizeObserver(() => { applyCamera(); drawMinimap(); });
    observer.observe(viewport);
    drawMinimap();
  }
  function zoomTo(state, zoom) {
    const viewport = document.querySelector('.canvas-viewport'), world = document.querySelector('.canvas-world');
    if (!viewport || !world) return;
    const old = Number(world.dataset.scale || 1);
    const x = (viewport.scrollLeft + viewport.clientWidth / 2) / old;
    const y = (viewport.scrollTop + viewport.clientHeight / 2) / old;
    world.dataset.zoom = zoom;
    document.querySelector('[data-canvas-zoom]').value = String(zoom);
    applyCamera();
    const scale = Number(world.dataset.scale);
    viewport.scrollLeft = zoom === 'fit' ? 0 : x * scale - viewport.clientWidth / 2;
    viewport.scrollTop = zoom === 'fit' ? 0 : y * scale - viewport.clientHeight / 2;
    captureView(state);
    drawMinimap();
  }
  function drawViewFrame() {
    const viewport = document.querySelector('.canvas-viewport'), world = document.querySelector('.canvas-world');
    const frame = document.querySelector('.minimap-view');
    if (!viewport || !world || !frame) return;
    const scale = Number(world.dataset.scale || 1);
    for (const [name, value] of Object.entries({ x: viewport.scrollLeft / scale, y: viewport.scrollTop / scale,
      width: Math.min(world.offsetWidth, viewport.clientWidth / scale), height: Math.min(world.offsetHeight, viewport.clientHeight / scale) }))
      frame.setAttribute(name, value);
  }
  function drawMinimap() {
    const map = document.querySelector('#canvas-minimap'), world = document.querySelector('.canvas-world');
    if (!map || !world || map.closest('[hidden]')) return;
    map.setAttribute('viewBox', `0 0 ${world.offsetWidth} ${world.offsetHeight}`);
    const origin = world.getBoundingClientRect(), scale = Number(world.dataset.scale || 1);
    const group = map.querySelector('.minimap-elements');
    group.replaceChildren();
    for (const block of world.querySelectorAll('.canvas-block:not(.level-hidden)')) {
      const rect = block.getBoundingClientRect(), node = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [name, value] of Object.entries({ x: (rect.x - origin.x) / scale, y: (rect.y - origin.y) / scale,
        width: rect.width / scale, height: rect.height / scale })) node.setAttribute(name, value);
      node.setAttribute('class', block.classList.contains('selected') ? 'minimap-selected' : 'minimap-element');
      group.append(node);
    }
    drawViewFrame();
  }
  function navigateMap(event, state) {
    const map = document.querySelector('#canvas-minimap'), world = document.querySelector('.canvas-world');
    const viewport = document.querySelector('.canvas-viewport'), rect = map.getBoundingClientRect();
    const ratio = Math.min(rect.width / world.offsetWidth, rect.height / world.offsetHeight);
    const x = (event.clientX - rect.left - (rect.width - world.offsetWidth * ratio) / 2) / ratio;
    const y = (event.clientY - rect.top - (rect.height - world.offsetHeight * ratio) / 2) / ratio;
    viewport.scrollLeft = x * Number(world.dataset.scale) - viewport.clientWidth / 2;
    viewport.scrollTop = y * Number(world.dataset.scale) - viewport.clientHeight / 2;
    captureView(state);
  }
  function focusBlock(key) {
    const block = [...document.querySelectorAll('.canvas-block')].find(block => block.dataset.blockKey === key);
    block?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function collisions() {
    const pairs = new Map();
    const scale = Number(document.querySelector('.canvas-world')?.dataset.scale || 1);
    for (const grid of document.querySelectorAll('.canvas-grid')) {
      const boxes = [...grid.querySelectorAll(':scope > .canvas-block')];
      const rects = boxes.map(block => block.getBoundingClientRect());
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].dataset.level !== boxes[j].dataset.level) continue;
        const a = rects[i], b = rects[j];
        const width = (Math.min(a.right, b.right) - Math.max(a.left, b.left)) / scale;
        const height = (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) / scale;
        if (width > 0.5 && height > 0.5)
          pairs.set([boxes[i].dataset.blockKey, boxes[j].dataset.blockKey].sort().join('|'), width * height);
      }
    }
    return pairs;
  }
  function levelOptions(items) {
    const counts = new Map();
    for (const level of A.elementLevels(items).values()) counts.set(level, (counts.get(level) || 0) + 1);
    return `<legend class="visually-hidden">표시할 요소 레벨</legend><label class="level-all"><input type="checkbox" data-all-levels checked ${items.length ? '' : 'disabled'}>전체</label>` +
      [...counts].sort(([a], [b]) => b - a).map(([level, count]) =>
        `<label><input type="checkbox" data-view-level="${level}" checked><span><strong>${level}레벨</strong> · ${count}개 요소</span></label>`
      ).join('') + (items.length ? '' : '<p class="field-help">추가한 요소가 없어요.</p>');
  }
  function updateLevels(answers, state) {
    const { screen, element } = selection(answers, state);
    const items = A.layoutItems(screen, answers.screens.find((row) => row.isCommon));
    const levels = A.elementLevels(items);
    for (const block of document.querySelectorAll('.canvas-block')) {
      const level = levels.get(block.dataset.blockKey);
      block.dataset.level = level;
      block.style.zIndex = level;
      block.querySelector(':scope > .canvas-level').textContent = `${level}레벨`;
    }
    document.querySelector('.level-menu').innerHTML = levelOptions(items);
    const input = document.querySelector('[data-element-level]');
    if (input) {
      input.value = levels.get(element);
      input.removeAttribute('aria-invalid');
      document.querySelector('#element-level-error').hidden = true;
      document.querySelector('[data-level-move="-1"]').disabled = input.valueAsNumber <= 1;
      document.querySelector('[data-level-move="1"]').disabled = input.valueAsNumber >= A.MAX_ELEMENT_LEVEL;
    }
    applyVisibility(state, screen.id);
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
    const size = A.canvasSize(screen), zoom = state.views?.[screen.id]?.zoom || 1;
    const positions = A.canvasLayout(blocks);
    const levels = A.elementLevels(blocks);
    const gridHtml = (items, target, path = []) => {
      return `<div class="canvas-grid${target.startsWith('parent:') ? ' canvas-children' : ' canvas-world'}" ${target.startsWith('parent:') ? `data-drop-parent="${esc(target.slice(7))}"` : `data-drop-region="main" data-canvas-width="${size.width}" data-canvas-height="${size.height}" data-screen="${screen.id}" data-zoom="${zoom}"`}>${items.map((item) => blockHtml(item, path)).join('')}</div>`;
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
        <div class="canvas-paper" aria-label="${esc(label(screen))} 구성 미리보기"><div class="canvas-chrome">
          <button type="button" class="button secondary small" data-add-element data-screen="${index}" data-target="region:main">+ 요소 추가</button>
          <div class="canvas-zoom-controls"><button type="button" class="button secondary small" data-zoom-step="-1" aria-label="캔버스 축소">−</button><label class="visually-hidden" for="canvas-zoom">캔버스 확대 비율</label><select id="canvas-zoom" data-canvas-zoom>${[['fit','화면 맞춤'],[.1,'10%'],[.25,'25%'],[.5,'50%'],[.75,'75%'],[1,'100%'],[1.5,'150%'],[2,'200%']].map(([value,text])=>`<option value="${value}" ${String(zoom)===String(value)?'selected':''}>${text}</option>`).join('')}</select><button type="button" class="button secondary small" data-zoom-step="1" aria-label="캔버스 확대">+</button></div>
          <button type="button" class="button secondary small" data-pan-canvas aria-pressed="${Boolean(state.panMode)}">화면 이동</button>
          <span class="canvas-size-label" data-canvas-size-label>${size.width} × ${size.height}</span>
          <div class="canvas-view-controls"><button type="button" class="button secondary small" data-toggle-minimap aria-pressed="${state.minimap !== false}" aria-controls="canvas-minimap-panel">미니맵</button><details class="level-filter"><summary aria-label="요소 보기"><span>요소 보기</span><small data-visible-level-count>전체</small></summary><fieldset class="level-menu">${levelOptions(blocks)}</fieldset></details></div>
        </div><div class="canvas-frame"><div class="canvas-viewport${state.panMode ? ' is-panning' : ''}" tabindex="0" aria-label="화면 설계 작업면" aria-describedby="canvas-navigation-help"><div class="canvas-space">${gridHtml(blocks.filter(item=>!item.parent), 'region:main')}</div></div>
        <div class="canvas-minimap" id="canvas-minimap-panel" ${state.minimap === false ? 'hidden' : ''}><svg id="canvas-minimap" tabindex="0" role="group" aria-label="미니맵 위치 이동. 누르거나 끌기, 방향키로 이동" preserveAspectRatio="xMidYMid meet"><g class="minimap-elements"></g><rect class="minimap-view"/></svg></div></div></div><p class="designer-hint" id="canvas-navigation-help">이름을 끌어 배치하고 모서리로 크기를 조절해요. 화면 이동 또는 가운데 버튼으로 작업면을 끌고, 미니맵으로 위치를 찾으세요.</p>${reason}
      </section><div class="designer-panel${state.panelCollapsed ? ' panel-collapsed' : ''}">${state.panelCollapsed ? '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="false" aria-label="설정 패널 펼치기" title="설정 패널 펼치기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>' : ''}<aside class="designer-inspector" id="designer-inspector" ${state.panelCollapsed ? 'hidden' : ''} aria-label="요소 설정과 참고 자료">
        <div class="inspector-heading">${state.panelCollapsed ? '' : '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="true" aria-label="설정 패널 접기" title="설정 패널 접기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>'}<div class="inspector-tabs" role="tablist" aria-label="화면 편집 설정">${tabs.map(([id, text]) => `<button type="button" role="tab" id="inspector-tab-${id}" data-designer-panel="${id}" aria-selected="${panel === id}" aria-controls="inspector-panel-${id}" tabindex="${panel === id ? 0 : -1}">${text}</button>`).join('')}</div></div>
        <div class="inspector-body" id="designer-inspector-body">${tabs.map(([id, text]) => `<section role="tabpanel" id="inspector-panel-${id}" aria-labelledby="inspector-tab-${id}" ${panel === id ? '' : 'hidden'}>${panel === id ? `<h4 class="visually-hidden" tabindex="-1" id="inspector-title">${text}</h4>${content}` : ''}</section>`).join('')}</div>
      </aside></div></div></div>`;
  }
  const api = { selection, elementName, references, applySizes, applyVisibility, collisions, updateLevels, captureView, mountViewport, zoomTo, drawMinimap, navigateMap, focusBlock, render };
  root.BriefDesigner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
