import type {
    BrowserPushSubscription,
    RegisterPushSubscriptionRequest,
    SubscriptionErrorResponse,
} from "@/src/types/notification";

type ToggleNoticeInput = {
    isLoggedIn: boolean;
    isStandalone: boolean;
    permissionStatus: NotificationPermission | null;
    isSubscribed: boolean;
};

export function getToggleNotice(input: ToggleNoticeInput): string | null {
    if (input.isSubscribed) return null;
    if (!input.isLoggedIn) {
        return "로그인하면 이 미팅의 일정 변경, 미팅 시작 알림을 받을 수 있습니다.";
    }
    if (!input.isStandalone) {
        return "PWA를 홈 화면에 추가하면 알림을 받을 수 있습니다.";
    }
    if (input.permissionStatus !== "granted") {
        return "설정에서 알림을 허용하면 실시간 알림을 받을 수 있습니다.";
    }
    return null;
}

export function resolveSubscriptionErrorMessage(
    errorData: SubscriptionErrorResponse | null,
): string {
    if (!errorData) return "구독 등록 실패";
    switch (errorData.requiredAction) {
        case "install":
            return "PWA를 앱으로 설치한 뒤 다시 시도해주세요";
        case "grant-permission":
            return "브라우저 설정에서 알림 권한을 허용해주세요";
        case "re-login":
            return "세션이 만료되었습니다. 다시 로그인해주세요";
        case "refresh-status":
            return "상태를 새로고침한 뒤 다시 시도해주세요";
        default:
            return errorData.message || "구독 등록 실패";
    }
}

function toBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function serializePushSubscription(
    subscription: PushSubscription,
): BrowserPushSubscription {
    const auth = subscription.getKey("auth");
    const p256dh = subscription.getKey("p256dh");

    return {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
            auth: auth ? toBase64(auth) : "",
            p256dh: p256dh ? toBase64(p256dh) : "",
        },
    };
}

type BuildRegisterRequestInput = {
    isStandalone: boolean;
    permissionStatus: NotificationPermission;
    subscription: PushSubscription;
    deviceId: string;
};

export function buildRegisterRequest(
    input: BuildRegisterRequestInput,
): RegisterPushSubscriptionRequest {
    return {
        isStandalone: input.isStandalone,
        notificationPermissionStatus: input.permissionStatus,
        pushSubscription: serializePushSubscription(input.subscription),
        deviceId: input.deviceId,
    };
}
