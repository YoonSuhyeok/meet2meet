const POST_LOGIN_REDIRECT_KEY = "meet2meet:post-login-redirect";

type PostLoginRedirectPayload = {
    path: string;
    createdAt: number;
};

const MAX_AGE_MS = 1000 * 60 * 30;

function canUseStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
}

export function savePostLoginRedirect(path: string) {
    if (!canUseStorage()) return;
    if (!path.startsWith("/")) return;

    const payload: PostLoginRedirectPayload = {
        path,
        createdAt: Date.now(),
    };

    window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, JSON.stringify(payload));
}

export function consumePostLoginRedirect(): string | null {
    if (!canUseStorage()) return null;

    const raw = window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    window.localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (!raw) return null;

    try {
        const payload = JSON.parse(raw) as PostLoginRedirectPayload;
        if (!payload.path?.startsWith("/")) return null;
        if (Date.now() - payload.createdAt > MAX_AGE_MS) return null;
        return payload.path;
    } catch {
        return null;
    }
}
