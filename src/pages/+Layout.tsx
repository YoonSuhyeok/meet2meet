import "@/src/app/styles/global.css";
import { useEffect } from "react";
import { NavBar } from "@/src/widgets/nav-bar";

export default function Layout({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("serviceWorker" in navigator)) return;
        if (import.meta.env.DEV) return;

        navigator.serviceWorker.register("/sw.js").catch(() => {
            // SW 등록 실패 시 앱 기능에 영향이 없도록 무시
        });
    }, []);

    return (
        <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
            <NavBar />
            {children}
        </div>
    );
}
