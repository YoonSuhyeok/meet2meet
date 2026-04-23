import { useCallback, useEffect, useState } from "react";
import {
    clearStoredAuthToken,
    createAuthHeaders,
    getStoredAuthToken,
} from "./token";

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

        fetch("/api/auth/me", {
            headers: createAuthHeaders(),
        })
            .then((res) => {
                if (res.ok) {
                    return res.json();
                }

                if (res.status === 401) {
                    clearStoredAuthToken();
                }

                return null;
            })
            .then((data) => setUser(data as User | null))
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
