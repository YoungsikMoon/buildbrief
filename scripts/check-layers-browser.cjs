const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    workspace.projects.find((p) => p.id === workspace.activeId).answers =
      BriefAnswers.normalizeAnswers({
        screens: [
          {
            id: 'layers-common',
            isCommon: true, canvas: { width: 1280, height: 720 },
            customElements: [
              { id: 'back', name: '뒤쪽 요소' },
              { id: 'front', name: '앞쪽 요소' }
            ],
            placements: {
              'custom:back': { level: 1, region: 'main', width: 70, height: 120, position: { x: 0, y: 0 } },
              'custom:front': { level: 2, region: 'main', width: 70, height: 120, position: { x: 0, y: 0 } }
            }
          },
          {
            id: 'layers-own', canvas: { width: 1280, height: 720 },
            name: '중첩 화면',
            customElements: [{ id: 'child', name: '안쪽 요소' }],
            placements: {
              'custom:child': { level: 3,
                region: 'main',
                parent: 'custom:back',
                width: 60,
                height: 64,
                position: { x: 0, y: 0 }
              }
            }
          },
          {
            id: 'layers-other', canvas: { width: 1280, height: 720 },
            name: '다른 화면',
            useCommonLayout: false,
            customElements: [{ id: 'only', name: '다른 요소' }]
          }
        ]
      });
    localStorage.setItem(BriefProjects.KEY, JSON.stringify(workspace));
  });
  await page.reload();
  await go(4);
  const stored = () =>
    page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
      return BriefAnswers.normalizeAnswers(w.projects.find((p) => p.id === w.activeId).answers);
    });
  const box = (id) => page.locator('[data-block-key="custom:' + id + '"]');
  const check = (id) => page.locator('[data-view-level="' + ({back:1,front:2,child:3}[id] || id) + '"]');
  const all = page.locator('[data-all-levels]');
  const menu = page.locator('.level-filter');
  const summary = menu.locator('summary');
  const open = async () => {
    if (!(await menu.evaluate((n) => n.open))) await summary.click();
  };
  const select = async (id) => {
    const button = page.locator('[data-canvas-element="custom:' + id + '"]');
    await button.focus();
    await button.press('Enter');
  };
  const frontAtOverlap = () =>
    box('back').evaluate((n) => {
      const r = n.getBoundingClientRect();
      return document.elementFromPoint(r.x + 20, r.y + 20)?.closest('.canvas-block')?.dataset
        .blockKey;
    });
  await page.locator('[data-expand-designer]').click();
  const untouched = await stored();
  await select('back');
  assert.equal(await box('back').evaluate((n) => getComputedStyle(n).zIndex), '1');
  assert.equal(await box('front').evaluate((n) => getComputedStyle(n).zIndex), '2');
  if (width > 800)
    assert.equal(
      await frontAtOverlap(),
      'custom:front',
      'Selecting a covered box must not raise it'
    );
  assert.deepEqual(await stored(), untouched, 'Selection does not rewrite levels');
  await page.locator('[data-property="name"]').fill('바뀐 이름');
  await open();
  assert.equal(await box('back').locator('.canvas-block-title').innerText(), '바뀐 이름');
  await summary.click();
  await page.locator('[data-property="name"]').fill('뒤쪽 요소');
  await page.locator('[data-level-move="1"]').click();
  assert.equal(await box('back').getAttribute('data-level'), '1', 'An overlapping equal level is rejected');
  assert(await page.locator('#element-level-error').isVisible());
  await page.locator('[data-element-level]').fill('3');
  await page.locator('[data-element-level]').press('Enter');
  assert.equal(await box('front').getAttribute('data-level'),'2','Other levels never shift');
  if (width > 800) assert.equal(await frontAtOverlap(),'custom:back');
  await page.locator('[data-element-level]').fill('1');
  await page.locator('[data-element-level]').press('Enter');
  await page.locator('[data-level-help]').click();
  assert((await page.locator('#help-content').innerText()).includes('숫자가 높을수록 앞'));
  await page.keyboard.press('Escape');
  for (const level of [3, 1]) {
    await open(); await all.uncheck(); await page.keyboard.press('Escape');
    await page.locator('[data-element-level]').fill(String(level));
    await page.locator('[data-element-level]').press('Enter');
    assert(await box('back').isVisible(), 'Changing a hidden element level reveals it');
    assert(await check(level).isChecked());
    assert(await box('front').isHidden(), 'Unrelated levels stay hidden');
  }
  await open();
  await all.check();
  await page.keyboard.press('Escape');
  const saved = await stored();
  const geometry = () =>
    page
      .locator('.canvas-block')
      .evaluateAll((nodes) =>
        nodes.map((n) => [
          n.dataset.blockKey,
          n.offsetWidth,
          n.offsetHeight,
          n.dataset.x,
          n.dataset.y
        ])
      );
  const beforeGeometry = await geometry();
  await open();
  assert.deepEqual(await menu.locator('strong').allTextContents(), ['2레벨', '1레벨']);
  assert(await all.isChecked());
  await all.uncheck();
  assert(await box('back').isHidden());
  assert(await box('front').isHidden());
  await check('back').check();
  assert(await box('back').isVisible());
  assert(await box('front').isHidden());
  assert(await all.evaluate((n) => n.indeterminate));
  assert.deepEqual(
    await geometry(),
    beforeGeometry,
    'Filtering preserves the canvas size and all positions'
  );
  assert.deepEqual(await stored(), saved, 'Visibility is temporary and never changes answers');
  await shot('level-filter');
  await page.keyboard.press('Escape');
  assert(await summary.evaluate((n) => n === document.activeElement));
  assert(
    await page.locator('body').evaluate((n) => n.classList.contains('designer-expanded')),
    'Escape closes the dropdown before expanded mode'
  );
  await page.locator('[data-designer-screen="layers-other"]').click();
  await open();
  assert.deepEqual(await menu.locator('strong').allTextContents(), ['1레벨']);
  assert(await all.isChecked());
  await all.uncheck();
  await page.locator('[data-designer-screen="layers-common"]').click();
  assert(await box('back').isVisible());
  assert(await box('front').isHidden());
  await page.locator('[data-designer-screen="layers-own"]').click();
  await open();
  assert.deepEqual(await menu.locator('strong').allTextContents(), ['3레벨', '2레벨', '1레벨']);
  assert(await all.isChecked(), 'The common screen filter does not leak into an individual screen');
  await all.uncheck();
  await check('child').check();
  assert.equal(await box('back').evaluate((n) => getComputedStyle(n).visibility), 'hidden');
  assert(
    await page.locator('[data-canvas-element="custom:child"]').isVisible(),
    'A child can be viewed while its parent layer is hidden'
  );
  assert(await page.locator('[data-canvas-element="custom:back"]').isHidden());
  await page.keyboard.press('Escape');
  await select('child');
  assert.equal(await page.locator('[data-property="name"]').inputValue(), '안쪽 요소');
  await page.locator('[data-designer-screen="layers-other"]').click();
  assert(await box('only').isHidden(), 'Each screen retains its own view selection');
  await open();
  await all.check();
  assert(await box('only').isVisible());
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  const bounds = await menu.locator('.level-menu').boundingBox();
  assert(
    bounds.x >= 0 && bounds.x + bounds.width <= width + 1,
    'The dropdown fits the viewport at enlarged text sizes'
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  assert.deepEqual(await stored(), saved);
  await page.reload();
  await go(4);
  await open();
  assert(await all.isChecked(), 'Reload starts with all levels visible');
  assert.deepEqual(await stored(), saved, 'Level order survives reload');
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY)),
      p = w.projects.find((p) => p.id === w.activeId);
    const restored = BriefProjects.importBackup({ format: 'buildbrief-idea', version: 1, ...p })
      .projects[0];
    if (JSON.stringify(restored.answers) !== JSON.stringify(p.answers))
      throw Error('Layer order backup mismatch');
    if (!BriefReport.report(p.answers).includes('겹침 레벨'))
      throw Error('Missing levels in report');
  });
  // New elements copy the parent's current level once; edits never renumber neighbors.
  await page.locator('[data-expand-designer]').click();
  await page.locator('[data-designer-screen="layers-common"]').click();
  await select('back');
  const input = page.locator('[data-element-level]');
  const setLevel = async value => { await input.fill(String(value)); await input.press('Enter'); };
  await setLevel(7);
  assert.equal(await box('front').getAttribute('data-level'), '2');
  const geometryBefore = await geometry();
  await setLevel(8);
  assert.deepEqual(await geometry(), geometryBefore, 'Changing levels preserves all geometry');
  await setLevel(7);
  await page.locator('[data-add-element][data-target="parent:custom:back"]').click();
  const childKey = await page.locator('.canvas-block.selected').getAttribute('data-block-key');
  assert.equal(await input.inputValue(), '8', 'New children start one level above their parent');
  await page.locator('.inspector-add').click();
  const siblingKey = await page.locator('.canvas-block.selected').getAttribute('data-block-key');
  assert.equal(await input.inputValue(), '8', 'Inspector siblings use the shared parent level plus one');
  await select('back'); await setLevel(9);
  const childBox = page.locator(`[data-block-key="${childKey}"]`);
  const siblingBox = page.locator(`[data-block-key="${siblingKey}"]`);
  assert.equal(await childBox.getAttribute('data-level'), '8', 'Parent changes do not silently rewrite children');
  await page.locator('[data-add-element][data-target="region:main"]').click();
  assert.equal(await input.inputValue(), '1', 'A region addition always starts at level one');
  await page.locator('[data-add-element][data-target="region:main"]').click();
  assert.equal(await input.inputValue(), '1', 'Repeated additions never auto-increment levels');
  await open();
  assert.equal(await check(1).count(), 1, 'A shared level has only one menu row');
  await check(8).uncheck();
  assert(await childBox.isHidden()); assert(await siblingBox.isHidden());
  await page.keyboard.press('Escape');
  await setLevel(8);
  assert(await childBox.isVisible()); assert(await siblingBox.isVisible());
  assert(await check(8).isChecked(), 'Direct entry also reveals the destination level');
  const beforeInvalid = await stored();
  for (const invalid of ['', '0', '-1', '1.5', '1000']) {
    await input.fill(invalid); await input.press('Enter');
    assert.equal(await input.getAttribute('aria-invalid'), 'true');
    assert(await page.locator('#element-level-error').isVisible());
    assert.deepEqual(await stored(), beforeInvalid, 'Invalid levels never enter saved data');
  }
  await input.press('Escape');
  assert.equal(await input.inputValue(), '8');
  assert(await page.locator('body').evaluate(n=>n.classList.contains('designer-expanded')), 'Escape cancels input before leaving expanded mode');
  await input.fill('12');
  await page.locator('[data-level-move="1"]').click();
  assert.equal(await input.inputValue(), '13', 'Blur commits the value without swallowing the following button click');
  await setLevel(999); assert(await page.locator('[data-level-move="1"]').isDisabled());
  await setLevel(1); assert(await page.locator('[data-level-move="-1"]').isDisabled());
  await setLevel(7);
  await input.focus(); await input.press('ArrowUp'); await input.press('Tab');
  assert.equal(await input.inputValue(), '8', 'Native keyboard stepping works');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert(await page.locator('.level-controls').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await shot('editable-level');
  await page.locator('[data-designer-screen="layers-own"]').click();
  await page.locator('[data-add-element][data-target="parent:custom:back"]').click();
  assert.equal(await input.inputValue(), '10', 'Children in individual screens start one level above the inherited parent');
  await page.locator('[data-designer-screen="layers-common"]').click();
  await select('back');
  await page.locator('[data-designer-remove-element]').click();
  assert.equal(await childBox.getAttribute('data-level'), '8', 'Deleting a parent preserves child levels');
  assert.equal(await siblingBox.getAttribute('data-level'), '8');
  assert.equal(await box('front').getAttribute('data-level'), '2', 'Deletion never renumbers other elements');
  const edited = await stored();
  await page.reload(); await go(4);
  assert.deepEqual(await stored(), edited, 'Explicit levels survive reload');
  await page.evaluate(() => {
    const w=JSON.parse(localStorage.getItem(BriefProjects.KEY)),p=w.projects.find(p=>p.id===w.activeId);
    const restored=BriefProjects.importBackup({format:'buildbrief-idea',version:1,...p}).projects[0];
    if(JSON.stringify(restored.answers)!==JSON.stringify(p.answers))throw Error('Explicit level backup mismatch');
    if(!BriefReport.report(p.answers).includes('겹침 레벨'))throw Error('Explicit level report missing');
  });
  console.log(`Explicit levels, creation defaults, direct input and per-screen visibility passed: ${width}px`);
};
