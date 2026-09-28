# 배포와 버전 관리

[프로젝트 안내·문서 목차](../README.md) · [개발과 검증](development.md)

버전 발급 규칙·릴리스 작성·Cloudflare Pages 설정·배포 실패 시 확인할 내용을 관리합니다. 관련 코드: [release.yml](../.github/workflows/release.yml), [release.cjs](../scripts/release.cjs), [build.cjs](../scripts/build.cjs), [wrangler.jsonc](../wrangler.jsonc).

## 버전 관리

릴리스 본문에는 해당 커밋의 제목과 본문을 자동으로 포함합니다. 커밋 메시지는 사용자가 이해할 수 있는 한국어로 작성하고, 해당하는 추가·개선·오류 수정 내용을 적어 주세요.

버전 형식은 **`yymmdd.01`부터 `yymmdd.99`까지**입니다. Git 태그와 GitHub Release가 버전의 기준이며, 발급 날짜는 **한국 시간(Asia/Seoul)**을 사용합니다. 최신 버전은 [Releases](https://github.com/YoungsikMoon/buildbrief/releases)에서 확인하세요.

- Pull Request는 검증만 진행합니다. `main`에 변경을 푸시하거나 병합하면 검증 성공 후 자동으로 릴리스를 발급합니다. 문서만 수정한 커밋에도 같은 규칙이 적용됩니다.
- 같은 날에는 `260922.01` → `260922.02`처럼 증가하고, 다음 날짜의 첫 발급은 `260923.01`입니다.
- 같은 커밋을 재실행하면 기존 버전을 재사용합니다. 테스트 실패 시 새 버전을 발급하지 않습니다.
- 하루 99개를 넘으면 중단합니다. 기존 태그를 덮어쓰거나 이동하지 않습니다. 변경 없는 날짜에는 버전을 만들지 않습니다.
- 릴리스 작업은 대기열에서 순서대로 실행하며, 필요한 경우 Actions에서 `main`을 대상으로 수동 실행할 수 있습니다.

공개 앱 상단에는 **실제 배포 커밋의 버전**이 표시되며 누르면 전체 업데이트 이력을 새 탭으로 엽니다. 로컬에서는 `개발 버전`으로 표시합니다. Pages 미리보기도 일치하는 태그가 없으면 개발 버전을 사용합니다.

## Cloudflare Pages 배포

현재 서비스는 Cloudflare Pages에서 **`dist`의 정적 파일만** 제공합니다. GitHub 저장소 연동으로 배포하며 별도 배포 API 토큰은 필요하지 않습니다.

| 설정 | 값 |
| --- | --- |
| 프로젝트 이름 | `buildbrief` |
| Production branch | `main` |
| Root directory | 저장소 루트 |
| Framework preset | 없음 |
| Build command | `node scripts/build.cjs` |
| Build output directory | `dist` |
| 빌드 환경 변수 | `NODE_VERSION=24` |

`main` 변경 후 GitHub 릴리스와 Pages 빌드가 각각 시작됩니다. 운영 빌드는 체크아웃한 커밋과 `CF_PAGES_COMMIT_SHA`가 일치하는지 확인하고, 그 커밋의 원격 릴리스 태그를 최대 5분 기다려 버전을 표시합니다. 태그를 찾지 못하거나 여러 버전이 같은 커밋을 가리키면 실패합니다. 릴리스 발급이 늦어 실패한 경우에는 릴리스 성공 후 Pages 빌드를 다시 실행하세요.

배포 디렉터리는 `dist`를 유지하세요. `dist/_headers`에는 스크립트 출처 제한, 스크립트의 외부 통신 차단(`connect-src 'none'`), 외부 사이트의 프레임 삽입 차단 등의 설정이 있습니다. 클라우드 배포 자체가 답변의 서버 저장이나 기기 간 동기화를 추가하지는 않습니다.

2026-09-23 확인 기준, Functions를 호출하지 않는 정적 파일 요청은 [무료·무제한](https://developers.cloudflare.com/pages/functions/pricing/#static-asset-requests)이며 Free 플랜은 [월 500회 빌드](https://developers.cloudflare.com/pages/platform/limits/#builds)를 지원합니다. 새로 배포하거나 서버 기능을 추가할 때는 공식 요금·한도를 다시 확인하세요.

계정 권한·토큰·도메인·복구에 관한 운영 점검은 [보안 운영 문서](security/operations.md)에서 관리합니다.
