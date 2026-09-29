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
      let acceptDialog=true;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>acceptDialog?d.accept():d.dismiss());
      await page.goto(base);
      const stored=()=>page.evaluate(()=>{const w=JSON.parse(localStorage.getItem(BriefProjects.KEY));const p=w.projects.find(p=>p.id===w.activeId);return {...p,...BriefAnswers.normalizeProject(p)};});
      const go=async step=>{const button=page.locator(`[data-step="${step}"]`);if(!await button.isVisible()) await page.locator('#toggle-navigation').click();await button.click();};
      const edit=(q,row,field)=>page.locator(`[data-q="${q}"][data-row="${row}"][data-field="${field}"]`);
      const nested=(row,element,item,property)=>page.locator(`[data-q="screens"][data-row="${row}"][data-field="elementContents"][data-element="${element}"]${item===null?'':`[data-item="${item}"]`}[data-property="${property}"]`);
      const selectElement=async(row,id)=>{
        const target=page.locator(`[data-q="screens"][data-row="${row}"][data-field="elements"][value="${id}"]`);
        const groups=target.locator('xpath=ancestor::details');
        for(let i=0;i<await groups.count();i++){const group=groups.nth(i);if(!await group.evaluate(n=>n.open)) await group.locator(':scope > summary').click();}
        await target.check();
      };
      const openRoles=async(row=0)=>{const picker=page.locator(`#row-screens-${row} .role-picker`);if(!await picker.evaluate(n=>n.open)) await picker.locator('summary').click();await picker.locator('[data-role-search]').fill('');return picker;};
      const action=(screen,scope,row,property)=>page.locator(`[data-q="screens"][data-row="${screen}"][data-field="flow"][data-flow-scope="${scope}"][data-flow-row="${row}"][data-property="${property}"]`);
      const reveal=async locator=>{
        const parents=locator.locator('xpath=ancestor::details');
        for(let i=0;i<await parents.count();i++){const p=parents.nth(i);if(!await p.evaluate(n=>n.open)) await p.locator(':scope > summary').click();}
      };
      const addFeature=async(screen,scope,kind='custom')=>{
        const trigger=page.locator('[data-feature-catalog-target="feature-catalog-'+screen+'-'+scope+'"]');
        const direct=page.locator('[data-feature="custom"][data-screen="'+screen+'"][data-flow-scope="'+scope+'"]');
        const boxes=await trigger.evaluate(n=>[...n.parentElement.children].map(b=>{const r=b.getBoundingClientRect();return {y:r.y,height:r.height};}));
        assert(Math.abs(boxes[0].y-boxes[1].y)<1 && Math.abs(boxes[0].height-boxes[1].height)<1,'Feature entry buttons share one row and height: '+JSON.stringify(boxes));
        if(kind!=='custom') await page.locator('[data-feature-catalog-target="feature-catalog-'+screen+'-'+scope+'"]').click();
        await page.locator('[data-feature="'+kind+'"][data-screen="'+screen+'"][data-flow-scope="'+scope+'"]').click();
        return (await stored()).answers.features.at(-1);
      };
      const openFlow=async(screen,scope='',feature='')=>{
        const state=await stored(),id=state.answers.screens[screen].id;
        const panel=page.locator(`[id="flow-${id}-${scope}${feature?'-'+feature:''}"]`);
        await reveal(panel);
        if(await panel.evaluate(n=>n.tagName==='DETAILS'&&!n.open)) await panel.locator(':scope > summary').click();
      };
      const addFlow=async(screen,scope='',feature='')=>{await openFlow(screen,scope,feature);await page.locator(`[data-flow-add][data-screen="${screen}"][data-flow-scope="${scope}"][data-flow-feature="${feature}"]`).click();};
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
      if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.locator('.element-settings').first().evaluate(n=>n.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`element-start-${width}.png`)});}
      await reveal(page.locator('[data-content-add][data-screen="0"][data-element="form"]'));
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
      const f=await addFeature(0,'form','browse');
      await edit('features',0,'name').fill('예약하기');
      await reveal(edit('features',0,'outcome'));await edit('features',0,'outcome').fill('예약 번호 확인');
      assert.equal(await edit('features',0,'priority').inputValue(),'');
      assert.equal(await edit('features',0,'priority').locator('option').filter({hasText:'아직 미정'}).count(),0);
      assert.equal(await page.locator('[data-feature-title="0"]').textContent(),'예약하기');
      assert.equal(await page.locator('[data-screen-title="0"]').textContent(),'예약 신청');
      await page.locator('[data-recommend="screens"]').check();
      await edit('screens',0,'recommendLayout').check();
      assert.equal(await page.locator('[id^="recommendation-hint"],[id^="screen-recommendation-hint"]').count(),0);
      assert(!(await page.locator('#question-form').textContent()).includes('기획 초안에 요청을 담아요'));
      const picker=await openRoles();
      const search=picker.locator('[data-role-search]');
      const beforeSearch=await stored();
      await search.fill('강사');assert.equal(await picker.locator('[data-role-option]:visible').count(),1);
      assert.deepEqual((await stored()).answers,beforeSearch.answers);
      await search.fill('없는 역할');assert.equal(await picker.locator('[data-role-option]:visible').count(),0);
      assert((await picker.locator('[role="status"]').textContent()).includes('검색 결과가 없어요'));
      await search.press('Escape');assert(!await picker.evaluate(n=>n.open));
      assert(await picker.locator('summary').evaluate(n=>n===document.activeElement));
      await picker.locator('summary').press('Enter');await search.fill('');
      await picker.locator('[data-edit-roles]').focus();await page.keyboard.press('Tab');
      assert(!await picker.evaluate(n=>n.open));await openRoles();
      if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.locator('#row-screens-0').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`hierarchy-${width}.png`)});}

      assert.equal(await edit('features',0,'actor').count(),0);
      await openRoles();
      await page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[1].id}"]`).check();
      assert((await picker.locator('[data-role-summary]').textContent()).includes('로그인 사용자'));
      await page.locator('#page-title').click();assert(!await picker.evaluate(n=>n.open));
      await action(0,'form',0,'event').fill('신청서 제출');
      assert.equal((await stored()).answers.screens[0].elementContents.form.flow[0].featureId,f.id);
      await action(0,'form',0,'result').fill('실패하면 입력을 유지하고 다시 시도');
      await action(0,'form',0,'recommendExceptions').check();
      await page.locator('[data-q="screens"][data-row="0"][data-field="recommendFlow"][data-flow-scope="form"]').check();
      await reveal(action(0,'form',0,'exceptions'));await action(0,'form',0,'exceptions').fill('중복 신청이면 기존 예약 안내');
      await page.locator(`[id="reason-feature-0-form-${f.id}"] > summary`).click();
      await edit('features',0,'reason').fill('개인 예약 보호');
      await page.locator('[data-add="screens"]').click();await edit('screens',1,'name').fill('내 예약');
      await selectElement(1,'table');await reveal(page.locator('[data-content-add][data-screen="1"][data-element="table"]'));await page.locator('[data-content-add][data-screen="1"][data-element="table"]').click();
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
      await page.locator('[data-feature-catalog-target="feature-catalog-1-table"]').click();
      await page.locator('[data-link-feature][data-screen="1"][data-flow-scope="table"]').selectOption(f.id);
      assert.equal(await edit('features',0,'name').count(),2);
      await edit('features',0,'name').last().fill('예약 신청하기');
      assert.equal(await edit('features',0,'name').first().inputValue(),'예약 신청하기');
      let state=await stored();assert.equal(state.answers.features.length,1);assert.equal(state.answers.screens[1].featureIds[0],f.id);
      if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await nested(1,'table',0,'name').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`planning-${width}.png`)});}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
      await action(0,'form',0,'nextScreenId').selectOption(state.answers.screens[1].id);
      await addFlow(0);
      await action(0,'',0,'event').fill('이 화면에 들어오면');await action(0,'',0,'nextScreenId').selectOption('@stay');
      await selectElement(0,'sidebar');const sidebarFeature=await addFeature(0,'sidebar');
      await edit('features',1,'name').fill('뒤로 가기');
      await action(0,'sidebar',0,'event').fill('뒤로가기 누르기');await action(0,'sidebar',0,'nextScreenId').selectOption('@back');
      await addFlow(0,'sidebar',sidebarFeature.id);await action(0,'sidebar',1,'event').fill('삭제할 동작');
      await page.locator('[data-flow-move="1"][data-flow-scope="sidebar"][data-direction="-1"]').click();
      assert.equal(await action(0,'sidebar',0,'event').inputValue(),'삭제할 동작');
      await page.locator('[data-flow-remove="0"][data-flow-scope="sidebar"]').click();
      assert.equal(await action(0,'sidebar',0,'event').inputValue(),'뒤로가기 누르기');
      await page.locator('[data-add-element][data-screen="0"]').click();
      await page.locator('[data-row="0"][data-field="customElements"][data-property="name"]').fill('좌석 배치도');
      const custom=(await stored()).answers.screens[0].customElements[0];
      const customFeature=await addFeature(0,'custom:'+custom.id);await edit('features',2,'name').fill('좌석 고르기');
      await action(0,'custom:'+custom.id,0,'event').fill('좌석 선택');
      await action(0,'custom:'+custom.id,0,'nextScreenId').selectOption('@stay');
      await openRoles();
      await page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[3].id}"]`).check();
      await page.locator('[data-edit-roles]').first().click();
      assert(await page.locator('[data-role-preset="0"]').isVisible());
      await edit('roles',1,'role').fill('예약 회원');
      await page.locator('[data-remove="roles"][data-index="3"]').click();
      await go(4);
      await openRoles();
      const selectedRole=page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[1].id}"]`);
      assert(await selectedRole.isChecked());assert((await selectedRole.locator('..').innerText()).includes('예약 회원'));
      const deletedRole=page.locator(`[data-q="screens"][data-row="0"][data-field="roleIds"][value="${roles[3].id}"]`);
      assert((await deletedRole.locator('..').innerText()).includes('삭제된 역할'));await deletedRole.uncheck();
      const extra=await addFeature(0,'form');await edit('features',3,'name').fill('삭제할 기능');
      const extraDetails=page.locator(`[id="feature-0-form-${extra.id}"]`);
      await extraDetails.locator(':scope > summary').click();
      const remove=page.locator('[data-remove="features"][data-index="3"]');assert(await remove.isVisible());
      if(process.env.PLANNING_SCREENSHOTS){await extraDetails.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`feature-delete-${width}.png`)});}
      acceptDialog=false;await remove.click();assert.equal((await stored()).answers.features.length,4);assert(!await extraDetails.evaluate(n=>n.open));
      acceptDialog=true;await remove.focus();await page.keyboard.press('Enter');assert.equal((await stored()).answers.features.length,3);
      assert(await page.locator('[data-feature-catalog-target="feature-catalog-0-form"]').evaluate(n=>n===document.activeElement));
      await page.locator('[data-unlink-feature][data-screen="1"]').click();
      state=await stored();assert.equal(state.answers.features.length,3);assert.deepEqual(state.answers.screens[1].elementContents.table.featureIds,[]);
      assert.equal(state.answers.screens[1].elementContents.table.flow[0].featureId,'');
      await page.locator('[data-flow-remove="0"][data-screen="1"][data-flow-scope="table"][data-flow-feature=""]').click();
      assert.equal((await stored()).answers.screens[1].elementContents.table.flow.length,0);
      assert(await page.locator('[data-feature-catalog-target="feature-catalog-1-table"]').evaluate(n=>n===document.activeElement));
      assert.equal(state.answers.screens[0].elementContents.form.flow[0].featureId,f.id);
      if(process.env.PLANNING_SCREENSHOTS){await openFlow(0,'form',f.id);await action(0,'form',0,'event').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`flow-${width}.png`)});}
      await go(5);await page.locator('#next-button').click();
      const report=await page.locator('#report-view').innerText();
      for(const text of ['예약 신청하기','입력 항목 1','표의 열 1','기초','심화','개인 예약 보호','신청서 제출','좌석 선택','예약 회원','이전 화면으로 돌아가기','현재 화면 유지','요소별 추천','오류·예외 추천','중복 신청이면 기존 예약 안내']) assert(report.includes(text),text);
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
      // Old screen-level links remain editable; moving within one feature preserves other actions.
      await page.evaluate(()=>{
        const project=BriefProjects.createProject({answers:{features:[{id:'f1',name:'저장'},{id:'f2',name:'검색'},{id:'f3',name:'기존 기능'}],screens:[{id:'s',name:'이전 화면',elements:['form'],featureIds:['f1','f2','f3'],flow:[{id:'load',featureId:'f1',event:'화면 진입'}],elementContents:{form:{flow:[{id:'a',featureId:'f1',event:'첫 동작',recommendExceptions:true},{id:'b',featureId:'f2',event:'검색 동작'},{id:'c',featureId:'f1',event:'다른 동작'}]}}}]}});
        localStorage.setItem(BriefProjects.KEY,JSON.stringify({version:1,activeId:project.id,projects:[project]}));
      });await page.reload();await go(4);
      assert.equal(await action(0,'',0,'event').inputValue(),'화면 진입');
      await page.locator('[data-flow-move="2"][data-flow-scope="form"][data-flow-feature="f1"][data-direction="-1"]').click();
      assert.deepEqual((await stored()).answers.screens[0].elementContents.form.flow.map(a=>a.id),['c','b','a']);
      assert((await stored()).answers.screens[0].elementContents.form.flow[2].recommendExceptions);
      await page.locator('[data-assign-feature="f3"]').selectOption('form');
      assert((await stored()).answers.screens[0].elementContents.form.featureIds.includes('f3'));
      assert.equal(await page.locator('[id="feature-0-f3"]').count(),0);
      assert.equal(await page.locator('[id="feature-0-form-f3"]').count(),1);
      await reveal(page.locator('[data-q="screens"][data-row="0"][data-field="elements"][value="form"]'));
      await page.locator('[data-q="screens"][data-row="0"][data-field="elements"][value="form"]').uncheck();
      assert.equal(await page.locator('[id="feature-0-form-f3"]').count(),0);
      assert.equal((await stored()).answers.screens[0].elementContents.form.flow.length,4);
      await selectElement(0,'form');
      assert.equal(await action(0,'form',2,'event').inputValue(),'첫 동작');
      assert.equal(await page.locator('[id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length-new Set(ids).size;}),0,'Duplicate shared feature IDs');
      await page.evaluate(()=>{
        const project=BriefProjects.createProject({answers:{features:[],screens:[{id:'s',name:'기존 연결 상한',elements:['form'],featureIds:Array.from({length:80},(_,i)=>'old-'+i),elementContents:{form:{}}}]}});
        localStorage.setItem(BriefProjects.KEY,JSON.stringify({version:1,activeId:project.id,projects:[project]}));
      });await page.reload();await go(4);
      const atLimit=(await stored()).answers;
      await page.locator('[data-feature="custom"][data-screen="0"][data-flow-scope="form"]').click();
      assert.deepEqual((await stored()).answers,atLimit,'A failed link must not create a feature or exceed backup limits');
      assert.equal(await page.locator('[data-feature-title]').count(),0);
      await page.evaluate(()=>{
        const project=BriefProjects.createProject({answers:{roles:Array.from({length:80},(_,i)=>({id:'role-'+i,role:'운영 담당 '+(i+1)})),screens:[{id:'s',name:'긴 역할 목록',roleIds:['role-79']}]}});
        localStorage.setItem(BriefProjects.KEY,JSON.stringify({version:1,activeId:project.id,projects:[project]}));
      });await page.reload();await go(4);
      const many=await openRoles();
      assert.equal(await many.locator('[data-role-option]').count(),80);
      assert(await many.locator('.role-options').evaluate(n=>n.scrollHeight>n.clientHeight));
      await many.locator('[data-role-search]').fill('담당 80');
      assert.equal(await many.locator('[data-role-option]:visible').count(),1);
      assert(await many.locator('[data-role-option]:visible input').isChecked());
      assert((await many.locator('[data-role-summary]').textContent()).includes('운영 담당 80'));
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`200% overflow ${width}`);
      assert.deepEqual(errors,[]);await context.close();console.log(`Connected planning browser flow passed: ${width}px`);
    }
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
