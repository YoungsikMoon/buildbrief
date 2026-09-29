// Optional: PLAYWRIGHT_MODULE points to an installed Playwright. Uses an isolated browser.
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const legacy=require('./check-planning.cjs');
const root=path.resolve(__dirname,'../dist');
const headers=Object.fromEntries(fs.readFileSync(path.join(root,'_headers'),'utf8').split(/\r?\n/).filter(line=>/^  [A-Z][^:]+:/.test(line)).map(line=>{const i=line.indexOf(':');return [line.slice(0,i).trim(),line.slice(i+1).trim()];}));
const server=http.createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!/^(?:[a-z.-]+|(?:element|idea)-examples\/[a-z-]+\.webp)$/.test(file)){res.writeHead(404);res.end();return;}try{res.writeHead(200,{...headers,'Content-Type':{'.js':'text/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'text/html'});res.end(fs.readFileSync(path.join(root,file)));}catch{res.end();}});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=process.env.BUILDBRIEF_TEST_URL||`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<800,acceptDownloads:true,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);
    await page.addInitScript(()=>{window.cspErrors=[];document.addEventListener('securitypolicyviolation',e=>window.cspErrors.push(e.violatedDirective));});
    let acceptDialog=true;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>acceptDialog?d.accept():d.dismiss());
    const stored=()=>page.evaluate(()=>{const w=JSON.parse(localStorage.getItem(BriefProjects.KEY));return BriefAnswers.normalizeProject(w.projects.find(p=>p.id===w.activeId));});
    const go=async step=>{const b=page.locator(`[data-step="${step}"]`);if(!await b.isVisible())await page.locator('#toggle-navigation').click();await b.click();};
    const edit=(row,field)=>page.locator(`[data-q="screens"][data-row="${row}"][data-field="${field}"]`);
    const block=key=>page.locator(`[data-block-key="${key}"]`);
    const choose=async(owner,key)=>{await page.locator(`[data-designer-screen="${owner}"]`).click();await page.locator(`[data-canvas-owner="${owner}"][data-canvas-element="${key}"]`).click();};
    const name=()=>page.locator('#designer-inspector-body [data-property="name"]');
    const describe=()=>page.locator('#designer-inspector-body [data-property="purpose"]');
    const validate=async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);assert.equal(await page.locator('[id]').evaluateAll(nodes=>{const ids=nodes.map(n=>n.id);return ids.length-new Set(ids).size;}),0);};
    const shot=async label=>{if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`${label}-${width}.png`),fullPage:width<800});}};
    try{
      await page.goto(base);await go(2);
      await page.locator('[data-q="login_need"][value="로그인 필요"]').check();
      for(const value of ['카카오','Google'])await page.locator(`[data-q="login_methods"][value="${value}"]`).check();
      await page.locator('[data-role-preset="1"]').click();await go(4);
      assert.equal(await page.locator('[data-designer-panel],[data-designer-placement],[data-insert-element]').count(),0);
      assert.equal(await page.locator('#field-features,.designer-related').count(),0);
      if(width===1440){
        const original=await page.locator('.designer-stage').boundingBox();
        await page.setViewportSize({width:1920,height:1000});
        const wider=await page.locator('.designer-stage').boundingBox(), main=await page.locator('main').boundingBox();
        assert(wider.width>original.width+400,'Extra desktop width goes to the canvas');
        assert(main.x+main.width>=1919,'The editor uses the available right edge');
        const title=await page.locator('#page-title').boundingBox();
        assert(wider.y-title.y<210,'The canvas follows the heading and screen controls without an extra toolbar');
        if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,'wide-editor-1920.png')});}
        for(const viewport of [1200,1001,1000,801,800]){
          await page.setViewportSize({width:viewport,height:1000});await validate();
          await page.locator('[data-toggle-inspector]').click();await validate();
          await page.locator('[data-toggle-inspector]').click();
        }
        await page.setViewportSize({width,height:1000});
      }
      await page.locator('[data-add-element][data-target="region:top"]').click();
      let state=await stored();const common=state.answers.screens[0].id,top='custom:'+state.answers.screens[0].customElements[0].id;
      await name().fill('상단 메뉴');await describe().fill('왼쪽에는 서비스 이름, 오른쪽에는 검색과 로그인 버튼을 보여 줘요.');
      assert.equal(await page.locator('.natural-element-settings input,.natural-element-settings textarea').count(),2);
      await page.locator(`[data-add-element][data-target="parent:${top}"]`).click();
      state=await stored();const first='custom:'+state.answers.screens[0].customElements[1].id;
      await name().fill('검색');await describe().fill('검색어를 입력하고 찾기를 누르면 결과를 보여 줘요.\n오류가 나도 검색어는 지우지 않아요.');
      assert.equal((await stored()).answers.screens[0].placements[first].parent,top);
      const beforeHelp=(await stored()).answers;
      await page.locator('[data-open-reference]').click();
      assert.equal(await page.locator('.reference-category:visible').count(),1);
      assert(!(await page.locator('#designer-inspector').innerText()).includes('예시와 설명 보기'));
      const categories=await page.evaluate(()=>BriefQuestions.uiElementGroups.map(g=>g.id));
      const category=page.getByLabel('참고할 분류',{exact:true});
      for(const id of [...categories,'features']){
        await category.selectOption(id);
        assert.equal(await page.locator('.reference-category:visible').count(),1);
        assert(await page.locator(`[data-reference-group="${id}"]`).isVisible());
        await validate();
      }
      const formGroup=await page.evaluate(()=>BriefQuestions.uiElements.find(el=>el.id==='form').group);
      await category.selectOption(formGroup);
      const formExample=page.locator('.insert-element [data-element-help="form"]');await formExample.click();
      assert(await page.locator('#option-help-dialog img').evaluate(img=>img.complete&&img.naturalWidth>0));
      assert((await page.locator('#help-content').innerText()).includes('무엇인가요?'));
      await page.locator('#help-content [data-element-choice]').first().click();assert((await page.locator('#help-content').innerText()).includes('언제 잘 맞나요?'));
      await page.locator('#close-option-help').click();
      await category.selectOption('features');
      await page.locator('[data-feature-help="booking"]').click();assert((await page.locator('#help-content').innerText()).includes('무엇인가요?'));await page.locator('#close-option-help').click();
      const lastFeature=page.locator('[data-reference-group="features"] button').last();await lastFeature.click();await page.locator('#close-option-help').click();
      assert((await page.locator('#designer-inspector-body').boundingBox()).height<1000);
      const toggle=page.locator('[data-toggle-inspector]');
      const toggleBox=await toggle.boundingBox(),panelBox=await page.locator('#designer-inspector').boundingBox();
      assert(toggleBox.width>=44&&toggleBox.height>=44,'Panel control has a usable touch target');
      if(width>800)assert(toggleBox.x>=panelBox.x&&toggleBox.x<panelBox.x+80,'The open control stays inside the panel');
      await toggle.focus();await page.keyboard.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await page.locator('#designer-inspector').isHidden());
      assert(await toggle.evaluate(n=>n===document.activeElement),'Collapse preserves keyboard focus');
      await validate();await shot('collapsed-panel');
      await page.keyboard.press('Space');
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert(await toggle.evaluate(n=>n===document.activeElement));
      assert.equal(await category.inputValue(),'features','Reopening retains the reference category');
      assert(await page.locator('[data-reference-group="features"]').isVisible());
      await category.scrollIntoViewIfNeeded();
      if(width<800)assert((await page.locator('#designer-inspector-body').boundingBox()).height<=650,'Mobile references stay within a bounded panel');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');await validate();await page.evaluate(()=>document.documentElement.style.fontSize='');
      assert.deepEqual((await stored()).answers,beforeHelp,'Reference browsing never inserts or changes data');
      await validate();await shot('references');await page.locator('[data-close-reference]').click();
      assert.equal(await name().inputValue(),'검색');
      await page.locator('.inspector-add').click();state=await stored();const second='custom:'+state.answers.screens[0].customElements[2].id;
      await name().fill('회원 메뉴');await describe().fill('로그인한 사람에게 내 신청과 로그아웃 버튼을 보여 줘요.');
      assert.equal((await stored()).answers.screens[0].placements[second].parent,top);
      await page.locator('[data-designer-move="-1"]').click();assert.equal((await stored()).answers.screens[0].layoutOrder.indexOf(second)<(await stored()).answers.screens[0].layoutOrder.indexOf(first),true);
      await page.locator('[data-designer-move="1"]').click();
      const resize=page.locator(`[data-resize-element="${second}"]`);await resize.focus();await resize.press('ArrowLeft');await resize.press('ArrowDown');
      assert.equal((await stored()).answers.screens[0].placements[second].width,95);
      assert.equal((await stored()).answers.screens[0].placements[second].height,136);
      await resize.scrollIntoViewIfNeeded();const box=await resize.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
      if(width>800){await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-65,y+64,{steps:8});await page.mouse.up();}
      else{const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-25,y:y+64}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      const resized=(await stored()).answers.screens[0].placements[second];assert(resized.width<95);assert(resized.height>136);
      if(width<800){const beforeCancel=(await stored()).answers;await resize.scrollIntoViewIfNeeded();const b=await resize.boundingBox(),cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+12,y:b.y+12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x-20,y:b.y+42}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();assert.deepEqual((await stored()).answers,beforeCancel);}
      assert.equal(await block(second).evaluate(n=>parseInt(n.style.getPropertyValue('--block-height'))),resized.height);
      if(width>800){
        const beforeCancel=(await stored()).answers;await resize.scrollIntoViewIfNeeded();const b=await resize.boundingBox();await page.mouse.move(b.x+10,b.y+10);await page.mouse.down();await page.mouse.move(b.x-25,b.y+30);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual((await stored()).answers,beforeCancel);
        const source=page.locator('[data-canvas-element="'+second+'"]'), destination=page.locator('[data-drop-region="bottom"] > .canvas-add');
        await source.evaluate(n=>window.scrollTo(0,window.scrollY+n.getBoundingClientRect().top-160));
        const from=await source.boundingBox(), to=await destination.boundingBox();
        await page.mouse.move(from.x+12,from.y+12);await page.mouse.down();await page.mouse.move(from.x+20,from.y+20);await page.mouse.move(to.x+20,to.y+10,{steps:12});await page.mouse.move(to.x+22,to.y+12);await page.mouse.up();
        const moved=(await stored()).answers.screens[0].placements[second];assert.equal(moved.region,'bottom');assert.equal(moved.height,resized.height);
      }
      await choose(common,top);acceptDialog=false;await page.locator('[data-designer-remove-element]').click();assert.equal((await stored()).answers.screens[0].customElements.length,3);acceptDialog=true;
      await page.locator('[data-designer-remove-element]').click();state=await stored();assert.equal(state.answers.screens[0].customElements.length,2);assert(!state.answers.screens[0].placements[first].parent);assert.equal(state.answers.screens[0].placements[first].region,'top');
      await page.locator('[data-add="screens"]').click();state=await stored();const own=state.answers.screens[1].id;
      await edit(1,'name').fill('신청 화면');await edit(1,'purpose').fill('원하는 수업을 찾아 신청');
      await page.locator('.role-picker > summary').click();await page.locator('[data-role-option] input').first().check();
      await page.locator(`[data-add-element][data-target="parent:${first}"]`).click();await name().fill('빠른 찾기');await describe().fill('이 화면에서만 인기 수업을 먼저 보여 주세요.');
      state=await stored();const local='custom:'+state.answers.screens[1].customElements[0].id;assert.equal(state.answers.screens[1].placements[local].parent,first);
      const beforeCollapse=await page.locator('.designer-stage').boundingBox();await page.locator('[data-toggle-inspector]').click();assert(await page.locator('#designer-inspector').isHidden());
      if(width>800)assert((await page.locator('.designer-stage').boundingBox()).width>beforeCollapse.width);
      await page.locator('[data-toggle-inspector]').click();await validate();await page.locator('#screen-designer').scrollIntoViewIfNeeded();await shot('natural-editor');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');await validate();await page.evaluate(()=>document.documentElement.style.fontSize='');
      const before=await stored();await page.reload();await go(4);assert.deepEqual((await stored()).answers,before.answers);
      await go(5);await page.locator('#next-button').click();
      const report=await page.locator('.report-document').innerText();for(const text of ['검색어를 입력하고','오류가 나도 검색어','빠른 찾기','용도·기능·동작','기획용'])assert(report.includes(text),text);
      assert.equal(await page.locator('.report-document img,.report-document script').count(),0);
      const reportJump=page.locator('a[data-report-jump]').first();assert(await reportJump.isVisible(),'Report questions and answers link back to the form');
      const jumpTarget=await reportJump.getAttribute('data-report-jump');await reportJump.click();assert(await page.locator('#form-view').isVisible());assert(await page.locator('#field-'+jumpTarget).isVisible(),'Report jump lands on its question');
      await go(5);await page.locator('#next-button').click();
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopiedPrompt=text;}}}));
      await page.locator('#copy-prompt').click();const copied=await page.evaluate(()=>window.testCopiedPrompt);
      const download=page.waitForEvent('download');await page.locator('#download-report').click();const markdown=fs.readFileSync(await (await download).path(),'utf8');assert(copied.endsWith(markdown));assert(copied.includes('별도 기능 번호나 필드 목록이 없다는 이유로 누락하지 마세요'));
      const nav=page.locator('#export-answers');if(!await nav.isVisible())await page.locator('#toggle-navigation').click();
      const backupDownload=page.waitForEvent('download');await nav.click();const backup=JSON.parse(fs.readFileSync(await (await backupDownload).path(),'utf8'));assert.deepEqual(backup.answers,before.answers);
      await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});assert.deepEqual((await stored()).answers,before.answers);
      // Previously structured fields/actions stay available in every export after the UI change.
      await page.evaluate(answers=>{const p=BriefProjects.createProject({answers});localStorage.setItem(BriefProjects.KEY,JSON.stringify({version:1,activeId:p.id,projects:[p]}));},legacy);
      await page.reload();await go(4);await choose('home','form');
      assert.equal(await page.locator('#field-features,.designer-related').count(),0,'Existing projects also use the unified editor');
      const previous=(await stored()).answers.screens[1].elementContents.form;
      await name().fill('수업 신청서');await page.locator('[data-field="elementNotes"][data-element="form"]').fill('수업과 연락처를 받아요. 오류가 생기면 입력값을 유지해요.');
      const after=(await stored()).answers.screens[1].elementContents.form;assert.deepEqual(after,{...previous,name:'수업 신청서'});
      const legacyBeforeExport=(await stored()).answers;
      await go(5);await page.locator('#next-button').click();
      const entry=page.locator('.report-entry').filter({has:page.locator(':scope > h6').filter({hasText:'신청 화면 [S01]'})});
      const form=entry.locator('.report-element').filter({has:page.locator(':scope > h6').filter({hasText:'[S01-E03]'})});
      assert((await form.innerText()).includes('수업 신청서'));assert.equal(await form.locator('.report-input').count(),3);assert.equal(await form.locator('.report-action').count(),3);
      assert((await form.innerText()).includes('기초\n심화'));assert((await form.innerText()).includes('중복이면 기존 신청 안내'));assert.equal(await page.locator('.report-document img,.report-document script').count(),0);
      const legacyReport=await page.locator('.report-document').innerText();
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopiedPrompt=text;}}}));
      await page.locator('#copy-prompt').click();const legacyPrompt=await page.evaluate(()=>window.testCopiedPrompt);
      const legacyDownload=page.waitForEvent('download');await page.locator('#download-report').click();const legacyMarkdown=fs.readFileSync(await (await legacyDownload).path(),'utf8');
      assert(legacyPrompt.endsWith(legacyMarkdown));
      for(const output of [legacyReport,legacyPrompt,legacyMarkdown]){
        for(const text of ['연결할 기능 확인 필요','이름 미정','deadbeef-','empty-feature-card'])assert(!output.includes(text),text);
        for(const text of ['작성한 기록을 그대로 보여 줘요.','원본을 유지해요.','신청 결과를 확인하고 돌아와요.'])assert(output.includes(text),text);
      }
      assert.deepEqual((await stored()).answers,legacyBeforeExport,'Filtering obsolete links is display-only');
      await page.evaluate(()=>document.documentElement.style.fontSize='200%');await validate();
      assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.cspErrors),[]);
      console.log(`Natural-language designer browser checks passed: ${width}px`);
    }catch(error){if(process.env.PLANNING_SCREENSHOTS){fs.mkdirSync(process.env.PLANNING_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PLANNING_SCREENSHOTS,`failure-${width}.png`),fullPage:true});}throw error;}
    finally{await context.close();}
  }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
