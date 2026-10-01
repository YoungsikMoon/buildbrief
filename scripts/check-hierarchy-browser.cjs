const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    w.projects.find(p => p.id === w.activeId).answers = BriefAnswers.normalizeAnswers({ screens: [
      { id: 'parent-common', isCommon: true, canvas: { width: 1280, height: 720 }, customElements: [{ id: 'shared', name: '공통 메뉴' }],
        placements: { 'custom:shared': { region: 'main', width: 100, level: 4, position: { x: 0, y: 1000 } } } },
      { id: 'parent-screen', canvas: { width: 1280, height: 720 }, name: '편집 화면', customElements: [
        { id: 'a', name: '카드' }, { id: 'b', name: '도구' }, { id: 'c', name: '본문 내용' }
      ], placements: {
        'custom:a': { region: 'main', width: 40, height: 220, level: 1, position: { x: 0, y: 0 } },
        'custom:b': { region: 'main', width: 40, height: 120, level: 1, position: { x: 40, y: 0 } },
        'custom:c': { region: 'main', parent: 'custom:a', width: 100, height: 64, level: 2, position: { x: 0, y: 0 } }
      } },
      { id: 'other-parent-screen', canvas: { width: 1280, height: 720 }, name: '다른 편집 화면', useCommonLayout: false,
        customElements: [{ id: 'separate', name: '카드' }] }
    ] });
    localStorage.setItem(BriefProjects.KEY, JSON.stringify(w));
  });
  await page.reload(); await go(4);
  await page.locator('[data-designer-screen="parent-screen"]').click();
  const stored = () => page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    return BriefAnswers.normalizeAnswers(w.projects.find(p => p.id === w.activeId).answers);
  });
  const select = async key => { const b = page.locator(`[data-canvas-element="custom:${key}"]`); await b.focus(); await b.press('Enter'); };
  const name = page.locator('[data-designer-name]');
  const level = page.locator('[data-element-level]');
  const setLevel = async value => { await level.fill(String(value)); await level.press('Enter'); };
  await select('c');
  assert.equal(await page.locator('[data-parent-label]').innerText(), '카드');
  await page.locator('[data-edit-parent]').click();
  const parentName = page.locator('[data-parent-name]');
  const unchanged = await stored();
  await parentName.fill(' 도구 '); await parentName.press('Enter');
  assert.equal(await parentName.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(await stored(), unchanged, 'Duplicate parent names are not saved');
  await parentName.fill('카드 <img src=x onerror=alert(1)>'); await parentName.press('Enter');
  assert.equal(await page.locator('[data-parent-label]').innerText(), '카드 <img src=x onerror=alert(1)>');
  assert.equal(await page.locator('img[src="x"]').count(), 0);
  assert.equal(await page.locator('.canvas-block.selected').getAttribute('data-block-key'), 'custom:c');
  assert.equal((await stored()).screens[1].placements['custom:c'].parent, 'custom:a');
  await page.locator('[data-edit-parent]').click();
  await parentName.fill('저장하지 않을 이름'); await parentName.press('Escape');
  assert(await parentName.isHidden());
  assert(await page.locator('[data-edit-parent]').evaluate(n => n === document.activeElement));
  await name.fill('공통 메뉴');
  assert.equal(await name.getAttribute('aria-invalid'), 'true');
  await name.press('Tab');
  assert.equal((await stored()).screens[1].customElements[2].name, '본문 내용');
  await name.fill('본문 수정'); await name.press('Enter'); assert.equal(await name.getAttribute('aria-invalid'), null);
  await select('a');
  assert((await page.locator('.parent-setting').innerText()).includes('없음'));
  const before = await stored();
  await select('b'); await page.locator('[data-grid-move="left"]').click();
  assert.deepEqual(await stored(), before, 'Same-level movement cannot overlap a sibling');
  assert((await page.locator('#toast').innerText()).includes('겹칠 수 없어요'));
  await select('a');
  const handle = page.locator('[data-resize-element="custom:a"]');
  await handle.focus(); await handle.press('ArrowRight');
  assert.deepEqual(await stored(), before, 'Keyboard resize cannot overlap a sibling');
  await page.locator('[data-grid-width="100"]').click();
  assert.deepEqual(await stored(), before, 'Width presets use the same collision check');
  if (width > 800) {
    await handle.scrollIntoViewIfNeeded(); const rect = await handle.boundingBox();
    await page.mouse.move(rect.x + 10, rect.y + 10); await page.mouse.down();
    await page.mouse.move(rect.x + 45, rect.y + 10, { steps: 5 }); await page.mouse.up();
    assert.deepEqual(await stored(), before, 'Pointer resize rejects a collision and restores size');
    await select('b');
    const grid = page.locator('.canvas-world');
    await page.locator('[data-canvas-element="custom:b"]').dragTo(grid, { sourcePosition: { x: 8, y: 8 }, targetPosition: { x: 20, y: 20 } });
    assert.deepEqual(await stored(), before, 'Drag and drop cannot overlap a same-level sibling');
  }
  await select('b'); await setLevel(3); await page.locator('[data-grid-move="left"]').click();
  assert((await stored()).screens[1].placements['custom:b'].position.x < 40, 'Different levels can overlap');
  await setLevel(1);
  assert.equal((await stored()).screens[1].placements['custom:b'].level, 3, 'A colliding level change is rejected');
  assert(await page.locator('#element-level-error').isVisible());
  await page.locator('[data-add-element][data-target="parent:custom:a"]').click();
  assert.equal(await level.inputValue(), '2');
  const child = await page.locator('.canvas-block.selected').getAttribute('data-block-key');
  await page.locator('.inspector-add').click(); assert.equal(await level.inputValue(), '2');
  await select('a'); await setLevel(999);
  const max = await stored();
  await page.locator('[data-add-element][data-target="parent:custom:a"]').click();
  assert.deepEqual(await stored(), max, 'The maximum level never silently creates a same-level child');
  await page.locator('[data-add-element][data-target="parent:custom:shared"]').click();
  assert.equal(await level.inputValue(), '5');
  assert.equal(await page.locator('[data-parent-label]').innerText(), '공통 메뉴');
  await page.locator('[data-edit-parent]').click();
  await parentName.fill('도구'); await parentName.press('Enter');
  assert.equal(await parentName.getAttribute('aria-invalid'), 'true', 'Common parents check the individual screens that use them');
  await parentName.fill('공통 탐색'); await page.locator('[data-save-parent]').click();
  assert.equal((await stored()).screens[0].customElements[0].name, '공통 탐색');
  assert((await page.locator('[data-canvas-element="custom:shared"]').innerText()).includes('공통 탐색'));
  await page.locator('[data-designer-panel="screen"]').click();
  await name.fill('다른 편집 화면'); assert.equal(await name.getAttribute('aria-invalid'), 'true');
  assert.equal((await stored()).screens[1].name, '편집 화면');
  await name.fill('기본 공통 화면'); assert.equal(await name.getAttribute('aria-invalid'), 'true');
  await name.fill('편집 결과'); await name.press('Enter'); assert.equal(await name.getAttribute('aria-invalid'), null);
  const saved = await stored();
  await page.reload(); await go(4); assert.deepEqual(await stored(), saved);
  await page.locator('[data-designer-screen="parent-screen"]').click();
  await page.locator(`[data-canvas-element="${child}"]`).focus(); await page.keyboard.press('Enter');
  await page.locator('[data-edit-parent]').click();
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await shot('parent-name');
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY)), p = w.projects.find(p => p.id === w.activeId);
    const restored = BriefProjects.importBackup({ format: 'buildbrief-idea', version: 1, ...p }).projects[0];
    if (JSON.stringify(restored.answers) !== JSON.stringify(p.answers)) throw Error('Parent/name backup mismatch');
    if (!BriefReport.report(p.answers).includes('공통 탐색')) throw Error('Renamed parent missing from report');
  });
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    w.projects.find(p => p.id === w.activeId).answers = BriefAnswers.normalizeAnswers({ screens: [{
      id: 'explicit-parent', isCommon: true, canvas: { width: 1280, height: 720 },
      customElements: ['a','b','c','d'].map(id => ({ id, name: {a:'부모 요소',b:'떠 있는 요소',c:'중첩 컨테이너',d:'자식 요소'}[id] })),
      placements: {
        'custom:a': { region: 'main', width: 40, height: 300, level: 2, position: { x: 0, y: 0 } },
        'custom:b': { region: 'main', width: 15, height: 80, level: 7, position: { x: 60, y: 0 } },
        'custom:c': { region: 'main', parent: 'custom:a', width: 50, height: 120, level: 3, position: { x: 0, y: 0 } },
        'custom:d': { region: 'main', parent: 'custom:c', width: 50, height: 64, level: 4, position: { x: 0, y: 0 } }
      }
    }] });
    localStorage.setItem(BriefProjects.KEY, JSON.stringify(w));
  });
  await page.reload(); await go(4);
  await page.locator('[data-canvas-zoom]').selectOption('0.5');
  const choices = page.locator('[data-parent-choice]');
  const openParents = async () => { if (!await choices.isVisible()) await page.locator('#parent-change > summary').click(); };
  const placement = async key => (await stored()).screens[0].placements['custom:' + key];
  const size = key => page.locator(`[data-block-key="custom:${key}"]`).evaluate(block => {
    const scale = Number(document.querySelector('.canvas-world').dataset.scale);
    const rect = block.getBoundingClientRect();
    return { width: rect.width / scale, height: rect.height / scale };
  });
  const sameSize = (actual, expected) => {
    for (const dimension of ['width','height']) assert(Math.abs(actual[dimension] - expected[dimension]) < .08,
      `${dimension}: expected ${expected[dimension]}, got ${actual[dimension]}`);
  };
  if (width > 800) {
    await page.locator('[data-canvas-element="custom:b"]').dragTo(page.locator('[data-drop-parent="custom:a"]'),
      { sourcePosition: { x: 8, y: 8 }, targetPosition: { x: 150, y: 35 } });
    assert(!(await placement('b')).parent, 'Overlapping another container does not adopt it');
    assert.equal((await placement('b')).level,7);
    assert((await placement('b')).position.x < 40, 'The overlap move actually happened');
    await page.locator('[data-canvas-element="custom:c"]').dragTo(page.locator('.canvas-world'),
      { sourcePosition: { x: 8, y: 8 }, targetPosition: { x: 400, y: 250 } });
    assert.equal((await placement('c')).parent,'custom:a','Dragging out keeps the existing parent');
    assert.equal((await placement('c')).level,3);
  }
  await select('a'); await openParents();
  assert.deepEqual(await choices.locator('option').evaluateAll(options => options.map(o => o.value)),['','custom:b'],
    'The current element and all its descendants are excluded');
  await select('b'); await openParents();
  const originalSize = await size('b');
  const beforeChoice = await stored();
  await choices.selectOption('custom:a');
  assert.deepEqual(await stored(),beforeChoice,'Choosing a parent is not enough to apply it');
  await page.locator('[data-cancel-parent-change]').click();
  assert.deepEqual(await stored(),beforeChoice,'Cancel preserves placement and level');
  await page.locator('.level-filter summary').click(); await page.locator('[data-view-level="3"]').uncheck();
  await page.locator('.level-filter summary').click();
  await openParents(); await choices.selectOption('custom:a');
  assert((await choices.locator('option:checked').innerText()).includes('3레벨'));
  await page.locator('[data-apply-parent]').focus(); await page.keyboard.press('Enter');
  assert.equal((await placement('b')).parent,'custom:a'); assert.equal((await placement('b')).level,3);
  sameSize(await size('b'),originalSize);
  assert(await page.locator('[data-view-level="3"]').isChecked(),'Reparenting reveals a hidden destination level');
  assert(await page.locator('#parent-change > summary').evaluate(n => n === document.activeElement));
  await openParents(); await choices.selectOption('');
  await page.locator('[data-apply-parent]').click();
  assert(!(await placement('b')).parent); assert.equal((await placement('b')).level,1);
  sameSize(await size('b'),originalSize);
  await select('c'); await openParents(); await choices.selectOption('custom:b');
  const tooSmall = await stored(); await page.locator('[data-apply-parent]').click();
  assert.deepEqual(await stored(),tooSmall,'A smaller target cannot silently shrink the element');
  assert((await page.locator('#toast').innerText()).includes('너비'));
  const containerSize = await size('c'), descendantSize = await size('d');
  for (const zoom of ['2','0.5']) {
    await page.locator('[data-canvas-zoom]').selectOption(zoom);
    for (const parent of ['', 'custom:a']) {
      await select('c'); await openParents(); await choices.selectOption(parent);
      await page.locator('[data-apply-parent]').click();
      assert.equal((await placement('c')).parent || '',parent);
      sameSize(await size('c'),containerSize); sameSize(await size('d'),descendantSize);
    }
  }
  await select('a'); await setLevel(999);
  await select('b'); await openParents();
  assert(await choices.locator('option[value="custom:a"]').isDisabled());
  // DOM tampering still goes through the relationship validator before saving.
  await choices.evaluate(select => { const option = new Option('self','custom:b'); select.add(option); });
  await choices.selectOption('custom:b'); const invalidBefore = await stored();
  await page.locator('[data-apply-parent]').click();
  assert.deepEqual(await stored(),invalidBefore,'Self-parenting cannot be saved');
  await page.locator('[data-cancel-parent-change]').click();
  await openParents(); await choices.selectOption('custom:c');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await shot('parent-change');
  await page.locator('[data-apply-parent]').click();
  assert.equal((await placement('b')).parent,'custom:c'); assert.equal((await placement('b')).level,4);
  const final = await stored(); await page.reload(); await go(4); assert.deepEqual(await stored(),final);
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY)), p = w.projects.find(p => p.id === w.activeId);
    if (JSON.stringify(BriefProjects.importBackup({format:'buildbrief-idea',version:1,...p}).projects[0].answers) !== JSON.stringify(p.answers))
      throw Error('Reparented backup mismatch');
  });
  // Parent deletion also detaches children on screens that are not currently mounted.
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    w.projects.find(p => p.id === w.activeId).answers = BriefAnswers.normalizeAnswers({screens:[
      {id:'size-common',isCommon:true,canvas:{width:1920,height:1080},
        customElements:[{id:'parent',name:'크기 부모'},{id:'shared-child',name:'공통 자식'}],placements:{
          'custom:parent':{region:'main',width:40,height:200,level:2,position:{x:0,y:0}},
          'custom:shared-child':{region:'main',parent:'custom:parent',width:20,height:80,level:3,position:{x:0,y:0}},
          button:{region:'main',parent:'custom:parent',width:20,height:80,level:3,position:{x:0,y:100}}
        }},
      {id:'size-own',name:'넓은 화면',canvas:{width:8192,height:1080},
        customElements:[{id:'local-child',name:'작은 자식'}],placements:{
          'custom:local-child':{region:'main',parent:'custom:parent',width:1,height:64,level:4,position:{x:30,y:0}}
        }}
    ]});
    localStorage.setItem(BriefProjects.KEY,JSON.stringify(w));
  });
  await page.reload(); await go(4);
  await page.locator('[data-designer-screen="size-own"]').click();
  const ownSize = await size('local-child');
  await page.locator('[data-designer-screen="size-common"]').click();
  const sharedSize = await size('shared-child');
  await select('parent'); await page.locator('[data-designer-remove-element]').click();
  sameSize(await size('shared-child'),sharedSize);
  const hidden = (await stored()).screens[0].placements.button;
  assert(!hidden.parent); assert(Math.abs(hidden.width * 1920 / 100 - sharedSize.width) < .08);
  await page.locator('[data-designer-screen="size-own"]').click();
  sameSize(await size('local-child'),ownSize);
  const small = (await stored()).screens[1].placements['custom:local-child'];
  assert(!small.parent); assert(small.width > 0 && small.width < 1);
  const afterDelete = await stored(); await page.reload(); await go(4);
  await page.locator('[data-designer-screen="size-own"]').click();
  sameSize(await size('local-child'),ownSize); assert.deepEqual(await stored(),afterDelete);
  await page.evaluate(() => {
    const w=JSON.parse(localStorage.getItem(BriefProjects.KEY)),p=w.projects.find(p=>p.id===w.activeId);
    if(JSON.stringify(BriefProjects.importBackup({format:'buildbrief-idea',version:1,...p}).projects[0].answers)!==JSON.stringify(p.answers))
      throw Error('Small detached element backup mismatch');
  });
  console.log(`Explicit parent changes, unique names and collision checks passed: ${width}px`);
};
