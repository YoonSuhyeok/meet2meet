import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/src/shared";
import type { CalendarProps, DateKey } from "../model/types";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateKey(date: Date): DateKey {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
    const t = date.getTime();
    const s = Math.min(start.getTime(), end.getTime());
    const e = Math.max(start.getTime(), end.getTime());
    return t >= s && t <= e;
}

function stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function Calendar({
    selected,
    onSelectionChange,
    minDate,
    maxDate,
}: CalendarProps) {
    const today = stripTime(new Date());
    const effectiveMin = minDate ? stripTime(minDate) : today;

    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    // ── 구간 선택 상태 ──
    const [rangeAnchor, setRangeAnchor] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
    const isDragging = useRef(false);
    const suppressClickRef = useRef(false);
    const ignoreMouseAfterTouchRef = useRef(false);
    const ignoreMouseTimerRef = useRef<number | null>(null);

    const markTouchInteraction = useCallback(() => {
        ignoreMouseAfterTouchRef.current = true;
        if (ignoreMouseTimerRef.current !== null) {
            window.clearTimeout(ignoreMouseTimerRef.current);
        }
        ignoreMouseTimerRef.current = window.setTimeout(() => {
            ignoreMouseAfterTouchRef.current = false;
            ignoreMouseTimerRef.current = null;
        }, 700);
    }, []);

    useEffect(() => {
        return () => {
            if (ignoreMouseTimerRef.current !== null) {
                window.clearTimeout(ignoreMouseTimerRef.current);
            }
        };
    }, []);

    const days = getDaysInMonth(viewYear, viewMonth);
    const firstDayOfWeek = days[0].getDay();

    // ── 월 탐색 ──
    const goToPrevMonth = () => {
        if (viewMonth === 0) {
            setViewYear(viewYear - 1);
            setViewMonth(11);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const goToNextMonth = () => {
        if (viewMonth === 11) {
            setViewYear(viewYear + 1);
            setViewMonth(0);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    // ── 날짜 활성 여부 ──
    const isDisabled = useCallback(
        (date: Date): boolean => {
            if (date < effectiveMin) return true;
            if (maxDate && date > stripTime(maxDate)) return true;
            return false;
        },
        [effectiveMin, maxDate],
    );

    // ── 구간의 날짜들을 Set으로 변환 ──
    const getRangeDates = useCallback(
        (start: Date, end: Date): DateKey[] => {
            const keys: DateKey[] = [];
            const s = start < end ? start : end;
            const e = start < end ? end : start;
            const cursor = new Date(s);
            while (cursor <= e) {
                if (!isDisabled(cursor)) {
                    keys.push(toDateKey(cursor));
                }
                cursor.setDate(cursor.getDate() + 1);
            }
            return keys;
        },
        [isDisabled],
    );

    // ── 선택 처리 ──
    const handleSelect = useCallback(
        (date: Date, shiftKey: boolean) => {
            if (isDisabled(date)) return;

            // Shift+클릭: 구간 선택
            if (shiftKey && rangeAnchor) {
                const rangeDates = getRangeDates(rangeAnchor, date);
                const next = new Set(selected);
                for (const key of rangeDates) {
                    next.add(key);
                }
                onSelectionChange(next);
                setRangeAnchor(null);
                setRangeEnd(null);
                return;
            }

            // 일반 클릭: 토글
            const key = toDateKey(date);
            const next = new Set(selected);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            onSelectionChange(next);
            setRangeAnchor(date);
            setRangeEnd(null);
        },
        [isDisabled, rangeAnchor, getRangeDates, selected, onSelectionChange],
    );

    // ── 드래그 선택 (마우스) ──
    const handleMouseDown = useCallback(
        (date: Date, e: React.MouseEvent) => {
            if (ignoreMouseAfterTouchRef.current) return;
            if (isDisabled(date)) return;
            if (e.shiftKey) {
                handleSelect(date, true);
                return;
            }
            e.preventDefault();
            suppressClickRef.current = false;
            isDragging.current = true;
            setRangeAnchor(date);
            setRangeEnd(date);
        },
        [isDisabled, handleSelect],
    );

    const handleMouseEnter = useCallback(
        (date: Date) => {
            if (ignoreMouseAfterTouchRef.current) return;
            if (!isDragging.current || isDisabled(date)) return;
            setRangeEnd(date);
        },
        [isDisabled],
    );

    const handleMouseUp = useCallback(() => {
        if (ignoreMouseAfterTouchRef.current) return;
        if (!isDragging.current || !rangeAnchor || !rangeEnd) {
            isDragging.current = false;
            return;
        }

        // 같은 날짜면 토글
        if (isSameDay(rangeAnchor, rangeEnd)) {
            const key = toDateKey(rangeAnchor);
            const next = new Set(selected);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            onSelectionChange(next);
        } else {
            // 구간 선택
            const rangeDates = getRangeDates(rangeAnchor, rangeEnd);
            const next = new Set(selected);
            for (const key of rangeDates) {
                next.add(key);
            }
            onSelectionChange(next);
        }

        suppressClickRef.current = true;
        isDragging.current = false;
        setRangeAnchor(null);
        setRangeEnd(null);
    }, [rangeAnchor, rangeEnd, selected, onSelectionChange, getRangeDates]);

    const handleCellClick = useCallback(
        (date: Date, shiftKey: boolean) => {
            if (isDisabled(date)) return;
            if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
            }
            handleSelect(date, shiftKey);
        },
        [isDisabled, handleSelect],
    );

    // ── 드래그 선택 (터치) ──
    // React onTouchMove는 passive이므로 preventDefault가 무시됩니다.
    // 명시적으로 { passive: false }로 네이티브 리스너를 붙입니다.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const touchAnchorRef = useRef<Date | null>(null);
    const touchDateRef = useRef<Date | null>(null);

    const handleTouchStart = useCallback(
        (date: Date) => {
            if (isDisabled(date)) return;
            markTouchInteraction();
            isDragging.current = true;
            touchAnchorRef.current = date;
            touchDateRef.current = date;
            setRangeAnchor(date);
            setRangeEnd(date);
        },
        [isDisabled, markTouchInteraction],
    );

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onTouchMoveNative = (e: TouchEvent) => {
            if (!isDragging.current) return;
            const touch = e.touches[0];
            if (!touch) return;
            // 드래그 중에는 스크롤을 막아서 안정적인 범위 선택을 보장
            e.preventDefault();
            const target = document.elementFromPoint(
                touch.clientX,
                touch.clientY,
            );
            const cell = target?.closest<HTMLElement>("[data-date]");
            const dateStr = cell?.getAttribute("data-date");
            if (!dateStr) return;
            const date = new Date(`${dateStr}T00:00:00`);
            if (Number.isNaN(date.getTime())) return;
            if (isDisabled(date)) return;
            // 이전과 같은 셀이면 상태 업데이트 생략 (렌더 떨주함 방지)
            const last = touchDateRef.current;
            if (last && isSameDay(last, date)) return;
            touchDateRef.current = date;
            setRangeEnd(date);
        };

        el.addEventListener("touchmove", onTouchMoveNative, { passive: false });
        return () => {
            el.removeEventListener("touchmove", onTouchMoveNative);
        };
    }, [isDisabled]);

    const handleTouchEnd = useCallback(() => {
        const start = rangeAnchor ?? touchAnchorRef.current;
        const end = rangeEnd ?? touchDateRef.current ?? start;

        if (!isDragging.current || !start || !end) {
            isDragging.current = false;
            touchAnchorRef.current = null;
            touchDateRef.current = null;
            return;
        }

        if (isSameDay(start, end)) {
            const key = toDateKey(start);
            const next = new Set(selected);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            onSelectionChange(next);
        } else {
            const rangeDates = getRangeDates(start, end);
            const next = new Set(selected);
            for (const key of rangeDates) {
                next.add(key);
            }
            onSelectionChange(next);
        }

        suppressClickRef.current = true;
        isDragging.current = false;
        touchAnchorRef.current = null;
        touchDateRef.current = null;
        setRangeAnchor(null);
        setRangeEnd(null);
    }, [rangeAnchor, rangeEnd, selected, onSelectionChange, getRangeDates]);

    // ── 프리뷰 여부 ──
    const isInDragPreview = useCallback(
        (date: Date): boolean => {
            if (!isDragging.current || !rangeAnchor || !rangeEnd) return false;
            return (
                isDateInRange(date, rangeAnchor, rangeEnd) && !isDisabled(date)
            );
        },
        [rangeAnchor, rangeEnd, isDisabled],
    );

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: custom drag-select calendar widget
        <div
            ref={containerRef}
            className="inline-block w-full max-w-sm select-none"
            style={{ touchAction: "none" }}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onPointerUp={(e) => {
                if (e.pointerType === "touch") {
                    handleTouchEnd();
                }
            }}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* 헤더 */}
            <div className="mb-2 flex items-center justify-between">
                <button
                    type="button"
                    onClick={goToPrevMonth}
                    className="rounded-md p-1.5 hover:bg-accent"
                    aria-label="이전 달"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">
                    {viewYear}년 {viewMonth + 1}월
                </span>
                <button
                    type="button"
                    onClick={goToNextMonth}
                    className="rounded-md p-1.5 hover:bg-accent"
                    aria-label="다음 달"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-0">
                {WEEK_DAYS.map((day) => (
                    <div
                        key={day}
                        className="flex h-9 items-center justify-center text-xs font-medium text-muted-foreground"
                    >
                        {day}
                    </div>
                ))}

                {/* 빈 칸 (첫째 주 시작 전) */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static empty cells never reorder
                    <div key={`empty-${i}`} className="h-9" />
                ))}

                {/* 날짜 셀 */}
                {days.map((date) => {
                    const key = toDateKey(date);
                    const disabled = isDisabled(date);
                    const isSelected = selected.has(key);
                    const isToday = isSameDay(date, today);
                    const inPreview = isInDragPreview(date);

                    return (
                        // biome-ignore lint/a11y/noStaticElementInteractions: custom drag-select calendar cell
                        <div
                            key={key}
                            data-date={key}
                            className={cn(
                                "flex h-9 cursor-pointer items-center justify-center rounded-md text-sm transition-colors duration-75",
                                disabled &&
                                    "pointer-events-none text-muted-foreground/40",
                                !disabled &&
                                    !isSelected &&
                                    !inPreview &&
                                    "hover:bg-accent",
                                isSelected &&
                                    !inPreview &&
                                    "bg-primary text-primary-foreground",
                                inPreview &&
                                    "bg-primary/40 text-foreground ring-1 ring-primary/30",
                                isToday &&
                                    !isSelected &&
                                    !inPreview &&
                                    "border border-primary/50 font-semibold",
                            )}
                            onMouseDown={(e) => handleMouseDown(date, e)}
                            onMouseEnter={() => handleMouseEnter(date)}
                            onPointerDown={(e) => {
                                if (e.pointerType === "touch") {
                                    handleTouchStart(date);
                                }
                            }}
                            onPointerUp={(e) => {
                                if (e.pointerType === "touch") {
                                    handleTouchEnd();
                                }
                            }}
                            onTouchStart={() => handleTouchStart(date)}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            onClick={(e) => handleCellClick(date, e.shiftKey)}
                        >
                            {date.getDate()}
                        </div>
                    );
                })}
            </div>

            {/* 안내 */}
            <p className="mt-2 text-xs text-muted-foreground">
                클릭으로 선택 · Shift+클릭 또는 드래그로 구간 선택
            </p>
        </div>
    );
}
