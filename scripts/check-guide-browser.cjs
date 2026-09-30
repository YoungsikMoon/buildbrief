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
  if (!/^(?:[a-z.-]+|(?:element|idea)-examples\/[a-z-]+\.webp|fonts\/pretendard-variable-1\.3\.9\.woff2)$/.test(file)) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const bytes = fs.readFileSync(path.join(root, file));
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2' }[path.extname(file)] || 'text/html';
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
      const track = page.locator('#guide-examples');
      await track.scrollIntoViewIfNeeded();
      const current = index => page.waitForFunction(i => document.querySelector('#guide-example-status').textContent.startsWith(`${i + 1} / 3`), index);
      const centered = () => page.waitForFunction(() => {
        const track = document.querySelector('#guide-examples').getBoundingClientRect();
        const card = document.querySelector('.guide-example.is-current').getBoundingClientRect();
        return Math.abs(track.left + track.width / 2 - card.left - card.width / 2) < 2;
      });
      await centered();
      assert(await page.locator('#guide-example-previous').isDisabled());
      await page.locator('#guide-example-next').click(); await current(1); await centered();
      assert.equal(await page.locator('.guide-example.is-current').count(), 1);
      const peek = await track.evaluate(el => {
        const box = el.getBoundingClientRect();
        return [...el.children].filter(card => !card.classList.contains('is-current')).map(card => {
          const rect = card.getBoundingClientRect();
          return { visible: Math.min(rect.right, box.right) - Math.max(rect.left, box.left), blur: getComputedStyle(card).filter };
        });
      });
      assert(peek.every(p => p.visible > 5 && p.blur.includes('blur')), `Missing neighboring previews at ${width}`);
      await track.focus(); await page.keyboard.press('End'); await current(2); await centered();
      assert(await page.locator('#guide-example-next').isDisabled());
      await page.keyboard.press('ArrowLeft'); await current(1); await centered();
      await page.keyboard.press('Home'); await current(0); await centered();
      await page.waitForFunction(() => [...document.querySelectorAll('.guide-service-image')].every(img => img.complete && img.naturalWidth === 1200));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`);
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).fontSize), width <= 1000 ? '15px' : '16px');
      if (width === 390) {
        const session = await page.context().newCDPSession(page);
        await page.locator('.guide-service-image').first().scrollIntoViewIfNeeded();
        const box = await page.locator('.guide-service-image').first().boundingBox();
        const y = box.y + box.height / 2, start = box.x + box.width - 8;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
        for (let step = 1; step <= 10; step++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start - step * 24, y }] });
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await current(1); await centered();
        await session.detach();
      }
      if (process.env.GUIDE_SCREENSHOTS) {
        fs.mkdirSync(process.env.GUIDE_SCREENSHOTS, { recursive: true });
        await page.setViewportSize({ width, height: 1800 });
        await page.evaluate(() => document.activeElement.blur());
        await page.locator('.guide-transformation').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 150));
        await page.screenshot({ path: path.join(process.env.GUIDE_SCREENSHOTS, `idea-gallery-${width}.png`) });
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(BriefProjects.KEY)), original, 'Examples changed project data');
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow at ${width}`);
      assert(await track.evaluate(el => [...el.querySelectorAll('.guide-seed, .guide-paper, .guide-paper dl')].every(e => e.scrollWidth <= e.clientWidth + 1)), 'Clipped example text');
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      await page.locator('#start-planning').click();
      await page.locator('#input-project_name').fill('예시와 분리된 내 아이디어');
      await page.locator('.brand').click();
      assert(await page.locator('#guide-view').isVisible());
      await page.reload();
      assert(await page.locator('#guide-view').isVisible());
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem(BriefProjects.KEY)));
      assert.equal(stored.projects[0].answers.project_name, '예시와 분리된 내 아이디어');
      assert.deepEqual(errors, []); assert.deepEqual(requests, []);
      await page.close();
    }
    console.log('Guide browser check passed: four widths, neighbor previews, buttons, keyboard, touch swipe, local images, 200% text, CSP, and saved answers.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
