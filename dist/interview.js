(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const A = root.BriefAnswers || require('./answers.js');
  const decided = value => typeof value === 'string' && value.trim() !== '' && value !== 'undecided' && value !== A.UNKNOWN;
  const keyName = value => (value || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  function responses(answers) {
    return Object.fromEntries((Array.isArray(answers.deep_interview) ? answers.deep_interview : [])
      .map(row => [row.id, decided(row.answer) ? row.answer.trim() : '']));
  }
  function questions(answers = {}) {
    const values = responses(answers);
    const active = {};
    // Only current parent answers can unlock children; old hidden responses remain in the backup.
    return Q.interviewQuestions.filter(question => {
      if (!A.matches(question.when, { ...answers, ...active })) return false;
      active[question.id] = values[question.id];
      return true;
    });
  }
  function preview(input = {}) {
    const answers = A.normalizeAnswers(input), active = questions(answers);
    const values = responses(answers), activeIds = new Set(active.map(question => question.id));
    const v = Object.fromEntries(Object.entries(values).filter(([id]) => activeIds.has(id)));
    const rows = Array.isArray(answers.deep_interview) ? answers.deep_interview : [];
    const warnings = [], existing = [], settings = [];
    const answered = active.filter(question => decided(v[question.id])).length;
    const missing = active.filter(question => !decided(v[question.id]));
    for (const question of missing) warnings.push('미정: ' + question.label);
    let ready = decided(v.task) && decided(v.workflow);
    if (['personal', 'team'].includes(v.visibility) && answers.login_need !== '로그인 필요') {
      if (v.access_resolution === 'login') {
        if (!decided(answers.login_need)) settings.push({ id: 'login_need', label: '로그인 사용', before: answers.login_need || '', after: '로그인 필요' });
        else {
          warnings.push('앞에서 “로그인 없이 사용”을 골랐어요. 계정으로 확인하려면 사용자·환경 단계의 로그인 선택을 바꾼 뒤 반영해 주세요.');
          ready = false;
        }
      } else if (v.access_resolution !== 'link') {
        warnings.push('공개하지 않을 내용을 누가 볼 수 있는지 확인하는 방법을 먼저 정해 주세요.');
        ready = false;
      }
    }
    if (v.publication === 'private' && ['public', 'team'].includes(v.visibility) ||
      ['direct', 'review'].includes(v.publication) && v.visibility === 'personal') {
      warnings.push('작성물의 공개 방식과 볼 수 있는 사람이 달라요. 두 답변을 같은 방향으로 맞춰 주세요.');
      ready = false;
    }
    if (v.visibility === 'personal' && (v.confirmation === 'approval' || v.cancellation === 'operator')) {
      warnings.push('담당자가 확인하거나 처리해야 하는데 본인만 볼 수 있다고 정했어요. 담당자도 필요한 내용을 볼 수 있도록 보기 범위를 다시 확인해 주세요.');
      ready = false;
    }
    const information = [];
    for (const item of (v.information || '').split(/[,\n]/).map(item => item.trim()).filter(Boolean))
      if (!information.some(name => keyName(name) === keyName(item))) information.push(item);
    if (information.length > 12) {
      warnings.push('처음 필요한 정보는 최대 12개까지 화면에 반영할 수 있어요. 핵심 항목으로 줄인 뒤 다시 반영해 주세요.');
      ready = false;
    }
    const result = { questions: active, answered, total: active.length, ready,
      features: [], screens: [], settings, warnings, existing };
    if (!decided(v.task) || !decided(v.workflow)) return result;
    const reason = (...ids) => ids.filter(id => activeIds.has(id) && decided(v[id])).map(id => {
      const row = rows.find(item => item.id === id);
      return row?.reason?.trim() ? `${Q.interviewQuestions.find(question => question.id === id).label} ${row.reason.trim()}` : '';
    }).filter(Boolean).join('\n').slice(0, A.MAX_TEXT);
    const label = id => Q.interviewQuestions.find(question => question.id === id)?.options?.find(option => option.value === v[id])?.label || '';
    const actor = (Array.isArray(answers.audience) ? answers.audience : []).find(row => row.person?.trim())?.person ||
      (Array.isArray(answers.roles) ? answers.roles : []).find(row => row.role?.trim())?.role || '처음 사용할 사람 · 확인 필요';
    const permission = label('visibility') + (v.visibility === 'team' && v.team_scope ? '\n' + label('team_scope') : '');
    const category = { browse: 'browse', request: 'booking', create: 'content', manage: 'workflow' }[v.workflow];
    const mode = {
      browse: ['목록 보기', '상세 정보', 'list', '상세 내용 보기'],
      request: ['신청 작성', '신청 결과', 'form', '신청하기'],
      create: ['내용 작성', '작성 결과', 'form', '저장하기'],
      manage: ['업무 목록', '업무 처리', 'table', '처리하기']
    }[v.workflow];
    const candidates = [], screens = [];
    const feature = (id, name, category, outcome, notes, why, priority = '첫 버전에 필요') => {
      const row = { id: 'interview-' + id, category, name, actor, outcome, notes,
        permission, reason: why, priority };
      candidates.push(row);
      return row.id;
    };
    const rules = ['confirmation', 'capacity', 'cancellation', 'publication'].filter(id => decided(v[id])).map(label).join('\n');
    const main = feature('main', v.task, category, v.success || '완료 결과는 아직 미정', rules, reason('task', 'workflow', 'success'));
    const primaryLinks = [main], resultLinks = [main];
    if (v.capacity === 'limited') primaryLinks.push(feature('capacity', '남은 자리·수량 확인', 'booking',
      '신청 마지막 단계에서 남은 자리를 다시 확인하고 초과 신청을 막아요.',
      '자리가 없으면 확정하지 않고 다른 선택을 안내해요. 수량·마감 기준은 추가 확인이 필요해요.', reason('capacity')));
    const approval = v.confirmation === 'approval' || v.publication === 'review';
    let reviewFeature = '';
    if (approval) {
      reviewFeature = feature('review', '담당자 검토·승인', 'workflow', '담당자가 확인한 뒤 승인 또는 반려 결과를 남겨요.',
        '누가 담당하며 어떤 기준으로 판단할지 추가 확인이 필요해요.', reason('confirmation', 'publication'));
      resultLinks.push(reviewFeature);
    }
    if (v.cancellation === 'self' || v.cancellation === 'operator') resultLinks.push(feature('cancel',
      v.cancellation === 'self' ? '내 신청 취소' : '취소 요청', 'booking', label('cancellation'),
      '취소 가능 기한·비용·처리 후 자리 반환 규칙은 추가 확인이 필요해요.', reason('cancellation')));
    if (v.visibility === 'team') primaryLinks.push(feature('team', '함께 보는 자료의 이용 범위', 'collaboration',
      label('team_scope') || '팀별 보기·수정 범위는 아직 미정',
      '초대할 사람과 초대·해제할 담당자를 추가 확인해요.', reason('visibility', 'team_scope')));
    if (v.access_resolution === 'link') resultLinks.push(feature('access-link', '개인별 확인 링크·번호', 'personalization',
      '받은 사람에게 허용된 내용만 확인할 수 있게 해요.',
      '링크·번호의 전달·분실·만료·재발급과 본인 확인 방법을 별도로 설계해야 해요.', reason('access_resolution')));
    const screen = (id, name, purpose, links, element, content) => ({
      id: 'interview-screen-' + id, name, purpose, isCommon: false, useCommonLayout: false,
      featureIds: links, elements: [element, 'button'], roleIds: [],
      roles: actor, content, empty: '표시할 내용이 없으면 첫 행동을 안내해요.',
      error: v.recovery || '실패했을 때의 안내·복구 방법은 아직 미정',
      mobile: (answers.devices || []).includes('휴대폰') ? '좁은 화면에서도 내용과 주요 행동을 순서대로 확인해요.' : '',
      reason: reason('workflow', 'success', 'visibility', 'recovery'),
      canvas: { width: 1920, height: 1080 }, layoutOrder: [element, 'button'],
      placements: {
        [element]: { region: 'main', width: 80, height: 420, level: 1, position: { x: 10, y: 80 } },
        button: { region: 'main', width: 35, height: 96, level: 1, position: { x: 10, y: 540 } }
      },
      elementNotes: { [element]: content + (!information.length ? '\n필요한 정보 항목은 아직 미정이에요.' : ''), button: '' },
      elementContents: {
        [element]: { name: element === 'form' ? '필요한 내용 입력' : '확인할 내용', featureIds: links,
          reason: reason('task', 'information'), items: information.slice(0, 12).map((name, index) => ({
            id: `interview-item-${id}-${index + 1}`, name,
            notes: element === 'form' ? '입력 방식·필수 여부는 화면에서 확인해요.' : '',
            ...(element === 'form' ? { type: '', required: '', options: '' } : {}) })) },
        button: { name: mode[3], featureIds: links, reason: reason('success'), flow: [] }
      }
    });
    const primary = screen('primary', mode[0], v.task, primaryLinks, mode[2], v.task + '\n' + rules);
    const complete = screen('result', mode[1], v.success || '완료 뒤 확인할 결과를 정해요.', resultLinks, 'cards',
      (approval ? '처리 대기와 승인·반려를 구분해 보여요.\n' : '') + (v.success || '완료 결과는 아직 미정'));
    primary.elementContents.button.flow = [{ id: 'interview-action-main', event: mode[3],
      result: approval ? '접수 후 담당자 확인을 기다려요.' : v.success || '완료 결과는 아직 미정',
      exceptions: v.recovery || '', featureId: main, nextScreenId: complete.id }];
    complete.elementContents.button.name = '돌아가기';
    complete.elementContents.button.flow = [{ id: 'interview-action-back', event: '돌아가기', result: '처음 화면으로 돌아가요.',
      featureId: '', nextScreenId: primary.id, exceptions: '' }];
    screens.push(primary, complete);
    if (approval) {
      const review = screen('review', '담당자 검토', '접수 내용을 확인하고 승인 여부를 정해요.', [reviewFeature], 'table',
        '대기 중인 내용과 검토 결과를 구분해 보여요. 담당자 역할과 접근 범위는 확인이 필요해요.');
      review.roles = '검토 담당자 · 역할 지정 필요';
      review.elementContents.button.name = '검토 결과 남기기';
      review.elementContents.button.flow = [{ id: 'interview-action-review', event: '검토 결과 남기기',
        result: '승인 또는 반려 결과를 남겨요.', exceptions: v.recovery || '', featureId: reviewFeature, nextScreenId: '@stay' }];
      screens.push(review);
    }
    if (decided(v.scope)) {
      const history = feature('history', '지난 기록 다시 보기', 'personalization', '이전에 처리한 내용을 다시 확인해요.',
        v.scope === 'core' ? '핵심 과정의 도움이 확인된 뒤 다음 버전에서 검토해요.' : '보관할 내용과 기간은 추가 확인이 필요해요.',
        reason('scope'), v.scope === 'core' ? '나중에' : '첫 버전에 필요');
      if (v.scope === 'followup') {
        const historyScreen = screen('history', '지난 기록', '이전에 처리한 내용을 다시 찾아봐요.', [history], 'list', '완료한 내용과 처리 결과를 보여요.');
        historyScreen.elementContents.button.name = '새로 시작하기';
        historyScreen.elementContents.button.flow = [{ id: 'interview-action-new', event: '새로 시작하기', result: '새 일을 시작해요.',
          featureId: main, nextScreenId: primary.id, exceptions: '' }];
        screens.push(historyScreen);
      }
    }
    const normalized = A.normalizeAnswers({ features: candidates, screens });
    const priorFeatures = Array.isArray(answers.features) ? answers.features : [];
    const priorScreens = Array.isArray(answers.screens) ? answers.screens : [];
    const featureIds = new Map(), screenIds = new Map();
    const find = (rows, row) => rows.find(item => item.id === row.id) || rows.find(item => keyName(item.name) === keyName(row.name));
    for (const row of normalized.features) {
      const old = find(priorFeatures, row);
      featureIds.set(row.id, old?.id || row.id);
    }
    for (const row of normalized.screens) {
      const old = find(priorScreens.filter(item => !item.isCommon), row);
      screenIds.set(row.id, old?.id || row.id);
    }
    const remapPlan = plan => {
      plan.featureIds = (plan.featureIds || []).map(id => featureIds.get(id) || id);
      for (const action of plan.flow || []) {
        action.featureId = featureIds.get(action.featureId) || action.featureId;
        action.nextScreenId = screenIds.get(action.nextScreenId) || action.nextScreenId;
      }
    };
    for (const row of normalized.screens) {
      remapPlan(row);
      Object.values(row.elementContents).forEach(remapPlan);
    }
    for (const [kind, candidates, prior] of [['features', normalized.features, priorFeatures], ['screens', normalized.screens, priorScreens]]) {
      for (const row of candidates) {
        const old = find(prior.filter(item => kind !== 'screens' || !item.isCommon), row);
        if (old) {
          existing.push(row.name + ' · 기존 내용 보존');
          if (JSON.stringify({ ...row, id: old.id }) !== JSON.stringify(old))
            warnings.push(row.name + ': 현재 답변으로 만든 제안과 기존 내용이 달라요. 기존 내용을 덮어쓰지 않으니 화면·기능에서 직접 확인해 주세요.');
        } else result[kind].push(row);
      }
      for (const old of prior) {
        if (old.id.startsWith(kind === 'screens' ? 'interview-screen-' : 'interview-') && !candidates.some(row => row.id === old.id))
          warnings.push(old.name + ': 이전 답변으로 추가한 내용이 남아 있어요. 지금도 필요한지 직접 확인해 주세요.');
      }
      if (prior.length + result[kind].length > A.MAX_ROWS) {
        result.ready = false;
        warnings.push((kind === 'screens' ? '화면' : '기능') + `은 최대 ${A.MAX_ROWS}개까지 만들 수 있어요. 기존 내용을 정리한 뒤 다시 반영해 주세요.`);
      }
    }
    if (!decided(v.visibility)) warnings.push('자료를 볼 수 있는 사람은 미정이에요. 실제 개발 전 접근 범위를 정해 주세요.');
    return result;
  }
  function apply(input = {}) {
    const answers = A.normalizeAnswers(input), plan = preview(answers);
    if (!plan.ready) throw new Error('핵심 답변과 서로 다른 선택을 먼저 확인해 주세요. 기존 내용은 변경하지 않았어요.');
    const next = { ...answers, features: [...(Array.isArray(answers.features) ? answers.features : []), ...plan.features],
      screens: [...(Array.isArray(answers.screens) ? answers.screens : []), ...plan.screens] };
    for (const setting of plan.settings) next[setting.id] = setting.after;
    return A.normalizeAnswers(next);
  }
  const api = { questions, preview, apply };
  root.BriefInterview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
