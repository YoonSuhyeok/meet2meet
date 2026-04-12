import { useCallback, useRef, useState } from "react";
import type { SlotKey } from "@/src/entities/meeting";

/** 드래그 모드: 선택 또는 해제 */
export type DragMode = "select" | "deselect";

interface DragState {
    mode: DragMode;
    slots: Set<SlotKey>;
}

interface UseDragSelectOptions {
    selected: Set<SlotKey>;
    onSelectionChange: (selected: Set<SlotKey>) => void;
}

export function useDragSelect({
    selected,
    onSelectionChange,
}: UseDragSelectOptions) {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const dragRef = useRef<DragState | null>(null);

    const getSlotFromPoint = useCallback(
        (x: number, y: number): SlotKey | null => {
            const el = document.elementFromPoint(x, y);
            return el?.getAttribute("data-slot") ?? null;
        },
        [],
    );

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

    const moveDrag = useCallback(
        (x: number, y: number) => {
            if (!dragRef.current) return;

            const slot = getSlotFromPoint(x, y);
            if (!slot) return;

            const prev = dragRef.current;
            if (prev.slots.has(slot)) return;

            const newSlots = new Set(prev.slots);
            newSlots.add(slot);
            const state: DragState = { mode: prev.mode, slots: newSlots };
            dragRef.current = state;
            setDragState(state);
        },
        [getSlotFromPoint],
    );

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

    const getDragPreview = useCallback(
        (slotKey: SlotKey): boolean | null => {
            if (!dragState?.slots.has(slotKey)) return null;
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
