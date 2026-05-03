export interface TimeRange {
    start: string;
    end: string;
}

export interface SlotSummary {
    slot: string;
    count: number;
}

export interface MeetingDetailResponse {
    id: string;
    shortId: string;
    inviteCode: string;
    title: string;
    description?: string;
    location?: string;
    dates: string[];
    timeRange: TimeRange;
    hostId: string;
    hostName: string;
    participantCount: number;
    isClosed: boolean;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
    voteSummary?: SlotSummary[];
    finalSlot?: string;
    finalizedBy?: string;
    finalizedAt?: string;
}

export interface MeetingFinalResponse {
    meetingId: string;
    slot: string;
    finalizedBy: string;
    finalizedAt: string;
}

export interface Vote {
    meetingId: string;
    userId: string;
    userName: string;
    slots: string[];
    updatedAt: string;
}

export interface VoteListResponse {
    meetingId: string;
    votes: Vote[];
    summary: SlotSummary[];
}

export interface CloneDraftOptions {
    keepMembers: boolean;
    keepLocation: boolean;
    suggestAfterDays: number;
}

export interface CreateRecapRequest {
    summaryText: string;
    highlights: string[];
    publishToParticipants: boolean;
    cloneDraftOptions: CloneDraftOptions;
}

export interface RecapReactionRequest {
    rating: number;
    comment?: string;
    wantsNextInvite: boolean;
}

export interface RecapReactionSummary {
    avgRating: number;
    count: number;
}

export interface MeetingRecapResponse {
    meetingId: string;
    recapId: string;
    summaryText: string;
    highlights: string[];
    publishedAt: string;
    nextDraftId: string | null;
    reactionSummary: RecapReactionSummary;
}

type RawSlotSummary = {
    slot?: unknown;
    count?: unknown;
};

type RawTimeRange = {
    start?: unknown;
    end?: unknown;
    startTime?: unknown;
    endTime?: unknown;
};

type RawMeetingDetailResponse = {
    id?: unknown;
    shortId?: unknown;
    inviteCode?: unknown;
    title?: unknown;
    description?: unknown;
    location?: unknown;
    dates?: unknown;
    timeRange?: RawTimeRange;
    startTime?: unknown;
    endTime?: unknown;
    hostId?: unknown;
    hostName?: unknown;
    participantCount?: unknown;
    isClosed?: unknown;
    closedAt?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    voteSummary?: unknown;
    finalSlot?: unknown;
    finalizedBy?: unknown;
    finalizedAt?: unknown;
};

function pickString(...values: unknown[]): string {
    for (const value of values) {
        if (typeof value === "string" && value.trim() !== "") {
            return value;
        }
    }
    return "";
}

function toDateKey(value: unknown): string | null {
    if (typeof value !== "string") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

function normalizeVoteSummary(value: unknown): SlotSummary[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const raw = item as RawSlotSummary;
            if (typeof raw?.slot !== "string") return null;
            if (typeof raw?.count !== "number") return null;
            return { slot: raw.slot, count: raw.count };
        })
        .filter((item): item is SlotSummary => item !== null);
}

/**
 * Backend 응답의 스키마 차이(timeRange.start/end vs startTime/endTime)를 흡수해
 * 화면에서 안전하게 사용할 수 있는 표준 MeetingDetailResponse로 정규화한다.
 */
export function normalizeMeetingDetailResponse(
    body: unknown,
): MeetingDetailResponse | null {
    if (!body || typeof body !== "object") return null;

    const raw = body as RawMeetingDetailResponse;
    const id =
        typeof raw.id === "number"
            ? String(raw.id)
            : typeof raw.id === "string"
              ? raw.id
              : "";
    if (!id) return null;

    const shortId = pickString(raw.shortId);
    const title = pickString(raw.title);
    const start = pickString(
        raw.timeRange?.start,
        raw.timeRange?.startTime,
        raw.startTime,
    );
    const end = pickString(raw.timeRange?.end, raw.timeRange?.endTime, raw.endTime);

    if (!shortId || !title || !start || !end) {
        return null;
    }

    const dates = Array.isArray(raw.dates)
        ? raw.dates
              .map((value) => toDateKey(value))
              .filter((value): value is string => value !== null)
        : [];

    const participantCount =
        typeof raw.participantCount === "number" ? raw.participantCount : 0;

    return {
        id,
        shortId,
        inviteCode: pickString(raw.inviteCode),
        title,
        description: typeof raw.description === "string" ? raw.description : undefined,
        location: typeof raw.location === "string" ? raw.location : undefined,
        dates,
        timeRange: { start, end },
        hostId: pickString(raw.hostId),
        hostName: pickString(raw.hostName),
        participantCount,
        isClosed: typeof raw.isClosed === "boolean" ? raw.isClosed : false,
        closedAt: typeof raw.closedAt === "string" ? raw.closedAt : undefined,
        createdAt:
            typeof raw.createdAt === "string"
                ? raw.createdAt
                : new Date().toISOString(),
        updatedAt:
            typeof raw.updatedAt === "string"
                ? raw.updatedAt
                : new Date().toISOString(),
        voteSummary: normalizeVoteSummary(raw.voteSummary),
        finalSlot: typeof raw.finalSlot === "string" ? raw.finalSlot : undefined,
        finalizedBy:
            typeof raw.finalizedBy === "string" ? raw.finalizedBy : undefined,
        finalizedAt:
            typeof raw.finalizedAt === "string" ? raw.finalizedAt : undefined,
    };
}
