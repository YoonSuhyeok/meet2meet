import { useCallback, useRef, useState } from "react";
import type { DragMode, SlotKey } from "./types";
import { makeSlotKey } from "./types";

interface DragState {
  mode: DragMode;
  /** 드래그 중 영향 받는 슬롯 키 집합 */
  slots: Set<SlotKey>;
}

interface UseDragSelectOptions {
  selected: Set<SlotKey>;
  onSelectionChange: (selected: Set<SlotKey>) => void;
}

export function useDragSelect({ selected, onSelectionChange }: UseDragSelectOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  /** data-slot 속성에서 슬롯 키 추출 */
  const getSlotFromPoint = useCallback((x: number, y: number): SlotKey | null => {
    const el = document.elementFromPoint(x, y);
    return el?.getAttribute("data-slot") ?? null;
  }, []);

  /** 드래그 시작 (mouse/touch 공통) */
  const startDrag = useCallback(
    (x: number, y: number) => {
      const slot = getSlotFromPoint(x, y);
      if (!slot) return;

      const mode: DragMode = selected.has(slot) ? "deselect" : "select";
      const state: DragState = { mode, slots: new Set([slot]) };
      dragRef.current = state;
      setDragState(state);
    },
    [selected, getSlotFromPoint],
  );

  /** 드래그 이동 (mouse/touch 공통) */
  const moveDrag = useCallback(
    (x: number, y: number) => {
      if (!dragRef.current) return;

      const slot = getSlotFromPoint(x, y);
      if (!slot) return;

      const prev = dragRef.current;
      if (prev.slots.has(slot)) return; // 이미 포함된 셀

      const newSlots = new Set(prev.slots);
      newSlots.add(slot);
      const state: DragState = { mode: prev.mode, slots: newSlots };
      dragRef.current = state;
      setDragState(state);
    },
    [getSlotFromPoint],
  );

  /** 드래그 종료 — 선택 확정 */
  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state) return;

    const next = new Set(selected);
    for (const slot of state.slots) {
      if (state.mode === "select") {
        next.add(slot);
      } else {
        next.delete(slot);
      }
    }

    dragRef.current = null;
    setDragState(null);
    onSelectionChange(next);
  }, [selected, onSelectionChange]);

  /** 특정 슬롯의 드래그 프리뷰 상태 계산 */
  const getDragPreview = useCallback(
    (slotKey: SlotKey): boolean | null => {
      if (!dragState || !dragState.slots.has(slotKey)) return null;
      return dragState.mode === "select";
    },
    [dragState],
  );

  return {
    startDrag,
    moveDrag,
    endDrag,
    getDragPreview,
    isDragging: dragState !== null,
  };
}
