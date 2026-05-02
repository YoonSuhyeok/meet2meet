---
title: Push Notification Subscription Prd
---

## Problem Statement

Meet2Meet의 Participant는 링크 진입만으로는 PushNotification을 안정적으로 수신할 수 없고, Host는 Finalize 이후 미응답자를 AttendanceNudge로 후속 조치하기 어렵다. 현재 정책은 로그인, PWA 설치, 알림 권한, NotificationSubscription 활성화라는 수신 자격을 요구하지만, 사용자 관점에서는 토글 진입 경험과 로그인 복구 흐름이 아직 완결되지 않아 실제 opt-in 전환이 떨어질 위험이 있다. 또한 Core API(Go) 소유 경계와 BFF 진입점 정책이 문서화되어 있으나, 구현 우선순위와 테스트 전략을 하나의 실행 가능한 제품 요구사항으로 통합할 필요가 있다.

## Solution

사용자에게는 미팅 상세에서 "이 미팅 알림 받기"를 단일 진입점으로 제공하고, 시스템은 BFF가 브라우저 컨텍스트 사실(로그인 세션, standalone 여부, 알림 권한, PushSubscriptionEndpoint)을 수집해 Core API에 전달한다. Core API는 NotificationSubscription, InstallFlag, AttendanceNudge 정책을 단일 소스로 소유한다. 로그인하지 않은 사용자 토글 클릭은 로그인으로 전환되며, 로그인 후 동일 Meeting으로 복귀해 구독 의도를 복구한다. 전달 보장 모델은 at-least-once를 유지하고, 서버 idempotency + 클라이언트 notification tag 병합으로 체감 중복을 최소화한다.

## User Stories

1. As a Participant, I want to enable PushNotification from Meeting detail, so that I can receive FinalSlot and schedule change updates without reopening the app.
2. As a Participant, I want the toggle to explain why I cannot subscribe (not logged in, not installed, permission denied), so that I can fix the exact blocking condition.
3. As a Participant, I want to be redirected to login when I tap the toggle while logged out, so that I can complete subscription with my account identity.
4. As a Participant, I want my toggle intent restored after login, so that I do not have to repeat navigation and taps.
5. As a Participant, I want subscription to be scoped by account × device × Meeting, so that enabling notifications on one Meeting does not unintentionally subscribe me to all Meetings.
6. As a Participant, I want to unsubscribe instantly, so that I can stop receiving PushNotification before the next send attempt.
7. As a Participant, I want permission request timing to occur only when I explicitly opt in, so that the browser prompt feels intentional and understandable.
8. As a Participant, I want clear guidance when PWA standalone is required, so that I know I must install/open as app to qualify.
9. As a Participant, I want install and permission state revalidation on key entry points, so that stale InstallFlag or endpoint states can self-heal.
10. As a Participant, I want subscription errors to return actionable requiredAction values, so that the UI can guide me without ambiguous failure messages.
11. As a Host, I want to send one manual AttendanceNudge after the auto nudge, so that I can recover RSVP responses without spamming.
12. As a Host, I want manual nudge eligibility enforced server-side, so that policy is consistent regardless of client behavior.
13. As a Host, I want nudge requests accepted asynchronously, so that UI remains responsive and delivery can be retried in background.
14. As a Host, I want quiet-hour behavior to be predictable, so that recipients are not disturbed outside policy windows.
15. As a Host, I want delivery reliability under unstable mobile networks, so that important meeting changes are less likely to be missed.
16. As a Host, I want duplicate notification exposure minimized, so that participants trust the channel.
17. As a product owner, I want eligibility policy centralized in Core API, so that policy changes do not require coordinated client rewrites.
18. As a product owner, I want browser-context collection centralized in BFF, so that Core API stays domain-focused and channel-agnostic.
19. As an operator, I want idempotency keys per eventType + meetingId + userId + deviceId + timeBucket, so that transient retries do not explode duplicates.
20. As an operator, I want delivery retries with backoff and terminal failure handling, so that failed endpoints can move to sending-suppressed state safely.
21. As an operator, I want endpoint suppression decoupled from InstallFlag, so that app installation truth remains separate from transient delivery failures.
22. As an operator, I want metrics for opt-in conversion, permission abandonment, send success/failure, and dedup rate, so that rollout decisions are data-driven.
23. As a security reviewer, I want upstream calls to avoid forwarding browser auth token, so that Core API trust is based on BFF-authenticated identity headers.
24. As a security reviewer, I want unauthorized calls rejected before upstream proxying, so that attack surface and noisy traffic are reduced.
25. As a QA engineer, I want deterministic behavior for login recovery and toggle state transitions, so that end-to-end scenarios are reliable.
26. As a QA engineer, I want API contracts for register/unregister/status/nudge to remain stable, so that Go Core implementation and BFF can evolve independently.
27. As a documentation consumer, I want domain terms (PushNotification, NotificationSubscription, AttendanceNudge, InstallFlag) used consistently, so that requirements and implementation remain aligned.
28. As a mobile Participant, I want lockscreen privacy behavior clearly controlled by product policy, so that sensitive details are not shown unexpectedly.
29. As a release manager, I want kill-switch and rollback criteria tied to delivery metrics, so that beta rollout can be stopped safely when anomalies appear.
30. As a future contributor, I want deep modules around eligibility evaluation and subscription orchestration, so that changes stay local and testable.

## Implementation Decisions

- BFF remains the single entry point for NotificationSubscription and AttendanceNudge HTTP APIs, with Core API as the owner of policy, persistence, and dispatch.
- Subscription eligibility remains strict: login + InstallFlag-qualified standalone execution + notification permission granted.
- The registration pipeline will treat browser facts as inputs, while policy decisions and state transitions are finalized server-side.
- Login recovery flow will persist an explicit subscription intent and the target Meeting context, then replay post-login before clearing intent.
- NotificationSubscription scope is fixed to account × device × Meeting.
- Server-side InstallFlag and PushSubscriptionEndpoint lifecycle are separated: endpoint can be sending-suppressed without invalidating installation truth.
- Delivery guarantee remains at-least-once with dual dedup controls: server idempotency key and client notification tag merge.
- Nudge policy remains: auto 1회 + manual 1회; manual nudge is host-only and validated in Core API.
- Proxy contract remains four operations: register, unregister, status, manual nudge; all routed through authenticated BFF identity headers.
- Error contract exposes requiredAction semantics for install, grant-permission, re-login, refresh-status.
- Deep module extraction target 1: Subscription Eligibility Evaluator (inputs: browser context + account/session + server state; output: allow/deny + reason + requiredAction).
- Deep module extraction target 2: Subscription Orchestrator (coordinates permission request, push endpoint serialization, API invocation, optimistic UI transitions).
- Deep module extraction target 3: Auth Intent Recovery Coordinator (capture intent, restore after login, expiry and idempotent replay semantics).
- Deep module extraction target 4: Delivery Reliability Policy Adapter (idempotency key strategy, retry schedule, suppression trigger thresholds).
- Schema-level expectation for Core API includes persisted NotificationSubscription state, InstallFlag state, endpoint status, and nudge audit metadata.

## Testing Decisions

- Good tests validate external behavior (API contract, state transition, user-visible outcomes) and avoid asserting private implementation details.
- BFF proxy tests should mirror existing route proxy tests: unauthorized short-circuit, identity header forwarding, query/body forwarding, upstream error mapping.
- UI tests should focus on toggle behavior under four states: logged out, not standalone, permission denied/default, subscribed.
- Login recovery tests should prove intent capture and post-login replay exactly once.
- Eligibility evaluator tests should be table-driven by input combinations and expected requiredAction output.
- Subscription orchestrator tests should verify failure handling branches (permission denied, endpoint creation failure, upstream validation errors).
- Delivery policy tests (Core-facing contract tests or shared spec tests) should cover idempotency key composition, retry backoff schedule, and suppression transition behavior.
- Prior art for testing style:
  - auth-layer fetch tests that assert redirect/logout behavior and credential policy.
  - BFF meeting proxy tests that assert request rewrite, auth handling, and upstream fault mapping.
- End-to-end tests should validate complete user journey: toggle click → login redirect → return to Meeting → subscription completed.
- Contract tests should pin request/response fields for register/unregister/status/nudge to prevent drift between BFF and Go Core API.

## Out of Scope

- SMS, email, KakaoTalk 등 멀티채널 알림 확장.
- Exactly-once delivery 보장 모델.
- 비로그인 Participant 대상 endpoint-only 구독 저장.
- Reminder 템플릿 시스템의 기능 확장.
- 대규모 운영 대시보드 구축과 장기 분석 파이프라인 전체.

## Further Notes

- 본 PRD는 기존 도메인 용어집과 ADR(수신 자격, InstallFlag 저장, BFF/Core 분리, at-least-once 전달 모델)을 우선 준수한다.
- Go Core API는 별도 구현이지만, BFF와의 계약은 본 PRD의 API 계약 및 상태 모델을 기준으로 고정한다.
- 롤아웃 시 핵심 게이트는 전달 성공률, 중복 체감, 권한 이탈률, 즉시 해지 반영률로 판단한다.
