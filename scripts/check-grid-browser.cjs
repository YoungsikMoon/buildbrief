const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await page.evaluate(() => {
    const answers = BriefAnswers.normalizeAnswers({
      screens: [
        {
          id: 'grid-common',
          isCommon: true, canvas: { width: 1280, height: 720 },
          elements: [],
          customElements: [
            { id: 'container', name: '상단 메뉴' },
            { id: 'a', name: '검색 결과' },
            { id: 'b', name: '추천 목록' }
          ],
          placements: {
            'custom:container': { region: 'main', width: 100, height: 96, position: { x: 0, y: 320 } },
            'custom:a': { region: 'main', width: 50, height: 96, grid: { row: 1, column: 1 } },
            'custom:b': { level: 2, region: 'main', width: 50, height: 96, grid: { row: 1, column: 11 } }
          }
        },
        {
          id: 'grid-own', canvas: { width: 1280, height: 720 },
          name: '검색 화면',
          elements: [],
          customElements: [{ id: 'child', name: '검색 입력' }],
          placements: {
            'custom:child': { region: 'main', parent: 'custom:container', width: 50, height: 64 }
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
      return BriefAnswers.normalizeAnswers(w.projects.find((p) => p.id === w.activeId).answers);
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
    await page.locator('.level-filter summary').click();
    await page.locator('[data-view-level="2"]').uncheck();
    await page.keyboard.press('Escape');
    const grid = page.locator('.canvas-world');
    const rect = await grid.boundingBox();
    const beforeB = (await stored()).screens[0].placements['custom:b'];
    const beforeLevel = await block('a').getAttribute('data-level');
    await page.locator('[data-canvas-element="custom:a"]').dragTo(grid, {
      sourcePosition: { x: 8, y: 8 },
      targetPosition: { x: rect.width * 0.3 + 12, y: 84 }
    });
    const position = (await stored()).screens[0].placements['custom:a'].position;
    assert.equal(
      await block('a').getAttribute('data-level'),
      beforeLevel,
      'Moving a box does not change its level'
    );
    assert(
      position.x > 0 && position.y > 0 && position.y < 96,
      'Pointer drops save a free position between former rows'
    );
    assert.equal(position.y % 8, 0, 'Drops lightly snap to dots');
    assert.deepEqual((await stored()).screens[0].placements['custom:b'], beforeB);
    assert.equal(await page.locator('.canvas-drop-preview,.drop-active').count(), 0);
    await page.locator('.level-filter summary').click();
    await page.locator('[data-view-level="2"]').check();
    await page.keyboard.press('Escape');
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
  await page.locator('[data-designer-panel="reference"]').click();
  await page.locator('.insert-element button').first().click();
  await page.keyboard.press('Escape');
  assert(
    await page.locator('body').evaluate((n) => n.classList.contains('designer-expanded')),
    'Closing a help dialog does not exit expanded mode'
  );
  await page.locator('[data-designer-panel="element"]').click();
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
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    workspace.projects.find((p) => p.id === workspace.activeId).answers = {};
    localStorage.setItem(BriefProjects.KEY, JSON.stringify(workspace));
  });
  await page.reload();
  await go(4);
  const tab = (id) => page.locator('[data-designer-panel="' + id + '"]');
  assert.deepEqual(await page.locator('.inspector-tabs [role="tab"]').allTextContents(), [
    '화면',
    '요소',
    '참고'
  ]);
  assert.equal(
    await page
      .locator('[data-designer-settings],[data-open-reference],[data-close-reference]')
      .count(),
    0
  );
  await tab('element').click();
  assert(
    (await page.locator('#designer-inspector-body').innerText()).includes('배치한 요소를 선택')
  );
  await page.locator('[data-add="screens"]').click();
  assert.equal(await tab('screen').getAttribute('aria-selected'), 'true');
  assert.equal((await stored()).screens[1].name, '새 화면 1');
  await page.locator('[data-add="screens"]').click();
  assert.equal((await stored()).screens[2].name, '새 화면 2');
  const owner = (await stored()).screens[2].id;
  await page.locator('[data-add-element][data-target="region:main"]').click();
  assert.equal(await tab('element').getAttribute('aria-selected'), 'true');
  const first = (await stored()).screens[2].customElements[0];
  assert.equal(first.name, '요소1');
  await page.locator('.inspector-add').click();
  const second = (await stored()).screens[2].customElements[1];
  assert.equal(second.name, '요소2');
  await page.locator('[data-property="purpose"]').fill('탭을 바꿔도 남아 있는 설명');
  const original = await stored();
  await tab('screen').click();
  assert(await page.getByLabel('화면 이름', { exact: true }).isVisible());
  assert.equal(await page.locator('.natural-element-settings').count(), 0);
  await tab('screen').press('ArrowRight');
  assert.equal(await tab('element').getAttribute('aria-selected'), 'true');
  assert(await tab('element').evaluate((n) => n === document.activeElement));
  assert.equal(await page.locator('[data-property="name"]').inputValue(), '요소2');
  assert.equal(
    await page.locator('[data-property="purpose"]').inputValue(),
    '탭을 바꿔도 남아 있는 설명'
  );
  await tab('element').press('End');
  assert(await page.getByLabel('참고할 분류', { exact: true }).isVisible());
  await tab('reference').press('Home');
  assert.equal(await tab('screen').getAttribute('aria-selected'), 'true');
  assert.deepEqual(await stored(), original, 'Tab switching does not change saved work');
  await page.locator('[data-canvas-element="custom:' + first.id + '"]').click();
  assert.equal(await tab('element').getAttribute('aria-selected'), 'true');
  await page.locator('[data-designer-remove-element]').click();
  await page.locator('.inspector-add').click();
  assert.equal((await stored()).screens[2].customElements.at(-1).name, '요소3');
  await tab('screen').click();
  await page.getByLabel('화면 이름', { exact: true }).fill('');
  assert.equal(
    await page.locator('[data-designer-screen="' + owner + '"]').innerText(),
    '새 화면 2'
  );
  assert.equal(await page.locator('.designer-stage-title h3').innerText(), '새 화면 2');
  await page.reload();
  await go(4);
  await page.locator('[data-designer-screen="' + owner + '"]').click();
  assert.deepEqual(
    (await stored()).screens[2].customElements.map((el) => el.name),
    ['요소2', '요소3']
  );
  assert.equal(await page.locator('#designer-inspector [role="tabpanel"]:visible').count(), 1);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  await shot('inspector-tabs');
  // A fixed world stays the same size across monitors; camera controls never rewrite placement.
  await page.evaluate(() => {
    const w=JSON.parse(localStorage.getItem(BriefProjects.KEY));
    w.projects.find(p=>p.id===w.activeId).answers=BriefAnswers.normalizeAnswers({screens:[{
      id:'camera',isCommon:true,canvas:{width:1920,height:1080},
      customElements:[{id:'near',name:'검색 상자'},{id:'far',name:'하단 메뉴'}],
      placements:{
        'custom:near':{region:'main',level:1,width:12.5,height:120,position:{x:0,y:16}},
        'custom:far':{region:'main',level:2,width:12.5,height:120,position:{x:75,y:800}}
      }
    }]});
    localStorage.setItem(BriefProjects.KEY,JSON.stringify(w));
  });
  await page.reload(); await go(4);
  const cameraBefore=await stored();
  const world=page.locator('.canvas-world'), viewport=page.locator('.canvas-viewport');
  const zoom=page.locator('[data-canvas-zoom]'), map=page.locator('#canvas-minimap');
  const near=page.locator('[data-block-key="custom:near"]');
  const camera=()=>viewport.evaluate(n=>({x:n.scrollLeft,y:n.scrollTop,width:n.clientWidth,height:n.clientHeight}));
  assert.equal(await page.locator('.canvas-region').count(),0);
  assert.equal(await world.evaluate(n=>n.offsetWidth),1920);
  assert.equal(await map.locator('.minimap-elements rect').count(),2);
  assert(await page.locator('[data-toggle-minimap]').evaluate(n=>n.nextElementSibling.matches('.level-filter')));
  for(const scale of [.5,2,1]) {
    await zoom.selectOption(String(scale));
    assert(Math.abs((await near.boundingBox()).width-240*scale)<1);
    assert.equal(await world.evaluate(n=>n.offsetWidth),1920);
  }
  await page.setViewportSize({width:width===1440?1024:width+20,height:768});
  assert.equal(await world.evaluate(n=>n.offsetWidth),1920);
  await page.setViewportSize({width,height:1000});
  await zoom.selectOption('fit');
  assert(await viewport.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1),'Fit shows the entire world');
  await zoom.selectOption('1');
  await map.scrollIntoViewIfNeeded();
  const mr=await map.boundingBox();
  await map.click({position:{x:mr.width*.85,y:mr.height*.7}});
  let location=await camera();assert(location.x>0&&location.y>0);
  assert(Math.abs(Number(await map.locator('.minimap-view').getAttribute('x'))-location.x)<1);
  await map.focus();await map.press('Home');assert.equal((await camera()).x,0);
  await map.press('ArrowRight');assert((await camera()).x>0);
  await map.press('End');assert((await camera()).y>0);
  await page.locator('[data-toggle-minimap]').click();assert(await map.isHidden());
  await page.locator('[data-designer-panel="element"]').click();assert(await map.isHidden());
  await page.locator('[data-toggle-minimap]').click();assert(await map.isVisible());
  await map.focus();await map.press('Home');
  await page.locator('[data-pan-canvas]').click();
  await viewport.scrollIntoViewIfNeeded();
  const vr=await viewport.boundingBox();
  await page.mouse.move(vr.x+150,vr.y+130);await page.mouse.down();
  await page.mouse.move(vr.x+86,vr.y+66,{steps:4});await page.mouse.up();
  location=await camera();assert.equal(location.x,64);assert.equal(location.y,64);
  if(width<800) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:vr.x+140,y:vr.y+120}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:vr.x+100,y:vr.y+80}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();assert.equal((await camera()).x,104);assert.equal((await camera()).y,104);
  }
  await page.locator('[data-pan-canvas]').click();
  await page.locator('.level-filter summary').click();
  await page.locator('[data-view-level="2"]').uncheck();
  assert.equal(await map.locator('.minimap-elements rect').count(),1);
  await page.locator('[data-view-level="2"]').check();await page.keyboard.press('Escape');
  assert.deepEqual(await stored(),cameraBefore,'Zoom, pan, fit, minimap and window resize are view-only');
  // Both half and double zoom must convert pointer movement back into world pixels.
  for(const scale of [.5,2]) {
    await zoom.selectOption(String(scale));
    const handle=page.locator('[data-resize-element="custom:near"]');
    await handle.scrollIntoViewIfNeeded();const hr=await handle.boundingBox();
    const beforeSize=(await stored()).screens[0].placements['custom:near'];
    await page.mouse.move(hr.x+hr.width/2,hr.y+hr.height/2);await page.mouse.down();
    await page.mouse.move(hr.x+hr.width/2+16,hr.y+hr.height/2+16,{steps:4});await page.mouse.up();
    const size=(await stored()).screens[0].placements['custom:near'];
    assert.equal(size.height,beforeSize.height+16/scale);
    assert(Math.abs((size.width-beforeSize.width)*19.2-16/scale)<.01);
  }
  if(width>800) {
    await zoom.selectOption('0.5');await map.focus();await map.press('Home');
    const source=page.locator('[data-canvas-element="custom:near"]');
    await source.scrollIntoViewIfNeeded();const r=await source.boundingBox();
    const beforeDrop=(await stored()).screens[0].placements['custom:near'].position;
    await page.mouse.move(r.x+8,r.y+8);await page.mouse.down();
    await page.mouse.move(r.x+16,r.y+16,{steps:3});
    await page.mouse.move(r.x+40,r.y+168,{steps:8});await page.mouse.move(r.x+40,r.y+168);await page.mouse.up();
    const afterDrop=(await stored()).screens[0].placements['custom:near'].position;
    assert(Math.abs((afterDrop.x-beforeDrop.x)*19.2-64)<.02);
    assert.equal(afterDrop.y-beforeDrop.y,320,'Half zoom drops save world pixels, not screen pixels');
  }
  await zoom.selectOption('1');
  await map.focus();await map.press('End');
  const addLocation=await camera();
  await page.locator('[data-add-element][data-target="region:main"]').click();
  const added=(await stored()).screens[0].customElements.at(-1);
  const placement=(await stored()).screens[0].placements['custom:'+added.id];
  assert(placement.position.y>=addLocation.y,'New elements are added near the current view');
  assert.equal(await page.evaluate(()=>BriefDesigner.collisions().size),0);
  await page.locator('[data-designer-panel="screen"]').click();
  await page.locator('[data-canvas-preset]').selectOption('monitor');
  assert.deepEqual((await stored()).screens[0].canvas,await page.evaluate(()=>({width:Math.max(320,Math.min(8192,screen.width)),height:Math.max(240,Math.min(100000,screen.height))})));
  await page.locator('[data-canvas-preset]').selectOption('3840x2160');
  assert.equal(await world.evaluate(n=>n.offsetWidth),3840);
  const dimensions=await stored();
  await page.locator('#canvas-width').fill('319');await page.locator('#canvas-width').press('Enter');
  assert.equal(await page.locator('#canvas-width').getAttribute('aria-invalid'),'true');assert.deepEqual(await stored(),dimensions);
  await page.locator('#canvas-width').fill('2560');await page.locator('#canvas-width').press('Enter');
  assert.equal(await world.evaluate(n=>n.offsetWidth),2560);
  await page.locator('#canvas-height').fill('240');await page.locator('#canvas-height').press('Enter');
  assert(await world.evaluate(n=>n.offsetHeight>=936),'A short canvas still includes its elements');
  await page.locator('#canvas-height').fill('2160');await page.locator('#canvas-height').press('Enter');
  await page.locator('[data-add="screens"]').click();assert.equal((await stored()).screens[1].canvas.width,2560);
  await page.locator('[data-designer-screen="camera"]').click();
  await zoom.selectOption('fit');await shot('monitor-canvas');
  const final=await stored();await page.reload();await go(4);assert.deepEqual(await stored(),final);
  await page.evaluate(()=>{
    const w=JSON.parse(localStorage.getItem(BriefProjects.KEY)),p=w.projects.find(p=>p.id===w.activeId);
    if(JSON.stringify(BriefProjects.importBackup({format:'buildbrief-idea',version:1,...p}).projects[0].answers)!==JSON.stringify(BriefAnswers.normalizeAnswers(p.answers)))throw Error('Canvas backup mismatch');
    if(!BriefReport.report(p.answers).includes('2560 × 2160px'))throw Error('Canvas dimensions missing from report');
  });
  console.log(`Canvas, minimap, zoom, pan, dimensions and expanded editor passed: ${width}px`);
};
