import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { logger } from "hono/logger";

type Bindings = {
    JWT_SECRET: string;
    BASE_URL: string;
    TEST_LOGIN_ENABLED?: string;
    NAVER_CLIENT_ID: string;
    NAVER_CLIENT_SECRET: string;
    KAKAO_CLIENT_ID: string;
    KAKAO_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
};

type AuthProvider = Provider | "test";

type AuthPayload = {
    sub: string;
    name: string;
    email: string;
    profileImage: string;
    provider: AuthProvider;
    exp: number;
};

const PROVIDERS = {
    naver: {
        authUrl: "https://nid.naver.com/oauth2.0/authorize",
        tokenUrl: "https://nid.naver.com/oauth2.0/token",
        userInfoUrl: "https://openapi.naver.com/v1/nid/me",
        scope: "name,email,profile_image",
    },
    kakao: {
        authUrl: "https://kauth.kakao.com/oauth/authorize",
        tokenUrl: "https://kauth.kakao.com/oauth/token",
        userInfoUrl: "https://kapi.kakao.com/v2/user/me",
        scope: "profile_nickname",
    },
    google: {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
        scope: "openid email profile",
    },
} as const;

type Provider = keyof typeof PROVIDERS;

const TEST_USERS = {
    host: {
        id: "test-host-1",
        name: "테스트 호스트",
        email: "host@meet2meet.test",
        profileImage: "",
    },
    participant1: {
        id: "test-participant-1",
        name: "테스트 참가자 1",
        email: "participant1@meet2meet.test",
        profileImage: "",
    },
    participant2: {
        id: "test-participant-2",
        name: "테스트 참가자 2",
        email: "participant2@meet2meet.test",
        profileImage: "",
    },
} as const;

type TestAccount = keyof typeof TEST_USERS;

const AUTH_COOKIE_NAME = "meet2meet_auth";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_COOKIE_PREFIX = "meet2meet_oauth_state_";
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const authRoutes = new Hono<{ Bindings: Bindings }>();
authRoutes.use(logger());

authRoutes.post("/logout", (c) => {
    const baseUrl = resolveAuthBaseUrl(c);

    deleteCookie(c, AUTH_COOKIE_NAME, {
        path: "/",
        secure: isSecureCookie(baseUrl),
        sameSite: "Lax",
    });

    return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
    const token = getAuthToken(c);
    if (!token) {
        return c.json({ error: "unauthorized" }, 401);
    }

    try {
        const payload = (await verify(
            token,
            c.env.JWT_SECRET,
            "HS256",
        )) as AuthPayload;

        return c.json({
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            profileImage: payload.profileImage,
            provider: payload.provider,
        });
    } catch {
        return c.json({ error: "unauthorized" }, 401);
    }
});

authRoutes.get("/test-login", async (c) => {
    const baseUrl = resolveAuthBaseUrl(c);

    if (!isTestLoginEnabled(baseUrl, c.env.TEST_LOGIN_ENABLED)) {
        return c.redirect("/login?error=test_login_disabled");
    }

    const account = getTestAccount(c.req.query("account"));
    const user = TEST_USERS[account];
    const payload: AuthPayload = {
        sub: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        provider: "test",
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const appToken = await sign(payload, c.env.JWT_SECRET, "HS256");
    setCookie(c, AUTH_COOKIE_NAME, appToken, {
        path: "/",
        maxAge: TOKEN_TTL_SECONDS,
        httpOnly: true,
        secure: isSecureCookie(baseUrl),
        sameSite: "Lax",
    });

    return c.redirect(buildCallbackRedirect(baseUrl));
});

authRoutes.get("/:provider", async (c) => {
    const provider = c.req.param("provider") as Provider;
    const config = PROVIDERS[provider];
    if (!config) {
        return c.redirect("/login?error=auth_failed");
    }

    const state = generateOAuthState();
    const baseUrl = resolveAuthBaseUrl(c);

    const clientId = getOAuthClientId(c.env, provider);
    const callbackUrl = `${baseUrl}/api/auth/${provider}/callback`;

    // CSRF 방지를 위해 provider별 state를 HttpOnly 쿠키로 저장
    setCookie(c, getOAuthStateCookieName(provider), state, {
        path: "/",
        maxAge: OAUTH_STATE_TTL_SECONDS,
        httpOnly: true,
        secure: isSecureCookie(baseUrl),
        sameSite: "Lax",
    });

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        state,
        ...(config.scope ? { scope: config.scope } : {}),
    });

    console.log(`[auth] ${provider} 로그인 시작 → ${config.authUrl}`);
    return c.redirect(`${config.authUrl}?${params.toString()}`);
});

authRoutes.get("/:provider/callback", async (c) => {
    const provider = c.req.param("provider") as Provider;
    const config = PROVIDERS[provider];
    if (!config) {
        return c.redirect("/login?error=auth_failed");
    }

    const baseUrl = resolveAuthBaseUrl(c);

    const stateFromQuery = c.req.query("state") ?? "";
    const stateCookieName = getOAuthStateCookieName(provider);
    const stateFromCookie = getCookie(c, stateCookieName) ?? "";
    deleteCookie(c, stateCookieName, {
        path: "/",
        secure: isSecureCookie(baseUrl),
        sameSite: "Lax",
    });

    if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
        return c.redirect("/login?error=invalid_state");
    }

    const code = c.req.query("code");
    console.log(`[auth] ${provider} 콜백 수신, code=${code ? "있음" : "없음"}`);
    if (!code) {
        return c.redirect("/login?error=auth_failed");
    }

    const env = c.env;
    const clientId = getOAuthClientId(env, provider);
    const clientSecret = getOAuthClientSecret(env, provider);
    const callbackUrl = `${baseUrl}/api/auth/${provider}/callback`;

    let accessToken: string;
    try {
        const tokenRes = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: callbackUrl,
                code,
            }),
        });
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        accessToken = tokenData.access_token ?? "";
        console.log(
            `[auth] ${provider} 토큰 교환`,
            accessToken ? "성공" : "실패",
        );
        if (!accessToken) {
            return c.redirect("/login?error=token_exchange");
        }
    } catch (e) {
        console.error(`[auth] ${provider} 토큰 교환 실패:`, e);
        return c.redirect("/login?error=token_exchange");
    }

    let user: {
        id: string;
        name: string;
        email: string;
        profileImage: string;
    };
    try {
        const userRes = await fetch(config.userInfoUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const raw = await userRes.json();
        console.log(
            `[auth] ${provider} 사용자 정보 원본:`,
            JSON.stringify(raw),
        );
        user = normalizeUser(provider, raw);
        console.log(`[auth] ${provider} 정규화된 사용자:`, user);
    } catch (e) {
        console.error(`[auth] ${provider} 사용자 정보 조회 실패:`, e);
        return c.redirect("/login?error=user_info");
    }

    const payload: AuthPayload = {
        sub: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        provider,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };

    const appToken = await sign(payload, env.JWT_SECRET, "HS256");
    setCookie(c, AUTH_COOKIE_NAME, appToken, {
        path: "/",
        maxAge: TOKEN_TTL_SECONDS,
        httpOnly: true,
        secure: isSecureCookie(baseUrl),
        sameSite: "Lax",
    });

    return c.redirect(buildCallbackRedirect(baseUrl));
});

function buildCallbackRedirect(baseUrl: string) {
    return `${baseUrl}/auth/callback`;
}

function getOAuthStateCookieName(provider: Provider) {
    return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

function generateOAuthState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getAuthToken(c: Context<{ Bindings: Bindings }>) {
    const bearerToken = getBearerToken(c.req.header("Authorization"));
    if (bearerToken) {
        return bearerToken;
    }

    return getCookie(c, AUTH_COOKIE_NAME) ?? null;
}

function getBearerToken(authorizationHeader?: string) {
    if (!authorizationHeader?.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice("Bearer ".length).trim() || null;
}

function getOAuthClientId(env: Bindings, provider: Provider): string {
    switch (provider) {
        case "naver":
            return env.NAVER_CLIENT_ID;
        case "kakao":
            return env.KAKAO_CLIENT_ID;
        case "google":
            return env.GOOGLE_CLIENT_ID;
    }
}

function getOAuthClientSecret(env: Bindings, provider: Provider): string {
    switch (provider) {
        case "naver":
            return env.NAVER_CLIENT_SECRET;
        case "kakao":
            return env.KAKAO_CLIENT_SECRET;
        case "google":
            return env.GOOGLE_CLIENT_SECRET;
    }
}

function resolveAuthBaseUrl(c: Context<{ Bindings: Bindings }>): string {
    const configured = c.env.BASE_URL?.trim();
    let requestUrl: URL | null = null;

    try {
        requestUrl = new URL(c.req.url);
    } catch {
        requestUrl = null;
    }

    if (!configured) {
        return requestUrl?.origin ?? "http://localhost:3000";
    }

    if (!requestUrl) {
        return configured;
    }

    try {
        const configuredUrl = new URL(configured);
        const requestHost = requestUrl.hostname;
        const configuredHost = configuredUrl.hostname;

        // BASE_URL이 localhost로 설정된 개발 환경에서는
        // 사설망/다른 호스트 또는 명시적으로 다른 포트로 접근한 경우 요청 origin을 사용한다.
        if (isLocalHostName(configuredHost) && isDevRequestHost(requestHost)) {
            if (requestHost !== configuredHost) {
                return requestUrl.origin;
            }

            if (requestUrl.port && requestUrl.port !== configuredUrl.port) {
                return requestUrl.origin;
            }
        }
    } catch {
        return configured;
    }

    return configured;
}

function isLocalHostName(hostname: string): boolean {
    return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname === "[::1]"
    );
}

function isPrivateIpv4Host(hostname: string): boolean {
    const segments = hostname.split(".");
    if (segments.length !== 4) {
        return false;
    }

    const octets = segments.map((segment) => Number(segment));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return false;
    }

    if (octets[0] === 10) {
        return true;
    }

    if (octets[0] === 127) {
        return true;
    }

    if (octets[0] === 192 && octets[1] === 168) {
        return true;
    }

    return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

function isDevRequestHost(hostname: string): boolean {
    return (
        isLocalHostName(hostname) ||
        isPrivateIpv4Host(hostname) ||
        hostname === "host.docker.internal"
    );
}

function isSecureCookie(baseUrl: string) {
    return baseUrl.startsWith("https://");
}

function isTestLoginEnabled(baseUrl: string, flag?: string) {
    if (flag?.trim().toLowerCase() === "true") {
        return true;
    }

    try {
        const hostname = new URL(baseUrl).hostname;
        return isDevRequestHost(hostname);
    } catch {
        return false;
    }
}

function getTestAccount(account?: string): TestAccount {
    if (account && Object.hasOwn(TEST_USERS, account)) {
        return account as TestAccount;
    }

    return "host";
}

// biome-ignore lint/suspicious/noExplicitAny: OAuth 제공자별 응답 구조가 다름
function normalizeUser(provider: Provider, raw: any) {
    switch (provider) {
        case "naver": {
            const r = raw.response;
            return {
                id: r.id,
                name: r.name,
                email: r.email,
                profileImage: r.profile_image,
            };
        }
        case "kakao": {
            const acct = raw.kakao_account;
            return {
                id: String(raw.id),
                name: acct?.profile?.nickname ?? "",
                email: acct?.email ?? "",
                profileImage: acct?.profile?.profile_image_url ?? "",
            };
        }
        case "google":
            return {
                id: raw.id,
                name: raw.name,
                email: raw.email,
                profileImage: raw.picture,
            };
    }
}

export { authRoutes };
