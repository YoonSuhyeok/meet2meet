import { useAuth } from "@/src/features/auth";

export function NavBar() {
    const { user, loading, logout } = useAuth();

    return (
        <nav className="flex items-center justify-between border-b border-border pb-4 mb-8">
            <a href="/" className="text-xl font-bold tracking-tight">
                Meet2Meet
            </a>

            <div className="flex items-center gap-3">
                {loading ? (
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                ) : user ? (
                    <>
                        {user.profileImage ? (
                            <img
                                src={user.profileImage}
                                alt={user.name}
                                className="h-8 w-8 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                {user.name.charAt(0)}
                            </div>
                        )}
                        <span className="text-sm font-medium">{user.name}</span>
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                            로그아웃
                        </button>
                    </>
                ) : (
                    <a
                        href="/login"
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        로그인
                    </a>
                )}
            </div>
        </nav>
    );
}
