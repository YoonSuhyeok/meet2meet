import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationRoutes } from "./notification";

const env = {
    JWT_SECRET: "test-jwt-secret",
    CORE_API_URL: "http://localhost:8080",
};

function buildApp() {
    const app = new Hono();
    app.route("/api/meetings", notificationRoutes);
    return app;
}

function makeToken(sub = "user-1") {
    const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64");
    const payload = Buffer.from(JSON.stringify({ sub })).toString("base64");
    return `${header}.${payload}.signature`;
}

function parseRequestBody(init: RequestInit): unknown {
    if (!init.body) return null;
    if (typeof init.body === "string") return JSON.parse(init.body);

    if (init.body instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(init.body);
        return JSON.parse(text);
    }

    if (ArrayBuffer.isView(init.body)) {
        const text = new TextDecoder().decode(init.body);
        return JSON.parse(text);
    }

    return null;
}

describe("notificationRoutes (BFF contract)", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, "fetch");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("push-subscriptions", () => {
        it("POST: 토큰 없으면 401, 업스트림 호출 없음", async () => {
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/push-subscriptions",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                },
                env,
            );

            expect(res.status).toBe(401);
            expect(await res.json()).toEqual({
                error: "unauthorized",
                message: "로그인이 필요합니다",
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("POST: bearer 인증 시 X-User-Id, body를 업스트림에 그대로 forward", async () => {
            const upstreamResponse = {
                subscriptionId: "sub-1",
                meetingId: 123,
                userId: "user-42",
                installFlagCreated: true,
                registeredAt: "2026-05-02T12:00:00Z",
            };
            fetchSpy.mockResolvedValue(
                new Response(JSON.stringify(upstreamResponse), {
                    status: 201,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const token = makeToken("user-42");
            const requestBody = {
                pushSubscription: {
                    endpoint: "https://push.example/sub-1",
                    expirationTime: null,
                    keys: { auth: "auth-key", p256dh: "p256dh-key" },
                },
                deviceId: "device-1",
                isStandalone: true,
                notificationPermissionStatus: "granted" as const,
            };

            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/push-subscriptions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                },
                env,
            );

            expect(res.status).toBe(201);
            expect(await res.json()).toEqual(upstreamResponse);
            expect(fetchSpy).toHaveBeenCalledOnce();

            const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                `${env.CORE_API_URL}/meetings/123/push-subscriptions`,
            );
            expect(init.method).toBe("POST");

            const headers = new Headers(init.headers);
            expect(headers.get("X-User-Id")).toBe("user-42");
            expect(headers.get("Content-Type")).toBe("application/json");
            expect(headers.get("Authorization")).toBeNull();

            expect(parseRequestBody(init)).toEqual(requestBody);
        });

        it("GET status: Cookie 인증으로도 X-User-Id가 전달된다", async () => {
            const upstreamStatus = {
                meetingId: 123,
                userId: "cookie-user",
                deviceId: "device-1",
                isSubscribed: true,
                isStandalone: true,
                notificationPermissionStatus: "granted",
                installFlagStatus: "active",
                pushEndpointStatus: "active",
                lastVerifiedAt: "2026-05-02T12:00:00Z",
                lastNudgeAt: null,
            };

            fetchSpy.mockResolvedValue(
                new Response(JSON.stringify(upstreamStatus), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const token = makeToken("cookie-user");
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/push-subscriptions/status",
                {
                    headers: {
                        Cookie: `meet2meet_auth=${token}`,
                    },
                },
                env,
            );

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(upstreamStatus);

            const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                `${env.CORE_API_URL}/meetings/123/push-subscriptions/status`,
            );
            expect(init.method).toBe("GET");

            const headers = new Headers(init.headers);
            expect(headers.get("X-User-Id")).toBe("cookie-user");
        });

        it("POST: standalone/permission 미충족이면 400 + requiredAction 반환 (업스트림 호출 없음)", async () => {
            const token = makeToken("user-1");
            const app = buildApp();

            const res = await app.request(
                "/api/meetings/123/push-subscriptions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        pushSubscription: {
                            endpoint: "https://push.example/sub-2",
                            expirationTime: null,
                            keys: { auth: "a", p256dh: "b" },
                        },
                        deviceId: "device-2",
                        isStandalone: false,
                        notificationPermissionStatus: "default",
                    }),
                },
                env,
            );

            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({
                error: "pwа_installation_required",
                message: "푸시 알림을 받기 위한 조건이 충족되지 않았습니다",
                requiredAction: "install",
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("GET status: 업스트림 에러 응답을 status/body 그대로 매핑", async () => {
            fetchSpy.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        error: "meeting_not_found",
                        message: "회의를 찾을 수 없습니다",
                        requiredAction: "refresh-status",
                    }),
                    {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );

            const token = makeToken("user-1");
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/999/push-subscriptions/status",
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
                env,
            );

            expect(res.status).toBe(404);
            expect(await res.json()).toEqual({
                error: "meeting_not_found",
                message: "회의를 찾을 수 없습니다",
                requiredAction: "refresh-status",
            });
        });
    });

    describe("attendance-nudges", () => {
        it("POST: 토큰 없으면 401, 업스트림 호출 없음", async () => {
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/attendance-nudges",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messageOverride: "응답 부탁드려요",
                    }),
                },
                env,
            );

            expect(res.status).toBe(401);
            expect(await res.json()).toEqual({
                error: "unauthorized",
                message: "로그인이 필요합니다",
            });
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("POST: 요청 body를 forward하고 202 Accepted 응답 shape를 보존", async () => {
            const upstreamResponse = {
                nudgeId: "nudge-1",
                meetingId: 123,
                targetCount: 5,
                queuedAt: "2026-05-02T13:00:00Z",
            };
            fetchSpy.mockResolvedValue(
                new Response(JSON.stringify(upstreamResponse), {
                    status: 202,
                    headers: { "Content-Type": "application/json" },
                }),
            );

            const token = makeToken("host-1");
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/attendance-nudges",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        messageOverride: "최종 확정 부탁드려요",
                    }),
                },
                env,
            );

            expect(res.status).toBe(202);
            expect(await res.json()).toEqual(upstreamResponse);

            const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe(
                `${env.CORE_API_URL}/meetings/123/attendance-nudges`,
            );
            expect(init.method).toBe("POST");

            const headers = new Headers(init.headers);
            expect(headers.get("X-User-Id")).toBe("host-1");
            expect(headers.get("Content-Type")).toBe("application/json");
            expect(parseRequestBody(init)).toEqual({
                messageOverride: "최종 확정 부탁드려요",
            });
        });

        it("POST: 업스트림 정책 거부(409) 응답을 그대로 매핑", async () => {
            fetchSpy.mockResolvedValue(
                new Response(
                    JSON.stringify({
                        error: "manual_nudge_limit_exceeded",
                        message: "이미 수동 독촉을 발송했습니다",
                    }),
                    {
                        status: 409,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );

            const token = makeToken("host-1");
            const app = buildApp();
            const res = await app.request(
                "/api/meetings/123/attendance-nudges",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({}),
                },
                env,
            );

            expect(res.status).toBe(409);
            expect(await res.json()).toEqual({
                error: "manual_nudge_limit_exceeded",
                message: "이미 수동 독촉을 발송했습니다",
            });
        });
    });
});
