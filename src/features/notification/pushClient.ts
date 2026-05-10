type IOSNavigator = Navigator & {
    standalone?: boolean;
};

const DEVICE_ID_STORAGE_KEY = "meet2meet_device_id";

export function detectStandaloneMode(): boolean {
    if (typeof window === "undefined") return false;

    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as IOSNavigator).standalone === true
    );
}

export function getNotificationPermissionStatus(): NotificationPermission | null {
    if (typeof window === "undefined") return null;
    if (!("Notification" in window)) return null;

    return Notification.permission as NotificationPermission;
}

export function supportsWebPush(): boolean {
    if (typeof window === "undefined") return false;

    return (
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window
    );
}

export function getDeviceId(): string {
    if (typeof window === "undefined") return "";

    const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored) return stored;

    const nextId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? `device_${crypto.randomUUID()}`
            : `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);
    return nextId;
}

export function getVapidPublicKey(): string | null {
    const value = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
    if (!("serviceWorker" in navigator)) {
        throw new Error("service_worker_unsupported");
    }

    const existingRegistration =
        await navigator.serviceWorker.getRegistration();
    if (existingRegistration) {
        return existingRegistration;
    }

    await navigator.serviceWorker.register("/sw.js");
    return navigator.serviceWorker.ready;
}

export async function getOrCreatePushSubscription(
    vapidPublicKey: string,
): Promise<PushSubscription> {
    if (!supportsWebPush()) {
        throw new Error("web_push_unsupported");
    }

    const registration = await getPushRegistration();
    const existingSubscription =
        await registration.pushManager.getSubscription();
    if (existingSubscription) {
        return existingSubscription;
    }

    return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
            vapidPublicKey,
        ) as BufferSource,
    });
}

export async function unsubscribePushSubscription(): Promise<void> {
    if (!("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await subscription.unsubscribe();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = atob(normalized);
    const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
    for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
