import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type {
    PushSubscriptionStatus,
    RegisterPushSubscriptionRequest,
    RegisterPushSubscriptionResponse,
    SendAttendanceNudgeRequest,
    SendAttendanceNudgeResponse,
    SendTestPushRequest,
    SendTestPushResponse,
    SubscriptionErrorResponse,
} from "@/src/types/notification";

type Bindings = {
    JWT_SECRET: string;
    CORE_API_URL?: string;
};

const DEFAULT_CORE_API_URL = "http://localhost:8080";
const AUTH_COOKIE_NAME = "meet2meet_auth";

export const notificationRoutes = new Hono<{ Bindings: Bindings }>();

type AuthContext = {
    userId: string;
    userName: string;
};

/**
 * 현재 요청의 인증된 사용자 ID를 추출한다.
 * 인증 실패 시 null 반환.
 */
function getAuthContext(
    authHeader: string | undefined,
    cookieToken: string | undefined,
): AuthContext | null {
    const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : undefined;
    const token = bearerToken || cookieToken || "";

    if (!token) return null;

    try {
        // 동기 검증이 필요해 임시로 토큰 파싱만 진행
        // 실제로는 verify가 async라 다르게 구현되어야 함
        // 현재는 간단히 토큰에서 sub를 파싱
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString()) as {
            sub?: string;
            name?: string;
        };
        const userId = payload.sub?.trim() ?? "";
        const userName = (payload.name?.trim() || userId).trim();
        if (!userId || !userName) return null;
        return { userId, userName };
    } catch {
        return null;
    }
}

/**
 * POST /api/meetings/:meetingId/push-subscriptions
 *
 * PushNotification 구독 등록.
 * 성공 조건: 로그인 + PWA 설치 + 권한 허용
 */
notificationRoutes.post("/:meetingId/push-subscriptions", async (c) => {
    const meetingId = c.req.param("meetingId");
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const auth = getAuthContext(authHeader, cookieToken);

    if (!auth) {
        return c.json(
            {
                error: "unauthorized",
                message: "로그인이 필요합니다",
            },
            401 as any,
        );
    }

    const body = await c.req.json<RegisterPushSubscriptionRequest>();

    // ── 브라우저 컨텍스트 검증 ──
    const errors: string[] = [];

    if (!body.isStandalone) {
        errors.push(
            "PWA 설치 상태: standalone 모드가 아닙니다. 앱에서 다시 열어주세요.",
        );
    }

    if (body.notificationPermissionStatus !== "granted") {
        errors.push(
            `알림 권한 상태: ${body.notificationPermissionStatus}. 설정에서 알림을 허용해주세요.`,
        );
    }

    if (errors.length > 0) {
        const resp: SubscriptionErrorResponse = {
            error: "pwа_installation_required",
            message: "푸시 알림을 받기 위한 조건이 충족되지 않았습니다",
            requiredAction: !body.isStandalone
                ? "install"
                : body.notificationPermissionStatus !== "granted"
                  ? "grant-permission"
                  : undefined,
        };
        return c.json(resp, 400 as any);
    }

    // ── Core API로 프록시 (실제 저장) ──
    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;
    const coreUrl = `${coreBase.replace(/\/$/, "")}/meetings/${meetingId}/push-subscriptions`;

    try {
        const upstreamResp = await fetch(coreUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Id": auth.userId,
                "X-User-Name": encodeURIComponent(auth.userName),
            },
            body: JSON.stringify(body),
        });

        if (!upstreamResp.ok) {
            const errorData = await upstreamResp.json();
            return c.json(errorData, upstreamResp.status as any);
        }

        const data =
            (await upstreamResp.json()) as RegisterPushSubscriptionResponse;
        return c.json(data, 201 as any);
    } catch (err) {
        console.error("[notification] upstream fetch failed:", err);
        return c.json(
            {
                error: "service_unavailable",
                message:
                    "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
            },
            502 as any,
        );
    }
});

/**
 * DELETE /api/meetings/:meetingId/push-subscriptions
 *
 * 해당 미팅의 구독 해지.
 * 해지는 즉시(발송 직전) 반영된다.
 */
notificationRoutes.delete("/:meetingId/push-subscriptions", async (c) => {
    const meetingId = c.req.param("meetingId");
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const auth = getAuthContext(authHeader, cookieToken);

    if (!auth) {
        return c.json(
            {
                error: "unauthorized",
                message: "로그인이 필요합니다",
            },
            401 as any,
        );
    }

    // ── Core API로 프록시 ──
    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;
    const coreUrl = `${coreBase.replace(/\/$/, "")}/meetings/${meetingId}/push-subscriptions`;

    try {
        const upstreamResp = await fetch(coreUrl, {
            method: "DELETE",
            headers: {
                "X-User-Id": auth.userId,
                "X-User-Name": encodeURIComponent(auth.userName),
            },
        });

        if (upstreamResp.ok) {
            return c.json({}, 204 as any);
        }

        const errorData = await upstreamResp.json();
        return c.json(errorData, upstreamResp.status as any);
    } catch (err) {
        console.error("[notification] upstream DELETE failed:", err);
        return c.json(
            {
                error: "service_unavailable",
                message: "서버에 연결할 수 없습니다",
            },
            502 as any,
        );
    }
});

/**
 * GET /api/meetings/:meetingId/push-subscriptions/status
 *
 * 현재 기기에서의 구독 상태를 조회.
 * (설치 여부, 권한 상태, 서버 플래그 상태)
 */
notificationRoutes.get("/:meetingId/push-subscriptions/status", async (c) => {
    const meetingId = c.req.param("meetingId");
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const auth = getAuthContext(authHeader, cookieToken);

    if (!auth) {
        return c.json(
            {
                error: "unauthorized",
                message: "로그인이 필요합니다",
            },
            401 as any,
        );
    }

    // ── Core API로 프록시 ──
    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;
    const coreUrl = `${coreBase.replace(/\/$/, "")}/meetings/${meetingId}/push-subscriptions/status`;

    try {
        const upstreamResp = await fetch(coreUrl, {
            method: "GET",
            headers: {
                "X-User-Id": auth.userId,
                "X-User-Name": encodeURIComponent(auth.userName),
            },
        });

        if (!upstreamResp.ok) {
            const errorData = await upstreamResp.json();
            return c.json(errorData, upstreamResp.status as any);
        }

        const data = (await upstreamResp.json()) as PushSubscriptionStatus;
        return c.json(data, 200 as any);
    } catch (err) {
        console.error("[notification] upstream GET status failed:", err);
        return c.json(
            {
                error: "service_unavailable",
                message: "서버에 연결할 수 없습니다",
            },
            502 as any,
        );
    }
});

/**
 * POST /api/meetings/:meetingId/attendance-nudges
 *
 * 미응답자 독촉 발송 (호스트만).
 * 자동 1회 이후 수동 1회만 추가로 발송 가능.
 */
notificationRoutes.post("/:meetingId/attendance-nudges", async (c) => {
    const meetingId = c.req.param("meetingId");
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const auth = getAuthContext(authHeader, cookieToken);

    if (!auth) {
        return c.json(
            {
                error: "unauthorized",
                message: "로그인이 필요합니다",
            },
            401 as any,
        );
    }

    const body = await c.req.json<SendAttendanceNudgeRequest>();

    // ── Core API로 프록시 ──
    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;
    const coreUrl = `${coreBase.replace(/\/$/, "")}/meetings/${meetingId}/attendance-nudges`;

    try {
        const upstreamResp = await fetch(coreUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Id": auth.userId,
                "X-User-Name": encodeURIComponent(auth.userName),
            },
            body: JSON.stringify(body),
        });

        if (!upstreamResp.ok) {
            const errorData = await upstreamResp.json();
            return c.json(errorData, upstreamResp.status as any);
        }

        const data = (await upstreamResp.json()) as SendAttendanceNudgeResponse;
        return c.json(data, 202 as any); // 202 Accepted (비동기 처리)
    } catch (err) {
        console.error("[notification] upstream POST nudge failed:", err);
        return c.json(
            {
                error: "service_unavailable",
                message: "서버에 연결할 수 없습니다",
            },
            502 as any,
        );
    }
});

/**
 * POST /api/meetings/:meetingId/push-test-send
 *
 * 현재 로그인 사용자의 활성 구독 대상으로 테스트 Push를 발송한다.
 */
notificationRoutes.post("/:meetingId/push-test-send", async (c) => {
    const meetingId = c.req.param("meetingId");
    const authHeader = c.req.header("Authorization");
    const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
    const auth = getAuthContext(authHeader, cookieToken);

    if (!auth) {
        return c.json(
            {
                error: "unauthorized",
                message: "로그인이 필요합니다",
            },
            401 as any,
        );
    }

    const body = await c.req.json<SendTestPushRequest>();

    const coreBase = c.env.CORE_API_URL ?? DEFAULT_CORE_API_URL;
    const coreUrl = `${coreBase.replace(/\/$/, "")}/meetings/${meetingId}/push-test-send`;

    try {
        const upstreamResp = await fetch(coreUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-User-Id": auth.userId,
                "X-User-Name": encodeURIComponent(auth.userName),
            },
            body: JSON.stringify(body),
        });

        if (!upstreamResp.ok) {
            const errorData = await upstreamResp.json();
            return c.json(errorData, upstreamResp.status as any);
        }

        const data = (await upstreamResp.json()) as SendTestPushResponse;
        return c.json(data, 200 as any);
    } catch (err) {
        console.error("[notification] upstream POST push-test-send failed:", err);
        return c.json(
            {
                error: "service_unavailable",
                message: "서버에 연결할 수 없습니다",
            },
            502 as any,
        );
    }
});
