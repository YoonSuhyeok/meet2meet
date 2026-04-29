import {
    ArrowRight,
    CheckCircle2,
    FileText,
    Plus,
    Sparkles,
    Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { apiFetch, useAuth } from "@/src/features/auth";
import { cn } from "@/src/shared";
import { resolveServerErrorMessage } from "@/src/pages/meeting/new/errors";
import {
    buildLocalRecapResponse,
    saveLocalRecap,
} from "@/src/pages/meeting/model/recapLocal";
import type {
    CreateRecapRequest,
    MeetingDetailResponse,
    MeetingRecapResponse,
} from "@/src/pages/meeting/model/types";

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
    const match = pathname.match(/^\/meeting\/([^/?#]+)\/recap/);
    return match?.[1] ?? null;
}

function normalizeHighlights(values: string[]): string[] {
    return values
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5);
}

function normalizeRecapResponse(
    body: unknown,
    fallbackPayload: CreateRecapRequest,
    meetingId: string,
): MeetingRecapResponse {
    const maybeBody = body as Partial<MeetingRecapResponse> | null;

    return {
        meetingId: maybeBody?.meetingId ?? meetingId,
        recapId: maybeBody?.recapId ?? `recap-${Date.now().toString(36)}`,
        summaryText: maybeBody?.summaryText ?? fallbackPayload.summaryText,
        highlights: maybeBody?.highlights ?? fallbackPayload.highlights,
        publishedAt: maybeBody?.publishedAt ?? new Date().toISOString(),
        nextDraftId:
            maybeBody?.nextDraftId ??
            (fallbackPayload.cloneDraftOptions.keepMembers ||
            fallbackPayload.cloneDraftOptions.keepLocation ||
            fallbackPayload.cloneDraftOptions.suggestAfterDays > 0
                ? `draft-${Date.now().toString(36)}`
                : null),
        reactionSummary: maybeBody?.reactionSummary ?? {
            avgRating: 0,
            count: 0,
        },
    };
}

export default function Page() {
    const pageContext = usePageContext();
    const meetingId = useMemo(() => getMeetingIdFromContext(pageContext), [pageContext]);
    const { user, loading: authLoading } = useAuth();

    const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [summaryText, setSummaryText] = useState("");
    const [highlightInput, setHighlightInput] = useState("");
    const [highlights, setHighlights] = useState<string[]>([
        "참석률 80% 이상",
        "장소 만족도 4점 이상",
    ]);

    const [publishToParticipants, setPublishToParticipants] = useState(true);
    const [keepMembers, setKeepMembers] = useState(true);
    const [keepLocation, setKeepLocation] = useState(true);
    const [suggestAfterDays, setSuggestAfterDays] = useState(7);

    const [submitting, setSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [published, setPublished] = useState<MeetingRecapResponse | null>(null);

    useEffect(() => {
        if (!meetingId) {
            setError("미팅 ID를 확인할 수 없습니다.");
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const loadMeeting = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`/api/meetings/${meetingId}`, {
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
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        loadMeeting();
        return () => controller.abort();
    }, [meetingId]);

    const addHighlight = useCallback(() => {
        const value = highlightInput.trim();
        if (!value) return;

        setHighlights((prev) => {
            if (prev.length >= 5) return prev;
            if (prev.includes(value)) return prev;
            return [...prev, value];
        });
        setHighlightInput("");
    }, [highlightInput]);

    const removeHighlight = useCallback((index: number) => {
        setHighlights((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleHighlightKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addHighlight();
        },
        [addHighlight],
    );

    const canSubmit =
        !!meeting &&
        !!user &&
        summaryText.trim().length > 0 &&
        normalizeHighlights(highlights).length > 0 &&
        !submitting;

    const handlePublish = useCallback(async () => {
        if (!meeting) return;

        if (!user) {
            window.location.href = "/login";
            return;
        }

        const payload: CreateRecapRequest = {
            summaryText: summaryText.trim(),
            highlights: normalizeHighlights(highlights),
            publishToParticipants,
            cloneDraftOptions: {
                keepMembers,
                keepLocation,
                suggestAfterDays: Math.max(0, Math.floor(suggestAfterDays)),
            },
        };

        if (!payload.summaryText || payload.highlights.length === 0) {
            setStatusMessage("회고 요약과 하이라이트를 최소 1개 이상 입력해주세요.");
            return;
        }

        setSubmitting(true);
        setStatusMessage(null);

        try {
            const res = await apiFetch(`/api/meetings/${meeting.id}/recap`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                if (res.status === 401) return;

                if ([404, 405, 501, 502].includes(res.status)) {
                    const localRecap = buildLocalRecapResponse(meeting.id, payload);
                    saveLocalRecap({
                        meetingId: meeting.id,
                        shortId: meeting.shortId,
                        recap: localRecap,
                    });
                    setPublished(localRecap);
                    setStatusMessage(
                        "백엔드 미구현 상태라 로컬 프론트 모드로 저장했습니다.",
                    );
                    return;
                }

                const body = (await res.json().catch(() => null)) as
                    | { code?: string; message?: string }
                    | null;
                throw new Error(resolveServerErrorMessage(res.status, body));
            }

            const body = (await res.json().catch(() => null)) as unknown;
            const normalized = normalizeRecapResponse(body, payload, meeting.id);
            setPublished(normalized);
            setStatusMessage("회고가 발행되었습니다.");
        } catch (err) {
            setStatusMessage(
                err instanceof Error
                    ? err.message
                    : "회고 발행에 실패했습니다. 잠시 후 다시 시도해주세요.",
            );
        } finally {
            setSubmitting(false);
        }
    }, [
        highlights,
        keepLocation,
        keepMembers,
        meeting,
        publishToParticipants,
        suggestAfterDays,
        summaryText,
        user,
    ]);

    if (loading || authLoading) {
        return (
            <div className="space-y-4 py-12">
                <div className="h-8 w-64 animate-pulse rounded bg-muted" />
                <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                <div className="h-72 animate-pulse rounded-2xl bg-muted" />
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
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Recap Publisher
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {meeting.title} 회고 작성
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    참석 결과를 공유하고, 다음 모임 초안을 빠르게 연결하세요.
                </p>
                <a
                    href={`/m/${meeting.shortId}/recap`}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
                >
                    참여자 보기 페이지 미리보기
                    <ArrowRight className="h-4 w-4" />
                </a>
            </section>

            <section className="rounded-[1.75rem] border border-border/70 bg-background p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.42)] sm:p-7">
                <div className="space-y-5">
                    <label className="block space-y-2">
                        <span className="text-sm font-semibold text-foreground">회고 요약</span>
                        <textarea
                            value={summaryText}
                            onChange={(event) => setSummaryText(event.target.value)}
                            rows={4}
                            placeholder="이번 모임의 핵심 인사이트를 2~3문장으로 정리해주세요."
                            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
                        />
                    </label>

                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">하이라이트</p>
                        <div className="flex flex-wrap gap-2">
                            {highlights.map((item, index) => (
                                <span
                                    key={`${item}-${index}`}
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                                >
                                    {item}
                                    <button
                                        type="button"
                                        onClick={() => removeHighlight(index)}
                                        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                                        aria-label="하이라이트 삭제"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                value={highlightInput}
                                onChange={(event) => setHighlightInput(event.target.value)}
                                onKeyDown={handleHighlightKeyDown}
                                placeholder="예: 장소 만족도 평균 4.5"
                                className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                            />
                            <button
                                type="button"
                                onClick={addHighlight}
                                disabled={highlights.length >= 5}
                                className={cn(
                                    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                                    highlights.length >= 5
                                        ? "pointer-events-none bg-muted text-muted-foreground"
                                        : "bg-accent text-foreground hover:bg-accent/70",
                                )}
                            >
                                <Plus className="h-4 w-4" />
                                추가
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            최대 5개까지 태그를 추가할 수 있습니다.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">발행 옵션</p>
                        <label className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
                            <span>참여자에게 회고 공개</span>
                            <input
                                type="checkbox"
                                checked={publishToParticipants}
                                onChange={(event) => setPublishToParticipants(event.target.checked)}
                            />
                        </label>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">다음 모임 초안</p>
                        <label className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
                            <span>현재 멤버 그대로 복제</span>
                            <input
                                type="checkbox"
                                checked={keepMembers}
                                onChange={(event) => setKeepMembers(event.target.checked)}
                            />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
                            <span>장소/설명 템플릿 재사용</span>
                            <input
                                type="checkbox"
                                checked={keepLocation}
                                onChange={(event) => setKeepLocation(event.target.checked)}
                            />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground">
                            <span>후보 날짜 자동 제안 (일)</span>
                            <input
                                type="number"
                                min={0}
                                max={30}
                                value={suggestAfterDays}
                                onChange={(event) => setSuggestAfterDays(Number(event.target.value))}
                                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                            />
                        </label>
                    </div>
                </div>

                {statusMessage && (
                    <div className="mt-5 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground">
                        {statusMessage}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePublish}
                        disabled={!canSubmit}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                            canSubmit
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "pointer-events-none bg-muted text-muted-foreground",
                        )}
                    >
                        <FileText className="h-4 w-4" />
                        {submitting ? "발행 중..." : "회고 발행하기"}
                    </button>
                </div>
            </section>

            {published && (
                <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/60 p-6">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-emerald-900">
                                회고 발행 완료
                            </p>
                            <p className="text-sm text-emerald-900/90">
                                recapId: {published.recapId}
                            </p>
                            {published.nextDraftId && (
                                <p className="text-sm text-emerald-900/90">
                                    nextDraftId: {published.nextDraftId}
                                </p>
                            )}
                            <a
                                href={`/m/${meeting.shortId}/recap`}
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                            >
                                참여자 반응 화면으로 이동
                                <Sparkles className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
