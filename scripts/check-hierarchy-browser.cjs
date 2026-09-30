const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    w.projects.find(p => p.id === w.activeId).answers = BriefAnswers.normalizeAnswers({ screens: [
      { id: 'parent-common', isCommon: true, customElements: [{ id: 'shared', name: '공통 메뉴' }],
        placements: { 'custom:shared': { region: 'top', width: 100, level: 4 } } },
      { id: 'parent-screen', name: '편집 화면', customElements: [
        { id: 'a', name: '카드' }, { id: 'b', name: '도구' }, { id: 'c', name: '본문 내용' }
      ], placements: {
        'custom:a': { region: 'main', width: 40, height: 220, level: 1, position: { x: 0, y: 0 } },
        'custom:b': { region: 'main', width: 40, height: 120, level: 1, position: { x: 40, y: 0 } },
        'custom:c': { region: 'main', parent: 'custom:a', width: 100, height: 64, level: 2, position: { x: 0, y: 0 } }
      } },
      { id: 'other-parent-screen', name: '다른 편집 화면', useCommonLayout: false,
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
    const grid = page.locator('.region-main > .canvas-grid');
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
  console.log(`Parent editing, unique names and collision checks passed: ${width}px`);
};
