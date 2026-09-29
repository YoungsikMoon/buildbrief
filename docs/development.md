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
node scripts/release.cjs --test
node scripts/build.cjs --test
```

질문 표시 조건, 진행률, 기능·화면 연결, 로그인 조합, 보고서 출력, 입력 검증, 프로젝트 분리, 백업 호환성, 버전 발급과 배포 버전 표시를 검사합니다. 브라우저에서는 수정한 입력 흐름과 PC·모바일 화면도 확인하세요.

시작 안내의 예시 넘기기는 `node scripts/check-guide-browser.cjs`로 확인할 수 있습니다. 이 선택 검사는 개발 환경의 Playwright와 Chrome을 사용합니다. Playwright가 모듈 검색 경로에 없다면 `PLAYWRIGHT_MODULE`에 설치된 모듈의 절대 경로를 지정하세요. 별도 브라우저에서 로컬 서버와 CSP를 적용해 320·390·1001·1440px, 키보드·버튼·터치 이동, 이미지 로딩, 글자 확대와 기존 답변 보존을 검사합니다. `BUILDBRIEF_TEST_URL`로 검증할 배포 주소, `GUIDE_SCREENSHOTS`로 화면 저장 디렉터리를 지정할 수 있습니다. 앱 실행이나 배포 빌드에는 Playwright가 필요하지 않습니다.

JS·CSS를 수정하면 `dist/index.html`의 해당 `?v=` 값도 갱신해야 합니다. 값은 파일의 줄바꿈을 LF로 맞춘 내용의 **SHA-256 앞 12자리**이며 `check.cjs`가 일치 여부를 검사합니다. 전체 로컬 빌드 검증은 `node scripts/build.cjs`로 실행할 수 있습니다. 이 명령은 위 검사를 실행하고 HTML의 앱 버전 표시를 `개발 버전`으로 설정합니다.

화면·기능 연결과 폼·표 편집은 `node scripts/check-planning-browser.cjs`로 검증합니다. 같은 `PLAYWRIGHT_MODULE` 환경을 사용하고, `PLANNING_SCREENSHOTS`로 화면 저장 위치를 지정할 수 있습니다. 별도 Chrome에서 320·390·1440px, 로그인 선택·역할 추가/이름 변경/삭제·80개 역할의 검색/복수 선택/스크롤·접힌 기능 삭제와 취소·공유 기능 수정·화면/요소 동작·초안·백업 왕복과 200% 글자 확대를 확인합니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| [dist/index.html](../dist/index.html) | 페이지 구조, 대화 상자, 자산 참조와 버전 표시 영역 |
| [dist/questions.js](../dist/questions.js) | 6단계 질문, 표시 조건, 기능 후보, 화면 요소 |
| [dist/guides.js](../dist/guides.js) | 선택지별 도움말 |
| [dist/app.js](../dist/app.js) | 앱 시작, 화면 이동, 이벤트 연결, 프로젝트 관리 UI, 내보내기 |
| [dist/answers.js](../dist/answers.js) | 답변·메모 검증, 질문 표시 조건, 진행률, 선택지·입력 상한 |
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
| [scripts/check-planning-browser.cjs](../scripts/check-planning-browser.cjs) | PC·모바일의 로그인·역할→화면·기능·동작→초안·백업 흐름 검사 (선택 실행) |
| [scripts/check-runtime.cjs](../scripts/check-runtime.cjs) | 저장 실패·충돌·복구와 화면 출력 검사 (`check.cjs`에서 함께 실행) |
| [scripts/check-guide-browser.cjs](../scripts/check-guide-browser.cjs) | 시작 안내 예시의 반응형·키보드·터치·저장 분리 검사 (선택 실행) |
| [scripts/release.cjs](../scripts/release.cjs) | 날짜별 Git 태그와 GitHub Release 발급 |
| [scripts/build.cjs](../scripts/build.cjs) | 빌드 검증과 배포 커밋의 앱 버전 표시 |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Pull Request·main 검증과 자동 릴리스 |
| [wrangler.jsonc](../wrangler.jsonc) | Pages 프로젝트 이름과 공개 디렉터리 설정 |

## 모듈을 수정하는 기준

- 질문과 도움말의 내용·표시 조건은 `questions.js`, 답변 형식과 공통 제한은 `answers.js`에서 관리합니다. 같은 선택지나 상한을 화면 코드에 다시 선언하지 않습니다.
- `questions.js`의 `retiredQuestions`는 제거한 질문의 기존 저장·백업을 검증하고 초안에서 보존하기 위한 허용 목록입니다. 작성 화면·진행률에는 넣지 않습니다. 마무리 메모의 `optional` 표시는 진행률과 미정 질문 목록에서 제외하며, `allowReason: false`는 새 이유 입력을 생략하되 이미 남긴 이유는 보존해 표시합니다.
- `report.js`는 문서 텍스트, `views.js`는 HTML을 반환합니다. 이 두 모듈은 저장소나 실제 DOM을 변경하지 않습니다. 사용자 입력의 이스케이프와 질문·답변·이유의 경계를 유지하세요.
- `projects.js`는 저장·백업 형식을 검증하고, `storage.js`는 읽기·쓰기 실패와 다른 탭의 변경을 처리합니다. UI 안내와 프로젝트 전환은 `app.js`에서 연결합니다. 저장 키와 백업 버전은 기존 값을 유지합니다.
- 브라우저는 `index.html`의 순서대로 모듈을 불러옵니다. Node 검사에서는 같은 파일을 `require`합니다. 파일을 추가·이동하면 HTML, `check.cjs`의 공개 파일 목록·순서·해시 검사, 관련 보안 문서의 코드 경로도 함께 갱신하세요.
- 화면 요소 이미지는 `questions.js`의 요소 ID와 같은 이름의 WebP만 공개합니다. `check.cjs`가 정확한 목록·파일 유형·용량 상한을 확인합니다. 새 이미지는 [UI 기준](ui-guidelines.md#화면-요소-예시)에 따라 수동 검수하고, 생성 프롬프트와 원본·개발용 파일은 공개 폴더에 넣지 않습니다. 이미지 생성 도구는 빌드 의존성이 아닙니다.

## 코드 정렬

실행·빌드에는 외부 npm 패키지가 필요하지 않습니다. 소스 정렬에는 필요할 때만 아래 고정 버전 명령을 사용합니다. HTML 템플릿은 공백이 입력값이나 배치에 영향을 줄 수 있어 `strict` 옵션을 유지하고 브라우저에서 확인합니다.

```sh
npm exec --yes --package=prettier@3.6.2 -- prettier --write --single-quote --print-width 100 --trailing-comma none --html-whitespace-sensitivity strict "dist/*.js" dist/styles.css
```

정렬 뒤에도 자산 해시를 갱신하고 검증해야 합니다. CSS는 기존 선언 순서를 유지해 화면별 우선순위가 바뀌지 않도록 합니다.

상세 문서의 역할과 진입점은 [README 목차](../README.md#문서-안내)에서 확인합니다. 동작을 바꾸면 해당 주제 문서를 갱신하고, 보안 관련 변경은 [SECURITY.md](../SECURITY.md)에서 관련 모듈을 찾아 검토합니다.
