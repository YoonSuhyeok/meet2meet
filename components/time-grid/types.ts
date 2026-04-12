/** TimeGrid 데이터 모델 */

/** 개별 시간 슬롯의 좌표 키 (예: "2026-04-11-09:00") */
export type SlotKey = string;

/** 드래그 모드: 선택 또는 해제 */
export type DragMode = "select" | "deselect";

/** TimeGrid에 전달할 props */
export interface TimeGridProps {
  /** 열 헤더로 표시할 날짜 목록 (예: ["4/11 (금)", "4/12 (토)"]) */
  dates: string[];
  /** 행으로 표시할 시간 슬롯 목록 (예: ["09:00", "09:30", "10:00"]) */
  timeSlots: string[];
  /** 현재 선택된 슬롯 집합 */
  selected: Set<SlotKey>;
  /** 선택 상태가 변경될 때 호출 */
  onSelectionChange: (selected: Set<SlotKey>) => void;
}

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
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}
