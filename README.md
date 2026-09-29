# 빌드브리프 · BuildBrief

**아이디어를 다른 사람과 함께 검토할 수 있는 서비스 기획 초안으로 정리합니다.**

개발 경험이 없어도 문제와 사용자부터 기능·이용 과정·화면까지 하나씩 구체화할 수 있습니다. 답변과 선택 이유를 정리한 뒤 원하는 AI 대화에 전달해 기획을 보완합니다. 사이트에서 AI를 자동 실행하지는 않습니다.

[서비스 이용](https://buildbrief.moon0sik.cloud/) · [변경 내역·최신 버전](https://github.com/YoungsikMoon/buildbrief/releases) · [오류·개선 제안](https://github.com/YoungsikMoon/buildbrief/issues/new) · [개발자 LinkedIn](https://www.linkedin.com/in/moonyoungsik95)

## 주요 기능

- 질문과 선택지를 따라 아이디어를 정리하고, 선택한 이유와 미정 사항을 기록합니다.
- 기획 초안을 확인·내려받고, AI에게 전달할 요청문을 복사합니다.
- 여러 프로젝트를 관리하고 JSON 파일로 백업·복구합니다.

답변은 **현재 브라우저에 저장**되며 다른 기기로 자동 동기화되지 않습니다. 브라우저 저장과 백업은 암호화하지 않습니다. 중요한 기록은 백업하고, 비밀번호·API 키는 입력하지 마세요. [저장·복구 안내](docs/storage-and-backup.md)

## 로컬 실행

Git과 Python 3이 있으면 실행할 수 있습니다.

```sh
git clone https://github.com/YoungsikMoon/buildbrief.git
cd buildbrief
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

[http://127.0.0.1:4173/](http://127.0.0.1:4173/)에서 확인하세요. 개발·검증에 필요한 환경과 명령은 [개발 문서](docs/development.md)에 있습니다.

## 문서 안내

| 알아보거나 변경할 내용 | 문서 |
| --- | --- |
| 시작 안내, 6단계 질문, 기획 초안·AI 전달문, 진행률 | [사용 가이드](docs/user-guide.md) |
| 자동 저장, 백업·복구, 기기 간 이동, 저장 형식 | [저장과 백업](docs/storage-and-backup.md) |
| 색상, 글자 크기, 모바일·접근성 기준 | [UI와 접근성](docs/ui-guidelines.md) |
| 실행 환경, 파일 구성, 테스트, 자산 갱신 | [개발과 검증](docs/development.md) |
| 자동 버전 발급, 릴리스, Cloudflare 설정·배포 | [배포와 버전 관리](docs/release-and-deployment.md) |
| 보안 적용 범위, 점검표, 운영·검증 절차 | [보안 문서 목차](SECURITY.md) |
| 수정 제안, PR 작성, 기여자의 권리 | [기여 안내](CONTRIBUTING.md) |

사람과 AI 모두 작업에 해당하는 문서부터 읽고 갱신합니다. 상세 설명은 담당 문서에서 관리하고, 새 주제가 생기면 이 목차에 연결합니다.

## 이용 조건

**BuildBrief 비상업적 소스 공개 라이선스 1.0**을 적용합니다. 비상업적 사용·수정·재배포는 출처 표시와 대응 소스 공개 등 라이선스 조건에 따라 허용하며, 상업적 사용은 사전에 별도 서면 허락을 받아야 합니다. OSI 승인 오픈소스 라이선스가 아닙니다.

정확한 이용 조건과 별도 결과물의 예외는 [LICENSE](LICENSE), 외부 구성요소 고지는 [NOTICE](NOTICE)를 확인하세요.
