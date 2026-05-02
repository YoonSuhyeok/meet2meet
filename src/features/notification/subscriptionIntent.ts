const SUBSCRIPTION_INTENT_KEY = "meet2meet:notification-subscription-intent";
const MAX_AGE_MS = 1000 * 60 * 30;

type SubscriptionIntentPayload = {
    meetingId: string;
    createdAt: number;
};

function canUseStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
}

export function saveSubscriptionIntent(meetingId: string) {
    if (!canUseStorage()) return;
    if (!meetingId) return;

    const payload: SubscriptionIntentPayload = {
        meetingId,
        createdAt: Date.now(),
    };
    window.localStorage.setItem(SUBSCRIPTION_INTENT_KEY, JSON.stringify(payload));
}

export function consumeSubscriptionIntent(meetingId: string): boolean {
    if (!canUseStorage()) return false;

    const raw = window.localStorage.getItem(SUBSCRIPTION_INTENT_KEY);
    window.localStorage.removeItem(SUBSCRIPTION_INTENT_KEY);
    if (!raw) return false;

    try {
        const payload = JSON.parse(raw) as SubscriptionIntentPayload;
        if (!payload.meetingId) return false;
        if (Date.now() - payload.createdAt > MAX_AGE_MS) return false;
        return payload.meetingId === meetingId;
    } catch {
        return false;
    }
}
