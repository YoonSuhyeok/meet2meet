import { Hono } from "hono";
import { sign } from "hono/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meetingRoutes } from "./meeting";

const env = {
	JWT_SECRET: "test-jwt-secret",
	CORE_API_URL: "http://localhost:8080",
};

/** +server.ts와 동일하게 마운트한 테스트용 앱 */
function buildApp() {
	const app = new Hono();
	app.route("/api/meetings", meetingRoutes);
	return app;
}

async function makeToken(
	overrides: Partial<{
		sub: string;
		name: string;
		email: string;
		profileImage: string;
		provider: string;
		exp: number;
	}> = {},
) {
	const payload = {
		sub: "user-1",
		name: "홍길동",
		email: "u@example.com",
		profileImage: "",
		provider: "naver",
		exp: Math.floor(Date.now() / 1000) + 60 * 60,
		...overrides,
	};
	return sign(payload, env.JWT_SECRET, "HS256");
}

describe("meetingRoutes (BFF proxy)", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("인증", () => {
		it("POST: 토큰 없으면 401, 업스트림 호출 없음", async () => {
			const app = buildApp();
			const res = await app.request(
				"/api/meetings",
				{ method: "POST", body: "{}" },
				env,
			);
			expect(res.status).toBe(401);
			const body = (await res.json()) as { code: string };
			expect(body.code).toBe("unauthorized");
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("POST: 위조된 토큰은 401", async () => {
			const app = buildApp();
			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: { Authorization: "Bearer not.a.real.jwt" },
					body: "{}",
				},
				env,
			);
			expect(res.status).toBe(401);
			const body = (await res.json()) as { code: string };
			expect(body.code).toBe("unauthorized");
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("POST: 만료된 토큰은 401", async () => {
			const expired = await makeToken({
				exp: Math.floor(Date.now() / 1000) - 10,
			});
			const app = buildApp();
			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: { Authorization: `Bearer ${expired}` },
					body: "{}",
				},
				env,
			);
			expect(res.status).toBe(401);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("GET: 토큰 없어도 통과 (업스트림 호출됨, X-User-Id 미부착)", async () => {
			fetchSpy.mockResolvedValue(
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
			const app = buildApp();
			const res = await app.request("/api/meetings/code/ABC123", {}, env);
			expect(res.status).toBe(200);
			expect(fetchSpy).toHaveBeenCalledOnce();
			const init = fetchSpy.mock.calls[0][1] as RequestInit;
			const headers = new Headers(init.headers);
			expect(headers.get("X-User-Id")).toBeNull();
		});
	});

	describe("프록시 동작", () => {
		it("POST: 유효 토큰이면 업스트림 호출 + 사용자 헤더 forward + 경로 rewrite", async () => {
			fetchSpy.mockResolvedValue(
				new Response(JSON.stringify({ id: "m-1" }), {
					status: 201,
					headers: { "Content-Type": "application/json" },
				}),
			);
			const token = await makeToken({ sub: "user-42", name: "테스터" });
			const app = buildApp();

			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ title: "회의" }),
				},
				env,
			);

			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({ id: "m-1" });
			expect(fetchSpy).toHaveBeenCalledOnce();

			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(`${env.CORE_API_URL}/meetings`);
			expect(init.method).toBe("POST");

			const headers = new Headers(init.headers);
			expect(headers.get("X-User-Id")).toBe("user-42");
			expect(headers.get("X-User-Name")).toBe(encodeURIComponent("테스터"));
			expect(headers.get("Content-Type")).toBe("application/json");
			expect(headers.get("Authorization")).toBeNull(); // 업스트림에 토큰을 흘리지 않음

			const body = init.body as ArrayBuffer;
			const text = new TextDecoder().decode(body);
			expect(JSON.parse(text)).toEqual({ title: "회의" });
		});

		it("POST: Authorization 헤더 없이 쿠키 토큰으로도 인증된다", async () => {
			fetchSpy.mockResolvedValue(
				new Response(JSON.stringify({ id: "m-2" }), {
					status: 201,
					headers: { "Content-Type": "application/json" },
				}),
			);
			const token = await makeToken({ sub: "cookie-user", name: "쿠키" });
			const app = buildApp();

			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: {
						Cookie: `meet2meet_auth=${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ title: "쿠키 회의" }),
				},
				env,
			);

			expect(res.status).toBe(201);
			const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			const headers = new Headers(init.headers);
			expect(headers.get("X-User-Id")).toBe("cookie-user");
			expect(headers.get("X-User-Name")).toBe(encodeURIComponent("쿠키"));
		});

		it("쿼리스트링을 보존한다", async () => {
			fetchSpy.mockResolvedValue(new Response("[]", { status: 200 }));
			const app = buildApp();
			await app.request("/api/meetings?page=2&size=10", {}, env);
			const [url] = fetchSpy.mock.calls[0] as [string];
			expect(url).toBe(`${env.CORE_API_URL}/meetings?page=2&size=10`);
		});

		it("PATCH: 본문과 사용자 헤더가 forward 된다", async () => {
			fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
			const token = await makeToken();
			const app = buildApp();

			const res = await app.request(
				"/api/meetings/m-1",
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ title: "수정" }),
				},
				env,
			);

			expect(res.status).toBe(204);
			const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(url).toBe(`${env.CORE_API_URL}/meetings/m-1`);
			expect(init.method).toBe("PATCH");
		});

		it("DELETE: 인증되면 업스트림으로 forward", async () => {
			fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
			const token = await makeToken();
			const app = buildApp();

			const res = await app.request(
				"/api/meetings/m-1",
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				},
				env,
			);

			expect(res.status).toBe(204);
			expect(fetchSpy).toHaveBeenCalledOnce();
			const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
			expect(init.method).toBe("DELETE");
		});
	});

	describe("업스트림 장애", () => {
		it("fetch가 throw 하면 502 upstream_unreachable", async () => {
			fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
			const token = await makeToken();
			const app = buildApp();

			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: "{}",
				},
				env,
			);

			expect(res.status).toBe(502);
			const body = (await res.json()) as { code: string };
			expect(body.code).toBe("upstream_unreachable");
		});

		it("업스트림 4xx/5xx는 그대로 패스스루", async () => {
			fetchSpy.mockResolvedValue(
				new Response(JSON.stringify({ code: "title_required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				}),
			);
			const token = await makeToken();
			const app = buildApp();

			const res = await app.request(
				"/api/meetings",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: "{}",
				},
				env,
			);

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ code: "title_required" });
		});
	});
});
