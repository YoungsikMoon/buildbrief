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
assert(R.report(dangling).includes('연결할 기능 확인 필요'));
const different = clone(answers); different.screens[0].featureIds=[];
assert(R.report(different).includes('을 사용할 수 있는지 확인'));
const unsafe = '<img src=x onerror=alert(1)>\n### 다른 질문';
const attack = clone(answers); attack.screens[0].elementContents.form.items[0].name=unsafe;
attack.features[0].permission=unsafe; attack.screens[0].reason=unsafe;
const html = V.question(A.allQuestions.find(q=>q.id==='screens'),attack);
assert(!html.includes('<img src=x'));
assert(!R.report(attack,true).includes('<img src=x'));
assert(!V.report(attack).includes('<img src=x'));
assert(html.includes('기존 기능 연결') || html.includes('이 화면에 기능 추가'));
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
assert(R.report(renamed).includes('연결할 기능 확인 필요'));
assert(V.question(A.allQuestions.find(q=>q.id==='screens'),renamed).includes('삭제된 역할'));
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

console.log('Connected planning checks passed: two stage migrations, login, stable roles, shared features, nested flow/content, scoped reports and backup validation.');
