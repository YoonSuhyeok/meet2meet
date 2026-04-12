/** ISO 날짜 문자열 (예: "2026-04-12") */
export type DateKey = string;

/** Calendar에 전달할 props */
export interface CalendarProps {
  selected: Set<DateKey>;
  onSelectionChange: (selected: Set<DateKey>) => void;
  /** 선택 가능한 최소 날짜 (기본: 오늘) */
  minDate?: Date;
  /** 선택 가능한 최대 날짜 */
  maxDate?: Date;
}
