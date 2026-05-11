---
title: Branch UI Atlas (예시)
description: 분기 조건별 화면 구성도를 카드 단위로 정리하는 예시 문서
---

이 문서는 **분기별 화면 구성 확인용 예시**입니다.  
키는 `FO-ID`를 사용하고, 각 분기마다 무엇이 보여야/숨겨져야 하는지를 한 번에 확인합니다.

연결 기준: [Flow Oracle](/planning/flow-oracle/)

실전 적용 예시: [미팅 상세 Branch UI Atlas](/planning/meeting-detail-branch-ui-atlas/)

## 분기 카드 예시 1개

### FO-03-003 — 미팅 확정/마감 상태에서 제출 차단

- Route: `/m/{shortId}` 또는 `/meeting/{id}`
- Condition: `meeting.status in ["finalized", "closed"]`
- Goal: 사용자 제출 액션이 차단된 UI인지 확인

### 1) 상태 조건

| 항목 | 값 |
|---|---|
| FO-ID | `FO-03-003` |
| 사용자 | 로그인/비로그인 참여자 |
| 미팅 상태 | `finalized` 또는 `closed` |
| 진입 경로 | 공유 링크 또는 상세 페이지 |

### 2) 화면 구성도 (이 분기에서 기대되는 UI)

| 영역 | 보여야 함 | 숨김/비활성 |
|---|---|---|
| 상단 정보 | 미팅 제목, 날짜, 확정/마감 배지 | - |
| 시간 선택 그리드 | 기존 선택 결과(읽기 전용) | 새 선택 입력 인터랙션 |
| 제출 액션 | 차단 메시지 또는 안내 텍스트 | 제출 버튼 비활성(또는 미노출) |
| 피드백 | "이미 확정/마감되어 변경할 수 없음" 안내 | 성공 토스트/저장 완료 메시지 |

### 3) CTA 규칙

| 버튼 | 상태 | 동작 |
|---|---|---|
| 투표 제출 | Disabled | 클릭 불가 |
| 로그인 유도(비로그인 시) | Optional | 필요 시 `/login` 이동 |
| 상세 보기 | Enabled | 상세 화면 이동 허용 |

### 4) 스크린샷 슬롯

- 파일 경로 규칙: `/public/branch-ui/FO-03-003-*.png`
- 예시:
  - `/branch-ui/FO-03-003-desktop.png`
  - `/branch-ui/FO-03-003-mobile.png`

스크린샷이 준비되면 아래처럼 이미지 블록을 추가합니다.

```md
![FO-03-003 Desktop](/branch-ui/FO-03-003-desktop.png)
![FO-03-003 Mobile](/branch-ui/FO-03-003-mobile.png)
```

