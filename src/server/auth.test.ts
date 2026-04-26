import { env } from "cloudflare:test";
import { sign } from "hono/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "./auth";

async function signToken(
	payload: Record<string, unknown>,
	secret = env.JWT_SECRET,
) {
	return sign(payload, secret, "HS256");
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
});

describe("authRoutes OAuth callback (naver)", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("code 없으면 /login?error=auth_failed로 리다이렉트", async () => {
		const res = await authRoutes.request("/naver/callback", {}, env);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=auth_failed");
	});

	it("토큰 교환 성공 + 사용자 정보 정상이면 /auth/callback#token=... 리다이렉트", async () => {
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

		const res = await authRoutes.request("/naver/callback?code=abc", {}, env);

		expect(res.status).toBe(302);
		const location = res.headers.get("Location") ?? "";
		expect(location.startsWith(`${env.BASE_URL}/auth/callback#token=`)).toBe(
			true,
		);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("access_token이 비어있으면 /login?error=token_exchange", async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		const res = await authRoutes.request("/naver/callback?code=abc", {}, env);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=token_exchange");
	});

	it("알 수 없는 provider는 /login?error=auth_failed", async () => {
		const res = await authRoutes.request("/unknown/callback?code=x", {}, env);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/login?error=auth_failed");
	});
});
