import {
    AlertCircle,
    BellRing,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Lock,
    LockOpen,
    LogIn,
    NotebookPen,
    Share2,
    Users,
} from "lucide-react";
import { cn } from "../../shared/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger";
type PreviewMode = "loading" | "error" | "interactive";
type ActionTone = "primary" | "secondary" | "warning";
type ActionState = "enabled" | "disabled";

export interface MeetingDetailAtlasAction {
    label: string;
    tone: ActionTone;
    state: ActionState;
}

export interface MeetingDetailAtlasProps {
    branchId: string;
    title: string;
    route: string;
    actor: string;
    statusLabel: string;
    statusTone: Tone;
    summary: string;
    goal: string;
    previewMode: PreviewMode;
    visibleElements: string[];
    hiddenElements: string[];
    notes: string[];
    actions: MeetingDetailAtlasAction[];
    stats?: Array<{ label: string; value: string }>;
    showLoginCta?: boolean;
    showHostControls?: boolean;
    showNotificationCard?: boolean;
    showSelectionSummary?: boolean;
    lockedMessage?: string;
    finalSlotLabel?: string;
    errorMessage?: string;
}

const toneClassName: Record<Tone, string> = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-destructive/10 text-destructive",
};

const actionClassName: Record<ActionTone, string> = {
    primary: "bg-primary text-primary-foreground",
    secondary: "border border-border bg-background text-foreground",
    warning: "bg-amber-500 text-white",
};

const miniDates = ["05/10", "05/11", "05/12"];
const miniTimes = ["18:00", "19:00", "20:00", "21:00"];
const counts = [
    [1, 3, 2],
    [2, 4, 3],
    [0, 2, 1],
    [1, 1, 0],
];

function SkeletonBlock({ className }: { className?: string }) {
    return (
        <div className={cn("animate-pulse rounded-xl bg-muted", className)} />
    );
}

function ActionPreviewButton({ action }: { action: MeetingDetailAtlasAction }) {
    return (
        <button
            type="button"
            disabled={action.state === "disabled"}
            className={cn(
                "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                actionClassName[action.tone],
                action.state === "disabled" && "cursor-not-allowed opacity-50",
            )}
        >
            {action.label}
        </button>
    );
}

function MiniHeatmap({
    locked,
    finalSlotLabel,
}: {
    locked: boolean;
    finalSlotLabel?: string;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
            <div
                className="grid"
                style={{
                    gridTemplateColumns: `4rem repeat(${miniDates.length}, minmax(0, 1fr))`,
                }}
            >
                <div className="h-10 border-b border-r border-border/60 bg-accent/50" />
                {miniDates.map((date) => (
                    <div
                        key={date}
                        className="flex h-10 items-center justify-center border-b border-border/60 bg-accent/30 text-xs font-medium text-muted-foreground"
                    >
                        {date}
                    </div>
                ))}

                {miniTimes.map((time, timeIndex) => (
                    <div key={time} className="contents">
                        <div className="flex h-11 items-center justify-end border-r border-border/60 pr-2 text-[11px] text-muted-foreground">
                            {time}
                        </div>
                        {miniDates.map((date, dateIndex) => {
                            const count = counts[timeIndex]?.[dateIndex] ?? 0;
                            const isFinalSlot =
                                finalSlotLabel === `${date} ${time}`;
                            return (
                                <div
                                    key={`${date}-${time}`}
                                    className={cn(
                                        "flex h-11 items-center justify-center border-t border-border/40 text-xs font-semibold",
                                        count === 0 &&
                                            "bg-background text-muted-foreground",
                                        count === 1 && "bg-sky-50 text-sky-700",
                                        count === 2 &&
                                            "bg-sky-100 text-sky-800",
                                        count >= 3 &&
                                            "bg-emerald-100 text-emerald-800",
                                        locked && "opacity-80",
                                        isFinalSlot &&
                                            "ring-2 ring-emerald-500 ring-inset",
                                    )}
                                >
                                    {count > 0 ? `${count}명` : "-"}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MeetingDetailAtlas({
    actions,
    actor,
    branchId,
    errorMessage,
    finalSlotLabel,
    goal,
    hiddenElements,
    lockedMessage,
    notes,
    previewMode,
    route,
    showHostControls = false,
    showLoginCta = false,
    showNotificationCard = true,
    showSelectionSummary = false,
    stats = [],
    statusLabel,
    statusTone,
    summary,
    title,
    visibleElements,
}: MeetingDetailAtlasProps) {
    const isLocked = Boolean(lockedMessage);

    return (
        <div className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6">
            <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,2fr)_22rem]">
                <div className="space-y-6">
                    <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    <span>{branchId}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{route}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span
                                        className={cn(
                                            "rounded-full px-3 py-1 text-xs font-medium",
                                            toneClassName[statusTone],
                                        )}
                                    >
                                        {statusLabel}
                                    </span>
                                    <span className="rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                                        사용자: {actor}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                                        {title}
                                    </h1>
                                    <p className="mt-2 max-w-[72ch] text-sm leading-6 text-muted-foreground">
                                        {summary}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-card/60 px-4 py-3 text-sm text-muted-foreground sm:max-w-xs">
                                <p className="font-semibold text-foreground">
                                    검토 목표
                                </p>
                                <p className="mt-1 leading-6">{goal}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                        {previewMode === "loading" ? (
                            <div className="space-y-4 py-4">
                                <SkeletonBlock className="h-8 w-64" />
                                <SkeletonBlock className="h-28" />
                                <SkeletonBlock className="h-64" />
                            </div>
                        ) : previewMode === "error" ? (
                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                                {errorMessage ?? "미팅을 찾을 수 없습니다."}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <section className="rounded-[1.5rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.22)]">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                        <div className="min-w-0 space-y-2">
                                            <h2 className="text-2xl font-semibold tracking-tight text-foreground break-words [overflow-wrap:anywhere]">
                                                수요일 저녁 번개
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={cn(
                                                        "rounded-full px-3 py-1 text-xs font-medium",
                                                        isLocked
                                                            ? "bg-amber-100 text-amber-800"
                                                            : "bg-emerald-100 text-emerald-700",
                                                    )}
                                                >
                                                    {isLocked
                                                        ? "투표 잠김"
                                                        : "투표 진행 중"}
                                                </span>
                                                <span className="rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                                                    미응답 3명
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                <CalendarDays className="mr-1 inline h-4 w-4" />
                                                강남역 · 18:00 ~ 22:00
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            {showHostControls && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                                                    >
                                                        <NotebookPen className="h-4 w-4" />
                                                        회고 작성
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                                                    >
                                                        <Share2 className="h-4 w-4" />
                                                        공유 링크 복사
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                                                    >
                                                        {isLocked ? (
                                                            <LockOpen className="h-4 w-4" />
                                                        ) : (
                                                            <Lock className="h-4 w-4" />
                                                        )}
                                                        {isLocked
                                                            ? "투표 재오픈"
                                                            : "투표 마감"}
                                                    </button>
                                                </>
                                            )}
                                            {showLoginCta && (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
                                                >
                                                    <LogIn className="h-4 w-4" />
                                                    로그인해서 내 응답 연동
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {stats.length > 0 && (
                                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                            {stats.map((stat) => (
                                                <div
                                                    key={stat.label}
                                                    className="rounded-2xl border border-border/70 bg-card/80 p-4"
                                                >
                                                    <p className="text-xs text-muted-foreground">
                                                        {stat.label}
                                                    </p>
                                                    <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                                                        {stat.label.includes(
                                                            "날짜",
                                                        ) ? (
                                                            <CalendarDays className="h-4 w-4" />
                                                        ) : stat.label.includes(
                                                              "참여자",
                                                          ) ? (
                                                            <Users className="h-4 w-4" />
                                                        ) : (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        )}
                                                        {stat.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {showNotificationCard && (
                                    <section className="rounded-[1.5rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.22)]">
                                        <h3 className="text-lg font-semibold text-foreground">
                                            미팅 알림
                                        </h3>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            이 미팅의 일정 변경과 시작 전 안내를
                                            알림으로 받을 수 있습니다.
                                        </p>
                                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground">
                                            <BellRing className="h-4 w-4" />
                                            {showLoginCta
                                                ? "로그인 후 알림 설정 가능"
                                                : isLocked
                                                  ? "확정 이후 알림만 제공"
                                                  : "알림 받기 토글"}
                                        </div>
                                    </section>
                                )}

                                <section className="rounded-[1.5rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.22)]">
                                    <div className="mb-4 flex items-center justify-between gap-4">
                                        <h3 className="text-lg font-semibold text-foreground">
                                            {showHostControls
                                                ? "시간표 히트맵"
                                                : "가능한 시간 선택"}
                                        </h3>
                                        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                                            <Clock3 className="h-3.5 w-3.5" />
                                            18:00 ~ 22:00
                                        </span>
                                    </div>

                                    {lockedMessage && (
                                        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                            {lockedMessage}
                                            {finalSlotLabel && (
                                                <div className="mt-1 font-medium">
                                                    확정 슬롯: {finalSlotLabel}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <MiniHeatmap
                                        locked={isLocked}
                                        finalSlotLabel={finalSlotLabel}
                                    />

                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {showHostControls
                                            ? "Host는 집계 중심으로 본다."
                                            : "Participant는 드래그로 빠르게 다중 선택할 수 있다."}
                                    </p>

                                    {showSelectionSummary && (
                                        <div className="mt-4 rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm text-foreground">
                                            선택된 슬롯 3개 · 마지막 저장:
                                            2026-05-11 20:45
                                        </div>
                                    )}

                                    <div className="mt-5 flex flex-wrap gap-2">
                                        {actions.map((action) => (
                                            <ActionPreviewButton
                                                key={action.label}
                                                action={action}
                                            />
                                        ))}
                                    </div>
                                </section>
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_16px_44px_-36px_rgba(15,23,42,0.36)]">
                        <h2 className="text-base font-semibold text-foreground">
                            보여야 하는 요소
                        </h2>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {visibleElements.map((item) => (
                                <li key={item} className="flex gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_16px_44px_-36px_rgba(15,23,42,0.36)]">
                        <h2 className="text-base font-semibold text-foreground">
                            숨김 / 비활성 규칙
                        </h2>
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {hiddenElements.map((item) => (
                                <li key={item} className="flex gap-2">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-[1.5rem] border border-border/70 bg-background p-5 shadow-[0_16px_44px_-36px_rgba(15,23,42,0.36)]">
                        <h2 className="text-base font-semibold text-foreground">
                            검토 메모
                        </h2>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                            {notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    </section>
                </aside>
            </div>
        </div>
    );
}
