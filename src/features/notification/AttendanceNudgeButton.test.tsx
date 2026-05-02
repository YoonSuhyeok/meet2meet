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
import { AttendanceNudgeButton } from "./AttendanceNudgeButton";

vi.mock("@/src/features/auth", () => ({
    apiFetch: vi.fn(),
}));

import { apiFetch } from "@/src/features/auth";

const mockApiFetch = vi.mocked(apiFetch);

describe("AttendanceNudgeButton", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("미응답자 수가 0이면 버튼 비활성화", () => {
        render(<AttendanceNudgeButton meetingId="m1" pendingCount={0} />);
        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("미응답자 수 > 0 이면 버튼 활성화", () => {
        render(<AttendanceNudgeButton meetingId="m1" pendingCount={3} />);
        expect(screen.getByRole("button")).not.toBeDisabled();
    });

    it("클릭 시 POST 전송 후 success 상태 표시", async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            status: 202,
            json: async () => ({
                nudgeId: "nid-1",
                meetingId: 1,
                targetCount: 3,
                queuedAt: "2026-05-02T12:00:00Z",
            }),
        } as any);

        render(<AttendanceNudgeButton meetingId="m1" pendingCount={3} />);
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByText(/독촉 발송 완료/)).toBeDefined();
        });

        // POST 완료 후 버튼 비활성화(재발송 방지)
        expect(screen.getByRole("button")).toBeDisabled();
        expect(screen.getByText(/추가 발송은 불가/)).toBeDefined();
    });

    it("409 응답 시 policy_rejected 메시지 표시", async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({
                message: "이미 수동 독촉을 발송했습니다.",
            }),
        } as any);

        render(<AttendanceNudgeButton meetingId="m1" pendingCount={2} />);
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeDefined();
            expect(
                screen.getByText(/이미 수동 독촉을 발송했습니다/),
            ).toBeDefined();
        });
    });

    it("네트워크 오류 시 error 메시지 표시", async () => {
        mockApiFetch.mockRejectedValueOnce(new Error("network error"));

        render(<AttendanceNudgeButton meetingId="m1" pendingCount={2} />);
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toBeDefined();
            expect(screen.getByText(/연결할 수 없습니다/)).toBeDefined();
        });
    });

    // 호스트 접근 제어: 이 컴포넌트 자체는 순수 UI — 렌더 여부는 호출부에서 결정.
    // 컴포넌트가 실수로 isHost prop을 무시하지 않음을 확인하는 대신
    // 상위 컴포넌트(meeting/detail/+Page.tsx)의 isHost 조건 gate를 테스트합니다.
    it("성공 후 버튼은 disabled이고 재클릭해도 apiFetch 재호출하지 않음", async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            status: 202,
            json: async () => ({
                nudgeId: "nid-2",
                meetingId: 1,
                targetCount: 1,
                queuedAt: "2026-05-02T12:00:00Z",
            }),
        } as any);

        render(<AttendanceNudgeButton meetingId="m1" pendingCount={1} />);
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());

        fireEvent.click(screen.getByRole("button"));
        expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });
});
