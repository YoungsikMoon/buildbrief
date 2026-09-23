(function (root) {
  "use strict";
  const featureTypes = [
    { id: "browse", label: "정보 보기", description: "안내, 소식, 상품 등을 목록과 상세 화면에서 봐요.", fit: "필요한 정보를 확인하는 일이 중요할 때", avoid: "보여 줄 내용을 정하지 않은 채 화면부터 늘리지 않아요." },
    { id: "search", label: "검색·필터", description: "원하는 항목을 찾고 조건이나 순서로 좁혀 봐요.", fit: "항목이 많거나 사람마다 찾는 조건이 다를 때", avoid: "한눈에 볼 만큼 적은 항목이라면 검색창이 필요 없을 수 있어요." },
    { id: "content", label: "작성·관리", description: "글, 메모, 자료를 만들고 고치거나 정리해요.", fit: "이용자가 자기 내용을 직접 남기고 관리할 때", avoid: "예약이나 결제까지 글쓰기로 묶지 말고 실제 할 일을 따로 적어요." },
    { id: "booking", label: "예약·신청", description: "원하는 시간이나 대상을 고르고 이용을 신청해요.", fit: "자리, 시간, 참가 인원처럼 신청할 대상이 있을 때", avoid: "신청 버튼만 정하지 말고 확정 조건과 취소 가능 여부도 생각해요." },
    { id: "workflow", label: "승인·처리 상태", description: "접수, 검토, 승인, 완료처럼 일이 진행된 상태를 확인해요.", fit: "신청자와 처리자가 다르거나 여러 단계를 거칠 때", avoid: "상태를 바꾸는 사람과 조건이 불분명하면 단계 이름부터 늘리지 않아요." },
    { id: "schedule", label: "일정·달력", description: "약속, 할 일, 마감일을 날짜와 연결해 봐요.", fit: "언제 해야 하는지가 중요한 서비스일 때", avoid: "날짜가 참고 정보일 뿐이라면 목록만으로 충분할 수 있어요." },
    { id: "files", label: "사진·파일", description: "사진이나 문서를 첨부하고 확인하거나 내려받아요.", fit: "글만으로 전달하기 어려운 증빙이나 자료가 필요할 때", avoid: "파일 선택과 직접 촬영은 달라요. 필요한 행동만 정해요." },
    { id: "community", label: "댓글·리뷰·반응", description: "게시물이나 상품에 의견, 후기, 좋아요를 남겨요.", fit: "다른 사람의 의견이나 평가를 함께 볼 때", avoid: "문의 답변만 필요하다면 공개 댓글 대신 문의로 구체화해도 돼요." },
    { id: "chat", label: "문의·대화", description: "이용자끼리 또는 담당자와 메시지를 주고받아요.", fit: "질문과 답변이 오가거나 상대와 조율해야 할 때", avoid: "즉시 답변할 사람이 없다면 실시간 응답을 약속하지 않아요." },
    { id: "notifications", label: "알림", description: "예약 변경이나 답변 도착처럼 알아야 할 일을 알려 줘요.", fit: "이용자가 계속 화면을 확인하지 않아도 변화를 알아야 할 때", avoid: "모든 행동보다 놓치면 곤란한 사건부터 골라요." },
    { id: "payments", label: "구매·결제·구독", description: "상품이나 서비스에 돈을 내고 구매 결과를 확인해요.", fit: "서비스 안에서 주문이나 결제 과정을 제공할 때", avoid: "가격 안내만 있거나 외부에서 계약한다면 그 범위만 적어요." },
    { id: "personalization", label: "즐겨찾기·내 기록", description: "관심 항목, 최근 본 내용, 나의 활동을 모아 봐요.", fit: "같은 사람이 다시 찾아와 이전 활동을 이어갈 때", avoid: "내 기록이 필요하다고 반드시 로그인해야 하는 것은 아니에요." },
    { id: "analytics", label: "집계·통계", description: "여러 기록을 합쳐 현황이나 변화, 비교 결과를 봐요.", fit: "숫자를 보고 다음 행동이나 판단을 해야 할 때", avoid: "차트 수보다 어떤 판단에 필요한 숫자인지 먼저 생각해요." },
    { id: "location", label: "지도·위치", description: "장소를 지도에서 찾거나 위치를 기준으로 정보를 봐요.", fit: "장소나 거리가 이용자의 선택에 영향을 줄 때", avoid: "지도 표시와 이용자의 현재 위치 수집은 달라요." },
    { id: "ai", label: "AI 도움", description: "입력한 내용을 바탕으로 답변, 요약, 추천, 초안을 받아요.", fit: "이용자가 결과를 확인하고 활용할 구체적인 일이 있을 때", avoid: "AI의 결과가 언제나 맞거나 바로 실행해도 된다고 가정하지 않아요." },
    { id: "collaboration", label: "공유·공동 작업", description: "다른 사람을 초대하고 같은 자료를 보거나 함께 고쳐요.", fit: "여러 사람이 같은 자료로 함께 일할 때", avoid: "링크를 보내는 것과 수정 권한을 주는 것을 구분해요." },
    { id: "admin", label: "운영·관리", description: "담당자가 사용자, 게시물, 신청 등을 확인하고 처리해요.", fit: "이용자 화면만으로 처리할 수 없는 운영 업무가 있을 때", avoid: "관리자라고 모든 자료를 보거나 바꿀 수 있다고 정하지 않아요." },
    { id: "device", label: "촬영·음성·기기 기능", description: "카메라나 마이크처럼 이용 기기의 기능을 사용해요.", fit: "사진을 바로 찍거나 음성으로 입력하는 일이 필요할 때", avoid: "웹과 설치 앱 모두 필요한 기기 기능과 거절 시 대안을 생각해요." },
    { id: "custom", label: "직접 추가", description: "목록에 없는 이 서비스만의 일을 내 말로 적어요.", fit: "후보 이름보다 구체적인 업무를 바로 설명할 수 있을 때", avoid: "목록에 없다는 이유로 핵심 기능을 빼지 않아요." }
  ];
  const uiElements = [
    { id: "appbar", label: "상단 바", group: "navigation", meaning: "화면 위쪽에 제목, 메뉴, 계정 등의 공통 정보를 놓아요.", fit: "현재 화면과 공통 이동 경로를 보여 줄 때", avoid: "좁은 화면에서 메뉴를 모두 펼치면 내용이 밀릴 수 있어요.", prompt: "제목과 어떤 메뉴·행동을 넣을까요?", preview: "appbar" },
    { id: "sidebar", label: "왼쪽 메뉴", group: "navigation", meaning: "왼쪽에 메뉴를 세로로 두고 다른 영역으로 이동해요.", fit: "PC에서 여러 업무 화면을 자주 오갈 때", avoid: "휴대폰에서는 본문 공간을 차지하므로 접거나 다른 이동 방식을 생각해요.", prompt: "어떤 메뉴가 있고 현재 위치는 어떻게 보여 줄까요?", preview: "sidebar" },
    { id: "bottomnav", label: "하단 메뉴", group: "navigation", meaning: "화면 아래쪽에서 자주 쓰는 주요 영역으로 이동해요.", fit: "휴대폰에서 소수의 주요 화면을 반복해 오갈 때", avoid: "많은 메뉴나 저장·삭제 같은 개별 행동을 모두 넣지 않아요.", prompt: "항상 접근할 주요 화면은 무엇인가요?", preview: "bottomnav" },
    { id: "tabs", label: "탭", group: "navigation", meaning: "관련된 내용을 한 영역 안에서 나눠 보여 줘요.", fit: "상세·활동 내역처럼 같은 대상의 다른 내용을 볼 때", avoid: "순서대로 해야 하는 작성 과정은 탭만으로 표현하면 헷갈릴 수 있어요.", prompt: "어떤 내용을 나누고 처음에는 어느 탭을 보여 줄까요?", preview: "tabs" },
    { id: "list", label: "목록", group: "display", meaning: "항목을 한 줄씩 나열하고 필요한 내용을 선택하게 해요.", fit: "이름, 상태, 날짜 같은 간단한 정보를 훑어볼 때", avoid: "항목마다 비교할 값이 많으면 줄이 복잡해질 수 있어요.", prompt: "한 항목에 무엇을 보여 주고 누르면 어디로 가나요?", preview: "list" },
    { id: "cards", label: "카드", group: "display", meaning: "관련 정보와 행동을 하나의 상자에 묶어 보여 줘요.", fit: "사진과 설명을 함께 보거나 항목을 탐색할 때", avoid: "수치를 행끼리 비교해야 하면 표가 더 읽기 쉬울 수 있어요.", prompt: "카드마다 어떤 정보와 행동을 넣을까요?", preview: "cards" },
    { id: "table", label: "표(Table)", group: "display", meaning: "행과 열로 항목의 같은 속성을 나란히 보여 줘요.", fit: "상태, 날짜, 금액 등을 비교하거나 여러 항목을 관리할 때", avoid: "휴대폰에서는 꼭 필요한 열을 남기거나 상세 화면 이동을 생각해요.", prompt: "어떤 열을 보여 주고 정렬·선택·행동이 필요한가요?", preview: "table" },
    { id: "calendar", label: "달력", group: "display", meaning: "일정이나 이용 가능한 시간을 날짜에 맞춰 보여 줘요.", fit: "날짜별 빈자리, 약속, 마감을 확인할 때", avoid: "일정의 자세한 설명이 더 중요하면 목록을 함께 검토해요.", prompt: "어떤 일정을 표시하고 날짜를 고르면 무엇을 하나요?", preview: "calendar" },
    { id: "map", label: "지도", group: "display", meaning: "장소의 위치와 주변 관계를 지도에 표시해요.", fit: "거리나 위치를 보고 장소를 선택해야 할 때", avoid: "주소만 확인하면 지도 없이도 가능해요. 현재 위치 권한은 별도로 정해요.", prompt: "어떤 장소를 표시하고 누르면 무엇을 보여 줄까요?", preview: "map" },
    { id: "chart", label: "차트", group: "display", meaning: "숫자의 변화나 항목 간 차이를 그림으로 보여 줘요.", fit: "추세, 비율, 크기를 비교해 판단할 때", avoid: "정확한 개별 값이 중요하면 숫자나 표도 함께 제공해요.", prompt: "무엇을 비교하며 어떤 판단을 하길 바라나요?", preview: "chart" },
    { id: "form", label: "입력 양식", group: "input", meaning: "글, 선택 항목, 날짜처럼 필요한 값을 입력하는 영역이에요.", fit: "신청, 정보 수정, 설정처럼 정해진 내용을 받을 때", avoid: "불필요한 정보까지 필수로 받거나 긴 양식을 한꺼번에 요구하지 않아요.", prompt: "입력할 내용과 꼭 필요한 항목은 무엇인가요?", preview: "form" },
    { id: "upload", label: "사진·파일 첨부", group: "input", meaning: "사진이나 문서를 골라 올리는 영역이에요.", fit: "증빙, 프로필 사진, 함께 볼 자료를 받을 때", avoid: "파일 선택과 카메라 촬영은 다른 행동이에요. 필요한 쪽만 정해요.", prompt: "어떤 파일을 몇 개 받으며 완료·실패를 어떻게 알릴까요?", preview: "upload" },
    { id: "fab", label: "떠 있는 주요 버튼(FAB)", group: "action", meaning: "화면 위에 떠 있는 눈에 띄는 버튼으로 주요 행동 하나를 실행해요.", fit: "새 메모나 신청처럼 반복하는 대표 행동이 있을 때", avoid: "중요도가 같은 행동이 많거나 본문을 가리면 일반 버튼을 검토해요.", prompt: "이 버튼이 실행할 한 가지 행동은 무엇인가요?", preview: "fab" },
    { id: "search", label: "검색창", group: "action", meaning: "단어나 번호를 입력해 원하는 내용을 찾아요.", fit: "찾을 이름이나 단어를 이용자가 알고 있을 때", avoid: "모든 정보를 검색할 수 있다고 약속하지 말고 대상을 정해요.", prompt: "무엇으로 어떤 대상을 찾으며 결과가 없으면 무엇을 안내하나요?", preview: "search" },
    { id: "filters", label: "필터·정렬", group: "action", meaning: "조건에 맞는 항목만 보거나 표시 순서를 바꿔요.", fit: "상태, 날짜, 지역 등으로 목록을 좁혀야 할 때", avoid: "조건이 너무 많으면 고르기 어려우므로 자주 쓰는 조건부터 보여 줘요.", prompt: "어떤 조건과 정렬이 필요하며 선택을 어떻게 해제하나요?", preview: "filters" },
    { id: "rightpanel", label: "오른쪽 보조 패널", group: "support", meaning: "주 화면 옆에서 선택한 항목의 상세 정보나 보조 작업을 보여 줘요.", fit: "목록을 유지한 채 상세 정보를 빠르게 확인하거나 수정할 때", avoid: "작은 화면에서는 별도 상세 화면이나 접히는 영역이 더 편할 수 있어요.", prompt: "언제 열리고 무엇을 보여 주며 휴대폰에서는 어떻게 볼까요?", preview: "rightpanel" },
    { id: "dialog", label: "대화 상자", group: "support", meaning: "현재 화면 위에 잠깐 나타나 확인이나 짧은 입력을 받아요.", fit: "삭제 확인이나 간단한 선택처럼 지금 끝낼 작은 작업이 있을 때", avoid: "긴 작성이나 자주 반복하는 작업은 별도 화면이 더 편할 수 있어요.", prompt: "언제 열리고 확인·취소하면 각각 어떻게 되나요?", preview: "dialog" }
  ];
  const loginRequired = { id: "login_need", in: ["일부 기능에서만 로그인", "주요 기능은 로그인 후 사용"] };
  const category = id => ({ id: "features", category: id });
  const steps = [
    { id: "idea", title: "아이디어 소개", short: "아이디어", description: "누구에게 무엇을 제공하고 싶은지 한두 문장으로 시작해요.", groups: [
      { title: "만들고 싶은 서비스", description: "가칭이나 짧은 설명이면 충분해요. 뒤에서 구체화할 수 있어요.", questions: [
        { id: "project_name", label: "어떤 이름으로 부를까요?", type: "text", help: "아직 이름이 없다면 알아보기 쉬운 가칭을 적어요.", placeholder: "예: 우리 동네 작업실 예약" },
        { id: "summary", label: "누구에게 무엇을 제공하는 서비스인가요?", type: "textarea", help: "사용할 사람, 할 수 있는 일, 얻을 도움을 한두 문장으로 적어요.", placeholder: "예: 동네 주민이 빈 작업실 시간을 확인하고 원하는 시간에 예약할 수 있는 서비스" }
      ] }
    ] },
    { id: "problem", title: "문제와 기존 방법", short: "해결할 문제", description: "지금의 불편과 나아졌으면 하는 점을 정리해요.", groups: [
      { title: "지금 어떤 점이 불편한가요?", description: "실제 겪은 일과 아직 확인하지 않은 생각을 구분해 적으면 좋아요.", questions: [
        { id: "problem", label: "어떤 상황에서 누가 불편을 겪나요?", type: "textarea", help: "한 가지 구체적인 장면부터 적어요. 추측이라면 ‘예상’이라고 남겨도 돼요.", placeholder: "예: 주민이 빈 시간을 물으려고 전화하지만 담당자가 없으면 확인할 수 없어요." },
        { id: "current_methods", label: "지금은 어떤 방법으로 해결하나요?", type: "multi", options: ["메신저", "전화", "종이·수기", "엑셀·문서", "기존 서비스", "특별한 방법 없음", "다른 방법"], optionLabels: { "다른 방법": "직접 입력" }, help: "함께 쓰는 방법을 모두 골라요." },
        { id: "current_method_other", label: "지금 쓰는 다른 방법은 무엇인가요?", type: "text", help: "", placeholder: "예: 회사 내부 게시판", when: { id: "current_methods", includes: "다른 방법" } },
        { id: "current_pain", label: "지금 방법에서 무엇이 달라지면 좋을까요?", type: "textarea", help: "현재 방법의 불편과 바라는 변화를 연결해요. 앞의 문제를 다시 길게 쓰지 않아도 돼요.", placeholder: "예: 전화 없이 빈 시간을 알 수 있고 담당자는 중복 신청을 따로 확인하지 않아도 되면 좋겠어요." }
      ] }
    ] },
    { id: "users", title: "사용할 사람과 환경", short: "사용자·환경", description: "실제로 사용할 사람과 사용 장면을 생각해요.", groups: [
      { title: "누가 언제 사용하나요?", description: "일반인 전체보다 처음 사용할 사람부터 구체적으로 적어요.", questions: [
        { id: "audience", label: "처음 사용할 사람은 누구인가요?", type: "rows", rowLabel: "사용자", help: "필요가 다른 사람만 나누어요. 계정 권한은 뒤에서 정하므로 여기서는 목적에 집중해요.", fields: [
          { id: "person", label: "어떤 사람인가요?", placeholder: "예: 작업실을 빌리려는 주민" },
          { id: "goal", label: "무엇을 해결하고 싶나요?", placeholder: "예: 토요일에 쓸 공간 찾기" },
          { id: "context", label: "특별히 고려할 점", placeholder: "예: 처음 이용해서 준비물 안내가 필요함" }
        ] },
        { id: "usage_context", label: "언제, 어디서 사용하는 모습을 떠올리나요?", type: "textarea", help: "이동 중, 업무 중, 느린 인터넷, 글씨를 크게 봐야 하는 상황처럼 필요한 조건만 적어요.", placeholder: "예: 주민은 이동 중 휴대폰, 담당자는 사무실 PC로 이용해요." }
      ] },
      { title: "어떻게 열어 보나요?", description: "원하는 사용 방법을 고르는 단계예요. 개발 기술은 정하지 않아요.", questions: [
        { id: "devices", label: "주로 어떤 기기에서 사용하나요?", type: "multi", options: ["휴대폰", "PC", "태블릿", "다른 기기", "아직 미정"], optionLabels: { "다른 기기": "직접 입력" }, help: "여러 기기를 함께 골라도 돼요. 모든 기기에 같은 화면 배치를 적용할 필요는 없어요." },
        { id: "device_context_other", label: "어떤 다른 기기에서 사용하나요?", type: "text", help: "", placeholder: "예: 매장 키오스크, 거실 TV", when: { id: "devices", includes: "다른 기기" } },
        { id: "service_form", allowRecommend: true, label: "서비스를 어떻게 열어 사용하면 좋을까요?", type: "multi", options: ["주소·링크로 여는 웹", "휴대폰에 설치하는 앱", "PC에 설치하는 프로그램", "다른 이용 방식", "아직 미정"], optionLabels: { "다른 이용 방식": "직접 입력" }, help: "여러 방식을 희망할 수 있고 필요성을 확인한 뒤 범위를 줄여도 돼요.", optionHelp: {
          "주소·링크로 여는 웹": { meaning: "브라우저에서 주소나 링크를 열어 사용해요.", fit: "설치 없이 접근하거나 링크로 안내하고 싶을 때", avoid: "인터넷 없이 쓸 수 있는지나 기기 기능 사용 여부가 자동으로 정해지지는 않아요." },
          "휴대폰에 설치하는 앱": { meaning: "휴대폰에 설치한 앱을 열어 사용해요.", fit: "휴대폰에서 자주 사용하는 경험을 원할 때", avoid: "앱이 필요한 이유와 설치 부담을 함께 생각해요." },
          "PC에 설치하는 프로그램": { meaning: "컴퓨터에 설치한 프로그램을 실행해요.", fit: "PC에서 긴 작업을 하거나 기기 안 자료를 주로 다룰 때", avoid: "다른 컴퓨터에서 이어 쓰거나 자료를 공유할 수 있는지는 따로 정해요." }
        } },
        { id: "service_form_other", label: "원하는 다른 이용 방식은 무엇인가요?", type: "text", help: "", placeholder: "예: 메신저에서 대화로 이용", when: { id: "service_form", includes: "다른 이용 방식" } }
      ] }
    ] },
    { id: "features", title: "필요한 기능", short: "기능", description: "기능 후보를 출발점으로 실제로 할 일을 적어요.", groups: [
      { title: "누가 무엇을 할 수 있나요?", description: "필요한 후보만 고르거나 직접 추가해요. 같은 유형으로 여러 기능을 만들어도 돼요.", questions: [
        { id: "features", allowRecommend: true, label: "이 서비스에서 할 수 있어야 하는 일은 무엇인가요?", type: "features", help: "기능 이름, 사용하는 사람, 기대하는 결과를 적어요. 첫 버전에 필요한지 모르겠다면 미정으로 남겨요. 후보를 고른 것만으로 기능이 완성된 것은 아니에요." }
      ] }
    ] },
    { id: "flow", title: "대표 이용 과정", short: "이용 과정", description: "가장 중요한 목적 하나를 달성하는 순서부터 연결해요.", groups: [
      { title: "시작부터 목적 달성까지", description: "모든 기능의 과정을 만들 필요는 없어요. 앞의 기능을 연결하거나 내 말로 적어요.", questions: [
        { id: "main_flow", allowRecommend: true, label: "사용자는 어떤 순서로 목적을 달성하나요?", type: "flow", help: "누가 어떤 상황에서 시작하는지 포함해요. 예: 빈 시간 보기 → 시간 선택 → 신청 내용 확인 → 예약 결과 확인." },
        { id: "journey_finish", label: "마지막에 무엇이 보이거나 달라져야 하나요?", type: "textarea", help: "이용자가 원하는 일을 끝냈다고 알 수 있는 결과를 적어요. 기능 카드와 같다면 핵심만 짚어도 돼요.", placeholder: "예: 예약 번호와 확정 시간을 보고 내 예약 목록에서도 확인할 수 있어요." },
        { id: "failure_experience", allowRecommend: true, label: "중간에 막히면 어떻게 도와주면 좋을까요?", type: "textarea", help: "걱정되는 상황 한두 개만 적어요. 원인 안내, 입력 내용 유지, 다시 시도, 담당자 문의 등을 생각해요.", placeholder: "예: 다른 사람이 먼저 예약했다면 입력 내용은 유지하고 다른 시간을 고르게 해요." }
      ] }
    ] },
    { id: "accounts", title: "로그인과 사용자 구분", short: "로그인·역할", description: "로그인이 필요한 범위와 사람마다 할 수 있는 일을 정해요.", groups: [
      { title: "로그인이 필요한가요?", description: "로그인은 사용자를 알아보는 방법이에요. 할 수 있는 일은 역할과 함께 정해요.", questions: [
        { id: "login_need", allowRecommend: true, label: "어디에 로그인이 필요한가요?", type: "single", options: ["로그인 없이 사용", "일부 기능에서만 로그인", "주요 기능은 로그인 후 사용", "아직 미정"], help: "단순히 정보를 보는 일에도 로그인이 필요한지 생각해요. 모르면 지금 정하지 않아도 돼요." },
        { id: "login_features", label: "어떤 기능을 사용할 때 로그인하나요?", type: "multi", source: "features", help: "앞에서 만든 기능 중 로그인이 필요한 대상을 골라요. 목록에 없으면 기능 단계에서 추가할 수 있어요.", when: { id: "login_need", value: "일부 기능에서만 로그인" } },
        { id: "login_methods", allowRecommend: true, label: "어떤 방법으로 로그인하면 좋을까요?", type: "multi", options: ["이메일·비밀번호", "아이디·비밀번호", "이메일 인증 링크·번호", "휴대폰 인증번호", "카카오", "네이버", "Google", "Apple", "다른 방법", "아직 미정"], optionLabels: { "다른 방법": "직접 입력" }, help: "여러 방법을 함께 제공할 수 있어요. 소셜 로그인과 서비스 안의 회원 정보·역할은 따로 정해요. 실제 계정이나 비밀번호를 적지 마세요.", when: loginRequired, optionHelp: {
          "이메일·비밀번호": { meaning: "이메일 주소와 서비스용 비밀번호로 로그인해요.", fit: "이메일을 사용자를 알아보는 값으로 쓰고 싶을 때", avoid: "비밀번호를 잊었을 때 다시 접근할 방법도 필요해요." },
          "아이디·비밀번호": { meaning: "이 서비스의 아이디와 비밀번호로 로그인해요.", fit: "이메일 대신 정한 아이디로 구분하고 싶을 때", avoid: "아이디나 비밀번호 분실 시 확인 방법도 생각해요." },
          "이메일 인증 링크·번호": { meaning: "이메일로 받은 링크나 번호를 이용해 로그인해요.", fit: "서비스용 비밀번호를 따로 기억하지 않게 하고 싶을 때", avoid: "메일 수신이 늦거나 불가능할 때의 안내가 필요해요." },
          "휴대폰 인증번호": { meaning: "휴대폰으로 받은 번호를 입력해 로그인해요.", fit: "휴대폰을 이용한 접근이 사용자에게 익숙할 때", avoid: "번호 변경이나 수신 실패를 생각해요. 가입자에 관한 모든 정보를 증명하는 것은 아니에요." },
          "카카오": { meaning: "카카오 계정을 이용해 로그인해요.", fit: "예상 사용자가 카카오 계정으로 접근하기를 원할 때", avoid: "필요한 회원 정보를 모두 받을 수 있다고 가정하지 않아요." },
          "네이버": { meaning: "네이버 계정을 이용해 로그인해요.", fit: "예상 사용자가 네이버 계정으로 접근하기를 원할 때", avoid: "로그인 성공과 서비스 이용 승인은 별도로 정해요." },
          "Google": { meaning: "Google 계정을 이용해 로그인해요.", fit: "예상 사용자가 Google 계정을 쓰는 경우", avoid: "우리 서비스의 역할과 이용 기록은 따로 정해요." },
          "Apple": { meaning: "Apple 계정을 이용해 로그인해요.", fit: "예상 사용자가 Apple 계정으로 접근하기를 원할 때", avoid: "다른 로그인 방법과 같은 사람으로 연결할지는 별도로 생각해요." }
        } },
        { id: "login_other", label: "목록에 없는 로그인 방법은 무엇인가요?", type: "text", help: "사용자가 어떻게 본인임을 확인하고 들어오는지 적어요. 실제 계정이나 비밀값은 넣지 마세요.", placeholder: "예: 회사에서 이미 사용하는 계정으로 로그인", when: { all: [loginRequired, { id: "login_methods", includes: "다른 방법" }] } },
        { id: "signup_audience", label: "누가 가입하거나 이용 승인을 받을 수 있나요?", type: "textarea", help: "누구나 가입, 초대받은 사람만, 담당자 승인처럼 필요한 조건을 적어요. 여러 조건을 조합할 수 있어요.", placeholder: "예: 누구나 가입 가능. 담당자 역할은 운영자가 확인 후 부여.", when: loginRequired },
        { id: "signup_fields", label: "회원에게 꼭 받아야 할 정보가 있나요?", type: "multi", options: ["추가 정보 없음", "표시 이름·닉네임", "이름", "이메일", "전화번호", "소속", "프로필 정보", "다른 정보", "아직 미정"], optionLabels: { "다른 정보": "직접 입력" }, help: "가입과 이용에 꼭 필요한 정보의 종류만 골라요. 실제 개인정보는 적지 않아요. 로그인 수단에서 받을 수 있는지는 나중에 확인해요.", when: loginRequired },
        { id: "signup_other", label: "추가로 받을 회원 정보와 필요한 이유는 무엇인가요?", type: "textarea", help: "정보의 종류와 쓰임만 적어요. 실제 개인정보는 넣지 마세요.", placeholder: "예: 수강할 반 — 담당 선생님과 수업 자료를 연결하기 위해 필요", when: { all: [loginRequired, { id: "signup_fields", includes: "다른 정보" }] } },
        { id: "account_actions", allowRecommend: true, label: "이용자가 자기 계정에서 무엇을 할 수 있어야 하나요?", type: "multi", options: ["프로필 수정", "연락처 변경", "다른 로그인 방법 연결", "회원 탈퇴", "담당자에게 변경 요청", "다른 계정 기능", "아직 미정"], optionLabels: { "다른 계정 기능": "직접 입력" }, help: "필요한 행동을 골라요. 계정 변경이나 탈퇴 후 자료 처리는 자료 규칙에 연결해요.", when: loginRequired },
        { id: "account_actions_other", label: "추가로 필요한 계정 기능은 무엇인가요?", type: "text", help: "", placeholder: "예: 알림 수신 설정을 한곳에서 변경", when: { all: [loginRequired, { id: "account_actions", includes: "다른 계정 기능" }] } },
        { id: "password_recovery", label: "아이디나 비밀번호를 잊으면 어떻게 다시 들어오나요?", type: "textarea", help: "사용자가 겪는 복구 방법을 적어요. 확인 방법을 모르면 미정으로 남겨요.", placeholder: "예: 등록한 이메일로 비밀번호 재설정 안내를 받아요.", when: { all: [loginRequired, { id: "login_methods", in: ["이메일·비밀번호", "아이디·비밀번호"] }] } }
      ] },
      { title: "사람마다 할 수 있는 일이 다른가요?", description: "사용자 종류가 다를 때만 나누어요. 비회원이나 운영 담당자도 포함할 수 있어요.", questions: [
        { id: "roles", label: "역할별로 무엇을 보거나 할 수 있나요?", type: "rows", rowLabel: "역할", help: "모두 같은 일을 한다면 한 역할만 적거나 비워 두어도 돼요. 사용자 설명을 반복하기보다 권한 차이를 적어요.", fields: [
          { id: "role", label: "역할 이름", placeholder: "예: 신청자 / 작업실 담당자" },
          { id: "actions", label: "할 수 있는 행동", placeholder: "예: 내 예약 신청·취소 / 신청 승인" },
          { id: "data", label: "볼 수 있는 자료", placeholder: "예: 본인 예약 / 담당 작업실 예약" }
        ] }
      ] }
    ] },
    { id: "data", title: "자료와 서비스 규칙", short: "자료·규칙", description: "기억할 정보와 이용자가 알아야 할 기본 규칙을 정리해요.", groups: [
      { title: "어떤 정보를 남기고 다루나요?", description: "기능에서 필요한 자료만 생각해요. 자료마다 공개·수정·삭제 방법이 달라도 돼요.", questions: [
        { id: "data_items", label: "사용을 마친 뒤에도 기억해야 할 정보가 있나요?", type: "rows", rowLabel: "자료", help: "예: 예약 내용, 작성한 글, 즐겨찾기. 자료가 없다면 비워 두거나 그 사실을 적어요. 실제 개인정보는 넣지 마세요.", fields: [
          { id: "name", label: "자료 이름", placeholder: "예: 예약 기록" },
          { id: "purpose", label: "남길 내용과 이유", placeholder: "예: 신청자·날짜·처리 상태 확인" },
          { id: "access", label: "누가 볼 수 있나요?", placeholder: "예: 본인과 해당 작업실 담당자" },
          { id: "change", label: "누가 언제 바꾸나요?", placeholder: "예: 신청자는 이용 전날까지 시간 변경" },
          { id: "deletion", label: "삭제·탈퇴 후에는 어떻게 하나요?", placeholder: "예: 초안은 삭제 가능, 완료 기록 보관 기간은 미정" }
        ] },
        { id: "general_rules", label: "여러 기능에 함께 적용할 규칙이 있나요?", type: "textarea", help: "기능 카드에 적은 내용은 반복하지 않아요. 이용 시간, 작성 제한, 잘못된 정보의 수정·신고 등 공통 규칙만 적어요.", placeholder: "예: 담당자도 다른 작업실의 신청 내용을 볼 수 없어요." }
      ] },
      { title: "선택한 기능에서 더 확인할 점", description: "고른 기능에 필요한 질문만 보여요. 세부 숫자나 정책을 모르면 미정으로 남겨요.", questions: [
        { id: "booking_rules", label: "신청·예약의 확정, 중복, 마감, 취소는 어떻게 하나요?", type: "textarea", help: "기능 이름과 규칙을 연결해요. 정원, 동일 시간 중복, 확정하는 사람, 취소 가능 시점 중 필요한 것만 적어요.", placeholder: "예: 같은 시간에는 한 팀만 예약. 신청 즉시 확정, 이용 전날까지 취소 가능.", when: category("booking") },
        { id: "workflow_rules", label: "처리 상태는 누가 어떤 조건에서 바꾸나요?", type: "textarea", help: "접수 → 승인 → 완료처럼 필요한 순서와 반려·취소 후 결과를 적어요. 기능 카드에 있다면 빠진 조건만 보완해요.", placeholder: "예: 담당자가 승인하거나 이유를 적어 반려. 신청자는 승인 전까지 수정 가능.", when: category("workflow") },
        { id: "file_rules", label: "어떤 파일을 받고, 누가 확인하거나 내려받나요?", type: "textarea", help: "파일 종류와 대략적인 개수·크기, 볼 수 있는 사람을 적어요. 수치를 모르겠다면 실제 올릴 자료의 예를 적어요.", placeholder: "예: 신청마다 사진 3장 정도. 신청자와 담당자만 확인. PDF 안내문은 누구나 다운로드.", when: category("files") },
        { id: "notification_rules", label: "어떤 일이 생기면 누구에게 어떻게 알리나요?", type: "textarea", help: "사건, 받을 사람, 경로를 연결해요. 서비스 안 알림, 이메일, 문자 등 필요한 안내만 적어요.", placeholder: "예: 예약 취소 시 신청자에게 이메일, 담당자에게 서비스 안 알림.", when: category("notifications") },
        { id: "payment_offer", label: "무엇에 돈을 내며 결제 후 무엇을 받나요?", type: "textarea", help: "상품, 예약 이용료, 서비스 이용권 등을 구분해요. 무료 범위나 가격이 정해졌다면 함께 적어요.", placeholder: "예: 작업실 2시간 이용료를 내면 그 시간의 예약이 확정돼요.", when: category("payments") },
        { id: "payment_timing", label: "결제는 어떤 방식으로 받나요?", type: "multi", options: ["필요할 때 한 번씩 결제", "정기적으로 반복 결제", "이용한 양에 따라 결제", "별도 계약·현장 결제", "아직 미정"], help: "함께 사용할 방식을 골라요. 예: 매달 기본요금과 이용량 요금. 상품마다 다르면 결제 설명에 구분해요.", when: category("payments") },
        { id: "payment_cancel", label: "취소·환불하거나 결제가 안 되면 어떻게 안내하나요?", type: "textarea", help: "상품별 취소 시점과 신청·이용 상태 등 바라는 기본 흐름을 적어요. 확인하지 못한 기준은 미정으로 남겨요.", placeholder: "예: 결제 실패 시 예약은 확정하지 않고 다시 결제할 수 있게 해요. 환불 기준은 확인 필요.", when: category("payments") },
        { id: "ai_help", label: "AI에 무엇을 주고 어떤 도움을 받나요?", type: "textarea", help: "입력 자료와 원하는 결과를 연결해요. 회사 자료나 개인정보는 보낼 수 있는 범위만 적고 실제 내용은 넣지 않아요.", placeholder: "예: 공지 초안을 넣으면 빠진 정보와 이해하기 어려운 문장을 짚어 줘요.", when: category("ai") },
        { id: "ai_review", allowRecommend: true, label: "AI 결과는 어떻게 확인하고 사용하나요?", type: "textarea", help: "수정, 재요청, 출처 확인, 사람이 확인 후 적용 등 필요한 경험과 기대에 못 미칠 때의 동작을 적어요.", placeholder: "예: 원문과 제안을 비교하고 사용자가 선택한 문장만 공지에 반영해요.", when: category("ai") },
        { id: "location_use", label: "지도나 위치로 어떤 일을 하나요?", type: "multi", options: ["정해진 장소를 지도에서 보기", "주소·장소 검색", "내 현재 위치 주변 찾기", "내 위치를 다른 사람에게 공유", "다른 용도", "아직 미정"], optionLabels: { "다른 용도": "직접 입력" }, help: "장소 표시만 필요하면 현재 위치를 받을 필요는 없어요. 위치 공유는 누구에게 언제까지 보이는지도 생각해요.", when: category("location") },
        { id: "location_sharing", label: "내 위치는 누구에게 언제까지 보이며 어떻게 공유를 멈추나요?", type: "textarea", help: "공유를 켜고 끄는 사람, 볼 수 있는 사람, 끝나는 시점을 적어요. 한 번 보낸 위치인지 계속 바뀌는 위치인지도 구분해요.", placeholder: "예: 동행자로 초대한 사람에게만 현재 위치 표시. 모임 종료 또는 본인이 중단하면 더 이상 표시하지 않아요.", when: { all: [category("location"), { id: "location_use", includes: "내 위치를 다른 사람에게 공유" }] } },
        { id: "location_other", label: "지도·위치로 할 다른 일은 무엇인가요?", type: "textarea", help: "사용자가 할 일과 보여 줄 결과를 적어요. 필요한 위치가 장소의 주소인지 이용자의 현재 위치인지도 구분해요.", placeholder: "예: 입력한 두 장소 사이의 이동 거리를 비교해요.", when: { all: [category("location"), { id: "location_use", includes: "다른 용도" }] } },
        { id: "device_needs", label: "실제로 필요한 기기 기능은 무엇인가요?", type: "multi", options: ["카메라로 촬영", "마이크로 음성 입력", "현재 위치 사용", "기기 기능이 필요하지 않음", "다른 기능", "아직 미정"], optionLabels: { "다른 기능": "직접 입력" }, help: "웹과 설치 앱 모두 필요한 경우에만 골라요. 기존 사진·파일을 고르는 것과 직접 촬영은 달라요.", when: { any: [category("device"), category("location"), category("files")] } },
        { id: "device_other", label: "목록에 없는 기기 기능은 무엇이며 어디에 쓰나요?", type: "textarea", help: "기능 이름을 몰라도 원하는 행동으로 설명해요. 실제로 필요한지 확인할 점이 있다면 함께 남겨요.", placeholder: "예: 가까이에 있는 측정 기기에서 수치를 받아 기록해요.", when: { all: [{ any: [category("device"), category("location"), category("files")] }, { id: "device_needs", includes: "다른 기능" }] } },
        { id: "permission_alternative", allowRecommend: true, label: "기기 기능 사용을 허용하지 않으면 어떻게 하나요?", type: "textarea", help: "해당 기능만 제한할지, 직접 입력이나 파일 선택 같은 대안을 제공할지 적어요. 전체 서비스를 막아야 하는지도 생각해요.", placeholder: "예: 위치를 허용하지 않아도 동네 이름을 직접 입력해 찾을 수 있어요.", when: { any: [
          { all: [{ any: [category("device"), category("location"), category("files")] }, { id: "device_needs", in: ["카메라로 촬영", "마이크로 음성 입력", "현재 위치 사용", "다른 기능"] }] },
          { all: [category("location"), { id: "location_use", in: ["내 현재 위치 주변 찾기", "내 위치를 다른 사람에게 공유"] }] }
        ] } },
        { id: "collaboration_rules", label: "누구와 어떤 자료를 함께 사용하나요?", type: "textarea", help: "초대, 보기·수정 범위, 동시 수정, 공유 취소·구성원 탈퇴 후 처리를 필요한 만큼 적어요.", placeholder: "예: 초대한 팀원은 일정 수정 가능. 같은 일정을 고치면 충돌을 알리고 확인하게 해요.", when: category("collaboration") }
      ] }
    ] },
    { id: "references", title: "참고 서비스와 디자인 방향", short: "참고·분위기", description: "참고할 주소와 실제로 바라는 화면 분위기를 남겨요.", groups: [
      { title: "참고할 부분이 있나요?", description: "자료가 없어도 괜찮아요. URL을 적는 것만으로 내용을 열람하거나 분석한 것은 아니에요.", questions: [
        { id: "references", label: "참고하고 싶은 서비스나 디자인의 주소가 있나요?", type: "references", help: "한 행에 URL 하나를 넣어요. 참고할 부분은 선택 메모이며 여러 주소를 줄별로 붙여 넣을 수 있어요." },
        { id: "visual_style", allowRecommend: true, label: "어떤 분위기를 바라나요?", type: "multi", options: ["간결하고 실용적인", "차분하고 전문적인", "밝고 친근한", "사진·이미지가 중심인", "개성이 뚜렷한", "다른 분위기", "아직 미정"], optionLabels: { "다른 분위기": "직접 입력" }, help: "가까운 방향을 함께 골라도 돼요. 정답이 있는 분류가 아니며 실제 참고 화면이 더 도움이 될 수 있어요." },
        { id: "visual_style_other", label: "원하는 다른 분위기를 적어 주세요.", type: "text", help: "", placeholder: "예: 오래된 공책처럼 편안한 느낌", when: { id: "visual_style", includes: "다른 분위기" } },
        { id: "brand_notes", label: "정해진 색상·로고나 지키고 싶은 표현이 있나요?", type: "textarea", help: "이미 있는 자료나 확실한 희망만 적어요. 피하고 싶은 표현도 남길 수 있고 없으면 비워 두어요.", placeholder: "예: 동네 로고의 초록색 사용. 작은 글씨와 과한 움직임은 피하고 싶어요." }
      ] }
    ] },
    { id: "screens", title: "화면 구성", short: "화면", description: "화면에서 할 일을 정한 뒤 필요한 요소를 함께 골라요.", groups: [
      { title: "어떤 화면이 필요한가요?", description: "앞의 기능과 화면을 연결해요. 구성요소를 모르겠다면 화면 이름과 목적만 적어도 돼요.", questions: [
        { id: "screens", allowRecommend: true, label: "화면마다 무엇을 보여 주고 어떤 일을 하나요?", type: "screens", help: "표·메뉴·버튼 등을 함께 사용할 수 있어요. 고른 요소의 역할, 빈 내용·실패 상황, 휴대폰에서 달라질 점을 필요한 화면에만 보완해요." }
      ] }
    ] },
    { id: "review", title: "첫 버전 정리", short: "첫 버전·검토", description: "이미 적은 기능을 검토하고 확인할 일을 남겨요.", groups: [
      { title: "처음에는 어디까지 만들까요?", description: "처음 사용할 사람이 핵심 일을 끝낼 수 있는 범위로 생각해요.", questions: [
        { id: "scope", allowRecommend: true, label: "기능별 첫 버전 우선순위를 확인해 주세요.", type: "scope", help: "기능 단계의 같은 목록을 검토해요. 여기서 바꾸면 원래 기능에도 반영돼요. 미정인 기능을 억지로 확정하지 않아도 돼요." },
        { id: "excluded_work", label: "추가로 이번에는 하지 않을 일이 있나요?", type: "textarea", help: "이미 ‘나중에’로 정한 기능은 다시 쓰지 않아요. 오해하기 쉬운 제외 범위나 나중에 검토할 조건만 적어요.", placeholder: "예: 첫 버전은 한 작업실만 대상. 여러 지점 운영은 실제 사용을 확인한 뒤 검토." }
      ] },
      { title: "무엇을 확인하면 다음으로 갈 수 있나요?", description: "이 자료는 검토할 서비스 기획 초안이에요. 빈칸이 없다고 기획 검증이나 개발 준비가 끝난 것은 아니에요.", questions: [
        { id: "success_check", allowRecommend: true, label: "이 아이디어가 쓸모 있는지 어떻게 확인할까요?", type: "textarea", help: "처음 사용할 사람과 확인할 행동·반응을 적어요. 복잡한 수치가 없어도 돼요.", placeholder: "예: 주민 3명과 담당자에게 화면 초안을 보여 주고 도움 없이 예약 과정을 이해하는지 확인." },
        { id: "open_questions", label: "아직 모르거나 다른 사람과 확인할 점은 무엇인가요?", type: "textarea", help: "궁금한 점, 확인할 사람·자료, 다음에 결정할 일을 남겨요. 다른 단계의 미정 답도 초안에 함께 표시돼요.", placeholder: "예: 담당자에게 실제 취소 기준 확인. 주민이 회원가입 없는 예약을 원하는지 물어보기." }
      ] }
    ] }
  ];
  const api = { steps, featureTypes, uiElements };
  root.BriefQuestions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
