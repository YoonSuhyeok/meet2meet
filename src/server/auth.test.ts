import { sign } from "hono/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "./auth";

const env = {
	JWT_SECRET: "test-jwt-secret",
	BASE_URL: "http://localhost:3000",
	NAVER_CLIENT_ID: "naver-client-id",
	NAVER_CLIENT_SECRET: "naver-client-secret",
	KAKAO_CLIENT_ID: "kakao-client-id",
	KAKAO_CLIENT_SECRET: "kakao-client-secret",
	GOOGLE_CLIENT_ID: "google-client-id",
	GOOGLE_CLIENT_SECRET: "google-client-secret",
};

async function signToken(
	payload: Record<string, unknown>,
	secret = env.JWT_SECRET,
) {
	return sign(payload, secret, "HS256");
}

function readCookieValue(setCookieHeader: string, cookieName: string) {
	const match = setCookieHeader.match(
		new RegExp(`${cookieName}=([^;]+)`),
	);
	return match?.[1] ?? null;
}

describe("authRoutes /me", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("토큰 없으면 401", async () => {
		const res = await authRoutes.request("/me", {}, env);
		expect(res.status).toBe(401);
	});

	it("위조된 토큰은 401", async () => {
		const res = await authRoutes.request(
			"/me",
			{ headers: { Authorization: "Bearer not.a.real.jwt" } },
			env,
		);
		expect(res.status).toBe(401);
	});

	it("다른 비밀로 서명된 토큰은 401", async () => {
		const token = await signToken(
			{
				sub: "u-1",
				name: "n",
				email: "e",
				profileImage: "",
				provider: "naver",
				exp: Math.floor(Date.now() / 1000) + 60,
			},
			"wrong-secret",
		);
		const res = await authRoutes.request(
			"/me",
			{ headers: { Authorization: `Bearer ${token}` } },
			env,
		);
		expect(res.status).toBe(401);
	});

	it("유효 토큰이면 사용자 정보 반환", async () => {
		const token = await signToken({
			sub: "u-1",
			name: "홍길동",
			email: "u@example.com",
			profileImage: "https://example.com/p.png",
			provider: "naver",
			exp: Math.floor(Date.now() / 1000) + 60 * 60,
		});
		const res = await authRoutes.request(
			"/me",
			{ headers: { Authorization: `Bearer ${token}` } },
			env,
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: "u-1",
			name: "홍길동",
			email: "u@example.com",
			profileImage: "https://example.com/p.png",
			provider: "naver",
		});
	});

	it("쿠키 토큰으로도 사용자 정보 반환", async () => {
		const token = await signToken({
			sub: "u-2",
			name: "쿠키유저",
			email: "cookie@example.com",
			profileImage: "",
			provider: "google",
			exp: Math.floor(Date.now() / 1000) + 60 * 60,
		});
		const res = await authRoutes.request(
			"/me",
			{ headers: { Cookie: `meet2meet_auth=${token}` } },
			env,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: "u-2",
			name: "쿠키유저",
			email: "cookie@example.com",
			profileImage: "",
			provider: "google",
		});
	});
});

describe("authRoutes OAuth callback (naver)", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("/naver 시작 시 state를 발급하고 쿠키를 설정한다", async () => {
		const res = await authRoutes.request("/naver", {}, env);
		expect(res.status).toBe(302);

		const location = res.headers.get("Location") ?? "";
		expect(location.startsWith("https://nid.naver.com/oauth2.0/authorize?")).toBe(
			true,
		);
		const state = new URL(location).searchParams.get("state");
		expect(state && state.length > 0).toBe(true);

		const setCookie = res.headers.get("Set-Cookie") ?? "";
		expect(setCookie.includes("meet2meet_oauth_state_naver=")).toBe(true);
		expect(setCookie.includes("HttpOnly")).toBe(true);
	});

	it("state 없으면 /login?error=invalid_state로 리다이렉트", async () => {
		const res = await authRoutes.request("/naver/callback", {}, env);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=invalid_state");
	});

	it("state 불일치면 /login?error=invalid_state로 리다이렉트", async () => {
		const res = await authRoutes.request(
			"/naver/callback?code=abc&state=query-state",
			{ headers: { Cookie: "meet2meet_oauth_state_naver=cookie-state" } },
			env,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=invalid_state");
	});

	it("토큰 교환 성공 + 사용자 정보 정상이면 쿠키 설정 후 /auth/callback 리다이렉트", async () => {
		fetchSpy
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ access_token: "naver-access" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						response: {
							id: "naver-user-1",
							name: "홍길동",
							email: "u@example.com",
							profile_image: "https://img/p.png",
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			);

		const state = "valid-state";
		const res = await authRoutes.request(
			`/naver/callback?code=abc&state=${state}`,
			{ headers: { Cookie: `meet2meet_oauth_state_naver=${state}` } },
			env,
		);

		expect(res.status).toBe(302);
		const location = res.headers.get("Location") ?? "";
		expect(location).toBe(`${env.BASE_URL}/auth/callback`);
		const setCookie = res.headers.get("Set-Cookie") ?? "";
		expect(setCookie.includes("meet2meet_auth=")).toBe(true);
		expect(setCookie.includes("HttpOnly")).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("access_token이 비어있으면 /login?error=token_exchange", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const state = "valid-state";
		const res = await authRoutes.request(
			`/naver/callback?code=abc&state=${state}`,
			{ headers: { Cookie: `meet2meet_oauth_state_naver=${state}` } },
			env,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=token_exchange");
	});

	it("알 수 없는 provider는 /login?error=auth_failed", async () => {
		const res = await authRoutes.request("/unknown/callback?code=x", {}, env);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=auth_failed");
	});

	it("/logout은 인증 쿠키를 삭제한다", async () => {
		const res = await authRoutes.request("/logout", { method: "POST" }, env);
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("Set-Cookie") ?? "";
		expect(setCookie.includes("meet2meet_auth=")).toBe(true);
	});
});

describe("authRoutes /test-login", () => {
	it("localhost에서는 기본 테스트 계정으로 로그인 쿠키를 발급한다", async () => {
		const res = await authRoutes.request("/test-login", {}, env);

		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`${env.BASE_URL}/auth/callback`);

		const setCookie = res.headers.get("Set-Cookie") ?? "";
		expect(setCookie.includes("meet2meet_auth=")).toBe(true);

		const token = readCookieValue(setCookie, "meet2meet_auth");
		expect(token).not.toBeNull();

		const meRes = await authRoutes.request(
			"/me",
			{ headers: { Cookie: `meet2meet_auth=${token}` } },
			env,
		);
		expect(meRes.status).toBe(200);
		expect(await meRes.json()).toMatchObject({
			id: "test-host-1",
			name: "테스트 호스트",
			provider: "test",
		});
	});

	it("계정을 지정하면 해당 테스트 계정으로 로그인된다", async () => {
		const res = await authRoutes.request(
			"/test-login?account=participant1",
			{},
			env,
		);

		expect(res.status).toBe(302);

		const setCookie = res.headers.get("Set-Cookie") ?? "";
		const token = readCookieValue(setCookie, "meet2meet_auth");
		expect(token).not.toBeNull();

		const meRes = await authRoutes.request(
			"/me",
			{ headers: { Cookie: `meet2meet_auth=${token}` } },
			env,
		);
		expect(meRes.status).toBe(200);
		expect(await meRes.json()).toMatchObject({
			id: "test-participant-1",
			name: "테스트 참가자 1",
			provider: "test",
		});
	});

	it("로컬이 아닌 BASE_URL에서는 기본적으로 비활성화된다", async () => {
		const prodLikeEnv = {
			...env,
			BASE_URL: "https://meet2meet.app",
		};

		const res = await authRoutes.request("/test-login", {}, prodLikeEnv);
		expect(res.status).toBe(404);
	});

	it("TEST_LOGIN_ENABLED=true면 비로컬 BASE_URL에서도 활성화된다", async () => {
		const enabledEnv = {
			...env,
			BASE_URL: "https://meet2meet.app",
			TEST_LOGIN_ENABLED: "true",
		};

		const res = await authRoutes.request("/test-login", {}, enabledEnv);
		expect(res.status).toBe(302);
	});

	it("로컬에서 요청 포트가 BASE_URL과 다르면 요청 포트를 리다이렉트에 사용한다", async () => {
		const res = await authRoutes.request(
			"http://localhost:3002/test-login",
			{},
			env,
		);

		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("http://localhost:3002/auth/callback");
	});
});
