# 입력·출력·백업

[보안 목차](../../SECURITY.md) · [적용 범위·상태 기준](scope.md) · [검증 절차·이력](verification.md)

직접 입력, JSON 가져오기, 저장 자료 읽기, HTML·Markdown 출력, 참고 URL, 파일 내려받기, 동시 편집을 바꿀 때 읽습니다. 담당 항목: **BB-01~10**.

담당: 변경을 만드는 개발자와 검토자. 점검 상태는 기재한 검증 범위에 한정하며, ASVS 전체 충족을 뜻하지 않습니다.

관련 코드: [app.js](../../dist/app.js), [answers.js](../../dist/answers.js), [views.js](../../dist/views.js), [report.js](../../dist/report.js), [projects.js](../../dist/projects.js), [storage.js](../../dist/storage.js), [check.cjs](../../check.cjs), [check-runtime.cjs](../../scripts/check-runtime.cjs). 표 안의 코드 경로는 저장소 루트 기준입니다.

## 점검표

| ID · ASVS 참조 | 확인할 사항 | 상태 | 근거와 남은 확인 |
| --- | --- | --- | --- |
| BB-01 · `v5.0.0-2.2.1`, `v5.0.0-15.3.5` | 입력·복구·저장 읽기에 일관된 형식 검증 적용. 질문·필드·선택지·날짜·ID·길이·행 수 검증. | 부분 | `dist/answers.js`, `dist/projects.js`의 가져오기·저장 자료 읽기는 공통 정규화와 회귀 검사로 확인했습니다. 직접 입력은 UI 제한 중심이며 `save` 직전 공통 정규화는 없습니다. 입력 경로별 상한 일치와 저장 후 재로딩 가능성을 추가 확인해야 합니다. |
| BB-02 · `v5.0.0-1.5.2`, `v5.0.0-15.3.6` | JSON을 코드로 실행하지 않고 필요한 필드로 다시 구성. 알 수 없는 질문·메모 키 거부, 원형 객체 오염 방지. | 확인 | `JSON.parse` 이후 정규화. `check.cjs`의 프로토타입 오염·알 수 없는 스키마 검사. 새 필드와 병합 방식은 다시 검토합니다. |
| BB-03 · `v5.0.0-1.2.1`, `v5.0.0-3.2.2` | 답변·메모·프로젝트 이름이 입력 화면, 관리 창, 초안에서 HTML이나 이벤트로 실행되지 않음. | 확인 | 단순 문구는 `textContent`·`value`, 템플릿은 `views.js`의 공통 이스케이프. 악성 마크업 회귀 검사와 브라우저 확인. `innerHTML`의 새 변수는 출처·출력 문맥을 검토합니다. |
| BB-04 · `v5.0.0-1.3.2` | `eval`, 문자열 실행, 사용자 스크립트·이벤트·CSS 실행을 도입하지 않음. | 확인 | 현재 코드 검토와 `check.cjs`의 제한된 회귀 검사. 정규식 검사는 우회 가능한 보조 장치이며 범용 코드 분석기가 아닙니다. |
| BB-05 · `v5.0.0-1.2.2` | 참고·경쟁 서비스 URL에 HTTP(S) 형식 검사 적용. 사용자 정보가 든 URL·제어 문자·역슬래시·공백이 섞인 주소 등을 거부. | 확인 | 공통 `normalizeHttpUrl`, URL 경계 사례 검사. 부적합한 주소는 초안·AI 전달문에서 제외하고 편집 원본·백업은 보존합니다. URL 안전성·운영 주체·목적지 신뢰성을 보장하지는 않습니다. |
| BB-06 · `v5.0.0-1.2.1` | Markdown 내보내기와 화면 표시에도 질문·답변·이유의 경계를 유지하고 마크업을 이스케이프. | 확인 | `dist/report.js`와 `dist/views.js`의 초안 변환, 두 내보내기 검사. 다른 Markdown 도구·AI가 문서를 어떻게 처리하는지까지 보장하지 않습니다. |
| BB-07 · `v5.0.0-5.2.1`, `v5.0.0-15.2.2` | 큰 백업·많은 자료로 브라우저가 멈추지 않도록 제한하고 실패 시 기존 자료 유지. | 부분 | 읽기 전 16MiB 제한, 필드·행 수 제한은 있습니다. 프로젝트 총수 제한은 없고 상한 근처 파일·누적 자료의 저사양 기기 성능은 미점검입니다. |
| BB-08 · `v5.0.0-2.3.3`, `v5.0.0-16.5.3` | 검증·가져오기·저장 실패 시 원본을 덮어쓰거나 조용히 잘라내지 않음. | 확인 | `importBackup` 검증 후 새 프로젝트 ID로 추가. 잘못된 백업의 상태 불변 검사, `storage.js`의 저장 실패·원본 보존·복구 검사와 UI 안내. |
| BB-09 · V15.4 동시 처리 | 다른 탭에서 같은 자료를 바꾼 경우 충돌을 알리고 자동 저장 중지. | 부분 | `storage` 이벤트와 저장 전 원본 비교가 있습니다. localStorage의 읽기·비교·쓰기는 하나의 트랜잭션이 아니므로 거의 동시에 저장하는 경쟁 상황까지 해결한 것은 아닙니다. |
| BB-10 · `v5.0.0-5.4.2` | 내려받는 파일 이름에 경로·제어 문자를 넣지 않고 JSON·Markdown 형식으로만 생성. | 확인 | `app.js`의 `download` 코드 검토와 실제 내보내기 확인. 브라우저 Blob 다운로드이며 서버 `Content-Disposition` 설정을 검증한 것은 아닙니다. 백업은 실행하거나 압축 해제하지 않습니다. |

화면 요소 확장에 추가된 세부 선택은 허용된 요소·선택지 ID와 단일/복수 선택 개수를 검증합니다. 직접 추가한 요소도 기존 행 수·문자 수·식별자 제한을 적용하며, 출력은 기존 HTML·Markdown 이스케이프를 거칩니다. 기존 백업에는 새 필드가 없어도 빈 값으로 보완합니다. BB-01~03·06·08의 변경분 검사 결과는 [검증 이력](verification.md#검증-이력)에 기록합니다.

화면 요소 예시의 이미지 주소는 검토된 카탈로그 ID로만 구성합니다. 답변이나 참고 URL을 이미지 주소에 넣지 않으며, 알 수 없는 ID는 표시하지 않습니다. 대체 텍스트·설명은 HTML 이스케이프하고 새 탭 링크는 `noopener noreferrer`를 유지합니다. BB-03 검사는 카탈로그의 이미지 태그만 허용하면서 악성 입력이 새 태그를 만들지 못하는지 확인합니다.

화면별 구성 추천 요청은 `recommendLayout`의 boolean 값만 허용하고 기존 백업에서 빠져 있으면 `false`로 읽습니다. 화면 목록 추천과 별도로 저장하며, 요청만 남긴 화면도 초안에서 그 화면의 번호에 연결합니다. 새 화면 이름 출력도 기존 인코딩을 적용합니다. 이 변경은 외부 AI 통신이나 자동 입력을 추가하지 않습니다.

제거한 09단계의 질문 세 개는 `retiredQuestions`의 명시적인 허용 목록으로만 읽습니다. 기존 답변·작성 중 내용·이유·추천 요청의 검증과 보존을 유지하며, 알 수 없는 키나 잘못된 유형·상한 초과는 계속 거부합니다. 기존 답변과 이유를 보여 주는 ‘이전에 작성한 내용’도 공통 Markdown·HTML 인코딩과 질문별 구분을 거칩니다. 현재 질문·진행률·미정 항목에는 포함하지 않습니다.

## URL 검사의 경계

`normalizeHttpUrl`은 **SSRF 방어가 아닙니다**. 기획 자료의 localhost·사설 IP는 허용하지만 실제 요청은 보내지 않습니다. 이 함수의 결과로 서버 요청을 허가해서는 안 됩니다. 브라우저 CSP도 서버의 송신을 제어하지 않습니다.

서버가 URL을 가져오는 기능을 추가한다면 [기능 확장](feature-changes.md)을 검토합니다. 저장 실패 처리와 오류 안내는 [코드·배포](code-and-delivery.md)의 BB-21도 확인합니다.

## 참고 원문

- [XSS 예방](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) · [DOM XSS 예방](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [입력 검증](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Input_Validation_Cheat_Sheet.md) · [SSRF 예방](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
