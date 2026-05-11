---
title: Flow Oracle
---

# Meet2Meet Front Flow Oracle

작성일: 2026-05-10

## 목적

화면 플로우가 맞는지 감으로 보지 않고, 같은 입력에 대해 항상 같은 판정을 내리기 위한 정답표를 정의한다.

이 문서는 다음에 사용한다.

- E2E 테스트 pass or fail 기준
- 수동 QA 체크리스트 기준
- 회귀 발생 시 원인 구간 식별 기준

## 오라클 레코드 형식

| 필드 | 설명 |
|---|---|
| Scenario ID | 시나리오 고유 ID |
| Start State | 로그인 상태, 역할, 데이터 상태 |
| Action | 사용자 행동 |
| Expected Transition | 기대 URL 또는 화면 전이 |
| Expected Effects | 기대 API 호출, 저장, 버튼 상태 |
| Fail Condition | 실패 판정 조건 |

## 공통 판정 규칙

1. URL 전이와 핵심 UI 상태를 동시에 만족해야 성공으로 본다.
2. 보호 액션은 미인증 상태에서 로그인 전이 또는 401 처리 중 하나가 반드시 발생해야 한다.
3. 변경 요청은 성공 시 상태 변화가 보이고, 실패 시 안내 메시지가 보여야 한다.
4. 마감 또는 확정 상태는 제출 액션이 비활성 또는 차단 메시지로 나타나야 한다.
5. 로컬 폴백 정책이 있는 플로우는 폴백 메시지까지 포함해야 성공으로 본다.

## Flow 01 인증

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-01-001 | 비로그인, /login 진입 | 소셜 로그인 버튼 클릭 | OAuth 시작 엔드포인트로 요청 | GET /api/auth/{provider} 발생 | 요청 미발생 또는 잘못된 provider |
| FO-01-002 | OAuth 성공 후 /auth/callback | 페이지 로드 | / 로 이동 | 세션 체크 후 홈 화면 표시 | /auth/callback에 잔류 |
| FO-01-003 | /login?error=auth_failed | 페이지 로드 | /login 유지 | 오류 배너 노출 | 오류 배너 미노출 |
| FO-01-004 | 로그인된 사용자, /login 진입 | 페이지 로드 | / 로 이동 | post-login redirect 있으면 우선 적용 | 로그인 페이지 잔류 |

## Flow 02 미팅 생성

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-02-001 | 비로그인, /meeting/new 진입 | 페이지 로드 | /login 이동 | 보호 페이지 접근 차단 | 로딩 후 페이지 노출 |
| FO-02-002 | 로그인, 필수 입력 완료 | 생성 버튼 클릭 | /meeting/new 유지 후 공유 모달 노출 | POST /api/meetings 1회, shortId 및 inviteCode 표시 | 요청 미발생, 모달 미노출 |
| FO-02-003 | 로그인, 제목 또는 날짜 누락 | 생성 버튼 클릭 | /meeting/new 유지 | 에러 메시지 표시, POST 미발생 | POST 발생 또는 에러 미표시 |

## Flow 03 상세 조회 및 공유 투표

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-03-001 | 로그인 Host, /meeting/{id} | 페이지 로드 | /meeting/{id} 유지 | GET /api/meetings/{id}, GET /api/meetings/{id}/votes | 핵심 데이터 누락 |
| FO-03-002 | 비로그인 Participant, /m/{shortId} | 슬롯 선택 후 제출 | /m/{shortId} 유지 | PUT /api/meetings/{id}/votes?participantCode=guest:* | 요청 누락 또는 participantCode 누락 |
| FO-03-003 | 미팅 확정 또는 마감 상태 | 제출 버튼 클릭 | 현재 화면 유지 | 차단 메시지 또는 비활성 상태 유지 | 제출 허용됨 |
| FO-03-004 | 비로그인, 공유 화면 알림 토글 클릭 | 토글 클릭 | /login 이동 | post-login redirect에 /m/{shortId} 저장 | 로그인 이동 실패 또는 redirect 저장 실패 |

## Flow 04 일정 확정

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-04-001 | Host, /meeting/{id}, topSlots 존재 | 확정 버튼 클릭 | /meeting/{id} 유지 | POST /api/meetings/{id}/finalize, 확정 배지 및 확정 슬롯 노출 | 호출 실패 또는 상태 미변경 |
| FO-04-002 | Host, 이미 확정된 미팅 | 확정 해제 클릭 | /meeting/{id} 유지 | DELETE /api/meetings/{id}/finalize, 확정 상태 해제 | 호출 실패 또는 상태 잔류 |
| FO-04-003 | Host 아님 | 상세 로드 | /meeting/{id} 유지 | 확정 액션 UI 비노출 | 확정 버튼 노출 |

## Flow 05 리마인드 및 참석 독촉

참고: 현재 구현은 전용 attendance 페이지 대신 상세 화면 내 독촉 액션 중심으로 동작한다.

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-05-001 | Host, 마감 상태, 미응답 인원 존재 | 독촉 발송 클릭 | /meeting/{id} 유지 | POST /api/meetings/{id}/attendance-nudges, 완료 후 버튼 비활성 | 다중 발송 가능 상태 유지 |
| FO-05-002 | Host 아님 또는 미응답 0명 | 상세 로드 | /meeting/{id} 유지 | 독촉 버튼 비노출 | 버튼 노출 |

## Flow 06 회고 및 다음 단계

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-06-001 | Host, /meeting/{id}/recap | 회고 발행 클릭 | /meeting/{id}/recap 유지 | POST /api/meetings/{id}/recap, recapId 표시 | 발행 성공 상태 미노출 |
| FO-06-002 | Host, 백엔드 미구현 응답(404, 405, 501, 502) | 회고 발행 클릭 | /meeting/{id}/recap 유지 | 로컬 폴백 저장 메시지 노출 | 폴백 메시지 미노출 |
| FO-06-003 | 로그인 Participant, /m/{shortId}/recap | 반응 제출 클릭 | /m/{shortId}/recap 유지 | POST /api/meetings/{id}/recap/reactions, 평균값 갱신 | 성공 메시지 미노출 |
| FO-06-004 | Participant, 백엔드 미구현 응답(404, 405, 410, 501, 502) | 반응 제출 클릭 | /m/{shortId}/recap 유지 | 로컬 폴백 저장 메시지 노출 | 폴백 메시지 미노출 |

## Flow 07 모바일 RSVP Quick

참고: 현재 전용 /m/{shortId}/rsvp 라우트는 없고, /m/{shortId} 화면에서 quick 투표 플로우를 수행한다.

| Scenario ID | Start State | Action | Expected Transition | Expected Effects | Fail Condition |
|---|---|---|---|---|---|
| FO-07-001 | 모바일 뷰포트, /m/{shortId} | 슬롯 선택 후 제출 | /m/{shortId} 유지 | PUT /api/meetings/{id}/votes 호출, 저장 메시지 표시 | 저장 메시지 미노출 |
| FO-07-002 | 모바일 뷰포트, 비로그인 | 로그인 연동 버튼 클릭 | /login 이동 | post-login redirect에 /m/{shortId} 저장 | 로그인 이동 실패 |

## 자동검증 매핑

| 범위 | 기존 자동검증 | 보강 필요 |
|---|---|---|
| 홈/생성/상세 모바일 레이아웃 | tests/e2e/home-meeting-list.spec.ts, tests/e2e/meeting-new-calendar.spec.ts, tests/e2e/meeting-detail-title-overflow.spec.ts, tests/e2e/shared-meeting-title-overflow.spec.ts | 회고 플로우 성공 and 폴백 케이스 |
| 알림 전이 and 독촉 | tests/e2e/notification-flow.spec.ts | 확정 해제 및 권한 경계 케이스 |
| 인증 전이 | server/auth.test.ts 및 일부 페이지 동작 | /login 오류 코드별 UI 케이스 |

## Playwright 판정 체크 템플릿

아래 3축을 모두 assert 하면 플로우 오라클 기준 검증이 된다.

1. transition: URL and 핵심 heading
2. effect: API 호출 path and method and body
3. state: 버튼 활성화, 메시지, 배지

예시 템플릿

```ts
await page.goto(startUrl)
await doAction(page)

await expect(page).toHaveURL(expectedUrlRegex)
await expect(page.getByText(expectedMessage)).toBeVisible()

expect(capturedRequests).toContainEqual({
  method: expectedMethod,
  path: expectedPath,
})
```
