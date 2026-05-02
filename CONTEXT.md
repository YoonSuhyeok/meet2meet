# Meet2Meet

모임 일정 조율 서비스. 참가자가 드래그로 가능 시간을 선택하고, 주최자가 최종 일정을 확정하는 흐름을 중심으로 한다.

## Language

### 모임 도메인

**Meeting**:
주최자가 생성하고 참가자들이 일정을 투표하는 모임 단위.
_Avoid_: 이벤트, 약속, 스케줄

**Host**:
Meeting을 생성하고 최종 일정을 확정하는 사용자.
_Avoid_: 주인, 관리자, 오너

**Participant**:
inviteCode로 Meeting에 참가하여 가능 시간을 투표하는 사용자. 비로그인 진입 가능.
_Avoid_: 참여자, 멤버, 유저

**Finalize**:
Host가 투표 결과를 바탕으로 최종 슬롯을 확정하고 Meeting을 잠금 상태로 전환하는 행위.
_Avoid_: 결정, 확정, 완료, 종료

**Slot**:
투표 대상이 되는 날짜+시간 구간 단위.
_Avoid_: 시간대, 타임슬롯, 후보

**FinalSlot**:
Finalize 이후 확정된 단일 Slot.
_Avoid_: 최종 시간, 확정 시간

**inviteCode**:
Meeting 참가 진입점이 되는 단일 공유 코드. Participant는 이 코드로 Meeting에 접근한다.
_Avoid_: 초대 링크, 참가 코드, 공유 URL

### 알림 도메인

**PushNotification**:
브라우저 Web Push API를 통해 기기에 전달되는 단건 메시지.
_Avoid_: 알림, 노티, 메시지

**Reminder**:
Host가 작성하고 발송 큐에 등록하는 모임 안내 메시지. PushNotification의 상위 개념이 아니며, 별도의 발송 흐름을 가진다.
_Avoid_: 알림, 공지, 메시지

**NotificationSubscription**:
사용자 계정 × 기기 × Meeting 단위의 PushNotification 수신 구독 상태.
_Avoid_: 알림 구독, 푸시 등록, 구독

**AttendanceNudge**:
미응답 Participant에게 보내는 독촉 PushNotification. 자동 1회 + Host 수동 1회로 제한된다.
_Avoid_: 독촉 알림, 재촉, 리마인드

**PushSubscriptionEndpoint**:
브라우저가 발급하는 Web Push 수신 주소. NotificationSubscription의 기술 구성 요소.
_Avoid_: 엔드포인트, 구독 URL

**InstallFlag**:
로그인 사용자가 해당 기기에서 PWA를 설치 완료했음을 서버에 기록한 플래그.
_Avoid_: 설치 여부, PWA 상태

### 참석 확인 도메인

**AttendanceAck**:
Finalize 이후 Participant가 참석 여부(confirmed / late / absent)를 제출하는 행위 또는 그 결과.
_Avoid_: 참석 확인, 출석 체크, RSVP

## Relationships

- **Meeting**은 하나의 **FinalSlot**을 가진다 (Finalize 이후)
- **Host**는 Meeting당 하나의 **Reminder**를 작성하거나 발송 큐에 등록할 수 있다
- **NotificationSubscription**은 하나의 사용자 계정 × 하나의 기기 × 하나의 Meeting에 귀속된다
- **AttendanceNudge**는 **NotificationSubscription**이 활성 상태인 미응답 Participant에게만 전달된다
- **PushSubscriptionEndpoint**는 **NotificationSubscription** 1건에 대응하며, sending-suppressed 상태로 내려갈 수 있다

## Example dialogue

> **Dev:** "Host가 리마인드를 보내면 Participant들한테 PushNotification이 가는 건가요?"
> **Domain expert:** "Reminder와 PushNotification은 별개예요. Reminder는 Host가 작성한 메시지 템플릿이고, PushNotification은 브라우저 푸시로 전달되는 단건 메시지예요. Reminder 발송이 PushNotification을 트리거할 수 있지만, NotificationSubscription이 활성 상태인 사용자에게만 전달돼요."

> **Dev:** "Participant가 링크로 들어오면 바로 알림 받을 수 있나요?"
> **Domain expert:** "아니에요. 로그인 + InstallFlag + 알림 권한 허용 + NotificationSubscription ON이 모두 충족돼야 PushNotification을 받을 수 있어요. 링크 진입 자체는 조건 충족이 안 돼요."

## Flagged ambiguities

- "알림"은 Reminder(메시지), PushNotification(브라우저 푸시), AttendanceNudge(독촉)를 혼용하고 있었음 → 세 개념을 분리하여 각각의 용어로 고정함
- "사용자"는 Host와 Participant 두 역할을 동시에 지칭하는 경우가 있었음 → 역할에 따라 Host / Participant로 구분함
