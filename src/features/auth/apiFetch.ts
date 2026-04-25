import { clearStoredAuthToken, createAuthHeaders, getStoredAuthToken } from "./token";

/**
 * JWT exp 클레임을 디코딩해서 만료 여부를 확인합니다.
 * - 토큰이 없거나 형식이 잘못된 경우 true 반환 (만료 취급)
 * - 60초 leeway: 시계 차이를 감안해 60초 이내 만료 직전이면 만료로 판정
 */
export function isStoredTokenExpired(leewaySeconds = 60): boolean {
    const token = getStoredAuthToken();
    if (!token) return true;

    const parts = token.split(".");
    if (parts.length !== 3) return true;

    try {
        const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadJson) as { exp?: number };
        if (typeof payload.exp !== "number") return true;
        const nowSec = Math.floor(Date.now() / 1000);
        return payload.exp - leewaySeconds <= nowSec;
    } catch {
        return true;
    }
}

/**
 * 인증 헤더를 자동으로 첨부하고 401/만료 시 자동 로그아웃을 처리하는 fetch 래퍼.
 *
 * - 요청 직전에 토큰 만료를 확인해 만료된 경우 즉시 로그인 페이지로 이동
 * - 응답 401일 때도 동일하게 처리
 * - 그 외 응답은 그대로 반환 (호출 측에서 본문 파싱/에러 처리)
 */
export async function apiFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    if (getStoredAuthToken() && isStoredTokenExpired()) {
        forceLogout("session_expired");
        // 리다이렉트 직전에도 호출 측에서 안전하게 처리할 수 있도록 빈 401 반환
        return new Response(null, { status: 401 });
    }

    const headers = createAuthHeaders(init.headers);
    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
        forceLogout("session_expired");
    }

    return response;
}

function forceLogout(errorCode: string) {
    if (typeof window === "undefined") return;
    clearStoredAuthToken();
    // 무한 리다이렉트 방지: 이미 /login 위에 있으면 아무 것도 하지 않음
    if (window.location.pathname.startsWith("/login")) return;
    window.location.href = `/login?error=${encodeURIComponent(errorCode)}`;
}
