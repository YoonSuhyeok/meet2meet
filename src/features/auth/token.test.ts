import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearStoredAuthToken,
	createAuthHeaders,
	getStoredAuthToken,
	setStoredAuthToken,
} from "./token";

function createFakeWindow() {
	return {};
}

describe("token storage (with window)", () => {
	beforeEach(() => {
		vi.stubGlobal("window", createFakeWindow());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("HttpOnly 쿠키 환경에서는 get이 항상 null", () => {
		expect(getStoredAuthToken()).toBeNull();
		setStoredAuthToken("abc");
		expect(getStoredAuthToken()).toBeNull();
		clearStoredAuthToken();
		expect(getStoredAuthToken()).toBeNull();
	});

	it("createAuthHeaders는 Authorization을 부착하지 않는다", () => {
		const headers = createAuthHeaders();
		expect(headers.get("Authorization")).toBeNull();
	});

	it("createAuthHeaders는 기존 헤더를 보존한다", () => {
		const headers = createAuthHeaders({ "Content-Type": "application/json" });
		expect(headers.get("Content-Type")).toBe("application/json");
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
