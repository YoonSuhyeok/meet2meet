import { describe, expect, it } from "vitest";
import {
    buildRegisterRequest,
    getToggleNotice,
    resolveSubscriptionErrorMessage,
} from "./toggleModel";

function bytes(values: number[]): ArrayBuffer {
    return new Uint8Array(values).buffer;
}

describe("getToggleNotice", () => {
    it("shows login notice when user is logged out", () => {
        expect(
            getToggleNotice({
                isLoggedIn: false,
                isStandalone: false,
                permissionStatus: "default",
                isSubscribed: false,
            }),
        ).toContain("로그인");
    });

    it("shows standalone notice when installed condition is not met", () => {
        expect(
            getToggleNotice({
                isLoggedIn: true,
                isStandalone: false,
                permissionStatus: "granted",
                isSubscribed: false,
            }),
        ).toContain("PWA");
    });

    it("shows permission notice when notification permission is blocked", () => {
        expect(
            getToggleNotice({
                isLoggedIn: true,
                isStandalone: true,
                permissionStatus: "denied",
                isSubscribed: false,
            }),
        ).toContain("알림");
    });

    it("returns no notice when already subscribed", () => {
        expect(
            getToggleNotice({
                isLoggedIn: true,
                isStandalone: true,
                permissionStatus: "granted",
                isSubscribed: true,
            }),
        ).toBeNull();
    });
});

describe("resolveSubscriptionErrorMessage", () => {
    it("maps requiredAction to user guidance", () => {
        expect(
            resolveSubscriptionErrorMessage({
                error: "pwa_installation_required",
                message: "설치 필요",
                requiredAction: "install",
            }),
        ).toContain("설치");
    });
});

describe("buildRegisterRequest", () => {
    it("serializes browser push subscription fields for API contract", () => {
        const mockSubscription = {
            endpoint: "https://example.test/push",
            expirationTime: null,
            getKey(name: PushEncryptionKeyName) {
                if (name === "auth") return bytes([97, 98, 99]);
                if (name === "p256dh") return bytes([100, 101, 102]);
                return null;
            },
        } as unknown as PushSubscription;

        const req = buildRegisterRequest({
            isStandalone: true,
            permissionStatus: "granted",
            subscription: mockSubscription,
            deviceId: "device-1",
        });

        expect(req.pushSubscription.endpoint).toBe("https://example.test/push");
        expect(req.pushSubscription.keys.auth).toBe("YWJj");
        expect(req.pushSubscription.keys.p256dh).toBe("ZGVm");
    });
});
