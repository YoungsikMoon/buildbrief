// Connected planning data: migration, nested records, scoped exports and import boundaries.
const assert = require('node:assert/strict');
const Q = require('../dist/questions.js');
const A = require('../dist/answers.js');
const P = require('../dist/projects.js');
const R = require('../dist/report.js');
const V = require('../dist/views.js');
const clone = value => JSON.parse(JSON.stringify(value));
const answers = A.normalizeAnswers({
  features: [{id:'book', category:'booking', name:'예약 신청', actor:'회원', outcome:'신청 결과 보기', permission:'자신의 예약만 변경', recommendPermission:true, reason:'본인 기록 보호'}],
  screens: [{id:'apply',name:'신청 화면',purpose:'예약하기',featureIds:['book'],elements:['form','table','button'], reason:'짧게 신청',
    elementNotes:{form:'날짜와 연락처를 받고 싶다',table:'내 예약만 표시'},
    elementContents:{
      form:{recommend:true,reason:'연락처는 선택',featureIds:['book'],items:[{id:'field1',name:'날짜',type:'날짜',required:'필수',notes:'오늘 이후'},{id:'field2',name:'수업',type:'하나 선택',required:'선택',options:'기초\n심화'}]},
      table:{recommend:true,items:[{id:'column1',name:'예약 날짜',notes:'날짜순'}]},
      button:{recommend:true,featureIds:['book'],reason:'완료 행동'}
    }},
    {id:'history',name:'내 예약',featureIds:['book'],elements:['table'],elementContents:{table:{items:[{id:'column2',name:'다른 화면의 열',notes:'별도 내용'}]}}}],
  main_flow:[{id:'flow1',screenId:'apply',featureId:'book',note:'신청하고 결과 확인'}]
});
const project = P.createProject({answers,drafts:answers,notes:{screens:'전체 화면 이유'},step:4});
for (const backup of [{format:'buildbrief-idea',version:1,...project},{format:'buildbrief-ideas',version:1,activeId:project.id,projects:[project]}]) {
  const restored = P.importBackup(clone(backup)).projects[0];
  assert.deepEqual(restored.answers, answers);
  assert.deepEqual(restored.drafts, answers);
  assert.equal(restored.step,4);
}
// Old numeric positions are translated once; new positions do not drift on reload.
for (const [oldStep, newStep] of [[0,0],[1,1],[2,2],[3,4],[4,4],[5,2],[6,3],[7,4],[8,5]]) {
  const old = {...clone(project),step:oldStep}; delete old.navigationVersion;
  const restored = P.normalizeWorkspace({version:1,activeId:old.id,projects:[old]}).projects[0];
  assert.equal(restored.step,newStep);
  assert.equal(restored.navigationVersion,3);
  assert.deepEqual(restored.answers,answers);
  assert.equal(P.importBackup({format:'buildbrief-idea',version:1,...restored}).projects[0].step,newStep);
}
const old = A.normalizeAnswers({screens:[{id:'old',name:'기존 화면',elements:['form'],elementOptions:{form:['text']},elementNotes:{form:'기존 메모'}}],features:[{id:'f',category:'custom'}],main_flow:[{id:'old-flow',featureId:'f'}]});
assert.deepEqual(old.screens[0].elementContents,{});
assert.equal(old.main_flow[0].screenId,'');
assert.equal(old.features[0].recommendPermission,false);
for (const prompt of [false,true]) {
  const text = R.report(answers,prompt);
  assert(text.includes('**입력 항목 1**\n> 날짜'));
  assert(text.includes('**필수 여부**\n> 필수'));
  assert(text.includes('기초\n> 심화'));
  assert(text.includes('**표의 열 1**\n> 예약 날짜'));
  assert(text.includes('**이때 사용하는 화면**\n> 신청 화면 \\[S01\\]'));
  assert(text.includes('본인 기록 보호'));
  assert(text.includes('기능별 권한 추천 — 예약 신청 \\[F01\\]'));
  assert(text.includes('요소별 추천 — 신청 화면 \\[S01\\] / 입력 양식'));
  assert(!text.includes('요소별 추천 — 내 예약'));
  const first = text.split('##### 내 예약')[0];
  assert(!first.includes('다른 화면의 열'));
  assert(text.includes('연결한 기능'));
}
const hidden = clone(answers); hidden.screens[0].elements = [];
assert(!R.report(hidden).includes('입력 항목 1'));
assert(!R.report(hidden).includes('요소별 추천 — 신청 화면'));
assert.deepEqual(P.createProject({answers:hidden}).answers.screens[0].elementContents,answers.screens[0].elementContents);
const requestOnly = A.normalizeAnswers({screens:[{id:'request',elementContents:{form:{recommend:true}}}],features:[{id:'request-f',category:'custom',recommendPermission:true}]});
assert.equal(A.progress(requestOnly).answered,0);
assert(R.report(requestOnly).includes('기능별 권한 추천'));
const dangling = clone(answers); dangling.features=[]; dangling.main_flow[0].screenId='deleted';
assert(R.report(dangling).includes('연결할 화면 확인 필요'));
assert(!R.report(dangling).includes('연결할 기능 확인 필요'));
const different = clone(answers); different.screens[0].featureIds=[];
assert(R.report(different).includes('을 사용할 수 있는지 확인'));
const unsafe = '<img src=x onerror=alert(1)>\n### 다른 질문';
const attack = clone(answers); attack.screens[0].elementContents.form.items[0].name=unsafe;
attack.features[0].permission=unsafe; attack.screens[0].reason=unsafe;
const html = V.question(A.allQuestions.find(q=>q.id==='screens'),attack,{},[],{screenId:'apply',element:'form',panel:'settings'});
assert(!html.includes('<img src=x'));
assert(!R.report(attack,true).includes('<img src=x'));
assert(!V.report(attack).includes('<img src=x'));
assert(html.includes('요소 이름') && html.includes('어떤 용도로 쓰나요?'));
assert(!html.includes('data-designer-placement') && !html.includes('data-designer-panel'));
const library=V.question(A.allQuestions.find(q=>q.id==='screens'),attack,{},[],{screenId:'history',element:'table',referenceOpen:true});
assert(library.includes('data-reference-category') && !library.includes('예시와 설명 보기'));
assert.equal((library.match(/data-element-help=/g)||[]).length,Q.uiElements.length);
assert.equal((library.match(/data-feature-help=/g)||[]).length,Q.featureTypes.filter(f=>f.id!=='custom').length);
assert(!library.includes('data-insert-element'));
for (const contents of [null,[],{form:null},{nope:{}},JSON.parse('{"__proto__":{}}'),{form:{recommend:'yes'}},{form:{featureIds:['bad id']}},{form:{items:[{id:'a',type:'SQL'}]}},{form:{items:[{id:'a',required:true}]}},{form:{items:[{id:'a'},{id:'a'}]}},{table:{items:[{id:'a',notes:'x'.repeat(A.MAX_TEXT+1)}]}},{button:{items:[{id:'a'}]}},{table:{items:Array.from({length:A.MAX_ROWS+1},(_,i)=>({id:'i'+i}))}}]) {
  const input = {screens:[{id:'s',elementContents:contents}]}; const before=clone(input);
  assert.throws(()=>A.normalizeAnswers(input)); assert.deepEqual(input,before);
}
assert.throws(()=>A.normalizeAnswers({features:[{id:'f',recommendPermission:'yes'}]}));
assert.throws(()=>A.normalizeAnswers({main_flow:[{id:'flow',screenId:'<script>'}]}));
// The previous eight-stage release also migrates once, including its two removed tabs.
for (const [oldStep,newStep] of [0,1,2,3,4,4,2,5].entries()) {
  const old = {...clone(project),navigationVersion:2,step:oldStep};
  const result = P.normalizeWorkspace({version:1,activeId:old.id,projects:[old]}).projects[0];
  assert.equal(result.step,newStep); assert.equal(result.navigationVersion,3);
  assert.equal(P.normalizeWorkspace({version:1,activeId:result.id,projects:[result]}).projects[0].step,newStep);
}
assert.equal(new Set([...A.allQuestions,...Q.retiredQuestions].map(q=>q.id)).size,A.allQuestions.length+Q.retiredQuestions.length);
const login = A.allQuestions.find(q=>q.id==='login_need');
assert.deepEqual(A.choiceOptions(login),['로그인 없이 사용','로그인 필요']);
for (const legacy of login.legacyOptions) {
  const a = A.normalizeAnswers({login_need:legacy,login_methods:['카카오','네이버','Google'],login_features:['book']});
  assert.equal(a.login_need,'로그인 필요'); assert.equal(a.login_scope_history,legacy);
  assert.deepEqual(A.normalizeAnswers(a),a);
  assert(A.activeQuestions(a).some(q=>q.id==='login_methods'));
  a.login_need='로그인 없이 사용';
  assert(!A.activeQuestions(a).some(q=>q.id==='login_methods'));
  assert.deepEqual(A.normalizeAnswers(a).login_methods,['카카오','네이버','Google']);
}
assert(!A.allQuestions.some(q=>['main_flow','signup_fields','password_recovery','login_features'].includes(q.id)));
const local = A.normalizeAnswers({
  login_need:'로그인 필요',login_methods:['카카오','Google'],
  roles:[{id:'member',role:'로그인 사용자'}],
  features:[{id:'save',category:'custom',name:'예약 저장',outcome:'예약 번호 표시'}],
  screens:[{id:'booking',name:'예약',roleIds:['member'],elements:['button','sidebar'],
    flow:[{id:'load',event:'처음 들어오면',nextScreenId:'@stay',result:'내 예약 안내'}],
    elementContents:{button:{flow:[{id:'submit',event:'신청 버튼 누르기',featureId:'save',nextScreenId:'done',result:unsafe}],recommendFlow:true},sidebar:{flow:[{id:'back',event:'뒤로 가기',nextScreenId:'@back'}]}},
    customElements:[{id:'seat',name:'좌석 배치도',purpose:'좌석 선택',recommendFlow:true,flow:[{id:'pick',event:'좌석 선택',nextScreenId:'@stay'}]}]},
    {id:'done',name:'예약 완료'}]
});
for (const prompt of [false,true]) {
  const output = R.report(local,prompt);
  assert(output.includes('**사용할 역할**\n> 로그인 사용자'));
  assert(output.includes('**다음 화면**\n> 예약 완료 \\[S02\\]'));
  assert(output.includes('현재 화면 유지') && output.includes('이전 화면으로 돌아가기'));
  assert(output.includes('동작·이동 추천 — 예약 \\[S01\\] / 일반 버튼'));
  assert(output.includes('동작·이동 추천 — 예약 \\[S01\\] / 좌석 배치도'));
  assert(output.split('###### 일반 버튼')[1].split('######')[0].includes('신청 버튼 누르기'));
  assert(!output.includes('<img src=x'));
}
assert(!V.question(A.allQuestions.find(q=>q.id==='screens'),local).includes('<img src=x'));
assert(!V.report(local).includes('<img src=x'));
const renamed = clone(local); renamed.roles[0].role='예약 회원';
assert(R.report(renamed).includes('**사용할 역할**\n> 예약 회원'));
assert.deepEqual(renamed.screens[0].roleIds,['member']);
renamed.roles=[]; renamed.screens.pop(); renamed.features=[];
assert(R.report(renamed).includes('연결할 역할 확인 필요'));
assert(R.report(renamed).includes('연결할 화면 확인 필요'));
assert(!R.report(renamed).includes('연결할 기능 확인 필요'));
assert(V.question(A.allQuestions.find(q=>q.id==='screens'),renamed,{},[],{panel:'settings'}).includes('삭제된 역할'));
const hiddenFlow = clone(local); hiddenFlow.screens[0].elements=[];
assert(!R.report(hiddenFlow).includes('신청 버튼 누르기'));
assert(!R.report(hiddenFlow).includes('/ 일반 버튼'));
assert(R.report(hiddenFlow).includes('좌석 선택'));
const onlyRequest=A.normalizeAnswers({screens:[{id:'s',recommendFlow:true}]});
assert.equal(A.progress(onlyRequest).answered,0);
assert(R.report(onlyRequest).includes('동작·이동 추천'));
const p = P.createProject({answers:local,drafts:local,notes:{roles:'이용 범위 구분'}});
for (const backup of [{format:'buildbrief-idea',version:1,...p},{format:'buildbrief-ideas',version:1,activeId:p.id,projects:[p]}]) {
  const restored=P.importBackup(clone(backup)).projects[0];
  assert.deepEqual(restored.answers,local); assert.deepEqual(restored.drafts,local);
  assert.deepEqual(restored.notes,p.notes);
}
for (const flow of [null,{},[{id:'x',nextScreenId:'javascript:alert(1)'}],[{id:'x',featureId:'bad id'}],[{id:'x',result:[]}],[{id:'x'},{id:'x'}],[{id:'x',event:'x'.repeat(A.MAX_TEXT+1)}],Array.from({length:A.MAX_ROWS+1},(_,i)=>({id:'a'+i}))]) {
  for (const screen of [{id:'s',flow},{id:'s',elementContents:{sidebar:{flow}}},{id:'s',customElements:[{id:'el',flow}]}]) {
    const input={screens:[screen]},before=clone(input);
    assert.throws(()=>A.normalizeAnswers(input)); assert.deepEqual(input,before);
  }
}
for (const screen of [{id:'s',recommendFlow:'yes'},{id:'s',roleIds:['bad id']},{id:'s',roleIds:['r','r']},{id:'s',elementContents:{sidebar:{recommendFlow:1}}}]) assert.throws(()=>A.normalizeAnswers({screens:[screen]}));

// Omitted details must not turn into repetitive placeholder answers or lose their parent record.
const partial=A.normalizeAnswers({screens:[{id:'s',name:'내 기록',purpose:'기록 확인',elements:['form','table'],flow:[{id:'a',result:'안내 표시'}],elementContents:{form:{items:[{id:'field',type:'짧은 글'},{id:'empty'}]},table:{}}}]});
for(const prompt of [false,true]) {
  const text=R.report(partial,prompt),body=text.split('## 확인해 볼 질문')[0];
  assert(!body.includes('> 아직 미정'));
  assert(!body.includes('역할 미정') && !body.includes('용도 미정'));
  assert(!body.includes('**다음 화면**') && !body.includes('**보여 줄 정보**'));
  assert(body.includes('**동작 1**') && body.includes('안내 표시'));
  assert(body.includes('**입력 항목 1**') && !body.includes('**입력 항목 2**'));
  assert(text.includes('사용할 역할 확인') && text.includes('다음 화면 또는 현재 화면 유지'));
}
const preserved=P.createProject({answers:{login_methods:[A.UNKNOWN],features:[{id:'f',priority:A.UNKNOWN}]}});
assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...preserved}).projects[0].answers,preserved.answers);

assert.equal(V.roleSelectionLabel([],[]),'역할 선택');
assert.equal(V.roleSelectionLabel(['missing'],[]),'삭제된 역할');
assert.equal(V.roleSelectionLabel(['empty'],[{id:'empty',role:''}]),'이름 없는 역할');
assert.equal(V.roleSelectionLabel(['a','b','c'],[{id:'a',role:'회원'},{id:'b',role:'관리자'},{id:'c',role:'작성자'}]),'회원 · 관리자 외 1개');
for(const q of A.allQuestions.filter(q=>q.allowRecommend)) {
  const html=V.question(q,local,{},[q.id]);
  assert(!html.includes('recommendation-hint-'));
  assert(!html.includes('초안에 요청을 담아요'));
  assert(!html.includes('외부 AI에 전달하세요'));
}
const unsafeRole=clone(local);unsafeRole.roles[0].role=unsafe;
assert(!V.question(A.allQuestions.find(q=>q.id==='screens'),unsafeRole).includes('<img src=x'));

// Element → feature → action preserves old links and scopes each exception request.
const elementFirst=A.normalizeAnswers({features:[{id:'f',category:'custom',name:'저장'}],screens:[{id:'s',name:'입력 화면',elements:['form'],featureIds:['f'],elementContents:{form:{featureIds:['f'],flow:[{id:'a',featureId:'f',event:'제출',result:'저장 완료',exceptions:unsafe,recommendExceptions:true}]}},customElements:[{id:'map',name:'좌석 지도',featureIds:['f'],flow:[{id:'b',featureId:'f',event:'선택',result:'선택 완료'}]}]}]});
assert.deepEqual(A.linkedFeatureIds(elementFirst.screens[0].elementContents.form),['f']);
const elementProject=P.createProject({answers:elementFirst,drafts:elementFirst});
for(const backup of [{format:'buildbrief-idea',version:1,...elementProject},{format:'buildbrief-ideas',version:1,activeId:elementProject.id,projects:[elementProject]}]) assert.deepEqual(P.importBackup(backup).projects[0].answers,elementFirst);
for(const prompt of [true,false]) {
  const text=R.report(elementFirst,prompt);
  assert(text.includes('오류·예외 추천 — 입력 화면 \\[S01\\] / 입력 양식 / 저장 \\[F01\\] / 동작 1'));
  assert(!text.includes('오류·예외 추천 — 입력 화면 \\[S01\\] / 좌석 지도'));
  assert(!text.includes('<img src=x'));
  assert(!text.includes('이름·결과 중 미정인 내용을 확인'));
}
assert(!V.report(elementFirst).includes('<img src=x'));
assert(!V.question(A.allQuestions.find(q=>q.id==='screens'),elementFirst).includes('<img src=x'));
const hiddenExceptions=clone(elementFirst);hiddenExceptions.screens[0].elements=[];
assert(!R.report(hiddenExceptions).includes('오류·예외 추천 —'));
assert.deepEqual(P.createProject({answers:hiddenExceptions}).answers.screens[0].elementContents,elementFirst.screens[0].elementContents);
const exceptionOnly=A.normalizeAnswers({screens:[{id:'s',flow:[{id:'a',recommendExceptions:true}]}]});
assert.equal(A.progress(exceptionOnly).answered,0);assert(R.report(exceptionOnly).includes('오류·예외 추천 —'));
for(const bad of [{recommendExceptions:'yes'},{exceptions:[]},{exceptions:'x'.repeat(A.MAX_TEXT+1)}]) {
  for(const screen of [{id:'s',flow:[{id:'a',...bad}]},{id:'s',elementContents:{button:{flow:[{id:'a',...bad}]}}},{id:'s',customElements:[{id:'el',flow:[{id:'a',...bad}]}]}]) assert.throws(()=>A.normalizeAnswers({screens:[screen]}));
}
assert.throws(()=>A.normalizeAnswers({screens:[{id:'s',customElements:[{id:'el',featureIds:['bad id']}]}]}));
// Shared layout and visual placement stay separate from each screen's roles and reason.
const design=A.normalizeAnswers({screens:[
  {id:'common',isCommon:true,elements:['appbar','sidebar'],reason:'공통 메뉴의 이유',placements:{appbar:{region:'top',width:'full'}}},
  {id:'home',name:'첫 화면',purpose:'신청',reason:'첫 화면만의 이유',elements:['form','table'],layoutOrder:['table','form'],placements:{table:{region:'main',width:'half'}},customElements:[{id:'custom',name:unsafe}]},
  {id:'independent',name:'독립 화면',useCommonLayout:false,reason:'독립 화면만의 이유'}
]});
const D=require('../dist/designer.js'),screenQ=A.allQuestions.find(q=>q.id==='screens');
assert.equal(design.screens[1].useCommonLayout,true);
assert.deepEqual(A.elementKeys(design.screens[1]),['table','form','custom:custom']);
assert.deepEqual(A.elementPlacement(design.screens[0],'sidebar'),{region:'left',width:'full'});
assert.deepEqual(A.progress(A.normalizeAnswers({screens:[{id:'c',isCommon:true}]})),A.progress({}));
assert(!R.report(A.normalizeAnswers({screens:[{id:'c',isCommon:true}]})).includes('##### 기본 공통 화면'));
const recommendation=A.normalizeAnswers({screens:[{id:'c',isCommon:true,recommendLayout:true}]});
assert(R.report(recommendation).includes('화면 구성 추천 — 기본 공통 화면'));
assert(R.report(recommendation).includes('**이 화면의 구성 추천 요청 · 미확정**'));
for(const prompt of [false,true]) {
  const text=R.report(design,prompt,{screens:'예전 전체 메모'});
  assert(text.includes('기본 공통 화면 [공통]') && text.includes('첫 화면 [S01]') && text.includes('독립 화면 [S02]'));
  assert(text.includes('공통 레이아웃 적용') && text.includes('사용하지 않음'));
  assert(text.includes('예전 전체 메모') && text.includes('요소 배치 구조'));
  assert(!text.includes('기본 공통 화면 \\[공통\\]: 사용할 역할 확인'));
  const common=text.split('##### 기본 공통 화면')[1].split('##### 첫 화면')[0];
  assert(common.includes('공통 메뉴의 이유') && !common.includes('첫 화면만의 이유'));
}
const homeHtml=V.question(screenQ,design,{screens:'예전 전체 메모'},[],{screenId:'home',element:'custom:custom',panel:'settings'});
assert(!homeHtml.includes('<img src=x'));
assert(homeHtml.includes('이 화면의 선택 이유') && !homeHtml.includes('data-note="screens"'));
assert(homeHtml.includes(' inherited') && !V.question(screenQ,design,{},[],{screenId:'independent'}).includes(' inherited'));
assert(!homeHtml.includes('공통 메뉴의 이유') && homeHtml.includes('첫 화면만의 이유'));
assert.equal(D.selection(design,{screenId:'deleted'}).screen.id,'common');
const nameOnlyCanvas=D.render({screens:[{id:'s',elements:['form'],elementNotes:{form:'FORM_DESCRIPTION'},customElements:[{id:'c',name:'요소 이름',purpose:'CUSTOM_DESCRIPTION'}]}]},{screenId:'s'},'','');
assert(nameOnlyCanvas.includes('요소 이름')&&!nameOnlyCanvas.includes('FORM_DESCRIPTION')&&!nameOnlyCanvas.includes('CUSTOM_DESCRIPTION'),'Canvas shows element names without descriptions');
const designProject=P.createProject({answers:design,drafts:design,notes:{screens:'예전 전체 메모'}});
for(const backup of [{format:'buildbrief-idea',version:1,...designProject},{format:'buildbrief-ideas',version:1,activeId:designProject.id,projects:[designProject]}]) {
  const restored=P.importBackup(clone(backup)).projects[0];assert.deepEqual(restored.answers,design);assert.deepEqual(restored.drafts,design);assert.deepEqual(restored.notes,designProject.notes);
}
for(const invalid of [
  {isCommon:'yes'},{useCommonLayout:0},{layoutOrder:['form','form']},{layoutOrder:['unknown']},{layoutOrder:['custom:missing']},
  {placements:null},{placements:[]},{placements:{form:{region:'url(x)',width:'full'}}},{placements:{form:{region:'main',width:'auto'}}},
  {placements:{form:null}},{placements:JSON.parse('{"__proto__":{"region":"main","width":"full"}}')}
]) {const input={screens:[{id:'s',...invalid}]},before=clone(input);assert.throws(()=>A.normalizeAnswers(input));assert.deepEqual(input,before);}
assert.throws(()=>A.normalizeAnswers({screens:[{id:'a',isCommon:true},{id:'b',isCommon:true}]}));
// Nested local/shared elements survive exports and backups; cycles never enter saved plans.
const nestedDesign=A.normalizeAnswers({screens:[
  {id:'c',isCommon:true,elements:['appbar'],customElements:[{id:'wrap',name:'도구 모음'}],placements:{'custom:wrap':{region:'top',width:'full',parent:'appbar'}}},
  {id:'s',elements:['button','form'],placements:{button:{region:'top',width:'half',parent:'custom:wrap'},form:{region:'main',width:'full'}}}
]});
const tree=A.layoutItems(nestedDesign.screens[1],nestedDesign.screens[0]);
assert.equal(tree.find(item=>item.key==='button').parent,'custom:wrap');
assert(!A.canNest(tree,'appbar','custom:wrap'));
assert(!A.canNest(tree,'form','form'));
assert(!A.canNest(tree,'form','button'));
assert(A.canNest(tree,'form','custom:wrap'));
for(const prompt of [false,true])assert(R.report(nestedDesign,prompt).includes('상단 &gt; 상단 바 &gt; 도구 모음 &gt; 일반 버튼'));
const nestedProject=P.createProject({answers:nestedDesign,drafts:nestedDesign});
assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...clone(nestedProject)}).projects[0].answers,nestedDesign);
for(const parent of ['button','unknown','custom:missing','__proto__',unsafe,123]) {
  const bad=clone(nestedDesign);bad.screens[1].placements.button.parent=parent;assert.throws(()=>A.normalizeAnswers(bad));
}
const cyclic=clone(nestedDesign);cyclic.screens[0].placements.appbar={region:'top',width:'full',parent:'custom:wrap'};
assert.throws(()=>A.normalizeAnswers(cyclic));
// A local override must not turn a valid shared tree into a cycle.
const inheritedCycle=clone(nestedDesign);inheritedCycle.screens[1].elements.push('appbar');
inheritedCycle.screens[1].placements.appbar={region:'top',width:'full',parent:'custom:wrap'};
assert.throws(()=>A.normalizeAnswers(inheritedCycle));
const off=clone(nestedDesign);off.screens[1].useCommonLayout=false;
assert.equal(A.layoutItems(off.screens[1],off.screens[0]).find(item=>item.key==='button').parent,'');
assert(R.report(off).includes('포함할 요소가 현재 화면에 없어 위치 확인 필요'));
// The same readable document reaches the preview, Markdown file and AI prompt.
const handoff=A.normalizeAnswers({
  "project_name": "화면 전달 검증 예시",
  "roles": [{"id":"member","role":"회원"},{"id":"manager","role":"담당자"}],
  "features": [
    {"id":"book","category":"booking","name":"신청","actor":"회원","outcome":"선택한 수업 예약","permission":"본인의 신청만 확인","priority":"첫 버전에 필요","notes":"한 사람당 하나만 신청","reason":"중복을 방지","recommendPermission":true},
    {"id":"cancel","category":"custom","name":"취소","outcome":"신청 철회"},
    {"id":"signout","category":"custom","name":"로그아웃","outcome":"로그인 종료"}
  ],
  "screens": [
    {
      "id":"common","isCommon":true,"purpose":"공통 이동 구조","reason":"이동 방식 통일",
      "elements":["appbar","sidebar","form"],
      "elementNotes":{"appbar":"서비스 이름과 내 메뉴","form":"공통 폼만의 용도"},
      "customElements":[{"id":"nav","name":"사용자 메뉴","purpose":"계정 메뉴 묶음"}],
      "placements":{"custom:nav":{"region":"top","width":"half","parent":"appbar"}},
      "elementContents":{
        "appbar":{"featureIds":["signout"],"recommendFlow":true,"flow":[{"id":"shared-action","featureId":"signout","event":"종료 누르기","result":"로그인 해제","nextScreenId":"@stay","exceptions":"실패하면 현재 로그인 유지","recommendExceptions":true}]},
        "form":{"items":[{"id":"shared-field","name":"공통 전용 입력","type":"짧은 글"}]}
      }
    },
    {
      "id":"home","name":"신청 화면","purpose":"수업을 골라 신청","roleIds":["member"],"featureIds":["book","cancel"],
      "reason":"입력 부담을 줄이기","recommendLayout":true,
      "content":"이전에 적은 추가 정보","empty":"접수할 수업이 없으면 일정 안내","error":"실패 시 입력 보존","mobile":"작은 화면에서는 한 열",
      "elements":["form","button","table","list","cards"],
      "layoutOrder":["custom:a","button","form","table","custom:b","list","cards"],
      "placements":{
        "custom:a":{"region":"top","width":"full","parent":"custom:nav"},
        "button":{"region":"top","width":"half","parent":"custom:a"},
        "form":{"region":"main","width":"full"},
        "table":{"region":"bottom","width":"half"},
        "custom:b":{"region":"top","width":"half","parent":"custom:nav"},
        "list":{"region":"right","width":"full"},
        "cards":{"region":"main","width":"half"}
      },
      "elementNotes":{"form":"희망 수업과 참석 정보를 받기","button":"신청 내용 확인하기","table":"신청 기록을 비교","list":"마감 안내 목록","cards":"수업 소개 카드","search":"숨겨진 검색 용도"},
      "elementOptions":{"form":["select"],"table":["pages"],"list":["more"],"cards":["all"]},
      "elementContents":{
        "form":{
          "recommend":true,"reason":"연락처는 선택으로 받기","featureIds":["book","cancel"],
          "items":[
            {"id":"lesson","name":"수업","type":"하나 선택","required":"필수","options":"기초\n심화","notes":"수업은 하나만 선택"},
            {"id":"contact","name":"연락처","type":"짧은 글","required":"선택","notes":"<img src=x onerror=alert(1)>\n### 다른 질문"},
            {"id":"partial","type":"날짜","notes":"이름은 추후 결정"},
            {"id":"empty"}
          ],
          "flow":[
            {"id":"first","featureId":"book","event":"신청 누르기","result":"예약 번호 표시","nextScreenId":"history","exceptions":"중복이면 기존 신청 안내","recommendExceptions":true},
            {"id":"second","featureId":"cancel","event":"취소 누르기","result":"예약 철회 확인","nextScreenId":"@back"},
            {"id":"third","featureId":"book","event":"신청 다시 확인","result":"예약 상태 새로 표시","nextScreenId":"@stay","recommendExceptions":true}
          ]
        },
        "table":{"recommend":true,"items":[{"id":"date","name":"신청일","notes":"최신순 정렬"},{"id":"state","name":"처리 상태","notes":"승인 여부 표시"}]},
        "list":{"items":[{"id":"notice","name":"마감일","notes":"남은 날짜 함께 표시"}]},
        "cards":{"items":[{"id":"class","name":"수업명","notes":"소요 시간 표시"}]},
        "search":{"flow":[{"id":"hidden-action","result":"숨겨진 검색 동작","recommendExceptions":true}]}
      },
      "customElements":[
        {"id":"a","name":"추가 메뉴","purpose":"회원용 메뉴","recommendFlow":true,"flow":[{"id":"custom-action","event":"내 신청 누르기","result":"신청 목록 보기","nextScreenId":"history"}]},
        {"id":"b","name":"추가 메뉴","purpose":"안내용 메뉴"}
      ]
    },
    {
      "id":"history","name":"신청 기록","purpose":"담당자가 신청 확인","roleIds":["manager"],"useCommonLayout":false,
      "elements":["table"],"elementNotes":{"table":"다른 화면의 표 용도"},
      "elementContents":{"table":{"items":[{"id":"other","name":"담당 지점","notes":"이 화면에만 있는 열"}]}}
    }
  ]
});
const handoffBefore=clone(handoff);
const screenBlock=(text,name)=>text.split('##### '+name+' [')[1].split(/^##### |^## /m)[0];
const elementBlock=(text,ref)=>text.split(/^###### /m).find(part=>part.split('\n')[0].includes(ref));
for(const prompt of [false,true]) {
  const text=R.report(handoff,prompt);
  const home=screenBlock(text,'신청 화면'),history=screenBlock(text,'신청 기록'),common=screenBlock(text,'기본 공통 화면');
  assert(home.includes('상단 &gt; 상단 바 &gt; 사용자 메뉴 &gt; 추가 메뉴 &gt; 일반 버튼'));
  assert(home.indexOf('└ 1. 추가 메뉴') < home.indexOf('└ 2. 추가 메뉴'));
  const button=elementBlock(home,'[S01-E02]');
  assert(button.includes('추가 메뉴 \\[S01-E01\\]') && button.includes('절반 너비 · 부모 요소 안에서'));
  const inherited=elementBlock(home,'[공통-E01]');
  assert(inherited.includes('설정 원본') && inherited.includes('상단 바 \\[공통-E01\\]'));
  assert(!inherited.includes('종료 누르기'));assert(elementBlock(common,'[공통-E01]').includes('종료 누르기'));
  const form=elementBlock(home,'[S01-E03]');
  assert(form.includes('공통 요소와의 관계') && form.includes('입력 양식 \\[공통-E03\\]'));
  assert(!home.includes('공통 전용 입력'));assert(common.includes('공통 전용 입력'));
  const records=form.split('\n---\n');
  const input=records.find(part=>part.includes('**입력 항목 1**'));
  for(const value of ['S01-E03-P01','> 수업','하나 선택','필수','기초\n> 심화','수업은 하나만 선택'])assert(input.includes(value),value);
  assert(!input.includes('연락처') && !input.includes('중복이면 기존 신청 안내'));
  assert(form.includes('**입력 항목 3**') && !form.includes('**입력 항목 4**'));
  const action=records.find(part=>part.includes('**동작 번호**\n> \\[S01-E03-A01\\]'));
  for(const value of ['신청 누르기','예약 번호 표시','신청 기록 \\[S02\\]','중복이면 기존 신청 안내','오류·예외 추천 요청'])assert(action.includes(value),value);
  assert(!action.includes('예약 철회 확인') && !action.includes('연락처는 선택으로 받기'));
  assert(text.includes('대상 동작 \\[S01-E03-A03\\]') && text.includes('대상 동작 \\[공통-E01-A01\\]'));
  assert(text.includes('대상 요소 \\[S01-E01\\]') && text.includes('대상 요소 \\[S01-E03\\]'));
  assert(elementBlock(home,'[S01-E01]').includes('회원용 메뉴'));
  assert(!elementBlock(home,'[S01-E01]').includes('안내용 메뉴'));
  assert(elementBlock(home,'[S01-E05]').includes('안내용 메뉴'));
  for(const [ref,values] of [['[S01-E04]',['신청일','처리 상태','최신순 정렬','승인 여부 표시','페이지 번호로 이동']],['[S01-E06]',['마감일','남은 날짜 함께 표시','더 보기 버튼']],['[S01-E07]',['수업명','소요 시간 표시','한 번에 모두 보기']]])for(const value of values)assert(elementBlock(home,ref).includes(value),value);
  for(const value of ['수업을 골라 신청','회원','입력 부담을 줄이기','이전에 적은 추가 정보','접수할 수업이 없으면 일정 안내','실패 시 입력 보존','작은 화면에서는 한 열','연락처는 선택으로 받기'])assert(home.includes(value),value);
  for(const value of ['기초','공통 설정 사용','예약 번호 표시','회원용 메뉴','S01-E03'])assert(!history.includes(value),value);
  assert(history.includes('담당 지점') && history.includes('이 화면에만 있는 열'));
  assert(!text.includes('숨겨진 검색') && !text.includes('<img src=x'));
  assert(text.includes('&lt;img src=x onerror=alert(1)&gt;\n> \\#\\#\\# 다른 질문'));
}
assert(R.report(handoff,true).endsWith(R.report(handoff)));
assert.deepEqual(handoff,handoffBefore,'Exports do not rewrite saved screen definitions');
// Natural-language blocks keep their own names, descriptions and bounded planning sizes.
const natural=A.normalizeAnswers({screens:[{id:'natural',name:'자유 구성',elements:['button'],elementContents:{button:{name:'문의하기'}},elementNotes:{button:unsafe},customElements:[{id:'search',name:'찾기',purpose:'검색어를 쓰고 찾기를 누르면 결과 목록을 보여 줘요.\n실패하면 입력한 검색어를 유지해요.'}],placements:{'custom:search':{region:'main',width:65,height:240},button:{region:'overlay',width:'half'}}}]});
assert.equal(A.elementLabel(natural.screens[0],'button'),'문의하기');
assert.deepEqual(A.elementSize(natural.screens[0],'button'),{width:50,height:120});
assert.deepEqual(A.elementSize(natural.screens[0],'custom:search'),{width:65,height:240});
const naturalReport=R.report(natural,true);
for(const value of ['문의하기','실패하면 입력한 검색어를 유지해요.','65%','240px','용도·기능·동작','기존에 선택한 요소 유형'])assert(naturalReport.includes(value),value);
assert(!naturalReport.includes('<img src=x'));
const naturalHtml=V.question(screenQ,natural,{},[],{screenId:'natural',element:'custom:search'});
assert(naturalHtml.includes('data-resize-element="custom:search"') && naturalHtml.includes('data-width="65"'));
assert(naturalHtml.includes('data-open-reference') && !naturalHtml.includes('data-feature-choice'));
const naturalProject=P.createProject({answers:natural});
assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...naturalProject}).projects[0].answers,natural);
// Grid positions share normalization, preview, export and backup paths.
const gridAnswers=A.normalizeAnswers({screens:[{id:'grid',elements:['button','search','form'],placements:{button:{region:'main',width:50,grid:{column:11,row:2}},search:{region:'main',width:50,grid:{column:11,row:2}},form:{region:'main',width:100,grid:{column:20,row:160}}}}]});
const gridBefore=clone(gridAnswers), gridItems=A.layoutItems(gridAnswers.screens[0]);
assert.deepEqual(A.gridLayout(gridItems).get('button'),{column:11,row:2,span:10});
assert.deepEqual(A.gridLayout(gridItems).get('search'),{column:11,row:3,span:10});
assert.deepEqual(A.gridLayout(gridItems).get('form'),{column:1,row:160,span:20});
assert.equal(A.gridLayout(gridItems,'search').get('search').row,2);
assert.equal(A.gridLayout(gridItems,'search').get('button').row,3);
assert(R.report(gridAnswers).includes('2행 · 11열 / 20열'));
assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...P.createProject({answers:gridAnswers})}).projects[0].answers,gridAnswers);
assert.deepEqual(gridAnswers,gridBefore);
for(const grid of [null,[],{}, {column:0,row:1},{column:21,row:1},{column:1.5,row:1},{column:1,row:0},{column:1,row:A.MAX_GRID_ROWS+1},{column:1,row:1.5},{column:'1',row:1},{column:1,row:Infinity}])
  assert.throws(()=>A.normalizeAnswers({screens:[{id:'bad-grid',elements:['button'],placements:{button:{region:'main',width:50,grid}}}]}));
const wrapped=gridItems.map((item)=>({...item,owner:{...item.owner,placements:{...item.owner.placements,[item.key]:{region:'main',width:100,grid:{column:1,row:A.MAX_GRID_ROWS}}}}}));
assert.equal(A.gridLayout(wrapped).get('search').row,1,'Collisions at the row limit use available rows');
assert.equal(A.gridLayout([{...gridItems[0],inherited:true},gridItems[1]],'search').get('button').row,2,'Common positions remain anchored');
assert.equal(A.gridLayout([{...gridItems[0],parent:'form'},gridItems[1]]).get('search').row,2,'Nested grids have separate occupancy');
const crowded=Array.from({length:(A.MAX_ROWS+Q.uiElements.length)*2},(_,i)=>({key:'custom:'+i,region:'main',parent:'',owner:{placements:{['custom:'+i]:{region:'main',width:100,grid:{column:1,row:A.MAX_GRID_ROWS}}}}}));
assert.equal(new Set([...A.gridLayout(crowded).values()].map(p=>p.row)).size,crowded.length,'All common and local elements fit without exhausting grid rows');
const flowing=gridItems.map((item,i)=>({...item,owner:{...item.owner,placements:{[item.key]:{region:'main',width:[65,50,20][i]}}}}));
assert.deepEqual([...A.gridLayout(flowing).values()].map(p=>p.row),[1,2,2],'Legacy automatic layouts preserve reading order instead of filling earlier gaps');
for(const height of [64,80,119,801,1600,10000]) {
  const sized=A.normalizeAnswers({screens:[{id:'s',elements:['button'],placements:{button:{region:'main',width:50,height}}}]});
  const project=P.createProject({answers:sized});
  assert.equal(A.elementSize(sized.screens[0],'button').height,height);
  assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...project}).projects[0].answers,sized);
}
for(const bad of [{width:19},{width:101},{width:'65%'},{width:NaN},{width:50.5},{height:63},{height:0},{height:-1},{height:64.5},{height:'240px'},{height:Infinity},{height:Number.MAX_SAFE_INTEGER+1}]) {
  const raw={screens:[{id:'s',placements:{button:{region:'main',width:50,...bad}}}]},before=clone(raw);
  assert.throws(()=>A.normalizeAnswers(raw));assert.deepEqual(clone(raw),before);
}
assert.throws(()=>A.normalizeAnswers({screens:[{id:'s',elementContents:{button:{name:'x'.repeat(A.MAX_TEXT+1)}}}]}));
// Old deleted links and untouched cards must not become requirements in any export.
const missingIds=['deadbeef-0000-4000-8000-000000000001','deadbeef-0000-4000-8000-000000000002'];
const emptyFeature={id:'empty-feature-card',category:'custom',name:'  ',priority:A.UNKNOWN};
const stale=clone(handoff);
stale.features.unshift(emptyFeature);
stale.login_features=[...missingIds,emptyFeature.id,'book'];
stale.screens[1].featureIds.push(...missingIds,emptyFeature.id);
stale.screens[1].elementContents.form.featureIds.push(...missingIds,emptyFeature.id);
stale.screens[1].elementContents.form.flow.push({id:'unused-old-action',featureId:missingIds[0]});
stale.screens[0].flow.push({id:'old-action-with-text',featureId:missingIds[1],event:'처음 방문하면',result:'작성한 기록을 그대로 보여 줘요.',exceptions:'기록을 읽지 못하면 원본을 유지해요.',recommendExceptions:true});
stale.screens[1].customElements[0].featureIds=[...missingIds,emptyFeature.id];
stale.main_flow=[{id:'old-empty-flow',featureId:missingIds[0]},{id:'old-flow-with-text',featureId:missingIds[1],note:'신청 결과를 확인하고 돌아와요.'}];
const staleAnswers=A.normalizeAnswers(stale),staleBefore=clone(staleAnswers);
for(const output of [R.report(staleAnswers),R.report(staleAnswers,true),V.report(staleAnswers)]) {
  for(const text of [...missingIds,emptyFeature.id,'연결할 기능 확인 필요','이름 미정','[undefined]'])assert(!output.includes(text),text);
  for(const text of ['작성한 기록을 그대로 보여 줘요.','원본을 유지해요.','신청 결과를 확인하고 돌아와요.','로그아웃','선택한 수업 예약','연락처는 선택으로 받기'])assert(output.includes(text),text);
}
assert.deepEqual(staleAnswers,staleBefore);
const staleProject=P.createProject({answers:staleAnswers});
assert.deepEqual(P.importBackup({format:'buildbrief-idea',version:1,...staleProject}).projects[0].answers,staleAnswers);
const onlyStale=A.normalizeAnswers({features:[emptyFeature],screens:[{id:'only',name:'화면',featureIds:[...missingIds,emptyFeature.id],flow:[{id:'unused',featureId:missingIds[0]}]}],main_flow:[{id:'unused-flow',featureId:missingIds[1]}]});
for(const output of [R.report(onlyStale),R.report(onlyStale,true),V.report(onlyStale)])for(const text of ['연결한 기능','실행할 기능','이름 미정','F01','서비스에 필요한 기능은 무엇인가요?','사용자는 어떤 순서로 목적을 달성하나요?','동작 번호'])assert(!output.includes(text),text);
const unnamed=A.normalizeAnswers({features:[{id:'note',category:'custom',notes:'이름 없이 적은 설명은 보존'},{id:'request',category:'custom',recommendPermission:true}]});
for(const output of [R.report(unnamed),R.report(unnamed,true),V.report(unnamed)])for(const text of ['이름 없이 적은 설명은 보존','이전에 작성한 기능','기능별 권한 추천'])assert(output.includes(text),text);
console.log('Connected planning checks passed: migration, visual layouts, roles, scoped actions, safe exports and backup validation.');

module.exports = staleAnswers;
