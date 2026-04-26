import { useEffect } from "react";

export default function Page() {
    useEffect(() => {
        // 인증 쿠키는 서버에서 이미 설정되었으므로 홈으로 이동
        window.location.replace("/");
    }, []);

    return (
        <div className="py-16 text-center">
            <div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
    );
}
