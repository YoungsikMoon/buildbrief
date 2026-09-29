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
      const action=(screen,scope,row,property)=>page.locator(`[data-q="screens"][data-row="${screen}"][data-field="flow"][data-flow-scope="${scope}"][data-flow-row="${row}"][data-property="${property}"]`);
      const openFlow=async(screen,scope='')=>{
        const state=await stored(),id=state.answers.screens[screen].id;
        const panel=page.locator(`[id="flow-${id}-${scope}"]`);
        if(!await panel.evaluate(n=>n.open)) await panel.locator(':scope > summary').click();
      };
      const addFlow=async(screen,scope='')=>{await openFlow(screen,scope);await page.locator(`[data-flow-add][data-screen="${screen}"][data-flow-scope="${scope}"]`).click();};
      await go(2);
      assert.equal(await page.locator('#question-form [value="아직 미정"]').count(),0);
      assert.equal(await page.locator('[data-q="login_need"]').count(),2);
      await page.locator('[data-q="login_need"][value="로그인 필요"]').check();
      for(const value of ['이메일·비밀번호','카카오','네이버','Google']) await page.locator(`[data-q="login_methods"][value="${value}"]`).check();
      await page.locator('[data-q="login_need"][value="로그인 없이 사용"]').check();
      assert.equal(await page.locator('[data-q="login_methods"]').count(),0);
      assert.equal((await stored()).answers.login_methods.length,4);
      await page.locator('[data-q="login_need"][value="로그인 필요"]').check();
      assert(await page.locator('[data-q="login_methods"][value="카카오"]').isChecked());
      for(const n of [0,1,2]) await page.locator(`[data-role-preset="${n}"]`).click();
      await page.locator('[data-add="roles"]').click();await edit('roles',3,'role').fill('강사');
      let roles=(await stored()).answers.roles;
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
      assert.equal(await edit('features',0,'priority').inputValue(),'');
      assert.equal(await edit('features',0,'priority').locator('option').filter({hasText:'아직 미정'}).count(),0);
      const f=(await stored()).answers.features[0];
      assert.equal(await edit('features',0,'actor').count(),0);
      await page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[1].id}"]`).check();
      await addFlow(0,'form');
      await action(0,'form',0,'event').fill('신청서 제출');
      await action(0,'form',0,'featureId').selectOption(f.id);
      await action(0,'form',0,'result').fill('실패하면 입력을 유지하고 다시 시도');
      await page.locator('[data-q="screens"][data-row="0"][data-field="recommendFlow"][data-flow-scope="form"]').check();
      await page.locator(`[id="reason-feature-0-${f.id}"] > summary`).click();
      await edit('features',0,'reason').fill('개인 예약 보호');
      await page.locator('[data-add="screens"]').click();await edit('screens',1,'name').fill('내 예약');
      await selectElement(1,'table');await page.locator('[data-content-add][data-screen="1"][data-element="table"]').click();
      await nested(1,'table',0,'name').fill('예약일');await nested(1,'table',0,'notes').fill('가까운 날짜순');
      await nested(1,'table',null,'recommend').check();
      const tableOption=page.locator('[data-row="1"][data-field="elementOptions"][data-element="table"][value="pages"]');
      assert.equal(await page.locator('[data-row="1"][data-field="elementOptions"][value=""]').count(),0);
      await tableOption.check();
      assert.deepEqual((await stored()).answers.screens[1].elementOptions.table,['pages']);
      await page.locator('[data-clear-element="table"][data-screen="1"]').click();
      assert(!await tableOption.isChecked());
      assert.deepEqual((await stored()).answers.screens[1].elementOptions.table,[]);
      await tableOption.check();
      await page.locator('[data-link-feature][data-screen="1"]').selectOption(f.id);
      assert.equal(await edit('features',0,'name').count(),2);
      await edit('features',0,'name').last().fill('예약 신청하기');
      assert.equal(await edit('features',0,'name').first().inputValue(),'예약 신청하기');
      let state=await stored();assert.equal(state.answers.features.length,1);assert.equal(state.answers.screens[1].featureIds[0],f.id);
      if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await nested(1,'table',0,'name').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`planning-${width}.png`)});}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
      await action(0,'form',0,'nextScreenId').selectOption(state.answers.screens[1].id);
      await addFlow(0);
      await action(0,'',0,'event').fill('이 화면에 들어오면');await action(0,'',0,'nextScreenId').selectOption('@stay');
      await selectElement(0,'sidebar');await addFlow(0,'sidebar');
      await action(0,'sidebar',0,'event').fill('뒤로가기 누르기');await action(0,'sidebar',0,'nextScreenId').selectOption('@back');
      await addFlow(0,'sidebar');await action(0,'sidebar',1,'event').fill('삭제할 동작');
      await page.locator('[data-flow-move="1"][data-flow-scope="sidebar"][data-direction="-1"]').click();
      assert.equal(await action(0,'sidebar',0,'event').inputValue(),'삭제할 동작');
      await page.locator('[data-flow-remove="0"][data-flow-scope="sidebar"]').click();
      assert.equal(await action(0,'sidebar',0,'event').inputValue(),'뒤로가기 누르기');
      await page.locator('[data-add-element][data-screen="0"]').click();
      await page.locator('[data-row="0"][data-field="customElements"][data-property="name"]').fill('좌석 배치도');
      const custom=(await stored()).answers.screens[0].customElements[0];
      await addFlow(0,'custom:'+custom.id);await action(0,'custom:'+custom.id,0,'event').fill('좌석 선택');
      await action(0,'custom:'+custom.id,0,'nextScreenId').selectOption('@stay');
      await page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[3].id}"]`).check();
      await page.locator('[data-edit-roles]').first().click();
      assert(await page.locator('[data-role-preset="0"]').isVisible());
      await edit('roles',1,'role').fill('예약 회원');
      await page.locator('[data-remove="roles"][data-index="3"]').click();
      await go(4);
      const selectedRole=page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[1].id}"]`);
      assert(await selectedRole.isChecked());assert((await selectedRole.locator('..').innerText()).includes('예약 회원'));
      const deletedRole=page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[3].id}"]`);
      assert((await deletedRole.locator('..').innerText()).includes('삭제된 역할'));await deletedRole.uncheck();
      await page.locator('[data-unlink-feature][data-screen="1"]').click();
      state=await stored();assert.equal(state.answers.features.length,1);assert.deepEqual(state.answers.screens[1].featureIds,[]);
      assert.equal(state.answers.screens[0].elementContents.form.flow[0].featureId,f.id);
      if(process.env.PLANNING_SCREENSHOTS){await openFlow(0,'form');await action(0,'form',0,'event').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`flow-${width}.png`)});}
      await go(5);await page.locator('#next-button').click();
      const report=await page.locator('#report-view').innerText();
      for(const text of ['예약 신청하기','입력 항목 1','표의 열 1','기초','심화','개인 예약 보호','신청서 제출','좌석 선택','예약 회원','이전 화면으로 돌아가기','현재 화면 유지','요소별 추천','동작·이동 추천']) assert(report.includes(text),text);
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
