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

JS·CSS를 수정하면 `dist/index.html`의 해당 `?v=` 값도 갱신해야 합니다. 값은 파일의 줄바꿈을 LF로 맞춘 내용의 **SHA-256 앞 12자리**이며 `check.cjs`가 일치 여부를 검사합니다. 전체 로컬 빌드 검증은 `node scripts/build.cjs`로 실행할 수 있습니다. 이 명령은 위 검사를 실행하고 HTML의 앱 버전 표시를 `개발 버전`으로 설정합니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| [dist/index.html](../dist/index.html) | 페이지 구조, 대화 상자, 자산 참조와 버전 표시 영역 |
| [dist/questions.js](../dist/questions.js) | 9단계 질문, 표시 조건, 기능 후보, 화면 요소 |
| [dist/guides.js](../dist/guides.js) | 선택지별 도움말 |
| [dist/app.js](../dist/app.js) | 입력 편집기, 진행률 표시, 자동 저장, 프로젝트 관리, 내보내기 |
| [dist/report.js](../dist/report.js) | 입력 검증, 조건과 진행률 계산, 기획 초안·AI 전달문 |
| [dist/projects.js](../dist/projects.js) | 프로젝트 저장·백업 형식과 가져오기 검증 |
| [dist/styles.css](../dist/styles.css) | PC·모바일 레이아웃 |
| [dist/_headers](../dist/_headers) | Cloudflare Pages의 보안·캐시 응답 헤더 |
| [SECURITY.md](../SECURITY.md) | 보안 문서 목차, 작업별 읽는 순서와 문서 갱신 규칙 |
| [docs/security/](../docs/security/) | 주제별 ASVS 적용 범위·점검표·운영 기준·검증 이력 |
| [check.cjs](../check.cjs) | 앱 회귀 검사와 자산 해시 검사 |
| [scripts/release.cjs](../scripts/release.cjs) | 날짜별 Git 태그와 GitHub Release 발급 |
| [scripts/build.cjs](../scripts/build.cjs) | 빌드 검증과 배포 커밋의 앱 버전 표시 |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Pull Request·main 검증과 자동 릴리스 |
| [wrangler.jsonc](../wrangler.jsonc) | Pages 프로젝트 이름과 공개 디렉터리 설정 |

상세 문서의 역할과 진입점은 [README 목차](../README.md#문서-안내)에서 확인합니다. 동작을 바꾸면 해당 주제 문서를 갱신하고, 보안 관련 변경은 [SECURITY.md](../SECURITY.md)에서 관련 모듈을 찾아 검토합니다.
