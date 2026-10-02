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
    const elements = (state.elements?.includes(element) ? state.elements : element ? [element] : [])
      .filter(key => A.elementKeys(screen).includes(key) && !state.hiddenLevels?.[screen.id]?.includes(A.elementPlacement(screen, key).level ?? 1));
    return {
      screen,
      index,
      element,
      elements,
      panel: ['screen', 'element', 'reference'].includes(state.panel)
        ? state.panel
        : element
          ? 'element'
          : 'screen'
    };
  }
  const elementName = (screen, key) => A.elementLabel(screen, key);
  function manual() {
    const sections = [
      ['처음 시작하기', [
        ['작업 순서', '화면을 선택한 뒤 오른쪽 ‘화면’ 탭에서 작업면 크기를 정하세요. 캔버스의 ‘+ 요소 추가’로 박스를 만들고, 이름·용도를 적은 다음 위치와 크기를 조절하세요.'],
        ['새 화면과 기본 공통 화면', '‘+ 새 화면’은 별도 화면을 만듭니다. 기본 공통 화면은 여러 화면이 함께 쓰는 틀이에요. 개별 화면의 ‘기본 공통 화면 사용’ 체크로 적용 여부를 정해요. 옅게 표시된 공통 요소를 선택하면 공통 화면으로 이동해 수정해요.'],
        ['작업면 크기', '‘화면’ 탭에서 너비·기준 높이를 입력하거나 모니터 크기·해상도를 선택해요. 너비를 바꾸면 요소의 가로 위치와 너비도 비례해 바뀌고, 아래 공간은 요소에 맞춰 늘어나요. 화면을 크게 보고 싶을 때는 작업면 크기 대신 확대 비율을 바꾸세요.']
      ]],
      ['요소 추가와 오른쪽 설정 패널', [
        ['두 가지 + 버튼', '캔버스 위 ‘+ 요소 추가’는 작업면에 요소를 만들어요. 요소 이름 옆 +는 그 요소 안에 자식을 만들어요. 패널의 ‘+ 요소 추가’는 선택한 요소와 같은 소속에 추가해요.'],
        ['화면 · 요소 · 참고', '‘화면’은 화면 이름·용도·작업면 크기, ‘요소’는 선택한 요소의 이름·용도·배치를 설정해요. ‘참고’에서는 요소와 기능의 예시를 살펴볼 수 있어요. 패널 가장자리 화살표로 접고 펼칠 수 있어요.'],
        ['이름과 삭제', '새 이름은 번호가 자동으로 붙어요. 화면 이름은 프로젝트 안에서, 요소 이름은 같은 화면에서 공통 요소를 포함해 중복할 수 없어요. 휴지통은 선택한 요소를 삭제하고 자식은 밖으로 옮겨 보존해요. 화면 탭의 ×는 해당 화면을 삭제해요.']
      ]],
      ['여러 요소 선택과 이동', [
        ['영역으로 선택', '빈 곳에서 드래그해 요소를 완전히 둘러싸세요. Shift·Ctrl·Command를 누르고 이름을 클릭하면 선택에 더하거나 빼요. 수정 키를 누른 채 영역을 드래그하면 기존 선택에 더해요. 숨긴 요소와 상속된 공통 요소는 영역 선택에서 제외돼요.'],
        ['함께 이동', '선택한 요소의 이름을 끌면 묶음이 같은 거리만큼 이동해요. 작업면에 초점이 있을 때 방향키, 또는 패널의 방향 버튼으로도 옮길 수 있어요. 크기·간격·소속·레벨은 유지되고, 부모와 자식을 함께 선택해도 자식이 두 번 이동하지 않아요.'],
        ['선택 해제와 터치', '이름만 클릭하면 개별 설정으로 돌아가요. 빈 곳 클릭이나 ‘선택 해제’로 선택을 비울 수 있어요. 터치에서는 빈 곳을 끌어 선택한 뒤 패널 방향 버튼으로 함께 이동하세요.']
      ]],
      ['크기 조절과 부모 요소', [
        ['크기 손잡이', '박스 오른쪽 아래 손잡이를 끌어 크기를 바꿔요. 손잡이에 초점을 두고 방향키로도 조절할 수 있어요. ‘절반’·‘전체’는 현재 소속 공간을 기준으로 너비를 정해요. 자식이 차지하는 공간보다 작게는 줄어들지 않을 수 있어요.'],
        ['소속 변경', '요소를 다른 박스 위로 끌어도 자동으로 포함되지 않아요. ‘요소’ 탭의 ‘소속 변경’에서 부모를 고른 뒤 적용하세요. ‘없음’을 선택하면 캔버스로 분리해요. 픽셀 크기를 유지하며, 새 부모가 너무 좁으면 먼저 부모를 넓혀야 해요.'],
        ['부모 이름 수정', '‘현재 소속 · 부모 요소’에 부모 이름이 표시돼요. 연필 모양의 ‘부모 이름 수정’은 그 부모의 이름만 바꾸며 소속은 바뀌지 않아요. 공통 부모의 이름을 바꾸면 사용하는 화면에도 반영돼요.']
      ]],
      ['레벨과 가려진 요소 보기', [
        ['앞뒤 순서', '같은 부모 안에서는 레벨 숫자가 높을수록 앞에 보여요. 숫자를 직접 입력하거나 ↑·↓로 바꾸세요. 같은 부모의 같은 레벨끼리는 겹칠 수 없고, 이동으로 새 충돌이 생기면 원래 위치로 돌아가요. 묶음 이동도 전체가 복원돼요.'],
        ['레벨과 포함 관계는 달라요', '캔버스에 새로 추가하거나 분리하면 1레벨, 부모 안에 새로 추가하거나 소속을 바꾸면 부모 레벨 +1로 시작해요. 자식은 부모 묶음 안에서 겹쳐요. 예를 들어 부모 안의 3레벨과 캔버스의 3레벨은 같은 소속이 아니며, 숫자만으로 포함 관계를 판단하지 않아요.'],
        ['요소 보기', '오른쪽 위 ‘요소 보기’에서 체크한 레벨만 표시해요. ‘전체’를 해제하면 모두 숨겨지고, 필요한 레벨만 켜서 뒤에 가려진 요소를 편집할 수 있어요. 레벨을 변경하면 새 레벨이 자동으로 표시돼요. 숨김은 편집용이며 초안에서 요소를 제외하지 않아요.']
      ]],
      ['확대 · 화면 이동 · 미니맵', [
        ['확대 비율과 크게 보기', '−·+와 비율 선택은 보이는 배율만 바꿔요. ‘화면 맞춤’은 작업면 전체를 보여줘요. ‘크게 보기’는 편집 공간을 넓히고 ‘작게 보기’로 돌아와요. 배율과 크게 보기는 기획 좌표·크기를 바꾸지 않아요.'],
        ['화면 이동', '‘화면 이동’을 켜고 작업면을 끌면 보고 있는 위치가 바뀌어요. 이 모드에서는 요소를 선택·이동하지 않으니 편집할 때 다시 끄세요. 마우스 가운데 버튼이나 스크롤바로도 작업면을 이동할 수 있어요.'],
        ['미니맵', '미니맵 테두리는 현재 보고 있는 범위예요. 누르거나 끌어 원하는 위치로 이동하고, 미니맵에 초점을 둔 뒤 방향키로도 이동할 수 있어요. ‘미니맵’ 버튼으로 켜고 끌 수 있어요.']
      ]],
      ['취소 · 저장 · 기획 초안', [
        ['Escape로 취소', '영역 선택이나 크기 조절 중 Escape를 누르면 진행 중인 조작을 취소해요. 작업면에 초점이 있으면 선택을 해제해요. 도움말·요소 보기에서는 열린 창을 닫아요. 이미 저장한 모든 변경을 되돌리는 실행 취소 기능은 아니에요.'],
        ['자동 저장과 백업', '기획은 현재 브라우저에 자동 저장돼요. 다른 기기나 브라우저로 옮기거나 자료를 보관하려면 왼쪽 프로젝트 메뉴에서 백업을 내려받으세요. 모바일에서는 ‘프로젝트·목차’를 열면 찾을 수 있어요.'],
        ['AI에 전달되는 화면 정보', '‘기획 초안 보기’에서 화면별 크기, 요소의 좌표·크기·레벨·포함 관계를 확인해요. AI 전달문에는 화면 구조가 JSON으로 포함돼요. 선택·확대·미니맵·편집용 숨김 상태는 기획 구조를 바꾸지 않아요.']
      ]]
    ];
    return '<div class="designer-manual"><p class="field-help">화면 크기를 정하고 요소를 추가한 뒤, 위치와 크기를 조절하세요. 자세한 조작법은 아래 항목을 펼쳐 확인하세요.</p>' +
      sections.map(([title, rows]) => `<details><summary>${esc(title)}</summary><dl>${rows.map(([label, text]) => `<div class="help-fact"><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl></details>`).join('') + '</div>';
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
    const scope = container.ownerDocument || container;
    const world = scope.querySelector('.canvas-world');
    if (!world) return;
    const blocks = [...world.querySelectorAll('.canvas-block[data-width]')];
    const geometry = A.canvasGeometry(blocks.map(block => ({
      key: block.dataset.blockKey, parent: block.parentElement.dataset.dropParent || '',
      x: Number(block.dataset.x), y: Number(block.dataset.y),
      width: Number(block.dataset.width), height: Number(block.dataset.height)
    })), { width: Number(world.dataset.canvasWidth), height: Number(world.dataset.canvasHeight) });
    world.style.width = geometry.width + 'px';
    world.style.minHeight = geometry.height + 'px';
    for (const block of blocks) {
      const box = geometry.boxes.get(block.dataset.blockKey);
      const parent = geometry.boxes.get(block.parentElement.dataset.dropParent);
      block.style.width = box.width + 'px';
      block.style.left = (box.x - (parent ? parent.x + 5 : 0)) + 'px';
      block.style.top = block.dataset.y + 'px';
      block.style.zIndex = block.dataset.level;
      block.style.setProperty('--block-height', box.height + 'px');
      const children = block.querySelector(':scope > .canvas-children');
      if (children) children.style.minHeight = box.childrenHeight + 'px';
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
    const { screen, index, elements, panel } = selection(answers, state);
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
      return `<div class="canvas-block${inherited ? ' inherited' : ''}${!inherited && elements.includes(key) ? ' selected' : ''}" data-block-key="${esc(key)}" data-level="${levels.get(key)}" data-width="${size.width}" data-height="${size.height}" data-x="${position.x}" data-y="${position.y}">
        <div class="canvas-block-heading"><button type="button" class="canvas-block-select" data-canvas-element="${esc(key)}" data-canvas-owner="${owner.id}" ${inherited ? '' : 'draggable="true"'} aria-pressed="${!inherited && elements.includes(key)}" aria-label="${esc(elementName(owner, key))}${inherited ? ' · 공통 화면에서 수정' : ' 선택'}"><span class="canvas-block-title">${esc(elementName(owner, key))}${inherited ? '<small>공통</small>' : ''}</span></button>${A.canContain(key) ? `<button type="button" class="canvas-add-child" data-add-element data-screen="${index}" data-target="parent:${esc(key)}" aria-label="${esc(elementName(owner, key))} 안에 요소 추가" title="이 요소 안에 추가">+</button>` : ''}</div>
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
        )}<button type="button" class="screen-tab add-screen" data-add="screens">+ 새 화면</button></nav>${recommendation}<button type="button" class="button secondary small" data-designer-help aria-haspopup="dialog" aria-controls="option-help-dialog">사용법</button><button type="button" class="button secondary small" data-expand-designer aria-pressed="${Boolean(state.expanded)}" aria-controls="screen-designer">${state.expanded ? '↙ 작게 보기' : '⛶ 크게 보기'}</button></div>
      <div class="designer-workspace${state.panelCollapsed ? ' inspector-collapsed' : ''}"><section class="designer-stage" aria-label="화면 배치">
        <div class="designer-stage-heading"><div class="designer-stage-title"><h3 data-screen-title="${index}">${esc(label(screen))}</h3><p class="designer-hint">${screen.isCommon ? '여기서 만든 틀을 새 화면에 함께 사용해요.' : common && screen.useCommonLayout !== false ? '공통 요소는 옅게 표시돼요. 선택하면 공통 화면에서 수정해요.' : '이 화면만의 요소를 배치해요.'}</p></div></div>
        <div class="canvas-paper" aria-label="${esc(label(screen))} 구성 미리보기"><div class="canvas-chrome">
          <button type="button" class="button secondary small" data-add-element data-screen="${index}" data-target="region:main">+ 요소 추가</button>
          <div class="canvas-zoom-controls"><button type="button" class="button secondary small" data-zoom-step="-1" aria-label="캔버스 축소">−</button><label class="visually-hidden" for="canvas-zoom">캔버스 확대 비율</label><select id="canvas-zoom" data-canvas-zoom>${[['fit','화면 맞춤'],[.1,'10%'],[.25,'25%'],[.5,'50%'],[.75,'75%'],[1,'100%'],[1.5,'150%'],[2,'200%']].map(([value,text])=>`<option value="${value}" ${String(zoom)===String(value)?'selected':''}>${text}</option>`).join('')}</select><button type="button" class="button secondary small" data-zoom-step="1" aria-label="캔버스 확대">+</button></div>
          <button type="button" class="button secondary small" data-pan-canvas aria-pressed="${Boolean(state.panMode)}">화면 이동</button>
          <span class="canvas-size-label" data-canvas-size-label>${size.width} × ${size.height}</span>
          <div class="canvas-view-controls"><button type="button" class="button secondary small" data-toggle-minimap aria-pressed="${state.minimap !== false}" aria-controls="canvas-minimap-panel">미니맵</button><details class="level-filter"><summary aria-label="요소 보기"><span>요소 보기</span><small data-visible-level-count>전체</small></summary><fieldset class="level-menu">${levelOptions(blocks)}</fieldset></details></div>
        </div><div class="canvas-frame"><div class="canvas-viewport${state.panMode ? ' is-panning' : ''}" tabindex="0" aria-label="화면 설계 작업면" aria-describedby="canvas-navigation-help"><div class="canvas-space">${gridHtml(blocks.filter(item=>!item.parent), 'region:main')}</div></div>
        <div class="canvas-minimap" id="canvas-minimap-panel" ${state.minimap === false ? 'hidden' : ''}><svg id="canvas-minimap" tabindex="0" role="group" aria-label="미니맵 위치 이동. 누르거나 끌기, 방향키로 이동" preserveAspectRatio="xMidYMid meet"><g class="minimap-elements"></g><rect class="minimap-view"/></svg></div></div></div><p class="designer-hint" id="canvas-navigation-help">빈 곳을 드래그해 요소를 둘러싸면 함께 선택돼요. Shift+클릭으로 선택을 더하거나 빼고, 선택한 이름을 끌거나 방향키로 함께 옮겨요. 포함·분리는 ‘소속 변경’, 작업면 이동은 ‘화면 이동’ 또는 가운데 버튼을 이용하세요.</p>${reason}
      </section><div class="designer-panel${state.panelCollapsed ? ' panel-collapsed' : ''}">${state.panelCollapsed ? '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="false" aria-label="설정 패널 펼치기" title="설정 패널 펼치기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>' : ''}<aside class="designer-inspector" id="designer-inspector" ${state.panelCollapsed ? 'hidden' : ''} aria-label="요소 설정과 참고 자료">
        <div class="inspector-heading">${state.panelCollapsed ? '' : '<button type="button" class="inspector-toggle" data-toggle-inspector aria-controls="designer-inspector" aria-expanded="true" aria-label="설정 패널 접기" title="설정 패널 접기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>'}<div class="inspector-tabs" role="tablist" aria-label="화면 편집 설정">${tabs.map(([id, text]) => `<button type="button" role="tab" id="inspector-tab-${id}" data-designer-panel="${id}" aria-selected="${panel === id}" aria-controls="inspector-panel-${id}" tabindex="${panel === id ? 0 : -1}">${text}</button>`).join('')}</div></div>
        <div class="inspector-body" id="designer-inspector-body">${tabs.map(([id, text]) => `<section role="tabpanel" id="inspector-panel-${id}" aria-labelledby="inspector-tab-${id}" ${panel === id ? '' : 'hidden'}>${panel === id ? `<h4 class="visually-hidden" tabindex="-1" id="inspector-title">${text}</h4>${content}` : ''}</section>`).join('')}</div>
      </aside></div></div></div>`;
  }
  const api = { selection, elementName, manual, references, applySizes, applyVisibility, collisions, updateLevels, captureView, mountViewport, zoomTo, drawMinimap, navigateMap, focusBlock, render };
  root.BriefDesigner = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
