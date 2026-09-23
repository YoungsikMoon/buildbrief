# 빌드브리프

아이디어만 있는 사람이 문제, 사용자, 기능과 화면을 정리하는 서비스 기획 도구입니다. HTML·CSS·JavaScript만 사용하며 입력을 서버에 전송하지 않습니다.

## 작성 흐름

아이디어 소개 → 문제와 기존 방법 → 사용할 사람과 환경 → 필요한 기능 → 대표 이용 과정 → 로그인과 사용자 구분 → 자료와 기본 규칙 → 참고 자료와 디자인 방향 → 화면 구성 → 첫 버전 검토.

기능 후보를 추가한 뒤 실제 기능 이름·사용자·기대 결과·우선순위를 적습니다. 그 기능을 이용 순서와 화면에 연결하며, 화면마다 작은 그림과 설명을 보고 여러 UI 요소를 함께 고릅니다. 로그인은 범위와 수단을 구분하고 자체 로그인과 소셜 로그인을 함께 선택할 수 있습니다. 예약·결제·파일·위치 등은 해당 기능을 선택했을 때만 후속 질문을 보여 줍니다. 참고 URL은 한 줄씩 보관하며 내용을 자동 열람하지 않습니다.

각 질문 아래의 ‘답변·선택 이유 남기기’에서 내 상황과 판단 근거를 선택적으로 적을 수 있습니다. 반복 안내 없이 빈 입력란에 자유롭게 기록합니다. 이유는 답변과 별도로 자동 저장하며 기획 초안·AI 전달문·JSON 백업에 함께 담습니다.

기능·화면·로그인 방법 등 대안을 비교할 질문에는 ‘AI에 추천 요청’을 제공합니다. 요청은 기존 답변과 별도로 저장하며, 기획 초안의 요청 목록과 AI 전달문에 포함됩니다. 실제 문제·기존 방법·참고 URL 같은 사실 정보에는 추천 요청을 붙이지 않습니다. 목록 밖 답변이 가능한 선택 질문은 ‘직접 입력’을 고르면 해당 내용을 적는 후속 질문을 보여 줍니다.

결과물은 **서비스 기획 초안**입니다. 비어 있는 정보와 미정 사항을 확인하고 AI와 함께 기획을 보완할 수 있는 요청문을 복사하거나 Markdown 파일을 내려받습니다. 자동 AI 호출·코드 생성·기술 스택 결정은 하지 않습니다. 질문에 응답한 개수를 기획 완성도나 전문성으로 평가하지 않습니다.

사이드바에는 현재 표시되는 질문을 기준으로 작성 진행률과 대항목별 ‘작성한 질문 / 전체 질문’을 표시합니다. 조건에 따라 숨겨진 답변, 선택 이유 메모, AI 추천 요청은 작성 수에 더하지 않습니다. 첫 버전의 기능 우선순위 검토는 등록한 모든 기능의 출시 범위를 정했을 때 반영합니다.

## 저장과 백업

- 같은 기기·브라우저·사이트 주소의 localStorage에 여러 프로젝트를 독립적으로 저장합니다. 새로고침 후에도 이어서 작성합니다.
- 사이트 데이터 삭제, 시크릿 모드 종료, 브라우저 초기화 등에는 사라질 수 있으므로 JSON 백업을 권장합니다. 저장 실패나 다른 탭의 변경을 감지하면 덮어쓰기를 멈추고 안내합니다.
- 새 모델은 `buildbrief.ideas.v1`을 사용합니다. 기존 기술 설계 질문지의 저장 키는 삭제하지 않지만 새 질문으로 자동 변환하거나 읽어 오지는 않습니다.
- 새 단일 백업 형식은 `buildbrief-idea`, 전체 백업은 `buildbrief-ideas`입니다. 가져오기는 검증 후 새로운 ID로 추가하며 현재 프로젝트를 덮어쓰지 않습니다. 입력 중인 URL도 문자 그대로 보존하고 안전한 http(s) URL인지 별도로 확인합니다.
- 브라우저 저장과 백업을 별도로 암호화하지 않습니다. 실제 비밀번호, 인증키나 개인정보를 기획 예시에 입력하지 마세요.

## 실행과 검증

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
node check.cjs
node scripts/release.cjs --test
node scripts/build.cjs --test
```

`http://127.0.0.1:4173/`에서 실행합니다. 추가 패키지가 없습니다. 조건부 질문·화면/기능 연결·로그인 조합·보고서·가져오기 검증과 버전 발급을 검사합니다.

## 구성

- `dist/questions.js`: 질문·조건, 기능 후보, 화면 요소와 설명
- `dist/report.js`: 입력 검증, 표시 조건, 기획 초안과 AI 전달문
- `dist/projects.js`: 프로젝트 저장·가져오기 형식 검증
- `dist/guides.js`: 실제 설명이 있는 선택지만 도움말 제공
- `dist/app.js`: 입력 편집기, 자동 저장, 프로젝트 관리, 백업·보고서
- `dist/styles.css`: PC·휴대폰 레이아웃

## 질문 구성의 참고 자료

[Design Council의 Double Diamond](https://www.designcouncil.org.uk/resources/framework-for-innovation/), [Atlassian PRD 안내](https://www.atlassian.com/agile/product-management/requirements), [GOV.UK 사용자 스토리](https://www.gov.uk/service-manual/agile-delivery/writing-user-stories), [Material 구성요소](https://developer.android.com/develop/ui/compose/components), [Carbon 구성요소](https://carbondesignsystem.com/components/overview/components/)를 참고했습니다. 이 서비스의 질문은 해당 표준의 공식 체크리스트나 인증 항목이 아닙니다.

## 공개 저장소와 이용 조건

[서비스 이용](https://buildbrief.moon0sik.cloud/) · [GitHub 저장소](https://github.com/YoungsikMoon/buildbrief) · [버전별 다운로드](https://github.com/YoungsikMoon/buildbrief/releases) · [기여 방법](CONTRIBUTING.md)

**BuildBrief 비상업적 소스 공개 라이선스 1.0**을 적용합니다. 아래 표는 요약이며 정확한 조건은 [LICENSE](LICENSE)를 따릅니다.

| 항목 | 조건 |
| --- | --- |
| 비상업적 사용·수정·재배포 | 허용 |
| 출처 표시 | 원본 저작자·저장소·라이선스 유지, 화면 또는 문서에 표시 |
| 소스 공개 | 실제 사용하는 BuildBrief 및 수정·파생 부분의 대응 소스를 공개하고 동일 라이선스 적용 |
| 수정 없는 사용 | 접근 가능한 원본 버전의 소스 링크로 충족 가능 |
| 상업적 사용 | 판매·유료 서비스·영리 업무·상업적 개발 등에 쓰기 전에 별도 서면 허락 필요 |
| 별도 프로젝트 | 입력한 답변·리포트와 독립적으로 만든 별도 서비스의 코드는 공개 의무에서 제외 |

상업적 사용을 제한하므로 [OSI 정의의 오픈소스](https://opensource.org/osd)가 아닌 **소스 공개(source-available)** 프로젝트입니다. 저장소가 공개되어 있다고 상업적으로 자유롭게 사용할 수 있는 것은 아닙니다. 상업적 이용은 [이슈](https://github.com/YoungsikMoon/buildbrief/issues)로 문의하세요. 별도 서비스의 코드를 공개하지 않아도 된다는 것은 이 도구의 상업적 사용까지 허용한다는 뜻은 아닙니다.

누구나 포크·수정·Pull Request를 할 수 있습니다. 원본 저장소에 직접 쓰는 권한은 관리자가 관리합니다. 외부 구성요소의 고지는 [NOTICE](NOTICE)를 참고하세요.

## 버전 관리

버전 형식은 **`yymmdd.01`부터 `yymmdd.99`까지**이며 Git 태그와 GitHub Release가 버전의 기준입니다. 날짜는 **한국 시간(Asia/Seoul)**으로 발급 시점에 결정합니다.

- `main`에 변경을 푸시하거나 Pull Request를 병합하면 자동 검증 후 릴리스를 발급합니다.
- 같은 날에는 `260922.01` → `260922.02`처럼 증가하고, 다음 날짜의 첫 발급은 `260923.01`입니다.
- 같은 커밋을 재실행하면 기존 버전을 재사용합니다. 테스트 실패 시 발급하지 않습니다.
- 하루 99개를 초과하면 오류로 중단합니다. `.100`을 만들거나 기존 번호를 덮어쓰지 않습니다.
- 변경이 없는 날짜에는 버전을 만들지 않습니다. 필요한 경우 Actions에서 수동 실행할 수 있습니다.

- 태그를 삭제·이동하지 마세요. 릴리스에는 해당 커밋의 소스 ZIP·tar.gz 다운로드가 제공됩니다.

공개 앱 상단의 버전은 빌드한 커밋을 가리키는 Git 릴리스 태그로 채웁니다. `v260922.14`처럼 표시되며 누르면 해당 GitHub Release를 새 탭에서 엽니다. 브라우저에서 최신 버전을 조회하거나 날짜로 추측하지 않으므로, 예전 배포를 열면 그 배포의 버전이 표시됩니다. 로컬 빌드는 항상 `개발 버전`이며 Pages 미리보기도 일치하는 태그가 없으면 `개발 버전`으로 표시됩니다.

동시 실행은 순서대로 처리합니다. GitHub Actions 대기열은 최대 100개이며, 그 이상으로 취소된 실행은 나중에 재실행해야 합니다. 첫 공개 이전의 비공개 개발 기록과 운영용 배포 설정은 공개 저장소에 포함하지 않습니다. 공개 버전과 기존 호스팅 서비스의 배포 번호는 별개입니다.


## Cloudflare 무료 배포

Cloudflare Pages로 `dist`의 정적 파일만 제공합니다. 서버 코드, 데이터베이스, 별도 배포 API 토큰은 필요하지 않습니다. [현재 요금 안내](https://developers.cloudflare.com/pages/functions/pricing/)에 따르면 정적 파일 요청은 무료·무제한이며, Free 플랜의 [빌드 한도](https://developers.cloudflare.com/pages/platform/limits/)는 월 500회입니다. 유료 플랜이나 별도 도메인을 구매하지 않아도 기본 HTTPS 주소로 사용할 수 있습니다. 이후 서버 기능을 추가하면 그 기능의 한도·요금을 별도로 확인하세요.

Cloudflare에서 Workers & Pages → Create application → Pages → 기존 Git 리포지토리 가져오기로 이 GitHub 저장소를 연결합니다.

| 설정 | 값 |
| --- | --- |
| 프로젝트 이름 | `buildbrief` |
| Production branch | `main` |
| Root directory | 저장소 루트 |
| Framework preset | 없음 |
| Build command | `node scripts/build.cjs` |
| Build output directory | `dist` |
| 빌드 환경 변수 | `NODE_VERSION=24` |
| 공개 파일 | `wrangler.jsonc`의 `pages_build_output_dir`인 `./dist` |

Cloudflare가 `main`의 GitHub push마다 `build.cjs`를 실행합니다. 이 명령은 기존 앱 검사, 릴리스 검사, 버전 표시 검사를 통과한 뒤 `CF_PAGES_COMMIT_SHA`가 현재 체크아웃과 같은지 확인하고 해당 커밋의 원격 태그만 읽습니다. GitHub 버전 발급과 Pages 빌드는 독립적으로 시작하므로 운영 빌드는 태그를 10초 간격으로 최대 5분 기다립니다. 일치하는 태그를 얻지 못하거나 태그가 모호하면 실패해 잘못된 버전을 배포하지 않습니다. 릴리스 작업이 늦게 끝났다면 성공 후 Pages 빌드를 다시 실행하세요. 환경 변수는 [Cloudflare Pages 빌드 설정](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)을 따릅니다.

버전은 `dist/index.html`의 지정한 표시 영역에만 빌드 시 반영하며 JS·CSS 파일의 콘텐츠 해시 검사와 브라우저 보안 정책은 유지합니다. 로컬 빌드는 원격 태그를 조회하지 않고 항상 개발 버전으로 표시합니다. Pages 미리보기는 일치하는 태그가 없거나 원격 조회가 불가능하면 기다리지 않고 개발 버전으로 표시합니다. 배포는 Pages가 처리하므로 별도 `wrangler deploy` 명령을 추가하지 않습니다. 배포 경로를 저장소 루트로 바꾸면 공개할 필요가 없는 파일까지 노출할 수 있으므로 `./dist`를 유지하세요.

`dist/_headers`는 스크립트 출처 제한(CSP), 다른 사이트의 프레임 삽입 차단, MIME 형식 보호 등의 응답 헤더를 설정합니다. 외부 폰트만 허용하고 스크립트의 외부 통신은 차단합니다. 답변은 계속 사용자의 브라우저에만 저장되며, 클라우드 배포가 답변의 서버 동기화나 암호화를 추가하지는 않습니다. 사이트 주소가 바뀌면 기존 주소의 브라우저 답변은 자동 이전되지 않으므로 JSON 백업으로 옮기세요.
