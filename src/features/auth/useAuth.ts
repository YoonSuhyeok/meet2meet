import { useCallback, useEffect, useState } from "react";
import { apiFetch, isStoredTokenExpired } from "./apiFetch";
import { clearStoredAuthToken, getStoredAuthToken } from "./token";

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
        const token = getStoredAuthToken();
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        // 토큰 자체를 클라이언트에서 먼저 검사해 네트워크 호출없이 만료 처리
        if (isStoredTokenExpired()) {
            clearStoredAuthToken();
            setUser(null);
            setLoading(false);
            return;
        }

        // apiFetch는 401 시 자동으로 /login으로 이동시키므로
        // 여기서는 단순히 모든 실패를 null로 묶으면 충분
        apiFetch("/api/auth/me")
            .then((res) => (res.ok ? (res.json() as Promise<User>) : null))
            .then((data) => setUser(data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const logout = useCallback(async () => {
        clearStoredAuthToken();
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        window.location.href = "/login";
    }, []);

    return { user, loading, logout };
}
