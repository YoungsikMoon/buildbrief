// Optional: PLAYWRIGHT_MODULE selects an installed Playwright; no user's browser data is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BUILDBRIEF_TEST_URL || 'https://buildbrief.moon0sik.cloud/';
const collector = url => { const u = new URL(url); return u.origin === 'https://buildbrief.moon0sik.cloud' && u.pathname === '/cdn-cgi/rum'; };
const policy = fs.readFileSync('dist/_headers', 'utf8').split(/\r?\n/).find(line => line.trim().startsWith('Content-Security-Policy:')).trim().slice('Content-Security-Policy:'.length).trim();
const marker = 'BUILDBRIEF_PRIVATE_ANALYTICS_TEST_7F21';
async function prepare(page) {
  if (process.argv.includes('--candidate-policy')) {
    const html = fs.readFileSync('dist/index.html', 'utf8');
    const tag = html.match(/<script src="analytics-preferences\.js[^>]*><\/script>/)[0];
    const faq = html.match(/<details><summary><span>방문 통계를 수집하나요\?<\/span>[\s\S]*?<\/details>/)[0];
    await page.route('https://buildbrief.moon0sik.cloud/**', async route => {
      if (new URL(route.request().url()).pathname === '/analytics-preferences.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('dist/analytics-preferences.js', 'utf8') });
      if (!route.request().isNavigationRequest()) return route.continue();
      const response = await route.fetch();
      const body = (await response.text()).replace(/<script src="analytics-preferences\.js[^>]*><\/script>/, '').replace('<meta name="theme-color"', tag + '<meta name="theme-color"').replace(/<details><summary><span>방문 통계를 수집하나요\?<\/span>[\s\S]*?<\/details>/, faq);
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy }, body });
    });
  }
  // Inspect payloads locally; automated checks must never add production analytics.
  await page.route('https://buildbrief.moon0sik.cloud/cdn-cgi/rum*', route => route.fulfill({ status: 204 }));
}
(async () => {
  assert.equal(new URL(base).origin, 'https://buildbrief.moon0sik.cloud', 'This check needs the real auto-injected script and collector');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, blocked] of [[1440, false], [390, false], [390, true]]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 800 });
      try {
        const page = await context.newPage(), errors = [], requests = [], statuses = [];
        await prepare(page);
        let blockedScripts = 0;
        if (blocked) await context.route('https://static.cloudflareinsights.com/**', route => { blockedScripts++; return route.abort(); });
        await page.addInitScript(value => {
          // Simulate a normal visitor only here; collector requests are fulfilled locally.
          Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
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
          assert(statuses.length >= 2 && statuses.every(status => status === 204), 'Load and page-leave payloads are checked locally without sending test traffic');
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
        console.log(`Analytics privacy check passed: ${width}px, analytics ${blocked ? 'blocked' : 'enabled'}, ${requests.length} locally checked requests (not sent), no answer/storage canaries or cookies.`);
      } finally { await context.close(); }
    }
    for (const automation of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
      try {
        const page = await context.newPage(), errors = [];
        let reports = 0;
        await prepare(page);
        page.on('request', request => { if (collector(request.url())) reports++; });
        page.on('pageerror', error => errors.push(error.message));
        if (!automation) await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
        await page.goto(base + (automation ? '?analytics=on' : '?analytics=off'), { waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-analytics-excluded'), 'true');
        assert.equal(reports, 0, 'Excluded browsers must not even attempt analytics collection');
        assert.equal(new URL(page.url()).searchParams.has('analytics'), false);
        const preference = page.locator('.guide-faq-list details').filter({ has: page.locator('#analytics-preference-status') });
        await preference.locator('summary').click();
        assert((await page.locator('#analytics-preference-status').innerText()).includes('제외'));
        await page.locator('#start-planning').click();
        await page.locator('#input-project_name').fill(marker);
        await page.reload({ waitUntil: 'networkidle' });
        await page.locator('#start-planning').click();
        assert.equal(await page.locator('#input-project_name').inputValue(), marker);
        assert.equal(reports, 0, 'Exclusion and saved answers survive refresh');
        if (!automation) {
          assert.equal(await page.evaluate(() => localStorage.getItem('buildbrief-analytics-excluded')), '1');
          await page.locator('.brand').click();
          const faq = page.locator('.guide-faq-list details').filter({ has: page.locator('#analytics-preference-status') });
          if (!await faq.evaluate(node => node.open)) await faq.locator('summary').click();
          await page.locator('#analytics-include').click();
          await page.waitForLoadState('networkidle');
          assert.equal(await page.locator('html').getAttribute('data-analytics-excluded'), 'false');
          assert.equal(await page.evaluate(() => localStorage.getItem('buildbrief-analytics-excluded')), null);
          assert(reports > 0, 'Re-enabling keeps the normal-visitor path working against the local mock');
        } else assert(await page.locator('#analytics-include').isHidden(), 'Automation cannot re-enable collection');
        assert.deepEqual(errors, []);
        console.log(`Analytics exclusion passed: ${automation ? 'automation' : 'owner off/reload/on'}, no excluded reports sent.`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
