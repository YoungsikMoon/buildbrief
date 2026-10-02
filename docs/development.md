# 개발과 검증

[프로젝트 안내·문서 목차](../README.md) · [기여 안내](../CONTRIBUTING.md) · [배포와 버전 관리](release-and-deployment.md)

로컬 개발 환경, 소스 파일의 역할, 수정 후 검증과 자산 갱신 방법을 확인할 때 읽습니다.

## 실행 환경

HTML·CSS·JavaScript로 만든 정적 사이트입니다. 앱 실행에 백엔드, 데이터베이스, AI API 키, npm 패키지 설치가 필요하지 않습니다. Git·Python 3을 사용하는 실행 명령은 [README의 로컬 실행](../README.md#로컬-실행)을 참고하세요.

서버는 실행한 터미널을 유지하며 종료할 때는 `Ctrl+C`를 누릅니다. 기본 로컬 서버에는 Cloudflare의 `_headers` 설정이 적용되지 않습니다. 실제 응답 헤더의 검증은 [보안 검증 절차](security/verification.md)를 따릅니다.

## 수정 후 검증

검증에는 Node.js를 사용하며 GitHub Actions와 Pages 빌드는 **Node.js 24**로 설정되어 있습니다. 로컬 서버와 별도의 터미널에서 저장소 루트를 열고 실행하세요.

```sh
node check.cjs
node scripts/planning-template.cjs --check
node scripts/release.cjs --test
node scripts/build.cjs --test
```

질문 표시 조건, 진행률, 기능·화면 연결, 로그인 조합, 보고서 출력, 입력 검증, 프로젝트 분리, 백업 호환성, 버전 발급과 배포 버전 표시를 검사합니다. 브라우저에서는 수정한 입력 흐름과 PC·모바일 화면도 확인하세요.

시작 안내의 미리보기와 예시 갤러리는 `node scripts/check-guide-browser.cjs`로 확인할 수 있습니다. 이 선택 검사는 개발 환경의 Playwright와 Chrome을 사용합니다. Playwright가 모듈 검색 경로에 없다면 `PLAYWRIGHT_MODULE`에 설치된 모듈의 절대 경로를 지정하세요. 별도 브라우저에서 로컬 서버와 CSP를 적용해 320·390·1001·1440px의 첫 화면 목적·시작 버튼·결과 예시 노출, 과정별 미리보기·원본 링크, 네 단계 사용법의 이전·다음·직접 이동과 작성 시작, 안내 중 답변 보존, 시작과 작성 화면의 메뉴 전환·프로젝트 관리 열기, 키보드·버튼 조작과 기획 내용 펼치기, 이미지 로딩, 글자 확대와 기존 답변 보존을 검사합니다. `BUILDBRIEF_TEST_URL`로 검증할 배포 주소, `GUIDE_SCREENSHOTS`로 화면 저장 디렉터리를 지정할 수 있습니다. 앱 실행이나 배포 빌드에는 Playwright가 필요하지 않습니다.

JS·CSS를 수정하면 `dist/index.html`의 해당 `?v=` 값도 갱신해야 합니다. 값은 파일의 줄바꿈을 LF로 맞춘 내용의 **SHA-256 앞 12자리**이며 `check.cjs`가 일치 여부를 검사합니다. 전체 로컬 빌드 검증은 `node scripts/build.cjs`로 실행할 수 있습니다. 이 명령은 위 검사를 실행하고 HTML의 앱 버전 표시를 `개발 버전`으로 설정합니다.

자연어 화면 편집은 `node scripts/check-planning-browser.cjs`로 검증합니다. 같은 `PLAYWRIGHT_MODULE` 환경을 사용하고 `PLANNING_SCREENSHOTS`로 화면 저장 위치를 지정합니다. 별도 Chrome 320·390·1440px에서 캔버스·중첩 추가, 이름·설명 입력과 레벨 숫자 입력, 참고 자료의 분류 전환·높이 제한·이미지·기능 도움말과 답변 불변, 마우스·터치·키보드 크기 조절과 취소, 정렬·삭제·자식 보존, 공통 요소 적용, 접기·열기, 초안·AI 복사·파일·백업 왕복, 기존 구조화된 기록 보존과 200% 글자 확대를 확인합니다. 요소 이름 바로 옆 +의 32px 누름 영역·이름 갱신·키보드 추가·위치 이동과 명시적 부모 변경, 추가용 빈 줄 제거도 확인합니다. 마우스·터치로 64px까지 축소, 키보드로 800px 초과 확대와 새로고침·백업 보존을 확인합니다. 1920px에서는 추가 폭을, 2536×1306에서는 추가 높이를 캔버스에 할당하고 단계 이동이 작업 영역 아래에 놓이는지 확인합니다. 별도 기능 질문은 기존 프로젝트에서도 다시 나타나지 않아야 합니다.

`scripts/check-selection-browser.cjs`는 같은 전체 검사에 포함됩니다. `node scripts/check-planning-browser.cjs --selection-only`로 영역 선택·수정 키 선택·터치 취소·묶음 드래그와 방향 이동·확대 배율·경계 제한·충돌 전체 복원·부모/자식 중복 이동 방지·서로 다른 부모의 좌표 변환·숨김/상속 제외·화면 전환과 저장 데이터 불변을 집중 검사할 수 있습니다. 선택 UI는 `designerState`에만 두고, 이동은 기존 `placements.position`과 충돌 검사를 재사용합니다.

`scripts/check-hierarchy-browser.cjs`는 부모 이름 표시·연필 편집·취소·공통 이름 반영, 같은 화면의 중복 이름 거부와 화면 간 허용, 입력 인코딩·기존 이름 보존, 이동·드롭·포인터/키보드 크기·너비·레벨 충돌 거부와 복원, 부모 +1·최대 레벨, 200% 확대·새로고침·백업을 검사합니다. 이름은 Enter 또는 입력칸을 벗어날 때 저장되므로 검사에서도 실제 완료 동작을 수행합니다. `node scripts/check-planning-browser.cjs --hierarchy-only`로 이 흐름만 확인할 수 있습니다. 겹치는 드롭과 부모 밖 드롭이 기존 소속을 유지하는지, 부모 선택·취소는 저장하지 않는지, 명시적 적용만 부모와 레벨을 바꾸는지, 순환·최대 레벨 제한과 변경한 레벨의 숨김 해제를 함께 검사합니다. 소속 변경·분리에서 실제 픽셀 너비/높이와 중첩 자식 크기가 50%·200% 배율에서도 유지되는지, 작은 대상 거부와 부모 삭제 시 보이지 않는 8192px 화면의 1% 미만 너비·새로고침·백업 보존을 검사합니다.

편집 사용법은 `node scripts/check-planning-browser.cjs --manual-only`로 집중 검증합니다. 320·390·1440px에서 키보드 열기·항목 펼치기·7개 그림 예시의 결과/처음 전환·상세 규칙 펼치기·스크롤 중 닫기·200% 글자 확대·Escape와 초점 복귀·크게 보기 안에서 열람·선택과 저장 자료 보존을 확인하며, 전체 편집기 검사에도 포함됩니다.

## 파일 구성

`scripts/check-grid-browser.cjs`는 화면 편집 브라우저 검사에서 함께 실행합니다. 고정 작업면의 창 크기 독립성, 배율·화면 맞춤·미니맵 클릭/키보드·마우스/터치 팬 이동·켜기/끄기, 50% 드롭과 50%·200% 포인터 크기 변환, 현재 뷰 근처 추가·작업면 설정의 정수 경계·새 화면 크기 상속·저장/초안/백업을 함께 확인합니다. `check-planning.cjs`는 이전 구역 이전의 멱등성·관계 보존과 선택적 canvas 필드의 경계·허용 키를 검사합니다. 점 격자 좌우·상하 배치, 의도적인 겹침 허용과 이웃 좌표 보존, 너비·높이 조절, 실제 끌어 놓기의 자유 좌표 저장, 중첩·공통 요소, 크게 보기·Escape·도움말·초점 복원, 1024×768 작업 공간, 새로고침·초안·백업 왕복을 확인합니다. 화면·요소 기본 이름 번호, 삭제 후 이름 충돌 방지, 화면·요소·참고 탭 전환·키보드·선택과 입력 보존도 같은 검사에서 확인합니다. `scripts/check-layers-browser.cjs`는 실제 겹침 지점의 앞 요소, 선택/이동 시 순서 보존, 캔버스 추가의 1레벨 기본값·중첩 추가의 부모 레벨 +1·직접 숫자 입력·오류와 범위 경계·화살표 연속 조작·겹치는 같은 레벨로 변경 거부·다른 요소의 레벨 보존을 확인합니다. 레벨별 묶음 보기·변경한 레벨의 숨김 해제·화면별 독립 상태·중첩 요소·Escape·200% 글자 확대·새로고침·초안·백업 왕복도 검사합니다.

| 파일 | 역할 |
| --- | --- |
| [dist/index.html](../dist/index.html) | 페이지 구조, 대화 상자, 자산 참조와 버전 표시 영역 |
| [dist/questions.js](../dist/questions.js) | 6단계 질문, 표시 조건, 기능 후보, 화면 요소 |
| [dist/guides.js](../dist/guides.js) | 선택지별 도움말 |
| [dist/planning-template.js](../dist/planning-template.js) | 문서 원본에서 생성한 개발 준비 템플릿의 버전·본문 |
| [dist/app.js](../dist/app.js) | 앱 시작, 화면 이동, 이벤트 연결, 프로젝트 관리 UI, 내보내기 |
| [dist/answers.js](../dist/answers.js) | 답변·메모 검증, 질문 표시 조건, 진행률, 선택지·입력 상한 |
| [dist/designer.js](../dist/designer.js) | 공통/개별 화면 배치, 요소·기능 참고 자료와 안전한 미리보기 |
| [dist/views.js](../dist/views.js) | 질문·기능·화면 편집기와 초안 HTML 생성, HTML 이스케이프 |
| [dist/report.js](../dist/report.js) | 기획 초안·AI 전달문 텍스트 생성 |
| [dist/storage.js](../dist/storage.js) | 브라우저 저장 읽기·쓰기, 실패·복구 상태, 다른 탭 변경 감지 |
| [dist/projects.js](../dist/projects.js) | 프로젝트 저장·백업 형식과 가져오기 검증 |
| [dist/styles.css](../dist/styles.css) | PC·모바일 레이아웃 |
| [dist/element-examples/](../dist/element-examples/) | 화면 요소 30개의 생성 이미지 예시 (WebP) |
| [dist/idea-examples/](../dist/idea-examples/) | 시작 안내의 가상 서비스 화면 3개 (WebP) |
| [dist/_headers](../dist/_headers) | Cloudflare Pages의 보안·캐시 응답 헤더 |
| [SECURITY.md](../SECURITY.md) | 보안 문서 목차, 작업별 읽는 순서와 문서 갱신 규칙 |
| [docs/security/](../docs/security/) | 주제별 ASVS 적용 범위·점검표·운영 기준·검증 이력 |
| [check.cjs](../check.cjs) | 앱 회귀 검사, 공개 파일·스크립트 순서·자산 해시 검사 |
| [scripts/check-planning.cjs](../scripts/check-planning.cjs) | 단계 위치 이전, 요소별 항목·추천 범위, 백업·입력 경계 검사 (`check.cjs`에 포함) |
| [scripts/planning-template.cjs](../scripts/planning-template.cjs) | 개발 준비 요청문 정적 생성과 `--check` 최신 여부 검사 |
| [scripts/check-planning-browser.cjs](../scripts/check-planning-browser.cjs) | PC·모바일의 로그인·역할→화면·기능·동작→초안·백업 흐름 검사 (선택 실행) |
| [scripts/check-runtime.cjs](../scripts/check-runtime.cjs) | 저장 실패·충돌·복구와 화면 출력 검사 (`check.cjs`에서 함께 실행) |
| [scripts/check-guide-browser.cjs](../scripts/check-guide-browser.cjs) | 시작 안내 예시의 반응형·키보드·내용 펼치기·저장 분리 검사 (선택 실행) |
| [scripts/release.cjs](../scripts/release.cjs) | 날짜별 Git 태그와 GitHub Release 발급 |
| [scripts/build.cjs](../scripts/build.cjs) | 빌드 검증과 배포 커밋의 앱 버전 표시 |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Pull Request·main 검증과 자동 릴리스 |
| [wrangler.jsonc](../wrangler.jsonc) | Pages 프로젝트 이름과 공개 디렉터리 설정 |

개발 준비 템플릿의 저장·이전 백업·엄격한 형식 검증은 `check.cjs`가 `scripts/check-template-storage.cjs`와 함께 검사합니다. `scripts/check-planning-browser.cjs`는 `scripts/check-template-browser.cjs`를 통해 프롬프트 대화상자·기본/고급 전환·비교 도움말·키보드 초점 복귀·프로젝트별 편집·복원 취소/확인·새로고침·백업 왕복과 실제 클립보드·실패 시 파일·미리보기의 일치도 확인합니다. 운영체제의 클립보드 줄바꿈 변환은 비교에서 정규화합니다.

## 모듈을 수정하는 기준

- 질문과 도움말의 내용·표시 조건은 `questions.js`, 답변 형식과 공통 제한은 `answers.js`에서 관리합니다. 같은 선택지나 상한을 화면 코드에 다시 선언하지 않습니다.
- `questions.js`의 `retiredQuestions`는 제거한 질문의 기존 저장·백업을 검증하고 초안에서 보존하기 위한 허용 목록입니다. 작성 화면·진행률에는 넣지 않습니다. 마무리 메모의 `optional` 표시는 진행률과 미정 질문 목록에서 제외하며, `allowReason: false`는 새 이유 입력을 생략하되 이미 남긴 이유는 보존해 표시합니다.
- `report.js`는 문서 텍스트, `views.js`·`designer.js`는 HTML을 반환합니다. 이 모듈들은 저장소나 실제 DOM을 변경하지 않습니다. 시각 편집은 `designer.js`가 외곽·배치·팔레트를, `views.js`가 선택 대상의 입력을 만듭니다. 편집 중 선택한 화면·요소·패널은 `app.js`의 임시 상태이며 프로젝트 전환 때 초기화합니다. 사용자 입력의 이스케이프와 질문·답변·이유의 경계를 유지하세요.
- 화면 초안은 편집기와 같은 `layoutItems`와 `canvasGeometry`를 사용합니다. 기획용 박스의 고정 32px 이름 줄, 테두리·패딩과 자식 영역 원점(5,45), 내부 높이 여유를 공유하며 CSS 변경 시 계산도 함께 검증합니다. 긴 이름은 줄임표로 표시하되 전체 접근 가능한 이름은 유지합니다. 확대·스크롤·편집 필터는 기획 좌표를 바꾸지 않습니다. 이전 구역 자료는 복사본만 `prepareCanvases`로 이전해 원본을 보존합니다. `check-planning-json.cjs`는 원본 값·소속·공통 상속·bbox·인코딩을, `check-geometry-browser.cjs`는 320·390·1440px와 50/100/200%·화면 맞춤에서 실제 DOM 경계와 JSON을 비교합니다. 선택하지 않은 유형의 과거 내용은 제외하지만 편집 필터로 숨기거나 가려진 배치 요소는 모두 포함합니다.
- AI 전달문은 기존 기획 지침 + 고급 원문(선택) + 공통 지침 + JSON입니다. `buildbrief-planning` schemaVersion 1은 질문·이유·현재/이전 구분, 역할·기능·화면·요소·필드·동작·추천·미결정을 담습니다. `bbox`는 화면 절대 CSS px의 두 경계점이며 자식도 같은 원점입니다. 인간용 Markdown과 HTML 초안은 계속 제공하고 기준/전체 화면 크기와 bbox를 추가합니다. 복원용 백업 형식과 저장 키는 유지합니다.
- `projects.js`는 저장·백업 형식을 검증하고, `storage.js`는 읽기·쓰기 실패와 다른 탭의 변경을 처리합니다. UI 안내와 프로젝트 전환은 `app.js`에서 연결합니다. 저장 키와 백업 버전은 기존 값을 유지합니다.
- 고급 원본은 `docs/planning-template/request-template.md`, 공통 원본은 `docs/planning-template/common-instructions.md`입니다. 원문과 `scripts/planning-template.cjs`의 버전을 갱신한 뒤 `node scripts/planning-template.cjs`로 생성하고 `--check`로 일치 여부를 검사합니다. 기본 버전은 `2026-10-02.1`이며 생성 파일의 `version`, `text`, `common`은 LF로 정규화한 정적 자료입니다. 저장용 `planningTemplate`에는 공통 지침을 복제하지 않으므로 모듈 객체를 그대로 펼쳐 저장하지 않습니다. 브라우저는 원문을 별도 요청하거나 동적으로 실행하지 않습니다. `dist/planning-template.js`는 직접 편집하지 않습니다.
- 프로젝트의 `planningTemplate`은 `null` 또는 `{ enabled, version, text }`로 저장합니다. 기존 기록에 필드가 없으면 `null`로 받아 기본 모드로 시작합니다. 기존 추가 요청의 내용 상한은 30,000자이며 모드 전환·기본 버전 갱신으로 저장 문구를 지우거나 자동 교체하지 않습니다. `report.js`는 고급 모드이고 비어 있지 않은 추가 요청만 자동 생성한 AI 전달문에 포함하며, 일반 기획 초안에는 포함하지 않습니다. 전체 수정본이 있으면 아래 규칙을 우선 적용합니다.
- 전체 프롬프트 직접 편집은 `promptDrafts`의 선택적인 `basic`·`advanced` 문자열에 따로 저장합니다. 키가 없으면 현재 답변에서 생성하고 빈 문자열은 그대로 유지합니다. `projects.js`가 모드 허용 목록·각 1,000,000자 상한·자료형을 검사하고 이전 백업은 `{}`로 보완합니다. `report.js`의 여섯 번째 인자가 수정본이며 AI 프롬프트에만 적용합니다. UI는 생성·수정본을 하나의 textarea에 표시하고 그 값을 그대로 복사합니다. 복원은 현재 모드의 수정본만 삭제하며, 고급이면 기존 추가 템플릿도 현재 원문으로 복원합니다. 수정본을 새 답변으로 자동 덮어쓰지 않습니다.
- 브라우저는 `index.html`의 순서대로 모듈을 불러옵니다. Node 검사에서는 같은 파일을 `require`합니다. 현재 순서는 questions → answers → planning-template → report → projects → guides → storage → designer → views → app입니다. designer의 HTML 이스케이프·예시 이미지는 렌더링 시 views의 기존 함수를 재사용합니다. 파일을 추가·이동하면 HTML, `check.cjs`의 공개 파일 목록·순서·해시 검사, 관련 보안 문서의 코드 경로도 함께 갱신하세요.
- 화면 요소 이미지는 `questions.js`의 요소 ID와 같은 이름의 WebP만 공개합니다. `check.cjs`가 정확한 목록·파일 유형·용량 상한을 확인합니다. 새 이미지는 [UI 기준](ui-guidelines.md#화면-요소-예시)에 따라 수동 검수하고, 생성 프롬프트와 원본·개발용 파일은 공개 폴더에 넣지 않습니다. 이미지 생성 도구는 빌드 의존성이 아닙니다.

## 코드 정렬

실행·빌드에는 외부 npm 패키지가 필요하지 않습니다. 소스 정렬에는 필요할 때만 아래 고정 버전 명령을 사용합니다. HTML 템플릿은 공백이 입력값이나 배치에 영향을 줄 수 있어 `strict` 옵션을 유지하고 브라우저에서 확인합니다.

```sh
npm exec --yes --package=prettier@3.6.2 -- prettier --write --single-quote --print-width 100 --trailing-comma none --html-whitespace-sensitivity strict "dist/*.js" dist/styles.css
```

정렬 후 `node scripts/planning-template.cjs`로 생성 파일의 형식을 복원하고 자산 해시를 갱신한 뒤 검증해야 합니다. CSS는 기존 선언 순서를 유지해 화면별 우선순위가 바뀌지 않도록 합니다.

상세 문서의 역할과 진입점은 [README 목차](../README.md#문서-안내)에서 확인합니다. 동작을 바꾸면 해당 주제 문서를 갱신하고, 보안 관련 변경은 [SECURITY.md](../SECURITY.md)에서 관련 모듈을 찾아 검토합니다.
