// Optional: PLAYWRIGHT_MODULE points to an installed Playwright. Uses an isolated browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'../dist');
const headers = Object.fromEntries(fs.readFileSync(path.join(root,'_headers'),'utf8').split(/\r?\n/)
  .filter(line=>/^  [A-Z][^:]+:/.test(line)).map(line=>{const at=line.indexOf(':');return [line.slice(0,at).trim(),line.slice(at+1).trim()];}));
const server = http.createServer((req,res)=>{
  const file = new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if (!/^(?:[a-z.-]+|(?:element|idea)-examples\/[a-z-]+\.webp)$/.test(file)) {res.writeHead(404);res.end();return;}
  try { const bytes=fs.readFileSync(path.join(root,file));res.writeHead(200,{...headers,'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'text/html'});res.end(bytes); }
  catch {res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=process.env.BUILDBRIEF_TEST_URL||`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const width of [1440,390,320]) {
      const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await page.goto(base);
      const stored=()=>page.evaluate(()=>{const w=JSON.parse(localStorage.getItem(BriefProjects.KEY));const p=w.projects.find(p=>p.id===w.activeId);return {...p,...BriefAnswers.normalizeProject(p)};});
      const go=async step=>{const button=page.locator(`[data-step="${step}"]`);if(!await button.isVisible()) await page.locator('#toggle-navigation').click();await button.click();};
      const edit=(q,row,field)=>page.locator(`[data-q="${q}"][data-row="${row}"][data-field="${field}"]`);
      const nested=(row,element,item,property)=>page.locator(`[data-q="screens"][data-row="${row}"][data-field="elementContents"][data-element="${element}"]${item===null?'':`[data-item="${item}"]`}[data-property="${property}"]`);
      const selectElement=async(row,id)=>{
        const target=page.locator(`[data-q="screens"][data-row="${row}"][data-field="elements"][value="${id}"]`);
        const group=target.locator('xpath=ancestor::details[1]');
        if(!await target.isVisible()) await group.locator(':scope > summary').click();
        await target.check();
      };
      await go(4);
      assert.equal(await page.locator('#page-title').textContent(),'화면과 기능');
      await page.locator('[data-add="screens"]').click();
      await edit('screens',0,'name').fill('예약 신청');await edit('screens',0,'purpose').fill('시간을 골라 예약');
      await selectElement(0,'form');
      await page.locator('[data-content-add][data-screen="0"][data-element="form"]').click();
      await nested(0,'form',0,'name').fill('수업');await nested(0,'form',0,'type').selectOption('하나 선택');
      await nested(0,'form',0,'required').selectOption('필수');await nested(0,'form',0,'options').fill('기초\n심화');
      await nested(0,'form',null,'recommend').check();
      await page.locator('[data-content-add][data-screen="0"][data-element="form"]').click();
      await nested(0,'form',1,'name').fill('인원');await nested(0,'form',1,'type').selectOption('숫자');
      await page.locator('[data-content-move="1"][data-direction="-1"][data-element="form"]').click();
      assert.equal(await nested(0,'form',0,'name').inputValue(),'인원');
      await page.locator('[data-content-remove="0"][data-element="form"]').click();
      assert.equal(await nested(0,'form',0,'options').inputValue(),'기초\n심화');
      await edit('screens',0,'elementNotes').filter({visible:true}).first().fill('선택지가 어려우면 설명을 보게 해요.');
      await page.locator('[data-feature="custom"][data-screen="0"]').click();
      await edit('features',0,'name').fill('예약하기');await edit('features',0,'outcome').fill('예약 번호 확인');
      const f=(await stored()).answers.features[0];
      await page.locator(`#permission-0-${f.id} > summary`).click();
      await edit('features',0,'actor').fill('회원');await edit('features',0,'permission').fill('자신의 예약만 변경');
      await edit('features',0,'recommendPermission').check();
      await nested(0,'form',null,'featureIds').check();
      await page.locator(`[id="reason-feature-0-${f.id}"] > summary`).click();
      await edit('features',0,'reason').fill('개인 예약 보호');
      await page.locator('[data-add="screens"]').click();await edit('screens',1,'name').fill('내 예약');
      await selectElement(1,'table');await page.locator('[data-content-add][data-screen="1"][data-element="table"]').click();
      await nested(1,'table',0,'name').fill('예약일');await nested(1,'table',0,'notes').fill('가까운 날짜순');
      await nested(1,'table',null,'recommend').check();
      await page.locator('[data-link-feature][data-screen="1"]').selectOption(f.id);
      assert.equal(await edit('features',0,'name').count(),2);
      await edit('features',0,'name').last().fill('예약 신청하기');
      assert.equal(await edit('features',0,'name').first().inputValue(),'예약 신청하기');
      let state=await stored();assert.equal(state.answers.features.length,1);assert.equal(state.answers.screens[1].featureIds[0],f.id);
      if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await nested(1,'table',0,'name').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`planning-${width}.png`)});}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
      await go(5);await page.locator('[data-add="main_flow"]').click();
      await edit('main_flow',0,'screenId').selectOption(state.answers.screens[0].id);
      await edit('main_flow',0,'featureId').selectOption(f.id);await edit('main_flow',0,'note').fill('신청하고 결과 확인');
      await go(6);await page.locator(`#permissions-${f.id} > summary`).click();
      assert.equal(await edit('features',0,'permission').inputValue(),'자신의 예약만 변경');
      await edit('features',0,'permission').fill('자신의 예약만 취소');
      await go(4);assert.equal(await edit('features',0,'permission').first().inputValue(),'자신의 예약만 취소');
      await page.locator('[data-unlink-feature][data-screen="1"]').click();
      state=await stored();assert.equal(state.answers.features.length,1);assert.deepEqual(state.answers.screens[1].featureIds,[]);
      await go(7);await page.locator('#next-button').click();
      const report=await page.locator('#report-view').innerText();
      for(const text of ['예약 신청하기','입력 항목 1','표의 열 1','기초','심화','개인 예약 보호','이때 사용하는 화면','요소별 추천','기능별 권한 추천']) assert(report.includes(text),text);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Report overflow ${width}`);
      await page.locator('#back-to-form').click();await go(4);
      const before=await stored();await page.reload();assert(await page.locator('#guide-view').isVisible());
      await go(4);assert.deepEqual((await stored()).answers,before.answers);
      const nav=page.locator('#export-answers');if(!await nav.isVisible()) await page.locator('#toggle-navigation').click();
      const downloaded=page.waitForEvent('download');await nav.click();const download=await downloaded;
      const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
      assert.deepEqual(backup.answers,before.answers);
      await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
      const restored=await stored();assert.notEqual(restored.id,before.id);assert.deepEqual(restored.answers,before.answers);
      assert.equal(await page.locator('[id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length-new Set(ids).size;}),0,'Duplicate DOM ids');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`200% overflow ${width}`);
      assert.deepEqual(errors,[]);await context.close();console.log(`Connected planning browser flow passed: ${width}px`);
    }
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
