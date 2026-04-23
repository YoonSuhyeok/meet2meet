const AUTH_TOKEN_KEY = "meet2meet.auth.token";

export function getStoredAuthToken() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredAuthToken(token: string) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken() {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function createAuthHeaders(init?: HeadersInit): Headers {
    const headers = new Headers(init);
    const token = getStoredAuthToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
}
