import { Hono } from "hono";
import { verify } from "hono/jwt";

type Bindings = {
    JWT_SECRET: string;
    /** Go Core API base URL (예: http://localhost:8080) */
    CORE_API_URL?: string;
};

type AuthPayload = {
    sub: string;
    name: string;
    email: string;
    profileImage: string;
    provider: string;
    exp: number;
};

const DEFAULT_CORE_API_URL = "http://localhost:8080";

export const meetingRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * `/api/meetings/*` 모든 요청을 Go Core API로 프록시.
 * - Authorization Bearer JWT를 BFF에서 검증
 * - 사용자 정보를 X-User-Id / X-User-Name 헤더로 전달
 * - 비인증이 허용되는 GET 엔드포인트(상세/공유/투표 조회)는 토큰이 없어도 통과
 */
meetingRoutes.all("/*", async (c) => {
    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;

    // ── 인증 처리 ──
    const authHeader = c.req.header("Authorization");
    let userId = "";
    let userName = "";

    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length).trim();
        try {
            const payload = (await verify(
                token,
                c.env.JWT_SECRET,
                "HS256",
            )) as AuthPayload;
            userId = payload.sub;
            userName = payload.name;
        } catch {
            // 토큰이 유효하지 않으면 401
            return c.json(
                { code: "unauthorized", message: "유효하지 않은 인증입니다." },
                401,
            );
        }
    }

    // 변경 작업이나 보호 엔드포인트는 인증 필수
    const method = c.req.method.toUpperCase();
    const isMutating = method !== "GET" && method !== "HEAD";
    if (isMutating && !userId) {
        return c.json(
            { code: "unauthorized", message: "로그인이 필요합니다." },
            401,
        );
    }

    // ── 업스트림 URL 빌드 ──
    const url = new URL(c.req.url);
    // /api/meetings 라우트로 마운트 → Go 쪽은 /meetings/...
    const upstreamPath = url.pathname.replace(/^\/api/, "");
    const upstreamUrl = `${coreBase.replace(/\/$/, "")}${upstreamPath}${url.search}`;

    // ── 요청 헤더 정리 ──
    const headers = new Headers();
    const contentType = c.req.header("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    const accept = c.req.header("Accept");
    if (accept) headers.set("Accept", accept);
    if (userId) headers.set("X-User-Id", userId);
    if (userName) headers.set("X-User-Name", userName);

    // ── 본문 (GET/HEAD 제외) ──
    let body: BodyInit | undefined;
    if (isMutating) {
        body = await c.req.raw.arrayBuffer();
    }

    // ── 프록시 호출 ──
    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, {
            method,
            headers,
            body,
        });
    } catch (err) {
        console.error("[meetings proxy] upstream fetch failed:", err);
        return c.json(
            {
                code: "upstream_unreachable",
                message: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
            },
            502,
        );
    }

    // ── 응답 패스스루 ──
    const responseHeaders = new Headers();
    const upstreamContentType = upstream.headers.get("Content-Type");
    if (upstreamContentType) {
        responseHeaders.set("Content-Type", upstreamContentType);
    }

    return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
    });
});
