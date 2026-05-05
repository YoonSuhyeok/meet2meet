/**
 * Notification domain types
 *
 * 핵심 개념:
 * - PushNotification: 브라우저 Web Push API로 전달되는 단건 메시지
 * - NotificationSubscription: 사용자 계정 × 기기 × 미팅 단위의 구독
 * - AttendanceNudge: 미응답자 독촉 푸시 (자동 1회 + 수동 1회)
 * - PushSubscriptionEndpoint: 브라우저가 발급하는 Web Push 수신 주소
 * - InstallFlag: 해당 기기에서 PWA 설치 완료를 나타내는 서버 플래그
 */

// ── Browser Push Subscription (Web Push API) ──
export type BrowserPushSubscription = {
    endpoint: string;
    expirationTime: number | null;
    keys: {
        auth: string;
        p256dh: string;
    };
};

// ── Request/Response Types ──

/**
 * POST /api/meetings/:meetingId/push-subscriptions
 *
 * 사용자가 해당 미팅의 PushNotification을 받기 위해 브라우저 구독 정보와
 * 기기 정보를 함께 등록한다.
 */
export type RegisterPushSubscriptionRequest = {
    /**
     * 브라우저 PushSubscription 객체를 JSON으로 직렬화한 값.
     * ServiceWorkerRegistration.pushManager.subscribe() 결과.
     */
    pushSubscription: BrowserPushSubscription;

    /**
     * 기기를 식별하는 일관된 ID.
     * 예: UUID, 브라우저 생성 deviceId, 또는 user-agent 해시
     * 같은 사용자가 다른 브라우저/기기에서 등록 시 다른 deviceId여야 함
     */
    deviceId: string;

    /**
     * PWA가 display-mode=standalone으로 실행 중인지 여부.
     * 이 값이 false면 설치 완료 조건을 만족하지 않음.
     */
    isStandalone: boolean;

    /**
     * 현재 Notification.permission 상태.
     * "granted" | "denied" | "default"
     */
    notificationPermissionStatus: NotificationPermission;
};

export type RegisterPushSubscriptionResponse = {
    subscriptionId: string;
    meetingId: number;
    userId: string;
    /**
     * 이번 요청에서 InstallFlag가 새로 생성되었는지 여부.
     * true = 처음 설치, false = 기존 기기 업데이트
     */
    installFlagCreated: boolean;
    registeredAt: string; // ISO datetime
};

export type SubscriptionErrorCode =
    | "pwа_installation_required"
    | "notification_permission_required"
    | "re_login_required"
    | "validation_error"
    | "meeting_not_found";

export type SubscriptionErrorResponse = {
    error: SubscriptionErrorCode;
    message: string;
    /**
     * 클라이언트가 취해야 할 다음 액션
     * - "install": PWA 설치 안내
     * - "grant-permission": 알림 권한 요청 안내
     * - "re-login": 재로그인 안내
     * - "refresh-status": 상태 새로고침 유도
     */
    requiredAction?:
        | "install"
        | "grant-permission"
        | "re-login"
        | "refresh-status";
};

/**
 * GET /api/meetings/:meetingId/push-subscriptions/status
 */
export type PushSubscriptionStatus = {
    meetingId: number;
    userId: string;
    deviceId: string;

    // 현재 구독 상태
    isSubscribed: boolean;

    // 성공 조건 확인
    isStandalone: boolean;
    notificationPermissionStatus: NotificationPermission;

    // 서버 상태
    installFlagStatus: "active" | "disabled" | "expired";
    pushEndpointStatus: "active" | "sending-suppressed" | "invalid";

    lastVerifiedAt: string; // ISO datetime
    lastNudgeAt: string | null; // ISO datetime or null
};

/**
 * POST /api/meetings/:meetingId/attendance-nudges
 */
export type SendAttendanceNudgeRequest = {
    /**
     * 기본 독촉 템플릿 대신 사용할 메시지 (선택).
     * 생략 시 서버 기본 템플릿 사용.
     */
    messageOverride?: string;
};

export type SendAttendanceNudgeResponse = {
    nudgeId: string; // 독촉 발송 작업 ID
    meetingId: number;
    targetCount: number; // 발송 대상 인원
    queuedAt: string; // ISO datetime
};

/**
 * POST /api/meetings/:meetingId/push-test-send
 */
export type SendTestPushRequest = {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
};

export type SendTestPushResult = {
    deviceId: string;
    success: boolean;
    error?: string;
};

export type SendTestPushResponse = {
    meetingId: number;
    sentCount: number;
    failCount: number;
    triggeredAt: string; // ISO datetime
    results: SendTestPushResult[];
};

// ── Domain State Types ──

/**
 * 사용자 단위로 구독 상태를 표현.
 * 이것은 BFF 캐시용이거나 UI 상태로 사용될 수 있다.
 */
export type NotificationSubscriptionState = {
    subscriptionId: string;
    meetingId: number;
    userId: string;
    deviceId: string;

    // 성공 조건
    isStandalone: boolean;
    notificationPermissionStatus: NotificationPermission;

    // 서버 상태
    installFlagStatus: "active" | "disabled" | "expired";

    // 메타
    registeredAt: string; // ISO datetime
    lastVerifiedAt: string | null; // ISO datetime
};

// ── Utility Types ──

/**
 * BFF에서 브라우저 컨텍스트 검증 결과.
 * 성공하면 RegisterPushSubscriptionRequest로 변환해 Core API로 전달.
 */
export type BrowserContextValidation = {
    isValid: boolean;
    errors: string[];
    context?: {
        isStandalone: boolean;
        notificationPermissionStatus: NotificationPermission;
        deviceId: string;
    };
};

/**
 * 비동기 푸시 발송 작업 상태.
 * 롤아웃 단계에서 지표 추적용.
 */
export type PushDeliveryEvent =
    | {
          type: "queued";
          nudgeId: string;
          targetCount: number;
          timestamp: string;
      }
    | {
          type: "sent";
          nudgeId: string;
          successCount: number;
          failureCount: number;
          timestamp: string;
      }
    | {
          type: "failed";
          nudgeId: string;
          reason: string;
          timestamp: string;
      };
