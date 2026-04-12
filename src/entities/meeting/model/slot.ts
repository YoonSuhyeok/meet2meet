/** 개별 시간 슬롯의 좌표 키 (예: "4/11 (금)-09:00") */
export type SlotKey = string;

/** 슬롯 키 생성 */
export function makeSlotKey(date: string, time: string): SlotKey {
    return `${date}-${time}`;
}

/** 시간 슬롯 목록 생성 유틸 (startHour~endHour, intervalMin 간격) */
export function generateTimeSlots(
    startHour: number,
    endHour: number,
    intervalMin: number = 30,
): string[] {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += intervalMin) {
            slots.push(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
            );
        }
    }
    return slots;
}
