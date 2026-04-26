const TIME_RE = /^([01]\d|2[0-3]):([03]0)$/;

function toMinutes(time: string): number | null {
    if (time === "24:00") return 24 * 60;
    const match = TIME_RE.exec(time);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour * 60 + minute;
}

function toHHmm(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function createTimeSlotsFromRange(
    start: string,
    end: string,
    intervalMin: number = 30,
): string[] {
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    if (startMin === null || endMin === null || startMin >= endMin) {
        return [];
    }

    const slots: string[] = [];
    for (let cursor = startMin; cursor < endMin; cursor += intervalMin) {
        slots.push(toHHmm(cursor));
    }
    return slots;
}

export function parseSlotKey(slot: string): { date: string; time: string } | null {
    if (slot.length !== 16 || slot[10] !== "-") return null;
    const date = slot.slice(0, 10);
    const time = slot.slice(11);
    if (!TIME_RE.test(time)) return null;
    return { date, time };
}

export function formatDateLabel(dateKey: string): string {
    const d = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateKey;
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}(${weekday})`;
}
