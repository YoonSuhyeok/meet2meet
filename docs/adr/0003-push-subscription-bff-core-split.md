# 푸시 구독 등록은 BFF가 진입점, Core API가 저장·발송 소유

NotificationSubscription 등록 흐름에서 BFF(Hono/Cloudflare Workers)는 브라우저 컨텍스트 사실(로그인 세션, standalone 실행 여부, 알림 권한, PushSubscriptionEndpoint 원본)을 수집해 Core API로 전달하고, Core API(Go/Fly.io)는 사용자-기기-미팅 정책 검사, InstallFlag 갱신, 중복 정합성 검사, 저장, 발송 큐 관리를 소유한다.

브라우저 컨텍스트는 BFF 레이어에서만 정확하게 접근 가능하고, 정책 판정은 도메인 규칙이므로 Core API가 단일 소유해야 버전이 늘어나도 분산되지 않는다. 클라이언트가 Core API를 직접 호출하거나 BFF가 발송까지 소유하면 인증 컨텍스트와 정책 로직이 뒤섞인다.
