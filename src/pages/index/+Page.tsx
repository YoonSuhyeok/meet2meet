import { useAuth } from "@/src/features/auth";

export default function Page() {
    const { user, loading } = useAuth();

    return (
        <div className="text-center py-16">
            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="mx-auto h-6 w-48 rounded bg-muted" />
                    <div className="mx-auto h-4 w-64 rounded bg-muted" />
                </div>
            ) : user ? (
                <>
                    <h1 className="text-2xl font-bold tracking-tight">
                        안녕하세요, {user.name}님
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        드래그 기반 시간 선택으로 모임 일정을 잡아보세요.
                    </p>
                    <a
                        href="/meeting/new"
                        className="mt-8 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        새 미팅 만들기
                    </a>
                </>
            ) : (
                <>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Meet2Meet
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        드래그 기반 시간 선택으로 모임 일정을 잡아보세요.
                    </p>
                    <a
                        href="/login"
                        className="mt-8 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        시작하기
                    </a>
                </>
            )}
        </div>
    );
}
