const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const placement = (x, y, level = 1) => ({ region: 'main', width: 20, height: 160, level, position: { x, y } });
    const project = BriefProjects.createProject({ started: true, step: 4, answers: { screens: [
      { id: 'selection-common', isCommon: true, customElements: [{ id: 'shared', name: '공통 요소' }],
        placements: { 'custom:shared': placement(70, 350) } },
      { id: 'selection-screen', name: '묶음 이동', canvas: { width: 800, height: 600 },
        customElements: ['a', 'b', 'c', 'child', 'hidden'].map(id => ({ id, name: id })),
        placements: { 'custom:a': { ...placement(10, 80), width: 20.1 }, 'custom:b': placement(40, 80), 'custom:c': placement(72, 80),
          'custom:hidden': placement(10, 350, 8),
          'custom:child': { ...placement(0, 0, 2), parent: 'custom:a', width: 40, height: 64 } } }
    ] } });
    localStorage.setItem(BriefProjects.KEY, JSON.stringify({ version: 1, activeId: project.id, projects: [project] }));
  });
  await page.reload(); await go(4);
  await page.locator('[data-designer-screen="selection-screen"]').click();
  await page.locator('[data-canvas-zoom]').selectOption('fit');
  await page.locator('[data-toggle-minimap]').click();
  const button = id => page.locator(`[data-canvas-element="custom:${id}"]`);
  const selected = () => page.locator('.canvas-block.selected').evaluateAll(nodes => nodes.map(n => n.dataset.blockKey).sort());
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem(BriefProjects.KEY)).projects[0].answers);
  const placements = async () => (await stored()).screens[1].placements;
  const point = async (x, y) => {
    await page.locator('.canvas-viewport').scrollIntoViewIfNeeded();
    return page.locator('.canvas-world').evaluate((world, p) => {
      const rect = world.getBoundingClientRect(), scale = Number(world.dataset.scale);
      return { x: rect.x + p.x * scale, y: rect.y + p.y * scale };
    }, { x, y });
  };
  const marquee = async (cancel = false, touch = false) => {
    const start = await point(24, 24), end = await point(504, 264);
    if (touch) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
      await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 8 });
      if (cancel) await page.keyboard.press('Escape');
      else await shot('marquee');
      await page.mouse.up();
    }
  };
  const initial = await stored();
  await marquee(false, width < 800);
  assert.deepEqual(await selected(), ['custom:a', 'custom:b', 'custom:child']);
  assert.deepEqual(await stored(), initial, 'Selection is temporary, not a planning edit');
  assert.equal(await page.locator('[data-element-level]').count(), 0, 'Multi selection does not edit only one member');
  assert((await page.locator('#designer-inspector-body').innerText()).includes('3개 요소 선택'));
  await shot('selection');
  await button('b').click({ modifiers: ['Shift'] });
  assert.deepEqual(await selected(), ['custom:a', 'custom:child']);
  await button('b').click({ modifiers: ['Control'] });
  assert.deepEqual(await selected(), ['custom:a', 'custom:b', 'custom:child']);
  await marquee(true, width < 800);
  assert.deepEqual(await selected(), ['custom:a', 'custom:b', 'custom:child'], 'Cancel restores selection');
  assert.equal(await page.locator('.canvas-marquee').count(), 0);
  const before = await placements();
  await page.locator('[data-grid-move="right"]').click();
  let after = await placements();
  for (const id of ['a', 'b']) assert.equal(after['custom:' + id].position.x, before['custom:' + id].position.x + 1);
  assert.deepEqual(after['custom:child'], before['custom:child'], 'Selected child is carried by selected parent once');
  await page.locator('.canvas-viewport').focus(); await page.keyboard.press('ArrowDown');
  after = await placements();
  for (const id of ['a', 'b']) assert.equal(after['custom:' + id].position.y, before['custom:' + id].position.y + 8);
  if (width > 800) {
    const drag = async (id, dx, dy) => {
      await button(id).scrollIntoViewIfNeeded();
      const box = await button(id).boundingBox(), scale = await page.locator('.canvas-world').evaluate(n => Number(n.dataset.scale));
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx * scale, y + dy * scale, { steps: 12 }); await page.mouse.up();
    };
    // Run the native group drag at half scale, keeping world-space gaps intact.
    await page.locator('[data-canvas-zoom]').selectOption('0.5');
    const preDrag = await placements(); await drag('a', 32, 24); after = await placements();
    const dx = after['custom:a'].position.x - preDrag['custom:a'].position.x;
    const dy = after['custom:a'].position.y - preDrag['custom:a'].position.y;
    assert(dx > 0 && dy > 0, 'Native drag moves the selection');
    assert.equal(after['custom:b'].position.x - preDrag['custom:b'].position.x, dx);
    assert.equal(after['custom:b'].position.y - preDrag['custom:b'].position.y, dy);
    assert.deepEqual(after['custom:child'], preDrag['custom:child']);
    const preCollision = await placements(); await drag('a', 200, 0);
    assert.deepEqual(await placements(), preCollision, 'Collision rolls back the whole group');
    await drag('b', -320, 0); after = await placements();
    assert.equal(after['custom:a'].position.x, 0, 'Clamp the group at its leftmost member');
    assert.equal(after['custom:b'].position.x - after['custom:a'].position.x, 30);
    for (const id of ['a', 'b', 'child']) for (const field of ['width', 'height', 'level', 'parent'])
      assert.equal(after['custom:' + id][field], before['custom:' + id][field]);
  }
  // Independently selected children use their own parent's width for the same pixel delta.
  await button('child').click(); await button('b').click({ modifiers: ['Shift'] });
  const crossBefore = await placements();
  const childWidth = await button('child').evaluate(n => n.closest('.canvas-block').parentElement.getBoundingClientRect().width / Number(document.querySelector('.canvas-world').dataset.scale));
  await page.locator('[data-grid-move="right"]').click(); after = await placements();
  assert(Math.abs((after['custom:child'].position.x - crossBefore['custom:child'].position.x) / 100 * childWidth - 8) < .001);
  assert.equal(after['custom:b'].position.x - crossBefore['custom:b'].position.x, 1);
  await page.locator('.level-filter > summary').click(); await page.locator('[data-view-level="2"]').uncheck();
  assert.deepEqual(await selected(), ['custom:b'], 'Hidden members are removed from selection');
  await page.locator('[data-view-level="8"]').uncheck(); await page.locator('.level-filter > summary').click();
  await page.locator('[data-canvas-zoom]').selectOption('fit');
  const start = await point(0, 0), end = await point(790, 580);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
  assert.deepEqual(await selected(), ['custom:a', 'custom:b', 'custom:c'], 'Inherited and hidden elements are excluded');
  await page.keyboard.press('Escape'); assert.deepEqual(await selected(), []);
  await button('a').click({ modifiers: ['Shift'] }); await button('b').click({ modifiers: ['Shift'] });
  await page.locator('[data-designer-screen="selection-common"]').click(); assert.deepEqual(await selected(), []);
  await page.locator('[data-designer-screen="selection-screen"]').click(); assert.deepEqual(await selected(), []);
  await page.reload(); await go(4); assert.deepEqual(await selected(), []);
  console.log(`Marquee and group movement checks passed: ${width}px`);
};
