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

// 기본 브라우저 API 설정
function setupBrowserEnv({
    isStandalone = false,
    permission = "default" as NotificationPermission,
} = {}) {
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
        value: { permission },
    });
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: undefined,
    });
}

describe("PushNotificationToggle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupBrowserEnv();
    });

    afterEach(() => {
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
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ isSubscribed: true }),
        } as any);

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
            {},
            { onUnauthorized: "none" },
        );
    });

    it("non-standalone 상태: PWA 설치 안내 notice 표시", async () => {
        setupBrowserEnv({ isStandalone: false, permission: "default" });
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ isSubscribed: false }),
        } as any);

        render(<PushNotificationToggle meetingId="meet-1" isLoggedIn={true} />);

        await waitFor(() => {
            expect(screen.getByText(/홈 화면에 추가/)).toBeDefined();
        });
    });

    it("permission=denied 상태: 알림 설정 허용 안내 notice 표시", async () => {
        setupBrowserEnv({ isStandalone: true, permission: "denied" });
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ isSubscribed: false }),
        } as any);

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
});
