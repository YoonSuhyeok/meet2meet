import { cn } from "@/lib/utils";

interface TimeCellProps {
  /** 이 셀이 확정 선택 상태인지 */
  isSelected: boolean;
  /** 드래그 중 임시 선택/해제 상태 (null이면 드래그 영향 없음) */
  isDragPreview: boolean | null;
  /** data attribute로 사용할 슬롯 키 */
  slotKey: string;
}

export function TimeCell({ isSelected, isDragPreview, slotKey }: TimeCellProps) {
  // 최종 표시 상태: 드래그 프리뷰가 있으면 그걸 우선, 아니면 확정 상태
  const visualSelected = isDragPreview !== null ? isDragPreview : isSelected;

  return (
    <div
      data-slot={slotKey}
      className={cn(
        "h-8 min-w-10 border border-border/50 transition-colors duration-75 select-none",
        visualSelected
          ? "bg-primary/80 border-primary/60"
          : "bg-background hover:bg-accent/50",
        isDragPreview !== null && "ring-1 ring-ring/30",
      )}
    />
  );
}
