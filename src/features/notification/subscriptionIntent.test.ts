import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeSubscriptionIntent, saveSubscriptionIntent } from "./subscriptionIntent";

interface MockStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
}

function createMockStorage(): MockStorage {
    const store = new Map<string, string>();
    return {
        getItem(key) {
            return store.get(key) ?? null;
        },
        setItem(key, value) {
            store.set(key, value);
        },
        removeItem(key) {
            store.delete(key);
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
    vi.useRealTimers();
    if (originalWindow) {
        (globalThis as { window?: Window }).window = originalWindow;
    } else {
        delete (globalThis as { window?: Window }).window;
    }
});

describe("subscriptionIntent", () => {
    it("consumes intent once when meetingId matches", () => {
        saveSubscriptionIntent("meeting-1");
        expect(consumeSubscriptionIntent("meeting-1")).toBe(true);
        expect(consumeSubscriptionIntent("meeting-1")).toBe(false);
    });

    it("returns false when meetingId differs", () => {
        saveSubscriptionIntent("meeting-1");
        expect(consumeSubscriptionIntent("meeting-2")).toBe(false);
    });

    it("expires stale intent", () => {
        vi.useFakeTimers();
        saveSubscriptionIntent("meeting-1");
        vi.advanceTimersByTime(1000 * 60 * 31);
        expect(consumeSubscriptionIntent("meeting-1")).toBe(false);
    });
});
