import { describe, expect, it } from "vitest";
import { generateTimeSlots, makeSlotKey } from "./slot";

describe("makeSlotKey", () => {
	it("joins date and time with a hyphen", () => {
		expect(makeSlotKey("4/11 (금)", "09:00")).toBe("4/11 (금)-09:00");
	});
});

describe("generateTimeSlots", () => {
	it("generates 30분 간격 슬롯", () => {
		const slots = generateTimeSlots(9, 11);
		expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30"]);
	});

	it("커스텀 간격을 지원한다", () => {
		const slots = generateTimeSlots(9, 10, 15);
		expect(slots).toEqual(["09:00", "09:15", "09:30", "09:45"]);
	});

	it("종료 시간(미포함)을 지킨다", () => {
		expect(generateTimeSlots(0, 1, 60)).toEqual(["00:00"]);
	});

	it("두 자리 시 패딩", () => {
		expect(generateTimeSlots(0, 1, 30)).toEqual(["00:00", "00:30"]);
	});
});
