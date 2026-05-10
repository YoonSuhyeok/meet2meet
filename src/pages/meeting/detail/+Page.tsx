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
import { apiFetch, savePostLoginRedirect, useAuth } from "@/src/features/auth";
import { AttendanceNudgeButton } from "@/src/features/notification/AttendanceNudgeButton";
import { PushNotificationToggle } from "@/src/features/notification";
import {
    createTimeSlotsFromRange,
    formatDateLabel,
    parseSlotKey,
} from "@/src/pages/meeting/model/time";
import {
    buildSlotPresentationGroups,
    countSlotPresentationItems,
} from "@/src/pages/meeting/model/slotPresentation";
import type {
    MeetingDetailResponse,
    MeetingFinalResponse,
    SlotSummary,
    Vote,
    VoteListResponse,
} from "@/src/pages/meeting/model/types";
import { normalizeMeetingDetailResponse } from "@/src/pages/meeting/model/types";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import { cn } from "@/src/shared";

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

function formatVoteSlotLabel(slot: string): string {
    const parsed = parseSlotKey(slot);
    if (!parsed) return slot;
    return `${formatDateLabel(parsed.date)} ${parsed.time}`;
}

function formatUpdatedAtLabel(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "업데이트 시각 없음";

    return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(parsed);
}

function formatCompactDateLabel(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
    }).format(parsed);
}

function formatCompactDateWithWeekday(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
    }).format(parsed);
}

function toMeetingFinal(
    meeting: MeetingDetailResponse | null,
): MeetingFinalResponse | null {
    if (!meeting?.finalSlot || !meeting.finalizedAt) {
        return null;
    }

    return {
        meetingId: meeting.id,
        slot: meeting.finalSlot,
        finalizedBy: meeting.finalizedBy ?? meeting.hostName,
        finalizedAt: meeting.finalizedAt,
    };
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
    const [finalized, setFinalized] = useState<MeetingFinalResponse | null>(null);
    const [finalizeBusy, setFinalizeBusy] = useState(false);
    const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);
    const [mobileDateIndex, setMobileDateIndex] = useState(0);

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
                const meetingRes = await apiFetch(
                    `/api/meetings/${meetingId}`,
                    {
                        signal: controller.signal,
                    },
                );

                if (!meetingRes.ok) {
                    if (meetingRes.status === 401) return;
                    const body = (await meetingRes
                        .json()
                        .catch(() => null)) as {
                        code?: string;
                        message?: string;
                    } | null;
                    throw new Error(
                        resolveServerErrorMessage(meetingRes.status, body),
                    );
                }

                const meetingRaw = (await meetingRes
                    .json()
                    .catch(() => null)) as unknown;
                const meetingBody = normalizeMeetingDetailResponse(meetingRaw);
                if (!meetingBody) {
                    throw new Error("미팅 데이터 형식이 올바르지 않습니다.");
                }
                setMeeting(meetingBody);
                setFinalized(toMeetingFinal(meetingBody));
                setIsClosed(meetingBody.isClosed || !!meetingBody.finalSlot);

                const votesRes = await apiFetch(
                    `/api/meetings/${meetingId}/votes`,
                    {
                        signal: controller.signal,
                    },
                );
                if (votesRes.ok) {
                    const votesBody =
                        (await votesRes.json()) as VoteListResponse;
                    setVotes(votesBody.votes ?? []);
                } else {
                    setVotes([]);
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
        () => {
            const meetingSummary = toSummaryMap(meeting?.voteSummary);
            if (meetingSummary.size > 0) {
                return meetingSummary;
            }

            const voteSummary = new Map<string, number>();
            for (const vote of votes) {
                for (const slot of vote.slots ?? []) {
                    voteSummary.set(slot, (voteSummary.get(slot) ?? 0) + 1);
                }
            }

            return voteSummary;
        },
        [meeting?.voteSummary, votes],
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

    const voteSlotPresentation = useMemo(() => {
        const presentation = new Map<
            string,
            {
                groups: ReturnType<typeof buildSlotPresentationGroups>;
                rangeCount: number;
            }
        >();

        for (const vote of votes) {
            const groups = buildSlotPresentationGroups(vote.slots ?? []);
            presentation.set(vote.userId, {
                groups,
                rangeCount: countSlotPresentationItems(groups),
            });
        }

        return presentation;
    }, [votes]);

    useEffect(() => {
        setMobileDateIndex((prev) => {
            if (dates.length === 0) return 0;
            return Math.min(prev, dates.length - 1);
        });
    }, [dates.length]);

    const mobileSelectedDate = dates[mobileDateIndex] ?? dates[0] ?? null;

    const heatmapGridStyle = useMemo(() => {
        const timeColumnRem = 3.6;
        const minCellRem = 3.1;
        const minGridWidthRem = Math.max(
            20,
            timeColumnRem + dates.length * minCellRem,
        );

        return {
            minWidth: `${minGridWidthRem}rem`,
            gridTemplateColumns: `${timeColumnRem}rem repeat(${dates.length}, minmax(clamp(${minCellRem}rem, 9vw, 4.5rem), 1fr))`,
        };
    }, [dates.length]);

    const participantCount = Math.max(
        meeting?.participantCount ?? 0,
        votes.length,
    );
    const pendingCount = Math.max(participantCount - votes.length, 0);
    const isHost = !!user && !!meeting && user.id === meeting.hostId;
    const shareUrl =
        meeting && typeof window !== "undefined"
            ? `${window.location.origin}/m/${meeting.shortId}`
            : null;

    useEffect(() => {
        if (!meeting) {
            setIsClosed(false);
            return;
        }

        setIsClosed(meeting.isClosed || !!finalized);
    }, [finalized, meeting]);

    const handleFinalize = useCallback(
        async (slot: string) => {
            if (!meeting || !isHost) return;

            setFinalizeBusy(true);
            setFinalizeMessage(null);
            try {
                const res = await apiFetch(`/api/meetings/${meeting.id}/finalize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slot }),
                });

                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { code?: string; message?: string; error?: string }
                        | null;
                    throw new Error(
                        resolveServerErrorMessage(res.status, {
                            code: body?.code,
                            message: body?.message ?? body?.error,
                        }),
                    );
                }

                const body = (await res.json()) as MeetingFinalResponse;
                setFinalized({
                    meetingId: String(body.meetingId),
                    slot: body.slot,
                    finalizedBy: body.finalizedBy,
                    finalizedAt: body.finalizedAt,
                });
                setMeeting((prev) =>
                    prev
                        ? {
                              ...prev,
                              isClosed: true,
                              finalSlot: body.slot,
                              finalizedBy: body.finalizedBy,
                              finalizedAt: body.finalizedAt,
                          }
                        : prev,
                );
                setIsClosed(true);
                setFinalizeMessage("최종 일정이 확정되었습니다.");
            } catch (err) {
                setFinalizeMessage(
                    err instanceof Error
                        ? err.message
                        : "일정 확정에 실패했습니다. 다시 시도해주세요.",
                );
            } finally {
                setFinalizeBusy(false);
            }
        },
        [isHost, meeting],
    );

    const handleClearFinalization = useCallback(() => {
        if (!meeting || !isHost) return;

        setFinalizeBusy(true);
        setFinalizeMessage(null);
        void apiFetch(`/api/meetings/${meeting.id}/finalize`, {
            method: "DELETE",
        })
            .then(async (res) => {
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { code?: string; message?: string; error?: string }
                        | null;
                    throw new Error(
                        resolveServerErrorMessage(res.status, {
                            code: body?.code,
                            message: body?.message ?? body?.error,
                        }),
                    );
                }

                setFinalized(null);
                setMeeting((prev) =>
                    prev
                        ? {
                              ...prev,
                              finalSlot: undefined,
                              finalizedBy: undefined,
                              finalizedAt: undefined,
                          }
                        : prev,
                );
                setFinalizeMessage("확정이 해제되었습니다.");
            })
            .catch((err) => {
                setFinalizeMessage(
                    err instanceof Error
                        ? err.message
                        : "확정 해제에 실패했습니다. 다시 시도해주세요.",
                );
            })
            .finally(() => setFinalizeBusy(false));
    }, [isHost, meeting]);

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
        if (!meeting || finalized) return;

        const nextClosed = !isClosed;
        setFinalizeBusy(true);
        setFinalizeMessage(null);
        void apiFetch(`/api/meetings/${meeting.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isClosed: nextClosed }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as
                        | { code?: string; message?: string; error?: string }
                        | null;
                    throw new Error(
                        resolveServerErrorMessage(res.status, {
                            code: body?.code,
                            message: body?.message ?? body?.error,
                        }),
                    );
                }

                const body = (await res.json()) as {
                    meetingId: string | number;
                    isClosed: boolean;
                    closedAt?: string;
                };
                setIsClosed(!!body.isClosed);
                setMeeting((prev) =>
                    prev
                        ? {
                              ...prev,
                              isClosed: !!body.isClosed,
                              closedAt:
                                  typeof body.closedAt === "string"
                                      ? body.closedAt
                                      : undefined,
                          }
                        : prev,
                );
            })
            .catch((err) => {
                setFinalizeMessage(
                    err instanceof Error
                        ? err.message
                        : "투표 상태 변경에 실패했습니다.",
                );
            })
            .finally(() => setFinalizeBusy(false));
    }, [finalized, isClosed, meeting]);

    const handleLoginRequiredForNotification = useCallback(() => {
        if (!meeting) return;
        savePostLoginRedirect(`/meeting/${meeting.id}`);
        window.location.href = "/login";
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
                    <div className="min-w-0 space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground break-words [overflow-wrap:anywhere] sm:text-3xl">
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
                            {meeting.location || "장소 미정"} ·{" "}
                            {meeting.timeRange.start} ~ {meeting.timeRange.end}
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
                            {reminderCopied
                                ? "리마인드 복사됨"
                                : "리마인드 문구 복사"}
                        </button>

                        {isHost && isClosed && pendingCount > 0 && (
                            <AttendanceNudgeButton
                                meetingId={meeting.id}
                                pendingCount={pendingCount}
                            />
                        )}

                        <button
                            type="button"
                            onClick={handleToggleClosed}
                            disabled={!!finalized}
                            className={cn(
                                "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                                isClosed
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                    : "bg-amber-500 text-white hover:bg-amber-400",
                                finalized && "cursor-not-allowed opacity-60",
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
                        <p className="text-xs text-muted-foreground">
                            후보 날짜
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <CalendarDays className="h-4 w-4" />
                            {dates.length}일
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs text-muted-foreground">
                            응답 참여자
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <Users className="h-4 w-4" />
                            {participantCount}명
                        </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                        <p className="text-xs text-muted-foreground">
                            최고 겹침 슬롯
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            {maxCount}명
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <h2 className="text-lg font-semibold text-foreground">미팅 알림</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    이 미팅의 일정 변경과 시작 전 안내를 알림으로 받을 수 있습니다.
                </p>
                <div className="mt-4">
                    <PushNotificationToggle
                        meetingId={meeting.id}
                        isLoggedIn={!!user}
                        isFinalized={!!finalized}
                        onLoginRequired={handleLoginRequiredForNotification}
                    />
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
                    <>
                        <div className="sm:hidden">
                            <p className="mb-2 text-xs text-muted-foreground">
                                날짜를 선택하면 해당 일자의 시간대만 집중해서 볼 수 있습니다.
                            </p>
                            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                                {dates.map((date, index) => {
                                    const selected = index === mobileDateIndex;
                                    return (
                                        <button
                                            key={`mobile-date-${date}`}
                                            type="button"
                                            onClick={() =>
                                                setMobileDateIndex(index)
                                            }
                                            className={cn(
                                                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                                                selected
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-border bg-background text-muted-foreground",
                                            )}
                                        >
                                            {formatCompactDateWithWeekday(date)}
                                        </button>
                                    );
                                })}
                            </div>

                            {mobileSelectedDate && (
                                <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                                    <div className="grid grid-cols-[3.6rem_1fr]">
                                        <div className="h-9 border-b border-r border-border/60 bg-accent/60" />
                                        <div className="flex h-9 items-center justify-between border-b border-border/60 px-3 text-xs font-medium text-foreground">
                                            <span>
                                                {formatDateLabel(
                                                    mobileSelectedDate,
                                                )}
                                            </span>
                                            <span className="text-muted-foreground">
                                                참여 인원
                                            </span>
                                        </div>

                                        {timeSlots.map((time) => {
                                            const slotKey =
                                                `${mobileSelectedDate}-${time}`;
                                            const count =
                                                summaryMap.get(slotKey) ?? 0;
                                            const isFinalSlot =
                                                finalized?.slot === slotKey;

                                            return (
                                                <Fragment
                                                    key={`mobile-${slotKey}`}
                                                >
                                                    <div className="flex h-9 items-center justify-end border-b border-r border-border/60 pr-2 text-[11px] text-muted-foreground">
                                                        {time}
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            "flex h-9 items-center justify-between border-b border-border/40 px-3 text-xs",
                                                            countClass(
                                                                count,
                                                                maxCount,
                                                            ),
                                                            isFinalSlot &&
                                                                "border-emerald-500 ring-1 ring-emerald-400/80",
                                                        )}
                                                    >
                                                        <span className="text-muted-foreground">
                                                            {count > 0
                                                                ? "가능"
                                                                : "-"}
                                                        </span>
                                                        <span className="text-sm font-semibold">
                                                            {count > 0
                                                                ? `${count}명`
                                                                : ""}
                                                        </span>
                                                    </div>
                                                </Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="hidden overflow-auto rounded-2xl border border-border/70 bg-background sm:block">
                            <div className="grid" style={heatmapGridStyle}>
                                <div className="sticky left-0 top-0 z-30 h-10 border-b border-r border-border/60 bg-background" />
                                {dates.map((date) => (
                                    <div
                                        key={date}
                                        className="sticky top-0 z-20 flex h-10 items-center justify-center border-b border-border/60 bg-background px-1 text-center text-xs font-medium text-muted-foreground"
                                        title={formatDateLabel(date)}
                                    >
                                        {formatCompactDateLabel(date)}
                                    </div>
                                ))}

                                {timeSlots.map((time) => (
                                    <Fragment key={time}>
                                        <div className="sticky left-0 z-10 flex h-8 items-center justify-end border-r border-border/60 bg-background pr-2 text-[11px] text-muted-foreground">
                                            {time}
                                        </div>
                                        {dates.map((date) => {
                                            const slotKey = `${date}-${time}`;
                                            const count =
                                                summaryMap.get(slotKey) ?? 0;
                                            const isFinalSlot =
                                                finalized?.slot === slotKey;
                                            return (
                                                <div
                                                    key={slotKey}
                                                    className={cn(
                                                        "flex h-8 items-center justify-center border border-border/40 px-1 text-[11px]",
                                                        countClass(
                                                            count,
                                                            maxCount,
                                                        ),
                                                        isFinalSlot &&
                                                            "border-emerald-500 ring-2 ring-emerald-400/70",
                                                    )}
                                                    title={`${formatDateLabel(date)} ${time} · ${count}명`}
                                                >
                                                    {count > 0 ? count : ""}
                                                </div>
                                            );
                                        })}
                                    </Fragment>
                                ))}
                        </div>
                        </div>
                    </>
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

                {finalized && (
                    <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <p className="font-semibold">최종 일정이 확정되었습니다.</p>
                        <p className="mt-1">
                            {formatVoteSlotLabel(finalized.slot)} · {finalized.finalizedBy}
                        </p>
                    </div>
                )}

                {isHost && topSlots.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-card/70 p-4">
                        <p className="text-sm font-semibold text-foreground">
                            호스트 일정 확정
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            추천 슬롯을 선택해 최종 일정을 확정하면 투표가 잠금됩니다.
                        </p>

                        {!finalized ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {topSlots.map((item) => (
                                    <button
                                        key={`finalize-${item.slot}`}
                                        type="button"
                                        disabled={finalizeBusy}
                                        onClick={() => handleFinalize(item.slot)}
                                        className="rounded-full border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                                    >
                                        {item.label} 확정
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <button
                                type="button"
                                disabled={finalizeBusy}
                                onClick={handleClearFinalization}
                                className="mt-3 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                            >
                                확정 해제
                            </button>
                        )}
                        {finalizeMessage && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                {finalizeMessage}
                            </p>
                        )}
                    </div>
                )}
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <h2 className="text-lg font-semibold text-foreground">
                    참여자 상태
                </h2>
                {pendingCount > 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        아직 {pendingCount}명이 응답하지 않았습니다. 상단의
                        리마인드 문구 복사로 안내를 보낼 수 있습니다.
                    </p>
                )}
                {votes.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        아직 제출된 참여자 응답이 없습니다.
                    </p>
                ) : (
                    <div className="mt-4 space-y-2">
                        {votes.map((vote) => {
                            const normalized =
                                voteSlotPresentation.get(vote.userId) ??
                                (() => {
                                    const groups = buildSlotPresentationGroups(
                                        vote.slots ?? [],
                                    );
                                    return {
                                        groups,
                                        rangeCount:
                                            countSlotPresentationItems(groups),
                                    };
                                })();

                            return (
                                <div
                                    key={vote.userId}
                                    className="rounded-xl border border-border/70 bg-card/80 px-4 py-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-foreground">
                                            {vote.userName}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {normalized.rangeCount}개 구간 선택 ·{" "}
                                            {formatUpdatedAtLabel(
                                                vote.updatedAt,
                                            )}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        {normalized.groups.map((group) => (
                                            <div
                                                key={`${vote.userId}-${group.groupKey}`}
                                                className="rounded-lg border border-border/60 bg-background px-3 py-2"
                                            >
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <p className="text-xs font-medium text-foreground">
                                                        {group.label}
                                                    </p>
                                                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
                                                        {group.items.length}개
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {group.items.map((item) => (
                                                        <span
                                                            key={`${vote.userId}-${item.key}`}
                                                            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-foreground"
                                                        >
                                                            {item.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
