// Capture fictional sample content in an isolated browser; never use a saved user profile.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    await page.goto(process.env.BUILDBRIEF_TEST_URL || 'http://127.0.0.1:4173');
    await page.evaluate(() => {
      const answers = { project_name: '공방 클래스 예약', summary: '공방 수업의 날짜와 남은 자리를 확인하고 예약하는 서비스', problem: '수업 문의와 시간 조율을 메시지로 반복하고 있어요.',
        screens: [{ id: 'sample', name: '수업 예약', canvas: { width: 960, height: 480 },
          customElements: [{ id: 'photo', name: '수업 사진' }, { id: 'intro', name: '수업 소개' }, { id: 'date', name: '날짜·인원 선택' }, { id: 'book', name: '예약하기', purpose: '선택한 날짜와 인원을 확인한 뒤 예약을 신청해요.' }],
          placements: {
            'custom:photo': { region: 'main', width: 42, height: 320, level: 1, position: { x: 4, y: 40 } },
            'custom:intro': { region: 'main', width: 45, height: 88, level: 1, position: { x: 50, y: 40 } },
            'custom:date': { region: 'main', width: 45, height: 112, level: 1, position: { x: 50, y: 152 } },
            'custom:book': { region: 'main', width: 45, height: 72, level: 1, position: { x: 50, y: 288 } }
          } }] };
      const project = BriefProjects.createProject({ answers, drafts: answers, started: true });
      localStorage.setItem(BriefProjects.KEY, JSON.stringify({ version: 1, activeId: project.id, projects: [project] }));
    });
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    const dir = path.resolve(__dirname, '../dist/guide-previews'); fs.mkdirSync(dir, { recursive: true });
    async function capture(name, selector, target, maxHeight = 600) {
      const el = page.locator(selector); await el.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.activeElement.blur());
      const box = await el.boundingBox();
      await page.screenshot({ path: path.join(dir, name + '.jpg'), type: 'jpeg', quality: 88, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, maxHeight) } });
      if (target) {
        const point = await page.locator(target).boundingBox();
        console.log(name, JSON.stringify({ width: box.width, height: Math.min(box.height, maxHeight), marker: [(point.x-box.x)/box.width*100, (point.y-box.y)/Math.min(box.height,maxHeight)*100, point.width/box.width*100, point.height/Math.min(box.height,maxHeight)*100].map(n=>Number(n.toFixed(2))) }));
      }
    }
    await page.locator('#start-planning').click();
    await capture('idea', '#form-view', '#input-project_name');
    await page.locator('#step-nav [data-step="4"]').click();
    await page.locator('[data-designer-screen="sample"]').click();
    await page.locator('[data-canvas-zoom]').selectOption('fit');
    await page.locator('[data-canvas-element="custom:book"]').click();
    await capture('canvas', '.designer-workspace', '.canvas-chrome [data-add-element]');
    await page.locator('#report-button').click();
    await capture('brief', '#report-view', '#download-report');
    await page.setViewportSize({width: 1000, height: 800});
    await page.locator('#show-prompt').click();
    await capture('prompt', '#prompt-dialog', '#copy-prompt', 900);
    console.log('Captured fictional examples from the actual local app.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
