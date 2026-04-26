import { describe, expect, it } from "vitest";
import {
	DEFAULT_MEETING_CREATE_ERROR,
	resolveServerErrorMessage,
	SERVER_ERROR_MESSAGES,
} from "./errors";

describe("resolveServerErrorMessage", () => {
	it("코드 매핑이 가장 우선한다", () => {
		expect(
			resolveServerErrorMessage(400, {
				code: "title_required",
				message: "ignored",
			}),
		).toBe(SERVER_ERROR_MESSAGES.title_required);
	});

	it("매핑되지 않은 코드는 body.message로 폴백", () => {
		expect(
			resolveServerErrorMessage(400, {
				code: "unknown_code",
				message: "서버 정의 메시지",
			}),
		).toBe("서버 정의 메시지");
	});

	it("429는 rate_limited 메시지", () => {
		expect(resolveServerErrorMessage(429, null)).toBe(
			SERVER_ERROR_MESSAGES.rate_limited,
		);
	});

	it("5xx는 server_error 메시지", () => {
		expect(resolveServerErrorMessage(500, null)).toBe(
			SERVER_ERROR_MESSAGES.server_error,
		);
		expect(resolveServerErrorMessage(503, {})).toBe(
			SERVER_ERROR_MESSAGES.server_error,
		);
	});

	it("기타 4xx는 validation_failed 메시지", () => {
		expect(resolveServerErrorMessage(400, null)).toBe(
			SERVER_ERROR_MESSAGES.validation_failed,
		);
	});

	it("그 외(2xx 등)는 기본 메시지", () => {
		expect(resolveServerErrorMessage(200, null)).toBe(
			DEFAULT_MEETING_CREATE_ERROR,
		);
	});
});
