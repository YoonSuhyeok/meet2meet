import { BellRing } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/src/features/auth";
import { cn } from "@/src/shared";
import type { SendAttendanceNudgeResponse } from "@/src/types/notification";

interface AttendanceNudgeButtonProps {
    meetingId: string;
    /** 미응답자 수 — 0이면 버튼 비활성화 */
    pendingCount: number;
    className?: string;
}

type NudgeState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; targetCount: number; queuedAt: string }
    | { status: "policy_rejected"; message: string }
    | { status: "error"; message: string };

/**
 * 호스트 전용 AttendanceNudge 발송 버튼.
 * - 1회 성공 후 버튼 비활성화 (서버 정책: 수동 1회)
 * - success / policy_rejection / upstream error 상태를 인라인으로 표시
 */
export function AttendanceNudgeButton({
    meetingId,
    pendingCount,
    className,
}: AttendanceNudgeButtonProps) {
    const [nudge, setNudge] = useState<NudgeState>({ status: "idle" });

    const isDisabled =
        pendingCount <= 0 ||
        nudge.status === "loading" ||
        nudge.status === "success";

    async function handleNudge() {
        if (isDisabled) return;
        setNudge({ status: "loading" });

        try {
            const resp = await apiFetch(
                `/api/meetings/${meetingId}/attendance-nudges`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                },
            );

            if (resp.ok) {
                const data = (await resp.json()) as SendAttendanceNudgeResponse;
                setNudge({
                    status: "success",
                    targetCount: data.targetCount,
                    queuedAt: data.queuedAt,
                });
            } else if (resp.status === 409) {
                // 정책 상 이미 수동 nudge 사용함
                const data = (await resp.json()) as { message?: string };
                setNudge({
                    status: "policy_rejected",
                    message:
                        data.message ??
                        "이미 수동 독촉을 발송했습니다. 추가 발송은 불가합니다.",
                });
            } else if (resp.status === 422) {
                const data = (await resp.json()) as { message?: string };
                setNudge({
                    status: "policy_rejected",
                    message:
                        data.message ?? "독촉 발송 조건이 충족되지 않았습니다.",
                });
            } else {
                const data = (await resp.json()) as { message?: string };
                setNudge({
                    status: "error",
                    message:
                        data.message ??
                        "독촉 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
                });
            }
        } catch {
            setNudge({
                status: "error",
                message: "서버에 연결할 수 없습니다. 네트워크를 확인해주세요.",
            });
        }
    }

    return (
        <div className={cn("flex flex-col items-start gap-1.5", className)}>
            <button
                type="button"
                onClick={handleNudge}
                disabled={isDisabled}
                aria-busy={nudge.status === "loading"}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    nudge.status === "success"
                        ? "border-green-300 bg-green-50 text-green-700 cursor-default"
                        : nudge.status === "policy_rejected" ||
                            nudge.status === "error"
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-border bg-background hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
                )}
            >
                <BellRing className="h-4 w-4" />
                {nudge.status === "loading"
                    ? "발송 중…"
                    : nudge.status === "success"
                      ? `독촉 발송 완료 (${nudge.targetCount}명)`
                      : "미응답자 독촉 발송"}
            </button>

            {(nudge.status === "policy_rejected" ||
                nudge.status === "error") && (
                <p role="alert" className="text-xs text-destructive">
                    {nudge.message}
                </p>
            )}

            {nudge.status === "success" && (
                <p className="text-xs text-muted-foreground">
                    {nudge.targetCount}명에게 알림이 발송되었습니다. 이후 추가
                    발송은 불가합니다.
                </p>
            )}
        </div>
    );
}
