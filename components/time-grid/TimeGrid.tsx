import { useCallback, useRef } from "react";
import { TimeCell } from "./TimeCell";
import type { TimeGridProps } from "./types";
import { makeSlotKey } from "./types";
import { useDragSelect } from "./useDragSelect";

export function TimeGrid({ dates, timeSlots, selected, onSelectionChange }: TimeGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { startDrag, moveDrag, endDrag, getDragPreview, isDragging } = useDragSelect({
    selected,
    onSelectionChange,
  });

  // ── Mouse 이벤트 ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    },
    [startDrag],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      moveDrag(e.clientX, e.clientY);
    },
    [moveDrag],
  );

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // ── Touch 이벤트 ──
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
    },
    [startDrag],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // 스크롤 방지
      const touch = e.touches[0];
      moveDrag(touch.clientX, touch.clientY);
    },
    [moveDrag],
  );

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return (
    <div
      ref={gridRef}
      className="inline-block select-none overflow-auto"
      style={{ touchAction: "none" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* CSS Grid: 1열(시간 레이블) + N열(날짜) */}
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `4rem repeat(${dates.length}, 1fr)`,
        }}
      >
        {/* 헤더 행: 좌상단 빈 셀 + 날짜 헤더 */}
        <div className="h-10" />
        {dates.map((date) => (
          <div
            key={date}
            className="flex h-10 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {date}
          </div>
        ))}

        {/* 본문 행: 시간 레이블 + 셀 */}
        {timeSlots.map((time) => (
          <>
            {/* 시간 레이블 */}
            <div
              key={`label-${time}`}
              className="flex h-8 items-center justify-end pr-2 text-xs text-muted-foreground"
            >
              {time}
            </div>

            {/* 각 날짜별 셀 */}
            {dates.map((date) => {
              const slotKey = makeSlotKey(date, time);
              return (
                <TimeCell
                  key={slotKey}
                  slotKey={slotKey}
                  isSelected={selected.has(slotKey)}
                  isDragPreview={getDragPreview(slotKey)}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
