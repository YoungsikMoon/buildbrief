(function (root) {
  'use strict';
  const screenRecommendationScope =
    '필요한 요소와 배치, 보여 줄 정보, 빈 화면·오류 안내, 휴대폰에서의 구성';
  const featureTypes = [
    {
      id: 'browse',
      label: '정보 보기',
      description: '안내, 소식, 상품 등을 목록과 상세 화면에서 봐요.',
      fit: '필요한 정보를 확인하는 일이 중요할 때',
      avoid: '보여 줄 내용을 정하지 않은 채 화면부터 늘리지 않아요.'
    },
    {
      id: 'search',
      label: '검색·필터',
      description: '원하는 항목을 찾고 조건이나 순서로 좁혀 봐요.',
      fit: '항목이 많거나 사람마다 찾는 조건이 다를 때',
      avoid: '한눈에 볼 만큼 적은 항목이라면 검색창이 필요 없을 수 있어요.'
    },
    {
      id: 'content',
      label: '작성·관리',
      description: '글, 메모, 자료를 만들고 고치거나 정리해요.',
      fit: '이용자가 자기 내용을 직접 남기고 관리할 때',
      avoid: '예약이나 결제까지 글쓰기로 묶지 말고 실제 할 일을 따로 적어요.'
    },
    {
      id: 'booking',
      label: '예약·신청',
      description: '원하는 시간이나 대상을 고르고 이용을 신청해요.',
      fit: '자리, 시간, 참가 인원처럼 신청할 대상이 있을 때',
      avoid: '신청 버튼만 정하지 말고 확정 조건과 취소 가능 여부도 생각해요.'
    },
    {
      id: 'workflow',
      label: '승인·처리 상태',
      description: '접수, 검토, 승인, 완료처럼 일이 진행된 상태를 확인해요.',
      fit: '신청자와 처리자가 다르거나 여러 단계를 거칠 때',
      avoid: '상태를 바꾸는 사람과 조건이 불분명하면 단계 이름부터 늘리지 않아요.'
    },
    {
      id: 'schedule',
      label: '일정·달력',
      description: '약속, 할 일, 마감일을 날짜와 연결해 봐요.',
      fit: '언제 해야 하는지가 중요한 서비스일 때',
      avoid: '날짜가 참고 정보일 뿐이라면 목록만으로 충분할 수 있어요.'
    },
    {
      id: 'files',
      label: '사진·파일',
      description: '사진이나 문서를 첨부하고 확인하거나 내려받아요.',
      fit: '글만으로 전달하기 어려운 증빙이나 자료가 필요할 때',
      avoid: '파일 선택과 직접 촬영은 달라요. 필요한 행동만 정해요.'
    },
    {
      id: 'community',
      label: '댓글·리뷰·반응',
      description: '게시물이나 상품에 의견, 후기, 좋아요를 남겨요.',
      fit: '다른 사람의 의견이나 평가를 함께 볼 때',
      avoid: '문의 답변만 필요하다면 공개 댓글 대신 문의로 구체화해도 돼요.'
    },
    {
      id: 'chat',
      label: '문의·대화',
      description: '이용자끼리 또는 담당자와 메시지를 주고받아요.',
      fit: '질문과 답변이 오가거나 상대와 조율해야 할 때',
      avoid: '즉시 답변할 사람이 없다면 실시간 응답을 약속하지 않아요.'
    },
    {
      id: 'notifications',
      label: '알림',
      description: '예약 변경이나 답변 도착처럼 알아야 할 일을 알려 줘요.',
      fit: '이용자가 계속 화면을 확인하지 않아도 변화를 알아야 할 때',
      avoid: '모든 행동보다 놓치면 곤란한 사건부터 골라요.'
    },
    {
      id: 'payments',
      label: '구매·결제·구독',
      description: '상품이나 서비스에 돈을 내고 구매 결과를 확인해요.',
      fit: '서비스 안에서 주문이나 결제 과정을 제공할 때',
      avoid: '가격 안내만 있거나 외부에서 계약한다면 그 범위만 적어요.'
    },
    {
      id: 'personalization',
      label: '즐겨찾기·내 기록',
      description: '관심 항목, 최근 본 내용, 나의 활동을 모아 봐요.',
      fit: '같은 사람이 다시 찾아와 이전 활동을 이어갈 때',
      avoid: '내 기록이 필요하다고 반드시 로그인해야 하는 것은 아니에요.'
    },
    {
      id: 'analytics',
      label: '집계·통계',
      description: '여러 기록을 합쳐 현황이나 변화, 비교 결과를 봐요.',
      fit: '숫자를 보고 다음 행동이나 판단을 해야 할 때',
      avoid: '차트 수보다 어떤 판단에 필요한 숫자인지 먼저 생각해요.'
    },
    {
      id: 'location',
      label: '지도·위치',
      description: '장소를 지도에서 찾거나 위치를 기준으로 정보를 봐요.',
      fit: '장소나 거리가 이용자의 선택에 영향을 줄 때',
      avoid: '지도 표시와 이용자의 현재 위치 수집은 달라요.'
    },
    {
      id: 'ai',
      label: 'AI 도움',
      description: '입력한 내용을 바탕으로 답변, 요약, 추천, 초안을 받아요.',
      fit: '이용자가 결과를 확인하고 활용할 구체적인 일이 있을 때',
      avoid: 'AI의 결과가 언제나 맞거나 바로 실행해도 된다고 가정하지 않아요.'
    },
    {
      id: 'collaboration',
      label: '공유·공동 작업',
      description: '다른 사람을 초대하고 같은 자료를 보거나 함께 고쳐요.',
      fit: '여러 사람이 같은 자료로 함께 일할 때',
      avoid: '링크를 보내는 것과 수정 권한을 주는 것을 구분해요.'
    },
    {
      id: 'admin',
      label: '운영·관리',
      description: '담당자가 사용자, 게시물, 신청 등을 확인하고 처리해요.',
      fit: '이용자 화면만으로 처리할 수 없는 운영 업무가 있을 때',
      avoid: '관리자라고 모든 자료를 보거나 바꿀 수 있다고 정하지 않아요.'
    },
    {
      id: 'device',
      label: '촬영·음성·기기 기능',
      description: '카메라나 마이크처럼 이용 기기의 기능을 사용해요.',
      fit: '사진을 바로 찍거나 음성으로 입력하는 일이 필요할 때',
      avoid: '웹과 설치 앱 모두 필요한 기기 기능과 거절 시 대안을 생각해요.'
    },
    {
      id: 'custom',
      label: '직접 추가',
      description: '목록에 없는 이 서비스만의 일을 내 말로 적어요.',
      fit: '후보 이름보다 구체적인 업무를 바로 설명할 수 있을 때',
      avoid: '목록에 없다는 이유로 핵심 기능을 빼지 않아요.'
    }
  ];
  const uiElementGroups = [
    {
      id: 'navigation',
      label: '화면 틀·이동',
      description: '메뉴를 배치하고 다른 화면으로 이동해요.'
    },
    { id: 'content', label: '내용 표시', description: '글·사진·일정·숫자를 보기 좋게 보여 줘요.' },
    { id: 'input', label: '입력·찾기', description: '정보를 입력하거나 원하는 자료를 찾아요.' },
    {
      id: 'action',
      label: '행동 실행',
      description: '저장·신청 같은 행동이나 링크 이동을 제공해요.'
    },
    {
      id: 'feedback',
      label: '알림·진행 상태',
      description: '알아야 할 소식과 처리 중인 상태를 알려 줘요.'
    },
    {
      id: 'overlay',
      label: '보조 화면',
      description: '현재 화면에서 확인·선택·상세 보기를 이어가요.'
    }
  ];
  const collectionDetail = {
    label: '항목이 많아지면 어떻게 이어서 보나요?',
    multiple: false,
    options: [
      {
        id: 'all',
        label: '한 번에 모두 보기',
        meaning: '항목을 나누지 않고 한 화면에 모두 보여 줘요.',
        fit: '항목 수가 적고 앞으로도 크게 늘지 않을 때',
        avoid: '항목이 많아지면 화면이 느려지고 원하는 위치를 찾기 어려워져요.'
      },
      {
        id: 'pages',
        label: '페이지 번호로 이동',
        meaning: '일정 개수로 나눈 뒤 이전·다음이나 페이지 번호로 이동해요.',
        fit: '자료를 비교하거나 이전에 본 위치로 돌아가야 할 때',
        avoid:
          '페이지를 넘기는 행동이 필요해요. 정렬과 자료 변경에 따라 같은 번호의 내용이 달라질 수 있어요.'
      },
      {
        id: 'more',
        label: '더 보기 버튼',
        meaning: '버튼을 누르면 지금 본 항목 아래에 다음 항목을 붙여요.',
        fit: '사용자가 읽는 양을 조절하며 상품이나 게시물을 둘러볼 때',
        avoid:
          '많이 펼친 뒤에는 화면이 길어져요. 상세 화면에서 돌아올 때 펼친 범위와 위치를 유지하는 편이 좋아요.'
      },
      {
        id: 'infinite',
        label: '스크롤하면 계속 불러오기',
        meaning: '아래로 내려가면 다음 항목을 자동으로 붙여요.',
        fit: '사진이나 소식을 끊김 없이 둘러보는 것이 주된 목적일 때',
        avoid:
          '특정 위치로 돌아가거나 화면 맨 아래에 닿기 어려워요. 정확한 자료 비교·관리에는 페이지 이동이 더 맞을 수 있어요.'
      }
    ]
  };
  const uiElements = [
    {
      id: 'appbar',
      example: '화면 맨 위의 가로 영역에 로고, 둘러보기, 내 예약과 프로필을 모은 상단 바 예시.',
      group: 'navigation',
      label: '상단 바',
      meaning: '화면 위쪽에 제목, 메뉴, 계정 등의 공통 정보를 놓아요.',
      fit: '현재 화면과 공통 이동 경로를 보여 줄 때',
      avoid: '좁은 화면에서 메뉴를 모두 펼치면 내용이 밀릴 수 있어요.',
      prompt: '제목과 어떤 메뉴·행동을 넣을까요?'
    },
    {
      id: 'sidebar',
      example: '본문 왼쪽에 대시보드, 내 수업, 예약 관리, 설정을 세로로 배치한 메뉴 예시.',
      group: 'navigation',
      label: '왼쪽 메뉴',
      meaning: '왼쪽에 메뉴를 세로로 두고 다른 영역으로 이동해요.',
      fit: 'PC에서 여러 업무 화면을 자주 오갈 때',
      avoid: '휴대폰에서는 본문 공간을 차지하므로 접거나 다른 이동 방식을 생각해요.',
      prompt: '어떤 메뉴가 있고 현재 위치는 어떻게 보여 줄까요?'
    },
    {
      id: 'bottomnav',
      example: '화면 아래에서 홈, 둘러보기, 내 예약, 내 정보로 이동하는 하단 메뉴 예시.',
      group: 'navigation',
      label: '하단 메뉴',
      meaning: '화면 아래쪽에서 자주 쓰는 주요 영역으로 이동해요.',
      fit: '휴대폰에서 소수의 주요 화면을 반복해 오갈 때',
      avoid: '많은 메뉴나 저장·삭제 같은 개별 행동을 모두 넣지 않아요.',
      prompt: '항상 접근할 주요 화면은 무엇인가요?'
    },
    {
      id: 'tabs',
      example: '수업 소개, 일정, 후기 중 하나를 골라 같은 수업의 다른 내용을 보는 탭 예시.',
      group: 'navigation',
      label: '탭',
      meaning: '관련된 내용을 한 영역 안에서 나눠 보여 줘요.',
      fit: '상세·활동 내역처럼 같은 대상의 다른 내용을 볼 때',
      avoid: '순서대로 해야 하는 작성 과정은 탭만으로 표현하면 헷갈릴 수 있어요.',
      prompt: '어떤 내용을 나누고 처음에는 어느 탭을 보여 줄까요?'
    },
    {
      id: 'list',
      example: '사진, 수업 이름, 날짜와 상태를 한 줄씩 나열한 예약 목록 예시.',
      group: 'content',
      detail: collectionDetail,
      label: '목록',
      meaning: '항목을 한 줄씩 나열하고 필요한 내용을 선택하게 해요.',
      fit: '이름, 상태, 날짜 같은 간단한 정보를 훑어볼 때',
      avoid: '항목마다 비교할 값이 많으면 줄이 복잡해질 수 있어요.',
      prompt: '한 항목에 무엇을 보여 주고 누르면 어디로 가나요?'
    },
    {
      id: 'cards',
      example: '수업별 사진, 이름, 일정, 가격과 예약 버튼을 각각 묶은 카드 예시.',
      group: 'content',
      detail: collectionDetail,
      label: '카드',
      meaning: '관련 정보와 행동을 하나의 상자에 묶어 보여 줘요.',
      fit: '사진과 설명을 함께 보거나 항목을 탐색할 때',
      avoid: '수치를 행끼리 비교해야 하면 표가 더 읽기 쉬울 수 있어요.',
      prompt: '카드마다 어떤 정보와 행동을 넣을까요?'
    },
    {
      id: 'table',
      example: '여러 수업의 날짜, 신청자 수와 상태를 행과 열로 비교하는 표 예시.',
      group: 'content',
      detail: collectionDetail,
      label: '표(Table)',
      meaning: '행과 열로 항목의 같은 속성을 나란히 보여 줘요.',
      fit: '상태, 날짜, 금액 등을 비교하거나 여러 항목을 관리할 때',
      avoid: '휴대폰에서는 꼭 필요한 열을 남기거나 상세 화면 이동을 생각해요.',
      prompt: '어떤 열을 보여 주고 정렬·선택·행동이 필요한가요?'
    },
    {
      id: 'calendar',
      example: '요일과 시간에 맞춰 도자기, 요리, 꽃꽂이 수업을 배치한 주간 달력 예시.',
      group: 'content',
      label: '달력',
      meaning: '일정이나 이용 가능한 시간을 날짜에 맞춰 보여 줘요.',
      fit: '날짜별 빈자리, 약속, 마감을 확인할 때',
      avoid: '일정의 자세한 설명이 더 중요하면 목록을 함께 검토해요.',
      prompt: '어떤 일정을 표시하고 날짜를 고르면 무엇을 하나요?'
    },
    {
      id: 'map',
      example: '길과 주변 장소 위에 도자기 공방과 요리 교실의 위치를 표시한 지도 예시.',
      group: 'content',
      label: '지도',
      meaning: '장소의 위치와 주변 관계를 지도에 표시해요.',
      fit: '거리나 위치를 보고 장소를 선택해야 할 때',
      avoid: '주소만 확인하면 지도 없이도 가능해요. 현재 위치 권한은 별도로 정해요.',
      prompt: '어떤 장소를 표시하고 누르면 무엇을 보여 줄까요?'
    },
    {
      id: 'chart',
      example: '요일별 신청 수를 막대 높이로 비교하는 차트 예시.',
      group: 'content',
      label: '차트',
      meaning: '숫자의 변화나 항목 간 차이를 그림으로 보여 줘요.',
      fit: '추세, 비율, 크기를 비교해 판단할 때',
      avoid: '정확한 개별 값이 중요하면 숫자나 표도 함께 제공해요.',
      prompt: '무엇을 비교하며 어떤 판단을 하길 바라나요?'
    },
    {
      id: 'form',
      example: '이름, 수업, 날짜와 시간을 입력하거나 선택해 신청하는 입력 양식 예시.',
      group: 'input',
      detail: {
        label: '어떤 방식으로 입력하나요?',
        multiple: true,
        options: [
          {
            id: 'text',
            label: '글 입력',
            meaning: '이름처럼 짧은 글이나 설명처럼 긴 글을 직접 적어요.',
            fit: '미리 정한 선택지로 표현하기 어려운 내용을 받을 때',
            avoid: '표현과 오타가 제각각일 수 있어요. 답이 정해져 있다면 선택형 입력이 더 편해요.'
          },
          {
            id: 'number',
            label: '숫자 입력',
            meaning: '수량·금액처럼 계산에 쓸 숫자를 받아요.',
            fit: '최소·최대 범위나 단위가 있는 수치를 입력할 때',
            avoid:
              '전화번호·우편번호는 계산할 숫자가 아니에요. 앞의 0이나 기호를 유지해야 하므로 별도로 다뤄요.'
          },
          {
            id: 'radio',
            label: '하나 선택',
            meaning: '선택지를 모두 보여 주고 그중 하나만 고르게 해요.',
            fit: '배송 방법처럼 서로 함께 선택할 수 없는 후보가 몇 개 있을 때',
            avoid: '후보가 많으면 화면이 길어져요. 목록을 펼쳐 고르거나 검색하는 방식을 검토해요.'
          },
          {
            id: 'checkbox',
            label: '여러 개 선택',
            meaning: '체크 상자로 원하는 항목을 여러 개 고르게 해요.',
            fit: '관심 분야나 필요한 서비스처럼 함께 선택할 수 있을 때',
            avoid:
              '‘없음’과 다른 항목처럼 모순되는 조합은 막아야 해요. 선택 개수 제한이 있다면 알려 줘요.'
          },
          {
            id: 'select',
            label: '목록을 펼쳐서 선택',
            meaning: '접혀 있는 목록을 열어 항목을 고르게 해요.',
            fit: '지역처럼 후보가 많고 화면 공간을 아끼고 싶을 때',
            avoid:
              '열기 전에는 후보가 보이지 않아 비교하기 어려워요. 아주 긴 목록에는 검색도 필요할 수 있어요.'
          },
          {
            id: 'switch',
            label: '켜기·끄기',
            meaning: '스위치로 설정의 켜짐과 꺼짐을 바꿔요.',
            fit: '알림 받기처럼 두 상태가 명확한 설정을 바로 바꿀 때',
            avoid:
              '신청·동의·결제 확인을 대신하지 않아요. 따로 저장해야 한다면 그 사실을 분명히 알려야 해요.'
          },
          {
            id: 'datetime',
            label: '날짜·시간 선택',
            meaning: '예약일이나 시작 시간을 달력·시간 목록에서 골라요.',
            fit: '날짜 형식을 맞추거나 가능한 날짜·시간을 안내할 때',
            avoid:
              '생년월일처럼 먼 날짜는 직접 입력이 더 빠를 수 있어요. 마감 시간과 이용 가능한 범위를 정해요.'
          }
        ]
      },
      label: '입력 양식',
      meaning: '글, 선택 항목, 날짜처럼 필요한 값을 입력하는 영역이에요.',
      fit: '신청, 정보 수정, 설정처럼 정해진 내용을 받을 때',
      avoid: '불필요한 정보까지 필수로 받거나 긴 양식을 한꺼번에 요구하지 않아요.',
      prompt: '입력할 내용과 꼭 필요한 항목은 무엇인가요?'
    },
    {
      id: 'upload',
      example: '파일 선택 버튼과 선택한 사진의 미리보기를 제공하는 파일 첨부 예시.',
      group: 'input',
      label: '사진·파일 첨부',
      meaning: '사진이나 문서를 골라 올리는 영역이에요.',
      fit: '증빙, 프로필 사진, 함께 볼 자료를 받을 때',
      avoid: '파일 선택과 카메라 촬영은 다른 행동이에요. 필요한 쪽만 정해요.',
      prompt: '어떤 파일을 몇 개 받으며 완료·실패를 어떻게 알릴까요?'
    },
    {
      id: 'search',
      example: '검색창에 도자기를 입력하고 관련 수업을 찾는 예시.',
      group: 'input',
      label: '검색창',
      meaning: '단어나 번호를 입력해 원하는 내용을 찾아요.',
      fit: '찾을 이름이나 단어를 이용자가 알고 있을 때',
      avoid: '모든 정보를 검색할 수 있다고 약속하지 말고 대상을 정해요.',
      prompt: '무엇으로 어떤 대상을 찾으며 결과가 없으면 무엇을 안내하나요?'
    },
    {
      id: 'filters',
      example: '지역과 요일로 수업을 좁히고 표시 순서를 바꾸는 필터·정렬 예시.',
      group: 'input',
      label: '필터·정렬',
      meaning: '조건에 맞는 항목만 보거나 표시 순서를 바꿔요.',
      fit: '상태, 날짜, 지역 등으로 목록을 좁혀야 할 때',
      avoid: '조건이 너무 많으면 고르기 어려우므로 자주 쓰는 조건부터 보여 줘요.',
      prompt: '어떤 조건과 정렬이 필요하며 선택을 어떻게 해제하나요?'
    },
    {
      id: 'rightpanel',
      example:
        '예약 목록을 계속 보면서 오른쪽에서 선택한 예약의 상세 내용을 확인하는 보조 패널 예시.',
      group: 'overlay',
      label: '오른쪽 보조 패널',
      meaning: '주 화면 옆에서 선택한 항목의 상세 정보나 보조 작업을 보여 줘요.',
      fit: '목록을 유지한 채 상세 정보를 빠르게 확인하거나 수정할 때',
      avoid: '작은 화면에서는 별도 상세 화면이나 접히는 영역이 더 편할 수 있어요.',
      prompt: '언제 열리고 무엇을 보여 주며 휴대폰에서는 어떻게 볼까요?'
    },
    {
      id: 'dialog',
      example: '배경을 어둡게 하고 화면 가운데에서 예약 취소 여부를 확인하는 대화 상자 예시.',
      group: 'overlay',
      label: '대화 상자',
      meaning: '현재 화면 위에 잠깐 나타나 확인이나 짧은 입력을 받아요.',
      fit: '삭제 확인이나 간단한 선택처럼 지금 끝낼 작은 작업이 있을 때',
      avoid: '긴 작성이나 자주 반복하는 작업은 별도 화면이 더 편할 수 있어요.',
      prompt: '언제 열리고 확인·취소하면 각각 어떻게 되나요?'
    },
    {
      id: 'footer',
      example: '페이지 끝에 이용약관, 개인정보처리방침과 문의 링크를 모은 푸터 예시.',
      group: 'navigation',
      label: '화면 아래 공통 정보(푸터)',
      meaning: '페이지 끝에 운영자 정보, 이용약관, 문의·관련 링크를 모아요.',
      fit: '여러 화면에서 공통으로 찾아볼 안내가 있을 때',
      avoid:
        '주요 작업 버튼을 숨겨 두지 않아요. 무한 스크롤을 쓰면 페이지 끝에 도달하기 어려울 수 있어요.',
      prompt: '어떤 정보와 링크를 모아 둘까요?'
    },
    {
      id: 'drawer',
      example: '메뉴 버튼으로 연 왼쪽 이동 메뉴와 그 뒤로 어두워진 본문을 보여 주는 예시.',
      group: 'navigation',
      label: '접었다 여는 메뉴',
      meaning: '메뉴 버튼을 누르면 옆에서 이동 메뉴가 펼쳐져요.',
      fit: '휴대폰처럼 좁은 화면에 여러 이동 경로를 제공할 때',
      avoid:
        '메뉴를 열기 전에는 경로가 보이지 않아요. 자주 쓰는 핵심 이동은 바로 보이게 두는 편이 좋아요.',
      prompt: '어떤 메뉴를 넣고 어떤 버튼으로 열까요?'
    },
    {
      id: 'breadcrumbs',
      example: '홈, 클래스, 도자기의 순서로 현재 화면의 상위 경로를 보여 주는 예시.',
      group: 'navigation',
      label: '현재 위치 경로',
      meaning: '‘홈 > 자료 > 상세’처럼 현재 화면의 상위 경로를 보여 줘요.',
      fit: '분류가 여러 단계이고 상위 목록으로 돌아갈 일이 많을 때',
      avoid:
        '방문 기록이나 작성 순서를 표시하는 용도와는 달라요. 화면 구조가 단순하면 없어도 돼요.',
      prompt: '어떤 상위 경로를 표시하고 어디로 돌아갈 수 있나요?'
    },
    {
      id: 'image',
      example: '수업 내용을 설명하기 위해 도자기 만드는 사진 한 장을 보여 주는 이미지 예시.',
      group: 'content',
      label: '이미지',
      meaning: '상품 사진, 안내 그림처럼 내용을 시각적으로 보여 줘요.',
      fit: '모양이나 사용 방법을 글보다 빠르게 전달할 때',
      avoid:
        '중요한 안내를 그림 안에만 넣지 않아요. 이미지 설명과 느린 연결에서의 로딩도 생각해요.',
      prompt: '어떤 이미지를 보여 주고 확대나 이동이 필요한가요?'
    },
    {
      id: 'video',
      example: '재생 버튼, 재생 시간과 진행 막대가 있는 수업 미리보기 영상 예시.',
      group: 'content',
      label: '영상',
      meaning: '시연이나 강의 영상을 화면 안에서 재생해요.',
      fit: '움직임이나 과정을 직접 보여 주어야 할 때',
      avoid:
        '데이터 사용량과 재생 시간을 고려해요. 소리만으로 설명하지 말고 자막·대체 설명을 준비해요.',
      prompt: '어떤 영상을 어디에서 가져와 보여 줄까요?'
    },
    {
      id: 'gallery',
      example: '큰 사진과 작은 미리보기 사진, 이전·다음 이동으로 공방을 살펴보는 사진 모음 예시.',
      group: 'content',
      label: '사진 모음',
      meaning: '여러 사진을 모아 보여 주고 고른 사진을 크게 보거나 넘겨 봐요.',
      fit: '상품이나 공간처럼 여러 모습을 살펴봐야 할 때',
      avoid: '자동으로 빠르게 넘기면 읽기 어려워요. 사용자가 이동하고 멈출 수 있어야 해요.',
      prompt: '어떤 사진을 모으고 한눈에 볼지 넘겨 볼지 정해 볼까요?'
    },
    {
      id: 'accordion',
      example: '자주 묻는 질문 중 준비물에 관한 답변만 펼치고 다른 답변은 접은 예시.',
      group: 'content',
      label: '접었다 펼치는 내용',
      meaning: '제목을 누르면 그 아래의 설명이 펼쳐져요.',
      fit: '자주 묻는 질문처럼 필요한 설명만 골라 읽을 때',
      avoid: '반드시 봐야 하는 내용이나 서로 비교할 내용을 모두 접어 두면 놓치기 쉬워요.',
      prompt: '어떤 내용을 접고 처음부터 보여 줄 내용은 무엇인가요?'
    },
    {
      id: 'button',
      example: '수업 정보 바로 아래에서 예약하기를 실행하는 일반 버튼 예시.',
      group: 'action',
      label: '일반 버튼',
      meaning: '저장·신청·삭제처럼 사용자가 원하는 작업을 실행해요.',
      fit: '명확한 행동을 시작하거나 완료할 때',
      avoid:
        '눈에 띄는 주요 버튼이 너무 많으면 다음 행동을 고르기 어려워요. 삭제처럼 되돌리기 어려운 행동은 구분해요.',
      prompt: '어떤 버튼이 필요하며 누르면 각각 무엇을 하나요?'
    },
    {
      id: 'link',
      example: '밑줄이 있는 파란 글자를 눌러 자세한 이용 안내로 이동하는 링크 예시.',
      group: 'action',
      label: '링크',
      meaning: '다른 페이지나 문서, 같은 화면의 특정 위치로 이동해요.',
      fit: '관련 내용을 더 읽거나 별도 사이트로 안내할 때',
      avoid:
        '‘여기’보다는 목적지가 드러나는 이름을 써요. 자료를 지우는 등의 작업은 링크 대신 버튼으로 구분해요.',
      prompt: '어디로 이동하는 링크를 어떤 이름으로 보여 줄까요?'
    },
    {
      id: 'fab',
      example: '본문 위의 오른쪽 아래에 떠 있는 파란색 더하기 버튼으로 수업을 추가하는 예시.',
      group: 'action',
      label: '떠 있는 주요 버튼(FAB)',
      meaning: '화면 위에 떠 있는 눈에 띄는 버튼으로 주요 행동 하나를 실행해요.',
      fit: '새 메모나 신청처럼 반복하는 대표 행동이 있을 때',
      avoid: '중요도가 같은 행동이 많거나 본문을 가리면 일반 버튼을 검토해요.',
      prompt: '이 버튼이 실행할 한 가지 행동은 무엇인가요?'
    },
    {
      id: 'banner',
      example: '페이지 상단의 안내 영역에서 토요일 점검 소식을 알려 주는 배너 예시.',
      group: 'feedback',
      label: '안내 배너',
      meaning: '공지·주의 사항·현재 상태를 눈에 띄는 영역에 보여 줘요.',
      fit: '점검 안내나 이용 제한처럼 작업 전에 알아야 할 내용이 있을 때',
      avoid:
        '여러 안내를 겹치면 중요한 내용을 구분하기 어려워요. 표시 대상·기간·닫기 가능 여부를 정해요.',
      prompt: '누구에게 어떤 상황에서 무엇을 안내하나요?'
    },
    {
      id: 'toast',
      example: '화면을 가로막지 않고 예약 저장 결과를 잠깐 알려 주는 완료 메시지 예시.',
      group: 'feedback',
      label: '잠깐 뜨는 완료 메시지',
      meaning: '‘저장했어요’처럼 작업 결과를 잠깐 알리고 사라져요.',
      fit: '사용하던 흐름을 막지 않고 간단한 결과를 확인시킬 때',
      avoid:
        '꼭 확인해야 할 오류나 행동 요청은 사라지는 메시지에만 담지 않아요. 보조기기에도 결과를 전달해야 해요.',
      prompt: '어떤 작업 뒤에 어떤 결과를 알려 줄까요?'
    },
    {
      id: 'progress',
      example: '사진 업로드가 얼마나 진행됐는지 막대와 60% 숫자로 보여 주는 예시.',
      group: 'feedback',
      label: '로딩·진행 표시',
      meaning: '불러오는 중이거나 작업이 얼마나 진행됐는지 보여 줘요.',
      fit: '파일 업로드나 처리처럼 결과를 기다려야 할 때',
      avoid:
        '진행률을 알 수 없는데 임의의 퍼센트를 보여 주지 않아요. 오래 걸리거나 실패했을 때의 안내도 필요해요.',
      prompt: '어떤 작업의 대기 상태를 어떻게 알려 줄까요?'
    },
    {
      id: 'bottomsheet',
      example: '배경 화면을 유지한 채 아래에서 열린 패널에서 정렬 방식을 고르는 예시.',
      group: 'overlay',
      label: '아래에서 여는 패널',
      meaning: '휴대폰 화면 아래에서 선택지나 짧은 상세 내용이 올라와요.',
      fit: '현재 화면을 유지하며 필터나 간단한 선택을 할 때',
      avoid:
        '내용이 길거나 키보드 입력이 많으면 좁아져요. 닫는 방법을 제공하고 본문을 가리는 범위를 생각해요.',
      prompt: '어떤 상황에서 열리고 어떤 내용·선택을 제공하나요?'
    }
  ];
  const loginRequired = {
    id: 'login_need',
    in: ['일부 기능에서만 로그인', '주요 기능은 로그인 후 사용']
  };
  const category = (id) => ({ id: 'features', category: id });
  const steps = [
    {
      id: 'idea',
      title: '아이디어 소개',
      short: '아이디어',
      description: '누구에게 무엇을 제공하고 싶은지 한두 문장으로 시작해요.',
      groups: [
        {
          title: '만들고 싶은 서비스',
          description: '가칭이나 짧은 설명이면 충분해요. 뒤에서 구체화할 수 있어요.',
          questions: [
            {
              id: 'project_name',
              label: '어떤 이름으로 부를까요?',
              type: 'text',
              help: '아직 이름이 없다면 알아보기 쉬운 가칭을 적어요.',
              placeholder: '예: 우리 동네 작업실 예약'
            },
            {
              id: 'summary',
              label: '누구에게 무엇을 제공하는 서비스인가요?',
              type: 'textarea',
              help: '사용할 사람, 할 수 있는 일, 얻을 도움을 한두 문장으로 적어요.',
              placeholder:
                '예: 동네 주민이 빈 작업실 시간을 확인하고 원하는 시간에 예약할 수 있는 서비스'
            }
          ]
        }
      ]
    },
    {
      id: 'problem',
      title: '문제와 기존 방법',
      short: '해결할 문제',
      description: '지금의 불편과 나아졌으면 하는 점을 정리해요.',
      groups: [
        {
          title: '지금 어떤 점이 불편한가요?',
          description: '실제 겪은 일과 아직 확인하지 않은 생각을 구분해 적으면 좋아요.',
          questions: [
            {
              id: 'problem',
              label: '어떤 상황에서 누가 불편을 겪나요?',
              type: 'textarea',
              help: '한 가지 구체적인 장면부터 적어요. 추측이라면 ‘예상’이라고 남겨도 돼요.',
              placeholder:
                '예: 주민이 빈 시간을 물으려고 전화하지만 담당자가 없으면 확인할 수 없어요.'
            },
            {
              id: 'current_methods',
              label: '지금은 어떤 방법으로 해결하나요?',
              type: 'multi',
              options: [
                '메신저',
                '전화',
                '종이·수기',
                '엑셀·문서',
                '기존 서비스',
                '특별한 방법 없음',
                '다른 방법'
              ],
              optionLabels: { '다른 방법': '직접 입력' },
              help: '함께 쓰는 방법을 모두 골라요.'
            },
            {
              id: 'current_method_other',
              label: '지금 쓰는 다른 방법은 무엇인가요?',
              type: 'text',
              help: '',
              placeholder: '예: 회사 내부 게시판',
              when: { id: 'current_methods', includes: '다른 방법' }
            },
            {
              id: 'alternatives',
              label: '비교해 볼 서비스나 방법이 있나요?',
              type: 'rows',
              rowLabel: '서비스·방법',
              help: '경쟁 서비스뿐 아니라 엑셀·전화·수작업도 비교할 수 있어요. 한 개부터 추가하고, 아직 조사하지 않았다면 비워 두세요. URL의 내용을 자동으로 조사하지는 않아요.',
              fields: [
                { id: 'name', label: '이름' },
                { id: 'url', label: 'URL · 선택', type: 'url', maxLength: 2000 },
                { id: 'strength', label: '잘 해결하는 점', type: 'textarea' },
                { id: 'weakness', label: '아쉬운 점', type: 'textarea' },
                { id: 'context', label: '누가 어떤 상황에서 불편한가요?', type: 'textarea' },
                {
                  id: 'evidence',
                  label: '무엇을 보고 판단했나요?',
                  type: 'single',
                  options: ['직접 사용', '사용자 의견', '후기·자료', '아직 예상']
                },
                {
                  id: 'source',
                  label: '판단 근거 · 선택',
                  type: 'textarea',
                  help: '직접 겪은 일, 들은 의견이나 참고한 자료를 적어요. 확인한 사실과 예상은 구분해 주세요.'
                }
              ]
            },
            {
              id: 'current_pain',
              label: '내 서비스는 어떤 점을 다르게 해결하나요?',
              type: 'textarea',
              help: '앞에서 살펴본 방법과 비교해, 누구의 어떤 불편을 어떻게 줄일지 적어요. 모든 면에서 더 좋을 필요는 없어요.',
              placeholder:
                '예: 전화 없이 빈 시간을 알 수 있고 담당자는 중복 신청을 따로 확인하지 않아도 되면 좋겠어요.'
            }
          ]
        }
      ]
    },
    {
      id: 'users',
      title: '사용할 사람과 환경',
      short: '사용자·환경',
      description: '실제로 사용할 사람과 사용 장면을 생각해요.',
      groups: [
        {
          title: '누가 언제 사용하나요?',
          description: '일반인 전체보다 처음 사용할 사람부터 구체적으로 적어요.',
          questions: [
            {
              id: 'audience',
              label: '처음 사용할 사람은 누구인가요?',
              type: 'rows',
              rowLabel: '사용자',
              help: '필요가 다른 사람만 나누어요. 계정 권한은 뒤에서 정하므로 여기서는 목적에 집중해요.',
              fields: [
                {
                  id: 'person',
                  label: '어떤 사람인가요?',
                  placeholder: '예: 작업실을 빌리려는 주민'
                },
                {
                  id: 'goal',
                  label: '무엇을 해결하고 싶나요?',
                  placeholder: '예: 토요일에 쓸 공간 찾기'
                },
                {
                  id: 'context',
                  label: '특별히 고려할 점',
                  placeholder: '예: 처음 이용해서 준비물 안내가 필요함'
                }
              ]
            },
            {
              id: 'usage_context',
              label: '언제, 어디서 사용하는 모습을 떠올리나요?',
              type: 'textarea',
              help: '이동 중, 업무 중, 느린 인터넷, 글씨를 크게 봐야 하는 상황처럼 필요한 조건만 적어요.',
              placeholder: '예: 주민은 이동 중 휴대폰, 담당자는 사무실 PC로 이용해요.'
            }
          ]
        },
        {
          title: '어떻게 열어 보나요?',
          description: '원하는 사용 방법을 고르는 단계예요. 개발 기술은 정하지 않아요.',
          questions: [
            {
              id: 'devices',
              label: '주로 어떤 기기에서 사용하나요?',
              type: 'multi',
              options: ['휴대폰', 'PC', '태블릿', '다른 기기', '아직 미정'],
              optionLabels: { '다른 기기': '직접 입력' },
              help: '여러 기기를 함께 골라도 돼요. 모든 기기에 같은 화면 배치를 적용할 필요는 없어요.'
            },
            {
              id: 'device_context_other',
              label: '어떤 다른 기기에서 사용하나요?',
              type: 'text',
              help: '',
              placeholder: '예: 매장 키오스크, 거실 TV',
              when: { id: 'devices', includes: '다른 기기' }
            },
            {
              id: 'service_form',
              allowRecommend: true,
              label: '서비스를 어떻게 열어 사용하면 좋을까요?',
              type: 'multi',
              options: [
                '주소·링크로 여는 웹',
                '휴대폰에 설치하는 앱',
                'PC에 설치하는 프로그램',
                '다른 이용 방식',
                '아직 미정'
              ],
              optionLabels: { '다른 이용 방식': '직접 입력' },
              help: '여러 방식을 희망할 수 있고 필요성을 확인한 뒤 범위를 줄여도 돼요.',
              optionHelp: {
                '주소·링크로 여는 웹': {
                  meaning: '브라우저에서 주소나 링크를 열어 사용해요.',
                  fit: '설치 없이 접근하거나 링크로 안내하고 싶을 때',
                  avoid:
                    '인터넷 없이 쓸 수 있는지나 기기 기능 사용 여부가 자동으로 정해지지는 않아요.'
                },
                '휴대폰에 설치하는 앱': {
                  meaning: '휴대폰에 설치한 앱을 열어 사용해요.',
                  fit: '휴대폰에서 자주 사용하는 경험을 원할 때',
                  avoid: '앱이 필요한 이유와 설치 부담을 함께 생각해요.'
                },
                'PC에 설치하는 프로그램': {
                  meaning: '컴퓨터에 설치한 프로그램을 실행해요.',
                  fit: 'PC에서 긴 작업을 하거나 기기 안 자료를 주로 다룰 때',
                  avoid: '다른 컴퓨터에서 이어 쓰거나 자료를 공유할 수 있는지는 따로 정해요.'
                }
              }
            },
            {
              id: 'service_form_other',
              label: '원하는 다른 이용 방식은 무엇인가요?',
              type: 'text',
              help: '',
              placeholder: '예: 메신저에서 대화로 이용',
              when: { id: 'service_form', includes: '다른 이용 방식' }
            }
          ]
        }
      ]
    },
    {
      id: 'references',
      title: '참고 서비스와 디자인 방향',
      short: '참고·분위기',
      description: '참고할 주소와 실제로 바라는 화면 분위기를 남겨요.',
      groups: [
        {
          title: '참고할 부분이 있나요?',
          description:
            '자료가 없어도 괜찮아요. URL을 적는 것만으로 내용을 열람하거나 분석한 것은 아니에요.',
          questions: [
            {
              id: 'references',
              label: '화면·디자인을 참고하고 싶은 주소가 있나요?',
              type: 'references',
              help: '화면 배치·색상·사용 흐름 등 참고할 부분을 남겨요. 경쟁 서비스의 장단점은 ‘해결할 문제’에서 비교해요. URL은 한 줄에 하나씩 붙여 넣을 수 있어요.'
            },
            {
              id: 'visual_style',
              allowRecommend: true,
              label: '어떤 분위기를 바라나요?',
              type: 'multi',
              options: [
                '간결하고 실용적인',
                '차분하고 전문적인',
                '밝고 친근한',
                '사진·이미지가 중심인',
                '개성이 뚜렷한',
                '다른 분위기',
                '아직 미정'
              ],
              optionLabels: { '다른 분위기': '직접 입력' },
              help: '가까운 방향을 함께 골라도 돼요. 정답이 있는 분류가 아니며 실제 참고 화면이 더 도움이 될 수 있어요.'
            },
            {
              id: 'visual_style_other',
              label: '원하는 다른 분위기를 적어 주세요.',
              type: 'text',
              help: '',
              placeholder: '예: 오래된 공책처럼 편안한 느낌',
              when: { id: 'visual_style', includes: '다른 분위기' }
            },
            {
              id: 'brand_notes',
              label: '정해진 색상·로고나 지키고 싶은 표현이 있나요?',
              type: 'textarea',
              help: '이미 있는 자료나 확실한 희망만 적어요. 피하고 싶은 표현도 남길 수 있고 없으면 비워 두어요.',
              placeholder: '예: 동네 로고의 초록색 사용. 작은 글씨와 과한 움직임은 피하고 싶어요.'
            }
          ]
        }
      ]
    },
    {
      id: 'screens',
      title: '화면과 기능',
      short: '화면·기능',
      description: '화면을 떠올리고, 그 안에서 보여 줄 정보와 할 수 있는 일을 함께 정리해요.',
      groups: [
        {
          title: '어떤 화면이 필요한가요?',
          description:
            '화면 안에서 기능을 바로 추가할 수 있어요. 이름과 목적만 적거나 필요한 부분의 추천을 요청해도 돼요.',
          questions: [
            {
              id: 'screens',
              allowRecommend: true,
              recommendationLabel: '필요한 화면 목록을 AI에 추천 요청',
              recommendationScope: '필요한 화면의 이름·역할·화면 간 이동 흐름',
              label: '화면마다 무엇을 보여 주고 어떤 일을 하나요?',
              type: 'screens',
              help: '어떤 화면이 필요할지 모르겠다면 화면 목록을 추천받으세요. 떠오르는 화면이 있다면 추가한 뒤, 그 화면의 구성만 따로 추천받을 수 있어요.'
            }
          ]
        },
        {
          title: '화면 밖에서 필요한 기능도 있나요?',
          description:
            '알림 발송처럼 화면 없이 실행하는 기능이나 아직 화면을 정하지 않은 기능을 남겨요.',
          questions: [
            {
              id: 'features',
              allowRecommend: true,
              label: '서비스에 필요한 기능은 무엇인가요?',
              type: 'features',
              help: '화면에서 만든 기능은 다시 적지 않아요. 여기서 추가한 기능도 나중에 화면에 연결할 수 있어요.'
            }
          ]
        },
        {
          title: '예약·신청',
          description: '예약한 사람이 겪는 상황을 하나씩 정해요.',
          questions: [
            {
              id: 'booking_confirmation',
              label: '신청하면 바로 예약되나요?',
              type: 'single',
              options: ['바로 확정돼요', '담당자가 승인해야 해요', '직접 입력', '아직 미정'],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'booking' }
            },
            {
              id: 'booking_confirmation_other',
              label: '신청하면 바로 예약되나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_confirmation', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'booking_history',
              label: '예약한 사람이 나중에 예약 내역을 볼 수 있나요?',
              type: 'single',
              options: ['볼 수 있어요', '따로 보여주지 않아도 돼요', '직접 입력', '아직 미정'],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'booking' }
            },
            {
              id: 'booking_history_other',
              label: '예약한 사람이 나중에 예약 내역을 볼 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_history', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'booking_cancellation',
              label: '예약을 취소할 수 있나요?',
              type: 'single',
              options: [
                '언제든 가능해요',
                '정해진 시점까지만 가능해요',
                '담당자에게 요청해야 해요',
                '취소할 수 없어요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'booking' }
            },
            {
              id: 'booking_cancellation_other',
              label: '예약을 취소할 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_cancellation', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'booking_deadline',
              label: '언제까지 취소할 수 있나요?',
              type: 'textarea',
              help: '예: 이용 하루 전까지. 아직 정하지 않았다면 비워 두세요.',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_cancellation', value: '정해진 시점까지만 가능해요' }
                ]
              }
            },
            {
              id: 'booking_capacity',
              label: '같은 시간이나 대상에 몇 명까지 신청할 수 있나요?',
              type: 'single',
              options: [
                '한 명 또는 한 팀만 가능해요',
                '정해진 인원이나 수량까지만 가능해요',
                '제한 없이 신청받아요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'booking' }
            },
            {
              id: 'booking_capacity_other',
              label: '같은 시간이나 대상에 몇 명까지 신청할 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_capacity', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'booking_capacity_limit',
              label: '몇 명 또는 몇 팀까지 신청받나요?',
              type: 'textarea',
              help: '',
              when: {
                all: [
                  { id: 'features', category: 'booking' },
                  { id: 'booking_capacity', value: '정해진 인원이나 수량까지만 가능해요' }
                ]
              }
            }
          ]
        },
        {
          title: '선택한 기능의 이용 방식',
          description:
            '아는 것부터 골라요. 목록에 없는 방식은 직접 입력하고, 아직 정하지 않았다면 모른다고 남겨도 돼요.',
          questions: [
            {
              id: 'workflow_approval',
              label: '접수된 요청은 누가 승인하나요?',
              type: 'single',
              options: [
                '담당자 한 명이 승인해요',
                '여러 담당자가 차례로 승인해요',
                '조건이 맞으면 자동으로 승인해요',
                '승인 없이 진행 상황만 표시해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'workflow' }
            },
            {
              id: 'workflow_approval_other',
              label: '접수된 요청은 누가 승인하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'workflow' },
                  { id: 'workflow_approval', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'workflow_tracking',
              label: '요청한 사람이 진행 상황을 확인할 수 있나요?',
              type: 'single',
              options: [
                '진행 상황을 직접 볼 수 있어요',
                '결과가 나왔을 때만 알려줘요',
                '담당자에게 물어봐야 해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'workflow' }
            },
            {
              id: 'workflow_tracking_other',
              label: '요청한 사람이 진행 상황을 확인할 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'workflow' },
                  { id: 'workflow_tracking', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'file_kind',
              label: '어떤 파일을 올릴 수 있나요?',
              type: 'single',
              options: [
                '사진만 올려요',
                '문서만 올려요',
                '사진과 문서를 올려요',
                '동영상이나 음성도 올려요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'files' }
            },
            {
              id: 'file_kind_other',
              label: '어떤 파일을 올릴 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'files' },
                  { id: 'file_kind', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'file_limit',
              label: '파일의 개수나 크기를 제한하나요?',
              type: 'single',
              options: [
                '제한을 정하고 싶어요',
                '실제로 올릴 파일을 보고 정하고 싶어요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '파일 용량을 지금 계산할 필요는 없어요.',
              when: { id: 'features', category: 'files' }
            },
            {
              id: 'file_limit_other',
              label: '파일의 개수나 크기를 제한하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'files' },
                  { id: 'file_limit', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'file_limit_details',
              label: '생각한 파일 개수나 크기는 어느 정도인가요?',
              type: 'textarea',
              help: '아는 범위만 적어요. 예: 게시물마다 사진 5장.',
              when: {
                all: [
                  { id: 'features', category: 'files' },
                  { id: 'file_limit', value: '제한을 정하고 싶어요' }
                ]
              }
            },
            {
              id: 'notification_event',
              label: '어떤 일이 생기면 누구에게 알려줘야 하나요?',
              type: 'textarea',
              help: '예: 예약이 취소되면 신청자에게 알려줘요.',
              when: { id: 'features', category: 'notifications' }
            },
            {
              id: 'notification_channel',
              label: '어떤 방법으로 알려주면 좋을까요?',
              type: 'single',
              options: [
                '서비스 안에서 알려줘요',
                '이메일로 보내요',
                '문자로 보내요',
                '휴대폰 푸시 알림으로 보내요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '여러 경로를 함께 쓰려면 직접 입력에 적어 주세요.',
              when: { id: 'features', category: 'notifications' }
            },
            {
              id: 'notification_channel_other',
              label: '어떤 방법으로 알려주면 좋을까요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'notifications' },
                  { id: 'notification_channel', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'payment_offer',
              label: '무엇에 돈을 내며 결제 후 무엇을 받나요?',
              type: 'textarea',
              help: '상품, 예약 이용료, 서비스 이용권 등을 구분해요. 무료 범위나 가격이 정해졌다면 함께 적어요.',
              placeholder: '예: 작업실 2시간 이용료를 내면 그 시간의 예약이 확정돼요.',
              when: { id: 'features', category: 'payments' }
            },
            {
              id: 'payment_timing',
              label: '결제는 어떤 방식으로 받나요?',
              type: 'multi',
              options: [
                '필요할 때 한 번씩 결제',
                '정기적으로 반복 결제',
                '이용한 양에 따라 결제',
                '별도 계약·현장 결제',
                '아직 미정'
              ],
              help: '함께 사용할 방식을 골라요. 예: 매달 기본요금과 이용량 요금. 상품마다 다르면 결제 설명에 구분해요.',
              when: { id: 'features', category: 'payments' }
            },
            {
              id: 'payment_refund',
              label: '사용자가 취소나 환불을 원하면 어떻게 하나요?',
              type: 'single',
              options: [
                '직접 신청하고 조건에 맞으면 처리돼요',
                '담당자에게 요청하고 확인받아요',
                '환불 조건을 먼저 알아봐야 해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '실제로 적용할 환불 조건은 판매하는 상품과 관련 기준을 확인한 뒤 정해요.',
              when: { id: 'features', category: 'payments' }
            },
            {
              id: 'payment_refund_other',
              label: '사용자가 취소나 환불을 원하면 어떻게 하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'payments' },
                  { id: 'payment_refund', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'payment_failure',
              label: '결제에 실패하면 어떻게 진행하나요?',
              type: 'single',
              options: [
                '다시 결제할 수 있게 해요',
                '주문이나 신청을 취소해요',
                '담당자에게 문의할 수 있게 해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'payments' }
            },
            {
              id: 'payment_failure_other',
              label: '결제에 실패하면 어떻게 진행하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'payments' },
                  { id: 'payment_failure', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'ai_help',
              label: 'AI에 무엇을 주고 어떤 도움을 받나요?',
              type: 'textarea',
              help: '입력 자료와 원하는 결과를 연결해요. 회사 자료나 개인정보는 보낼 수 있는 범위만 적고 실제 내용은 넣지 않아요.',
              placeholder: '예: 공지 초안을 넣으면 빠진 정보와 이해하기 어려운 문장을 짚어 줘요.',
              when: { id: 'features', category: 'ai' }
            },
            {
              id: 'ai_result_use',
              label: 'AI가 만든 결과를 바로 사용하나요?',
              type: 'single',
              options: [
                '사용자가 확인하고 고쳐서 사용해요',
                '담당자가 확인한 뒤 공개해요',
                '확인 없이 자동으로 사용해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '자동으로 사용할 경우 잘못된 결과가 나올 때의 대응도 생각해 주세요.',
              when: { id: 'features', category: 'ai' }
            },
            {
              id: 'ai_result_use_other',
              label: 'AI가 만든 결과를 바로 사용하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'ai' },
                  { id: 'ai_result_use', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'ai_retry',
              label: 'AI 결과가 마음에 들지 않으면 어떻게 하나요?',
              type: 'single',
              options: [
                '다시 요청할 수 있어요',
                '직접 고칠 수 있어요',
                '다시 요청하거나 직접 고칠 수 있어요',
                '담당자에게 도움을 요청해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'ai' }
            },
            {
              id: 'ai_retry_other',
              label: 'AI 결과가 마음에 들지 않으면 어떻게 하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'ai' },
                  { id: 'ai_retry', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'location_use',
              label: '지도나 위치로 어떤 일을 하나요?',
              type: 'multi',
              options: [
                '정해진 장소를 지도에서 보기',
                '주소·장소 검색',
                '내 현재 위치 주변 찾기',
                '내 위치를 다른 사람에게 공유',
                '다른 용도',
                '아직 미정'
              ],
              optionLabels: { '다른 용도': '직접 입력' },
              help: '장소 표시만 필요하면 현재 위치를 받을 필요는 없어요. 위치 공유는 누구에게 언제까지 보이는지도 생각해요.',
              when: { id: 'features', category: 'location' }
            },
            {
              id: 'location_audience',
              label: '내 위치를 누가 볼 수 있나요?',
              type: 'single',
              options: [
                '내가 초대한 사람만 볼 수 있어요',
                '같은 모임이나 팀의 사람이 볼 수 있어요',
                '서비스 이용자 누구나 볼 수 있어요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: {
                all: [
                  { id: 'features', category: 'location' },
                  { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                ]
              }
            },
            {
              id: 'location_audience_other',
              label: '내 위치를 누가 볼 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  {
                    all: [
                      { id: 'features', category: 'location' },
                      { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                    ]
                  },
                  { id: 'location_audience', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'location_duration',
              label: '위치를 얼마나 오래 공유하나요?',
              type: 'single',
              options: [
                '보낼 때의 위치만 한 번 공유해요',
                '내가 끌 때까지 현재 위치를 공유해요',
                '정해진 시간이 지나면 공유를 멈춰요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: {
                all: [
                  { id: 'features', category: 'location' },
                  { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                ]
              }
            },
            {
              id: 'location_duration_other',
              label: '위치를 얼마나 오래 공유하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  {
                    all: [
                      { id: 'features', category: 'location' },
                      { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                    ]
                  },
                  { id: 'location_duration', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'location_end',
              label: '언제 위치 공유를 멈추나요?',
              type: 'textarea',
              help: '예: 모임이 끝나거나 1시간이 지나면.',
              when: {
                all: [
                  {
                    all: [
                      { id: 'features', category: 'location' },
                      { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                    ]
                  },
                  { id: 'location_duration', value: '정해진 시간이 지나면 공유를 멈춰요' }
                ]
              }
            },
            {
              id: 'location_other',
              label: '지도·위치로 할 다른 일은 무엇인가요?',
              type: 'textarea',
              help: '사용자가 할 일과 보여 줄 결과를 적어요. 필요한 위치가 장소의 주소인지 이용자의 현재 위치인지도 구분해요.',
              placeholder: '예: 입력한 두 장소 사이의 이동 거리를 비교해요.',
              when: {
                all: [
                  { id: 'features', category: 'location' },
                  { id: 'location_use', includes: '다른 용도' }
                ]
              }
            },
            {
              id: 'device_needs',
              label: '실제로 필요한 기기 기능은 무엇인가요?',
              type: 'multi',
              options: [
                '카메라로 촬영',
                '마이크로 음성 입력',
                '현재 위치 사용',
                '기기 기능이 필요하지 않음',
                '다른 기능',
                '아직 미정'
              ],
              optionLabels: { '다른 기능': '직접 입력' },
              help: '웹과 설치 앱 모두 필요한 경우에만 골라요. 기존 사진·파일을 고르는 것과 직접 촬영은 달라요.',
              when: {
                any: [
                  { id: 'features', category: 'device' },
                  { id: 'features', category: 'location' },
                  { id: 'features', category: 'files' }
                ]
              }
            },
            {
              id: 'device_other',
              label: '목록에 없는 기기 기능은 무엇이며 어디에 쓰나요?',
              type: 'textarea',
              help: '기능 이름을 몰라도 원하는 행동으로 설명해요. 실제로 필요한지 확인할 점이 있다면 함께 남겨요.',
              placeholder: '예: 가까이에 있는 측정 기기에서 수치를 받아 기록해요.',
              when: {
                all: [
                  {
                    any: [
                      { id: 'features', category: 'device' },
                      { id: 'features', category: 'location' },
                      { id: 'features', category: 'files' }
                    ]
                  },
                  { id: 'device_needs', includes: '다른 기능' }
                ]
              }
            },
            {
              id: 'permission_response',
              label: '카메라·위치 등의 사용을 허용하지 않으면 어떻게 하나요?',
              type: 'single',
              options: [
                '직접 입력하거나 파일을 고르게 해요',
                '그 기능만 사용할 수 없게 해요',
                '왜 필요한지 설명하고 다시 요청할 수 있게 해요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '권한을 거절했을 때의 흐름이에요. 실제로 가능한 대안을 적어 주세요.',
              when: {
                any: [
                  {
                    all: [
                      {
                        any: [
                          { id: 'features', category: 'device' },
                          { id: 'features', category: 'location' },
                          { id: 'features', category: 'files' }
                        ]
                      },
                      {
                        id: 'device_needs',
                        in: ['카메라로 촬영', '마이크로 음성 입력', '현재 위치 사용', '다른 기능']
                      }
                    ]
                  },
                  {
                    all: [
                      { id: 'features', category: 'location' },
                      {
                        id: 'location_use',
                        in: ['내 현재 위치 주변 찾기', '내 위치를 다른 사람에게 공유']
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: 'permission_response_other',
              label: '카메라·위치 등의 사용을 허용하지 않으면 어떻게 하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  {
                    any: [
                      {
                        all: [
                          {
                            any: [
                              { id: 'features', category: 'device' },
                              { id: 'features', category: 'location' },
                              { id: 'features', category: 'files' }
                            ]
                          },
                          {
                            id: 'device_needs',
                            in: [
                              '카메라로 촬영',
                              '마이크로 음성 입력',
                              '현재 위치 사용',
                              '다른 기능'
                            ]
                          }
                        ]
                      },
                      {
                        all: [
                          { id: 'features', category: 'location' },
                          {
                            id: 'location_use',
                            in: ['내 현재 위치 주변 찾기', '내 위치를 다른 사람에게 공유']
                          }
                        ]
                      }
                    ]
                  },
                  { id: 'permission_response', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'collaboration_join',
              label: '함께 작업할 사람은 어떻게 참여하나요?',
              type: 'single',
              options: [
                '초대받은 사람만 참여해요',
                '참여를 신청하고 승인받아요',
                '링크를 받은 사람이 참여해요',
                '누구나 참여할 수 있어요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '',
              when: { id: 'features', category: 'collaboration' }
            },
            {
              id: 'collaboration_join_other',
              label: '함께 작업할 사람은 어떻게 참여하나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'collaboration' },
                  { id: 'collaboration_join', value: '직접 입력' }
                ]
              }
            },
            {
              id: 'collaboration_edit',
              label: '함께 작업하는 사람은 무엇을 할 수 있나요?',
              type: 'single',
              options: [
                '보기만 할 수 있어요',
                '모두 내용을 수정할 수 있어요',
                '사람마다 보기·수정 권한을 다르게 줘요',
                '직접 입력',
                '아직 미정'
              ],
              optionLabels: { '아직 미정': '아직 모르겠어요' },
              help: '역할별 자세한 권한은 로그인·역할에서 정해요.',
              when: { id: 'features', category: 'collaboration' }
            },
            {
              id: 'collaboration_edit_other',
              label: '함께 작업하는 사람은 무엇을 할 수 있나요? — 직접 입력',
              type: 'textarea',
              help: '여러 기능에 서로 다른 방식을 적용한다면 기능 이름과 함께 적어 주세요.',
              when: {
                all: [
                  { id: 'features', category: 'collaboration' },
                  { id: 'collaboration_edit', value: '직접 입력' }
                ]
              }
            }
          ]
        },
        {
          title: '이전에 작성한 정보',
          description:
            '기존 자료·규칙 답변을 보존했어요. 필요한 내용을 기능별로 옮겨 정리할 수 있어요.',
          questions: [
            {
              id: 'booking_rules',
              label: '이전 답변: 신청·예약의 확정, 중복, 마감, 취소는 어떻게 하나요?',
              type: 'textarea',
              help: '기능 이름과 규칙을 연결해요. 정원, 동일 시간 중복, 확정하는 사람, 취소 가능 시점 중 필요한 것만 적어요.',
              placeholder:
                '예: 같은 시간에는 한 팀만 예약. 신청 즉시 확정, 이용 전날까지 취소 가능.',
              when: { id: 'features', category: 'booking' },
              legacyOnly: true
            },
            {
              id: 'workflow_rules',
              label: '이전 답변: 처리 상태는 누가 어떤 조건에서 바꾸나요?',
              type: 'textarea',
              help: '접수 → 승인 → 완료처럼 필요한 순서와 반려·취소 후 결과를 적어요. 기능 카드에 있다면 빠진 조건만 보완해요.',
              placeholder:
                '예: 담당자가 승인하거나 이유를 적어 반려. 신청자는 승인 전까지 수정 가능.',
              when: { id: 'features', category: 'workflow' },
              legacyOnly: true
            },
            {
              id: 'file_rules',
              label: '이전 답변: 어떤 파일을 받고, 누가 확인하거나 내려받나요?',
              type: 'textarea',
              help: '파일 종류와 대략적인 개수·크기, 볼 수 있는 사람을 적어요. 수치를 모르겠다면 실제 올릴 자료의 예를 적어요.',
              placeholder:
                '예: 신청마다 사진 3장 정도. 신청자와 담당자만 확인. PDF 안내문은 누구나 다운로드.',
              when: { id: 'features', category: 'files' },
              legacyOnly: true
            },
            {
              id: 'notification_rules',
              label: '이전 답변: 어떤 일이 생기면 누구에게 어떻게 알리나요?',
              type: 'textarea',
              help: '사건, 받을 사람, 경로를 연결해요. 서비스 안 알림, 이메일, 문자 등 필요한 안내만 적어요.',
              placeholder: '예: 예약 취소 시 신청자에게 이메일, 담당자에게 서비스 안 알림.',
              when: { id: 'features', category: 'notifications' },
              legacyOnly: true
            },
            {
              id: 'payment_cancel',
              label: '이전 답변: 취소·환불하거나 결제가 안 되면 어떻게 안내하나요?',
              type: 'textarea',
              help: '상품별 취소 시점과 신청·이용 상태 등 바라는 기본 흐름을 적어요. 확인하지 못한 기준은 미정으로 남겨요.',
              placeholder:
                '예: 결제 실패 시 예약은 확정하지 않고 다시 결제할 수 있게 해요. 환불 기준은 확인 필요.',
              when: { id: 'features', category: 'payments' },
              legacyOnly: true
            },
            {
              id: 'ai_review',
              allowRecommend: true,
              label: '이전 답변: AI 결과는 어떻게 확인하고 사용하나요?',
              type: 'textarea',
              help: '수정, 재요청, 출처 확인, 사람이 확인 후 적용 등 필요한 경험과 기대에 못 미칠 때의 동작을 적어요.',
              placeholder: '예: 원문과 제안을 비교하고 사용자가 선택한 문장만 공지에 반영해요.',
              when: { id: 'features', category: 'ai' },
              legacyOnly: true
            },
            {
              id: 'location_sharing',
              label: '이전 답변: 내 위치는 누구에게 언제까지 보이며 어떻게 공유를 멈추나요?',
              type: 'textarea',
              help: '공유를 켜고 끄는 사람, 볼 수 있는 사람, 끝나는 시점을 적어요. 한 번 보낸 위치인지 계속 바뀌는 위치인지도 구분해요.',
              placeholder:
                '예: 동행자로 초대한 사람에게만 현재 위치 표시. 모임 종료 또는 본인이 중단하면 더 이상 표시하지 않아요.',
              when: {
                all: [
                  { id: 'features', category: 'location' },
                  { id: 'location_use', includes: '내 위치를 다른 사람에게 공유' }
                ]
              },
              legacyOnly: true
            },
            {
              id: 'permission_alternative',
              allowRecommend: true,
              label: '이전 답변: 기기 기능 사용을 허용하지 않으면 어떻게 하나요?',
              type: 'textarea',
              help: '해당 기능만 제한할지, 직접 입력이나 파일 선택 같은 대안을 제공할지 적어요. 전체 서비스를 막아야 하는지도 생각해요.',
              placeholder: '예: 위치를 허용하지 않아도 동네 이름을 직접 입력해 찾을 수 있어요.',
              when: {
                any: [
                  {
                    all: [
                      {
                        any: [
                          { id: 'features', category: 'device' },
                          { id: 'features', category: 'location' },
                          { id: 'features', category: 'files' }
                        ]
                      },
                      {
                        id: 'device_needs',
                        in: ['카메라로 촬영', '마이크로 음성 입력', '현재 위치 사용', '다른 기능']
                      }
                    ]
                  },
                  {
                    all: [
                      { id: 'features', category: 'location' },
                      {
                        id: 'location_use',
                        in: ['내 현재 위치 주변 찾기', '내 위치를 다른 사람에게 공유']
                      }
                    ]
                  }
                ]
              },
              legacyOnly: true
            },
            {
              id: 'collaboration_rules',
              label: '이전 답변: 누구와 어떤 자료를 함께 사용하나요?',
              type: 'textarea',
              help: '초대, 보기·수정 범위, 동시 수정, 공유 취소·구성원 탈퇴 후 처리를 필요한 만큼 적어요.',
              placeholder:
                '예: 초대한 팀원은 일정 수정 가능. 같은 일정을 고치면 충돌을 알리고 확인하게 해요.',
              when: { id: 'features', category: 'collaboration' },
              legacyOnly: true
            },
            {
              id: 'data_items',
              legacyOnly: true,
              label: '사용을 마친 뒤에도 기억해야 할 정보가 있나요?',
              type: 'rows',
              rowLabel: '자료',
              help: '예: 예약 내용, 작성한 글, 즐겨찾기. 자료가 없다면 비워 두거나 그 사실을 적어요. 실제 개인정보는 넣지 마세요.',
              fields: [
                { id: 'name', label: '자료 이름', placeholder: '예: 예약 기록' },
                {
                  id: 'purpose',
                  label: '남길 내용과 이유',
                  placeholder: '예: 신청자·날짜·처리 상태 확인'
                },
                {
                  id: 'access',
                  label: '누가 볼 수 있나요?',
                  placeholder: '예: 본인과 해당 작업실 담당자'
                },
                {
                  id: 'change',
                  label: '누가 언제 바꾸나요?',
                  placeholder: '예: 신청자는 이용 전날까지 시간 변경'
                },
                {
                  id: 'deletion',
                  label: '삭제·탈퇴 후에는 어떻게 하나요?',
                  placeholder: '예: 초안은 삭제 가능, 완료 기록 보관 기간은 미정'
                }
              ]
            },
            {
              id: 'general_rules',
              legacyOnly: true,
              label: '여러 기능에 함께 적용할 규칙이 있나요?',
              type: 'textarea',
              help: '기능 카드에 적은 내용은 반복하지 않아요. 이용 시간, 작성 제한, 잘못된 정보의 수정·신고 등 공통 규칙만 적어요.',
              placeholder: '예: 담당자도 다른 작업실의 신청 내용을 볼 수 없어요.'
            }
          ]
        }
      ]
    },
    {
      id: 'flow',
      title: '대표 이용 과정',
      short: '이용 과정',
      description: '가장 중요한 목적 하나를 달성하는 순서부터 연결해요.',
      groups: [
        {
          title: '시작부터 목적 달성까지',
          description:
            '앞에서 만든 화면과 기능을 순서대로 연결하거나 내 말로 적어요. 대표 과정 하나면 충분해요.',
          questions: [
            {
              id: 'main_flow',
              allowRecommend: true,
              label: '사용자는 어떤 순서로 목적을 달성하나요?',
              type: 'flow',
              help: '누가 어떤 상황에서 시작하는지 포함해요. 예: 빈 시간 보기 → 시간 선택 → 신청 내용 확인 → 예약 결과 확인.'
            },
            {
              id: 'journey_finish',
              label: '마지막에 무엇이 보이거나 달라져야 하나요?',
              type: 'textarea',
              help: '이용자가 원하는 일을 끝냈다고 알 수 있는 결과를 적어요. 기능 카드와 같다면 핵심만 짚어도 돼요.',
              placeholder: '예: 예약 번호와 확정 시간을 보고 내 예약 목록에서도 확인할 수 있어요.'
            },
            {
              id: 'failure_experience',
              allowRecommend: true,
              label: '중간에 막히면 어떻게 도와주면 좋을까요?',
              type: 'textarea',
              help: '걱정되는 상황 한두 개만 적어요. 원인 안내, 입력 내용 유지, 다시 시도, 담당자 문의 등을 생각해요.',
              placeholder:
                '예: 다른 사람이 먼저 예약했다면 입력 내용은 유지하고 다른 시간을 고르게 해요.'
            }
          ]
        }
      ]
    },
    {
      id: 'accounts',
      title: '로그인과 권한',
      short: '로그인·권한',
      description: '로그인이 필요한 범위와 사람마다 할 수 있는 일을 정해요.',
      groups: [
        {
          title: '로그인이 필요한가요?',
          description: '로그인은 사용자를 알아보는 방법이에요. 할 수 있는 일은 역할과 함께 정해요.',
          questions: [
            {
              id: 'login_need',
              allowRecommend: true,
              label: '어디에 로그인이 필요한가요?',
              type: 'single',
              options: [
                '로그인 없이 사용',
                '일부 기능에서만 로그인',
                '주요 기능은 로그인 후 사용',
                '아직 미정'
              ],
              help: '단순히 정보를 보는 일에도 로그인이 필요한지 생각해요. 모르면 지금 정하지 않아도 돼요.'
            },
            {
              id: 'login_features',
              label: '어떤 기능을 사용할 때 로그인하나요?',
              type: 'multi',
              source: 'features',
              help: '앞에서 만든 기능 중 로그인이 필요한 대상을 골라요. 목록에 없으면 ‘화면·기능’ 단계에서 추가할 수 있어요.',
              when: { id: 'login_need', value: '일부 기능에서만 로그인' }
            },
            {
              id: 'login_methods',
              allowRecommend: true,
              label: '어떤 방법으로 로그인하면 좋을까요?',
              type: 'multi',
              options: [
                '이메일·비밀번호',
                '아이디·비밀번호',
                '이메일 인증 링크·번호',
                '휴대폰 인증번호',
                '카카오',
                '네이버',
                'Google',
                'Apple',
                '다른 방법',
                '아직 미정'
              ],
              optionLabels: { '다른 방법': '직접 입력' },
              help: '여러 방법을 함께 제공할 수 있어요. 소셜 로그인과 서비스 안의 회원 정보·역할은 따로 정해요. 실제 계정이나 비밀번호를 적지 마세요.',
              when: loginRequired,
              optionHelp: {
                '이메일·비밀번호': {
                  meaning: '이메일 주소와 서비스용 비밀번호로 로그인해요.',
                  fit: '이메일을 사용자를 알아보는 값으로 쓰고 싶을 때',
                  avoid: '비밀번호를 잊었을 때 다시 접근할 방법도 필요해요.'
                },
                '아이디·비밀번호': {
                  meaning: '이 서비스의 아이디와 비밀번호로 로그인해요.',
                  fit: '이메일 대신 정한 아이디로 구분하고 싶을 때',
                  avoid: '아이디나 비밀번호 분실 시 확인 방법도 생각해요.'
                },
                '이메일 인증 링크·번호': {
                  meaning: '이메일로 받은 링크나 번호를 이용해 로그인해요.',
                  fit: '서비스용 비밀번호를 따로 기억하지 않게 하고 싶을 때',
                  avoid: '메일 수신이 늦거나 불가능할 때의 안내가 필요해요.'
                },
                '휴대폰 인증번호': {
                  meaning: '휴대폰으로 받은 번호를 입력해 로그인해요.',
                  fit: '휴대폰을 이용한 접근이 사용자에게 익숙할 때',
                  avoid:
                    '번호 변경이나 수신 실패를 생각해요. 가입자에 관한 모든 정보를 증명하는 것은 아니에요.'
                },
                카카오: {
                  meaning: '카카오 계정을 이용해 로그인해요.',
                  fit: '예상 사용자가 카카오 계정으로 접근하기를 원할 때',
                  avoid: '필요한 회원 정보를 모두 받을 수 있다고 가정하지 않아요.'
                },
                네이버: {
                  meaning: '네이버 계정을 이용해 로그인해요.',
                  fit: '예상 사용자가 네이버 계정으로 접근하기를 원할 때',
                  avoid: '로그인 성공과 서비스 이용 승인은 별도로 정해요.'
                },
                Google: {
                  meaning: 'Google 계정을 이용해 로그인해요.',
                  fit: '예상 사용자가 Google 계정을 쓰는 경우',
                  avoid: '우리 서비스의 역할과 이용 기록은 따로 정해요.'
                },
                Apple: {
                  meaning: 'Apple 계정을 이용해 로그인해요.',
                  fit: '예상 사용자가 Apple 계정으로 접근하기를 원할 때',
                  avoid: '다른 로그인 방법과 같은 사람으로 연결할지는 별도로 생각해요.'
                }
              }
            },
            {
              id: 'login_other',
              label: '목록에 없는 로그인 방법은 무엇인가요?',
              type: 'text',
              help: '사용자가 어떻게 본인임을 확인하고 들어오는지 적어요. 실제 계정이나 비밀값은 넣지 마세요.',
              placeholder: '예: 회사에서 이미 사용하는 계정으로 로그인',
              when: { all: [loginRequired, { id: 'login_methods', includes: '다른 방법' }] }
            },
            {
              id: 'signup_audience',
              label: '누가 가입하거나 이용 승인을 받을 수 있나요?',
              type: 'textarea',
              help: '누구나 가입, 초대받은 사람만, 담당자 승인처럼 필요한 조건을 적어요. 여러 조건을 조합할 수 있어요.',
              placeholder: '예: 누구나 가입 가능. 담당자 역할은 운영자가 확인 후 부여.',
              when: loginRequired
            },
            {
              id: 'signup_fields',
              label: '회원에게 꼭 받아야 할 정보가 있나요?',
              type: 'multi',
              options: [
                '추가 정보 없음',
                '표시 이름·닉네임',
                '이름',
                '이메일',
                '전화번호',
                '소속',
                '프로필 정보',
                '다른 정보',
                '아직 미정'
              ],
              optionLabels: { '다른 정보': '직접 입력' },
              help: '가입과 이용에 꼭 필요한 정보의 종류만 골라요. 실제 개인정보는 적지 않아요. 로그인 수단에서 받을 수 있는지는 나중에 확인해요.',
              when: loginRequired
            },
            {
              id: 'signup_other',
              label: '추가로 받을 회원 정보와 필요한 이유는 무엇인가요?',
              type: 'textarea',
              help: '정보의 종류와 쓰임만 적어요. 실제 개인정보는 넣지 마세요.',
              placeholder: '예: 수강할 반 — 담당 선생님과 수업 자료를 연결하기 위해 필요',
              when: { all: [loginRequired, { id: 'signup_fields', includes: '다른 정보' }] }
            },
            {
              id: 'account_actions',
              allowRecommend: true,
              label: '이용자가 자기 계정에서 무엇을 할 수 있어야 하나요?',
              type: 'multi',
              options: [
                '프로필 수정',
                '연락처 변경',
                '다른 로그인 방법 연결',
                '회원 탈퇴',
                '담당자에게 변경 요청',
                '다른 계정 기능',
                '아직 미정'
              ],
              optionLabels: { '다른 계정 기능': '직접 입력' },
              help: '필요한 행동을 골라요. 탈퇴 후 작성한 글이나 이용 내역의 처리가 정해졌다면 해당 기능에 함께 적어요.',
              when: loginRequired
            },
            {
              id: 'account_actions_other',
              label: '추가로 필요한 계정 기능은 무엇인가요?',
              type: 'text',
              help: '',
              placeholder: '예: 알림 수신 설정을 한곳에서 변경',
              when: { all: [loginRequired, { id: 'account_actions', includes: '다른 계정 기능' }] }
            },
            {
              id: 'password_recovery',
              label: '아이디나 비밀번호를 잊으면 어떻게 다시 들어오나요?',
              type: 'textarea',
              help: '사용자가 겪는 복구 방법을 적어요. 확인 방법을 모르면 미정으로 남겨요.',
              placeholder: '예: 등록한 이메일로 비밀번호 재설정 안내를 받아요.',
              when: {
                all: [
                  loginRequired,
                  { id: 'login_methods', in: ['이메일·비밀번호', '아이디·비밀번호'] }
                ]
              }
            }
          ]
        },
        {
          title: '사람마다 할 수 있는 일이 다른가요?',
          description:
            '사용자 종류가 다를 때만 나누어요. 비회원이나 운영 담당자도 포함할 수 있어요.',
          questions: [
            {
              id: 'roles',
              allowRecommend: true,
              label: '역할별로 무엇을 보거나 할 수 있나요?',
              type: 'rows',
              rowLabel: '역할',
              help: '화면에서 정한 기능별 권한을 먼저 확인해요. 역할 전체에 공통으로 적용할 설명만 추가하세요. 버튼을 숨기는 것만으로 접근 권한이 제한되지는 않아요.',
              fields: [
                { id: 'role', label: '역할 이름', placeholder: '예: 신청자 / 작업실 담당자' },
                {
                  id: 'actions',
                  label: '할 수 있는 행동',
                  placeholder: '예: 내 예약 신청·취소 / 신청 승인'
                },
                {
                  id: 'data',
                  label: '볼 수 있는 자료',
                  placeholder: '예: 본인 예약 / 담당 작업실 예약'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'review',
      title: '마무리 메모',
      short: '마무리 메모',
      description: '남기고 싶은 내용이 있으면 적고, 기획 초안을 확인해 보세요.',
      groups: [
        {
          title: '',
          questions: [
            {
              id: 'open_questions',
              label: '추가로 남기고 싶은 생각이나 궁금한 점이 있나요? (선택)',
              type: 'textarea',
              optional: true,
              allowReason: false,
              help: '비워 두어도 괜찮아요. 적은 내용은 기획 초안에 함께 담겨요.'
            }
          ]
        }
      ]
    }
  ];

  // Retained only to validate and preserve earlier answers and backups, not as form questions.
  const retiredQuestions = [
    { id: 'scope', label: '기능별 첫 버전 우선순위 검토', type: 'scope', allowRecommend: true },
    { id: 'excluded_work', label: '추가로 이번에는 하지 않을 일', type: 'textarea' },
    {
      id: 'success_check',
      label: '아이디어가 쓸모 있는지 확인하는 방법',
      type: 'textarea',
      allowRecommend: true
    }
  ];
  const formInputTypes = [
    '짧은 글',
    '긴 글',
    '숫자',
    '날짜',
    '시간',
    '하나 선택',
    '여러 개 선택',
    '이메일',
    '전화번호',
    '파일 첨부',
    '직접 설명'
  ];
  const elementContentTypes = ['form', 'table', 'list', 'cards', 'button'];
  const api = {
    formInputTypes,
    elementContentTypes,
    steps,
    retiredQuestions,
    featureTypes,
    uiElements,
    uiElementGroups,
    screenRecommendationScope
  };
  root.BriefQuestions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
