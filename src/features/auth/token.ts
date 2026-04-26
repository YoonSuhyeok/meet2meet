export function getStoredAuthToken() {
    // HttpOnly 쿠키는 JS에서 읽을 수 없음
    return null;
}

export function setStoredAuthToken(token: string) {
    void token;
}

export function clearStoredAuthToken() {
    // 쿠키 삭제는 서버 /api/auth/logout에서 처리
}

export function createAuthHeaders(init?: HeadersInit): Headers {
    return new Headers(init);
}
