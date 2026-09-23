(function (root) {
  'use strict';
  const R = root.BriefReport || require('./report.js');
  const { steps } = root.BriefQuestions || require('./questions.js');
  const KEY = 'buildbrief.ideas.v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  const clampStep = value => Number.isInteger(value) ? Math.min(Math.max(value, 0), steps.length - 1) : 0;
  const topicAt = (step, topic) => steps[clampStep(step)].groups.some(group => group.title === topic) ? topic : '';

  function projectData(input) {
    if (!isObject(input) || !['answers', 'drafts', 'notes'].every(key => Object.hasOwn(input, key) && isObject(input[key]))) {
      throw new Error('프로젝트의 답변·추천 전 입력·메모 형식이 올바르지 않아요.');
    }
    return R.normalizeProject(input);
  }

  function newId() {
    const crypto = root.crypto || (typeof require === 'function' ? require('node:crypto').webcrypto : null);
    if (crypto?.randomUUID) return crypto.randomUUID();
    if (!crypto?.getRandomValues) throw new Error('프로젝트 식별자를 만들 수 없어요. 최신 브라우저에서 다시 열어 주세요.');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function createProject({ answers = {}, drafts = {}, notes = {}, step = 0, topic = '' } = {}) {
    const data = projectData({ answers, drafts, notes });
    const now = new Date().toISOString();
    return { id: newId(), createdAt: now, updatedAt: now, step: clampStep(step), topic: topicAt(step, topic), ...data };
  }

  function normalizeWorkspace(input) {
    if (!isObject(input) || input.version !== 1 || !Array.isArray(input.projects) || !input.projects.length) {
      throw new Error('지원하지 않거나 비어 있는 프로젝트 저장 형식이에요. 원본 백업을 보관해 주세요.');
    }
    const ids = new Set();
    const projects = input.projects.map(project => {
      if (!isObject(project) || typeof project.id !== 'string' || !UUID.test(project.id) || ids.has(project.id)) {
        throw new Error('프로젝트 식별자가 올바르지 않거나 중복되어 있어요.');
      }
      if (!validDate(project.createdAt) || !validDate(project.updatedAt)) {
        throw new Error('프로젝트의 생성·수정 날짜가 올바르지 않아요.');
      }
      ids.add(project.id);
      return { id: project.id, createdAt: project.createdAt, updatedAt: project.updatedAt, step: clampStep(project.step), topic: topicAt(project.step, project.topic), ...projectData(project) };
    });
    if (typeof input.activeId !== 'string' || !ids.has(input.activeId)) throw new Error('현재 선택한 프로젝트를 찾을 수 없어요.');
    return { version: 1, activeId: input.activeId, projects };
  }

  function importBackup(input) {
    let checked;
    if (isObject(input) && input.format === 'buildbrief-idea' && input.version === 1) {
      checked = normalizeWorkspace({ version: 1, activeId: input.id, projects: [input] });
    } else if (isObject(input) && input.format === 'buildbrief-ideas') {
      checked = normalizeWorkspace(input);
    } else {
      throw new Error('새 아이디어 기획 버전의 백업 파일을 선택해 주세요. 이전 기술 설계 질문지의 백업은 자동 변환하지 않아요.');
    }
    const ids = new Map(checked.projects.map(project => [project.id, newId()]));
    return { ...checked, activeId: ids.get(checked.activeId), projects: checked.projects.map(project => ({ ...project, id: ids.get(project.id) })) };
  }

  const projectTitle = project => R.display(project?.answers?.project_name) || '새로운 아이디어';
  const api = { KEY, newId, createProject, normalizeWorkspace, importBackup, projectTitle };
  root.BriefProjects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
