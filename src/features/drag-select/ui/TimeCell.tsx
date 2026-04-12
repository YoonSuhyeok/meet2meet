import { cn } from "@/src/shared";

interface TimeCellProps {
  isSelected: boolean;
  isDragPreview: boolean | null;
  slotKey: string;
}

export function TimeCell({ isSelected, isDragPreview, slotKey }: TimeCellProps) {
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
