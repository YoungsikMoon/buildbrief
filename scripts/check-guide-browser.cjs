// Optional browser check: set PLAYWRIGHT_MODULE to an installed Playwright module.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../dist');
const headers = Object.fromEntries(fs.readFileSync(path.join(root, '_headers'), 'utf8')
  .split(/\r?\n/).filter(line => /^  [A-Z][^:]+:/.test(line))
  .map(line => { const at = line.indexOf(':'); return [line.slice(0, at).trim(), line.slice(at + 1).trim()]; }));
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!/^(?:[a-z.-]+|(?:element|idea)-examples\/[a-z-]+\.webp|guide-previews\/[a-z-]+\.jpg|fonts\/pretendard-variable-1\.3\.9\.woff2)$/.test(file)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const bytes = fs.readFileSync(path.join(root, file));
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }[path.extname(file)] || 'text/html';
    res.writeHead(200, { ...headers, 'Content-Type': mime }); res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.BUILDBRIEF_TEST_URL || `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1001, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 500, reducedMotion: width === 1440 ? 'no-preference' : 'reduce' });
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (['fetch', 'xhr', 'websocket', 'eventsource', 'ping'].includes(r.resourceType())) requests.push(r.url()); });
      await page.goto(base); await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => [...document.fonts].some(font => font.family === 'Pretendard' && font.status === 'loaded')), 'The local Korean font must load under CSP');
      assert(await page.locator('#guide-view').isVisible());
      const original = await page.evaluate(() => localStorage.getItem(BriefProjects.KEY));
      assert.match(await page.locator('#guide-title').innerText(), /앱·웹 아이디어를/);
      assert.equal(await page.locator('.project-switcher label').count(), 0);
      await page.setViewportSize({ width, height: 800 });
      const headingLines = await page.locator('#guide-title').evaluate(el => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
      assert(headingLines < 2.1, 'Hero title should fit in two lines');
      if (width > 1100) {
        const visual = await page.locator('.guide-process').boundingBox();
        assert(visual.y + visual.height < 800, 'The whole product preview should fit in the first desktop viewport');
      }
      const cta = await page.locator('#start-planning').boundingBox();
      const preview = await page.locator('.guide-process strong').first().boundingBox();
      assert(cta.y + cta.height < 800 && preview.y + preview.height < 800, 'Purpose, action and output must appear in the first viewport');
      if (process.env.GUIDE_SCREENSHOTS) {
        fs.mkdirSync(process.env.GUIDE_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, 'first-view-' + width + '.png') });
      }
      assert(await page.locator('.guide-topnav button').isVisible());
      assert(await page.locator('#sidebar').isHidden());
      assert(await page.locator('.mobile-navigation').isHidden());
      assert.equal(await page.locator('.guide-process li').count(), 4);
      assert.equal(await page.locator('.guide-process button, .guide-process a').count(), 0);
      assert.equal(await page.locator('#guide-details-link').innerText(), '사용 가이드 자세히 보기');
      for (const img of await page.locator('.guide-process img').all()) await img.evaluate(el => el.decode());
      await page.setViewportSize({ width, height: 1000 });
      const track = page.locator('#guide-examples');
      await track.scrollIntoViewIfNeeded();
      const examples = page.locator('.guide-example');
      assert.equal(await examples.count(), 3);
      for (let i = 0; i < 3; i++) {
        const example = examples.nth(i), summary = example.locator('summary');
        await example.locator('img').scrollIntoViewIfNeeded();
        await example.locator('img').evaluate(img => img.decode());
        assert.equal(await example.evaluate(el => getComputedStyle(el).filter), 'none');
        await summary.focus(); await summary.press('Enter');
        assert(await example.locator('details').evaluate(el => el.open));
        assert(await example.locator('dl').isVisible());
        await summary.press('Enter');
        assert(!await example.locator('details').evaluate(el => el.open));
      }
      if (width > 1100) {
        const boxes = await examples.evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
        assert(boxes.every(top => Math.abs(top - boxes[0]) < 1), 'Desktop examples should share one row');
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow at ' + width);
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).fontSize), width <= 1000 ? '15px' : '16px');
      if (process.env.GUIDE_SCREENSHOTS) {
        fs.mkdirSync(process.env.GUIDE_SCREENSHOTS, { recursive: true });
        await page.setViewportSize({ width, height: 1800 });
        await page.evaluate(() => document.activeElement.blur());
        await page.locator('.guide-transformation').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 150));
        await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, `idea-gallery-${width}.png`) });
      }
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#guide-details-link').focus(); await page.keyboard.press('Enter');
      assert(await page.locator('#guide-walkthrough').evaluate(el => el.open));
      assert(await page.locator('[data-walkthrough-move="-1"]').isDisabled());
      for (let i = 0; i < 4; i++) {
        if (i) { await page.locator('[data-walkthrough-move="1"]').focus(); await page.keyboard.press('Enter'); }
        assert.equal(await page.locator('.walkthrough-panel:visible').count(), 1);
        assert(await page.locator('#walkthrough-panel-' + i).isVisible());
        assert.equal(await page.locator('#walkthrough-position').innerText(), (i+1) + ' / 4');
        await page.locator('#walkthrough-panel-' + i + ' img').evaluate(img => img.decode());
        if (process.env.GUIDE_SCREENSHOTS && [0,1,3].includes(i)) {
          await page.locator('#guide-storyboard').evaluate(el => el.scrollIntoView({block:'start'}));
          await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, 'walkthrough-' + i + '-' + width + '.png') });
        }
      }
      assert(await page.locator('#walkthrough-start').isVisible());
      assert(await page.locator('[data-walkthrough-move="1"]').isHidden());
      await page.locator('[data-walkthrough-move="-1"]').click();
      assert(await page.locator('#walkthrough-panel-2').isVisible());
      if (width < 500) await page.locator('[data-walkthrough-step="0"]').tap();
      else { await page.locator('[data-walkthrough-step="0"]').focus(); await page.keyboard.press('Enter'); }
      assert(await page.locator('#walkthrough-panel-0').isVisible());
      assert(await page.locator('[data-walkthrough-move="-1"]').isDisabled());
      for (const details of await page.locator('.guide-faq-list details').all()) {
        await details.locator('summary').click(); assert(await details.locator('p').first().isVisible());
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(BriefProjects.KEY)), original, 'Examples and instructions changed project data');
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow at ${width}`);
      assert(await track.evaluate(el => [...el.querySelectorAll('.guide-example, blockquote')].every(e => e.scrollWidth <= e.clientWidth + 1)), 'Clipped example text');
      assert(await page.locator('.walkthrough-navigation').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Guide controls overflow at 200%');
      assert(await page.locator('.guide-process').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Preview controls overflow at 200%');
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await page.locator('#start-planning').click();
      if (width <= 1000) await page.locator('#toggle-navigation').click();
      const manage = page.locator('#manage-projects');
      const managerBox = await manage.boundingBox();
      const selectBox = await page.locator('#project-select').boundingBox();
      assert(managerBox.height >= 44 && Math.abs(managerBox.y - selectBox.y) < 8);
      if (process.env.GUIDE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, 'project-menu-' + width + '.png') });
      await manage.click();
      assert(await page.locator('#projects-dialog').isVisible());
      for (const scale of ['100%', '200%']) {
        await page.evaluate(value => document.documentElement.style.fontSize = value, scale);
        assert(await page.locator('#projects-dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Project dialog overflow');
        assert(await page.locator('.project-actions button').evaluateAll(els => els.every(el => el.getBoundingClientRect().height >= 44 && el.scrollWidth <= el.clientWidth + 1)), 'Project actions must remain readable and tappable');
        if (process.env.GUIDE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, `projects-${width}-${scale}.png`) });
      }
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await page.locator('[data-project-rename]').first().click();
      assert(await page.locator('#project-name-dialog').isVisible());
      await page.locator('#cancel-project-name').click();
      const download = page.waitForEvent('download');
      await page.locator('[data-project-backup]').first().click();
      assert.match((await download).suggestedFilename(), /\.json$/);
      await page.locator('[data-project-delete]').first().click();
      assert(await page.locator('#delete-project-dialog').isVisible());
      await page.locator('#cancel-delete-project').click();
      await page.locator('#close-projects').click();
      if (width <= 1000) await page.locator('#toggle-navigation').click();
      await page.locator('#input-project_name').fill('예시와 분리된 내 아이디어');
      await page.locator('.brand').click();
      assert(await page.locator('#guide-view').isVisible());
      await page.reload();
      assert(await page.locator('#guide-view').isVisible());
      await page.locator('#guide-details-link').click();
      await page.locator('[data-walkthrough-step="3"]').click();
      await page.locator('#walkthrough-start').click();
      assert(await page.locator('#form-view').isVisible());
      await page.locator('.brand').click();
      await page.locator('.guide-topnav button').click();
      assert(await page.locator('#form-view').isVisible());
      assert(await page.locator('.guide-topnav').isHidden());
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(BriefProjects.KEY)));
      assert.equal(stored.projects[0].answers.project_name, '예시와 분리된 내 아이디어');
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      await page.close();
    }
    console.log('Guide browser check passed: four widths, four static stages, three visible examples, four-step walkthrough, keyboard/touch navigation, native details, local images, 200% text, CSP, and saved answers.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
