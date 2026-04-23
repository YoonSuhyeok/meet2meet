import { useEffect } from "react";
import { setStoredAuthToken } from "@/src/features/auth";

export default function Page() {
    useEffect(() => {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get("token");

        if (!token) {
            window.location.replace("/login?error=auth_failed");
            return;
        }

        setStoredAuthToken(token);
        window.history.replaceState(null, "", "/auth/callback");
        window.location.replace("/");
    }, []);

    return (
        <div className="py-16 text-center">
            <div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
    );
}
