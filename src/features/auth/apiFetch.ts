/**
 * 쿠키 기반 세션을 사용하는 fetch 래퍼.
 *
 * - HttpOnly 쿠키는 JS에서 읽을 수 없으므로, 만료 판단은 서버 401 응답으로 처리
 * - 응답 401일 때 세션 정리 API 호출 후 로그인 페이지로 이동
 * - 그 외 응답은 그대로 반환 (호출 측에서 본문 파싱/에러 처리)
 */
export async function apiFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const response = await fetch(input, {
        ...init,
        credentials: init.credentials ?? "same-origin",
    });

    if (response.status === 401) {
        forceLogout("session_expired");
    }

    return response;
}

function forceLogout(errorCode: string) {
    if (typeof window === "undefined") return;
    void fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
    }).catch(() => null);

    // 무한 리다이렉트 방지: 이미 /login 위에 있으면 아무 것도 하지 않음
    if (window.location.pathname.startsWith("/login")) return;
    window.location.href = `/login?error=${encodeURIComponent(errorCode)}`;
}
