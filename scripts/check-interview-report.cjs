const assert = require('node:assert/strict');
const A = require('../dist/answers.js');
const I = require('../dist/interview.js');
const R = require('../dist/report.js');
const V = require('../dist/views.js');
const { parse } = require('./check-planning-json.cjs');
const response = (id, answer, reason = '') => ({ id, answer, reason });
const attack = '</textarea><img src=x onerror=alert(1)> ```json';
const answers = {
  deep_interview: [response('task', '작업실 신청하기', attack), response('workflow', 'request'),
    response('success', '신청 번호 확인'), response('visibility', 'public'),
    response('confirmation', 'approval', '담당자 확인이 필요해요'),
    response('capacity', 'limited'), response('cancellation', 'undecided'),
    response('recovery', '입력 내용 유지 후 다시 시도'), response('scope', 'core'),
    response('publication', 'direct', '선택하지 않은 작성 흐름의 이유')]
};
const before = JSON.stringify(answers);
const data = parse(R.report(answers, true));
const decisions = data.questions.find(question => question.id === 'deep_interview');
assert.equal(decisions.status, 'current');
assert.equal(decisions.answer.find(row => row.questionId === 'task').reason, attack);
assert.equal(decisions.answer.find(row => row.questionId === 'cancellation').status, 'undecided');
assert(!decisions.answer.some(row => row.questionId === 'publication'));
assert(!R.report(answers).includes('선택하지 않은 작성 흐름의 이유'));
assert(data.openQuestions.some(item => item.question.includes(require('../dist/questions.js').interviewQuestions.find(q => q.id === 'cancellation').label)));
assert(!/<(?:img|script|\/textarea)\b/i.test(R.report(answers, true)));
assert(!/<img\b/i.test(V.report(answers)));
assert.equal(JSON.stringify(answers), before, 'Export is read-only');
const applied = I.apply(answers);
const appliedData = parse(R.report(applied, true));
assert(!JSON.stringify(appliedData).includes('선택하지 않은 작성 흐름의 이유'));
assert(!R.report(applied).includes('선택하지 않은 작성 흐름의 이유'));
assert.equal(appliedData.questions.find(question => question.id === 'features').status, 'current');
assert(appliedData.features.some(feature => feature.reason.includes(attack)));
assert(appliedData.screens.some(screen => screen.elements.some(element => element.flow.some(action =>
  action.featureId && appliedData.features.some(feature => feature.id === action.featureId) &&
  appliedData.screens.some(target => target.id === action.nextScreenId)))));
assert.equal(R.report(applied, true, {}, [], null, { basic: '사용자 수정본' }), '사용자 수정본');
const unknown = { deep_interview: [response('task', 'undecided')] };
const unknownData = parse(R.report(unknown, true));
assert.equal(unknownData.questions.find(question => question.id === 'deep_interview').answer[0].status, 'undecided');
assert.equal(unknownData.features.length, 0);
assert.equal(unknownData.screens.length, 0);
assert(!R.report(unknown).includes('> undecided'));
console.log('Interview report checks passed: current decisions, hidden branches, uncertainty, linked output, encoding and edited prompts.');
