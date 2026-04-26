import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { logger } from "hono/logger";

type Bindings = {
    JWT_SECRET: string;
    BASE_URL: string;
    NAVER_CLIENT_ID: string;
    NAVER_CLIENT_SECRET: string;
    KAKAO_CLIENT_ID: string;
    KAKAO_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
};

type AuthPayload = {
    sub: string;
    name: string;
    email: string;
    profileImage: string;
    provider: Provider;
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

const AUTH_COOKIE_NAME = "meet2meet_auth";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_COOKIE_PREFIX = "meet2meet_oauth_state_";
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const authRoutes = new Hono<{ Bindings: Bindings }>();
authRoutes.use(logger());

authRoutes.post("/logout", (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, {
        path: "/",
        secure: isSecureCookie(c.env.BASE_URL),
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

authRoutes.get("/:provider", async (c) => {
    const provider = c.req.param("provider") as Provider;
    const config = PROVIDERS[provider];
    if (!config) {
        return c.redirect("/login?error=auth_failed");
    }

    const state = generateOAuthState();

    const clientId =
        c.env[`${provider.toUpperCase()}_CLIENT_ID` as keyof Bindings];
    const callbackUrl = `${c.env.BASE_URL}/api/auth/${provider}/callback`;

    // CSRF 방지를 위해 provider별 state를 HttpOnly 쿠키로 저장
    setCookie(c, getOAuthStateCookieName(provider), state, {
        path: "/",
        maxAge: OAUTH_STATE_TTL_SECONDS,
        httpOnly: true,
        secure: isSecureCookie(c.env.BASE_URL),
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

    const stateFromQuery = c.req.query("state") ?? "";
    const stateCookieName = getOAuthStateCookieName(provider);
    const stateFromCookie = getCookie(c, stateCookieName) ?? "";
    deleteCookie(c, stateCookieName, {
        path: "/",
        secure: isSecureCookie(c.env.BASE_URL),
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
    const clientId =
        env[`${provider.toUpperCase()}_CLIENT_ID` as keyof Bindings];
    const clientSecret =
        env[`${provider.toUpperCase()}_CLIENT_SECRET` as keyof Bindings];
    const callbackUrl = `${env.BASE_URL}/api/auth/${provider}/callback`;

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
        secure: isSecureCookie(env.BASE_URL),
        sameSite: "Lax",
    });

    return c.redirect(buildCallbackRedirect(env.BASE_URL));
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

function isSecureCookie(baseUrl: string) {
    return baseUrl.startsWith("https://");
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
