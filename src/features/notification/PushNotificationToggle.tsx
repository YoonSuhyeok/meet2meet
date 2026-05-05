import { useEffect, useState } from "react";
import type {
    PushSubscriptionStatus,
    SubscriptionErrorResponse,
} from "@/src/types/notification";
import { apiFetch } from "@/src/features/auth";
import {
    consumeSubscriptionIntent,
    saveSubscriptionIntent,
} from "@/src/features/notification/subscriptionIntent";
import {
    buildRegisterRequest,
    getToggleNotice,
    resolveSubscriptionErrorMessage,
} from "@/src/features/notification/toggleModel";
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

    // 초기화: 브라우저 context 확인
    useEffect(() => {
        setStatusLoaded(false);
        const isStandaloneMode =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as any).standalone === true;
        setIsStandalone(isStandaloneMode);

        if ("Notification" in window) {
            setPermissionStatus(
                Notification.permission as NotificationPermission,
            );
        }

        // 로그인 상태일 때만 서버에서 상태 조회
        if (isLoggedIn) {
            fetchSubscriptionStatus();
        } else {
            setStatusLoaded(true);
        }
    }, [isLoggedIn, meetingId]);

    /**
     * 서버에서 구독 상태 조회
     */
    async function fetchSubscriptionStatus() {
        try {
            const resp = await apiFetch(
                `/api/meetings/${meetingId}/push-subscriptions/status`,
                {},
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
    }

    useEffect(() => {
        if (!isLoggedIn) return;
        if (!statusLoaded) return;
        if (isSubscribed) return;

        const shouldReplay = consumeSubscriptionIntent(meetingId);
        if (shouldReplay) {
            void subscribe();
        }
    }, [isLoggedIn, statusLoaded, isSubscribed, meetingId]);

    /**
     * 토글 클릭 핸들러
     */
    async function handleToggle() {
        // 로그인 필요
        if (!isLoggedIn) {
            saveSubscriptionIntent(meetingId);
            onLoginRequired?.();
            return;
        }

        // 이미 구독 중이면 해지
        if (isSubscribed) {
            await unsubscribe();
        } else {
            // 아니면 구독
            await subscribe();
        }
    }

    /**
     * 구독 등록
     */
    async function subscribe() {
        setIsLoading(true);
        setError(null);

        try {
            // Standalone 모드 확인
            if (!isStandalone) {
                setError("PWA를 앱으로 설치한 후 사용 가능합니다");
                setIsLoading(false);
                return;
            }

            // 알림 권한 요청
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

            // Push subscription 생성
            let subscription: PushSubscription | null = null;
            const vapidPublicKey = getVapidPublicKey();
            if (!vapidPublicKey) {
                setError("VAPID 공개키가 설정되지 않았습니다. 관리자에게 문의해주세요.");
                setIsLoading(false);
                return;
            }
            try {
                const reg = await navigator.serviceWorker.ready;
                subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                });
            } catch (err) {
                console.error(
                    "[notification] pushManager.subscribe failed:",
                    err,
                );
                setError("알림 구독 등록에 실패했습니다");
                setIsLoading(false);
                return;
            }

            if (!subscription) {
                setError("Push subscription을 생성할 수 없습니다");
                setIsLoading(false);
                return;
            }

            // 서버에 구독 등록
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
    }

    /**
     * 구독 해지
     */
    async function unsubscribe() {
        setIsLoading(true);
        setError(null);

        try {
            const resp = await apiFetch(
                `/api/meetings/${meetingId}/push-subscriptions`,
                { method: "DELETE" },
            );

            if (resp.ok) {
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

/**
 * 간단한 device ID 생성 (localStorage 기반)
 */
function getDeviceId(): string {
    const key = "meet2meet_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
        id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        localStorage.setItem(key, id);
    }
    return id;
}

function getVapidPublicKey(): string | null {
    const value = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(normalized);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
