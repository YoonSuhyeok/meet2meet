# PWA 설치 상태를 서버 InstallFlag로 저장

브라우저 API만으로는 설치 여부를 기기 전환이나 앱 삭제 후에도 일관되게 확인할 수 없다. 최초 설치 시 서버에 InstallFlag를 기록하고, 이후 클라이언트 재검증(앱 시작 / 로그인 직후 / 미팅 상세 진입)에서 standalone 실행 여부 + 알림 권한 + PushSubscriptionEndpoint 유효성을 확인해 불일치 시 InstallFlag를 비활성화한다.

실행 시점 조건만 쓰는 방식은 매 요청마다 클라이언트 컨텍스트를 서버에 전달해야 하고, 백그라운드 발송 시 최신 상태 확인이 불가하다. 서버 플래그를 두면 발송 파이프라인이 클라이언트 접속 없이도 수신 자격을 판단할 수 있다.

영구 발송 실패 시에는 InstallFlag를 내리지 않고 PushSubscriptionEndpoint만 `sending-suppressed`로 내린다. 설치 상태와 전송 가능 상태를 분리해 유령 구독 축적을 막고, 다음 클라이언트 재검증 때 endpoint가 재생성되면 자동 복구된다.

## Considered Options

- 실행 시점 조건 판정만 사용 — 백그라운드 발송 시 자격 판단 불가, 매 요청에 클라이언트 컨텍스트 필요
- 서버 InstallFlag 영구 유지 — 앱 삭제·권한 철회 후 유령 구독 누적
- 서버 InstallFlag + 클라이언트 재검증으로 무효화 (채택)
