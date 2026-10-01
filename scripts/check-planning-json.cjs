const assert = require('node:assert/strict');
const A = require('../dist/answers.js');
const Q = require('../dist/questions.js');
const R = require('../dist/report.js');
const T = require('../dist/planning-template.js');
const parse = prompt => JSON.parse(prompt.slice(prompt.lastIndexOf('\n```json\n') + 9, prompt.lastIndexOf('\n```')));

// Check source ownership as well as values; identical text on another screen is not sufficient.
function verify(answers, notes = {}, recommendations = []) {
  const before = JSON.stringify({ answers, notes, recommendations });
  const prompt = R.report(answers, true, notes, recommendations);
  const data = parse(prompt);
  assert.equal(data.format, 'buildbrief-planning');
  assert.equal(data.schemaVersion, 1);
  assert(!/<(?:script|img|svg|\/textarea)\b/i.test(prompt));
  assert.equal(JSON.stringify({ answers, notes, recommendations }), before);
  for (const question of data.questions) {
    assert.equal(question.reason, notes[question.id] || '');
    assert.equal(question.label, [...A.allQuestions, ...Q.retiredQuestions].find(q => q.id === question.id).label);
    if (['text', 'textarea', 'single', 'multi'].includes(question.type) && !question.dataPath)
      assert.deepEqual(question.answer, answers[question.id] ?? null);
    if (question.dataPath) assert(Array.isArray(data[question.dataPath]));
  }
  const source = structuredClone(answers.screens || []);
  A.prepareCanvases(source);
  const common = source.find(screen => screen.isCommon);
  for (const screen of data.screens) {
    const original = source.find(row => row.id === screen.id);
    assert.equal(screen.canvas.width, original.canvas.width);
    assert.equal(screen.canvas.baseHeight, original.canvas.height);
    assert.deepEqual(screen.roleIds, original.roleIds);
    for (const key of ['purpose', 'reason', 'content', 'empty', 'error', 'mobile']) assert.equal(screen[key], original[key]);
    const layout = A.layoutItems(original, common);
    assert.deepEqual(screen.elements.map(el => el.id), layout.map(item => item.key));
    for (const element of screen.elements) {
      const item = layout.find(item => item.key === element.id), key = item.key;
      const plan = key.startsWith('custom:') ? item.owner.customElements.find(el => 'custom:' + el.id === key) : item.owner.elementContents?.[key] || {};
      assert.equal(element.name, A.elementLabel(item.owner, key));
      assert.equal(element.parentId, item.parent || null);
      assert.equal(element.description, key.startsWith('custom:') ? plan.purpose || '' : item.owner.elementNotes?.[key] || '');
      assert.equal(element.reason, plan.reason);
      assert.equal(element.inherited, item.inherited);
      assert.deepEqual(element.source, { screenId: item.owner.id, elementId: key });
      assert.equal(element.level, A.elementPlacement(item.owner, key).level ?? 1);
      assert.deepEqual(element.items.map(({ ref, ...field }) => field), plan.items || []);
      for (const action of element.flow) {
        const saved = plan.flow.find(row => row.id === action.id);
        for (const key of ['event', 'result', 'nextScreenId', 'exceptions', 'recommendExceptions']) assert.equal(action[key], saved[key]);
      }
      const [x1, y1, x2, y2] = element.bbox;
      assert(element.bbox.every(Number.isFinite));
      assert(Math.abs(x2 - x1 - element.width) < 1e-8);
      assert(Math.abs(y2 - y1 - element.height) < 1e-8);
      assert(y2 <= screen.canvas.height);
    }
  }
  return data;
}

const sample = A.normalizeAnswers({ project_name: '원문\n```\n</script><img src=x> &',
  screens: [
    { id: 'common', isCommon: true, canvas: { width: 1000, height: 600 }, customElements: [{ id: 'parent', name: '부모' }],
      placements: { 'custom:parent': { region: 'main', width: 50, height: 120, level: 1, position: { x: 10, y: 20 } } } },
    { id: 'screen', name: '화면', canvas: { width: 2000, height: 600 }, customElements: [
      { id: 'child', name: '자식', purpose: '설명\n```\n가림과 무관하게 보존' }, { id: 'overlap', name: '겹침' }],
      placements: {
        'custom:child': { region: 'main', parent: 'custom:parent', width: 50, height: 800, level: 2, position: { x: 20, y: 30 } },
        'custom:overlap': { region: 'main', width: 50, height: 120, level: 2, position: { x: 10, y: 20 } }
      } },
    { id: 'independent', name: '독립', useCommonLayout: false }
  ], references: [{ id: 'ref', url: 'javascript:alert(1)', note: '주소 제외, 메모 유지' }] });
const data = verify(sample, { project_name: '이 이름의 이유' }, ['screens']);
assert.equal(data.questions.find(q => q.id === 'project_name').answer, sample.project_name);
assert.equal(data.questions.find(q => q.id === 'references').answer[0].url.referenceStatus, 'invalid');
assert(!R.report(sample, true).includes('javascript:alert(1)'));
const child = data.screens[1].elements.find(el => el.id === 'custom:child');
assert.deepEqual(child.bbox, [403, 95, 898, 895]);
assert.deepEqual(data.screens[1].elements.find(el => el.id === 'custom:parent').bbox, [200, 20, 1200, 936]);
assert.equal(data.screens[1].canvas.height, 952);
assert.deepEqual(data.screens[0].elements[0].bbox, [100, 20, 600, 140]);
assert.equal(data.screens[2].elements.length, 0);
assert.deepEqual(parse(R.report(sample, true, {}, [], { enabled: true, version: T.version, text: T.text })), parse(R.report(sample, true)));
for (const mode of [null, { enabled: true, version: T.version, text: T.text }]) {
  const text = R.report(sample, true, {}, [], mode);
  assert(text.includes(T.common));
  assert.equal(text.includes(T.text), !!mode);
}
assert.equal(R.report(sample, true, {}, [], null, { basic: '' }), '');
assert.equal(R.report(sample, true, {}, [], { enabled: true }, { advanced: '직접 쓴 문장' }), '직접 쓴 문장');
console.log('Planning JSON checks passed: source ownership, geometry, safe strings and shared continuity rules.');
module.exports = { parse, verify };
