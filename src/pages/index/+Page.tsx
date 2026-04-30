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

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function toStringId(value: unknown): string | null {
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
}

function parseTimeRange(value: Record<string, unknown>): {
    start: string;
    end: string;
} | null {
    const direct = isRecord(value.timeRange) ? value.timeRange : null;
    const snake = isRecord(value.time_range) ? value.time_range : null;
    const source = direct ?? snake;

    if (source) {
        const start =
            typeof source.start === "string"
                ? source.start
                : typeof source.startTime === "string"
                    ? source.startTime
                    : null;
        const end =
            typeof source.end === "string"
                ? source.end
                : typeof source.endTime === "string"
                    ? source.endTime
                    : null;
        if (start && end) return { start, end };
    }

    const startTop =
        typeof value.startTime === "string"
            ? value.startTime
            : typeof value.start === "string"
                ? value.start
                : null;
    const endTop =
        typeof value.endTime === "string"
            ? value.endTime
            : typeof value.end === "string"
                ? value.end
                : null;

    if (startTop && endTop) {
        return { start: startTop, end: endTop };
    }

    return null;
}

function parseMeetingListItem(value: unknown): MeetingListItem | null {
    if (!isRecord(value)) return null;

    const id = toStringId(value.id);
    const title =
        typeof value.title === "string"
            ? value.title
            : typeof value.name === "string"
                ? value.name
                : null;
    const dates =
        toStringArray(value.dates).length > 0
            ? toStringArray(value.dates)
            : toStringArray(value.candidateDates);
    const timeRange = parseTimeRange(value);

    if (!id || !title || !timeRange) return null;

    return {
        id,
        title,
        dates,
        timeRange,
        participantCount:
            typeof value.participantCount === "number"
                ? value.participantCount
                : typeof value.participant_count === "number"
                    ? value.participant_count
                    : 0,
        createdAt:
            typeof value.createdAt === "string"
                ? value.createdAt
                : typeof value.created_at === "string"
                    ? value.created_at
                    : undefined,
        updatedAt:
            typeof value.updatedAt === "string"
                ? value.updatedAt
                : typeof value.updated_at === "string"
                    ? value.updated_at
                    : undefined,
    };
}

function normalizeMeetingListResponse(body: unknown): MeetingListItem[] {
    const candidates: unknown[] = [];

    if (Array.isArray(body)) {
        candidates.push(...body);
    }

    if (isRecord(body)) {
        if (Array.isArray(body.meetings)) candidates.push(...body.meetings);
        if (Array.isArray(body.items)) candidates.push(...body.items);
        if (isRecord(body.data)) {
            if (Array.isArray(body.data.meetings)) candidates.push(...body.data.meetings);
            if (Array.isArray(body.data.items)) candidates.push(...body.data.items);
        }
    }

    return candidates
        .map(parseMeetingListItem)
        .filter((item): item is MeetingListItem => item !== null);
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
