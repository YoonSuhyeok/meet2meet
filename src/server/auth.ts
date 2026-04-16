import { Hono } from "hono";
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

const PROVIDERS = {
    naver: {
        authUrl: "https://nid.naver.com/oauth2.0/authorize",
        tokenUrl: "https://nid.naver.com/oauth2.0/token",
        userInfoUrl: "https://openapi.naver.com/v1/nid/me",
        scope: "name,email,profile_image", // 네이버는 쉼표로 구분
    },
    kakao: {
        authUrl: "https://kauth.kakao.com/oauth/authorize",
        tokenUrl: "https://kauth.kakao.com/oauth/token",
        userInfoUrl: "https://kapi.kakao.com/v2/user/me",
        scope: "profile_nickname", // 필요한 항목 명시
    },
    google: {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo", // 최신 OIDC 규격
        scope: "openid email profile",
    },
} as const;

type Provider = keyof typeof PROVIDERS;

const authRoutes = new Hono<{ Bindings: Bindings }>();
authRoutes.use(logger());

// GET /api/auth/:provider — 소셜 로그인 시작
authRoutes.get("/:provider", async ({ req, env, redirect }) => {
    const provider = req.param("provider") as Provider;
    const config = PROVIDERS[provider];
    if (!config) return redirect("/login?error=auth_failed");

    const clientId =
        env[`${provider.toUpperCase()}_CLIENT_ID` as keyof Bindings];
    const callbackUrl = `${env.BASE_URL}/api/auth/${provider}/callback`;

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: callbackUrl,
        ...(config.scope ? { scope: config.scope } : {}),
    });

    console.log(`[auth] ${provider} 로그인 시작 → ${config.authUrl}`);
    return redirect(`${config.authUrl}?${params.toString()}`);
});

// GET /api/auth/:provider/callback — 콜백 처리
authRoutes.get("/:provider/callback", async (c) => {
    const provider = c.req.param("provider") as Provider;
    const config = PROVIDERS[provider];
    if (!config) return c.redirect("/login?error=auth_failed");

    const code = c.req.query("code");
    console.log(`[auth] ${provider} 콜백 수신, code=${code ? "있음" : "없음"}`);
    if (!code) return c.redirect("/login?error=auth_failed");

    const env = c.env;
    const clientId =
        env[`${provider.toUpperCase()}_CLIENT_ID` as keyof Bindings];
    const clientSecret =
        env[`${provider.toUpperCase()}_CLIENT_SECRET` as keyof Bindings];
    const callbackUrl = `${env.BASE_URL}/api/auth/${provider}/callback`;

    // 1) code → access_token 교환
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
        const tokenData = (await tokenRes.json()) as { access_token: string };
        accessToken = tokenData.access_token;
        console.log(
            `[auth] ${provider} 토큰 교환`,
            accessToken ? "성공" : "실패",
            tokenData,
        );
        if (!accessToken) return c.redirect("/login?error=token_exchange");
    } catch (e) {
        console.error(`[auth] ${provider} 토큰 교환 실패:`, e);
        return c.redirect("/login?error=token_exchange");
    }

    // 2) access_token → 사용자 정보 조회
    let user: { id: string; name: string; email: string; profileImage: string };
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

    // 3) JWT 발급 & 쿠키 설정
    const payload = {
        sub: user.id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        provider,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7일
    };

    const token = await sign(payload, env.JWT_SECRET, "HS256");

    setCookie(c, "session", token, {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });

    return c.redirect("/");
});

// POST /api/auth/logout — 로그아웃
authRoutes.post("/logout", async (c) => {
    deleteCookie(c, "session", { path: "/" });
    return c.json({ ok: true });
});

// GET /api/auth/me — 현재 사용자 조회
authRoutes.get("/me", async (c) => {
    const token = getCookie(c, "session");
    if (!token) return c.json({ error: "unauthorized" }, 401);

    try {
        const payload = await verify(token, c.env.JWT_SECRET, "HS256");
        return c.json({
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            profileImage: payload.profileImage,
            provider: payload.provider,
        });
    } catch {
        deleteCookie(c, "session", { path: "/" });
        return c.json({ error: "unauthorized" }, 401);
    }
});

// 제공자별 사용자 정보 정규화
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
