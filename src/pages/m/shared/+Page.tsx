import { ArrowRight, LogIn, NotebookPen, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { type SlotKey, makeSlotKey } from "@/src/entities/meeting";
import { apiFetch, savePostLoginRedirect, useAuth } from "@/src/features/auth";
import { PushNotificationToggle } from "@/src/features/notification";
import { cn } from "@/src/shared";
import { TimeGrid } from "@/src/widgets/time-picker";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import {
    createTimeSlotsFromRange,
    formatDateLabel,
    parseSlotKey,
} from "@/src/pages/meeting/model/time";
import type {
    MeetingDetailResponse,
    Vote,
    VoteListResponse,
} from "@/src/pages/meeting/model/types";
import { normalizeMeetingDetailResponse } from "@/src/pages/meeting/model/types";

const GUEST_PARTICIPANT_PREFIX = "guest:";

function createGuestParticipantCode() {
    const uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${GUEST_PARTICIPANT_PREFIX}${uuid}`;
}

function getGuestParticipantCode(shortId: string) {
    if (typeof window === "undefined") return "";

    const key = `meeting:guest:participant:${shortId}`;
    const stored = window.localStorage.getItem(key);
    if (stored?.startsWith(GUEST_PARTICIPANT_PREFIX)) {
        return stored;
    }

    const created = createGuestParticipantCode();
    window.localStorage.setItem(key, created);
    return created;
}

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

function formatSlotLabel(slot: string): string {
    const parsed = parseSlotKey(slot);
    if (!parsed) return slot;
    return `${formatDateLabel(parsed.date)} ${parsed.time}`;
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

                const meetingRaw = (await res.json().catch(() => null)) as unknown;
                const detail = normalizeMeetingDetailResponse(meetingRaw);
                if (!detail) {
                    throw new Error("미팅 데이터 형식이 올바르지 않습니다.");
                }
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
        if (!meeting) {
            setMyVote(null);
            setSelected(new Set());
            return;
        }

        const viewerVoteKey = user
            ? user.id
            : getGuestParticipantCode(meeting.shortId);

        const controller = new AbortController();
        const loadMyVote = async () => {
            try {
                const voteUrl = user
                    ? `/api/meetings/${meeting.id}/votes`
                    : `/api/meetings/${meeting.id}/votes?participantCode=${encodeURIComponent(viewerVoteKey)}`;

                const res = await fetch(voteUrl, {
                    signal: controller.signal,
                });
                if (!res.ok) {
                    setMyVote(null);
                    setSelected(new Set());
                    return;
                }

                const body = (await res.json()) as VoteListResponse;
                const vote =
                    (body.votes ?? []).find((item) => item.userId === viewerVoteKey) ??
                    null;
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
        if (!meeting) {
            setIsClosed(false);
            return;
        }

        setIsClosed(meeting.isClosed);
    }, [meeting]);

    const finalizedSlot = meeting?.finalSlot ?? null;
    const isMeetingLocked = isClosed || !!finalizedSlot;

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

    const canSubmit = selected.size > 0 && !submitting && !isMeetingLocked;

    const navigateToLoginWithRedirect = useCallback(() => {
        if (!meeting) {
            window.location.href = "/login";
            return;
        }

        savePostLoginRedirect(`/m/${meeting.shortId}`);
        window.location.href = "/login";
    }, [meeting]);

    const handleSelectionChange = useCallback(
        (next: Set<SlotKey>) => {
            if (isMeetingLocked) return;
            setSelected(next);
        },
        [isMeetingLocked],
    );

    const handleSubmit = useCallback(async () => {
        if (!meeting) return;

        if (isMeetingLocked) {
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
            const guestParticipantCode = user
                ? ""
                : getGuestParticipantCode(meeting.shortId);
            const voteUrl = guestParticipantCode
                ? `/api/meetings/${meeting.id}/votes?participantCode=${encodeURIComponent(guestParticipantCode)}`
                : `/api/meetings/${meeting.id}/votes`;

            const res = await apiFetch(
                voteUrl,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...(guestParticipantCode
                            ? { "X-Participant-Name": "Guest" }
                            : {}),
                    },
                    body: JSON.stringify({ slots }),
                },
                user ? {} : { onUnauthorized: "none" },
            );

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
    }, [isMeetingLocked, meeting, navigateToLoginWithRedirect, selected, user]);

    const handleReset = useCallback(() => {
        setSelected(new Set());
        setStatusMessage(null);
    }, []);

    const handleLoginRequiredForNotification = useCallback(() => {
        navigateToLoginWithRedirect();
    }, [navigateToLoginWithRedirect]);

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
                <h1 className="mt-2 break-all text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl">
                    {meeting.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {summaryText || "후보 날짜 없음"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    투표 시간: {meeting.timeRange.start} ~ {meeting.timeRange.end}
                </p>
                {isMeetingLocked && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {finalizedSlot
                            ? `호스트가 일정을 확정했습니다: ${formatSlotLabel(finalizedSlot)}`
                            : "이 미팅은 현재 마감 상태입니다. 투표를 제출하거나 수정할 수 없습니다."}
                        <div className="mt-2">
                            <a
                                href={`/m/${meeting.shortId}/recap`}
                                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                            >
                                <NotebookPen className="h-3.5 w-3.5" />
                                회고 보기
                            </a>
                        </div>
                    </div>
                )}
                {!user && (
                    <button
                        type="button"
                        onClick={navigateToLoginWithRedirect}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                    >
                        <LogIn className="h-4 w-4" />
                        로그인해서 내 응답 연동
                        <ArrowRight className="h-4 w-4" />
                    </button>
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

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <h2 className="text-lg font-semibold text-foreground">미팅 알림</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    이 미팅의 일정 변경과 시작 전 안내를 PushNotification으로 받을 수 있습니다.
                </p>
                <div className="mt-4">
                    <PushNotificationToggle
                        meetingId={meeting.id}
                        isLoggedIn={!!user}
                        onLoginRequired={handleLoginRequiredForNotification}
                    />
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
