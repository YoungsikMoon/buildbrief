const assert = require('node:assert/strict');

module.exports = async ({ page, go, width, shot }) => {
  await go(4);
  await page.locator('.canvas-chrome [data-add-element]').click();
  const before = await page.evaluate(() => localStorage.getItem(BriefProjects.KEY));
  const selection = await page.locator('.canvas-block.selected').getAttribute('data-block-key');
  const help = page.locator('[data-designer-help]'), dialog = page.locator('#option-help-dialog');
  await help.focus(); await help.press('Enter');
  assert(await dialog.isVisible());
  assert.equal(await page.locator('#help-title').innerText(), '화면 편집 사용법');
  assert.equal(await dialog.locator('.manual-topic').count(), 7);
  assert.equal(await dialog.locator('.manual-topic[open]').count(), 1);
  assert.equal(await dialog.locator('.manual-rules[open]').count(), 0);
  await shot('editor-manual');
  const summaries = dialog.locator('.manual-topic > summary');
  for (let i = 0; i < await summaries.count(); i++) {
    if (i > 0) { await summaries.nth(i).focus(); await summaries.nth(i).press('Enter'); }
    const demo = dialog.locator('.manual-demo').nth(i), action = demo.locator('button');
    const original = await demo.locator('figcaption').innerText();
    assert(!await demo.locator('.manual-after').first().isVisible());
    await action.focus(); await action.press('Enter');
    assert(await demo.locator('.manual-after').first().isVisible());
    assert.notEqual(await demo.locator('figcaption').innerText(), original);
    assert.equal(await action.getAttribute('aria-pressed'), 'true');
    if (i === 2) await shot('manual-selection-result');
    await action.press('Enter');
    assert.equal(await demo.locator('figcaption').innerText(), original);
    await dialog.locator('.manual-rules > summary').nth(i).click();
  }
  const text = await dialog.innerText();
  for (const phrase of ['소속 변경', '부모 이름 수정', '같은 부모', '미니맵', 'Shift', '터치', '자동 저장', 'JSON']) assert(text.includes(phrase));
  await dialog.evaluate(n => { n.scrollTop = n.scrollHeight; });
  const close = page.locator('#close-option-help');
  const box = await close.boundingBox(), bounds = await dialog.boundingBox();
  assert(box.y >= bounds.y && box.y + box.height <= bounds.y + bounds.height, 'Close remains visible while reading');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert(await dialog.evaluate(n => n.scrollWidth <= n.clientWidth), `${width}px help has no horizontal overflow at 200%`);
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.keyboard.press('Escape');
  assert(!await dialog.isVisible());
  assert(await help.evaluate(n => n === document.activeElement), 'Escape returns focus to the help button');
  await page.locator('[data-expand-designer]').click();
  await help.click(); await close.click();
  assert(await page.locator('[data-expand-designer]').getAttribute('aria-pressed') === 'true');
  assert(await help.evaluate(n => n === document.activeElement));
  await page.locator('[data-expand-designer]').click();
  assert.equal(await page.locator('.canvas-block.selected').getAttribute('data-block-key'), selection);
  assert.equal(await page.evaluate(() => localStorage.getItem(BriefProjects.KEY)), before, 'Reading help preserves stored planning data');
  console.log(`Editor manual checks passed: ${width}px`);
};
