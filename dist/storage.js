(function (root) {
  'use strict';
  const P = root.BriefProjects || require('./projects.js');

  function load() {
    const initial = P.createProject({ started: false });
    const state = {
      workspace: { version: 1, activeId: initial.id, projects: [initial] },
      storedRaw: null,
      originalStorage: null,
      loadFailed: false,
      externalChange: false,
      storageWorking: true
    };
    try {
      state.storedRaw = state.originalStorage = root.localStorage.getItem(P.KEY);
      if (state.storedRaw !== null) {
        state.workspace = P.normalizeWorkspace(JSON.parse(state.storedRaw));
      }
    } catch {
      state.loadFailed = true;
      state.storageWorking = false;
    }
    return state;
  }

  function save(state, next, recover = false) {
    if (state.loadFailed && !recover) return false;
    try {
      // ponytail: 동시 편집은 덮어쓰기를 막는다. 공동 편집이 필요해지면 서버 동기화를 도입한다.
      if (state.externalChange || root.localStorage.getItem(P.KEY) !== state.storedRaw) {
        state.externalChange = true;
        return false;
      }
      next = {
        ...next,
        projects: next.projects.map((project) =>
          project.id === state.workspace.activeId
            ? { ...project, updatedAt: new Date().toISOString() }
            : project
        )
      };
      const raw = JSON.stringify(next);
      root.localStorage.setItem(P.KEY, raw);
      state.workspace = next;
      state.storedRaw = raw;
      state.storageWorking = true;
      if (recover) {
        state.loadFailed = false;
        state.originalStorage = null;
      }
      return true;
    } catch {
      state.storageWorking = false;
      return false;
    }
  }

  function status(state) {
    if (state.loadFailed) return '저장 읽기 실패 · 원본 보존 중';
    if (state.externalChange) return '다른 탭 변경 · 백업 후 새로고침';
    if (!state.storageWorking) return '저장 불가 · 답변을 백업해 주세요';
    return '이 브라우저에 저장됨';
  }

  const api = { load, save, status };
  root.BriefStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
