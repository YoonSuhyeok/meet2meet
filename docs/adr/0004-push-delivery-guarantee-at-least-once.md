# PushNotification 전달 보장 모델을 at-least-once로 설정

Web Push 프로토콜 특성상 exactly-once를 강제하면 구현 복잡도가 비선형으로 증가하고, 모바일 브라우저의 네트워크 불안정 환경에서 유실 리스크가 높아진다. at-least-once를 기본 보장 모델로 채택하고, 중복 노출은 클라이언트에서 동일 이벤트 키(`eventType + meetingId`)를 가진 notification을 tag 덮어쓰기로 합쳐 사용자 체감 중복을 제거한다.

서버 레이어에서는 `eventType + meetingId + userId + deviceId + timeBucket` 조합의 idempotency 키(TTL 10분)로 중복 발송을 줄인다. 지수 백오프 3회 재시도 후 실패 확정 시 수동 재발송 대상으로 노출한다.

## Considered Options

- exactly-once — 구현 복잡도 과다, Web Push에서 현실적으로 보장 불가
- at-most-once — 재시도 없으면 네트워크 불안정 환경에서 유실률 과다
- at-least-once + 클라이언트 중복 덮어쓰기 (채택)
