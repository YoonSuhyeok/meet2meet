---
title: Notification Core API
---

# Notification Core API (Go) Implementation README

This document defines the Go Core API implementation contract for the notification domain in Meet2Meet.

It is the execution guide for:
- `NotificationSubscription` registration and lifecycle
- `InstallFlag` persistence and revalidation behavior
- `PushSubscriptionEndpoint` delivery state transitions
- `AttendanceNudge` policy and dispatch behavior

This README must be treated as the Core API source of truth together with:
- `docs/NOTIFICATION_API_SPEC.yaml`
- ADR `0003` (BFF entry, Core ownership)
- ADR `0004` (at-least-once delivery)

## 1) Ownership boundary

### BFF owns
- Browser-context fact collection:
  - login session extraction
  - `isStandalone`
  - `notificationPermissionStatus`
  - browser `PushSubscription` payload
- Authentication at edge and user identity propagation
- HTTP proxying to Core API

### Core API owns
- Domain policy decisions (eligibility, host-only actions)
- Persistence (`NotificationSubscription`, `InstallFlag`, endpoint state, nudge audit)
- Idempotency and retry policy
- Delivery queueing/dispatch and endpoint suppression

## 2) Trust model between BFF and Core API

Core API must trust BFF identity headers instead of browser auth token.

Required inbound headers from BFF:
- `X-User-Id`: authenticated account id

Notes:
- Browser `Authorization` token must not be required at Core API boundary.
- If `X-User-Id` is absent/invalid, Core API must return `401 unauthorized`.

## 3) HTTP contract to implement

Core API endpoints (base: `/meetings/{meetingId}`):
- `POST /push-subscriptions`
- `DELETE /push-subscriptions`
- `GET /push-subscriptions/status`
- `POST /attendance-nudges`

Request/response field-level contract follows `docs/NOTIFICATION_API_SPEC.yaml`.

### 3.1 Register subscription

`POST /meetings/{meetingId}/push-subscriptions`

Input:
- `pushSubscription.endpoint`
- `pushSubscription.keys.auth`
- `pushSubscription.keys.p256dh`
- `deviceId`
- `isStandalone`
- `notificationPermissionStatus`

Core behavior:
1. Validate meeting exists.
2. Validate user is eligible:
   - logged-in (`X-User-Id` present)
   - `isStandalone == true`
   - `notificationPermissionStatus == granted`
3. Upsert `NotificationSubscription` scoped by `userId x deviceId x meetingId`.
4. Upsert/activate `InstallFlag` for `userId x deviceId`.
5. Return `201` with `subscriptionId`, `installFlagCreated`, `registeredAt`.

Validation failure:
- return `400` with `SubscriptionErrorResponse` and `requiredAction`.

### 3.2 Unregister subscription

`DELETE /meetings/{meetingId}/push-subscriptions`

Core behavior:
1. Resolve target subscription by `userId x meetingId` and current device context (or provided device id policy).
2. Mark subscription inactive immediately.
3. Ensure send pipeline excludes inactive subscriptions at send-time filter.
4. Return `204`.

### 3.3 Subscription status

`GET /meetings/{meetingId}/push-subscriptions/status`

Core behavior:
- return current device-level status snapshot:
  - `isSubscribed`
  - `isStandalone`
  - `notificationPermissionStatus`
  - `installFlagStatus` (`active|disabled|expired`)
  - `pushSubscriptionEndpointStatus` (`active|sending-suppressed|invalid`)
  - `lastVerifiedAt`, `lastNudgeAt`

### 3.4 Manual AttendanceNudge

`POST /meetings/{meetingId}/attendance-nudges`

Core behavior:
1. Validate caller is Host of the meeting.
2. Enforce nudge quota policy:
   - max 1 auto nudge + max 1 manual nudge.
3. Select targets: non-responding participants only, with active `NotificationSubscription`.
4. Enqueue async dispatch job and return `202` with `nudgeId`, `targetCount`, `queuedAt`.

Forbidden/policy failures:
- `403 forbidden` for non-host
- `400` for invalid state (quota exceeded, no targets)

## 4) Persistence model (recommended)

The exact schema can vary, but behavior must be equivalent.

### 4.1 notification_subscriptions

Purpose:
- subscription state by account x device x meeting

Recommended columns:
- `id` (pk)
- `meeting_id`
- `user_id`
- `device_id`
- `endpoint`
- `p256dh`
- `auth`
- `is_active` (bool)
- `endpoint_status` (`active|sending_suppressed|invalid`)
- `registered_at`
- `last_verified_at`
- `updated_at`

Unique index:
- `(meeting_id, user_id, device_id)`

Operational index:
- `(meeting_id, is_active, endpoint_status)`

### 4.2 install_flags

Purpose:
- installation truth for account x device

Recommended columns:
- `id` (pk)
- `user_id`
- `device_id`
- `status` (`active|disabled|expired`)
- `activated_at`
- `disabled_at` (nullable)
- `last_verified_at`
- `updated_at`

Unique index:
- `(user_id, device_id)`

### 4.3 attendance_nudges

Purpose:
- nudge audit and quota control

Recommended columns:
- `id` (pk, nudge_id)
- `meeting_id`
- `trigger_type` (`auto|manual`)
- `requested_by_user_id` (nullable for auto)
- `message_override` (nullable)
- `target_count`
- `queued_at`
- `sent_at` (nullable)
- `status` (`queued|sent|failed`)

Index:
- `(meeting_id, trigger_type, queued_at)`

### 4.4 push_delivery_attempts

Purpose:
- per-recipient dispatch trace and retries

Recommended columns:
- `id` (pk)
- `nudge_id` (fk)
- `meeting_id`
- `user_id`
- `device_id`
- `endpoint`
- `idempotency_key`
- `attempt_no`
- `result` (`success|retryable_failure|terminal_failure|suppressed`)
- `http_status` (nullable)
- `error_code` (nullable)
- `attempted_at`

Indexes:
- `(idempotency_key)`
- `(meeting_id, user_id, device_id, attempted_at)`

## 5) Policy details

### 5.1 Eligibility policy

`NotificationSubscription` can be active only when:
- login identity exists
- app is standalone (`isStandalone == true`)
- notification permission is granted

### 5.2 InstallFlag vs endpoint suppression

Do not collapse these concepts.

- `InstallFlag` expresses installation truth.
- `PushSubscriptionEndpoint` state expresses delivery health.

On terminal delivery failures:
- set endpoint status to `sending_suppressed`
- do not automatically disable `InstallFlag`

Recovery path:
- client revalidation or re-subscription can reactivate endpoint.

### 5.3 AttendanceNudge quota

Per meeting:
- auto nudge max `1`
- manual nudge max `1`

Manual nudge requires host ownership.

## 6) Delivery reliability and idempotency

Delivery model: `at-least-once`.

### 6.1 Idempotency key

Use:
- `eventType + meetingId + userId + deviceId + timeBucket`

Where:
- `timeBucket` is 10-minute bucket
- dedup TTL is 10 minutes

### 6.2 Retry policy

Retryable failures must use exponential-like backoff:
- attempt #1: immediate
- attempt #2: +30s
- attempt #3: +5m
- attempt #4: +30m

After final failure:
- mark endpoint `sending_suppressed`
- record terminal failure
- surface for manual recovery/retry tooling

## 7) Error mapping contract

Core API should preserve stable error codes for BFF/UI actions.

Examples:
- `unauthorized`
- `forbidden`
- `not_found`
- `validation_error`
- `installation_required`
- `notification_permission_required`
- `re_login_required`

For subscription validation failures, include `requiredAction` when applicable:
- `install`
- `grant-permission`
- `re-login`
- `refresh-status`

## 8) Minimal implementation sequence (Go)

1. Implement persistence tables and unique/index constraints.
2. Implement register/unregister/status handlers.
3. Implement manual `AttendanceNudge` enqueue path with host check and quota check.
4. Implement dispatcher worker with idempotency + retry + suppression.
5. Add contract tests against `NOTIFICATION_API_SPEC.yaml` payloads.

## 9) Test expectations

Core tests should validate external behavior:
- eligibility acceptance/rejection
- `NotificationSubscription` upsert semantics
- immediate unsubscribe filtering
- nudge quota and host-only policy
- idempotency dedup within 10-minute bucket
- retry schedule and suppression transition

Avoid coupling tests to internal function structure.

## 10) Open implementation choices (allowed)

The following may differ by team preference as long as behavior is preserved:
- queue technology (DB queue, Redis, cloud queue)
- exact SQL naming and enum representation
- endpoint health thresholds beyond minimum retry policy
- observability backend

## 11) Done criteria for this README

This README is complete when a Go developer can implement Core API notification flows without re-reading PRD, using this doc + OpenAPI spec + ADRs as sufficient inputs.
