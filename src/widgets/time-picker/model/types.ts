import type { SlotKey } from "@/src/entities/meeting";

/** TimeGrid에 전달할 props */
export interface TimeGridProps {
  dates: string[];
  timeSlots: string[];
  selected: Set<SlotKey>;
  onSelectionChange: (selected: Set<SlotKey>) => void;
}
