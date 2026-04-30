import {
    BellRing,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Copy,
    Lock,
    LockOpen,
    NotebookPen,
    Users,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { apiFetch, useAuth } from "@/src/features/auth";
import { cn } from "@/src/shared";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import {
    createTimeSlotsFromRange,
    formatDateLabel,
    parseSlotKey,
} from "@/src/pages/meeting/model/time";
import type {
    MeetingDetailResponse,
    SlotSummary,
    Vote,
    VoteListResponse,
} from "@/src/pages/meeting/model/types";
import { normalizeMeetingDetailResponse } from "@/src/pages/meeting/model/types";

function getMeetingIdFromContext(pageContext: unknown): string | null {
    const maybeContext = pageContext as {
        routeParams?: Record<string, string>;
        urlPathname?: string;
    };
    if (maybeContext.routeParams?.meetingId) {
        return maybeContext.routeParams.meetingId;
    }

    const pathname =
        maybeContext.urlPathname ??
        (typeof window !== "undefined" ? window.location.pathname : "");
    const match = pathname.match(/^\/meeting\/([^/?#]+)/);
    return match?.[1] ?? null;
}

function toSummaryMap(summary: SlotSummary[] | undefined): Map<string, number> {
    const map = new Map<string, number>();
    if (!summary) return map;
    for (const item of summary) {
        map.set(item.slot, item.count);
    }
    return map;
}

function countClass(count: number, max: number): string {
    if (count <= 0 || max <= 0) return "bg-background";
    const ratio = count / max;
    if (ratio >= 0.8) return "bg-primary/85 text-primary-foreground";
    if (ratio >= 0.55) return "bg-primary/65 text-primary-foreground";
    if (ratio >= 0.3) return "bg-primary/40";
    return "bg-primary/20";
}

export default function Page() {
    const pageContext = usePageContext();
    const meetingId = useMemo(
        () => getMeetingIdFromContext(pageContext),
        [pageContext],
    );
    const { user, loading: authLoading } = useAuth();

    const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [reminderCopied, setReminderCopied] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user) {
            window.location.href = "/login";
            return;
        }

        if (!meetingId) {
            setError("미팅 ID를 확인할 수 없습니다.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const meetingRes = await apiFetch(`/api/meetings/${meetingId}`, {
                    signal: controller.signal,
                });

                if (!meetingRes.ok) {
                    if (meetingRes.status === 401) return;
                    const body = (await meetingRes.json().catch(() => null)) as
                        | { code?: string; message?: string }
                        | null;
                    throw new Error(
                        resolveServerErrorMessage(meetingRes.status, body),
                    );
                }

                const meetingRaw = (await meetingRes.json().catch(() => null)) as unknown;
                const meetingBody = normalizeMeetingDetailResponse(meetingRaw);
                if (!meetingBody) {
                    throw new Error("미팅 데이터 형식이 올바르지 않습니다.");
                }
                setMeeting(meetingBody);

                if ((meetingBody.participantCount ?? 0) <= 0) {
                    setVotes([]);
                    return;
                }

                const votesRes = await apiFetch(`/api/meetings/${meetingId}/votes`, {
                    signal: controller.signal,
                });
                if (votesRes.ok) {
                    const votesBody = (await votesRes.json()) as VoteListResponse;
                    setVotes(votesBody.votes ?? []);
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "미팅 정보를 불러오지 못했습니다.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => controller.abort();
    }, [authLoading, meetingId, user]);

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

    const summaryMap = useMemo(
        () => toSummaryMap(meeting?.voteSummary),
        [meeting?.voteSummary],
    );

    const maxCount = useMemo(() => {
        let max = 0;
        for (const value of summaryMap.values()) {
            if (value > max) max = value;
        }
        return max;
    }, [summaryMap]);

    const topSlots = useMemo(() => {
        const items = [...summaryMap.entries()]
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([slot, count]) => {
                const parsed = parseSlotKey(slot);
                return {
                    slot,
                    count,
                    label: parsed
                        ? `${formatDateLabel(parsed.date)} ${parsed.time}`
                        : slot,
                };
            });
        return items;
    }, [summaryMap]);

    const participantCount = Math.max(meeting?.participantCount ?? 0, votes.length);
    const pendingCount = Math.max(participantCount - votes.length, 0);
    const shareUrl =
        meeting && typeof window !== "undefined"
            ? `${window.location.origin}/m/${meeting.shortId}`
            : null;

    useEffect(() => {
        if (!meeting || typeof window === "undefined") {
            setIsClosed(false);
            return;
        }

        const key = `meeting:closed:${meeting.id}`;
        setIsClosed(window.localStorage.getItem(key) === "1");
    }, [meeting]);

    const handleCopyLink = useCallback(async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    }, [shareUrl]);

    const handleCopyReminder = useCallback(async () => {
        if (!meeting || !shareUrl) return;

        const text = [
            `[${meeting.title}] 가능한 시간 응답 부탁드려요.`,
            `링크: ${shareUrl}`,
            `초대 코드: ${meeting.inviteCode}`,
        ].join("\n");

        try {
            await navigator.clipboard.writeText(text);
            setReminderCopied(true);
            setTimeout(() => setReminderCopied(false), 1800);
        } catch {
            setReminderCopied(false);
        }
    }, [meeting, shareUrl]);

    const handleToggleClosed = useCallback(() => {
        if (!meeting || typeof window === "undefined") return;

        const key = `meeting:closed:${meeting.id}`;
        setIsClosed((prev) => {
            const next = !prev;
            if (next) {
                window.localStorage.setItem(key, "1");
            } else {
                window.localStorage.removeItem(key);
            }
            return next;
        });
    }, [meeting]);

    if (loading || authLoading) {
        return (
            <div className="space-y-4 py-12">
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                <div className="h-64 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    if (error || !meeting) {
        return (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                {error ?? "미팅을 찾을 수 없습니다."}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            {meeting.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-medium",
                                    isClosed
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-emerald-100 text-emerald-700",
                                )}
                            >
                                {isClosed ? "투표 마감" : "투표 진행 중"}
                            </span>
                            {pendingCount > 0 && (
                                <span className="rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                                    미응답 {pendingCount}명
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {meeting.location || "장소 미정"} · {meeting.timeRange.start} ~{" "}
                            {meeting.timeRange.end}
                        </p>
                        {meeting.description && (
                            <p className="max-w-[72ch] text-sm leading-6 text-muted-foreground">
                                {meeting.description}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <a
                            href={`/meeting/${meeting.id}/recap`}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                        >
                            <NotebookPen className="h-4 w-4" />
                            회고 작성
                        </a>

                        <button
                            type="button"
                            onClick={handleCopyLink}
                            className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                                copied
                                    ? "border-green-300 bg-green-50 text-green-700"
                                    : "border-border bg-background hover:bg-accent",
                            )}
                        >
                            <Copy className="h-4 w-4" />
                            {copied ? "링크 복사됨" : "공유 링크 복사"}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyReminder}
                            className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                                reminderCopied
                                    ? "border-green-300 bg-green-50 text-green-700"
                                    : "border-border bg-background hover:bg-accent",
                            )}
                        >
                            <BellRing className="h-4 w-4" />
                            {reminderCopied ? "리마인드 복사됨" : "리마인드 문구 복사"}
                        </button>

                        <button
                            type="button"
                            onClick={handleToggleClosed}
                            className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                                isClosed
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                    : "bg-amber-500 text-white hover:bg-amber-400",
                            )}
                        >
                            {isClosed ? (
                                <>
                                    <LockOpen className="h-4 w-4" />
                                    투표 재오픈
                                </>
                            ) : (
                                <>
                                    <Lock className="h-4 w-4" />
                                    투표 마감하기
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs text-muted-foreground">후보 날짜</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <CalendarDays className="h-4 w-4" />
                            {dates.length}일
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs text-muted-foreground">응답 참여자</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <Users className="h-4 w-4" />
                            {participantCount}명
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs text-muted-foreground">최고 겹침 슬롯</p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            {maxCount}명
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        시간표 히트맵
                    </h2>
                    <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {meeting.timeRange.start} ~ {meeting.timeRange.end}
                    </span>
                </div>

                {dates.length === 0 || timeSlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        표시할 시간표 데이터가 없습니다.
                    </p>
                ) : (
                    <div className="overflow-auto rounded-2xl border border-border/70 bg-background">
                        <div
                            className="grid min-w-[36rem]"
                            style={{
                                gridTemplateColumns: `4.2rem repeat(${dates.length}, minmax(4.5rem, 1fr))`,
                            }}
                        >
                            <div className="h-10 border-b border-r border-border/60" />
                            {dates.map((date) => (
                                <div
                                    key={date}
                                    className="flex h-10 items-center justify-center border-b border-border/60 text-xs font-medium text-muted-foreground"
                                >
                                    {formatDateLabel(date)}
                                </div>
                            ))}

                            {timeSlots.map((time) => (
                                <Fragment key={time}>
                                    <div className="flex h-8 items-center justify-end border-r border-border/60 pr-2 text-[11px] text-muted-foreground">
                                        {time}
                                    </div>
                                    {dates.map((date) => {
                                        const slotKey = `${date}-${time}`;
                                        const count = summaryMap.get(slotKey) ?? 0;
                                        return (
                                            <div
                                                key={slotKey}
                                                className={cn(
                                                    "flex h-8 items-center justify-center border border-border/40 text-[11px]",
                                                    countClass(count, maxCount),
                                                )}
                                            >
                                                {count > 0 ? count : ""}
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                )}

                {topSlots.length > 0 && (
                    <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            추천 시간대 Top 5
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {topSlots.map((item) => (
                                <span
                                    key={item.slot}
                                    className="rounded-full border border-border bg-accent px-3 py-1 text-xs text-foreground"
                                >
                                    {item.label} · {item.count}명
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <h2 className="text-lg font-semibold text-foreground">참여자 상태</h2>
                {pendingCount > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        아직 {pendingCount}명이 응답하지 않았습니다. 상단의 리마인드 문구 복사로 안내를 보낼 수 있습니다.
                    </p>
                )}
                {votes.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        아직 제출된 참여자 응답이 없습니다.
                    </p>
                ) : (
                    <div className="mt-4 space-y-2">
                        {votes.map((vote) => (
                            <div
                                key={vote.userId}
                                className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 px-4 py-3"
                            >
                                <span className="text-sm font-medium text-foreground">
                                    {vote.userName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {vote.slots.length} 슬롯 선택
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
