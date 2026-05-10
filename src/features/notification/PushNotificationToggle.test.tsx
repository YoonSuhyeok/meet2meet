// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PushNotificationToggle } from "./PushNotificationToggle";

// apiFetch 모킹
vi.mock("@/src/features/auth", () => ({
    apiFetch: vi.fn(),
}));

// subscriptionIntent 모킹
vi.mock("@/src/features/notification/subscriptionIntent", () => ({
    saveSubscriptionIntent: vi.fn(),
    consumeSubscriptionIntent: vi.fn(() => false),
}));

import { apiFetch } from "@/src/features/auth";

const mockApiFetch = vi.mocked(apiFetch);

type BrowserEnvOptions = {
    isStandalone?: boolean;
    permission?: NotificationPermission;
    registration?: {
        getRegistration: ReturnType<typeof vi.fn>;
        register: ReturnType<typeof vi.fn>;
        ready: Promise<unknown>;
    };
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: {
            "Content-Type": "application/json",
            ...init.headers,
        },
    });
}

function createMockSubscription() {
    return {
        endpoint: "https://push.example/sub-1",
        expirationTime: null,
        getKey(name: PushEncryptionKeyName) {
            if (name === "auth") return new Uint8Array([97, 98, 99]).buffer;
            if (name === "p256dh")
                return new Uint8Array([100, 101, 102]).buffer;
            return null;
        },
        unsubscribe: vi.fn().mockResolvedValue(true),
    } as unknown as PushSubscription;
}

// 기본 브라우저 API 설정
function setupBrowserEnv({
    isStandalone = false,
    permission = "default" as NotificationPermission,
    registration,
}: BrowserEnvOptions = {}) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn((query: string) => ({
            matches: query === "(display-mode: standalone)" && isStandalone,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    Object.defineProperty(window, "Notification", {
        writable: true,
        value: {
            permission,
            requestPermission: vi.fn().mockResolvedValue(permission),
        },
    });
    Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: registration,
    });
}

describe("PushNotificationToggle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupBrowserEnv();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        cleanup();
    });

    it("비로그인 상태: 버튼 disabled 아님, 로그인 안내 notice 표시", () => {
        render(
            <PushNotificationToggle meetingId="meet-1" isLoggedIn={false} />,
        );

        const btn = screen.getByRole("button", { name: /알림/ });
        // 비로그인: 클릭 가능(로그인 유도)
        expect(btn).not.toBeDisabled();
        expect(btn.getAttribute("aria-pressed")).toBe("false");
        // 로그인 안내 notice
        expect(screen.getAllByText(/로그인/).length).toBeGreaterThan(0);
    });

    it("로그인 + 구독 중 상태: aria-pressed=true", async () => {
        setupBrowserEnv({ isStandalone: true, permission: "granted" });
        mockApiFetch.mockResolvedValueOnce(
            jsonResponse({ isSubscribed: true }),
        );

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            const btn = screen.getByRole("button", { name: /알림/ });
            expect(btn.getAttribute("aria-pressed")).toBe("true");
        });
        // 구독 상태에선 notice 없음
        expect(screen.queryByText(/로그인/)).toBeNull();
        expect(screen.queryByText(/PWA|설치/)).toBeNull();

        expect(mockApiFetch).toHaveBeenCalledWith(
            "/api/meetings/meet-1/push-subscriptions/status",
            {
                headers: {
                    "X-Device-Id": expect.stringMatching(/^device_/),
                },
            },
            { onUnauthorized: "none" },
        );
    });

    it("non-standalone 상태: PWA 설치 안내 notice 표시", async () => {
        setupBrowserEnv({ isStandalone: false, permission: "default" });
        mockApiFetch.mockResolvedValueOnce(
            jsonResponse({ isSubscribed: false }),
        );

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            expect(screen.getByText(/홈 화면에 추가/)).toBeDefined();
        });
    });

    it("permission=denied 상태: 알림 설정 허용 안내 notice 표시", async () => {
        setupBrowserEnv({ isStandalone: true, permission: "denied" });
        mockApiFetch.mockResolvedValueOnce(
            jsonResponse({ isSubscribed: false }),
        );

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            expect(screen.getByText(/설정에서 알림을 허용/)).toBeDefined();
        });
    });

    it("비로그인 클릭 시 onLoginRequired 호출", () => {
        const onLoginRequired = vi.fn();
        render(
            <PushNotificationToggle
                meetingId="meet-1"
                isLoggedIn={false}
                onLoginRequired={onLoginRequired}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /알림/ }));
        expect(onLoginRequired).toHaveBeenCalledOnce();
    });

    it("기존 브라우저 구독이 있으면 새 endpoint를 만들지 않고 그대로 등록한다", async () => {
        const existingSubscription = createMockSubscription();
        const subscribe = vi.fn();
        const getSubscription = vi.fn().mockResolvedValue(existingSubscription);
        const registration = {
            pushManager: {
                getSubscription,
                subscribe,
            },
        };

        setupBrowserEnv({
            isStandalone: true,
            permission: "granted",
            registration: {
                getRegistration: vi.fn().mockResolvedValue(registration),
                register: vi.fn(),
                ready: Promise.resolve(registration),
            },
        });
        vi.stubEnv(
            "VITE_VAPID_PUBLIC_KEY",
            "BEl62iUYgUivxIkv69-8R7m2KGrJxM2C1Y7vQ8Wd9Lxy2jL0O7R5I4mx3D4K1L2NQ7sKx8yN1zQw6i7T8o9p0A",
        );

        mockApiFetch
            .mockResolvedValueOnce(jsonResponse({ isSubscribed: false }))
            .mockResolvedValueOnce(jsonResponse({ message: "ok" }));

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /이 미팅 알림 받기/ }),
            ).toBeVisible();
        });

        fireEvent.click(
            screen.getByRole("button", { name: /이 미팅 알림 받기/ }),
        );

        await waitFor(() => {
            expect(mockApiFetch).toHaveBeenCalledTimes(2);
        });

        expect(subscribe).not.toHaveBeenCalled();

        const registerCall = mockApiFetch.mock.calls[1];
        expect(registerCall?.[0]).toBe(
            "/api/meetings/meet-1/push-subscriptions",
        );
        expect(registerCall?.[1]).toMatchObject({
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        expect(JSON.parse(String(registerCall?.[1]?.body))).toEqual({
            deviceId: expect.stringMatching(/^device_/),
            isStandalone: true,
            notificationPermissionStatus: "granted",
            pushSubscription: {
                endpoint: "https://push.example/sub-1",
                expirationTime: null,
                keys: {
                    auth: "YWJj",
                    p256dh: "ZGVm",
                },
            },
        });
    });

    it("구독 해지 시 서버와 브라우저 구독을 함께 정리한다", async () => {
        const existingSubscription = createMockSubscription();
        const unsubscribe = vi.mocked(existingSubscription.unsubscribe);
        const getSubscription = vi.fn().mockResolvedValue(existingSubscription);
        const registration = {
            pushManager: {
                getSubscription,
                subscribe: vi.fn(),
            },
        };

        setupBrowserEnv({
            isStandalone: true,
            permission: "granted",
            registration: {
                getRegistration: vi.fn().mockResolvedValue(registration),
                register: vi.fn(),
                ready: Promise.resolve(registration),
            },
        });

        mockApiFetch
            .mockResolvedValueOnce(jsonResponse({ isSubscribed: true }))
            .mockResolvedValueOnce(jsonResponse({}));

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: /알림 받는 중/ }),
            ).toBeVisible();
        });

        fireEvent.click(screen.getByRole("button", { name: /알림 받는 중/ }));

        await waitFor(() => {
            expect(unsubscribe).toHaveBeenCalledOnce();
        });

        expect(mockApiFetch).toHaveBeenNthCalledWith(
            2,
            "/api/meetings/meet-1/push-subscriptions",
            {
                method: "DELETE",
                headers: {
                    "X-Device-Id": expect.stringMatching(/^device_/),
                },
            },
        );
    });
});
