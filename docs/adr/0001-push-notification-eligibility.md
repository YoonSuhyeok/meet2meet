# PushNotification 수신 자격을 로그인 + PWA 설치 완료 사용자로 제한

링크로 진입한 비로그인 Participant도 기술적으로는 브라우저 푸시 구독이 가능하지만, 1차 출시에서는 로그인 완료 + 기기에서 PWA 설치 완료 + 알림 권한 허용을 모두 충족한 사용자만 NotificationSubscription을 허용한다.

비로그인 참가자 대상 푸시는 계정 없이 endpoint만 저장해야 하는데, 이렇게 하면 구독 소유자를 특정할 수 없어 해지 보장, 계정 전환 안전, 미팅별 정책 관리가 불가능해진다. 링크 진입 Participant에게는 미팅 상세 알림 토글을 노출하되, 누를 경우 로그인 유도로 전환한다.

## Considered Options

- 비로그인 기기 단위 구독 허용 — 구독 소유자 불명확, 해지·계정 전환·정책 관리 불가
- 로그인만 필수, PWA 설치 불요 — 실행 환경 불일치로 PushSubscriptionEndpoint 신뢰도 하락
- 로그인 + PWA 설치 필수 (채택)
