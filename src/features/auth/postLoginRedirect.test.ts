import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    consumePostLoginRedirect,
    savePostLoginRedirect,
} from "./postLoginRedirect";

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

describe("postLoginRedirect", () => {
    it("saves and consumes redirect path once", () => {
        savePostLoginRedirect("/m/abc123");
        expect(consumePostLoginRedirect()).toBe("/m/abc123");
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it("ignores non-relative paths", () => {
        savePostLoginRedirect("https://example.com");
        expect(consumePostLoginRedirect()).toBeNull();
    });

    it("expires stale payload", () => {
        vi.useFakeTimers();
        savePostLoginRedirect("/m/late");
        vi.advanceTimersByTime(1000 * 60 * 31);
        expect(consumePostLoginRedirect()).toBeNull();
    });
});
