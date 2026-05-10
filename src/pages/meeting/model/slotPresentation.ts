import { formatDateLabel, parseSlotKey } from "./time";

const OTHER_GROUP_KEY = "__other";

export type SlotPresentationItem = {
    key: string;
    label: string;
};

export type SlotPresentationGroup = {
    groupKey: string;
    dateKey: string | null;
    label: string;
    items: SlotPresentationItem[];
};

type MinuteRange = {
    startMin: number;
    endExclusiveMin: number;
};

function hhmmToMinutes(value: string): number | null {
    const [hour, minute] = value.split(":");
    if (!hour || !minute) return null;
    const hourNum = Number(hour);
    const minuteNum = Number(minute);
    if (!Number.isInteger(hourNum) || !Number.isInteger(minuteNum)) return null;
    return hourNum * 60 + minuteNum;
}

function minutesToHHmm(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function mergeConsecutiveMinutes(
    minutes: number[],
    intervalMin: number,
): MinuteRange[] {
    if (minutes.length === 0) return [];

    const sorted = [...new Set(minutes)].sort((a, b) => a - b);
    const merged: MinuteRange[] = [];

    let rangeStart = sorted[0];
    let previous = sorted[0];

    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (current - previous === intervalMin) {
            previous = current;
            continue;
        }

        merged.push({
            startMin: rangeStart,
            endExclusiveMin: previous + intervalMin,
        });
        rangeStart = current;
        previous = current;
    }

    merged.push({
        startMin: rangeStart,
        endExclusiveMin: previous + intervalMin,
    });

    return merged;
}

function toRangeLabel(range: MinuteRange): string {
    const start = minutesToHHmm(range.startMin);
    const endExclusive = minutesToHHmm(range.endExclusiveMin);
    if (range.endExclusiveMin - range.startMin <= 30) {
        return start;
    }
    return `${start}~${endExclusive}`;
}

export function buildSlotPresentationGroups(
    slots: string[],
    intervalMin: number = 30,
): SlotPresentationGroup[] {
    const groupedMinutes = new Map<string, number[]>();
    const invalidSlots: string[] = [];

    for (const slot of slots) {
        const parsed = parseSlotKey(slot);
        if (!parsed) {
            invalidSlots.push(slot);
            continue;
        }

        const minutes = hhmmToMinutes(parsed.time);
        if (minutes === null) {
            invalidSlots.push(slot);
            continue;
        }

        const existing = groupedMinutes.get(parsed.date) ?? [];
        existing.push(minutes);
        groupedMinutes.set(parsed.date, existing);
    }

    const groups: SlotPresentationGroup[] = [];
    const sortedDateKeys = [...groupedMinutes.keys()].sort((a, b) =>
        a.localeCompare(b),
    );

    for (const dateKey of sortedDateKeys) {
        const minutes = groupedMinutes.get(dateKey) ?? [];
        const mergedRanges = mergeConsecutiveMinutes(minutes, intervalMin);
        const items = mergedRanges.map((range) => ({
            key: `${dateKey}-${range.startMin}-${range.endExclusiveMin}`,
            label: toRangeLabel(range),
        }));

        groups.push({
            groupKey: dateKey,
            dateKey,
            label: formatDateLabel(dateKey),
            items,
        });
    }

    if (invalidSlots.length > 0) {
        groups.push({
            groupKey: OTHER_GROUP_KEY,
            dateKey: null,
            label: "기타 시간",
            items: invalidSlots.map((slot, index) => ({
                key: `${OTHER_GROUP_KEY}-${index}`,
                label: slot,
            })),
        });
    }

    return groups;
}

export function countSlotPresentationItems(
    groups: SlotPresentationGroup[],
): number {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
}

export function truncateSlotPresentationItems(
    groups: SlotPresentationGroup[],
    maxItems: number,
): { groups: SlotPresentationGroup[]; omittedCount: number } {
    const safeLimit = Math.max(0, maxItems);
    const total = countSlotPresentationItems(groups);

    if (total <= safeLimit) {
        return { groups, omittedCount: 0 };
    }

    const truncated: SlotPresentationGroup[] = [];
    let remaining = safeLimit;

    for (const group of groups) {
        if (remaining <= 0) break;

        const sliced = group.items.slice(0, remaining);
        if (sliced.length === 0) continue;

        truncated.push({
            ...group,
            items: sliced,
        });

        remaining -= sliced.length;
    }

    return {
        groups: truncated,
        omittedCount: total - safeLimit,
    };
}
