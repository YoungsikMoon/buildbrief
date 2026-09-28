# UI와 접근성 기준

[프로젝트 안내·문서 목차](../README.md) · [사용 가이드](user-guide.md)

안내 화면·질문·기획 초안·프로젝트 관리의 색상·글자 크기·접근성을 바꿀 때 읽습니다. 관련 코드: [styles.css](../dist/styles.css), [index.html](../dist/index.html), [views.js](../dist/views.js), [app.js](../dist/app.js).

## 시작 안내의 구성 원칙

안내 화면은 [NN/g의 홈페이지 사용성 원칙](https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/) 중 명확한 목적, 주요 행동, 구체적인 결과물 예시를 기준으로 구성했습니다. 글자 대비와 클릭 영역은 [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)를 참고했습니다. 전환율 개선은 별도의 사용자 관찰과 측정으로 확인해야 합니다.

## 색상과 글자 크기

화면 전체에 짙은 잉크색 제목, 어두운 회색 본문, 딥 블루 버튼·선택 상태와 흰색 입력 영역을 사용합니다. 보조 설명도 읽기 쉬운 대비를 유지하고, 입력창 테두리와 키보드 포커스를 구분합니다.

글자 크기는 [KRDS 타이포그래피](https://www.krds.go.kr/html/site/style/style_03.html)의 본문 최소 16px·줄 간격 150% 이상과 [GOV.UK의 본문 19px 기준](https://design-system.service.gov.uk/styles/type-scale/)을 참고해, 읽고 작성하는 서비스에 맞춰 정했습니다. 아래 수치는 브라우저 기본 글자 크기가 16px일 때이며, 실제 스타일은 `rem`으로 작성해 사용자 글자 크기 설정을 따릅니다. 읽고 판단하는 설명까지 본문 크기로 통일하고, 짧은 보조 정보만 작게 구분합니다. 본문 줄 간격은 165~175%이며 모바일에서도 본문을 축소하지 않습니다. 공통 글자 크기 변수로 안내·작성·기획 초안·프로젝트 관리 화면에 같은 기준을 적용합니다.

| 역할 | PC | 모바일 |
| --- | --- | --- |
| 단계·초안 문서 제목 | 32px | 28px |
| 질문 묶음 제목 | 26px | 24px |
| 질문·카드 제목 | 22px | 22px |
| 본문·설명·선택지·입력값·기획 초안 | 19px | 19px |
| 메뉴·버튼·입력란 이름 | 18px | 18px |
| 버전·질문 수 등 짧은 보조 정보 | 16px | 16px |

글자를 키웠을 때도 읽고 조작할 수 있도록 버튼과 카드의 줄바꿈·간격을 함께 조정합니다. 확대 시 내용이나 기능이 사라지지 않는지는 [WCAG의 텍스트 200% 확대 기준](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)으로 확인합니다.

변경 후 PC·모바일에서 입력, 긴 문구, 버튼 줄바꿈과 목차 스크롤을 함께 확인하세요. 기능별 조작 흐름은 [사용 가이드](user-guide.md), 검증 명령은 [개발 문서](development.md)를 참고하세요.
