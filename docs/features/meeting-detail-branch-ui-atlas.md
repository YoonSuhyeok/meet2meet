# Meet2Meet 미팅 상세 Branch UI Atlas

## 목적

`/meeting/{id}`와 `/m/{shortId}` 화면을 상태별 분기로 쪼개서,
모든 케이스를 실제 앱에서 하나씩 진입하지 않아도 화면 구성을 빠르게 확인할 수 있게 한다.

이 문서는 다음에 사용한다.

- 기획 변경 시 어떤 상태 문서를 수정해야 하는지 판단
- 개발 중 "이 상태에서 뭐가 보여야 하지?"를 빠르게 확인
- QA와 Storybook 스토리의 기준선 유지

연결 문서

- `FLOW_ORACLE.md` Flow 03 상세 조회 및 공유 투표
- `03.meeting-detail-wireframe.html`

## 고정 화면 계약

아래 요소는 대부분의 분기에서 유지되는 기본 골격이다.

| 영역 | 기본 구성 요소 |
|---|---|
| Header | 미팅 제목, 날짜 또는 날짜 범위, 상태 배지 |
| Summary | 장소, 설명, 참여자 수 또는 응답 요약 |
| Main | 시간 선택 그리드 또는 읽기 전용 시간표 |
| Secondary | 참여자 요약, 안내 메시지, 공유 정보 |
| Action | 제출, 공유, 로그인 유도, 호스트 운영 액션 |

이 계약이 바뀌면 단순 UI polish가 아니라 spec 변경으로 본다.

## 상태 분기 인덱스

| Branch ID | Oracle ID | Route | 핵심 상태 |
|---|---|---|---|
| Branch-01 | `FO-03-001` | `/meeting/{id}` | 로그인 Host가 상세 화면을 조회 |
| Branch-02 | `FO-03-002` | `/m/{shortId}` | 비로그인 Participant가 공유 화면에서 투표 |
| Branch-03 | `FO-03-003` | `/meeting/{id}`, `/m/{shortId}` | 미팅이 확정 또는 마감되어 제출 차단 |
| Branch-04 | `FO-03-004` | `/m/{shortId}` | 비로그인 사용자가 알림 토글을 눌러 로그인 전이 |

## Branch-01 — Host 기본 상세 조회

### 상태 조건

| 항목 | 값 |
|---|---|
| Oracle ID | `FO-03-001` |
| 사용자 | 로그인 Host |
| Route | `/meeting/{id}` |
| 데이터 | 미팅 상세와 votes 로드 성공 |
| 목적 | 전체 현황 확인, 후속 운영 액션 판단 |

### 보여야 하는 요소

| 영역 | 요소 |
|---|---|
| Header | 미팅 제목, 날짜, 상태 배지 |
| Summary | 장소, 설명, 참여자 요약 |
| Main | 슬롯별 집계가 보이는 Time Grid |
| Secondary | 참여자 목록 또는 응답 요약 |
| Action | 공유 액션, 호스트 전용 운영 CTA |

### 숨김/비활성 요소

| 항목 | 규칙 |
|---|---|
| 로그인 유도 배너 | 숨김 |
| 게스트 participantCode 안내 | 숨김 |
| 확정 해제/차단 메시지 | 현재 상태가 진행중이면 숨김 |

### 메시지와 피드백

- 로딩 스켈레톤이 끝난 뒤 핵심 데이터가 보여야 한다.
- Host는 읽기만 하는 게 아니라 운영을 위한 CTA를 볼 수 있어야 한다.

### Storybook 권장 이름

- `MeetingDetail/Branch-01-HostDefault`

---

## Branch-02 — Guest 공유 화면 투표

### 상태 조건

| 항목 | 값 |
|---|---|
| Oracle ID | `FO-03-002` |
| 사용자 | 비로그인 Participant |
| Route | `/m/{shortId}` |
| 데이터 | 공유용 미팅 상세 로드 성공 |
| 목적 | 빠르게 시간 선택 후 제출 |

### 보여야 하는 요소

| 영역 | 요소 |
|---|---|
| Header | 미팅 제목, 날짜, 공유용 간소 배지 |
| Main | 선택 가능한 Time Grid |
| Secondary | 참여 안내 문구, 게스트 투표 설명 |
| Action | 제출 버튼, 로그인 연동 또는 공유 관련 보조 CTA |

### 숨김/비활성 요소

| 항목 | 규칙 |
|---|---|
| 호스트 전용 운영 버튼 | 숨김 |
| 상세 관리자 정보 | 최소화 또는 숨김 |
| 확정/마감 차단 문구 | 진행중 상태라면 숨김 |

### 메시지와 피드백

- 제출 후 저장 완료 메시지가 보인다.
- 요청에는 `participantCode=guest:*`가 포함되어야 한다.

### Storybook 권장 이름

- `MeetingDetail/Branch-02-GuestVote`

---

## Branch-03 — 확정 또는 마감으로 제출 차단

### 상태 조건

| 항목 | 값 |
|---|---|
| Oracle ID | `FO-03-003` |
| 사용자 | Host 또는 Participant |
| Route | `/meeting/{id}` 또는 `/m/{shortId}` |
| 데이터 | `meeting.status in ["finalized", "closed"]` |
| 목적 | 현재 상태를 인지시키고 수정 액션을 막기 |

### 보여야 하는 요소

| 영역 | 요소 |
|---|---|
| Header | 미팅 제목, 날짜, 확정 또는 마감 배지 |
| Main | 읽기 전용 시간표 또는 확정 슬롯 표시 |
| Secondary | 차단 이유 메시지, 현재 상태 설명 |
| Action | 상세 보기, 공유 등 비파괴 액션 |

### 숨김/비활성 요소

| 항목 | 규칙 |
|---|---|
| Time Grid 편집 인터랙션 | 비활성 또는 읽기 전용 |
| 투표 제출 버튼 | 비활성 또는 숨김 |
| 저장 성공 토스트 | 노출되면 안 됨 |

### 메시지와 피드백

- "이미 확정되어 변경할 수 없음" 또는 "마감되어 더 이상 응답할 수 없음" 안내가 필요하다.
- 사용자는 왜 제출이 막혔는지 즉시 이해할 수 있어야 한다.

### Storybook 권장 이름

- `MeetingDetail/Branch-03-Finalized`
- `MeetingDetail/Branch-03-Closed`

---

## Branch-04 — 비로그인 알림 토글 로그인 전이

### 상태 조건

| 항목 | 값 |
|---|---|
| Oracle ID | `FO-03-004` |
| 사용자 | 비로그인 Participant |
| Route | `/m/{shortId}` |
| 액션 | 알림 토글 클릭 |
| 목적 | 로그인 전이와 복귀 경로 보장 |

### 보여야 하는 요소

| 영역 | 요소 |
|---|---|
| Before action | 알림 토글 UI, 공유 화면 핵심 정보 |
| After action | `/login` 이동, post-login redirect 저장 |

### 숨김/비활성 요소

| 항목 | 규칙 |
|---|---|
| 알림 설정 완료 상태 | 로그인 전에는 확정 상태로 보이면 안 됨 |
| 호스트 운영 액션 | 항상 숨김 |

### 메시지와 피드백

- 토글 클릭만으로 무반응이면 안 된다.
- 로그인 이후 다시 `/m/{shortId}`로 돌아올 수 있어야 한다.

### Storybook 권장 이름

- `MeetingDetail/Branch-04-GuestNotificationRedirect`

## 상태별 확인 규칙

아래 중 하나라도 바뀌면 Branch UI Atlas를 수정한다.

1. 노출 요소가 바뀜
2. 숨김 또는 비활성 규칙이 바뀜
3. CTA 종류나 버튼 가능 여부가 바뀜
4. 로그인, 권한, 확정/마감 같은 상태 분기가 추가 또는 제거됨
5. 저장/차단/에러 메시지 정책이 바뀜

반대로 아래는 문서 수정 없이 넘어갈 수 있다.

- spacing, color, typo 수정
- 동일 의미의 미세 문구 polish
- 레이아웃 미세 조정
