import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildLocalRecapResponse,
    readLocalRecapByMeetingId,
    readLocalRecapByShortId,
    saveLocalRecap,
    upsertLocalReaction,
} from "./recapLocal";
import type { CreateRecapRequest } from "./types";

interface MockStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
}

function createMockStorage(): MockStorage {
    const store = new Map<string, string>();

    return {
        getItem(key) {
            return store.has(key) ? (store.get(key) ?? null) : null;
        },
        setItem(key, value) {
            store.set(key, value);
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
    };
}

const originalWindow = (globalThis as { window?: Window }).window;

beforeEach(() => {
    const storage = createMockStorage();
    (globalThis as { window?: Window }).window = {
        localStorage: storage,
    } as unknown as Window;
});

afterEach(() => {
    if (originalWindow) {
        (globalThis as { window?: Window }).window = originalWindow;
    } else {
        delete (globalThis as { window?: Window }).window;
    }
});

describe("buildLocalRecapResponse", () => {
    it("creates nextDraftId when clone options are enabled", () => {
        const req: CreateRecapRequest = {
            summaryText: "요약",
            highlights: ["포인트"],
            publishToParticipants: true,
            cloneDraftOptions: {
                keepMembers: true,
                keepLocation: false,
                suggestAfterDays: 0,
            },
        };

        const recap = buildLocalRecapResponse("meeting-1", req);
        expect(recap.meetingId).toBe("meeting-1");
        expect(recap.nextDraftId).toBeTruthy();
        expect(recap.reactionSummary).toEqual({ avgRating: 0, count: 0 });
    });

    it("returns null nextDraftId when all clone options are disabled", () => {
        const req: CreateRecapRequest = {
            summaryText: "요약",
            highlights: ["포인트"],
            publishToParticipants: true,
            cloneDraftOptions: {
                keepMembers: false,
                keepLocation: false,
                suggestAfterDays: 0,
            },
        };

        const recap = buildLocalRecapResponse("meeting-2", req);
        expect(recap.nextDraftId).toBeNull();
    });
});

describe("local recap persistence", () => {
    it("saves and reads recap by meetingId and shortId", () => {
        const recap = buildLocalRecapResponse("meeting-3", {
            summaryText: "회의 요약",
            highlights: ["참석률 90%"],
            publishToParticipants: true,
            cloneDraftOptions: {
                keepMembers: true,
                keepLocation: true,
                suggestAfterDays: 7,
            },
        });

        saveLocalRecap({
            meetingId: "meeting-3",
            shortId: "short-3",
            recap,
        });

        const byMeeting = readLocalRecapByMeetingId("meeting-3");
        const byShort = readLocalRecapByShortId("short-3");

        expect(byMeeting?.recap.recapId).toBe(recap.recapId);
        expect(byShort?.meetingId).toBe("meeting-3");
    });

    it("upserts reaction per reactor and updates aggregate summary", () => {
        const recap = buildLocalRecapResponse("meeting-4", {
            summaryText: "후기",
            highlights: ["장소 만족도 높음"],
            publishToParticipants: true,
            cloneDraftOptions: {
                keepMembers: true,
                keepLocation: true,
                suggestAfterDays: 7,
            },
        });

        saveLocalRecap({
            meetingId: "meeting-4",
            shortId: "short-4",
            recap,
        });

        const first = upsertLocalReaction({
            meetingId: "meeting-4",
            shortId: "short-4",
            reaction: {
                rating: 5,
                comment: "좋았어요",
                wantsNextInvite: true,
            },
        });

        expect(first?.reactionSummary).toEqual({ avgRating: 5, count: 1 });

        const storage = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage;
        storage.setItem("meet2meet:recap:reactor-id", "another-reactor");

        const second = upsertLocalReaction({
            meetingId: "meeting-4",
            shortId: "short-4",
            reaction: {
                rating: 3,
                comment: "보통",
                wantsNextInvite: false,
            },
        });

        expect(second?.reactionSummary).toEqual({ avgRating: 4, count: 2 });

        const third = upsertLocalReaction({
            meetingId: "meeting-4",
            shortId: "short-4",
            reaction: {
                rating: 2,
                comment: "다음엔 개선",
                wantsNextInvite: true,
            },
        });

        expect(third?.reactionSummary).toEqual({ avgRating: 3.5, count: 2 });
    });
});
