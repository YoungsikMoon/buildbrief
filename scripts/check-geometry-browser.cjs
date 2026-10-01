const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const project = BriefProjects.createProject({ started: true, step: 4, answers: {
      screens: [
        { id: 'geometry-common', isCommon: true, canvas: { width: 1000, height: 600 },
          customElements: [{ id: 'parent', name: '이름이 길어도 박스 좌표와 높이는 달라지지 않는 공통 부모 요소' }],
          placements: { 'custom:parent': { region: 'main', width: 50, height: 120, level: 1, position: { x: 10, y: 20 } } } },
        { id: 'geometry-screen', name: '좌표 검증', canvas: { width: 2000, height: 600 },
          customElements: [{ id: 'child', name: '자식' }, { id: 'grandchild', name: '손자' }, { id: 'cover', name: '가리는 요소' }],
          placements: {
            'custom:child': { region: 'main', parent: 'custom:parent', width: 50, height: 800, level: 2, position: { x: 20, y: 30 } },
            'custom:grandchild': { region: 'main', parent: 'custom:child', width: 33.3333, height: 64, level: 3, position: { x: 12.345, y: 56 } },
            'custom:cover': { region: 'main', width: 50, height: 120, level: 4, position: { x: 10, y: 20 } }
          } }
      ]
    } });
    localStorage.setItem(BriefProjects.KEY, JSON.stringify({ version: 1, activeId: project.id, projects: [project] }));
  });
  await page.reload(); await go(4);
  for (const id of ['geometry-common', 'geometry-screen']) {
    await page.locator(`[data-designer-screen="${id}"]`).click();
    let exported;
    for (const zoom of ['0.5', '1', '2', 'fit']) {
      await page.locator('[data-canvas-zoom]').selectOption(zoom);
      const result = await page.evaluate(id => {
        const workspace = JSON.parse(localStorage.getItem(BriefProjects.KEY)), p = workspace.projects[0];
        const prompt = BriefReport.report(p.answers, true);
        const screen = JSON.parse(prompt.slice(prompt.lastIndexOf('\n```json\n') + 9, prompt.lastIndexOf('\n```'))).screens.find(s => s.id === id);
        const world = document.querySelector('.canvas-world'), origin = world.getBoundingClientRect(), scale = Number(world.dataset.scale);
        return { screen, actual: [...world.querySelectorAll('.canvas-block')].map(block => {
          const rect = block.getBoundingClientRect();
          return { id: block.dataset.blockKey, bbox: [(rect.left - origin.left) / scale, (rect.top - origin.top) / scale,
            (rect.right - origin.left) / scale, (rect.bottom - origin.top) / scale] };
        }), height: world.offsetHeight };
      }, id);
      for (const actual of result.actual) {
        const element = result.screen.elements.find(el => el.id === actual.id);
        element.bbox.forEach((coordinate, index) => assert(Math.abs(coordinate - actual.bbox[index]) < .08,
          `${width}px ${zoom}: ${actual.id} bbox[${index}] expected ${coordinate}, rendered ${actual.bbox[index]}`));
      }
      assert.equal(result.height, result.screen.canvas.height);
      if (exported) assert.deepEqual(result.screen, exported, 'Camera changes do not alter exports');
      exported = result.screen;
    }
  }
  const before = await page.evaluate(() => BriefReport.report(JSON.parse(localStorage.getItem(BriefProjects.KEY)).projects[0].answers, true));
  await page.locator('.level-filter > summary').click();
  await page.locator('[data-all-levels]').uncheck();
  await page.locator('.level-filter > summary').click();
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  const after = await page.evaluate(() => BriefReport.report(JSON.parse(localStorage.getItem(BriefProjects.KEY)).projects[0].answers, true));
  assert.equal(after, before, 'Hidden levels, occlusion and font scaling do not omit or reposition data');
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.locator('.level-filter > summary').click(); await page.locator('[data-all-levels]').check();
  await page.locator('.level-filter > summary').click();
  await shot('json-geometry');
  console.log(`Screen JSON matches nested rendered boxes at every zoom: ${width}px`);
};
