## Problem Statement

Meet2Meet에서 PushNotification을 안정적으로 전달하기 위한 Go Core API 구현 전략이 필요하다. 현재 요구사항은 NotificationSubscription 수명주기, InstallFlag 기반 자격 판정, AttendanceNudge 발송 정책, at-least-once 전달 보장, 중복 제어, 재시도, 장애 복구를 모두 만족해야 한다. 동시에 초기 운영 복잡도를 과도하게 올리지 않으면서 향후 확장 가능한 구조가 필요하다.

## Solution

1차 구현은 Redis + PostgreSQL 이원화 전략으로 진행한다. PostgreSQL은 영속 상태와 감사 이력의 단일 진실원으로 사용하고, Redis는 큐/재시도/락/중복 키 처리 전용 성능 계층으로 사용한다. 전달 보장 모델은 at-least-once로 유지하되, Outbox 패턴과 이중 idempotency 가드를 통해 유실과 중복을 제어한다. 작업 단위는 recipient 단위로 분해해 부분 실패 복구와 운영 가시성을 높인다. 또한 API/정책 변경은 Astro 기반 docs-site에 동기화해 구현 계약과 운영 런북의 가시성을 유지한다.

## User Stories

1. As a Host, I want AttendanceNudge delivery to continue even when transient network failures happen, so that Participant에게 독촉이 안정적으로 전달된다.
2. As a Host, I want manual nudge quota policy to be consistently enforced, so that 동일 Meeting에서 정책 위반 발송이 발생하지 않는다.
3. As a Participant, I want PushNotification to arrive only when my NotificationSubscription is active, so that 원치 않는 발송을 받지 않는다.
4. As a Participant, I want unsubscription to take effect immediately at send-time filtering, so that 해지 이후 발송이 차단된다.
5. As an authenticated user, I want InstallFlag and permission eligibility to be evaluated consistently, so that 자격 미충족 상태에서는 구독이 비활성화된다.
6. As an operator, I want delivery to be at-least-once with bounded retries, so that 일시 장애가 있어도 전달 성공률을 확보할 수 있다.
7. As an operator, I want endpoint suppression on terminal failures, so that 영구 실패 endpoint로 재시도가 무한 반복되지 않는다.
8. As an operator, I want idempotency keys per eventType + meetingId + userId + deviceId + timeBucket, so that 중복 enqueue/재처리가 사용자 체감 중복으로 확산되지 않는다.
9. As an operator, I want Redis dedup keys with TTL, so that 단기 중복 트래픽을 빠르게 흡수할 수 있다.
10. As an operator, I want PostgreSQL unique idempotency guard, so that Redis 재시작/유실 상황에서도 중복이 최종 차단된다.
11. As an operator, I want Outbox-based publish flow, so that DB commit 이후 queue publish 실패로 인한 유실 창이 제거된다.
12. As an operator, I want Redis ready queue and delayed retry scheduler separation, so that 재시도 정책을 단순하고 예측 가능하게 운영할 수 있다.
13. As an operator, I want lease + requeue scanning for processing jobs, so that worker crash 시 in-flight 작업이 자동 복구된다.
14. As an operator, I want per-recipient job granularity, so that partial failures only retry failed recipients.
15. As an operator, I want recovery bootstrap from PostgreSQL queued/retryable state, so that Redis 장애 이후 자동 재적재로 서비스 복구가 가능하다.
16. As a developer, I want deep modules with stable interfaces for delivery policy, so that 정책 변경이 전체 코드를 흔들지 않는다.
17. As a developer, I want contract-focused Core API behavior tests, so that 내부 구현 변경에도 외부 동작 회귀를 방지한다.
18. As a developer, I want explicit endpoint state transitions (active, sending_suppressed, invalid), so that 운영 중 원인 분석이 가능하다.
19. As a developer, I want auditable push_delivery_attempts records, so that 재발송 판단과 장애 분석을 데이터 기반으로 수행할 수 있다.
20. As a product owner, I want initial architecture to avoid premature Kafka/RabbitMQ/SQS adoption, so that 초기 비용과 운영 부담을 최소화한다.
21. As a product owner, I want future broker migration to remain possible, so that 트래픽 성장 시 구조적 전환이 가능하다.
22. As a security reviewer, I want Core API to trust BFF-propagated identity headers and reject missing identity, so that 인증 경계가 일관된다.
23. As a reliability reviewer, I want retries to follow agreed backoff schedule (immediate, +30s, +5m, +30m), so that 과도한 재시도 폭주를 방지한다.
24. As a UX stakeholder, I want server and client dedup strategies to coexist, so that 사용자 체감 중복 노출이 최소화된다.
25. As a maintainer, I want notification delivery architecture changes reflected in the Astro docs-site, so that 팀이 최신 계약과 운영 절차를 단일 문서 경로에서 확인할 수 있다.
26. As a maintainer, I want Notification API spec and PRD updates to be published through docs-site build, so that 배포 전 문서 정합성을 검증할 수 있다.

## Implementation Decisions

- 아키텍처는 Redis + PostgreSQL 이원화로 채택한다.
- PostgreSQL은 NotificationSubscription, InstallFlag, AttendanceNudge audit, push_delivery_attempts, outbox 등 영속/감사 데이터를 소유한다.
- Redis는 ready queue, delayed retry scheduler, processing lease, dedup key, 단기 분산락을 소유한다.
- 전달 보장 모델은 at-least-once를 유지하고, exactly-once는 채택하지 않는다.
- Outbox 패턴을 사용해 도메인 상태 변경과 발행 의도를 동일 트랜잭션으로 기록한다.
- publish worker는 outbox를 읽어 Redis에 jobId를 적재하고 sent 상태를 반영한다.
- job payload는 최소 식별자 중심으로 구성하며, 상세 상태는 PostgreSQL에서 조회한다.
- 처리 단위는 recipient 단위(userId x deviceId x endpoint)로 분해한다.
- retry는 delayed scheduler로 관리하고, 정책 백오프는 immediate, +30s, +5m, +30m를 따른다.
- worker는 processing lease를 획득하고 heartbeat 또는 TTL 만료 기반 재적재를 허용한다.
- requeue scanner는 lease 만료 작업을 ready queue로 복귀시킨다.
- 중복 방지는 Redis TTL dedup key(1차) + PostgreSQL unique idempotency key(2차) 이중 가드로 구현한다.
- idempotency key 조합은 eventType + meetingId + userId + deviceId + timeBucket(10분)로 고정한다.
- terminal failure 시 endpoint_status를 sending_suppressed로 전환하고 InstallFlag는 자동 비활성화하지 않는다.
- Redis 장애 복구는 PostgreSQL queued/retryable/outbox 상태를 기준으로 자동 재적재한다.
- 수동/자동 AttendanceNudge quota 정책은 Core API에서 단일 소유한다.
- BFF는 브라우저 컨텍스트 사실 수집과 인증 컨텍스트 전달만 담당하고 정책 결정/저장/전달은 Core API가 소유한다.
- 향후 확장 시 브로커 교체 가능성을 위해 queue adapter 경계를 모듈화한다.
- 알림 도메인 구현 결정은 Astro docs-site 콘텐츠(아키텍처, API 스펙, PRD 요약, 운영 가이드)와 함께 릴리스한다.
- 문서 파이프라인은 docs-site 동기화 스크립트와 빌드를 통과해야 배포 기준을 충족한다.

권장 Deep Modules

- Delivery Reliability Policy Adapter: idempotency, retry schedule, suppression transition을 단일 인터페이스로 캡슐화.
- Outbox Publisher Coordinator: outbox 읽기, publish, sent 마킹, 재시도 재진입을 단순 API로 캡슐화.
- Recipient Dispatch Orchestrator: 대상자 분해, send attempt 기록, 결과 상태 전이를 캡슐화.
- Queue Runtime Adapter: Redis List/Sorted Set/lease/requeue 구현을 인프라 경계 뒤로 숨김.
- Recovery Bootstrap Engine: 재시작 시 PostgreSQL 기준 Redis 재적재를 캡슐화.

## Testing Decisions

- 좋은 테스트는 내부 함수 구조가 아니라 외부 행위(입력/출력/상태 전이/부수효과)를 검증해야 한다.
- 계약 테스트는 Notification API 스펙과 ADR 합의(자격 정책, 상태코드, requiredAction, nudge 정책)를 중심으로 작성한다.
- 신뢰성 테스트는 idempotency key 충돌, retry schedule, suppression 전이를 중심으로 작성한다.
- 장애 복구 테스트는 worker crash, lease 만료, Redis 재시작, outbox 재발행을 중심으로 작성한다.
- 모듈별 테스트는 deep module 경계 인터페이스 기준으로 작성해 구현 교체 내성을 높인다.
- recipient 단위 dispatch 테스트는 부분 실패/부분 성공 혼합 시나리오를 포함한다.
- 기존 코드베이스의 server contract 테스트 스타일과 feature-level 모델 테스트 스타일을 prior art로 계승한다.
- 통합 테스트는 PostgreSQL + Redis를 함께 띄운 상태에서 queue/retry/recovery 흐름을 검증한다.
- 문서 검증은 Astro docs-site 빌드 성공과 OpenAPI/PRD 반영 여부를 체크리스트로 포함한다.

우선 테스트 대상 모듈

- Delivery Reliability Policy Adapter
- Outbox Publisher Coordinator
- Recipient Dispatch Orchestrator
- Queue Runtime Adapter
- Recovery Bootstrap Engine

## Out of Scope

- Kafka, RabbitMQ, SQS의 즉시 도입 및 운영 전환
- exactly-once 전달 보장 구현
- 다중 리전 active-active 분산 전달 아키텍처
- 알림 콘텐츠 개인화 고도화 및 템플릿 CMS
- 관리자용 수동 재발송 UI 고도화
- 대규모 observability stack 교체 작업

## Further Notes

- 본 PRD는 기존 ADR(0001~0004)의 정책 결정을 유지한 상태에서 구현 상세를 확정한다.
- 초기 목표는 운영 단순성과 신뢰성의 균형이며, 핵심은 PostgreSQL 기준 복구 가능성이다.
- 브로커 전환 여부는 지표 기반으로 판단한다: queue backlog 지속 시간, retry 실패율, 발송 지연 p95/p99, 운영 장애 빈도.
- 이후 이슈 분해 시 tracer-bullet 방식으로 수직 슬라이스(Outbox, Dispatch, Recovery, Contract Tests)를 우선 적용한다.
- 문서 공개 경로는 Astro docs-site를 기본으로 하며, 아키텍처/ADR/PRD/OpenAPI의 변경 이력 추적을 유지한다.
