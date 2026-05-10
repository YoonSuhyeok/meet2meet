import { describe, expect, it } from "vitest";
import {
    buildSlotPresentationGroups,
    countSlotPresentationItems,
    truncateSlotPresentationItems,
} from "./slotPresentation";

describe("buildSlotPresentationGroups", () => {
    it("groups by date and merges consecutive 30-minute slots", () => {
        const groups = buildSlotPresentationGroups([
            "2026-05-01-09:00",
            "2026-04-30-07:00",
            "2026-04-30-07:30",
            "2026-04-30-08:00",
            "2026-04-30-09:00",
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].dateKey).toBe("2026-04-30");
        expect(groups[0].items.map((item) => item.label)).toEqual([
            "07:00~08:30",
            "09:00",
        ]);
        expect(groups[1].dateKey).toBe("2026-05-01");
        expect(groups[1].items.map((item) => item.label)).toEqual(["09:00"]);
    });

    it("keeps invalid slot keys in 기타 시간 group", () => {
        const groups = buildSlotPresentationGroups([
            "2026-04-30-09:00",
            "broken-slot",
            "unknown",
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[1].groupKey).toBe("__other");
        expect(groups[1].label).toBe("기타 시간");
        expect(groups[1].items.map((item) => item.label)).toEqual([
            "broken-slot",
            "unknown",
        ]);
    });
});

describe("countSlotPresentationItems", () => {
    it("counts merged range items", () => {
        const groups = buildSlotPresentationGroups([
            "2026-04-30-07:00",
            "2026-04-30-07:30",
            "2026-04-30-09:00",
            "2026-05-01-10:00",
        ]);

        expect(countSlotPresentationItems(groups)).toBe(3);
    });
});

describe("truncateSlotPresentationItems", () => {
    it("keeps order and returns omitted count", () => {
        const groups = buildSlotPresentationGroups([
            "2026-04-30-07:00",
            "2026-04-30-09:00",
            "2026-05-01-10:00",
            "broken-slot",
        ]);

        const truncated = truncateSlotPresentationItems(groups, 2);
        expect(truncated.omittedCount).toBe(2);
        expect(truncated.groups).toHaveLength(1);
        expect(truncated.groups[0].dateKey).toBe("2026-04-30");
        expect(truncated.groups[0].items.map((item) => item.label)).toEqual([
            "07:00",
            "09:00",
        ]);
    });
});
