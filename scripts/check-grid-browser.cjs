const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const answers = BriefAnswers.normalizeAnswers({
      screens: [
        {
          id: 'grid-common',
          isCommon: true,
          elements: [],
          customElements: [
            { id: 'container', name: '상단 메뉴' },
            { id: 'a', name: '검색 결과' },
            { id: 'b', name: '추천 목록' }
          ],
          placements: {
            'custom:container': { region: 'top', width: 100, height: 96 },
            'custom:a': { region: 'main', width: 50, height: 96, grid: { row: 1, column: 1 } },
            'custom:b': { region: 'main', width: 50, height: 96, grid: { row: 1, column: 11 } }
          }
        },
        {
          id: 'grid-own',
          name: '검색 화면',
          elements: [],
          customElements: [{ id: 'child', name: '검색 입력' }],
          placements: {
            'custom:child': { region: 'top', parent: 'custom:container', width: 50, height: 64 }
          }
        }
      ]
    });
    const workspace = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    const project = BriefProjects.createProject({ answers, step: 4, started: true });
    workspace.projects = [project];
    workspace.activeId = project.id;
    localStorage.setItem(BriefProjects.KEY, JSON.stringify(workspace));
  });
  await page.reload();
  await go(4);
  const block = (key) => page.locator(`[data-block-key="custom:${key}"]`);
  const select = async (key) => {
    const button = page.locator(`[data-canvas-element="custom:${key}"]`);
    await button.focus();
    await button.press('Enter');
  };
  const stored = () =>
    page.evaluate(() => {
      const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
      return w.projects.find((p) => p.id === w.activeId).answers;
    });
  const before = await stored();
  const assertSeparate = async () => {
    const a = await block('a').boundingBox(),
      b = await block('b').boundingBox();
    assert(
      a.x + a.width <= b.x + 1 ||
        b.x + b.width <= a.x + 1 ||
        a.y + a.height <= b.y + 1 ||
        b.y + b.height <= a.y + 1,
      'Grid boxes must not overlap'
    );
  };
  await assertSeparate();
  assert.equal(
    await block('a').getAttribute('data-y'),
    await block('b').getAttribute('data-y'),
    'Half-width elements sit side by side'
  );
  const expand = page.locator('[data-expand-designer]');
  const oldWidth = (await page.locator('.canvas-paper').boundingBox()).width;
  await expand.focus();
  await expand.press('Enter');
  assert(await page.locator('body').evaluate((n) => n.classList.contains('designer-expanded')));
  assert.equal(await expand.getAttribute('aria-pressed'), 'true');
  const full = await page.locator('#screen-designer').boundingBox();
  assert(
    full.x === 0 &&
      full.y === 0 &&
      Math.round(full.width) === width &&
      Math.round(full.height) === 1000
  );
  assert(await page.locator('.topbar').isHidden());
  assert(await page.locator('#sidebar').isHidden());
  assert(await page.locator('.site-footer').isHidden());
  assert((await page.locator('.canvas-paper').boundingBox()).width > oldWidth);
  assert.deepEqual(await stored(), before, 'Expanding does not change answers');
  const aPosition = await block('a').evaluate((n) => ({ x: n.dataset.x, y: n.dataset.y }));
  const checkA = async () =>
    assert.deepEqual(
      await block('a').evaluate((n) => ({ x: n.dataset.x, y: n.dataset.y })),
      aPosition,
      'Moving or resizing a neighbor leaves this box in place'
    );
  await select('b');
  await page.locator('[data-grid-move="left"]').click();
  let moved = (await stored()).screens[0].placements['custom:b'];
  assert(moved.position.x < 50 && moved.position.x > 0);
  assert.equal(moved.position.y, 0);
  await checkA();
  const aBox = await block('a').boundingBox(),
    bBox = await block('b').boundingBox();
  assert(
    bBox.x < aBox.x + aBox.width && bBox.y === aBox.y,
    'Free placement permits overlap without pushing other boxes'
  );
  await page.locator('[data-grid-move="down"]').click();
  assert.equal((await stored()).screens[0].placements['custom:b'].position.y, 8);
  await page.locator('[data-grid-move="up"]').click();
  await page.locator('[data-grid-move="right"]').click();
  assert(Math.abs((await stored()).screens[0].placements['custom:b'].position.x - 50) < 0.001);
  await page.locator('[data-grid-width="100"]').click();
  await checkA();
  await page.locator('[data-grid-width="50"]').click();
  assert.equal(await block('b').getAttribute('data-width'), '50');
  await checkA();
  if (width > 800) {
    await select('a');
    const grid = page.locator('.region-main > .canvas-grid');
    const rect = await grid.boundingBox();
    const beforeB = (await stored()).screens[0].placements['custom:b'];
    await page.locator('[data-canvas-element="custom:a"]').dragTo(grid, {
      sourcePosition: { x: 8, y: 8 },
      targetPosition: { x: rect.width * 0.3 + 12, y: 84 }
    });
    const position = (await stored()).screens[0].placements['custom:a'].position;
    assert(
      position.x > 0 && position.y > 0 && position.y < 96,
      'Pointer drops save a free position between former rows'
    );
    assert.equal(position.y % 8, 0, 'Drops lightly snap to dots');
    assert.deepEqual((await stored()).screens[0].placements['custom:b'], beforeB);
    assert.equal(await page.locator('.canvas-drop-preview,.drop-active').count(), 0);
    const beforeSizeB = await block('b').boundingBox();
    await page.locator('[data-resize-element="custom:a"]').press('ArrowDown');
    assert.deepEqual(
      await block('b').boundingBox(),
      beforeSizeB,
      'Resizing does not shift neighbors'
    );
  }
  await page.locator('[data-designer-screen="grid-own"]').click();
  await select('child');
  await page.locator('[data-grid-move="right"]').click();
  const childPosition = (await stored()).screens[1].placements['custom:child'].position;
  assert(childPosition.x > 0);
  assert.equal(childPosition.y, 0);
  assert.equal((await stored()).screens[1].placements['custom:child'].parent, 'custom:container');
  assert(
    await page.locator('body').evaluate((n) => n.classList.contains('designer-expanded')),
    'Screen and selection changes keep expanded mode'
  );
  await page.locator('[data-open-reference]').click();
  await page.locator('.insert-element button').first().click();
  await page.keyboard.press('Escape');
  assert(
    await page.locator('body').evaluate((n) => n.classList.contains('designer-expanded')),
    'Closing a help dialog does not exit expanded mode'
  );
  await page.locator('[data-close-reference]').click();
  await page.locator('[data-designer-screen="grid-common"]').click();
  await page.locator('[data-toggle-inspector]').click();
  if (width > 800) {
    await page.setViewportSize({ width: 1024, height: 768 });
    const editor = await page.locator('#screen-designer').boundingBox();
    assert.equal(Math.round(editor.width), 1024);
    assert.equal(Math.round(editor.height), 768);
    assert(
      (await page.locator('.canvas-paper').boundingBox()).width > 850,
      'Small desktop monitors gain the sidebar and page margins'
    );
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await expand.click();
    await expand.click();
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));
    await page.setViewportSize({ width, height: 1000 });
  }
  await page.locator('#screen-designer').evaluate((n) => (n.scrollTop = 0));
  await shot('free-canvas');
  await page.keyboard.press('Escape');
  assert.equal(await expand.getAttribute('aria-pressed'), 'false');
  assert(await expand.evaluate((n) => n === document.activeElement));
  assert(await page.locator('.topbar').isVisible());
  const saved = await stored();
  await page.reload();
  await go(4);
  assert.deepEqual(await stored(), saved, 'Grid positions survive reload');
  assert.deepEqual(
    await block('a').evaluate((n) => ({ x: Number(n.dataset.x), y: Number(n.dataset.y) })),
    saved.screens[0].placements['custom:a'].position
  );
  assert.equal(await expand.getAttribute('aria-pressed'), 'false', 'Expanded mode is temporary');
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    const project = w.projects.find((p) => p.id === w.activeId);
    const restored = BriefProjects.importBackup({
      format: 'buildbrief-idea',
      version: 1,
      ...project
    }).projects[0];
    if (
      JSON.stringify(restored.answers) !==
      JSON.stringify(BriefAnswers.normalizeAnswers(project.answers))
    )
      throw new Error('Grid backup mismatch');
    if (!BriefReport.report(restored.answers).includes('자유 배치 위치'))
      throw new Error('Grid positions missing from report');
  });
  console.log(`Grid and expanded editor browser checks passed: ${width}px`);
};
