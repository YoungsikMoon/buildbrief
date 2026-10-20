// Runs in the isolated CSP/Chrome harness: check-planning-browser.cjs --interview-only.
const assert = require('node:assert/strict');
const fs = require('node:fs');

module.exports = async ({ page, go, width, shot }) => {
  const panel = page.locator('#field-deep_interview');
  const stored = () => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    return workspace.projects.find(project => project.id === workspace.activeId);
  });
  const side = async selector => {
    const target = page.locator(selector);
    if (!await target.isVisible()) await page.locator('#toggle-navigation').click();
    return target;
  };
  const action = name => panel.locator(`[data-interview-action="${name}"]`);
  const open = async () => {
    await go(4);
    if (!await panel.evaluate(node => node.open)) {
      const summary = panel.locator(':scope > summary');
      await summary.focus(); await summary.press('Enter');
    }
    assert(await panel.locator('.interview-body').isVisible());
  };
  const newProject = async name => {
    await (await side('#add-project')).click();
    await page.locator('#project-name').fill(name);
    await page.locator('#project-name-form button[type="submit"]').click();
    await open();
  };
  const assertQuestion = async id => assert.equal(await panel.locator('[data-interview-question]').getAttribute('data-interview-question'), id);
  const focusOnHeading = async () => assert(['interview-question-title', 'interview-preview-title'].includes(await page.evaluate(() => document.activeElement.id)), 'Question changes keep a keyboard-readable focus target');
  const respond = async (id, answer, { recommend = false, defer = false } = {}) => {
    await assertQuestion(id);
    const before = await stored();
    if (defer) await action('defer').click();
    else {
      if (recommend) {
        await action('recommend').click();
        assert.deepEqual(await stored(), before, 'A recommendation is only a draft until saved');
      } else {
        const input = panel.locator('[data-interview-field="answer"]');
        if (await input.first().getAttribute('type') === 'radio') {
          const choice = panel.locator(`[data-interview-field="answer"][value="${answer}"]`);
          await choice.focus(); await choice.press('Space');
        } else await input.fill(answer);
      }
      await action('next').click();
    }
    await focusOnHeading();
  };
  const edit = async id => {
    const history = panel.locator('.interview-history');
    if (!await history.evaluate(node => node.open)) await history.locator(':scope > summary').click();
    await panel.locator(`[data-interview-action="edit"][data-interview-id="${id}"]`).click();
    await assertQuestion(id);
  };
  const responsive = async label => {
    for (const size of ['', '200%']) {
      await page.evaluate(value => { document.documentElement.style.fontSize = value; }, size);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px interview has no page overflow at ${size || '100%'}`);
      assert(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1), `${width}px interview has no panel overflow at ${size || '100%'}`);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await panel.scrollIntoViewIfNeeded(); await shot(label);
  };
  const failStorage = () => page.evaluate(() => {
    window.interviewOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === BriefProjects.KEY) throw new DOMException('Test quota exceeded', 'QuotaExceededError');
      return window.interviewOriginalSetItem.call(this, key, value);
    };
  });
  const restoreStorage = () => page.evaluate(() => {
    Storage.prototype.setItem = window.interviewOriginalSetItem;
    delete window.interviewOriginalSetItem;
  });

  await newProject(`심층 질문 검사 ${width}`);
  await assertQuestion('task');
  const emptyProject = await stored();
  await action('next').click();
  assert(await panel.locator('#interview-error').isVisible());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'interview-error');
  assert.deepEqual(await stored(), emptyProject, 'Empty answers do not advance or save');
  const task = '토요일 오후에 사용할 작업실 한 곳을 예약해요.';
  const unsafe = '전화 없이 예약하려고 해요. </textarea><img id="interview-attack" src=x onerror="window.interviewAttack=1"><script>window.interviewAttack=1</script>';
  await panel.locator('[data-interview-field="answer"]').fill(task);
  await panel.locator('[data-interview-field="reason"]').fill(unsafe);
  await failStorage();
  try {
    await action('next').click();
    assert.deepEqual(await stored(), emptyProject, 'A failed save preserves the last stored answers');
    await assertQuestion('task');
    assert.equal(await panel.locator('[data-interview-field="answer"]').inputValue(), task);
    assert.equal(await panel.locator('[data-interview-field="reason"]').inputValue(), unsafe);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'interview-error');
  } finally { await restoreStorage(); }
  await action('next').click(); await focusOnHeading();
  await respond('workflow', 'request');
  const beforePreview = await stored();
  await action('preview').click(); await focusOnHeading();
  assert.deepEqual(await stored(), beforePreview, 'Preview never creates features or screens');
  assert(await panel.locator('#interview-preview-title').isVisible());
  await action('continue').click();
  await respond('success', null, { recommend: true });
  await respond('information', '예약 날짜, 시작 시간\n작업실 이름');
  await respond('visibility', 'team');
  await respond('confirmation', 'approval');
  await respond('capacity', null, { defer: true });
  await respond('cancellation', 'operator');
  await respond('team_scope', null, { recommend: true });
  await respond('access_resolution', 'login');
  await responsive('interview-question');
  await respond('recovery', null, { recommend: true });
  await respond('scope', 'core');
  assert(await panel.locator('#interview-preview-title').isVisible());
  const previewText = await panel.locator('.interview-preview').innerText();
  for (const text of ['추가할 기능', '추가할 화면', '연결 기능', '담당자', '미정']) assert(previewText.includes(text), text);
  assert.equal(await page.locator('#interview-attack').count(), 0);
  assert.equal(await page.evaluate(() => window.interviewAttack), undefined);
  const unapplied = await stored();
  assert.equal((unapplied.answers.features || []).length, 0);
  assert(!(unapplied.answers.screens || []).some(screen => screen.id.startsWith('interview-')));
  assert.equal(unapplied.answers.deep_interview.find(row => row.id === 'capacity').answer, 'undecided');
  assert.notEqual(unapplied.answers.login_need, '로그인 필요', 'Login remains a proposed setting before apply');
  await responsive('interview-preview');
  await failStorage();
  try {
    await action('apply').click();
    assert.deepEqual(await stored(), unapplied, 'Failed apply preserves both answers and canvas');
    assert((await panel.locator('#interview-error').innerText()).includes('적용하지 않았어요'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'interview-error');
  } finally { await restoreStorage(); }
  await action('apply').click();
  assert(await page.locator('.designer-stage-heading h3').evaluate(node => node === document.activeElement));
  const applied = await stored(), features = applied.answers.features, screens = applied.answers.screens;
  assert(features.some(feature => feature.id === 'interview-review'));
  assert(!features.some(feature => feature.id === 'interview-capacity'), 'An undecided capacity rule is not confirmed');
  assert.equal(features.find(feature => feature.id === 'interview-main').name, task);
  assert.equal(features.find(feature => feature.id === 'interview-history').priority, '나중에');
  assert.equal(applied.answers.login_need, '로그인 필요');
  assert(screens.some(screen => screen.id === 'interview-screen-review'));
  const formItems = screens.find(screen => screen.id === 'interview-screen-primary').elementContents.form.items;
  assert.deepEqual(formItems.map(item => item.name), ['예약 날짜', '시작 시간', '작업실 이름']);
  for (const item of formItems) { assert.equal(item.required, ''); assert.equal(item.type, ''); }
  const featureIds = new Set(features.map(feature => feature.id)), screenIds = new Set(screens.map(screen => screen.id));
  for (const screen of screens.filter(row => row.id.startsWith('interview-screen-'))) {
    assert(screen.featureIds.length > 0);
    for (const id of screen.featureIds) assert(featureIds.has(id), 'Generated screens link to real features');
    for (const content of Object.values(screen.elementContents)) {
      for (const id of content.featureIds || []) assert(featureIds.has(id));
      for (const flow of content.flow || []) {
        if (flow.featureId) assert(featureIds.has(flow.featureId));
        if (flow.nextScreenId && !flow.nextScreenId.startsWith('@')) assert(screenIds.has(flow.nextScreenId));
      }
    }
  }
  const primaryId = 'interview-screen-primary', row = screens.findIndex(screen => screen.id === primaryId);
  await page.locator(`[data-designer-screen="${primaryId}"]`).click();
  await page.locator(`[data-q="screens"][data-row="${row}"][data-field="name"]`).fill('직접 다듬은 예약 화면');
  await page.locator(`[data-q="screens"][data-row="${row}"][data-field="purpose"]`).fill('내가 직접 보완한 목적');
  const manual = await stored();
  if (!await panel.evaluate(node => node.open)) await panel.locator(':scope > summary').click();
  assert(await action('apply').isDisabled(), 'Already applied plans cannot create duplicates');
  assert.deepEqual((await stored()).answers, manual.answers, 'Reviewing an applied plan preserves manual edits');
  await edit('workflow'); await respond('workflow', 'create');
  await assertQuestion('publication');
  const branch = await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem(BriefProjects.KEY));
    return BriefInterview.questions(w.projects.find(p => p.id === w.activeId).answers).map(q => q.id);
  });
  assert(branch.includes('publication'));
  for (const id of ['confirmation', 'capacity', 'cancellation']) assert(!branch.includes(id), `Old branch ${id} is inactive`);
  assert((await stored()).answers.deep_interview.some(answer => answer.id === 'confirmation'), 'Hidden branch answers are retained for later review');
  await edit('workflow'); await respond('workflow', 'request');
  assert(await panel.locator('#interview-preview-title').isVisible());
  assert((await panel.locator('.interview-preview').innerText()).includes('기존 내용'));
  await responsive('interview-existing');

  const final = await stored();
  await page.reload(); await open();
  assert.deepEqual((await stored()).answers, final.answers, 'Refresh preserves interview and generated structures');
  const downloading = page.waitForEvent('download');
  await (await side('#export-answers')).click();
  const backupText = fs.readFileSync(await (await downloading).path(), 'utf8');
  const backup = JSON.parse(backupText);
  assert.deepEqual(backup.answers, final.answers);
  await newProject(`분리된 프로젝트 ${width}`);
  await assertQuestion('task');
  assert.equal(await panel.locator('[data-interview-field="answer"]').inputValue(), '');
  assert.equal(((await stored()).answers.deep_interview || []).length, 0);
  await (await side('#project-select')).selectOption(final.id); await open();
  assert.deepEqual((await stored()).answers, final.answers, 'Project switching keeps interview answers separate');
  await page.locator('#import-file').setInputFiles({ name: 'interview-backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) });
  await page.waitForFunction(id => JSON.parse(localStorage.getItem(BriefProjects.KEY)).activeId !== id, final.id);
  await open();
  assert.deepEqual((await stored()).answers, backup.answers, 'Backup import retains answers, links, manual edits and undecided choices');
  assert.equal(await page.locator('#interview-attack').count(), 0);
  await go(5); await page.locator('#next-button').click();
  const report = await page.locator('.report-document').innerText();
  for (const text of [task, '직접 다듬은 예약 화면', '같은 시간이나 자리', '아직 정하지 못했어요']) assert(report.includes(text), text);
  assert.equal(await page.locator('#interview-attack').count(), 0);
  await go(4);
  console.log(`Guided interview browser checks passed: ${width}px`);
};
