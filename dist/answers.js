(function (root) {
  'use strict';
  const Q = root.BriefQuestions || require('./questions.js');
  const UNKNOWN = '아직 미정';
  const allQuestions = Q.steps.flatMap((step) => step.groups.flatMap((group) => group.questions));
  const questions = new Map(allQuestions.map((q) => [q.id, q]));
  const MAX_ROWS = 80,
    MAX_TEXT = 6000;
  const EXCLUSIVE = [UNKNOWN, '특별한 방법 없음', '추가 정보 없음', '기기 기능이 필요하지 않음'];
  const priorities = ['첫 버전에 필요', '나중에', UNKNOWN];
  const plain = (value) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const fail = (label) => {
    throw new Error(
      `${label} 형식이 올바르지 않아요. 가져오기를 취소했으며 원본은 변경하지 않았어요.`
    );
  };
  const text = (value, label, max = MAX_TEXT) => {
    if (typeof value !== 'string' || value.length > max) fail(label);
    return value;
  };
  const choiceOptions = (q) => [...new Set([...(q.options || []), UNKNOWN])];
  const isAnswered = (value) =>
    typeof value === 'string'
      ? value.trim() !== ''
      : Array.isArray(value)
        ? value.some(isAnswered)
        : plain(value)
          ? Object.entries(value).some(
              ([key, item]) => !['id', 'category'].includes(key) && isAnswered(item)
            )
          : false;
  const display = (value) =>
    typeof value === 'string'
      ? value.trim()
      : Array.isArray(value)
        ? value.map(display).filter(Boolean).join(', ')
        : plain(value)
          ? Object.entries(value)
              .filter(([key]) => !['id', 'category'].includes(key))
              .map(([, item]) => display(item))
              .filter(Boolean)
              .join(' · ')
          : '';

  function matches(condition, answers = {}) {
    if (!condition) return true;
    if (condition.any) return condition.any.some((item) => matches(item, answers));
    if (condition.all) return condition.all.every((item) => matches(item, answers));
    if (condition.not) return !matches(condition.not, answers);
    const value = answers[condition.id];
    if (condition.category)
      return (
        Array.isArray(value) &&
        value.some((row) => plain(row) && row.category === condition.category)
      );
    if (Object.hasOwn(condition, 'answered')) {
      const answered =
        isAnswered(value) &&
        value !== UNKNOWN &&
        !(Array.isArray(value) && value.includes(UNKNOWN));
      return condition.answered ? answered : !answered;
    }
    if (Object.hasOwn(condition, 'value')) return value === condition.value;
    if (Object.hasOwn(condition, 'includes'))
      return Array.isArray(value) && value.includes(condition.includes);
    if (condition.in)
      return (Array.isArray(value) ? value : [value]).some((item) => condition.in.includes(item));
    return false;
  }
  const activeGroups = (step, answers = {}, notes = {}) =>
    step.groups
      .filter((group) => matches(group.when, answers))
      .map((group) => ({
        ...group,
        questions: group.questions.filter(
          (q) =>
            matches(q.when, answers) &&
            (!q.legacyOnly || isAnswered(answers[q.id]) || isAnswered(notes[q.id]))
        )
      }))
      .filter((group) => group.questions.length);
  const activeQuestions = (answers = {}) =>
    Q.steps.flatMap((step) => activeGroups(step, answers).flatMap((group) => group.questions));
  function progress(answers = {}) {
    const features = Array.isArray(answers.features) ? answers.features : [];
    const hasPriority = (row) => isAnswered(row?.priority) && row.priority !== UNKNOWN;
    const stepProgress = Q.steps.map((step) => {
      const active = activeGroups(step, answers).flatMap((group) => group.questions);
      const answered = active.filter((q) => {
        if (q.type === 'scope') return features.length > 0 && features.every(hasPriority);
        if (q.type === 'features')
          return (
            answers[q.id] === UNKNOWN ||
            features.some(
              (row) =>
                ['name', 'actor', 'outcome', 'notes', 'savedInfo'].some((key) =>
                  isAnswered(row?.[key])
                ) || hasPriority(row)
            )
          );
        return isAnswered(answers[q.id]);
      }).length;
      return { answered, total: active.length };
    });
    const answered = stepProgress.reduce((sum, step) => sum + step.answered, 0);
    const total = stepProgress.reduce((sum, step) => sum + step.total, 0);
    return {
      answered,
      total,
      percent: total ? Math.round((answered / total) * 100) : 0,
      steps: stepProgress
    };
  }

  function selected(value, field, label) {
    const options = choiceOptions(field);
    const valid = (item) =>
      typeof item === 'string' &&
      (item === '' ||
        (field.source === 'features' && /^[A-Za-z0-9_-]{1,80}$/.test(item)) ||
        options.includes(item));
    if (field.type === 'multi') {
      if (!Array.isArray(value) || value.length > MAX_ROWS || value.some((item) => !valid(item)))
        fail(label);
      if (value.some((item) => EXCLUSIVE.includes(item)) && value.length > 1)
        fail(`${label}의 함께 고를 수 없는 선택`);
      if (new Set(value).size !== value.length) fail(`${label}의 중복 선택`);
      return value.map((item) => text(item, label, 2000));
    }
    if (!valid(value)) fail(label);
    return text(value, label, 2000);
  }
  function rowId(value, label) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value))
      fail(`${label}의 식별자`);
    return value;
  }
  function list(value, label, read) {
    if (!Array.isArray(value) || value.length > MAX_ROWS) fail(label);
    const seen = new Set();
    return value.map((row, index) => {
      if (!plain(row)) fail(`${label} ${index + 1}`);
      const id = rowId(row.id, label);
      if (seen.has(id)) fail(`${label}의 중복 식별자`);
      seen.add(id);
      return { id, ...read(row, `${label} ${index + 1}`) };
    });
  }
  const stringFields = (row, fields, label) =>
    Object.fromEntries(
      fields.map((key) => [key, text(row[key] === undefined ? '' : row[key], `${label} ${key}`)])
    );
  function ids(value, label, allowed) {
    if (!Array.isArray(value) || value.length > MAX_ROWS) fail(label);
    const result = value.map((item) => rowId(item, label));
    if (
      new Set(result).size !== result.length ||
      (allowed && result.some((item) => !allowed.includes(item)))
    )
      fail(label);
    return result;
  }
  const HTTP_URL_HELP =
    'http:// 또는 https://로 시작하는 주소 하나를 입력하세요. 계정·비밀번호가 포함된 주소는 사용하지 마세요.';
  // For reference text only: this does not check DNS, redirects or private networks.
  // Never use this function as authorization for a server-side request.
  function normalizeHttpUrl(value) {
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f\\]/.test(value)) return '';
    const raw = value.trim();
    if (raw.length > 2000 || !/^https?:\/\/[^/]/i.test(raw) || /\s/.test(raw)) return '';
    try {
      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol) &&
        url.hostname &&
        !url.username &&
        !url.password
        ? url.href
        : '';
    } catch {
      return '';
    }
  }

  function normalizeAnswer(q, value) {
    if (value === UNKNOWN) return UNKNOWN;
    if (['text', 'textarea'].includes(q.type))
      return text(value, q.label, q.maxLength || (q.id === 'project_name' ? 200 : MAX_TEXT));
    if (['single', 'multi'].includes(q.type)) return selected(value, q, q.label);
    if (q.type === 'scope') {
      if (value !== '') fail(q.label);
      return '';
    }
    if (q.type === 'features')
      return list(value, q.label, (row, label) => {
        const category = text(row.category === undefined ? 'custom' : row.category, label, 80);
        if (!(Q.featureTypes || []).some((item) => item.id === category))
          fail(`${label}의 기능 유형`);
        const result = stringFields(row, ['name', 'actor', 'outcome', 'priority', 'notes'], label);
        if (result.priority && !priorities.includes(result.priority)) fail(`${label}의 우선순위`);
        return {
          category,
          ...result,
          ...(Object.hasOwn(row, 'savedInfo')
            ? { savedInfo: text(row.savedInfo, label + ' 남길 정보') }
            : {})
        };
      });
    if (q.type === 'screens')
      return list(value, q.label, (row, label) => {
        if (row.recommendLayout !== undefined && typeof row.recommendLayout !== 'boolean')
          fail(`${label}의 구성 추천 요청`);
        const elements = ids(
          row.elements === undefined ? [] : row.elements,
          label,
          (Q.uiElements || []).map((item) => item.id)
        );
        const notes = row.elementNotes === undefined ? {} : row.elementNotes;
        if (!plain(notes)) fail(`${label}의 구성요소 메모`);
        const elementNotes = {};
        for (const [key, item] of Object.entries(notes)) {
          if (!(Q.uiElements || []).some((element) => element.id === key))
            fail(`${label}의 구성요소 메모`);
          elementNotes[key] = text(item, `${label}의 구성요소 메모`);
        }
        const options = row.elementOptions === undefined ? {} : row.elementOptions;
        if (!plain(options)) fail(`${label}의 구성요소 세부 선택`);
        const elementOptions = {};
        for (const [key, value] of Object.entries(options)) {
          const detail = Q.uiElements.find((element) => element.id === key)?.detail;
          if (!detail) fail(`${label}의 구성요소 세부 선택`);
          elementOptions[key] = ids(
            value,
            label,
            detail.options.map((option) => option.id)
          );
          if (!detail.multiple && value.length > 1) fail(`${label}의 단일 선택`);
        }
        return {
          ...stringFields(
            row,
            ['name', 'purpose', 'roles', 'content', 'empty', 'error', 'mobile'],
            label
          ),
          featureIds: ids(row.featureIds === undefined ? [] : row.featureIds, label),
          recommendLayout: row.recommendLayout === true,
          elements,
          elementNotes,
          elementOptions,
          customElements: list(
            row.customElements === undefined ? [] : row.customElements,
            `${label}의 직접 추가한 요소`,
            (item, itemLabel) => stringFields(item, ['name', 'purpose'], itemLabel)
          )
        };
      });
    if (q.type === 'references')
      return list(value, q.label, (row, label) => ({
        url: text(row.url === undefined ? '' : row.url, '참고 URL', 2000),
        note: text(row.note === undefined ? '' : row.note, label)
      }));
    if (q.type === 'flow')
      return list(value, q.label, (row, label) => ({
        featureId:
          row.featureId === undefined || row.featureId === '' ? '' : rowId(row.featureId, label),
        note: text(row.note === undefined ? '' : row.note, label)
      }));
    if (q.type === 'rows')
      return list(value, q.label, (row, label) =>
        Object.fromEntries(
          q.fields.map((field) => {
            const current =
              row[field.id] === undefined ? (field.type === 'multi' ? [] : '') : row[field.id];
            return [
              field.id,
              ['single', 'multi'].includes(field.type)
                ? selected(current, field, `${label} ${field.label}`)
                : text(current, `${label} ${field.label}`, field.maxLength || MAX_TEXT)
            ];
          })
        )
      );
    return fail(q.label);
  }
  function normalizeAnswers(input = {}) {
    if (!plain(input)) fail('답변 목록');
    const result = {};
    for (const [id, value] of Object.entries(input)) {
      const q = questions.get(id);
      if (!q) fail(`알 수 없는 질문 ${id}`);
      result[id] = normalizeAnswer(q, value);
    }
    return result;
  }
  function normalizeNotes(input = {}) {
    if (!plain(input)) fail('메모 목록');
    const result = {};
    for (const [id, value] of Object.entries(input)) {
      if (!questions.has(id)) fail(`알 수 없는 메모 ${id}`);
      result[id] = text(value, '추가 메모');
    }
    return result;
  }
  function normalizeRecommendations(input = []) {
    if (
      !Array.isArray(input) ||
      input.length > allQuestions.filter((q) => q.allowRecommend).length ||
      new Set(input).size !== input.length ||
      input.some((id) => typeof id !== 'string' || questions.get(id)?.allowRecommend !== true)
    )
      fail('AI 비교·추천 요청');
    return [...input];
  }
  function normalizeProject(input) {
    if (!plain(input)) fail('프로젝트');
    return {
      answers: normalizeAnswers(input.answers === undefined ? {} : input.answers),
      drafts: normalizeAnswers(input.drafts === undefined ? {} : input.drafts),
      notes: normalizeNotes(input.notes === undefined ? {} : input.notes),
      recommendations: normalizeRecommendations(input.recommendations)
    };
  }

  const api = {
    UNKNOWN,
    EXCLUSIVE,
    MAX_ROWS,
    MAX_TEXT,
    HTTP_URL_HELP,
    allQuestions,
    choiceOptions,
    isAnswered,
    display,
    matches,
    activeGroups,
    activeQuestions,
    normalizeAnswers,
    normalizeNotes,
    normalizeRecommendations,
    normalizeProject,
    progress,
    normalizeHttpUrl,
    priorities
  };
  root.BriefAnswers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
