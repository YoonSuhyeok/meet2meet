import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearStoredAuthToken,
	createAuthHeaders,
	getStoredAuthToken,
	setStoredAuthToken,
} from "./token";

function createFakeWindow() {
	const store = new Map<string, string>();
	return {
		localStorage: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
		},
	};
}

describe("token storage (with window)", () => {
	beforeEach(() => {
		vi.stubGlobal("window", createFakeWindow());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("set/get/clear round-trip", () => {
		expect(getStoredAuthToken()).toBeNull();
		setStoredAuthToken("abc");
		expect(getStoredAuthToken()).toBe("abc");
		clearStoredAuthToken();
		expect(getStoredAuthToken()).toBeNull();
	});

	it("createAuthHeaders가 토큰이 있으면 Authorization을 부착한다", () => {
		setStoredAuthToken("xyz");
		const headers = createAuthHeaders();
		expect(headers.get("Authorization")).toBe("Bearer xyz");
	});

	it("createAuthHeaders는 기존 헤더를 보존한다", () => {
		setStoredAuthToken("xyz");
		const headers = createAuthHeaders({ "Content-Type": "application/json" });
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(headers.get("Authorization")).toBe("Bearer xyz");
	});

	it("토큰이 없으면 Authorization을 부착하지 않는다", () => {
		const headers = createAuthHeaders();
		expect(headers.get("Authorization")).toBeNull();
	});
});

describe("token storage (SSR / window 없음)", () => {
	it("window 미정의 시 안전하게 no-op / null 반환", () => {
		// 워커 환경에는 기본적으로 window가 없음
		expect(typeof globalThis.window).toBe("undefined");
		expect(getStoredAuthToken()).toBeNull();
		expect(() => setStoredAuthToken("x")).not.toThrow();
		expect(() => clearStoredAuthToken()).not.toThrow();
	});
});
