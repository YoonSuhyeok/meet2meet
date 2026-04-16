import { useCallback, useEffect, useState } from "react";

export type User = {
    id: string;
    name: string;
    email: string;
    profileImage: string;
    provider: string;
};

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => setUser(data as User | null))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    }, []);

    return { user, loading, logout };
}
