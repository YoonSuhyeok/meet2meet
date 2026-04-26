import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, isStoredTokenExpired } from "./apiFetch";

function base64url(input: string) {
	return btoa(input)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** exp 클레임만 가진 페이크 JWT 생성 (서명은 검증되지 않음) */
function fakeJwt(expSeconds: number) {
	const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
	const payload = base64url(JSON.stringify({ exp: expSeconds }));
	return `${header}.${payload}.sig`;
}

interface FakeWindow {
	localStorage: {
		getItem(k: string): string | null;
		setItem(k: string, v: string): void;
		removeItem(k: string): void;
	};
	location: {
		pathname: string;
		href: string;
	};
}

function createFakeWindow(pathname = "/meeting/new"): FakeWindow {
	const store = new Map<string, string>();
	return {
		localStorage: {
			getItem: (k) => store.get(k) ?? null,
			setItem: (k, v) => {
				store.set(k, v);
			},
			removeItem: (k) => {
				store.delete(k);
			},
		},
		location: { pathname, href: `http://localhost:3000${pathname}` },
	};
}

describe("isStoredTokenExpired", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("토큰이 없으면 만료로 판정", () => {
		vi.stubGlobal("window", createFakeWindow());
		expect(isStoredTokenExpired()).toBe(true);
	});

	it("형식이 잘못된 토큰은 만료로 판정", () => {
		const w = createFakeWindow();
		w.localStorage.setItem("meet2meet.auth.token", "not.a.jwt.token");
		vi.stubGlobal("window", w);
		expect(isStoredTokenExpired()).toBe(true);
	});

	it("디코딩 실패는 만료로 판정", () => {
		const w = createFakeWindow();
		w.localStorage.setItem("meet2meet.auth.token", "aaa.???.bbb");
		vi.stubGlobal("window", w);
		expect(isStoredTokenExpired()).toBe(true);
	});

	it("exp가 미래면 유효", () => {
		const w = createFakeWindow();
		const future = Math.floor(Date.now() / 1000) + 60 * 60;
		w.localStorage.setItem("meet2meet.auth.token", fakeJwt(future));
		vi.stubGlobal("window", w);
		expect(isStoredTokenExpired()).toBe(false);
	});

	it("exp가 과거면 만료", () => {
		const w = createFakeWindow();
		const past = Math.floor(Date.now() / 1000) - 10;
		w.localStorage.setItem("meet2meet.auth.token", fakeJwt(past));
		vi.stubGlobal("window", w);
		expect(isStoredTokenExpired()).toBe(true);
	});

	it("leeway 안쪽도 만료로 판정", () => {
		const w = createFakeWindow();
		const soon = Math.floor(Date.now() / 1000) + 30; // 60초 leeway 안쪽
		w.localStorage.setItem("meet2meet.auth.token", fakeJwt(soon));
		vi.stubGlobal("window", w);
		expect(isStoredTokenExpired(60)).toBe(true);
		// leeway를 줄이면 유효
		expect(isStoredTokenExpired(0)).toBe(false);
	});
});

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

	it("토큰이 있으면 Authorization 헤더를 자동 부착", async () => {
		const future = Math.floor(Date.now() / 1000) + 60 * 60;
		win.localStorage.setItem("meet2meet.auth.token", fakeJwt(future));

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("ok", { status: 200 }));

		await apiFetch("/api/meetings");

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const headers = new Headers(init.headers);
		expect(headers.get("Authorization")).toBe(`Bearer ${fakeJwt(future)}`);
	});

	it("응답 401이면 토큰을 비우고 /login으로 강제 이동", async () => {
		const future = Math.floor(Date.now() / 1000) + 60 * 60;
		win.localStorage.setItem("meet2meet.auth.token", fakeJwt(future));

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(null, { status: 401 }),
		);

		const res = await apiFetch("/api/meetings");

		expect(res.status).toBe(401);
		expect(win.localStorage.getItem("meet2meet.auth.token")).toBeNull();
		expect(win.location.href).toContain("/login?error=session_expired");
	});

	it("저장된 토큰이 만료된 경우 fetch를 호출하지 않고 즉시 401", async () => {
		const past = Math.floor(Date.now() / 1000) - 10;
		win.localStorage.setItem("meet2meet.auth.token", fakeJwt(past));

		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const res = await apiFetch("/api/meetings");

		expect(res.status).toBe(401);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(win.location.href).toContain("/login?error=session_expired");
	});

	it("/login에 이미 있을 땐 무한 리다이렉트를 막는다", async () => {
		win = createFakeWindow("/login");
		vi.stubGlobal("window", win);
		const future = Math.floor(Date.now() / 1000) + 60 * 60;
		win.localStorage.setItem("meet2meet.auth.token", fakeJwt(future));
		const original = win.location.href;

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(null, { status: 401 }),
		);

		await apiFetch("/api/meetings");

		expect(win.localStorage.getItem("meet2meet.auth.token")).toBeNull();
		expect(win.location.href).toBe(original); // 변경 없음
	});

	it("토큰이 없으면 만료 체크를 건너뛰고 fetch를 그대로 호출", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("ok", { status: 200 }));

		const res = await apiFetch("/api/public");

		expect(res.status).toBe(200);
		expect(fetchSpy).toHaveBeenCalledOnce();
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const headers = new Headers(init?.headers);
		expect(headers.get("Authorization")).toBeNull();
	});
});
