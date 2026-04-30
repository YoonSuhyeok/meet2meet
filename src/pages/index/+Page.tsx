import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, useAuth } from "@/src/features/auth";
import { formatDateLabel } from "@/src/pages/meeting/model/time";

type MeetingListItem = {
    id: string;
    title: string;
    dates: string[];
    timeRange: {
        start: string;
        end: string;
    };
    participantCount: number;
    createdAt?: string;
    updatedAt?: string;
};

function isMeetingListItem(value: unknown): value is MeetingListItem {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<MeetingListItem>;
    return (
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        Array.isArray(item.dates) &&
        !!item.timeRange &&
        typeof item.timeRange.start === "string" &&
        typeof item.timeRange.end === "string"
    );
}

function normalizeMeetingListResponse(body: unknown): MeetingListItem[] {
    if (Array.isArray(body)) {
        return body.filter(isMeetingListItem);
    }

    if (body && typeof body === "object") {
        const maybe = body as { meetings?: unknown };
        if (Array.isArray(maybe.meetings)) {
            return maybe.meetings.filter(isMeetingListItem);
        }
    }

    return [];
}

function toTimestamp(value?: string): number {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateRange(dates: string[]): string {
    if (dates.length === 0) return "날짜 미정";
    const sorted = [...dates].sort();
    if (sorted.length === 1) {
        return formatDateLabel(sorted[0]);
    }
    return `${formatDateLabel(sorted[0])} - ${formatDateLabel(sorted[sorted.length - 1])} · ${sorted.length}일`;
}

export default function Page() {
    const { user, loading } = useAuth();
    const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
    const [meetingsLoading, setMeetingsLoading] = useState(false);
    const [meetingsError, setMeetingsError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const reloadMeetings = useCallback(() => {
        setReloadKey((prev) => prev + 1);
    }, []);

    useEffect(() => {
        if (loading || !user) {
            setMeetings([]);
            setMeetingsError(null);
            setMeetingsLoading(false);
            return;
        }

        const controller = new AbortController();

        const loadMeetings = async () => {
            setMeetingsLoading(true);
            setMeetingsError(null);

            try {
                const res = await apiFetch("/api/meetings?limit=20", {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    if (res.status === 401) return;
                    throw new Error("내 미팅 목록을 불러오지 못했습니다.");
                }

                const data = (await res.json().catch(() => null)) as unknown;
                const parsed = normalizeMeetingListResponse(data).sort((a, b) => {
                    const aTs = Math.max(
                        toTimestamp(a.updatedAt),
                        toTimestamp(a.createdAt),
                    );
                    const bTs = Math.max(
                        toTimestamp(b.updatedAt),
                        toTimestamp(b.createdAt),
                    );
                    return bTs - aTs;
                });
                setMeetings(parsed);
            } catch (err) {
                if (controller.signal.aborted) return;
                setMeetingsError(
                    err instanceof Error
                        ? err.message
                        : "내 미팅 목록을 불러오지 못했습니다.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setMeetingsLoading(false);
                }
            }
        };

        loadMeetings();
        return () => controller.abort();
    }, [loading, reloadKey, user]);

    const hasMeetings = useMemo(() => meetings.length > 0, [meetings.length]);

    return (
        <div className="py-16 text-center">
            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="mx-auto h-6 w-48 rounded bg-muted" />
                    <div className="mx-auto h-4 w-64 rounded bg-muted" />
                </div>
            ) : user ? (
                <div className="mx-auto max-w-3xl space-y-6 px-4 text-left sm:px-6">
                    <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">
                        안녕하세요, {user.name}님
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        드래그 기반 시간 선택으로 모임 일정을 잡아보세요.
                    </p>
                    </div>

                    {meetingsLoading ? (
                        <div className="space-y-3">
                            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
                            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
                        </div>
                    ) : meetingsError ? (
                        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
                            <p className="font-semibold text-destructive">목록 조회 실패</p>
                            <p className="mt-1 text-destructive/90">{meetingsError}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={reloadMeetings}
                                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                                >
                                    다시 시도
                                </button>
                                <a
                                    href="/meeting/new"
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    새 미팅 만들기
                                </a>
                            </div>
                        </div>
                    ) : hasMeetings ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    내 미팅
                                </h2>
                                <a
                                    href="/meeting/new"
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    새 미팅 만들기
                                </a>
                            </div>

                            <ul className="space-y-3">
                                {meetings.map((meeting) => (
                                    <li key={meeting.id}>
                                        <a
                                            href={`/meeting/${meeting.id}`}
                                            className="block rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/40 hover:bg-accent/30"
                                        >
                                            <p className="text-base font-semibold text-foreground">
                                                {meeting.title}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {formatDateRange(meeting.dates)}
                                            </p>
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                시간 {meeting.timeRange.start} ~ {meeting.timeRange.end} · 참여 {meeting.participantCount}명
                                            </p>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                            <p className="text-base font-semibold">아직 내가 가진 미팅이 없어요</p>
                            <p className="mt-2 text-sm text-muted-foreground">
                                첫 미팅을 만들고 링크를 공유해 일정을 빠르게 잡아보세요.
                            </p>
                            <a
                                href="/meeting/new"
                                className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                            >
                                새 미팅 만들기
                            </a>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Meet2Meet
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        드래그 기반 시간 선택으로 모임 일정을 잡아보세요.
                    </p>
                    <a
                        href="/login"
                        className="mt-8 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        시작하기
                    </a>
                </>
            )}
        </div>
    );
}
