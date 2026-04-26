import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./apiFetch";

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
        // HttpOnly 쿠키 기반 세션 확인
        apiFetch("/api/auth/me")
            .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
            .then((data) => setUser(data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = useCallback(async () => {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
        }).catch(() => null);
        window.location.href = "/login";
    }, []);

    return { user, loading, logout };
}
