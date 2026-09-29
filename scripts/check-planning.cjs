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
for (const [oldStep, newStep] of [[0,0],[1,1],[2,2],[3,4],[4,5],[5,6],[6,3],[7,4],[8,7]]) {
  const old = {...clone(project),step:oldStep}; delete old.navigationVersion;
  const restored = P.normalizeWorkspace({version:1,activeId:old.id,projects:[old]}).projects[0];
  assert.equal(restored.step,newStep);
  assert.equal(restored.navigationVersion,2);
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
console.log('Connected planning checks passed: stage migration, shared features, form/table content, scoped recommendations, safe export and backup validation.');
