import type {
    CreateRecapRequest,
    MeetingRecapResponse,
    RecapReactionRequest,
    RecapReactionSummary,
} from "./types";

interface StoredReaction extends RecapReactionRequest {
    reactorId: string;
}

interface LocalRecapPayload {
    meetingId: string;
    shortId: string;
    recap: MeetingRecapResponse;
    reactions: StoredReaction[];
}

const BY_MEETING_PREFIX = "meet2meet:recap:meeting:";
const BY_SHORT_PREFIX = "meet2meet:recap:short:";
const REACTOR_ID_KEY = "meet2meet:recap:reactor-id";

function isBrowser() {
    return typeof window !== "undefined";
}

function readRaw(key: string): LocalRecapPayload | null {
    if (!isBrowser()) return null;

    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as LocalRecapPayload;
    } catch {
        return null;
    }
}

function writeRaw(payload: LocalRecapPayload) {
    if (!isBrowser()) return;

    try {
        window.localStorage.setItem(`${BY_MEETING_PREFIX}${payload.meetingId}`, JSON.stringify(payload));
        window.localStorage.setItem(`${BY_SHORT_PREFIX}${payload.shortId}`, JSON.stringify(payload));
    } catch {
        // localStorage write failure should not break UI flow.
    }
}

function getReactorId(): string {
    if (!isBrowser()) return "server";

    const existing = window.localStorage.getItem(REACTOR_ID_KEY);
    if (existing) return existing;

    const generated =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `reactor-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(REACTOR_ID_KEY, generated);
    return generated;
}

function toReactionSummary(reactions: StoredReaction[]): RecapReactionSummary {
    if (reactions.length === 0) {
        return { avgRating: 0, count: 0 };
    }

    const total = reactions.reduce((sum, item) => sum + item.rating, 0);
    const avgRating = Math.round((total / reactions.length) * 10) / 10;
    return {
        avgRating,
        count: reactions.length,
    };
}

export function buildLocalRecapResponse(
    meetingId: string,
    request: CreateRecapRequest,
): MeetingRecapResponse {
    const now = new Date().toISOString();
    const localSuffix = Date.now().toString(36);

    return {
        meetingId,
        recapId: `local-recap-${localSuffix}`,
        summaryText: request.summaryText,
        highlights: request.highlights,
        publishedAt: now,
        nextDraftId:
            request.cloneDraftOptions.keepMembers ||
            request.cloneDraftOptions.keepLocation ||
            request.cloneDraftOptions.suggestAfterDays > 0
                ? `local-draft-${localSuffix}`
                : null,
        reactionSummary: {
            avgRating: 0,
            count: 0,
        },
    };
}

export function saveLocalRecap(input: {
    meetingId: string;
    shortId: string;
    recap: MeetingRecapResponse;
}) {
    writeRaw({
        meetingId: input.meetingId,
        shortId: input.shortId,
        recap: input.recap,
        reactions: [],
    });
}

export function readLocalRecapByMeetingId(meetingId: string): LocalRecapPayload | null {
    return readRaw(`${BY_MEETING_PREFIX}${meetingId}`);
}

export function readLocalRecapByShortId(shortId: string): LocalRecapPayload | null {
    return readRaw(`${BY_SHORT_PREFIX}${shortId}`);
}

export function upsertLocalReaction(input: {
    meetingId: string;
    shortId: string;
    reaction: RecapReactionRequest;
}): MeetingRecapResponse | null {
    const payload = readLocalRecapByMeetingId(input.meetingId);
    if (!payload) return null;

    const reactorId = getReactorId();
    const next: StoredReaction = {
        ...input.reaction,
        reactorId,
    };

    const reactions = [...payload.reactions];
    const existingIndex = reactions.findIndex((item) => item.reactorId === reactorId);
    if (existingIndex >= 0) {
        reactions[existingIndex] = next;
    } else {
        reactions.push(next);
    }

    const nextRecap: MeetingRecapResponse = {
        ...payload.recap,
        reactionSummary: toReactionSummary(reactions),
    };

    writeRaw({
        ...payload,
        shortId: input.shortId,
        recap: nextRecap,
        reactions,
    });

    return nextRecap;
}
