import { useEffect } from "react";
import { useAuth } from "@/src/features/auth";
import { LoginPage } from "./LoginPage";

export default function Page() {
    const { user, loading } = useAuth();
    const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
    );

    useEffect(() => {
        if (!loading && user) {
            window.location.href = "/";
        }
    }, [user, loading]);

    if (loading || user) {
        return null;
    }

    return <LoginPage error={params.get("error")} />;
}
