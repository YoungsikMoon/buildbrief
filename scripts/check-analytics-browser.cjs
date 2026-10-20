// Optional: PLAYWRIGHT_MODULE selects an installed Playwright; no user's browser data is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDBRIEF_TEST_URL || 'https://buildbrief.moon0sik.cloud/';
const collector = url => { const u = new URL(url); return u.origin === 'https://buildbrief.moon0sik.cloud' && u.pathname === '/cdn-cgi/rum'; };
const policy = fs.readFileSync('dist/_headers', 'utf8').split(/\r?\n/).find(line => line.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
const marker = 'BUILDBRIEF_PRIVATE_ANALYTICS_TEST_7F21';
(async () => {
  assert.equal(new URL(base).origin, 'https://buildbrief.moon0sik.cloud', 'This check needs the real auto-injected script and collector');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, blocked] of [[1440, false], [390, false], [390, true]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 800 });
      try {
        const page = await context.newPage(), errors = [], requests = [], statuses = [];
        if (process.argv.includes('--candidate-policy')) {
          await page.route('https://buildbrief.moon0sik.cloud/**', async route => {
            if (!route.request().isNavigationRequest()) return route.continue();
            const response = await route.fetch();
            await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
          });
        }
        let blockedScripts = 0;
        if (blocked) await context.route('https://static.cloudflareinsights.com/**', route => { blockedScripts++; return route.abort(); });
        await page.addInitScript(value => {
          localStorage.setItem('analytics-privacy-probe', value);
          sessionStorage.setItem('analytics-privacy-probe', value);
          window.analyticsCsp = [];
          document.addEventListener('securitypolicyviolation', e => window.analyticsCsp.push({ directive: e.violatedDirective, url: e.blockedURI }));
        }, marker);
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (['fetch', 'xhr', 'websocket', 'eventsource', 'ping'].includes(request.resourceType())) requests.push({ url: request.url(), method: request.method(), body: request.postData() || '' });
        });
        page.on('response', response => { if (collector(response.url())) statuses.push(response.status()); });
        await page.goto(base, { waitUntil: 'networkidle' });
        const beacon = page.locator('script[src^="https://static.cloudflareinsights.com/beacon.min.js"]');
        assert.equal(await beacon.count(), 1, 'Keep one provider-injected script, without a duplicate SDK');
        assert((await beacon.getAttribute('integrity')).startsWith('sha'), 'The provider-injected script retains SRI');
        await page.locator('#start-planning').click();
        await page.locator('#input-project_name').fill(marker);
        await page.waitForFunction(value => localStorage.getItem(BriefProjects.KEY).includes(value), marker);
        const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, projectKey: BriefProjects.KEY }));
        assert.deepEqual(Object.keys(before.local).sort(), ['analytics-privacy-probe', before.projectKey].sort(), 'No extra storage keys are created at initial load');
        assert.equal(before.local['analytics-privacy-probe'], marker);
        assert.deepEqual(before.session, { 'analytics-privacy-probe': marker });
        delete before.projectKey;
        if (!blocked) {
          const response = page.waitForResponse(r => collector(r.url()) && r.request().resourceType() === 'ping');
          // Trigger the normal page-leave report inside this isolated test context.
          await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
            delete document.visibilityState;
          });
          assert.equal((await response).status(), 204);
          assert(statuses.length >= 2 && statuses.every(status => status === 204), 'Load and page-leave reports are accepted');
          assert(requests.length >= 2, 'Actual analytics traffic is required');
        } else {
          assert(blockedScripts > 0);
          assert.equal(requests.length, 0, 'Blocking analytics leaves the app usable without retries or other collectors');
        }
        assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), before, 'Analytics does not change project or browser storage');
        assert.deepEqual(await context.cookies(), [], 'Analytics must not create cookies');
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.analyticsCsp), [], 'No blocked script or unexpected connection under the reviewed CSP');
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('#start-planning').click();
        assert.equal(await page.locator('#input-project_name').inputValue(), marker, 'Saved answers work with analytics enabled or blocked');
        for (const request of requests) {
          assert(collector(request.url) && request.method === 'POST', 'Only the reviewed same-origin collector may receive analytics');
          assert(!request.body.includes(marker) && !request.url.includes(marker), 'Project answers and browser-storage canaries must not be transmitted');
          const payload = JSON.parse(request.body);
          assert.equal(payload.location, 'https://buildbrief.moon0sik.cloud/');
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => window.analyticsCsp), [], 'Reload with a stored project keeps the reviewed CSP');
        assert.deepEqual(await context.cookies(), [], 'Reload does not create analytics cookies');
        console.log(`Analytics privacy check passed: ${width}px, analytics ${blocked ? 'blocked' : 'enabled'}, ${requests.length} reviewed requests, no answer/storage canaries or cookies.`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
