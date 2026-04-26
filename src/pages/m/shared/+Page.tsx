import { ArrowRight, LogIn, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { type SlotKey, makeSlotKey } from "@/src/entities/meeting";
import { apiFetch, useAuth } from "@/src/features/auth";
import { cn } from "@/src/shared";
import { TimeGrid } from "@/src/widgets/time-picker";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import {
    createTimeSlotsFromRange,
    formatDateLabel,
} from "@/src/pages/meeting/model/time";
import type {
    MeetingDetailResponse,
    Vote,
    VoteListResponse,
} from "@/src/pages/meeting/model/types";

function getShortIdFromContext(pageContext: unknown): string | null {
    const maybeContext = pageContext as {
        routeParams?: Record<string, string>;
        urlPathname?: string;
    };
    if (maybeContext.routeParams?.shortId) {
        return maybeContext.routeParams.shortId;
    }

    const pathname =
        maybeContext.urlPathname ??
        (typeof window !== "undefined" ? window.location.pathname : "");
    const match = pathname.match(/^\/m\/([^/?#]+)/);
    return match?.[1] ?? null;
}

function buildInitialSelected(vote: Vote | null): Set<SlotKey> {
    return new Set(vote?.slots ?? []);
}

export default function Page() {
    const pageContext = usePageContext();
    const shortId = useMemo(() => getShortIdFromContext(pageContext), [pageContext]);
    const { user, loading: authLoading } = useAuth();

    const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
    const [myVote, setMyVote] = useState<Vote | null>(null);
    const [selected, setSelected] = useState<Set<SlotKey>>(new Set());
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isClosed, setIsClosed] = useState(false);

    useEffect(() => {
        if (!shortId) {
            setError("공유 링크를 확인할 수 없습니다.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const loadMeeting = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/meetings/s/${shortId}`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { code?: string; message?: string }
                        | null;
                    throw new Error(resolveServerErrorMessage(res.status, body));
                }

                const detail = (await res.json()) as MeetingDetailResponse;
                setMeeting(detail);
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "미팅 정보를 불러오지 못했습니다.",
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadMeeting();
        return () => controller.abort();
    }, [shortId]);

    useEffect(() => {
        if (!meeting || !user) {
            setMyVote(null);
            setSelected(new Set());
            return;
        }

        const controller = new AbortController();
        const loadMyVote = async () => {
            try {
                const res = await fetch(`/api/meetings/${meeting.id}/votes`, {
                    signal: controller.signal,
                });
                if (!res.ok) return;

                const body = (await res.json()) as VoteListResponse;
                const vote = (body.votes ?? []).find((item) => item.userId === user.id) ?? null;
                setMyVote(vote);
                setSelected(buildInitialSelected(vote));
            } catch {
                // 조회 실패는 제출 가능성에 영향을 주지 않으므로 무시
            }
        };

        loadMyVote();
        return () => controller.abort();
    }, [meeting, user]);

    useEffect(() => {
        if (!meeting || typeof window === "undefined") {
            setIsClosed(false);
            return;
        }

        const key = `meeting:closed:${meeting.id}`;
        const sync = () => {
            setIsClosed(window.localStorage.getItem(key) === "1");
        };

        sync();
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, [meeting]);

    const dates = meeting?.dates ?? [];
    const timeSlots = useMemo(
        () =>
            meeting
                ? createTimeSlotsFromRange(
                      meeting.timeRange.start,
                      meeting.timeRange.end,
                      30,
                  )
                : [],
        [meeting],
    );

    const summaryText = useMemo(
        () => dates.map((date) => formatDateLabel(date)).join(", "),
        [dates],
    );

    const canSubmit = !!user && selected.size > 0 && !submitting && !isClosed;

    const handleSelectionChange = useCallback(
        (next: Set<SlotKey>) => {
            if (isClosed) return;
            setSelected(next);
        },
        [isClosed],
    );

    const handleSubmit = useCallback(async () => {
        if (!meeting) return;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        if (isClosed) {
            setStatusMessage("이미 마감된 미팅입니다. 주최자에게 재오픈을 요청해주세요.");
            return;
        }

        if (selected.size === 0) {
            setStatusMessage("최소 1개 이상의 슬롯을 선택해주세요.");
            return;
        }

        setSubmitting(true);
        setStatusMessage(null);

        try {
            const slots = [...selected].sort();
            const res = await apiFetch(`/api/meetings/${meeting.id}/votes`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots }),
            });

            if (!res.ok) {
                if (res.status === 401) return;
                const body = (await res.json().catch(() => null)) as
                    | { code?: string; message?: string }
                    | null;
                throw new Error(resolveServerErrorMessage(res.status, body));
            }

            const vote = (await res.json().catch(() => null)) as Vote | null;
            if (vote) {
                setMyVote(vote);
            }
            setStatusMessage("응답이 저장되었습니다.");
        } catch (err) {
            setStatusMessage(
                err instanceof Error
                    ? err.message
                    : "응답 저장에 실패했습니다. 다시 시도해주세요.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [isClosed, meeting, selected, user]);

    const handleReset = useCallback(() => {
        setSelected(new Set());
        setStatusMessage(null);
    }, []);

    if (loading || authLoading) {
        return (
            <div className="space-y-4 py-12">
                <div className="h-8 w-56 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                {error ?? "유효하지 않은 공유 링크입니다."}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Shared Meeting
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {meeting.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {summaryText || "후보 날짜 없음"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    투표 시간: {meeting.timeRange.start} ~ {meeting.timeRange.end}
                </p>
                {isClosed && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        이 미팅은 현재 마감 상태입니다. 투표를 제출하거나 수정할 수 없습니다.
                    </div>
                )}
                {!user && (
                    <a
                        href="/login"
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                    >
                        <LogIn className="h-4 w-4" />
                        로그인하고 응답 제출
                        <ArrowRight className="h-4 w-4" />
                    </a>
                )}
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">가능한 시간 선택</h2>
                    <span className="rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                        {selected.size}개 슬롯 선택됨
                    </span>
                </div>

                {dates.length === 0 || timeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        선택 가능한 시간표가 없습니다.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background p-3 sm:p-4">
                        <div className="flex justify-center">
                            <TimeGrid
                                dates={dates}
                                timeSlots={timeSlots}
                                selected={selected}
                                onSelectionChange={handleSelectionChange}
                            />
                        </div>
                    </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                    드래그로 빠르게 다중 선택/해제할 수 있습니다.
                </p>

                {myVote?.updatedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        마지막 저장: {new Date(myVote.updatedAt).toLocaleString()}
                    </p>
                )}

                {statusMessage && (
                    <div className="mt-4 rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm text-foreground">
                        {statusMessage}
                    </div>
                )}

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={isClosed}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
                    >
                        <RotateCcw className="h-4 w-4" />
                        내 선택 초기화
                    </button>

                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors",
                            canSubmit
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "pointer-events-none bg-muted text-muted-foreground opacity-60",
                        )}
                    >
                        <Send className="h-4 w-4" />
                        {submitting ? "저장 중..." : "응답 제출"}
                    </button>
                </div>
            </section>

            {user && selected.size > 0 && (
                <section className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5">
                    <h3 className="text-sm font-semibold text-foreground">선택 미리보기</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {[...selected]
                            .sort()
                            .slice(0, 12)
                            .map((slot) => {
                                const date = slot.slice(0, 10);
                                const time = slot.slice(11);
                                return (
                                    <span
                                        key={makeSlotKey(date, time)}
                                        className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                                    >
                                        {formatDateLabel(date)} {time}
                                    </span>
                                );
                            })}
                    </div>
                </section>
            )}
        </div>
    );
}
