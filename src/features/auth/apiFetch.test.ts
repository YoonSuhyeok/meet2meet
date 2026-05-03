import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch";

interface FakeWindow {
	location: {
		pathname: string;
		href: string;
	};
}

function createFakeWindow(pathname = "/meeting/new"): FakeWindow {
	return {
		location: { pathname, href: `http://localhost:3000${pathname}` },
	};
}

describe("apiFetch", () => {
	let win: FakeWindow;

	beforeEach(() => {
		win = createFakeWindow();
		vi.stubGlobal("window", win);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("기본적으로 same-origin credentials로 호출", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("ok", { status: 200 }));

		await apiFetch("/api/meetings");

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.credentials).toBe("same-origin");
	});

	it("응답 401이면 /api/auth/logout 호출 후 /login으로 강제 이동", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		fetchSpy
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const res = await apiFetch("/api/meetings");

		expect(res.status).toBe(401);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy.mock.calls[1][0]).toBe("/api/auth/logout");
		expect(win.location.href).toContain("/login?error=session_expired");
	});

	it("onUnauthorized=none이면 401이어도 리다이렉트하지 않는다", async () => {
		const original = win.location.href;
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(new Response(null, { status: 401 }));

		const res = await apiFetch("/api/auth/me", {}, { onUnauthorized: "none" });

		expect(res.status).toBe(401);
		expect(fetchSpy).toHaveBeenCalledOnce();
		expect(win.location.href).toBe(original);
	});

	it("/login에 이미 있을 땐 무한 리다이렉트를 막는다", async () => {
		win = createFakeWindow("/login");
		vi.stubGlobal("window", win);
		const original = win.location.href;

		const fetchSpy = vi.spyOn(globalThis, "fetch");
		fetchSpy
			.mockResolvedValueOnce(new Response(null, { status: 401 }))
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		await apiFetch("/api/meetings");

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(win.location.href).toBe(original); // 변경 없음
	});

	it("기본 요청은 fetch 응답을 그대로 반환", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("ok", { status: 200 }));

		const res = await apiFetch("/api/public");

		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledOnce();
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.credentials).toBe("same-origin");
	});
});
