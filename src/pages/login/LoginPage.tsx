import { cn } from "@/src/shared";

const ERROR_MESSAGES: Record<string, string> = {
    auth_failed: "소셜 인증에 실패했습니다. 다시 시도해주세요.",
	token_exchange: "인증 처리 중 오류가 발생했습니다.",
	user_info: "사용자 정보를 가져올 수 없습니다.",
	server_error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
	session_expired: "로그인이 만료되었습니다. 다시 로그인해주세요.",
};

function NaverIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M13.56 10.7L6.15 0H0v20h6.44V9.3L13.85 20H20V0h-6.44v10.7z"
                fill="currentColor"
            />
        </svg>
    );
}

function KakaoIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M10 1C4.48 1 0 4.45 0 8.68c0 2.7 1.8 5.08 4.5 6.44-.15.56-.97 3.6-.99 3.83 0 0-.02.17.09.24.11.06.24.01.24.01.32-.05 3.7-2.44 4.28-2.86.6.09 1.23.14 1.88.14 5.52 0 10-3.45 10-7.8S15.52 1 10 1z"
                fill="currentColor"
            />
        </svg>
    );
}

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M19.6 10.23c0-.68-.06-1.36-.17-2.02H10v3.84h5.38a4.6 4.6 0 0 1-2 3.01v2.49h3.23c1.89-1.74 2.99-4.3 2.99-7.32z"
                fill="#4285F4"
            />
            <path
                d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H1.07v2.58A9.99 9.99 0 0 0 10 20z"
                fill="#34A853"
            />
            <path
                d="M4.4 11.91A6 6 0 0 1 4.08 10c0-.67.12-1.31.32-1.91V5.51H1.07A9.99 9.99 0 0 0 0 10c0 1.61.39 3.14 1.07 4.49l3.33-2.58z"
                fill="#FBBC05"
            />
            <path
                d="M10 3.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86C14.96.99 12.7 0 10 0A9.99 9.99 0 0 0 1.07 5.51L4.4 8.09C5.19 5.73 7.4 3.96 10 3.96z"
                fill="#EA4335"
            />
        </svg>
    );
}

const PROVIDERS = [
    {
        id: "naver",
        label: "네이버로 시작하기",
        icon: NaverIcon,
        className: "bg-[#03C75A] text-white hover:bg-[#02b351]",
    },
    {
        id: "kakao",
        label: "카카오로 시작하기",
        icon: KakaoIcon,
        className: "bg-[#FEE500] text-[#191919] hover:bg-[#e6cf00]",
    },
    {
        id: "google",
        label: "Google로 시작하기",
        icon: GoogleIcon,
        className:
            "border border-border bg-white text-foreground hover:bg-accent",
    },
] as const;

export function LoginPage({ error }: { error?: string | null }) {
    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <div className="w-full max-w-sm space-y-8 px-4">
                {/* 헤더 */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold tracking-tight">
                        Meet2Meet
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        소셜 계정으로 간편하게 시작하세요
                    </p>
                </div>

                {/* 에러 메시지 */}
                {error && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {ERROR_MESSAGES[error] ??
                            "알 수 없는 오류가 발생했습니다."}
                    </div>
                )}

                {/* OAuth 버튼 */}
                <div className="space-y-3">
                    {PROVIDERS.map(({ id, label, icon: Icon, className }) => (
                        <a
                            key={id}
                            href={`/api/auth/${id}`}
                            className={cn(
                                "flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                                className,
                            )}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {label}
                        </a>
                    ))}
                </div>

                {/* 하단 안내 */}
                <p className="text-center text-xs text-muted-foreground">
                    로그인 시{" "}
                    <a
                        href="/terms"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        이용약관
                    </a>{" "}
                    및{" "}
                    <a
                        href="/privacy"
                        className="underline underline-offset-2 hover:text-foreground"
                    >
                        개인정보처리방침
                    </a>
                    에 동의하는 것으로 간주합니다.
                </p>
            </div>
        </div>
    );
}
