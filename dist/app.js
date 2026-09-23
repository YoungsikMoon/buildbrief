(() => {
  'use strict';
  const Q = window.BriefQuestions, R = window.BriefReport, P = window.BriefProjects;
  const { steps, featureTypes, uiElements } = Q;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const exclusive = ['아직 미정','특별한 방법 없음','추가 정보 없음','기기 기능이 필요하지 않음'];
  const priorities = ['첫 버전에 필요', '나중에', '아직 미정'];
  const questions = new Map(R.allQuestions.map(q => [q.id, q]));
  const initial = P.createProject();
  let workspace = { version:1, activeId:initial.id, projects:[initial] };
  let answers, drafts, notes, currentStep, storedRaw = null, originalStorage = null;
  let loadFailed = false, externalChange = false, storageWorking = true, toastTimer;
  try { storedRaw = originalStorage = localStorage.getItem(P.KEY); if (storedRaw !== null) workspace = P.normalizeWorkspace(JSON.parse(storedRaw)); }
  catch { loadFailed = true; storageWorking = false; }
  activateProject();
  function activateProject() { const p = workspace.projects.find(p => p.id === workspace.activeId); ({ answers, drafts, notes } = p); currentStep = p.step; }
  function collectWorkspace() { return { ...workspace,projects:workspace.projects.map(p => p.id === workspace.activeId ? { ...p,answers,drafts,notes,step:currentStep,topic:'' } : p) }; }
  function status(message) {
    $('#save-status').textContent = $('#storage-help-status').textContent = $('#mobile-progress').textContent = message;
    $('#storage-help-warning').hidden = storageWorking && !externalChange;
    $('#storage-original').hidden = !loadFailed || originalStorage === null;
    $('#save-help-button').dataset.attention = String(!storageWorking || externalChange);
    $('#save-help-button').setAttribute('aria-label',message + ' · 저장 안내 열기');
  }
  function save(next = collectWorkspace(),recover = false) {
    if (loadFailed && !recover) { status('저장 읽기 실패 · 원본 보존 중'); return false; }
    try {
      // ponytail: 동시 편집은 덮어쓰기를 막는다. 공동 편집이 필요해지면 서버 동기화를 도입한다.
      if (externalChange || localStorage.getItem(P.KEY) !== storedRaw) { externalChange = true; status('다른 탭 변경 · 백업 후 새로고침'); return false; }
      next = { ...next,projects:next.projects.map(p => p.id === workspace.activeId ? { ...p,updatedAt:new Date().toISOString() } : p) };
      const raw = JSON.stringify(next); localStorage.setItem(P.KEY,raw); workspace = next; storedRaw = raw; storageWorking = true;
      if (recover) { loadFailed = false; originalStorage = null; }
      status('이 브라우저에 저장됨'); return true;
    } catch { storageWorking = false; status('저장 불가 · 답변을 백업해 주세요'); return false; }
  }
  function commitProjects(next,recover = false) {
    if (!save(next,recover)) {
      const message = '저장하지 못해 프로젝트를 바꾸지 않았어요. 현재 답변을 백업한 뒤 저장 안내를 확인해 주세요.';
      for (const id of ['projects-error','project-name-error','delete-project-error']) $('#' + id).textContent = message;
      toast(message); return false;
    }
    activateProject(); renderStep(currentStep,true); return true;
  }
  function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; },5000); }
  function picker() { $('#project-select').innerHTML = collectWorkspace().projects.map(p => `<option value="${p.id}">${esc(P.projectTitle(p))}</option>`).join(''); $('#project-select').value = workspace.activeId; }
  function updateProgress() { const p = R.progress(answers); $('#progress-caption').textContent = `${p.total}개 주제 중 ${p.started}개 작성 시작 · 언제든 이어서 수정할 수 있어요.`; picker(); }
  const attrs = (qid,row,field) => `data-q="${esc(qid)}"${row === undefined ? '' : ` data-row="${row}"`}${field ? ` data-field="${esc(field)}"` : ''}`;
  function input(label,value,attributes,{type='text',placeholder='',options=[],help=''} = {}) {
    const id = 'input-' + P.newId(); let control;
    if (type === 'single') control = `<select id="${id}" ${attributes}><option value="">선택해 주세요</option>${options.map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (type === 'multi') control = `<div class="choices compact">${options.map(o => `<label class="choice"><input type="checkbox" ${attributes} value="${esc(o)}" ${Array.isArray(value) && value.includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    else control = type === 'textarea' ? `<textarea id="${id}" ${attributes} rows="3" maxlength="6000" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input id="${id}" ${attributes} type="${type}" maxlength="${type === 'url' ? 2000 : 6000}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">`;
    return `<div class="input-field"><label ${type === 'multi' ? '' : `for="${id}"`}>${esc(label)}</label>${help ? `<p class="field-help">${esc(help)}</p>` : ''}${control}</div>`;
  }
  const rowsOf = id => Array.isArray(answers[id]) ? answers[id] : [];
  const rowHeader = (title,qid,i) => `<div class="card-top"><h3>${esc(title)}</h3><button type="button" class="text-button danger-text" data-remove="${qid}" data-index="${i}">삭제</button></div>`;
  const addButton = (id,label) => `<button type="button" class="button secondary" data-add="${id}">+ ${esc(label)}</button>`;
  const empty = message => `<p class="empty-note">${esc(message)}</p>`;
  function featureEditor() {
    return `<div class="catalog">${featureTypes.filter(f => f.id !== 'custom').map(f => `<div class="catalog-entry"><button type="button" class="catalog-item" data-feature="${f.id}"><strong>${esc(f.label)} <span aria-hidden="true">＋</span></strong><span>${esc(f.description)}</span></button><button type="button" class="option-help" data-feature-help="${f.id}" aria-label="${esc(f.label)} 설명">?</button></div>`).join('')}</div><p class="field-help">유형을 누르면 아래에 기능 카드가 생겨요. 같은 유형도 여러 번 추가할 수 있어요.</p><div class="editor-list">${rowsOf('features').map((row,i) => `<section class="editor-card" id="row-features-${i}">${rowHeader(row.name || '새 기능','features',i)}<div class="field-grid">${input('기능 이름',row.name,attrs('features',i,'name'),{placeholder:'사용자가 할 수 있는 일을 이름 붙여 주세요'})}${input('사용하는 사람',row.actor,attrs('features',i,'actor'),{placeholder:'예: 방문자, 회원, 담당자'})}</div>${input('어떤 일을 하고, 어떤 결과를 얻나요?',row.outcome,attrs('features',i,'outcome'),{type:'textarea',placeholder:'사용자가 하는 행동과 확인할 결과를 적어 주세요.'})}<div class="field-grid">${input('언제 필요한가요?',row.priority,attrs('features',i,'priority'),{type:'single',options:priorities})}${input('이 기능의 규칙·추가 메모 (선택)',row.notes,attrs('features',i,'notes'),{placeholder:'제한, 예외, 아직 정하지 못한 점'})}</div></section>`).join('')}</div>${addButton('features','목록에 없는 기능 직접 추가')}`;
  }
  function referenceEditor(q) {
    return (rowsOf(q.id).map((row,i) => `<section class="editor-card" id="row-${q.id}-${i}">${rowHeader('참고 자료 ' + (i+1),q.id,i)}${input('사이트 또는 자료 URL',row.url,attrs(q.id,i,'url'),{type:'url',placeholder:'https://example.com',help:'주소 하나만 입력하세요. 링크의 내용은 자동으로 읽어 오지 않아요.'})}${input('어떤 부분을 참고하나요? (선택)',row.note,attrs(q.id,i,'note'),{placeholder:'예: 첫 화면의 구성, 검색 방식, 색상'})}</section>`).join('') || empty('참고하고 싶은 사이트나 디자인 자료가 있다면 하나씩 추가하세요.')) + addButton(q.id,'참고 URL 추가');
  }
  function flowEditor(q) {
    const features = rowsOf('features');
    return (rowsOf(q.id).map((row,i,rows) => `<section class="editor-card" id="row-${q.id}-${i}"><div class="card-top"><h3>${i+1}번째 행동</h3><div class="inline-actions"><button type="button" class="text-button" data-move="${i}" data-direction="-1" ${i === 0 ? 'disabled' : ''} aria-label="${i+1}번째 행동 위로">↑ 위로</button><button type="button" class="text-button" data-move="${i}" data-direction="1" ${i === rows.length-1 ? 'disabled' : ''} aria-label="${i+1}번째 행동 아래로">↓ 아래로</button><button type="button" class="text-button danger-text" data-remove="${q.id}" data-index="${i}">삭제</button></div></div><div class="input-field"><label for="flow-feature-${i}">앞에서 정한 기능 연결 (선택)</label><select id="flow-feature-${i}" ${attrs(q.id,i,'featureId')}><option value="">기능을 연결하지 않고 직접 설명</option>${row.featureId && !features.some(f => f.id === row.featureId) ? `<option value="${esc(row.featureId)}" selected>삭제된 기능 · 다시 선택해 주세요</option>` : ''}${features.map(f => `<option value="${f.id}" ${f.id === row.featureId ? 'selected' : ''}>${esc(f.name || '이름 없는 기능')}</option>`).join('')}</select></div>${input('이때 사용자는 무엇을 하나요?',row.note,attrs(q.id,i,'note'),{placeholder:'예: 처음 방문해서 원하는 항목을 찾아요'})}</section>`).join('') || empty('가장 대표적인 이용 과정 하나부터 정리하세요. 모든 기능의 흐름을 작성할 필요는 없어요.')) + addButton(q.id,'다음 행동 추가');
  }
  function wireframe(kind) {
    const box = (x,y,w,h,accent=false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ${accent ? 'class="accent"' : ''}/>`;
    const lines = '<path d="M35 22h54M35 33h43M35 44h50M35 55h36"/>';
    const shapes = {
      appbar:box(8,8,104,12,true)+lines,sidebar:box(8,8,21,64,true)+lines,bottomnav:box(8,59,104,13,true)+lines,
      tabs:box(8,8,31,10,true)+box(42,8,31,10)+box(76,8,31,10)+lines,
      list:[10,30,50].map(y=>box(8,y,16,14,true)+`<path d="M32 ${y+4}h72M32 ${y+11}h48"/>`).join(''),
      cards:[8,45,82].map(x=>box(x,12,30,52)+box(x+4,16,22,22,true)).join(''),
      table:box(8,10,104,58)+'<path d="M8 24h104M8 38h104M8 52h104M42 10v58M78 10v58"/>'+box(8,10,104,13,true),
      calendar:box(10,8,100,64)+box(10,8,100,13,true)+'<path d="M10 38h100M10 54h100M35 21v51M60 21v51M85 21v51"/>',
      map:'<path d="M8 62L37 12l40 58 33-54M8 25l100 33M44 8v64"/><circle class="accent" cx="68" cy="33" r="9"/>',
      chart:box(18,43,15,25)+box(49,26,15,42,true)+box(80,10,15,58),
      form:box(14,14,92,15)+box(14,37,92,15)+box(74,59,32,12,true),upload:box(15,8,90,64)+'<path d="M60 53V25m-12 12 12-12 12 12"/>',
      fab:lines+'<circle class="accent" cx="97" cy="57" r="13"/><path d="M90 57h14M97 50v14"/>',
      search:box(10,10,100,20,true)+'<circle cx="22" cy="19" r="4"/><path d="M25 22l4 4M14 44h75M14 57h52"/>',
      filters:[8,43,78].map(x=>box(x,9,30,13,true)).join('')+lines,
      rightpanel:box(83,8,29,64,true)+'<path d="M10 20h59M10 32h43M10 44h59M10 56h40"/>',
      dialog:box(8,8,104,64)+box(28,22,64,38,true)+'<path d="M37 32h43M37 42h28"/>'
    };
    return `<svg class="wireframe" viewBox="0 0 120 80" aria-hidden="true">${shapes[kind] || shapes.cards}</svg>`;
  }
  function screenEditor(q) {
    const features = rowsOf('features');
    return (rowsOf(q.id).map((row,i) => `<section class="editor-card screen-card" id="row-${q.id}-${i}">${rowHeader(row.name || '새 화면',q.id,i)}<div class="field-grid">${input('화면 이름',row.name,attrs(q.id,i,'name'),{placeholder:'예: 홈, 검색 결과, 내 기록'})}${input('이 화면을 사용하는 사람',row.roles,attrs(q.id,i,'roles'),{placeholder:'예: 누구나, 로그인한 회원, 운영자'})}</div>${input('이 화면에서 무엇을 할 수 있어야 하나요?',row.purpose,attrs(q.id,i,'purpose'),{placeholder:'사용자가 이 화면에 들어오는 목적'})}<fieldset class="sub-field"><legend>이 화면에서 제공할 기능</legend>${features.length ? `<div class="choices compact">${features.map(f => `<label class="choice"><input type="checkbox" ${attrs(q.id,i,'featureIds')} value="${f.id}" ${(row.featureIds || []).includes(f.id) ? 'checked' : ''}><span>${esc(f.name || '이름 없는 기능')}</span></label>`).join('')}</div>` : '<p class="field-help">‘필요한 기능’에서 추가하면 이곳에서 연결할 수 있어요.</p>'}${(row.featureIds || []).some(id => !features.some(f => f.id === id)) ? '<p class="field-help">삭제된 기능 연결이 있어요. 기획 초안에서 확인할 수 있어요.</p>' : ''}</fieldset><details class="element-picker" id="elements-${row.id}" open><summary>화면에 넣을 요소 고르기 <span>${(row.elements || []).length}개 선택</span></summary><p class="field-help">여러 요소를 함께 쓸 수 있어요. 그림은 역할을 보여 주는 예시이며 실제 배치를 확정하지 않아요.</p><div class="element-grid">${uiElements.map(el => `<div class="element-option ${(row.elements || []).includes(el.id) ? 'selected' : ''}"><label>${wireframe(el.preview || el.id)}<span><input type="checkbox" ${attrs(q.id,i,'elements')} value="${el.id}" ${(row.elements || []).includes(el.id) ? 'checked' : ''}>${esc(el.label)}</span></label><button type="button" class="option-help" data-element-help="${el.id}" aria-label="${esc(el.label)} 설명">?</button></div>`).join('')}</div></details>${(row.elements || []).map(id => { const el = uiElements.find(e => e.id === id); return el ? input(el.prompt || el.label + '에 무엇을 넣나요?',row.elementNotes?.[id],attrs(q.id,i,'elementNotes') + ` data-element="${id}"`,{placeholder:'아직 정하지 않았다면 비워 두세요'}) : ''; }).join('')}${input('보여 줄 내용·정보',row.content,attrs(q.id,i,'content'),{type:'textarea',placeholder:'예: 제목, 사진, 날짜, 가격, 처리 상태'})}<details id="states-${row.id}" class="optional-details"><summary>빈 화면·오류·작은 화면에서의 모습 (선택)</summary><p class="field-help">처음 자료가 없거나 문제가 생겼을 때 무엇을 보여 줄지 생각해 보세요.</p>${input('자료가 아직 없을 때',row.empty,attrs(q.id,i,'empty'),{placeholder:'예: 안내 문구와 첫 자료 추가 버튼'})}${input('작업이 실패했을 때',row.error,attrs(q.id,i,'error'),{placeholder:'예: 입력 내용을 유지하고 다시 시도할 수 있게'})}${input('휴대폰의 작은 화면에서',row.mobile,attrs(q.id,i,'mobile'),{placeholder:'예: 표를 카드로 바꾸고 메뉴를 아래쪽에 배치'})}</details></section>`).join('') || empty('처음 만나는 화면부터 추가하세요. 아직 화면이 떠오르지 않으면 나중에 돌아와도 괜찮아요.')) + addButton(q.id,'화면 추가');
  }
  function scopeEditor() { return rowsOf('features').map((f,i) => `<div class="scope-row"><div><strong>${esc(f.name || '이름 없는 기능')}</strong><p>${esc(f.outcome || '제공할 결과를 아직 적지 않았어요.')}</p></div>${input('출시 범위',f.priority,attrs('features',i,'priority'),{type:'single',options:priorities})}</div>`).join('') || empty('‘필요한 기능’에서 추가하면 이곳에 모여요.'); }
  function reasonEditor(q) {
    const value = notes[q.id] || '';
    return `<details class="answer-note" id="reason-${q.id}" ${value.trim() ? 'open' : ''}><summary>답변·선택 이유 남기기 <span>(선택)</span></summary><div class="input-field"><label id="reason-label-${q.id}" for="reason-input-${q.id}">왜 이렇게 답하거나 선택했나요?</label><p class="field-help" id="reason-help-${q.id}">내 상황, 중요하게 생각한 점, 비교했던 다른 방법을 적어 두세요. 나중에 답변을 바꿀 때 다시 살펴볼 수 있어요.</p><textarea id="reason-input-${q.id}" data-note="${q.id}" aria-labelledby="label-${q.id} reason-label-${q.id}" aria-describedby="reason-help-${q.id}" rows="3" maxlength="6000" placeholder="예: 처음 이용하는 사람도 쉽게 시작할 수 있는 점을 우선했어요.">${esc(value)}</textarea></div></details>`;
  }
  function renderQuestion(q) {
    const value = answers[q.id]; let control = '';
    if (q.type === 'features') control = featureEditor();
    else if (q.type === 'screens') control = screenEditor(q);
    else if (q.type === 'references') control = referenceEditor(q);
    else if (q.type === 'flow') control = flowEditor(q);
    else if (q.type === 'scope') control = scopeEditor();
    else if (q.type === 'rows') control = rowsOf(q.id).map((row,i) => `<section class="editor-card" id="row-${q.id}-${i}">${rowHeader((q.rowLabel || '항목') + ' ' + (i+1),q.id,i)}<div class="field-grid">${q.fields.map(f => input(f.label,row[f.id] ?? '',attrs(q.id,i,f.id),f)).join('')}</div></section>`).join('') + addButton(q.id,(q.rowLabel || '항목') + ' 추가');
    else if (q.type === 'single' || q.type === 'multi') {
      const options = q.source === 'features' ? rowsOf('features').map(f => ({value:f.id,label:f.name || '이름 없는 기능'})) : R.choiceOptions(q).map(o => ({value:o,label:o}));
      control = options.length ? `<div class="choices">${options.map((o,i) => { const guide = q.source ? null : window.BriefGuides.get(q,o.value); return `<div class="choice-row"><label class="choice"><input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="${q.id}" ${attrs(q.id)} value="${esc(o.value)}" ${(q.type === 'multi' ? Array.isArray(value) && value.includes(o.value) : value === o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>${guide && o.value !== R.UNKNOWN ? `<button type="button" class="option-help" data-help="${q.id}" data-option="${i}" aria-label="${esc(o.label)} 설명">?</button>` : ''}</div>`; }).join('')}</div>` : empty('‘필요한 기능’에서 추가한 뒤 이곳에서 선택할 수 있어요.');
      if (value && (typeof value === 'string' || value.length)) control += `<button class="text-button clear-answer" type="button" data-clear="${q.id}">선택 지우기</button>`;
    } else control = q.type === 'textarea' ? `<textarea id="input-${q.id}" ${attrs(q.id)} aria-labelledby="label-${q.id}" aria-describedby="hint-${q.id}" maxlength="6000" rows="4" placeholder="${esc(q.placeholder || '')}">${esc(value)}</textarea>` : `<input id="input-${q.id}" ${attrs(q.id)} aria-labelledby="label-${q.id}" aria-describedby="hint-${q.id}" type="text" maxlength="${q.id === 'project_name' ? 200 : 6000}" value="${esc(value)}" placeholder="${esc(q.placeholder || '')}" autocomplete="off">`;
    return `<fieldset class="question" id="field-${q.id}"><legend id="label-${q.id}">${esc(q.label)}</legend>${q.help ? `<p class="question-help" id="hint-${q.id}">${esc(q.help)}</p>` : ''}${control}${reasonEditor(q)}</fieldset>`;
  }
  function renderStep(index,navigate = false) {
    const states = new Map([...document.querySelectorAll('#question-groups details[id]')].map(el => [el.id,el.open]));
    currentStep = Math.max(0,Math.min(steps.length-1,index)); const step = steps[currentStep];
    $('#form-view').hidden = false; $('#report-view').hidden = true;
    $('#page-title').textContent = step.title; $('#page-description').textContent = step.description;
    $('#step-badge').textContent = `${currentStep+1} / ${steps.length}`; $('#mobile-progress').textContent = $('#save-status').textContent;
    $('#start-note').hidden = currentStep !== 0;
    $('#step-nav').innerHTML = steps.map((s,i) => `<button type="button" class="step-link ${i === currentStep ? 'active' : ''}" data-step="${i}" ${i === currentStep ? 'aria-current="step"' : ''}><span>${String(i+1).padStart(2,'0')}</span>${esc(s.short || s.title)}</button>`).join('');
    $('#question-groups').innerHTML = R.activeGroups(step,answers).map(g => `<section class="question-group"><div class="group-heading"><h2>${esc(g.title)}</h2>${g.description ? `<p>${esc(g.description)}</p>` : ''}</div><div class="group-body">${g.questions.map(renderQuestion).join('')}</div></section>`).join('');
    for (const [id,open] of states) { const el = document.getElementById(id); if (el) el.open = open; }
    $('#previous-button').disabled = currentStep === 0; $('#next-button').textContent = currentStep === steps.length-1 ? '기획 초안 보기 →' : '다음 단계 →';
    updateProgress();
    if (navigate) { save(); setNavigation(false); window.scrollTo({top:0,behavior:'instant'}); $('#page-title').tabIndex = -1; $('#page-title').focus({preventScroll:true}); }
  }
  function setNavigation(open) { $('#sidebar').dataset.open = String(open); $('#toggle-navigation').setAttribute('aria-expanded',String(open)); }
  function changed(rerender = false) { save(); if (rerender) renderStep(currentStep); else updateProgress(); }
  function showHelp(title,guide) {
    $('#help-context').textContent = '선택을 돕는 설명'; $('#help-title').textContent = title;
    $('#help-content').innerHTML = '<dl>' + [['meaning','무엇인가요?'],['fit','언제 잘 맞나요?'],['avoid','어떤 점을 주의하나요?']].filter(([key]) => guide?.[key]).map(([key,label]) => `<div class="help-fact"><dt>${label}</dt><dd>${esc(guide[key])}</dd></div>`).join('') + '</dl>';
    $('#option-help-dialog').showModal();
  }
  function renderReport() {
    $('#form-view').hidden = true; $('#report-view').hidden = false; setNavigation(false);
    // Only our heading/list prefixes become HTML; all user text remains escaped.
    const readable = value => esc(value.replace(/\\([\\`*_\[\]#|])/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
    const body = R.report(answers,false,notes).split('\n').map(line => {
      const heading = /^(#{1,4}) (.*)$/.exec(line);
      if (heading) { const level = Math.min(heading[1].length+1,4); return `<h${level}>${readable(heading[2])}</h${level}>`; }
      if (/^\*\*.*\*\*$/.test(line)) return `<p class="report-label"><strong>${readable(line.slice(2,-2))}</strong></p>`;
      if (line.startsWith('> ')) return `<p class="report-answer">${readable(line.slice(2))}</p>`;
      return line.trim() ? `<p class="${/^[-*] /.test(line) ? 'report-item' : ''}">${readable(line.replace(/^[-*] /,'• '))}</p>` : '';
    }).join('');
    $('#report-view').innerHTML = `<div class="page-topline"><span>내 아이디어의 첫 문서</span><button type="button" class="text-button" id="back-to-form">← 작성으로 돌아가기</button></div><div class="page-heading"><h1 id="report-title" tabindex="-1">서비스 기획 초안</h1><p>작성한 내용과 미정 사항을 모았어요. 빈칸은 확정된 요구사항으로 간주하지 않아요.</p></div><div class="report-actions"><button type="button" class="button primary" id="copy-prompt">AI와 기획 다듬기 · 복사</button><button type="button" class="button secondary" id="download-report">기획 초안 내려받기</button></div><p class="field-help">복사한 내용을 원하는 AI 대화에 붙여 넣으세요. 자료를 검토하고 추가 질문을 거쳐 기획을 보완하도록 안내해요. 이 사이트에서 AI가 자동 실행되지는 않아요.</p><article class="report-document">${body}</article>`;
    window.scrollTo({top:0,behavior:'instant'}); $('#report-title').focus({preventScroll:true});
  }
  function download(text,extension,suffix,title = P.projectTitle({answers})) {
    const filename = `${title}-${suffix}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);
    const url = URL.createObjectURL(new Blob([text],{type:extension === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = filename + '.' + extension; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function backupProject(id = workspace.activeId) {
    const p = collectWorkspace().projects.find(p => p.id === id); if (!p) return;
    download(JSON.stringify({format:'buildbrief-idea',version:1,exportedAt:new Date().toISOString(),...p},null,2),'json','백업',P.projectTitle(p));
  }
  function renderProjects() {
    $('#project-list').innerHTML = collectWorkspace().projects.map(p => `<section class="project-item"><div><strong>${esc(P.projectTitle(p))}</strong><p>${p.id === workspace.activeId ? '현재 작성 중 · ' : ''}${esc(new Date(p.updatedAt).toLocaleString('ko-KR'))}</p></div><div class="inline-actions"><button type="button" class="button secondary small" data-project-open="${p.id}">열기</button><button type="button" class="text-button" data-project-rename="${p.id}">이름 변경</button><button type="button" class="text-button" data-project-backup="${p.id}">백업</button><button type="button" class="text-button danger-text" data-project-delete="${p.id}">삭제</button></div></section>`).join('');
  }
  function nameProject(id = '') {
    const p = workspace.projects.find(p => p.id === id); if (id && !p) return;
    $('#project-name-dialog').dataset.project = id; $('#project-name-title').textContent = id ? '프로젝트 이름 변경' : '새 프로젝트 만들기';
    $('#project-name-description').textContent = '프로젝트마다 답변을 따로 보관해요. 이름은 나중에 바꿀 수 있어요.';
    $('#project-name-form button[type="submit"]').textContent = id ? '이름 변경' : '프로젝트 만들기';
    $('#project-name').value = p?.answers.project_name || ''; $('#project-name-error').textContent = ''; $('#project-name-dialog').showModal(); $('#project-name').focus();
  }
  document.addEventListener('input',event => {
    const el = event.target;
    if (el.matches('textarea[data-note]') && questions.has(el.dataset.note)) {
      if (el.value) notes[el.dataset.note] = el.value; else delete notes[el.dataset.note];
      save(); return;
    }
    if (el.dataset.q && el.matches('input:not([type="checkbox"]):not([type="radio"]),textarea')) edit(el);
  });
  document.addEventListener('change',event => { const el = event.target; if (el.dataset.q && el.matches('select,input[type="checkbox"],input[type="radio"]')) edit(el); });
  function edit(el) {
    const {q:qid,row,field,element} = el.dataset;
    const object = row === undefined ? answers : rowsOf(qid)[Number(row)]; if (!object) return;
    const key = field || qid;
    if (element) { object.elementNotes ||= {}; object.elementNotes[element] = el.value; }
    else if (el.type === 'checkbox') {
      let values = Array.isArray(object[key]) ? [...object[key]] : [];
      values = el.checked ? [...new Set([...values,el.value])] : values.filter(v => v !== el.value);
      if (el.checked && exclusive.includes(el.value)) values = [el.value]; else if (el.checked) values = values.filter(v => !exclusive.includes(v));
      object[key] = values;
    } else object[key] = el.value;
    const rerender = row === undefined && el.matches('select,input[type="checkbox"],input[type="radio"]') || field === 'elements';
    changed(rerender);
    if (rerender) [...document.querySelectorAll('[data-q]')].find(c => c.dataset.q === qid && c.dataset.row === row && c.dataset.field === field && c.value === el.value)?.focus({preventScroll:true});
  }
  $('#question-form').addEventListener('submit',event => { event.preventDefault(); if (currentStep === steps.length-1) renderReport(); else renderStep(currentStep+1,true); });
  $('#project-select').addEventListener('change',event => { commitProjects({...collectWorkspace(),activeId:event.target.value}); picker(); });
  $('#project-name-form').addEventListener('submit',event => {
    event.preventDefault(); const name = $('#project-name').value.trim(); if (!name) return;
    const id = $('#project-name-dialog').dataset.project; let next = collectWorkspace();
    if (id) next = {...next,projects:next.projects.map(p => p.id === id ? {...p,answers:{...p.answers,project_name:name},updatedAt:new Date().toISOString()} : p)};
    else { const p = P.createProject({answers:{project_name:name}}); next = {...next,activeId:p.id,projects:[...next.projects,p]}; }
    if (!commitProjects(next)) return;
    $('#project-name-dialog').close(); if (id) renderProjects(); else $('#projects-dialog').close(); toast(id ? '이름을 변경했어요.' : '새 프로젝트를 만들었어요.');
  });
  document.addEventListener('click',async event => {
    const b = event.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.step !== undefined) return renderStep(Number(d.step),true);
    if (d.help) { const q = questions.get(d.help), option = R.choiceOptions(q)[Number(d.option)]; return showHelp(option,window.BriefGuides.get(q,option)); }
    if (d.featureHelp) { const f = featureTypes.find(f => f.id === d.featureHelp); return showHelp(f.label,window.BriefGuides.get('features',f.id)); }
    if (d.elementHelp) { const el = uiElements.find(e => e.id === d.elementHelp); return showHelp(el.label,el); }
    if (d.feature || d.add) {
      const qid = d.feature ? 'features' : d.add, rows = rowsOf(qid); if (rows.length >= 80) return toast('한 목록에는 최대 80개까지 추가할 수 있어요.');
      let row = {id:P.newId()};
      if (qid === 'features') row = {...row,category:d.feature || 'custom',name:featureTypes.find(f => f.id === d.feature)?.label || '',actor:'',outcome:'',priority:'아직 미정',notes:''};
      if (qid === 'screens') row = {...row,name:'',purpose:'',roles:'',featureIds:[],elements:[],elementNotes:{},content:'',empty:'',error:'',mobile:''};
      answers[qid] = [...rows,row]; changed(true);
      const card = document.getElementById(`row-${qid}-${rows.length}`); card?.scrollIntoView({block:'start',behavior:'smooth'}); card?.querySelector('input,textarea,select')?.focus({preventScroll:true}); return;
    }
    if (d.remove) { const rows = rowsOf(d.remove), index = Number(d.index); if (rows[index] && window.confirm('이 항목을 삭제할까요? 작성한 내용도 함께 삭제돼요.')) { answers[d.remove] = rows.filter((_,i) => i !== index); changed(true); document.querySelector(`[data-add="${d.remove}"]`)?.focus({preventScroll:true}); } return; }
    if (d.move !== undefined) { const rows = rowsOf('main_flow'), from = Number(d.move), to = from+Number(d.direction); if (to >= 0 && to < rows.length) { [rows[from],rows[to]] = [rows[to],rows[from]]; changed(true); document.getElementById(`row-main_flow-${to}`)?.querySelector('select')?.focus({preventScroll:true}); } return; }
    if (d.clear) { delete answers[d.clear]; return changed(true); }
    if (d.projectOpen) { if (commitProjects({...collectWorkspace(),activeId:d.projectOpen})) $('#projects-dialog').close(); return; }
    if (d.projectRename) return nameProject(d.projectRename);
    if (d.projectBackup) return backupProject(d.projectBackup);
    if (d.projectDelete) { $('#delete-project-dialog').dataset.project = d.projectDelete; $('#delete-project-name').textContent = P.projectTitle(workspace.projects.find(p => p.id === d.projectDelete)); $('#delete-project-error').textContent = ''; return $('#delete-project-dialog').showModal(); }
    switch (b.id) {
      case 'previous-button': return renderStep(currentStep-1,true);
      case 'report-button': return renderReport();
      case 'back-to-form': return renderStep(currentStep,true);
      case 'toggle-navigation': return setNavigation($('#sidebar').dataset.open !== 'true');
      case 'save-help-button': return $('#storage-help-dialog').showModal();
      case 'close-storage-help': return $('#storage-help-dialog').close();
      case 'close-option-help': return $('#option-help-dialog').close();
      case 'manage-projects': $('#projects-error').textContent = ''; renderProjects(); return $('#projects-dialog').showModal();
      case 'close-projects': return $('#projects-dialog').close();
      case 'add-project': case 'create-project': return nameProject();
      case 'cancel-project-name': return $('#project-name-dialog').close();
      case 'cancel-delete-project': return $('#delete-project-dialog').close();
      case 'confirm-delete-project': {
        const id = $('#delete-project-dialog').dataset.project, next = collectWorkspace(); next.projects = next.projects.filter(p => p.id !== id);
        if (!next.projects.length) next.projects.push(P.createProject()); if (next.activeId === id) next.activeId = next.projects[0].id;
        if (commitProjects(next)) { $('#delete-project-dialog').close(); renderProjects(); } return;
      }
      case 'export-all-projects': return download(JSON.stringify({format:'buildbrief-ideas',...collectWorkspace(),exportedAt:new Date().toISOString()},null,2),'json','전체백업','buildbrief');
      case 'export-answers': case 'storage-backup': return backupProject();
      case 'storage-original': if (originalStorage !== null) download(originalStorage,'json','복구용원본'); return;
      case 'import-answers': return $('#import-file').click();
      case 'download-report': return download(R.report(answers,false,notes),'md','기획초안');
      case 'copy-prompt': try { await navigator.clipboard.writeText(R.report(answers,true,notes)); toast('기획 초안과 AI에게 전달할 요청을 복사했어요.'); } catch { download(R.report(answers,true,notes),'md','AI기획요청'); toast('복사가 허용되지 않아 파일로 내려받았어요.'); } return;
    }
  });
  $('#import-file').addEventListener('change',async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 16*1024*1024) throw new Error('16MB 이하의 백업 파일을 선택해 주세요.');
      const incoming = P.importBackup(JSON.parse(await file.text()));
      if (loadFailed && !window.confirm('읽지 못한 저장 원본을 백업으로 복구할까요? 먼저 저장 안내에서 원본과 새로 입력한 내용을 각각 백업해 주세요.')) return;
      if (commitProjects({...incoming,projects:[...(loadFailed ? [] : collectWorkspace().projects),...incoming.projects]},loadFailed)) toast(`프로젝트 ${incoming.projects.length}개를 추가했어요.`);
    } catch (error) { toast(error instanceof SyntaxError ? '올바른 JSON 백업 파일이 아니에요.' : error.message); }
    finally { event.target.value = ''; }
  });
  $('.brand').addEventListener('click',event => { event.preventDefault(); renderStep(0,true); });
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && $('#sidebar').dataset.open === 'true') { setNavigation(false); $('#toggle-navigation').focus(); } });
  window.addEventListener('storage',event => { if (event.key === P.KEY || event.key === null) { externalChange = true; status('다른 탭 변경 · 백업 후 새로고침'); toast('자동 저장을 멈췄어요. 이 탭의 답변을 백업한 뒤 새로고침해 주세요.'); } });
  if (!loadFailed && storedRaw === null) save();
  else if (!loadFailed) status('이 브라우저에 저장됨');
  renderStep(currentStep);
  if (loadFailed) { status('저장 읽기 실패 · 원본 보존 중'); toast('기존 저장 내용을 읽지 못했어요. 저장 안내에서 원본을 백업할 수 있어요.'); }
})();
