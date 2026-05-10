import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/src/features/auth";
import {
    detectStandaloneMode,
    getDeviceId,
    getNotificationPermissionStatus,
    getOrCreatePushSubscription,
    getVapidPublicKey,
    supportsWebPush,
    unsubscribePushSubscription,
} from "@/src/features/notification/pushClient";
import {
    consumeSubscriptionIntent,
    saveSubscriptionIntent,
} from "@/src/features/notification/subscriptionIntent";
import {
    buildRegisterRequest,
    getToggleNotice,
    resolveSubscriptionErrorMessage,
} from "@/src/features/notification/toggleModel";
import type {
    PushSubscriptionStatus,
    SubscriptionErrorResponse,
} from "@/src/types/notification";
import styles from "./PushNotificationToggle.module.css";

interface PushNotificationToggleProps {
    meetingId: string;
    /** 미팅 확정 여부 (true면 더 강조) */
    isFinalized?: boolean;
    /** 로그인 여부 */
    isLoggedIn?: boolean;
    /** 로그인 페이지로 리다이렉트하는 함수 */
    onLoginRequired?: () => void | Promise<void>;
    className?: string;
}

export function PushNotificationToggle({
    meetingId,
    isFinalized = false,
    isLoggedIn = false,
    onLoginRequired,
    className,
}: PushNotificationToggleProps) {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [permissionStatus, setPermissionStatus] =
        useState<NotificationPermission | null>(null);
    const [statusLoaded, setStatusLoaded] = useState(false);
    const notice = getToggleNotice({
        isLoggedIn,
        isStandalone,
        permissionStatus,
        isSubscribed,
    });

    const fetchSubscriptionStatus = useCallback(async () => {
        const deviceId = getDeviceId();
        try {
            const resp = await apiFetch(
                `/api/meetings/${meetingId}/push-subscriptions/status`,
                {
                    headers: {
                        "X-Device-Id": deviceId,
                    },
                },
                { onUnauthorized: "none" },
            );
            if (resp.ok) {
                const data = (await resp.json()) as PushSubscriptionStatus;
                setIsSubscribed(data.isSubscribed);
            } else if (resp.status !== 401) {
                setError("구독 상태를 불러오지 못했습니다");
            }
        } catch (err) {
            console.error(
                "[notification] fetchSubscriptionStatus failed:",
                err,
            );
        } finally {
            setStatusLoaded(true);
        }
    }, [meetingId]);

    const subscribe = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (!isStandalone) {
                setError("PWA를 앱으로 설치한 후 사용 가능합니다");
                setIsLoading(false);
                return;
            }

            if (!supportsWebPush()) {
                setError("이 브라우저에서는 푸시 알림을 지원하지 않습니다");
                setIsLoading(false);
                return;
            }

            let newPermStatus: NotificationPermission =
                permissionStatus ?? "default";
            if ("Notification" in window && permissionStatus !== "granted") {
                const result = await Notification.requestPermission();
                newPermStatus = result as NotificationPermission;
                setPermissionStatus(newPermStatus);

                if (result !== "granted") {
                    setError("알림 권한을 허용해주세요");
                    setIsLoading(false);
                    return;
                }
            }

            const vapidPublicKey = getVapidPublicKey();
            if (!vapidPublicKey) {
                setError(
                    "VAPID 공개키가 설정되지 않았습니다. 관리자에게 문의해주세요.",
                );
                setIsLoading(false);
                return;
            }

            let subscription: PushSubscription;
            try {
                subscription =
                    await getOrCreatePushSubscription(vapidPublicKey);
            } catch (err) {
                console.error(
                    "[notification] getOrCreatePushSubscription failed:",
                    err,
                );
                setError("알림 구독 등록에 실패했습니다");
                setIsLoading(false);
                return;
            }

            const req = buildRegisterRequest({
                isStandalone,
                permissionStatus: newPermStatus,
                subscription,
                deviceId: getDeviceId(),
            });

            const resp = await apiFetch(
                `/api/meetings/${meetingId}/push-subscriptions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(req),
                },
            );

            if (resp.ok) {
                setIsSubscribed(true);
            } else {
                const errorData =
                    (await resp.json()) as SubscriptionErrorResponse;
                setError(resolveSubscriptionErrorMessage(errorData));
            }
        } catch (err) {
            console.error("[notification] subscribe failed:", err);
            setError("서버 오류로 구독할 수 없습니다");
        } finally {
            setIsLoading(false);
        }
    }, [isStandalone, meetingId, permissionStatus]);

    const unsubscribe = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const deviceId = getDeviceId();
            const resp = await apiFetch(
                `/api/meetings/${meetingId}/push-subscriptions`,
                {
                    method: "DELETE",
                    headers: {
                        "X-Device-Id": deviceId,
                    },
                },
            );

            if (resp.ok) {
                try {
                    await unsubscribePushSubscription();
                } catch (err) {
                    console.error(
                        "[notification] unsubscribePushSubscription failed:",
                        err,
                    );
                }
                setIsSubscribed(false);
            } else {
                setError("구독 해지 실패");
            }
        } catch (err) {
            console.error("[notification] unsubscribe failed:", err);
            setError("서버 오류로 구독 해지할 수 없습니다");
        } finally {
            setIsLoading(false);
        }
    }, [meetingId]);

    useEffect(() => {
        setStatusLoaded(false);
        setIsStandalone(detectStandaloneMode());
        setPermissionStatus(getNotificationPermissionStatus());

        if (isLoggedIn) {
            void fetchSubscriptionStatus();
        } else {
            setStatusLoaded(true);
        }
    }, [fetchSubscriptionStatus, isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;
        if (!statusLoaded) return;
        if (isSubscribed) return;

        const shouldReplay = consumeSubscriptionIntent(meetingId);
        if (shouldReplay) {
            void subscribe();
        }
    }, [isLoggedIn, isSubscribed, meetingId, statusLoaded, subscribe]);

    async function handleToggle() {
        if (!isLoggedIn) {
            saveSubscriptionIntent(meetingId);
            onLoginRequired?.();
            return;
        }

        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
    }

    return (
        <div
            className={`${styles.container} ${isFinalized ? styles.emphasized : ""} ${className ?? ""}`}
        >
            <button
                type="button"
                className={`${styles.toggle} ${isSubscribed ? styles.active : ""}`}
                onClick={handleToggle}
                disabled={isLoading}
                aria-pressed={isSubscribed}
                title={
                    !isLoggedIn
                        ? "로그인 필요"
                        : !isStandalone
                          ? "PWA 앱 설치 필요"
                          : permissionStatus !== "granted"
                            ? "알림 권한 필요"
                            : isSubscribed
                              ? "알림 받지 않음"
                              : "알림 받음"
                }
            >
                <span className={styles.icon}>
                    {isSubscribed ? "🔔" : "🔕"}
                </span>
                <span className={styles.label}>
                    {isLoggedIn
                        ? isSubscribed
                            ? "알림 받는 중"
                            : "이 미팅 알림 받기"
                        : "로그인 후 알림 설정"}
                </span>
            </button>

            {error && <div className={styles.error}>{error}</div>}

            {notice && <div className={styles.notice}>{notice}</div>}
        </div>
    );
}
