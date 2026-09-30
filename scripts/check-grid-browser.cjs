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
  const select = (key) => page.locator(`[data-canvas-element="custom:${key}"]`).click();
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
    await block('a').getAttribute('data-row'),
    await block('b').getAttribute('data-row'),
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
  await select('b');
  await page.locator('[data-grid-move="left"]').click();
  assert.deepEqual((await stored()).screens[0].placements['custom:b'].grid, { row: 1, column: 10 });
  assert.equal(
    (await stored()).screens[0].placements['custom:a'].grid.row,
    2,
    'A collision moves the other box to the next row'
  );
  await assertSeparate();
  await page.locator('[data-grid-move="down"]').click();
  assert.equal((await stored()).screens[0].placements['custom:b'].grid.row, 2);
  await page.locator('[data-grid-move="up"]').click();
  await page.locator('[data-grid-move="right"]').click();
  assert.deepEqual((await stored()).screens[0].placements['custom:b'].grid, { row: 1, column: 11 });
  await page.locator('[data-grid-width="100"]').click();
  await assertSeparate();
  await page.locator('[data-grid-width="50"]').click();
  assert.equal(await block('b').getAttribute('data-width'), '50');
  if (width > 800) {
    const grid = page.locator('.region-main > .canvas-grid');
    const rect = await grid.boundingBox(),
      row = await grid.locator('[data-grid-row="2"]').boundingBox();
    await page
      .locator('[data-canvas-element="custom:a"]')
      .dragTo(grid, { targetPosition: { x: rect.width * 0.56, y: row.y - rect.y + 12 } });
    assert.deepEqual(
      (await stored()).screens[0].placements['custom:a'].grid,
      { row: 2, column: 11 },
      'Pointer drops persist the chosen grid cell'
    );
    assert.equal(await page.locator('.canvas-drop-preview,.drop-active').count(), 0);
    await assertSeparate();
  }
  await page.locator('[data-designer-screen="grid-own"]').click();
  await select('child');
  await page.locator('[data-grid-move="right"]').click();
  assert.deepEqual((await stored()).screens[1].placements['custom:child'].grid, {
    row: 1,
    column: 2
  });
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
  await shot('expanded-grid');
  await page.keyboard.press('Escape');
  assert.equal(await expand.getAttribute('aria-pressed'), 'false');
  assert(await expand.evaluate((n) => n === document.activeElement));
  assert(await page.locator('.topbar').isVisible());
  const saved = await stored();
  await page.reload();
  await go(4);
  assert.deepEqual(await stored(), saved, 'Grid positions survive reload');
  await assertSeparate();
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
    if (!BriefReport.report(restored.answers).includes('격자 위치'))
      throw new Error('Grid positions missing from report');
  });
  console.log(`Grid and expanded editor browser checks passed: ${width}px`);
};
