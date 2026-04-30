import { ArrowRight, LogIn, MessageSquareText, Send, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { apiFetch, useAuth } from "@/src/features/auth";
import { cn } from "@/src/shared";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import {
    readLocalRecapByShortId,
    upsertLocalReaction,
} from "@/src/pages/meeting/model/recapLocal";
import type {
    MeetingDetailResponse,
    MeetingRecapResponse,
    RecapReactionRequest,
} from "@/src/pages/meeting/model/types";
import { normalizeMeetingDetailResponse } from "@/src/pages/meeting/model/types";

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
    const match = pathname.match(/^\/m\/([^/?#]+)\/recap/);
    return match?.[1] ?? null;
}

function normalizeRecapResponse(
    body: unknown,
    fallbackMeetingId: string,
): MeetingRecapResponse | null {
    if (!body || typeof body !== "object") return null;

    const maybeBody = body as Partial<MeetingRecapResponse>;
    if (!maybeBody.recapId) return null;

    return {
        meetingId: maybeBody.meetingId ?? fallbackMeetingId,
        recapId: maybeBody.recapId,
        summaryText: maybeBody.summaryText ?? "",
        highlights: maybeBody.highlights ?? [],
        publishedAt: maybeBody.publishedAt ?? new Date().toISOString(),
        nextDraftId: maybeBody.nextDraftId ?? null,
        reactionSummary: maybeBody.reactionSummary ?? {
            avgRating: 0,
            count: 0,
        },
    };
}

export default function Page() {
    const pageContext = usePageContext();
    const shortId = useMemo(() => getShortIdFromContext(pageContext), [pageContext]);
    const { user, loading: authLoading } = useAuth();

    const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
    const [recap, setRecap] = useState<MeetingRecapResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [wantsNextInvite, setWantsNextInvite] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!shortId) {
            setError("공유 링크를 확인할 수 없습니다.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const meetingRes = await fetch(`/api/meetings/s/${shortId}`, {
                    signal: controller.signal,
                });

                if (!meetingRes.ok) {
                    const body = (await meetingRes.json().catch(() => null)) as
                        | { code?: string; message?: string }
                        | null;
                    throw new Error(resolveServerErrorMessage(meetingRes.status, body));
                }

                const meetingRaw = (await meetingRes.json().catch(() => null)) as unknown;
                const detail = normalizeMeetingDetailResponse(meetingRaw);
                if (!detail) {
                    throw new Error("미팅 데이터 형식이 올바르지 않습니다.");
                }
                setMeeting(detail);

                const recapRes = await fetch(`/api/meetings/${detail.id}/recap`, {
                    signal: controller.signal,
                });

                if (recapRes.ok) {
                    const body = (await recapRes.json().catch(() => null)) as unknown;
                    const normalized = normalizeRecapResponse(body, detail.id);
                    if (normalized) {
                        setRecap(normalized);
                        return;
                    }
                }

                const local = readLocalRecapByShortId(shortId);
                if (local?.recap) {
                    setRecap(local.recap);
                    return;
                }

                setError("아직 발행된 회고가 없습니다.");
            } catch (err) {
                if (controller.signal.aborted) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "회고 정보를 불러오지 못했습니다.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => controller.abort();
    }, [shortId]);

    const canSubmit = !!meeting && !!recap && !!user && rating >= 1 && !submitting;

    const handleSubmit = useCallback(async () => {
        if (!meeting || !recap) return;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        if (rating < 1) {
            setStatusMessage("별점을 먼저 선택해주세요.");
            return;
        }

        const payload: RecapReactionRequest = {
            rating,
            comment: comment.trim() || undefined,
            wantsNextInvite,
        };

        setSubmitting(true);
        setStatusMessage(null);

        try {
            const res = await apiFetch(`/api/meetings/${meeting.id}/recap/reactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                if (res.status === 401) return;

                if ([404, 405, 410, 501, 502].includes(res.status)) {
                    const nextRecap = upsertLocalReaction({
                        meetingId: meeting.id,
                        shortId: meeting.shortId,
                        reaction: payload,
                    });
                    if (nextRecap) {
                        setRecap(nextRecap);
                    }
                    setStatusMessage(
                        "백엔드 미구현 상태라 로컬 프론트 모드로 반응을 저장했습니다.",
                    );
                    return;
                }

                const body = (await res.json().catch(() => null)) as
                    | { code?: string; message?: string }
                    | null;
                throw new Error(resolveServerErrorMessage(res.status, body));
            }

            const body = (await res.json().catch(() => null)) as unknown;
            const normalized = normalizeRecapResponse(body, meeting.id);
            if (normalized) {
                setRecap(normalized);
            }
            setStatusMessage("반응이 저장되었습니다.");
        } catch (err) {
            setStatusMessage(
                err instanceof Error
                    ? err.message
                    : "반응 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [comment, meeting, rating, recap, user, wantsNextInvite]);

    if (loading || authLoading) {
        return (
            <div className="space-y-4 py-12">
                <div className="h-8 w-52 animate-pulse rounded bg-muted" />
                <div className="h-20 animate-pulse rounded-2xl bg-muted" />
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    if (error || !meeting || !recap) {
        return (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                {error ?? "회고를 찾을 수 없습니다."}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Recap
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {meeting.title} 회고
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {recap.summaryText}
                </p>

                {recap.highlights.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {recap.highlights.map((item, index) => (
                            <span
                                key={`${item}-${index}`}
                                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mt-4 rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                    현재 반응 평균 {recap.reactionSummary.avgRating.toFixed(1)} / 5 · 총 {recap.reactionSummary.count}명
                </div>

                {!user && (
                    <a
                        href="/login"
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                    >
                        <LogIn className="h-4 w-4" />
                        로그인하고 반응 남기기
                    </a>
                )}
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <h2 className="text-lg font-semibold text-foreground">이번 모임 만족도</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setRating(value)}
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition",
                                rating >= value
                                    ? "border-amber-300 bg-amber-50 text-amber-700"
                                    : "border-border bg-background text-muted-foreground hover:bg-accent",
                            )}
                        >
                            <Star className="h-4 w-4" />
                            {value}
                        </button>
                    ))}
                </div>

                <label className="mt-4 block space-y-2">
                    <span className="text-sm font-medium text-foreground">한 줄 코멘트 (선택)</span>
                    <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        placeholder="다음 모임이 더 좋아지도록 짧은 의견을 남겨주세요."
                        className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                    />
                </label>

                <label className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
                    <span>다음 모임 초대 알림 받기</span>
                    <input
                        type="checkbox"
                        checked={wantsNextInvite}
                        onChange={(event) => setWantsNextInvite(event.target.checked)}
                    />
                </label>

                {statusMessage && (
                    <div className="mt-4 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground">
                        {statusMessage}
                    </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                            canSubmit
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "pointer-events-none bg-muted text-muted-foreground",
                        )}
                    >
                        <Send className="h-4 w-4" />
                        {submitting ? "저장 중..." : "반응 남기기"}
                    </button>

                    {recap.nextDraftId && (
                        <a
                            href="/meeting/new"
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                        >
                            다음 모임 만들기
                            <ArrowRight className="h-4 w-4" />
                        </a>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        반응은 수정 제출 시 최신 값으로 갱신됩니다.
                    </span>
                </div>
            </section>
        </div>
    );
}
