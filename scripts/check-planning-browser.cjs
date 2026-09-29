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
  try {const bytes=fs.readFileSync(path.join(root,file));res.writeHead(200,{...headers,'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'text/html'});res.end(bytes);}
  catch {res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=process.env.BUILDBRIEF_TEST_URL||`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const width of [1440,390,320]) {
      const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
      const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);
      await page.addInitScript(()=>{window.cspErrors=[];document.addEventListener('securitypolicyviolation',e=>window.cspErrors.push(e.violatedDirective));});
      let acceptDialog=true;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>acceptDialog?d.accept():d.dismiss());
      const stored=()=>page.evaluate(()=>{const w=JSON.parse(localStorage.getItem(BriefProjects.KEY));const p=w.projects.find(p=>p.id===w.activeId);return {...p,...BriefAnswers.normalizeProject(p)};});
      const go=async step=>{const button=page.locator(`[data-step="${step}"]`);if(!await button.isVisible()) await page.locator('#toggle-navigation').click();await button.click();};
      const edit=(q,row,field)=>page.locator(`[data-q="${q}"][data-row="${row}"][data-field="${field}"]`);
      const nested=(row,element,item,property)=>page.locator(`[data-q="screens"][data-row="${row}"][data-field="elementContents"][data-element="${element}"]${item===null?'':`[data-item="${item}"]`}[data-property="${property}"]`);
      const action=(row,scope,index,property)=>page.locator(`[data-q="screens"][data-row="${row}"][data-field="flow"][data-flow-scope="${scope}"][data-flow-row="${index}"][data-property="${property}"]`);
      const reveal=async target=>{const parents=target.locator('xpath=ancestor::details');for(let i=0;i<await parents.count();i++){const p=parents.nth(i);if(!await p.evaluate(n=>n.open)) await p.locator(':scope > summary').click();}};
      const insert=async key=>{await page.locator('[data-designer-panel="elements"]').click();const b=page.locator(`[data-insert-element="${key}"]`);await reveal(b);await b.click();};
      const select=async(id,key='')=>{await page.locator(`[data-designer-screen="${id}"]`).click();if(key) await page.locator(`[data-canvas-owner="${id}"][data-canvas-element="${key}"]`).click();};
      const settings=()=>page.locator('[data-designer-settings]').click();
      const reason=async row=>{const input=edit('screens',row,'reason');await reveal(input);return input;};
      const addFeature=async(row,scope,kind='custom')=>{
        const picker=page.locator('[data-feature-choice][data-screen="'+row+'"][data-flow-scope="'+scope+'"]').locator('..');
        const boxes=await picker.locator('.feature-add-actions > button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {y:r.y,height:r.height};}));
        assert(Math.abs(boxes[0].y-boxes[1].y)<1 && Math.abs(boxes[0].height-boxes[1].height)<1,'Equal feature entry actions');
        if(kind!=='custom') {
          const before=(await stored()).answers.features?.length||0;
          await picker.locator('select').selectOption('type:'+kind);
          assert.equal((await stored()).answers.features?.length||0,before,'Choosing alone does not add a feature');
          assert(await picker.locator('[data-feature-description]').innerText());
          await picker.locator('[data-add-chosen-feature]').click();
        } else await picker.locator('[data-feature="custom"]').click();
        return (await stored()).answers.features.at(-1);
      };
      const snapshot=async name=>{if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.locator('#screen-designer').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`${name}-${width}.png`),fullPage:true});}};
      const validatePage=async()=>{
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);
        assert.equal(await page.locator('[id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length-new Set(ids).size;}),0,'Duplicate DOM ids');
      };
      try {
        await page.goto(base);await go(2);
        await page.locator('[data-q="login_need"][value="로그인 필요"]').check();
        for(const value of ['이메일·비밀번호','카카오','네이버','Google']) await page.locator(`[data-q="login_methods"][value="${value}"]`).check();
        await page.locator('[data-q="login_need"][value="로그인 없이 사용"]').check();assert.equal(await page.locator('[data-q="login_methods"]').count(),0);
        assert.equal((await stored()).answers.login_methods.length,4);
        await page.locator('[data-role-preset="1"]').click();await page.locator('[data-add="roles"]').click();await edit('roles',1,'role').fill('강사');
        await go(4);
        let state=await stored();const common=state.answers.screens[0].id;
        assert.equal(state.answers.screens.length,1);assert(state.answers.screens[0].isCommon);
        assert.equal(await page.evaluate(()=>BriefAnswers.isAnswered(JSON.parse(localStorage.getItem(BriefProjects.KEY)).projects[0].answers.screens)),false);
        assert.equal(await page.locator('[data-note="screens"]').count(),0);
        assert.equal(await page.locator('.designer-screens button').first().innerText(),'▣ 기본 공통 화면');
        assert.equal(await page.locator('.insert-group[open]').count(),0,'All element groups initially collapsed');
        const beforeToggle=(await stored()).answers;
        const narrow=await page.locator('.designer-stage').evaluate(n=>n.getBoundingClientRect().width);
        await page.locator('[data-toggle-inspector]').click();assert(!await page.locator('#designer-inspector').isVisible());
        assert.equal(await page.locator('[data-toggle-inspector]').getAttribute('aria-expanded'),'false');
        if(width===1440)assert(await page.locator('.designer-stage').evaluate(n=>n.getBoundingClientRect().width)>narrow+200);
        assert.deepEqual((await stored()).answers,beforeToggle);
        await page.locator('[data-toggle-inspector]').press('Enter');assert(await page.locator('#designer-inspector').isVisible());
        await insert('appbar');await insert('sidebar');
        assert.equal(await page.locator('.region-top [data-canvas-element="appbar"]').count(),1);
        assert.equal(await page.locator('.region-left [data-canvas-element="sidebar"]').count(),1);
        await (await reason(0)).fill('서비스의 이동 메뉴를 통일');
        await page.locator('[data-add="screens"]').click();await edit('screens',1,'name').fill('예약 신청');await edit('screens',1,'purpose').fill('날짜와 인원을 선택');
        const home=(await stored()).answers.screens[1].id;
        assert.equal(await page.locator('.canvas-block.inherited').count(),2);
        await page.locator('.inherited [data-canvas-element="appbar"]').click();
        assert.equal(await page.locator('.designer-screens [aria-pressed="true"]').getAttribute('data-designer-screen'),common);
        await select(home);await settings();
        const picker=page.locator('.role-picker');await picker.locator('summary').click();await picker.locator('[data-role-search]').fill('강사');
        assert.equal(await picker.locator('[data-role-option]:visible').count(),1);await picker.locator('[data-role-option]:visible input').check();
        await picker.locator('[data-role-search]').fill('없음');assert.equal(await picker.locator('[data-role-option]:visible').count(),0);
        await picker.locator('[data-role-search]').press('Escape');assert(!await picker.evaluate(n=>n.open));
        await insert('form');
        const add=page.locator('[data-content-add][data-element="form"]');await reveal(add);await add.click();
        await nested(1,'form',0,'name').fill('수업');await nested(1,'form',0,'type').selectOption('하나 선택');await nested(1,'form',0,'options').fill('기초\n심화');
        await nested(1,'form',null,'recommend').check();
        assert((await page.locator('.wire-form').innerText()).includes('수업'));
        await page.locator('[data-designer-panel="features"]').click();const f=await addFeature(1,'form','booking');
        await edit('features',0,'name').fill('예약하기');await action(1,'form',0,'event').fill('신청서 제출');await action(1,'form',0,'result').fill('예약 번호 확인');
        await reveal(action(1,'form',0,'recommendExceptions'));await action(1,'form',0,'recommendExceptions').check();assert.equal(await action(1,'form',0,'recommendExceptions').locator('xpath=ancestor::details').count(),2);await reveal(action(1,'form',0,'exceptions'));await action(1,'form',0,'exceptions').fill('중복 신청이면 기존 예약 안내');
        assert.equal(await action(1,'form',0,'nextScreenId').locator(`option[value="${common}"]`).count(),0);
        await action(1,'form',0,'nextScreenId').selectOption('@stay');
        await (await reason(1)).fill('한 화면에서 간단하게 신청');
        await page.locator('[data-designer-placement="width"]').selectOption('half');assert(await page.locator('[data-canvas-element="form"]').evaluate(n=>n.closest('.canvas-block').classList.contains('block-half')));
        await page.locator('[data-designer-placement="location"]').selectOption('region:right');assert.equal(await page.locator('.region-right [data-canvas-element="form"]').count(),1);
        await page.locator('[data-designer-placement="location"]').selectOption('region:main');await page.locator('[data-designer-placement="width"]').selectOption('full');
        await insert('table');await reveal(page.locator('[data-content-add][data-element="table"]'));await page.locator('[data-content-add][data-element="table"]').click();await nested(1,'table',0,'name').fill('예약일');
        await page.locator('[data-designer-move="-1"]').click();assert.deepEqual((await stored()).answers.screens[1].layoutOrder,['table','form']);
        if(width===1440){await page.locator('[data-canvas-element="table"]').dragTo(page.locator('.region-bottom'));assert.equal((await stored()).answers.screens[1].placements.table.region,'bottom');}
        // Add a local button inside the inherited app bar; move without editing the common screen.
        await page.locator('[data-insert-target="parent:appbar"]').click();
        assert.equal(await page.locator('[data-insert-location]').inputValue(),'parent:appbar');
        await insert('button');
        assert.equal((await stored()).answers.screens[1].placements.button.parent,'appbar');
        assert.equal(await page.locator('[data-block-key="appbar"] [data-canvas-element="button"]').count(),1);
        assert(!(await stored()).answers.screens[0].elements.includes('button'));
        if(width===1440) await page.locator('[data-canvas-element="button"]').dragTo(page.locator('[data-drop-parent="form"] > .canvas-add'));
        else await page.locator('[data-designer-placement="location"]').selectOption('parent:form');
        assert.equal((await stored()).answers.screens[1].placements.button.parent,'form');
        assert.equal(await page.locator('[data-block-key="form"] [data-canvas-element="button"]').count(),1);
        await select(home,'form');
        assert.equal(await page.locator('[data-designer-placement="location"] option[value="parent:form"]').count(),0);
        assert.equal(await page.locator('[data-designer-placement="location"] option[value="parent:button"]').count(),0);
        await select(home,'button');await page.locator('[data-designer-placement="location"]').selectOption('parent:appbar');
        await snapshot('designer');await validatePage();
        await page.locator('[data-add="screens"]').click();await edit('screens',2,'name').fill('내 예약');
        const history=(await stored()).answers.screens[2].id;
        await edit('screens',2,'useCommonLayout').uncheck();assert.equal(await page.locator('.inherited').count(),0);
        await (await reason(2)).fill('목록만 집중해서 보기');await insert('table');
        await page.locator('[id="feature-choice-2-table"]').selectOption('link:'+f.id);await page.locator('[data-add-chosen-feature][data-screen="2"]').click();
        await edit('features',0,'name').fill('예약 신청하기');await action(2,'table',0,'event').fill('예약 상세 보기');await action(2,'table',0,'nextScreenId').selectOption(home);
        await select(home,'form');assert.equal(await edit('features',0,'name').inputValue(),'예약 신청하기');assert.equal(await action(1,'form',0,'event').inputValue(),'신청서 제출');
        await page.locator('[data-designer-panel="elements"]').click();await page.locator('[data-add-element]').click();
        const custom=page.locator('[data-field="customElements"][data-property="name"]');await custom.fill('좌석 배치도');
        assert.equal(await page.locator('#inspector-title').innerText(),'좌석 배치도');
        await page.locator('[data-designer-placement="location"]').selectOption('parent:appbar');
        const customKey='custom:'+(await stored()).answers.screens[1].customElements[0].id;
        await select(home,'form');await page.locator('[data-designer-placement="location"]').selectOption('parent:'+customKey);
        await select(home,customKey);
        assert.equal(await page.locator('[data-designer-placement="location"] option[value="parent:form"]').count(),0,'Descendant cannot contain its ancestor');
        acceptDialog=false;await page.locator('[data-designer-remove-element]').click();assert.equal((await stored()).answers.screens[1].customElements.length,1);
        acceptDialog=true;await page.locator('[data-designer-remove-element]').click();state=await stored();assert.equal(state.answers.screens[1].customElements.length,0);assert(!Object.keys(state.answers.screens[1].placements).some(k=>k.startsWith('custom:')));assert.equal(state.answers.screens[1].placements.form.parent,'appbar');
        // Hiding a standard element keeps its configuration for undo by insertion.
        await select(home,'form');await page.locator('[data-designer-remove-element]').click();assert.equal(await page.locator('[data-canvas-element="form"]').count(),0);
        await insert('form');assert.equal(await nested(1,'form',0,'name').inputValue(),'수업');assert.equal(await action(1,'form',0,'event').inputValue(),'신청서 제출');
        const temporary=await addFeature(1,'form');
        const card=page.locator(`[id="feature-1-form-${temporary.id}"]`).locator('..');
        if(await card.locator('details').first().evaluate(n=>n.open)) await card.locator('details > summary').first().click();
        const removeFeature=card.locator('[data-remove="features"]');assert(await removeFeature.isVisible());
        acceptDialog=false;await removeFeature.click();assert((await stored()).answers.features.some(f=>f.id===temporary.id));
        acceptDialog=true;await removeFeature.click();assert(!(await stored()).answers.features.some(f=>f.id===temporary.id));
        assert(await page.locator('[id="feature-choice-1-form"]').evaluate(n=>n===document.activeElement));
        assert(!(await page.locator('#question-form').innerText()).includes('기능에 연결하지 않은 동작'));
        await validatePage();await go(5);await page.locator('#next-button').click();
        const report=await page.locator('#report-view').innerText();for(const text of ['기본 공통 화면','공통 레이아웃 적용','사용하지 않음','서비스의 이동 메뉴를 통일','한 화면에서 간단하게 신청','목록만 집중해서 보기','예약 신청하기','수업','예약일','오류·예외 추천','중복 신청이면 기존 예약 안내','요소 배치 순서','상단 > 상단 바 > 일반 버튼']) assert(report.includes(text),text);
        await validatePage();await page.locator('#back-to-form').click();await go(4);
        const before=await stored();await page.reload();assert(await page.locator('#guide-view').isVisible());await go(4);assert.deepEqual((await stored()).answers,before.answers);
        const nav=page.locator('#export-answers');if(!await nav.isVisible()) await page.locator('#toggle-navigation').click();
        const downloaded=page.waitForEvent('download');await nav.click();const backup=JSON.parse(fs.readFileSync(await (await downloaded).path(),'utf8'));assert.deepEqual(backup.answers,before.answers);
        await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
        const restored=await stored();assert.notEqual(restored.id,before.id);assert.deepEqual(restored.answers,before.answers);
        // Close a tab without opening settings or switching away from the active screen.
        await go(4);
        assert.equal(await page.locator('.screen-tab-close[data-index="0"]').count(),0);
        await page.locator('[data-add="screens"]').click();await edit('screens',3,'name').fill('임시 화면 A');
        await page.locator('[data-add="screens"]').click();await edit('screens',4,'name').fill('임시 화면 B');
        const activeId=(await stored()).answers.screens[4].id;
        const closeA=page.locator('.screen-tab-close[data-index="3"]');
        assert.equal(await closeA.getAttribute('aria-label'),'임시 화면 A 삭제');
        acceptDialog=false;await closeA.click();assert.equal((await stored()).answers.screens.length,5);
        assert.equal(await page.locator('.designer-screens [aria-pressed="true"]').getAttribute('data-designer-screen'),activeId);
        acceptDialog=true;await closeA.click();assert.equal((await stored()).answers.screens.length,4);
        assert.equal(await page.locator('.designer-screens [aria-pressed="true"]').getAttribute('data-designer-screen'),activeId);
        assert.equal(await edit('screens',3,'name').inputValue(),'임시 화면 B');
        await page.locator('.screen-tab-close[data-index="3"]').focus();await page.keyboard.press('Enter');
        assert.deepEqual((await stored()).answers,restored.answers);
        assert(await page.locator(`[data-designer-screen="${history}"]`).evaluate(n=>n===document.activeElement));
        await page.locator('.screen-tab-close[data-index="2"]').click();await page.locator('.screen-tab-close[data-index="1"]').click();
        assert.equal(await page.locator('.screen-tab-close').count(),0);
        assert.equal(await page.locator('.common-tab').getAttribute('aria-pressed'),'true');
        assert.equal((await stored()).answers.features.length,restored.answers.features.length);
        // Deleting a shared container preserves children placed by an individual screen.
        await page.locator('[data-add-element]').click();
        await page.locator('[data-field="customElements"][data-property="name"]').fill('공통 도구 모음');
        const sharedKey='custom:'+(await stored()).answers.screens[0].customElements[0].id;
        await page.locator('[data-designer-placement="location"]').selectOption('parent:appbar');
        await page.locator('[data-add="screens"]').click();
        await page.locator('[data-insert-target="parent:'+sharedKey+'"]').click();await insert('button');
        assert.equal((await stored()).answers.screens[1].placements.button.parent,sharedKey);
        await select(common,sharedKey);await page.locator('[data-designer-remove-element]').click();
        assert.equal((await stored()).answers.screens[1].placements.button.parent,'appbar');
        // Legacy screen-level records are only shown when actually present.
        await page.evaluate(()=>{const p=BriefProjects.createProject({answers:{roles:Array.from({length:80},(_,i)=>({id:'r'+i,role:'운영 담당 '+(i+1)})),screens:[{id:'old',name:'기존 화면',roleIds:['r79'],content:'보존할 메모',flow:[{id:'old-flow',event:'기존 진입 동작'}],elements:['form'],elementContents:{form:{items:[{id:'f',name:'<img src=x onerror=alert(1)>'}]}}}]},notes:{screens:'예전 전체 메모'}});localStorage.setItem(BriefProjects.KEY,JSON.stringify({version:1,activeId:p.id,projects:[p]}));});
        await page.reload();await go(4);await select('old');await settings();await reveal(edit('screens',1,'content'));assert.equal(await edit('screens',1,'content').inputValue(),'보존할 메모');
        await reveal(action(1,'',0,'event'));assert.equal(await action(1,'',0,'event').inputValue(),'기존 진입 동작');
        assert.equal(await page.locator('[data-note="screens"]').count(),0);
        const many=page.locator('.role-picker');await many.locator('summary').click();assert.equal(await many.locator('[data-role-option]').count(),80);assert(await many.locator('.role-options').evaluate(n=>n.scrollHeight>n.clientHeight));
        await many.locator('[data-role-search]').fill('담당 80');assert.equal(await many.locator('[data-role-option]:visible').count(),1);assert(await many.locator('[data-role-option]:visible input').isChecked());await many.locator('[data-role-search]').press('Escape');
        await select('old','form');assert.equal(await page.locator('.wire-preview img').count(),0);assert((await page.locator('.wire-preview').innerText()).includes('<img'));
        await page.evaluate(()=>document.documentElement.style.fontSize='200%');await validatePage();
        assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.cspErrors),[]);console.log(`Visual screen designer browser flow passed: ${width}px`);
      } catch(error) {await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS||'.',`designer-failure-${width}.png`),fullPage:true});throw error;}
      finally {await context.close();}
    }
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
